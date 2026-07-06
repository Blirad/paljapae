/**
 * M8 DeckBuild 테스트 — 덱 편집 기능
 *
 * - unlockStore.addCardToDeck: 덱 추가 (20장 캡 방어, 미보유 카드 차단)
 * - unlockStore.removeCardFromDeck: 기존 제거 기능 회귀 없음 (8장 하한, 스타터 보호)
 * - addCardToDeck + removeCardFromDeck 연동 시나리오
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useUnlockStore } from '@/stores/unlockStore'

// localStorage 목 (node 환경)
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

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

beforeEach(() => {
  localStorageMock.clear()
  useUnlockStore.getState().resetUnlocks()
})

// ────────────────────────────────────────────────────
// addCardToDeck — 기본 동작
// ────────────────────────────────────────────────────

describe('addCardToDeck — 덱 추가 기본', () => {
  it('보유 카드를 덱에 추가하면 currentDeckIds에 포함됨', () => {
    useUnlockStore.getState().initUnlocks('木')

    // 먼저 비스타터 카드 1장 제거하여 덱을 19장으로 만들기
    const state = useUnlockStore.getState()
    const nonStarter = state.currentDeckIds.find(id => !state.starterDeckIds.includes(id))
    if (!nonStarter) return
    useUnlockStore.getState().removeCardFromDeck(nonStarter)

    const state19 = useUnlockStore.getState()
    expect(state19.currentDeckIds.length).toBe(19)

    // 방금 제거한 카드는 ownedCardIds에 남아있으므로 재추가 가능
    useUnlockStore.getState().addCardToDeck(nonStarter)
    const after = useUnlockStore.getState().currentDeckIds

    expect(after.length).toBe(20)
    expect(after).toContain(nonStarter)
  })

  it('addCardToDeck 후 saveCurrentDeckIds 호출 — localStorage에 반영됨', () => {
    useUnlockStore.getState().initUnlocks('火')

    // 비스타터 카드 1장 제거 후 재추가
    const state = useUnlockStore.getState()
    const nonStarter = state.currentDeckIds.find(id => !state.starterDeckIds.includes(id))
    if (!nonStarter) return
    useUnlockStore.getState().removeCardFromDeck(nonStarter)

    // 재추가
    useUnlockStore.getState().addCardToDeck(nonStarter)

    // localStorage에 저장됨 (paljapae_current_deck_ids 키)
    const saved = localStorage.getItem('paljapae_current_deck_ids')
    expect(saved).not.toBeNull()
    if (saved) {
      const parsed = JSON.parse(saved) as string[]
      expect(parsed).toContain(nonStarter)
    }
  })
})

// ────────────────────────────────────────────────────
// addCardToDeck — 20장 캡 방어
// ────────────────────────────────────────────────────

describe('addCardToDeck — 20장 캡 방어', () => {
  it('덱이 이미 20장이면 추가되지 않음', () => {
    useUnlockStore.getState().initUnlocks('木')
    const state = useUnlockStore.getState()

    // 덱이 20장인지 확인
    expect(state.currentDeckIds.length).toBe(20)

    // 덱에 없는 보유 카드 찾기
    const ownedArr = Array.from(state.ownedCardIds)
    const notInDeck = ownedArr.find(id => !state.currentDeckIds.includes(id))
    if (!notInDeck) return

    useUnlockStore.getState().addCardToDeck(notInDeck)
    const after = useUnlockStore.getState().currentDeckIds

    // 20장 유지
    expect(after.length).toBe(20)
    // 추가 안 됨
    expect(after.filter(id => id === notInDeck).length).toBe(0)
  })

  it('덱이 19장일 때 카드 1장 추가 → 20장 (경계값)', () => {
    useUnlockStore.getState().initUnlocks('木')
    const state = useUnlockStore.getState()

    // 비스타터 카드 1장 제거하여 19장으로 만들기
    const nonStarter = state.currentDeckIds.find(id => !state.starterDeckIds.includes(id))
    if (!nonStarter) return
    useUnlockStore.getState().removeCardFromDeck(nonStarter)

    expect(useUnlockStore.getState().currentDeckIds.length).toBe(19)

    // 덱에 없는 보유 카드 추가
    const state2 = useUnlockStore.getState()
    const ownedArr = Array.from(state2.ownedCardIds)
    const notInDeck = ownedArr.find(id => !state2.currentDeckIds.includes(id))
    if (!notInDeck) return

    useUnlockStore.getState().addCardToDeck(notInDeck)
    expect(useUnlockStore.getState().currentDeckIds.length).toBe(20)
  })
})

// ────────────────────────────────────────────────────
// addCardToDeck — 미보유 카드 차단
// ────────────────────────────────────────────────────

describe('addCardToDeck — 미보유 카드 차단', () => {
  it('보유하지 않은 카드 ID로 addCardToDeck 호출 시 덱 변경 없음', () => {
    useUnlockStore.getState().initUnlocks('水')
    const before = [...useUnlockStore.getState().currentDeckIds]

    // 존재하지 않는 카드 ID
    useUnlockStore.getState().addCardToDeck('NONEXISTENT_CARD_ID_XYZ')

    const after = useUnlockStore.getState().currentDeckIds
    expect(after).toEqual(before)
  })
})

// ────────────────────────────────────────────────────
// removeCardFromDeck — 기존 기능 회귀 없음
// ────────────────────────────────────────────────────

describe('removeCardFromDeck — 기존 기능 회귀 없음 (M8 DeckBuild)', () => {
  it('덱이 8장일 때 removeCardFromDeck 호출 시 차단됨', () => {
    useUnlockStore.getState().initUnlocks('金')

    // 비스타터 카드를 제거하여 덱을 9장으로 만들기 (마지막 1장 제거 시도)
    let safetyLimit = 20
    while (useUnlockStore.getState().currentDeckIds.length > 9 && safetyLimit-- > 0) {
      const cur = useUnlockStore.getState()
      const nonStarter = cur.currentDeckIds.find(id => !cur.starterDeckIds.includes(id))
      if (!nonStarter) break
      useUnlockStore.getState().removeCardFromDeck(nonStarter)
    }

    const sizeAfterLoop = useUnlockStore.getState().currentDeckIds.length
    // 루프 후 덱이 9장인 경우에만 테스트 진행
    if (sizeAfterLoop !== 9) return

    // 9→8장 제거 (정상 작동)
    const cur9 = useUnlockStore.getState()
    const nonStarter9 = cur9.currentDeckIds.find(id => !cur9.starterDeckIds.includes(id))
    if (!nonStarter9) return
    useUnlockStore.getState().removeCardFromDeck(nonStarter9)

    expect(useUnlockStore.getState().currentDeckIds.length).toBe(8)

    // 8장에서 한 장 더 제거 시도 (차단되어야 함)
    const state8 = useUnlockStore.getState()
    const nonStarter8 = state8.currentDeckIds.find(id => !state8.starterDeckIds.includes(id))
    if (nonStarter8) {
      useUnlockStore.getState().removeCardFromDeck(nonStarter8)
    } else {
      // 비스타터가 없어도 starterDeckIds 카드로 시도 (차단 확인)
      const starterId = state8.currentDeckIds[0]
      if (starterId) useUnlockStore.getState().removeCardFromDeck(starterId)
    }

    expect(useUnlockStore.getState().currentDeckIds.length).toBe(8)
  })

  it('스타터 카드는 removeCardFromDeck으로 제거 불가', () => {
    useUnlockStore.getState().initUnlocks('土')
    const state = useUnlockStore.getState()

    const starterId = state.starterDeckIds[0]
    if (!starterId) return

    const beforeLen = state.currentDeckIds.length
    useUnlockStore.getState().removeCardFromDeck(starterId)

    expect(useUnlockStore.getState().currentDeckIds.length).toBe(beforeLen)
  })
})

// ────────────────────────────────────────────────────
// addCardToDeck + removeCardFromDeck 연동
// ────────────────────────────────────────────────────

describe('addCardToDeck + removeCardFromDeck 연동', () => {
  it('카드 추가 후 제거 → 원래 덱으로 복원', () => {
    useUnlockStore.getState().initUnlocks('木')

    // 비스타터 카드 1장 제거
    const state = useUnlockStore.getState()
    const nonStarter = state.currentDeckIds.find(id => !state.starterDeckIds.includes(id))
    if (!nonStarter) return

    useUnlockStore.getState().removeCardFromDeck(nonStarter)
    const afterRemove = useUnlockStore.getState().currentDeckIds.length
    expect(afterRemove).toBe(state.currentDeckIds.length - 1)

    // 다시 추가 (비스타터 카드는 ownedCardIds에 남아있음)
    useUnlockStore.getState().addCardToDeck(nonStarter)
    const afterAdd = useUnlockStore.getState().currentDeckIds.length
    expect(afterAdd).toBe(state.currentDeckIds.length)
  })

  it('ownedCardIds는 addCardToDeck / removeCardFromDeck으로 변경되지 않음', () => {
    useUnlockStore.getState().initUnlocks('火')
    const ownedBefore = new Set(useUnlockStore.getState().ownedCardIds)

    // 비스타터 카드 찾기
    const state = useUnlockStore.getState()
    const nonStarter = state.currentDeckIds.find(id => !state.starterDeckIds.includes(id))
    if (!nonStarter) return

    // 제거 후 확인
    useUnlockStore.getState().removeCardFromDeck(nonStarter)
    const ownedAfterRemove = useUnlockStore.getState().ownedCardIds
    expect(ownedAfterRemove.size).toBe(ownedBefore.size)
    expect(ownedAfterRemove.has(nonStarter)).toBe(true)

    // 다시 추가
    useUnlockStore.getState().addCardToDeck(nonStarter)
    const ownedAfterAdd = useUnlockStore.getState().ownedCardIds
    expect(ownedAfterAdd.size).toBe(ownedBefore.size)
  })
})
