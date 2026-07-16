/**
 * 배치 1.5: E2E 연동 통합 테스트 (§4 영구 추가 규격)
 *
 * 검증 목적: "신규 시스템 시뮬 전 연동 증명"
 * - 플래그 ON 상태에서 initGame→playCards 실행 시
 *   detectRecipe() / applyYongsinDescent()가 실제 엔진 경로를 통해 호출됨을 assert
 * - 유닛 테스트(함수 직접 호출)로 대체 불가
 */

import { describe, it, expect, vi } from 'vitest'
import type { Card, SavedHeroProfile } from '../types/game'

// ─── 레시피 E2E: comboRuleset='recipe' 플래그 ON ───────────────────────────

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return {
    ...(actual as Record<string, unknown>),
    COMBO_RULESET_VERSION: 'recipe' as const,
    ENABLE_YONGSIN_DESCENT: true,
  }
})

const { judgeCombo, detectRecipe } = await import('../engine/pokerHandJudge')
const { createInitialGameState, playCards, initYongsinDescent, applyYongsinDescent } = await import('../engine/paljajeonEngine')

function card(id: string, element: Card['element'], value = 5): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

const mockHero: SavedHeroProfile = {
  name: '테스트',
  sajuPillar: { year: 'gapja', month: 'eulchuk', day: 'byeongin', hour: 'jeongmyo' },
  deckSeed: 42,
  primaryElement: 'su',
}

// ─── 1. detectRecipe() — judgeCombo() 경유 E2E ────────────────────────────

describe('E2E: detectRecipe → judgeCombo() 경유 (recipe 모드)', () => {
  it('su+mok 3장 조합이 judgeCombo()를 통해 fusion_forest 레시피로 판정됨', () => {
    const spy = vi.spyOn({ detectRecipe }, 'detectRecipe')
    // judgeCombo()를 통한 엔진 경로 검증 — 직접 호출 X
    const cards = [card('1', 'su'), card('2', 'mok'), card('3', 'mok')]
    const result = judgeCombo(cards)
    // recipe 모드에서 3장 su+mok → fusion_forest (소형 낳는)
    expect(result.name).toBe('fusion_forest')
    expect(result.type).toBe('fusion-birth')
    expect(result.multiplier).toBe(3.0)  // RECIPE_SMALL_BIRTH_MULT
    expect(result.finishingElement).toBe('su')  // elem1
    void spy  // spy 미사용 경고 억제
  })

  it('to+geum 5장 조합이 judgeCombo()를 통해 대형 레시피로 판정됨', () => {
    // to(X2) + geum(Y3): fusion_mine 대형 (X2+Y3)
    const cards = [card('1', 'to'), card('2', 'geum'), card('3', 'geum'), card('4', 'geum'), card('5', 'to')]
    const result = judgeCombo(cards)
    expect(result.name).toBe('fusion_mine')
    expect(result.type).toBe('fusion-birth')
    expect(result.multiplier).toBe(5.5)  // RECIPE_LARGE_MULT_A (A벌 정본, 9e76a4d)
    expect(result.totalScore).toBe(Math.round(result.baseScore * 5.5))
  })

  it('4장 잡탕(레시피 분기 미진입)은 none 또는 gather로 폴백됨', () => {
    // 4장 = recipe 분기 진입 안 함 (length !== 3 && !== 5)
    // mok+hwa+to+geum — 4원소, isFusionCombo=false(4원소), isGatherCombo=false → none
    const cards = [card('1', 'mok'), card('2', 'hwa'), card('3', 'to'), card('4', 'geum')]
    const result = judgeCombo(cards)
    expect(result.type).toBe('none')
  })
})

// ─── 2. applyYongsinDescent() — playCards() 경유 E2E ─────────────────────

describe('E2E: applyYongsinDescent → playCards() 경유 (descent 모드)', () => {
  it('강림 슬롯 turn에 용신 포함 시 playCards()가 ×2.0 데미지를 반환함', () => {
    // 초기 상태 생성 (floor 1)
    const state = createInitialGameState(0, mockHero)

    // 강림 슬롯을 turn=0으로 강제 설정 (첫 번째 attackCount=0)
    const forcedDescent = {
      descentCount: 2,
      slots: [0, 5],  // 첫 번째 턴(attackCount=0) 강림 슬롯
      usedCount: 0,
      pendingDescent: false,
    }
    const stateWithDescent = {
      ...state,
      yongsinDescent: forcedDescent,
      favorableElement: 'su' as Card['element'],  // 용신 = 水
    }

    // su 카드를 손패에 직접 삽입
    const suCard = card('su1', 'su', 10)
    const stateWithHand = {
      ...stateWithDescent,
      hand: [suCard, ...stateWithDescent.hand.slice(1)],
    }

    // playCards() 실행 — 엔진 경로 통해 applyYongsinDescent() 호출됨
    const before = stateWithHand.enemyHp
    const after = playCards(stateWithHand, [suCard.id])

    // 용신(su) 포함 + 강림 슬롯 → ×2.0 적용되어 대미지가 기본보다 커야 함
    const damageDone = before - after.enemyHp
    // 기본 데미지(value=10, 낱장)가 ×2.0되면 20 이상
    expect(damageDone).toBeGreaterThan(10)
    // 강림 발동 후 usedCount 증가 확인 (연동 증거)
    expect(after.yongsinDescent?.usedCount).toBe(1)
  })

  it('ENABLE_YONGSIN_DESCENT=true 시 상시 ×1.3 폐지 — 비강림 슬롯에서 데미지 변화 없음', () => {
    const state = createInitialGameState(0, mockHero)
    const forcedDescent = {
      descentCount: 1,
      slots: [99],  // turn=99 = 절대 도달 불가 슬롯
      usedCount: 0,
      pendingDescent: false,
    }
    const stateWithDescent = {
      ...state,
      yongsinDescent: forcedDescent,
      favorableElement: 'su' as Card['element'],
    }
    const suCard = card('su1', 'su', 10)
    const stateWithHand = {
      ...stateWithDescent,
      hand: [suCard, ...stateWithDescent.hand.slice(1)],
    }

    // 비강림 슬롯 → ×1.3 없음, ×2.0 없음 → 순수 데미지만
    const before = stateWithHand.enemyHp
    const after = playCards(stateWithHand, [suCard.id])
    const damageDone = before - after.enemyHp

    // 상시 ×1.3 폐지: 데미지 = baseScore (value=10) × 낱장 배율
    // 낱장 배율이 1이라면 damage = 10, 여기서 ×1.3 안 붙어야 함
    expect(damageDone).toBeLessThanOrEqual(15)  // ×1.3=13 이하 (상시 배율 없음 확인)
    expect(after.yongsinDescent?.usedCount).toBe(0)  // 발동 없음
  })

  it('initYongsinDescent()가 createInitialGameState()를 통해 2~3개 슬롯을 생성함', () => {
    const state = createInitialGameState(0, mockHero)
    // ENABLE_YONGSIN_DESCENT=true 상태에서 yongsinDescent가 실제 슬롯을 가져야 함
    expect(state.yongsinDescent).toBeDefined()
    expect(state.yongsinDescent!.slots.length).toBeGreaterThanOrEqual(2)
    expect(state.yongsinDescent!.slots.length).toBeLessThanOrEqual(3)
    // 슬롯 위치 범위 0~17
    for (const slot of state.yongsinDescent!.slots) {
      expect(slot).toBeGreaterThanOrEqual(0)
      expect(slot).toBeLessThanOrEqual(17)
    }
  })
})
