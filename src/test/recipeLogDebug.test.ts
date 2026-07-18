/**
 * Recipe logging debug — 1회 실행으로 로깅 확인
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

describe('Recipe logging debug', () => {
  it('single run - check if __recipeLog is populated', () => {
    ;(globalThis as any).__recipeLog = []
    ;(globalThis as any).__toDanilAlphaLog = undefined

    const dist = { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>
    const talismans = selectTalismanBySaju(dist)
    const favorableElement = getFavorableElement('geum' as Element)

    console.log('Starting single run...')
    const result = simulateFullCapRun(12345, {
      elementDist: dist,
      favorableElement,
      enableFloorReward: true,
      activePassiveIds: talismans,
      enableEffectMode: true,
    })

    console.log('Game result:', result.victory ? 'VICTORY' : 'DEFEAT')
    console.log('descentActivated:', result.descentActivated)
    console.log('descentSlotsArrived:', result.descentSlotsArrived)

    const recipeLog = (globalThis as any).__recipeLog || []
    console.log('Recipe log entries:', recipeLog.length)
    if (recipeLog.length > 0) {
      console.log('Sample recipes:', recipeLog.slice(0, 5))
    }

    const alphaLog = (globalThis as any).__toDanilAlphaLog
    console.log('Alpha log:', alphaLog)

    expect(recipeLog.length).toBeGreaterThan(0)
  })
})
