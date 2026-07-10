/**
 * 팔자전 Phase 1.9 — 조합 판정 유닛 테스트
 * 새 체계: 기운 모으기 / 융합 / 오행연환
 */

import { describe, it, expect } from 'vitest'
import { judgeHand, judgeCombo, isGatherCombo, isFusionCombo, isOhangYeonhwan } from '../engine/pokerHandJudge'
import { findFusionCombo } from '../engine/balance'
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

describe('Phase 1.9 조합 판정: 오행연환', () => {
  it('5종 오행 5장 → 오행연환 (배율 ×10)', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yin', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yin', 5),
      makeCard('su', 'yang', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('ohang-yeonhwan')
    expect(result.multiplier).toBe(8)  // Phase 1.9.2: ×10 → ×8
    expect(isOhangYeonhwan(cards)).toBe(true)
  })

  it('5종 오행이 아닌 3기운 5장 → 오행연환 아님 (3기운만 있음)', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yin', 5),
      makeCard('hwa', 'yang', 5),
      makeCard('hwa', 'yin', 5),
      makeCard('to', 'yang', 5),
    ]
    const result = judgeHand(cards)
    // 5기운이 아니므로 오행연환이 아님, 하지만 같은 기운이 아니므로 gather도 아님
    expect(result.rank).toBe('none')
    expect(isOhangYeonhwan(cards)).toBe(false)
  })
})

describe('Phase 1.9 조합 판정: 기운 모으기', () => {
  it('같은 기운 2장 → 기운 모으기 (배율 ×1.5)', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yin', 6),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('gather')
    expect(result.multiplier).toBe(1.5)
    expect(isGatherCombo(cards)).toBe(true)
  })

  it('같은 기운 3장 → 기운 모으기 (배율 ×2.5)', () => {
    const cards = [
      makeCard('hwa', 'yang', 3),
      makeCard('hwa', 'yin', 4),
      makeCard('hwa', 'yang', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('gather')
    expect(result.multiplier).toBe(2.5)
  })

  it('같은 기운 4장 → 기운 모으기 (배율 ×3.5)', () => {
    const cards = [
      makeCard('to', 'yang', 2),
      makeCard('to', 'yin', 3),
      makeCard('to', 'yang', 4),
      makeCard('to', 'yin', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('gather')
    expect(result.multiplier).toBe(3.5)
  })

  it('같은 기운 5장 → 기운 모으기 (배율 ×5.0)', () => {
    const cards = [
      makeCard('su', 'yang', 1),
      makeCard('su', 'yin', 2),
      makeCard('su', 'yang', 3),
      makeCard('su', 'yin', 4),
      makeCard('su', 'yang', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('gather')
    expect(result.multiplier).toBe(5.0)
  })

  it('같은 기운 + 음양 조화 → +20% 보너스', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yin', 6),
    ]
    const result = judgeCombo(cards)
    expect(result.eumyangBonusApplied).toBe(true)
    const baseScore = 5 + 6  // 11
    const withMultiplier = Math.round(baseScore * 1.5)  // 16
    const withBonus = Math.round(withMultiplier * 1.2)  // 19
    expect(result.totalScore).toBe(withBonus)
  })

  it('같은 기운 + 음양 조화 없음 (같은 음양) → 보너스 없음', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yang', 6),
    ]
    const result = judgeCombo(cards)
    expect(result.eumyangBonusApplied).toBe(false)
    const baseScore = 5 + 6
    const expected = Math.round(baseScore * 1.5)
    expect(result.totalScore).toBe(expected)
  })
})

describe('Phase 1.9 조합 판정: 융합', () => {
  describe('낳는 조합 (배율 ×3.0)', () => {
    it('목 + 화 → 들불(火)', () => {
      const cards = [
        makeCard('mok', 'yang', 5),
        makeCard('hwa', 'yin', 6),
      ]
      const result = judgeHand(cards)
      expect(result.rank).toBe('fusion-birth')
      expect(result.multiplier).toBe(3.0)
      expect(result.finishingElement).toBe('hwa')
      expect(isFusionCombo(cards)).toBe(true)
    })

    it('화 + 토 → 옹기가마(土)', () => {
      const fusion = findFusionCombo('hwa', 'to')
      expect(fusion?.name).toBe('옹기가마')
      expect(fusion?.result).toBe('to')
    })

    it('토 + 금 → 광맥(金)', () => {
      const fusion = findFusionCombo('to', 'geum')
      expect(fusion?.name).toBe('광맥')
      expect(fusion?.result).toBe('geum')
    })

    it('금 + 수 → 샘(水)', () => {
      const fusion = findFusionCombo('geum', 'su')
      expect(fusion?.name).toBe('샘')
      expect(fusion?.result).toBe('su')
    })

    it('수 + 목 → 숲(木)', () => {
      const fusion = findFusionCombo('su', 'mok')
      expect(fusion?.name).toBe('숲')
      expect(fusion?.result).toBe('mok')
    })
  })

  describe('벼리는 조합 (배율 ×3.5)', () => {
    it('화 + 금 → 벼린 검(金)', () => {
      const cards = [
        makeCard('hwa', 'yang', 5),
        makeCard('geum', 'yin', 5),
      ]
      const result = judgeHand(cards)
      expect(result.rank).toBe('fusion-hone')
      expect(result.multiplier).toBe(3.5)
      expect(result.finishingElement).toBe('geum')
      expect(isFusionCombo(cards)).toBe(true)
    })

    it('금 + 목 → 깎은 화살(木)', () => {
      const fusion = findFusionCombo('geum', 'mok')
      expect(fusion?.name).toBe('깎은 화살')
      expect(fusion?.result).toBe('mok')
    })

    it('목 + 토 → 일군 밭(土)', () => {
      const fusion = findFusionCombo('mok', 'to')
      expect(fusion?.name).toBe('일군 밭')
      expect(fusion?.result).toBe('to')
    })

    it('토 + 수 → 맑은 못(水)', () => {
      const fusion = findFusionCombo('to', 'su')
      expect(fusion?.name).toBe('맑은 못')
      expect(fusion?.result).toBe('su')
    })

    it('수 + 화 → 담금불(火)', () => {
      const fusion = findFusionCombo('su', 'hwa')
      expect(fusion?.name).toBe('담금불')
      expect(fusion?.result).toBe('hwa')
    })
  })

  it('목 + 금 → 깎은 화살(벼리는 조합)', () => {
    // 목 + 금은 실제로 "깎은 화살" 벼리는 조합임
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('geum', 'yin', 5),
    ]
    const fusion = findFusionCombo('mok', 'geum')
    expect(fusion?.name).toBe('깎은 화살')
    expect(fusion?.type).toBe('hone')
    expect(isFusionCombo(cards)).toBe(true)
  })

  it('3기운 이상 선택은 융합 아님', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yin', 5),
      makeCard('to', 'yang', 5),
    ]
    expect(isFusionCombo(cards)).toBe(false)
  })

  describe('Phase 1.9.3 다장 융합 (장수 제약 제거)', () => {
    it('화1+화8+수7+수5 = 담금불(火) · 공격력 21 × 3.5 (이든 실기 검증 케이스)', () => {
      const cards = [
        makeCard('hwa', 'yang', 1),
        makeCard('hwa', 'yin', 8),
        makeCard('su', 'yang', 7),
        makeCard('su', 'yin', 5),
      ]
      expect(isFusionCombo(cards)).toBe(true)
      const result = judgeCombo(cards)
      expect(result.type).toBe('fusion-hone')
      expect(result.name).toBe('담금불')
      expect(result.finishingElement).toBe('hwa')
      expect(result.baseScore).toBe(21)
      expect(result.multiplier).toBe(3.5)
      expect(result.totalScore).toBe(Math.round(21 * 3.5))  // 73
    })

    it('3장 융합: 목+목+화 = 들불(火) · 공격력 합산', () => {
      const cards = [
        makeCard('mok', 'yang', 3),
        makeCard('mok', 'yin', 4),
        makeCard('hwa', 'yang', 6),
      ]
      expect(isFusionCombo(cards)).toBe(true)
      const result = judgeCombo(cards)
      expect(result.type).toBe('fusion-birth')
      expect(result.name).toBe('들불')
      expect(result.baseScore).toBe(13)
    })

    it('5장 융합 (상한): 화×3 + 금×2 = 벼린 검(金)', () => {
      const cards = [
        makeCard('hwa', 'yang', 2),
        makeCard('hwa', 'yin', 3),
        makeCard('hwa', 'yang', 1),
        makeCard('geum', 'yin', 4),
        makeCard('geum', 'yang', 5),
      ]
      expect(isFusionCombo(cards)).toBe(true)
      const result = judgeCombo(cards)
      expect(result.type).toBe('fusion-hone')
      expect(result.name).toBe('벼린 검')
      expect(result.baseScore).toBe(15)
    })

    it('6장은 융합 불가 (상한 5장 초과)', () => {
      const cards = [
        makeCard('hwa', 'yang', 1),
        makeCard('hwa', 'yin', 2),
        makeCard('hwa', 'yang', 3),
        makeCard('su', 'yin', 1),
        makeCard('su', 'yang', 2),
        makeCard('su', 'yin', 3),
      ]
      expect(isFusionCombo(cards)).toBe(false)
    })

    it('3기운 × 다장 선택은 여전히 융합 아님', () => {
      const cards = [
        makeCard('mok', 'yang', 3),
        makeCard('hwa', 'yin', 3),
        makeCard('to', 'yang', 3),
      ]
      expect(isFusionCombo(cards)).toBe(false)
    })
  })
})

describe('Phase 1.9 조합 판정: 우선순위', () => {
  it('오행연환 > 기운 모으기 (5기운 모두 있을 때)', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yin', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yin', 5),
      makeCard('su', 'yang', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('ohang-yeonhwan')  // 모으기 아님
  })

  it('융합 > 기운 모으기 (2기운 정확히 일 때)', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yin', 6),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('fusion-birth')  // 모으기 아님
  })
})

describe('Phase 1.9 조합 판정: 기본 구조', () => {
  it('카드 없음 → none', () => {
    const result = judgeHand([])
    expect(result.rank).toBe('none')
    expect(result.totalScore).toBe(0)
  })

  it('totalScore = baseScore × multiplier (+ 음양 조화 보너스 시 추가)', () => {
    const cards = [
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yin', 6),
    ]
    const result = judgeCombo(cards)
    // 음양 조화가 적용되므로: baseScore * multiplier * (1 + bonus)
    const expected = result.eumyangBonusApplied
      ? Math.round(result.baseScore * result.multiplier * (1 + 0.2))
      : Math.round(result.baseScore * result.multiplier)
    expect(result.totalScore).toBe(expected)
  })

  it('오행연환 > 기운 모으기 > 융합 > none 점수 순서', () => {
    const ohang = judgeHand([
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yin', 5),
      makeCard('to', 'yang', 5),
      makeCard('geum', 'yin', 5),
      makeCard('su', 'yang', 5),
    ])
    const gather = judgeHand([
      makeCard('mok', 'yang', 10),
      makeCard('mok', 'yin', 10),
      makeCard('mok', 'yang', 10),
    ])
    const fusion = judgeHand([
      makeCard('mok', 'yang', 10),
      makeCard('hwa', 'yin', 10),
    ])
    const none = judgeHand([
      makeCard('mok', 'yang', 1),
      makeCard('hwa', 'yang', 1),
      makeCard('to', 'yang', 1),
    ])

    expect(ohang.totalScore).toBeGreaterThan(gather.totalScore)
    expect(gather.totalScore).toBeGreaterThan(fusion.totalScore)
    expect(fusion.totalScore).toBeGreaterThan(none.totalScore)
  })
})
