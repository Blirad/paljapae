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
  OHANG_YEONHWAN_MULTIPLIER,
  EOHWAN_MULTIPLIER,
  CHEONJI_EOHWAN_MULTIPLIER,
  COMBO_RULESET_VERSION,
  RECIPE_MAP,
  RECIPE_SMALL_BIRTH_MULT,
  RECIPE_SMALL_HONE_MULT,
  // RECIPE_LARGE_BIRTH_MULT / RECIPE_LARGE_HONE_MULT: fallback only, 대형은 _largeMult 키로 주입됨
  RECIPE_GATHER5_MULT_A,
  RECIPE_LARGE_MULT_A,
  V4_TIER_MULTIPLIERS,
  getV4RatioCorrection,
  getV4RatioCorrectionSteps,
  V4_RATIO_CORRECTION,
  type V4RatioCorrectionTable,
  getGather5Multiplier,
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
  /**
   * v4 §3 황금비 정점 플래그 (작업 2 — 2026-07-18)
   * true: 실제 황금비 정점 (N≥3 AND steps===0)
   * false: 비정점 또는 2장 면제 정점(N=2)
   * undefined: v4 융합 판정 외 경로 (gather/yeonhwan/none/recipe 등)
   *
   * 2장 면제(N<3)와 진짜 정점(N≥3 정점) 구분:
   *   N=2 → isRatioPeak=false (면제 — 배율은 peak이지만 황금비 정점 사건 아님)
   *   N≥3, steps=0 → isRatioPeak=true (진짜 정점 — 연출 대상)
   *   N≥3, steps>0 → isRatioPeak=false (비정점)
   */
  isRatioPeak?: boolean
  hasKingUpgrade?: boolean   // 배치 2 §2: 왕 승격 적용 여부
  hasQueenAmplify?: boolean  // 배치 2 §2: 여왕 증폭 적용 여부
  isEohwan?: boolean         // 배치 2 §4: 어환(왕족1장+4오행) ×12 발동 여부
  isCheonjiEohwan?: boolean  // 배치 2 §4: 천지어환(왕+여왕+3오행) ×15 발동 여부
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

/**
 * G3 v4: 투입 장수 계급 배율 산출 (이든 판정 2026-07-17)
 * 2장 → ×1.5 / 3장 → ×3.0 / 4장 → ×4.0 / 5장 → ×5.5
 * 범위 밖(0~1, 6+)이면 ×1.0 폴백 (판정 오류 방지)
 */
export function getV4TierMultiplier(cardCount: number): number {
  return V4_TIER_MULTIPLIERS[cardCount] ?? 1.0
}

/**
 * G3 v4: 접두 명명 산출
 * 2장 → '소' / 5장 → '대' / 3~4장 → '' (접두 없음)
 */
function getV4NamePrefix(cardCount: number): string {
  if (cardCount === 2) return '소'
  if (cardCount === 5) return '대'
  return ''
}

/**
 * 오행연환 최소 카드값 합계 임계치 (작업 3 — 2026-07-18 이든 지시)
 * "아무 낱장 5원소 5장" 성립 방지 — 좋은 5장을 모아야 성립.
 * 이든 추정: 값 게이트 전 성립률 ~65% → 게이트 후 ~30%대 하향 목표.
 */
export const YEONHWAN_MIN_SUM = 25

/**
 * 오행연환 검사: 5기운 전부(size===5) + 총합 값 ≥ YEONHWAN_MIN_SUM
 *
 * 폴백 경로: 5원소이지만 값 미달(sumCardValues < 25) → false 반환.
 * judgeCombo 우선순위상 오행연환 판정 실패 → 다음 분기(v4 융합/모으기)로 폴스루.
 * 단, 5원소 5장은 isFusionCombo(2원소 조건 미충족) = false 이므로 결국 none(일반기) 폴백.
 * 즉: 값 미달 5원소 5장 → none (잡탕으로 취급).
 *
 * 봇·엔진 양쪽 판정 일관성: isOhangYeonhwan은 단일 함수이므로
 * fullCapBot(봇)과 paljajeonEngine(엔진) 모두 이 함수를 통해 판정 → 자동 일관성.
 */
export function isOhangYeonhwan(cards: Card[]): boolean {
  if (cards.length !== 5) return false
  const elements = new Set(cards.map((c) => c.element))
  if (elements.size !== 5) return false
  return sumCardValues(cards) >= YEONHWAN_MIN_SUM
}

/**
 * 천지어환(天地御環) 검사: 왕 + 여왕 동시 + 상이 3오행 (배치 2 §4 어환 계단형 — 2026-07-18)
 *
 * 5장·5원소·값합 25+ AND 왕 1장 AND 여왕 1장 AND 상이 3원소만 포함.
 * 왕과 여왕이 2원소, 나머지가 3원소 → 전설 계층.
 * 최상위 우선순위 — 천지어환 성립 시 어환/연환 판정에 도달하지 않음.
 */
export function isCheonjiEohwan(cards: Card[]): boolean {
  if (cards.length !== 5) return false
  const elements = new Set(cards.map((c) => c.element))
  if (elements.size !== 5) return false  // 5원소 필수
  if (sumCardValues(cards) < YEONHWAN_MIN_SUM) return false  // 값합 25+ 필수
  const hasKing = cards.some(c => c.royalType === 'king')
  const hasQueen = cards.some(c => c.royalType === 'queen')
  return hasKing && hasQueen
}

/**
 * 어환(御環) 검사: 왕족 1장(왕 또는 여왕) + 상이 4오행 (배치 2 §4 어환 계단형 — 2026-07-18)
 *
 * 5장·5원소·값합 25+ AND (왕 또는 여왕) 1장 이상 AND 천지어환 조건 미충족.
 * 왕족 1장이 가능하므로 발동 가능성 높음 (천지어환의 아래 계층).
 * 어환 성립 시 연환 판정에 도달하지 않음.
 */
export function isEohwan(cards: Card[]): boolean {
  if (cards.length !== 5) return false
  const elements = new Set(cards.map((c) => c.element))
  if (elements.size !== 5) return false  // 5원소 필수
  if (sumCardValues(cards) < YEONHWAN_MIN_SUM) return false  // 값합 25+ 필수
  // 천지어환 조건 먼저 확인 (천지어환이 어환을 포함하므로 제외)
  if (isCheonjiEohwan(cards)) return false
  // 왕족 1장 이상 (왕 또는 여왕)
  const hasRoyal = cards.some(c => c.royalType === 'king' || c.royalType === 'queen')
  return hasRoyal
}

/**
 * 조합 판정 메인 함수
 * @param selectedCards 선택된 카드 배열
 * @param recipeMultipliers 사주별 레시피 배율표 (선택사항, 배치 1.5)
 *   - undefined: 전역 고정 배율 사용 (기본값)
 *   - Record: state.recipeMultipliers로 주입된 배율표 (런 중 고정)
 * @param ratioCorrectionTable v4 §3 황금비 보정 테이블 (선택사항)
 *   - undefined: 기본 V4_RATIO_CORRECTION (현행) 사용
 *   - V4_RATIO_CORRECTION_A / _B: 희소성 복원 측정용 주입 (2026-07-18)
 * @param gatherUsedInBattle α 수확 체감 — 동일 전투 내 gather5 활성화 횟수 (선택사항, 기본=0)
 */
export function judgeCombo(
  selectedCards: Card[],
  recipeMultipliers?: Record<string, number>,
  ratioCorrectionTable?: V4RatioCorrectionTable,
  gatherUsedInBattle: number = 0,
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
  // 배치 2 §4: 천지어환 → 어환 → 연환 (상위 우선)
  if (isCheonjiEohwan(selectedCards)) {
    // 0. 천지어환(天地御環) — 왕+여왕+3오행 (전설, ×15)
    return {
      type: 'ohang-yeonhwan',
      name: '천지어환',
      baseScore,
      multiplier: CHEONJI_EOHWAN_MULTIPLIER,
      totalScore: Math.round(baseScore * CHEONJI_EOHWAN_MULTIPLIER),
      finishingElement: 'mok',  // 임시 (모든 기운이 관여하므로)
      description: '왕좌의 양극이 천지의 고리를 이룬다 — 천지어환(天地御環)',
      isCheonjiEohwan: true,
    }
  }
  if (isEohwan(selectedCards)) {
    // 1. 어환(御環) — 왕족1장+4오행 (희귀, ×12)
    return {
      type: 'ohang-yeonhwan',
      name: '어환',
      baseScore,
      multiplier: EOHWAN_MULTIPLIER,
      totalScore: Math.round(baseScore * EOHWAN_MULTIPLIER),
      finishingElement: 'mok',  // 임시 (모든 기운이 관여하므로)
      description: '왕족의 힘이 오행의 고리를 강화한다 — 어환(御環)',
      isEohwan: true,
    }
  }
  if (isOhangYeonhwan(selectedCards)) {
    // 2. 오행연환 (기본, ×8)
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

  // G3 v4: 자유 성립·투입 장수 위계 + §3 황금비 곡선 — 2026-07-17
  //   성립 조건: 정확히 2원소 조합 (v3 isFusionCombo 경로 재사용, 장수 자유 2~5장)
  //   3원소 이상 잡탕 → 일반기(none) 폴백
  //   배율: §2 getV4TierMultiplier(장수) × §3 getV4RatioCorrection(촉,연,N)
  //   양자택일 효과: 전 장수(2~5장) 개방 — 효과 값은 장수 비례(투입값 기반, B1-2 방식 그대로)
  if (COMBO_RULESET_VERSION === 'v4') {
    if (isFusionCombo(selectedCards)) {
      // 2원소 조합 성립: 계단식 배율 × 황금비 보정 적용
      const count = selectedCards.length
      const [el1, el2] = Array.from(new Set(selectedCards.map((c) => c.element))) as Element[]
      const fusion = findFusionCombo(el1, el2)!
      const tierMult = getV4TierMultiplier(count)
      // §3 황금비 곡선: 촉매(element1)·연료(element2) 장수 카운트
      const catCount = selectedCards.filter(c => c.element === fusion.element1).length
      const fuelCount = selectedCards.filter(c => c.element === fusion.element2).length

      // 배치 2 §2: 왕 효과 — 비율 판정 한 계단 승격 (레버 b: 정점 도달 불가)
      // "왕은 길을 넓혀주나, 완성은 그대의 손으로" — 정점(×1.0)은 오직 비율로만.
      // step2→step1 승격 ○ / step1→step1 유지 (정점 미도달) — 최대 step1까지.
      const hasKing = selectedCards.some(c => c.royalType === 'king')
      const preKingSteps = count < 3 ? -1 : getV4RatioCorrectionSteps(catCount, fuelCount, count)
      let ratioSteps = preKingSteps
      if (hasKing && ratioSteps > 1) {
        ratioSteps = Math.max(1, ratioSteps - 1)  // 한 계단 승격하되 정점(step0) 도달 불가
      }
      const kingUpgraded = hasKing && preKingSteps > 1  // 실제 승격 발생 여부 (step2→step1)
      // 승격된 steps로 직접 보정값 산출
      let ratioCorrection: number
      if (count < 3) {
        ratioCorrection = ratioCorrectionTable?.peak ?? V4_RATIO_CORRECTION.peak
      } else if (ratioSteps === 0) {
        ratioCorrection = ratioCorrectionTable?.peak ?? V4_RATIO_CORRECTION.peak
      } else if (ratioSteps === 1) {
        ratioCorrection = ratioCorrectionTable?.step1 ?? V4_RATIO_CORRECTION.step1
      } else {
        ratioCorrection = ratioCorrectionTable?.step2 ?? V4_RATIO_CORRECTION.step2
      }

      const multiplier = Math.round(tierMult * ratioCorrection * 100) / 100
      const prefix = getV4NamePrefix(count)
      const name = prefix ? `${prefix}${fusion.name}` : fusion.name
      const isRatioPeak = count >= 3 && ratioSteps === 0
      const hasQueen = selectedCards.some(c => c.royalType === 'queen')
      return {
        type: fusion.type === 'birth' ? 'fusion-birth' : 'fusion-hone',
        name,
        baseScore,
        multiplier,
        totalScore: Math.round(baseScore * multiplier),
        finishingElement: fusion.result,
        description: `v4 융합 ${count}장 (×${multiplier}) — ${name}`,
        isRatioPeak,
        hasKingUpgrade: kingUpgraded,
        hasQueenAmplify: hasQueen,
      }
    }
    // v4에서 gather·오행연환은 이하 기존 판정으로 폴스루
    // gather5(5장)는 이하 분기에서 RECIPE_GATHER5_MULT_A(6.5) 적용됨
    // 3원소 이상 잡탕은 isGatherCombo false → none 폴백 (이하 동일 로직)
  }

  // 배치 1.5-A-1 (2026-07-16): v3 융합 판정은 ruleset==='v3'에서만.
  //   recipe 모드에서는 detectRecipe(위 3~5장 소형/대형) 단일 참조로 통일.
  //   → 2장 융합·잡탕(2원소 비레시피)은 여기서 걸리지 않고 일반기(none)로 폴백.
  //   (버그: 화1토1이 v3 옹기가마 fusion-birth로 판정되어 대응축 +120%/양자택일 노출)
  if (COMBO_RULESET_VERSION !== 'recipe' && isFusionCombo(selectedCards)) {
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
    // T20: recipe/v4 모드에서 gather5(5장) 필살기 계층 배율 override
    // ⚠️ GATHER_MULTIPLIERS[5]=5.0 은 v3 모드 동결값 — 직접 수정 금지
    // recipeMultipliers['_gather5'] 주입 시 그 값 우선 (B벌=7.0 측정용)
    // §4 위계 확정: 대모으기(gather5) = ×6.5 — recipe 및 v4 공통 (T20 확정값)
    // E2E 지문: gather5 ×6.5 참조 — RECIPE_GATHER5_MULT_A
    // α 수확 체감: gather5 3회차 이상 발동 시 배율 감소 (6.5 → 5.0 → 4.0)
    let gather5Mult = recipeMultipliers?.['_gather5'] ?? RECIPE_GATHER5_MULT_A
    if ((COMBO_RULESET_VERSION === 'recipe' || COMBO_RULESET_VERSION === 'v4') && count === 5) {
      // gatherUsedInBattle > 0 이면 α 배율 적용
      gather5Mult = getGather5Multiplier(gatherUsedInBattle)
    }
    const multiplier = ((COMBO_RULESET_VERSION === 'recipe' || COMBO_RULESET_VERSION === 'v4') && count === 5)
      ? gather5Mult
      : (GATHER_MULTIPLIERS[count] ?? 1)
    // 배치 2 §1: 음양 조화 +20% 폐지 — 평민에서 음양 속성 삭제됨
    const totalScore = Math.round(baseScore * multiplier)

    const elementNames: Record<Element, string> = {
      mok: '나무',
      hwa: '불',
      to: '흙',
      geum: '쇠',
      su: '물',
    }
    const gatherName = `${elementNames[element]} 모으기 ${count}`

    return {
      type: 'gather',
      name: gatherName,
      baseScore,
      multiplier,
      totalScore,
      finishingElement: element,
      description: gatherName,
      eumyangBonusApplied: false,
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
 * α 수확 체감 — gatherUsedInBattle 옵션 추가: gather5 동일 전투 내 활성화 횟수
 */
export function judgeHand(selectedCards: Card[], recipeMultipliers?: Record<string, number>, gatherUsedInBattle: number = 0): HandJudgeResult {
  const result = judgeCombo(selectedCards, recipeMultipliers, undefined, gatherUsedInBattle)
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
