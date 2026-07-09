/**
 * 팔자전 — 덱 타입
 */
import type { Card } from './game'

export interface HandCard extends Card {
  isSelected: boolean
  isDiscarded: boolean
}

export interface DeckCard extends Card {
  acquiredAt: string  // ISO date
  upgradeLevel: number  // 0 = base, max = 2
}

export interface DeckState {
  cards: DeckCard[]
  maxSize: number
}
