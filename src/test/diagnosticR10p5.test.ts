/**
 * R10-5 진단 — 융합 발동률 + 담금불 어블레이션
 *
 * (b) 회전 5종 덱별 융합 특성 발동률 비교
 *     → 金水 샘 vs 火土 옹기가마·담금불
 * (c) 담금불 OFF 어블레이션 (火土·木火 1000판)
 *     → 火 라인 우위가 담금불 복리 단일 요인인지 확인
 *
 * 수치 변경 금지. R8 값 동결.
 * 실행: npm test -- src/test/diagnosticR10p5.test.ts
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

const ROTATIONS: Array<{
  label: string; ilgan: Element; dist: Record<Element, number>
}> = [
  { label: '木火', ilgan: 'mok',  dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } },
  { label: '火土', ilgan: 'hwa',  dist: { mok: 2, hwa: 4, to: 4, geum: 2, su: 2 } },
  { label: '土金', ilgan: 'to',   dist: { mok: 2, hwa: 2, to: 4, geum: 4, su: 2 } },
  { label: '金水', ilgan: 'geum', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } },
  { label: '水木', ilgan: 'su',   dist: { mok: 4, hwa: 2, to: 2, geum: 2, su: 4 } },
]

// 10종 특성 전수 목록
const ALL_TRAITS = [
  'wildfire', 'yonggigama', 'mining', 'purification', 'nourish',
  'keen', 'snipe', 'harvest', 'mirror', 'quench',
]

describe('R10-5b: 융합 발동률 측정', () => {
  it('회전 5종 × 1000판 — 덱별 특성 발동 횟수', { timeout: 60000 }, () => {
    const RUNS = 1000

    console.log('\n========== R10-5b 융합 발동률 ==========')
    console.log(`패턴: 4/4/2/2/2 × 오행 5회전, ${RUNS}판\n`)

    // 덱별 집계
    const deckTraits: Record<string, Record<string, number>> = {}
    const deckCleared: Record<string, number> = {}
    const deckTotal: Record<string, number> = {}

    for (const rot of ROTATIONS) {
      const yongsin = getFavorableElement(rot.ilgan)
      const traits: Record<string, number> = {}
      ALL_TRAITS.forEach(t => traits[t] = 0)
      let cleared = 0

      for (let i = 0; i < RUNS; i++) {
        const seed = i * 12345 + 7777
        const result = simulateFullCapRun(seed, {
          elementDist: rot.dist as Record<Element, number>,
          ilganElement: rot.ilgan,
          favorableElement: yongsin,
          useFixedFloorElements: false,
          enableFloorReward: true,
        })
        if (result.victory) cleared++
        if (result.traitCounts) {
          for (const [trait, cnt] of Object.entries(result.traitCounts)) {
            traits[trait] = (traits[trait] ?? 0) + cnt
          }
        }
      }

      deckTraits[rot.label] = traits
      deckCleared[rot.label] = cleared
      deckTotal[rot.label] = RUNS
    }

    // 1. 덱별 클리어율
    console.log('=== 1. 클리어율 ===\n')
    console.log('| 덱 | 클리어율 |')
    console.log('|------|----------|')
    for (const rot of ROTATIONS) {
      const rate = ((deckCleared[rot.label] / RUNS) * 100).toFixed(1)
      console.log(`| ${rot.label} | ${rate}% |`)
    }

    // 2. 특성 발동 횟수 / 판 평균
    console.log('\n=== 2. 특성 발동 횟수 (총 / 판 평균) ===\n')
    const header = '| 덱 | ' + ALL_TRAITS.map(t => t.slice(0, 8).padEnd(8)).join(' | ') + ' |'
    console.log(header)
    console.log('|' + '-'.repeat(header.length - 2) + '|')
    for (const rot of ROTATIONS) {
      const t = deckTraits[rot.label]
      const cols = ALL_TRAITS.map(trait => {
        const avg = (t[trait] / RUNS).toFixed(2)
        return avg.padStart(8)
      })
      console.log(`| ${rot.label} | ${cols.join(' | ')} |`)
    }

    // 3. 핵심 비교: 金水 샘 vs 火土 옹기가마·담금불
    console.log('\n=== 3. 핵심 비교 ===\n')
    const gsTraits = deckTraits['金水']
    const htTraits = deckTraits['火土']
    console.log(`金水 샘(purification): ${gsTraits.purification}회 (${(gsTraits.purification / RUNS).toFixed(2)}/판)`)
    console.log(`火土 옹기가마(yonggigama): ${htTraits.yonggigama}회 (${(htTraits.yonggigama / RUNS).toFixed(2)}/판)`)
    console.log(`火土 담금불(quench): ${htTraits.quench}회 (${(htTraits.quench / RUNS).toFixed(2)}/판)`)
    console.log(`火土 들불(wildfire): ${htTraits.wildfire}회 (${(htTraits.wildfire / RUNS).toFixed(2)}/판)`)
    console.log('')

    // 4. 全 특성 총합 비교
    console.log('=== 4. 전체 특성 발동 총합 ===\n')
    for (const rot of ROTATIONS) {
      const total = Object.values(deckTraits[rot.label]).reduce((a, b) => a + b, 0)
      console.log(`${rot.label}: 총 ${total}회 (${(total / RUNS).toFixed(2)}/판)`)
    }

    console.log('\n========================================\n')

    // 최소 assertion
    for (const rot of ROTATIONS) {
      expect(deckTotal[rot.label]).toBe(RUNS)
    }
  })
})

describe('R10-5c: 담금불 OFF 어블레이션', () => {
  it('火土·木火 × 1000판 — 정본 vs 담금불 OFF', { timeout: 60000 }, () => {
    const RUNS = 1000
    const targets = ROTATIONS.filter(r => r.label === '火土' || r.label === '木火')

    console.log('\n========== R10-5c 담금불 어블레이션 ==========')
    console.log(`대상: 火土·木火 × ${RUNS}판, 정본 vs quench OFF\n`)

    interface AblResult {
      label: string; variant: string; cleared: number; total: number;
      ci: { low: number; high: number; point: number }
    }
    const results: AblResult[] = []

    for (const rot of targets) {
      const yongsin = getFavorableElement(rot.ilgan)
      for (const variant of ['정본', 'quench OFF'] as const) {
        let cleared = 0
        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const result = simulateFullCapRun(seed, {
            elementDist: rot.dist as Record<Element, number>,
            ilganElement: rot.ilgan,
            favorableElement: yongsin,
            useFixedFloorElements: false,
            enableFloorReward: true,
            disabledTraits: variant === 'quench OFF' ? ['quench'] : undefined,
          })
          if (result.victory) cleared++
        }
        results.push({
          label: rot.label,
          variant,
          cleared,
          total: RUNS,
          ci: wilsonCI(cleared, RUNS),
        })
      }
    }

    // 결과 출력
    console.log('| 덱 | 변형 | 클리어 | 클리어율 | 95% CI |')
    console.log('|------|------|--------|----------|--------|')
    for (const r of results) {
      console.log(
        `| ${r.label} | ${r.variant.padEnd(10)} | ${r.cleared.toString().padStart(3)}/${r.total} | ${pct(r.ci.point).padStart(6)}% | ${pct(r.ci.low)}%~${pct(r.ci.high)}% |`
      )
    }

    // 격차 분석
    console.log('\n=== 담금불 효과 분리 ===\n')
    for (const rot of targets) {
      const base = results.find(r => r.label === rot.label && r.variant === '정본')!
      const off = results.find(r => r.label === rot.label && r.variant === 'quench OFF')!
      const diff = ((base.ci.point - off.ci.point) * 100).toFixed(2)
      const overlap = base.ci.low <= off.ci.high && off.ci.low <= base.ci.high
      console.log(`${rot.label}: 정본 ${pct(base.ci.point)}% → OFF ${pct(off.ci.point)}% (격차 ${diff}%p, CI ${overlap ? '겹침' : '분리'})`)
    }

    // 판독
    console.log('\n=== 판독 ===\n')
    const htBase = results.find(r => r.label === '火土' && r.variant === '정본')!
    const htOff = results.find(r => r.label === '火土' && r.variant === 'quench OFF')!
    const htDrop = (htBase.ci.point - htOff.ci.point) * 100
    const overlap = htBase.ci.low <= htOff.ci.high && htOff.ci.low <= htBase.ci.high
    if (!overlap && htDrop > 3) {
      console.log(`담금불 단일 요인 확인: 火土 ${htDrop.toFixed(1)}%p 하락, CI 분리`)
    } else if (overlap) {
      console.log(`담금불 단독 원인 미확인: 火土 ${htDrop.toFixed(1)}%p 하락, CI 겹침`)
    } else {
      console.log(`담금불 부분 기여: 火土 ${htDrop.toFixed(1)}%p 하락, CI 분리`)
    }

    console.log('\n========================================\n')

    for (const r of results) {
      expect(r.total).toBe(RUNS)
    }
  })
})
