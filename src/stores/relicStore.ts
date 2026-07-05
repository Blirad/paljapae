/**
 * 유물 스토어 — M7 P3
 * 리라 M7 P3 스펙 §6-2 기반
 *
 * - 런 종속 데이터 (localStorage 저장 불필요, 메모리 only)
 * - unlockStore.ts 패턴 동일 적용
 */

import { create } from 'zustand'
import type { Relic, RelicId, RelicHookPoint } from '@/types/relics'
import { ALL_RELICS } from '@/types/relics'

interface RelicStore {
  ownedRelics: Relic[]
  addRelic: (id: RelicId) => void
  hasRelic: (id: RelicId) => boolean
  resetRelics: () => void
  getRelicsByHook: (hook: RelicHookPoint) => Relic[]
}

export const useRelicStore = create<RelicStore>((set, get) => ({
  ownedRelics: [],

  addRelic: (id: RelicId) => {
    const relic = ALL_RELICS[id]
    if (!relic) return
    // 중복 방지
    if (get().ownedRelics.some(r => r.id === id)) return
    set(state => ({ ownedRelics: [...state.ownedRelics, relic] }))
  },

  hasRelic: (id: RelicId) => {
    return get().ownedRelics.some(r => r.id === id)
  },

  resetRelics: () => {
    set({ ownedRelics: [] })
  },

  getRelicsByHook: (hook: RelicHookPoint) => {
    return get().ownedRelics.filter(r => r.hookPoints.includes(hook))
  },
}))
