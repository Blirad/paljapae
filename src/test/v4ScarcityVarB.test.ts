/**
 * v4 희소성 복원 — B벌 측정 (2026-07-18 이든 지시)
 *
 * B벌: V4_RATIO_CORRECTION = { peak:1.0, step1:0.75, step2:0.50 }
 * 2장 면제 유지 (N<3 → peak 반환 로직 불변)
 *
 * 측정 항목:
 *   1. 클리어율 3프리셋 (게이트: 25~40% + 격차 ≤15%p)
 *   2. 정점/비정점 실발동 분포 (step0/step1/step2 하드 넘버)
 *   3. 대융합(5장) 발동률
 *   4. 연환 성립률 (값 게이트 전후 — 이번은 값 게이트 적용 후)
 *
 * 시드: i×12345+7777 (재기준선 동일)
 * HP: V4_FLOOR_HP_TABLE 고정 (vi.mock)
 * 결과: /tmp/v4_scarcity_B.json 저장
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── V4_RATIO_CORRECTION B벌 교체 + v4 HP 주입 ────────────────────────────
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>

  const V4_FLOOR_HP_TABLE = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const originalFloorConfigs = actual['FLOOR_CONFIGS'] as Array<{
    floor: number; enemyHp: number; [k: string]: unknown
  }>
  const v4FloorConfigs = originalFloorConfigs.map(cfg => ({
    ...cfg,
    enemyHp: V4_FLOOR_HP_TABLE[cfg.floor] ?? cfg.enemyHp,
  }))

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    FLOOR_CONFIGS: v4FloorConfigs,
    // B벌: step1=0.75, step2=0.50
    V4_RATIO_CORRECTION: {
      peak: 1.0,
      step1: 0.75,
      step2: 0.50,
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { FLOOR_CONFIGS, V4_FLOOR_HP_TABLE } = await import('../engine/balance')

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

describe('v4 희소성 복원 — B벌 측정 (step1=0.75/step2=0.50)', () => {
  it(
    'B벌 1000판 × 3프리셋 + 정점/비정점 하드 넘버 + 5장 발동률 + 연환 성립률',
    { timeout: 900000 },
    () => {
      // HP 확인
      console.log(`\n[B벌] V4_FLOOR_HP_TABLE: 1층=${V4_FLOOR_HP_TABLE[1]} / 2층=${V4_FLOOR_HP_TABLE[2]} / 3층=${V4_FLOOR_HP_TABLE[3]} / 4층=${V4_FLOOR_HP_TABLE[4]}`)
      console.log(`[B벌] v4 FLOOR_CONFIGS HP: ${FLOOR_CONFIGS.map((c: { floor: number; enemyHp: number }) => `${c.floor}층=${c.enemyHp}`).join(' / ')}`)

      // 집계 변수
      let totalStep0 = 0
      let totalStep1 = 0
      let totalStep2 = 0
      let total2CardExempt = 0
      let total5Card = 0
      let totalYeonhwan = 0
      let totalFusionAll = 0
      let totalAttacks = 0

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
          totalStep0 += tc['v4_fusion_step0'] ?? 0
          totalStep1 += tc['v4_fusion_step1'] ?? 0
          totalStep2 += tc['v4_fusion_step2'] ?? 0
          total2CardExempt += tc['v4_fusion_2card_exempt'] ?? 0
          total5Card += tc['v4_fusion_5card'] ?? 0
          totalYeonhwan += tc['ohang-yeonhwan'] ?? 0

          totalFusionAll += result.fusionCount ?? 0

          for (const fs of (result.floorStats ?? [])) {
            totalAttacks += fs.attackCount
          }
        }

        const clearRate = (victories / RUNS) * 100
        const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX
        results.push({ label: preset.label, victories, clearRate, gatePass })

        console.log(
          `[B벌] ${preset.label}: 클리어율 ${clearRate.toFixed(1)}% (${victories}/${RUNS}) — 게이트 ${gatePass ? 'PASS' : 'FAIL'}`,
        )
      }

      const allPass = results.every(r => r.gatePass)
      const maxRate = Math.max(...results.map(r => r.clearRate))
      const minRate = Math.min(...results.map(r => r.clearRate))
      const spread = maxRate - minRate
      const spreadPass = spread <= GATE_SPREAD

      console.log('\n=== B벌 게이트 결과 ===')
      console.log('프리셋\t클리어율\t게이트')
      for (const r of results) {
        console.log(`${r.label}\t${r.clearRate.toFixed(1)}%\t${r.gatePass ? 'PASS' : 'FAIL'}`)
      }
      console.log(`프리셋 간 격차: ${spread.toFixed(1)}%p — ${spreadPass ? 'PASS' : 'FAIL'}`)
      console.log(`전체 게이트: ${allPass && spreadPass ? 'PASS' : 'FAIL'}`)

      const totalFusionHG = totalStep0 + totalStep1 + totalStep2
      const totalFusionIncl2 = totalFusionHG + total2CardExempt

      console.log('\n=== B벌 정점/비정점 실발동 분포 (하드 넘버) ===')
      console.log(`총 공격 턴: ${totalAttacks}`)
      console.log(`총 융합 발동 (전체): ${totalFusionIncl2}`)
      console.log(`  2장 면제: ${total2CardExempt} (${totalFusionIncl2 > 0 ? ((total2CardExempt / totalFusionIncl2) * 100).toFixed(1) : '-'}%)`)
      console.log(`  N≥3 융합 합계: ${totalFusionHG}`)
      console.log(`    step0 정점: ${totalStep0} (${totalFusionHG > 0 ? ((totalStep0 / totalFusionHG) * 100).toFixed(1) : '-'}% of N≥3)`)
      console.log(`    step1 한계단: ${totalStep1} (${totalFusionHG > 0 ? ((totalStep1 / totalFusionHG) * 100).toFixed(1) : '-'}% of N≥3)`)
      console.log(`    step2 두계단: ${totalStep2} (${totalFusionHG > 0 ? ((totalStep2 / totalFusionHG) * 100).toFixed(1) : '-'}% of N≥3)`)

      console.log('\n=== B벌 대융합(5장) 발동률 ===')
      const fusion5Rate = totalFusionIncl2 > 0 ? (total5Card / totalFusionIncl2) * 100 : 0
      console.log(`5장 대융합: ${total5Card}회 / 전체 융합 ${totalFusionIncl2}회 = ${fusion5Rate.toFixed(1)}%`)

      console.log('\n=== B벌 연환 성립률 (값 게이트 ≥25 적용 후) ===')
      const yeonhwanRate = totalAttacks > 0 ? (totalYeonhwan / totalAttacks) * 100 : 0
      console.log(`연환 발동: ${totalYeonhwan}회 / 전체 공격 ${totalAttacks}회 = ${yeonhwanRate.toFixed(2)}%`)

      const output = {
        variant: 'B',
        table: { peak: 1.0, step1: 0.75, step2: 0.50 },
        presets: results,
        gatePass: allPass && spreadPass,
        spread: parseFloat(spread.toFixed(1)),
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

      writeFileSync('/tmp/v4_scarcity_B.json', JSON.stringify(output, null, 2))
      console.log('\n[B벌] 결과 → /tmp/v4_scarcity_B.json 저장 완료')

      expect(results).toHaveLength(3)
      expect(spread).toBeGreaterThanOrEqual(0)
      expect(totalAttacks).toBeGreaterThan(0)
    },
  )
})
