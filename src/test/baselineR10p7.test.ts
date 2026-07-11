/**
 * R10-7 — 스펙 정합 코드 최초의 공식 기준선
 *
 * 변경: 담금불 "손 전체 +1" → "쓴 카드만 +1" (스펙 일치화)
 *       + R10 미구현 3종 특성 구현 (정화/예리/비침)
 * 불변: 극×1.7, 생×0.5, 역극×0.75, 부기운극×1.25, 용신, 응축, HP
 * 프리셋: 목화/금수/토단일 × 3000판
 * 판정: 각 25~40%, 격차 ≤15%p (회전 수렴은 기준에서 제외)
 *
 * 실행: npm test -- src/test/baselineR10p7.test.ts
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
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin), point: p }
}
function pct(v: number): string { return (v * 100).toFixed(2) }

const ALL_TRAITS = [
  'wildfire', 'yonggigama', 'mining', 'purification', 'nourish',
  'keen', 'snipe', 'harvest', 'mirror', 'quench',
]

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
  traitCounts: Record<string, number>
}

function runPreset(key: keyof typeof PRESETS, runs: number): PresetResult {
  const preset = PRESETS[key]
  const yongsin = getFavorableElement(preset.ilganElement)

  let cleared = 0
  const deathByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const traitCounts: Record<string, number> = {}
  ALL_TRAITS.forEach(t => traitCounts[t] = 0)

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

    if (result.traitCounts) {
      for (const [trait, cnt] of Object.entries(result.traitCounts)) {
        traitCounts[trait] = (traitCounts[trait] ?? 0) + cnt
      }
    }
  }

  return { label: preset.label, cleared, total: runs, ci: wilsonCI(cleared, runs), deathByFloor, traitCounts }
}

describe('R10-7 공식 기준선 — 스펙 정합 코드', () => {
  it('목화/금수/토단일 × 3000판 + Wilson 95% CI + 융합 발동률', { timeout: 120000 }, () => {
    const RUNS = 3000

    console.log('\n========== R10-7 공식 기준선 ==========')
    console.log('스펙 정합 코드: 융합 10종 전수 구현 + 담금불 수정')
    console.log('수치 동결: 극×1.7, 생×0.5, 역극×0.75, 부기운극×1.25')
    console.log(`샘플: ${RUNS}판 × 3 프리셋`)
    console.log('신뢰구간: Wilson 95%')
    console.log('enableFloorReward: ON')
    console.log('판정: 각 25~40%, 격차 ≤15%p\n')

    // R8 참조값
    console.log('=== R8 참조값 (담금불 구 구현) ===')
    console.log('  목화: 28.33%  금수: 18.33%  토단일: 35.10%')
    console.log('  격차: 16.77%p (토단일−금수)\n')

    const results: PresetResult[] = []
    for (const key of ['mokHwa', 'geumSu', 'toDanil'] as const) {
      results.push(runPreset(key, RUNS))
    }

    // 1. 클리어율 + Wilson CI
    console.log('=== 1. 클리어율 + Wilson 95% CI ===\n')
    console.log('| 프리셋 | 클리어 | 클리어율 | 95% CI | CI 폭 |')
    console.log('|--------|--------|----------|--------|-------|')
    for (const r of results) {
      const ciWidth = ((r.ci.high - r.ci.low) * 100 / 2).toFixed(2)
      console.log(
        `| ${r.label.padEnd(6)} | ${r.cleared.toString().padStart(4)}/${r.total} | ${pct(r.ci.point).padStart(6)}% | ${pct(r.ci.low)}%~${pct(r.ci.high)}% | ±${ciWidth}%p |`
      )
    }

    // 2. 층별 사망 분포
    console.log('\n=== 2. 층별 사망 분포 ===\n')
    console.log('| 프리셋 | 1층 | 2층 | 3층 | 4층 | 클리어 |')
    console.log('|--------|-----|-----|-----|-----|--------|')
    for (const r of results) {
      const pcts = [1, 2, 3, 4].map(f =>
        ((r.deathByFloor[f] ?? 0) / r.total * 100).toFixed(1).padStart(5) + '%'
      )
      console.log(`| ${r.label.padEnd(6)} | ${pcts.join(' | ')} | ${pct(r.ci.point).padStart(5)}% |`)
    }

    // 3. 융합 발동률
    console.log('\n=== 3. 프리셋별 융합 발동률 (발동/판) ===\n')
    const traitLabels: Record<string, string> = {
      wildfire: '번짐', yonggigama: '응축', mining: '채굴', purification: '정화',
      nourish: '자양', keen: '예리', snipe: '저격', harvest: '수확',
      mirror: '비침', quench: '담금질',
    }
    const header = '| 프리셋 | ' + ALL_TRAITS.map(t => (traitLabels[t] ?? t).padEnd(4)).join(' | ') + ' | 총합 |'
    console.log(header)
    console.log('|' + '-'.repeat(header.length - 2) + '|')
    for (const r of results) {
      let total = 0
      const cols = ALL_TRAITS.map(t => {
        const avg = r.traitCounts[t] / r.total
        total += r.traitCounts[t]
        return avg.toFixed(2).padStart(4)
      })
      console.log(`| ${r.label.padEnd(6)} | ${cols.join(' | ')} | ${(total / r.total).toFixed(2)} |`)
    }

    // 4. R8 대비 변동
    const r8Ref: Record<string, number> = { '목화': 28.33, '금수': 18.33, '토단일': 35.10 }
    console.log('\n=== 4. R8 대비 변동 ===\n')
    console.log('| 프리셋 | R8 | R10-7 | 변동 |')
    console.log('|--------|------|-------|------|')
    for (const r of results) {
      const ref = r8Ref[r.label] ?? 0
      const cur = r.ci.point * 100
      const diff = cur - ref
      console.log(`| ${r.label.padEnd(6)} | ${ref.toFixed(1)}% | ${cur.toFixed(1)}% | ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%p |`)
    }

    // 5. 판정
    const rates = results.map(r => r.ci.point * 100)
    const maxRate = Math.max(...rates)
    const minRate = Math.min(...rates)
    const gap = maxRate - minRate

    console.log('\n=== 5. 판정 ===\n')
    const allInRange = rates.every(r => r >= 25 && r <= 40)
    const gapOk = gap <= 15

    for (const r of results) {
      const rate = r.ci.point * 100
      const inRange = rate >= 25 && rate <= 40
      console.log(`${r.label}: ${rate.toFixed(1)}% → ${inRange ? '✅ 범위 내 (25~40%)' : '❌ 범위 이탈'}`)
    }
    console.log(`\n격차: ${gap.toFixed(1)}%p → ${gapOk ? '✅ 15%p 이내' : '❌ 15%p 초과'}`)

    if (allInRange && gapOk) {
      console.log('\n🟢 최종 판정: PASS — 스펙 정합 코드 공식 기준선 확립')
    } else {
      const issues: string[] = []
      if (!allInRange) {
        const oob = results.filter(r => r.ci.point * 100 < 25 || r.ci.point * 100 > 40)
        issues.push(`범위 이탈: ${oob.map(r => `${r.label} ${(r.ci.point * 100).toFixed(1)}%`).join(', ')}`)
      }
      if (!gapOk) issues.push(`격차 초과: ${gap.toFixed(1)}%p`)
      console.log(`\n🔴 최종 판정: FAIL — ${issues.join(' / ')}`)
    }

    console.log('\n========================================\n')

    // 최소 assertion
    for (const r of results) {
      expect(r.total).toBe(RUNS)
    }
  })
})
