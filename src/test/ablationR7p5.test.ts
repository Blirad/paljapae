/**
 * R7-5 봇 컴포넌트 어블레이션
 *
 * 표준 설정(R7-4) 고정, 봇만 4종 변형 × 목화 덱 1000판:
 *  (a) 정본 871c69d (응축 동적 + 용신 스코어링) — 대조군
 *  (b) 응축 구버전 (mult≥1.2), 용신 스코어링 유지
 *  (c) 응축 동적 유지, 용신 스코어링 OFF
 *  (d) 둘 다 구버전 = R4.5 시절 봇 복원
 *
 * 판정: (d)가 R4.5의 31% 근방 → 하락 원인 봇 확정
 *       (b) vs (c)로 범인 분리
 *
 * 실행: npm test -- src/test/ablationR7p5.test.ts
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

// 표준 목화 프리셋 (R7-4 동일)
const MOK_HWA_BASE = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  ilganElement: 'mok' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

interface VariantConfig {
  label: string
  condenseOldStyle: boolean
  disableYongsinScoring: boolean
}

const VARIANTS: VariantConfig[] = [
  { label: '(a) 정본 871c69d',           condenseOldStyle: false, disableYongsinScoring: false },
  { label: '(b) 응축 구버전, 용신 ON',   condenseOldStyle: true,  disableYongsinScoring: false },
  { label: '(c) 응축 동적, 용신 OFF',    condenseOldStyle: false, disableYongsinScoring: true  },
  { label: '(d) 둘 다 구버전 (R4.5)',     condenseOldStyle: true,  disableYongsinScoring: true  },
]

interface VariantResult {
  label: string
  cleared: number
  total: number
  ci: { low: number; high: number; point: number }
  deathByFloor: Record<number, number>
  condenseCount: number
}

describe('R7-5 봇 컴포넌트 어블레이션', () => {
  it('4종 변형 × 목화 1000판', { timeout: 60000 }, () => {
    const RUNS = 1000
    const yongsin = getFavorableElement('mok' as Element)

    console.log('\n========== R7-5 봇 컴포넌트 어블레이션 ==========')
    console.log(`프리셋: 목화 (木4 火4 土2 金2 水2)`)
    console.log(`용신: ${yongsin} (ilgan=mok → getFavorableElement)`)
    console.log(`enableFloorReward: ON`)
    console.log(`샘플: ${RUNS}판 × 4종 변형\n`)

    const results: VariantResult[] = []

    for (const variant of VARIANTS) {
      let cleared = 0
      let totalCondense = 0
      const deathByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

      for (let i = 0; i < RUNS; i++) {
        const seed = i * 12345 + 7777
        const result = simulateFullCapRun(seed, {
          ...MOK_HWA_BASE,
          favorableElement: variant.disableYongsinScoring ? undefined : yongsin,
          condenseOldStyle: variant.condenseOldStyle,
          disableYongsinScoring: variant.disableYongsinScoring,
        })

        if (result.victory) {
          cleared++
        } else {
          const df = result.deathFloor ?? 1
          deathByFloor[df] = (deathByFloor[df] ?? 0) + 1
        }
        totalCondense += result.condenseCount
      }

      results.push({
        label: variant.label,
        cleared,
        total: RUNS,
        ci: wilsonCI(cleared, RUNS),
        deathByFloor,
        condenseCount: totalCondense,
      })
    }

    // ──────────────────────────────────────────────────────────────
    // 1. 클리어율 + CI
    // ──────────────────────────────────────────────────────────────
    console.log('=== 1. 클리어율 + Wilson 95% CI ===\n')
    console.log('| 변형 | 클리어 | 클리어율 | 95% CI | 응축 횟수/판 |')
    console.log('|------|--------|----------|--------|-------------|')

    for (const r of results) {
      const condensePer = (r.condenseCount / r.total).toFixed(2)
      console.log(
        `| ${r.label.padEnd(28)} | ${r.cleared.toString().padStart(3)}/${r.total} | ${pct(r.ci.point).padStart(6)}% | ${pct(r.ci.low)}%~${pct(r.ci.high)}% | ${condensePer} |`
      )
    }

    // ──────────────────────────────────────────────────────────────
    // 2. 층별 사망 분포
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 2. 층별 사망 분포 ===\n')
    console.log('| 변형 | 1층 | 2층 | 3층 | 4층 | 클리어 |')
    console.log('|------|-----|-----|-----|-----|--------|')

    for (const r of results) {
      const d = r.deathByFloor
      const deaths = [1, 2, 3, 4].map(f => {
        const cnt = d[f] ?? 0
        return `${((cnt / r.total) * 100).toFixed(1)}%`
      })
      console.log(
        `| ${r.label.padEnd(28)} | ${deaths[0].padStart(5)} | ${deaths[1].padStart(5)} | ${deaths[2].padStart(5)} | ${deaths[3].padStart(5)} | ${((r.cleared / r.total) * 100).toFixed(1)}% |`
      )
    }

    // ──────────────────────────────────────────────────────────────
    // 3. R4.5 대조 + 범인 판독
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 3. R4.5 대조 + 범인 판독 ===\n')

    const R4P5_MOK = 31.0
    const [a, b, c, d] = results.map(r => r.ci.point * 100)

    console.log(`R4.5 목화 참조값: ${R4P5_MOK}%`)
    console.log(`(a) 정본:         ${a.toFixed(2)}%  (대조군)`)
    console.log(`(b) 응축 구버전:  ${b.toFixed(2)}%  (diff from a: ${(b - a).toFixed(2)}%p)`)
    console.log(`(c) 용신 OFF:     ${c.toFixed(2)}%  (diff from a: ${(c - a).toFixed(2)}%p)`)
    console.log(`(d) R4.5 복원:    ${d.toFixed(2)}%  (diff from a: ${(d - a).toFixed(2)}%p)`)
    console.log('')

    // (d)가 R4.5 근방(±5%p)이면 봇 원인 확정
    const dNearR4p5 = Math.abs(d - R4P5_MOK) <= 8
    if (dNearR4p5) {
      console.log(`✅ (d) ${d.toFixed(2)}% ≈ R4.5 ${R4P5_MOK}% (±8%p 이내) → 하락 원인: 봇 확정`)
      // b vs c 비교로 범인 분리
      const bDiff = b - a
      const cDiff = c - a
      console.log(`\n범인 분리:`)
      console.log(`  (b) 응축 구버전 효과: ${bDiff > 0 ? '+' : ''}${bDiff.toFixed(2)}%p`)
      console.log(`  (c) 용신 OFF 효과:    ${cDiff > 0 ? '+' : ''}${cDiff.toFixed(2)}%p`)
      if (Math.abs(bDiff) > Math.abs(cDiff)) {
        console.log(`\n  ⟹ 응축 동적 조건이 주 범인 (${bDiff.toFixed(2)}%p 변동)`)
        console.log(`  ⟹ 롤백 대상: 응축 → 구버전 (mult≥1.2)`)
      } else if (Math.abs(cDiff) > Math.abs(bDiff)) {
        console.log(`\n  ⟹ 용신 스코어링이 주 범인 (${cDiff.toFixed(2)}%p 변동)`)
        console.log(`  ⟹ 롤백 대상: 용신 스코어링 OFF`)
      } else {
        console.log(`\n  ⟹ 두 컴포넌트 효과 동등 — 둘 다 구버전 롤백 권장`)
      }
    } else {
      console.log(`❌ (d) ${d.toFixed(2)}%도 R4.5 ${R4P5_MOK}%에서 벗어남 → 봇 가설 기각`)
      console.log(`   ⟹ R4.5↔현재 게임 코드 diff 커밋 단위 감사 필요`)
    }

    console.log('\n========================================\n')

    // 기본 검증
    for (const r of results) {
      expect(r.total).toBe(RUNS)
    }
  })
})
