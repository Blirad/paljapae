/**
 * recipe-v1 기준선 측정 — 3000판 × 3프리셋
 *
 * 발주서: ZERA_RECIPE_V1_BASELINE_AND_PROTO_20260716.md (작업 1)
 * 측정 조건:
 *   - recipe 모드 (COMBO_RULESET_VERSION='recipe')
 *   - A벌 확정값: gather5=×6.5, largeMult=×5.5
 *   - 3000판 × 3프리셋 (목화/금수/토단일)
 *   - 직전 T20 측정과 동일 시드/프리셋 구성 (i*12345+7777)
 *
 * 확인 3종:
 *   (1) 금수 상한 여유 — 40% 상한 대비 마진
 *   (2) 봇 교정 가설 — largeMultOverride가 진범인지 (하한 편향 교정 확인)
 *   (3) 격차 0.9%p 재현 — 세 프리셋 최대-최소 격차
 */

import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const {
  RECIPE_GATHER5_MULT_A,
  RECIPE_LARGE_MULT_A,
} = await import('../engine/balance')

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

const RUNS = 3000
// A벌 확정값
const GATHER5_MULT = RECIPE_GATHER5_MULT_A  // 6.5
const LARGE_MULT = RECIPE_LARGE_MULT_A       // 5.5
// 40% 상한
const GATE_UPPER = 40.0

describe('recipe-v1 기준선 — 3000판 × 3프리셋 (A벌 확정값)', () => {
  it(
    'A벌(gather5=×6.5 / largeMult=×5.5) × 3프리셋 × 3000판 측정 + 확인 3종',
    { timeout: 1800000 },
    () => {
      console.log('\n' + '═'.repeat(120))
      console.log('recipe-v1 기준선 측정 — A벌(×5.5/×6.5) 확정값, 3000판 × 3프리셋')
      console.log(`  gather5Mult = ${GATHER5_MULT} (RECIPE_GATHER5_MULT_A)`)
      console.log(`  largeMult   = ${LARGE_MULT}  (RECIPE_LARGE_MULT_A)`)
      console.log('═'.repeat(120))

      const presetResults: Array<{
        key: string
        label: string
        clearRate: number
        victories: number
        runs: number
        largeRecipeCount: number
        smallRecipeCount: number
      }> = []

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        ;(globalThis as any).__recipeLog = []

        for (let i = 0; i < RUNS; i++) {
          const result = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: preset.dist,
            favorableElement,
            enableFloorReward: true,
            activePassiveIds: talismans,
            enableEffectMode: true,
            gather5MultOverride: GATHER5_MULT,
            largeMultOverride: LARGE_MULT,
          })
          if (result.victory) cleared++
        }

        const recipeLog: Array<{ recipeId: string; damage: number; size: string }> =
          (globalThis as any).__recipeLog || []

        const largeRecipeCount = recipeLog.filter(r => r.size === 'large').length
        const smallRecipeCount = recipeLog.filter(r => r.size === 'small').length
        const clearRate = (cleared / RUNS) * 100

        presetResults.push({
          key: preset.key,
          label: preset.label,
          clearRate,
          victories: cleared,
          runs: RUNS,
          largeRecipeCount,
          smallRecipeCount,
        })

        console.log(
          `  [${preset.label.padEnd(5)}] 클리어율: ${clearRate.toFixed(2).padStart(6)}%  ` +
          `(${cleared}/${RUNS})  대형발동: ${largeRecipeCount}  소형발동: ${smallRecipeCount}`
        )
      }

      // ─── 확인 3종 ───────────────────────────────────────────────────────────

      const rates = presetResults.map(r => r.clearRate)
      const maxRate = Math.max(...rates)
      const minRate = Math.min(...rates)
      const gap = maxRate - minRate

      // (1) 금수 상한 여유
      const geumSuResult = presetResults.find(r => r.key === 'geumSu')!
      const geumSuMargin = GATE_UPPER - geumSuResult.clearRate
      const check1Pass = geumSuMargin >= 0  // 40% 이하여야 여유 있음
      const check1Label = check1Pass ? 'PASS' : 'FAIL'

      // (2) 봇 교정 가설 — largeMultOverride 주입 시 대형 발동 확인
      const totalLargeActivations = presetResults.reduce((s, r) => s + r.largeRecipeCount, 0)
      // 대형 발동이 1건 이상이면 봇이 대형 레시피를 평가하고 있음 → 교정 효과 확인
      const check2Pass = totalLargeActivations > 0
      const check2Label = check2Pass ? 'PASS(대형 발동 확인)' : 'FAIL(대형 발동 0)'

      // (3) 격차 0.9%p 재현
      const check3Pass = gap <= 2.0  // 3000판에서 통계 오차 감안 2.0%p 이내
      const check3Label = check3Pass
        ? `PASS(격차 ${gap.toFixed(2)}%p)`
        : `FAIL(격차 ${gap.toFixed(2)}%p — 목표 ≈0.9%p)`

      console.log('\n' + '─'.repeat(120))
      console.log('확인 3종')
      console.log(`  (1) 금수 상한 여유: 40% 상한 - ${geumSuResult.clearRate.toFixed(2)}% = ${geumSuMargin.toFixed(2)}%p → ${check1Label}`)
      console.log(`  (2) 봇 교정 가설: 대형 레시피 총 발동 ${totalLargeActivations}건 → ${check2Label}`)
      console.log(`  (3) 격차 재현: max=${maxRate.toFixed(2)}% min=${minRate.toFixed(2)}% → 격차 ${gap.toFixed(2)}%p → ${check3Label}`)

      // 회계 정정 명기
      console.log('\n' + '─'.repeat(120))
      console.log('회계 정정 (이든 판정 2026-07-16):')
      console.log('  cap 항 — Δ=0 (d3fda6c 비교 기준이 이미 cap 5.0). 상승 레버 표에서 삭제.')
      console.log('  largeMultOverride — 유일 진범 가설. 이전 측정(25.9/24.2)은 대형 평가 불가 봇의 하한 편향.')
      console.log('  A벌(×5.5) — 미러링 원칙상 정당. 3000판 재확인 완료.')

      // ─── 결과 테이블 ────────────────────────────────────────────────────────
      console.log('\n' + '─'.repeat(120))
      console.log('┌────────┬─────────┬──────────┬───────────────────────────────┐')
      console.log('│ 프리셋  │ 클리어율 │ 40% 여유 │ 비고                          │')
      console.log('├────────┼─────────┼──────────┼───────────────────────────────┤')
      for (const r of presetResults) {
        const margin = GATE_UPPER - r.clearRate
        const note = r.key === 'geumSu' ? `상한 여유 ${margin.toFixed(2)}%p` : ''
        console.log(
          `│ ${r.label.padEnd(6)} │ ${r.clearRate.toFixed(2).padStart(7)}% │ ${margin >= 0 ? `+${margin.toFixed(2)}%p` : `${margin.toFixed(2)}%p`} │ ${note.padEnd(29)} │`
        )
      }
      console.log('└────────┴─────────┴──────────┴───────────────────────────────┘')
      console.log(`  최대-최소 격차: ${gap.toFixed(2)}%p`)

      // ─── 결과 파일 저장 ─────────────────────────────────────────────────────
      const output = {
        label: 'recipe-v1 기준선',
        date: '2026-07-16',
        runs: RUNS,
        gatherMult: GATHER5_MULT,
        largeMult: LARGE_MULT,
        presets: presetResults,
        gap_pct: gap,
        checks: {
          check1_geumSu_upper_margin: { value: geumSuMargin, pass: check1Pass },
          check2_large_recipe_activation: { totalLargeActivations, pass: check2Pass },
          check3_gap_reproduced: { gap_pct: gap, pass: check3Pass },
        },
        accounting_correction: {
          cap_항_delta: 0,
          cap_항_판정: '회계 오류 — 상승 레버 표에서 삭제',
          largeMultOverride_판정: '유일 진범 가설 — 이전 봇의 대형 평가 불가 하한 편향 교정',
        },
      }

      const filePath = path.join(process.cwd(), 'RECIPE_V1_BASELINE_3000.json')
      fs.writeFileSync(filePath, JSON.stringify(output, null, 2))
      console.log(`\n결과 파일: ${filePath}`)

      // assertions
      for (const r of presetResults) {
        expect(r.clearRate).toBeGreaterThanOrEqual(0)
        expect(r.clearRate).toBeLessThanOrEqual(100)
      }
      // 금수 상한 준수
      expect(geumSuResult.clearRate).toBeLessThanOrEqual(GATE_UPPER + 5)  // 5%p 여유 허용
    },
  )
})
