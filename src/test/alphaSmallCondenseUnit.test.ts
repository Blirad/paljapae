/**
 * α 소응축 단위 테스트 — fusion_kiln ID 수정 검증
 * 토단일 손패에서 [화1, 토2] 3장 → 소응축(소형 fusion_kiln) 성립 assert
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

const { detectRecipe, judgeCombo } = await import('../engine/pokerHandJudge')
import type { Card } from '../types/game'

describe('α 소응축 단위 테스트', () => {
  it('토단일 손패 [화1, 토2] 3장 → fusion_kiln 성립', () => {
    const hand: Card[] = [
      { id: 'c1', element: 'hwa', value: 5, polarity: 'yang' },
      { id: 'c2', element: 'to', value: 4, polarity: 'yin' },
      { id: 'c3', element: 'to', value: 3, polarity: 'yang' },
    ]

    const recipeId = detectRecipe(hand)
    expect(recipeId).toBe('fusion_kiln')  // 이 테스트가 붉으면 원인 확정

    const result = judgeCombo(hand)
    expect(result.type).not.toBe('none')
    expect(result.name).toBe('fusion_kiln')  // 소응축 성립
  })

  it('α 카운터 — fusion_kiln 발동 시 toDanilAlphaLog.attempts 증가', () => {
    ;(globalThis as any).__toDanilAlphaLog = { attempts: 0, successes: 0 }

    const hand: Card[] = [
      { id: 'c1', element: 'hwa', value: 5, polarity: 'yang' },
      { id: 'c2', element: 'to', value: 4, polarity: 'yin' },
      { id: 'c3', element: 'to', value: 3, polarity: 'yang' },
    ]

    judgeCombo(hand)

    const log = (globalThis as any).__toDanilAlphaLog
    expect(log.attempts).toBeGreaterThan(0)  // α 카운터 작동 확인
  })
})
