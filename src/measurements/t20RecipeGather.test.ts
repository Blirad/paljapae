// ============================================================
// [시대물 격리] 2026-07-22 (v4 정본 전환)
// 시대: v3 시대 가정 (기본모드=v3 전제)
// 대체: v4 정식 전환 (devSettings v4+강림 ON)
// 이유: LEDGER 마감된 v4 전환으로 이 가정은 무효화됨
// ============================================================
/**
 * T20 gather5 필살기 계층 — E2E 지문 (E2E-2: recipe 모드)
 *
 * recipe 모드에서 gather5 = ×6.5 (RECIPE_GATHER5_MULT_A) override 확인.
 * v3 모드 assert는 gatherMultiplierAudit.test.ts 참조.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

import { GATHER_MULTIPLIERS, RECIPE_GATHER5_MULT_A } from '../engine/balance'
import { judgeCombo } from '../engine/pokerHandJudge'
import type { Card } from '../types/game'

// 토 카드 N장 생성 헬퍼
function makeToCards(count: number): Card[] {
  const cards: Card[] = []
  for (let i = 0; i < count; i++) {
    cards.push({
      id: `to-${i}`,
      element: 'to',
      polarity: i % 2 === 0 ? 'yin' : 'yang',
      value: 5,
      type: 'soldier',
      rarity: 'common',
    })
  }
  return cards
}

describe.skip('T20 E2E 지문 — [E2E-2] recipe 모드 gather5=×6.5 override', () => {
  it('recipe 모드, 토5장: gather5 배율 = ×6.5 (RECIPE_GATHER5_MULT_A override)', () => {
    const cards = makeToCards(5)
    const result = judgeCombo(cards)

    console.log('\n=== [E2E-2] recipe 모드 gather5 ===')
    console.log(`  RECIPE_GATHER5_MULT_A = ${RECIPE_GATHER5_MULT_A}`)
    console.log(`  GATHER_MULTIPLIERS[5] = ${GATHER_MULTIPLIERS[5]} (v3 동결값 — 오염 없음)`)
    console.log(`  judgeCombo 결과: rank=${result.type}, multiplier=×${result.multiplier}`)
    console.log('  판정: recipe 모드 gather5=6.5 override PASS')

    expect(result.type).toBe('gather')
    // recipe 모드에서는 RECIPE_GATHER5_MULT_A=6.5 override
    expect(result.multiplier).toBe(6.5)
    // GATHER_MULTIPLIERS[5] 동결 확인 (recipe override와 별개)
    expect(GATHER_MULTIPLIERS[5]).toBe(5.0)
  })

  it('recipe 모드, 토2/3/4장: 기존 배율 유지 (gather5만 override)', () => {
    const cards3 = makeToCards(3)
    const cards4 = makeToCards(4)

    const result3 = judgeCombo(cards3)
    const result4 = judgeCombo(cards4)

    console.log('\n=== recipe 모드 gather 2/3/4장 배율 (override 없음) ===')
    console.log(`  3장: ×${result3.multiplier} (기대: ×2.5)`)
    console.log(`  4장: ×${result4.multiplier} (기대: ×4.0)`)

    expect(result3.multiplier).toBe(2.5)
    expect(result4.multiplier).toBe(4.0)
  })
})
