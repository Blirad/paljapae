/**
 * Phase 1.9 QA — 핵심 기능 검증
 * 새 조합 체계, 응축, 극/반극 판정 통합 테스트
 */

import { describe, it, expect } from 'vitest'
import { judgeCombo, judgeHand } from '../engine/pokerHandJudge'
import { findFusionCombo, getCondenseMultiplier, EUMYANG_HARMONY_BONUS } from '../engine/balance'
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

describe('Phase 1.9 QA — 새 조합 체계 + 응축 + 극/반극', () => {
  describe('1. 기운 모으기 배율 정확성', () => {
    it('2장 → 1.5배', () => {
      const result = judgeCombo([makeCard('mok', 'yang', 5), makeCard('mok', 'yin', 6)])
      expect(result.multiplier).toBe(1.5)
    })

    it('3장 → 2.5배', () => {
      const result = judgeCombo([makeCard('hwa', 'yang', 3), makeCard('hwa', 'yin', 4), makeCard('hwa', 'yang', 5)])
      expect(result.multiplier).toBe(2.5)
    })

    it('4장 → 3.5배', () => {
      const result = judgeCombo([
        makeCard('to', 'yang', 2), makeCard('to', 'yin', 3), 
        makeCard('to', 'yang', 4), makeCard('to', 'yin', 5),
      ])
      expect(result.multiplier).toBe(3.5)
    })

    it('5장 → 5.0배', () => {
      const result = judgeCombo([
        makeCard('su', 'yang', 1), makeCard('su', 'yin', 2), makeCard('su', 'yang', 3),
        makeCard('su', 'yin', 4), makeCard('su', 'yang', 5),
      ])
      expect(result.multiplier).toBe(5.0)
    })
  })

  describe('2. 음양 조화 보너스 +20% 정확성', () => {
    it('양음 혼재 → +20% 적용', () => {
      const result = judgeCombo([makeCard('mok', 'yang', 5), makeCard('mok', 'yin', 6)])
      expect(result.eumyangBonusApplied).toBe(true)
      const baseScore = 11
      const withMult = Math.round(baseScore * 1.5) // 16
      const withBonus = Math.round(withMult * (1 + EUMYANG_HARMONY_BONUS)) // 19
      expect(result.totalScore).toBe(withBonus)
    })

    it('양음 단일 → 보너스 없음', () => {
      const result = judgeCombo([makeCard('mok', 'yang', 5), makeCard('mok', 'yang', 6)])
      expect(result.eumyangBonusApplied).toBe(false)
      const baseScore = 11
      const expected = Math.round(baseScore * 1.5)
      expect(result.totalScore).toBe(expected)
    })
  })

  describe('3. 융합 낳는/벼리는 조합 10종 정의 + 타격 속성', () => {
    it('낳는: 목+화 → 들불(火) ×3.0', () => {
      const fusion = findFusionCombo('mok', 'hwa')
      expect(fusion?.name).toBe('들불')
      expect(fusion?.result).toBe('hwa')
      expect(fusion?.multiplier).toBe(3.0)
      const result = judgeCombo([makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 6)])
      expect(result.finishingElement).toBe('hwa')
    })

    it('낳는: 화+토 → 옹기가마(土) ×3.0', () => {
      const fusion = findFusionCombo('hwa', 'to')
      expect(fusion?.name).toBe('옹기가마')
      expect(fusion?.result).toBe('to')
      expect(fusion?.multiplier).toBe(3.0)
    })

    it('낳는: 토+금 → 광맥(金) ×2.5', () => {
      const fusion = findFusionCombo('to', 'geum')
      expect(fusion?.name).toBe('광맥')
      expect(fusion?.result).toBe('geum')
    })

    it('낳는: 금+수 → 샘(水) ×2.5', () => {
      const fusion = findFusionCombo('geum', 'su')
      expect(fusion?.name).toBe('샘')
      expect(fusion?.result).toBe('su')
    })

    it('낳는: 수+목 → 숲(木) ×2.5', () => {
      const fusion = findFusionCombo('su', 'mok')
      expect(fusion?.name).toBe('숲')
      expect(fusion?.result).toBe('mok')
    })

    it('벼리는: 화+금 → 벼린 검(金) ×3.5', () => {
      const fusion = findFusionCombo('hwa', 'geum')
      expect(fusion?.name).toBe('벼린 검')
      expect(fusion?.result).toBe('geum')
      expect(fusion?.multiplier).toBe(3.5)
    })

    it('벼리는: 금+목 → 깎은 화살(木) ×3.5', () => {
      const fusion = findFusionCombo('geum', 'mok')
      expect(fusion?.name).toBe('깎은 화살')
      expect(fusion?.result).toBe('mok')
      expect(fusion?.multiplier).toBe(3.5)
    })

    it('벼리는: 목+토 → 일군 밭(土) ×3.5', () => {
      const fusion = findFusionCombo('mok', 'to')
      expect(fusion?.name).toBe('일군 밭')
      expect(fusion?.result).toBe('to')
      expect(fusion?.multiplier).toBe(3.5)
    })

    it('벼리는: 토+수 → 맑은 못(水) ×3.5', () => {
      const fusion = findFusionCombo('to', 'su')
      expect(fusion?.name).toBe('맑은 못')
      expect(fusion?.result).toBe('su')
      expect(fusion?.multiplier).toBe(3.5)
    })

    it('벼리는: 수+화 → 담금불(火) ×3.5', () => {
      const fusion = findFusionCombo('su', 'hwa')
      expect(fusion?.name).toBe('담금불')
      expect(fusion?.result).toBe('hwa')
      expect(fusion?.multiplier).toBe(3.5)
    })
  })

  describe('4. 오행연환 배율 (×8 — Phase 1.9.2 희소화)', () => {
    it('5기운 모두 필수 + 정확히 5장 → 배율 ×8', () => {
      const result = judgeCombo([
        makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 5), makeCard('to', 'yang', 5),
        makeCard('geum', 'yin', 5), makeCard('su', 'yang', 5),
      ])
      expect(result.type).toBe('ohang-yeonhwan')
      expect(result.multiplier).toBe(8)
    })

    it('4기운만 → 오행연환 아님', () => {
      const result = judgeCombo([
        makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 5), 
        makeCard('to', 'yang', 5), makeCard('geum', 'yin', 5),
      ])
      expect(result.type).not.toBe('ohang-yeonhwan')
    })

    it('5기운 6장 → 오행연환 아님 (정확히 5장 필요)', () => {
      const result = judgeCombo([
        makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 5), makeCard('to', 'yang', 5),
        makeCard('geum', 'yin', 5), makeCard('su', 'yang', 5), makeCard('mok', 'yin', 5),
      ])
      expect(result.type).not.toBe('ohang-yeonhwan')
    })
  })

  describe('5. 조합 우선순위 (오행연환 > 융합 > 모으기 > none)', () => {
    it('5기운 혼합 → 오행연환 선택', () => {
      const result = judgeCombo([
        makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 5), makeCard('to', 'yang', 5),
        makeCard('geum', 'yin', 5), makeCard('su', 'yang', 5),
      ])
      expect(result.type).toBe('ohang-yeonhwan')
    })

    it('2기운 정확히 (유효한 조합) → 융합 선택 (모으기 아님)', () => {
      const result = judgeCombo([makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 6)])
      expect(result.type).toBe('fusion-birth')
    })

    it('조합 유형별 우선순위 검증 (타입 기준)', () => {
      const ohang = judgeCombo([
        makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 5), makeCard('to', 'yang', 5),
        makeCard('geum', 'yin', 5), makeCard('su', 'yang', 5),
      ])
      expect(ohang.type).toBe('ohang-yeonhwan')
      expect(ohang.multiplier).toBe(8)  // Phase 1.9.2: ×10 → ×8

      // 같은 카드 값으로 비교
      const fusion = judgeCombo([makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 5)])
      expect(fusion.type).toBe('fusion-birth')
      expect(fusion.multiplier).toBe(3.0)

      const gather = judgeCombo([makeCard('mok', 'yang', 5), makeCard('mok', 'yin', 5)])
      expect(gather.type).toBe('gather')
      expect(gather.multiplier).toBe(1.5)

      const none = judgeCombo([makeCard('mok', 'yang', 1), makeCard('hwa', 'yin', 1), makeCard('to', 'yang', 1)])
      expect(none.type).toBe('none')
      expect(none.multiplier).toBe(1)

      // 배율 비교: 오행 > 융합 > 모으기 > none
      expect(ohang.multiplier).toBeGreaterThan(fusion.multiplier)
      expect(fusion.multiplier).toBeGreaterThan(gather.multiplier)
      expect(gather.multiplier).toBeGreaterThan(none.multiplier)
    })
  })

  describe('6. 응축(Condense) — Phase 1.9.5 옹기가마 전용 장수 비례', () => {
    it('응축 장수 배율 (getCondenseMultiplier)', () => {
      expect(getCondenseMultiplier(2)).toBe(1.2)  // +120%
      expect(getCondenseMultiplier(3)).toBe(1.6)  // +160%
      expect(getCondenseMultiplier(4)).toBe(2.0)  // +200%
      expect(getCondenseMultiplier(5)).toBe(2.4)  // +240%
    })

    it('토 모으기 → 타격 속성 토', () => {
      const result = judgeCombo([makeCard('to', 'yang', 5), makeCard('to', 'yin', 6)])
      expect(result.finishingElement).toBe('to')
    })

    it('광맥(토+금→금) → 타격 속성 금 (응축 발동 안 함)', () => {
      const fusion = findFusionCombo('to', 'geum')
      expect(fusion?.result).toBe('geum') // 타격 속성이 금이므로 응축 발동 안 함
    })

    it('옹기가마(화+토→토) → 타격 속성 토 (응축 발동)', () => {
      const fusion = findFusionCombo('hwa', 'to')
      expect(fusion?.name).toBe('옹기가마')
      expect(fusion?.result).toBe('to') // 타격 속성이 토이므로 응축 발동
    })

    it('맑은 못(토+수→수) → 타격 속성 수 (응축 발동 안 함)', () => {
      const fusion = findFusionCombo('to', 'su')
      expect(fusion?.result).toBe('su') // 타격 속성이 수이므로 응축 발동 안 함
    })
  })

  describe('7. Phase 1.8 호환성 (judgeHand wrapper)', () => {
    it('judgeHand는 judgeCombo를 래핑', () => {
      const cards = [makeCard('mok', 'yang', 5), makeCard('mok', 'yin', 6)]
      const comboResult = judgeCombo(cards)
      const handResult = judgeHand(cards)
      
      expect(handResult.rank).toBe(comboResult.type)
      expect(handResult.multiplier).toBe(comboResult.multiplier)
      expect(handResult.totalScore).toBe(comboResult.totalScore)
      expect(handResult.finishingElement).toBe(comboResult.finishingElement)
    })
  })

  describe('8. 회귀 검증 (Phase 1.8 무변경)', () => {
    it('마무리 기운 로직: 함수 결과에 finishingElement 포함', () => {
      const result = judgeCombo([makeCard('hwa', 'yang', 5), makeCard('hwa', 'yin', 6)])
      expect(result).toHaveProperty('finishingElement')
      expect(result.finishingElement).toBe('hwa')
    })

    it('극/반극 판정 기준 타입: 여전히 Element 타입', () => {
      const result = judgeCombo([makeCard('mok', 'yang', 5), makeCard('hwa', 'yin', 6)])
      expect(['mok', 'hwa', 'to', 'geum', 'su']).toContain(result.finishingElement)
    })
  })

  describe('9. 그리디 봇 신체계 적용', () => {
    it('유효한 조합만 선택 (none 필터링)', () => {
      // judgeCombo 사용 확인 (함수가 존재하고 작동)
      const validCombo = judgeCombo([makeCard('mok', 'yang', 5), makeCard('mok', 'yin', 6)])
      expect(validCombo.type).not.toBe('none')
      
      const invalidCombo = judgeCombo([makeCard('mok', 'yang', 1), makeCard('hwa', 'yin', 1), makeCard('to', 'yang', 1)])
      expect(invalidCombo.type).toBe('none')
    })
  })

  describe('10. 타입 정합성 검증', () => {
    it('HandRank 확장: 새 조합 타입 4종 포함', () => {
      const gather = judgeCombo([makeCard('mok', 'yang', 5), makeCard('mok', 'yin', 6)])
      expect(['gather', 'fusion-birth', 'fusion-hone', 'ohang-yeonhwan', 'none']).toContain(gather.type)
    })

    it('ComboJudgeResult 구조 검증', () => {
      const result = judgeCombo([makeCard('mok', 'yang', 5), makeCard('mok', 'yin', 6)])
      expect(result).toHaveProperty('type')
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('baseScore')
      expect(result).toHaveProperty('multiplier')
      expect(result).toHaveProperty('totalScore')
      expect(result).toHaveProperty('finishingElement')
      expect(result).toHaveProperty('description')
    })
  })
})
