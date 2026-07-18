/**
 * v4 희소성 복원 — A벌 측정 (수정판: getFloorHp 직접 mock 주입)
 *
 * A벌: { peak:1.0, step1:0.70, step2:0.45 }
 * v4 HP: getFloorHp 직접 mock → 308/623/952/621
 * YEONHWAN_MIN_SUM=25: 코드 실제값 (pokerHandJudge.ts — mock 없음)
 *
 * 측정 항목:
 *   1. 클리어율 3프리셋 (게이트: 25~40% + 격차 ≤15%p)
 *   2. 정점/비정점 실발동 (판당 평균 + σ)
 *   3. 대융합(5장) 발동률
 *   4. 연환 성립률 (값 게이트 ≥25 적용 후)
 *   5. 정점/비정점 평균 배율
 *
 * 산출물: /tmp/v4_sparsity_A.json
 */

import { describe, it, expect, vi, afterAll } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const V4_FLOOR_HP_TABLE = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    // v4 HP 직접 주입 — getFloorHp 함수 자체를 교체해야 mock이 엔진에 반영됨
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = V4_FLOOR_HP_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
    // A벌 비율 보정
    V4_RATIO_CORRECTION: {
      peak: 1.0,
      step1: 0.70,
      step2: 0.45,
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')

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
const GATE_SPREAD = 15
const TABLE = { peak: 1.0, step1: 0.70, step2: 0.45 }

describe('v4 희소성 복원 — A벌 측정 (getFloorHp 직접 mock)', () => {
  it(
    'A벌 1000판 × 3프리셋 측정',
    { timeout: 900000 },
    () => {
      console.log(`\n[A벌] V4_FLOOR_HP_TABLE: 1층=${V4_FLOOR_HP_TABLE[1]} / 2층=${V4_FLOOR_HP_TABLE[2]} / 3층=${V4_FLOOR_HP_TABLE[3]} / 4층=${V4_FLOOR_HP_TABLE[4]}`)

      // 전체 집계
      let totalStep0 = 0
      let totalStep1 = 0
      let totalStep2 = 0
      let total2CardExempt = 0
      let total5Card = 0
      let totalYeonhwan = 0
      let totalAttacks = 0

      // 판당 추적 (σ 계산용)
      const perGameStep0: number[] = []
      const perGameNonPeak: number[] = []  // step1 + step2
      const perGameYeonhwan: number[] = []

      const results: Array<{
        label: string
        victories: number
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

          const tc = result.traitCounts ?? {}
          const gs0 = tc['v4_fusion_step0'] ?? 0
          const gs1 = tc['v4_fusion_step1'] ?? 0
          const gs2 = tc['v4_fusion_step2'] ?? 0
          const gy = tc['ohang-yeonhwan'] ?? 0

          totalStep0 += gs0
          totalStep1 += gs1
          totalStep2 += gs2
          total2CardExempt += tc['v4_fusion_2card_exempt'] ?? 0
          total5Card += tc['v4_fusion_5card'] ?? 0
          totalYeonhwan += gy

          let gameAttacks = 0
          for (const fs of (result.floorStats ?? [])) {
            gameAttacks += fs.attackCount
          }
          totalAttacks += gameAttacks

          perGameStep0.push(gs0)
          perGameNonPeak.push(gs1 + gs2)
          perGameYeonhwan.push(gy)
        }

        const clearRate = (victories / RUNS) * 100
        const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX
        results.push({ label: preset.label, victories, clearRate, gatePass })

        console.log(
          `[A벌] ${preset.label}: 클리어율 ${clearRate.toFixed(1)}% (${victories}/${RUNS}) — ${gatePass ? 'PASS' : 'FAIL'}`,
        )
      }

      const allPass = results.every(r => r.gatePass)
      const maxRate = Math.max(...results.map(r => r.clearRate))
      const minRate = Math.min(...results.map(r => r.clearRate))
      const spread = maxRate - minRate
      const spreadPass = spread <= GATE_SPREAD

      console.log(`\n[A벌] 격차: ${spread.toFixed(1)}%p — ${spreadPass ? 'PASS' : 'FAIL'}`)
      console.log(`[A벌] 게이트: ${allPass && spreadPass ? 'PASS' : 'FAIL'}`)

      // 분포 계산
      const totalFusionHG = totalStep0 + totalStep1 + totalStep2
      const totalFusionIncl2 = totalFusionHG + total2CardExempt
      const fusion5Rate = totalFusionIncl2 > 0 ? (total5Card / totalFusionIncl2) * 100 : 0
      const yeonhwanRate = totalAttacks > 0 ? (totalYeonhwan / totalAttacks) * 100 : 0
      const avgClearRate = results.reduce((s, r) => s + r.clearRate, 0) / results.length

      // σ 계산
      const N = perGameStep0.length
      const meanStep0 = N > 0 ? perGameStep0.reduce((s, x) => s + x, 0) / N : 0
      const meanNonPeak = N > 0 ? perGameNonPeak.reduce((s, x) => s + x, 0) / N : 0
      const varStep0 = N > 1 ? perGameStep0.reduce((s, x) => s + (x - meanStep0) ** 2, 0) / (N - 1) : 0
      const varNonPeak = N > 1 ? perGameNonPeak.reduce((s, x) => s + (x - meanNonPeak) ** 2, 0) / (N - 1) : 0
      const sigmaStep0 = Math.sqrt(varStep0)
      const sigmaNonPeak = Math.sqrt(varNonPeak)

      // 비정점 평균 배율 (step1/step2 가중 평균)
      const step1Total = totalStep1
      const step2Total = totalStep2
      const nonPeakTotal = step1Total + step2Total
      const avgNonPeakMult = nonPeakTotal > 0
        ? (step1Total * TABLE.step1 + step2Total * TABLE.step2) / nonPeakTotal
        : TABLE.step1

      console.log(`\n[A벌] 정점 발동: ${meanStep0.toFixed(2)} ± ${sigmaStep0.toFixed(2)} 회/판`)
      console.log(`[A벌] 비정점 발동: ${meanNonPeak.toFixed(2)} ± ${sigmaNonPeak.toFixed(2)} 회/판`)
      console.log(`[A벌] 비정점 평균 배율: ×${avgNonPeakMult.toFixed(3)}`)
      console.log(`[A벌] 5장 발동률: ${fusion5Rate.toFixed(1)}%`)
      console.log(`[A벌] 연환 성립률: ${yeonhwanRate.toFixed(2)}%`)

      const output = {
        variant: 'A',
        table: TABLE,
        presets: results,
        avgClearRate: parseFloat(avgClearRate.toFixed(1)),
        gatePass: allPass && spreadPass,
        spread: parseFloat(spread.toFixed(1)),
        perGame: {
          meanStep0: parseFloat(meanStep0.toFixed(3)),
          sigmaStep0: parseFloat(sigmaStep0.toFixed(3)),
          meanNonPeak: parseFloat(meanNonPeak.toFixed(3)),
          sigmaNonPeak: parseFloat(sigmaNonPeak.toFixed(3)),
        },
        multipliers: {
          peak: 1.0,
          avgNonPeak: parseFloat(avgNonPeakMult.toFixed(4)),
        },
        distribution: {
          totalAttacks,
          totalFusionAll: totalFusionIncl2,
          exempt2Card: total2CardExempt,
          n3plus: totalFusionHG,
          step0Peak: totalStep0,
          step1: totalStep1,
          step2: totalStep2,
          step0PctOfN3: totalFusionHG > 0 ? parseFloat(((totalStep0 / totalFusionHG) * 100).toFixed(1)) : 0,
          step1PctOfN3: totalFusionHG > 0 ? parseFloat(((totalStep1 / totalFusionHG) * 100).toFixed(1)) : 0,
          step2PctOfN3: totalFusionHG > 0 ? parseFloat(((totalStep2 / totalFusionHG) * 100).toFixed(1)) : 0,
        },
        fusion5: {
          count: total5Card,
          total: totalFusionIncl2,
          rate: parseFloat(fusion5Rate.toFixed(1)),
        },
        yeonhwan: {
          count: totalYeonhwan,
          totalAttacks,
          rate: parseFloat(yeonhwanRate.toFixed(2)),
        },
      }

      writeFileSync('/tmp/v4_sparsity_A.json', JSON.stringify(output, null, 2))
      console.log('\n[A벌] → /tmp/v4_sparsity_A.json 저장 완료')

      expect(results).toHaveLength(3)
      expect(totalAttacks).toBeGreaterThan(0)
    },
  )
})
