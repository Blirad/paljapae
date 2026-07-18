/**
 * 배치 2 §4 연환 2단 계단형 (천지어환/어환/기본연환) E2E 테스트
 *
 * 이든 지시 2026-07-18 G5 최종 판정:
 *   - 천지어환(天地御環) = 왕 + 여왕 + 상이 3오행 (5장·5원소) → ×15 (전설)
 *   - 어환(御環) = 왕족(왕 또는 여왕) 1장 + 상이 4오행 (5장·5원소) → ×12 (희귀)
 *   - 기본연환(5원소 각1) ×8 불변
 *   - 판정 순서: 천지어환 → 어환 → 기본연환 (상위 우선)
 *   - E2E: 왕+4오행 → ×12 / 여왕+4오행 → ×12 / 왕+여왕+3오행 → ×15
 *           평민 5오행 → ×8 / 왕 승격·여왕 증폭이 어환과 중복 미적용
 */

import { describe, it, expect } from 'vitest'
import { judgeCombo, isCheonjiEohwan, isEohwan, isOhangYeonhwan, YEONHWAN_MIN_SUM } from '../engine/pokerHandJudge'
import { CHEONJI_EOHWAN_MULTIPLIER, EOHWAN_MULTIPLIER, OHANG_YEONHWAN_MULTIPLIER } from '../engine/balance'
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

describe('배치 2 §4 연환 2단 계단형 (천지어환/어환/기본연환) E2E', () => {
  it('E2E-1: 천지어환 — 왕+여왕+3오행 → ×15', () => {
    // 왕(화,값10) + 여왕(수,값10) + 목(값5) + 토(값5) + 금(값5) = 5원소, 합=35 ≥ 25
    const cards = [
      makeCard('hwa', 'yang', 10, 'king'),   // 왕 — 병화
      makeCard('su', 'yin', 10, 'queen'),    // 여왕 — 계수
      makeCard('mok', 'yang', 5),            // 목
      makeCard('to', 'yang', 5),             // 토
      makeCard('geum', 'yang', 5),           // 금
    ]
    expect(isCheonjiEohwan(cards)).toBe(true)
    expect(isEohwan(cards)).toBe(false)  // 천지어환이 이미 충족되었으므로 어환 판정 제외
    expect(isOhangYeonhwan(cards)).toBe(true)

    const result = judgeCombo(cards)
    expect(result.type).toBe('ohang-yeonhwan')
    expect(result.name).toBe('천지어환')
    expect(result.multiplier).toBe(CHEONJI_EOHWAN_MULTIPLIER)  // ×15
    expect(result.isCheonjiEohwan).toBe(true)
    expect(result.baseScore).toBe(35)
    expect(result.totalScore).toBe(35 * 15)
  })

  it('E2E-2: 어환(왕) — 왕+4오행 → ×12', () => {
    // 왕(화,값10) + 목(값5) + 토(값5) + 수(값5) + 금(값5) = 5원소, 합=30 ≥ 25
    const cards = [
      makeCard('hwa', 'yang', 10, 'king'),   // 왕 — 병화
      makeCard('mok', 'yang', 5),            // 목
      makeCard('to', 'yang', 5),             // 토
      makeCard('su', 'yang', 5),             // 수
      makeCard('geum', 'yang', 5),           // 금
    ]
    expect(isCheonjiEohwan(cards)).toBe(false)  // 여왕 부재
    expect(isEohwan(cards)).toBe(true)
    expect(isOhangYeonhwan(cards)).toBe(true)

    const result = judgeCombo(cards)
    expect(result.type).toBe('ohang-yeonhwan')
    expect(result.name).toBe('어환')
    expect(result.multiplier).toBe(EOHWAN_MULTIPLIER)  // ×12
    expect(result.isEohwan).toBe(true)
    expect(result.baseScore).toBe(30)
    expect(result.totalScore).toBe(30 * 12)
  })

  it('E2E-3: 어환(여왕) — 여왕+4오행 → ×12', () => {
    // 여왕(수,값10) + 목(값5) + 화(값5) + 토(값5) + 금(값5) = 5원소, 합=30 ≥ 25
    const cards = [
      makeCard('su', 'yin', 10, 'queen'),    // 여왕 — 계수
      makeCard('mok', 'yang', 5),            // 목
      makeCard('hwa', 'yang', 5),            // 화
      makeCard('to', 'yang', 5),             // 토
      makeCard('geum', 'yang', 5),           // 금
    ]
    expect(isCheonjiEohwan(cards)).toBe(false)  // 왕 부재
    expect(isEohwan(cards)).toBe(true)
    expect(isOhangYeonhwan(cards)).toBe(true)

    const result = judgeCombo(cards)
    expect(result.type).toBe('ohang-yeonhwan')
    expect(result.name).toBe('어환')
    expect(result.multiplier).toBe(EOHWAN_MULTIPLIER)  // ×12
    expect(result.isEohwan).toBe(true)
    expect(result.baseScore).toBe(30)
    expect(result.totalScore).toBe(30 * 12)
  })

  it('E2E-4: 기본연환 — 평민 5오행 → ×8', () => {
    // 왕족 없이 평민만 5원소 (합=25)
    const cards = [
      makeCard('mok', 'yang', 5),  // 목
      makeCard('hwa', 'yang', 5),  // 화
      makeCard('to', 'yang', 5),   // 토
      makeCard('geum', 'yang', 5), // 금
      makeCard('su', 'yang', 5),   // 수
    ]
    expect(isCheonjiEohwan(cards)).toBe(false)  // 왕족 부재
    expect(isEohwan(cards)).toBe(false)         // 왕족 부재
    expect(isOhangYeonhwan(cards)).toBe(true)

    const result = judgeCombo(cards)
    expect(result.type).toBe('ohang-yeonhwan')
    expect(result.name).toBe('오행연환')
    expect(result.multiplier).toBe(OHANG_YEONHWAN_MULTIPLIER)  // ×8
    expect(result.baseScore).toBe(25)
    expect(result.totalScore).toBe(25 * 8)
  })

  it('E2E-5: 값 미달 5오행 → 불성립', () => {
    // 왕족 없이 평민만 5원소이지만 합 < 25 (합=20)
    const cards = [
      makeCard('mok', 'yang', 4),  // 목
      makeCard('hwa', 'yang', 4),  // 화
      makeCard('to', 'yang', 4),   // 토
      makeCard('geum', 'yang', 4), // 금
      makeCard('su', 'yang', 4),   // 수
    ]
    expect(isOhangYeonhwan(cards)).toBe(false)  // 값 미달

    const result = judgeCombo(cards)
    expect(result.type).toBe('none')
  })

  it('E2E-6: 왕 승격·여왕 증폭이 어환과 중복 미적용', () => {
    // 어환 발동 시 왕의 "비율 판정 승격" 효과가 어환 배율에 적용되지 않음.
    // 어환은 "왕족의 힘"이므로 기본 계층에서만 비율 영향 (비율 승격은 fusion 경로에서만).
    // 여기서는 구조적 확인: isEohwan=true, hasKingUpgrade/hasQueenAmplify는 undefined (fusion 경로 아님).

    const cards = [
      makeCard('hwa', 'yang', 10, 'king'),   // 왕 — 병화
      makeCard('mok', 'yang', 5),            // 목
      makeCard('to', 'yang', 5),             // 토
      makeCard('su', 'yang', 5),             // 수
      makeCard('geum', 'yang', 5),           // 금
    ]
    const result = judgeCombo(cards)
    expect(result.isEohwan).toBe(true)
    expect(result.multiplier).toBe(EOHWAN_MULTIPLIER)  // ×12 고정 (융합 비율 미적용)
    expect(result.hasKingUpgrade).toBeUndefined()  // fusion 경로가 아니므로
    expect(result.hasQueenAmplify).toBeUndefined()
  })
})
