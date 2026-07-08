/**
 * heroStore — 선택된 영웅 상태 관리
 * 운명카드전 Phase 1
 *
 * Zustand 기반, persist 없음 (런 시작 시 매번 선택)
 */

import { create } from 'zustand'
import type { HeroData } from '@/types/hero'

interface HeroState {
  /** 현재 선택된 영웅 (null = 미선택) */
  selectedHero: HeroData | null
  /** 영웅 선택 */
  selectHero: (hero: HeroData) => void
  /** 선택 해제 */
  clearHero: () => void
}

export const useHeroStore = create<HeroState>((set) => ({
  selectedHero: null,

  selectHero: (hero: HeroData) => {
    set({ selectedHero: hero })
  },

  clearHero: () => {
    set({ selectedHero: null })
  },
}))
