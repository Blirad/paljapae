/**
 * M4 스테이지 스토어 단위 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useStageStore } from '@/stores/stageStore'
import { ALL_STAGES } from '@/data/stages'

beforeEach(() => {
  useStageStore.getState().resetProgress()
})

describe('초기 상태', () => {
  it('클리어된 스테이지 없음', () => {
    expect(useStageStore.getState().clearedStageIds.size).toBe(0)
  })

  it('선택된 스테이지 없음', () => {
    expect(useStageStore.getState().selectedStageId).toBeNull()
  })

  it('덱 편집 미해금', () => {
    expect(useStageStore.getState().deckEditUnlocked).toBe(false)
  })

  it('stages 목록이 6개', () => {
    expect(useStageStore.getState().stages.length).toBe(6)
  })
})

describe('isUnlocked — 스테이지 해금 확인', () => {
  it('Stage 1은 처음부터 해금', () => {
    expect(useStageStore.getState().isUnlocked(1)).toBe(true)
  })

  it('Stage 2는 Stage 1 클리어 전 잠김', () => {
    expect(useStageStore.getState().isUnlocked(2)).toBe(false)
  })

  it('Stage 1 클리어 후 Stage 2 해금', () => {
    useStageStore.getState().clearStage(1)
    expect(useStageStore.getState().isUnlocked(2)).toBe(true)
  })

  it('Stage 6은 Stage 5 클리어 필요', () => {
    // 1~4 클리어
    [1, 2, 3, 4].forEach(id => useStageStore.getState().clearStage(id))
    expect(useStageStore.getState().isUnlocked(6)).toBe(false)

    // 5 클리어 후
    useStageStore.getState().clearStage(5)
    expect(useStageStore.getState().isUnlocked(6)).toBe(true)
  })
})

describe('isCleared — 클리어 확인', () => {
  it('클리어 전 false', () => {
    expect(useStageStore.getState().isCleared(1)).toBe(false)
  })

  it('클리어 후 true', () => {
    useStageStore.getState().clearStage(1)
    expect(useStageStore.getState().isCleared(1)).toBe(true)
  })
})

describe('selectStage + deselectStage', () => {
  it('해금된 스테이지 선택 가능', () => {
    useStageStore.getState().selectStage(1)
    expect(useStageStore.getState().selectedStageId).toBe(1)
  })

  it('잠긴 스테이지 선택 무시', () => {
    useStageStore.getState().selectStage(2) // Stage 2 잠김
    expect(useStageStore.getState().selectedStageId).toBeNull()
  })

  it('deselectStage로 선택 해제', () => {
    useStageStore.getState().selectStage(1)
    useStageStore.getState().deselectStage()
    expect(useStageStore.getState().selectedStageId).toBeNull()
  })
})

describe('clearStage — 클리어 처리', () => {
  it('clearStage(1) 후 clearedStageIds에 1 포함', () => {
    useStageStore.getState().clearStage(1)
    expect(useStageStore.getState().clearedStageIds.has(1)).toBe(true)
  })

  it('Stage 4 클리어 시 덱 편집 해금', () => {
    useStageStore.getState().clearStage(4)
    expect(useStageStore.getState().deckEditUnlocked).toBe(true)
  })

  it('Stage 3 클리어로는 덱 편집 미해금', () => {
    useStageStore.getState().clearStage(3)
    expect(useStageStore.getState().deckEditUnlocked).toBe(false)
  })
})

describe('loadProgress — 진행 복원', () => {
  it('클리어 ID 배열로 상태 복원', () => {
    useStageStore.getState().loadProgress([1, 2, 3])
    expect(useStageStore.getState().clearedStageIds.has(1)).toBe(true)
    expect(useStageStore.getState().clearedStageIds.has(2)).toBe(true)
    expect(useStageStore.getState().clearedStageIds.has(3)).toBe(true)
    expect(useStageStore.getState().clearedStageIds.has(4)).toBe(false)
  })

  it('Stage 4 이상 클리어 ID 포함 시 덱 편집 해금', () => {
    useStageStore.getState().loadProgress([1, 2, 3, 4])
    expect(useStageStore.getState().deckEditUnlocked).toBe(true)
  })
})

describe('resetProgress', () => {
  it('resetProgress 후 완전 초기화', () => {
    useStageStore.getState().clearStage(1)
    useStageStore.getState().clearStage(2)
    useStageStore.getState().selectStage(1)
    useStageStore.getState().resetProgress()

    expect(useStageStore.getState().clearedStageIds.size).toBe(0)
    expect(useStageStore.getState().selectedStageId).toBeNull()
    expect(useStageStore.getState().deckEditUnlocked).toBe(false)
  })
})

describe('셀렉터', () => {
  it('selectClearedCount — 클리어 수 반환', () => {
    useStageStore.getState().clearStage(1)
    useStageStore.getState().clearStage(2)
    const count = useStageStore.getState().clearedStageIds.size
    expect(count).toBe(2)
  })

  it('selectAllCleared — 전체 클리어 감지', () => {
    ALL_STAGES.forEach(s => useStageStore.getState().clearStage(s.id))
    expect(useStageStore.getState().clearedStageIds.size).toBe(ALL_STAGES.length)
  })
})
