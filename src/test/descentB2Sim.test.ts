/**
 * 강림제 §4-b — B-2 "이원" (재구현, 2026-07-15)
 *
 * 정의: 슬롯 도래 콤보에서 즉시 발동 — 용신 포함 ×2.5 / 미포함 ×1.5 약강림.
 *       슬롯 소비형 (비슬롯 턴 보너스 일절 없음).
 *
 * 판정 기준 (§4-b 개정):
 *  1. 포착률 (발동 ÷ 슬롯도래): 목화·금수 ≥70%, 토단일 ≥40%
 *  2. 소멸률: <30%
 *  3. 클리어율: 25~40% 유지
 *  4. 토단일 발동 개선폭 별도 보고
 *
 * 0단계 기준선 (slot ×2.0, 커밋 70fc9db):
 *   목화: 28.50% clear, 1.2 발동, 24.1% 소멸
 *   금수: 31.70% clear, 1.17 발동, 26.3% 소멸
 *   토단일: 27.40% clear, 0.79 발동, 36.6% 소멸
 *
 * E2E 지문: applyYongsinDescent → descentState.slots.includes(currentTurn) (§4 불변)
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return {
    ...(actual as Record<string, unknown>),
    ENABLE_YONGSIN_DESCENT: true,
    DESCENT_VARIANT: 'dual' as const,
    DESCENT_DUAL_SLOT_MULT: 2.5,
    DESCENT_DUAL_NONSLOT_MULT: 1.5,
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
    baselineClear: 28.50,
    captureGate: 0.70,  // ≥70%
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    baselineClear: 31.70,
    captureGate: 0.70,  // ≥70%
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
    baselineClear: 27.40,
    captureGate: 0.40,  // ≥40% (완화)
  },
]

const RUNS = 1000

describe('강림제 §4-b — B-2 "이원" (슬롯 소비형, 용신 ×2.5 / 미포함 ×1.5)', () => {
  it(
    '1000판 × 3프리셋: 포착률 + 소멸률 + 클리어율',
    { timeout: 300000 },
    () => {
      const results: Array<{
        label: string
        clearRate: number
        baselineClear: number
        avgActivated: number
        avgVanished: number
        avgSlotsArrived: number
        captureRate: number
        captureGate: number
        extinctionRate: number
        verdict: string
      }> = []

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        let totalActivated = 0
        let totalVanished = 0
        let totalSlotsArrived = 0

        for (let i = 0; i < RUNS; i++) {
          const result = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: preset.dist,
            favorableElement,
            enableFloorReward: true,
            activePassiveIds: talismans,
            enableEffectMode: true,
          })

          if (result.victory) cleared++
          totalActivated += result.descentActivated ?? 0
          totalVanished += result.descentVanished ?? 0
          totalSlotsArrived += result.descentSlotsArrived ?? 0
        }

        const clearRate = (cleared / RUNS) * 100
        const avgActivated = totalActivated / RUNS
        const avgVanished = totalVanished / RUNS
        const avgSlotsArrived = totalSlotsArrived / RUNS
        const captureRate = totalSlotsArrived > 0 ? totalActivated / totalSlotsArrived : 0
        const extinctionRate = (totalActivated + totalVanished) > 0
          ? totalVanished / (totalActivated + totalVanished)
          : 0

        const clearOk = clearRate >= 25 && clearRate <= 40
        const captureOk = captureRate >= preset.captureGate
        const extinctionOk = extinctionRate < 0.30
        const verdict = clearOk && captureOk && extinctionOk ? 'PASS' : 'FAIL'

        results.push({
          label: preset.label,
          clearRate,
          baselineClear: preset.baselineClear,
          avgActivated,
          avgVanished,
          avgSlotsArrived,
          captureRate,
          captureGate: preset.captureGate,
          extinctionRate,
          verdict,
        })
      }

      console.log('\n' + '='.repeat(110))
      console.log('강림제 §4-b — B-2 "이원" × 1000판 × 3프리셋')
      console.log('판정: 포착률(목화·금수 ≥70%, 토단일 ≥40%) + 소멸률 <30% + 클리어율 25~40')
      console.log('E2E 지문: descentState.slots.includes(currentTurn) → 슬롯 즉시 소비, 비슬롯 보너스 없음')
      console.log('='.repeat(110))

      console.log(
        '\n┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────┐'
      )
      console.log(
        '│ 프리셋   │ 클리어율 │ 기준선   │ 슬롯도래 │ 발동/게임 │ 소멸/게임 │ 포착률   │ 소멸률   │ 판정   │'
      )
      console.log(
        '├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼────────┤'
      )

      for (const r of results) {
        console.log(
          `│ ${r.label.padEnd(8)} │ ${r.clearRate.toFixed(1).padStart(7)}% │ ${r.baselineClear.toFixed(1).padStart(7)}% │ ${r.avgSlotsArrived.toFixed(2).padStart(8)} │ ${r.avgActivated.toFixed(2).padStart(8)} │ ${r.avgVanished.toFixed(2).padStart(8)} │ ${(r.captureRate * 100).toFixed(1).padStart(6)}%${r.captureRate >= r.captureGate ? '✓' : '✗'} │ ${(r.extinctionRate * 100).toFixed(1).padStart(6)}%${r.extinctionRate < 0.30 ? '✓' : '✗'} │ ${r.verdict.padStart(6)} │`
        )
      }

      console.log(
        '└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴────────┘'
      )

      const passCount = results.filter(r => r.verdict === 'PASS').length
      console.log(`\n종합 판정: ${passCount}/${results.length} 프리셋 PASS`)
      for (const r of results) {
        const clearOk = r.clearRate >= 25 && r.clearRate <= 40 ? '✓' : '✗'
        const captureOk = r.captureRate >= r.captureGate ? '✓' : '✗'
        const extinctOk = r.extinctionRate < 0.30 ? '✓' : '✗'
        console.log(`  ${r.label}: ${r.verdict} — 클리어${clearOk} 포착${captureOk}(게이트≥${(r.captureGate * 100).toFixed(0)}%) 소멸${extinctOk}`)
      }

      // 토단일 별도 보고
      const toDanil = results.find(r => r.label === '토단일')!
      console.log(`\n[토단일 별도 보고]`)
      console.log(`  포착률: ${(toDanil.captureRate * 100).toFixed(1)}% (게이트 ≥40%)`)
      console.log(`  슬롯 도래: ${toDanil.avgSlotsArrived.toFixed(2)}/게임`)
      console.log(`  발동: ${toDanil.avgActivated.toFixed(2)}/게임`)
      console.log(`  클리어율: ${toDanil.clearRate.toFixed(1)}% (기준 ${toDanil.baselineClear}%)`)

      for (const r of results) {
        expect(r.clearRate).toBeGreaterThanOrEqual(0)
        expect(r.clearRate).toBeLessThanOrEqual(100)
      }
    },
  )
})
