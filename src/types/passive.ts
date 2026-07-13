/**
 * 팔자전 — 패시브 타입 정의
 * Phase 1.6 C항목: 바이블 3-4 십성(十星) 7종으로 교체
 *
 * 교체 이력:
 *  - 주작(朱雀)   → 식신(食神)  : 바이블 3-4 조식명 정책 준수
 *  - 귀하(貴河)   → 비견(比肩)  : 바이블 3-4 조식명 정책 준수
 *  - 현무(玄武)   → 겁재(劫財)  : 바이블 3-4 조식명 정책 준수
 *  - 구황(勾黃)   → 상관(傷官)  : 바이블 3-4 조식명 정책 준수
 *  - 청룡(靑龍)   → 편재(偏財)  : 바이블 3-4 조식명 정책 준수
 *  - (신규) 정재(正財), 편인(偏印) 추가
 */

export type PassiveRarity = 'common' | 'rare' | 'hero'

export interface Passive {
  id: string
  name: string          // "식신", "비견" 등
  effect: string        // 1줄 효과 설명
  rarity: PassiveRarity
  element?: string      // 관련 오행 (있을 시)
  sipsong: string       // 십성 코드: 'sikshin' | 'bigyeon' | 'geoptae' | 'sanggwan' | 'pyeonjae' | 'jeongjae' | 'pyeonin'
}

/**
 * 바이블 3-4 정식 7종 십성(十星) 패시브 풀
 * 식신·비견·겁재·상관·편재·정재·편인
 */
export const PASSIVE_POOL: Passive[] = [
  {
    id: 'sikshin',
    name: '식신(食神)',
    effect: '낱장 조합 시 피해 +20%',
    rarity: 'common',
    sipsong: 'sikshin',
  },
  {
    id: 'bigyeon',
    name: '비견(比肩)',
    effect: '같은 기운 모으기 3 이상 시 적 반격 -1',
    rarity: 'common',
    sipsong: 'bigyeon',
  },
  {
    id: 'geoptae',
    name: '겁재(劫財)',
    effect: '나무 기운 카드 포함 시 첫 공격 피해 +30%',
    rarity: 'rare',
    element: 'mok',
    sipsong: 'geoptae',
  },
  {
    id: 'sanggwan',
    name: '상관(傷官)',
    effect: '불 기운 카드 3장 이상 시 피해 ×1.25',
    rarity: 'rare',
    element: 'hwa',
    sipsong: 'sanggwan',
  },
  {
    id: 'pyeonjae',
    name: '편재(偏財)',
    effect: '쇠 기운으로 이기는 기운 발동 시 체력 3 회복',
    rarity: 'rare',
    element: 'geum',
    sipsong: 'pyeonjae',
  },
  {
    id: 'jeongjae',
    name: '정재(正財)',
    effect: '물 기운 5장 이상 시 오행연환 배율 +2',
    rarity: 'hero',
    element: 'su',
    sipsong: 'jeongjae',
  },
  {
    id: 'pyeonin',
    name: '편인(偏印)',
    effect: '흙 기운 결집 시 마지막 공격 피해 +50%',
    rarity: 'hero',
    element: 'to',
    sipsong: 'pyeonin',
  },
]

/** 등급별 색상 */
export const PASSIVE_RARITY_COLORS: Record<PassiveRarity, string> = {
  common: '#D8CCB4',
  rare:   '#4A9B6E',
  hero:   '#D9A441',
}

/** 등급별 테두리 색상 */
export const PASSIVE_RARITY_BORDER: Record<PassiveRarity, string> = {
  common: '#4A4540',
  rare:   '#3A7A55',
  hero:   '#B38A30',
}

/** 등급 표시 이름 */
export const PASSIVE_RARITY_LABEL: Record<PassiveRarity, string> = {
  common: '일반',
  rare:   '희귀',
  hero:   '영웅',
}
