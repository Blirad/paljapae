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

// --- 응축 v2 배율 (Phase 1.9.4 — 저장형 전환)
// 기본 응축: 태운 조합의 예상 피해 저장 → 다음 공격에 저장량 × 1.5 가산
export const CONDENSE_V2_MULTIPLIER = 1.5       // Phase 1.9.4 신규: 저장형 응축 배율 (×1.5)
// 대응축: 태운 조합의 예상 피해 저장 → 다음 공격에 저장량 × 2.0 가산
export const GREAT_CONDENSE_MULTIPLIER = 2.0    // Phase 1.9.4 신규: 저장형 대응축 배율 (×2.0)

// --- 오행 연환 배율 (Phase 1.9.2 — E-1: ×10 → ×8 희소화)
export const OHANG_YEONHWAN_MULTIPLIER = 8

// --- 극 판정 배율
export const GEUK_BONUS_MULTIPLIER = 1.7  // +70%
export const ANTI_GEUK_PENALTY = 0.6      // −40%

/**
 * 밸런스 튜닝 v9.0 (2026-07-11) — Phase 1.9.4 역산 재수행: 저장형 응축 + 덱 재순환 반영
 *
 * 역산 절차 (이든 지시 2026-07-11):
 *  1. 저장형 응축(×1.5/×2.0) 도입으로 봇 단위 피해 대폭 상승:
 *     - 1층 단위 피해: 126.4 (구 80.8 대비 +56%)
 *     - 2층 단위 피해: 143.9 (구 77.7 대비 +85%)
 *     - 3층 단위 피해: 195.9 (구 87.9 대비 +123%)
 *     - 4층 단위 피해: 83.3 (damage-reduction 30% 적용, 구 50.1 대비 +66%)
 *  2. HP 이분법 수렴 (클리어율 52.2% 달성 — 탐욕 봇 1000판):
 *     1층 100.0% × 2층 95.9% × 3층 88.4% × 4층 67.9% ≈ 57.2% → 수렴 52.2%
 *     - 1층 HP = 220  (1층 사망 0판 — ≤5% 조건 충족)
 *     - 2층 HP = 400  (2층 사망 41판)
 *     - 3층 HP = 680  (3층 사망 116판)
 *     - 4층 명목HP = 520  (실효HP = 520/0.7 ≈ 743, 4층 사망 321 > 3층 사망 116 ✓)
 *  3. 4층 damage-reduction 30% 유지 (이든 지시)
 *
 * 목표: 클리어율 50~60%, 1층 사망 ≤5%, 4층 사망 > 3층 사망
 * 실측 (1000판): 클리어율 52.2%, 1층 사망 0판, 4층 사망 321 > 3층 사망 116 ✓
 *
 * HP 조정 (v8.0 → v9.0):
 *  - 1층: 175 → 220 (+26%)
 *  - 2층: 280 → 400 (+43%)
 *  - 3층: 380 → 680 (+79%)
 *  - 4층: 282 → 520 (+84%, 실효HP 743 ← 403 대비 +84%)
 *
 * 저장형 응축 배율: CONDENSE_V2_MULTIPLIER=1.5, GREAT_CONDENSE_MULTIPLIER=2.0
 * 응축 발동 조건: "토 모으기", "일군 밭", "옹기가마" 3종 유지
 * 연환 1회 제한, 화 연소 +30%, 금 관통 보호 무시 유지
 */
export const FLOOR_CONFIGS: FloorConfig[] = [
  {
    floor: 1,
    enemyName: '변질 오행',
    enemyHp: 220,
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'mok',
    enemySubElement: 'hwa',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 2,
    enemyName: '변질 오행 혼성',
    enemyHp: 400,
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'hwa',
    enemySubElement: 'geum',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 3,
    enemyName: '정예: 고신',
    enemyHp: 680,
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
    enemyHp: 520,
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
