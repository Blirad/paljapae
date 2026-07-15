/**
 * 강림제 0단계 — 미러링 수정 후 기준선 측정
 *
 * 커밋: 70fc9db (봇 미러링 수정) + initYongsinDescent 봇 연동
 * 조건: M=2.0, 이월 1회 (1차와 동일), ENABLE_YONGSIN_DESCENT=true
 *
 * 이전 1차 측정(ebe0106)은 봇 미러링 위반(×1.3 잔존)으로 무효.
 * 이 0단계가 B-1/B-2 판정의 새 기준선.
 *
 * 측정 항목:
 *  1. 클리어율 (3프리셋 × 1000판)
 *  2. 실발동률 (강림 ×2.0 적용 횟수/게임)
 *  3. 소멸률 (이월 후 다시 용신 부재 → 소멸)
 *  4. 강림 딜 비중 (이 측정은 별도 오버레이)
 *
 * 봇 지문 (fullCapBot.ts, 70fc9db):
 *   if (favorableElement && !ENABLE_YONGSIN_DESCENT) { // L121 — 강림 시 무가중
 *   yongsinDescent: initYongsinDescent(null, floorIndex), // createDeterministicState
 *
 * 엔진 지문 (paljajeonEngine.ts):
 *   if (ENABLE_YONGSIN_DESCENT && state.yongsinDescent && state.favorableElement && !isBlocked) { // L332
 *   damage = Math.round(damage * 2.0) // L1232
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

// ENABLE_YONGSIN_DESCENT=true 오버라이드
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), ENABLE_YONGSIN_DESCENT: true }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

// ─── 프리셋 ────────────────────────────────────────────────────────────────────
const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
    v3BaseRate: 39.43,  // v3 기준선 (강림 OFF)
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    v3BaseRate: 35.93,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
    v3BaseRate: 27.77,
  },
]

const RUNS = 1000

describe('강림제 0단계 — 미러링 수정 후 기준선 (M=2.0, 이월1회)', () => {
  it(
    '1000판 × 3프리셋: 클리어율 + 실발동률 + 소멸률',
    { timeout: 300000 },
    () => {
      const allResults: Array<{
        label: string
        clearRate: number
        v3BaseRate: number
        delta: string
        avgDescentActivated: number
        avgDescentDeferred: number
        avgDescentVanished: number
        activationRate: string
        vanishRate: string
        talismans: string[]
      }> = []

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        let totalDescentActivated = 0
        let totalDescentDeferred = 0
        let totalDescentVanished = 0

        for (let i = 0; i < RUNS; i++) {
          const result = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: preset.dist,
            favorableElement,
            enableFloorReward: true,
            activePassiveIds: talismans,
            enableEffectMode: true,
          })

          if (result.victory) cleared++
          totalDescentActivated += result.descentActivated ?? 0
          totalDescentDeferred += result.descentDeferred ?? 0
          totalDescentVanished += result.descentVanished ?? 0
        }

        const clearRate = (cleared / RUNS) * 100
        const avgActivated = totalDescentActivated / RUNS
        const avgDeferred = totalDescentDeferred / RUNS
        const avgVanished = totalDescentVanished / RUNS
        const totalEvents = totalDescentActivated + totalDescentDeferred + totalDescentVanished
        const activationRate = totalEvents > 0
          ? ((totalDescentActivated / totalEvents) * 100).toFixed(1)
          : '0.0'
        const vanishRate = totalEvents > 0
          ? ((totalDescentVanished / totalEvents) * 100).toFixed(1)
          : '0.0'

        allResults.push({
          label: preset.label,
          clearRate,
          v3BaseRate: preset.v3BaseRate,
          delta: `${clearRate >= preset.v3BaseRate ? '+' : ''}${(clearRate - preset.v3BaseRate).toFixed(2)}%p`,
          avgDescentActivated: Number(avgActivated.toFixed(2)),
          avgDescentDeferred: Number(avgDeferred.toFixed(2)),
          avgDescentVanished: Number(avgVanished.toFixed(2)),
          activationRate: activationRate + '%',
          vanishRate: vanishRate + '%',
          talismans,
        })
      }

      // ─── 결과 출력 ────────────────────────────────────────────────────────
      console.log('\n' + '='.repeat(80))
      console.log('강림제 0단계 — 미러링 수정 후 기준선 (M=2.0, 이월1회)')
      console.log('커밋: 70fc9db | 봇: 용신 무가중 | 엔진: 슬롯×2.0')
      console.log('='.repeat(80))

      console.log('\n┌─────────┬──────────┬──────────┬───────────┬───────────┬───────────┬───────────┬───────────┐')
      console.log('│ 프리셋  │ 클리어율 │  v3기준  │    차이    │ 발동/게임 │ 이월/게임 │ 소멸/게임 │ 발동률    │')
      console.log('├─────────┼──────────┼──────────┼───────────┼───────────┼───────────┼───────────┼───────────┤')

      for (const r of allResults) {
        console.log(
          `│ ${r.label.padEnd(6)} │ ${r.clearRate.toFixed(2).padStart(7)}% │ ${r.v3BaseRate.toFixed(2).padStart(7)}% │ ${r.delta.padStart(9)} │ ${String(r.avgDescentActivated).padStart(9)} │ ${String(r.avgDescentDeferred).padStart(9)} │ ${String(r.avgDescentVanished).padStart(9)} │ ${r.activationRate.padStart(9)} │`
        )
      }

      console.log('└─────────┴──────────┴──────────┴───────────┴───────────┴───────────┴───────────┴───────────┘')

      // 프리셋 간 격차
      const rates = allResults.map(r => r.clearRate)
      const gap = Math.max(...rates) - Math.min(...rates)
      console.log(`\n프리셋 간 격차: ${gap.toFixed(2)}%p`)
      console.log(`가호: ${allResults.map(r => `${r.label}=[${r.talismans.join(',')}]`).join(' | ')}`)

      // ─── 판정 기준 로그 ──────────────────────────────────────────────────
      console.log('\n─── 판정 기준 ───')
      for (const r of allResults) {
        const inGate = r.clearRate >= 25 && r.clearRate <= 40
        console.log(`${r.label}: ${r.clearRate.toFixed(2)}% → ${inGate ? '게이트권(25~40)' : '게이트 외'}`)
      }
      console.log('─'.repeat(80))

      // 기본 assertion — 시뮬이 실행되고 합리적 결과를 반환하는지 확인
      for (const r of allResults) {
        expect(r.clearRate).toBeGreaterThanOrEqual(0)
        expect(r.clearRate).toBeLessThanOrEqual(100)
      }
    },
  )
})
