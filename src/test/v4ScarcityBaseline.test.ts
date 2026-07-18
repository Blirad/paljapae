/**
 * v4 희소성 복원 — 재기준선 측정 (2026-07-18 이든 지시)
 *
 * 재기준선: 현행 V4_RATIO_CORRECTION (step1=0.85/step2=0.70)
 *          + 연환 값 게이트 없음 (YEONHWAN_MIN_SUM=0 → 5원소=성립)
 *
 * 목적: A/B벌 비교를 위한 기준 수치 확보
 *   - 5장 대융합 발동률 기준선
 *   - 연환 성립률 기준선 (값 게이트 전)
 *
 * 시드: i×12345+7777 (재기준선 동일)
 * HP: V4_FLOOR_HP_TABLE 고정 (vi.mock)
 * 결과: /tmp/v4_scarcity_baseline.json 저장
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── 현행 V4_RATIO_CORRECTION + v4 HP 주입 + 연환 게이트 없음 ──────────────
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
    // 현행 계수 유지 (기준선)
    V4_RATIO_CORRECTION: {
      peak: 1.0,
      step1: 0.85,
      step2: 0.70,
    },
  }
})

// 연환 값 게이트 없음 — YEONHWAN_MIN_SUM=0으로 mock (5원소=항상 성립)
vi.mock('../engine/pokerHandJudge', async () => {
  const actual = await vi.importActual('../engine/pokerHandJudge') as Record<string, unknown>
  return {
    ...actual,
    YEONHWAN_MIN_SUM: 0,
    isOhangYeonhwan: (cards: Array<{ element: string; value: number }>) => {
      if (cards.length !== 5) return false
      const elements = new Set(cards.map((c) => c.element))
      return elements.size === 5  // 값 게이트 없음 — 5원소 조건만
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

describe('v4 희소성 복원 — 재기준선 측정 (현행 0.85/0.70 + 연환 게이트 없음)', () => {
  it(
    '재기준선 1000판 × 3프리셋 + 5장 발동률 + 연환 성립률(게이트 전)',
    { timeout: 900000 },
    () => {
      console.log(`\n[기준선] V4_FLOOR_HP_TABLE: 1층=${V4_FLOOR_HP_TABLE[1]} / 2층=${V4_FLOOR_HP_TABLE[2]} / 3층=${V4_FLOOR_HP_TABLE[3]} / 4층=${V4_FLOOR_HP_TABLE[4]}`)
      console.log(`[기준선] v4 FLOOR_CONFIGS HP: ${FLOOR_CONFIGS.map((c: { floor: number; enemyHp: number }) => `${c.floor}층=${c.enemyHp}`).join(' / ')}`)

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
          `[기준선] ${preset.label}: 클리어율 ${clearRate.toFixed(1)}% (${victories}/${RUNS}) — 게이트 ${gatePass ? 'PASS' : 'FAIL'}`,
        )
      }

      const allPass = results.every(r => r.gatePass)
      const maxRate = Math.max(...results.map(r => r.clearRate))
      const minRate = Math.min(...results.map(r => r.clearRate))
      const spread = maxRate - minRate
      const spreadPass = spread <= GATE_SPREAD

      console.log('\n=== 재기준선 게이트 결과 ===')
      for (const r of results) {
        console.log(`${r.label}\t${r.clearRate.toFixed(1)}%\t${r.gatePass ? 'PASS' : 'FAIL'}`)
      }
      console.log(`격차: ${spread.toFixed(1)}%p — ${spreadPass ? 'PASS' : 'FAIL'}`)
      console.log(`게이트: ${allPass && spreadPass ? 'PASS' : 'FAIL'}`)

      const totalFusionHG = totalStep0 + totalStep1 + totalStep2
      const totalFusionIncl2 = totalFusionHG + total2CardExempt

      console.log('\n=== 재기준선 정점/비정점 분포 ===')
      console.log(`총 공격 턴: ${totalAttacks}`)
      console.log(`N≥3 융합 합계: ${totalFusionHG}`)
      console.log(`  step0 정점: ${totalStep0} (${totalFusionHG > 0 ? ((totalStep0 / totalFusionHG) * 100).toFixed(1) : '-'}%)`)
      console.log(`  step1 한계단: ${totalStep1} (${totalFusionHG > 0 ? ((totalStep1 / totalFusionHG) * 100).toFixed(1) : '-'}%)`)
      console.log(`  step2 두계단: ${totalStep2} (${totalFusionHG > 0 ? ((totalStep2 / totalFusionHG) * 100).toFixed(1) : '-'}%)`)

      const fusion5Rate = totalFusionIncl2 > 0 ? (total5Card / totalFusionIncl2) * 100 : 0
      console.log(`\n5장 대융합: ${total5Card}회 / ${totalFusionIncl2}회 = ${fusion5Rate.toFixed(1)}%`)

      const yeonhwanRate = totalAttacks > 0 ? (totalYeonhwan / totalAttacks) * 100 : 0
      console.log(`\n연환 발동 (게이트 없음): ${totalYeonhwan}회 / ${totalAttacks}회 = ${yeonhwanRate.toFixed(2)}%`)

      const output = {
        variant: 'baseline',
        table: { peak: 1.0, step1: 0.85, step2: 0.70 },
        yeonhwanGate: 'none',
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
          gate: 'none (5원소 조건만)',
        },
      }

      writeFileSync('/tmp/v4_scarcity_baseline.json', JSON.stringify(output, null, 2))
      console.log('\n[기준선] 결과 → /tmp/v4_scarcity_baseline.json 저장 완료')

      expect(results).toHaveLength(3)
      expect(spread).toBeGreaterThanOrEqual(0)
      expect(totalAttacks).toBeGreaterThan(0)
    },
  )
})
