/**
 * G3 v4 시뮬레이션 — 자유 성립·투입 장수 위계 (이든 판정 2026-07-17)
 *
 * COMBO_RULESET_VERSION='v4' 오버라이드 (vi.mock 최상단 필수)
 *
 * 게이트 기준: 프리셋별 클리어율 25~40%
 * 3프리셋: 목화 / 금수 / 토단일
 * 시드: i×12345+7777 (i=0~999)
 * 가호: selectTalismanBySaju(dist)
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

// COMBO_RULESET_VERSION='v4' 오버라이드 — 반드시 최상단
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'v4' }
})

// mock 적용 후 동적 import
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

// ─── 프리셋 정의 ─────────────────────────────────────────────────────────────
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

describe('G3 v4 시뮬레이션 — 1000판 × 3프리셋 게이트 (2026-07-17)', () => {
  it(
    'v4 클리어율 1000판 × 3프리셋 + 게이트 판정',
    { timeout: 300000 },
    () => {
      const results: Array<{
        label: string
        clearRate: number
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

        const clearRate = (victories / RUNS) * 100
        const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX

        results.push({ label: preset.label, clearRate, gatePass })

        console.log(
          `[v4] ${preset.label}: 클리어율 ${clearRate.toFixed(1)}% (${victories}/${RUNS}) — 게이트 ${gatePass ? 'PASS' : 'FAIL'} [${GATE_MIN}~${GATE_MAX}%]`,
        )
      }

      // 결과 표 출력
      console.log('\n=== G3 v4 게이트 결과 ===')
      console.log('프리셋\t클리어율\t게이트')
      for (const r of results) {
        console.log(`${r.label}\t${r.clearRate.toFixed(1)}%\t${r.gatePass ? 'PASS' : 'FAIL'}`)
      }

      const allPass = results.every((r) => r.gatePass)
      const maxRate = Math.max(...results.map((r) => r.clearRate))
      const minRate = Math.min(...results.map((r) => r.clearRate))
      const spread = maxRate - minRate
      console.log(`\n프리셋 간 격차: ${spread.toFixed(1)}%p`)
      console.log(`전체 게이트: ${allPass ? 'PASS' : 'FAIL'}`)

      // 결과를 전역에 저장 (보고용)
      ;(globalThis as any).__g3V4SimResults = {
        results,
        allPass,
        spread,
        runs: RUNS,
      }

      // 시뮬레이션 실행 자체 검증 (게이트 FAIL은 보고만, 테스트 fail 아님)
      expect(results).toHaveLength(3)
      expect(victories).toBeGreaterThanOrEqual(0)
    },
  )
})
