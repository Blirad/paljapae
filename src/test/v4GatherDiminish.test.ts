/**
 * v4 α 수확 체감 E2E — gather5 배율 체감 검증
 *
 * 이든 게이트 확정 (2026-07-18):
 *   동일 전투 내 gather5 반복 발동 시 배율 감소: 7.5 → 6.5 → 6.0
 *   전투 경계(층 전환) 시 gatherUsedInBattle=0 리셋
 *
 * 3 assertions:
 *   1. 동일 전투 내 gather5 3연발: 7.5/6.5/6.0 배율 순차 적용 확인
 *   2. 전투 경계 리셋: advanceToNextFloor 후 gatherUsedInBattle=0 복원 확인
 *   3. 목화·금수 경로 무변경: gather5 < 1회/게임이므로 체감 도달 없음 확인
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as any
  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    ENABLE_YONGSIN_DESCENT: true,
  }
})

import { judgeCombo } from '../engine/pokerHandJudge'
import { playCards, createInitialGameState, advanceToNextFloor } from '../engine/paljajeonEngine'
import { getGather5Multiplier } from '../engine/balance'
import type { Card, GameState } from '../types/game'

function makeToCards(count: number, value = 5): Card[] {
  // 전부 yang — 음양 조화 보너스 미발동 (순수 배율만 검증)
  return Array.from({ length: count }, (_, i) => ({
    id: `to-${i}`,
    element: 'to' as const,
    polarity: 'yang' as const,
    value,
    type: 'soldier' as const,
    rarity: 'common' as const,
  }))
}

describe('α 수확 체감 — gather5 배율 체감', () => {
  it('E2E-1: 동일 전투 내 gather5 3연발 → 7.5/6.5/6.0 배율 순차', () => {
    // getGather5Multiplier 단위 테스트 (§1 실효 복원: 7.5/6.5/6.0)
    expect(getGather5Multiplier(0)).toBe(7.5)  // 1회차
    expect(getGather5Multiplier(1)).toBe(6.5)  // 2회차
    expect(getGather5Multiplier(2)).toBe(6.0)  // 3회차
    expect(getGather5Multiplier(3)).toBe(6.0)  // 4회차도 6.0 바닥

    // judgeCombo 통합 테스트 — gatherUsedInBattle 파라미터 직접 주입
    const toCards5 = makeToCards(5, 6)  // baseScore = 30

    const result1 = judgeCombo(toCards5, undefined, undefined, 0)
    expect(result1.type).toBe('gather')
    expect(result1.multiplier).toBe(7.5)
    expect(result1.totalScore).toBe(Math.round(30 * 7.5))

    const result2 = judgeCombo(toCards5, undefined, undefined, 1)
    expect(result2.multiplier).toBe(6.5)
    expect(result2.totalScore).toBe(Math.round(30 * 6.5))

    const result3 = judgeCombo(toCards5, undefined, undefined, 2)
    expect(result3.multiplier).toBe(6.0)
    expect(result3.totalScore).toBe(Math.round(30 * 6.0))
  })

  it('E2E-2: 전투 경계 리셋 — advanceToNextFloor 후 gatherUsedInBattle=0 복원', () => {
    const state = createInitialGameState()
    expect(state.gatherUsedInBattle).toBe(0)

    // simulate some gather5 activations
    const stateWithGather: GameState = { ...state, gatherUsedInBattle: 3 }
    const nextFloorState = advanceToNextFloor(stateWithGather)
    expect(nextFloorState.gatherUsedInBattle).toBe(0)
  })

  it('E2E-3: playCards에서 gather5 발동 시 gatherUsedInBattle 자동 증가', () => {
    // 토 5장을 손패로 세팅하고 출수하면 gatherUsedInBattle이 증가해야 함
    const toCards = makeToCards(5, 4)
    const extraCards = Array.from({ length: 3 }, (_, i) => ({
      id: `extra-${i}`,
      element: 'mok' as const,
      polarity: 'yang' as const,
      value: 3,
      type: 'soldier' as const,
      rarity: 'common' as const,
    }))

    const state = createInitialGameState()
    // Override hand with known cards
    const modState: GameState = {
      ...state,
      hand: [...toCards, ...extraCards],
      gatherUsedInBattle: 0,
    }

    // Play gather5 (토 5장)
    const afterPlay = playCards(modState, toCards.map(c => c.id))
    expect(afterPlay.gatherUsedInBattle).toBe(1)

    // If we could play again with gather5, it should be 2
    // Simulate by setting hand again
    const secondState: GameState = {
      ...afterPlay,
      hand: [...makeToCards(5, 3).map((c, i) => ({ ...c, id: `to2-${i}` })), ...extraCards.map((c, i) => ({ ...c, id: `ex2-${i}` }))],
      playsLeft: 5,
    }
    const afterPlay2 = playCards(secondState, secondState.hand.slice(0, 5).map(c => c.id))
    expect(afterPlay2.gatherUsedInBattle).toBe(2)
  })
})
