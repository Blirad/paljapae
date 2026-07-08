/**
 * 카드 데이터 단위 테스트
 * 기존 73장 + 운명카드전 Phase 1 영웅카드 25장 = 98장
 */

import { describe, it, expect } from 'vitest'
import {
  ALL_CARDS,
  ALL_SAMPLE_CARDS,
  CARDS_BY_ELEMENT,
  createStarterDeck,
  createFireStarterDeck,
  LEGEND_WOOD, LEGEND_FIRE, LEGEND_EARTH, LEGEND_METAL, LEGEND_WATER,
} from '@/data/cards'
import { isSoldierCard, isSpellCard } from '@/types/cards'

// ────────────────────────────────────────────────────
// 73장 수량 검증
// ────────────────────────────────────────────────────

describe('전체 카드 수량 검증 (Phase 1: 98장)', () => {
  it('ALL_CARDS 총 98장 (기존 73 + 영웅카드 25)', () => {
    expect(ALL_CARDS.length).toBe(98)
  })

  it('기존 오행별 카드풀(CARDS_BY_ELEMENT) — 木 13장 이상', () => {
    expect(CARDS_BY_ELEMENT['木'].length).toBeGreaterThanOrEqual(13)
  })

  it('기존 오행별 카드풀(CARDS_BY_ELEMENT) — 火 13장 이상', () => {
    expect(CARDS_BY_ELEMENT['火'].length).toBeGreaterThanOrEqual(13)
  })

  it('기존 오행별 카드풀(CARDS_BY_ELEMENT) — 土 13장 이상', () => {
    expect(CARDS_BY_ELEMENT['土'].length).toBeGreaterThanOrEqual(13)
  })

  it('기존 오행별 카드풀(CARDS_BY_ELEMENT) — 金 13장 이상', () => {
    expect(CARDS_BY_ELEMENT['金'].length).toBeGreaterThanOrEqual(13)
  })

  it('기존 오행별 카드풀(CARDS_BY_ELEMENT) — 水 13장 이상', () => {
    expect(CARDS_BY_ELEMENT['水'].length).toBeGreaterThanOrEqual(13)
  })

  it('중립 카드 8장 이상', () => {
    expect(CARDS_BY_ELEMENT['중립'].length).toBeGreaterThanOrEqual(8)
  })

  it('전설 카드 5장 이상 (오행별 1장, celestial 별도)', () => {
    const legendCards = ALL_CARDS.filter(c => c.rarity === 'legendary')
    expect(legendCards.length).toBeGreaterThanOrEqual(5)
  })

  it('병사 카드 40장 이상', () => {
    const soldiers = ALL_CARDS.filter(isSoldierCard)
    expect(soldiers.length).toBeGreaterThanOrEqual(40)
  })

  it('효과 카드 20장 이상 (오행별)', () => {
    const spells = ALL_CARDS.filter(isSpellCard).filter(c => c.element !== null)
    expect(spells.length).toBeGreaterThanOrEqual(20)
  })
})

// ────────────────────────────────────────────────────
// 카드 데이터 무결성
// ────────────────────────────────────────────────────

describe('카드 데이터 무결성', () => {
  it('모든 카드가 고유한 ID를 가짐', () => {
    const ids = ALL_CARDS.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('모든 카드 비용이 1 이상', () => {
    ALL_CARDS.forEach(card => {
      expect(card.cost).toBeGreaterThanOrEqual(1)
    })
  })

  it('일반 카드(soldier/spell) 비용이 1~5 범위, Commander/Celestial은 최대 8', () => {
    ALL_CARDS.forEach(card => {
      if (card.cardType === 'soldier' || card.cardType === 'spell') {
        expect(card.cost).toBeLessThanOrEqual(5)
      } else {
        // commander: 4~8 허용
        expect(card.cost).toBeLessThanOrEqual(8)
      }
    })
  })

  it('모든 병사 카드 공격력 1 이상', () => {
    ALL_CARDS.filter(isSoldierCard).forEach(card => {
      expect(card.attack).toBeGreaterThanOrEqual(1)
    })
  })

  it('모든 병사 카드 체력 1 이상', () => {
    ALL_CARDS.filter(isSoldierCard).forEach(card => {
      expect(card.maxHealth).toBeGreaterThanOrEqual(1)
    })
  })

  it('1비용 카드 공격력 4 초과 없음 (§9-3 금지 패턴)', () => {
    ALL_CARDS.filter(c => c.cost === 1).forEach(card => {
      if (isSoldierCard(card)) {
        expect(card.attack).toBeLessThanOrEqual(4)
      }
    })
  })

  it('모든 효과 카드에 subtype이 있음', () => {
    ALL_CARDS.filter(isSpellCard).forEach(card => {
      expect(card.subtype).toBeTruthy()
    })
  })

  it('모든 카드에 flavorText가 있음', () => {
    ALL_CARDS.forEach(card => {
      expect(card.flavorText).toBeTruthy()
      expect(card.flavorText.length).toBeGreaterThan(0)
    })
  })
})

// ────────────────────────────────────────────────────
// 전설 카드 검증
// ────────────────────────────────────────────────────

describe('전설 카드 검증', () => {
  it('목왕 청제 — 木 전설, 비용 5', () => {
    expect(LEGEND_WOOD.element).toBe('木')
    expect(LEGEND_WOOD.cost).toBe(5)
    expect(LEGEND_WOOD.rarity).toBe('legendary')
  })

  it('화황 염제 — 火 전설, 돌진 키워드', () => {
    expect(LEGEND_FIRE.element).toBe('火')
    expect(LEGEND_FIRE.keywords).toContain('rush')
    expect(LEGEND_FIRE.rarity).toBe('legendary')
  })

  it('토왕 황제 — 土 전설, 도발 키워드, 체력 12', () => {
    expect(LEGEND_EARTH.element).toBe('土')
    expect(LEGEND_EARTH.keywords).toContain('taunt')
    expect(LEGEND_EARTH.maxHealth).toBe(12)
  })

  it('금신 백제 — 金 전설, 관통 키워드', () => {
    expect(LEGEND_METAL.element).toBe('金')
    expect(LEGEND_METAL.keywords).toContain('pierce')
  })

  it('수신 흑제 — 水 전설, 생명흡수+냉기', () => {
    expect(LEGEND_WATER.element).toBe('水')
    expect(LEGEND_WATER.keywords).toContain('lifesteal')
    expect(LEGEND_WATER.keywords).toContain('freeze')
  })
})

// ────────────────────────────────────────────────────
// 시작 덱 생성 검증
// ────────────────────────────────────────────────────

describe('createStarterDeck — 오행별 시작 덱', () => {
  const elements = ['木', '火', '土', '金', '水'] as const

  elements.forEach(element => {
    it(`${element} 시작 덱은 20장`, () => {
      const deck = createStarterDeck(element)
      expect(deck.length).toBe(20)
    })
  })

  it('火 시작 덱에 火 카드 12장', () => {
    const deck = createStarterDeck('火')
    const fireCount = deck.filter(c => c.element === '火').length
    expect(fireCount).toBe(12)
  })

  it('火 시작 덱에 土 카드 6장 (火→土 상생)', () => {
    const deck = createStarterDeck('火')
    const earthCount = deck.filter(c => c.element === '土').length
    expect(earthCount).toBe(6)
  })

  it('시작 덱에 중립 카드 2장', () => {
    const deck = createStarterDeck('木')
    const neutralCount = deck.filter(c => c.element === null).length
    expect(neutralCount).toBe(2)
  })
})

// ────────────────────────────────────────────────────
// 하위호환: sampleCards 테스트 호환 (cardModel.test.ts 대체)
// ────────────────────────────────────────────────────

describe('ALL_SAMPLE_CARDS 하위호환 (cardModel.test.ts)', () => {
  it('ALL_SAMPLE_CARDS === ALL_CARDS (98장)', () => {
    expect(ALL_SAMPLE_CARDS.length).toBe(98)
  })

  it('createFireStarterDeck() 20장', () => {
    const deck = createFireStarterDeck()
    expect(deck.length).toBe(20)
  })

  it('createFireStarterDeck() 火 12장', () => {
    const deck = createFireStarterDeck()
    expect(deck.filter(c => c.element === '火').length).toBe(12)
  })

  it('createFireStarterDeck() 木 6장', () => {
    const deck = createFireStarterDeck()
    expect(deck.filter(c => c.element === '木').length).toBe(6)
  })

  it('createFireStarterDeck() 중립 2장', () => {
    const deck = createFireStarterDeck()
    expect(deck.filter(c => c.element === null).length).toBe(2)
  })
})
