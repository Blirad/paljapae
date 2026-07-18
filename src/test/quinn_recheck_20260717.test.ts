/**
 * Quinn 재검증 — 룰셋 배지 2c·부정3종 (2026-07-17)
 * 방법 B: 단위 테스트 코드 경로 직접 검증
 *
 * 검증 항목:
 *   2c  — 화1+토2 (소응축 옹기가마) 성립
 *   부정1 — 목1+금1 2장 촉매 불충분 → 미성립
 *   부정2 — 목1+금1+수1 잡탕 3장 → 레시피 불성립 → none
 *   부정3 — 화2+토1 3장 (역방향) → 소형 불성립 → none
 */

import { describe, it, expect, vi } from 'vitest'
import type { Card } from '../types/game'

// COMBO_RULESET_VERSION을 'recipe'로 강제 설정 (브라우저 환경 없음 대응)
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' as const }
})

const { detectRecipe, judgeCombo } = await import('../engine/pokerHandJudge')

function makeCard(id: string, element: Card['element'], value = 5): Card {
  return { id, element, value, polarity: 'yang' as const, type: 'soldier' as any, rarity: 'common' as any }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2c: 화1+토2 → 소응축(옹기가마) fusion_kiln 성립
// ─────────────────────────────────────────────────────────────────────────────
describe('Quinn 재검증: 2c — 화1+토2 소응축 성립', () => {
  it('detectRecipe: 화1+토2 3장 → fusion_kiln 반환', () => {
    const hand: Card[] = [
      makeCard('c1', 'hwa', 5),
      makeCard('c2', 'to', 4),
      makeCard('c3', 'to', 3),
    ]
    const result = detectRecipe(hand)
    expect(result).toBe('fusion_kiln')
  })

  it('judgeCombo: 화1+토2 3장 → fusion-birth 타입, name=fusion_kiln, none 아님', () => {
    const hand: Card[] = [
      makeCard('c1', 'hwa', 5),
      makeCard('c2', 'to', 4),
      makeCard('c3', 'to', 3),
    ]
    const result = judgeCombo(hand)
    expect(result.type).toBe('fusion-birth')
    expect(result.name).toBe('fusion_kiln')
    expect(result.type).not.toBe('none')
  })

  it('judgeCombo: 화1+토2 → 소형(isSmall) 경로 — description에 "소형" 포함', () => {
    const hand: Card[] = [
      makeCard('c1', 'hwa', 6),
      makeCard('c2', 'to', 5),
      makeCard('c3', 'to', 4),
    ]
    const result = judgeCombo(hand)
    expect(result.description).toMatch(/소형/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 부정1: 촉매 불충분 2장 (목+금) → 레시피 미성립 → none
// recipe 모드에서 2장은 detectRecipe → null, isFusionCombo 분기 차단 → none
// ─────────────────────────────────────────────────────────────────────────────
describe('Quinn 재검증: 부정1 — 목+금 2장 촉매 불충분', () => {
  it('detectRecipe: 2장은 length 조건(3 or 5) 미충족 → null 반환', () => {
    const hand: Card[] = [
      makeCard('c1', 'mok', 5),
      makeCard('c2', 'geum', 5),
    ]
    const result = detectRecipe(hand)
    expect(result).toBeNull()
  })

  it('judgeCombo: recipe 모드에서 2장 (목+금) → none 타입 (isFusionCombo 차단됨)', () => {
    const hand: Card[] = [
      makeCard('c1', 'mok', 5),
      makeCard('c2', 'geum', 5),
    ]
    const result = judgeCombo(hand)
    // recipe 모드: isFusionCombo 분기는 COMBO_RULESET_VERSION !== 'recipe' 조건으로 실행 안 됨
    // 2장은 isGatherCombo도 미성립(2종 원소) → none
    expect(result.type).toBe('none')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 부정2: 잡탕 3장 (목+금+수) → 레시피 불성립 → none
// 3원소 혼합 → RECIPE_MAP 내 어떤 레시피도 elem1×1+elem2×2 미충족
// ─────────────────────────────────────────────────────────────────────────────
describe('Quinn 재검증: 부정2 — 목+금+수 잡탕 3장 레시피 불성립', () => {
  it('detectRecipe: 목1+금1+수1 3장 잡탕 → null 반환', () => {
    const hand: Card[] = [
      makeCard('c1', 'mok', 5),
      makeCard('c2', 'geum', 5),
      makeCard('c3', 'su', 5),
    ]
    const result = detectRecipe(hand)
    expect(result).toBeNull()
  })

  it('judgeCombo: 목1+금1+수1 3장 → none 타입 (레시피/모으기/융합 모두 불성립)', () => {
    const hand: Card[] = [
      makeCard('c1', 'mok', 5),
      makeCard('c2', 'geum', 5),
      makeCard('c3', 'su', 5),
    ]
    const result = judgeCombo(hand)
    // 3원소 혼합 → detectRecipe null, isGatherCombo false, isFusionCombo recipe 모드 차단 → none
    expect(result.type).toBe('none')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 부정3: 화2+토1 (역방향) 3장 → 소형 불성립 → none
// fusion_kiln: elem1=hwa(촉매), elem2=to(연료). minCount=2
// 화2+토1 → to(elem2) count=1 < minCount=2 → detectRecipe null
// judgeCombo: isSmall(catalystCount=1, fuelCount>=2) 불충족 → none
// ─────────────────────────────────────────────────────────────────────────────
describe('Quinn 재검증: 부정3 — 화2+토1 역방향 소형 불성립', () => {
  it('detectRecipe: 화2+토1 3장 → fusion_kiln 불성립 → null 반환', () => {
    const hand: Card[] = [
      makeCard('c1', 'hwa', 5),
      makeCard('c2', 'hwa', 5),
      makeCard('c3', 'to', 5),
    ]
    const result = detectRecipe(hand)
    // fusion_kiln: elementCounts[hwa]>=1(true) AND elementCounts[to]>=2(false: 1<2) → 불성립
    // 다른 레시피(fusion_wildfire: mok1+hwa2 → mok=0 불성립)도 불성립
    expect(result).toBeNull()
  })

  it('judgeCombo: 화2+토1 3장 → none 타입 (역방향 소형 불성립)', () => {
    const hand: Card[] = [
      makeCard('c1', 'hwa', 5),
      makeCard('c2', 'hwa', 5),
      makeCard('c3', 'to', 5),
    ]
    const result = judgeCombo(hand)
    // detectRecipe null → recipe 분기 미진입
    // isFusionCombo: recipe 모드에서 차단
    // isGatherCombo: 2종 원소 → false
    // → none
    expect(result.type).toBe('none')
  })

  it('대조군 확인: 화1+토2 (정방향) → fusion_kiln 성립 (역방향 부정3와 대비)', () => {
    const handPositive: Card[] = [
      makeCard('p1', 'hwa', 5),
      makeCard('p2', 'to', 5),
      makeCard('p3', 'to', 5),
    ]
    const handNegative: Card[] = [
      makeCard('n1', 'hwa', 5),
      makeCard('n2', 'hwa', 5),
      makeCard('n3', 'to', 5),
    ]
    expect(detectRecipe(handPositive)).toBe('fusion_kiln')
    expect(detectRecipe(handNegative)).toBeNull()
  })
})
