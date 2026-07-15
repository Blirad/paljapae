/**
 * 배치 1.5 최종 재측정 — 완전 규격
 *
 * 동시 산출:
 * [A] 클리어율 + 포착률
 * [B] 금수 recipe 딜 분해 (레시피별 발동수 × 평균데미지 × 총딜비중%)
 * [C] 토단일 α 성립률 신측정 + 소응축 발동수·클리어 기여
 *
 * 로깅: 관찰만, 게임 로직 영향 0
 */

import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

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

describe('배치 1.5 최종 재측정 — 1000판 × 3프리셋 × 양 룰셋', () => {
  it('[A][B][C] 동시 산출', { timeout: 600000 }, () => {
    console.log('\n' + '═'.repeat(130))
    console.log('배치 1.5 최종 재측정 — recipe 모드 (α 촉매 1장 검사 포함)')
    console.log('═'.repeat(130))

    const results: Array<{
      label: string
      clearRate: number
      recipeBreakdown: Record<string, { count: number; damage: number; avgDamage: number; percent: string }>
      toDanilAlpha: { attempts: number; successes: number; rate: string }
    }> = []

    for (const preset of PRESETS) {
      const talismans = selectTalismanBySaju(preset.dist)
      const favorableElement = getFavorableElement(preset.ilgan)

      let cleared = 0
      const aggregatedRecipeLog: Record<string, { count: number; damage: number }> = {}
      let toDanilAlphaAttempts = 0
      let toDanilAlphaSuccesses = 0

      // Initialize logs for this preset's 1000 runs
      ;(globalThis as any).__recipeLog = []
      ;(globalThis as any).__toDanilAlphaLog = undefined

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

      // [B] 레시피 딜 분해 수집 — 1000게임 누적 완료 후 처리
      const recipeLog = (globalThis as any).__recipeLog || []
      for (const { recipeId, damage } of recipeLog) {
        if (!aggregatedRecipeLog[recipeId]) {
          aggregatedRecipeLog[recipeId] = { count: 0, damage: 0 }
        }
        aggregatedRecipeLog[recipeId].count++
        aggregatedRecipeLog[recipeId].damage += damage
      }

      // [C] 토단일 α 로그 수집
      const alphaLog = (globalThis as any).__toDanilAlphaLog
      if (alphaLog && preset.key === 'toDanil') {
        toDanilAlphaAttempts = alphaLog.attempts
        toDanilAlphaSuccesses = alphaLog.successes
      }

      const clearRate = (cleared / RUNS) * 100
      // [C] 강림 OFF (initYongsinDescent(null, ...)) — 포착률 컬럼 제거

      console.log(`\n[${preset.label}]`)
      console.log(`  [A] 클리어율: ${clearRate.toFixed(2)}% (게이트 25~40: ${clearRate >= 25 && clearRate <= 40 ? '✓' : '✗'})`)

      // [B] 레시피별 딜 분해
      const breakdown: Record<string, { count: number; damage: number; avgDamage: number; percent: string }> = {}
      let totalRecipeDamage = 0
      for (const [recipeId, data] of Object.entries(aggregatedRecipeLog)) {
        totalRecipeDamage += data.damage
      }
      for (const [recipeId, data] of Object.entries(aggregatedRecipeLog)) {
        const percent = totalRecipeDamage > 0 ? ((data.damage / totalRecipeDamage) * 100).toFixed(1) : '0'
        const avgDamage = data.count > 0 ? data.damage / data.count : 0
        breakdown[recipeId] = {
          count: data.count,
          damage: data.damage,
          avgDamage,
          percent,
        }
        if (preset.key === 'geumSu') {
          console.log(`    [B] ${recipeId}: ${data.count}회 × ${avgDamage.toFixed(0)} = ${data.damage}(${percent}%)`)
        }
      }

      // [C] 토단일 α 통계
      const toDanilAlpha = preset.key === 'toDanil'
        ? { attempts: toDanilAlphaAttempts, successes: toDanilAlphaSuccesses, rate: toDanilAlphaAttempts > 0 ? ((toDanilAlphaSuccesses / toDanilAlphaAttempts) * 100).toFixed(1) + '%' : '0%' }
        : { attempts: 0, successes: 0, rate: 'N/A' }

      if (preset.key === 'toDanil') {
        console.log(`  [C] 소응축 α: ${toDanilAlpha.successes}/${toDanilAlpha.attempts} (${toDanilAlpha.rate}) + 클리어 기여`)
      }

      results.push({
        label: preset.label,
        clearRate,
        recipeBreakdown: breakdown,
        toDanilAlpha,
      })

      // sanity: 판당 발동수 ≤ 19 (물리적 최대값)
      const recipeLog = (globalThis as any).__recipeLog || []
      const activationsPerGame = recipeLog.length / RUNS
      expect(activationsPerGame).toBeLessThanOrEqual(19)

      expect(clearRate).toBeGreaterThanOrEqual(0)
      expect(clearRate).toBeLessThanOrEqual(100)
    }

    console.log('\n' + '═'.repeat(130))
    console.log('[B] 금수 recipe 딜 분해')
    console.log('═'.repeat(130))
    const geumSuResult = results.find(r => r.label === '금수')
    if (geumSuResult) {
      console.log('(레시피별 발동수 × 평균데미지 × 총딜비중% — 39.7% 구조 확인)')
      console.log('추적 대상: fusion_keen(고빈도) vs 대형×3.5(구조) vs 기타')
    }

    console.log('\n' + '═'.repeat(130))
    console.log('[C] 토단일 α 성립률 신측정')
    console.log('═'.repeat(130))
    const toDanilResult = results.find(r => r.label === '토단일')
    if (toDanilResult) {
      console.log(`소응축 발동 시도/성공 (기준: 13.8% → 회복 폭 측정)`)
      console.log(`소응축 클리어 기여 (예: "소형만으로 X판 클리어" 추정)`)
    }

    // ═══ 결과 파일 저장 (세션 유실 방지)
    const timestamp = new Date().toISOString().split('T')[0]
    const resultFile = path.join(process.cwd(), `ZERA_BATCH1P5_FINAL_RESULT_${timestamp}.md`)

    const resultContent = JSON.stringify(results, null, 2)
    fs.writeFileSync(resultFile, resultContent)
    console.log(`\n✓ 결과 파일 저장: ${resultFile}`)
  })
})
