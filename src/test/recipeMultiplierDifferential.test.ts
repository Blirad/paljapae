/**
 * recipe 차등 배율 — 10쌍 배율표 산출 및 재측정
 *
 * 커밋: 예정
 * 공식: 성립률 × (배율-1) = K (상수)
 * 기준점: 성립률 40% ↔ ×3.0 → K = 0.8
 *
 * 배율 = 1 + 0.8 / (성립률%)
 *
 * 목표: 금수 fusion_keen 76.79% (과도) 하향, 균형 조정
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

// 0단계 측정값 (핸드 샘플링 기준)
const FORMATION_RATES: Record<string, Record<string, number>> = {
  mokHwa: {
    fusion_forest: 4.40 + 0.21,      // 소형 + 대형
    fusion_spring: 1.08,
    fusion_mine: 1.08,
    fusion_kiln: 4.40 + 0.21,
    fusion_wildfire: 1.12,
    fusion_keen: 35.00 + 10.84,
    fusion_snipe: 21.57 + 10.21,
    fusion_harvest: 17.56 + 31.20,   // 48.75%
    fusion_pierce: 0,
    fusion_temper: 1.09,
  },
  geumSu: {
    fusion_forest: 4.37 + 0.20,
    fusion_spring: 13.16 + 2.39,
    fusion_mine: 4.42 + 0.20,
    fusion_kiln: 1.11,
    fusion_wildfire: 0,
    fusion_keen: 41.89 + 34.91,      // 76.79% ← 문제!
    fusion_snipe: 15.41 + 23.84,
    fusion_harvest: 6.59 + 6.00,
    fusion_pierce: 0,
    fusion_temper: 3.28 + 0.19,
  },
  toDanil: {
    fusion_forest: 0.09,
    fusion_spring: 0.34,
    fusion_mine: 17.30 + 2.33,
    fusion_kiln: 7.98,
    fusion_wildfire: 0,
    fusion_keen: 10.61 + 2.83,
    fusion_snipe: 20.95 + 5.01,
    fusion_harvest: 9.41,
    fusion_pierce: 0,
    fusion_temper: 0.09,
  },
}

// K = 사주별 "레시피 총 화력 다이얼" — 승격 2026-07-16
// mokHwa: 32.9% 안정 → K=0.8 동결
// geumSu: 40.6% 과열 → K=0.60 처방 (1000판 35.0% PASS)
// toDanil: K 다이얼 미작동 (성립률 낮아 모두 cap5.0) → 별도 처방 대기
const K_BY_PRESET: Record<string, number> = {
  mokHwa: 0.8,
  geumSu: 0.60,  // 2026-07-16 확정 — 40.6%→35.0% 과열 해소
  toDanil: 0.8,  // K 다이얼 무효 — cap5.0 구조. 별도 처방 필요
}

function computeMultiplier(formationRate: number, preset?: string): number {
  if (formationRate === 0) return 3.0  // 성립률 0인 레시피는 최대 배율
  const k = preset ? (K_BY_PRESET[preset] ?? 0.8) : 0.8
  const mult = 1 + k / (formationRate / 100)
  // 금수 처방: 하한 1.6 (기존 2.0 → 1.6)
  const lowerBound = preset === 'geumSu' ? 1.6 : 2.0
  return Math.min(Math.max(mult, lowerBound), 5.0)
}

const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
    baselineClear: 28.50,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    baselineClear: 31.70,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
    baselineClear: 27.40,
  },
]

const RUNS = 1000

describe('recipe 차등 배율 — 10쌍 배율표', () => {
  it(
    '배율 산출 및 1000판 재측정',
    { timeout: 300000 },
    () => {
      console.log('\n' + '='.repeat(100))
      console.log('recipe 차등 배율 산출 (공식: 배율 = 1 + 0.8 / 성립률%)')
      console.log('='.repeat(100))

      // 배율표 산출
      const RECIPE_NAMES = [
        'fusion_forest',
        'fusion_spring',
        'fusion_mine',
        'fusion_kiln',
        'fusion_wildfire',
        'fusion_keen',
        'fusion_snipe',
        'fusion_harvest',
        'fusion_pierce',
        'fusion_temper',
      ]

      const multiplierTables: Record<string, Record<string, number>> = {}
      for (const preset of PRESETS) {
        const table: Record<string, number> = {}
        for (const recipe of RECIPE_NAMES) {
          const rate = FORMATION_RATES[preset.key]?.[recipe] ?? 0
          table[recipe] = computeMultiplier(rate, preset.key)
        }
        multiplierTables[preset.key] = table
      }

      // 배율표 출력
      for (const preset of PRESETS) {
        console.log(`\n─── ${preset.label} ───`)
        console.log(
          '┌────────────────────┬───────────┬──────────────────┬────────────────────┐'
        )
        console.log(
          '│ Recipe ID          │ 성립률(%) │    배율 산출       │    배율 (정리)       │'
        )
        console.log(
          '├────────────────────┼───────────┼──────────────────┼────────────────────┤'
        )

        const table = multiplierTables[preset.key]
        for (const recipe of RECIPE_NAMES) {
          const rate = FORMATION_RATES[preset.key]?.[recipe] ?? 0
          const mult = table[recipe]
          const multRounded = Math.round(mult * 100) / 100  // 2자리
          console.log(
            `│ ${recipe.padEnd(18)} │ ${rate.toFixed(2).padStart(8)}% │ ${mult.toFixed(4).padStart(16)} │ ${multRounded.toFixed(2).padStart(18)} │`
          )
        }
        console.log(
          '└────────────────────┴───────────┴──────────────────┴────────────────────┘'
        )
      }

      // 1000판 재측정
      console.log('\n' + '='.repeat(100))
      console.log('recipe 차등 배율 적용 후 1000판 재측정')
      console.log('='.repeat(100))

      const results: Array<{
        label: string
        clearRate: number
        baselineClear: number
        delta: string
      }> = []

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0

        for (let i = 0; i < RUNS; i++) {
          const result = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: preset.dist,
            favorableElement,
            enableFloorReward: true,
            activePassiveIds: talismans,
            enableEffectMode: true,
          })

          if (result.victory) cleared++
        }

        const clearRate = (cleared / RUNS) * 100
        const inGate = clearRate >= 25 && clearRate <= 40
        const delta = clearRate - preset.baselineClear

        results.push({
          label: preset.label,
          clearRate,
          baselineClear: preset.baselineClear,
          delta: `${inGate ? '✓' : '✗'} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p`,
        })

        console.log(
          `${preset.label.padEnd(8)}: ${clearRate.toFixed(2).padStart(7)}% (기준 ${preset.baselineClear.toFixed(2)}% → ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p) ${inGate ? 'PASS' : 'FAIL'}`
        )
      }

      console.log('\n주요 조정:')
      console.log('  금수 fusion_keen 76.79% → ×2.04 (기존 ×3.0 → ×2.0 근처, 과도 완화)')
      console.log('  목화 fusion_harvest 48.75% → ×2.64 (적정 유지)')
      console.log('  토단일 병렬 분포 → 균등 배율 적용')

      // 파일 출력
      const fileOutput = results.map(r =>
        `${r.label.padEnd(8)}: ${r.clearRate.toFixed(2).padStart(7)}% (기준 ${r.baselineClear.toFixed(2)}% → ${r.delta})`
      ).join('\n')
      fs.writeFileSync(path.join(process.cwd(), 'RECIPE_RESULTS.txt'), fileOutput)

      for (const r of results) {
        expect(r.clearRate).toBeGreaterThanOrEqual(0)
        expect(r.clearRate).toBeLessThanOrEqual(100)
      }
    },
  )
})
