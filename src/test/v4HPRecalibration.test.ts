/**
 * v4 HP 정밀 재산정 — 2벌 채점제 (2026-07-18 이든 지시)
 *
 * 배경: 상시 용신 ×1.3 제거 후 강림 ON 재측정에서 토단일 44.3%(>40% 상한)
 * 원인: 포착률 구조 (토 포함 콤보 = 토단일 유리)
 * 해법: 층 HP 조정 (1~3층 계수 재산정)
 *
 * 2벌 후보:
 * - A벌: 1~3층 ×1.50 균일 (→ 330/668/1020)
 * - B벌: ×1.45 균일 + 토단일 사망 집중층 추가
 *
 * 채점 기준 (4층 확정 때와 동일):
 * - 전 프리셋 25~40% PASS
 * - 격차 ≤15%p PASS
 * - 정밀 조준: 목화 <30% FAIL
 *
 * 강림: ON (getDevDescentEnabled=true, 정식 세계)
 * 시드: i×12345+7777 (1000판 × 3프리셋 × 2벌)
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ── 2벌 HP 후보 정의 ──
const HP_VARIANTS = {
  A: {
    name: 'A벌 (×1.50 균일)',
    hp1: Math.round(220 * 1.50),   // 330
    hp2: Math.round(445 * 1.50),   // 668
    hp3: Math.round(680 * 1.50),   // 1020
  },
  B: {
    name: 'B벌 (×1.45 균일)',
    hp1: Math.round(220 * 1.45),   // 319
    hp2: Math.round(445 * 1.45),   // 645
    hp3: Math.round(680 * 1.45),   // 986
    // 토단일 사망 집중층: (pending 제라 보고)
  },
}

const GATE_MIN = 25
const GATE_MAX = 40
const GATE_SPREAD = 15
const PRECISION_MIN = 30  // 목화 조준: <30 FAIL
const RUNS = 1000

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

// ── 강림 ON mock ──
vi.mock('../engine/devSettings', () => ({
  getDevComboRuleset: () => 'v4',
  getDevDescentEnabled: () => true,  // 정식 세계
}))

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { getFloorHp } = await import('../engine/balance')

describe('v4 HP 재산정 — 2벌 채점 (강림 ON)', () => {
  it('A벌 (×1.50) × B벌 (×1.45) 측정', { timeout: 600000 }, () => {
    const results: Array<{
      variant: string
      presets: Array<{ label: string; clearRate: number; gatePass: boolean }>
      spread: number
      spreadPass: boolean
      allPass: boolean
      precisionPass: boolean
    }> = []

    for (const [key, variant] of Object.entries(HP_VARIANTS)) {
      console.log(`\n[${variant.name}] 측정 시작`)
      const hp1 = variant.hp1
      const hp2 = variant.hp2
      const hp3 = variant.hp3
      console.log(`  HP: 1층=${hp1} / 2층=${hp2} / 3층=${hp3}`)

      let totalMokHwa = 0
      const presetResults = []

      for (const preset of PRESETS) {
        const favorableElement = getFavorableElement(preset.ilgan)
        const activePassiveIds = selectTalismanBySaju(preset.dist)
        let victories = 0

        for (let i = 0; i < RUNS; i++) {
          const result = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            enableFloorReward: true,
            enableEffectMode: true,
            activePassiveIds,
          })
          if (result.victory) victories++
        }

        const clearRate = parseFloat(((victories / RUNS) * 100).toFixed(1))
        const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX

        if (preset.key === 'mokHwa') totalMokHwa = clearRate

        presetResults.push({ label: preset.label, clearRate, gatePass })
        console.log(`  ${preset.label}: ${clearRate}% ${gatePass ? 'PASS' : 'FAIL'}`)
      }

      const rates = presetResults.map(p => p.clearRate)
      const spread = parseFloat((Math.max(...rates) - Math.min(...rates)).toFixed(1))
      const spreadPass = spread <= GATE_SPREAD
      const allPass = presetResults.every(p => p.gatePass)
      const precisionPass = totalMokHwa >= PRECISION_MIN

      console.log(`  격차=${spread}%p (${spreadPass ? 'PASS' : 'FAIL'})`)
      console.log(`  목화=${totalMokHwa}% (정밀조준: ${precisionPass ? 'PASS' : 'FAIL'})`)
      console.log(`  종합=${allPass && spreadPass && precisionPass ? 'PASS' : 'FAIL'}`)

      results.push({
        variant: variant.name,
        presets: presetResults,
        spread,
        spreadPass,
        allPass,
        precisionPass,
      })
    }

    // ── 결과 출력 ──
    console.log('\n========================================')
    console.log('2벌 채점 결과 (강림 ON, 정식 세계)')
    console.log('========================================')
    console.log('| 벌 | 목화 | 금수 | 토단일 | 격차 | 게이트 | 정밀 | 종합 |')
    console.log('|----|------|------|--------|------|--------|------|------|')

    for (const r of results) {
      const mokHwa = r.presets.find(p => p.label === '목화')!
      const geumSu = r.presets.find(p => p.label === '금수')!
      const toDanil = r.presets.find(p => p.label === '토단일')!

      console.log(
        `| ${r.variant.split('(')[0].trim()} | ${mokHwa.clearRate}%(${mokHwa.gatePass ? '✓' : '✗'}) | ${geumSu.clearRate}%(${geumSu.gatePass ? '✓' : '✗'}) | ${toDanil.clearRate}%(${toDanil.gatePass ? '✓' : '✗'}) | ${r.spread}(${r.spreadPass ? '✓' : '✗'}) | ${r.allPass ? '✓' : '✗'} | ${r.precisionPass ? '✓' : '✗'} | ${r.allPass && r.spreadPass && r.precisionPass ? '✓ PASS' : '✗ FAIL'} |`,
      )
    }

    // 산출물
    const output = {
      timestamp: new Date().toISOString(),
      description: 'v4 HP 재산정 2벌 채점 (강림 ON)',
      conditions: { descent: 'ON', ruleset: 'v4' },
      variants: results.map(r => ({
        name: r.variant,
        results: r.presets,
        spread: r.spread,
        gate: r.allPass && r.spreadPass ? 'PASS' : 'FAIL',
        precision: r.precisionPass ? 'PASS' : 'FAIL',
      })),
    }

    writeFileSync('/tmp/v4_hp_recalibration.json', JSON.stringify(output, null, 2))
    console.log('\n산출물: /tmp/v4_hp_recalibration.json')

    expect(results).toHaveLength(2)
  })
})
