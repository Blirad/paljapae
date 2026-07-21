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
import type { V4RatioCorrectionTable } from './balance'
import type { Card, Element, GameState } from '../types/game'
import {
  createFixedDeck,
  shuffleDeck,
  playCards,
  discardCards,
  applyCondense,
  getCondenseAvailability,
  applyRewardOption,
  initYongsinDescent,
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
  YIKSEANG_MAP,
  YIKSEANG_MULT,
  getCondenseMultiplier,
  getRandomFloorElements,
  SIKSHIN_BASE_SCORE,
  BIGYEON_ELEMENT_WEIGHT,
  GEOPTAE_MOK_WEIGHT,
  SANGGWAN_HWA_WEIGHT,
  PYEONJAE_GEUM_WEIGHT,
  JEONGJAE_SU_WEIGHT,
  PYEONIN_TO_WEIGHT,
  PYEONGWAN_WEIGHT,
  JEONGGWAN_WEIGHT,
  JEONGIN_WEIGHT,
  FUSION_TRAIT_MAP,
  NOURISH_HEAL_PCT,
  BASE_PURIFICATION_DAMAGE,
  PURIFICATION_THRESHOLD,
  MINING_DRAW_DIVISOR,
  MINING_MAX_DRAW,
  EMBER_MULTIPLIER,
  EMBER_DURATION,
  MAX_DISCARD_PER_USE,
  RECIPE_MULTIPLIER_BY_PRESET,
  identifyRecipePreset,
  getFloorHp,
  ROYAL_CARDS,
  createRoyalCard,
  countRoyalCards,
  ROYAL_DECK_CAP,
} from './balance'
import { getFavorableElement } from './manseryeok'

// §3 역마(驛馬) v1 비활성 플래그 — v1 FAIL(낱장 변환 vs 콤보 타격속성 좌표계 미스매치) 격리 보존.
// v2 재설계(손패 전체 교체·없던 오행 생성) 통과 전까지 false. 이든 판정 2026-07-21 (커밋 범위 A).
const SINSAL_YEOKMA_ENABLED = false

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
  if (YIKSEANG_MAP[repEl] === enemyEl) return YIKSEANG_MULT  // 역생: 적이 나를 생 → ×1.2
  return 1.0
}

/**
 * 풀능력 봇 — 예상 데미지 계산
 * affinityBot 대비 추가:
 *  - 용신 보너스 가중치
 * T16-P2: amplifyActive 파라미터 추가 — 증폭부(×2) 효과 반영
 * α 수확 체감: gatherUsedInBattle 파라미터 추가 — 동일 전투 내 gather5 활성화 횟수
 */
export function fullCapCalcExpectedDamage(
  combo: Card[],
  enemyPrimaryElement: Element,
  _enemySubElement?: Element,
  condensedMultiplier?: number,
  yeonhwanUsed?: boolean,
  carryoverBurn?: number,
  _favorableElement?: Element,
  amplifyActive?: boolean,
  recipeMultipliers?: Record<string, number>,
  gatherUsedInBattle: number = 0,
): number {
  const result = judgeCombo(combo, recipeMultipliers, undefined, gatherUsedInBattle)
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

  // [2026-07-18 이든 확정] 용신 상시 ×1.3/×1.5 폐지. 정본 B-3: 슬롯 도래 시에만 사건.

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
 * R5 (balance-v3 §3) — 효과 기대값 닫힌 수식 5종 + synergyMultiplier 거울 반영
 *
 * 원칙: 우대 가중치(bias/boost) 절대 금지.
 * 공격 기대 데미지와 동일 척도(데미지 환산)로 비교만 수행.
 * 엔진(paljajeonEngine.ts)의 효과 계산식을 그대로 거울 반영 — C안 흔적 없음.
 *
 * synergyMultiplier = 용신 배율 × 가호 배율 (엔진과 동일 산출 방식)
 *  - 용신: favorableElement 카드 포함 시 YONGSIN_BONUS_MULTIPLIER(×1.3) 또는 YONGSIN_CHAIN_MULTIPLIER(×1.5)
 *  - 가호(geoptae): 목 카드 포함 시 ×1.3 추가 (낳는 융합 2장이므로 sanggwan/pyeonin 자연 제외)
 *
 * @param traitId             특성 ID (nourish / wildfire / mining / purification / yonggigama)
 * @param baseValue           투입 카드 value 합계
 * @param attackDamage        공격 시 기대 데미지 (비교 기준)
 * @param hand                현재 핸드 전체 (채굴 핸드평균값 계산용)
 * @param playerHp            현재 플레이어 HP (자양 HP위험 가중치용)
 * @param condensedMultiplier 현재 응축 배율 (미사용, 시그니처 유지)
 * @param enemyPrimaryElement 적 주 원소 (정화 기세죽음 해제 판정용)
 * @param _comboResult        judgeCombo 결과 (시그니처 유지)
 * @param playsLeft           남은 공격 횟수 (잔불 평가식용)
 * @param synergyMultiplier   용신·가호 시너지 배율 (엔진과 동일 계산값)
 * @returns 효과 기대값 (데미지 환산). attackDamage 초과 시 효과 선택.
 */
function scoreEffectForTrait(
  traitId: string,
  baseValue: number,
  _attackDamage: number,
  hand: Card[],
  playerHp: number | undefined,
  _condensedMultiplier: number | undefined,
  enemyPrimaryElement: Element | undefined,
  _comboResult: ReturnType<typeof judgeCombo>,
  playsLeft: number,
  synergyMultiplier: number,
): number {
  const maxHp = PLAYER_BASE_HP
  const curHp = playerHp ?? maxHp

  switch (traitId) {
    case 'nourish': {
      // R5: 자양 — 엔진과 동일: playerMaxHp × NOURISH_HEAL_PCT × synergyMultiplier
      // HP위험 가중치: HP≤30% → ×2.0, HP≤50% → ×1.5, else → ×1.0
      const baseHeal = Math.round(maxHp * NOURISH_HEAL_PCT)
      const rawHeal = Math.min(
        Math.round(baseHeal * synergyMultiplier),
        Math.max(0, maxHp - curHp),
      )
      const hpRatio = curHp / maxHp
      const hpWeight = hpRatio <= 0.3 ? 2.0 : hpRatio <= 0.5 ? 1.5 : 1.0
      return Math.round(rawHeal * hpWeight)
    }

    case 'wildfire': {
      // R5: 잔불 — 엔진과 동일: damage × 0.3 × synergyMultiplier
      // 봇 기대값: attackDamage × 0.3 × synergyMultiplier × min(3, 남은공격)/3
      // (엔진은 이전 공격 damage 기준이므로 봇은 attackDamage를 대리값으로 사용)
      const gameTotalMult = EMBER_MULTIPLIER * EMBER_DURATION
      const attackDecay = Math.min(3, playsLeft) / 3
      return Math.round(baseValue * gameTotalMult * attackDecay * synergyMultiplier)
    }

    case 'mining': {
      // R5: 채굴 — 엔진과 동일: floor(투입값 × synergyMultiplier / MINING_DRAW_DIVISOR)
      // 핸드평균값 = sum(card.value) / hand.length
      const drawCount = Math.min(
        MINING_MAX_DRAW,
        Math.floor(baseValue * synergyMultiplier / MINING_DRAW_DIVISOR),
      )
      const handAvg = hand.length > 0
        ? hand.reduce((s, c) => s + c.value, 0) / hand.length
        : 0
      return Math.round(drawCount * handAvg)
    }

    case 'purification': {
      // R5: 정화 — 엔진과 동일: 임계값 시너지 스케일 + 데미지 × synergyMultiplier
      // effectiveThreshold = PURIFICATION_THRESHOLD / synergyMultiplier
      // 투입값 ≥ effectiveThreshold: 전 원소 기세죽음 해제 → 5 × BASE_PURIFICATION_DAMAGE × synergyMultiplier
      // 투입값 < effectiveThreshold: 1종 해제 → BASE_PURIFICATION_DAMAGE × synergyMultiplier
      const effectiveThreshold = PURIFICATION_THRESHOLD / synergyMultiplier
      if (baseValue >= effectiveThreshold) {
        // 전 원소 해제 (5종) — 최대 기대값
        return Math.round(5 * BASE_PURIFICATION_DAMAGE * synergyMultiplier)
      } else if (enemyPrimaryElement) {
        // 1종 해제 기대값
        return Math.round(BASE_PURIFICATION_DAMAGE * synergyMultiplier)
      }
      return 0
    }

    case 'yonggigama': {
      // 응축(옹기가마): effectMode 경로가 아닌 별도 applyCondense 경로로 처리됨
      // 봇 루프(simulateFullCapRun)에서 getCondenseAvailability → applyCondense 직접 호출
      // effectMode 경로에서는 return 0 (이중 처리 방지 — 정당한 설계)
      // * 응축 채택률은 applyCondense 별도 경로에서 condenseCount로 추적됨
      return 0
    }

    default:
      return 0  // 미정의 특성 → 0 (효과 미채택)
  }
}

/**
 * 풀능력 봇 핸드 선택
 * T16-P3: talismans 파라미터 추가 — 부적 효과를 카드 선택 평가에 반영
 * 배치 1.5: recipeMultipliers 추가 — 사주별 레시피 배율
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
  playsLeft?: number,         // R4: 잔불 평가식 남은 공격 횟수 전달
  enemyHp?: number,           // R7: 오버킬 할인 — 적 현재 HP
  recipeMultipliers?: Record<string, number>, // 배치 1.5: 사주별 레시피 배율
  gatherUsedInBattle: number = 0, // α 수확 체감: 동일 전투 내 gather5 활성화 횟수
): FullCapPlayDecision {
  // T16-P3: talismans에서 amplifyActive 여부 추출 (증폭부 사용 가능 시 평가에 반영)
  const amplifyActive = (talismans ?? []).includes('jeungpok')
  // sikshin v2: 낱장 단독 ×1.2 폐지 — 융합 시 밥알 소비로 변경됨. 낱장 가중치 제거.
  // hasSikshin 변수 하위 호환 유지 (낱장 단독 평가 블록 자체를 비활성화)
  const hasSikshin = false  // v2: 낱장 특별 경로 비활성화 (sikshin은 fusion+ricegrains 기반)
  if (hand.length === 0) return { cardIds: [], shouldDiscard: false, bestAffinityMult: 1.0, bestDamage: 0 }

  let bestIds: string[] = []
  let bestScore = -1
  let bestAffinityMult = 0
  let bestEffectMode = false  // B1-1: fusion-birth 효과 선택 여부

  const maxCards = Math.min(5, hand.length)
  for (let k = 1; k <= maxCards; k++) {
    const combos = combinations(hand, k)
    for (const combo of combos) {
      const result = judgeCombo(combo, recipeMultipliers, undefined, gatherUsedInBattle)

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
        // [2026-07-18] 용신 상시 보너스 폐지 (B-3: 슬롯 도래 시에만 사건)
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
      const evalResult = judgeCombo(evalCombo, recipeMultipliers, undefined, gatherUsedInBattle)
      const repEl = evalResult.finishingElement
      const affinityMult = getAffinityMultiplier(repEl, enemyPrimaryElement)

      let score = fullCapCalcExpectedDamage(
        evalCombo,
        enemyPrimaryElement,
        enemySubElement,
        condensedMultiplier,
        yeonhwanUsed,
        carryoverBurn,
        favorableElement,
        amplifyActive,  // T16-P2/P3: 증폭부 효과 반영
        recipeMultipliers, // 배치 1.5: 사주별 레시피 배율
        gatherUsedInBattle, // α 수확 체감: gather5 동일 전투 내 활성화 횟수
      )

      // T33 §a: 가호 지향 가중 — 봇이 가호 경로를 선호하게 유도 (최소 계수, 과가중 금지)
      // 가중 계수: 최종 EV에 승산으로 적용. 봇이 가호 경로를 "약간" 선호하게 만드는 최소값.
      // 정관(jeonggwan)은 이미 effectMode ×1.5로 반영됨 — 유지.
      if (activePassiveIds && activePassiveIds.length > 0) {
        // 상관(sanggwan): 황금비 정점(isRatioPeak) 성립 조합에 ×1.15 가중
        if (
          activePassiveIds.includes('sanggwan') &&
          (evalResult as { isRatioPeak?: boolean }).isRatioPeak === true
        ) {
          score = Math.round(score * 1.15)
        }
        // 겁재(geoptae): 왕족 카드 포함 조합에 ×1.15 가중
        if (
          activePassiveIds.includes('geoptae') &&
          evalCombo.some(c => c.royalType === 'king' || c.royalType === 'queen')
        ) {
          score = Math.round(score * 1.15)
        }
        // 정재(jeongjae): 오행연환(ohang-yeonhwan) 조합에 ×1.20 가중 — 봇이 연환 조립 경로 선호
        if (
          activePassiveIds.includes('jeongjae') &&
          evalResult.type === 'ohang-yeonhwan'
        ) {
          score = Math.round(score * 1.20)
        }
      }

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
      const result = judgeCombo(bestCombo, recipeMultipliers)
      // 실발동 로그 (판당 ≤19회 보장 시점)
      if (typeof globalThis !== 'undefined') {
        if (!(globalThis as any).__recipeLog) (globalThis as any).__recipeLog = []
        if (result.name && result.name.startsWith('fusion_')) {
          ;(globalThis as any).__recipeLog.push({
            recipeId: result.name,
            damage: result.totalScore,
            size: 'actual',
          })
        }
      }
      if (result.type === 'fusion-birth') {
        const traitId = FUSION_TRAIT_MAP[result.name] ?? ''
        const baseValue = bestCombo.reduce((sum, c) => sum + c.value, 0)
        const attackDamage = enemyPrimaryElement
          ? fullCapCalcExpectedDamage(bestCombo, enemyPrimaryElement, enemySubElement, condensedMultiplier, yeonhwanUsed, carryoverBurn, favorableElement, amplifyActive, recipeMultipliers, gatherUsedInBattle)
          : result.totalScore

        // [2026-07-18] 용신 상시 보너스 폐지 (B-3: 슬롯 도래 시에만 사건)
        let synergyMultiplier = 1.0
        // 가호 v2: geoptae 목카드 ×1.3 폐지 (v2에서 stealDamage 기반으로 변경됨)
        // 정관(jeonggwan): effectMode 선택 시 ×1.5 → synergyMultiplier에 반영
        if ((activePassiveIds ?? []).includes('jeonggwan')) {
          // effectMode 경로에서만 적용 (공격 모드는 반영 안 함)
          // scoreEffectForTrait 호출 시점에 결정되므로 여기서 미리 적용
          synergyMultiplier = synergyMultiplier * 1.5
        }

        // R5: 효과 기대값 — 엔진 거울 반영 (synergyMultiplier 전달)
        const effectValue = scoreEffectForTrait(traitId, baseValue, attackDamage, hand, playerHp, condensedMultiplier, enemyPrimaryElement, result, playsLeft ?? 1, synergyMultiplier)

        // R7: 오버킬 할인 — 즉발 공격으로 적 격파 가능하면 잔불 효과 기대값 0 처리
        // 적이 이번 공격으로 죽으면 잔불 3틱은 의미없음 → 효과 선택 불필요
        const adjustedEffectValue = (enemyHp !== undefined && attackDamage >= enemyHp) ? 0 : effectValue

        // 효과 선택 여부 결정: 조정된 효과 기대값 > 공격 기대 데미지일 때만 선택
        if (adjustedEffectValue > attackDamage) {
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

// ─── 배치 2 §1: ForcedAcquireSpec 공용 하네스 ─────────────────────────────────

/**
 * 강제 획득 대상 종류
 *  - 'royal':    왕족 카드 강제 획득 (기존 royalForceAcquire 계열)
 *  - 'talisman': 가호(passive) 강제 장착
 *  - 'taegeuk':  태극 (미구현 placeholder)
 *  - 'sinsal':   신살 (미구현 placeholder)
 */
export type ForcedAcquireKind = 'royal' | 'talisman' | 'taegeuk' | 'sinsal'

/**
 * 강제 획득/장착 스펙 — 왕족·가호 공용 하네스
 *
 * 사용 예:
 *   { kind: 'royal', value: 10, count: 1 }       — 왕(값=10) 1장 강제 획득
 *   { kind: 'talisman', id: 'sanggwan', count: 1 } — 상관 강제 장착
 *   { kind: 'taegeuk' }                           — 태극 (미구현)
 */
export interface ForcedAcquireSpec {
  kind: ForcedAcquireKind
  /** 'talisman' kind: 강제 장착할 passive id (예: 'sanggwan') */
  id?: string
  /** 'royal' kind: 왕족 카드 값 (10=왕 / 11=여왕) */
  value?: number
  /** 목표 횟수 (기본 1) */
  count?: number
}

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
  /** 배치 1.5: 강림제 통계 */
  descentActivated?: number
  descentDeferred?: number
  descentVanished?: number
  /** 배치 1.5 §4-b: 슬롯 도래 횟수 (포착률 산출용) */
  descentSlotsArrived?: number
  /** 배치 2 §2: 왕족 카드 획득 횟수 */
  royalObtainedCount?: number
  /** §3 신살: 역마 실제 발동 횟수 (유령측정 차단용) */
  yeokmaActivations?: number
  /** §3 신살: 화개 실제 발동 횟수 (유령측정 차단용) */
  hwagaeActivations?: number
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
  /**
   * T20: recipe 모드 gather5 배율 직접 지정 (A벌=6.5, B벌=7.0)
   * 지정 시 recipeMultipliers['_gather5']에 주입됨
   * 미지정 시 RECIPE_GATHER5_MULT_A 사용 (기본값)
   */
  gather5MultOverride?: number
  /**
   * 대형 레시피 필살기 배율 직접 지정 (A벌=5.5, B벌=6.0)
   * 지정 시 recipeMultipliers['_largeMult']에 주입됨
   * 미지정 시 RECIPE_LARGE_MULT_A 사용 (기본값)
   */
  largeMultOverride?: number
  /**
   * v4 §3 황금비 보정 테이블 직접 주입 (희소성 복원 2벌 측정용 — 2026-07-18)
   * 미지정 시 기본 V4_RATIO_CORRECTION (현행 0.85/0.70) 사용
   * A벌: V4_RATIO_CORRECTION_A (0.70/0.45)
   * B벌: V4_RATIO_CORRECTION_B (0.75/0.50)
   */
  ratioCorrectionTable?: V4RatioCorrectionTable
  /**
   * 배치 2 §2: 왕족 카드 값 (10 or 11)
   * 지정 시 층 보상에서 왕족 등장 (25% 확률, 덱 상한 ROYAL_DECK_CAP 준수)
   * 미지정 시 왕족 미생성 (기존 동작)
   */
  royalValue?: number
  /**
   * 배치 2 §2/§4: 강제 A/B 측정 모드 (이든 판정 2026-07-18 — 조건부 획득 델타 폐지)
   * true(A군): 왕족 등장 시 봇 3택 비교를 우회하고 무조건 획득 (선택 편향 제거)
   * false/미지정: 조건부 획득 (봇이 획득 유리 시에만) — 프로덕션 동작
   * B군(왕족 배제)은 royalValue 미지정으로 표현.
   */
  royalForceAcquire?: boolean
  /**
   * 배치 2 §4: 강제 획득 목표 횟수 (기본 1, §4 어환 측정 시 2)
   * royalForceAcquire=true일 때, 이 횟수까지 등장 왕족을 무조건 획득.
   * §2: 1 (첫 왕족만), §4: 2 (왕+여왕 모두)
   */
  royalForceAcquireCount?: number
  /**
   * 배치 2 §1: 공용 강제 획득/장착 하네스 (ForcedAcquireSpec)
   * - kind='royal':    왕족 강제 획득 (royalForceAcquire/royalValue 병행 가능 — forceAcquire 우선)
   * - kind='talisman': 가호 강제 장착 (activePassiveIds에 id 강제 포함)
   * - kind='taegeuk':  미구현 placeholder
   * - kind='sinsal':   미구현 placeholder
   *
   * 하위 호환: royalForceAcquire/royalForceAcquireCount/royalValue 필드 유지.
   * forceAcquire가 있으면 forceAcquire가 우선.
   */
  forceAcquire?: ForcedAcquireSpec
  /**
   * T33 겁재 재측정: 시작 덱에 추가할 카드 목록 (왕족 시딩 등 측정 하네스 전용)
   * 지정 시 generateSajuDeck/createFixedDeck으로 생성된 덱 앞에 prepend됨.
   * A/B 양군 동일 주입 시 순수 가호 효과만 측정 가능.
   */
  startingExtraCards?: Card[]
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
  _favorableEl: Element | undefined,
): number {
  let score = 0
  for (const card of deck) {
    let cardWeight = card.value  // 카드값 기반 기본 가중치
    if (nextEnemyEl) {
      cardWeight *= getAffinityMultiplier(card.element, nextEnemyEl)
    }
    // [2026-07-18] 용신 상시 보너스 폐지 (B-3)
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
  royalValue?: number,  // 배치 2 §2: 왕족 카드 값 (10 or 11, 없으면 왕족 미생성)
  forceAcquireRoyal?: boolean,  // 배치 2 §2: 강제 A/B — 왕족 생성 시 3택 우회 무조건 획득
): { type: 'add-card'; card: Card } | { type: 'upgrade-card'; targetId: string } | { type: 'remove-card'; targetId: string } {
  const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

  // ── 옵션 a: 카드 획득
  // 배치 2 §2: 왕족 등장 확률 25% (덱 상한 미달 시)
  const currentRoyalCount = countRoyalCards(currentDeck)
  const canOfferRoyal = royalValue !== undefined && currentRoyalCount < ROYAL_DECK_CAP
  const royalRoll = rng()
  let newCard: Card

  if (canOfferRoyal && royalRoll < 0.25) {
    // 왕족 카드 생성 — 무작위 오행, 왕/여왕 균등
    const elIdx = Math.floor(rng() * ELEMENTS.length)
    const el = ELEMENTS[elIdx]
    const isKing = rng() > 0.5
    const matchingDef = ROYAL_CARDS.find(d => d.element === el && d.royalType === (isKing ? 'king' : 'queen'))!
    newCard = createRoyalCard(matchingDef, royalValue, `${Date.now()}-${Math.floor(rng() * 99999)}`)
    // 강제 A/B (A군): 왕족 등장 시 봇 3택 비교 우회 무조건 획득 — 선택 편향 제거
    if (forceAcquireRoyal) {
      return { type: 'add-card', card: newCard }
    }
  } else {
    // 평민 카드 생성 (§1: 값 2~10, polarity yang 고정)
    const elIdx = Math.floor(rng() * ELEMENTS.length)
    const el = ELEMENTS[elIdx]
    const value = Math.floor(rng() * 9) + 2  // 2~10
    newCard = {
      id: `reward-${Date.now()}-${Math.floor(rng() * 99999)}`,
      element: el,
      polarity: 'yang',
      value,
      type: 'soldier',
      rarity: 'common',
    }
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
  // T33 겁재 재측정: 시작 덱 앞에 왕족 등 추가 카드 주입 (A/B 양군 동일 적용)
  if (opts?.startingExtraCards && opts.startingExtraCards.length > 0) {
    deck = [...opts.startingExtraCards, ...deck]
  }

  const hand = deck.slice(0, HAND_SIZE)
  const remainDeck = deck.slice(HAND_SIZE)

  // 배치 1.5: 레시피 사주별 배율 산출 (출정 시 고정)
  // E2E 지문: elementDist 기반으로 preset 식별 후 배율표 선택
  let recipeMultipliers: Record<string, number> = {}
  if (opts?.elementDist) {
    const preset = identifyRecipePreset(opts.elementDist)
    recipeMultipliers = { ...RECIPE_MULTIPLIER_BY_PRESET[preset] }
  }
  // T20: gather5MultOverride 주입 (_gather5 키 — pokerHandJudge.ts에서 읽힘)
  if (opts?.gather5MultOverride !== undefined) {
    recipeMultipliers['_gather5'] = opts.gather5MultOverride
  }
  // 대형 레시피 필살기 배율 주입 (_largeMult 키 — pokerHandJudge.ts에서 읽힘)
  if (opts?.largeMultOverride !== undefined) {
    recipeMultipliers['_largeMult'] = opts.largeMultOverride
  }

  // v4 모드 시 V4_FLOOR_HP_TABLE 주입, 그 외 floorConfig.enemyHp 유지
  const initEnemyHp = getFloorHp(floorIndex)
  return {
    currentFloor: floorConfig.floor,
    playerHp: PLAYER_BASE_HP,
    playerMaxHp: PLAYER_BASE_HP,
    enemyHp: initEnemyHp,
    enemyMaxHp: initEnemyHp,
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
    // B1-1: 잔불 지속 피해 — 런 시작 시 초기화
    emberDamagePerTurn: 0,
    emberTurnsLeft: 0,
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
    // 배치 1.5: 강림제 상태 초기화 — ENABLE_YONGSIN_DESCENT=true 시 슬롯 사전 결정
    yongsinDescent: initYongsinDescent(null, floorIndex),
    // 배치 1.5: 레시피 사주별 배율 (출정 시 고정, 런 중 재계산 금지)
    recipeMultipliers,
    // 배치 2 §1: 가호 v2 신규 필드 — 엔진 정본(createInitialState L207~213)과 동치
    // rngState: 층별 결정론 seed 파생 (엔진의 deckSeed^0x9E3779B9와 동일 구조) — ?? fallback 은폐 방지
    rngState: (seed ^ 0x9E3779B9) >>> 0,
    geoptaeStealDamage: 0,
    sikshinRicegrains: 0,
    bigyeonCopyUsed: false,
    jeonginUsed: false,
    jeonginBuff: false,
    // §3 신살 초기화 — 기본 탑재 금지 (forceAcquire.kind='sinsal'로만 주입)
    yeokmaCharges: 0,
    hwagaeApplied: false,
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

  // 배치 2 §1: ForcedAcquireSpec — talisman 강제 장착
  // forceAcquire.kind==='talisman' && forceAcquire.id → activePassiveIds에 강제 포함 (오버라이드)
  let resolvedActivePassiveIds: string[] | undefined = opts?.activePassiveIds
  if (opts?.forceAcquire?.kind === 'talisman' && opts.forceAcquire.id) {
    const forcedId = opts.forceAcquire.id
    const base = opts.activePassiveIds ?? []
    resolvedActivePassiveIds = base.includes(forcedId) ? base : [forcedId, ...base]
  }

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
  let royalObtainedCount = 0
  const traitCounts: Record<string, number> = {}
  const floor4PlayedElements: Element[] = []  // [R7-2] 4층에서 플레이된 카드 원소 기록
  // 배치 1.5: 강림제 통계 추적
  let descentActivated = 0
  let descentDeferred = 0
  let descentVanished = 0
  let descentSlotsArrived = 0
  // §3 신살 발동 횟수 추적 (유령측정 차단)
  let yeokmaActivations = 0
  let hwagaeActivations = 0

  // createDeterministicState에 resolvedFavorableElement + resolvedActivePassiveIds 반영을 위해 opts 래핑
  const resolvedOpts: FullCapSimOptions | undefined = opts
    ? {
        ...opts,
        favorableElement: resolvedFavorableElement,
        // ForcedAcquireSpec talisman: 강제 장착된 passive 포함
        activePassiveIds: resolvedActivePassiveIds,
      }
    : undefined

  // R4.5 영속 덱: 런 시작 시 1회 덱 생성 — 이후 층에서 재사용
  let state = createDeterministicState(0, rng, resolvedOpts)
  let playerHp = PLAYER_BASE_HP

  // §3 신살 강제 획득 처리 (forceAcquire.kind='sinsal')
  // royalForceAcquire 패턴 승계 — 시뮬 초기에 신살 상태 주입
  if (opts?.forceAcquire?.kind === 'sinsal') {
    const sinsalId = opts.forceAcquire.id
    if (sinsalId === 'yeokma') {
      // 역마: 런 스코프 3회 발동 권한 부여
      state = { ...state, yeokmaCharges: 3 }
    } else if (sinsalId === 'hwagae') {
      // 화개: 런 시작 시 최고값 카드에 +3 즉시 부여 (런 영구)
      const allStartCards = [...state.hand, ...state.deck]
      if (allStartCards.length > 0) {
        const maxVal = Math.max(...allStartCards.map(c => c.value))
        const targetCard = allStartCards.find(c => c.value === maxVal)
        if (targetCard) {
          // 핸드 또는 덱에서 해당 카드에 +3 부여
          const applyHwagae = (cards: typeof state.hand) =>
            cards.map(c => c.id === targetCard.id ? { ...c, value: c.value + 3 } : c)
          state = {
            ...state,
            hand: applyHwagae(state.hand),
            deck: applyHwagae(state.deck),
            hwagaeApplied: true,
          }
          hwagaeActivations++
        }
      }
    }
  }

  while (floor <= 4) {
    if (floor > 1) {
      // R4.5 영속 덱: 새 덱 재생성 금지 — 현재 state의 hand+deck+discardPile 재사용
      const allCards = [...state.hand, ...state.deck, ...state.discardPile]
      const seed = Math.floor(rng() * 0xffffffff)
      const reshuffledDeck = shuffleDeck(allCards, seed)
      const hand = reshuffledDeck.slice(0, HAND_SIZE)
      const floorConfig = FLOOR_CONFIGS[floor - 1]
      // v4 모드 시 V4_FLOOR_HP_TABLE 주입, 그 외 floorConfig.enemyHp 유지
      const floorEnemyHp = getFloorHp(floor - 1)
      state = {
        ...state,
        currentFloor: floor,
        enemyHp: floorEnemyHp,
        enemyMaxHp: floorEnemyHp,
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
        // B1-1: 잔불 지속 피해 — 층 전환 시 리셋
        emberDamagePerTurn: 0,
        emberTurnsLeft: 0,
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
        // 배치 1.5: 레시피 배율 — 출정 시작 시 고정, 층 전환 시 유지
        recipeMultipliers: state.recipeMultipliers,
        // α 수확 체감: 층(전투) 전환 시 리셋
        gatherUsedInBattle: 0,
        // §3 신살: 런 스코프 유지 (층 전환 시 소모량 그대로 유지)
        yeokmaCharges: state.yeokmaCharges ?? 0,
        hwagaeApplied: state.hwagaeApplied ?? false,
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
          // 강제 A/B (A군): 첫 왕족 등장 시 무조건 획득 (royalObtainedCount===0 = 아직 미획득)
          // ForcedAcquireSpec: forceAcquire.kind==='royal'이면 기존 royalForceAcquire와 동일하게 처리
          const forceTarget =
            (opts?.forceAcquire?.kind === 'royal' ? (opts.forceAcquire.count ?? 1) : null)
            ?? opts?.royalForceAcquireCount
            ?? 1
          const forceRoyalNow =
            ((opts?.forceAcquire?.kind === 'royal') || (opts?.royalForceAcquire === true))
            && royalObtainedCount < forceTarget
          const royalValue =
            (opts?.forceAcquire?.kind === 'royal' ? opts.forceAcquire.value : undefined)
            ?? opts?.royalValue
          const rewardResult = selectFloorReward(allCurrentCards, rng, nextEnemyEl, resolvedFavorableElement, royalValue, forceRoyalNow)
          let rewardOption: RewardOption
          if (rewardResult.type === 'add-card') {
            rewardOption = { type: 'add-card', card: rewardResult.card }
            if (rewardResult.card.royalType) royalObtainedCount++
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
        return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount, traitCounts, reachedFloor4: floor4PlayedElements.length > 0, floor4PlayedElements, descentActivated, descentDeferred, descentVanished, descentSlotsArrived, royalObtainedCount, yeokmaActivations, hwagaeActivations }
      }

      if (state.playsLeft <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount, traitCounts, reachedFloor4: floor4PlayedElements.length > 0, floor4PlayedElements, descentActivated, descentDeferred, descentVanished, descentSlotsArrived, royalObtainedCount, yeokmaActivations, hwagaeActivations }
      }

      if (state.playerHp <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount, traitCounts, reachedFloor4: floor4PlayedElements.length > 0, floor4PlayedElements, descentActivated, descentDeferred, descentVanished, descentSlotsArrived, royalObtainedCount, yeokmaActivations, hwagaeActivations }
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

      // §3 역마(驛馬) 발동 판단 — 불리 매치업에서 손패 1장 오행 변환 (봇 정책 §3 확정판)
      // 조건: yeokmaCharges > 0 AND 현재 손패 최선 상성 ≤ ANTI_GEUK_PENALTY(역극·생 불리)
      // 정책: 변환 전후 예상 데미지 델타가 최대인 손패·목표 오행 조합 선택
      if (SINSAL_YEOKMA_ENABLED && (state.yeokmaCharges ?? 0) > 0 && currentPrimaryEl) {
        // 현재 손패의 최선 상성 배율 계산
        const bestCurrentMult = state.hand.reduce((best, card) => {
          const m = getAffinityMultiplier(card.element, currentPrimaryEl)
          return m > best ? m : best
        }, 0)
        // 불리 판정: 역극(×0.75) 이하 = 상성 불리
        if (evalYeokmaTrigger(bestCurrentMult, 1)) {
          // 유리 오행 탐색: currentPrimaryEl을 극하는 오행 (GEUK_MAP[el] === currentPrimaryEl)
          const favorableEl = (Object.entries(GEUK_MAP) as Array<[Element, Element]>)
            .find(([, target]) => target === currentPrimaryEl)?.[0]
          if (favorableEl) {
            // 최대 EV 델타 조합: 각 손패 카드를 favorableEl로 변환했을 때 delta = after - before
            let bestDelta = 0
            let bestTargetCardId: string | null = null
            for (const card of state.hand) {
              const before = getAffinityMultiplier(card.element, currentPrimaryEl) * card.value
              const after = getAffinityMultiplier(favorableEl, currentPrimaryEl) * card.value
              const delta = after - before
              if (delta > bestDelta) {
                bestDelta = delta
                bestTargetCardId = card.id
              }
            }
            if (bestTargetCardId !== null && bestDelta > 0) {
              // 손패 1장 오행 변환 적용
              state = {
                ...state,
                hand: state.hand.map(c =>
                  c.id === bestTargetCardId ? { ...c, element: favorableEl } : c
                ),
                yeokmaCharges: (state.yeokmaCharges ?? 0) - 1,
              }
              yeokmaActivations++
            }
          }
        }
      }

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
        state.playsLeft,         // R4: 잔불 평가식 남은 공격 횟수 전달
        state.enemyHp,           // R7: 오버킬 할인 — 적 현재 HP 전달
        state.recipeMultipliers, // 배치 1.5: 사주별 레시피 배율
        state.gatherUsedInBattle ?? 0, // α 수확 체감: 동일 전투 내 gather5 활성화 횟수
      )

      if (decision.cardIds.length === 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats, discardCount, condenseCount, fusionCount, traitCounts, reachedFloor4: floor4PlayedElements.length > 0, floor4PlayedElements, descentActivated, descentDeferred, descentVanished, descentSlotsArrived, royalObtainedCount, yeokmaActivations, hwagaeActivations }
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
        const comboResult = judgeCombo(selectedCards, state.recipeMultipliers, undefined, state.gatherUsedInBattle ?? 0)
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
      const comboResult = judgeCombo(selectedCards, state.recipeMultipliers, undefined, state.gatherUsedInBattle ?? 0)
      // 실발동 로그 (판당 ≤19회 보장 시점)
      if (typeof globalThis !== 'undefined') {
        if (!(globalThis as any).__recipeLog) (globalThis as any).__recipeLog = []
        if (comboResult.name && comboResult.name.startsWith('fusion_')) {
          // 소형/대형 구분 — description 기반 ('소형 레시피 —' or '대형 레시피 —')
          const recipeSize = comboResult.description.includes('소형') ? 'small' : 'large'
          ;(globalThis as any).__recipeLog.push({
            recipeId: comboResult.name,
            damage: comboResult.totalScore,
            size: recipeSize,
          })
        }
        // gather 딜 로그 (작업 A: gather 유형별 데미지 집계용)
        if (comboResult.type === 'gather') {
          if (!(globalThis as any).__gatherLog) (globalThis as any).__gatherLog = []
          ;(globalThis as any).__gatherLog.push({
            gatherKey: `gather${selectedCards.length}`,
            damage: comboResult.totalScore,
          })
        }
        // yeonhwan 딜 로그
        if (comboResult.type === 'ohang-yeonhwan') {
          if (!(globalThis as any).__yeonhwanLog) (globalThis as any).__yeonhwanLog = []
          ;(globalThis as any).__yeonhwanLog.push({
            damage: comboResult.totalScore,
          })
        }
        // none/일반기 로그
        if (comboResult.type === 'none') {
          if (!(globalThis as any).__noneLog) (globalThis as any).__noneLog = []
          ;(globalThis as any).__noneLog.push({ damage: comboResult.totalScore })
        }
        // v4 융합 딜 로그 (금수 spring 딜 분해용 — 이든 병행 진단 2026-07-18)
        // v4 명명은 fusion_* 아닌 산물명(샘/대샘 등) → type 접두 + finishingElement로 집계
        if (comboResult.type === 'fusion-birth' || comboResult.type === 'fusion-hone') {
          if (!(globalThis as any).__v4FusionLog) (globalThis as any).__v4FusionLog = []
          ;(globalThis as any).__v4FusionLog.push({
            name: comboResult.name,
            finishingElement: comboResult.finishingElement,
            cardCount: selectedCards.length,
            damage: comboResult.totalScore,
          })
        }
      }
      if (comboResult.type === 'fusion-birth' || comboResult.type === 'fusion-hone') {
        fusionCount++
        // v4 §3 황금비 곡선 정점/비정점 분포 추적 (작업 4 측정 인프라 — 2026-07-18)
        // isRatioPeak: true=진짜 정점(N≥3,steps=0) / false=비정점 or 2장면제
        if (comboResult.isRatioPeak === true) {
          // step0 정점 (N≥3 AND steps=0)
          traitCounts['v4_fusion_step0'] = (traitCounts['v4_fusion_step0'] ?? 0) + 1
        } else if (comboResult.isRatioPeak === false && selectedCards.length >= 3) {
          // N≥3 비정점 — step1/step2 구분: multiplier 역산 (tierMult로 나눠서 ratioCorrection 추정)
          // tierMult: 3장=3.0, 4장=4.0, 5장=5.5 (V4_TIER_MULTIPLIERS 기준)
          // ratioCorrection = multiplier / tierMult (반올림 오차 허용)
          const n = selectedCards.length
          const tierMult = n === 3 ? 3.0 : n === 4 ? 4.0 : 5.5
          const ratio = comboResult.multiplier / tierMult
          // step1: ~0.70(A벌) ~0.75(B벌) ~0.85(현행) — 0.55 이상이면 step1로 간주
          // step2: ~0.45(A벌) ~0.50(B벌) ~0.70(현행) — 0.55 미만이면 step2로 간주
          if (ratio >= 0.55) {
            traitCounts['v4_fusion_step1'] = (traitCounts['v4_fusion_step1'] ?? 0) + 1
          } else {
            traitCounts['v4_fusion_step2'] = (traitCounts['v4_fusion_step2'] ?? 0) + 1
          }
        }
        // 2장 면제(selectedCards.length===2) 별도 집계 (정점 배율이지만 황금비 판정 미적용)
        if (selectedCards.length === 2) {
          traitCounts['v4_fusion_2card_exempt'] = (traitCounts['v4_fusion_2card_exempt'] ?? 0) + 1
        }
        // 5장 대융합 집계 (희소성 복원 정량 지표)
        if (selectedCards.length === 5) {
          traitCounts['v4_fusion_5card'] = (traitCounts['v4_fusion_5card'] ?? 0) + 1
        }
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
        // §4: 어환 계단형 별도 집계
        if (comboResult.isCheonjiEohwan) {
          traitCounts['cheonji-eohwan'] = (traitCounts['cheonji-eohwan'] ?? 0) + 1
        } else if (comboResult.isEohwan) {
          traitCounts['eohwan'] = (traitCounts['eohwan'] ?? 0) + 1
        }
      }

      // T13-R2: 모으기 장수 분포 추적 (gather 유형 + 장수)
      if (comboResult.type === 'gather') {
        const gatherKey = `gather${selectedCards.length}`
        traitCounts[gatherKey] = (traitCounts[gatherKey] ?? 0) + 1
      }

      // T13-R2: 가호 기여도 추적 — v2 발동 조건 기반 사전 판정
      // activePassiveIds + comboResult + state로 v2 효과 발동 여부 평가
      {
        const activeIds = state.activePassiveIds ?? []
        const isFusionCombo = comboResult.type === 'fusion-birth' || comboResult.type === 'fusion-hone'
        const isSmallFusionCombo = isFusionCombo && selectedCards.length === 2

        // 식신 v2: 융합 시 밥알 ≥5 소비 ×1.3
        if (activeIds.includes('sikshin') && isFusionCombo && (state.sikshinRicegrains ?? 0) >= 5) {
          traitCounts['passive_sikshin'] = (traitCounts['passive_sikshin'] ?? 0) + 1
        }
        // 비견 v2: 이번 전투 첫 융합 복제타
        if (activeIds.includes('bigyeon') && isFusionCombo && !(state.bigyeonCopyUsed ?? false)) {
          traitCounts['passive_bigyeon'] = (traitCounts['passive_bigyeon'] ?? 0) + 1
        }
        // 겁재 v2: 첫 공격에 stealDamage 가산
        if (activeIds.includes('geoptae') && !(state.geoptaeUsed ?? false) && (state.geoptaeStealDamage ?? 0) > 0) {
          traitCounts['passive_geoptae'] = (traitCounts['passive_geoptae'] ?? 0) + 1
        }
        // 상관 v2: 황금비 정점(isRatioPeak) 시 RNG 배율
        if (activeIds.includes('sanggwan') && (comboResult as { isRatioPeak?: boolean }).isRatioPeak === true) {
          traitCounts['passive_sanggwan'] = (traitCounts['passive_sanggwan'] ?? 0) + 1
        }
        // 편재 v2: 턴 종료 20% 확률 — 여기서는 근사 추적 (매 공격 0.2 확률로 카운트)
        if (activeIds.includes('pyeonjae')) {
          traitCounts['passive_pyeonjae_opportunity'] = (traitCounts['passive_pyeonjae_opportunity'] ?? 0) + 1
        }
        // 정재 v2: 오행연환 시 2장 드로우
        if (activeIds.includes('jeongjae') && comboResult.type === 'ohang-yeonhwan') {
          traitCounts['passive_jeongjae'] = (traitCounts['passive_jeongjae'] ?? 0) + 1
        }
        // 편인 v2: 소융합(2장) ×1.6
        if (activeIds.includes('pyeonin') && isSmallFusionCombo) {
          traitCounts['passive_pyeonin'] = (traitCounts['passive_pyeonin'] ?? 0) + 1
        }
        // 편관 v2: damage ≥ enemyMaxHp×15% → 추가 출수권 (결과에서 판정)
        if (activeIds.includes('pyeongwan') && isFusionCombo) {
          traitCounts['passive_pyeongwan_fusion'] = (traitCounts['passive_pyeongwan_fusion'] ?? 0) + 1
        }
        // 정관 v2: effectMode 선택 시 ×1.5
        if (activeIds.includes('jeonggwan') && decision.effectMode) {
          traitCounts['passive_jeonggwan'] = (traitCounts['passive_jeonggwan'] ?? 0) + 1
        }
        // 정인 v2: jeonginBuff=true 시 융합 ×1.5 소비
        if (activeIds.includes('jeongin') && isFusionCombo && (state.jeonginBuff ?? false)) {
          traitCounts['passive_jeongin_buff'] = (traitCounts['passive_jeongin_buff'] ?? 0) + 1
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
        state.playerHp === prevState.playerHp &&
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
      // 배치 1.5: 강림제 상태 변화 추적
      if (prevState.yongsinDescent && state.yongsinDescent) {
        // §4-b: 슬롯 도래 카운트 (포착률 산출용)
        if (prevState.yongsinDescent.slots.includes(attackCount)) {
          descentSlotsArrived++
        }
        if (state.yongsinDescent.usedCount > prevState.yongsinDescent.usedCount) {
          descentActivated++
        } else if (!prevState.yongsinDescent.pendingDescent && state.yongsinDescent.pendingDescent) {
          descentDeferred++
        } else if (prevState.yongsinDescent.pendingDescent && !state.yongsinDescent.pendingDescent) {
          descentVanished++
        }
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
    descentActivated,
    descentDeferred,
    descentVanished,
    descentSlotsArrived,
    royalObtainedCount,
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
 * 가호(십성) 후보 목록 — 배치 2 §1 v2 10종 전부
 * (PASSIVE_POOL의 id 기준, balance.ts 상수와 대응)
 */
const ALL_TALISMAN_IDS = [
  'sikshin',    // 식신 v2: 융합 시 밥알 5개 소비 ×1.3 (범용)
  'bigyeon',    // 비견 v2: 첫 융합 복제타 50%
  'geoptae',    // 겁재 v2: 전투 시작 25% 실패판정, 성공=첫공격 +enemyMaxHp×8%
  'sanggwan',   // 상관 v2: 황금비 정점 시 50% ×2.0 or ×1.2
  'pyeonjae',   // 편재 v2: 턴 종료 20% 고값 카드 추가
  'jeongjae',   // 정재 v2: 오행연환 시 2장 드로우
  'pyeonin',    // 편인 v2: 소융합(2장) ×1.6
  'pyeongwan',  // 편관 v2: 피해 ≥15% → +1 출수권
  'jeonggwan',  // 정관 v2: 효과 모드 ×1.5
  'jeongin',    // 정인 v2: 사망 가로채기 런당 1회 + 다음 융합 ×1.5
] as const

/**
 * T13: 사주 기반 가호 2종 선택 — 배치 2 §1 v2 10종 기준
 *
 * elementDist 기반 "기대 데미지 기여 최대" 2종을 반환한다.
 *
 * 점수 계산 기준 (v2 간소화 EV):
 *  - sikshin:   SIKSHIN_BASE_SCORE (범용, 원소 비율 무관)
 *  - bigyeon:   BIGYEON_ELEMENT_WEIGHT × max(elementDist 비율)
 *  - geoptae:   GEOPTAE_MOK_WEIGHT × elementDist.mok 비율
 *  - sanggwan:  SANGGWAN_HWA_WEIGHT × elementDist.hwa 비율
 *  - pyeonjae:  PYEONJAE_GEUM_WEIGHT × elementDist.geum 비율
 *  - jeongjae:  JEONGJAE_SU_WEIGHT × elementDist.su 비율
 *  - pyeonin:   PYEONIN_TO_WEIGHT × elementDist.to 비율
 *  - pyeongwan: PYEONGWAN_WEIGHT (범용 상수 — 고데미지 확률 × 추가 출수 가치)
 *  - jeonggwan: JEONGGWAN_WEIGHT (범용 상수 — 효과 모드 선택 빈도 × 1.5)
 *  - jeongin:   JEONGIN_WEIGHT   (범용 상수 — 생존 가치 보험)
 *
 * @param elementDist 사주 오행 분포 (합계가 0이면 균등 분포로 대체)
 * @param availableTalismans 선택 가능한 가호 id 목록 (없으면 전 10종)
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

  // 가호별 기대 데미지 기여 점수 계산 (v2 10종)
  const scores: Record<string, number> = {
    sikshin:   SIKSHIN_BASE_SCORE,
    bigyeon:   BIGYEON_ELEMENT_WEIGHT * maxRatio,
    geoptae:   GEOPTAE_MOK_WEIGHT * norm('mok'),
    sanggwan:  SANGGWAN_HWA_WEIGHT * norm('hwa'),
    pyeonjae:  PYEONJAE_GEUM_WEIGHT * norm('geum'),
    jeongjae:  JEONGJAE_SU_WEIGHT * norm('su'),
    pyeonin:   PYEONIN_TO_WEIGHT * norm('to'),
    // T33 §b: 범용 상수 하향 — 원소 점수가 가호 선택에 실질 반영되도록 조정.
    // 수정 전: pyeongwan=18.0, jeonggwan=16.0, jeongin=14.0 (원소 점수 최대 ~8.0을 압도)
    // 수정 후: 범용 상수를 원소 점수 최대값(~8.0) 이하로 낮춰 목화≠금수 구분 가능하게.
    pyeongwan: PYEONGWAN_WEIGHT * 0.4,  // 18.0 → ~7.2 (원소 기반 점수와 경쟁 가능)
    jeonggwan: JEONGGWAN_WEIGHT * 0.4,  // 16.0 → ~6.4
    jeongin:   JEONGIN_WEIGHT   * 0.5,  // 14.0 → ~7.0 (생존 보험 가치 일부 유지)
  }

  // pool에 있는 가호만 필터링 → 점수 내림차순 정렬 → 상위 2종 반환
  return pool
    .filter(id => id in scores)
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
    .slice(0, 2)
}

// ─── T33 §c: 신살 발동형 "사용 시점 EV" 평가 골격 ───────────────────────────
//
// §3 신살(역마·화개)은 발동형 아이템이므로 봇이 "언제 발동할지" 판단 로직이 필요.
// 이번엔 골격만 — 정밀 계수는 §3 게이트에서 확정. 실제 역마·화개 효과 로직은 §3 본 구현 소관.
//
// 역마(驛馬, yeokma): 오행 변환 — 나쁜 매치업(적 상성 불리)에서 사용 시 EV 상승
// 화개(華蓋, hwagae): 값 +3 분식 — 고값(high-value) 카드에 사용 시 EV 상승

/**
 * §3 본구현: 신살 발동형 "사용 시점 EV" 평가 — 역마(오행 변환) 정밀화
 *
 * 발동 판단 정책 (§3 확정판):
 *  - 역극·생 불리 매치업: currentAffinityMult ≤ ANTI_GEUK_PENALTY(0.75) 이하
 *  - 변환 후 극(×1.7) 달성 가능할 때만 발동 (EV 순상승 보장)
 *  - 소지 3회 한정 → 불리 정도 큰 매치업 우선 (호출 측에서 charges 관리)
 *
 * @param currentAffinityMult 현재 손패 최선 상성 배율 (getAffinityMultiplier 결과)
 * @param baseScore           현재 콤보 기대 데미지 (양수 확인용)
 * @returns 역마 발동 권장 여부 (true = 발동 시 EV 이득 예상)
 */
export function evalYeokmaTrigger(
  currentAffinityMult: number,
  baseScore: number,
): boolean {
  // §3 정밀 조건: 역극(×0.75) 이하 불리 매치업에서만 발동
  // 역극·생(×0.5) 모두 포함 — ANTI_GEUK_PENALTY(0.75) 이하
  if (currentAffinityMult <= ANTI_GEUK_PENALTY) {
    // EV 상승 확인: 발동 후 극(×1.7)으로 전환 시 currentAffinityMult < 1.7이면 항상 이득
    // → 불리 확인만으로 충분 (baseScore > 0 추가 보호)
    return baseScore > 0
  }
  return false
}

/**
 * §3 본구현: 신살 발동형 "사용 시점 EV" 평가 — 화개(값 +3 분식) 정밀화
 *
 * 발동 판단 정책 (§3 확정판):
 *  - 최고값 카드에 사용 — 손패/덱 중 value 최대 카드에 +3 부여 (분식 효과 극대화)
 *  - 런 영구이므로 조기 최고값 카드 우선 강화
 *  - 단위테스트 호환: targetCardValue === handMaxValue 일 때 발동 권장
 *
 * @param targetCardValue 화개를 적용할 카드의 현재 값
 * @param handMaxValue    현재 핸드/덱 최대 값
 * @returns 화개 발동 권장 여부 (true = 최고값 카드에 적용 시 EV 이득 최대화)
 */
export function evalHwagaeTrigger(
  targetCardValue: number,
  handMaxValue: number,
): boolean {
  // §3 정밀 조건: 최고값 카드(value === max)에 사용 시 분식 효과 극대화
  return targetCardValue >= handMaxValue
}
