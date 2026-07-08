/**
 * M8 P1 테스트 — 일일 카드 뽑기 로직
 *
 * - useDailyDraw 훅 유틸 함수 (localStorage 기반 날짜 체크)
 * - drawCards: 3장 반환, 중복 없음, 등급 분포 유효
 * - unlockStore.addOwnedCards: 덱에 카드 추가
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  hasDrawnToday,
  getLastDrawDate,
  setLastDrawDate,
  drawCards,
} from '@/game/hooks/useDailyDraw'
import { useUnlockStore } from '@/stores/unlockStore'

// ─────────────────────────────────────────────────────
// localStorage 목 (node 환경)
// ─────────────────────────────────────────────────────

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

function getTodayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─────────────────────────────────────────────────────
// localStorage 기반 날짜 체크
// ─────────────────────────────────────────────────────

describe('M8 P1: hasDrawnToday / setLastDrawDate', () => {
  beforeEach(() => {
    localStorage.removeItem('paljapae_last_draw_date')
  })

  afterEach(() => {
    localStorage.removeItem('paljapae_last_draw_date')
  })

  it('localStorage 비어있으면 hasDrawnToday() = false', () => {
    expect(hasDrawnToday()).toBe(false)
  })

  it('오늘 날짜 저장 후 hasDrawnToday() = true', () => {
    setLastDrawDate(getTodayString())
    expect(hasDrawnToday()).toBe(true)
  })

  it('어제 날짜 저장 후 hasDrawnToday() = false', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const y = yesterday.getFullYear()
    const m = String(yesterday.getMonth() + 1).padStart(2, '0')
    const d = String(yesterday.getDate()).padStart(2, '0')
    setLastDrawDate(`${y}-${m}-${d}`)
    expect(hasDrawnToday()).toBe(false)
  })

  it('getLastDrawDate: 저장된 날짜 반환', () => {
    const today = getTodayString()
    setLastDrawDate(today)
    expect(getLastDrawDate()).toBe(today)
  })

  it('getLastDrawDate: 미저장 시 null 반환', () => {
    expect(getLastDrawDate()).toBeNull()
  })
})

// ─────────────────────────────────────────────────────
// drawCards 로직
// ─────────────────────────────────────────────────────

describe('M8 P1: drawCards', () => {
  it('기본 3장 반환', () => {
    const cards = drawCards(3)
    expect(cards).toHaveLength(3)
  })

  it('카드 ID 중복 없음', () => {
    const cards = drawCards(3)
    const ids = cards.map(c => c.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('각 카드는 유효한 rarity를 가짐', () => {
    // Phase 1: epic, celestial 추가로 6단계 모두 유효
    const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'celestial']
    const cards = drawCards(3)
    cards.forEach(card => {
      expect(VALID_RARITIES).toContain(card.rarity)
    })
  })

  it('각 카드는 name, id, cost 필드를 가짐', () => {
    const cards = drawCards(3)
    cards.forEach(card => {
      expect(typeof card.name).toBe('string')
      expect(typeof card.id).toBe('string')
      expect(typeof card.cost).toBe('number')
    })
  })

  it('count=1로 호출 시 1장만 반환', () => {
    const cards = drawCards(1)
    expect(cards).toHaveLength(1)
  })

  it('10회 반복 뽑기에서 common이 1회 이상 등장 (55% 가중치)', () => {
    let hasCommon = false
    for (let i = 0; i < 30; i++) {
      const cards = drawCards(3)
      if (cards.some(c => c.rarity === 'common')) {
        hasCommon = true
        break
      }
    }
    expect(hasCommon).toBe(true)
  })
})

// ─────────────────────────────────────────────────────
// unlockStore.addOwnedCards
// ─────────────────────────────────────────────────────

describe('M8 P1: unlockStore.addOwnedCards', () => {
  beforeEach(() => {
    useUnlockStore.getState().resetUnlocks()
    // 기본 덱 15장으로 초기화 (20장 미만이어야 자동 추가 로직 작동)
    useUnlockStore.setState({
      ownedCardIds: new Set(['W-01', 'F-01', 'T-01']),
      currentDeckIds: ['W-01', 'F-01', 'T-01'],
      starterDeckIds: ['W-01', 'F-01', 'T-01'],
    })
  })

  it('addOwnedCards: 새 카드 ID가 ownedCardIds에 추가됨', () => {
    useUnlockStore.getState().addOwnedCards(['W-02', 'F-02'])
    const owned = useUnlockStore.getState().ownedCardIds
    expect(owned.has('W-02')).toBe(true)
    expect(owned.has('F-02')).toBe(true)
  })

  it('addOwnedCards: 덱이 20장 미만이면 currentDeckIds에도 추가', () => {
    useUnlockStore.getState().addOwnedCards(['W-03'])
    const deck = useUnlockStore.getState().currentDeckIds
    expect(deck).toContain('W-03')
  })

  it('addOwnedCards: 이미 보유한 카드는 중복 추가 안 됨 (Set 특성)', () => {
    useUnlockStore.getState().addOwnedCards(['W-01']) // 이미 있음
    const owned = useUnlockStore.getState().ownedCardIds
    // Set이므로 size 그대로 3
    expect(owned.size).toBe(3)
  })

  it('addOwnedCards: 덱이 20장이면 currentDeckIds에 추가 안 됨', () => {
    // 20장 덱 세팅
    const fullDeck = Array.from({ length: 20 }, (_, i) => `card-${i}`)
    useUnlockStore.setState({ currentDeckIds: fullDeck })
    useUnlockStore.getState().addOwnedCards(['NEW-CARD'])
    const deck = useUnlockStore.getState().currentDeckIds
    expect(deck).toHaveLength(20)
    expect(deck).not.toContain('NEW-CARD')
  })
})

// ─────────────────────────────────────────────────────
// DailyDraw localStorage 키 명세 검증
// ─────────────────────────────────────────────────────

describe('M8 P1: localStorage 키 명세', () => {
  afterEach(() => {
    localStorage.removeItem('paljapae_last_draw_date')
  })

  it('저장 키는 paljapae_last_draw_date', () => {
    setLastDrawDate('2026-07-06')
    expect(localStorage.getItem('paljapae_last_draw_date')).toBe('2026-07-06')
  })

  it('날짜 형식은 YYYY-MM-DD', () => {
    const today = getTodayString()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
