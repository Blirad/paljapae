/**
 * 팔자전 — 패시브 타입 정의
 * 배치 2 §1: 십성(十星) 10종 정본 (SPEC_gaho_v2)
 *
 * 기존 7종 + 신규 3종 (편관/정관/정인) 추가
 * sipsong 코드 기존 명칭 유지 + 신규: pyeongwan/jeonggwan/jeongin
 */

export type PassiveRarity = 'common' | 'rare' | 'hero' | 'legendary'

export interface Passive {
  id: string
  name: string          // "식신", "비견" 등
  effect: string        // 1줄 효과 설명
  rarity: PassiveRarity
  element?: string      // 관련 오행 (있을 시)
  sipsong: string       // 십성 코드
}

/**
 * 배치 2 §1 정본 10종 십성(十星) 패시브 풀
 * 식신·비견·겁재·상관·편재·정재·편인·편관·정관·정인
 */
export const PASSIVE_POOL: Passive[] = [
  {
    id: 'sikshin',
    name: '식신(食神)',
    effect: '융합 시 밥알 +버린장수 누적; 5밥알마다 융합 피해 ×1.3 (1회 소비)',
    rarity: 'common',
    sipsong: 'sikshin',
  },
  {
    id: 'bigyeon',
    name: '비견(比肩)',
    effect: '이번 전투 첫 융합 시 같은 피해를 한 번 더 가함 (반격 1회만); 이후 미발동',
    rarity: 'common',
    sipsong: 'bigyeon',
  },
  {
    id: 'geoptae',
    name: '겁재(劫財)',
    effect: '전투 시작 시 25% 실패 판정: 성공=첫 공격 +적최대HP×8%, 실패=플레이어 HP-5',
    rarity: 'rare',
    sipsong: 'geoptae',
  },
  {
    id: 'sanggwan',
    name: '상관(傷官)',
    effect: '황금비 정점 도달 시 50% 확률로 피해 ×2.0, 아니면 ×1.2',
    rarity: 'rare',
    sipsong: 'sanggwan',
  },
  {
    id: 'pyeonjae',
    name: '편재(偏財)',
    effect: '턴 종료 시 20% 확률로 왕족 또는 고값(8~10) 카드 1장을 손패에 추가',
    rarity: 'rare',
    sipsong: 'pyeonjae',
  },
  {
    id: 'jeongjae',
    name: '정재(正財)',
    effect: '오행연환 발동 시 덱에서 카드 2장 드로우',
    rarity: 'hero',
    sipsong: 'jeongjae',
  },
  {
    id: 'pyeonin',
    name: '편인(偏印)',
    effect: '소융합(2장) 시 피해 ×1.6',
    rarity: 'hero',
    sipsong: 'pyeonin',
  },
  {
    id: 'pyeongwan',
    name: '편관(偏官)',
    effect: '이번 공격 피해 ≥ 적최대HP×15% 시 추가 공격권 +1 (턴당 1회)',
    rarity: 'rare',
    sipsong: 'pyeongwan',
  },
  {
    id: 'jeonggwan',
    name: '정관(正官)',
    effect: '효과 모드(양자택일) 선택 시 효과량 ×1.5',
    rarity: 'rare',
    sipsong: 'jeonggwan',
  },
  {
    id: 'jeongin',
    name: '정인(正印)',
    effect: '런당 1회: 사망 직전 HP를 1로 가로채고 다음 융합 피해 ×1.5 버프 부여',
    rarity: 'hero',
    sipsong: 'jeongin',
  },
]

/** 등급별 색상 (이름/등급 텍스트) */
export const PASSIVE_RARITY_COLORS: Record<PassiveRarity, string> = {
  common:    '#D8CCB4',
  rare:      '#A8B4C0',
  hero:      '#D9A441',
  legendary: '#C9A227',
}

/** 등급별 테두리 색상 */
export const PASSIVE_RARITY_BORDER: Record<PassiveRarity, string> = {
  common:    '#4A4540',
  rare:      '#A8B4C0',
  hero:      '#B38A30',
  legendary: '#C9A227',
}

/** 등급별 테두리 두께 */
export const PASSIVE_RARITY_BORDER_WIDTH: Record<PassiveRarity, string> = {
  common:    '1px',
  rare:      '2px',
  hero:      '1px',
  legendary: '2px',
}

/** 등급별 box-shadow (글로우) */
export const PASSIVE_RARITY_SHADOW: Record<PassiveRarity, string> = {
  common:    'none',
  rare:      '0 0 6px 1px rgba(168,180,192,0.35)',
  hero:      'none',
  legendary: '0 0 8px 2px rgba(201,162,39,0.45)',
}

/** 등급 표시 이름 */
export const PASSIVE_RARITY_LABEL: Record<PassiveRarity, string> = {
  common:    '일반',
  rare:      '희귀',
  hero:      '영웅',
  legendary: '전설',
}
