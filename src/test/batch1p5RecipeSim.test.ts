/**
 * 배치 1.5 레시피제 시뮬 — A 벌: v3 기준선 1000판 × 3프리셋 (재발사)
 *
 * 커밋: ebe0106
 * 이전 시뮬(630530f)과의 차이:
 *   - 630530f: detectRecipe() judgeCombo() 미연동 → 결과 무효
 *   - ebe0106: COMBO_RULESET_VERSION='recipe' 시 judgeCombo() L146 분기 진입 → 연동 완성
 *
 * 시드: i×12345+7777 (i=0~999)
 * 가호: selectTalismanBySaju(dist)
 *
 * A 벌: COMBO_RULESET_VERSION='v3' (기본값) — v3 기준선
 * B 벌 (recipe 모드): batch1p5RecipeSimB.test.ts 참조
 *
 * 소형 레시피 성립률 (덱 샘플링 측정):
 *   - 목화: 소숲(水1+木2) — fusion_forest
 *   - 금수: 소광맥(土1+金2) — fusion_mine
 *   - 토단일: 소응축(火1+土2) — fusion_kiln [재실측]
 *
 * 레시피 지문 (pokerHandJudge.ts L146, 커밋 ebe0106):
 *   COMBO_RULESET_VERSION === 'recipe' && (selectedCards.length === 3 || selectedCards.length === 5)
 *   → const recipeId = detectRecipe(selectedCards)
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { RECIPE_MAP } from '../engine/balance'
import type { Card } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'

// ─── 프리셋 정의 ─────────────────────────────────────────────────────────────
const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
    smallRecipeId: 'fusion_forest',
    smallRecipeLabel: '소숲(水1+木2)',
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    smallRecipeId: 'fusion_mine',
    smallRecipeLabel: '소광맥(土1+金2)',
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
    smallRecipeId: 'fusion_kiln',
    smallRecipeLabel: '소응축(火1+土2)',
  },
]

const RUNS = 1000

// ─── detectRecipe 인라인 재현 (성립률 측정용) ────────────────────────────────
function detectRecipeInline(combo: Card[]): string | null {
  if (combo.length !== 3 && combo.length !== 5) return null

  const elementCounts: Record<string, number> = {}
  for (const card of combo) {
    elementCounts[card.element] = (elementCounts[card.element] ?? 0) + 1
  }

  for (const [recipeId, recipe] of Object.entries(RECIPE_MAP)) {
    const spec = combo.length === 3 ? recipe.small : recipe.large
    const { elem1, elem2, minCount } = spec

    if (combo.length === 3) {
      if (elem2 === null) {
        const otherCount = combo.length - (elementCounts[elem1] ?? 0)
        if ((elementCounts[elem1] ?? 0) >= 1 && otherCount >= minCount) return recipeId
      } else if (elem1 === elem2) {
        if ((elementCounts[elem1] ?? 0) >= minCount) return recipeId
      } else {
        if ((elementCounts[elem1] ?? 0) >= 1 && (elementCounts[elem2] ?? 0) >= 2) return recipeId
        if ((elementCounts[elem2] ?? 0) >= 1 && (elementCounts[elem1] ?? 0) >= 2) return recipeId
      }
    }

    if (combo.length === 5) {
      if (elem2 === null) {
        const otherCount = combo.length - (elementCounts[elem1] ?? 0)
        if ((elementCounts[elem1] ?? 0) >= 2 && otherCount >= minCount) return recipeId
      } else if (elem1 === elem2) {
        if ((elementCounts[elem1] ?? 0) >= minCount) return recipeId
      } else {
        if ((elementCounts[elem1] ?? 0) >= 2 && (elementCounts[elem2] ?? 0) >= 3) return recipeId
        if ((elementCounts[elem2] ?? 0) >= 2 && (elementCounts[elem1] ?? 0) >= 3) return recipeId
      }
    }
  }

  return null
}

function sampleRecipeRate(
  dist: Record<Element, number>,
  targetRecipeId: string,
  seed: number,
): { rate3: number; targetRate: number } {
  const elements: Element[] = []
  const total = Object.values(dist).reduce((s, v) => s + v, 0)
  for (const [el, count] of Object.entries(dist)) {
    const cards = Math.round((count / total) * 14)
    for (let i = 0; i < cards; i++) {
      elements.push(el as Element)
    }
  }
  while (elements.length < 14) elements.push('to')

  let s = seed
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }

  const shuffle = (arr: Element[]) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const SAMPLES = 2000
  let combo3Count = 0
  let target3Count = 0
  let totalRecipe3 = 0

  for (let i = 0; i < SAMPLES; i++) {
    const shuffled = shuffle(elements)
    const hand8 = shuffled.slice(0, 8)

    const available = [...Array(hand8.length).keys()]
    const pick3: number[] = []
    while (pick3.length < 3 && available.length > 0) {
      const pos = Math.floor(rng() * available.length)
      pick3.push(available.splice(pos, 1)[0])
    }
    if (pick3.length === 3) {
      const cards3: Card[] = pick3.map((idx, j) => ({
        id: `c3_${i}_${j}`,
        element: hand8[idx],
        polarity: 'yang' as const,
        value: 5,
        type: 'soldier' as const,
        rarity: 'common' as const,
      }))
      combo3Count++
      const recipeResult = detectRecipeInline(cards3)
      if (recipeResult !== null) totalRecipe3++
      if (recipeResult === targetRecipeId) target3Count++
    }
  }

  return {
    rate3: combo3Count > 0 ? (totalRecipe3 / combo3Count) * 100 : 0,
    targetRate: combo3Count > 0 ? (target3Count / combo3Count) * 100 : 0,
  }
}

// ─── A 벌: v3 기준선 시뮬 ────────────────────────────────────────────────────

describe('배치 1.5 레시피제 시뮬 — A 벌: v3 기준선 (ebe0106)', () => {
  it(
    'v3 클리어율 1000판 × 3프리셋 + 소형 레시피 성립률',
    { timeout: 300000 },
    () => {
      interface PresetResult {
        label: string
        talismans: string[]
        v3Cleared: number
        v3Rate: number
        deathsByFloor: Record<number, number>
        traitCounts: Record<string, number>
        fusionCount: number
        recipeRate_3: number
        targetRecipeRate: number
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let v3Cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        const traitCounts: Record<string, number> = {}
        let fusionCount = 0

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
            v3Cleared++
          } else if (r.deathFloor !== null) {
            deathsByFloor[r.deathFloor] = (deathsByFloor[r.deathFloor] ?? 0) + 1
          }

          fusionCount += r.fusionCount ?? 0

          if (r.traitCounts) {
            for (const [k, v] of Object.entries(r.traitCounts)) {
              traitCounts[k] = (traitCounts[k] ?? 0) + v
            }
          }
        }

        const recipeStats = sampleRecipeRate(preset.dist, preset.smallRecipeId, 42)

        results.push({
          label: preset.label,
          talismans,
          v3Cleared,
          v3Rate: (v3Cleared / RUNS) * 100,
          deathsByFloor,
          traitCounts,
          fusionCount,
          recipeRate_3: recipeStats.rate3,
          targetRecipeRate: recipeStats.targetRate,
        })
      }

      // ─── 출력 ──────────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(72))
      console.log('배치 1.5 레시피제 시뮬 — A 벌: v3 기준선 (재발사, ebe0106)')
      console.log('커밋: ebe0106 | COMBO_RULESET_VERSION=v3 (기본값)')
      console.log('='.repeat(72))

      // §4 dispatch 8줄
      console.log('\n[§4 dispatch 8줄]')
      console.log('커밋: ebe0106')
      console.log('프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}')
      console.log("조건: COMBO_RULESET_VERSION='v3' (기준선) / 'recipe'(B벌, batch1p5RecipeSimB.test.ts)")
      console.log('시드: i×12345+7777 (i=0~999)')
      const talismanLine = results.map(r => `${r.label}[${r.talismans.join('+')}]`).join('/')
      console.log(`가호: selectTalismanBySaju(dist) — ${talismanLine}`)
      console.log('채택률 단위: "%" — (count/n)×100')
      console.log("7. 레시피 지문: COMBO_RULESET_VERSION === 'recipe' && (selectedCards.length === 3 || selectedCards.length === 5) → detectRecipe() 경유 (judgeCombo L146)")
      console.log("8. COMBO_RULESET_VERSION: v3(기존)/recipe(신규) — ebe0106에서 judgeCombo 연동 완성")

      // v3 클리어율 표
      console.log('\n[v3 클리어율 — balance-v3 기준선 대비]')
      const balanceV3 = { 목화: 39.43, 금수: 35.93, 토단일: 27.77 }
      console.log('| 프리셋 | 가호 | v3 클리어율 | 기준선 | 차이 |')
      console.log('|--------|------|-----------|--------|------|')
      for (const r of results) {
        const base = balanceV3[r.label as keyof typeof balanceV3] ?? 0
        const diff = r.v3Rate - base
        console.log(
          `| ${r.label.padEnd(6)} | ${r.talismans.join('+')} | ${r.v3Rate.toFixed(2).padStart(11)}% | ${base.toFixed(2)}% | ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p |`
        )
      }
      const v3Rates = results.map(r => r.v3Rate)
      const v3Gap = Math.max(...v3Rates) - Math.min(...v3Rates)
      console.log(`\nv3 프리셋 간 격차: ${v3Gap.toFixed(2)}%p (기준: 11.67%p, 게이트: +-1%p)`)
      const gatePass = Math.abs(v3Gap - 11.67) <= 1.0
      console.log(`격차 게이트: ${gatePass ? 'PASS' : 'FAIL'} (|${v3Gap.toFixed(2)} - 11.67| = ${Math.abs(v3Gap - 11.67).toFixed(2)})`)

      // 층별 사망
      console.log('\n[층별 사망 분포]')
      console.log('| 프리셋 | 1층 | 2층 | 3층 | 4층 |')
      console.log('|--------|-----|-----|-----|-----|')
      for (const r of results) {
        console.log(
          `| ${r.label.padEnd(6)} | ${r.deathsByFloor[1]} | ${r.deathsByFloor[2]} | ${r.deathsByFloor[3]} | ${r.deathsByFloor[4]} |`
        )
      }

      // 계층별 발동 분포 (v3 모드)
      console.log('\n[v3 계층별 발동 분포]')
      console.log('| 프리셋 | 모으기% | 융합% | 연환% | 총 공격 |')
      console.log('|--------|--------|------|------|--------|')
      for (const r of results) {
        const gather = ['gather2','gather3','gather4','gather5'].reduce((s, k) => s + (r.traitCounts[k] ?? 0), 0)
        const fusion = r.fusionCount
        const yeonhwan = r.traitCounts['ohang-yeonhwan'] ?? 0
        const total = gather + fusion + yeonhwan
        const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0.0'
        console.log(
          `| ${r.label.padEnd(6)} | ${pct(gather).padStart(6)}% | ${pct(fusion).padStart(4)}% | ${pct(yeonhwan).padStart(4)}% | ${total} |`
        )
      }

      // 소형 레시피 성립률 (덱 샘플링)
      console.log('\n[소형 레시피 성립률 — detectRecipe 직접 샘플링 2000회]')
      console.log('| 프리셋 | 레시피 타깃 | 대상 성립률 | 전체 3장 recipe% |')
      console.log('|--------|-----------|----------|----------------|')
      for (let i = 0; i < PRESETS.length; i++) {
        const r = results[i]
        const p = PRESETS[i]
        console.log(
          `| ${r.label.padEnd(6)} | ${p.smallRecipeLabel.padEnd(12)} | ${r.targetRecipeRate.toFixed(2).padStart(10)}% | ${r.recipeRate_3.toFixed(2).padStart(16)}% |`
        )
      }
      const toDanilResult = results.find(r => r.label === '토단일')!
      console.log(`\n[필수 재실측] 소응축(火1+土2) 성립률 (토단일): ${toDanilResult.targetRecipeRate.toFixed(2)}%`)

      // balance-v3 대비 영향표
      console.log('\n[balance-v3 대비 영향표 (v3 A벌 vs recipe B벌 비교 준비)]')
      console.log('v3 클리어율 (A벌):')
      for (const r of results) {
        const base = balanceV3[r.label as keyof typeof balanceV3] ?? 0
        const diff = r.v3Rate - base
        console.log(`  ${r.label}: ${base.toFixed(2)}% -> ${r.v3Rate.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p)`)
      }
      console.log(`격차: 11.67%p -> ${v3Gap.toFixed(2)}%p`)

      // 검증
      for (const r of results) {
        expect(r.v3Rate).toBeGreaterThanOrEqual(15)
        expect(r.v3Rate).toBeLessThanOrEqual(65)
      }
      expect(v3Gap).toBeGreaterThan(0)

      console.log('\n[PASS] v3 기준선 시뮬 완료 (A벌, ebe0106)')
    }
  )
})
