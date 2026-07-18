/**
 * v4 최종 벌 측정 — HP 정밀 타격 후 채점 (2026-07-18 이든 최종 확정)
 *
 * 벌: B벌 균일 ×1.45 + 3층 정밀 타격 1085
 * - 1층: 319 (×1.45)
 * - 2층: 645 (×1.45)
 * - 3층: 1085 (986 + 10%, 사망 분포 기반)
 * - 4층: 680 (극상성 무사통과 관문, 불변 확정)
 *
 * 채점 기준:
 * - 토단일: 36~38% (목표)
 * - 목화·금수: 무풍 ±1.5%p (기준: 목화 ~31%, 금수 ~39%)
 * - 전 프리셋: 25~40% PASS
 * - 격차: ≤15%p PASS
 *
 * 조건: 강림 ON, v4 모드, 1000판 × 3프리셋
 * 산출물: /tmp/v4_final_hp.json
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ── 강림 ON mock ──
vi.mock('../engine/devSettings', () => ({
  getDevComboRuleset: () => 'v4',
  getDevDescentEnabled: () => true,
}))

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { getFloorHp } = await import('../engine/balance')

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

// 예상 기준값 (B벌 ×1.45 기준)
const EXPECTED = {
  mokHwa: 31.1,    // B벌 측정값
  geumSu: 39.2,    // B벌 측정값
  toDanil: 40.7,   // B벌 측정값 (3층 타격 전)
}

const THRESHOLD_WIND = 1.5  // 무풍 기준 ±1.5%p
const GATE_MIN = 25
const GATE_MAX = 40
const GATE_SPREAD = 15

describe('v4 최종 벌 — HP 정밀 타격 채점 (강림 ON)', () => {
  it('1000판 × 3프리셋 — 토단일 36~38% 목표', { timeout: 300000 }, () => {
    console.log('\n========================================')
    console.log('v4 최종 벌 채점 시작 (이든 최종 확정)')
    console.log('========================================')
    console.log('HP: 1층=319 / 2층=645 / 3층=1085 / 4층=680')
    console.log('기준: B벌 후 vs 최종 벌')
    console.log(`목표: 토단일 36~38% / 목화·금수 무풍 ±${THRESHOLD_WIND}%p`)
    console.log('========================================\n')

    // HP 실효값 assert
    const hp1 = getFloorHp(0)
    const hp2 = getFloorHp(1)
    const hp3 = getFloorHp(2)
    const hp4 = getFloorHp(3)

    console.log(`[HP assert] 1층=${hp1}(기대=319) / 2층=${hp2}(기대=645) / 3층=${hp3}(기대=1085) / 4층=${hp4}(기대=680)`)
    expect(hp1).toBe(319)
    expect(hp2).toBe(645)
    expect(hp3).toBe(1085)
    expect(hp4).toBe(680)
    console.log('✓ HP 실효값 PASS\n')

    const results: Array<{
      label: string
      clearRate: number
      expected: number
      delta: number
      windPass: boolean
      gatePass: boolean
    }> = []

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
      const expected = EXPECTED[preset.key as keyof typeof EXPECTED]
      const delta = parseFloat((clearRate - expected).toFixed(1))
      const windPass = Math.abs(delta) <= THRESHOLD_WIND
      const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX

      results.push({ label: preset.label, clearRate, expected, delta, windPass, gatePass })

      console.log(`${preset.label}: ${clearRate}% (기준 ${expected}%, Δ=${delta > 0 ? '+' : ''}${delta}%p) [${windPass ? '✓' : '✗'} 무풍 / ${gatePass ? '✓' : '✗'} 게이트]`)
    }

    // 채점
    console.log('\n========================================')
    console.log('채점 결과')
    console.log('========================================')

    const toDanil = results.find(r => r.label === '토단일')!
    const mokHwa = results.find(r => r.label === '목화')!
    const geumSu = results.find(r => r.label === '금수')!

    const toDanilGoal = toDanil.clearRate >= 36 && toDanil.clearRate <= 38
    const allGate = results.every(r => r.gatePass)
    const allWind = mokHwa.windPass && geumSu.windPass
    const spread = parseFloat((Math.max(...results.map(r => r.clearRate)) - Math.min(...results.map(r => r.clearRate))).toFixed(1))
    const spreadPass = spread <= GATE_SPREAD

    console.log(`토단일 목표 (36~38%): ${toDanil.clearRate}% — ${toDanilGoal ? '✓ PASS' : '✗ FAIL'}`)
    console.log(`무풍 (±${THRESHOLD_WIND}%p):`)
    console.log(`  목화: Δ=${mokHwa.delta > 0 ? '+' : ''}${mokHwa.delta}%p — ${mokHwa.windPass ? '✓' : '✗'}`)
    console.log(`  금수: Δ=${geumSu.delta > 0 ? '+' : ''}${geumSu.delta}%p — ${geumSu.windPass ? '✓' : '✗'}`)
    console.log(`게이트 (25~40): ${allGate ? '✓ PASS' : '✗ FAIL'}`)
    console.log(`격차 (≤15%p): ${spread}%p — ${spreadPass ? '✓ PASS' : '✗ FAIL'}`)

    const allPass = toDanilGoal && allGate && allWind && spreadPass
    console.log(`\n종합: ${allPass ? '✓✓✓ PASS — 배포 발사!' : '✗ FAIL — 구조 안건 승격'}`)

    // 산출물
    const output = {
      timestamp: new Date().toISOString(),
      description: 'v4 최종 벌 채점 (HP 정밀 타격)',
      hp: { floor1: 319, floor2: 645, floor3: 1085, floor4: 680 },
      results: results.map(r => ({
        preset: r.label,
        clearRate: r.clearRate,
        baseline: r.expected,
        delta: r.delta,
        windPass: r.windPass,
        gatePass: r.gatePass,
      })),
      gate: {
        allPass,
        toDanilGoal,
        allGate,
        allWind,
        spread,
        spreadPass,
      },
    }

    writeFileSync('/tmp/v4_final_hp.json', JSON.stringify(output, null, 2))
    console.log('\n산출물: /tmp/v4_final_hp.json')

    expect(results).toHaveLength(3)
  })
})
