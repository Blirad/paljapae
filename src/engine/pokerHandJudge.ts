/**
 * 팔자전 Phase 1.9 — 조합 판정 엔진
 * 새 체계: 기운 모으기 / 융합 / 오행연환
 *
 * 구조:
 *  1. 기운 모으기: 같은 기운 2~5장 (배율 1.5~5.0) + 음양 조화 보너스 (+20%)
 *  2. 융합: 서로 다른 기운 정확히 2장 → 특정 조합만 성립 (낳는×2.5 / 벼리는×3.5)
 *  3. 오행연환: 5기운 전부, 정확히 5장 (배율 ×10)
 *  4. 극/반극: 마무리 기운(타격 속성) 기준으로 판정 (기존 로직 재사용)
 */

import type { Card, Element, HandJudgeResult } from '../types/game'
import {
  GATHER_MULTIPLIERS,
  findFusionCombo,
  EUMYANG_HARMONY_BONUS,
  OHANG_YEONHWAN_MULTIPLIER,
  COMBO_RULESET_VERSION,
  RECIPE_MAP,
  RECIPE_SMALL_BIRTH_MULT,
  RECIPE_SMALL_HONE_MULT,
  // RECIPE_LARGE_BIRTH_MULT / RECIPE_LARGE_HONE_MULT: fallback only, 대형은 _largeMult 키로 주입됨
  RECIPE_GATHER5_MULT_A,
  RECIPE_LARGE_MULT_A,
} from './balance'

// 오행 상극: A가 B를 극한다
const GEUK_MAP: Record<Element, Element> = {
  mok: 'to',
  hwa: 'geum',
  to: 'su',
  geum: 'mok',
  su: 'hwa',
}

// --- 조합 타입 정의 (새 체계 전용)

export type ComboType = 'gather' | 'fusion-birth' | 'fusion-hone' | 'ohang-yeonhwan' | 'none'

export interface ComboJudgeResult {
  type: ComboType
  name: string                    // UI용 이름 (예: "불 모으기 2", "들불", "오행연환")
  baseScore: number               // 카드 합계
  multiplier: number              // 배율
  totalScore: number              // baseScore × multiplier
  finishingElement: Element       // 타격 속성 (극 판정 기준)
  description: string             // 한글 설명
  eumyangBonusApplied?: boolean   // 음양 조화 보너스 적용 여부
}

/** 카드 합계 계산 */
export function sumCardValues(cards: Card[]): number {
  return cards.reduce((acc, c) => acc + c.value, 0)
}

/** 기운별 카드 그룹화 */
export function groupCardsByElement(cards: Card[]): Record<Element, Card[]> {
  const groups: Record<Element, Card[]> = {
    mok: [],
    hwa: [],
    to: [],
    geum: [],
    su: [],
  }
  for (const card of cards) {
    groups[card.element].push(card)
  }
  return groups
}

/** 기운 카운트 */
export function countElements(cards: Card[]): Record<Element, number> {
  const counts: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
  for (const card of cards) {
    counts[card.element]++
  }
  return counts
}

/** 기운 종류 수 */
export function countUniqueElements(cards: Card[]): number {
  return new Set(cards.map((c) => c.element)).size
}

/** 기운 모으기 검사: 모든 카드가 같은 기운인가? */
export function isGatherCombo(cards: Card[]): boolean {
  if (cards.length < 2 || cards.length > 5) return false
  const elements = new Set(cards.map((c) => c.element))
  return elements.size === 1
}

/** 기운 모으기의 음양 조화 확인 */
export function hasEumyangHarmony(cards: Card[]): boolean {
  if (!isGatherCombo(cards)) return false
  const yangCount = cards.filter((c) => c.polarity === 'yang').length
  const yinCount = cards.filter((c) => c.polarity === 'yin').length
  return yangCount > 0 && yinCount > 0  // 양음 모두 존재
}

/**
 * 융합 검사: 선택 카드의 기운이 정확히 2종류이고 유효 쌍인가?
 * Phase 1.9.3: 총 선택 상한 5장, 장수 제약 제거 (다장 융합 일반화)
 */
export function isFusionCombo(cards: Card[]): boolean {
  if (cards.length < 2 || cards.length > 5) return false
  const elements = new Set(cards.map((c) => c.element))
  if (elements.size !== 2) return false
  const [el1, el2] = Array.from(elements) as Element[]
  return findFusionCombo(el1, el2) !== null
}

/** 오행연환 검사: 5기운 전부, 정확히 5장 */
export function isOhangYeonhwan(cards: Card[]): boolean {
  if (cards.length !== 5) return false
  const elements = new Set(cards.map((c) => c.element))
  return elements.size === 5
}

/**
 * 조합 판정 메인 함수
 * @param selectedCards 선택된 카드 배열
 * @param recipeMultipliers 사주별 레시피 배율표 (선택사항, 배치 1.5)
 *   - undefined: 전역 고정 배율 사용 (기본값)
 *   - Record: state.recipeMultipliers로 주입된 배율표 (런 중 고정)
 */
export function judgeCombo(
  selectedCards: Card[],
  recipeMultipliers?: Record<string, number>,
): ComboJudgeResult {
  if (selectedCards.length === 0) {
    return {
      type: 'none',
      name: '(선택 없음)',
      baseScore: 0,
      multiplier: 1,
      totalScore: 0,
      finishingElement: 'mok',
      description: '카드를 선택해주세요',
    }
  }

  const baseScore = sumCardValues(selectedCards)

  // 조합 판정 (우선순위 순서)
  if (isOhangYeonhwan(selectedCards)) {
    // 1. 오행연환 (가장 강력)
    return {
      type: 'ohang-yeonhwan',
      name: '오행연환',
      baseScore,
      multiplier: OHANG_YEONHWAN_MULTIPLIER,
      totalScore: Math.round(baseScore * OHANG_YEONHWAN_MULTIPLIER),
      finishingElement: 'mok',  // 임시 (모든 기운이 관여하므로)
      description: '모든 기운이 원형으로 순환한다 — 천지를 뒤흔들다',
    }
  }

  // 배치 1.5: recipe 모드 — detectRecipe() 우선 적용 (3/5장, 조기 반환)
  // recipe 불성립 시 이하 기존 판정(融合/모으기/none)으로 자연 폴백
  // E2E 지문: recipeMultipliers[recipeId]로 출정 시작 덱 기준 배율 조회
  if (COMBO_RULESET_VERSION === 'recipe' && (selectedCards.length >= 3 && selectedCards.length <= 5)) {
    const recipeId = detectRecipe(selectedCards)
    if (recipeId !== null) {
      // α 정합화 (2026-07-16): 촉매(elem1)/연료(elem2) 고정 + 뒷문 폐쇄
      const recipeEntry = RECIPE_MAP[recipeId]
      const smallSpec = recipeEntry.small
      const largeSpec = recipeEntry.large
      const catalystCount = selectedCards.filter(c => c.element === smallSpec.elem1).length
      const fuelCount = selectedCards.filter(c => c.element === smallSpec.elem2).length
      const isSmall = catalystCount === 1 && fuelCount >= 2 && fuelCount <= 4
      const isLarge = catalystCount === 2 && fuelCount === 3
      // 뒷문 폐쇄: 소형/대형 중 하나도 아니면 일반기로 폴백
      if (!isSmall && !isLarge) {
        // no-op: fall through to isFusionCombo / isGatherCombo / none
      } else {
      const spec = isSmall ? smallSpec : largeSpec
      // fusionType 필드 기반 판별 (elem2 고정 후 null 판별 불가 — 2026-07-16 정본화)
      const isHone = recipeEntry.fusionType === 'hone'

      // 사주별 배율 주입 — 소형/대형 분리 (대형 필살기 승격)
      // 소형: recipeMultipliers[recipeId] (cap 5.0) 또는 기본값
      // 대형: recipeMultipliers['_largeMult'] (A벌/B벌 주입) 또는 RECIPE_LARGE_MULT_A
      // v3 모드에서는 이 분기 진입하지 않으므로 대형 무풍 보장
      let multiplier: number
      if (isLarge) {
        // 대형 5장 — 별도 상수 (소형 cap 5.0과 완전 분리)
        multiplier = recipeMultipliers?.['_largeMult'] ?? RECIPE_LARGE_MULT_A
      } else if (recipeMultipliers?.[recipeId] !== undefined) {
        multiplier = recipeMultipliers[recipeId]
      } else {
        // Fallback to global constants (소형 전용)
        multiplier = isHone ? RECIPE_SMALL_HONE_MULT : RECIPE_SMALL_BIRTH_MULT
      }

      const totalScore = Math.round(baseScore * multiplier)

      // 토단일 α 시도/성공 카운트 (소응축 기여 측정용)
      if (recipeId === 'fusion_kiln' && selectedCards.length <= 5) {
        if (!(globalThis as any).__toDanilAlphaLog) {
          ;(globalThis as any).__toDanilAlphaLog = { attempts: 0, successes: 0 }
        }
        ;(globalThis as any).__toDanilAlphaLog.attempts++
        if (isSmall) {
          ;(globalThis as any).__toDanilAlphaLog.successes++
        }
      }

      return {
        type: isHone ? 'fusion-hone' : 'fusion-birth',
        name: recipeId,
        baseScore,
        multiplier,
        totalScore,
        finishingElement: spec.elem1,
        description: `${isSmall ? '소형' : '대형'} 레시피 — ${recipeId}`,
      }
      } // closes else (isSmall || isLarge)
    }
  }

  if (isFusionCombo(selectedCards)) {
    // 2. 융합 (낳는 or 벼리는)
    const [el1, el2] = Array.from(new Set(selectedCards.map((c) => c.element))) as Element[]
    const fusion = findFusionCombo(el1, el2)!
    return {
      type: fusion.type === 'birth' ? 'fusion-birth' : 'fusion-hone',
      name: fusion.name,
      baseScore,
      multiplier: fusion.multiplier,
      totalScore: Math.round(baseScore * fusion.multiplier),
      finishingElement: fusion.result,  // 타격 속성 = 결과 기운
      description: fusion.description,
    }
  } else if (isGatherCombo(selectedCards)) {
    // 3. 기운 모으기
    const element = selectedCards[0].element
    const count = selectedCards.length
    // T20: recipe 모드에서 gather5(5장) 필살기 계층 배율 override
    // ⚠️ GATHER_MULTIPLIERS[5]=5.0 은 v3 모드 동결값 — 직접 수정 금지
    // recipeMultipliers['_gather5'] 주입 시 그 값 우선 (B벌=7.0 측정용)
    const gather5Mult = recipeMultipliers?.['_gather5'] ?? RECIPE_GATHER5_MULT_A
    const multiplier = (COMBO_RULESET_VERSION === 'recipe' && count === 5)
      ? gather5Mult
      : (GATHER_MULTIPLIERS[count] ?? 1)
    const hasHarmony = hasEumyangHarmony(selectedCards)
    const harmonyBonus = hasHarmony ? EUMYANG_HARMONY_BONUS : 0
    const totalScoreBase = Math.round(baseScore * multiplier)
    const totalScore = Math.round(totalScoreBase * (1 + harmonyBonus))

    const elementNames: Record<Element, string> = {
      mok: '나무',
      hwa: '불',
      to: '흙',
      geum: '쇠',
      su: '물',
    }
    const gatherName = `${elementNames[element]} 모으기 ${count}`
    const harmonyText = hasHarmony ? ' (음양 조화 +20%)' : ''

    return {
      type: 'gather',
      name: gatherName,
      baseScore,
      multiplier,
      totalScore,
      finishingElement: element,
      description: `${gatherName}${harmonyText}`,
      eumyangBonusApplied: hasHarmony,
    }
  } else {
    // 유효하지 않은 조합
    return {
      type: 'none',
      name: '(유효하지 않은 조합)',
      baseScore,
      multiplier: 1,
      totalScore: baseScore,
      finishingElement: 'mok',
      description: '인정되지 않는 조합입니다',
    }
  }
}

/**
 * Phase 1.8 호환성 함수: judgeHand()
 * 기존 코드와의 호환성을 위해 유지
 * 내부적으로 judgeCombo()를 호출하고 HandJudgeResult로 변환
 *
 * Phase 1.9 — 조합 이름 추가: 응축 조건 판정 시 사용
 * 배치 1.5 — recipeMultipliers 옵션 추가: 사주별 배율 주입
 */
export function judgeHand(selectedCards: Card[], recipeMultipliers?: Record<string, number>): HandJudgeResult {
  const result = judgeCombo(selectedCards, recipeMultipliers)
  return {
    rank: result.type as any,  // ComboType → HandRank 호환성
    baseScore: result.baseScore,
    multiplier: result.multiplier,
    totalScore: result.totalScore,
    description: result.description,
    finishingElement: result.finishingElement,
    name: result.name,  // Phase 1.9: 조합 이름 (응축 조건 판정용)
  }
}

// --- 극/반극 판정 헬퍼 (기존 로직 유지)

export interface ClashPair {
  attacker: Element
  victim: Element
}

export function detectElementClash(cards: Card[]): ClashPair[] {
  const elements = new Set(cards.map((c) => c.element))
  const clashes: ClashPair[] = []
  for (const el of elements) {
    const target = GEUK_MAP[el]
    if (elements.has(target)) {
      clashes.push({ attacker: el, victim: target })
    }
  }
  return clashes
}

export interface PrimaryElement {
  element: Element
  count: number
  totalValue: number
}

export function determinePrimaryElement(cards: Card[]): PrimaryElement | null {
  if (cards.length === 0) return null
  const map: Record<string, { count: number; totalValue: number }> = {}
  for (const card of cards) {
    if (!map[card.element]) map[card.element] = { count: 0, totalValue: 0 }
    map[card.element].count++
    map[card.element].totalValue += card.value
  }
  let best: PrimaryElement | null = null
  for (const [el, stats] of Object.entries(map)) {
    if (
      !best ||
      stats.count > best.count ||
      (stats.count === best.count && stats.totalValue > best.totalValue)
    ) {
      best = { element: el as Element, count: stats.count, totalValue: stats.totalValue }
    }
  }
  return best
}

export function calcGeukBonusMultiplier(
  cards: Card[],
  enemyElement: Element,
): { multiplier: number; isMainGeuk: boolean; primaryElement: PrimaryElement | null } {
  const hasAnyGeuk = cards.some((c) => GEUK_MAP[c.element] === enemyElement)
  if (!hasAnyGeuk) {
    return { multiplier: 1.0, isMainGeuk: false, primaryElement: null }
  }
  const primary = determinePrimaryElement(cards)
  if (!primary) {
    return { multiplier: 1.1, isMainGeuk: false, primaryElement: null }
  }
  const isMainGeuk = GEUK_MAP[primary.element] === enemyElement
  return {
    multiplier: isMainGeuk ? 1.5 : 1.1,
    isMainGeuk,
    primaryElement: primary,
  }
}

export function detectYeokgeukPenalty(
  myCards: Card[],
  enemyElements: Element[],
): { hasPenalty: boolean; enemyStrongest: Element | null; myPrimary: PrimaryElement | null } {
  if (enemyElements.length === 0) return { hasPenalty: false, enemyStrongest: null, myPrimary: null }
  const myPrimary = determinePrimaryElement(myCards)
  if (!myPrimary) return { hasPenalty: false, enemyStrongest: null, myPrimary: null }

  const enemyCount: Record<string, number> = {}
  for (const el of enemyElements) {
    enemyCount[el] = (enemyCount[el] || 0) + 1
  }
  let enemyStrongest: Element | null = null
  let maxCount = 0
  for (const [el, cnt] of Object.entries(enemyCount)) {
    if (cnt > maxCount) {
      maxCount = cnt
      enemyStrongest = el as Element
    }
  }
  if (!enemyStrongest) return { hasPenalty: false, enemyStrongest: null, myPrimary }

  const hasPenalty = GEUK_MAP[enemyStrongest] === myPrimary.element
  return { hasPenalty, enemyStrongest, myPrimary }
}

export { GEUK_MAP }

/**
 * 레시피 검출 함수 (배치 1.5)
 * comboRuleset이 'recipe'일 때만 동작
 * 3장: elem1(촉매) 1장 + elem2(연료) 2장
 * 5장: elem1(촉매) 2장 + elem2(연료) 3장
 *
 * 2026-07-16 정본화: elem2 null 분기 제거 (모든 레시피 elem2 고정).
 * 2026-07-16 α정합화: 양방향 제거 — 촉매 = elem1 고정. 역방향(elem2가 촉매) 불성립.
 * E2E 지문: elementCounts[elem1] 및 elementCounts[elem2] 조건으로 특정 원소 쌍만 성립.
 *   예) fusion_keen: geum(촉매)+mok(연료)만 성립. mok2+geum1(역방향) 불성립.
 */
export function detectRecipe(combo: Card[]): string | null {
  if (COMBO_RULESET_VERSION !== 'recipe') return null
  if (combo.length !== 3 && combo.length !== 5) return null

  const elementCounts: Record<Element, number> = {
    mok: 0,
    hwa: 0,
    to: 0,
    geum: 0,
    su: 0,
  }

  for (const card of combo) {
    elementCounts[card.element]++
  }

  for (const [recipeId, recipe] of Object.entries(RECIPE_MAP)) {
    const spec = combo.length === 3 ? recipe.small : recipe.large
    const { elem1, elem2, minCount } = spec

    if (combo.length === 3) {
      // 3장: 촉매(elem1) 정확히 1장 + 연료(elem2) 2장 (α정합화 — 역방향 불성립)
      if (elementCounts[elem1] >= 1 && elementCounts[elem2] >= minCount) return recipeId
    }

    if (combo.length === 5) {
      // 5장: 촉매(elem1) 정확히 2장 + 연료(elem2) 3장 (α정합화 — 역방향 불성립)
      if (elementCounts[elem1] >= 2 && elementCounts[elem2] >= minCount) return recipeId
    }
  }

  return null
}
