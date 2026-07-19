/**
 * 팔자전 — 상성 인지 봇 (Affinity Bot)
 * Phase 1.9.5 기반 — 상생상극 매트릭스 인지 전략
 *
 * 전략:
 *  1. 극 우선: 콤보 대표 원소가 적 원소를 극하는 조합 우선 선택 (×1.5)
 *  2. 생 회피: 콤보 대표 원소가 적 원소를 생하는 조합 회피 (×0.5 페널티)
 *  3. 버리기 사용: 핸드 전체 최선 콤보의 상성 배율이 1.0 이하(생 또는 중립 불리)이고
 *                  discardsLeft > 0이면 버리기 선택
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
  discardCards,
  applyCondense,
  getCondenseAvailability,
} from './paljajeonEngine'
import {
  FLOOR_CONFIGS,
  PLAYER_BASE_HP,
  HAND_SIZE,
  BASE_DISCARDS,
  SANG_MAP,
  GEUK_BONUS_MULTIPLIER,
  SANG_PENALTY_MULTIPLIER,
  ANTI_GEUK_PENALTY,
  YIKSEANG_MAP,
  YIKSEANG_MULT,
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
 * 콤보 대표 원소 판정 (paljajeonEngine.ts 다수결 로직과 동일)
 * 다수결: 가장 많이 등장한 원소. 동수 시: 마지막 카드 원소
 */
function getRepresentativeElement(cards: Card[]): Element {
  const counts: Record<string, number> = {}
  for (const c of cards) {
    counts[c.element] = (counts[c.element] ?? 0) + 1
  }
  let maxCount = 0
  let repCandidate: Element = cards[cards.length - 1].element
  for (const [el, cnt] of Object.entries(counts)) {
    if (cnt > maxCount) {
      maxCount = cnt
      repCandidate = el as Element
    }
  }
  // 동수 시: 마지막 카드 원소
  const maxEntries = Object.entries(counts).filter(([, cnt]) => cnt === maxCount)
  if (maxEntries.length > 1) {
    return cards[cards.length - 1].element
  }
  return repCandidate
}

/**
 * 상성 배율 계산 (대표 원소 vs 적 주 원소)
 * - 극(剋): 내 대표 원소가 적을 극 → ×1.5
 * - 생(生): 내 대표 원소가 적을 생 → ×0.5
 * - 역극: 적이 내 대표 원소를 극 → ×0.75
 * - 동기/적이 나를 생 → ×1.0
 */
function getAffinityMultiplier(repEl: Element, enemyEl: Element): number {
  if (GEUK_MAP[repEl] === enemyEl) return GEUK_BONUS_MULTIPLIER    // ×1.7 극
  if (SANG_MAP[repEl] === enemyEl) return SANG_PENALTY_MULTIPLIER  // ×0.5 생
  if (GEUK_MAP[enemyEl] === repEl) return ANTI_GEUK_PENALTY        // ×0.75 역극
  if (YIKSEANG_MAP[repEl] === enemyEl) return YIKSEANG_MULT        // ×1.2 역생
  return 1.0  // 동기
}

/**
 * 상성 인지 봇 — 예상 데미지 계산
 * greedyBot의 calcExpectedDamage와 달리 대표 원소(repEl) 기반 상성을 우선 반영
 */
export function affinityCalcExpectedDamage(
  combo: Card[],
  enemyPrimaryElement: Element,
  _enemySubElement?: Element,
  condensedMultiplier?: number,
  yeonhwanUsed?: boolean,
  carryoverBurn?: number,
): number {
  const result = judgeCombo(combo)
  let damage = result.totalScore

  // 연환 1회 제한 — 이미 사용했으면 0
  if (result.type === 'ohang-yeonhwan' && yeonhwanUsed) {
    return 0
  }

  // 번짐 이월 피해 가산
  if (carryoverBurn && carryoverBurn > 0) {
    damage = damage + carryoverBurn
  }

  // 대표 원소 기반 상성 배율 적용
  const repEl = getRepresentativeElement(combo)
  const affinityMult = getAffinityMultiplier(repEl, enemyPrimaryElement)
  damage = Math.round(damage * affinityMult)

  // 응축 % 방식 소모
  if (condensedMultiplier && condensedMultiplier > 0) {
    damage = Math.round(damage * (1 + condensedMultiplier))
  }

  return damage
}

/**
 * 상성 인지 봇 핸드 선택
 *
 * 전략:
 *  1. 모든 유효 조합에서 상성 배율(affinityMult)을 계산
 *  2. 가장 높은 affinityMult를 가진 조합 중 최고 데미지 선택
 *  3. 최선 콤보의 affinityMult <= 1.0 AND discardsLeft > 0 → 버리기 신호 반환
 *
 * 반환: { cardIds: string[], shouldDiscard: boolean }
 */
export interface AffinityPlayDecision {
  cardIds: string[]
  shouldDiscard: boolean
  bestAffinityMult: number
}

export function affinitySelectCards(
  hand: Card[],
  enemyPrimaryElement?: Element,
  enemySubElement?: Element,
  condensedMultiplier?: number,
  yeonhwanUsed?: boolean,
  discardsLeft?: number,
  carryoverBurn?: number,
): AffinityPlayDecision {
  if (hand.length === 0) return { cardIds: [], shouldDiscard: false, bestAffinityMult: 1.0 }

  let bestIds: string[] = []
  let bestScore = -1
  let bestAffinityMult = 0

  const maxCards = Math.min(5, hand.length)
  for (let k = 1; k <= maxCards; k++) {
    const combos = combinations(hand, k)
    for (const combo of combos) {
      const result = judgeCombo(combo)

      // 유효한 조합만 선택 (none 제외)
      if (result.type === 'none') continue

      // 연환 1회 제한
      if (result.type === 'ohang-yeonhwan' && yeonhwanUsed) continue

      if (!enemyPrimaryElement) {
        const score = result.totalScore
        if (score > bestScore || (score === bestScore && combo.length < bestIds.length)) {
          bestScore = score
          bestIds = combo.map(c => c.id)
          bestAffinityMult = 1.0
        }
        continue
      }

      // 오행연환 특수 처리: 5원소 동수 시 마지막 카드 원소가 대표 원소
      // → 적을 극하는 원소 카드를 마지막에 배치해 극 배율 최대화
      let evalCombo = combo
      if (result.type === 'ohang-yeonhwan') {
        // 극하는 원소(GEUK_MAP[el] === enemyPrimaryElement)를 마지막에 배치
        const geukEl = Object.entries(GEUK_MAP).find(([, v]) => v === enemyPrimaryElement)?.[0] as Element | undefined
        if (geukEl) {
          const geukIdx = combo.findIndex(c => c.element === geukEl)
          if (geukIdx !== -1 && geukIdx !== combo.length - 1) {
            evalCombo = [...combo.filter((_, i) => i !== geukIdx), combo[geukIdx]]
          }
        }
      }

      // 대표 원소 상성 배율
      const repEl = getRepresentativeElement(evalCombo)
      const affinityMult = getAffinityMultiplier(repEl, enemyPrimaryElement)

      const score = affinityCalcExpectedDamage(
        evalCombo,
        enemyPrimaryElement,
        enemySubElement,
        condensedMultiplier,
        yeonhwanUsed,
        carryoverBurn,
      )

      // 우선순위: 1) 상성 배율 높을수록 우선 2) 동일 배율 내 데미지 높을수록 우선 3) 동일 데미지 시 카드 수 적게
      const isBetter =
        affinityMult > bestAffinityMult ||
        (affinityMult === bestAffinityMult && score > bestScore) ||
        (affinityMult === bestAffinityMult && score === bestScore && combo.length < bestIds.length)

      if (isBetter) {
        bestScore = score
        // 오행연환 카드 순서 재배열 반영: evalCombo 순서로 ID 저장
        bestIds = evalCombo.map(c => c.id)
        bestAffinityMult = affinityMult
      }
    }
  }

  // 유효한 조합 없으면 단일 카드 선택 (최후의 수단)
  if (bestIds.length === 0 && hand.length > 0) {
    bestIds = [hand[0].id]
    bestAffinityMult = 1.0
  }

  // 버리기 판단: 최선 상성 배율이 생(×0.5) 수준일 때만 버리기
  // 역극(×0.75)이나 동기(×1.0)는 그냥 공격하는 것이 유리
  const shouldDiscard =
    enemyPrimaryElement !== undefined &&
    bestAffinityMult <= SANG_PENALTY_MULTIPLIER &&
    (discardsLeft ?? 0) > 0 &&
    bestIds.length > 0

  return { cardIds: bestIds, shouldDiscard, bestAffinityMult }
}

export interface AffinityRunResult {
  victory: boolean
  floorsCleared: number
  deathFloor: number | null
  floorStats: Array<{ floor: number; attackCount: number; cleared: boolean }>
  discardCount: number  // 버리기 사용 총 횟수
  condenseCount: number
}

function makeLcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
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
    relics: [],
    amplifyActive: false,
    attackCount: 0,
    enemyPhaseSwitch: false,
    condenseActive: false,
    yeonhwanUsed: false,
    condensedMultiplier: 0,
    isLastAttack: floorConfig.maxPlays === 1,
    lastTraitTriggered: undefined,
    carryoverBurn: 0,
    reshuffled: false,
    // 배치 2 §1: 가호 v2 신규 필드 — 엔진 정본과 동치 (rngState는 층별 seed 파생)
    rngState: (seed ^ 0x9E3779B9) >>> 0,
    geoptaeStealDamage: 0,
    sikshinRicegrains: 0,
    bigyeonCopyUsed: false,
    jeonginUsed: false,
    jeonginBuff: false,
  }
}

export function simulateAffinityRun(seed: number): AffinityRunResult {
  const rng = makeLcg(seed)

  let floor = 1
  let deathFloor: number | null = null
  let floorsCleared = 0
  const floorStats: Array<{ floor: number; attackCount: number; cleared: boolean }> = []
  let discardCount = 0
  let condenseCount = 0

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
        yeonhwanUsed: false,
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
        return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats, discardCount, condenseCount }
      }

      if (state.playsLeft <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount }
      }

      if (state.playerHp <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount }
      }

      // 층별 적 주/부 기운 (기운 전환 반영)
      const floorConf = FLOOR_CONFIGS[state.currentFloor - 1]
      const currentPrimaryEl = state.enemyPhaseSwitch
        ? floorConf.enemySubElement
        : floorConf.enemyPrimaryElement
      const currentSubEl = state.enemyPhaseSwitch
        ? floorConf.enemyPrimaryElement
        : floorConf.enemySubElement

      // 상성 인지 봇 카드 선택
      const decision = affinitySelectCards(
        state.hand,
        currentPrimaryEl,
        currentSubEl,
        state.condensedMultiplier,
        state.yeonhwanUsed,
        state.discardsLeft,
        state.carryoverBurn,
      )

      if (decision.cardIds.length === 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount }
      }

      // 버리기 전략: 상성 불리(affinityMult <= 1.0) + 버리기 남아있음
      if (decision.shouldDiscard && state.discardsLeft > 0) {
        // 핸드에서 상성에 가장 불리한 카드를 버린다 (최선 콤보의 카드들)
        state = discardCards(state, decision.cardIds)
        discardCount++
        continue
      }

      // 응축 전략: 옹기가마 조합이고 조건 충족 시 응축
      if (
        state.condensedMultiplier === 0 &&
        !state.isLastAttack &&
        state.playsLeft >= 2
      ) {
        const selectedCards = state.hand.filter(c => decision.cardIds.includes(c.id))
        const comboResult = judgeCombo(selectedCards)
        const condenseKind = getCondenseAvailability(comboResult.name, comboResult.finishingElement)
        if (condenseKind === 'great') {
          const mult = getCondenseMultiplier(selectedCards.length)
          if (mult >= 1.2) {
            condenseCount++
            state = applyCondense(state, decision.cardIds)
            continue
          }
        }
      }

      state = playCards(state, decision.cardIds)
      attackCount++
      playerHp = state.playerHp
    }
  }

  return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats, discardCount, condenseCount }
}

export interface AffinitySimReport {
  runs: number
  clearRate: number
  avgFloorsCleared: number
  totalDiscards: number
  discardsPerRun: number
  deathsByFloor: Record<number, number>
  victories: number
}

export function runAffinitySimulation(runs = 1000): AffinitySimReport {
  let victories = 0
  let totalFloors = 0
  let totalDiscards = 0
  const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

  for (let i = 0; i < runs; i++) {
    const result = simulateAffinityRun(i * 12345 + 7777)
    if (result.victory) victories++
    totalFloors += result.floorsCleared
    totalDiscards += result.discardCount
    if (!result.victory && result.deathFloor !== null) {
      deathsByFloor[result.deathFloor] = (deathsByFloor[result.deathFloor] ?? 0) + 1
    }
  }

  return {
    runs,
    clearRate: (victories / runs) * 100,
    avgFloorsCleared: totalFloors / runs,
    totalDiscards,
    discardsPerRun: totalDiscards / runs,
    deathsByFloor,
    victories,
  }
}
