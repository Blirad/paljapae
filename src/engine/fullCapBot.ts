/**
 * 팔자전 — 풀능력 봇 (Full Capability Bot)
 * affinityBot 기반 업그레이드:
 *  1. 응축 조건 개선 (적 HP 대비 딜 부족 시)
 *  2. 버리기 활용 (affinityBot 로직 유지)
 *  3. 용신 보너스 고려 (favorableElement 카드 가중치)
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
  applyRewardOption,
} from './paljajeonEngine'
import type { RewardOption } from './paljajeonEngine'
import { generateSajuDeck } from './deckGenerator'
import {
  FLOOR_CONFIGS,
  PLAYER_BASE_HP,
  HAND_SIZE,
  BASE_DISCARDS,
  SANG_MAP,
  GEUK_BONUS_MULTIPLIER,
  SANG_PENALTY_MULTIPLIER,
  ANTI_GEUK_PENALTY,
  getCondenseMultiplier,
  FUSION_TRAIT_MAP,
  YONGSIN_BONUS_MULTIPLIER,
  YONGSIN_CHAIN_MULTIPLIER,
  getRandomFloorElements,
} from './balance'
import { getFavorableElement } from './manseryeok'

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(combo => [first, ...combo])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

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
  const maxEntries = Object.entries(counts).filter(([, cnt]) => cnt === maxCount)
  if (maxEntries.length > 1) {
    return cards[cards.length - 1].element
  }
  return repCandidate
}

function getAffinityMultiplier(repEl: Element, enemyEl: Element): number {
  if (GEUK_MAP[repEl] === enemyEl) return GEUK_BONUS_MULTIPLIER
  if (SANG_MAP[repEl] === enemyEl) return SANG_PENALTY_MULTIPLIER
  if (GEUK_MAP[enemyEl] === repEl) return ANTI_GEUK_PENALTY
  return 1.0
}

/**
 * 풀능력 봇 — 예상 데미지 계산
 * affinityBot 대비 추가:
 *  - 용신 보너스 가중치
 */
export function fullCapCalcExpectedDamage(
  combo: Card[],
  enemyPrimaryElement: Element,
  _enemySubElement?: Element,
  condensedMultiplier?: number,
  yeonhwanUsed?: boolean,
  carryoverBurn?: number,
  favorableElement?: Element,
): number {
  const result = judgeCombo(combo)
  let damage = result.totalScore

  if (result.type === 'ohang-yeonhwan' && yeonhwanUsed) {
    return 0
  }

  // 번짐 이월 피해 가산
  if (carryoverBurn && carryoverBurn > 0) {
    damage = damage + carryoverBurn
  }

  // 대표 원소 기반 상성 배율
  const repEl = getRepresentativeElement(combo)
  const affinityMult = getAffinityMultiplier(repEl, enemyPrimaryElement)
  damage = Math.round(damage * affinityMult)

  // 응축 % 방식 소모
  if (condensedMultiplier && condensedMultiplier > 0) {
    damage = Math.round(damage * (1 + condensedMultiplier))
  }

  // [신규 2-4] 용신 보너스 가중치 (엔진에서 실제 적용되는 보너스를 봇 평가에도 반영)
  if (favorableElement) {
    const hasYongsin = combo.some(c => c.element === favorableElement)
    if (hasYongsin) {
      const isChain3Plus = combo.length >= 3
      const lastCard = combo[combo.length - 1]
      const lastIsYongsin = lastCard?.element === favorableElement
      if (isChain3Plus && lastIsYongsin) {
        damage = Math.round(damage * YONGSIN_CHAIN_MULTIPLIER)
      } else {
        damage = Math.round(damage * YONGSIN_BONUS_MULTIPLIER)
      }
    }
  }

  return damage
}

export interface FullCapPlayDecision {
  cardIds: string[]
  shouldDiscard: boolean
  bestAffinityMult: number
  bestDamage: number
}

/**
 * 풀능력 봇 핸드 선택
 */
export function fullCapSelectCards(
  hand: Card[],
  enemyPrimaryElement?: Element,
  enemySubElement?: Element,
  condensedMultiplier?: number,
  yeonhwanUsed?: boolean,
  discardsLeft?: number,
  carryoverBurn?: number,
  favorableElement?: Element,
): FullCapPlayDecision {
  if (hand.length === 0) return { cardIds: [], shouldDiscard: false, bestAffinityMult: 1.0, bestDamage: 0 }

  let bestIds: string[] = []
  let bestScore = -1
  let bestAffinityMult = 0

  const maxCards = Math.min(5, hand.length)
  for (let k = 1; k <= maxCards; k++) {
    const combos = combinations(hand, k)
    for (const combo of combos) {
      const result = judgeCombo(combo)
      if (result.type === 'none') continue
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

      // 오행연환 특수 처리: 극하는 원소를 마지막에 배치
      let evalCombo = combo
      if (result.type === 'ohang-yeonhwan') {
        const geukEl = Object.entries(GEUK_MAP).find(([, v]) => v === enemyPrimaryElement)?.[0] as Element | undefined
        if (geukEl) {
          const geukIdx = combo.findIndex(c => c.element === geukEl)
          if (geukIdx !== -1 && geukIdx !== combo.length - 1) {
            evalCombo = [...combo.filter((_, i) => i !== geukIdx), combo[geukIdx]]
          }
        }
      }

      const repEl = getRepresentativeElement(evalCombo)
      const affinityMult = getAffinityMultiplier(repEl, enemyPrimaryElement)

      const score = fullCapCalcExpectedDamage(
        evalCombo,
        enemyPrimaryElement,
        enemySubElement,
        condensedMultiplier,
        yeonhwanUsed,
        carryoverBurn,
        favorableElement,
      )

      // 통합 최대화: 최종 기대 데미지(콤보 × 상성 × 용신 통합) 순수 최대화
      const isBetter =
        score > bestScore ||
        (score === bestScore && combo.length < bestIds.length)

      if (isBetter) {
        bestScore = score
        bestIds = evalCombo.map(c => c.id)
        bestAffinityMult = affinityMult
      }
    }
  }

  if (bestIds.length === 0 && hand.length > 0) {
    bestIds = [hand[0].id]
    bestAffinityMult = 1.0
  }

  // 버리기 판단: 생(×0.5) 수준일 때만 버리기 (affinityBot 동일)
  const shouldDiscard =
    enemyPrimaryElement !== undefined &&
    bestAffinityMult <= SANG_PENALTY_MULTIPLIER &&
    (discardsLeft ?? 0) > 0 &&
    bestIds.length > 0

  return { cardIds: bestIds, shouldDiscard, bestAffinityMult, bestDamage: bestScore }
}

// --- 시뮬레이션 ---

export interface FullCapRunResult {
  victory: boolean
  floorsCleared: number
  deathFloor: number | null
  floorStats: Array<{ floor: number; attackCount: number; cleared: boolean }>
  discardCount: number
  condenseCount: number
  fusionCount: number
}

function makeLcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export interface FullCapSimOptions {
  /** 사주 덱 오행 분포 (없으면 균등 덱) */
  elementDist?: Record<Element, number>
  /**
   * 용신 원소 (직접 지정).
   * ilganElement와 동시에 지정 시 favorableElement 우선.
   */
  favorableElement?: Element
  /**
   * 일간 원소 — 엔진의 getFavorableElement() 함수로 용신 자동 도출.
   * favorableElement가 없을 때만 사용.
   * (작업 2: 용신 하드코딩 제거)
   */
  ilganElement?: Element
  /**
   * 어블레이션용: R1 고정 배치 사용 여부
   * true이면 getRandomFloorElements를 스킵하고 R1 고정 배치 사용
   */
  useFixedFloorElements?: boolean
  /**
   * 층 보상 포함 여부 (기본값: false)
   * true이면 층 클리어 시 카드 3장 제시 → 기대 데미지 최대화 선택 (작업 3)
   */
  enableFloorReward?: boolean
}

/**
 * R1 고정 배치 (어블레이션용)
 * HP/maxPlays/기믹 등은 R2 현재값 유지, 원소만 R1 기준으로 고정
 */
const R1_FIXED_FLOOR_ELEMENTS: Array<{ primaryElement: Element; subElement: Element }> = [
  { primaryElement: 'mok', subElement: 'hwa' },  // 1층
  { primaryElement: 'hwa', subElement: 'geum' }, // 2층
  { primaryElement: 'to',  subElement: 'su' },   // 3층
  { primaryElement: 'geum', subElement: 'mok' }, // 4층
]

/**
 * 덱 기대 데미지 점수 추정 (작업 3 — 간소화 방안)
 * 덱 내 오행별 카드 수 × 해당 오행의 nextFloorEnemyElement 대비 상성 배율로 가중 합산.
 * 용신 원소 카드에 YONGSIN_BONUS_MULTIPLIER 추가 가중치 적용.
 *
 * @param deck 평가 대상 덱 (후보 카드 추가된 임시 덱)
 * @param nextEnemyEl 다음 층 적 주 원소 (없으면 기댓값 1.0)
 * @param favorableEl 용신 원소 (있으면 가중치 추가)
 */
function evaluateDeckDamageScore(
  deck: Card[],
  nextEnemyEl: Element | undefined,
  favorableEl: Element | undefined,
): number {
  let score = 0
  for (const card of deck) {
    let cardWeight = card.value  // 카드값 기반 기본 가중치
    if (nextEnemyEl) {
      cardWeight *= getAffinityMultiplier(card.element, nextEnemyEl)
    }
    if (favorableEl && card.element === favorableEl) {
      cardWeight *= YONGSIN_BONUS_MULTIPLIER
    }
    score += cardWeight
  }
  return score
}

/**
 * R4 층 보상 3택 — 기대 데미지 비교 선택 (작업 2)
 *
 * 3가지 옵션 각각의 기대 데미지 점수를 계산해 최대 선택:
 *  a. 카드 획득: 카드풀에서 무작위 1장 → 덱에 추가 시 점수
 *  b. 카드 강화: 기대 데미지 최고 카드 × 1.5 → 덱 갱신 시 점수
 *  c. 카드 제거: 기대 데미지 최저 카드 제거 → 덱 갱신 시 점수
 *
 * @param currentDeck 현재 덱 (층 클리어 후 보유 카드 전체)
 * @param rng 결정론적 난수 함수
 * @param nextEnemyEl 다음 층 적 주 원소 (없으면 기댓값 1.0)
 * @param favorableEl 용신 원소
 * @returns 선택된 카드 1장 (a 선택 시 추가 카드, b/c 선택 시 undefined — rewardCards에 저장 방식 변경)
 */
function selectFloorReward(
  currentDeck: Card[],
  rng: () => number,
  nextEnemyEl?: Element,
  favorableEl?: Element,
): { type: 'add-card'; card: Card } | { type: 'upgrade-card'; targetId: string } | { type: 'remove-card'; targetId: string } {
  const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

  // ── 옵션 a: 카드 획득 — 무작위 카드 1장 생성
  const elIdx = Math.floor(rng() * ELEMENTS.length)
  const el = ELEMENTS[elIdx]
  const value = Math.floor(rng() * 10) + 1
  const newCard: Card = {
    id: `reward-${Date.now()}-${Math.floor(rng() * 99999)}`,
    element: el,
    polarity: rng() > 0.5 ? 'yang' : 'yin',
    value,
    type: 'soldier',
    rarity: 'common',
  }

  // ── 옵션 b: 카드 강화 — 기대 데미지 최고 카드 선택
  let upgradeTargetId: string | null = null
  let bestUpgradeScore = -Infinity
  for (const card of currentDeck) {
    const cardScore = card.value * (nextEnemyEl ? getAffinityMultiplier(card.element, nextEnemyEl) : 1.0)
    if (cardScore > bestUpgradeScore) {
      bestUpgradeScore = cardScore
      upgradeTargetId = card.id
    }
  }

  // ── 옵션 c: 카드 제거 — 기대 데미지 최저 카드 선택 (덱이 2장 이상일 때만)
  let removeTargetId: string | null = null
  let worstRemoveScore = Infinity
  if (currentDeck.length >= 2) {
    for (const card of currentDeck) {
      const cardScore = card.value * (nextEnemyEl ? getAffinityMultiplier(card.element, nextEnemyEl) : 1.0)
      if (cardScore < worstRemoveScore) {
        worstRemoveScore = cardScore
        removeTargetId = card.id
      }
    }
  }

  // ── 3가지 옵션 점수 비교
  // 옵션 a 점수
  const deckA = applyRewardOption(currentDeck, { type: 'add-card', card: newCard })
  const scoreA = evaluateDeckDamageScore(deckA, nextEnemyEl, favorableEl)

  // 옵션 b 점수 (강화 대상 없으면 스킵)
  let scoreB = -Infinity
  if (upgradeTargetId) {
    const deckB = applyRewardOption(currentDeck, { type: 'upgrade-card', targetId: upgradeTargetId, bonusPct: 50 })
    scoreB = evaluateDeckDamageScore(deckB, nextEnemyEl, favorableEl)
  }

  // 옵션 c 점수 (제거 대상 없으면 스킵)
  let scoreC = -Infinity
  if (removeTargetId) {
    const deckC = applyRewardOption(currentDeck, { type: 'remove-card', targetId: removeTargetId })
    scoreC = evaluateDeckDamageScore(deckC, nextEnemyEl, favorableEl)
  }

  // 최대 점수 옵션 선택
  if (scoreB >= scoreA && scoreB >= scoreC && upgradeTargetId) {
    return { type: 'upgrade-card', targetId: upgradeTargetId }
  }
  if (scoreC >= scoreA && scoreC >= scoreB && removeTargetId) {
    return { type: 'remove-card', targetId: removeTargetId }
  }
  return { type: 'add-card', card: newCard }
}

/** 하위 호환: R3 이전 카드 추가 방식 (R3 테스트에서 사용) */
function selectFloorRewardCard(
  currentDeck: Card[],
  rng: () => number,
  nextEnemyEl?: Element,
  favorableEl?: Element,
): Card {
  const result = selectFloorReward(currentDeck, rng, nextEnemyEl, favorableEl)
  if (result.type === 'add-card') return result.card
  // b/c 선택 시에도 add-card 로 fallback (R3 호환 — R4 시뮬에서는 selectFloorReward 직접 사용)
  const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
  const elIdx = Math.floor(rng() * ELEMENTS.length)
  const value = Math.floor(rng() * 10) + 1
  return {
    id: `reward-compat-${Date.now()}-${Math.floor(rng() * 99999)}`,
    element: ELEMENTS[elIdx],
    polarity: 'yang',
    value,
    type: 'soldier',
    rarity: 'common',
  }
}

function createDeterministicState(
  floorIndex: number,
  rng: () => number,
  opts?: FullCapSimOptions,
): GameState {
  const floorConfig = FLOOR_CONFIGS[floorIndex]
  const seed = Math.floor(rng() * 0xffffffff)

  let deck: Card[]
  if (opts?.elementDist) {
    deck = shuffleDeck(generateSajuDeck(opts.elementDist, seed), seed)
  } else {
    deck = shuffleDeck(createFixedDeck(), seed)
  }

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
    yeonhwanUsed: false,
    condensedMultiplier: 0,
    isLastAttack: floorConfig.maxPlays === 1,
    lastTraitTriggered: undefined,
    carryoverBurn: 0,
    reshuffled: false,
    favorableElement: opts?.favorableElement,
  }
}

export function simulateFullCapRun(seed: number, opts?: FullCapSimOptions): FullCapRunResult {
  const rng = makeLcg(seed)

  // 작업 2: 용신 원소 결정 — favorableElement 우선, 없으면 ilganElement로 함수 도출
  const resolvedFavorableElement: Element | undefined =
    opts?.favorableElement
    ?? (opts?.ilganElement ? getFavorableElement(opts.ilganElement) : undefined)

  // 층별 적 원소 결정: 어블레이션 모드면 R1 고정 배치, 아니면 R2 랜덤화
  const floorElements = opts?.useFixedFloorElements
    ? R1_FIXED_FLOOR_ELEMENTS
    : getRandomFloorElements(rng)

  let floor = 1
  let deathFloor: number | null = null
  let floorsCleared = 0
  const floorStats: Array<{ floor: number; attackCount: number; cleared: boolean }> = []
  let discardCount = 0
  let condenseCount = 0
  let fusionCount = 0

  // createDeterministicState에 resolvedFavorableElement 반영을 위해 opts 래핑
  const resolvedOpts: FullCapSimOptions | undefined = opts
    ? { ...opts, favorableElement: resolvedFavorableElement }
    : undefined

  // R4.5 영속 덱: 런 시작 시 1회 덱 생성 — 이후 층에서 재사용
  let state = createDeterministicState(0, rng, resolvedOpts)
  let playerHp = PLAYER_BASE_HP

  while (floor <= 4) {
    if (floor > 1) {
      // R4.5 영속 덱: 새 덱 재생성 금지 — 현재 state의 hand+deck+discardPile 재사용
      const allCards = [...state.hand, ...state.deck, ...state.discardPile]
      const seed = Math.floor(rng() * 0xffffffff)
      const reshuffledDeck = shuffleDeck(allCards, seed)
      const hand = reshuffledDeck.slice(0, HAND_SIZE)
      const floorConfig = FLOOR_CONFIGS[floor - 1]
      state = {
        ...state,
        currentFloor: floor,
        enemyHp: floorConfig.enemyHp,
        enemyMaxHp: floorConfig.enemyHp,
        hand,
        deck: reshuffledDeck.slice(HAND_SIZE),
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
        favorableElement: resolvedFavorableElement,
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

        // R4.5 층 보상 3택: 영속 덱에 즉시 적용 (id 불일치 버그 수정)
        if (opts?.enableFloorReward) {
          const allCurrentCards = [...state.hand, ...state.deck, ...state.discardPile]
          // 다음 층 적 원소 파악 (floor+1 기준)
          const nextFloorIdx = floor  // floor는 현재 클리어한 층, 다음 층 = floor+1 → index = floor
          const nextElemConfig = nextFloorIdx < 4 ? floorElements[nextFloorIdx] : undefined
          const nextEnemyEl = nextElemConfig?.primaryElement
          // R4.5 3택 선택 → 영속 덱(allCurrentCards)에 즉시 반영
          const rewardResult = selectFloorReward(allCurrentCards, rng, nextEnemyEl, resolvedFavorableElement)
          let rewardOption: RewardOption
          if (rewardResult.type === 'add-card') {
            rewardOption = { type: 'add-card', card: rewardResult.card }
          } else if (rewardResult.type === 'upgrade-card') {
            rewardOption = { type: 'upgrade-card', targetId: rewardResult.targetId, bonusPct: 50 }
          } else {
            rewardOption = { type: 'remove-card', targetId: rewardResult.targetId }
          }
          // 영속 덱에 즉시 적용 — state.deck + state.discardPile 갱신 (hand는 다음 층 셔플 시 포함)
          const updatedAllCards = applyRewardOption(allCurrentCards, rewardOption)
          // 업데이트된 카드를 state에 반영 (다음 층 진입 시 hand/deck으로 배분됨)
          state = {
            ...state,
            deck: updatedAllCards,  // 임시로 deck에 전부 저장 — 층 진입 시 다시 셔플 배분
            hand: [],
            discardPile: [],
          }
        }

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
        return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount }
      }

      if (state.playsLeft <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount }
      }

      if (state.playerHp <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount }
      }

      // 랜덤화된 층별 원소 사용 (작업 2)
      const floorIdx = state.currentFloor - 1
      const randomElem = floorElements[floorIdx]
      const floorConf = FLOOR_CONFIGS[floorIdx]
      // phase switch 시: primary↔sub 교환
      const basePrimary = randomElem?.primaryElement ?? floorConf.enemyPrimaryElement
      const baseSub = randomElem?.subElement ?? floorConf.enemySubElement
      const currentPrimaryEl = state.enemyPhaseSwitch ? baseSub : basePrimary
      const currentSubEl = state.enemyPhaseSwitch ? basePrimary : baseSub

      const decision = fullCapSelectCards(
        state.hand,
        currentPrimaryEl,
        currentSubEl,
        state.condensedMultiplier,
        state.yeonhwanUsed,
        state.discardsLeft,
        state.carryoverBurn,
        resolvedFavorableElement,
      )

      if (decision.cardIds.length === 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount }
      }

      // 버리기 전략
      if (decision.shouldDiscard && state.discardsLeft > 0) {
        state = discardCards(state, decision.cardIds)
        discardCount++
        continue
      }

      // [개선 2-1] 응축 전략: 적 HP 대비 딜 부족 시 응축
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
          if (mult > 0) {
            // 개선된 조건: 현재 최선 데미지로 적 HP를 한 번에 격파 불가능할 때 응축
            const bestDamage = decision.bestDamage
            if (state.enemyHp > bestDamage) {
              condenseCount++
              state = applyCondense(state, decision.cardIds)
              continue
            }
          }
        }
      }

      // 융합 통계 수집
      const selectedCards = state.hand.filter(c => decision.cardIds.includes(c.id))
      const comboResult = judgeCombo(selectedCards)
      if (comboResult.type === 'fusion-birth' || comboResult.type === 'fusion-hone') {
        fusionCount++
      }

      state = playCards(state, decision.cardIds)
      attackCount++
      playerHp = state.playerHp
    }
  }

  return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount }
}

export interface FullCapSimReport {
  runs: number
  clearRate: number
  avgFloorsCleared: number
  totalDiscards: number
  discardsPerRun: number
  totalCondenses: number
  condensesPerRun: number
  totalFusions: number
  fusionsPerRun: number
  deathsByFloor: Record<number, number>
  victories: number
  floorAttackStats: Record<number, { mean: number; min: number; max: number }>
}

export function runFullCapSimulation(runs = 1000, opts?: FullCapSimOptions): FullCapSimReport {
  let victories = 0
  let totalFloors = 0
  let totalDiscards = 0
  let totalCondenses = 0
  let totalFusions = 0
  const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const floorAttackData: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] }

  for (let i = 0; i < runs; i++) {
    const result = simulateFullCapRun(i * 12345 + 7777, opts)
    if (result.victory) victories++
    totalFloors += result.floorsCleared
    totalDiscards += result.discardCount
    totalCondenses += result.condenseCount
    totalFusions += result.fusionCount
    if (!result.victory && result.deathFloor !== null) {
      deathsByFloor[result.deathFloor] = (deathsByFloor[result.deathFloor] ?? 0) + 1
    }
    for (const fs of result.floorStats) {
      if (fs.cleared) {
        floorAttackData[fs.floor].push(fs.attackCount)
      }
    }
  }

  const floorAttackStats: Record<number, { mean: number; min: number; max: number }> = {}
  for (let f = 1; f <= 4; f++) {
    const data = floorAttackData[f]
    if (data.length === 0) {
      floorAttackStats[f] = { mean: 0, min: 0, max: 0 }
    } else {
      const mean = data.reduce((a, b) => a + b, 0) / data.length
      floorAttackStats[f] = { mean, min: Math.min(...data), max: Math.max(...data) }
    }
  }

  return {
    runs,
    clearRate: (victories / runs) * 100,
    avgFloorsCleared: totalFloors / runs,
    totalDiscards,
    discardsPerRun: totalDiscards / runs,
    totalCondenses,
    condensesPerRun: totalCondenses / runs,
    totalFusions,
    fusionsPerRun: totalFusions / runs,
    deathsByFloor,
    victories,
    floorAttackStats,
  }
}
