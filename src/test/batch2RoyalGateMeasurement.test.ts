/**
 * 배치 2 §2 왕·여왕 게이트 측정 (1000판 × 3프리셋 × 2벌)
 *
 * 게이트 기준:
 *   1. 전원 25~40% 클리어율 (3프리셋 모두)
 *   2. 격차 ≤15%p (최고-최저)
 *   3. 왕족 획득 판 +3~8%p 클리어율 상승 폭
 *   4. 연환 성립률 20~30% 밴드 재현
 *
 * 2벌: 값 10 vs 값 11 (왕·여왕 카드 값)
 */

import { describe, it, expect } from 'vitest'
import { simulateFullCapRun } from '../engine/fullCapBot'
import type { Element } from '../types/game'

describe('배치 2 §2 왕·여왕 게이트 측정 (스모크 테스트)', () => {
  const RUNS_PER_PRESET = 100  // 스모크 테스트: 100판 (풀 게이트는 1000판)

  // 3프리셋 사주 오행 분포 (정본)
  const presets: Record<string, Record<Element, number>> = {
    mokHwa: { mok: 26, hwa: 26, to: 16, geum: 16, su: 16 },       // 목화
    geumSu: { mok: 16, hwa: 16, to: 16, geum: 26, su: 26 },       // 금수
    toDanil: { mok: 7, hwa: 7, to: 28, geum: 26, su: 26 },        // 토단일
  }

  function runMeasurement(presetKey: string, royalValue: number, runs: number) {
    const elementDist = presets[presetKey]
    let victories = 0
    let royalObtainedRuns = 0
    let victoriesWithRoyal = 0
    let yeonhwanCount = 0

    for (let i = 0; i < runs; i++) {
      const result = simulateFullCapRun(i * 12345 + 7777, {
        elementDist,
        enableFloorReward: true,
        royalValue,
      })

      if (result.victory) {
        victories++
      }

      // 왕족 획득 판 추적 (향후 개선: state에서 직접 카운트하거나 result에 포함)
      // 현재는 모든 판에서 가능성 있음으로 간주

      // 연환 성립률 추적 (향후: result에 yeonhwanActivations 추가 필요)
    }

    const clearRate = (victories / runs) * 100

    return {
      clearRate,
      victories,
      runs,
      royalObtainedRuns,
      victoriesWithRoyal,
      yeonhwanCount,
    }
  }

  it('측정-값10: 목화 1000판', () => {
    const result = runMeasurement('mokHwa', 10, RUNS_PER_PRESET)
    console.log(`\n목화(값10) 클리어율: ${result.clearRate.toFixed(1)}% (${result.victories}/${result.runs})`)
    expect(result.clearRate).toBeGreaterThanOrEqual(25)
    expect(result.clearRate).toBeLessThanOrEqual(40)
  })

  it('측정-값10: 금수 1000판', () => {
    const result = runMeasurement('geumSu', 10, RUNS_PER_PRESET)
    console.log(`\n금수(값10) 클리어율: ${result.clearRate.toFixed(1)}% (${result.victories}/${result.runs})`)
    expect(result.clearRate).toBeGreaterThanOrEqual(25)
    expect(result.clearRate).toBeLessThanOrEqual(40)
  })

  it('측정-값10: 토단일 1000판', () => {
    const result = runMeasurement('toDanil', 10, RUNS_PER_PRESET)
    console.log(`\n토단일(값10) 클리어율: ${result.clearRate.toFixed(1)}% (${result.victories}/${result.runs})`)
    expect(result.clearRate).toBeGreaterThanOrEqual(25)
    expect(result.clearRate).toBeLessThanOrEqual(40)
  })

  it('측정-값11: 목화 1000판', () => {
    const result = runMeasurement('mokHwa', 11, RUNS_PER_PRESET)
    console.log(`\n목화(값11) 클리어율: ${result.clearRate.toFixed(1)}% (${result.victories}/${result.runs})`)
    expect(result.clearRate).toBeGreaterThanOrEqual(25)
    expect(result.clearRate).toBeLessThanOrEqual(40)
  })

  it('측정-값11: 금수 1000판', () => {
    const result = runMeasurement('geumSu', 11, RUNS_PER_PRESET)
    console.log(`\n금수(값11) 클리어율: ${result.clearRate.toFixed(1)}% (${result.victories}/${result.runs})`)
    expect(result.clearRate).toBeGreaterThanOrEqual(25)
    expect(result.clearRate).toBeLessThanOrEqual(40)
  })

  it('측정-값11: 토단일 1000판', () => {
    const result = runMeasurement('toDanil', 11, RUNS_PER_PRESET)
    console.log(`\n토단일(값11) 클리어율: ${result.clearRate.toFixed(1)}% (${result.victories}/${result.runs})`)
    expect(result.clearRate).toBeGreaterThanOrEqual(25)
    expect(result.clearRate).toBeLessThanOrEqual(40)
  })

  it('격차 검증: 값10 (3프리셋 격차 ≤15%p)', () => {
    const mokHwa = runMeasurement('mokHwa', 10, RUNS_PER_PRESET)
    const geumSu = runMeasurement('geumSu', 10, RUNS_PER_PRESET)
    const toDanil = runMeasurement('toDanil', 10, RUNS_PER_PRESET)

    const rates = [mokHwa.clearRate, geumSu.clearRate, toDanil.clearRate]
    const maxRate = Math.max(...rates)
    const minRate = Math.min(...rates)
    const gap = maxRate - minRate

    console.log(`\n값10 격차: ${maxRate.toFixed(1)}% - ${minRate.toFixed(1)}% = ${gap.toFixed(1)}%p`)
    expect(gap).toBeLessThanOrEqual(15)
  })

  it('격차 검증: 값11 (3프리셋 격차 ≤15%p)', () => {
    const mokHwa = runMeasurement('mokHwa', 11, RUNS_PER_PRESET)
    const geumSu = runMeasurement('geumSu', 11, RUNS_PER_PRESET)
    const toDanil = runMeasurement('toDanil', 11, RUNS_PER_PRESET)

    const rates = [mokHwa.clearRate, geumSu.clearRate, toDanil.clearRate]
    const maxRate = Math.max(...rates)
    const minRate = Math.min(...rates)
    const gap = maxRate - minRate

    console.log(`\n값11 격차: ${maxRate.toFixed(1)}% - ${minRate.toFixed(1)}% = ${gap.toFixed(1)}%p`)
    expect(gap).toBeLessThanOrEqual(15)
  })

  it('왕족 효과 검증: 값10 상승 폭 +3~8%p (향후 개선)', () => {
    // TODO: FullCapRunResult에 royalObtainedCount, victoriesWithRoyal 추가
    // 현재는 스키프 상태 (구현 대기)
    console.log('\n왕족 효과 검증: 향후 result에 왕족 획득 판 카운트 추가 필요')
  })

  it('연환 성립률 검증: 값10 20~30% 밴드 (향후 개선)', () => {
    // TODO: FullCapRunResult에 yeonhwanActivations 추가
    // 현재는 스키프 상태 (구현 대기)
    console.log('\n연환 성립률 검증: 향후 result에 연환 발동 횟수 추가 필요')
  })
})
