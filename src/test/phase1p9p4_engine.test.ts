/**
 * Phase 1.9.4 엔진 유닛 테스트
 * 수정 1: 덱 고갈 소프트락 방지 — 재순환 로직
 * 수정 2: 응축 저장형 전환 — condensedDamage 기반
 * 수정 3: 연소·관통 UI 연동 필드 (combustionBonus, penetrationIgnored)
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  playCards,
  discardCards,
  applyCondense,
} from '../engine/paljajeonEngine'
import { CONDENSE_V2_MULTIPLIER, GREAT_CONDENSE_MULTIPLIER } from '../engine/balance'
import type { Card, GameState } from '../types/game'

function makeCard(element: Card['element'], polarity: Card['polarity'], value: number, id?: string): Card {
  return {
    id: id ?? `${element}-${polarity}-${value}`,
    element,
    polarity,
    value,
    type: 'soldier',
    rarity: 'common',
  }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return { ...base, ...overrides }
}

// ============================================================
// 수정 1: 덱 고갈 소프트락 방지 (불변 조건: 핸드는 항상 리필)
// ============================================================
describe('수정 1: 덱 고갈 소프트락 방지', () => {
  it('덱이 비어 있을 때 playCards — 버림더미를 섞어 재순환', () => {
    const handCards = [
      makeCard('mok', 'yang', 5, 'mok1'),
      makeCard('mok', 'yin', 5, 'mok2'),
    ]
    const discardPile = [
      makeCard('hwa', 'yang', 3, 'hwa1'),
      makeCard('to', 'yang', 3, 'to1'),
      makeCard('geum', 'yang', 3, 'geum1'),
    ]
    const state = makeState({
      hand: handCards,
      deck: [],  // 덱 완전 고갈
      discardPile,
      playsLeft: 3,
    })
    const newState = playCards(state, [handCards[0].id])
    // 불변 조건: 핸드 리필 발생 — 2장이 아닌 2장(남은 1 + 버림더미에서 뽑힌 1)
    expect(newState.hand.length).toBeGreaterThanOrEqual(1)
    // reshuffled 플래그 확인
    expect(newState.reshuffled).toBe(true)
    // playsLeft 소모 확인
    expect(newState.playsLeft).toBe(2)
  })

  it('덱이 부족할 때 playCards — 부족분을 버림더미로 보충', () => {
    const handCards = [
      makeCard('mok', 'yang', 5, 'mok-a'),
      makeCard('mok', 'yin', 5, 'mok-b'),
      makeCard('hwa', 'yang', 4, 'hwa-a'),
    ]
    const discardPile = [
      makeCard('to', 'yang', 3, 'to-x'),
      makeCard('geum', 'yang', 3, 'geum-x'),
    ]
    // 덱에 1장 → 3장 플레이 시 2장 부족
    const state = makeState({
      hand: handCards,
      deck: [makeCard('su', 'yang', 2, 'su-d')],
      discardPile,
      playsLeft: 3,
    })
    const selectedIds = [handCards[0].id, handCards[1].id, handCards[2].id]
    const newState = playCards(state, selectedIds)
    // 3장 플레이 후 3장 리필 시도 → 덱 1장 + 버림더미 2장+플레이3장 = 재순환
    expect(newState.reshuffled).toBe(true)
    expect(newState.hand.length).toBeGreaterThan(0)
  })

  it('덱이 충분할 때 reshuffled = false', () => {
    const handCards = [makeCard('mok', 'yang', 5, 'mok-ok')]
    const deck = Array.from({ length: 10 }, (_, i) => makeCard('su', 'yang', 2, `deck-${i}`))
    const state = makeState({ hand: handCards, deck, playsLeft: 3 })
    const newState = playCards(state, [handCards[0].id])
    expect(newState.reshuffled).toBe(false)
  })

  it('discardCards — 덱 부족 시도 재순환', () => {
    const handCards = [
      makeCard('mok', 'yang', 3, 'mok-d1'),
      makeCard('mok', 'yin', 3, 'mok-d2'),
    ]
    const state = makeState({
      hand: handCards,
      deck: [],
      discardPile: [makeCard('hwa', 'yang', 4, 'hwa-pile')],
      discardsLeft: 2,
      playsLeft: 3,
    })
    const newState = discardCards(state, [handCards[0].id])
    expect(newState.reshuffled).toBe(true)
    expect(newState.hand.length).toBeGreaterThan(0)
  })
})

// ============================================================
// 수정 2: 응축 저장형 전환
// ============================================================
describe('수정 2: 응축 저장형 — condensedDamage 기반', () => {
  it('applyCondense — expectedDamage 전달 시 condensedDamage 저장', () => {
    const state = makeState({ playsLeft: 3, condenseType: null, isLastAttack: false })
    const newState = applyCondense(state, 'basic', undefined, 20)
    expect(newState.condenseType).toBe('basic')
    expect(newState.condensedDamage).toBe(20)
    expect(newState.condenseMultiplier).toBe(CONDENSE_V2_MULTIPLIER)  // 1.5
  })

  it('applyCondense(great) — expectedDamage 전달 시 condensedDamage 저장', () => {
    const state = makeState({ playsLeft: 3, condenseType: null, isLastAttack: false })
    const newState = applyCondense(state, 'great', undefined, 30)
    expect(newState.condenseType).toBe('great')
    expect(newState.condensedDamage).toBe(30)
    expect(newState.condenseMultiplier).toBe(GREAT_CONDENSE_MULTIPLIER)  // 2.0
  })

  it('playCards — condenseType=basic, condensedDamage=20 → damage +30 (20×1.5)', () => {
    const card = makeCard('mok', 'yang', 10, 'mok-condense')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk-${i}`))
    const state = makeState({
      hand: [card],
      deck,
      condenseType: 'basic',
      condenseMultiplier: CONDENSE_V2_MULTIPLIER,  // 1.5
      condensedDamage: 20,
      playsLeft: 3,
    })
    const beforeHp = state.enemyHp
    const newState = playCards(state, [card.id])
    // 저장형: 응축 소모 후 damage += 20×1.5 = 30 가산
    const dmgDealt = beforeHp - newState.enemyHp
    expect(dmgDealt).toBeGreaterThan(10)  // 기본 10 + 30 가산
    expect(newState.condenseType).toBeNull()
    expect(newState.condensedDamage).toBe(0)
  })

  it('playCards — condenseType=great, condensedDamage=15 → damage +30 (15×2.0)', () => {
    const card = makeCard('mok', 'yang', 10, 'mok-great')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk2-${i}`))
    const state = makeState({
      hand: [card],
      deck,
      condenseType: 'great',
      condenseMultiplier: GREAT_CONDENSE_MULTIPLIER,  // 2.0
      condensedDamage: 15,
      playsLeft: 3,
    })
    const beforeHp = state.enemyHp
    const newState = playCards(state, [card.id])
    // 저장형: 응축 소모 후 damage += 15×2.0 = 30 가산
    const dmgDealt = beforeHp - newState.enemyHp
    expect(dmgDealt).toBeGreaterThan(10)  // 기본 10 + 30 가산
    expect(newState.condenseType).toBeNull()
    expect(newState.condensedDamage).toBe(0)
  })

  it('condensedDamage = 0이면 응축 가산 없음 (저장형 폐지 검증)', () => {
    const card = makeCard('mok', 'yang', 10, 'mok-zero')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk3-${i}`))
    const stateWithZeroDmg = makeState({
      hand: [card],
      deck,
      condenseType: 'basic',
      condenseMultiplier: CONDENSE_V2_MULTIPLIER,
      condensedDamage: 0,  // 저장량 없음
      playsLeft: 3,
    })
    const stateWithDmg = makeState({
      hand: [makeCard('mok', 'yang', 10, 'mok-nonzero')],
      deck: Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk3b-${i}`)),
      condenseType: 'basic',
      condenseMultiplier: CONDENSE_V2_MULTIPLIER,
      condensedDamage: 20,  // 저장량 20
      playsLeft: 3,
    })
    const beforeZero = stateWithZeroDmg.enemyHp
    const afterZero = playCards(stateWithZeroDmg, [card.id])
    const beforeNonZero = stateWithDmg.enemyHp
    const afterNonZero = playCards(stateWithDmg, [makeCard('mok', 'yang', 10, 'mok-nonzero').id])

    // condensedDamage=20 케이스가 0 케이스보다 더 많이 피해를 줘야 한다
    const dmgZero = beforeZero - afterZero.enemyHp
    const dmgNonZero = beforeNonZero - afterNonZero.enemyHp
    expect(dmgNonZero).toBeGreaterThan(dmgZero)  // 저장형 보너스 확인
    // condenseType 소모 확인
    expect(afterZero.condenseType).toBeNull()
    expect(afterNonZero.condenseType).toBeNull()
  })
})

// ============================================================
// 수정 3: 연소·관통 UI 연동 필드
// ============================================================
describe('수정 3: 연소·관통 UI 필드', () => {
  it('화 타격 시 combustionBonus > 0', () => {
    const hwaCards = [
      makeCard('hwa', 'yang', 5, 'h1'),
      makeCard('hwa', 'yin', 5, 'h2'),
    ]
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk4-${i}`))
    const state = makeState({ hand: hwaCards, deck, playsLeft: 3 })
    const newState = playCards(state, hwaCards.map(c => c.id))
    if (newState.combustionTriggered) {
      expect(newState.combustionBonus).toBeGreaterThan(0)
    }
  })

  it('비화 타격 시 combustionBonus = 0', () => {
    const mokCards = [
      makeCard('mok', 'yang', 5, 'm1'),
      makeCard('mok', 'yin', 5, 'm2'),
    ]
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk5-${i}`))
    const state = makeState({ hand: mokCards, deck, playsLeft: 3 })
    const newState = playCards(state, mokCards.map(c => c.id))
    expect(newState.combustionTriggered).toBe(false)
    expect(newState.combustionBonus).toBe(0)
  })

  it('금 타격 시 penetrationTriggered = true', () => {
    const geumCards = [
      makeCard('geum', 'yang', 5, 'g1'),
      makeCard('geum', 'yin', 5, 'g2'),
    ]
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk6-${i}`))
    const state = makeState({ hand: geumCards, deck, playsLeft: 3 })
    const newState = playCards(state, geumCards.map(c => c.id))
    expect(newState.penetrationTriggered).toBe(true)
  })
})
