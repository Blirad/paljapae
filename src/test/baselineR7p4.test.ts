/**
 * R7-4 기준선 재수립 — 동결 봇(871c69d) 최종 판정
 *
 * 프리셋: 목화/금수/토단일 × 3000판 (균등 영구 제외)
 * 봇: fullCapBot 정본 (871c69d), 수정 없음
 * 신뢰구간: Wilson 95%
 *
 * 실행: npm test -- src/test/baselineR7p4.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'

// ─────────────────────────────────────────────────────────────────────────────
// Wilson 95% 신뢰구간
// ─────────────────────────────────────────────────────────────────────────────
function wilsonCI(successes: number, total: number): { low: number; high: number; point: number } {
  const p = successes / total
  const n = total
  const z = 1.96
  const denom = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denom
  const margin = (z * Math.sqrt(p * (1 - p) / n + (z * z) / (4 * n * n))) / denom
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    point: p,
  }
}

function pct(v: number): string {
  return (v * 100).toFixed(2)
}

// ─────────────────────────────────────────────────────────────────────────────
// 프리셋 (R4.5 이후 불변)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 층별 사망 분포
// ─────────────────────────────────────────────────────────────────────────────
interface PresetResult {
  label: string
  cleared: number
  total: number
  ci: { low: number; high: number; point: number }
  deathByFloor: Record<number, number>
  floorsClearedDist: Record<number, number>
}

function runPreset(key: keyof typeof PRESETS, runs: number): PresetResult {
  const preset = PRESETS[key]
  const yongsin = getFavorableElement(preset.ilganElement)

  let cleared = 0
  const deathByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const floorsClearedDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }

  for (let i = 0; i < runs; i++) {
    const seed = i * 12345 + 7777
    const result = simulateFullCapRun(seed, {
      ...preset,
      favorableElement: yongsin,
    })

    if (result.victory) {
      cleared++
      floorsClearedDist[4] = (floorsClearedDist[4] ?? 0) + 1
    } else {
      const df = result.deathFloor ?? 1
      deathByFloor[df] = (deathByFloor[df] ?? 0) + 1
      const fc = result.floorsCleared ?? 0
      floorsClearedDist[fc] = (floorsClearedDist[fc] ?? 0) + 1
    }
  }

  return {
    label: preset.label,
    cleared,
    total: runs,
    ci: wilsonCI(cleared, runs),
    deathByFloor,
    floorsClearedDist,
  }
}

describe('R7-4 기준선 재수립 — 동결 봇 최종 판정', () => {
  it('목화/금수/토단일 × 3000판 + Wilson 95% CI', { timeout: 60000 }, () => {
    const RUNS = 3000

    console.log('\n========== R7-4 기준선 재수립 ==========')
    console.log(`봇: fullCapBot 정본 (871c69d)`)
    console.log(`샘플: ${RUNS}판 × 3 프리셋`)
    console.log(`신뢰구간: Wilson 95%`)
    console.log(`균등 덱: 영구 제외`)
    console.log(`enableFloorReward: ON (3택 보상)`)
    console.log(`영속 덱: ON\n`)

    const results: PresetResult[] = []

    for (const key of ['mokHwa', 'geumSu', 'toDanil'] as const) {
      const r = runPreset(key, RUNS)
      results.push(r)
    }

    // ──────────────────────────────────────────────────────────────
    // 1. 클리어율 + 신뢰구간 표
    // ──────────────────────────────────────────────────────────────
    console.log('=== 1. 클리어율 + Wilson 95% CI ===\n')
    console.log('| 프리셋 | 클리어 | 클리어율 | 95% CI 하한 | 95% CI 상한 | CI 폭 |')
    console.log('|--------|--------|----------|-------------|-------------|-------|')

    for (const r of results) {
      const ciWidth = ((r.ci.high - r.ci.low) * 100).toFixed(2)
      console.log(
        `| ${r.label.padEnd(6)} | ${r.cleared.toString().padStart(4)}/${r.total} | ${pct(r.ci.point).padStart(6)}% | ${pct(r.ci.low).padStart(6)}% | ${pct(r.ci.high).padStart(6)}% | ±${(parseFloat(ciWidth) / 2).toFixed(2)}%p |`
      )
    }

    // ──────────────────────────────────────────────────────────────
    // 2. 층별 사망 분포
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 2. 층별 사망 분포 ===\n')
    console.log('| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |')
    console.log('|--------|----------|----------|----------|----------|--------|')

    for (const r of results) {
      const d = r.deathByFloor
      const deaths = [1, 2, 3, 4].map(f => {
        const cnt = d[f] ?? 0
        const rate = ((cnt / r.total) * 100).toFixed(1)
        return `${cnt}(${rate}%)`
      })
      const clearRate = ((r.cleared / r.total) * 100).toFixed(1)
      console.log(
        `| ${r.label.padEnd(6)} | ${deaths[0].padStart(10)} | ${deaths[1].padStart(10)} | ${deaths[2].padStart(10)} | ${deaths[3].padStart(10)} | ${r.cleared}(${clearRate}%) |`
      )
    }

    // ──────────────────────────────────────────────────────────────
    // 3. 프리셋 간 격차
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 3. 프리셋 간 격차 ===\n')
    const [mokHwa, geumSu, toDanil] = results

    const mokGeumGap = ((mokHwa.ci.point - geumSu.ci.point) * 100).toFixed(2)
    const mokToGap = ((mokHwa.ci.point - toDanil.ci.point) * 100).toFixed(2)
    const geumToGap = ((geumSu.ci.point - toDanil.ci.point) * 100).toFixed(2)

    // CI 겹침 여부
    const mokGeumOverlap = mokHwa.ci.low <= geumSu.ci.high && geumSu.ci.low <= mokHwa.ci.high
    const mokToOverlap = mokHwa.ci.low <= toDanil.ci.high && toDanil.ci.low <= mokHwa.ci.high
    const geumToOverlap = geumSu.ci.low <= toDanil.ci.high && toDanil.ci.low <= geumSu.ci.high

    console.log('| 비교 | 격차 | CI 겹침 | 유의미 차이 |')
    console.log('|------|------|---------|-------------|')
    console.log(`| 목화−금수 | ${mokGeumGap.padStart(6)}%p | ${mokGeumOverlap ? '겹침' : '분리'} | ${mokGeumOverlap ? '미확인' : '유의미'} |`)
    console.log(`| 목화−토단일 | ${mokToGap.padStart(6)}%p | ${mokToOverlap ? '겹침' : '분리'} | ${mokToOverlap ? '미확인' : '유의미'} |`)
    console.log(`| 금수−토단일 | ${geumToGap.padStart(6)}%p | ${geumToOverlap ? '겹침' : '분리'} | ${geumToOverlap ? '미확인' : '유의미'} |`)

    // ──────────────────────────────────────────────────────────────
    // 4. 용신 경로 확인
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 4. 용신 경로 ===\n')
    for (const key of ['mokHwa', 'geumSu', 'toDanil'] as const) {
      const p = PRESETS[key]
      const y = getFavorableElement(p.ilganElement)
      console.log(`${p.label}: ilgan=${p.ilganElement} → 용신=${y}`)
    }

    // ──────────────────────────────────────────────────────────────
    // 5. R4.5 참조값 대조
    // ──────────────────────────────────────────────────────────────
    const R4P5_REF = { mokHwa: 31.0, geumSu: 16.5, toDanil: 25.7 }
    console.log('\n=== 5. R4.5 참조값 대조 (1000판) ===\n')
    console.log('| 프리셋 | R4.5 (1000판) | R7-4 (3000판) | 차이 | 판정 |')
    console.log('|--------|---------------|---------------|------|------|')

    const r7Labels = ['mokHwa', 'geumSu', 'toDanil'] as const
    for (let i = 0; i < 3; i++) {
      const key = r7Labels[i]
      const ref = R4P5_REF[key]
      const r7val = results[i].ci.point * 100
      const diff = (r7val - ref).toFixed(1)
      const inRange = results[i].ci.point >= 0.25 && results[i].ci.point <= 0.40
      console.log(
        `| ${results[i].label.padEnd(6)} | ${ref.toFixed(1).padStart(5)}% | ${r7val.toFixed(2).padStart(6)}% | ${diff.padStart(6)}%p | ${inRange ? '목표 내' : '목표 외'} |`
      )
    }

    // ──────────────────────────────────────────────────────────────
    // 6. 최종 판정
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 6. 최종 판정 ===\n')
    console.log('판정 기준: 각 프리셋 25~40%, 격차 15%p 이내\n')

    let allPass = true
    for (const r of results) {
      const rate = r.ci.point * 100
      const inTarget = rate >= 25 && rate <= 40
      const status = inTarget ? 'PASS' : 'FAIL'
      if (!inTarget) allPass = false
      console.log(`${r.label}: ${rate.toFixed(2)}% — ${status} (목표 25~40%)`)
    }

    const maxGap = Math.max(
      Math.abs(parseFloat(mokGeumGap)),
      Math.abs(parseFloat(mokToGap)),
      Math.abs(parseFloat(geumToGap))
    )
    const gapPass = maxGap <= 15
    if (!gapPass) allPass = false
    console.log(`\n최대 격차: ${maxGap.toFixed(2)}%p — ${gapPass ? 'PASS' : 'FAIL'} (기준 ≤15%p)`)
    console.log(`\n종합: ${allPass ? 'ALL PASS ✅' : 'FAIL ❌'}`)

    console.log('\n========================================\n')

    // 기본 검증: 모든 프리셋에서 데이터가 수집됨
    for (const r of results) {
      expect(r.cleared).toBeGreaterThan(0)
      expect(r.total).toBe(RUNS)
    }
  })
})
