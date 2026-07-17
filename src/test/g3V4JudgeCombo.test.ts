/**
 * G3 v4 judgeCombo 통합 테스트 — §3 황금비 곡선 + gather5 ×6.5
 *
 * vi.mock으로 COMBO_RULESET_VERSION='v4' 오버라이드
 * 옹기가마 10쌍 → judgeCombo 반환 multiplier 검증
 * gather5 ×6.5 참조 확인
 */

import { describe, it, expect, vi } from 'vitest'
import type { Card } from '../types/game'

// COMBO_RULESET_VERSION='v4' 오버라이드 — 반드시 최상단
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'v4' }
})

const { judgeCombo } = await import('../engine/pokerHandJudge')

// 카드 생성 헬퍼
function makeCards(elementCounts: Array<{ element: Card['element']; count: number }>): Card[] {
  let id = 0
  const cards: Card[] = []
  for (const { element, count } of elementCounts) {
    for (let i = 0; i < count; i++) {
      cards.push({
        id: `c${id++}`,
        element,
        value: 2,
        polarity: 'yang',
        name: element,
        suit: element,
      } as Card)
    }
  }
  return cards
}

// 옹기가마 조합: 촉매=화(hwa), 연료=토(to)
// FUSION_COMBOS: 옹기가마 = element1:'hwa', element2:'to'

describe('G3 v4 judgeCombo — §3 황금비 보정 통합 (옹기가마 전표 10쌍)', () => {
  it('화1토1 (2장, 면제) → multiplier=1.50', () => {
    const cards = makeCards([{ element: 'hwa', count: 1 }, { element: 'to', count: 1 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(1.50, 2)
  })

  it('화1토2 (3장 정점) → multiplier=3.00', () => {
    const cards = makeCards([{ element: 'hwa', count: 1 }, { element: 'to', count: 2 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(3.00, 2)
  })

  it('화2토1 (3장 촉매과다) → multiplier=2.55', () => {
    const cards = makeCards([{ element: 'hwa', count: 2 }, { element: 'to', count: 1 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(2.55, 2)
  })

  it('화1토3 (4장 연료과다, 이탈1) → multiplier=3.40', () => {
    const cards = makeCards([{ element: 'hwa', count: 1 }, { element: 'to', count: 3 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(3.40, 2)
  })

  it('화2토2 (4장 정점) → multiplier=4.00', () => {
    const cards = makeCards([{ element: 'hwa', count: 2 }, { element: 'to', count: 2 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(4.00, 2)
  })

  it('화3토1 (4장 촉매과다, 이탈2) → multiplier=2.80', () => {
    const cards = makeCards([{ element: 'hwa', count: 3 }, { element: 'to', count: 1 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(2.80, 2)
  })

  it('화1토4 (5장 연료과다, 이탈2) → multiplier=3.85', () => {
    const cards = makeCards([{ element: 'hwa', count: 1 }, { element: 'to', count: 4 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(3.85, 2)
  })

  it('화2토3 (5장 정점) → multiplier=5.50', () => {
    const cards = makeCards([{ element: 'hwa', count: 2 }, { element: 'to', count: 3 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(5.50, 2)
  })

  it('화3토2 (5장 촉매과다, 이탈1) → multiplier=4.68', () => {
    const cards = makeCards([{ element: 'hwa', count: 3 }, { element: 'to', count: 2 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(4.68, 2)
  })

  it('화4토1 (5장 촉매과다, 이탈2) → multiplier=3.85 — DoD 필수 지문', () => {
    const cards = makeCards([{ element: 'hwa', count: 4 }, { element: 'to', count: 1 }])
    const result = judgeCombo(cards)
    expect(result.multiplier).toBeCloseTo(3.85, 2)
  })
})

describe('G3 v4 judgeCombo — gather5 ×6.5 참조 확인 (§4 위계)', () => {
  it('같은 기운 5장(gather5) → multiplier=6.5 (RECIPE_GATHER5_MULT_A)', () => {
    const cards = makeCards([{ element: 'mok', count: 5 }])
    const result = judgeCombo(cards)
    expect(result.type).toBe('gather')
    // E2E 지문: gather5 ×6.5 참조 — RECIPE_GATHER5_MULT_A
    expect(result.multiplier).toBe(6.5)
  })

  it('위계 확인: gather5(6.5) > 융합5장정점(5.5) > 연환은 별도', () => {
    const gather5Cards = makeCards([{ element: 'su', count: 5 }])
    const fusion5PeakCards = makeCards([{ element: 'hwa', count: 2 }, { element: 'to', count: 3 }])
    const gather5Result = judgeCombo(gather5Cards)
    const fusion5Result = judgeCombo(fusion5PeakCards)
    expect(gather5Result.multiplier).toBeGreaterThan(fusion5Result.multiplier)
    expect(gather5Result.multiplier).toBe(6.5)
    expect(fusion5Result.multiplier).toBe(5.5)
  })
})
