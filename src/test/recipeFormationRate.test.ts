/**
 * recipe 성립률 전표 — 10쌍 × 3프리셋
 *
 * 커밋: 70fc9db
 * 목적: 각 recipe의 프리셋별 성립 빈도를 측정하여 배율 차등안의 근거 마련.
 * 성립률이 높은 recipe(예: 금수 fusion_mine)는 배율 하향, 낮은 recipe는 상향.
 *
 * 방법: 1000판 실제 게임에서 봇이 선택한 콤보 중 recipe 해당하는 것의 빈도 측정.
 * COMBO_RULESET_VERSION='recipe'로 mock하여 judgeCombo가 recipe 분기를 실제 사용.
 *
 * detectRecipe 지문 (pokerHandJudge.ts L364):
 *   for (const [recipeId, recipe] of Object.entries(RECIPE_MAP)) { ... }
 *
 * RECIPE_MAP 10쌍:
 *   낳는: forest(수+목), spring(금+수), mine(토+금), kiln(화+토), wildfire(화3/5)
 *   벼리는: keen(금+他), snipe(수+他), harvest(목+他), pierce(금+수), temper(화+금)
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

// COMBO_RULESET_VERSION='recipe' 오버라이드
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { detectRecipe } = await import('../engine/pokerHandJudge')
const { RECIPE_MAP } = await import('../engine/balance')

// ─── 프리셋 ────────────────────────────────────────────────────────────────────
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

// 10쌍 recipe IDs
const RECIPE_IDS = Object.keys(RECIPE_MAP)

describe('recipe 성립률 전표 — 10쌍 × 3프리셋', () => {
  it(
    '1000판 × 3프리셋: recipe별 성립 횟수 + 성립률',
    { timeout: 300000 },
    () => {
      // 결과 저장: preset → recipeId → count
      const formationCounts: Record<string, Record<string, number>> = {}
      const totalGames: Record<string, number> = {}
      const totalRecipeHits: Record<string, number> = {}  // 프리셋당 총 recipe 성립 횟수
      const clearRates: Record<string, number> = {}

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)
        const counts: Record<string, number> = {}
        for (const id of RECIPE_IDS) counts[id] = 0
        let recipeHits = 0
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

          // traitCounts에서 recipe 관련 발동 추적
          // judgeCombo의 recipe 분기에서 type='fusion-birth'/'fusion-hone'이 되고
          // name=recipeId가 됨. fusionCount에는 모든 fusion이 포함됨.
          // 직접적인 recipe별 카운트가 없으므로 traitCounts에서 추출
          if (result.traitCounts) {
            for (const [key, count] of Object.entries(result.traitCounts)) {
              // effect_<traitId>_used 또는 attack_<traitId>_used 형태
              // traitId는 FUSION_TRAIT_MAP[comboResult.name] 기반
              // comboResult.name이 recipeId — 근데 traitCounts는 trait 기준이지 recipe 기준이 아님
              // 별도 추적 필요
            }
          }
        }

        formationCounts[preset.key] = counts
        totalGames[preset.key] = RUNS
        totalRecipeHits[preset.key] = recipeHits
        clearRates[preset.key] = (cleared / RUNS) * 100
      }

      // 위 방식으로는 recipe별 성립을 직접 세기 어려움 — 별도 접근 필요
      // 직접 핸드를 생성하고 detectRecipe를 호출하는 방식으로 전환

      console.log('\n' + '='.repeat(90))
      console.log('recipe 성립률 전표 — 핸드 샘플링 방식')
      console.log('='.repeat(90))

      // 방법 2: 랜덤 핸드에서 3장/5장 콤보를 생성하고 detectRecipe 호출
      // 프리셋별 덱 분포에서 카드를 생성, 핸드 7장 추출, 모든 3장/5장 조합 검사
      function combinations<T>(arr: T[], k: number): T[][] {
        if (k === 0) return [[]]
        if (k > arr.length) return []
        const [first, ...rest] = arr
        const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
        const withoutFirst = combinations(rest, k)
        return [...withFirst, ...withoutFirst]
      }

      const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
      const HAND_SIZE = 7
      const SAMPLE_HANDS = 10000  // 핸드 수

      interface Card { id: string; element: Element; value: number; polarity: 'yang' | 'yin'; type: 'soldier'; rarity: 'common' }

      function generateDeck(dist: Record<Element, number>, seed: number): Card[] {
        const deck: Card[] = []
        let id = 0
        for (const el of ELEMENTS) {
          const count = dist[el] ?? 0
          for (let i = 0; i < count; i++) {
            deck.push({
              id: `${el}-${id++}`,
              element: el,
              value: 3 + (seed + id) % 8,  // 3~10
              polarity: id % 2 === 0 ? 'yang' : 'yin',
              type: 'soldier',
              rarity: 'common',
            })
          }
        }
        return deck
      }

      function lcg(seed: number): () => number {
        let s = seed
        return () => {
          s = (s * 1664525 + 1013904223) & 0xffffffff
          return (s >>> 0) / 0xffffffff
        }
      }

      for (const preset of PRESETS) {
        const recipeCounts: Record<string, { small: number; large: number }> = {}
        for (const id of RECIPE_IDS) recipeCounts[id] = { small: 0, large: 0 }
        let totalSmallCombos = 0
        let totalLargeCombos = 0
        let handsWithAnyRecipe = 0

        for (let h = 0; h < SAMPLE_HANDS; h++) {
          const rng = lcg(h * 54321 + 9999)
          const deck = generateDeck(preset.dist, h)

          // 셔플
          for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1))
            ;[deck[i], deck[j]] = [deck[j], deck[i]]
          }

          const hand = deck.slice(0, Math.min(HAND_SIZE, deck.length))
          let foundAny = false

          // 3장 조합
          const combos3 = combinations(hand, 3)
          for (const combo of combos3) {
            const recipeId = detectRecipe(combo as any)
            if (recipeId) {
              recipeCounts[recipeId].small++
              foundAny = true
            }
            totalSmallCombos++
          }

          // 5장 조합
          if (hand.length >= 5) {
            const combos5 = combinations(hand, 5)
            for (const combo of combos5) {
              const recipeId = detectRecipe(combo as any)
              if (recipeId) {
                recipeCounts[recipeId].large++
                foundAny = true
              }
              totalLargeCombos++
            }
          }

          if (foundAny) handsWithAnyRecipe++
        }

        console.log(`\n─── ${preset.label} (${JSON.stringify(preset.dist)}) ───`)
        console.log(`핸드 수: ${SAMPLE_HANDS} | 총 3장콤보: ${totalSmallCombos} | 총 5장콤보: ${totalLargeCombos}`)
        console.log(`recipe 포함 핸드: ${handsWithAnyRecipe} (${((handsWithAnyRecipe / SAMPLE_HANDS) * 100).toFixed(1)}%)`)
        console.log('')
        console.log('┌────────────────────┬──────────┬──────────┬──────────┬──────────┐')
        console.log('│ Recipe ID          │ 소형(3장) │ 대형(5장) │ 소형성립률│ 대형성립률│')
        console.log('├────────────────────┼──────────┼──────────┼──────────┼──────────┤')

        const recipeRates: Array<{ id: string; smallRate: number; largeRate: number; totalRate: number }> = []

        for (const id of RECIPE_IDS) {
          const { small, large } = recipeCounts[id]
          const smallRate = totalSmallCombos > 0 ? (small / totalSmallCombos) * 100 : 0
          const largeRate = totalLargeCombos > 0 ? (large / totalLargeCombos) * 100 : 0
          const totalRate = smallRate + largeRate
          recipeRates.push({ id, smallRate, largeRate, totalRate })

          const spec = RECIPE_MAP[id]
          const type = spec.small.elem2 === null ? '벼리는' : (spec.small.elem1 === spec.small.elem2 ? '들불' : '낳는')
          console.log(
            `│ ${(id + ' (' + type + ')').padEnd(18)} │ ${String(small).padStart(8)} │ ${String(large).padStart(8)} │ ${smallRate.toFixed(2).padStart(7)}% │ ${largeRate.toFixed(2).padStart(7)}% │`
          )
        }

        console.log('└────────────────────┴──────────┴──────────┴──────────┴──────────┘')

        // 성립률 순위
        const sorted = [...recipeRates].sort((a, b) => b.totalRate - a.totalRate)
        console.log(`\n성립률 순위 (소형+대형 합산):`)
        sorted.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.id}: ${r.totalRate.toFixed(2)}%`)
        })
      }

      // ─── 클리어율도 함께 출력 ─────────────────────────────────────────────
      console.log('\n' + '='.repeat(90))
      console.log('recipe 모드 클리어율 (참고)')
      console.log('='.repeat(90))
      for (const preset of PRESETS) {
        console.log(`  ${preset.label}: ${clearRates[preset.key]?.toFixed(2) ?? 'N/A'}%`)
      }

      // assertions
      for (const id of RECIPE_IDS) {
        expect(id).toBeTruthy()
      }
      expect(RECIPE_IDS.length).toBe(10)
    },
  )
})
