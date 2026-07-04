/**
 * 카드 데이터 모델
 * 마스터플랜 §4 카드 분류 체계 및 스탯 프레임
 */

import type { FiveElement } from './elements'

// ────────────────────────────────────────────────────
// 희귀도 (마스터플랜 §4-3)
// ────────────────────────────────────────────────────

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export const RARITY_LABEL: Record<Rarity, string> = {
  common:    '평범 (平凡)',
  uncommon:  '별호 (別號)',
  rare:      '고수 (高手)',
  legendary: '전설 (傳說)',
}

// ────────────────────────────────────────────────────
// 키워드 (마스터플랜 §4-2)
// ────────────────────────────────────────────────────

export type Keyword =
  | 'rush'         // 돌진 — 소환 당턴 즉시 공격 가능 (火 친화)
  | 'taunt'        // 도발 — 적이 반드시 이 유닛부터 공격 (土 친화)
  | 'poison'       // 독성 — 공격 시 적 무조건 파괴 (木 친화)
  | 'lifesteal'    // 생명흡수 — 가한 피해만큼 영웅 HP 회복 (水 친화)
  | 'freeze'       // 냉기 — 공격당한 적 다음 턴 공격 불가 (水 친화)
  | 'pierce'       // 관통 — 유닛 무시하고 영웅에 직접 딜 가능 (金 친화)
  | 'reborn'       // 부활 — 처음 파괴 시 HP 1로 부활 (土 친화)
  | 'incinerate'   // 소각 — 처치된 적 묘지 대신 제거(부활 방지) (火 친화)

export const KEYWORD_LABEL: Record<Keyword, string> = {
  rush:       '急습(돌진)',
  taunt:      '守위(도발)',
  poison:     '毒수(독성)',
  lifesteal:  '回生(생명흡수)',
  freeze:     '凍결(냉기)',
  pierce:     '貫통(관통)',
  reborn:     '再生(부활)',
  incinerate: '滅滅(소각)',
}

// ────────────────────────────────────────────────────
// 카드 타입
// ────────────────────────────────────────────────────

/** 카드 종류: 병사(유닛) vs 효과(주문) */
export type CardType = 'soldier' | 'spell'

/** 효과 카드 세부 분류 (마스터플랜 §4-1 B) */
export type SpellSubtype =
  | 'attack'   // 공격 주문
  | 'buff'     // 강화 주문
  | 'debuff'   // 방해 주문
  | 'draw'     // 드로우 주문
  | 'summon'   // 생성 주문

// ────────────────────────────────────────────────────
// 카드 공통 기반
// ────────────────────────────────────────────────────

interface CardBase {
  /** 고유 ID (예: 'F-01', 'W-03') */
  id: string
  /** 카드명 */
  name: string
  /** 비용: 1~5 에너지 */
  cost: number
  /** 오행 속성 (중립 카드는 null) */
  element: FiveElement | null
  /** 희귀도 */
  rarity: Rarity
  /** 플레이버 텍스트 */
  flavorText: string
}

// ────────────────────────────────────────────────────
// 병사 카드
// ────────────────────────────────────────────────────

export interface SoldierCard extends CardBase {
  cardType: 'soldier'
  /** 공격력 */
  attack: number
  /** 최대 체력 */
  maxHealth: number
  /** 보유 키워드 목록 */
  keywords: Keyword[]
  /** 소환 시 효과 텍스트 (표시용) */
  battlecry?: string
}

// ────────────────────────────────────────────────────
// 효과 카드
// ────────────────────────────────────────────────────

export interface SpellCard extends CardBase {
  cardType: 'spell'
  /** 세부 분류 */
  subtype: SpellSubtype
  /** 효과 설명 텍스트 */
  effectText: string
}

/** 카드 유니온 타입 */
export type Card = SoldierCard | SpellCard

// ────────────────────────────────────────────────────
// 필드 위 유닛 상태 (카드 + 런타임 상태)
// ────────────────────────────────────────────────────

export interface FieldUnit {
  /** 원본 카드 데이터 */
  card: SoldierCard
  /** 현재 체력 */
  currentHealth: number
  /** 현재 공격력 (버프/디버프 적용 후) */
  currentAttack: number
  /** 이번 턴 공격 가능 여부 */
  canAttack: boolean
  /** 냉기(동결) 상태 */
  frozen: boolean
  /** 부활 사용 여부 (1회만 발동) */
  rebornUsed: boolean
  /** 소환된 턴 (돌진 판별용) */
  summonedOnTurn: number
  /** 임시 키워드 추가 목록 (버프 카드 등으로 부여된 것) */
  temporaryKeywords: Keyword[]
}

// ────────────────────────────────────────────────────
// 타입 가드
// ────────────────────────────────────────────────────

export function isSoldierCard(card: Card): card is SoldierCard {
  return card.cardType === 'soldier'
}

export function isSpellCard(card: Card): card is SpellCard {
  return card.cardType === 'spell'
}
