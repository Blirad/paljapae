/**
 * v3r 순정 기준선 — 역생 ×1.2 단독 효과 측정 (B-6, 이든 지시 2026-07-16)
 *
 * COMBO_RULESET_VERSION: 'v3' (기본값, mock 없음) + ENABLE_YONGSIN_DESCENT: false (기본값)
 *   → v3r 순정 모드. 현재 코드 유일한 v3 영향 diff = 역생 ×1.2 뿐.
 *   → balance-v3(632c30a, 강림 OFF) 39.43/35.93/27.77 대비 시프트 = 역생 단독 효과.
 *
 * 조건은 descent0Baseline v3BaseRate 측정과 동일:
 *   dist / getFavorableElement(ilgan) / floorReward true / selectTalismanBySaju / effectMode true
 *
 * 1000판 × 3프리셋. 통계 분산 ±5%p (1000판, σ≈1.5%).
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import type { Element } from '../types/game'

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
    baselineClear: 39.43,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    baselineClear: 35.93,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
    baselineClear: 27.77,
  },
]

const RUNS = 1000

describe('v3r 순정 기준선 — 역생 ×1.2 단독 시프트 (B-6)', () => {
  it('1000판 × 3프리셋', { timeout: 300000 }, () => {
    const output: string[] = [
      '\n' + '='.repeat(100),
      'v3r 순정 기준선 (v3 ruleset + 강림 OFF) — vs balance-v3(632c30a) = 역생 단독 효과',
      '='.repeat(100),
    ]

    const results: Array<{
      label: string
      clearRate: number
      baselineClear: number
      delta: number
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
      const delta = clearRate - preset.baselineClear
      const status = clearRate >= 25 && clearRate <= 40 ? '✓' : '✗'

      results.push({
        label: preset.label,
        clearRate,
        baselineClear: preset.baselineClear,
        delta,
      })

      const line = `${preset.label.padEnd(8)}: ${clearRate.toFixed(2).padStart(7)}% (balance-v3 ${preset.baselineClear.toFixed(2)}% → 역생시프트 ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p) 게이트25~40 ${status}`
      output.push(line)
      console.log(line)
    }

    output.push('\n결과 요약:')
    fs.writeFileSync(path.join(process.cwd(), 'V3_BASELINE_RESULTS.txt'), output.join('\n'))

    for (const r of results) {
      expect(r.clearRate).toBeGreaterThanOrEqual(0)
      expect(r.clearRate).toBeLessThanOrEqual(100)
    }
  })
})
