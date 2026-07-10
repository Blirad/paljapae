/**
 * 팔자전 — 탐욕 봇 (Greedy Bot)
 * Phase 1.7 업데이트: 신규 로직 3종 반영
 *  - 적 사주(주/부 기운) 반영한 극 보너스(+25%)
 *  - 강공(heavyAttack) 피해 누적
 *  - 가호 봉인(seal-passives) 효과 시뮬
 *
 * 목표:
 *  - 1층 평균 격파 공격 횟수: 2회 (±0.5)
 *  - 2층: 2~3회, 3층: 3~4회, 4층: 4~5회
 *  - 탐욕 봇 전체 클리어율: 50~60%
 *  - 원샷 클리어(1층 1회): <5%
 */

import {
  judgeHand,
  detectElementClash,
  GEUK_MAP,
} from './pokerHandJudge'
import type { Card, Element, GameState } from '../types/game'
import {
  createFixedDeck,
  shuffleDeck,
  playCards,
} from './paljajeonEngine'
import { FLOOR_CONFIGS, PLAYER_BASE_HP, HAND_SIZE, BASE_DISCARDS, SUB_GEUK_BONUS } from './balance'

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
 * Phase 1.8 — 마무리 기운 기반 예상 데미지 계산
 * (마무리 기운 극 +70%/+10%, 부 기운 극 +25%, 충돌 -30%, 반극 -40%)
 * 토 응축: 마무리 기운이 to이면 즉시 ×0.6 + 다음 턴 ×1.6
 */
export function calcExpectedDamage(
  combo: Card[],
  enemyPrimaryElement: Element,
  enemySubElement?: Element,
  condenseActive?: boolean,
): number {
  const result = judgeHand(combo)
  let damage = result.totalScore
  const finishEl = result.finishingElement

  // A-1: 기운 충돌 -30%
  const clashes = detectElementClash(combo)
  if (clashes.length > 0) {
    damage = Math.round(damage * 0.7)
  }

  // Phase 1.8: 마무리 기운 기준 극 보너스
  const finishGeuksEnemy = GEUK_MAP[finishEl] === enemyPrimaryElement
  const anyGeuksEnemy = combo.some(c => GEUK_MAP[c.element] === enemyPrimaryElement)
  let mainGeukApplied = false
  if (finishGeuksEnemy) {
    damage = Math.round(damage * 1.7)
    mainGeukApplied = true
  } else if (anyGeuksEnemy) {
    damage = Math.round(damage * 1.1)
    mainGeukApplied = true
  }

  // Phase 1.7: 부 기운 극 보너스 +25% (주 기운 극 미적용 시만)
  if (!mainGeukApplied && enemySubElement) {
    const hasSubGeuk = combo.some(c => GEUK_MAP[c.element] === enemySubElement)
    if (hasSubGeuk) {
      damage = Math.round(damage * SUB_GEUK_BONUS)
    }
  }

  // Phase 1.8: 마무리 기운이 적에 의해 극 당하면 -40%
  const enemyGeuksFinish = GEUK_MAP[enemyPrimaryElement] === finishEl
  if (enemyGeuksFinish) {
    damage = Math.round(damage * 0.6)
  }

  // Phase 1.8: 토 응축 — 다음 턴 ×1.6 보상 고려
  // condenseActive=true: 이번 턴에 응축 소모 → ×1.6
  if (condenseActive) {
    damage = Math.round(damage * 1.6)
  }

  // 토 마무리: 즉시 ×0.6 (응축 적립 → 다음 턴 보상)
  // 봇은 토 조합의 즉시 피해가 낮아도 다음 턴 보상(1.6)을 기대치에 반영
  if (finishEl === 'to' && !condenseActive) {
    // 즉시 피해 ×0.6이지만 다음 턴 기대 보상 factor 추가 (0.6 * 1.6 = 0.96 ≈ 손해 없음으로 간주)
    damage = Math.round(damage * 0.6)
    // 봇은 다음 턴 응축 보상을 기대값 +60% 보정으로 반영
    damage = Math.round(damage * 1.4)  // 0.6 * 1.4 ≈ 0.84 (보수적 추정)
  }

  return damage
}

/**
 * 탐욕 봇 핸드 선택 (Phase 1.8 — 마무리 기운 + 토 응축 반영)
 */
export function greedySelectCards(
  hand: Card[],
  enemyPrimaryElement?: Element,
  enemySubElement?: Element,
  condenseActive?: boolean,
): string[] {
  if (hand.length === 0) return []

  let bestIds: string[] = []
  let bestScore = -1

  const maxCards = Math.min(5, hand.length)
  for (let k = 1; k <= maxCards; k++) {
    const combos = combinations(hand, k)
    for (const combo of combos) {
      const score = enemyPrimaryElement
        ? calcExpectedDamage(combo, enemyPrimaryElement, enemySubElement, condenseActive)
        : judgeHand(combo).totalScore
      if (
        score > bestScore ||
        (score === bestScore && combo.length < bestIds.length)
      ) {
        bestScore = score
        bestIds = combo.map(c => c.id)
      }
    }
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
  }
}

export function simulateGreedyRun(seed: number): RunResult {
  const rng = makeLcg(seed)

  let floor = 1
  let deathFloor: number | null = null
  let floorsCleared = 0
  const floorStats: FloorStats[] = []

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
        return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats }
      }

      if (state.playsLeft <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats }
      }

      if (state.playerHp <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats }
      }

      // Phase 1.7: 층별 적 주/부 기운을 봇에 전달 (기운 전환 반영)
      const floorConf = FLOOR_CONFIGS[state.currentFloor - 1]
      const currentPrimaryEl = state.enemyPhaseSwitch
        ? floorConf.enemySubElement
        : floorConf.enemyPrimaryElement
      const currentSubEl = state.enemyPhaseSwitch
        ? floorConf.enemyPrimaryElement
        : floorConf.enemySubElement
      // Phase 1.8: 토 응축 상태 봇에 전달
      const selectedIds = greedySelectCards(state.hand, currentPrimaryEl, currentSubEl, state.condenseActive)
      if (selectedIds.length === 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats }
      }

      state = playCards(state, selectedIds)
      attackCount++
      playerHp = state.playerHp
    }
  }

  return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats }
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
}

export function runGreedySimulation(runs = 1000): SimulationReport {
  let victories = 0
  let oneShotClears = 0
  const floorAttackData: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] }
  const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

  for (let i = 0; i < runs; i++) {
    const result = simulateGreedyRun(i * 12345 + 7777)
    if (result.victory) victories++

    for (const fs of result.floorStats) {
      if (fs.cleared) {
        floorAttackData[fs.floor].push(fs.attackCount)
        if (fs.floor === 1 && fs.attackCount === 1) oneShotClears++
      } else if (result.deathFloor === fs.floor) {
        deathsByFloor[fs.floor] = (deathsByFloor[fs.floor] || 0) + 1
      }
    }
  }

  const clearRate = (victories / runs) * 100
  const oneShotClearRate = (oneShotClears / runs) * 100
  const floorAttacks: Record<number, DistStats> = {}
  for (let f = 1; f <= 4; f++) {
    floorAttacks[f] = calcStats(floorAttackData[f])
  }

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
  }
}
