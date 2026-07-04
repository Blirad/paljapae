/**
 * M4 LocalStorage 진행 저장/복원 단위 테스트
 * node 환경에서 localStorage mock 사용
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  isFirstVisit,
  markVisited,
  hasSavedProgress,
  savePlayerElement,
  loadPlayerElement,
  saveOwnedCardIds,
  loadOwnedCardIds,
  saveClearedStageIds,
  loadClearedStageIds,
  saveCurrentDeckIds,
  loadCurrentDeckIds,
  saveProgress,
  loadProgress,
  clearAllProgress,
} from '@/utils/persistence'

// ────────────────────────────────────────────────────
// localStorage mock (node 환경)
// ────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()

// globalThis.localStorage를 mock으로 대체
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

beforeEach(() => {
  localStorageMock.clear()
})

// ────────────────────────────────────────────────────
// 테스트
// ────────────────────────────────────────────────────

describe('방문 여부 감지', () => {
  it('초기에는 첫 방문으로 판단', () => {
    expect(isFirstVisit()).toBe(true)
  })

  it('markVisited 후 재방문으로 판단', () => {
    markVisited()
    expect(isFirstVisit()).toBe(false)
  })

  it('저장된 진행 없으면 hasSavedProgress false', () => {
    expect(hasSavedProgress()).toBe(false)
  })

  it('진행 저장 후 hasSavedProgress true', () => {
    savePlayerElement('火')
    saveClearedStageIds([1])
    expect(hasSavedProgress()).toBe(true)
  })
})

describe('플레이어 오행 저장/복원', () => {
  it('savePlayerElement + loadPlayerElement 왕복', () => {
    savePlayerElement('木')
    expect(loadPlayerElement()).toBe('木')
  })

  it('저장 전 loadPlayerElement는 null', () => {
    expect(loadPlayerElement()).toBeNull()
  })

  it('모든 오행 타입 저장 가능', () => {
    const elements = ['木', '火', '土', '金', '水'] as const
    elements.forEach(el => {
      savePlayerElement(el)
      expect(loadPlayerElement()).toBe(el)
    })
  })
})

describe('보유 카드 ID 저장/복원', () => {
  it('saveOwnedCardIds + loadOwnedCardIds 왕복', () => {
    const ids = ['W-01', 'F-02', 'T-03']
    saveOwnedCardIds(ids)
    expect(loadOwnedCardIds()).toEqual(ids)
  })

  it('저장 전 loadOwnedCardIds는 빈 배열', () => {
    expect(loadOwnedCardIds()).toEqual([])
  })

  it('빈 배열 저장/복원', () => {
    saveOwnedCardIds([])
    expect(loadOwnedCardIds()).toEqual([])
  })

  it('73개 ID 모두 저장/복원 가능', () => {
    const ids = Array.from({ length: 73 }, (_, i) => `CARD-${i}`)
    saveOwnedCardIds(ids)
    expect(loadOwnedCardIds()).toHaveLength(73)
  })
})

describe('스테이지 클리어 기록 저장/복원', () => {
  it('saveClearedStageIds + loadClearedStageIds 왕복', () => {
    saveClearedStageIds([1, 2, 3])
    expect(loadClearedStageIds()).toEqual([1, 2, 3])
  })

  it('저장 전 loadClearedStageIds는 빈 배열', () => {
    expect(loadClearedStageIds()).toEqual([])
  })

  it('전체 스테이지 클리어 저장', () => {
    saveClearedStageIds([1, 2, 3, 4, 5, 6])
    expect(loadClearedStageIds()).toHaveLength(6)
  })
})

describe('현재 덱 ID 저장/복원', () => {
  it('saveCurrentDeckIds + loadCurrentDeckIds 왕복', () => {
    const deckIds = ['W-01', 'W-02', 'F-01', 'F-02', 'N-01']
    saveCurrentDeckIds(deckIds)
    expect(loadCurrentDeckIds()).toEqual(deckIds)
  })

  it('저장 전 loadCurrentDeckIds는 빈 배열', () => {
    expect(loadCurrentDeckIds()).toEqual([])
  })

  it('20장 덱 저장/복원', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `CARD-${i}`)
    saveCurrentDeckIds(ids)
    expect(loadCurrentDeckIds()).toHaveLength(20)
  })
})

describe('전체 진행 스냅샷 saveProgress + loadProgress', () => {
  it('스냅샷 저장 후 완전 복원', () => {
    const snapshot = {
      playerElement: '水' as const,
      ownedCardIds: ['H-01', 'H-02', 'W-01'],
      clearedStageIds: [1, 2],
      currentDeckIds: ['H-01', 'H-02'],
      processedCombos: ['1,2'],
    }
    saveProgress(snapshot)
    const loaded = loadProgress()

    expect(loaded.playerElement).toBe('水')
    expect(loaded.ownedCardIds).toEqual(['H-01', 'H-02', 'W-01'])
    expect(loaded.clearedStageIds).toEqual([1, 2])
    expect(loaded.currentDeckIds).toEqual(['H-01', 'H-02'])
    expect(loaded.processedCombos).toEqual(['1,2'])
  })

  it('저장 전 loadProgress는 기본값 반환', () => {
    const loaded = loadProgress()
    expect(loaded.playerElement).toBeNull()
    expect(loaded.ownedCardIds).toEqual([])
    expect(loaded.clearedStageIds).toEqual([])
    expect(loaded.currentDeckIds).toEqual([])
  })
})

describe('clearAllProgress — 전체 초기화', () => {
  it('clearAllProgress 후 모든 저장 데이터 삭제', () => {
    savePlayerElement('火')
    saveClearedStageIds([1, 2])
    saveOwnedCardIds(['F-01'])
    markVisited()

    clearAllProgress()

    expect(loadPlayerElement()).toBeNull()
    expect(loadClearedStageIds()).toEqual([])
    expect(loadOwnedCardIds()).toEqual([])
    expect(isFirstVisit()).toBe(true)
  })
})
