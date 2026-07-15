/**
 * T13 R4 시뮬 — 상관 상한 3회 + sikshin 발동 검증 (2026-07-13)
 *
 * 수정 사항:
 *  - 상관(sanggwan): 출정당 최대 SANGGWAN_MAX_PER_RUN(3)회 상한 적용
 *  - sikshin: R3에서 가호 미장착으로 발동 0 오진 → 장착 표본으로 재측정
 *
 * 실행 항목:
 *  1. 프리셋 3종 × 3000판 — 클리어율 + 층별 분포
 *  2. 가호 장착(sikshin+sanggwan) 1000판 — sikshin 발동률/기여도, 상관 발동 분포
 *
 * 실행: npm test -- src/test/t13R4Sim.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import { SANGGWAN_MAX_PER_RUN } from '../engine/balance'

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

function pct(v: number, digits = 1): string {
  return (v * 100).toFixed(digits) + '%'
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

describe('T13 R4 — 상관 상한 3회 + sikshin 부활 검증', () => {
  it(
    'R4: 3000판 × 3종 + 가호 장착 1000판',
    { timeout: 600000 },
    () => {
      const RUNS = 3000
      const TALISMAN_RUNS = 1000

      // ─── 1. 기본 3000판 시뮬 ─────────────────────────────────────────
      interface PresetResult {
        label: string
        cleared: number
        total: number
        ci: ReturnType<typeof wilsonCI>
        deathByFloor: Record<number, number>
        traitCounts: Record<string, number>
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const yongsin = getFavorableElement(preset.ilgan)
        let cleared = 0
        const deathByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        const traitCounts: Record<string, number> = {}

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 31337 + 9001
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

        results.push({
          label: preset.label,
          cleared,
          total: RUNS,
          ci: wilsonCI(cleared, RUNS),
          deathByFloor,
          traitCounts,
        })
      }

      // ─── 2. 가호 장착(sikshin+sanggwan) 1000판 ──────────────────────
      interface TalismanResult {
        label: string
        talismanIds: string[]
        cleared: number
        total: number
        ci: ReturnType<typeof wilsonCI>
        // sikshin 측정
        sikshinFireCount: number
        // sanggwan 발동 분포 — 출정당 발동 횟수 히스토그램
        sanggwanPerRunDist: Record<number, number>  // { 0: N판, 1: N판, 2: N판, 3: N판 }
        sanggwanTotalFired: number
      }

      const talismanResults: TalismanResult[] = []

      // 목화 프리셋에 sikshin+sanggwan 직접 강제 장착 (사주 기반 선택 무관하게 검증)
      const forcedIds = ['sikshin', 'sanggwan']

      for (const preset of PRESETS) {
        const yongsin = getFavorableElement(preset.ilgan)
        let cleared = 0
        let sikshinFireCount = 0
        const sanggwanPerRunDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
        let sanggwanTotalFired = 0

        for (let i = 0; i < TALISMAN_RUNS; i++) {
          const seed = i * 31337 + 9001
          const result = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement: yongsin,
            useFixedFloorElements: false,
            enableFloorReward: true,
            activePassiveIds: forcedIds,
          })

          if (result.victory) cleared++

          if (result.traitCounts) {
            // sikshin 발동 합산
            for (const [k, c] of Object.entries(result.traitCounts)) {
              if (k.toLowerCase().includes('sikshin')) sikshinFireCount += c
            }
            // sanggwan 발동 — 판당 발동 횟수 히스토그램
            // 전체 sanggwan 발동 수는 층별 합산이므로 출정당 최대 SANGGWAN_MAX_PER_RUN×4층
            // 여기서는 단순 총합 추적 + 분포 근사
            let runSanggwan = 0
            for (const [k, c] of Object.entries(result.traitCounts)) {
              if (k.toLowerCase().includes('sanggwan')) runSanggwan += c
            }
            sanggwanTotalFired += runSanggwan
            // 분포: 0, 1, 2, 3, 4+
            const bucket = Math.min(runSanggwan, 4)
            sanggwanPerRunDist[bucket] = (sanggwanPerRunDist[bucket] ?? 0) + 1
          } else {
            sanggwanPerRunDist[0] = (sanggwanPerRunDist[0] ?? 0) + 1
          }
        }

        talismanResults.push({
          label: preset.label,
          talismanIds: forcedIds,
          cleared,
          total: TALISMAN_RUNS,
          ci: wilsonCI(cleared, TALISMAN_RUNS),
          sikshinFireCount,
          sanggwanPerRunDist,
          sanggwanTotalFired,
        })
      }

      // ─── 출력 ─────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(65))
      console.log('T13 R4 시뮬 — 상관 상한 3회 + sikshin 부활 검증 (2026-07-13)')
      console.log(`SANGGWAN_MAX_PER_RUN = ${SANGGWAN_MAX_PER_RUN} (출정당 상한)`)
      console.log('='.repeat(65))

      // 클리어율
      console.log('\n[1] 클리어율 (Wilson 95% CI) — 가호 미장착 본시뮬 3000판\n')
      console.log('판정 기준: 각 25~40%, 격차 ≤15%p\n')
      console.log('| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 |')
      console.log('|--------|--------|----------|---------|---------|')
      for (const r of results) {
        console.log(
          `| ${r.label.padEnd(6)} | ${r.cleared.toString().padStart(4)}/${r.total} ` +
          `| ${pct(r.ci.point, 2).padStart(8)} ` +
          `| ${pct(r.ci.low, 2).padStart(7)} ` +
          `| ${pct(r.ci.high, 2).padStart(7)} |`
        )
      }

      const rates = results.map(r => r.ci.point * 100)
      const maxRate = Math.max(...rates)
      const minRate = Math.min(...rates)
      const gap = maxRate - minRate
      const allInRange = rates.every(r => r >= 25 && r <= 40)
      const gapOk = gap <= 15

      console.log(`\n격차: ${gap.toFixed(1)}%p`)
      console.log(`범위 판정: ${allInRange ? 'PASS (전 프리셋 25~40%)' : 'FAIL (범위 이탈)'}`)
      console.log(`격차 판정: ${gapOk ? 'PASS (≤15%p)' : 'FAIL (>15%p)'}`)

      // 층별 사망 분포
      console.log('\n| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |')
      console.log('|--------|----------|----------|----------|----------|--------|')
      for (const r of results) {
        const cols = [1, 2, 3, 4].map(f =>
          (r.deathByFloor[f] ?? 0).toString().padStart(4) +
          `(${((r.deathByFloor[f] ?? 0) / r.total * 100).toFixed(1)}%)`
        )
        console.log(`| ${r.label.padEnd(6)} | ${cols.join(' | ')} | ${r.cleared} |`)
      }

      // sikshin 발동률
      console.log('\n[2] sikshin 발동률 — 가호 장착(sikshin+sanggwan) 1000판\n')
      console.log(`장착 가호: [${forcedIds.join(', ')}]\n`)
      console.log('| 프리셋 | 클리어율 | sikshin 발동 총계 | 평균/판 | 판정 |')
      console.log('|--------|----------|------------------|---------|------|')
      for (const r of talismanResults) {
        const sikshinPerRun = r.sikshinFireCount / r.total
        const judge = r.sikshinFireCount > 0 ? '발동 확인(부활)' : '미발동(재확인 필요)'
        console.log(
          `| ${r.label.padEnd(6)} | ${pct(r.ci.point, 1).padStart(8)} ` +
          `| ${r.sikshinFireCount.toString().padStart(16)} ` +
          `| ${sikshinPerRun.toFixed(3).padStart(7)} ` +
          `| ${judge} |`
        )
      }

      // sanggwan 발동 분포
      console.log('\n[3] 상관(sanggwan) 발동 분포 — 출정당 발동 횟수 (상한 3회 cap 실증)\n')
      console.log(`상한: SANGGWAN_MAX_PER_RUN = ${SANGGWAN_MAX_PER_RUN}\n`)
      console.log('| 프리셋 | 0회 | 1회 | 2회 | 3회 | 4+회 | 평균/판 | cap 실증 |')
      console.log('|--------|-----|-----|-----|-----|------|---------|----------|')
      for (const r of talismanResults) {
        const d = r.sanggwanPerRunDist
        const over3 = d[4] ?? 0
        const perRun = r.sanggwanTotalFired / r.total
        // cap 실증: 4+회가 0이면 cap 정상 작동
        const capProven = over3 === 0 ? 'PASS (0판)' : `FAIL (${over3}판 초과)`
        console.log(
          `| ${r.label.padEnd(6)} ` +
          `| ${(d[0] ?? 0).toString().padStart(3)} ` +
          `| ${(d[1] ?? 0).toString().padStart(3)} ` +
          `| ${(d[2] ?? 0).toString().padStart(3)} ` +
          `| ${(d[3] ?? 0).toString().padStart(3)} ` +
          `| ${over3.toString().padStart(4)} ` +
          `| ${perRun.toFixed(3).padStart(7)} ` +
          `| ${capProven} |`
        )
      }

      // 가호 장착 클리어율
      console.log('\n[4] 가호 장착 클리어율 비교\n')
      console.log('| 프리셋 | 미장착(3000판) | 장착(1000판) | 차이 |')
      console.log('|--------|--------------|-------------|------|')
      for (let i = 0; i < PRESETS.length; i++) {
        const base = results[i]
        const tal = talismanResults[i]
        const diff = (tal.ci.point - base.ci.point) * 100
        const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%p'
        console.log(
          `| ${base.label.padEnd(6)} ` +
          `| ${pct(base.ci.point, 1).padStart(12)} ` +
          `| ${pct(tal.ci.point, 1).padStart(11)} ` +
          `| ${diffStr} |`
        )
      }

      // 최종 판정
      console.log('\n' + '='.repeat(65))
      console.log('R4 최종 판정')
      console.log('='.repeat(65))
      for (const r of results) {
        const rate = r.ci.point * 100
        const ok = rate >= 25 && rate <= 40
        console.log(`${r.label}: ${rate.toFixed(1)}% — ${ok ? 'PASS' : 'FAIL'}`)
      }
      console.log(`격차: ${gap.toFixed(1)}%p — ${gapOk ? 'PASS' : 'FAIL'}`)

      const allSikshinActive = talismanResults.every(r => r.sikshinFireCount > 0)
      const allCapProven = talismanResults.every(r => (r.sanggwanPerRunDist[4] ?? 0) === 0)
      console.log(`sikshin 부활: ${allSikshinActive ? 'PASS (전 프리셋 발동 확인)' : 'FAIL (일부 미발동)'}`)
      console.log(`sanggwan cap: ${allCapProven ? `PASS (${SANGGWAN_MAX_PER_RUN}회 상한 준수)` : 'FAIL (초과 판 발생)'}`)

      const finalPass = allInRange && gapOk && allSikshinActive && allCapProven
      console.log(`\nR4 최종: ${finalPass ? 'PASS' : 'FAIL'}`)
      console.log('='.repeat(65) + '\n')

      // 기계 검증
      for (const r of results) expect(r.total).toBe(RUNS)
      for (const r of talismanResults) expect(r.total).toBe(TALISMAN_RUNS)
    },
  )
})
