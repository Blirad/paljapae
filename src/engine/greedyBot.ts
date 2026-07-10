/**
 * 팔자전 — 탐욕 봇 (Greedy Bot)
 * Phase 1.9.5 업데이트: 10종 융합 특성 + 응축 확정판 (% 방식) 반영
 *
 * 목표:
 *  - 1층 평균 격파 공격 횟수: 2회 (±0.5)
 *  - 2층: 2~3회, 3층: 3~4회, 4층: 4~5회
 *  - 탐욕 봇 전체 클리어율: 50~60%
 *  - 원샷 클리어(1층 1회): <5%
 */

import {
  judgeCombo,
  GEUK_MAP,
} from './pokerHandJudge'
import type { Card, Element, GameState } from '../types/game'
import {
  createFixedDeck,
  shuffleDeck,
  playCards,
  applyCondense,
  getCondenseAvailability,
} from './paljajeonEngine'
import {
  FLOOR_CONFIGS,
  PLAYER_BASE_HP,
  HAND_SIZE,
  BASE_DISCARDS,
  GEUK_BONUS_MULTIPLIER,
  ANTI_GEUK_PENALTY,
  getCondenseMultiplier,
} from './balance'

/**
 * 조합(combination) 유틸: n장 중 k장 뽑기
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(combo => [first, ...combo])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

/**
 * Phase 1.9.5 — 예상 데미지 계산
 *
 * 로직:
 *  1. judgeCombo()로 조합 판정 (type + finishingElement + multiplier)
 *  2. 타격 속성(finishingElement) 기준으로 극/반극 판정
 *  3. 극 보너스: +70% (GEUK_BONUS_MULTIPLIER = 1.7)
 *  4. 반극 페널티: −40% (ANTI_GEUK_PENALTY = 0.6)
 *  5. E-1: 연환 yeonhwanUsed 체크 → 사용됐으면 0점
 *  6. E-2: 응축 % 방식 소모 — condensedMultiplier > 0이면 damage × (1 + multiplier)
 *  7. 저격(snipe, 깎은 화살) — 피해감소 건너뜀 가중치
 *  8. 번짐(wildfire, 들불) — carryoverBurn 이월 피해 가산
 *
 * 음양 조화 보너스는 이미 judgeCombo()에서 totalScore에 포함됨
 */
export function calcExpectedDamage(
  combo: Card[],
  enemyPrimaryElement: Element,
  _enemySubElement?: Element,
  condensedMultiplier?: number,
  yeonhwanUsed?: boolean,
  isLastAttack?: boolean,
  enemyHasDamageReduction?: boolean,
  carryoverBurn?: number,
): number {
  const result = judgeCombo(combo)
  let damage = result.totalScore
  const finishEl = result.finishingElement

  // E-1: 연환 1회 제한 — 이미 사용했으면 0
  if (result.type === 'ohang-yeonhwan' && yeonhwanUsed) {
    return 0
  }

  // 극 판정: 타격 속성(finishingElement) 기준
  const isGeuk = GEUK_MAP[finishEl] === enemyPrimaryElement
  const isAntiGeuk = GEUK_MAP[enemyPrimaryElement] === finishEl

  if (isGeuk) {
    damage = Math.round(damage * GEUK_BONUS_MULTIPLIER)
  } else if (isAntiGeuk) {
    damage = Math.round(damage * ANTI_GEUK_PENALTY)
  }

  // 번짐 이월 피해 가산
  if (carryoverBurn && carryoverBurn > 0) {
    damage = damage + carryoverBurn
  }

  // E-2: 응축 % 방식 소모 — condensedMultiplier > 0이면 damage * (1 + multiplier)
  if (condensedMultiplier && condensedMultiplier > 0) {
    damage = Math.round(damage * (1 + condensedMultiplier))
  } else if (!condensedMultiplier || condensedMultiplier === 0) {
    // 2턴 시야: 응축 기대값 평가 (마지막 공격이 아닌 경우만, 옹기가마 조합 한정)
    const condenseKind = getCondenseAvailability(result.name, finishEl)
    if (condenseKind === 'great' && !isLastAttack) {
      // % 방식: 이번 응축 → 다음 공격 damage × (1 + mult)
      // 기대값 = (0 + damage × (1 + mult)) / 2
      const mult = getCondenseMultiplier(combo.length)
      const condenseExpected = mult > 0 ? Math.round(damage * (1 + mult) / 2) : 0
      damage = Math.max(damage, condenseExpected)
    }
  }

  // 저격(snipe, 깎은 화살 金+木) — 피해감소 무시 가중치
  if (result.name === '깎은 화살' && enemyHasDamageReduction) {
    // 저격 시 피해감소 무시: 방어 30% 기준 가중치 반영
    damage = Math.round(damage / 0.7)
  }

  return damage
}

/**
 * 탐욕 봇 핸드 선택 (Phase 1.9.5 — 10종 융합 특성 + 응축 % 방식 갱신)
 * 유효한 조합만 선택하고, 그 중 최고 예상 데미지를 고르기
 */
export function greedySelectCards(
  hand: Card[],
  enemyPrimaryElement?: Element,
  enemySubElement?: Element,
  condensedMultiplier?: number,
  yeonhwanUsed?: boolean,
  isLastAttack?: boolean,
  enemyHasDamageReduction?: boolean,
  carryoverBurn?: number,
): string[] {
  if (hand.length === 0) return []

  let bestIds: string[] = []
  let bestScore = -1

  const maxCards = Math.min(5, hand.length)
  for (let k = 1; k <= maxCards; k++) {
    const combos = combinations(hand, k)
    for (const combo of combos) {
      const result = judgeCombo(combo)

      // 유효한 조합만 선택 (none 제외)
      if (result.type === 'none') continue

      // E-1: 연환 1회 제한 — 이미 사용했으면 오행연환 제외
      if (result.type === 'ohang-yeonhwan' && yeonhwanUsed) continue

      const score = enemyPrimaryElement
        ? calcExpectedDamage(
            combo,
            enemyPrimaryElement,
            enemySubElement,
            condensedMultiplier,
            yeonhwanUsed,
            isLastAttack,
            enemyHasDamageReduction,
            carryoverBurn,
          )
        : result.totalScore

      if (
        score > bestScore ||
        (score === bestScore && combo.length < bestIds.length)
      ) {
        bestScore = score
        bestIds = combo.map(c => c.id)
      }
    }
  }

  // 유효한 조합을 찾지 못한 경우, 단일 카드 선택 (최후의 수단)
  if (bestIds.length === 0 && hand.length > 0) {
    bestIds = [hand[0].id]
  }

  return bestIds
}

/**
 * LCG 난수 생성기 (재현 가능)
 */
export function makeLcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export interface FloorStats {
  floor: number
  attackCount: number
  cleared: boolean
}

export interface RunResult {
  victory: boolean
  floorsCleared: number
  deathFloor: number | null
  floorStats: FloorStats[]
  // Phase 1.9.5 통계
  condenseCount: number       // 응축 선택 횟수 (옹기가마 전용)
  wildfireCount: number       // 번짐(들불) 특성 발동 횟수
  snipeCount: number          // 저격(깎은 화살) 특성 발동 횟수
}

function createDeterministicState(floorIndex: number, rng: () => number): GameState {
  const floorConfig = FLOOR_CONFIGS[floorIndex]
  const seed = Math.floor(rng() * 0xffffffff)
  const deck = shuffleDeck(createFixedDeck(), seed)
  const hand = deck.slice(0, HAND_SIZE)
  const remainDeck = deck.slice(HAND_SIZE)

  return {
    currentFloor: floorConfig.floor,
    playerHp: PLAYER_BASE_HP,
    playerMaxHp: PLAYER_BASE_HP,
    enemyHp: floorConfig.enemyHp,
    enemyMaxHp: floorConfig.enemyHp,
    hand,
    deck: remainDeck,
    discardPile: [],
    selectedCards: [],
    discardsLeft: BASE_DISCARDS,
    playsLeft: floorConfig.maxPlays,
    phase: 'select',
    isVictory: false,
    floorsCleared: 0,
    talismans: [],
    amplifyActive: false,
    attackCount: 0,
    enemyPhaseSwitch: false,
    condenseActive: false,
    // Phase 1.9.2: 연환 희소화
    yeonhwanUsed: false,
    // Phase 1.9.5: 응축 확정판 (% 방식)
    condensedMultiplier: 0,
    isLastAttack: floorConfig.maxPlays === 1,
    // Phase 1.9.5: 10종 융합 특성
    lastTraitTriggered: undefined,
    carryoverBurn: 0,
    // Phase 1.9.4: 덱 재순환
    reshuffled: false,
  }
}

export function simulateGreedyRun(seed: number): RunResult {
  const rng = makeLcg(seed)

  let floor = 1
  let deathFloor: number | null = null
  let floorsCleared = 0
  const floorStats: FloorStats[] = []
  // Phase 1.9.5 통계 카운터
  let condenseCount = 0
  let wildfireCount = 0
  let snipeCount = 0

  let state = createDeterministicState(0, rng)
  let playerHp = PLAYER_BASE_HP

  while (floor <= 4) {
    if (floor > 1) {
      const nextSeed = Math.floor(rng() * 0xffffffff)
      const deck = shuffleDeck(createFixedDeck(), nextSeed)
      const hand = deck.slice(0, HAND_SIZE)
      const floorConfig = FLOOR_CONFIGS[floor - 1]
      state = {
        ...state,
        currentFloor: floor,
        enemyHp: floorConfig.enemyHp,
        enemyMaxHp: floorConfig.enemyHp,
        hand,
        deck: deck.slice(HAND_SIZE),
        discardPile: [],
        selectedCards: [],
        discardsLeft: BASE_DISCARDS,
        playsLeft: floorConfig.maxPlays,
        playerHp,
        phase: 'select',
        talismans: [],
        amplifyActive: false,
        attackCount: 0,
        enemyPhaseSwitch: false,
        condenseActive: false,
        // Phase 1.9.2: 층 전환 시 연환 리셋
        yeonhwanUsed: false,
        // Phase 1.9.5: 응축 확정판 리셋
        condensedMultiplier: 0,
        isLastAttack: floorConfig.maxPlays === 1,
        lastTraitTriggered: undefined,
        carryoverBurn: 0,
        reshuffled: false,
      }
    } else {
      state = { ...state, playerHp }
    }

    let attackCount = 0
    let floorDone = false

    while (!floorDone) {
      if (state.phase === 'floor-reward') {
        floorsCleared++
        floorStats.push({ floor, attackCount, cleared: true })
        playerHp = state.playerHp
        floor++
        floorDone = true
        break
      }

      if (state.phase === 'result') {
        if (state.isVictory) {
          floorsCleared = state.floorsCleared
          floorStats.push({ floor, attackCount, cleared: true })
        } else {
          deathFloor = floor
          floorStats.push({ floor, attackCount, cleared: false })
        }
        return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats, condenseCount, wildfireCount, snipeCount }
      }

      if (state.playsLeft <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, condenseCount, wildfireCount, snipeCount }
      }

      if (state.playerHp <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, condenseCount, wildfireCount, snipeCount }
      }

      // 층별 적 주/부 기운을 봇에 전달 (기운 전환 반영)
      const floorConf = FLOOR_CONFIGS[state.currentFloor - 1]
      const currentPrimaryEl = state.enemyPhaseSwitch
        ? floorConf.enemySubElement
        : floorConf.enemyPrimaryElement
      const currentSubEl = state.enemyPhaseSwitch
        ? floorConf.enemyPrimaryElement
        : floorConf.enemySubElement
      // 적 피해감소 여부 (저격 가중치용)
      const hasDmgReduction = floorConf.eliteGimmickEffect?.type === 'damage-reduction'

      // Phase 1.9.5: 응축 % 방식 + 번짐 이월 피해 봇에 전달
      const selectedIds = greedySelectCards(
        state.hand,
        currentPrimaryEl,
        currentSubEl,
        state.condensedMultiplier,
        state.yeonhwanUsed,
        state.isLastAttack,
        hasDmgReduction,
        state.carryoverBurn,
      )
      if (selectedIds.length === 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, condenseCount, wildfireCount, snipeCount }
      }

      // Phase 1.9.5: 봇 응축 학습 — % 방식 (옹기가마 전용)
      // 조건: 응축 미활성 AND 마지막 공격 기회 아님 AND 공격 횟수 2회 이상 남음
      if (
        state.condensedMultiplier === 0 &&
        !state.isLastAttack &&
        state.playsLeft >= 2
      ) {
        const selectedCards = state.hand.filter(c => selectedIds.includes(c.id))
        const comboResult = judgeCombo(selectedCards)
        const condenseKind = getCondenseAvailability(comboResult.name, comboResult.finishingElement)
        if (condenseKind === 'great') {
          // % 방식: 이번 피해를 포기하고 다음 공격에 (1 + mult) 배율 적용
          const mult = getCondenseMultiplier(selectedCards.length)
          if (mult > 0) {
            const currentDamage = calcExpectedDamage(
              selectedCards,
              currentPrimaryEl,
              currentSubEl,
              0,
              state.yeonhwanUsed,
              state.isLastAttack,
              hasDmgReduction,
            )
            // 응축 기대값: damage × (1 + mult) vs 즉시 공격 damage
            // 1.2배 이상이면 항상 응축 선택 (기대값이 20% 이상 높음)
            if (mult >= 1.2 && currentDamage > 0) {
              condenseCount++
              state = applyCondense(state, selectedIds)
              continue
            }
          }
        }
      }

      state = playCards(state, selectedIds)
      attackCount++
      playerHp = state.playerHp

      // 특성 발동 통계
      if (state.lastTraitTriggered === 'wildfire') wildfireCount++
      if (state.lastTraitTriggered === 'snipe') snipeCount++
    }
  }

  return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats, condenseCount, wildfireCount, snipeCount }
}

/**
 * 분포 통계 계산
 */
export interface DistStats {
  mean: number
  min: number
  max: number
  stddev: number
}

function calcStats(values: number[]): DistStats {
  if (values.length === 0) return { mean: 0, min: 0, max: 0, stddev: 0 }
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const min = Math.min(...values)
  const max = Math.max(...values)
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n
  const stddev = Math.sqrt(variance)
  return { mean, min, max, stddev }
}

/**
 * 탐욕 봇 1000판 시뮬레이션 실행
 */
export interface SimulationReport {
  runs: number
  clearRate: number
  oneShotClearRate: number
  floorAttacks: Record<number, DistStats>
  deathsByFloor: Record<number, number>
  csvLines: string[]
  // Phase 1.9.5 통계
  totalAttacks: number          // 전체 공격 횟수 (선택률 분모)
  condenseTotal: number         // 응축 선택 총 횟수 (옹기가마 전용)
  wildfireTotal: number         // 번짐 발동 총 횟수
  snipeTotal: number            // 저격 발동 총 횟수
  condenseRate: number          // 응축 선택률 (%)
  wildfireRate: number          // 번짐 발동률 (%)
  snipeRate: number             // 저격 발동률 (%)
}

export function runGreedySimulation(runs = 1000): SimulationReport {
  let victories = 0
  let oneShotClears = 0
  const floorAttackData: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] }
  const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  // Phase 1.9.5 통계 집계
  let totalAttacks = 0
  let condenseTotal = 0
  let wildfireTotal = 0
  let snipeTotal = 0

  for (let i = 0; i < runs; i++) {
    const result = simulateGreedyRun(i * 12345 + 7777)
    if (result.victory) victories++

    condenseTotal += result.condenseCount
    wildfireTotal += result.wildfireCount
    snipeTotal += result.snipeCount

    for (const fs of result.floorStats) {
      if (fs.cleared) {
        floorAttackData[fs.floor].push(fs.attackCount)
        if (fs.floor === 1 && fs.attackCount === 1) oneShotClears++
        totalAttacks += fs.attackCount
      } else if (result.deathFloor === fs.floor) {
        deathsByFloor[fs.floor] = (deathsByFloor[fs.floor] || 0) + 1
        totalAttacks += fs.attackCount
      }
    }
  }

  const clearRate = (victories / runs) * 100
  const oneShotClearRate = (oneShotClears / runs) * 100
  const floorAttacks: Record<number, DistStats> = {}
  for (let f = 1; f <= 4; f++) {
    floorAttacks[f] = calcStats(floorAttackData[f])
  }

  // 선택률: 응축은 공격 기회 소모 포함
  const totalOpportunities = totalAttacks + condenseTotal
  const condenseRate = totalOpportunities > 0 ? (condenseTotal / totalOpportunities) * 100 : 0
  const wildfireRate = totalOpportunities > 0 ? (wildfireTotal / totalOpportunities) * 100 : 0
  const snipeRate = totalOpportunities > 0 ? (snipeTotal / totalOpportunities) * 100 : 0

  const csvLines = [
    'floor,mean_attacks,min_attacks,max_attacks,stddev_attacks,cleared_runs',
    ...([1, 2, 3, 4].map(f => {
      const s = floorAttacks[f]
      const cleared = floorAttackData[f].length
      return `${f},${s.mean.toFixed(2)},${s.min},${s.max},${s.stddev.toFixed(2)},${cleared}`
    })),
  ]

  return {
    runs,
    clearRate,
    oneShotClearRate,
    floorAttacks,
    deathsByFloor,
    csvLines,
    totalAttacks,
    condenseTotal,
    wildfireTotal,
    snipeTotal,
    condenseRate,
    wildfireRate,
    snipeRate,
  }
}
