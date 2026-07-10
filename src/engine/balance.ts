/**
 * 팔자전 — 밸런스 데이터 (balance.ts — 단일 출처)
 * 이 파일 외에 밸런스 숫자 하드코딩 금지
 */

import type { FloorConfig, Element } from '../types/game'

/**
 * Phase 1.9 — 새 조합 체계
 *
 * 조합 3종:
 *  1. 기운 모으기 (같은 기운 2~5장)
 *  2. 융합 (서로 다른 기운 정확히 2장)
 *  3. 오행연환 (5기운 전부, 배율 ×10)
 *
 * 음양 조화 보너스: 같은 기운 조합 내 양음 혼재 시 +20%
 * 응축(토 응축): 토 타격 속성 3종 발동 ("토 모으기", "일군 밭", "옹기가마")
 *   - 광맥(토+금→금)은 금 타격이므로 응축 미발동
 *   - 옹기가마(화+토→토): 불로 구워 힘을 가둔 그릇, Phase 1.9 추가
 * 극 판정: 융합의 타격 속성 기준 (기존 로직 재사용)
 *
 * 탐욕 봇 1000판 테스트 예상 (v1.0):
 *  - 클리어율 50~60%
 *  - 원샷 <5%
 *  - 융합 10종 고르게 사용
 */

// --- 기운 모으기 배율 (같은 기운 N장)
export const GATHER_MULTIPLIERS: Record<number, number> = {
  2: 1.5,
  3: 2.5,
  4: 3.5,
  5: 5.0,
}

// --- 융합 10쌍 정의

/** 융합 조합 타입 */
export type FusionType = 'birth' | 'hone'  // 낳는 | 벼리는

export interface FusionCombo {
  name: string           // 한글명 (들불, 옹기가마 등)
  element1: Element      // 첫 번째 기운
  element2: Element      // 두 번째 기운
  result: Element        // 결과 기운
  type: FusionType       // 낳는(×2.5) vs 벼리는(×3.5)
  multiplier: number     // 배율
  description: string    // 설명 (도감용)
}

/**
 * 융합 10쌍
 * 낳는 조합 (×2.5, 결과=자식): 목+화→들불(火) / 화+토→옹기가마(土) / 토+금→광맥(金) / 금+수→샘(水) / 수+목→숲(木)
 * 벼리는 조합 (×3.5, 결과=눌린): 화+금→벼린 검(金) / 금+목→깎은 화살(木) / 목+토→일군 밭(土) / 토+수→맑은 못(水) / 수+화→담금불(火)
 */
export const FUSION_COMBOS: FusionCombo[] = [
  // 낳는 조합 (×3.0) — Phase 1.9 A-3 밸런스 재구축: ×2.5 → ×3.0 일괄 상향
  {
    name: '들불',
    element1: 'mok',
    element2: 'hwa',
    result: 'hwa',
    type: 'birth',
    multiplier: 3.0,
    description: '나무와 불이 만나 맹렬한 불꽃이 피어오른다',
  },
  {
    name: '옹기가마',
    element1: 'hwa',
    element2: 'to',
    result: 'to',
    type: 'birth',
    multiplier: 3.0,
    description: '불로 구워 힘을 가둔 그릇 — 흙 응축이 발동된다 (×3.0, 응축 발동)',
  },
  {
    name: '광맥',
    element1: 'to',
    element2: 'geum',
    result: 'geum',
    type: 'birth',
    multiplier: 3.0,
    description: '흙 속에서 귀한 광물이 맥을 이루다',
  },
  {
    name: '샘',
    element1: 'geum',
    element2: 'su',
    result: 'su',
    type: 'birth',
    multiplier: 3.0,
    description: '금속 암반 아래에서 맑은 물이 솟는다',
  },
  {
    name: '숲',
    element1: 'su',
    element2: 'mok',
    result: 'mok',
    type: 'birth',
    multiplier: 3.0,
    description: '물의 자양으로 울창한 숲이 자라난다',
  },
  // 벼리는 조합 (×3.5)
  {
    name: '벼린 검',
    element1: 'hwa',
    element2: 'geum',
    result: 'geum',
    type: 'hone',
    multiplier: 3.5,
    description: '불로 쇠를 다져 칼날을 벼린다',
  },
  {
    name: '깎은 화살',
    element1: 'geum',
    element2: 'mok',
    result: 'mok',
    type: 'hone',
    multiplier: 3.5,
    description: '쇠 칼로 나뭇가지를 깎아 날카로운 화살을 만든다',
  },
  {
    name: '일군 밭',
    element1: 'mok',
    element2: 'to',
    result: 'to',
    type: 'hone',
    multiplier: 3.5,
    description: '나무를 베어내고 흙을 일궈 비옥한 땅이 된다',
  },
  {
    name: '맑은 못',
    element1: 'to',
    element2: 'su',
    result: 'su',
    type: 'hone',
    multiplier: 3.5,
    description: '흙의 여과를 거쳐 물이 맑아진다',
  },
  {
    name: '담금불',
    element1: 'su',
    element2: 'hwa',
    result: 'hwa',
    type: 'hone',
    multiplier: 3.5,
    description: '물과 불이 부딪혀 더욱 격렬한 불이 타오른다',
  },
]

/** 융합 조합 검색 헬퍼: (element1, element2) → FusionCombo | null */
export function findFusionCombo(el1: Element, el2: Element): FusionCombo | null {
  return FUSION_COMBOS.find(
    (f) =>
      (f.element1 === el1 && f.element2 === el2) ||
      (f.element1 === el2 && f.element2 === el1),
  ) ?? null
}

// --- 음양 조화 보너스
export const EUMYANG_HARMONY_BONUS = 0.2  // +20%

// --- 응축 (토 응축) 배율 — Phase 1.8 구형 (deprecated, 하위 호환용)
export const CONDENSE_MULTIPLIER = 1.6  // 하위 호환 상수 (v2에서는 아래 상수 사용)

// --- 응축 v2 배율 (Phase 1.9.2 — E-2: 선택형 2단계)
// 기본 응축: 공격 횟수 1 소모 → 다음 공격 +120% (×2.2)
export const CONDENSE_V2_MULTIPLIER = 1.2       // +120% 보너스 (최종 배율 = 1 + 1.2 = ×2.2)
// 대응축: 공격 횟수 1 소모 → 다음 공격 +180% (×2.8)
export const GREAT_CONDENSE_MULTIPLIER = 1.8    // +180% 보너스 (최종 배율 = 1 + 1.8 = ×2.8)

// --- 오행 연환 배율 (Phase 1.9.2 — E-1: ×10 → ×8 희소화)
export const OHANG_YEONHWAN_MULTIPLIER = 8

// --- 극 판정 배율
export const GEUK_BONUS_MULTIPLIER = 1.7  // +70%
export const ANTI_GEUK_PENALTY = 0.6      // −40%

/**
 * 밸런스 튜닝 v8.0 (2026-07-10) — Phase 1.9.2 역산 재수행: 탐욕 봇 기대값 기반 HP 재조정
 *
 * 역산 절차 (이든 지시 2026-07-10 21:41):
 *  1. 탐욕 봇 1000핸드 출수 기대값 측정 (고목령 보정 포함)
 *     - 1층 출수당 평균: 80.8, maxPlays=4 → 총기대값 323
 *     - 2층 출수당 평균: 77.7, maxPlays=4 → 총기대값 311
 *     - 3층 출수당 평균: 87.9, maxPlays=5 → 총기대값 439
 *     - 4층 출수당 평균: 50.1(감소후), maxPlays=6 → 총기대값 301(감소후)
 *  2. 목표 층별 통과율 기반 HP 역산 + Step4 이분법 수렴 (클리어율 54.2% 달성):
 *     1층 96.3% × 2층 82.5% × 3층 86.5% × 4층 78.9% ≈ 54.2%
 *     - 1층 HP = 175  (1층 사망 3.7% ≤5% 조건 충족, 기대값 323의 54%)
 *     - 2층 HP = 280  (기대값 311의 90%)
 *     - 3층 HP = 380  (기대값 439의 86%)
 *     - 4층 명목HP = 282  (실효HP 403, 4층 사망 145판 > 3층 사망 107판 ✓)
 *  3. 4층 damage-reduction 30% 유지 (이든 지시)
 *
 * 목표: 클리어율 50~60%, 1층 사망 ≤5%, 4층 사망 > 3층 사망, 원샷 <5%
 * 실측: 클리어율 54.2%, 1층 사망 3.7%, 4층사망 145>3층사망 107, 원샷 0%
 *
 * HP 조정 (v7.0 → v8.0):
 *  - 1층: 130 → 175 (온보딩: 기대값의 54%)
 *  - 2층: 290 → 280 (잡몹: 기대값의 90%)
 *  - 3층: 460 → 380 (정예: 기대값의 86%)
 *  - 4층: 330 → 282 (보스: 실효HP = 282/0.7 ≈ 403, damage-reduction 30%)
 *
 * 응축 발동 조건: "토 모으기", "일군 밭", "옹기가마" 3종
 * 연환 1회 제한, 화 연소 +30%, 금 관통 보호 무시 유지
 */
export const FLOOR_CONFIGS: FloorConfig[] = [
  {
    floor: 1,
    enemyName: '변질 오행',
    enemyHp: 175,
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'mok',
    enemySubElement: 'hwa',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 2,
    enemyName: '변질 오행 혼성',
    enemyHp: 280,
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'hwa',
    enemySubElement: 'geum',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 3,
    enemyName: '정예: 고신',
    enemyHp: 380,
    counterDamage: 2,
    maxPlays: 5,
    enemyPrimaryElement: 'to',
    enemySubElement: 'su',
    enemyGimmick: '홀로 됨',
    eliteGimmickEffect: { type: 'seal-passives', count: 2 },
    forcePhaseSwitch: { hpPct: 0.5 },
    heavyAttack: { everyN: 3, damage: 8 },
  },
  {
    floor: 4,
    enemyName: '보스: 명외자 대장',
    enemyHp: 282,
    counterDamage: 4,
    maxPlays: 6,
    enemyPrimaryElement: 'geum',
    enemySubElement: 'mok',
    enemyGimmick: '금강불괴',
    eliteGimmickEffect: { type: 'damage-reduction', pct: 0.3 },
    bossExtraGimmick: { type: 'rage', counterMult: 1.5 },
    forcePhaseSwitch: { hpPct: 0.5 },
    heavyAttack: { everyN: 2, damage: 8 },
  },
]

export const PLAYER_BASE_HP = 100
export const HAND_SIZE = 8
export const BASE_DISCARDS = 3
export const BASE_PLAYS = 4
export const BOSS_FLOOR = 4

/** 역극 페널티: 카드 데미지를 절반으로 */
export const YEOKGEUK_PENALTY = 0.5

// Phase 1.7 호환성: 부 기운 극 보너스 (현재는 사용 미정, 호환성 유지)
export const SUB_GEUK_BONUS = 1.25
