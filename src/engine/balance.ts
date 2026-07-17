/**
 * 팔자전 — 밸런스 데이터 (balance.ts — 단일 출처)
 * 이 파일 외에 밸런스 숫자 하드코딩 금지
 */

import type { FloorConfig, Element } from '../types/game'
import { getDevComboRuleset, getDevDescentEnabled } from './devSettings'

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
  2: 1.3,
  3: 2.5,
  4: 4.0,   // B1-6: 벼리는(×3.5) 동률 해소
  5: 5.0,
}

// --- T20: recipe 모드 전용 gather 필살기 계층 배율 (gather5)
// ⚠️ GATHER_MULTIPLIERS[5]=5.0 은 v3 모드용 — 직접 수정 금지
// recipe 모드에서만 아래 값 사용 (pokerHandJudge.ts 내 COMBO_RULESET_VERSION 분기)
export const RECIPE_GATHER5_MULT_A = 6.5  // 1벌 (A안)
export const RECIPE_GATHER5_MULT_B = 7.0  // 2벌 (B안)

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

// --- 응축 (T1 확정판 — 화/토 조합 매트릭스, +% 방식)
// 옹기가마(화+토→토) 선택 시 화/토 개수별 보너스 % 적용
// 다음 공격에 damage × (1 + bonusPercent/100) 적용
//
// 구조 (앵커만족):
//  - 240%는 화2토3 유일 최대
//  - 같은 장수에서 토 우세 > 화 우세
//  - 화 몰빵 페널티: 화4토1 < 화2토2
//  - 화1토1 = 120 = 최소

export const CONDENSE_MATRIX: Record<number, Record<number, number>> = {
  1: { 1: 120, 2: 150, 3: 185, 4: 215 },
  2: { 1: 135, 2: 175, 3: 240 },
  3: { 1: 145, 2: 205 },
  4: { 1: 155 },
}

/** 화/토 개수 기반 응축 보너스 % 계산 */
export function getCondenseBonus(hwaCount: number, toCount: number): number {
  if (hwaCount < 1 || toCount < 1) return 0
  const bonus = CONDENSE_MATRIX[hwaCount]?.[toCount]
  return bonus ?? 0  // 정의되지 않은 조합 = 0%
}

/**
 * 레거시 응축 배율 함수 — 카드 장수만으로 배율(소수) 반환
 * 고정 테이블: 2=1.2, 3=1.6, 4=2.0, 5=2.4, 5초과=2.4
 * @deprecated getCondenseBonus 사용 권장. 기존 호환 함수
 */
export function getCondenseMultiplier(cardCount: number): number {
  if (cardCount < 2) return 0
  const clampedCount = Math.min(cardCount, 5)
  const LEGACY_TABLE: Record<number, number> = { 2: 1.2, 3: 1.6, 4: 2.0, 5: 2.4 }
  return LEGACY_TABLE[clampedCount] ?? 0
}

// --- Phase 1.9.5: 10종 융합 특성 설정
export interface TraitConfig {
  name: string
  bannerText: string
  tooltipTitle: string
  tooltipBody: string
  element: 'mok' | 'hwa' | 'to' | 'geum' | 'su'
  fusionType: 'birth' | 'hone'
  keyframe: string
  textColor: string
  textShadow: string
}

export const TRAIT_CONFIGS: Record<string, TraitConfig> = {
  wildfire: {
    name: '번짐',
    bannerText: '번짐 — 피해의 30%가 다음 공격에 이월된다',
    tooltipTitle: '번짐 (들불)',
    tooltipBody: '들불이 번진다. 이번 공격 피해의 30%가 잔불이 되어 다음 공격에 더해진다. 연속으로 불을 지르면 더 강해진다.',
    element: 'hwa',
    fusionType: 'birth',
    keyframe: 'fireRise',
    textColor: '#FF7A5C',
    textShadow: '0 0 8px rgba(255,122,92,0.8), 0 0 16px rgba(198,61,47,0.4)',
  },
  mining: {
    name: '채굴',
    bannerText: '채굴 — 덱에서 1장을 더 가져간다',
    tooltipTitle: '채굴 (광맥)',
    tooltipBody: '광맥을 캔다. 덱에서 카드 1장을 즉시 손으로 가져온다. 손패가 풍성해질수록 선택지가 늘어난다.',
    element: 'geum',
    fusionType: 'birth',
    keyframe: 'metalSlash',
    textColor: '#E8E3D5',
    textShadow: '0 0 8px rgba(232,227,213,0.8), 0 0 12px rgba(200,192,176,0.4)',
  },
  purification: {
    name: '정화',
    bannerText: '정화 — 기세 죽음 1종이 해제되었다',
    tooltipTitle: '정화 (샘)',
    tooltipBody: '샘이 솟아 기운을 씻는다. 죽은 기운 중 1종이 되살아난다. 기세 죽음 상태가 해제된다.',
    element: 'su',
    fusionType: 'birth',
    keyframe: 'waterFade',
    textColor: '#8FB8DE',
    textShadow: '0 0 8px rgba(143,184,222,0.8), 0 0 16px rgba(61,90,128,0.5)',
  },
  nourish: {
    name: '자양',
    bannerText: '자양 — 최대 HP의 8%가 회복되었다',
    tooltipTitle: '자양 (숲)',
    tooltipBody: '숲이 품는다. 공격 후 최대 HP의 8%를 회복한다. 꾸준히 싸울수록 오래 버틸 수 있다.',
    element: 'mok',
    fusionType: 'birth',
    keyframe: 'leafRise',
    textColor: '#7BD4A3',
    textShadow: '0 0 8px rgba(123,212,163,0.8), 0 0 16px rgba(74,155,110,0.4)',
  },
  yonggigama: {
    name: '응축',
    bannerText: '응축 — 힘이 그릇에 담겼다',
    tooltipTitle: '응축 (옹기가마)',
    tooltipBody: '흙이 힘을 담는다. 불로 구운 그릇은 더 큰 힘을 담는다. 다음 공격에 보너스를 더한다.',
    element: 'to',
    fusionType: 'birth',
    keyframe: 'condenseFlare',
    textColor: '#FFD98A',
    textShadow: '0 0 8px rgba(255,217,138,0.8), 0 0 16px rgba(217,164,65,0.5)',
  },
  keen: {
    name: '예리',
    bannerText: '예리 — 극 보너스가 1.5배로 강해진다',
    tooltipTitle: '예리 (벼린 검)',
    tooltipBody: '검이 예리해진다. 이번 공격의 극 보너스가 1.5배로 상승한다. 상성이 유리할 때 더욱 강력하다.',
    element: 'geum',
    fusionType: 'hone',
    keyframe: 'metalSlash',
    textColor: '#E8E3D5',
    textShadow: '0 0 4px rgba(232,227,213,1.0), 0 0 12px rgba(200,192,176,0.7), 0 2px 0 #000',
  },
  snipe: {
    name: '저격',
    bannerText: '저격 — 적의 가호 1개를 꿰뚫었다',
    tooltipTitle: '저격 (깎은 화살)',
    tooltipBody: '화살이 꿰뚫는다. 적이 지닌 가호(보호 효과) 1개를 무효화한다. 단단한 적을 상대할 때 유용하다.',
    element: 'mok',
    fusionType: 'hone',
    keyframe: 'leafRise',
    textColor: '#7BD4A3',
    textShadow: '0 0 4px rgba(123,212,163,1.0), 0 0 12px rgba(74,155,110,0.7), 0 2px 0 #000',
  },
  harvest: {
    name: '수확',
    bannerText: '수확 — 손의 목·토 카드가 1씩 올랐다',
    tooltipTitle: '수확 (일군 밭)',
    tooltipBody: '밭을 일군다. 현재 손에 있는 목(木)·토(土) 카드의 값이 1씩 오른다. 해당 기운 카드가 많을수록 효과가 커진다.',
    element: 'to',
    fusionType: 'hone',
    keyframe: 'condenseFlare',
    textColor: '#FFD98A',
    textShadow: '0 0 4px rgba(255,217,138,1.0), 0 0 12px rgba(217,164,65,0.7), 0 2px 0 #000',
  },
  mirror: {
    name: '비침',
    bannerText: '비침 — 적의 다음 강공이 절반으로 약해진다',
    tooltipTitle: '비침 (맑은 못)',
    tooltipBody: '못이 비친다. 적의 다음 강공 피해가 50% 줄어든다. 강한 공격을 예감할 때 미리 쓰면 좋다.',
    element: 'su',
    fusionType: 'hone',
    keyframe: 'waterFade',
    textColor: '#8FB8DE',
    textShadow: '0 0 4px rgba(143,184,222,1.0), 0 0 12px rgba(61,90,128,0.7), 0 2px 0 #000',
  },
  quench: {
    name: '담금질',
    bannerText: '담금질 — 쓴 카드 값이 1 영구히 올랐다',
    tooltipTitle: '담금질 (담금불)',
    tooltipBody: '불로 달군다. 이번 공격에 쓴 카드들의 값이 1 영구히 오른다. 이번 출정이 끝날 때까지 유지된다.',
    element: 'hwa',
    fusionType: 'hone',
    keyframe: 'fireRise',
    textColor: '#FF7A5C',
    textShadow: '0 0 4px rgba(255,122,92,1.0), 0 0 12px rgba(198,61,47,0.7), 0 2px 0 #000',
  },
}

/** 융합 조합명 → 특성 ID 맵핑 */
export const FUSION_TRAIT_MAP: Record<string, string> = {
  '들불': 'wildfire',
  '광맥': 'mining',
  '샘': 'purification',
  '숲': 'nourish',
  '옹기가마': 'yonggigama',
  '벼린 검': 'keen',
  '깎은 화살': 'snipe',
  '일군 밭': 'harvest',
  '맑은 못': 'mirror',
  '담금불': 'quench',
}

// --- 오행 연환 배율 (Phase 1.9.2 — E-1: ×10 → ×8 희소화)
export const OHANG_YEONHWAN_MULTIPLIER = 8

// --- 상생상극 매트릭스 배율 (스펙 v2 — 단일 출처)
// 극(剋): 내가 적을 극 → ×1.5
// 생(生): 내가 적을 생 → ×0.5
// 적이 나를 극 → ×0.75
// 동기/적이 나를 생 → ×1.0

/** 오행 상극: key가 value를 극함 (木克土, 火克金, 土克水, 金克木, 水克火) */
export const GEUK_MAP_BALANCE: Record<string, string> = {
  mok: 'to',
  hwa: 'geum',
  to: 'su',
  geum: 'mok',
  su: 'hwa',
}

/** 오행 상생: key가 value를 생함 (木生火, 火生土, 土生金, 金生水, 水生木) */
export const SANG_MAP: Record<string, string> = {
  mok: 'hwa',
  hwa: 'to',
  to: 'geum',
  geum: 'su',
  su: 'mok',
}

/** 극(剋) 배율: 내가 적을 극 (×1.7) — R8 복원 */
export const GEUK_BONUS_MULTIPLIER = 1.7  // ×1.7 (R8: 1.5→1.7 복원)
/** 생(生) 배율: 내가 적을 생 (×0.5, 피해 감소) */
export const SANG_PENALTY_MULTIPLIER = 0.5
/** 역극 배율: 적이 나를 극 (×0.75) */
export const ANTI_GEUK_PENALTY = 0.75     // ×0.75 (스펙 v2)

/** 역생(逆生) 매트릭스: 적이 나를 생 (내가 적의 자식 = 연료를 삼킨다). SANG_MAP의 역방향.
 * 공격 원소 기준: 화→목·목→수·수→금·금→토·토→화 (attacker=enemy의 자식) */
export const YIKSEANG_MAP: Record<string, string> = {
  hwa: 'mok',
  mok: 'su',
  su: 'geum',
  geum: 'to',
  to: 'hwa',
}
/** 역생 배율: 적이 나를 생 → ×1.2 (이든 기정 승인 2026-07-16) — 양 룰셋 공통 상성층 */
export const YIKSEANG_MULT = 1.2

// 하위 호환 — 극 판정 배율 (deprecated, GEUK_BONUS_MULTIPLIER로 통일)
/** @deprecated GEUK_BONUS_MULTIPLIER 사용 */
export const YEOKGEUK_PENALTY_OLD = 0.5

// T19: 숲(자양) 회복 — 고정 8 → 최대 HP의 8% (반올림)
// 설계 의도: HP가 높은 런일수록 회복도 비례 증가, 저HP 런에서의 과잉 회복 방지
export const NOURISH_HEAL_PCT = 0.08  // 8% of playerMaxHp

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
    enemyHp: 445,  // R9: 430→445 (목화 2층 사망 집중 정밀 레버)
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'hwa',
    enemySubElement: 'geum',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 3,
    enemyName: '정예: 고신',
    enemyHp: 680,  // R8: 660→680
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
    enemyHp: 540,  // R10: 560→540 (4층 HP 하향)
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

// ─── T8: 유물 4종 정의 ───────────────────────────────────────────────────────

export type RelicId = 'haetae' | 'osakshil' | 'horybyeong' | 'moktag'

export interface RelicDef {
  id: RelicId
  name: string
  description: string
  icon: string  // 이모지 아이콘
}

/**
 * 유물 4종 정의 (balance.ts 단일 출처)
 * - 해태상: 적 반격 피해 -3 (하한 0)
 * - 오색실: 오행연환 성립 시 기본 피해 +15
 * - 호리병: 내 HP 30 이하 시 콤보 배율 +1
 * - 목탁: 버리기 사용 시 HP 2 회복
 */
export const RELIC_DEFS: Record<RelicId, RelicDef> = {
  haetae: {
    id: 'haetae',
    name: '해태상',
    description: '적의 반격 피해 -3 (최소 0)',
    icon: '🦁',
  },
  osakshil: {
    id: 'osakshil',
    name: '오색실',
    description: '오행연환 성립 시 기본 피해 +15',
    icon: '🧵',
  },
  horybyeong: {
    id: 'horybyeong',
    name: '호리병',
    description: 'HP 30 이하 시 콤보 배율 +1',
    icon: '🏺',
  },
  moktag: {
    id: 'moktag',
    name: '목탁',
    description: '버리기 사용 시 HP 2 회복',
    icon: '🪘',
  },
}

export const ALL_RELIC_IDS: RelicId[] = ['haetae', 'osakshil', 'horybyeong', 'moktag']

/** 해태상: 반격 피해 감소량 */
export const HAETAE_COUNTER_REDUCTION = 3
/** 오색실: 연환 시 기본 피해 보너스 */
export const OSAKSHIL_YEONHWAN_BONUS = 15
/** 호리병: 발동 HP 임계값 */
export const HORYBYEONG_HP_THRESHOLD = 30
/** 호리병: 콤보 배율 추가 */
export const HORYBYEONG_MULTIPLIER_BONUS = 1
/** 목탁: 버리기 HP 회복량 */
export const MOKTAG_DISCARD_HEAL = 2

export const PLAYER_BASE_HP = 100
export const HAND_SIZE = 8
export const BASE_DISCARDS = 3
export const MAX_DISCARD_PER_USE = 3  // B1-4: 버리기 1회당 최대 3장

// --- B1-1/B1-2: 낳는 양자택일 효과 상수
export const NOURISH_EFFECT_COEFF = 2.5    // 자양 [효과]: HP 회복 = 투입값 × 2.5
export const PURIFICATION_THRESHOLD = 10   // 정화 [효과]: 투입값 ≥ 10 → 전해제+면역
export const MINING_DRAW_DIVISOR = 5       // 채굴 [효과]: 드로우 = floor(투입값/5)
export const MINING_MAX_DRAW = 3           // 채굴 [효과]: 최대 3장
export const EMBER_DURATION = 3            // 잔불 [효과]: 지속 턴 수
export const EMBER_MULTIPLIER = 2.6 / 3   // ≈ 0.8667 — 총배율 ×2.6 (R8: ×3.0→×2.6)
export const CONDENSE_SCALE_BASE = 8       // 응축 값 스케일 기준값 (R9: 10→8, 토단일 전형 투입합 8이 풀 매트릭스 받도록)
export const CONDENSE_SCALE_MIN = 0.6      // 응축 값 스케일 하한 (R2: 0.4→0.6, 저치 착취 차단 강화)

// --- R5: 효과 시너지 (balance-v3 §3 개정)
// 스펙 v3.1 §3: 효과 = rawBase가 아니라 용신·가호 시너지를 받는 값. 공격과의 차이는 상성 축뿐.
/** 정화 [효과]: 원소 기세 죽음 해제 시 적에게 추가 데미지 (해제 1종당) */
export const BASE_PURIFICATION_DAMAGE = 8  // 해제된 원소 1종당 기본 데미지 × synergyMultiplier
export const BASE_PLAYS = 4
export const BOSS_FLOOR = 4

/** 역극 페널티: 카드 데미지를 절반으로 (legacy, 상생상극 매트릭스로 대체됨) */
export const YEOKGEUK_PENALTY = 0.5

// Phase 1.7 호환성: 부 기운 극 보너스 (현재는 사용 미정, 호환성 유지)
export const SUB_GEUK_BONUS = 1.25

// --- 용신 보너스 (스펙 v2 — 작업 4)
/** 콤보에 용신 원소 포함 시 배율 */
export const YONGSIN_BONUS_MULTIPLIER = 1.3
/** 연환 3장 이상, 마지막 카드가 용신 원소 시 배율 (×1.3 대체) */
export const YONGSIN_CHAIN_MULTIPLIER = 1.5

// --- T13: 가호(십성) 기대 데미지 가중치 상수 (balance.ts 단일 출처)
//
// 각 가호의 "기대 데미지 기여" 점수를 elementDist 기반으로 추산하기 위한 기준값.
// selectTalismanBySaju() 함수가 이 상수를 참조한다.
//
// 설계 원칙:
//  - 원소 친화 가호: elementDist의 해당 원소 비율 × 기여 계수
//  - 범용 가호: 고정 기여 점수 (원소 비율 무관)
//  - 수치는 1000판 시뮬 기반 추정치 (실측 후 튜닝 가능)

/** 식신(食神): 낱장 공격 +20% — 원소 무관, 범용 보너스
 *  R9 재산정: 작업 1 A/B 어블레이션 실측 (목화 1000판)
 *   - sikshin 단독 기여 Δ = +2.30%p (CI 교차, 보수 추정)
 *   - sanggwan 목화 점수 = 30.0 × (4/14) = 8.571
 *   - sanggwan 기여 추정 = 5%p (R5→R8 합산 계수 기반)
 *   - 재산정: 8.571 × (2.30 / 5.0) = 3.94 → 3.9 (최솟값 0.5 적용)
 */
export const SIKSHIN_BASE_SCORE = 3.9

/** 비견(比肩): 같은 기운 모으기 3+ 시 반격 감소 — 주력 원소 집중도에 비례 */
export const BIGYEON_ELEMENT_WEIGHT = 22.0

/** 겁재(劫財): 나무 카드 포함 첫 공격 +30% — 목(木) 원소 비율 비례 */
export const GEOPTAE_MOK_WEIGHT = 28.0

/** 상관(傷官): 불 카드 2장 이상 × 1.5 — 화(火) 원소 비율 비례 */
export const SANGGWAN_HWA_WEIGHT = 30.0

/** 상관(傷官): 출정당 최대 발동 횟수 */
export const SANGGWAN_MAX_PER_RUN = 2

/** 편재(偏財): 금 카드로 극 시 HP 3 회복 — 금(金) 원소 비율 비례 */
export const PYEONJAE_GEUM_WEIGHT = 20.0

/** 정재(正財): 물 카드 포함 연환 배율 +2 — 수(水) 원소 비율 비례 */
export const JEONGJAE_SU_WEIGHT = 24.0

/** 편인(偏印): 흙 모으기 마지막 공격 +50% — 토(土) 원소 비율 비례 */
export const PYEONIN_TO_WEIGHT = 26.0

// --- 4층 적 원소 생성 (R7-2용)
/**
 * 5원소 순열 난수 생성
 * Fisher-Yates 셔플로 5원소를 무작위 순서로 정렬 후 각 층에 배치
 */
export function getRandomFloorElements(rng: () => number): Array<{
  primaryElement: Element
  subElement: Element
}> {
  const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

  // Fisher-Yates 셔플 (1층~4층용, 5원소 중 4개)
  const shuffled = [...ELEMENTS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const result = []
  for (let floor = 0; floor < 4; floor++) {
    const primaryIdx = Math.floor(rng() * ELEMENTS.length)
    const primary = ELEMENTS[primaryIdx]

    // 부 원소: 주 원소 제외 4원소 중 선택
    const subCandidates = ELEMENTS.filter(el => el !== primary)
    const subIdx = Math.floor(rng() * subCandidates.length)
    const sub = subCandidates[subIdx]

    result.push({ primaryElement: primary, subElement: sub })
  }

  return result
}

// ─── 배치 1.5: 레시피제(comboRuleset) + 강림제(yongsinDescent) ────────────────

/**
 * comboRuleset 토글 플래그
 * 'v3': 기존 체계 (융합 10쌍 무명 "치기", 배율 미분화)
 * 'recipe': 신규 체계 (융합 10쌍 명명 레시피, 4계층 위계)
 * 'v4': G3 신규 체계 (자유 성립·투입 장수 위계 — 이든 판정 2026-07-17)
 *       2원소 조합, 장수 자유 (v3 isFusionCombo 재사용)
 *       배율: 2장×1.5 / 3장×3.0 / 4장×4.0 / 5장×5.5 (계단식 위계절벽)
 *       접두 명명: 2장=소 / 5장=대 / 3~4장=접두 없음
 * 배포: v3 기본값 (v4는 G3 게이트 후 활성화)
 *
 * 배치 1.5-A-1 (2026-07-16): 모듈 로드 시 프로토 스위치(getDevComboRuleset)로 초기화.
 *   - 프로토 브라우저: ?ruleset=recipe → localStorage → 'recipe' (판정 경로 실제 진입)
 *   - 프로덕션/SSR/테스트: window 없음 → 'v3' 기본값 (기존 동작 동일)
 *   - export const 유지 → 테스트 vi.mock 오버라이드 그대로 호환
 */
export const COMBO_RULESET_VERSION: 'v3' | 'recipe' | 'v4' = getDevComboRuleset()

/**
 * 강림제 활성화 플래그
 * false: 기존 체계 (용신 상시 ×1.3)
 * true: 강림제 (2~3회 슬롯에서만 ×2.0, 소멸 처리)
 * 배포: false 기본값 (배치 1.5 재기준선 게이트 후 활성화)
 *
 * 배치 1.5-A-1 (2026-07-16): 프로토 스위치(getDevDescentEnabled)로 초기화.
 *   - 프로토: ?descent=true → true / 프로덕션·테스트: false 기본값
 */
export const ENABLE_YONGSIN_DESCENT = getDevDescentEnabled()

/**
 * 강림제 변형 모드 (시뮬 전용) — 2026-07-16 최신
 * 'slot': 0단계 기본 (2~3 슬롯 × ×2.0, 1턴 이월/소멸)
 * 'wait3': B-1 대기창 (폐기됨, 코드 유지만 함)
 * 'dual': B-2 이원 (폐기됨, 코드 유지만 함)
 * 'glow': B-3 잔광 — 슬롯 도래 3공격 대기, 용신 ×1.8 풀강림 / 만료 시 ×1.25 잔광
 */
export type DescentVariant = 'slot' | 'wait3' | 'dual' | 'glow'
export const DESCENT_VARIANT: DescentVariant = 'slot'

// B-3 잔광 배율 상수
export const DESCENT_GLOW_FULL_MULT = 1.8     // 풀강림 (슬롯+용신)
export const DESCENT_GLOW_AFTERGLOW_MULT = 1.25 // 잔광 (대기창 만료 시)

// ─── v4 재기준선: HP 레버 (이든 판정 2026-07-17, 옵션 A 채택) ──────────────────
/**
 * v4 HP 스케일 상수 — 균일 스케일 기준값 (v4 분기 전용)
 *
 * 설계 원칙:
 *  - 레버 = 적 HP 단일 (적 공격력·반격 불변)
 *  - v4 모드에서만 적용 — v3/recipe FLOOR_CONFIGS HP 불변
 *  - 균일 스케일 우선 시도 후 격차 ≤15%p 미달 시 층별 차등 도입
 *
 * 역산 추정 과정 (초기 → 실측 이진 탐색):
 *  Step 1: 초기 추정 V4_HP_SCALE = 2.0
 *    - 근거: v4 §2+§3 적용 후 클리어율 76~81% (v3 HP 동결 시)
 *      목표 25~40%, 4~5장 배율 v3 대비 +28~57% → HP ×2.0 역산
 *    - 실측: 목화1.7% / 금수3.0% / 토단일0.1% — 클리어율 과소 (HP 과대)
 *  Step 2: V4_HP_SCALE = 1.3
 *    - 실측: 목화42.3% / 금수42.7% / 토단일27.0% — 격차15.7%p (≤15% FAIL)
 *  Step 3: V4_HP_SCALE = 1.35 (균일)
 *    - 실측: 목화34.6% / 금수36.4% / 토단일20.7% — 격차15.7%p 고정, 토단일 25% 미달
 *  결론: 균일 스케일로 격차 15.7%p 고정 → 층별 차등 도입 필요
 *    원인: 토단일은 4층(보스: 금+목)에서 토가 금을 생(×0.5 피해)하여 화력 대폭 감소
 *           → 4층 HP 하향 + 1~3층 HP 상향으로 격차 조정
 *
 * ⚠️ 역산 예측은 초기 추정용 — 1000판×3프리셋 실측이 이긴다
 */
export const V4_HP_SCALE = 1.35  // 균일 기준값 (참조용 — 실제 적용은 V4_FLOOR_HP_TABLE)

/**
 * v4 층별 HP 테이블 — 층별 차등 (균일 스케일 격차 15.7%p 초과로 차등 전환)
 *
 * 차등 근거:
 *  - 토단일이 4층(보스: 금+목)에서 토→금 상생(×0.5) + damage-reduction 30% 이중 패널티
 *  - 4층 HP 하향(×1.15): 토단일 4층 클리어율 상승
 *  - 1~3층 HP 상향(×1.40): 목화/금수 클리어율 하향 → 격차 축소
 *  - v3 HP 원본 불변 보장 — additive 정의
 *
 * 설계값:
 *  - 1층: 220 × 1.40 = 308
 *  - 2층: 445 × 1.40 = 623
 *  - 3층: 680 × 1.40 = 952
 *  - 4층: 730 (제라 스윕 ZERA_V4_TODANIL_HP_SWEEP_20260718 게이트 PASS 검증)
 */
export const V4_FLOOR_HP_TABLE: Record<number, number> = {
  1: Math.round(220 * 1.40),  // 308
  2: Math.round(445 * 1.40),  // 623
  3: Math.round(680 * 1.40),  // 952
  4: 730,                      // 621 → 730 (토단일 HP 재조정 2026-07-18)
}

/**
 * 층 HP 헬퍼 — COMBO_RULESET_VERSION 분기를 단일 출처에서 처리
 *
 * @param floorIndex  0-indexed 층 인덱스 (FLOOR_CONFIGS 배열 인덱스)
 * @param versionOverride  테스트 주입용 버전 오버라이드 (생략 시 COMBO_RULESET_VERSION 사용)
 * @returns 실제 적용할 적 HP
 *   - v4 모드: V4_FLOOR_HP_TABLE[floorIndex + 1] (1-indexed 키)
 *   - v3 / recipe 모드: FLOOR_CONFIGS[floorIndex].enemyHp (불변)
 */
export function getFloorHp(floorIndex: number, versionOverride?: 'v3' | 'recipe' | 'v4'): number {
  const version = versionOverride ?? COMBO_RULESET_VERSION
  if (version === 'v4') {
    const hp = V4_FLOOR_HP_TABLE[floorIndex + 1]
    if (hp !== undefined) return hp
  }
  return FLOOR_CONFIGS[floorIndex].enemyHp
}

// ─── G3 v4: 자유 성립·투입 장수 위계 배율 (이든 판정 2026-07-17) ─────────────
/**
 * v4 계단식 배율표 (투입 장수 → 배율)
 * 2장: ×1.5  (접두: 소, 예: 소들불)
 * 3장: ×3.0  (접두 없음)
 * 4장: ×4.0  (접두 없음)
 * 5장: ×5.5  (접두: 대, 예: 대들불)
 *
 * 주의: v3·recipe 기존 배율 대체하지 않음 — v4 분기에서만 사용.
 * gather·오행연환·강림·역생 배율 불변.
 */
export const V4_TIER_MULTIPLIERS: Record<number, number> = {
  2: 1.5,
  3: 3.0,
  4: 4.0,
  5: 5.5,
}

// ─── G3 v4 §3: 황금비 곡선 — 비율 보정 계수 (이든 판정 2026-07-17) ────────────
/**
 * 장수별 정점 조합 (촉매수, 연료수)
 * 정점 = 황금비(연료:촉매 ≈ 3:2)를 장수 제약 내에서 최대한 근사한 조합.
 * 2장: 보정 면제 (항상 ×1.0)
 * 3장: 촉1+연2 (연료:촉매 = 2:1)
 * 4장: 촉2+연2 (균등 — 짝수 장은 균형이 정점)
 * 5장: 촉2+연3 (연료:촉매 = 3:2, 황금비 정확 일치)
 */
export const V4_PEAKS: Record<number, { catPeak: number; fuelPeak: number }> = {
  3: { catPeak: 1, fuelPeak: 2 },
  4: { catPeak: 2, fuelPeak: 2 },
  5: { catPeak: 2, fuelPeak: 3 },
}

/**
 * 비율 보정 계수 값 — A벌 채택 (이든 확정 2026-07-18)
 * 구 값: step1=0.85, step2=0.70
 * A벌: step1=0.70, step2=0.45 (비정점 페널티 강화)
 * 제라 측정(ZERA_PALJAJEON_V4_SPARSITY_RESTORE_RESULT_20260718.md) — 게이트 PASS (클리어율 34.9%, 격차 3.0%p)
 */
export const V4_RATIO_CORRECTION = {
  peak: 1.0,   // 정점: ×1.0 (불변)
  step1: 0.70, // 한 계단 이탈: ×0.70 (구 0.85 → A벌 0.70)
  step2: 0.45, // 두 계단 이탈(바닥): ×0.45 (구 0.70 → A벌 0.45)
} as const

/** 측정 이력 보존용 — A벌 (프로덕션 반영 완료, V4_RATIO_CORRECTION과 동일) */
export const V4_RATIO_CORRECTION_A = {
  peak: 1.0,
  step1: 0.70,
  step2: 0.45,
} as const

/** 측정 이력 보존용 — B벌 (미채택) */
export const V4_RATIO_CORRECTION_B = {
  peak: 1.0,
  step1: 0.75,  // 한 계단: 현행 0.85 → 0.75
  step2: 0.50,  // 두 계단 바닥: 현행 0.70 → 0.50
} as const

/** 비율 보정 테이블 타입 */
export type V4RatioCorrectionTable = {
  readonly peak: number
  readonly step1: number
  readonly step2: number
}

/**
 * v4 §3 황금비 곡선 — 이탈 계단 계산
 *
 * 계단 정의:
 *   d = cat - catPeak  (총 장수 고정이므로 fuel 편차의 음수)
 *   d > 0: 촉매 과다(연료 부족) / d < 0: 연료 과다(촉매 부족) / d = 0: 정점
 *
 *   이탈 크기는 정점 비율(catPeak:fuelPeak)로 정규화하여 계단을 산정한다.
 *   - 촉매 과다(d > 0): steps_raw = ceil(d × catPeak / fuelPeak)
 *   - 연료 과다(d < 0): steps_raw = ceil(|d| × fuelPeak / catPeak)
 *
 *   단, 정점이 균등 비율(catPeak === fuelPeak, 4장에서 발생)인 경우
 *   촉매 과다 방향 계단에 1을 가산한다. 이는 균등 정점에서 촉매가 늘면
 *   황금비(3:2)에서 역방향으로 이탈하는 효과가 가중되기 때문이다.
 *
 *   계단 상한: 2 (바닥 이하 없음)
 *
 * 옹기가마 기준 전표 검증 (촉=화/연=토):
 *   화1토1(2장)=면제×1.0 / 화1토2(3장정점)=×1.0 / 화2토1(3장)=×0.85
 *   화1토3(4장)=×0.85 / 화2토2(4장정점)=×1.0 / 화3토1(4장)=×0.70
 *   화1토4(5장)=×0.70 / 화2토3(5장정점)=×1.0 / 화3토2(5장)=×0.85 / 화4토1(5장)=×0.70
 *
 * @param cat   촉매 장수
 * @param fuel  연료 장수
 * @param N     총 투입 장수 (= cat + fuel)
 * @returns 이탈 계단 수 (0=정점, 1=한 계단, 2=두 계단/바닥)
 */
export function getV4RatioCorrectionSteps(cat: number, _fuel: number, N: number): number {
  if (N < 3) return 0  // 2장: 면제
  const peak = V4_PEAKS[N]
  if (!peak) return 0
  const { catPeak, fuelPeak } = peak
  const d = cat - catPeak
  if (d === 0) return 0

  let stepsRaw: number
  if (d > 0) {
    // 촉매 과다
    stepsRaw = Math.ceil(d * catPeak / fuelPeak)
    // 균등 정점(4장: catPeak===fuelPeak)에서 촉매 과다 시 1 계단 추가
    if (catPeak === fuelPeak) stepsRaw += 1
  } else {
    // 연료 과다
    stepsRaw = Math.ceil((-d) * fuelPeak / catPeak)
  }
  return Math.min(2, stepsRaw)
}

/**
 * v4 §3 황금비 곡선 — 비율 보정계수 반환
 * E2E 지문: const correction = V4_RATIO_CORRECTION[...] (단일 테이블 참조)
 *
 * @param cat   촉매 장수
 * @param fuel  연료 장수
 * @param N     총 투입 장수 (= cat + fuel)
 * @param table 비율 보정 테이블 (미입력 시 기본 V4_RATIO_CORRECTION 사용)
 * @returns 비율 보정계수
 */
export function getV4RatioCorrection(
  cat: number,
  fuel: number,
  N: number,
  table: V4RatioCorrectionTable = V4_RATIO_CORRECTION,
): number {
  if (N < 3) return table.peak  // 2장 면제 (온보딩 불변)
  const steps = getV4RatioCorrectionSteps(cat, fuel, N)
  if (steps === 0) return table.peak
  if (steps === 1) return table.step1
  return table.step2
}

/**
 * 10쌍 레시피 판정 맵
 * elem1: 주 원소, elem2: 부 원소
 * minCount: 소형 3장에서 부 원소 최소 장수 / 대형 5장에서 부 원소 최소 장수
 * fusionType: 'birth'(낳는) | 'hone'(벼리는) — elem2 고정 후 null 판별 불가하므로 명시 필드
 */
export interface RecipeSpec {
  small: { elem1: Element; elem2: Element; minCount: number }
  large: { elem1: Element; elem2: Element; minCount: number }
  fusionType: 'birth' | 'hone'
}

// 레시피 배율 (소형 3장 / 대형 5장)
export const RECIPE_SMALL_BIRTH_MULT = 3.0   // 소형 낳는 (기존 birth 동일)
export const RECIPE_SMALL_HONE_MULT = 3.5    // 소형 벼리는 (기존 hone 동일)
export const RECIPE_LARGE_BIRTH_MULT = 3.5   // 대형 낳는 (소형보다 0.5 상향) — fallback only
export const RECIPE_LARGE_HONE_MULT = 4.0    // 대형 벼리는 (소형보다 0.5 상향) — fallback only

// --- 대형 레시피 필살기 배율 (recipe 모드 한정, 소형 cap 5.0과 완전 분리)
// 위계표: 소형 5.0 < 대형 5.5~6.0 < gather5 6.5 < 연환 8
// "대형 = gather5 불가 사주의 필살기" 재정의
// A벌: ×5.5 / B벌: ×6.0
export const RECIPE_LARGE_MULT_A = 5.5
export const RECIPE_LARGE_MULT_B = 6.0

export const RECIPE_MAP: Record<string, RecipeSpec> = {
  // 낳는 5쌍 (birth)
  // fusion_forest — 숲 (수+목)
  'fusion_forest': {
    small: { elem1: 'su', elem2: 'mok', minCount: 2 },
    large: { elem1: 'su', elem2: 'mok', minCount: 3 },
    fusionType: 'birth',
  },
  // fusion_spring — 샘 (금+수)
  'fusion_spring': {
    small: { elem1: 'geum', elem2: 'su', minCount: 2 },
    large: { elem1: 'geum', elem2: 'su', minCount: 3 },
    fusionType: 'birth',
  },
  // fusion_mine — 광맥 (토+금)
  'fusion_mine': {
    small: { elem1: 'to', elem2: 'geum', minCount: 2 },
    large: { elem1: 'to', elem2: 'geum', minCount: 3 },
    fusionType: 'birth',
  },
  // fusion_kiln — 옹기가마 (화+토)
  'fusion_kiln': {
    small: { elem1: 'hwa', elem2: 'to', minCount: 2 },
    large: { elem1: 'hwa', elem2: 'to', minCount: 3 },
    fusionType: 'birth',
  },
  // fusion_wildfire — 들불 (목+화) — 정본 복원: RECIPE_MAP 화+화는 오기, FUSION_COMBOS 기준 목+화
  'fusion_wildfire': {
    small: { elem1: 'mok', elem2: 'hwa', minCount: 2 },
    large: { elem1: 'mok', elem2: 'hwa', minCount: 3 },
    fusionType: 'birth',
  },
  // 벼리는 5쌍 (hone) — 정본 극관계 원소 고정 (elem2=null 설계 버그 수정)
  // fusion_keen — 벼림 (금극목: 금+목)
  'fusion_keen': {
    small: { elem1: 'geum', elem2: 'mok', minCount: 2 },
    large: { elem1: 'geum', elem2: 'mok', minCount: 3 },
    fusionType: 'hone',
  },
  // fusion_snipe — 담금질 (수극화: 수+화)
  'fusion_snipe': {
    small: { elem1: 'su', elem2: 'hwa', minCount: 2 },
    large: { elem1: 'su', elem2: 'hwa', minCount: 3 },
    fusionType: 'hone',
  },
  // fusion_harvest — 개간 (목극토: 목+토)
  'fusion_harvest': {
    small: { elem1: 'mok', elem2: 'to', minCount: 2 },
    large: { elem1: 'mok', elem2: 'to', minCount: 3 },
    fusionType: 'hone',
  },
  // fusion_pierce — 제방 (토극수: 토+수) — 특성 없음 (순수 화력) — 배치 1.5 스코프 밖
  // 원소 변경: 금+수(구) → 토+수(정본, 토극수). fusion_spring(금+수)과 충돌 해소됨.
  'fusion_pierce': {
    small: { elem1: 'to', elem2: 'su', minCount: 2 },
    large: { elem1: 'to', elem2: 'su', minCount: 3 },
    fusionType: 'hone',
  },
  // fusion_temper — 주물 (화극금: 화+금) — 특성 없음 (순수 화력) — 배치 1.5 스코프 밖
  'fusion_temper': {
    small: { elem1: 'hwa', elem2: 'geum', minCount: 2 },
    large: { elem1: 'hwa', elem2: 'geum', minCount: 3 },
    fusionType: 'hone',
  },
}

/**
 * Recipe (B) 사주별 배율 — 공식: M = 1 + 0.8 / (성립률%)
 * 0단계 측정 성립률 기준으로 배율 산출 후 출정 시 고정 (런 중 재계산 금지)
 * 캡: [2.0, 5.0]
 */
export type RecipePresetKey = 'mokHwa' | 'geumSu' | 'toDanil'

export interface RecipeMultiplierTable {
  [recipeId: string]: number
}

/**
 * Recipe (B) 사주별 배율 재산출 (2026-07-16 정본화 후 전면 재실측)
 *
 * 구조 정본화:
 *  - fusion_wildfire: 화+화 → 목+화 (RECIPE_MAP 오기 수정)
 *  - fusion_keen:     null → 금+목 (금극목 고정)
 *  - fusion_snipe:    null → 수+화 (수극화 고정)
 *  - fusion_harvest:  null → 목+토 (목극토 고정)
 *  - fusion_pierce:   금+수 → 토+수 (토극수, elem1 변경)
 *
 * 재실측 성립률 (핸드 샘플링 10000핸드):
 *  목화: wildfire 15.58% / 나머지 1.1~4.6% / keen 4.56% / snipe 4.64% / harvest 4.58%
 *  금수: spring 15.87% / 나머지 1.1~4.7% / keen 4.55% / pierce 4.61%
 *  토단일: mine 19.59% / pierce 19.53% / harvest 7.93% / kiln 7.85% / wildfire 0%
 *
 * 공식: M = max(lowerBound, min(cap, 1 + K/(rate%)))
 *  mokHwa/toDanil: K=0.8, lowerBound=2.0, cap=5.0
 *  geumSu:         K=0.65, lowerBound=1.6, cap=5.0 (복원 — cap 다이얼 휴면 2026-07-16)
 *
 * 정본화 후 구조 특성: 원소 특정으로 모든 성립률 < 20%
 * → mokHwa/toDanil: K 공식 전량 상한 5.0 cap
 * → geumSu: cap 5.0 복원 — cap 다이얼 휴면 (배율 bottleneck 아님, 역효과 실측)
 * → 예외: wildfire 토단일=0% → 기본값 3.0
 */
export const RECIPE_MULTIPLIER_BY_PRESET: Record<RecipePresetKey, RecipeMultiplierTable> = {
  // 목화 — K=0.8, lowerBound=2.0 (재실측 기반)
  // fusion_keen — 벼림 (금극목: 금+목): 4.56% → cap 5.0
  // fusion_harvest — 개간 (목극토: 목+토): 4.58% → cap 5.0
  // fusion_snipe — 담금질 (수극화: 수+화): 4.64% → cap 5.0
  // fusion_wildfire — 들불 (목+화): 15.58% → cap 5.0
  mokHwa: {
    fusion_forest:   5.00,  // 4.63% → cap 5.0
    fusion_spring:   5.00,  // 1.12% → cap 5.0
    fusion_mine:     5.00,  // 1.12% → cap 5.0
    fusion_kiln:     5.00,  // 4.59% → cap 5.0
    fusion_wildfire: 5.00,  // 15.58% → 1+0.8/0.1558=6.13 → cap 5.0
    fusion_keen:     5.00,  // 4.56% → cap 5.0
    fusion_snipe:    5.00,  // 4.64% → cap 5.0
    fusion_harvest:  5.00,  // 4.58% → cap 5.0
    fusion_pierce:   5.00,  // 1.13% → cap 5.0
    fusion_temper:   5.00,  // 4.54% → cap 5.0
  },
  // 금수 — K=0.65, lowerBound=1.6, cap=5.0 (복원 2026-07-16 이든 판정)
  // 재실측: keen 76.8%(구)→4.55%(정본화). spring 15.87% 최고.
  // cap 5.5/6.0 실험: 역효과(상향할수록 클리어율 하락) — cap 다이얼 휴면 판정.
  // 대형 레시피 소형/대형 배율 분리 처방 이든 판정 대기.
  geumSu: {
    fusion_forest:   5.00,  // 4.58% → cap 5.0
    fusion_spring:   5.00,  // 15.87% → 1+0.65/0.1587=5.10 → cap 5.0
    fusion_mine:     5.00,  // 4.60% → cap 5.0
    fusion_kiln:     5.00,  // 1.10% → cap 5.0
    fusion_wildfire: 5.00,  // 1.11% → cap 5.0
    fusion_keen:     5.00,  // 4.55% → cap 5.0
    fusion_snipe:    5.00,  // 4.66% → cap 5.0
    fusion_harvest:  5.00,  // 1.11% → cap 5.0
    fusion_pierce:   5.00,  // 4.61% → cap 5.0
    fusion_temper:   5.00,  // 4.61% → cap 5.0
  },
  // 토단일 — K=0.8, lowerBound=2.0 (재실측 기반)
  // mine(토+금) 19.59% / pierce(토+수) 19.53% / harvest(목+토) 7.93% / kiln(화+토) 7.85%
  // wildfire(목+화) 0% — 토단일 덱에 목 1장뿐, 목+화 동시 불성립
  toDanil: {
    fusion_forest:   5.00,  // 0.09% → cap 5.0
    fusion_spring:   5.00,  // 0.34% → cap 5.0
    fusion_mine:     5.00,  // 19.59% → 1+0.8/0.1959=5.08 → cap 5.0
    fusion_kiln:     5.00,  // 7.85% → 1+0.8/0.0785=11.19 → cap 5.0
    fusion_wildfire: 3.00,  // 0% 발동불가 — 기본값 3.0
    fusion_keen:     5.00,  // 0.09% → cap 5.0
    fusion_snipe:    5.00,  // 0.09% → cap 5.0
    fusion_harvest:  5.00,  // 7.93% → 1+0.8/0.0793=11.09 → cap 5.0
    fusion_pierce:   5.00,  // 19.53% → 1+0.8/0.1953=5.10 → cap 5.0
    fusion_temper:   5.00,  // 0.09% → cap 5.0
  },
}

/**
 * elementDist 기반 사주 preset 식별
 * 목화: mok:4, hwa:4 / 금수: geum:4, su:4 / 토단일: to:14
 */
export function identifyRecipePreset(elementDist: Record<Element, number>): RecipePresetKey {
  if ((elementDist.mok ?? 0) >= 4 && (elementDist.hwa ?? 0) >= 4) {
    return 'mokHwa'
  }
  if ((elementDist.geum ?? 0) >= 4 && (elementDist.su ?? 0) >= 4) {
    return 'geumSu'
  }
  if ((elementDist.to ?? 0) >= 10) {
    return 'toDanil'
  }
  // 기본값: 목화
  return 'mokHwa'
}
