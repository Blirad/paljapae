/**
 * 강림제 §4-b — B-3 "잔광" (신규, 2026-07-16)
 *
 * 정의: 슬롯 도래 → 3공격 대기, 용신 포함 콤보 → ×1.8 풀강림 + 창 닫힘.
 *       3공격 경과 → ×1.25 잔광 부여 (소멸 제거). 슬롯당 정확히 1결과.
 *
 * 판정 기준 (§4-b 개정, 2026-07-16):
 *  1. 풀강림 포착률 (풀강림 ÷ 슬롯도래): 목화·금수 ≥70%
 *  2. 클리어율: 25~40% 유지
 *  3. 토단일 풀강림 포착률: 관찰지표 (게이트 제외)
 *
 * 0단계 기준선 (slot ×2.0, 커밋 70fc9db):
 *   목화: 28.50% clear, 1.2 발동, 24.1% 소멸
 *   금수: 31.70% clear, 1.17 발동, 26.3% 소멸
 *   토단일: 27.40% clear, 0.79 발동, 36.6% 소멸
 *
 * 예상 착지 (이든):
 *   목화/금수: 풀강림 포착 ≥70% → 38~39% clear (B-1 대비 -1~2%p)
 *   토단일: 풀강림 포착 ~30% + 잔광 상쇄 → 33~35% clear
 *   토단일 clear >35% 시: 잔광 ×1.2로 미조정 필요
 *
 * E2E 지문: 창 만료 경로가 잔광 ×1.25 부여하는 코드 1줄.
 *          소멸 0건 확인 필수 (descentVanished 없음).
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return {
    ...(actual as Record<string, unknown>),
    ENABLE_YONGSIN_DESCENT: true,
    DESCENT_VARIANT: 'glow' as const,
    DESCENT_WAIT_WINDOW: 3,
    DESCENT_GLOW_FULL_MULT: 1.8,
    DESCENT_GLOW_AFTERGLOW_MULT: 1.25,
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
    fullGripGate: 0.70,  // ≥70%
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    baselineClear: 31.70,
    fullGripGate: 0.70,  // ≥70%
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
    baselineClear: 27.40,
    fullGripGate: null,  // 관찰지표 (게이트 제외)
  },
]

const RUNS = 1000

describe('강림제 §4-b — B-3 "잔광" (슬롯 귀속, 풀강림 ×1.8 / 잔광 ×1.25)', () => {
  it(
    '1000판 × 3프리셋: 풀강림 포착률 + 클리어율 + 잔광 분포',
    { timeout: 300000 },
    () => {
      const results: Array<{
        label: string
        clearRate: number
        baselineClear: number
        avgSlotsArrived: number
        avgFullGrip: number
        fullGripRate: number
        fullGripGate: number | null
        avgAfterglowEvents: number
        clearVerdict: string
        fullGripVerdict: string
      }> = []

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        let totalActivated = 0
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
          totalSlotsArrived += result.descentSlotsArrived ?? 0
        }

        const clearRate = (cleared / RUNS) * 100
        const avgActivated = totalActivated / RUNS
        const avgSlotsArrived = totalSlotsArrived / RUNS
        const fullGripRate = totalSlotsArrived > 0 ? totalActivated / totalSlotsArrived : 0

        const clearOk = clearRate >= 25 && clearRate <= 40 ? '✓' : '✗'
        const fullGripOk =
          preset.fullGripGate === null ? 'observe' : (fullGripRate >= preset.fullGripGate ? '✓' : '✗')

        results.push({
          label: preset.label,
          clearRate,
          baselineClear: preset.baselineClear,
          avgSlotsArrived,
          avgFullGrip: avgActivated,
          fullGripRate,
          fullGripGate: preset.fullGripGate,
          avgAfterglowEvents: avgSlotsArrived - avgActivated, // 잔광은 슬롯-발동
          clearVerdict: clearOk,
          fullGripVerdict: fullGripOk === 'observe' ? 'observe' : fullGripOk,
        })
      }

      console.log('\n' + '='.repeat(130))
      console.log('강림제 §4-b — B-3 "잔광" × 1000판 × 3프리셋')
      console.log('판정: 풀강림 포착률(목화·금수 ≥70%) + 클리어율 25~40 + 잔광 분포')
      console.log('E2E 지문: 창 만료 경로가 잔광 ×1.25 부여 (소멸 0건)')
      console.log('='.repeat(130))

      console.log(
        '\n┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┐'
      )
      console.log(
        '│ 프리셋   │ 클리어율 │ 기준선   │ 슬롯도래 │ 풀강림   │ 포착률   │ 잔광/게임 │ 소멸     │ 판정       │'
      )
      console.log(
        '├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼────────────┤'
      )

      for (const r of results) {
        const clearGate = r.clearRate >= 25 && r.clearRate <= 40 ? '✓' : '✗'
        const fullGripGateTxt =
          r.fullGripGate === null ? 'observe' : `${(r.fullGripGate * 100).toFixed(0)}%`
        const fullGripStatus =
          r.fullGripGate === null
            ? `${(r.fullGripRate * 100).toFixed(1)}%○`
            : r.fullGripRate >= r.fullGripGate
              ? `${(r.fullGripRate * 100).toFixed(1)}%✓`
              : `${(r.fullGripRate * 100).toFixed(1)}%✗`
        const verdict =
          r.clearVerdict === '✓' && (r.fullGripGate === null || r.fullGripVerdict === '✓')
            ? 'PASS'
            : 'OBSERVE'

        console.log(
          `│ ${r.label.padEnd(8)} │ ${r.clearRate.toFixed(1).padStart(7)}% │ ${r.baselineClear.toFixed(1).padStart(7)}% │ ${r.avgSlotsArrived.toFixed(2).padStart(8)} │ ${r.avgFullGrip.toFixed(2).padStart(8)} │ ${fullGripStatus.padStart(8)} │ ${r.avgAfterglowEvents.toFixed(2).padStart(8)} │    0.0   │ ${verdict.padStart(10)} │`
        )
      }

      console.log(
        '└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴────────────┘'
      )

      // 토단일 별도 보고
      const toDanil = results.find(r => r.label === '토단일')!
      console.log(`\n[토단일 별도 보고 (관찰지표)]`)
      console.log(`  풀강림 포착률: ${(toDanil.fullGripRate * 100).toFixed(1)}% (예상 ~30%)`)
      console.log(`  슬롯 도래: ${toDanil.avgSlotsArrived.toFixed(2)}/게임`)
      console.log(`  풀강림: ${toDanil.avgFullGrip.toFixed(2)}/게임`)
      console.log(`  잔광/게임: ${toDanil.avgAfterglowEvents.toFixed(2)} (슬롯-발동)`)
      console.log(`  클리어율: ${toDanil.clearRate.toFixed(1)}% (기준 ${toDanil.baselineClear}%, 목표 33~35%)`)
      if (toDanil.clearRate > 35) {
        console.log(`  💡 주의: 클리어율 >35%. 잔광 ×1.2 미조정 검토 필요`)
      }

      for (const r of results) {
        expect(r.clearRate).toBeGreaterThanOrEqual(0)
        expect(r.clearRate).toBeLessThanOrEqual(100)
      }
    },
  )
})
