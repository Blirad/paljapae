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
  YONGSIN_BONUS_MULTIPLIER,
  YONGSIN_CHAIN_MULTIPLIER,
  getRandomFloorElements,
  SIKSHIN_BASE_SCORE,
  BIGYEON_ELEMENT_WEIGHT,
  GEOPTAE_MOK_WEIGHT,
  SANGGWAN_HWA_WEIGHT,
  SANGGWAN_MAX_PER_RUN,
  PYEONJAE_GEUM_WEIGHT,
  JEONGJAE_SU_WEIGHT,
  PYEONIN_TO_WEIGHT,
  FUSION_TRAIT_MAP,
  NOURISH_EFFECT_COEFF,
  PURIFICATION_THRESHOLD,
  MINING_DRAW_DIVISOR,
  MINING_MAX_DRAW,
  EMBER_MULTIPLIER,
  EMBER_DURATION,
  EMBER_BOT_MULTIPLIER,
  MAX_DISCARD_PER_USE,
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

// T14: 다수결(getRepresentativeElement) 제거 — judgeCombo finishingElement 기준으로 통일
// 타격 속성(finishingElement)은 judgeCombo() 결과에서 직접 참조한다.

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
 * T16-P2: amplifyActive 파라미터 추가 — 증폭부(×2) 효과 반영
 */
export function fullCapCalcExpectedDamage(
  combo: Card[],
  enemyPrimaryElement: Element,
  _enemySubElement?: Element,
  condensedMultiplier?: number,
  yeonhwanUsed?: boolean,
  carryoverBurn?: number,
  favorableElement?: Element,
  amplifyActive?: boolean,
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

  // T14: 타격 속성(finishingElement) 기준 상성 배율 — 다수결 제거
  const repEl = result.finishingElement
  const affinityMult = getAffinityMultiplier(repEl, enemyPrimaryElement)
  damage = Math.round(damage * affinityMult)

  // 응축 % 방식 소모
  if (condensedMultiplier && condensedMultiplier > 0) {
    damage = Math.round(damage * (1 + condensedMultiplier))
  }

  // T16-P2: 증폭부(增幅符) 효과 반영 — amplifyActive 시 ×2 (실제 엔진과 동일)
  if (amplifyActive) {
    damage = damage * 2
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
  effectMode?: boolean  // B1-1: fusion-birth 양자택일 선택
}

/**
 * V3 작업 3 — 효과 기대값 닫힌 수식 4종
 *
 * 원칙: 우대 가중치(bias/boost) 절대 금지.
 * 공격 기대 데미지와 동일 척도(데미지 환산)로 비교만 수행.
 *
 * @param traitId      특성 ID (nourish / wildfire / mining / yonggigama)
 * @param baseValue    투입 카드 value 합계
 * @param attackDamage 공격 시 기대 데미지 (비교 기준)
 * @param hand         현재 핸드 전체 (채굴 핸드평균값 계산용)
 * @param playerHp     현재 플레이어 HP (자양 HP위험 가중치용)
 * @param condensedMultiplier 현재 응축 배율 (응축 기대값 계산용)
 * @param enemyPrimaryElement 적 주 원소 (잔불 상성 배율용)
 * @param comboResult  judgeCombo 결과 (잔불 상성 배율용)
 * @returns 효과 기대값 (데미지 환산). attackDamage 초과 시 효과 선택.
 */
function scoreEffectForTrait(
  traitId: string,
  baseValue: number,
  attackDamage: number,
  hand: Card[],
  playerHp: number | undefined,
  condensedMultiplier: number | undefined,
  enemyPrimaryElement: Element | undefined,
  comboResult: ReturnType<typeof judgeCombo>,
): number {
  const maxHp = PLAYER_BASE_HP
  const curHp = playerHp ?? maxHp

  switch (traitId) {
    case 'nourish': {
      // 자양: min(기본치×2.5, maxHP - HP) × HP위험 가중치
      // HP위험 가중치: HP≤30% → ×2.0, HP≤50% → ×1.5, else → ×1.0
      const rawHeal = Math.min(
        Math.round(baseValue * NOURISH_EFFECT_COEFF),
        Math.max(0, maxHp - curHp),
      )
      const hpRatio = curHp / maxHp
      const hpWeight = hpRatio <= 0.3 ? 2.0 : hpRatio <= 0.5 ? 1.5 : 1.0
      return Math.round(rawHeal * hpWeight)
    }

    case 'wildfire': {
      // 잔불(ember): max(기본치×3, 즉발데미지 × EMBER_MULTIPLIER × 상성배율)
      // 즉발데미지 = attackDamage (현재 핸드 최고 공격 조합 점수)
      const affinityMult = enemyPrimaryElement
        ? getAffinityMultiplier(comboResult.finishingElement, enemyPrimaryElement)
        : 1.0
      const emberVal = Math.max(
        baseValue * EMBER_BOT_MULTIPLIER,  // R2: ×3.0(EMBER_DURATION) → ×2.2(EMBER_BOT_MULTIPLIER)
        Math.round(attackDamage * EMBER_MULTIPLIER * affinityMult),
      )
      return emberVal
    }

    case 'mining': {
      // 채굴: 드로우장수 × 핸드평균값
      // 드로우장수 = min(MINING_MAX_DRAW, floor(투입값/MINING_DRAW_DIVISOR))
      // 투입값 = baseValue (엔진 구현과 동일 — hand.length가 아닌 카드값 합계 기준)
      // 핸드평균값 = sum(card.value) / hand.length
      const drawCount = Math.min(
        MINING_MAX_DRAW,
        Math.floor(baseValue / MINING_DRAW_DIVISOR),
      )
      const handAvg = hand.length > 0
        ? hand.reduce((s, c) => s + c.value, 0) / hand.length
        : 0
      return Math.round(drawCount * handAvg)
    }

    case 'yonggigama': {
      // 응축(옹기가마): effectMode 경로가 아닌 별도 applyCondense 경로로 처리됨
      // 봇 루프에서 getCondenseAvailability → applyCondense 직접 호출하므로
      // effectMode 경로에서는 0 반환 (이중 처리 방지)
      return 0
    }

    default:
      return 0  // 미정의 특성 → 0 (효과 미채택)
  }
}

/**
 * 풀능력 봇 핸드 선택
 * T16-P3: talismans 파라미터 추가 — 부적 효과를 카드 선택 평가에 반영
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
  talismans?: string[],
  activePassiveIds?: string[],
  playerHp?: number,          // B1-1: 추가
  enableEffectMode?: boolean, // B1-1: 추가
): FullCapPlayDecision {
  // T16-P3: talismans에서 amplifyActive 여부 추출 (증폭부 사용 가능 시 평가에 반영)
  const amplifyActive = (talismans ?? []).includes('jeungpok')
  // sikshin(식신) 장착 여부 — 낱장 후보를 유효 선택지로 평가할지 결정
  const hasSikshin = (activePassiveIds ?? []).includes('sikshin')
  if (hand.length === 0) return { cardIds: [], shouldDiscard: false, bestAffinityMult: 1.0, bestDamage: 0 }

  let bestIds: string[] = []
  let bestScore = -1
  let bestAffinityMult = 0
  let bestEffectMode = false  // B1-1: fusion-birth 효과 선택 여부

  const maxCards = Math.min(5, hand.length)
  for (let k = 1; k <= maxCards; k++) {
    const combos = combinations(hand, k)
    for (const combo of combos) {
      const result = judgeCombo(combo)

      // sikshin A안: 낱장(k=1)이고 sikshin 장착 시 — 직접 기대 데미지 계산
      // judgeCombo가 'none'을 반환해도 낱장은 유효 선택지로 평가한다.
      // 우대 가중치 없음 — sikshin +20% 보너스만 기대 데미지에 반영.
      if (result.type === 'none' && k === 1 && hasSikshin) {
        const card = combo[0]
        // 낱장 기본 점수: 카드값 × sikshin 보너스(×1.2)
        let baseScore = card.value * 1.2
        // 상성 배율 적용 (enemyPrimaryElement 기준)
        const repEl = card.element
        const affinityMult = enemyPrimaryElement
          ? getAffinityMultiplier(repEl, enemyPrimaryElement)
          : 1.0
        baseScore = Math.round(baseScore * affinityMult)
        // 응축 배율 적용
        if (condensedMultiplier && condensedMultiplier > 0) {
          baseScore = Math.round(baseScore * (1 + condensedMultiplier))
        }
        // 증폭부 적용
        if (amplifyActive) {
          baseScore = baseScore * 2
        }
        // 용신 보너스 적용
        if (favorableElement && card.element === favorableElement) {
          baseScore = Math.round(baseScore * YONGSIN_BONUS_MULTIPLIER)
        }
        // 번짐 이월 피해 가산
        if (carryoverBurn && carryoverBurn > 0) {
          baseScore = baseScore + carryoverBurn
        }
        if (!enemyPrimaryElement) {
          if (baseScore > bestScore || (baseScore === bestScore && combo.length < bestIds.length)) {
            bestScore = baseScore
            bestIds = combo.map(c => c.id)
            bestAffinityMult = 1.0
          }
        } else {
          const isBetter = baseScore > bestScore || (baseScore === bestScore && combo.length < bestIds.length)
          if (isBetter) {
            bestScore = baseScore
            bestIds = combo.map(c => c.id)
            bestAffinityMult = affinityMult
          }
        }
        continue
      }

      if (result.type === 'none') continue

      // B1-1: fusion-birth는 일반 콤보 평가만 수행 (양자택일은 최종 선택 후 평가)

      if (result.type === 'ohang-yeonhwan' && yeonhwanUsed) continue

      if (!enemyPrimaryElement) {
        const score = result.totalScore
        if (score > bestScore || (score === bestScore && combo.length < bestIds.length)) {
          bestScore = score
          bestIds = combo.map(c => c.id)
          bestAffinityMult = 1.0
          bestEffectMode = false
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

      // T14: 타격 속성(finishingElement) 기준 — 다수결 제거
      const evalResult = judgeCombo(evalCombo)
      const repEl = evalResult.finishingElement
      const affinityMult = getAffinityMultiplier(repEl, enemyPrimaryElement)

      const score = fullCapCalcExpectedDamage(
        evalCombo,
        enemyPrimaryElement,
        enemySubElement,
        condensedMultiplier,
        yeonhwanUsed,
        carryoverBurn,
        favorableElement,
        amplifyActive,  // T16-P2/P3: 증폭부 효과 반영
      )

      // 통합 최대화: 최종 기대 데미지(콤보 × 상성 × 용신 통합) 순수 최대화
      const isBetter =
        score > bestScore ||
        (score === bestScore && combo.length < bestIds.length)

      if (isBetter) {
        bestScore = score
        bestIds = evalCombo.map(c => c.id)
        bestAffinityMult = affinityMult
        bestEffectMode = false
      }
    }
  }

  if (bestIds.length === 0 && hand.length > 0) {
    bestIds = [hand[0].id]
    bestAffinityMult = 1.0
  }

  // B1-1: 최종 선택 콤보가 fusion-birth일 때만 양자택일 평가 (성능 최적화)
  if (enableEffectMode && bestIds.length > 0 && bestIds.length <= 5) {
    const bestCombo = hand.filter(c => bestIds.includes(c.id))
    if (bestCombo.length > 0) {
      const result = judgeCombo(bestCombo)
      if (result.type === 'fusion-birth') {
        const traitId = FUSION_TRAIT_MAP[result.name] ?? ''
        const baseValue = bestCombo.reduce((sum, c) => sum + c.value, 0)
        const attackDamage = enemyPrimaryElement
          ? fullCapCalcExpectedDamage(bestCombo, enemyPrimaryElement, enemySubElement, condensedMultiplier, yeonhwanUsed, carryoverBurn, favorableElement, amplifyActive)
          : result.totalScore

        // V3 작업 3: 효과 기대값 닫힌 수식 4종
        // 원칙: 우대 가중치 없음 — 공격 기대 데미지 vs 효과 기대값 동일 척도(데미지 환산) 비교
        const effectValue = scoreEffectForTrait(traitId, baseValue, attackDamage, hand, playerHp, condensedMultiplier, enemyPrimaryElement, result)

        // 효과 선택 여부 결정: 효과 기대값 > 공격 기대 데미지일 때만 선택
        if (effectValue > attackDamage) {
          bestEffectMode = true
        } else {
          bestEffectMode = false
        }
      }
    }
  }

  // 버리기 판단: 생(×0.5) 수준일 때만 버리기 (affinityBot 동일)
  const shouldDiscard =
    enemyPrimaryElement !== undefined &&
    bestAffinityMult <= SANG_PENALTY_MULTIPLIER &&
    (discardsLeft ?? 0) > 0 &&
    bestIds.length > 0

  return { cardIds: bestIds, shouldDiscard, bestAffinityMult, bestDamage: bestScore, effectMode: bestEffectMode }
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
  /** R10-5: 특성별 발동 횟수 */
  traitCounts?: Record<string, number>
  /** R7-2: 4층 도달 여부 */
  reachedFloor4: boolean
  /** R7-2: 4층에서 플레이된 카드 원소 목록 */
  floor4PlayedElements?: Element[]
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
  /** R7-2 검증용: 4층 적 원소 강제 */
  forceFloor4Element?: Element
  /** R7-5 어블레이션: 응축 구버전 (mult≥1.2 임계값, 동적 HP 비교 OFF) */
  condenseOldStyle?: boolean
  /** R7-5 어블레이션: 용신 스코어링 OFF (카드 선택 시 용신 보너스 무시) */
  disableYongsinScoring?: boolean
  /** R10-5 어블레이션: 비활성화할 특성 ID 목록 (예: ['quench']) */
  disabledTraits?: string[]
  /**
   * T13: 사주 기반 가호 장착 목록
   * selectTalismanBySaju() 결과를 전달하면 시뮬에서 런 내내 유지됨
   */
  activePassiveIds?: string[]
  /**
   * B1-1: 양자택일 효과 선택 활성화 여부 (A/B 테스트용)
   * false(기본): 항상 공격 모드 (이전 동작 유지)
   * true: trait별 기대값 비교 후 효과/공격 선택
   */
  enableEffectMode?: boolean
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
    favorableElement: opts?.favorableElement,
    disabledTraits: opts?.disabledTraits,
    // T13: 사주 기반 가호 장착 — 런 시작 시 activePassiveIds 주입
    activePassiveIds: opts?.activePassiveIds ?? [],
    // R4: 상관 발동 횟수 초기화
    sanggwanUsed: 0,
    // sikshin D안: 초기화
    sikshinDiscardBonus: false,
    // R10: 겁재 출정당 1회 제한 — 런 시작 시 초기화
    geoptaeUsed: false,
  }
}

export function simulateFullCapRun(seed: number, opts?: FullCapSimOptions): FullCapRunResult {
  const rng = makeLcg(seed)

  // 작업 2: 용신 원소 결정 — favorableElement 우선, 없으면 ilganElement로 함수 도출
  // R7-5 어블레이션: disableYongsinScoring → 카드 선택 시 용신 보너스 무시
  const resolvedFavorableElement: Element | undefined =
    opts?.disableYongsinScoring
    ? undefined
    : (opts?.favorableElement ?? (opts?.ilganElement ? getFavorableElement(opts.ilganElement) : undefined))

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
  const traitCounts: Record<string, number> = {}
  const floor4PlayedElements: Element[] = []  // [R7-2] 4층에서 플레이된 카드 원소 기록

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
        // T16-P1: 층 전환 시 talismans 유지 — 런 동안 누적 (이전 talismans: [] 버그 수정)
        talismans: state.talismans,
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
        // T13: 층 전환 시 activePassiveIds(가호) 유지 — 런 내내 유지
        activePassiveIds: state.activePassiveIds ?? opts?.activePassiveIds ?? [],
        // R4: 상관 발동 횟수 — 출정(런) 전체 기준, 층 전환 시 유지
        sanggwanUsed: state.sanggwanUsed ?? 0,
        // sikshin D안: 층 전환 시 리셋
        sikshinDiscardBonus: false,
        // R10: 겁재 발동 여부 — 출정(런) 전체 기준, 층 전환 시 리셋 금지
        geoptaeUsed: state.geoptaeUsed ?? false,
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
        return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount, traitCounts, reachedFloor4: floor4PlayedElements.length > 0, floor4PlayedElements }
      }

      if (state.playsLeft <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount, traitCounts, reachedFloor4: floor4PlayedElements.length > 0, floor4PlayedElements }
      }

      if (state.playerHp <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount, traitCounts, reachedFloor4: floor4PlayedElements.length > 0, floor4PlayedElements }
      }

      // 랜덤화된 층별 원소 사용 (작업 2) — R7-2 검증용 4층 강제 옵션 지원
      const floorIdx = state.currentFloor - 1
      const floorConf = FLOOR_CONFIGS[floorIdx]

      // 4층 적 원소 강제 옵션 (R7-2 게이트 검증용)
      const randomElem = (opts?.forceFloor4Element && state.currentFloor === 4)
        ? { primaryElement: opts.forceFloor4Element, subElement: floorConf.enemySubElement }
        : floorElements[floorIdx]

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
        state.talismans,  // T16-P3: 부적 효과 전달
        state.activePassiveIds,  // sikshin A안: 낱장 후보 평가
        state.playerHp,          // B1-1: 추가
        opts?.enableEffectMode,  // B1-1: 추가
      )

      if (decision.cardIds.length === 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount, traitCounts, reachedFloor4: floor4PlayedElements.length > 0, floor4PlayedElements }
      }

      // 버리기 전략 — B1-4: discardCards는 MAX_DISCARD_PER_USE(3)장 초과 리젝 → 슬라이스로 무한루프 방지
      if (decision.shouldDiscard && state.discardsLeft > 0) {
        const discardIds = decision.cardIds.slice(0, MAX_DISCARD_PER_USE)
        const prevDiscard = state
        state = discardCards(state, discardIds)
        // V3 무한루프 픽스: discardCards 리젝 감지
        if (
          state.hand.length === prevDiscard.hand.length &&
          state.discardsLeft === prevDiscard.discardsLeft &&
          state.deck.length === prevDiscard.deck.length
        ) {
          throw new Error(
            `[V3-무한루프-픽스] discardCards 리젝 감지 — floor=${floor} discardIds=${JSON.stringify(discardIds)}`
          )
        }
        discardCount++
        // sikshin D안: 버리기 후 보너스 설정 횟수 추적 (activePassiveIds에 sikshin 있을 때)
        if ((state.activePassiveIds ?? []).includes('sikshin') && state.sikshinDiscardBonus === true) {
          traitCounts['passive_sikshin_discard'] = (traitCounts['passive_sikshin_discard'] ?? 0) + 1
        }
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
            // 응축 조건 분기: 구버전(mult≥1.2) vs 동적(HP>딜)
            if (opts?.condenseOldStyle) {
              // R4.5 구버전: mult ≥ 1.2이면 무조건 응축
              if (mult >= 1.2) {
                condenseCount++
                state = applyCondense(state, decision.cardIds)
                continue
              }
            } else {
              // 정본: 현재 최선 데미지로 적 HP를 한 번에 격파 불가능할 때 응축
              const bestDamage = decision.bestDamage
              if (state.enemyHp > bestDamage) {
                condenseCount++
                state = applyCondense(state, decision.cardIds)
                continue
              }
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

      // B1-1: 효과 채택률 추적
      if (decision.effectMode && comboResult.type === 'fusion-birth') {
        const traitId = FUSION_TRAIT_MAP[comboResult.name] ?? 'unknown'
        const key = `effect_${traitId}_used`
        traitCounts[key] = (traitCounts[key] ?? 0) + 1
      } else if (comboResult.type === 'fusion-birth' && !decision.effectMode) {
        const traitId = FUSION_TRAIT_MAP[comboResult.name] ?? 'unknown'
        const key = `attack_${traitId}_used`
        traitCounts[key] = (traitCounts[key] ?? 0) + 1
      }

      // T13-R2: 연환 발생 추적 (comboResult.type 기준)
      if (comboResult.type === 'ohang-yeonhwan') {
        traitCounts['ohang-yeonhwan'] = (traitCounts['ohang-yeonhwan'] ?? 0) + 1
      }

      // T13-R2: 모으기 장수 분포 추적 (gather 유형 + 장수)
      if (comboResult.type === 'gather') {
        const gatherKey = `gather${selectedCards.length}`
        traitCounts[gatherKey] = (traitCounts[gatherKey] ?? 0) + 1
      }

      // T13-R2: 가호 기여도 추적 — activePassiveIds 기반 발동 조건 사전 판정
      // 가호 발동 여부를 comboResult + state 조건으로 직접 평가
      {
        const activeIds = state.activePassiveIds ?? []
        const floorIdx2 = state.currentFloor - 1
        const floorConf2 = FLOOR_CONFIGS[floorIdx2]
        const basePrimary2 = floorElements[floorIdx2]?.primaryElement ?? floorConf2.enemyPrimaryElement
        const baseSub2 = floorElements[floorIdx2]?.subElement ?? floorConf2.enemySubElement
        const curPrimEl = state.enemyPhaseSwitch ? baseSub2 : basePrimary2

        if (activeIds.includes('sikshin') && selectedCards.length === 1) {
          traitCounts['passive_sikshin'] = (traitCounts['passive_sikshin'] ?? 0) + 1
        }
        if (activeIds.includes('bigyeon') && comboResult.type === 'gather' && selectedCards.length >= 3) {
          traitCounts['passive_bigyeon'] = (traitCounts['passive_bigyeon'] ?? 0) + 1
        }
        if (activeIds.includes('geoptae') && selectedCards.some(c => c.element === 'mok') && !(state.geoptaeUsed ?? false)) {
          traitCounts['passive_geoptae'] = (traitCounts['passive_geoptae'] ?? 0) + 1
        }
        if (activeIds.includes('sanggwan') && selectedCards.filter(c => c.element === 'hwa').length >= 3 && (state.sanggwanUsed ?? 0) < SANGGWAN_MAX_PER_RUN) {
          traitCounts['passive_sanggwan'] = (traitCounts['passive_sanggwan'] ?? 0) + 1
        }
        if (activeIds.includes('pyeonjae')) {
          const hasGeum = selectedCards.some(c => c.element === 'geum')
          if (hasGeum && curPrimEl === 'mok') {
            traitCounts['passive_pyeonjae'] = (traitCounts['passive_pyeonjae'] ?? 0) + 1
          }
        }
        if (activeIds.includes('jeongjae') && comboResult.type === 'ohang-yeonhwan' && selectedCards.some(c => c.element === 'su')) {
          traitCounts['passive_jeongjae'] = (traitCounts['passive_jeongjae'] ?? 0) + 1
        }
        if (activeIds.includes('pyeonin')) {
          const hasTo = selectedCards.some(c => c.element === 'to')
          if (hasTo && comboResult.type === 'gather' && state.isLastAttack) {
            traitCounts['passive_pyeonin'] = (traitCounts['passive_pyeonin'] ?? 0) + 1
          }
        }
      }

      // [R7-2] 4층 플레이 카드 원소 기록
      if (state.currentFloor === 4) {
        selectedCards.forEach(card => floor4PlayedElements.push(card.element))
      }

      const prevState = state
      state = playCards(state, decision.cardIds, decision.effectMode)
      // V3 무한루프 픽스: 리젝 판별 — 모든 상태 동일 = 리젝 = throw
      if (
        state.hp === prevState.hp &&
        state.enemyHp === prevState.enemyHp &&
        state.playsLeft === prevState.playsLeft &&
        state.hand.length === prevState.hand.length &&
        state.discardsLeft === prevState.discardsLeft
      ) {
        throw new Error(
          `[V3-무한루프-픽스] playCards 리젝 감지 — floor=${floor} cardIds=${JSON.stringify(decision.cardIds)} phase=${state.phase}`
        )
      }
      // R10-5: 특성 발동 추적
      if (state.lastTraitTriggered) {
        traitCounts[state.lastTraitTriggered] = (traitCounts[state.lastTraitTriggered] ?? 0) + 1
      }
      attackCount++
      playerHp = state.playerHp
    }
  }

  return {
    victory: state.isVictory,
    floorsCleared: state.floorsCleared,
    deathFloor,
    floorStats,
    discardCount,
    condenseCount,
    fusionCount,
    traitCounts,
    reachedFloor4: floor4PlayedElements.length > 0,
    floor4PlayedElements,
  }
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

// ─── T13: 사주 기반 가호 장착 선택 ────────────────────────────────────────────

/**
 * 가호(십성) 후보 목록 — 7종 전부
 * (PASSIVE_POOL의 id 기준, balance.ts 상수와 대응)
 */
const ALL_TALISMAN_IDS = [
  'sikshin',    // 식신: 낱장 +20% (범용)
  'bigyeon',    // 비견: 모으기 3+ 반격 감소 (주력 원소 집중 보상)
  'geoptae',    // 겁재: 목 포함 첫 공격 +30%
  'sanggwan',   // 상관: 화 2장 이상 ×1.5
  'pyeonjae',   // 편재: 금 극 시 HP +3
  'jeongjae',   // 정재: 수 포함 연환 배율 +2
  'pyeonin',    // 편인: 토 모으기 마지막 공격 +50%
] as const

/**
 * T13: 사주 기반 가호 2종 선택
 *
 * elementDist 기반 "기대 데미지 기여 최대" 2종을 반환한다.
 *
 * 점수 계산 기준:
 *  - sikshin: SIKSHIN_BASE_SCORE (범용, 원소 비율 무관)
 *  - bigyeon: BIGYEON_ELEMENT_WEIGHT × max(elementDist 비율)
 *      → 주력 원소가 집중될수록 모으기 3+ 발동 확률 상승
 *  - geoptae: GEOPTAE_MOK_WEIGHT × elementDist.mok 비율
 *  - sanggwan: SANGGWAN_HWA_WEIGHT × elementDist.hwa 비율
 *  - pyeonjae: PYEONJAE_GEUM_WEIGHT × elementDist.geum 비율
 *  - jeongjae: JEONGJAE_SU_WEIGHT × elementDist.su 비율
 *  - pyeonin:  PYEONIN_TO_WEIGHT × elementDist.to 비율
 *
 * @param elementDist 사주 오행 분포 (합계가 0이면 균등 분포로 대체)
 * @param availableTalismans 선택 가능한 가호 id 목록 (없으면 전 7종)
 * @returns 기대 데미지 기여 상위 2종의 id 배열 (내림차순)
 */
export function selectTalismanBySaju(
  elementDist: Record<Element, number>,
  availableTalismans?: string[],
): string[] {
  const pool = availableTalismans ?? [...ALL_TALISMAN_IDS]

  // 오행 분포 정규화 (합계 기준 비율 계산)
  const total = Object.values(elementDist).reduce((s, v) => s + v, 0)
  const norm = (el: Element): number =>
    total > 0 ? (elementDist[el] ?? 0) / total : 0.2  // 합계 0이면 균등(20%)

  // 주력 원소 비율 (bigyeon 계산용)
  const maxRatio = Math.max(
    norm('mok'), norm('hwa'), norm('to'), norm('geum'), norm('su'),
  )

  // 가호별 기대 데미지 기여 점수 계산
  const scores: Record<string, number> = {
    sikshin:  SIKSHIN_BASE_SCORE,
    bigyeon:  BIGYEON_ELEMENT_WEIGHT * maxRatio,
    geoptae:  GEOPTAE_MOK_WEIGHT * norm('mok'),
    sanggwan: SANGGWAN_HWA_WEIGHT * norm('hwa'),
    pyeonjae: PYEONJAE_GEUM_WEIGHT * norm('geum'),
    jeongjae: JEONGJAE_SU_WEIGHT * norm('su'),
    pyeonin:  PYEONIN_TO_WEIGHT * norm('to'),
  }

  // pool에 있는 가호만 필터링 → 점수 내림차순 정렬 → 상위 2종 반환
  return pool
    .filter(id => id in scores)
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
    .slice(0, 2)
}
