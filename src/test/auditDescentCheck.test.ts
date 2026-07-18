import { vi, describe, it, expect } from 'vitest'

vi.mock('../engine/devSettings', () => ({
  getDevComboRuleset: () => 'v4',
  getDevDescentEnabled: () => true,
}))

import { ENABLE_YONGSIN_DESCENT, COMBO_RULESET_VERSION, getFloorHp } from '../engine/balance'

describe('감사 a — 강림 실효값', () => {
  it('ENABLE_YONGSIN_DESCENT 실효값 확인', () => {
    console.log('ENABLE_YONGSIN_DESCENT:', ENABLE_YONGSIN_DESCENT)
    console.log('COMBO_RULESET_VERSION:', COMBO_RULESET_VERSION)
    console.log('getFloorHp(0~3):', [0,1,2,3].map(i => getFloorHp(i)))
    expect(ENABLE_YONGSIN_DESCENT).toBe(true)
    expect(COMBO_RULESET_VERSION).toBe('v4')
  })
})
