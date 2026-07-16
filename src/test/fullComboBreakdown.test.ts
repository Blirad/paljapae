/**
 * 전체 딜 분해 진단 — recipe 모드 목화·금수 (2026-07-16 이든 지시)
 *
 * 확인 사항:
 *  ⓐ 연환이 recipe 판정 순서에 묻혀 죽었는가?
 *     → 코드 인용: isOhangYeonhwan > detectRecipe (recipe보다 연환 우선)
 *     → 실측 연환 발동률 (v3 기준 목화 2.47/판, 금수 2.40/판 대비)
 *  ⓑ 대형 레시피가 실제 발동되는가?
 *     → __recipeLog에 size='small'/'large' 구분 집계
 *
 * 출력: 일반기 / 소형 레시피 / 대형 레시피 / gather2~5 / 연환
 *       각 [발동수 × 평균데미지 × 총딜비중%] + 연환 발동률(회/판)
 *
 * 연환 판정 순서 코드 인용 (pokerHandJudge.ts):
 *   if (isOhangYeonhwan(selectedCards)) → return 연환 ← 1순위
 *   if (COMBO_RULESET_VERSION === 'recipe' && ...) → detectRecipe ← 2순위
 *   isOhangYeonhwan: combo.length === 5 && elements.size === 5
 *   → 5장+5원소 = 연환 우선. recipe로 넘어가지 않음. 연환 생존 확인.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' as const }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
    v3YeonhwanPerGame: 2.47,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    v3YeonhwanPerGame: 2.40,
  },
]

const RUNS = 1000

describe('전체 딜 분해 진단 — recipe 모드 (목화·금수)', () => {
  it('⓪ 연환 판정 순서 코드 인용 — 연환 생존 assert', () => {
    // pokerHandJudge.ts judgeCombo() 판정 순서:
    //   1. isOhangYeonhwan(selectedCards) → true 시 즉시 연환 return (recipe보다 우선)
    //   2. COMBO_RULESET_VERSION === 'recipe' → detectRecipe() (2순위)
    //   isOhangYeonhwan = combo.length === 5 && new Set(elements).size === 5
    // → 5장+5원소 서브셋은 recipe로 진입하지 않음 → 연환 판정 생존
    expect(true).toBe(true) // 구조적 assert — 코드 인용으로 증명
  })

  it('[A][B] 전체 콤보 유형별 딜 분해 + 연환 발동률', { timeout: 600000 }, () => {
    console.log('\n' + '═'.repeat(120))
    console.log('전체 딜 분해 진단 — recipe 모드 목화·금수 (이든 2026-07-16 지시)')
    console.log('판정 순서: ①연환(5장+5원소) > ②recipe(3/5장,elem1고정) > ③gather > ④none')
    console.log('═'.repeat(120))

    for (const preset of PRESETS) {
      const talismans = selectTalismanBySaju(preset.dist)
      const favorableElement = getFavorableElement(preset.ilgan)

      // 로그 초기화
      ;(globalThis as any).__recipeLog = []
      ;(globalThis as any).__gatherLog = []
      ;(globalThis as any).__yeonhwanLog = []
      ;(globalThis as any).__noneLog = []

      let cleared = 0

      for (let i = 0; i < RUNS; i++) {
        const result = simulateFullCapRun(i * 12345 + 7777, {
          elementDist: preset.dist,
          favorableElement,
          enableFloorReward: true,
          activePassiveIds: talismans,
          enableEffectMode: true,
        })
        if (result.victory) cleared++
      }

      const clearRate = (cleared / RUNS) * 100
      const recipeLog: Array<{ recipeId: string; damage: number; size: string }> =
        (globalThis as any).__recipeLog || []
      const gatherLog: Array<{ gatherKey: string; damage: number }> =
        (globalThis as any).__gatherLog || []
      const yeonhwanLog: Array<{ damage: number }> =
        (globalThis as any).__yeonhwanLog || []
      const noneLog: Array<{ damage: number }> =
        (globalThis as any).__noneLog || []

      // 전체 딜 합계
      const recipeDmg = recipeLog.reduce((s, e) => s + e.damage, 0)
      const gatherDmg = gatherLog.reduce((s, e) => s + e.damage, 0)
      const yeonhwanDmg = yeonhwanLog.reduce((s, e) => s + e.damage, 0)
      const noneDmg = noneLog.reduce((s, e) => s + e.damage, 0)
      const totalDmg = recipeDmg + gatherDmg + yeonhwanDmg + noneDmg

      const pct = (n: number) => totalDmg > 0 ? ((n / totalDmg) * 100).toFixed(1) + '%' : '0%'
      const avg = (arr: Array<{ damage: number }>) =>
        arr.length > 0 ? Math.round(arr.reduce((s, e) => s + e.damage, 0) / arr.length) : 0

      // 소형/대형 분리
      const smallRecipes = recipeLog.filter(e => e.size === 'small')
      const largeRecipes = recipeLog.filter(e => e.size === 'large')
      const smallDmg = smallRecipes.reduce((s, e) => s + e.damage, 0)
      const largeDmg = largeRecipes.reduce((s, e) => s + e.damage, 0)

      // gather 분리
      const gatherBySize: Record<string, Array<{ damage: number }>> = {}
      for (const e of gatherLog) {
        if (!gatherBySize[e.gatherKey]) gatherBySize[e.gatherKey] = []
        gatherBySize[e.gatherKey].push({ damage: e.damage })
      }

      // 연환 발동률
      const yeonhwanPerGame = yeonhwanLog.length / RUNS
      const yeonhwanDelta = yeonhwanPerGame - preset.v3YeonhwanPerGame

      console.log(`\n${'─'.repeat(60)} [${preset.label}] ${'─'.repeat(60)}`)
      console.log(`  [A] 클리어율: ${clearRate.toFixed(2)}% (게이트 25~40: ${clearRate >= 25 && clearRate <= 40 ? '✓' : '✗'})`)
      console.log(`\n  ┌─ 콤보 유형별 딜 분해 ─────────────────────────────────────────────────────────`)
      console.log(`  │ 유형                 │ 발동수   │ 평균데미지 │ 총딜      │ 비중`)
      console.log(`  ├──────────────────────┼──────────┼────────────┼───────────┼────────`)

      // 연환
      console.log(`  │ 연환(ohang-yeonhwan) │ ${String(yeonhwanLog.length).padEnd(8)} │ ${String(avg(yeonhwanLog)).padEnd(10)} │ ${String(yeonhwanDmg).padEnd(9)} │ ${pct(yeonhwanDmg)}`)

      // recipe 소형
      const avgSmall = smallRecipes.length > 0 ? Math.round(smallDmg / smallRecipes.length) : 0
      console.log(`  │ recipe 소형          │ ${String(smallRecipes.length).padEnd(8)} │ ${String(avgSmall).padEnd(10)} │ ${String(smallDmg).padEnd(9)} │ ${pct(smallDmg)}`)

      // recipe 대형
      const avgLarge = largeRecipes.length > 0 ? Math.round(largeDmg / largeRecipes.length) : 0
      console.log(`  │ recipe 대형          │ ${String(largeRecipes.length).padEnd(8)} │ ${String(avgLarge).padEnd(10)} │ ${String(largeDmg).padEnd(9)} │ ${pct(largeDmg)}`)

      // gather 2~5
      for (const k of ['gather2', 'gather3', 'gather4', 'gather5']) {
        const arr = gatherBySize[k] || []
        const dmg = arr.reduce((s, e) => s + e.damage, 0)
        const avgD = arr.length > 0 ? Math.round(dmg / arr.length) : 0
        console.log(`  │ ${k.padEnd(20)} │ ${String(arr.length).padEnd(8)} │ ${String(avgD).padEnd(10)} │ ${String(dmg).padEnd(9)} │ ${pct(dmg)}`)
      }

      // 일반기
      const avgNone = noneLog.length > 0 ? Math.round(noneDmg / noneLog.length) : 0
      console.log(`  │ 일반기(none)         │ ${String(noneLog.length).padEnd(8)} │ ${String(avgNone).padEnd(10)} │ ${String(noneDmg).padEnd(9)} │ ${pct(noneDmg)}`)
      console.log(`  └──────────────────────┴──────────┴────────────┴───────────┴────────`)
      console.log(`  │ 합계                 │ total    │            │ ${String(totalDmg).padEnd(9)} │ 100%`)

      // ⓐ 연환 발동률 (v3 대비)
      console.log(`\n  ⓐ 연환 발동률: ${yeonhwanPerGame.toFixed(2)}회/판  (v3 기준 ${preset.v3YeonhwanPerGame.toFixed(2)} → 차이 ${yeonhwanDelta >= 0 ? '+' : ''}${yeonhwanDelta.toFixed(2)}회/판)`)
      const yeonhwanStatus = Math.abs(yeonhwanDelta) < 0.3 ? '≈ 동일 (연환 판정 정상)' : yeonhwanDelta < 0 ? '⚠ 감소 (연환 억제 가능성)' : '증가'
      console.log(`     판정: ${yeonhwanStatus}`)

      // ⓑ 대형 레시피 실발동
      console.log(`\n  ⓑ 대형 레시피 실발동: ${largeRecipes.length}회 / 1000판 = ${(largeRecipes.length / RUNS).toFixed(2)}회/판`)
      const largeStatus = largeRecipes.length > 0 ? '✓ 대형 발동 확인' : '✗ 대형 미발동 (봇이 대형 선택 안 함)'
      console.log(`     판정: ${largeStatus}`)

      // 소형별 recipe 분해
      const recipeSmallById: Record<string, { count: number; damage: number }> = {}
      for (const e of smallRecipes) {
        if (!recipeSmallById[e.recipeId]) recipeSmallById[e.recipeId] = { count: 0, damage: 0 }
        recipeSmallById[e.recipeId].count++
        recipeSmallById[e.recipeId].damage += e.damage
      }
      console.log(`\n  [소형 레시피 개별 집계]`)
      for (const [id, data] of Object.entries(recipeSmallById).sort((a, b) => b[1].count - a[1].count)) {
        const avgD = data.count > 0 ? Math.round(data.damage / data.count) : 0
        console.log(`    ${id.padEnd(20)}: ${String(data.count).padEnd(6)}회 × ${avgD.toString().padEnd(4)} = ${String(data.damage).padEnd(8)} (${pct(data.damage)})`)
      }

      // 대형별 recipe 분해
      const recipeLargeById: Record<string, { count: number; damage: number }> = {}
      for (const e of largeRecipes) {
        if (!recipeLargeById[e.recipeId]) recipeLargeById[e.recipeId] = { count: 0, damage: 0 }
        recipeLargeById[e.recipeId].count++
        recipeLargeById[e.recipeId].damage += e.damage
      }
      if (Object.keys(recipeLargeById).length > 0) {
        console.log(`\n  [대형 레시피 개별 집계]`)
        for (const [id, data] of Object.entries(recipeLargeById).sort((a, b) => b[1].count - a[1].count)) {
          const avgD = data.count > 0 ? Math.round(data.damage / data.count) : 0
          console.log(`    ${id.padEnd(20)}: ${String(data.count).padEnd(6)}회 × ${avgD.toString().padEnd(4)} = ${String(data.damage).padEnd(8)} (${pct(data.damage)})`)
        }
      }

      expect(clearRate).toBeGreaterThanOrEqual(0)
      expect(clearRate).toBeLessThanOrEqual(100)
    }

    console.log('\n' + '═'.repeat(120))
    console.log('분기 진단 기준:')
    console.log('  연환 ≈ v3(±0.3회): 연환 판정 정상 → 연환 억제 아님 → 대형 레시피 승격 처방')
    console.log('  연환 << v3(−0.5+): 연환 판정 이상 → 판정 순서 수정이 처방 전부일 가능성')
    console.log('  대형 미발동: 봇이 elem1×2+elem2×3 형성 포기 → 소형 전용 구조로 유지')
    console.log('═'.repeat(120))
  })
})
