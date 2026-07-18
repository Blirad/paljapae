/**
 * Recipe K 사주별 승격 — 4벌 측정 (2026-07-16 이든 처방)
 *
 * 금수 K=0.60 / K=0.65 (현재 40.6% 과열 → 하향)
 * 토단일 K=1.3 / K=1.5  (현재 18.1% 부족 → 상향)
 * 목화 K=0.8 동결 (32.9% 안정)
 *
 * 공식: M = max(하한, min(5.0, 1 + K / (성립률%/100)))
 * 금수 하한: 1.6 / 나머지 하한: 2.0
 *
 * 구조: top-level await import (vitest ESM 규칙 준수)
 *   balance mock → COMBO_RULESET_VERSION: 'recipe'
 *   RECIPE_MULTIPLIER_BY_PRESET은 런타임에 모듈 참조를 통해 패치
 */

import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import type { Element } from '../types/game'

// ─── balance mock (top-level, hoisting 대응) ──────────────────────────────────

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return {
    ...(actual as Record<string, unknown>),
    COMBO_RULESET_VERSION: 'recipe',
  }
})

// ─── top-level import (vi.mock 이후) ─────────────────────────────────────────

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const balanceModule = await import('../engine/balance')

// ─── 성립률 (0단계 측정값) ───────────────────────────────────────────────────

const FORMATION_RATES: Record<string, Record<string, number>> = {
  geumSu: {
    fusion_forest:   4.37 + 0.20,    // 4.57%
    fusion_spring:   13.16 + 2.39,   // 15.55%
    fusion_mine:     4.42 + 0.20,    // 4.62%
    fusion_kiln:     1.11,
    fusion_wildfire: 0,
    fusion_keen:     41.89 + 34.91,  // 76.80%
    fusion_snipe:    15.41 + 23.84,  // 39.25%
    fusion_harvest:  6.59 + 6.00,    // 12.59%
    fusion_pierce:   0,
    fusion_temper:   3.28 + 0.19,    // 3.47%
  },
  toDanil: {
    fusion_forest:   0.09,
    fusion_spring:   0.34,
    fusion_mine:     17.30 + 2.33,   // 19.63%
    fusion_kiln:     7.98,
    fusion_wildfire: 0,
    fusion_keen:     10.61 + 2.83,   // 13.44%
    fusion_snipe:    20.95 + 5.01,   // 25.96%
    fusion_harvest:  9.41,
    fusion_pierce:   0,
    fusion_temper:   0.09,
  },
}

const RECIPE_NAMES = [
  'fusion_forest', 'fusion_spring', 'fusion_mine', 'fusion_kiln', 'fusion_wildfire',
  'fusion_keen', 'fusion_snipe', 'fusion_harvest', 'fusion_pierce', 'fusion_temper',
]

// ─── 배율 산출 함수 ───────────────────────────────────────────────────────────

function computeMultiplier(formationRate: number, preset: string, K: number): number {
  if (formationRate === 0) return 3.0
  const mult = 1 + K / (formationRate / 100)
  const lowerBound = preset === 'geumSu' ? 1.6 : 2.0
  return Math.min(Math.max(mult, lowerBound), 5.0)
}

function buildMultiplierTable(preset: string, K: number): Record<string, number> {
  const table: Record<string, number> = {}
  for (const recipe of RECIPE_NAMES) {
    const rate = FORMATION_RATES[preset]?.[recipe] ?? 0
    table[recipe] = computeMultiplier(rate, preset, K)
  }
  return table
}

// ─── 목화 배율표 (K=0.8 동결) ─────────────────────────────────────────────────
const MOK_HWA_TABLE: Record<string, number> = {
  fusion_forest:   2.75,
  fusion_spring:   2.64,
  fusion_mine:     5.00,
  fusion_kiln:     2.75,
  fusion_wildfire: 5.00,
  fusion_keen:     2.75,
  fusion_snipe:    2.32,
  fusion_harvest:  2.64,
  fusion_pierce:   5.00,
  fusion_temper:   5.00,
}

// ─── 토단일 기존 배율표 (K=0.8 기준, balance.ts 현재 값) ─────────────────────
const TO_DANIL_TABLE_K08: Record<string, number> = {
  fusion_forest:   5.00,
  fusion_spring:   5.00,
  fusion_mine:     5.00,
  fusion_kiln:     3.31,   // 현재값 (이든 지시 원문 "fusion_kiln 3.31" 확인)
  fusion_wildfire: 3.00,
  fusion_keen:     5.00,
  fusion_snipe:    5.00,
  fusion_harvest:  5.00,
  fusion_pierce:   3.00,
  fusion_temper:   5.00,
}

// 금수 기존 배율표 (K=0.8 기준)
const GEUM_SU_TABLE_K08: Record<string, number> = {
  fusion_forest:   5.00,
  fusion_spring:   5.00,
  fusion_mine:     5.00,
  fusion_kiln:     5.00,
  fusion_wildfire: 3.00,
  fusion_keen:     2.04,
  fusion_snipe:    3.04,
  fusion_harvest:  5.00,
  fusion_pierce:   3.00,
  fusion_temper:   5.00,
}

// ─── 프리셋 설정 ──────────────────────────────────────────────────────────────

const PRESETS_CONFIG = {
  geumSu: {
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
  },
  toDanil: {
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
  },
}

const RUNS = 1000

// ─── 시뮬 헬퍼 ───────────────────────────────────────────────────────────────

function runSimulation(
  presetKey: 'geumSu' | 'toDanil',
  newTable: Record<string, number>,
) {
  // balance 모듈의 RECIPE_MULTIPLIER_BY_PRESET 런타임 패치
  const presetObj = (balanceModule as any).RECIPE_MULTIPLIER_BY_PRESET
  if (presetObj) {
    presetObj[presetKey] = newTable
  }

  const presetCfg = PRESETS_CONFIG[presetKey]
  const talismans = selectTalismanBySaju(presetCfg.dist)
  const favorableElement = getFavorableElement(presetCfg.ilgan)

  ;(globalThis as any).__recipeLog = []
  ;(globalThis as any).__toDanilAlphaLog = undefined

  let cleared = 0
  const aggregatedRecipeLog: Record<string, { count: number; damage: number }> = {}

  for (let i = 0; i < RUNS; i++) {
    const result = simulateFullCapRun(i * 12345 + 7777, {
      elementDist: presetCfg.dist,
      favorableElement,
      enableFloorReward: true,
      activePassiveIds: talismans,
      enableEffectMode: true,
    })
    if (result.victory) cleared++
  }

  const recipeLog = (globalThis as any).__recipeLog || []
  for (const { recipeId, damage } of recipeLog) {
    if (!aggregatedRecipeLog[recipeId]) aggregatedRecipeLog[recipeId] = { count: 0, damage: 0 }
    aggregatedRecipeLog[recipeId].count++
    aggregatedRecipeLog[recipeId].damage += damage
  }

  const alphaLog = (globalThis as any).__toDanilAlphaLog
  const alphaAttempts: number = alphaLog?.attempts ?? 0
  const alphaSuccesses: number = alphaLog?.successes ?? 0

  const clearRate = (cleared / RUNS) * 100
  let totalDamage = 0
  for (const d of Object.values(aggregatedRecipeLog)) totalDamage += d.damage

  return { clearRate, aggregatedRecipeLog, totalDamage, alphaAttempts, alphaSuccesses }
}

function printBreakdown(
  label: string,
  K: number,
  clearRate: number,
  aggregatedRecipeLog: Record<string, { count: number; damage: number }>,
  totalDamage: number,
  alphaAttempts?: number,
  alphaSuccesses?: number,
) {
  console.log(`\n[${label} K=${K} 결과]`)
  console.log(`  클리어율: ${clearRate.toFixed(2)}% (게이트 25~40: ${clearRate >= 25 && clearRate <= 40 ? 'PASS' : 'FAIL'})`)
  if (alphaAttempts !== undefined) {
    const alphaRate = alphaAttempts > 0 ? ((alphaSuccesses! / alphaAttempts) * 100).toFixed(1) : '0'
    console.log(`  소응축 α: ${alphaSuccesses}/${alphaAttempts} (성립률 ${alphaRate}%)`)
  }
  console.log(`  딜 분해:`)
  for (const [recipeId, data] of Object.entries(aggregatedRecipeLog).sort((a, b) => b[1].damage - a[1].damage)) {
    const pct = totalDamage > 0 ? ((data.damage / totalDamage) * 100).toFixed(1) : '0'
    const avg = data.count > 0 ? (data.damage / data.count).toFixed(1) : '0'
    console.log(`    ${recipeId.padEnd(20)}: ${String(data.count).padStart(5)}회 × avg${avg.padStart(7)} = ${data.damage} (${pct}%)`)
  }
}

// ─── 측정 결과 저장소 ─────────────────────────────────────────────────────────

const measurementResults: Array<{
  id: string
  preset: string
  label: string
  K: number
  clearRate: number
  breakdown: Record<string, { count: number; damage: number }>
  totalDamage: number
  alphaAttempts?: number
  alphaSuccesses?: number
  multiplierTable: Record<string, number>
}> = []

// ─── 배율표 사전 출력 ─────────────────────────────────────────────────────────

describe('Recipe K 사주별 승격 — 배율표 + 4벌 시뮬 측정', () => {
  it('배율표 산출 (K 승격 구조 확인)', () => {
    console.log('\n' + '═'.repeat(100))
    console.log('K 사주별 승격 — 배율표 산출 (공식: M = 1 + K / 성립률%)')
    console.log('═'.repeat(100))

    const gs060 = buildMultiplierTable('geumSu', 0.60)
    const gs065 = buildMultiplierTable('geumSu', 0.65)
    const td13  = buildMultiplierTable('toDanil', 1.3)
    const td15  = buildMultiplierTable('toDanil', 1.5)

    console.log('\n[금수 배율 비교]')
    console.log('| 레시피              | 성립률(%) | K=0.8(현재) | K=0.60 | K=0.65 |')
    console.log('|---------------------|-----------|-------------|--------|--------|')
    for (const recipe of RECIPE_NAMES) {
      const rate = FORMATION_RATES.geumSu?.[recipe] ?? 0
      const c = GEUM_SU_TABLE_K08[recipe]?.toFixed(2) ?? '-'
      const a = gs060[recipe].toFixed(2)
      const b = gs065[recipe].toFixed(2)
      console.log(`| ${recipe.padEnd(19)} | ${rate.toFixed(2).padStart(9)} | ${c.padStart(11)} | ${a.padStart(6)} | ${b.padStart(6)} |`)
    }

    console.log('\n[토단일 배율 비교]')
    console.log('| 레시피              | 성립률(%) | K=0.8(현재) | K=1.3  | K=1.5  |')
    console.log('|---------------------|-----------|-------------|--------|--------|')
    for (const recipe of RECIPE_NAMES) {
      const rate = FORMATION_RATES.toDanil?.[recipe] ?? 0
      const c = TO_DANIL_TABLE_K08[recipe]?.toFixed(2) ?? '-'
      const a = td13[recipe].toFixed(2)
      const b = td15[recipe].toFixed(2)
      console.log(`| ${recipe.padEnd(19)} | ${rate.toFixed(2).padStart(9)} | ${c.padStart(11)} | ${a.padStart(6)} | ${b.padStart(6)} |`)
    }

    console.log('\n[핵심 변화]')
    console.log(`  금수 fusion_keen 76.80%: K=0.8→${GEUM_SU_TABLE_K08.fusion_keen?.toFixed(2)} / K=0.60→${gs060.fusion_keen.toFixed(2)} / K=0.65→${gs065.fusion_keen.toFixed(2)}`)
    console.log(`  금수 fusion_snipe 39.25%: K=0.8→${GEUM_SU_TABLE_K08.fusion_snipe?.toFixed(2)} / K=0.60→${gs060.fusion_snipe.toFixed(2)} / K=0.65→${gs065.fusion_snipe.toFixed(2)}`)
    console.log(`  금수 fusion_spring 15.55%: K=0.8→${GEUM_SU_TABLE_K08.fusion_spring?.toFixed(2)} / K=0.60→${gs060.fusion_spring.toFixed(2)} / K=0.65→${gs065.fusion_spring.toFixed(2)}`)
    console.log(`  토단일 fusion_kiln 7.98%: K=0.8→${TO_DANIL_TABLE_K08.fusion_kiln?.toFixed(2)} / K=1.3→${td13.fusion_kiln.toFixed(2)} / K=1.5→${td15.fusion_kiln.toFixed(2)}`)
    console.log(`  토단일 fusion_snipe 25.96%: K=0.8→${TO_DANIL_TABLE_K08.fusion_snipe?.toFixed(2)} / K=1.3→${td13.fusion_snipe.toFixed(2)} / K=1.5→${td15.fusion_snipe.toFixed(2)}`)

    // K 하향이 keen 배율을 낮추는지 검증
    expect(gs060.fusion_keen).toBeLessThan(2.04)
    expect(gs065.fusion_keen).toBeLessThan(2.04)
    // K 상향이 kiln 배율을 올리는지 검증 (7.98% 기준)
    expect(td13.fusion_kiln).toBeGreaterThan(TO_DANIL_TABLE_K08.fusion_kiln)
    expect(td15.fusion_kiln).toBeGreaterThan(TO_DANIL_TABLE_K08.fusion_kiln)
  })

  it('측정 A — 금수 K=0.60 1000판', { timeout: 300000 }, () => {
    const K = 0.60
    const table = buildMultiplierTable('geumSu', K)
    console.log('\n' + '─'.repeat(80))
    console.log(`측정 A: 금수 K=${K} 시뮬 시작 (1000판)`)

    const { clearRate, aggregatedRecipeLog, totalDamage } = runSimulation('geumSu', table)
    printBreakdown('금수', K, clearRate, aggregatedRecipeLog, totalDamage)

    measurementResults.push({
      id: 'A', preset: 'geumSu', label: '금수', K,
      clearRate, breakdown: aggregatedRecipeLog, totalDamage, multiplierTable: table,
    })

    expect(clearRate).toBeGreaterThanOrEqual(0)
    expect(clearRate).toBeLessThanOrEqual(100)
  })

  it('측정 B — 금수 K=0.65 1000판', { timeout: 300000 }, () => {
    const K = 0.65
    const table = buildMultiplierTable('geumSu', K)
    console.log('\n' + '─'.repeat(80))
    console.log(`측정 B: 금수 K=${K} 시뮬 시작 (1000판)`)

    const { clearRate, aggregatedRecipeLog, totalDamage } = runSimulation('geumSu', table)
    printBreakdown('금수', K, clearRate, aggregatedRecipeLog, totalDamage)

    measurementResults.push({
      id: 'B', preset: 'geumSu', label: '금수', K,
      clearRate, breakdown: aggregatedRecipeLog, totalDamage, multiplierTable: table,
    })

    expect(clearRate).toBeGreaterThanOrEqual(0)
    expect(clearRate).toBeLessThanOrEqual(100)
  })

  it('측정 C — 토단일 K=1.3 1000판', { timeout: 300000 }, () => {
    const K = 1.3
    const table = buildMultiplierTable('toDanil', K)
    console.log('\n' + '─'.repeat(80))
    console.log(`측정 C: 토단일 K=${K} 시뮬 시작 (1000판)`)

    const { clearRate, aggregatedRecipeLog, totalDamage, alphaAttempts, alphaSuccesses } = runSimulation('toDanil', table)
    printBreakdown('토단일', K, clearRate, aggregatedRecipeLog, totalDamage, alphaAttempts, alphaSuccesses)

    measurementResults.push({
      id: 'C', preset: 'toDanil', label: '토단일', K,
      clearRate, breakdown: aggregatedRecipeLog, totalDamage,
      alphaAttempts, alphaSuccesses, multiplierTable: table,
    })

    expect(clearRate).toBeGreaterThanOrEqual(0)
    expect(clearRate).toBeLessThanOrEqual(100)
  })

  it('측정 D — 토단일 K=1.5 1000판', { timeout: 300000 }, () => {
    const K = 1.5
    const table = buildMultiplierTable('toDanil', K)
    console.log('\n' + '─'.repeat(80))
    console.log(`측정 D: 토단일 K=${K} 시뮬 시작 (1000판)`)

    const { clearRate, aggregatedRecipeLog, totalDamage, alphaAttempts, alphaSuccesses } = runSimulation('toDanil', table)
    printBreakdown('토단일', K, clearRate, aggregatedRecipeLog, totalDamage, alphaAttempts, alphaSuccesses)

    measurementResults.push({
      id: 'D', preset: 'toDanil', label: '토단일', K,
      clearRate, breakdown: aggregatedRecipeLog, totalDamage,
      alphaAttempts, alphaSuccesses, multiplierTable: table,
    })

    expect(clearRate).toBeGreaterThanOrEqual(0)
    expect(clearRate).toBeLessThanOrEqual(100)
  })

  it('결과 파일 저장', () => {
    const resultPath = '/Users/bilard/.openclaw/workspace/ZERA_RECIPE_K_RAW_20260716.json'
    fs.writeFileSync(resultPath, JSON.stringify(measurementResults, null, 2))
    console.log(`\n결과 저장: ${resultPath}`)
    console.log('측정 완료 요약:')
    for (const r of measurementResults) {
      const gate = r.clearRate >= 25 && r.clearRate <= 40 ? 'PASS' : 'FAIL'
      console.log(`  ${r.id} [${r.label} K=${r.K}]: ${r.clearRate.toFixed(2)}% — ${gate}`)
    }
    expect(measurementResults.length).toBe(4)
  })
})
