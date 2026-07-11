/**
 * 팔자전 — 게임 상태 Store (Zustand)
 * 층수 / 핸드 / 출수 카운트 관리
 */

import { create } from 'zustand'
import type { GameState, SavedHeroProfile } from '../types/game'
import { HERO_PROFILE_STORAGE_KEY } from '../types/game'
import {
  createInitialGameState,
  playCards,
  discardCards,
  advanceToNextFloor,
  activateJeonghwa,
  activateHwanpae,
  activateJeungpok,
  acquireTalisman,
  applyCondense,
} from '../engine/paljajeonEngine'
import { judgeHand } from '../engine/pokerHandJudge'
import type { HandJudgeResult } from '../types/game'

function loadHeroProfileForStore(): SavedHeroProfile | null {
  try {
    const raw = localStorage.getItem(HERO_PROFILE_STORAGE_KEY)
    if (!raw) {
      console.log('[GameStore] ℹ️ localStorage에 사주 정보 없음')
      return null
    }
    const profile = JSON.parse(raw) as SavedHeroProfile
    console.log('[GameStore] ✅ 사주 로드 완료:', {
      ilganChar: profile.ilganChar,
      elementDist: profile.elementDist,
      deckSeed: profile.deckSeed,
    })
    return profile
  } catch (e) {
    console.error('[GameStore] ❌ 사주 로드 실패:', e)
    return null
  }
}

// B9: 전투 통계 (결과 근거)
interface BattleStats {
  totalPlaysUsed: number
  maxSingleDamage: number
  remainingEnemyHpAtEnd: number
}

interface GameStore extends GameState {
  // 실시간 족보 미리보기
  previewResult: HandJudgeResult | null

  // 인라인 안내 3종 플래그 (한 번만 표시)
  hasShownFirstHand: boolean
  hasShownFirstDiscard: boolean
  hasShownFirstAffinity: boolean

  // B9: 전투 통계
  battleStats: BattleStats

  // 액션
  startGame: () => void
  toggleCardSelect: (cardId: string) => void
  playSelectedCards: () => void
  discardSelectedCards: () => void
  proceedToNextFloor: (rewardIndex: number) => void
  resetGame: () => void
  markFirstHandShown: () => void
  markFirstDiscardShown: () => void
  markFirstAffinityShown: () => void
  updateBattleStats: (stats: Partial<BattleStats>) => void
  // Phase 1.6 B — 부적술
  useJeonghwa: () => void
  useHwanpae: () => void
  useJeungpok: () => void
  gainTalisman: (talismanId: string) => void
  // Phase 1.9.5: 응축 확정판 선택 적용 (장수 기반 % 배율)
  applyCondenseAction: (cardIds: string[]) => void
}

const INITIAL_BATTLE_STATS: BattleStats = {
  totalPlaysUsed: 0,
  maxSingleDamage: 0,
  remainingEnemyHpAtEnd: 0,
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialGameState(0, loadHeroProfileForStore()),
  previewResult: null,

  // 인라인 안내 플래그 초기값
  hasShownFirstHand: false,
  hasShownFirstDiscard: false,
  hasShownFirstAffinity: false,

  // B9: 전투 통계 초기값
  battleStats: { ...INITIAL_BATTLE_STATS },

  startGame: () => {
    const hp = loadHeroProfileForStore()
    set({ ...createInitialGameState(0, hp), previewResult: null, hasShownFirstHand: false, hasShownFirstDiscard: false, hasShownFirstAffinity: false, battleStats: { ...INITIAL_BATTLE_STATS } })
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

  proceedToNextFloor: (rewardIndex: number) => {
    const state = get()
    // TODO: Apply reward based on rewardIndex (1-4 task)
    // rewardIndex: 0 = add-card, 1 = upgrade-card, 2 = remove-card, (3 = add-relic for future)
    const newState = advanceToNextFloor(state)
    set({ ...newState, previewResult: null })
  },

  resetGame: () => {
    const hp = loadHeroProfileForStore()
    set({ ...createInitialGameState(0, hp), previewResult: null, hasShownFirstHand: false, hasShownFirstDiscard: false, hasShownFirstAffinity: false, battleStats: { ...INITIAL_BATTLE_STATS } })
  },

  markFirstHandShown: () => set({ hasShownFirstHand: true }),
  markFirstDiscardShown: () => set({ hasShownFirstDiscard: true }),
  markFirstAffinityShown: () => set({ hasShownFirstAffinity: true }),

  updateBattleStats: (stats: Partial<BattleStats>) => {
    const current = get().battleStats
    set({ battleStats: { ...current, ...stats } })
  },

  // Phase 1.6 B — 부적술 액션
  useJeonghwa: () => {
    const newState = activateJeonghwa(get())
    set(newState)
  },
  useHwanpae: () => {
    const newState = activateHwanpae(get())
    set({ ...newState, previewResult: null })
  },
  useJeungpok: () => {
    const newState = activateJeungpok(get())
    set(newState)
  },
  gainTalisman: (talismanId: string) => {
    const newState = acquireTalisman(get(), talismanId)
    set(newState)
  },
  // Phase 1.9.5: 응축 확정판 — 선택된 카드 장수 기반 % 배율 자동 계산
  applyCondenseAction: (cardIds: string[]) => {
    const state = get()
    const newState = applyCondense(state, cardIds)
    set({ ...newState, previewResult: null, selectedCards: [] })
  },
}))
