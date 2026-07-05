/**
 * 팔자패 카드 업그레이드 데이터 — M7 P1
 * 리라 M7 P1 UX 스펙 §업그레이드 카드 데이터 설계 기준
 *
 * - 원본 카드 ID + '_plus' 접미사
 * - 기존 밸런스 공식 §9-1 유지 (공격력 + 체력 = 비용 × 2 + 1)
 * - 업그레이드 후: +1~2 스탯 상향 또는 키워드 추가
 */

import type { Card, SoldierCard, SpellCard } from '@/types/cards'

// ────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────

export interface UpgradeEntry {
  /** 원본 카드 ID */
  baseId: string
  /** 강화된 카드 객체 (Card 타입 그대로) */
  upgraded: Card
}

// ────────────────────────────────────────────────────
// 업그레이드 카드 데이터 5종
// ────────────────────────────────────────────────────

/** 1. W-01 새싹 도사 → 묘목 도사 (苗木道士) */
const W01_PLUS: SoldierCard = {
  id: 'W-01_plus',
  name: '묘목 도사 (苗木道士)',
  cost: 1,
  element: '木',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 3,
  keywords: [],
  battlecry: '소환시 카드 1드로우. 木 카드면 추가 1드로우',
  flavorText: '이제 조금은 알 것 같아요. 아직 조금이요',
}

/** 2. F-01 화염 소졸 → 맹화 선봉 (猛火先鋒) */
const F01_PLUS: SoldierCard = {
  id: 'F-01_plus',
  name: '맹화 선봉 (猛火先鋒)',
  cost: 1,
  element: '火',
  rarity: 'common',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 1,
  keywords: ['rush'],
  flavorText: '더 세게 치고 나중에 생각한다',
}

/** 3. T-02 황토 거인 → 황토 거인+ (黃土巨人強) */
const T02_PLUS: SoldierCard = {
  id: 'T-02_plus',
  name: '황토 거인 强 (黃土巨人强)',
  cost: 4,
  element: '土',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 9,
  keywords: ['taunt', 'reborn'],
  flavorText: '한 번 더 버텨봅니다',
}

/** 4. W-05 봄바람 주문 → 여름바람 주문 (夏風術) */
const W05_PLUS: SpellCard = {
  id: 'W-05_plus',
  name: '여름바람 주문 (夏風術)',
  cost: 1,
  element: '木',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 유닛 1개에 +1/+3, 이번 턴 카드 1드로우',
  flavorText: '여름이 되니 더 나아졌다',
}

/** 5. F-02 불꽃 화살 → 화룡 화살 (火龍矢) */
const F02_PLUS: SpellCard = {
  id: 'F-02_plus',
  name: '화룡 화살 (火龍矢)',
  cost: 1,
  element: '火',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '적 유닛 or 영웅에 3 피해',
  flavorText: '조준? 그냥 더 세게 쏘면 됩니다',
}

// ────────────────────────────────────────────────────
// UPGRADE_MAP — baseId → UpgradeEntry
// ────────────────────────────────────────────────────

export const UPGRADE_MAP: Record<string, UpgradeEntry> = {
  'W-01': { baseId: 'W-01', upgraded: W01_PLUS },
  'F-01': { baseId: 'F-01', upgraded: F01_PLUS },
  'T-02': { baseId: 'T-02', upgraded: T02_PLUS },
  'W-05': { baseId: 'W-05', upgraded: W05_PLUS },
  'F-02': { baseId: 'F-02', upgraded: F02_PLUS },
}

/** 카드 ID가 업그레이드 가능한지 확인 */
export function isUpgradable(cardId: string): boolean {
  // 스타터 덱 접미사 제거 후 확인 (예: 'F-01_s0' → 'F-01')
  const baseId = cardId.replace(/_(?:s\d+|ai\d+|[a-z])$/, '')
  return Object.prototype.hasOwnProperty.call(UPGRADE_MAP, baseId)
}

/** 카드 ID에 해당하는 업그레이드 엔트리 반환 */
export function getUpgradeEntry(cardId: string): UpgradeEntry | undefined {
  const baseId = cardId.replace(/_(?:s\d+|ai\d+|[a-z])$/, '')
  return UPGRADE_MAP[baseId]
}
