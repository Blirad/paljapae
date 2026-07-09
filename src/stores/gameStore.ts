/**
 * 팔자전 — 게임 상태 Store (Zustand)
 * 층수 / 핸드 / 출수 카운트 관리
 */

import { create } from 'zustand'
import type { GameState } from '../types/game'
import {
  createInitialGameState,
  playCards,
  discardCards,
  advanceToNextFloor,
} from '../engine/paljajeonEngine'
import { judgeHand } from '../engine/pokerHandJudge'
import type { HandJudgeResult } from '../types/game'

interface GameStore extends GameState {
  // 실시간 족보 미리보기
  previewResult: HandJudgeResult | null

  // 인라인 안내 3종 플래그 (한 번만 표시)
  hasShownFirstHand: boolean
  hasShownFirstDiscard: boolean
  hasShownFirstAffinity: boolean

  // 액션
  startGame: () => void
  toggleCardSelect: (cardId: string) => void
  playSelectedCards: () => void
  discardSelectedCards: () => void
  proceedToNextFloor: () => void
  resetGame: () => void
  markFirstHandShown: () => void
  markFirstDiscardShown: () => void
  markFirstAffinityShown: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialGameState(),
  previewResult: null,

  // 인라인 안내 플래그 초기값
  hasShownFirstHand: false,
  hasShownFirstDiscard: false,
  hasShownFirstAffinity: false,

  startGame: () => {
    set({ ...createInitialGameState(), previewResult: null, hasShownFirstHand: false, hasShownFirstDiscard: false, hasShownFirstAffinity: false })
  },

  toggleCardSelect: (cardId: string) => {
    const state = get()
    const isSelected = state.selectedCards.includes(cardId)
    let newSelected: string[]

    if (isSelected) {
      newSelected = state.selectedCards.filter(id => id !== cardId)
    } else {
      if (state.selectedCards.length >= 5) return  // 최대 5장
      newSelected = [...state.selectedCards, cardId]
    }

    // 실시간 족보 판정
    const selectedCardObjs = state.hand.filter(c => newSelected.includes(c.id))
    const previewResult = newSelected.length > 0 ? judgeHand(selectedCardObjs) : null

    set({ selectedCards: newSelected, previewResult })
  },

  playSelectedCards: () => {
    const state = get()
    if (state.selectedCards.length === 0 || state.playsLeft <= 0) return
    const newState = playCards(state, state.selectedCards)
    set({ ...newState, previewResult: null })
  },

  discardSelectedCards: () => {
    const state = get()
    if (state.selectedCards.length === 0 || state.discardsLeft <= 0) return
    const newState = discardCards(state, state.selectedCards)
    set({ ...newState, previewResult: null })
  },

  proceedToNextFloor: () => {
    const state = get()
    const newState = advanceToNextFloor(state)
    set({ ...newState, previewResult: null })
  },

  resetGame: () => {
    set({ ...createInitialGameState(), previewResult: null, hasShownFirstHand: false, hasShownFirstDiscard: false, hasShownFirstAffinity: false })
  },

  markFirstHandShown: () => set({ hasShownFirstHand: true }),
  markFirstDiscardShown: () => set({ hasShownFirstDiscard: true }),
  markFirstAffinityShown: () => set({ hasShownFirstAffinity: true }),
}))
