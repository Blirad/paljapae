/**
 * R11 확정 — 3층 HP 580 풀 검증
 *
 * 변경: 3층 HP 680→580 (스크리닝 (c) 선택)
 * 불변: 극×1.7, 생×0.5, 역극×0.75, 부기운극×1.25, 용신, 응축
 * 프리셋: 목화/금수/토단일 × 3000판
 * 판정: 각 25~40%, 격차 ≤15%p
 *
 * 실행: npm test -- src/test/baselineR11.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import { FLOOR_CONFIGS } from '../engine/balance'

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

const PRESETS = [
  { key: 'mokHwa', label: '목화', dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'mok' as Element },
  { key: 'geumSu', label: '금수', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>, ilgan: 'geum' as Element },
  { key: 'toDanil', label: '토단일', dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'to' as Element },
]

describe('R11 확정 — 3층 HP 580', () => {
  it('목화/금수/토단일 × 3000판 풀 검증', { timeout: 120000 }, () => {
    const RUNS = 3000
    const originalHp = FLOOR_CONFIGS[2].enemyHp

    // 3층 HP 변경
    ;(FLOOR_CONFIGS[2] as any).enemyHp = 580

    console.log('\n========== R11 확정 — 3층 HP 580 ==========')
    console.log(`변경: 3층 HP ${originalHp}→580`)
    console.log(`샘플: ${RUNS}판 × 3 프리셋`)
    console.log('판정: 각 25~40%, 격차 ≤15%p\n')

    // R10-7 참조값
    console.log('=== R10-7 참조값 (3층 HP 680) ===')
    console.log('  목화: 24.9%  금수: 16.7%  토단일: 35.9%\n')

    interface Result {
      label: string; cleared: number; total: number
      ci: { low: number; high: number; point: number }
      deathByFloor: Record<number, number>
      traitCounts: Record<string, number>
    }
    const results: Result[] = []

    for (const preset of PRESETS) {
      const yongsin = getFavorableElement(preset.ilgan)
      let cleared = 0
      const deathByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      const traitCounts: Record<string, number> = {}
      ALL_TRAITS.forEach(t => traitCounts[t] = 0)

      for (let i = 0; i < RUNS; i++) {
        const seed = i * 12345 + 7777
        const result = simulateFullCapRun(seed, {
          elementDist: preset.dist,
          ilganElement: preset.ilgan,
          favorableElement: yongsin,
          useFixedFloorElements: false,
          enableFloorReward: true,
        })
        if (result.victory) cleared++
        else {
          const df = result.deathFloor ?? 1
          deathByFloor[df] = (deathByFloor[df] ?? 0) + 1
        }
        if (result.traitCounts) {
          for (const [t, c] of Object.entries(result.traitCounts)) {
            traitCounts[t] = (traitCounts[t] ?? 0) + c
          }
        }
      }

      results.push({ label: preset.label, cleared, total: RUNS, ci: wilsonCI(cleared, RUNS), deathByFloor, traitCounts })
    }

    // 3층 HP 원복
    ;(FLOOR_CONFIGS[2] as any).enemyHp = originalHp

    // 1. 클리어율
    console.log('=== 1. 클리어율 + Wilson 95% CI ===\n')
    console.log('| 프리셋 | 클리어 | 클리어율 | 95% CI | CI 폭 |')
    console.log('|--------|--------|----------|--------|-------|')
    for (const r of results) {
      const w = ((r.ci.high - r.ci.low) * 100 / 2).toFixed(2)
      console.log(`| ${r.label.padEnd(6)} | ${r.cleared.toString().padStart(4)}/${r.total} | ${pct(r.ci.point).padStart(6)}% | ${pct(r.ci.low)}%~${pct(r.ci.high)}% | ±${w}%p |`)
    }

    // 2. 층별 사망
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
    const traitLabels: Record<string, string> = {
      wildfire: '번짐', yonggigama: '응축', mining: '채굴', purification: '정화',
      nourish: '자양', keen: '예리', snipe: '저격', harvest: '수확',
      mirror: '비침', quench: '담금질',
    }
    console.log('\n=== 3. 융합 발동률 (발동/판) ===\n')
    const header = '| 프리셋 | ' + ALL_TRAITS.map(t => (traitLabels[t] ?? t).padEnd(4)).join(' | ') + ' |'
    console.log(header)
    console.log('|' + '-'.repeat(header.length - 2) + '|')
    for (const r of results) {
      const cols = ALL_TRAITS.map(t => (r.traitCounts[t] / r.total).toFixed(2).padStart(4))
      console.log(`| ${r.label.padEnd(6)} | ${cols.join(' | ')} |`)
    }

    // 4. R10-7 대비 변동
    const r10Ref: Record<string, number> = { '목화': 24.87, '금수': 16.70, '토단일': 35.93 }
    console.log('\n=== 4. R10-7 대비 변동 ===\n')
    for (const r of results) {
      const ref = r10Ref[r.label] ?? 0
      const cur = r.ci.point * 100
      const diff = cur - ref
      console.log(`${r.label}: ${ref.toFixed(1)}% → ${cur.toFixed(1)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%p)`)
    }

    // 5. 판정
    const rates = results.map(r => r.ci.point * 100)
    const maxRate = Math.max(...rates)
    const minRate = Math.min(...rates)
    const gap = maxRate - minRate

    console.log('\n=== 5. 판정 ===\n')
    for (const r of results) {
      const rate = r.ci.point * 100
      const ok = rate >= 25 && rate <= 40
      console.log(`${r.label}: ${rate.toFixed(1)}% → ${ok ? '✅ 범위 내' : '❌ 범위 이탈'}`)
    }
    console.log(`\n격차: ${gap.toFixed(1)}%p → ${gap <= 15 ? '✅ 15%p 이내' : '❌ 15%p 초과'}`)

    const allOk = rates.every(r => r >= 25 && r <= 40) && gap <= 15
    if (allOk) {
      console.log('\n🟢 최종 판정: PASS — 밸런스 라운드 종료')
    } else {
      const issues: string[] = []
      const oob = results.filter(r => { const rt = r.ci.point * 100; return rt < 25 || rt > 40 })
      if (oob.length) issues.push(`범위 이탈: ${oob.map(r => `${r.label} ${(r.ci.point*100).toFixed(1)}%`).join(', ')}`)
      if (gap > 15) issues.push(`격차 ${gap.toFixed(1)}%p`)
      console.log(`\n🔴 최종 판정: FAIL — ${issues.join(' / ')}`)
    }

    console.log('\n========================================\n')

    for (const r of results) expect(r.total).toBe(RUNS)
  })
})
