/**
 * 배치 2 §2 왕·여왕 카드 E2E 테스트
 *
 * 3 assertions:
 *   1. 왕 승격 플래그: hasKingUpgrade 적용
 *   2. 여왕 증폭 플래그: hasQueenAmplify 적용
 *   3. 소지 상한 2장: 왕+여왕 합산 최대 2장 (덱 상한)
 */

import { describe, it, expect } from 'vitest'
import { judgeCombo } from '../engine/pokerHandJudge'
import { countRoyalCards, ROYAL_CARDS, createRoyalCard, ROYAL_DECK_CAP } from '../engine/balance'
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

describe('배치 2 §2 왕·여왕 카드 E2E', () => {
  it('E2E-1: 왕 승격 — step2 → step1 (정점 도달 불가, 레버 b)', () => {
    // 레버 (b) "왕은 정점을 못 산다" (이든 판정 2026-07-18):
    //   왕 포함 융합은 비율 한 계단 승격하되, 정점(×1.0) 도달 불가 — 최대 step1까지.
    //   step2 → step1 승격 ○ / step1 → step1 유지 (정점 미도달) — 아래 E2E-1b 참조.

    // 5장 step2 조합: mok 4장 + hwa 1장 (peak 2:3, 현재 4:1 → 촉매 과다 2계단)
    const withoutKing = [
      makeCard('mok', 'yang', 3),
      makeCard('mok', 'yang', 4),
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yang', 5),
    ]
    const resultWithout = judgeCombo(withoutKing)
    expect(resultWithout.type).toBe('fusion-birth')
    expect(resultWithout.hasKingUpgrade).toBe(false)

    // 왕 포함: 같은 step2 조합, 촉매(mok) 1장을 왕으로 → 한 계단 승격 (step2→step1)
    const withKing = [
      makeCard('mok', 'yang', 3),
      makeCard('mok', 'yang', 4, 'king'),  // 왕(양간)
      makeCard('mok', 'yang', 5),
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yang', 5),
    ]
    const resultWithKing = judgeCombo(withKing)
    expect(resultWithKing.type).toBe('fusion-birth')
    expect(resultWithKing.hasKingUpgrade).toBe(true)

    // 승격 결과: step2(×0.45) → step1(×0.70). 왕 포함이 더 높은 배율.
    expect(resultWithKing.multiplier).toBeGreaterThan(resultWithout.multiplier)

    // 정점 도달 불가 검증: 왕 포함이어도 정점(×1.0) 미도달 — isRatioPeak false
    expect(resultWithKing.isRatioPeak).toBe(false)
    // step1 배율 = tierMult(5.5) × 0.70 = 3.85 (정점 5.5가 아님)
    expect(resultWithKing.multiplier).toBeLessThan(resultWithout.multiplier * 2)
  })

  it('E2E-1b: 왕 정점 미도달 — step1 + 왕 → step1 유지', () => {
    // 레버 (b): step1은 왕이 있어도 승격 불가 (정점 도달 금지). 배율 불변.

    // 5장 step1 조합: mok 3장 + hwa 2장 (촉매 과다 1계단)
    const withoutKing = [
      makeCard('mok', 'yang', 3),
      makeCard('mok', 'yang', 4),
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yang', 5),
      makeCard('hwa', 'yang', 5),
    ]
    const resultWithout = judgeCombo(withoutKing)
    expect(resultWithout.type).toBe('fusion-birth')
    expect(resultWithout.hasKingUpgrade).toBe(false)

    // 왕 포함: 같은 step1 조합, 촉매(mok) 1장을 왕으로
    const withKing = [
      makeCard('mok', 'yang', 3),
      makeCard('mok', 'yang', 4, 'king'),  // 왕(양간)
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yang', 5),
      makeCard('hwa', 'yang', 5),
    ]
    const resultWithKing = judgeCombo(withKing)
    // step1 → step1 유지: 승격 없음 (정점 미도달)
    expect(resultWithKing.hasKingUpgrade).toBe(false)
    expect(resultWithKing.isRatioPeak).toBe(false)
    // 배율 불변 — 왕이 있어도 step1 그대로
    expect(resultWithKing.multiplier).toBe(resultWithout.multiplier)
  })

  it('E2E-2: 여왕 증폭 — 융합 효과량 ×1.5', () => {
    // 시나리오: 들불(목+화) 융합 — wildfire 효과 (번짐 — 피해의 30%)
    // 여왕 없음: baseHeal × synergyMultiplier
    // 여왕 포함: baseHeal × synergyMultiplier × 1.5

    // 이 테스트는 전투 시뮬에서만 효과가 발동하므로, judgeCombo에서는
    // hasQueenAmplify 플래그만 확인 (실제 효과 적용은 paljajeonEngine에서)

    const withoutQueen = [
      makeCard('mok', 'yang', 3),
      makeCard('mok', 'yang', 4),
      makeCard('hwa', 'yang', 5),
      makeCard('hwa', 'yang', 5),
      makeCard('hwa', 'yang', 5),
    ]
    const resultWithout = judgeCombo(withoutQueen)
    expect(resultWithout.hasQueenAmplify).toBe(false)  // 여왕 없음

    const withQueen = [
      makeCard('mok', 'yang', 3),
      makeCard('mok', 'yang', 4),
      makeCard('hwa', 'yang', 5, 'queen'),  // 여왕(음간)
      makeCard('hwa', 'yang', 5),
      makeCard('hwa', 'yang', 5),
    ]
    const resultWithQueen = judgeCombo(withQueen)
    // judgeCombo에서는 hasQueenAmplify 플래그 설정만 (실제 배율은 fusion trait에서)
    expect(resultWithQueen.hasQueenAmplify).toBe(true)
  })

  it('E2E-3: 소지 상한 2장 — 왕+여왕 합산 제약', () => {
    // countRoyalCards 함수 검증

    // 왕족 0장
    const noneRoyal = [
      makeCard('mok', 'yang', 5),
      makeCard('hwa', 'yang', 5),
    ]
    expect(countRoyalCards(noneRoyal)).toBe(0)

    // 왕 1장
    const oneKing = [
      makeCard('mok', 'yang', 5, 'king'),
      makeCard('hwa', 'yang', 5),
    ]
    expect(countRoyalCards(oneKing)).toBe(1)

    // 왕 1장 + 여왕 1장 = 합산 2장 (상한)
    const oneKingOneQueen = [
      makeCard('mok', 'yang', 5, 'king'),
      makeCard('hwa', 'yang', 5, 'queen'),
    ]
    expect(countRoyalCards(oneKingOneQueen)).toBe(2)
    expect(countRoyalCards(oneKingOneQueen)).toBe(ROYAL_DECK_CAP)

    // 왕 2장 = 합산 2장 (상한)
    const twoKings = [
      makeCard('mok', 'yang', 5, 'king'),
      makeCard('hwa', 'yang', 5, 'king'),
    ]
    expect(countRoyalCards(twoKings)).toBe(2)

    // 여왕 2장 = 합산 2장 (상한)
    const twoQueens = [
      makeCard('mok', 'yang', 5, 'queen'),
      makeCard('hwa', 'yang', 5, 'queen'),
    ]
    expect(countRoyalCards(twoQueens)).toBe(2)
  })

  it('E2E-4: 왕족 카드 데이터 구조', () => {
    // ROYAL_CARDS 정의 검증

    // 10종 (왕 5 + 여왕 5)
    expect(ROYAL_CARDS.length).toBe(10)

    // 왕 5종
    const kings = ROYAL_CARDS.filter(c => c.royalType === 'king')
    expect(kings.length).toBe(5)
    kings.forEach(k => {
      expect(k.polarity).toBe('yang')
      expect(['mok', 'hwa', 'to', 'geum', 'su']).toContain(k.element)
    })

    // 여왕 5종
    const queens = ROYAL_CARDS.filter(c => c.royalType === 'queen')
    expect(queens.length).toBe(5)
    queens.forEach(q => {
      expect(q.polarity).toBe('yin')
      expect(['mok', 'hwa', 'to', 'geum', 'su']).toContain(q.element)
    })

    // createRoyalCard 함수 검증
    const kingDef = ROYAL_CARDS[0]
    const kingCard = createRoyalCard(kingDef, 10, 'test-001')
    expect(kingCard.element).toBe(kingDef.element)
    expect(kingCard.polarity).toBe('yang')
    expect(kingCard.value).toBe(10)
    expect(kingCard.type).toBe('commander')
    expect(kingCard.rarity).toBe('epic')
    expect(kingCard.royalType).toBe('king')
  })
})
