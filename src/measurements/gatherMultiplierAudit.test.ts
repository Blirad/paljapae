// ============================================================
// [시대물 격리] 2026-07-22 (v4 정본 전환)
// 시대: v3 시대 가정 (기본모드=v3 전제)
// 대체: v4 정식 전환 (devSettings v4+강림 ON)
// 이유: LEDGER 마감된 v4 전환으로 이 가정은 무효화됨
// ============================================================
/**
 * T20 gather5 필살기 계층 — E2E 지문 (E2E-1: v3 모드)
 *
 * v3 모드에서 GATHER_MULTIPLIERS[5]=5.0 동결 확인.
 * recipe 모드 assert는 t20RecipeGather.test.ts 참조.
 */

import { describe, it, expect } from 'vitest'
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

describe.skip('T20 E2E 지문 — [E2E-1] v3 모드 gather5=×5.0 동결', () => {
  it('v3 모드, 토5장: GATHER_MULTIPLIERS[5]=5.0 유지 (T20 구현 후에도 동결)', () => {
    // v3 모드 (balance.ts 기본값 COMBO_RULESET_VERSION='v3')
    const cards = makeToCards(5)
    const result = judgeCombo(cards)

    console.log('\n=== [E2E-1] v3 모드 gather5 ===')
    console.log(`  GATHER_MULTIPLIERS[5] = ${GATHER_MULTIPLIERS[5]}`)
    console.log(`  RECIPE_GATHER5_MULT_A = ${RECIPE_GATHER5_MULT_A}`)
    console.log(`  judgeCombo 결과: rank=${result.type}, multiplier=×${result.multiplier}`)
    console.log('  판정: GATHER_MULTIPLIERS[5]=5.0 동결 PASS (recipe 모드 오염 없음)')

    expect(result.type).toBe('gather')
    // v3 모드에서는 GATHER_MULTIPLIERS[5]=5.0 유지
    expect(result.multiplier).toBe(5.0)
    // 상수 값 직접 확인
    expect(GATHER_MULTIPLIERS[5]).toBe(5.0)
    // recipe 상수 정의 확인
    expect(RECIPE_GATHER5_MULT_A).toBe(6.5)
  })

  it('GATHER_MULTIPLIERS 전체 테이블 동결 확인', () => {
    console.log('\n=== GATHER_MULTIPLIERS 동결 상태 (v3 동결값) ===')
    console.log(`  2장: ×${GATHER_MULTIPLIERS[2]}`)
    console.log(`  3장: ×${GATHER_MULTIPLIERS[3]}`)
    console.log(`  4장: ×${GATHER_MULTIPLIERS[4]}`)
    console.log(`  5장: ×${GATHER_MULTIPLIERS[5]} (v3 동결 — recipe 모드는 별도 override)`)

    expect(GATHER_MULTIPLIERS[2]).toBe(1.3)
    expect(GATHER_MULTIPLIERS[3]).toBe(2.5)
    expect(GATHER_MULTIPLIERS[4]).toBe(4.0)
    expect(GATHER_MULTIPLIERS[5]).toBe(5.0)
  })
})
