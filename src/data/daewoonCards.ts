/**
 * 대운(大運) 카드 4종 — Phase 3-2
 *
 * 특별 카테고리: 전투당 1회 사용 제한
 * GameState.usedDaewoon[]에 사용 기록 → 중복 발동 차단
 *
 * 효과 실행은 daewoonEngine.ts에서 처리
 */

import type { SpellCard } from '@/types/cards'

export const DAEWOON_01: SpellCard = {
  id: 'DAEWOON-01',
  name: '시간역행 (時間逆行)',
  cost: 5,
  element: null,
  rarity: 'legendary',
  cardType: 'spell',
  subtype: 'special',
  effectText: '직전 행동 1회 undo (최대 3행동 전으로 복원)',
  flavorText: '운명의 물줄기를 거슬러 오른다. 단 한 번만',
}

export const DAEWOON_02: SpellCard = {
  id: 'DAEWOON-02',
  name: '월운가속 (月運加速)',
  cost: 3,
  element: null,
  rarity: 'legendary',
  cardType: 'spell',
  subtype: 'special',
  effectText: '다음 2턴 에너지 +2',
  flavorText: '달의 운기가 흐름을 빠르게 한다',
}

export const DAEWOON_03: SpellCard = {
  id: 'DAEWOON-03',
  name: '시운정지 (時運停止)',
  cost: 4,
  element: null,
  rarity: 'legendary',
  cardType: 'spell',
  subtype: 'special',
  effectText: '적의 다음 턴을 건너뜀 (AI 턴 스킵 1회)',
  flavorText: '시간이 멈추면 적만 혼자 얼어붙는다',
}

export const DAEWOON_04: SpellCard = {
  id: 'DAEWOON-04',
  name: '운명반전 (運命反轉)',
  cost: 6,
  element: null,
  rarity: 'legendary',
  cardType: 'spell',
  subtype: 'special',
  effectText: '오행 상성 2턴 역전 (상극↔상생 교환)',
  flavorText: '하늘이 뒤집히면 강자가 약자가 된다',
}

export const ALL_DAEWOON_CARDS: SpellCard[] = [
  DAEWOON_01,
  DAEWOON_02,
  DAEWOON_03,
  DAEWOON_04,
]

/** 대운 카드 ID 집합 */
export const DAEWOON_CARD_IDS = new Set(ALL_DAEWOON_CARDS.map(c => c.id))
