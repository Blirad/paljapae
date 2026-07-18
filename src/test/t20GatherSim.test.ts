/**
 * T20 재측정 — recipe 모드 gather5 필살기 계층 + toDanil 배율표 정화
 *
 * 조건:
 *   - recipe 모드 (COMBO_RULESET_VERSION='recipe')
 *   - toDanil 배율표 정화 반영 (K=0.8 공식 단일 경로)
 *   - A벌: gather5 = ×6.5 (RECIPE_GATHER5_MULT_A)
 *   - B벌: gather5 = ×7.0 (RECIPE_GATHER5_MULT_B, gather5MultOverride 주입)
 *
 * 총 6회 측정: 2벌 × 3프리셋(목화/금수/토단일) × 1000판
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
const { RECIPE_GATHER5_MULT_A, RECIPE_GATHER5_MULT_B } = await import('../engine/balance')

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

const RUNS = 1000
const GATE_MIN = 25
const GATE_MAX = 40

type BreakdownEntry = { count: number; damage: number; avgDamage: number; percent: string }

interface PresetResult {
  label: string
  clearRate: number
  gatePass: boolean
  recipeBreakdown: Record<string, BreakdownEntry>
}

function runPresets(gather5Mult: number): PresetResult[] {
  const results: PresetResult[] = []

  for (const preset of PRESETS) {
    const talismans = selectTalismanBySaju(preset.dist)
    const favorableElement = getFavorableElement(preset.ilgan)

    let cleared = 0
    const aggregatedRecipeLog: Record<string, { count: number; damage: number }> = {}

    ;(globalThis as any).__recipeLog = []

    for (let i = 0; i < RUNS; i++) {
      const result = simulateFullCapRun(i * 12345 + 7777, {
        elementDist: preset.dist,
        favorableElement,
        enableFloorReward: true,
        activePassiveIds: talismans,
        enableEffectMode: true,
        gather5MultOverride: gather5Mult,
      })

      if (result.victory) cleared++
    }

    // 레시피 로그 집계
    const recipeLog = (globalThis as any).__recipeLog || []
    for (const { recipeId, damage } of recipeLog) {
      if (!aggregatedRecipeLog[recipeId]) {
        aggregatedRecipeLog[recipeId] = { count: 0, damage: 0 }
      }
      aggregatedRecipeLog[recipeId].count++
      aggregatedRecipeLog[recipeId].damage += damage
    }

    const clearRate = (cleared / RUNS) * 100
    const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX

    // 딜 분해 계산
    const breakdown: Record<string, BreakdownEntry> = {}
    const totalRecipeDamage = Object.values(aggregatedRecipeLog).reduce((s, v) => s + v.damage, 0)

    for (const [recipeId, data] of Object.entries(aggregatedRecipeLog)) {
      const percent = totalRecipeDamage > 0 ? ((data.damage / totalRecipeDamage) * 100).toFixed(1) : '0'
      const avgDamage = data.count > 0 ? data.damage / data.count : 0
      breakdown[recipeId] = { count: data.count, damage: data.damage, avgDamage, percent }
    }

    results.push({ label: preset.label, clearRate, gatePass, recipeBreakdown: breakdown })
  }

  return results
}

describe('T20 재측정 — recipe 모드 gather5 × 2벌', () => {
  it('6회 측정: A벌(×6.5) + B벌(×7.0) × 3프리셋 × 1000판', { timeout: 600000 }, () => {
    console.log('\n' + '═'.repeat(130))
    console.log(`T20 재측정 — recipe gather5 필살기 계층 + toDanil 배율표 정화`)
    console.log(`RECIPE_GATHER5_MULT_A = ${RECIPE_GATHER5_MULT_A}, RECIPE_GATHER5_MULT_B = ${RECIPE_GATHER5_MULT_B}`)
    console.log(`게이트 기준: 토단일 ≥25%, 목화 25~40%, 금수 25~40% (목표 36~38)`)
    console.log('═'.repeat(130))

    // ── A벌 (×6.5) ──
    console.log('\n─── A벌 (gather5=×6.5) ───')
    const resultsA = runPresets(RECIPE_GATHER5_MULT_A)

    for (const r of resultsA) {
      const gateLabel = r.label === '토단일'
        ? (r.clearRate >= 25 ? 'PASS' : 'FAIL')
        : (r.gatePass ? 'PASS' : 'FAIL')
      console.log(`  [${r.label}] 클리어율: ${r.clearRate.toFixed(2)}%  ${gateLabel}`)
    }

    // ── B벌 (×7.0) ──
    console.log('\n─── B벌 (gather5=×7.0) ───')
    const resultsB = runPresets(RECIPE_GATHER5_MULT_B)

    for (const r of resultsB) {
      const gateLabel = r.label === '토단일'
        ? (r.clearRate >= 25 ? 'PASS' : 'FAIL')
        : (r.gatePass ? 'PASS' : 'FAIL')
      console.log(`  [${r.label}] 클리어율: ${r.clearRate.toFixed(2)}%  ${gateLabel}`)
    }

    // ── 요약 테이블 ──
    console.log('\n' + '═'.repeat(130))
    console.log('┌────┬──────────┬─────────┬─────────┬─────────┬──────────────────────┐')
    console.log('│ 벌 │ gather5  │   목화  │   금수  │ 토단일  │      게이트          │')
    console.log('├────┼──────────┼─────────┼─────────┼─────────┼──────────────────────┤')

    const fmtA = resultsA.map(r => r.clearRate.toFixed(1) + '%')
    const gateA = (() => {
      const mok = resultsA[0].gatePass
      const geum = resultsA[1].gatePass
      const to = resultsA[2].clearRate >= 25
      return (mok && geum && to) ? 'ALL PASS' : [
        mok ? '목화 OK' : '목화 FAIL',
        geum ? '금수 OK' : '금수 FAIL',
        to ? '토 OK' : '토 FAIL',
      ].join(' ')
    })()
    console.log(`│ A  │   ×6.5   │ ${fmtA[0].padStart(6)}  │ ${fmtA[1].padStart(6)}  │ ${fmtA[2].padStart(6)}  │ ${gateA.padEnd(20)} │`)

    const fmtB = resultsB.map(r => r.clearRate.toFixed(1) + '%')
    const gateB = (() => {
      const mok = resultsB[0].gatePass
      const geum = resultsB[1].gatePass
      const to = resultsB[2].clearRate >= 25
      return (mok && geum && to) ? 'ALL PASS' : [
        mok ? '목화 OK' : '목화 FAIL',
        geum ? '금수 OK' : '금수 FAIL',
        to ? '토 OK' : '토 FAIL',
      ].join(' ')
    })()
    console.log(`│ B  │   ×7.0   │ ${fmtB[0].padStart(6)}  │ ${fmtB[1].padStart(6)}  │ ${fmtB[2].padStart(6)}  │ ${gateB.padEnd(20)} │`)
    console.log('└────┴──────────┴─────────┴─────────┴─────────┴──────────────────────┘')

    // ── 토단일 딜 분해 (A/B 각각) ──
    const toDanilA = resultsA.find(r => r.label === '토단일')!
    const toDanilB = resultsB.find(r => r.label === '토단일')!

    console.log('\n─── 토단일 딜 분해 (A벌 ×6.5) ───')
    console.log('  (recipe 로그 기준 — gather5는 recipeLog 대상 아님, 아래는 융합 레시피 딜)')
    for (const [id, data] of Object.entries(toDanilA.recipeBreakdown).sort((a, b) => b[1].damage - a[1].damage)) {
      console.log(`  ${id.padEnd(20)}: ${String(data.count).padStart(5)}회 × ${data.avgDamage.toFixed(0).padStart(5)} = ${String(data.damage).padStart(8)} (${data.percent}%)`)
    }

    console.log('\n─── 토단일 딜 분해 (B벌 ×7.0) ───')
    for (const [id, data] of Object.entries(toDanilB.recipeBreakdown).sort((a, b) => b[1].damage - a[1].damage)) {
      console.log(`  ${id.padEnd(20)}: ${String(data.count).padStart(5)}회 × ${data.avgDamage.toFixed(0).padStart(5)} = ${String(data.damage).padStart(8)} (${data.percent}%)`)
    }

    // 결과 저장 (JSON)
    const output = {
      timestamp: new Date().toISOString(),
      gather5A: RECIPE_GATHER5_MULT_A,
      gather5B: RECIPE_GATHER5_MULT_B,
      벌A: resultsA,
      벌B: resultsB,
    }
    const filePath = path.join(process.cwd(), 'T20_GATHER_RESULTS.json')
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2))
    console.log(`\n결과 파일: ${filePath}`)

    // assert: 유효 범위
    for (const r of [...resultsA, ...resultsB]) {
      expect(r.clearRate).toBeGreaterThanOrEqual(0)
      expect(r.clearRate).toBeLessThanOrEqual(100)
    }
  })
})
