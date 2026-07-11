/**
 * T1: 응축 곱셈형 가중 — 화/토 매트릭스 유닛 테스트
 *
 * 테스트 대상: CONDENSE_MATRIX, getCondenseBonus()
 * 검증 항목: 3가지 앵커 성질 (값 하드코드 아님, 성질 기반)
 */

import { describe, it, expect } from 'vitest'
import { CONDENSE_MATRIX, getCondenseBonus } from '../engine/balance'

describe('T1 응축 매트릭스 — 앵커 성질 검증', () => {
  // ─────────────────────────────────────────────────────────────────
  // 성질 ①: 화2토3(240%) = 전체 유일 최대
  // ─────────────────────────────────────────────────────────────────
  it('성질①: 화2토3이 전체 유일 최대 (240%)', () => {
    const allBonuses = getAllCondenseValues()
    const maxBonus = Math.max(...allBonuses)
    const maxEntries = allBonuses.filter(b => b === maxBonus)

    // 최대값이 정확히 1개
    expect(maxEntries.length).toBe(1)
    expect(maxBonus).toBe(240)

    // 최대값이 화2토3에서만 나옴
    const bonus240 = getCondenseBonus(2, 3)
    expect(bonus240).toBe(240)
  })

  // ─────────────────────────────────────────────────────────────────
  // 성질 ②: 같은 장수에서 토 우세 > 화 우세
  // 예: 화1토2(150) > 화2토1(135), 화1토3(185) > 화3토1(145), ...
  // ─────────────────────────────────────────────────────────────────
  it('성질②: 같은 총 카드 수에서 토 우세 > 화 우세', () => {
    // 총 3장: 화1토2(150) > 화2토1(135)
    expect(getCondenseBonus(1, 2)).toBeGreaterThan(getCondenseBonus(2, 1))

    // 총 4장: 화1토3(185) > 화3토1(145)
    expect(getCondenseBonus(1, 3)).toBeGreaterThan(getCondenseBonus(3, 1))

    // 총 5장: 화1토4(215) > 화4토1(155)
    expect(getCondenseBonus(1, 4)).toBeGreaterThan(getCondenseBonus(4, 1))

    // 추가: 화2토2(175) > 화3토1(145)
    expect(getCondenseBonus(2, 2)).toBeGreaterThan(getCondenseBonus(3, 1))
  })

  // ─────────────────────────────────────────────────────────────────
  // 성질 ③: 화 몰빵 페널티 — 같은 화 수에서 토가 섞일수록 보너스 높음
  // 예: 화4토1(155) < 화2토2(175)
  // ─────────────────────────────────────────────────────────────────
  it('성질③: 화 몰빵 페널티 — 토 혼합이 높을수록 보너스 증가', () => {
    // 화4토1(155) < 화2토2(175)
    expect(getCondenseBonus(4, 1)).toBeLessThan(getCondenseBonus(2, 2))

    // 화1토1(120) < 화1토2(150) < 화1토3(185) < 화1토4(215)
    expect(getCondenseBonus(1, 1)).toBeLessThan(getCondenseBonus(1, 2))
    expect(getCondenseBonus(1, 2)).toBeLessThan(getCondenseBonus(1, 3))
    expect(getCondenseBonus(1, 3)).toBeLessThan(getCondenseBonus(1, 4))

    // 화2토1(135) < 화2토2(175) < 화2토3(240)
    expect(getCondenseBonus(2, 1)).toBeLessThan(getCondenseBonus(2, 2))
    expect(getCondenseBonus(2, 2)).toBeLessThan(getCondenseBonus(2, 3))
  })

  // ─────────────────────────────────────────────────────────────────
  // 추가 검증: 경계값 처리
  // ─────────────────────────────────────────────────────────────────
  it('경계값: 화0, 토0, 정의되지 않은 조합 = 0', () => {
    expect(getCondenseBonus(0, 1)).toBe(0)
    expect(getCondenseBonus(1, 0)).toBe(0)
    expect(getCondenseBonus(0, 0)).toBe(0)
    expect(getCondenseBonus(5, 5)).toBe(0)  // 정의되지 않은 조합
  })

  it('매트릭스 구조: CONDENSE_MATRIX 확인', () => {
    // 기본 접근 검증
    expect(CONDENSE_MATRIX[1][1]).toBe(120)
    expect(CONDENSE_MATRIX[2][3]).toBe(240)
    expect(CONDENSE_MATRIX[3][2]).toBe(205)
    expect(CONDENSE_MATRIX[4][1]).toBe(155)
  })
})

// ─────────────────────────────────────────────────────────────────
// 헬퍼: 모든 정의된 보너스 값 수집
// ─────────────────────────────────────────────────────────────────
function getAllCondenseValues(): number[] {
  const values: number[] = []
  for (const hwaCount of Object.keys(CONDENSE_MATRIX).map(Number)) {
    const toMap = CONDENSE_MATRIX[hwaCount]
    for (const toCount of Object.keys(toMap).map(Number)) {
      values.push(toMap[toCount])
    }
  }
  return values
}
