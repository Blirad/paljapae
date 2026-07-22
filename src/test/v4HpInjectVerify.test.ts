/**
 * v4 HP 런타임 배선 — v4 활성화 시 V4_FLOOR_HP_TABLE 적용 검증 (2026-07-17)
 *
 * versionOverride='v4' 파라미터를 사용하여 v4 HP 경로를 직접 검증.
 * (vi.mock은 balance.ts 내부 const 바인딩에 영향을 주지 못하므로 versionOverride 파라미터 활용)
 *
 * 검증 항목:
 *   - getFloorHp(i, 'v4') === V4_FLOOR_HP_TABLE[i+1] (모든 4개 층)
 *   - getFloorHp(i, 'v3') === FLOOR_CONFIGS[i].enemyHp (v3 불변)
 *   - v4 HP는 v3 HP(FLOOR_CONFIGS)와 다른 값임 (배선이 구분됨)
 */

import { describe, it, expect } from 'vitest'
import { getFloorHp, V4_FLOOR_HP_TABLE, FLOOR_CONFIGS } from '../engine/balance'

describe('v4 HP 배선 — getFloorHp versionOverride 검증', () => {
  describe('v4 모드 — V4_FLOOR_HP_TABLE 주입', () => {
    it('1층: getFloorHp(0, "v4") === V4_FLOOR_HP_TABLE[1] (352, ×1.60)', () => {
      expect(getFloorHp(0, 'v4')).toBe(V4_FLOOR_HP_TABLE[1])
      expect(getFloorHp(0, 'v4')).toBe(352)  // ×1.60 재기준선 (구 308=×1.35 → 363=×1.65 → 352=×1.60)
    })

    it('2층: getFloorHp(1, "v4") === V4_FLOOR_HP_TABLE[2] (712, ×1.60)', () => {
      expect(getFloorHp(1, 'v4')).toBe(V4_FLOOR_HP_TABLE[2])
      expect(getFloorHp(1, 'v4')).toBe(712)  // ×1.60 재기준선 (구 623 → 712)
    })

    it('3층: getFloorHp(2, "v4") === V4_FLOOR_HP_TABLE[3] (1088, ×1.60)', () => {
      expect(getFloorHp(2, 'v4')).toBe(V4_FLOOR_HP_TABLE[3])
      expect(getFloorHp(2, 'v4')).toBe(1088)  // ×1.60 재기준선 (구 952 → 1088)
    })

    it('4층: getFloorHp(3, "v4") === V4_FLOOR_HP_TABLE[4] (680)', () => {
      expect(getFloorHp(3, 'v4')).toBe(V4_FLOOR_HP_TABLE[4])
      expect(getFloorHp(3, 'v4')).toBe(680)
    })
  })

  describe('v3 모드 — FLOOR_CONFIGS.enemyHp 불변', () => {
    it('1층: getFloorHp(0, "v3") === FLOOR_CONFIGS[0].enemyHp (220)', () => {
      expect(getFloorHp(0, 'v3')).toBe(FLOOR_CONFIGS[0].enemyHp)
      expect(getFloorHp(0, 'v3')).toBe(220)
    })

    it('4층: getFloorHp(3, "v3") === FLOOR_CONFIGS[3].enemyHp (540)', () => {
      expect(getFloorHp(3, 'v3')).toBe(FLOOR_CONFIGS[3].enemyHp)
      expect(getFloorHp(3, 'v3')).toBe(540)
    })
  })

  describe('v4 vs v3 분리 보장', () => {
    it('1층: v4(308) !== v3(220)', () => {
      expect(getFloorHp(0, 'v4')).not.toBe(getFloorHp(0, 'v3'))
    })

    it('4층: v4(680) !== v3(540)', () => {
      expect(getFloorHp(3, 'v4')).not.toBe(getFloorHp(3, 'v3'))
    })
  })
})
