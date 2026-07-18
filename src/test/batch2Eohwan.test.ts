/**
 * 배치 2 §4 연환 2단 (어환 ×12) E2E 테스트
 *
 * 이든 지시 2026-07-18:
 *   - 어환(御環) = 왕 + 여왕 + 상이 3오행 (5장·5원소) → ×12
 *   - 기본 연환(5원소 각1) ×8 불변
 *   - 판정 순서: 어환 먼저 → 연환
 *   - E2E: 왕+여왕+3오행 → ×12 / 왕만+4오행 → ×8 / 어환 강림 중첩
 */

import { describe, it, expect } from 'vitest'
import { judgeCombo, isEohwan, isOhangYeonhwan, YEONHWAN_MIN_SUM } from '../engine/pokerHandJudge'
import { EOHWAN_MULTIPLIER, OHANG_YEONHWAN_MULTIPLIER } from '../engine/balance'
import type { Card } from '../types/game'

function makeCard(
  element: 'mok' | 'hwa' | 'to' | 'geum' | 'su',
  polarity: 'yang' | 'yin' = 'yang',
  value: number = 5,
  royalType?: 'king' | 'queen',
): Card {
  return {
    id: `test-${Math.random()}`,
    element,
    polarity,
    value,
    type: royalType ? 'commander' : 'soldier',
    rarity: royalType ? 'epic' : 'common',
    royalType,
  }
}

describe('배치 2 §4 연환 2단 (어환 ×12) E2E', () => {
  it('E2E-1: 왕+여왕+3오행 → 어환 ×12', () => {
    // 왕(화,값10) + 여왕(수,값10) + 목(값5) + 토(값5) + 금(값5) = 5원소, 합=35 ≥ 25
    const cards = [
      makeCard('hwa', 'yang', 10, 'king'),   // 왕 — 병화
      makeCard('su', 'yin', 10, 'queen'),    // 여왕 — 계수
      makeCard('mok', 'yang', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yang', 5),
    ]
    expect(isEohwan(cards)).toBe(true)
    expect(isOhangYeonhwan(cards)).toBe(true)

    const result = judgeCombo(cards)
    expect(result.type).toBe('ohang-yeonhwan')
    expect(result.name).toBe('어환')
    expect(result.multiplier).toBe(EOHWAN_MULTIPLIER)  // ×12
    expect(result.isEohwan).toBe(true)
    expect(result.totalScore).toBe(Math.round(35 * 12))  // 420
  })

  it('E2E-2: 왕만+4오행 → 기본 연환 ×8 (어환 불성립)', () => {
    // 왕(화,값10) + 수(값5) + 목(값5) + 토(값5) + 금(값5) = 5원소, 합=30 ≥ 25
    // 여왕 없음 → 어환 불성립, 기본 연환 판정
    const cards = [
      makeCard('hwa', 'yang', 10, 'king'),   // 왕만
      makeCard('su', 'yang', 5),
      makeCard('mok', 'yang', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yang', 5),
    ]
    expect(isEohwan(cards)).toBe(false)
    expect(isOhangYeonhwan(cards)).toBe(true)

    const result = judgeCombo(cards)
    expect(result.type).toBe('ohang-yeonhwan')
    expect(result.name).toBe('오행연환')
    expect(result.multiplier).toBe(OHANG_YEONHWAN_MULTIPLIER)  // ×8
    expect(result.isEohwan).toBeUndefined()
    expect(result.totalScore).toBe(Math.round(30 * 8))  // 240
  })

  it('E2E-3: 여왕만+4오행 → 기본 연환 ×8 (어환 불성립)', () => {
    // 여왕(목,값10) + 화(값5) + 토(값5) + 금(값5) + 수(값5) = 5원소, 합=30 ≥ 25
    const cards = [
      makeCard('mok', 'yin', 10, 'queen'),   // 여왕만
      makeCard('hwa', 'yang', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yang', 5),
      makeCard('su', 'yang', 5),
    ]
    expect(isEohwan(cards)).toBe(false)
    expect(isOhangYeonhwan(cards)).toBe(true)

    const result = judgeCombo(cards)
    expect(result.name).toBe('오행연환')
    expect(result.multiplier).toBe(OHANG_YEONHWAN_MULTIPLIER)  // ×8
  })

  it('E2E-4: 왕+여왕 동오행 → 5원소 불성립 → 어환·연환 모두 불성립', () => {
    // 왕(화) + 여왕(화) + 목 + 토 + 금 = 4원소 (화 2장) → 연환 조건 미충족
    const cards = [
      makeCard('hwa', 'yang', 10, 'king'),
      makeCard('hwa', 'yin', 10, 'queen'),
      makeCard('mok', 'yang', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yang', 5),
    ]
    expect(isEohwan(cards)).toBe(false)
    expect(isOhangYeonhwan(cards)).toBe(false)

    const result = judgeCombo(cards)
    // 5원소 아니므로 연환 불성립. 화2+목1+토1+금1 = 2원소 아닌 잡탕 → v4에서도 none 폴백
    expect(result.type).not.toBe('ohang-yeonhwan')
  })

  it('E2E-5: 어환 위계 — ×12가 위계 최상위 확인', () => {
    // 스펙 §5: 일반기 < 융합곡선(~5.5) < 대모으기(6.5) < 연환(8) < 어환(12)
    expect(EOHWAN_MULTIPLIER).toBe(12)
    expect(EOHWAN_MULTIPLIER).toBeGreaterThan(OHANG_YEONHWAN_MULTIPLIER)

    // 어환 성립 시 연환보다 우선 판정
    const eohwanCards = [
      makeCard('hwa', 'yang', 10, 'king'),
      makeCard('su', 'yin', 10, 'queen'),
      makeCard('mok', 'yang', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yang', 5),
    ]
    const result = judgeCombo(eohwanCards)
    expect(result.multiplier).toBe(12)
    expect(result.name).toBe('어환')

    // 같은 카드에서 왕·여왕을 평민으로 바꾸면 연환(×8)으로 격하
    const yeonhwanCards = [
      makeCard('hwa', 'yang', 10),     // 왕 → 평민
      makeCard('su', 'yang', 10),      // 여왕 → 평민
      makeCard('mok', 'yang', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yang', 5),
    ]
    const result2 = judgeCombo(yeonhwanCards)
    expect(result2.multiplier).toBe(8)
    expect(result2.name).toBe('오행연환')
  })

  it('E2E-6: 값합 미달 (왕+여왕+3오행, 합<25) → 어환·연환 모두 불성립', () => {
    // 왕(화,값2) + 여왕(수,값2) + 목(값2) + 토(값2) + 금(값2) = 합10 < 25
    const cards = [
      makeCard('hwa', 'yang', 2, 'king'),
      makeCard('su', 'yin', 2, 'queen'),
      makeCard('mok', 'yang', 2),
      makeCard('to', 'yang', 2),
      makeCard('geum', 'yang', 2),
    ]
    expect(isEohwan(cards)).toBe(false)
    expect(isOhangYeonhwan(cards)).toBe(false)
  })
})
