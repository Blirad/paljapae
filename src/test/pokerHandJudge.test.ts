/**
 * 팔자전 — 족보 판정 유닛 테스트
 */

import { describe, it, expect } from 'vitest'
import { judgeHand } from '../engine/pokerHandJudge'
import type { Card } from '../types/game'

function makeCard(element: Card['element'], polarity: Card['polarity'], value: number, id?: string): Card {
  return {
    id: id ?? `${element}-${polarity}-${value}`,
    element,
    polarity,
    value,
    type: 'soldier',
    rarity: 'common',
  }
}

describe('족보 판정: 오행연환', () => {
  it('5종 오행 5장 → 오행연환', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yin', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yin', 5),
      makeCard('su', 'yang', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('ohang-yeonhwan')
    expect(result.multiplier).toBe(10)
  })
})

describe('족보 판정: 상생 체인', () => {
  it('목→화→토→금 4체인 → saengchae-chain', () => {
    const cards = [
      makeCard('mok', 'yang', 3),
      makeCard('hwa', 'yin', 4),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yin', 2),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('saengchae-chain')
    expect(result.multiplier).toBe(7)
  })

  it('목→화→토 3체인 → saengchae-3', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yin', 5),
      makeCard('to', 'yang', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('saengchae-3')
  })
})

describe('족보 판정: 음양쌍', () => {
  it('같은 오행 양+음 → 음양쌍 1', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yin', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('eumyang-pair-1')
  })

  it('음양쌍 2개 → eumyang-pair-2', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yin', 5),
      makeCard('hwa', 'yang', 3),
      makeCard('hwa', 'yin', 3),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('eumyang-pair-2')
  })
})

describe('족보 판정: 결집', () => {
  it('같은 오행 같은 음양 3장 → jipgyeol-3', () => {
    const cards = [
      makeCard('mok', 'yang', 3),
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yang', 7),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('jipgyeol-3')
  })

  it('같은 오행 같은 음양 4장 → jipgyeol-4', () => {
    const cards = [
      makeCard('hwa', 'yang', 2),
      makeCard('hwa', 'yang', 4),
      makeCard('hwa', 'yang', 6),
      makeCard('hwa', 'yang', 8),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('jipgyeol-4')
  })

  it('같은 오행 5장 → jipgyeol-5', () => {
    const cards = [
      makeCard('to', 'yang', 1),
      makeCard('to', 'yang', 3),
      makeCard('to', 'yang', 5),
      makeCard('to', 'yin', 7),
      makeCard('to', 'yin', 9),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('jipgyeol-5')
  })
})

describe('족보 판정: 기타', () => {
  it('카드 없음 → 0점', () => {
    const result = judgeHand([])
    expect(result.rank).toBe('none')
    expect(result.totalScore).toBe(0)
  })

  it('혼합 → 해당 없음 → none', () => {
    const cards = [
      makeCard('mok', 'yang', 1),
      makeCard('geum', 'yang', 1),  // 극 관계 (금극목)
    ]
    const result = judgeHand(cards)
    // geuk-bonas: 금이 목을 극
    expect(['geuk-bonas', 'none']).toContain(result.rank)
  })

  it('totalScore = baseScore × multiplier', () => {
    const cards = [makeCard('mok', 'yang', 5)]
    const result = judgeHand(cards)
    expect(result.totalScore).toBe(Math.round(result.baseScore * result.multiplier))
  })
})

describe('족보 판정: 점수 구조', () => {
  it('오행연환이 단순 none보다 점수 높아야', () => {
    const bigCards = [
      makeCard('mok', 'yang', 1),
      makeCard('hwa', 'yin', 1),
      makeCard('to', 'yang', 1),
      makeCard('geum', 'yin', 1),
      makeCard('su', 'yang', 1),
    ]
    const smallCards = [makeCard('mok', 'yang', 1)]
    const bigResult = judgeHand(bigCards)
    const smallResult = judgeHand(smallCards)
    expect(bigResult.totalScore).toBeGreaterThan(smallResult.totalScore)
  })
})
