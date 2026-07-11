/**
 * R11 스크리닝 — 3층 HP 레버
 *
 * 현재 3층 HP: 680 (이든 기억값 560과 차이 — 680 기준으로 동일 비율 적용)
 * (a) 680 → 620  (≈560→520 비율 -8.6%)
 * (b) 680 → 600  (≈560→500 비율 -10.7%)
 * (c) 680 → 580  (≈560→480 비율 -14.3%)
 *
 * 또는 이든 지시 수치 그대로 520/500/480 적용 (확인 필요)
 * → 이든 지시 문자 그대로 520/500/480 적용
 *
 * 실행: npm test -- src/test/screeningR11.test.ts
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
function pct(v: number): string { return (v * 100).toFixed(1) }

const PRESETS = [
  { key: 'mokHwa', label: '목화', dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }, ilgan: 'mok' as Element },
  { key: 'geumSu', label: '금수', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 }, ilgan: 'geum' as Element },
  { key: 'toDanil', label: '토단일', dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 }, ilgan: 'to' as Element },
]

// 3층 HP 변형: 이든 지시 수치 그대로
const HP_VARIANTS = [
  { label: '현행(680)', hp: 680 },
  { label: '(a) 620', hp: 620 },
  { label: '(b) 600', hp: 600 },
  { label: '(c) 580', hp: 580 },
]

describe('R11 3층 HP 스크리닝', () => {
  it('3종 × 4변형 × 1000판', { timeout: 120000 }, () => {
    const RUNS = 1000
    const originalHp = FLOOR_CONFIGS[2].enemyHp  // 3층 원본 HP 저장

    console.log('\n========== R11 3층 HP 스크리닝 ==========')
    console.log(`3층 원본 HP: ${originalHp}`)
    console.log(`변형: ${HP_VARIANTS.map(v => v.label).join(' / ')}`)
    console.log(`샘플: ${RUNS}판 × 3 프리셋 × 4 변형\n`)

    // 이든 예측 기록
    console.log('=== 이든 예측 ((b) 600 기준) ===')
    console.log('금수: 21~23% / 목화: 28~30% / 토단일: 36~37%\n')

    interface Cell {
      preset: string; variant: string; cleared: number; total: number
      clearRate: number; floor3Death: number; floor3DeathPct: number
    }
    const grid: Cell[] = []

    for (const variant of HP_VARIANTS) {
      // 3층 HP 임시 변경
      ;(FLOOR_CONFIGS[2] as any).enemyHp = variant.hp

      for (const preset of PRESETS) {
        const yongsin = getFavorableElement(preset.ilgan)
        let cleared = 0
        let floor3Death = 0

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const result = simulateFullCapRun(seed, {
            elementDist: preset.dist as Record<Element, number>,
            ilganElement: preset.ilgan,
            favorableElement: yongsin,
            useFixedFloorElements: false,
            enableFloorReward: true,
          })
          if (result.victory) cleared++
          else if (result.deathFloor === 3) floor3Death++
        }

        grid.push({
          preset: preset.label,
          variant: variant.label,
          cleared,
          total: RUNS,
          clearRate: cleared / RUNS * 100,
          floor3Death,
          floor3DeathPct: floor3Death / RUNS * 100,
        })
      }
    }

    // 3층 HP 원복
    ;(FLOOR_CONFIGS[2] as any).enemyHp = originalHp

    // 결과 출력 — 변형별 프리셋 표
    console.log('=== 클리어율 + 3층 사망률 ===\n')
    console.log('| 변형 | 목화 CR | 목화 3층† | 금수 CR | 금수 3층† | 토단일 CR | 토단일 3층† |')
    console.log('|------|---------|----------|---------|----------|-----------|----------|')
    for (const variant of HP_VARIANTS) {
      const cells = grid.filter(c => c.variant === variant.label)
      const mh = cells.find(c => c.preset === '목화')!
      const gs = cells.find(c => c.preset === '금수')!
      const td = cells.find(c => c.preset === '토단일')!
      console.log(
        `| ${variant.label.padEnd(8)} | ${pct(mh.clearRate/100).padStart(5)}% | ${pct(mh.floor3DeathPct/100).padStart(5)}% | ${pct(gs.clearRate/100).padStart(5)}% | ${pct(gs.floor3DeathPct/100).padStart(5)}% | ${pct(td.clearRate/100).padStart(6)}% | ${pct(td.floor3DeathPct/100).padStart(5)}% |`
      )
    }

    // 2단계 선별: "금수 최대 상승 & 토단일 40% 이내"
    console.log('\n=== 2단계 선별 기준 ===\n')
    const baseline = grid.filter(c => c.variant === '현행(680)')
    const baseGs = baseline.find(c => c.preset === '금수')!

    interface CandidateEval {
      variant: string; gsRate: number; gsDelta: number; tdRate: number; tdOk: boolean
      mhRate: number; gap: number; spread: number
    }
    const candidates: CandidateEval[] = []

    for (const variant of HP_VARIANTS.slice(1)) {  // 현행 제외
      const cells = grid.filter(c => c.variant === variant.label)
      const gs = cells.find(c => c.preset === '금수')!
      const mh = cells.find(c => c.preset === '목화')!
      const td = cells.find(c => c.preset === '토단일')!
      const rates = [mh.clearRate, gs.clearRate, td.clearRate]
      const gap = Math.max(...rates) - Math.min(...rates)
      const center = 30  // 목표 중심
      const spread = rates.reduce((sum, r) => sum + Math.abs(r - center), 0)

      candidates.push({
        variant: variant.label,
        gsRate: gs.clearRate,
        gsDelta: gs.clearRate - baseGs.clearRate,
        tdRate: td.clearRate,
        tdOk: td.clearRate <= 40,
        mhRate: mh.clearRate,
        gap,
        spread,
      })
    }

    console.log('| 변형 | 금수 | 금수Δ | 토단일 | ≤40% | 목화 | 격차 | 편차합 |')
    console.log('|------|------|-------|--------|------|------|------|--------|')
    for (const c of candidates) {
      console.log(
        `| ${c.variant.padEnd(8)} | ${c.gsRate.toFixed(1)}% | +${c.gsDelta.toFixed(1)}%p | ${c.tdRate.toFixed(1)}% | ${c.tdOk ? '✅' : '❌'} | ${c.mhRate.toFixed(1)}% | ${c.gap.toFixed(1)}%p | ${c.spread.toFixed(1)} |`
      )
    }

    // 최적 안 선택
    const valid = candidates.filter(c => c.tdOk)
    if (valid.length > 0) {
      // 금수 최대 상승 우선, 동률 시 편차합 최소
      valid.sort((a, b) => b.gsDelta - a.gsDelta || a.spread - b.spread)
      const best = valid[0]
      console.log(`\n✅ 선택: ${best.variant} (금수 +${best.gsDelta.toFixed(1)}%p, 토단일 ${best.tdRate.toFixed(1)}%, 격차 ${best.gap.toFixed(1)}%p)`)
    } else {
      console.log('\n❌ 토단일 40% 이내 조건 충족 안 없음')
    }

    console.log('\n========================================\n')

    expect(grid.length).toBe(HP_VARIANTS.length * PRESETS.length)
  })
})
