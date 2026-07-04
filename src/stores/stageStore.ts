/**
 * 스테이지 진행 Zustand 스토어 — M4
 * 클리어 기록, 현재 선택 스테이지, 언락 상태 관리
 */

import { create } from 'zustand'
import type { Stage } from '@/data/stages'
import { ALL_STAGES, STAGES_BY_ID } from '@/data/stages'

// ────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────

export interface StageProgress {
  /** 클리어된 스테이지 ID 집합 */
  clearedStageIds: Set<number>
  /** 현재 선택된 스테이지 (null = 선택 안 됨) */
  selectedStageId: number | null
  /** 덱 편집 해금 여부 (Stage 4 클리어 시 해금) */
  deckEditUnlocked: boolean
}

interface StageStore extends StageProgress {
  /** 전체 스테이지 목록 */
  stages: Stage[]

  /** 특정 스테이지가 해금됐는지 확인 */
  isUnlocked: (stageId: number) => boolean

  /** 특정 스테이지가 클리어됐는지 확인 */
  isCleared: (stageId: number) => boolean

  /** 스테이지 선택 */
  selectStage: (stageId: number) => void

  /** 선택 해제 */
  deselectStage: () => void

  /** 스테이지 클리어 처리 */
  clearStage: (stageId: number) => void

  /** 진행 상태 불러오기 (persistence에서 호출) */
  loadProgress: (clearedIds: number[]) => void

  /** 진행 초기화 */
  resetProgress: () => void
}

// ────────────────────────────────────────────────────
// 초기 상태
// ────────────────────────────────────────────────────

const INITIAL_STATE: StageProgress = {
  clearedStageIds: new Set<number>(),
  selectedStageId: null,
  deckEditUnlocked: false,
}

// ────────────────────────────────────────────────────
// 스토어 구현
// ────────────────────────────────────────────────────

export const useStageStore = create<StageStore>((set, get) => ({
  ...INITIAL_STATE,
  stages: ALL_STAGES,

  isUnlocked: (stageId: number): boolean => {
    const stage = STAGES_BY_ID[stageId]
    if (!stage) return false
    if (stage.unlockRequires.length === 0) return true
    const { clearedStageIds } = get()
    return stage.unlockRequires.every(id => clearedStageIds.has(id))
  },

  isCleared: (stageId: number): boolean => {
    return get().clearedStageIds.has(stageId)
  },

  selectStage: (stageId: number) => {
    if (!get().isUnlocked(stageId)) return
    set({ selectedStageId: stageId })
  },

  deselectStage: () => {
    set({ selectedStageId: null })
  },

  clearStage: (stageId: number) => {
    set(state => {
      const newCleared = new Set(state.clearedStageIds)
      newCleared.add(stageId)
      // Stage 4 클리어 시 덱 편집 해금
      const deckEditUnlocked = state.deckEditUnlocked || stageId >= 4
      return {
        clearedStageIds: newCleared,
        deckEditUnlocked,
      }
    })
  },

  loadProgress: (clearedIds: number[]) => {
    const clearedStageIds = new Set(clearedIds)
    const deckEditUnlocked = clearedIds.some(id => id >= 4)
    set({ clearedStageIds, deckEditUnlocked })
  },

  resetProgress: () => {
    set({
      clearedStageIds: new Set<number>(),
      selectedStageId: null,
      deckEditUnlocked: false,
    })
  },
}))

// ────────────────────────────────────────────────────
// 셀렉터
// ────────────────────────────────────────────────────

export const selectSelectedStage = (s: StageStore): Stage | null =>
  s.selectedStageId !== null ? STAGES_BY_ID[s.selectedStageId] ?? null : null

export const selectClearedCount = (s: StageStore): number =>
  s.clearedStageIds.size

export const selectAllCleared = (s: StageStore): boolean =>
  s.clearedStageIds.size >= ALL_STAGES.length
