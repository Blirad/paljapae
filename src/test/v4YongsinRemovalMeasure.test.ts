/**
 * v4 용신 상시 ×1.3 제거 후 클리어율 측정 — 강림 ON 재측정 (2026-07-18)
 *
 * 목적: 용신 상시 보너스(×1.3/×1.5) 완전 제거 후 클리어율 변동 확인
 * 이전 기준: 목화 28.4% / 금수 34.6% / 토단일 34.8% (HP=680, A벌, 용신×1.3 활성)
 * 게이트: ±2%p 초과 시 보고만 (게이트 재판정은 이든 판단)
 *
 * 이든 지시 (2026-07-18 13:01):
 * - 강림 OFF 측정(-10~18%p 급락)은 비정식 세계
 * - 강림 ON 재측정(정식 세계): 슬롯 2~3회 × 풀강림 1.8/잔광 1.25 대체 효과 확인
 * - 게이트권 복귀 예상 → 측정으로 검증
 *
 * 조건: HP=680(4층), A벌 곡선, 용신 상시 보너스 제거, 강림 ON (getDevDescentEnabled=true)
 *
 * 시드: i×12345+7777 (1000판 × 3프리셋)
 * 산출물: /tmp/v4_yongsin_removal_descent_on.json
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ── COMBO_RULESET_VERSION을 'v4'로 강제 + 강림 ON (이든 지시 2026-07-18) ──
vi.mock('../engine/devSettings', () => ({
  getDevComboRuleset: () => 'v4',
  getDevDescentEnabled: () => true,  // 강림 ON — 정식 세계 측정
}))

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { getFloorHp } = await import('../engine/balance')

const RUNS = 1000

// ── 이전 기준 (용신 ×1.3 활성 시) ──
const BASELINE = {
  mokHwa: 28.4,
  geumSu: 34.6,
  toDanil: 34.8,
}
const THRESHOLD = 2.0  // ±2%p

// ── 프리셋 ──
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

describe('v4 용신 ×1.3 제거 후 클리어율 측정', () => {
  it(
    '1000판 × 3프리셋 — 이전 기준 대비 변동폭 확인',
    { timeout: 3600000 },
    () => {
      // ── HP 실효값 assert ──
      const hp1 = getFloorHp(0)
      const hp2 = getFloorHp(1)
      const hp3 = getFloorHp(2)
      const hp4 = getFloorHp(3)

      console.log(`\n[HP 실효값] 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4}`)
      expect(hp4, '4층 HP must be 680').toBe(680)

      const results: Array<{ key: string; label: string; clearRate: number; baseline: number; delta: number; exceeded: boolean }> = []

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
        const baseline = BASELINE[preset.key as keyof typeof BASELINE]
        const delta = parseFloat((clearRate - baseline).toFixed(1))
        const exceeded = Math.abs(delta) > THRESHOLD

        results.push({ key: preset.key, label: preset.label, clearRate, baseline, delta, exceeded })
        console.log(`  ${preset.label}: ${clearRate}% (기준 ${baseline}%, Δ=${delta > 0 ? '+' : ''}${delta}%p) ${exceeded ? '⚠ EXCEEDED' : '✓ OK'}`)
      }

      // ── 산출물 저장 ──
      const output = {
        timestamp: new Date().toISOString(),
        description: 'v4 용신 ×1.3 제거 후 클리어율 측정',
        conditions: {
          hp: { floor1: hp1, floor2: hp2, floor3: hp3, floor4: hp4 },
          curve: 'A벌 (step1=0.70, step2=0.45)',
          yongsinConstant: 'REMOVED',
        },
        baseline: BASELINE,
        results: results.map(r => ({
          preset: r.label,
          clearRate: r.clearRate,
          baseline: r.baseline,
          delta: r.delta,
          exceeded: r.exceeded,
        })),
        gate: {
          threshold: THRESHOLD,
          anyExceeded: results.some(r => r.exceeded),
        },
      }

      writeFileSync('/tmp/v4_yongsin_removal_measure.json', JSON.stringify(output, null, 2))
      console.log('\n산출물: /tmp/v4_yongsin_removal_measure.json')

      // ── 결과 테이블 ──
      console.log('\n========================================')
      console.log('| 프리셋   | 클리어율 | 기준    | Δ       | 판정     |')
      console.log('|----------|----------|---------|---------|----------|')
      for (const r of results) {
        console.log(`| ${r.label.padEnd(8)} | ${(r.clearRate + '%').padEnd(8)} | ${(r.baseline + '%').padEnd(7)} | ${(r.delta > 0 ? '+' : '') + r.delta + '%p'}`.padEnd(50) + ` | ${r.exceeded ? '⚠ EXCEEDED' : '✓ OK'}`.padEnd(10) + ' |')
      }
      console.log('========================================')

      // 테스트는 항상 PASS — 초과 여부는 보고용
      expect(results).toHaveLength(3)
    }
  )
})
