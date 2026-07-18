/**
 * 배치 최종 재측정 — 간단 디버그 (로깅 확인)
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
  },
]

const RUNS = 10  // 간단히 10회만 테스트

describe('배치 최종 재측정 — 로깅 디버그', () => {
  it('recipe logging accumulation', { timeout: 60000 }, () => {
    for (const preset of PRESETS) {
      const talismans = selectTalismanBySaju(preset.dist)
      const favorableElement = getFavorableElement(preset.ilgan)

      // Initialize logs for this preset
      ;(globalThis as any).__recipeLog = []
      ;(globalThis as any).__toDanilAlphaLog = undefined

      console.log(`\n[${preset.label}] Starting 10 runs...`)

      for (let i = 0; i < RUNS; i++) {
        const result = simulateFullCapRun(i * 12345 + 7777, {
          elementDist: preset.dist,
          favorableElement,
          enableFloorReward: true,
          activePassiveIds: talismans,
          enableEffectMode: true,
        })
      }

      const recipeLog = (globalThis as any).__recipeLog || []
      console.log(`[${preset.label}] Total recipe logs: ${recipeLog.length}`)

      if (recipeLog.length > 0) {
        const uniqueRecipes: Record<string, number> = {}
        for (const { recipeId } of recipeLog) {
          uniqueRecipes[recipeId] = (uniqueRecipes[recipeId] || 0) + 1
        }
        console.log(`[${preset.label}] Unique recipes: ${Object.keys(uniqueRecipes).length}`)
        for (const [recipeId, count] of Object.entries(uniqueRecipes)) {
          console.log(`  - ${recipeId}: ${count}`)
        }
      }
    }

    expect(true).toBe(true)
  })
})
