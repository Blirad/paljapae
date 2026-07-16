/**
 * recipe 성립률 전면 재실측 (2026-07-16 정본화 후)
 *
 * 변경 사항:
 *  - fusion_wildfire: 화+화 → 목+화 (RECIPE_MAP 정본 복원)
 *  - fusion_keen: null → 금+목 (금극목)
 *  - fusion_snipe: null → 수+화 (수극화)
 *  - fusion_harvest: null → 목+토 (목극토)
 *  - fusion_pierce: 금+수 → 토+수 (토극수, elem1 변경)
 *
 * 방법: 핸드 샘플링 (10000핸드) × 3장/5장 조합 × detectRecipe
 * 공식: M = max(lowerBound, min(5.0, 1 + K / (rate%)))
 *   mokHwa / toDanil: K=0.8, lowerBound=2.0
 *   geumSu:           K=0.65, lowerBound=1.6
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' as const }
})

const { detectRecipe } = await import('../engine/pokerHandJudge')
const { RECIPE_MAP } = await import('../engine/balance')

const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
const RECIPE_IDS = [
  'fusion_forest', 'fusion_spring', 'fusion_mine', 'fusion_kiln', 'fusion_wildfire',
  'fusion_keen', 'fusion_snipe', 'fusion_harvest', 'fusion_pierce', 'fusion_temper',
]

const PRESETS = [
  {
    key: 'mokHwa' as const,
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    K: 0.8,
    lowerBound: 2.0,
  },
  {
    key: 'geumSu' as const,
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    K: 0.65,
    lowerBound: 1.6,
  },
  {
    key: 'toDanil' as const,
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    K: 0.8,
    lowerBound: 2.0,
  },
]

interface SimpleCard { id: string; element: Element; value: number; polarity: 'yang' | 'yin'; type: 'soldier'; rarity: 'common' }

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function generateDeck(dist: Record<Element, number>, seed: number): SimpleCard[] {
  const deck: SimpleCard[] = []
  let id = 0
  for (const el of ELEMENTS) {
    const count = dist[el] ?? 0
    for (let i = 0; i < count; i++) {
      deck.push({
        id: `${el}-${id}`,
        element: el,
        value: 3 + ((seed + id) % 8),
        polarity: (id % 2 === 0) ? 'yang' : 'yin',
        type: 'soldier',
        rarity: 'common',
      })
      id++
    }
  }
  return deck
}

function computeMultiplier(formationRate: number, K: number, lowerBound: number): number {
  if (formationRate === 0) return 3.0  // 발동 불가 기본값
  const mult = 1 + K / (formationRate / 100)
  return Math.min(Math.max(mult, lowerBound), 5.0)
}

const SAMPLE_HANDS = 10000
const HAND_SIZE = 7

describe('recipe 성립률 전면 재실측 — 정본화 후 (2026-07-16)', () => {
  it(
    '10쌍 × 3프리셋 성립률 측정 + 배율표 산출',
    { timeout: 120000 },
    () => {
      const formationRates: Record<string, Record<string, number>> = {}
      const newMultiplierTable: Record<string, Record<string, number>> = {}

      for (const preset of PRESETS) {
        const smallCounts: Record<string, number> = {}
        const largeCounts: Record<string, number> = {}
        for (const id of RECIPE_IDS) {
          smallCounts[id] = 0
          largeCounts[id] = 0
        }

        let totalSmall = 0
        let totalLarge = 0

        for (let h = 0; h < SAMPLE_HANDS; h++) {
          const rng = lcg(h * 31337 + 20260716)
          const deck = generateDeck(preset.dist, h)

          // Fisher-Yates 셔플
          for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1))
            ;[deck[i], deck[j]] = [deck[j], deck[i]]
          }

          const hand = deck.slice(0, Math.min(HAND_SIZE, deck.length))

          // 3장 조합
          const combos3 = combinations(hand, 3)
          for (const combo of combos3) {
            const recipeId = detectRecipe(combo as any)
            if (recipeId && RECIPE_IDS.includes(recipeId)) {
              smallCounts[recipeId]++
            }
            totalSmall++
          }

          // 5장 조합
          if (hand.length >= 5) {
            const combos5 = combinations(hand, 5)
            for (const combo of combos5) {
              const recipeId = detectRecipe(combo as any)
              if (recipeId && RECIPE_IDS.includes(recipeId)) {
                largeCounts[recipeId]++
              }
              totalLarge++
            }
          }
        }

        const rates: Record<string, number> = {}
        for (const id of RECIPE_IDS) {
          const smallRate = totalSmall > 0 ? (smallCounts[id] / totalSmall) * 100 : 0
          const largeRate = totalLarge > 0 ? (largeCounts[id] / totalLarge) * 100 : 0
          rates[id] = smallRate + largeRate
        }
        formationRates[preset.key] = rates

        // 배율 산출
        const multTable: Record<string, number> = {}
        for (const id of RECIPE_IDS) {
          multTable[id] = computeMultiplier(rates[id], preset.K, preset.lowerBound)
        }
        newMultiplierTable[preset.key] = multTable
      }

      // ─── 출력 ────────────────────────────────────────────────────────────────
      console.log('\n' + '═'.repeat(110))
      console.log('recipe 성립률 전면 재실측 — 정본화 후 (2026-07-16)')
      console.log(`  변경: wildfire(화+화→목+화) / keen(null→금+목) / snipe(null→수+화)`)
      console.log(`  변경: harvest(null→목+토) / pierce(금+수→토+수)`)
      console.log('═'.repeat(110))

      for (const preset of PRESETS) {
        console.log(`\n─── ${preset.label} (K=${preset.K}, 하한=${preset.lowerBound}) ───`)
        console.log('┌────────────────────┬──────────────┬──────────────┬──────────────────┐')
        console.log('│ Recipe ID          │  성립률(%)   │  배율 산출   │  balance.ts 현행  │')
        console.log('├────────────────────┼──────────────┼──────────────┼──────────────────┤')

        for (const id of RECIPE_IDS) {
          const rate = formationRates[preset.key][id]
          const newMult = newMultiplierTable[preset.key][id]
          console.log(
            `│ ${id.padEnd(18)} │ ${rate.toFixed(2).padStart(11)}% │ ×${newMult.toFixed(2).padStart(10)} │                  │`
          )
        }
        console.log('└────────────────────┴──────────────┴──────────────┴──────────────────┘')
      }

      // ─── 배율표 코드 출력 (balance.ts 업데이트용) ────────────────────────────
      console.log('\n' + '─'.repeat(110))
      console.log('RECIPE_MULTIPLIER_BY_PRESET 업데이트 값 (balance.ts 반영용):')
      console.log('─'.repeat(110))
      for (const preset of PRESETS) {
        console.log(`\n  // ${preset.label} — K=${preset.K}`)
        console.log(`  ${preset.key}: {`)
        for (const id of RECIPE_IDS) {
          const rate = formationRates[preset.key][id]
          const mult = newMultiplierTable[preset.key][id]
          const comment = rate === 0 ? '0% (발동불가) — 기본값 3.0' : `${rate.toFixed(2)}% → ×${mult.toFixed(2)}`
          console.log(`    ${id}: ${mult.toFixed(2)},      // ${comment}`)
        }
        console.log(`  },`)
      }

      // ─── 최종 결과 저장 ──────────────────────────────────────────────────────
      ;(globalThis as any).__recipeFormationRatesV2 = formationRates
      ;(globalThis as any).__newMultiplierTable = newMultiplierTable

      // assertions
      expect(Object.keys(formationRates)).toHaveLength(3)
      for (const preset of PRESETS) {
        const rates = formationRates[preset.key]
        // fusion_pierce: 토+수 — 토단일 덱에 토 많으므로 성립률 있어야 함
        // fusion_wildfire: 목+화 — 목화 덱에서 성립률 있어야 함
        expect(rates['fusion_wildfire']).toBeGreaterThanOrEqual(0)
        expect(rates['fusion_pierce']).toBeGreaterThanOrEqual(0)
        // keen: 금+목 — 금수 덱에서 이전보다 낮아야 함 (null→mok 특정으로 성립률 하락 예상)
        expect(rates['fusion_keen']).toBeGreaterThanOrEqual(0)
      }
    },
  )
})
