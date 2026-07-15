/**
 * v3R11YeonhwanCand1000.test.ts
 * balance-v3 R11 작업 b — 연환 배율 후보 시뮬 (1000판 × 3종)
 *
 * 이 파일은 현재 OHANG_YEONHWAN_MULTIPLIER 값을 사용한다.
 * 실행 전 balance.ts의 OHANG_YEONHWAN_MULTIPLIER를 원하는 후보값으로 임시 변경 후 실행.
 * 실행 후 반드시 ×8로 복원할 것.
 *
 * 시드: i×12345+7777 (i=0~999) — 1000판
 * 커밋: 632c30a 기준 (OHANG_YEONHWAN_MULTIPLIER 단일 변경)
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import { OHANG_YEONHWAN_MULTIPLIER } from '../engine/balance'

function wilsonCI(successes: number, total: number) {
  const p = successes / total
  const z = 1.96
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    point: p,
  }
}

const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
  },
]

// R10 기준선 (3000판) — 1000판 후보 비교용
const BASELINE_R10 = {
  mok: 39.43,
  geum: 35.93,
  to: 27.77,
}

describe(`balance-v3 R11 작업b — 연환 후보 시뮬 (×${OHANG_YEONHWAN_MULTIPLIER}, 1000판 × 3종)`, () => {
  it(
    `R11-b: OHANG_YEONHWAN_MULTIPLIER=×${OHANG_YEONHWAN_MULTIPLIER} 1000판 시뮬`,
    { timeout: 300000 },
    () => {
      const RUNS = 1000

      interface PresetResult {
        label: string
        selectedTalismans: string[]
        cleared: number
        total: number
        ci: ReturnType<typeof wilsonCI>
        deathsByFloor: Record<number, number>
        yeonhwanCount: number
        traitCounts: Record<string, number>
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        let yeonhwanCount = 0
        const traitCounts: Record<string, number> = {}

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const r = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds: selectedTalismans,
            enableFloorReward: true,
            enableEffectMode: true,
          })

          if (r.victory) {
            cleared++
          } else if (r.deathFloor !== null) {
            deathsByFloor[r.deathFloor] = (deathsByFloor[r.deathFloor] ?? 0) + 1
          }

          if (r.traitCounts) {
            for (const [k, v] of Object.entries(r.traitCounts)) {
              traitCounts[k] = (traitCounts[k] ?? 0) + v
              if (k === 'ohang-yeonhwan') yeonhwanCount += v
            }
          }
        }

        results.push({
          label: preset.label,
          selectedTalismans,
          cleared,
          total: RUNS,
          ci: wilsonCI(cleared, RUNS),
          deathsByFloor,
          yeonhwanCount,
          traitCounts,
        })
      }

      // ─── 출력 ───────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(70))
      console.log(`balance-v3 R11 작업b — 연환 후보 시뮬`)
      console.log(`배율: ×${OHANG_YEONHWAN_MULTIPLIER} | 1000판 × 3종 | 시드: i×12345+7777 (i=0~999)`)
      console.log('='.repeat(70))

      // §3: 클리어율 + Wilson 95% CI
      console.log(`\n[§3] 클리어율 + Wilson 95% CI (×${OHANG_YEONHWAN_MULTIPLIER}, 1000판)\n`)
      console.log('| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | ±CI |')
      console.log('|--------|--------|----------|---------|---------|-----|')
      for (const r of results) {
        const ciW = ((r.ci.high - r.ci.low) * 100 / 2).toFixed(2)
        console.log(
          `| ${r.label.padEnd(6)} | ${r.cleared}/${r.total} ` +
          `| ${(r.ci.point * 100).toFixed(2).padStart(7)}% ` +
          `| ${(r.ci.low * 100).toFixed(2).padStart(6)}% ` +
          `| ${(r.ci.high * 100).toFixed(2).padStart(6)}% ` +
          `| ±${ciW}%p |`
        )
      }

      // §3-비교: R10 기준선(3000판) vs 현재 후보(1000판) 비교표
      console.log(`\n[§3-비교] R10 기준선(×8, 3000판) vs ×${OHANG_YEONHWAN_MULTIPLIER}(1000판)\n`)
      console.log(`| 프리셋 | R10 기준선(×8) | ×${OHANG_YEONHWAN_MULTIPLIER} 실측 | 변화 | ±1.5%p 초과? |`)
      console.log('|--------|---------------|---------|------|------------|')
      for (const r of results) {
        const baseKey = r.label === '목화' ? 'mok' : r.label === '금수' ? 'geum' : 'to'
        const baseline = BASELINE_R10[baseKey]
        const actual = r.ci.point * 100
        const delta = actual - baseline
        const over = Math.abs(delta) > 1.5 ? 'YES (초과)' : 'NO (범위내)'
        console.log(
          `| ${r.label.padEnd(6)} | ${baseline}% | ${actual.toFixed(2)}% ` +
          `| ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p | ${over} |`
        )
      }

      // §4: ±1.5%p 게이트 판정
      console.log(`\n[§4] ±1.5%p 게이트 판정 (×${OHANG_YEONHWAN_MULTIPLIER})\n`)
      const mokResult = results.find(r => r.label === '목화')
      const geumResult = results.find(r => r.label === '금수')
      const toResult = results.find(r => r.label === '토단일')

      let allWithinGate = true
      if (mokResult && geumResult && toResult) {
        const deltas = [
          { label: '목화', delta: mokResult.ci.point * 100 - BASELINE_R10.mok },
          { label: '금수', delta: geumResult.ci.point * 100 - BASELINE_R10.geum },
          { label: '토단일', delta: toResult.ci.point * 100 - BASELINE_R10.to },
        ]
        for (const d of deltas) {
          const pass = Math.abs(d.delta) <= 1.5
          if (!pass) allWithinGate = false
          console.log(`${d.label}: ${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(2)}%p — ${pass ? 'GATE PASS' : 'GATE FAIL (±1.5%p 초과)'}`)
        }
        console.log(`\n전체 게이트: ${allWithinGate ? 'PASS — v3.1 재기준선 불필요 → 배율 확정 후보' : 'FAIL — v3.1 재기준선 이든 판정 필요'}`)
      }

      // §1: 연환 발생률
      console.log(`\n[§1] 연환 발생률 (×${OHANG_YEONHWAN_MULTIPLIER}, 1000판)\n`)
      console.log('| 프리셋 | 연환 총합 | 발생률/판 |')
      console.log('|--------|-----------|-----------|')
      for (const r of results) {
        const perRun = (r.yeonhwanCount / r.total).toFixed(3)
        console.log(`| ${r.label.padEnd(6)} | ${r.yeonhwanCount.toString().padStart(8)} | ${perRun.padStart(8)}회/판 |`)
      }

      console.log('\n' + '='.repeat(70))
      console.log(`R11 작업b (×${OHANG_YEONHWAN_MULTIPLIER}) 완료`)
      console.log('='.repeat(70))

      // 검증
      for (const r of results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared).toBeGreaterThanOrEqual(0)
        expect(r.cleared).toBeLessThanOrEqual(RUNS)
        expect(r.cleared / RUNS).toBeGreaterThan(0.10)
      }

      console.log('\n판정: PASS')
    },
  )
})
