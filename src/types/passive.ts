/**
 * 팔자전 — 패시브 타입 정의
 */

export type PassiveRarity = 'common' | 'rare' | 'hero'

export interface Passive {
  id: string
  name: string          // "식신", "귀문" 등
  effect: string        // 1줄 효과 설명
  rarity: PassiveRarity
  element?: string      // 관련 오행 (있을 시)
}

/** 기본 패시브 풀 (Phase 1 — 4종 이상) */
export const PASSIVE_POOL: Passive[] = [
  {
    id: 'sikshin',
    name: '식신(食神)',
    effect: '기운 잇기 조합 시 피해 +20%',
    rarity: 'common',
  },
  {
    id: 'gwiha',
    name: '귀하(貴河)',
    effect: '같은 기운 모으기 3 이상 시 적 반격 -1',
    rarity: 'common',
  },
  {
    id: 'cheongryong',
    name: '청룡(靑龍)',
    effect: '나무 기운 카드 포함 시 첫 출수 피해 +30%',
    rarity: 'rare',
    element: 'mok',
  },
  {
    id: 'jujak',
    name: '주작(朱雀)',
    effect: '불 기운 카드 2장 이상 시 피해 ×1.5',
    rarity: 'rare',
    element: 'hwa',
  },
  {
    id: 'baekho',
    name: '백호(白虎)',
    effect: '쇠 기운으로 이기는 기운 발동 시 체력 3 회복',
    rarity: 'rare',
    element: 'geum',
  },
  {
    id: 'hyeonmu',
    name: '현무(玄武)',
    effect: '물 기운 5장 이상 시 오행연환 배율 +2',
    rarity: 'hero',
    element: 'su',
  },
  {
    id: 'guhwang',
    name: '구황(勾黃)',
    effect: '흙 기운 결집 시 마지막 출수 피해 +50%',
    rarity: 'hero',
    element: 'to',
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
