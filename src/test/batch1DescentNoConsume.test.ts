/**
 * 배치 1.5: 강림제 소진제 금지 검증
 * - slotIndices는 고정 (사전결정)
 * - usedCount는 추적용 (유저 조작 불가)
 * - 1회 이월 처리 (pendingDescent)
 * - 소멸 처리 (pendingDescent 리셋)
 */

import { describe, it, expect, vi } from 'vitest'
import type { GameState } from '../types/game'

// ENABLE_YONGSIN_DESCENT를 true로 mock (테스트 환경에서만)
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), ENABLE_YONGSIN_DESCENT: true }
})

const { applyYongsinDescent } = await import('../engine/paljajeonEngine')

describe('배치 1.5: 강림제 소진제 금지 (슬롯 고정)', () => {
  const baseDescent: GameState['yongsinDescent'] = {
    descentCount: 2,
    slots: [3, 8, 14],  // 슬롯: 3턴, 8턴, 14턴
    usedCount: 0,
    pendingDescent: false,
  }

  it('강림 슬롯 고정: 매번 동일 턴에서만 발동', () => {
    const descent = { ...baseDescent }

    // 3턴에서 강림 발동
    const result3 = applyYongsinDescent(100, true, 3, descent)
    expect(result3.descended).toBe(true)
    expect(result3.updatedState.usedCount).toBe(1)

    // 4턴에서는 발동 안 됨 (슬롯 아님)
    const descent4 = { ...descent, usedCount: 1, pendingDescent: false }
    const result4 = applyYongsinDescent(100, true, 4, descent4)
    expect(result4.descended).toBe(false)

    // 8턴에서 강림 발동 (다음 슬롯)
    const result8 = applyYongsinDescent(100, true, 8, result4.updatedState)
    expect(result8.descended).toBe(true)
    expect(result8.updatedState.usedCount).toBe(2)
  })

  it('소진제 금지: usedCount는 추적만, 플레이어가 발동 횟수 조작 불가', () => {
    const descent = { ...baseDescent }

    // slotIndices는 [3, 8, 14]로 고정
    // 플레이어는 3턴, 8턴, 14턴에서만 강림 가능 (조작 불가)

    // 임의의 턴(예: 5턴)에서 강림 발동 시도
    const result5 = applyYongsinDescent(100, true, 5, descent)
    expect(result5.descended).toBe(false)  // 슬롯이 아니면 발동 불가

    // 반복해도 5턴에서는 절대 발동 안 됨
    const result5_2 = applyYongsinDescent(100, true, 5, descent)
    expect(result5_2.descended).toBe(false)
  })

  it('1회 이월: 강림 슬롯에서 용신 없으면 다음 회차에 이월', () => {
    const descent = { ...baseDescent }

    // 3턴 (강림 슬롯)에서 용신 없음
    const result3 = applyYongsinDescent(100, false, 3, descent)
    expect(result3.descended).toBe(false)
    expect(result3.updatedState.pendingDescent).toBe(true)  // 1회 이월

    // 4턴 (비강림 슬롯, pendingDescent 여전)
    const result4 = applyYongsinDescent(100, false, 4, result3.updatedState)
    expect(result4.descended).toBe(false)
    expect(result4.updatedState.pendingDescent).toBe(true)  // 이월 유지

    // 8턴 (다음 강림 슬롯)에서 용신 없음 → 소멸
    const result8 = applyYongsinDescent(100, false, 8, result4.updatedState)
    expect(result8.descended).toBe(false)
    expect(result8.updatedState.pendingDescent).toBe(false)  // 소멸 (2회째 미발동)
  })

  it('1회 이월 후 용신 포함 → 강림 발동 (배율 ×2.0)', () => {
    const descent = { ...baseDescent, pendingDescent: true }

    // 8턴 (강림 슬롯, 이미 1회 이월됨)에서 용신 포함
    const result8 = applyYongsinDescent(100, true, 8, descent)
    expect(result8.descended).toBe(true)
    expect(result8.damage).toBe(200)  // 100 × 2.0 = 200
    expect(result8.updatedState.pendingDescent).toBe(false)  // 이월 해제
    expect(result8.updatedState.usedCount).toBe(1)
  })

  it('배율 검증: ×2.0 정확성', () => {
    const descent = { ...baseDescent }

    // 기본 데미지 150
    const result = applyYongsinDescent(150, true, 3, descent)
    expect(result.descended).toBe(true)
    expect(result.damage).toBe(300)  // 150 × 2.0 = 300

    // 다른 데미지 값
    const result2 = applyYongsinDescent(333, true, 3, descent)
    expect(result2.damage).toBe(666)  // 333 × 2.0 = 666
  })

  it('null 또는 undefined descentState 처리', () => {
    // descentState가 없으면 기본값 반환
    const result = applyYongsinDescent(100, true, 3, undefined)
    expect(result.descended).toBe(false)
    expect(result.damage).toBe(100)  // 배율 미적용
    expect(result.updatedState).toBeUndefined()
  })

  it('2~3회 강림 범위 내 슬롯 모두 정확히 발동', () => {
    const descent3slot = {
      descentCount: 3,
      slots: [2, 7, 15],
      usedCount: 0,
      pendingDescent: false,
    } as GameState['yongsinDescent']

    // 각 슬롯에서 정확히 1회씩 발동
    let currentDescent = descent3slot
    for (const slotTurn of [2, 7, 15]) {
      const result = applyYongsinDescent(100, true, slotTurn, currentDescent)
      expect(result.descended).toBe(true)
      expect(result.updatedState.usedCount).toBe(currentDescent.usedCount + 1)
      currentDescent = result.updatedState
    }

    // 최종적으로 usedCount = 3 (3회 강림 완료)
    expect(currentDescent.usedCount).toBe(3)
  })
})
