/**
 * 팔자전 — 덱 관리 Store (Phase 2)
 * - 사주 프로필 있을 시 사주 기반 덱 생성
 * - 없을 시 고정 덱 (Phase 1 호환)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DeckCard } from '../types/deck'
import { createFixedDeck } from '../engine/paljajeonEngine'
import { generateSajuDeck } from '../engine/deckGenerator'
import type { Card, SavedHeroProfile } from '../types/game'

interface DeckStore {
  deck: DeckCard[]
  initDeck: (heroProfile?: SavedHeroProfile | null) => void
  addCard: (card: Card) => void
}

function toDeckCard(card: Card): DeckCard {
  return {
    ...card,
    acquiredAt: new Date().toISOString(),
    upgradeLevel: 0,
  }
}

export const useDeckStore = create<DeckStore>()(
  persist(
    (set) => ({
      deck: [],

      initDeck: (heroProfile?: SavedHeroProfile | null) => {
        let cards: Card[]
        if (heroProfile?.elementDist && heroProfile?.deckSeed) {
          cards = generateSajuDeck(heroProfile.elementDist, heroProfile.deckSeed)
        } else {
          cards = createFixedDeck()
        }
        set({ deck: cards.map(toDeckCard) })
      },

      addCard: (card: Card) => {
        set(state => ({
          deck: [...state.deck, toDeckCard(card)],
        }))
      },
    }),
    {
      name: 'paljajeon-deck-v1',
    }
  )
)
