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
  4: 4.0,   // B1-6: 벼리는(×3.5) 동률 해소
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
 * 배포: v3 기본값 (recipe는 배치 1.5 재기준선 게이트 후 활성화)
 */
export const COMBO_RULESET_VERSION: 'v3' | 'recipe' = 'v3'

/**
 * 강림제 활성화 플래그
 * false: 기존 체계 (용신 상시 ×1.3)
 * true: 강림제 (2~3회 슬롯에서만 ×2.0, 소멸 처리)
 * 배포: false 기본값 (배치 1.5 재기준선 게이트 후 활성화)
 */
export const ENABLE_YONGSIN_DESCENT = false

/**
 * 10쌍 레시피 판정 맵
 * elem1: 주 원소, elem2: 부 원소 (null이면 "他" — elem1 외 아무 원소)
 * minCount: 소형 3장에서 부 원소 최소 장수 / 대형 5장에서 부 원소 최소 장수
 */
export interface RecipeSpec {
  small: { elem1: Element; elem2: Element | null; minCount: number }
  large: { elem1: Element; elem2: Element | null; minCount: number }
}

export const RECIPE_MAP: Record<string, RecipeSpec> = {
  // 낳는 5쌍
  'fusion_forest': {
    small: { elem1: 'su', elem2: 'mok', minCount: 2 },
    large: { elem1: 'su', elem2: 'mok', minCount: 3 },
  },
  'fusion_spring': {
    small: { elem1: 'geum', elem2: 'su', minCount: 2 },
    large: { elem1: 'geum', elem2: 'su', minCount: 3 },
  },
  'fusion_mine': {
    small: { elem1: 'to', elem2: 'geum', minCount: 2 },
    large: { elem1: 'to', elem2: 'geum', minCount: 3 },
  },
  'fusion_kiln': {
    small: { elem1: 'hwa', elem2: 'to', minCount: 2 },
    large: { elem1: 'hwa', elem2: 'to', minCount: 3 },
  },
  'fusion_wildfire': {
    small: { elem1: 'hwa', elem2: 'hwa', minCount: 3 },
    large: { elem1: 'hwa', elem2: 'hwa', minCount: 5 },
  },
  // 벼리는 5쌍 (elem2=null → elem1 외 타 원소)
  'fusion_keen': {
    small: { elem1: 'geum', elem2: null, minCount: 2 },
    large: { elem1: 'geum', elem2: null, minCount: 3 },
  },
  'fusion_snipe': {
    small: { elem1: 'su', elem2: null, minCount: 2 },
    large: { elem1: 'su', elem2: null, minCount: 3 },
  },
  'fusion_harvest': {
    small: { elem1: 'mok', elem2: null, minCount: 2 },
    large: { elem1: 'mok', elem2: null, minCount: 3 },
  },
  'fusion_pierce': {
    small: { elem1: 'geum', elem2: 'su', minCount: 2 },
    large: { elem1: 'geum', elem2: 'su', minCount: 3 },
  },
  'fusion_temper': {
    small: { elem1: 'hwa', elem2: 'geum', minCount: 2 },
    large: { elem1: 'hwa', elem2: 'geum', minCount: 3 },
  },
}
