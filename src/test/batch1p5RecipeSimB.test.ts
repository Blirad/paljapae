/**
 * 배치 1.5 레시피제 시뮬 — B 벌: recipe 모드 1000판 × 3프리셋 (재발사)
 *
 * 커밋: ebe0106
 * COMBO_RULESET_VERSION='recipe' 오버라이드 (vi.mock 최상단 필수)
 *
 * 주의: recipe 모드에서 judgeCombo() L146 분기의 폴백 구조:
 *   - recipe 불성립 + isFusionCombo → fusion 폴백 반환
 *   - recipe 불성립 + !isFusionCombo → isGatherCombo 체크 없이 분기 종료 → undefined 반환 가능
 *   이 케이스가 발생하면 fullCapBot L289에서 TypeError 발생.
 *   → 시뮬 실행 가능 여부 자체가 연동 상태 진단이다.
 *
 * 시드: i×12345+7777 (i=0~999)
 * 가호: selectTalismanBySaju(dist)
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

// COMBO_RULESET_VERSION='recipe' 오버라이드 — 반드시 최상단
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
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
    baseRate: 39.43,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    baseRate: 35.93,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
    baseRate: 27.77,
  },
]

const RUNS = 1000

describe('배치 1.5 레시피제 시뮬 — B 벌: recipe 모드 (ebe0106 연동 완성)', () => {
  it(
    'recipe 클리어율 1000판 × 3프리셋 + v3 대비 격차 분석',
    { timeout: 300000 },
    async () => {
      interface RecipeResult {
        label: string
        talismans: string[]
        recipeCleared: number
        recipeRate: number
        baseRate: number
        deathsByFloor: Record<number, number>
        traitCounts: Record<string, number>
        fusionCount: number
        totalAttacks: number
      }

      const recipeResults: RecipeResult[] = []

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let recipeCleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        const traitCounts: Record<string, number> = {}
        let fusionCount = 0
        let totalAttacks = 0

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const r = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds: talismans,
            enableFloorReward: true,
            enableEffectMode: true,
          })

          if (r.victory) {
            recipeCleared++
          } else if (r.deathFloor !== null) {
            deathsByFloor[r.deathFloor] = (deathsByFloor[r.deathFloor] ?? 0) + 1
          }

          fusionCount += r.fusionCount ?? 0

          if (r.traitCounts) {
            for (const [k, v] of Object.entries(r.traitCounts)) {
              traitCounts[k] = (traitCounts[k] ?? 0) + v
            }
          }

          for (const fs of r.floorStats) {
            totalAttacks += fs.attackCount
          }
        }

        recipeResults.push({
          label: preset.label,
          talismans,
          recipeCleared,
          recipeRate: (recipeCleared / RUNS) * 100,
          baseRate: preset.baseRate,
          deathsByFloor,
          traitCounts,
          fusionCount,
          totalAttacks,
        })
      }

      // ─── 출력 ────────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(72))
      console.log('배치 1.5 레시피제 시뮬 — B 벌: recipe 모드 (재발사, ebe0106)')
      console.log('커밋: ebe0106 | COMBO_RULESET_VERSION=recipe (오버라이드)')
      console.log('='.repeat(72))

      // §4 dispatch 8줄
      console.log('\n[§4 dispatch 8줄]')
      console.log('커밋: ebe0106')
      console.log('프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}')
      console.log("조건: COMBO_RULESET_VERSION='recipe' (vi.mock 오버라이드) / v3 기준선은 A벌")
      console.log('시드: i×12345+7777 (i=0~999)')
      const talismanLine = recipeResults.map(r => `${r.label}[${r.talismans.join('+')}]`).join('/')
      console.log(`가호: selectTalismanBySaju(dist) — ${talismanLine}`)
      console.log('채택률 단위: "%" — (count/n)×100')
      console.log("7. 레시피 지문: COMBO_RULESET_VERSION === 'recipe' && (selectedCards.length === 3 || selectedCards.length === 5) → detectRecipe() 경유 (judgeCombo L146)")
      console.log("8. COMBO_RULESET_VERSION: v3(기존, A벌)/recipe(신규, B벌) — ebe0106에서 judgeCombo 연동 완성")

      // recipe 클리어율 vs v3 기준선 비교
      console.log('\n[recipe 클리어율 vs v3 기준선 비교]')
      const balanceV3 = { 목화: 39.43, 금수: 35.93, 토단일: 27.77 }
      console.log('| 프리셋 | recipe 클리어율 | v3 기준선 | 격차 | 판정 |')
      console.log('|--------|--------------|---------|------|------|')
      for (const r of recipeResults) {
        const base = balanceV3[r.label as keyof typeof balanceV3] ?? 0
        const diff = r.recipeRate - base
        const mark = Math.abs(diff) <= 3 ? 'OK' : diff > 3 ? 'UP' : 'DOWN'
        console.log(
          `| ${r.label.padEnd(6)} | ${r.recipeRate.toFixed(2).padStart(14)}% | ${base.toFixed(2)}% | ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p | ${mark} |`
        )
      }
      const recipeRates = recipeResults.map(r => r.recipeRate)
      const recipeGap = Math.max(...recipeRates) - Math.min(...recipeRates)
      console.log(`\nrecipe 프리셋 간 격차: ${recipeGap.toFixed(2)}%p (기준: 11.67%p, 게이트: +-1%p)`)
      const recipeGatePass = Math.abs(recipeGap - 11.67) <= 1.0
      console.log(`격차 게이트: ${recipeGatePass ? 'PASS' : 'FAIL'}`)

      // 계층별 발동 분포 (recipe 모드)
      console.log('\n[recipe 모드 계층별 발동 분포]')
      console.log('| 프리셋 | 모으기% | 융합/레시피% | 연환% | 총 공격 |')
      console.log('|--------|--------|-----------|------|--------|')
      for (const r of recipeResults) {
        const gather = ['gather2','gather3','gather4','gather5'].reduce((s, k) => s + (r.traitCounts[k] ?? 0), 0)
        const fusion = r.fusionCount
        const yeonhwan = r.traitCounts['ohang-yeonhwan'] ?? 0
        const total = gather + fusion + yeonhwan
        const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0.0'
        console.log(
          `| ${r.label.padEnd(6)} | ${pct(gather).padStart(6)}% | ${pct(fusion).padStart(9)}% | ${pct(yeonhwan).padStart(4)}% | ${total} |`
        )
      }

      // recipe 발동 키 분포 (traitCounts 내 fusion_ 계열)
      console.log('\n[recipe 발동 키 분포 (traitCounts)]')
      for (const r of recipeResults) {
        const recipeKeys = Object.entries(r.traitCounts)
          .filter(([k]) => k.startsWith('fusion_'))
          .sort(([, a], [, b]) => b - a)
        console.log(`  ${r.label}: ${recipeKeys.map(([k, v]) => `${k}=${v}`).join(', ') || '없음'}`)
      }

      // 층별 사망
      console.log('\n[층별 사망 분포]')
      for (const r of recipeResults) {
        console.log(`  ${r.label}: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
      }

      // 검증
      for (const r of recipeResults) {
        expect(r.recipeRate).toBeGreaterThanOrEqual(10)
        expect(r.recipeRate).toBeLessThanOrEqual(70)
      }
      expect(recipeGap).toBeGreaterThan(0)

      console.log('\n[PASS] recipe 모드 시뮬 완료 (B벌, ebe0106)')
    }
  )
})
