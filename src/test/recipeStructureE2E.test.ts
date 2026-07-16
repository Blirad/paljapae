/**
 * E2E 지문 — 레시피 구조 정본화 검증 (2026-07-16)
 *
 * 작업 2 요건:
 *  E2E-1: elem2 고정 판정 코드 인용 + assert
 *    - fusion_keen: 금+목만 성립, 금+수는 불성립 (담금질/샘 후보)
 *  E2E-2: 들불 목+화 단위 테스트
 *    - fusion_wildfire: 목+화 성립, 화+화 불성립
 *
 * detectRecipe() 판정 로직 인용 (pokerHandJudge.ts):
 *   elementCounts[elem1] >= 1 && elementCounts[elem2] >= minCount → recipeId 반환
 *   elem2가 null에서 특정 원소로 고정됨 → 지정 쌍만 성립, 타원소는 불성립
 */

import { describe, it, expect, vi } from 'vitest'
import type { Card } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' as const }
})

const { detectRecipe } = await import('../engine/pokerHandJudge')

function card(id: string, element: Card['element']): Card {
  return { id, element, polarity: 'yang', value: 5, type: 'soldier', rarity: 'common' }
}

// ─── E2E-1: elem2 고정 판정 코드 인용 ────────────────────────────────────────
// detectRecipe() 핵심 판정 로직 (pokerHandJudge.ts):
//   elementCounts[elem1] >= 1 && elementCounts[elem2] >= minCount → recipeId 반환
// fusion_keen: elem1='geum', elem2='mok', minCount=2 (3장 소형)
// → 금1+목2: geum>=1 && mok>=2 → fusion_keen 성립
// → 금3+수2: geum>=1 && su>=2 이지만 fusion_keen은 elem2='mok' → 불성립

describe('E2E-1: elem2 고정 판정 코드 인용 (fusion_keen 금극목)', () => {
  it('벼림(fusion_keen): 금+목 3장 성립 — geum1+mok2', () => {
    // 판정 코드: elementCounts['geum'] >= 1 && elementCounts['mok'] >= 2 → fusion_keen
    const cards = [card('1', 'geum'), card('2', 'mok'), card('3', 'mok')]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_keen')
  })

  it('벼림(fusion_keen): 금+목 3장 성립 — geum2+mok1 (역방향)', () => {
    // 판정 코드: elementCounts['mok'] >= 1 && elementCounts['geum'] >= 2 → fusion_keen
    const cards = [card('1', 'geum'), card('2', 'geum'), card('3', 'mok')]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_keen')
  })

  it('벼림(fusion_keen): 금+목 5장 대형 성립', () => {
    const cards = [
      card('1', 'geum'), card('2', 'geum'),
      card('3', 'mok'), card('4', 'mok'), card('5', 'mok'),
    ]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_keen')
  })

  it('벼림(fusion_keen) 불성립: 금+수 3장 (샘 후보) — elem2=mok 고정으로 차단', () => {
    // 구버전(elem2=null): 금3+수2 → fusion_keen 성립 (타원소 허용)
    // 정본화 후: elem2='mok' 고정 → 금+수는 fusion_spring으로만 성립
    const cards = [card('1', 'geum'), card('2', 'su'), card('3', 'su')]
    const result = detectRecipe(cards)
    expect(result).not.toBe('fusion_keen')
    // 금+수는 fusion_spring(샘)이어야 함
    expect(result).toBe('fusion_spring')
  })

  it('벼림(fusion_keen) 불성립: 금+화 3장 — elem2=mok 고정으로 차단', () => {
    const cards = [card('1', 'geum'), card('2', 'hwa'), card('3', 'hwa')]
    const result = detectRecipe(cards)
    expect(result).not.toBe('fusion_keen')
    // 금+화는 fusion_temper(주물)
    expect(result).toBe('fusion_temper')
  })

  it('개간(fusion_harvest): 목+토 3장 성립 (목극토 정본)', () => {
    const cards = [card('1', 'mok'), card('2', 'to'), card('3', 'to')]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_harvest')
  })

  it('개간(fusion_harvest) 불성립: 목+화 3장 — 들불(fusion_wildfire)로 판별', () => {
    // 구버전(elem2=null): 목1+화2 → fusion_harvest 성립 (타원소 허용)
    // 정본화 후: elem2='to' 고정 → 목+화는 fusion_wildfire로 이동
    const cards = [card('1', 'mok'), card('2', 'hwa'), card('3', 'hwa')]
    const result = detectRecipe(cards)
    expect(result).not.toBe('fusion_harvest')
    expect(result).toBe('fusion_wildfire')
  })

  it('담금질(fusion_snipe): 수+화 3장 성립 (수극화 정본)', () => {
    const cards = [card('1', 'su'), card('2', 'hwa'), card('3', 'hwa')]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_snipe')
  })

  it('담금질(fusion_snipe) 불성립: 수+목 3장 — 숲(fusion_forest)으로 판별', () => {
    // 구버전(elem2=null): 수1+목2 → fusion_snipe 성립 (타원소 허용)
    // 정본화 후: elem2='hwa' 고정 → 수+목은 fusion_forest
    const cards = [card('1', 'su'), card('2', 'mok'), card('3', 'mok')]
    const result = detectRecipe(cards)
    expect(result).not.toBe('fusion_snipe')
    expect(result).toBe('fusion_forest')
  })

  it('제방(fusion_pierce): 토+수 3장 성립 (토극수 정본, 구 금+수에서 변경)', () => {
    const cards = [card('1', 'to'), card('2', 'su'), card('3', 'su')]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_pierce')
  })

  it('제방(fusion_pierce) 불성립: 금+수 3장 — 샘(fusion_spring)으로 판별 (충돌 해소)', () => {
    // 구버전: fusion_pierce elem1='geum' → 금+수가 spring과 pierce 두 곳에서 충돌
    // 정본화 후: fusion_pierce elem1='to' → 금+수는 fusion_spring만 성립
    const cards = [card('1', 'geum'), card('2', 'su'), card('3', 'su')]
    const result = detectRecipe(cards)
    expect(result).not.toBe('fusion_pierce')
    expect(result).toBe('fusion_spring')
  })
})

// ─── E2E-2: 들불 목+화 단위 테스트 ──────────────────────────────────────────
describe('E2E-2: 들불(fusion_wildfire) 목+화 단위 테스트', () => {
  it('들불(fusion_wildfire): 목+화 3장 성립 — mok1+hwa2', () => {
    const cards = [card('1', 'mok'), card('2', 'hwa'), card('3', 'hwa')]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_wildfire')
  })

  it('들불(fusion_wildfire): 목+화 3장 성립 — mok2+hwa1 (역방향)', () => {
    const cards = [card('1', 'mok'), card('2', 'mok'), card('3', 'hwa')]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_wildfire')
  })

  it('들불(fusion_wildfire): 목+화 5장 대형 성립', () => {
    const cards = [
      card('1', 'mok'), card('2', 'mok'),
      card('3', 'hwa'), card('4', 'hwa'), card('5', 'hwa'),
    ]
    const result = detectRecipe(cards)
    expect(result).toBe('fusion_wildfire')
  })

  it('들불(fusion_wildfire) 불성립: 화+화+화 3장 (구 설계 화+화) — 레시피 없음', () => {
    // 구버전: fusion_wildfire elem1='hwa', elem2='hwa' → 화3장 성립
    // 정본화 후: elem1='mok', elem2='hwa' → 화만 3장은 어떤 레시피도 불성립
    const cards = [card('1', 'hwa'), card('2', 'hwa'), card('3', 'hwa')]
    const result = detectRecipe(cards)
    expect(result).not.toBe('fusion_wildfire')
    // 화3장은 단순 모으기(gather)로 처리됨 (레시피 불성립)
    expect(result).toBeNull()
  })

  it('들불(fusion_wildfire) 불성립: 화5장 — gather5로 처리됨', () => {
    const cards = [
      card('1', 'hwa'), card('2', 'hwa'), card('3', 'hwa'),
      card('4', 'hwa'), card('5', 'hwa'),
    ]
    const result = detectRecipe(cards)
    expect(result).not.toBe('fusion_wildfire')
    expect(result).toBeNull()
  })
})
