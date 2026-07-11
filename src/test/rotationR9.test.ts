/**
 * R9 회전 대칭 테스트 — 인접쌍 5종 동형 덱
 *
 * 패턴: 4/4/2/2/2 + 용신 엔진 도출을 오행 사이클 5회전에 적용
 * 木火 / 火土 / 土金 / 金水 / 水木
 *
 * 판독:
 *  - 5종 CI 동등 → 엔진 대칭, 금수 열세는 프리셋 구성 차이
 *  - 특정 회전 처짐 → 해당 원소쌍 콘텐츠(융합 특성, 카드 수치) 범인
 *
 * 수치 변경 금지. R8 값(극×1.7, 부기운극×1.25) 동결.
 *
 * 실행: npm test -- src/test/rotationR9.test.ts
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

function pct(v: number): string { return (v * 100).toFixed(2) }

// 5종 회전 덱: 인접 2원소가 4장씩, 나머지 3원소가 2장씩
// ilgan = 첫 번째 원소 (용신은 getFavorableElement로 자동 도출)
const ROTATIONS: Array<{
  label: string
  ilgan: Element
  dist: Record<Element, number>
}> = [
  { label: '木火', ilgan: 'mok',  dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } },
  { label: '火土', ilgan: 'hwa',  dist: { mok: 2, hwa: 4, to: 4, geum: 2, su: 2 } },
  { label: '土金', ilgan: 'to',   dist: { mok: 2, hwa: 2, to: 4, geum: 4, su: 2 } },
  { label: '金水', ilgan: 'geum', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } },
  { label: '水木', ilgan: 'su',   dist: { mok: 4, hwa: 2, to: 2, geum: 2, su: 4 } },
]

interface RotResult {
  label: string
  ilgan: Element
  yongsin: Element
  cleared: number
  total: number
  ci: { low: number; high: number; point: number }
  deathByFloor: Record<number, number>
}

describe('R9 회전 대칭 테스트', () => {
  it('인접쌍 5종 × 1000판 + Wilson CI', { timeout: 60000 }, () => {
    const RUNS = 1000

    console.log('\n========== R9 회전 대칭 테스트 ==========')
    console.log('패턴: 4/4/2/2/2 인접쌍 × 오행 사이클 5회전')
    console.log('표준 설정: enableFloorReward=ON, R8 값 동결')
    console.log(`샘플: ${RUNS}판 × 5종\n`)

    const results: RotResult[] = []

    for (const rot of ROTATIONS) {
      const yongsin = getFavorableElement(rot.ilgan)
      let cleared = 0
      const deathByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

      for (let i = 0; i < RUNS; i++) {
        const seed = i * 12345 + 7777
        const result = simulateFullCapRun(seed, {
          elementDist: rot.dist as Record<Element, number>,
          ilganElement: rot.ilgan,
          favorableElement: yongsin,
          useFixedFloorElements: false,
          enableFloorReward: true,
        })

        if (result.victory) {
          cleared++
        } else {
          const df = result.deathFloor ?? 1
          deathByFloor[df] = (deathByFloor[df] ?? 0) + 1
        }
      }

      results.push({
        label: rot.label,
        ilgan: rot.ilgan,
        yongsin,
        cleared,
        total: RUNS,
        ci: wilsonCI(cleared, RUNS),
        deathByFloor,
      })
    }

    // 1. 덱 구성 + 용신 경로
    console.log('=== 1. 덱 구성 + 용신 경로 ===\n')
    console.log('| 덱 | 분포 | ilgan | 용신 |')
    console.log('|------|------|-------|------|')
    for (let i = 0; i < ROTATIONS.length; i++) {
      const rot = ROTATIONS[i]
      const r = results[i]
      const distStr = Object.entries(rot.dist).map(([k, v]) => `${k}:${v}`).join(' ')
      console.log(`| ${rot.label} | ${distStr} | ${rot.ilgan} | ${r.yongsin} |`)
    }

    // 2. 클리어율 + CI
    console.log('\n=== 2. 클리어율 + Wilson 95% CI ===\n')
    console.log('| 덱 | 클리어 | 클리어율 | 95% CI | CI 폭 |')
    console.log('|------|--------|----------|--------|-------|')
    for (const r of results) {
      const ciW = ((r.ci.high - r.ci.low) / 2 * 100).toFixed(2)
      console.log(
        `| ${r.label.padEnd(4)} | ${r.cleared.toString().padStart(3)}/${r.total} | ${pct(r.ci.point).padStart(6)}% | ${pct(r.ci.low)}%~${pct(r.ci.high)}% | ±${ciW}%p |`
      )
    }

    // 3. 층별 사망 분포
    console.log('\n=== 3. 층별 사망 분포 ===\n')
    console.log('| 덱 | 1층 | 2층 | 3층 | 4층 | 클리어 |')
    console.log('|------|-----|-----|-----|-----|--------|')
    for (const r of results) {
      const deaths = [1, 2, 3, 4].map(f => `${((r.deathByFloor[f] ?? 0) / r.total * 100).toFixed(1)}%`)
      console.log(
        `| ${r.label.padEnd(4)} | ${deaths[0].padStart(5)} | ${deaths[1].padStart(5)} | ${deaths[2].padStart(5)} | ${deaths[3].padStart(5)} | ${((r.cleared / r.total) * 100).toFixed(1)}% |`
      )
    }

    // 4. 대칭성 판독
    console.log('\n=== 4. 대칭성 판독 ===\n')
    const rates = results.map(r => r.ci.point * 100)
    const maxRate = Math.max(...rates)
    const minRate = Math.min(...rates)
    const maxLabel = results[rates.indexOf(maxRate)].label
    const minLabel = results[rates.indexOf(minRate)].label
    const spread = maxRate - minRate

    console.log(`최고: ${maxLabel} ${maxRate.toFixed(2)}%`)
    console.log(`최저: ${minLabel} ${minRate.toFixed(2)}%`)
    console.log(`격차: ${spread.toFixed(2)}%p`)
    console.log('')

    // 모든 쌍의 CI 겹침 검사
    let allOverlap = true
    let worstPair = ''
    let worstGap = 0
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i], b = results[j]
        const overlap = a.ci.low <= b.ci.high && b.ci.low <= a.ci.high
        const gap = Math.abs(a.ci.point - b.ci.point) * 100
        if (!overlap) {
          allOverlap = false
          if (gap > worstGap) {
            worstGap = gap
            worstPair = `${a.label}−${b.label}`
          }
        }
      }
    }

    if (allOverlap) {
      console.log('✅ 5종 모두 CI 겹침 → 엔진 대칭 확인')
      console.log('   금수 열세는 프리셋 구성 차이(카드 배분·용신)가 원인')
    } else {
      console.log(`❌ CI 분리 발견 — 최대 격차: ${worstPair} ${worstGap.toFixed(2)}%p`)
      console.log('   해당 원소쌍에 묶인 콘텐츠(융합 특성, 카드 수치) 감사 필요')
    }

    // CI 분리된 쌍 전수 출력
    console.log('\nCI 분리 상세:')
    console.log('| 쌍 | 격차 | CI 겹침 |')
    console.log('|----|------|---------|')
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i], b = results[j]
        const overlap = a.ci.low <= b.ci.high && b.ci.low <= a.ci.high
        const gap = ((a.ci.point - b.ci.point) * 100).toFixed(2)
        console.log(`| ${a.label}−${b.label} | ${gap.padStart(6)}%p | ${overlap ? '겹침' : '분리'} |`)
      }
    }

    console.log('\n========================================\n')

    for (const r of results) {
      expect(r.total).toBe(RUNS)
    }
  })
})
