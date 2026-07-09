/**
 * 팔자전 — 덱 관리 Store
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DeckCard } from '../types/deck'
import { createFixedDeck } from '../engine/paljajeonEngine'
import type { Card } from '../types/game'

interface DeckStore {
  deck: DeckCard[]
  initDeck: () => void
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

      initDeck: () => {
        const fixedDeck = createFixedDeck().map(toDeckCard)
        set({ deck: fixedDeck })
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
