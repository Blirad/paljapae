/**
 * R8 기준선 — 극×1.7 복원 + 부기운극×1.25 재활성화
 *
 * 변경: GEUK_BONUS_MULTIPLIER 1.5→1.7, SUB_GEUK_BONUS ×1.25 재활성화
 * 불변: 생×0.5, 역극×0.75, 용신×1.3/×1.5, 응축, HP 전부
 * 프리셋: 목화/금수/토단일 × 3000판
 * 판정: 각 25~40%, 격차 ≤15%p
 *
 * 실행: npm test -- src/test/baselineR8.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'

function wilsonCI(successes: number, total: number) {
  const p = successes / total
  const z = 1.96
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin = (z * Math.sqrt(p * (1 - p) / total + (z * z) / (4 * total * total))) / denom
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    point: p,
  }
}

function pct(v: number): string {
  return (v * 100).toFixed(2)
}

const PRESETS = {
  mokHwa: {
    label: '목화',
    elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilganElement: 'mok' as Element,
    useFixedFloorElements: false,
    enableFloorReward: true,
  },
  geumSu: {
    label: '금수',
    elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilganElement: 'geum' as Element,
    useFixedFloorElements: false,
    enableFloorReward: true,
  },
  toDanil: {
    label: '토단일',
    elementDist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilganElement: 'to' as Element,
    useFixedFloorElements: false,
    enableFloorReward: true,
  },
}

interface PresetResult {
  label: string
  cleared: number
  total: number
  ci: { low: number; high: number; point: number }
  deathByFloor: Record<number, number>
}

function runPreset(key: keyof typeof PRESETS, runs: number): PresetResult {
  const preset = PRESETS[key]
  const yongsin = getFavorableElement(preset.ilganElement)

  let cleared = 0
  const deathByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

  for (let i = 0; i < runs; i++) {
    const seed = i * 12345 + 7777
    const result = simulateFullCapRun(seed, {
      ...preset,
      favorableElement: yongsin,
    })

    if (result.victory) {
      cleared++
    } else {
      const df = result.deathFloor ?? 1
      deathByFloor[df] = (deathByFloor[df] ?? 0) + 1
    }
  }

  return {
    label: preset.label,
    cleared,
    total: runs,
    ci: wilsonCI(cleared, runs),
    deathByFloor,
  }
}

describe('R8 기준선 — 극×1.7 + 부기운극×1.25 복원', () => {
  it('목화/금수/토단일 × 3000판 + Wilson 95% CI', { timeout: 60000 }, () => {
    const RUNS = 3000

    // R8 사전 예측 (판독 훈련용)
    console.log('\n========== R8 사전 예측 ==========')
    console.log('극 관련 버프 → 극 빈도 높은 덱일수록 이득')
    console.log('  목화: 12.3% → 20~25% 예상 (木극土, 火극金 빈번)')
    console.log('  금수: 6.7% → 12~18% 예상 (金극木, 水극火)')
    console.log('  토단일: 23.8% → 25~28% 예상 (土극水 제한적)')
    console.log('  금수 25% 미달 시 → 전역 레버 문제\n')

    console.log('========== R8 기준선 ==========')
    console.log('변경: GEUK ×1.5→×1.7, SUB_GEUK ×1.25 재활성화')
    console.log('불변: 생×0.5, 역극×0.75, 용신, 응축, HP')
    console.log(`샘플: ${RUNS}판 × 3 프리셋`)
    console.log('신뢰구간: Wilson 95%')
    console.log('enableFloorReward: ON\n')

    const results: PresetResult[] = []
    for (const key of ['mokHwa', 'geumSu', 'toDanil'] as const) {
      results.push(runPreset(key, RUNS))
    }

    // 1. 클리어율 + CI
    console.log('=== 1. 클리어율 + Wilson 95% CI ===\n')
    console.log('| 프리셋 | 클리어 | 클리어율 | 95% CI | CI 폭 |')
    console.log('|--------|--------|----------|--------|-------|')
    for (const r of results) {
      const ciWidth = ((r.ci.high - r.ci.low) / 2 * 100).toFixed(2)
      console.log(
        `| ${r.label.padEnd(6)} | ${r.cleared.toString().padStart(4)}/${r.total} | ${pct(r.ci.point).padStart(6)}% | ${pct(r.ci.low)}%~${pct(r.ci.high)}% | ±${ciWidth}%p |`
      )
    }

    // 2. 층별 사망 분포
    console.log('\n=== 2. 층별 사망 분포 ===\n')
    console.log('| 프리셋 | 1층 | 2층 | 3층 | 4층 | 클리어 |')
    console.log('|--------|-----|-----|-----|-----|--------|')
    for (const r of results) {
      const deaths = [1, 2, 3, 4].map(f => {
        const cnt = r.deathByFloor[f] ?? 0
        return `${((cnt / r.total) * 100).toFixed(1)}%`
      })
      console.log(
        `| ${r.label.padEnd(6)} | ${deaths[0].padStart(5)} | ${deaths[1].padStart(5)} | ${deaths[2].padStart(5)} | ${deaths[3].padStart(5)} | ${((r.cleared / r.total) * 100).toFixed(1)}% |`
      )
    }

    // 3. 프리셋 간 격차
    const [mokHwa, geumSu, toDanil] = results
    const mokGeumGap = ((mokHwa.ci.point - geumSu.ci.point) * 100).toFixed(2)
    const mokToGap = ((mokHwa.ci.point - toDanil.ci.point) * 100).toFixed(2)
    const geumToGap = ((geumSu.ci.point - toDanil.ci.point) * 100).toFixed(2)

    const mokGeumOverlap = mokHwa.ci.low <= geumSu.ci.high && geumSu.ci.low <= mokHwa.ci.high
    const mokToOverlap = mokHwa.ci.low <= toDanil.ci.high && toDanil.ci.low <= mokHwa.ci.high
    const geumToOverlap = geumSu.ci.low <= toDanil.ci.high && toDanil.ci.low <= geumSu.ci.high

    console.log('\n=== 3. 프리셋 간 격차 ===\n')
    console.log('| 비교 | 격차 | CI 겹침 | 유의미 |')
    console.log('|------|------|---------|--------|')
    console.log(`| 목화−금수 | ${mokGeumGap.padStart(6)}%p | ${mokGeumOverlap ? '겹침' : '분리'} | ${mokGeumOverlap ? '미확인' : '유의미'} |`)
    console.log(`| 목화−토단일 | ${mokToGap.padStart(6)}%p | ${mokToOverlap ? '겹침' : '분리'} | ${mokToOverlap ? '미확인' : '유의미'} |`)
    console.log(`| 금수−토단일 | ${geumToGap.padStart(6)}%p | ${geumToOverlap ? '겹침' : '분리'} | ${geumToOverlap ? '미확인' : '유의미'} |`)

    // 4. R7-4 대조
    const R7P4_REF = { mokHwa: 12.33, geumSu: 6.73, toDanil: 23.77 }
    const R4P5_REF = { mokHwa: 31.0, geumSu: 16.5, toDanil: 25.7 }
    const r8Labels = ['mokHwa', 'geumSu', 'toDanil'] as const

    console.log('\n=== 4. R7-4 / R4.5 대조 ===\n')
    console.log('| 프리셋 | R4.5 | R7-4 | R8 | R7-4→R8 | 판정 |')
    console.log('|--------|------|------|-----|---------|------|')
    for (let i = 0; i < 3; i++) {
      const key = r8Labels[i]
      const r4 = R4P5_REF[key]
      const r7 = R7P4_REF[key]
      const r8val = results[i].ci.point * 100
      const diff = (r8val - r7).toFixed(1)
      const inRange = results[i].ci.point >= 0.25 && results[i].ci.point <= 0.40
      console.log(
        `| ${results[i].label.padEnd(6)} | ${r4.toFixed(1).padStart(5)}% | ${r7.toFixed(2).padStart(6)}% | ${r8val.toFixed(2).padStart(6)}% | ${diff.padStart(6)}%p | ${inRange ? 'PASS' : 'FAIL'} |`
      )
    }

    // 5. 예측 대조
    console.log('\n=== 5. 예측 대조 ===\n')
    const predictions = { mokHwa: [20, 25], geumSu: [12, 18], toDanil: [25, 28] }
    for (let i = 0; i < 3; i++) {
      const key = r8Labels[i]
      const actual = results[i].ci.point * 100
      const [lo, hi] = predictions[key]
      const hit = actual >= lo && actual <= hi
      console.log(`${results[i].label}: 예측 ${lo}~${hi}%, 실측 ${actual.toFixed(2)}% — ${hit ? '적중' : '빗나감'}`)
    }

    // 6. 최종 판정
    console.log('\n=== 6. 최종 판정 ===\n')
    console.log('판정 기준: 각 25~40%, 격차 ≤15%p\n')

    let allPass = true
    for (const r of results) {
      const rate = r.ci.point * 100
      const ok = rate >= 25 && rate <= 40
      if (!ok) allPass = false
      console.log(`${r.label}: ${rate.toFixed(2)}% — ${ok ? 'PASS' : 'FAIL'}`)
    }

    const maxGap = Math.max(
      Math.abs(parseFloat(mokGeumGap)),
      Math.abs(parseFloat(mokToGap)),
      Math.abs(parseFloat(geumToGap))
    )
    const gapOk = maxGap <= 15
    if (!gapOk) allPass = false
    console.log(`\n최대 격차: ${maxGap.toFixed(2)}%p — ${gapOk ? 'PASS' : 'FAIL'}`)
    console.log(`\n종합: ${allPass ? 'ALL PASS ✅' : 'FAIL ❌'}`)
    console.log('\n========================================\n')

    for (const r of results) {
      expect(r.cleared).toBeGreaterThan(0)
      expect(r.total).toBe(RUNS)
    }
  })
})
