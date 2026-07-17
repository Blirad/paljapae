/**
 * G3 v4 §3 황금비 곡선 단위 테스트
 *
 * 옹기가마 수용 전표 10쌍 전부 검증 (촉=화/연=토 기준)
 * 화4+토1=×3.85 필수 PASS (DoD 지문)
 *
 * 정본: SPEC_combo_v4.md §3
 * 지시서: ZERA_PALJAJEON_G3_V4_FULL_DISPATCH_20260717.md
 */

import { describe, it, expect } from 'vitest'
import { getV4RatioCorrection, getV4RatioCorrectionSteps, V4_TIER_MULTIPLIERS } from '../engine/balance'

// 최종 배율 계산 헬퍼
function finalMult(cat: number, fuel: number): number {
  const N = cat + fuel
  const tier = V4_TIER_MULTIPLIERS[N] ?? 1.0
  const correction = getV4RatioCorrection(cat, fuel, N)
  // 소수점 2자리 반올림 (전표 기준)
  return Math.round(tier * correction * 100) / 100
}

describe('G3 v4 §3 황금비 곡선 — 옹기가마 수용 전표 10쌍 검증 (촉=화/연=토)', () => {
  it('화1토1 (2장) = ×1.50 — 2장 보정 면제', () => {
    expect(finalMult(1, 1)).toBeCloseTo(1.50, 2)
  })

  it('화1토2 (3장 정점) = ×3.00', () => {
    expect(finalMult(1, 2)).toBeCloseTo(3.00, 2)
  })

  it('화2토1 (3장 촉매과다) = ×2.55', () => {
    expect(finalMult(2, 1)).toBeCloseTo(2.55, 2)
  })

  it('화1토3 (4장 연료과다, 이탈1) = ×3.40', () => {
    expect(finalMult(1, 3)).toBeCloseTo(3.40, 2)
  })

  it('화2토2 (4장 정점) = ×4.00', () => {
    expect(finalMult(2, 2)).toBeCloseTo(4.00, 2)
  })

  it('화3토1 (4장 촉매과다, 이탈2) = ×2.80', () => {
    expect(finalMult(3, 1)).toBeCloseTo(2.80, 2)
  })

  it('화1토4 (5장 연료과다, 이탈2) = ×3.85', () => {
    expect(finalMult(1, 4)).toBeCloseTo(3.85, 2)
  })

  it('화2토3 (5장 정점) = ×5.50', () => {
    expect(finalMult(2, 3)).toBeCloseTo(5.50, 2)
  })

  it('화3토2 (5장 촉매과다, 이탈1) = ×4.68', () => {
    // 5.5 × 0.85 = 4.675 → 반올림 4.68
    expect(finalMult(3, 2)).toBeCloseTo(4.68, 2)
  })

  it('화4토1 (5장 촉매과다, 이탈2) = ×3.85 — DoD 필수 지문', () => {
    expect(finalMult(4, 1)).toBeCloseTo(3.85, 2)
  })
})

describe('G3 v4 §3 — 이탈 계단 단위 검증', () => {
  it('2장: 항상 0계단 (면제)', () => {
    expect(getV4RatioCorrectionSteps(1, 1, 2)).toBe(0)
  })

  it('3장 정점(cat1,fuel2): 0계단', () => {
    expect(getV4RatioCorrectionSteps(1, 2, 3)).toBe(0)
  })

  it('3장 촉매과다(cat2,fuel1): 1계단', () => {
    expect(getV4RatioCorrectionSteps(2, 1, 3)).toBe(1)
  })

  it('4장 정점(cat2,fuel2): 0계단', () => {
    expect(getV4RatioCorrectionSteps(2, 2, 4)).toBe(0)
  })

  it('4장 연료과다(cat1,fuel3): 1계단', () => {
    expect(getV4RatioCorrectionSteps(1, 3, 4)).toBe(1)
  })

  it('4장 촉매과다(cat3,fuel1): 2계단 — 균등정점 비대칭', () => {
    expect(getV4RatioCorrectionSteps(3, 1, 4)).toBe(2)
  })

  it('5장 정점(cat2,fuel3): 0계단', () => {
    expect(getV4RatioCorrectionSteps(2, 3, 5)).toBe(0)
  })

  it('5장 연료과다(cat1,fuel4): 2계단', () => {
    expect(getV4RatioCorrectionSteps(1, 4, 5)).toBe(2)
  })

  it('5장 촉매과다(cat3,fuel2): 1계단', () => {
    expect(getV4RatioCorrectionSteps(3, 2, 5)).toBe(1)
  })

  it('5장 촉매과다(cat4,fuel1): 2계단', () => {
    expect(getV4RatioCorrectionSteps(4, 1, 5)).toBe(2)
  })
})

describe('G3 v4 §3 — 비율 보정계수 직접 검증', () => {
  it('정점은 항상 ×1.0', () => {
    expect(getV4RatioCorrection(1, 2, 3)).toBe(1.0)
    expect(getV4RatioCorrection(2, 2, 4)).toBe(1.0)
    expect(getV4RatioCorrection(2, 3, 5)).toBe(1.0)
  })

  it('한 계단 이탈은 ×0.85', () => {
    expect(getV4RatioCorrection(2, 1, 3)).toBe(0.85)
    expect(getV4RatioCorrection(1, 3, 4)).toBe(0.85)
    expect(getV4RatioCorrection(3, 2, 5)).toBe(0.85)
  })

  it('두 계단 이탈(바닥)은 ×0.70', () => {
    expect(getV4RatioCorrection(3, 1, 4)).toBe(0.7)
    expect(getV4RatioCorrection(1, 4, 5)).toBe(0.7)
    expect(getV4RatioCorrection(4, 1, 5)).toBe(0.7)
  })
})
