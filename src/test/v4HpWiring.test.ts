/**
 * v4 HP 런타임 배선 단위 테스트 (2026-07-22 v4 정본 전환 재작성)
 *
 * 시대: v4 정식 전환 (devSettings 기본값 = 'v4', 강림 게이트 ON)
 * 대체: 이전 v3 기본 가정 테스트는 measurements/ 격리됨.
 *
 * 검증 항목 (v4 기준):
 *   1. getFloorHp — 기본(v4) 모드 시 V4_FLOOR_HP_TABLE 값 반환
 *   2. getFloorHp — versionOverride='v3' 시 FLOOR_CONFIGS.enemyHp 반환 (역방향 회귀 방지)
 *   3. createInitialGameState — 기본(v4) 모드 시 V4_FLOOR_HP_TABLE 값 적용
 *   4. V4_FLOOR_HP_TABLE — ×1.60 계수 확정값 회귀 방지 (352 / 712 / 1088 / 680)
 */

import { describe, it, expect } from 'vitest'

// ─── 테스트 1: getFloorHp — v4 기본 모드 ─────────────────────────────────────

describe('getFloorHp — v4 정본 (기본 모드)', () => {
  it('4개 층 전부 V4_FLOOR_HP_TABLE 값과 일치', async () => {
    const { getFloorHp, V4_FLOOR_HP_TABLE } = await import('../engine/balance')
    for (let i = 0; i < 4; i++) {
      const expected = V4_FLOOR_HP_TABLE[i + 1]
      const actual = getFloorHp(i)
      expect(actual).toBe(expected)
    }
  })

  it('층별 확정값: 352 / 712 / 1088 / 680 (×1.60 재기준선)', async () => {
    const { getFloorHp } = await import('../engine/balance')
    expect(getFloorHp(0)).toBe(352)   // 1층 = 220 × 1.60
    expect(getFloorHp(1)).toBe(712)   // 2층 = 445 × 1.60
    expect(getFloorHp(2)).toBe(1088)  // 3층 = 680 × 1.60
    expect(getFloorHp(3)).toBe(680)   // 4층 = 불변 (극상성 사망층)
  })
})

// ─── 테스트 2: getFloorHp — v3 오버라이드 역방향 회귀 방지 ─────────────────

describe('getFloorHp — v3 오버라이드 (측정용 하위 호환)', () => {
  it('versionOverride="v3" 시 FLOOR_CONFIGS.enemyHp 반환', async () => {
    const { getFloorHp, FLOOR_CONFIGS } = await import('../engine/balance')
    for (let i = 0; i < 4; i++) {
      const expected = FLOOR_CONFIGS[i].enemyHp
      const actual = getFloorHp(i, 'v3')
      expect(actual).toBe(expected)
    }
  })
})

// ─── 테스트 3: createInitialGameState — v4 기본 모드 HP 반영 ───────────────

describe('createInitialGameState — v4 정본 HP 반영', () => {
  it('1층 enemyHp = 352 (V4_FLOOR_HP_TABLE[1] = 220 × 1.60)', async () => {
    const { createInitialGameState } = await import('../engine/paljajeonEngine')
    const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')
    const state = createInitialGameState(0)
    expect(state.enemyHp).toBe(V4_FLOOR_HP_TABLE[1])
    expect(state.enemyMaxHp).toBe(V4_FLOOR_HP_TABLE[1])
    expect(state.enemyHp).toBe(352)
  })

  it('4층 enemyHp = 680 (V4_FLOOR_HP_TABLE[4] = 불변)', async () => {
    const { createInitialGameState } = await import('../engine/paljajeonEngine')
    const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')
    const state = createInitialGameState(3)
    expect(state.enemyHp).toBe(V4_FLOOR_HP_TABLE[4])
    expect(state.enemyMaxHp).toBe(V4_FLOOR_HP_TABLE[4])
    expect(state.enemyHp).toBe(680)
  })
})
