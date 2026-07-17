/**
 * E2E assert: v3/recipe 모드 HP 불변 확인
 *
 * 지시서: ZERA_PALJAJEON_V4_REBASELINE_DISPATCH_20260717.md §2-a
 * "v3r·recipe 무풍: v4 모드에서만 HP 스케일 적용. v3/recipe 모드 HP는 한 값도 변하면 안 됨"
 *
 * mock 없이 원본 balance.ts를 직접 import하여 v3 HP 원본값 고정 확인.
 * V4_HP_SCALE/V4_FLOOR_HP_TABLE은 additive 정의 — FLOOR_CONFIGS 원본 불변.
 */

import { describe, it, expect } from 'vitest'
import {
  FLOOR_CONFIGS,
  V4_HP_SCALE,
  V4_FLOOR_HP_TABLE,
  COMBO_RULESET_VERSION,
} from '../engine/balance'

// v3 기준 HP 원본값 (v9.0 — balance.ts 소스 고정값)
const V3_HP_BASELINE = {
  1: 220,
  2: 445,
  3: 680,
  4: 540,
}

describe('E2E assert: v3/recipe HP 불변 확인', () => {
  it('COMBO_RULESET_VERSION 기본값이 v3임을 확인 (mock 없는 환경)', () => {
    // 테스트 환경에서는 window 없음 → devSettings.getDevComboRuleset() → 'v3'
    expect(COMBO_RULESET_VERSION).toBe('v3')
    console.log(`[HP 불변] COMBO_RULESET_VERSION 기본값: ${COMBO_RULESET_VERSION} (v3 확인)`)
  })

  it('FLOOR_CONFIGS 원본 HP가 v3 기준값(v9.0) 그대로임을 assert', () => {
    // mock 없는 환경에서 FLOOR_CONFIGS는 v3 원본 그대로여야 한다
    expect(FLOOR_CONFIGS[0].floor).toBe(1)
    expect(FLOOR_CONFIGS[0].enemyHp).toBe(V3_HP_BASELINE[1])

    expect(FLOOR_CONFIGS[1].floor).toBe(2)
    expect(FLOOR_CONFIGS[1].enemyHp).toBe(V3_HP_BASELINE[2])

    expect(FLOOR_CONFIGS[2].floor).toBe(3)
    expect(FLOOR_CONFIGS[2].enemyHp).toBe(V3_HP_BASELINE[3])

    expect(FLOOR_CONFIGS[3].floor).toBe(4)
    expect(FLOOR_CONFIGS[3].enemyHp).toBe(V3_HP_BASELINE[4])

    console.log('[HP 불변] FLOOR_CONFIGS v3 HP 원본값 확인:')
    for (const cfg of FLOOR_CONFIGS) {
      console.log(`  ${cfg.floor}층: ${cfg.enemyHp} (v3 기준 ${V3_HP_BASELINE[cfg.floor as 1|2|3|4]}) — ${cfg.enemyHp === V3_HP_BASELINE[cfg.floor as 1|2|3|4] ? 'PASS' : 'FAIL'}`)
    }
  })

  it('V4_HP_SCALE과 V4_FLOOR_HP_TABLE이 additive 정의임을 확인', () => {
    // V4_HP_SCALE은 별도 상수 — FLOOR_CONFIGS를 직접 수정하지 않음
    expect(V4_HP_SCALE).toBeGreaterThan(1.0)
    expect(typeof V4_HP_SCALE).toBe('number')

    // V4_FLOOR_HP_TABLE이 존재하며 4층 모두 정의됨을 확인
    expect(V4_FLOOR_HP_TABLE[1]).toBeGreaterThan(V3_HP_BASELINE[1])
    expect(V4_FLOOR_HP_TABLE[2]).toBeGreaterThan(V3_HP_BASELINE[2])
    expect(V4_FLOOR_HP_TABLE[3]).toBeGreaterThan(V3_HP_BASELINE[3])
    expect(V4_FLOOR_HP_TABLE[4]).toBeGreaterThan(V3_HP_BASELINE[4])

    // V4_FLOOR_HP_TABLE이 FLOOR_CONFIGS와 다른 값임을 확인 (분리 보장)
    // (층별 차등이므로 V4_HP_SCALE × v3 값과 다를 수 있음)
    expect(V4_FLOOR_HP_TABLE[1]).not.toBe(FLOOR_CONFIGS[0].enemyHp)
    expect(V4_FLOOR_HP_TABLE[2]).not.toBe(FLOOR_CONFIGS[1].enemyHp)

    console.log(`[HP 불변] V4_HP_SCALE = ${V4_HP_SCALE} (균일 기준값, 참조용)`)
    console.log(`[HP 불변] V4_FLOOR_HP_TABLE = ${JSON.stringify(V4_FLOOR_HP_TABLE)}`)
    console.log(`[HP 불변] FLOOR_CONFIGS HP (v3 원본) = [${FLOOR_CONFIGS.map(c => c.enemyHp).join(', ')}]`)
    console.log('[HP 불변] V4_FLOOR_HP_TABLE과 FLOOR_CONFIGS 분리 확인 PASS — v3 HP 불변 보장')
  })
})
