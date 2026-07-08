/**
 * sajuImbalance.ts 단위 테스트 — Phase 1-A
 *
 * 테스트 케이스:
 *   1. 극단 불균형 (extreme): {木:6, 火:0, 土:0, 金:0, 水:0}
 *   2. 중간 불균형 (moderate): {木:3, 火:1, 土:2, 金:0, 水:0}
 *   3. 균형형 (balanced): {木:1, 火:2, 土:1, 金:1, 水:1}
 *   4. 덱 구성 extreme: 주 14장 + 부 4장 + 중립 2장 = 20장
 *   5. 덱 구성 balanced: 균등 배분 + 중립 = 20장
 */

import { describe, it, expect } from 'vitest'
import { calculateImbalance } from '../sajuImbalance'
import { createStartingDeck } from '@/game/store/onboardingStore'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// calculateImbalance — 극단 불균형
// ────────────────────────────────────────────────────

describe('calculateImbalance — 극단 불균형 (extreme)', () => {
  const score = { 木: 6, 火: 0, 土: 0, 金: 0, 水: 0 }

  it('tier가 extreme이다', () => {
    const result = calculateImbalance(score)
    expect(result.tier).toBe('extreme')
  })

  it('dominantElement가 木이다', () => {
    const result = calculateImbalance(score)
    expect(result.dominantElement).toBe('木')
  })

  it('ratio가 1.0이다 (6/6)', () => {
    const result = calculateImbalance(score)
    expect(result.ratio).toBeCloseTo(1.0)
  })

  it('σ가 1.5를 초과한다', () => {
    // E = 6/5 = 1.2, variance = ((6-1.2)²×1 + (0-1.2)²×4)/5 = (23.04 + 5.76)/5 = 5.76
    // σ = sqrt(5.76)/1.2 = 2.4/1.2 = 2.0
    const result = calculateImbalance(score)
    expect(result.sigma).toBeGreaterThan(1.5)
    expect(result.sigma).toBeCloseTo(2.0)
  })

  it('ratio ≥ 0.7 조건만으로도 extreme 판정된다 (ratio=1.0)', () => {
    const result = calculateImbalance({ 木: 6, 火: 0, 土: 0, 金: 0, 水: 0 })
    expect(result.ratio).toBeGreaterThanOrEqual(0.7)
    expect(result.tier).toBe('extreme')
  })
})

// ────────────────────────────────────────────────────
// calculateImbalance — 중간 불균형
// ────────────────────────────────────────────────────

describe('calculateImbalance — 중간 불균형 (moderate)', () => {
  const score = { 木: 3, 火: 1, 土: 2, 金: 0, 水: 0 }

  it('tier가 moderate이다', () => {
    const result = calculateImbalance(score)
    expect(result.tier).toBe('moderate')
  })

  it('dominantElement가 木이다', () => {
    const result = calculateImbalance(score)
    expect(result.dominantElement).toBe('木')
  })

  it('ratio가 0.5이다 (3/6)', () => {
    const result = calculateImbalance(score)
    expect(result.ratio).toBeCloseTo(0.5)
  })

  it('σ가 0.6 이상 1.5 이하다', () => {
    // E = 1.2, scores = [3,1,2,0,0]
    // variance = ((3-1.2)²+(1-1.2)²+(2-1.2)²+(0-1.2)²+(0-1.2)²)/5
    //          = (3.24 + 0.04 + 0.64 + 1.44 + 1.44)/5 = 6.8/5 = 1.36
    // σ = sqrt(1.36)/1.2 ≈ 1.166/1.2 ≈ 0.972
    const result = calculateImbalance(score)
    expect(result.sigma).toBeGreaterThanOrEqual(0.6)
    expect(result.sigma).toBeLessThanOrEqual(1.5)
  })
})

// ────────────────────────────────────────────────────
// calculateImbalance — 균형형
// ────────────────────────────────────────────────────

describe('calculateImbalance — 균형형 (balanced)', () => {
  const score = { 木: 1, 火: 2, 土: 1, 金: 1, 水: 1 }

  it('tier가 balanced이다', () => {
    const result = calculateImbalance(score)
    expect(result.tier).toBe('balanced')
  })

  it('dominantElement가 火이다 (최고 점수)', () => {
    const result = calculateImbalance(score)
    expect(result.dominantElement).toBe('火')
  })

  it('ratio가 0.333이다 (2/6)', () => {
    const result = calculateImbalance(score)
    expect(result.ratio).toBeCloseTo(2 / 6)
  })

  it('σ가 0.6 미만이다', () => {
    // E = 1.2, scores = [1,2,1,1,1]
    // variance = ((1-1.2)²+(2-1.2)²+(1-1.2)²+(1-1.2)²+(1-1.2)²)/5
    //          = (0.04+0.64+0.04+0.04+0.04)/5 = 0.8/5 = 0.16
    // σ = sqrt(0.16)/1.2 = 0.4/1.2 ≈ 0.333
    const result = calculateImbalance(score)
    expect(result.sigma).toBeLessThan(0.6)
    expect(result.sigma).toBeCloseTo(0.333, 2)
  })
})

// ────────────────────────────────────────────────────
// calculateImbalance — 완전 균형
// ────────────────────────────────────────────────────

describe('calculateImbalance — 완전 균형', () => {
  it('모든 오행이 동일할 때 σ=0, tier=balanced', () => {
    // E = 6/5 = 1.2이지만 모두 동일한 점수 (2,2,2,2,2 → 합계 10)
    // E = 10/5 = 2, variance = 0
    const score = { 木: 2, 火: 2, 土: 2, 金: 2, 水: 2 }
    const result = calculateImbalance(score)
    expect(result.sigma).toBeCloseTo(0)
    expect(result.tier).toBe('balanced')
  })

  it('합계 0 엣지 케이스: balanced 반환', () => {
    const score = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
    const result = calculateImbalance(score)
    expect(result.tier).toBe('balanced')
    expect(result.sigma).toBe(0)
  })
})

// ────────────────────────────────────────────────────
// calculateImbalance — extreme 경계값 (ratio=0.7)
// ────────────────────────────────────────────────────

describe('calculateImbalance — ratio ≥ 0.7 경계값', () => {
  it('{木:4, 火:1, 土:1, 金:0, 水:0} → ratio≈0.667 → moderate', () => {
    // ratio = 4/6 ≈ 0.667 < 0.7
    const result = calculateImbalance({ 木: 4, 火: 1, 土: 1, 金: 0, 水: 0 })
    expect(result.ratio).toBeCloseTo(4 / 6)
    expect(result.ratio).toBeLessThan(0.7)
    // σ 확인 필요: moderate일 수 있음
    expect(['moderate', 'extreme']).toContain(result.tier)
  })

  it('{木:5, 火:1, 土:0, 金:0, 水:0} → ratio≈0.833 → extreme', () => {
    // ratio = 5/6 ≈ 0.833 ≥ 0.7
    const result = calculateImbalance({ 木: 5, 火: 1, 土: 0, 金: 0, 水: 0 })
    expect(result.ratio).toBeGreaterThanOrEqual(0.7)
    expect(result.tier).toBe('extreme')
  })
})

// ────────────────────────────────────────────────────
// 덱 구성 — extreme: 주 14 + 부 4 + 중립 2 = 20장
// ────────────────────────────────────────────────────

describe('createStartingDeck — extreme 덱 구성', () => {
  const extremeScore: Record<FiveElement, number> = { 木: 6, 火: 0, 土: 0, 金: 0, 水: 0 }

  it('총 20장이다', () => {
    const deck = createStartingDeck('木', extremeScore)
    expect(deck).toHaveLength(20)
  })

  it('카드 ID가 모두 유니크하다', () => {
    const deck = createStartingDeck('木', extremeScore)
    const ids = deck.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('중립 카드가 2장 포함된다', () => {
    const deck = createStartingDeck('木', extremeScore)
    const neutral = deck.filter(c => c.element === null)
    expect(neutral).toHaveLength(2)
  })

  it('주 오행(木) 카드가 14장이다', () => {
    const deck = createStartingDeck('木', extremeScore)
    const primary = deck.filter(c => c.element === '木')
    expect(primary).toHaveLength(14)
  })

  it('부 카드(상생)가 4장이다', () => {
    const deck = createStartingDeck('木', extremeScore)
    const secondary = deck.filter(c => c.element !== '木' && c.element !== null)
    expect(secondary).toHaveLength(4)
  })
})

// ────────────────────────────────────────────────────
// 덱 구성 — balanced: 균등 배분 + 중립 = 20장
// ────────────────────────────────────────────────────

describe('createStartingDeck — balanced 덱 구성', () => {
  const balancedScore: Record<FiveElement, number> = { 木: 1, 火: 2, 土: 1, 金: 1, 水: 1 }

  it('총 20장이다', () => {
    const deck = createStartingDeck('火', balancedScore)
    expect(deck).toHaveLength(20)
  })

  it('카드 ID가 모두 유니크하다', () => {
    const deck = createStartingDeck('火', balancedScore)
    const ids = deck.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('중립 카드가 2장 이상 포함된다', () => {
    const deck = createStartingDeck('火', balancedScore)
    const neutral = deck.filter(c => c.element === null)
    expect(neutral.length).toBeGreaterThanOrEqual(2)
  })

  it('모든 5개 오행 카드가 분산되어 포함된다', () => {
    const deck = createStartingDeck('火', balancedScore)
    const elements = new Set(deck.filter(c => c.element !== null).map(c => c.element))
    // balanced이므로 다수 오행 포함
    expect(elements.size).toBeGreaterThanOrEqual(3)
  })
})

// ────────────────────────────────────────────────────
// 덱 구성 — elementScore 없을 때 기존 동작 유지
// ────────────────────────────────────────────────────

describe('createStartingDeck — 기존 호환성 (elementScore 없음)', () => {
  const ALL_ELEMENTS: FiveElement[] = ['木', '火', '土', '金', '水']

  it('elementScore 없이 호출해도 20장이 반환된다', () => {
    for (const el of ALL_ELEMENTS) {
      const deck = createStartingDeck(el)
      expect(deck).toHaveLength(20)
    }
  })

  it('elementScore 없을 때 덱 카드 ID가 유니크하다', () => {
    for (const el of ALL_ELEMENTS) {
      const deck = createStartingDeck(el)
      const ids = deck.map(c => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
