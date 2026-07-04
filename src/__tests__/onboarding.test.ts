/**
 * 온보딩 시스템 통합 테스트
 * 만세력 → 오행 → 영웅 → 덱 생성 전체 흐름 검증
 */

import { describe, it, expect } from 'vitest'
import { calculateSaju } from '@/game/saju/manseryeok'
import { HERO_DATA, createStartingDeck, DECK_FLAVOR } from '@/game/store/onboardingStore'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'

const ALL_ELEMENTS: FiveElement[] = ['木', '火', '土', '金', '水']

// ────────────────────────────────────────────────────
// HERO_DATA 검증
// ────────────────────────────────────────────────────

describe('HERO_DATA — 오행별 영웅 데이터', () => {
  it('5개 오행 모두 영웅 데이터가 존재한다', () => {
    for (const el of ALL_ELEMENTS) {
      expect(HERO_DATA[el]).toBeDefined()
    }
  })

  it('각 영웅 데이터에 필수 필드가 있다', () => {
    for (const el of ALL_ELEMENTS) {
      const hero = HERO_DATA[el]
      expect(hero.name).toBeTruthy()
      expect(hero.nickname).toBeTruthy()
      expect(hero.strategyTag).toBeTruthy()
      expect(hero.playstyleTag).toBeTruthy()
      expect(hero.description).toBeTruthy()
      expect(hero.flavorText).toBeTruthy()
      expect(hero.element).toBe(el)
    }
  })

  it('木 영웅은 청룡도사이다', () => {
    expect(HERO_DATA['木'].name).toContain('청룡도사')
  })

  it('火 영웅은 화염검객이다', () => {
    expect(HERO_DATA['火'].name).toContain('화염검객')
  })

  it('土 영웅은 황토장군이다', () => {
    expect(HERO_DATA['土'].name).toContain('황토장군')
  })

  it('金 영웅은 백금사형이다', () => {
    expect(HERO_DATA['金'].name).toContain('백금사형')
  })

  it('水 영웅은 흑수선인이다', () => {
    expect(HERO_DATA['水'].name).toContain('흑수선인')
  })
})

// ────────────────────────────────────────────────────
// createStartingDeck 검증
// ────────────────────────────────────────────────────

describe('createStartingDeck — 시작 덱 생성', () => {
  it('5개 오행 모두 덱이 생성된다', () => {
    for (const el of ALL_ELEMENTS) {
      expect(() => createStartingDeck(el)).not.toThrow()
    }
  })

  it('생성된 덱은 항상 20장이다', () => {
    for (const el of ALL_ELEMENTS) {
      const deck = createStartingDeck(el)
      expect(deck).toHaveLength(20)
    }
  })

  it('덱 카드 ID가 모두 유니크하다', () => {
    for (const el of ALL_ELEMENTS) {
      const deck = createStartingDeck(el)
      const ids = deck.map(c => c.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    }
  })

  it('火 덱은 火 카드 비중이 가장 높다', () => {
    const deck = createStartingDeck('火')
    const fireCount = deck.filter(c => c.element === '火').length
    expect(fireCount).toBeGreaterThanOrEqual(10)
  })

  it('木 덱은 木 카드 비중이 가장 높다', () => {
    const deck = createStartingDeck('木')
    const woodCount = deck.filter(c => c.element === '木').length
    expect(woodCount).toBeGreaterThanOrEqual(10)
  })

  it('각 덱에 중립 카드가 포함된다', () => {
    for (const el of ALL_ELEMENTS) {
      const deck = createStartingDeck(el)
      const neutral = deck.filter(c => c.element === null)
      expect(neutral.length).toBeGreaterThanOrEqual(2)
    }
  })
})

// ────────────────────────────────────────────────────
// DECK_FLAVOR 검증
// ────────────────────────────────────────────────────

describe('DECK_FLAVOR — 화면 4 서브카피', () => {
  it('5개 오행 모두 카피가 존재한다', () => {
    for (const el of ALL_ELEMENTS) {
      expect(DECK_FLAVOR[el]).toBeTruthy()
      expect(typeof DECK_FLAVOR[el]).toBe('string')
    }
  })

  it('모든 카피는 "운명이 이미 카드를 골랐습니다"로 시작한다', () => {
    for (const el of ALL_ELEMENTS) {
      expect(DECK_FLAVOR[el]).toMatch(/^운명이 이미 카드를 골랐습니다/)
    }
  })
})

// ────────────────────────────────────────────────────
// ELEMENT_DISPLAY 검증
// ────────────────────────────────────────────────────

describe('ELEMENT_DISPLAY — 오행 표시 정보', () => {
  it('5개 오행 모두 표시 정보가 있다', () => {
    for (const el of ALL_ELEMENTS) {
      expect(ELEMENT_DISPLAY[el]).toBeDefined()
    }
  })

  it('각 표시 정보에 icon, color, gradient, label이 있다', () => {
    for (const el of ALL_ELEMENTS) {
      const d = ELEMENT_DISPLAY[el]
      expect(d.icon).toBeTruthy()
      expect(d.color).toMatch(/^#/)
      expect(d.gradient).toContain('linear-gradient')
      expect(d.label).toBeTruthy()
    }
  })
})

// ────────────────────────────────────────────────────
// 온보딩 완료 흐름 통합 검증
// ────────────────────────────────────────────────────

describe('온보딩 전체 흐름 통합', () => {
  it('생년월일 → 오행 → 영웅 → 덱 전체 흐름이 오류 없이 동작한다', () => {
    // 1. 만세력 계산
    const result = calculateSaju(1990, 3, 15)
    expect(result.primaryElement).toBeDefined()

    // 2. 영웅 조회
    const hero = HERO_DATA[result.primaryElement]
    expect(hero).toBeDefined()
    expect(hero.element).toBe(result.primaryElement)

    // 3. 덱 생성
    const deck = createStartingDeck(result.primaryElement)
    expect(deck).toHaveLength(20)

    // 4. 오행 표시
    const display = ELEMENT_DISPLAY[result.primaryElement]
    expect(display).toBeDefined()
  })

  it('다양한 생년월일에 대해 오행별 영웅 배정이 유효하다', () => {
    const dates = [
      [1985, 8, 20], [2000, 1, 1], [1975, 12, 25],
      [2010, 7, 7], [1957, 11, 30],
    ] as [number, number, number][]

    for (const [y, m, d] of dates) {
      const result = calculateSaju(y, m, d)
      expect(['木', '火', '土', '金', '水']).toContain(result.primaryElement)
      const hero = HERO_DATA[result.primaryElement]
      expect(hero.name).toBeTruthy()
      const deck = createStartingDeck(result.primaryElement)
      expect(deck).toHaveLength(20)
    }
  })
})
