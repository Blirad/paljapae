/**
 * Mock verification — COMBO_RULESET_VERSION check
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

const { COMBO_RULESET_VERSION } = await import('../engine/balance')

describe('Mock verification', () => {
  it('COMBO_RULESET_VERSION should be recipe', () => {
    console.log('COMBO_RULESET_VERSION:', COMBO_RULESET_VERSION)
    expect(COMBO_RULESET_VERSION).toBe('recipe')
  })
})
