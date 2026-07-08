/**
 * 카드 데이터 모델 단위 테스트
 * 마스터플랜 §4, §9 밸런스 프레임워크
 */

import { describe, it, expect } from 'vitest'
import { isSoldierCard, isSpellCard } from '@/types/cards'
import {
  ALL_SAMPLE_CARDS,
  F01, F02, F03, T01, T02, H01, H03,
  G01, W02, N01,
  createFireStarterDeck,
  LEGEND_FIRE,
} from '@/data/sampleCards'

describe('카드 타입 가드', () => {
  it('병사 카드 isSoldierCard() true', () => {
    expect(isSoldierCard(F01)).toBe(true)
    expect(isSoldierCard(T01)).toBe(true)
    expect(isSoldierCard(H01)).toBe(true)
  })
  it('효과 카드 isSoldierCard() false', () => {
    expect(isSoldierCard(F02)).toBe(false)
  })
  it('효과 카드 isSpellCard() true', () => {
    expect(isSpellCard(F02)).toBe(true)
  })
  it('병사 카드 isSpellCard() false', () => {
    expect(isSpellCard(F01)).toBe(false)
  })
})

describe('카드 스탯 — 밸런스 공식 검증 (마스터플랜 §9-1)', () => {
  /**
   * 기본 공식: 비용 N의 병사 카드 → 공격력 + 체력 = (N × 2) + 1
   * 키워드 보정 포함 카드는 제외 (§9-1 키워드 비용 표 참조)
   */

  it('1비용 병사 기본 공격+체력 범위 확인 (돌진 있으면 낮을 수 있음)', () => {
    // F-01: 2/1 돌진 → 공+체=3, 키워드 -1 보정 → 실제 (2×1+1)-1=2 OK
    if (isSoldierCard(F01)) {
      expect(F01.cost).toBe(1)
      // 돌진 카드는 기본 스탯이 낮아도 허용
      expect(F01.attack + F01.maxHealth).toBeGreaterThanOrEqual(2)
    }
  })

  it('2비용 병사 스탯 합 5 기준 확인', () => {
    // T-01: 1/5 도발 → 공+체=6, 도발 +0.5 보정이므로 실제 베이스=5.5 OK
    if (isSoldierCard(T01)) {
      expect(T01.cost).toBe(2)
      expect(T01.attack + T01.maxHealth).toBeGreaterThanOrEqual(5)
    }
  })

  it('4비용 병사 스탯 합 9 기준 확인', () => {
    // T-02: 3/8 도발 → 공+체=11, 도발 보정 포함 OK
    if (isSoldierCard(T02)) {
      expect(T02.cost).toBe(4)
      expect(T02.attack + T02.maxHealth).toBeGreaterThanOrEqual(9)
    }
  })

  it('1비용 카드 공격력 4 초과 금지 (§9-3 금지 패턴)', () => {
    const cost1Soldiers = ALL_SAMPLE_CARDS
      .filter(c => c.cost === 1 && isSoldierCard(c))
      .map(c => c as typeof F01)

    cost1Soldiers.forEach(card => {
      expect(card.attack).toBeLessThanOrEqual(4)
    })
  })
})

describe('카드 오행 속성 검증', () => {
  it('火 카드의 element가 火', () => {
    expect(F01.element).toBe('火')
    expect(F03.element).toBe('火')
    expect(LEGEND_FIRE.element).toBe('火')
  })
  it('土 카드의 element가 土', () => {
    expect(T01.element).toBe('土')
    expect(T02.element).toBe('土')
  })
  it('水 카드의 element가 水', () => {
    expect(H01.element).toBe('水')
    expect(H03.element).toBe('水')
  })
  it('金 카드의 element가 金', () => {
    expect(G01.element).toBe('金')
  })
  it('중립 카드의 element가 null', () => {
    expect(N01.element).toBeNull()
  })
})

describe('키워드 검증', () => {
  it('F-01 화염 소졸 — 돌진(rush) 키워드 보유', () => {
    if (isSoldierCard(F01)) expect(F01.keywords).toContain('rush')
  })
  it('T-01 흙담 수비병 — 도발(taunt) 키워드 보유', () => {
    if (isSoldierCard(T01)) expect(T01.keywords).toContain('taunt')
  })
  it('H-01 수면 유영사 — 냉기(freeze) 키워드 보유', () => {
    if (isSoldierCard(H01)) expect(H01.keywords).toContain('freeze')
  })
  it('H-03 흑수 선인 — 생명흡수(lifesteal) 키워드 보유', () => {
    if (isSoldierCard(H03)) expect(H03.keywords).toContain('lifesteal')
  })
  it('G-01 칼날 정예 — 관통(pierce) 키워드 보유', () => {
    if (isSoldierCard(G01)) expect(G01.keywords).toContain('pierce')
  })
  it('W-02 덩굴 포박사 — 도발(taunt) 키워드 보유', () => {
    if (isSoldierCard(W02)) expect(W02.keywords).toContain('taunt')
  })
})

describe('시작 덱 구성 검증', () => {
  it('火 시작 덱은 20장', () => {
    const deck = createFireStarterDeck()
    expect(deck.length).toBe(20)
  })

  it('火 시작 덱에서 火 카드가 12장', () => {
    const deck = createFireStarterDeck()
    const fireCards = deck.filter(c => c.element === '火')
    expect(fireCards.length).toBe(12)
  })

  it('火 시작 덱에서 木 카드(상생)가 6장', () => {
    const deck = createFireStarterDeck()
    const woodCards = deck.filter(c => c.element === '木')
    expect(woodCards.length).toBe(6)
  })

  it('火 시작 덱에서 중립 카드가 2장', () => {
    const deck = createFireStarterDeck()
    const neutralCards = deck.filter(c => c.element === null)
    expect(neutralCards.length).toBe(2)
  })

  it('덱 카드 비용은 모두 1~5 범위', () => {
    const deck = createFireStarterDeck()
    deck.forEach(card => {
      expect(card.cost).toBeGreaterThanOrEqual(1)
      expect(card.cost).toBeLessThanOrEqual(5)
    })
  })
})

describe('ALL_SAMPLE_CARDS 일관성 검증', () => {
  it('모든 카드가 고유한 id를 가짐', () => {
    const ids = ALL_SAMPLE_CARDS.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('모든 카드의 비용이 1 이상, Commander/Celestial 제외 최대 5', () => {
    ALL_SAMPLE_CARDS.forEach(card => {
      expect(card.cost).toBeGreaterThanOrEqual(1)
      // Commander(영웅 전용 고유 유닛)와 Celestial은 4~8 비용 허용
      if (card.cardType !== 'commander') {
        expect(card.cost).toBeLessThanOrEqual(5)
      } else {
        expect(card.cost).toBeLessThanOrEqual(8)
      }
    })
  })

  it('병사 카드의 attack과 maxHealth가 1 이상', () => {
    ALL_SAMPLE_CARDS.filter(isSoldierCard).forEach(card => {
      expect(card.attack).toBeGreaterThanOrEqual(1)
      expect(card.maxHealth).toBeGreaterThanOrEqual(1)
    })
  })

  it('효과 카드에 subtype이 있음', () => {
    ALL_SAMPLE_CARDS.filter(isSpellCard).forEach(card => {
      expect(card.subtype).toBeTruthy()
    })
  })

  it('전체 카드 수가 최소 20장 이상', () => {
    expect(ALL_SAMPLE_CARDS.length).toBeGreaterThanOrEqual(20)
  })
})
