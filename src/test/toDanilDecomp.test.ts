/**
 * 토단일 딜 소스 분해 — 전체 공격 유형 분리 (작업 A)
 *
 * gather2/3/4/5 + recipe 각종 + yeonhwan 를 발동 횟수 + 총딜 기준으로 집계
 * A벌(×6.5) / recipe 모드 / toDanil / 1000판
 *
 * 산출: gather5 vs recipe 딜 비중 비교 → 43.0% 초과 범인 특정
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

describe('[A] 토단일 딜 소스 분해 — 1000판 × recipe 모드', () => {
  it('전체 공격 유형별 발동수 + 총딜 + 비중 집계', { timeout: 600000 }, async () => {
    vi.mock('../engine/balance', async () => {
      const actual = await vi.importActual('../engine/balance')
      return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
    })

    const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
    const { getFavorableElement } = await import('../engine/manseryeok')

    const RUNS = 1000
    const preset = {
      key: 'toDanil',
      label: '토단일',
      dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
      ilgan: 'to' as Element,
    }

    const talismans = selectTalismanBySaju(preset.dist)
    const favorableElement = getFavorableElement(preset.ilgan)

    let cleared = 0

    // gather 딜 집계
    const gatherDmg: Record<string, { count: number; damage: number }> = {
      gather2: { count: 0, damage: 0 },
      gather3: { count: 0, damage: 0 },
      gather4: { count: 0, damage: 0 },
      gather5: { count: 0, damage: 0 },
    }
    // recipe 딜 집계
    const recipeDmg: Record<string, { count: number; damage: number }> = {}
    // yeonhwan 딜 집계
    let yeonhwanCount = 0
    let yeonhwanDamage = 0

    for (let i = 0; i < RUNS; i++) {
      // 판 시작마다 글로벌 로그 초기화
      ;(globalThis as any).__recipeLog = []
      ;(globalThis as any).__gatherLog = []
      ;(globalThis as any).__yeonhwanLog = []

      const result = simulateFullCapRun(i * 12345 + 7777, {
        elementDist: preset.dist,
        favorableElement,
        enableFloorReward: true,
        activePassiveIds: talismans,
        enableEffectMode: true,
      })

      if (result.victory) cleared++

      // gather 수집
      const gatherLog: Array<{ gatherKey: string; damage: number }> = (globalThis as any).__gatherLog || []
      for (const entry of gatherLog) {
        const key = entry.gatherKey as keyof typeof gatherDmg
        if (!gatherDmg[key]) gatherDmg[key] = { count: 0, damage: 0 }
        gatherDmg[key].count++
        gatherDmg[key].damage += entry.damage
      }

      // recipe 수집
      const recipeLog: Array<{ recipeId: string; damage: number }> = (globalThis as any).__recipeLog || []
      for (const entry of recipeLog) {
        if (!recipeDmg[entry.recipeId]) recipeDmg[entry.recipeId] = { count: 0, damage: 0 }
        recipeDmg[entry.recipeId].count++
        recipeDmg[entry.recipeId].damage += entry.damage
      }

      // yeonhwan 수집
      const yeonhwanLog: Array<{ damage: number }> = (globalThis as any).__yeonhwanLog || []
      for (const entry of yeonhwanLog) {
        yeonhwanCount++
        yeonhwanDamage += entry.damage
      }
    }

    const clearRate = (cleared / RUNS) * 100

    // 총딜 합계
    let totalGatherDamage = 0
    for (const v of Object.values(gatherDmg)) totalGatherDamage += v.damage

    let totalGatherCount = 0
    for (const v of Object.values(gatherDmg)) totalGatherCount += v.count

    let totalRecipeDamage = 0
    for (const v of Object.values(recipeDmg)) totalRecipeDamage += v.damage

    let totalRecipeCount = 0
    for (const v of Object.values(recipeDmg)) totalRecipeCount += v.count

    const grandTotal = totalGatherDamage + totalRecipeDamage + yeonhwanDamage

    // ─── 출력 ──────────────────────────────────────────────────────────────────

    console.log('\n' + '═'.repeat(110))
    console.log('[A] 토단일 딜 소스 분해 — 1000판 / recipe 모드 / A벌(gather5×6.5)')
    console.log('═'.repeat(110))
    console.log(`클리어율: ${clearRate.toFixed(2)}% (게이트 25~40: ${clearRate >= 25 && clearRate <= 40 ? 'PASS' : 'FAIL'})`)
    console.log('')

    console.log('[ 전체 딜 소스 분해 — 공격 유형별 ]')
    console.log(`${'공격 유형'.padEnd(28)} ${'발동수'.padStart(7)} ${'평균딜'.padStart(8)} ${'총딜'.padStart(10)} ${'비중%'.padStart(8)}`)
    console.log('─'.repeat(68))

    const GATHER_MULTS: Record<string, number> = { gather2: 1.3, gather3: 2.5, gather4: 4.0, gather5: 6.5 }  // §1-c: gather2 1.3 확정
    const gatherOrder = ['gather5', 'gather4', 'gather3', 'gather2']
    for (const key of gatherOrder) {
      const d = gatherDmg[key] ?? { count: 0, damage: 0 }
      const mult = GATHER_MULTS[key] ?? '?'
      const avg = d.count > 0 ? (d.damage / d.count).toFixed(1) : '0'
      const pct = grandTotal > 0 ? ((d.damage / grandTotal) * 100).toFixed(1) : '0'
      console.log(`  ${(`${key} (×${mult})`).padEnd(26)} ${String(d.count).padStart(7)} ${avg.padStart(8)} ${String(d.damage).padStart(10)} ${(pct + '%').padStart(8)}`)
    }

    // recipe 항목 (딜 내림차순)
    const recipeOrder = [
      'fusion_forest', 'fusion_spring', 'fusion_mine', 'fusion_kiln', 'fusion_wildfire',
      'fusion_keen', 'fusion_snipe', 'fusion_harvest', 'fusion_pierce', 'fusion_temper',
    ]
    for (const id of recipeOrder) {
      const d = recipeDmg[id] ?? { count: 0, damage: 0 }
      if (d.count === 0) continue
      const avg = d.count > 0 ? (d.damage / d.count).toFixed(1) : '0'
      const pct = grandTotal > 0 ? ((d.damage / grandTotal) * 100).toFixed(1) : '0'
      console.log(`  ${id.padEnd(26)} ${String(d.count).padStart(7)} ${avg.padStart(8)} ${String(d.damage).padStart(10)} ${(pct + '%').padStart(8)}`)
    }
    // 미분류 recipe
    for (const [id, d] of Object.entries(recipeDmg)) {
      if (!recipeOrder.includes(id)) {
        const avg = d.count > 0 ? (d.damage / d.count).toFixed(1) : '0'
        const pct = grandTotal > 0 ? ((d.damage / grandTotal) * 100).toFixed(1) : '0'
        console.log(`  ${(`기타: ${id}`).padEnd(26)} ${String(d.count).padStart(7)} ${avg.padStart(8)} ${String(d.damage).padStart(10)} ${(pct + '%').padStart(8)}`)
      }
    }

    // yeonhwan
    {
      const avg = yeonhwanCount > 0 ? (yeonhwanDamage / yeonhwanCount).toFixed(1) : '0'
      const pct = grandTotal > 0 ? ((yeonhwanDamage / grandTotal) * 100).toFixed(1) : '0'
      console.log(`  ${'오행연환 (×8)'.padEnd(26)} ${String(yeonhwanCount).padStart(7)} ${avg.padStart(8)} ${String(yeonhwanDamage).padStart(10)} ${(pct + '%').padStart(8)}`)
    }

    console.log('─'.repeat(68))
    // 합계
    const totalCount = totalGatherCount + totalRecipeCount + yeonhwanCount
    console.log(`  ${'합계'.padEnd(26)} ${String(totalCount).padStart(7)} ${''.padStart(8)} ${String(grandTotal).padStart(10)} ${'100%'.padStart(8)}`)

    console.log('')
    const gather5Pct = grandTotal > 0 ? ((gatherDmg.gather5.damage / grandTotal) * 100) : 0
    const gatherTotalPct = grandTotal > 0 ? ((totalGatherDamage / grandTotal) * 100) : 0
    const recipeTotalPct = grandTotal > 0 ? ((totalRecipeDamage / grandTotal) * 100) : 0

    console.log(`gather5 딜 비중: ${gather5Pct.toFixed(1)}%`)
    console.log(`gather 전체 딜 비중: ${gatherTotalPct.toFixed(1)}%`)
    console.log(`recipe (융합) 딜 비중: ${recipeTotalPct.toFixed(1)}%`)
    console.log(`yeonhwan 딜 비중: ${grandTotal > 0 ? ((yeonhwanDamage / grandTotal) * 100).toFixed(1) : '0'}%`)
    console.log('')
    const verdict = gather5Pct > recipeTotalPct ? 'gather5 (×6.5 배율)' : 'recipe 배율'
    console.log(`범인: ${verdict}`)
    console.log('═'.repeat(110))

    // assert
    expect(clearRate).toBeGreaterThanOrEqual(0)
    expect(clearRate).toBeLessThanOrEqual(100)
    expect(grandTotal).toBeGreaterThan(0)
  })
})
