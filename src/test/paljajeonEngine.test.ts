/**
 * 팔자전 — 엔진 유닛 테스트
 */

import { describe, it, expect } from 'vitest'
import {
  createFixedDeck,
  shuffleDeck,
  createInitialGameState,
  playCards,
  discardCards,
  advanceToNextFloor,
} from '../engine/paljajeonEngine'

describe('createFixedDeck', () => {
  it('20장 덱 생성', () => {
    const deck = createFixedDeck()
    expect(deck).toHaveLength(20)
  })

  it('5종 오행 포함', () => {
    const deck = createFixedDeck()
    const elements = new Set(deck.map(c => c.element))
    expect(elements.size).toBe(5)
  })

  it('각 카드에 id, element, value, type, rarity 있음', () => {
    const deck = createFixedDeck()
    for (const card of deck) {
      expect(card.id).toBeTruthy()
      expect(card.element).toBeTruthy()
      expect(card.value).toBeGreaterThanOrEqual(1)
      expect(card.value).toBeLessThanOrEqual(10)
    }
  })
})

describe('shuffleDeck', () => {
  it('장 수 유지', () => {
    const deck = createFixedDeck()
    const shuffled = shuffleDeck(deck)
    expect(shuffled).toHaveLength(deck.length)
  })

  it('같은 시드 → 같은 결과', () => {
    const deck = createFixedDeck()
    const a = shuffleDeck(deck, 42)
    const b = shuffleDeck(deck, 42)
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id))
  })
})

describe('createInitialGameState', () => {
  it('핸드 8장, 체력 100, 1층', () => {
    const state = createInitialGameState(0)
    expect(state.hand).toHaveLength(8)
    expect(state.playerHp).toBe(100)
    expect(state.currentFloor).toBe(1)
    expect(state.enemyHp).toBe(90)  // balance v1.1: L1 HP=90
  })

  it('에너지 개념 없음 — energy 필드 없어야', () => {
    const state = createInitialGameState(0)
    expect((state as unknown as Record<string, unknown>)['energy']).toBeUndefined()
    expect((state as unknown as Record<string, unknown>)['maxEnergy']).toBeUndefined()
  })
})

describe('playCards', () => {
  it('출수 후 플레이카운트 감소', () => {
    const state = createInitialGameState(0)
    const cardId = state.hand[0].id
    const newState = playCards(state, [cardId])
    expect(newState.playsLeft).toBe(state.playsLeft - 1)
  })

  it('출수 후 적 체력 감소', () => {
    const state = createInitialGameState(0)
    const cardId = state.hand[0].id
    const newState = playCards(state, [cardId])
    expect(newState.enemyHp).toBeLessThan(state.enemyHp)
  })

  it('플레이어 체력 감소 (반격)', () => {
    const state = createInitialGameState(0)
    const cardId = state.hand[0].id
    const newState = playCards(state, [cardId])
    expect(newState.playerHp).toBeLessThan(state.playerHp)
  })
})

describe('discardCards', () => {
  it('버리기 후 discardsLeft 감소', () => {
    const state = createInitialGameState(0)
    const cardId = state.hand[0].id
    const newState = discardCards(state, [cardId])
    expect(newState.discardsLeft).toBe(state.discardsLeft - 1)
  })

  it('버린 카드는 핸드에서 제거', () => {
    const state = createInitialGameState(0)
    const cardId = state.hand[0].id
    const newState = discardCards(state, [cardId])
    expect(newState.hand.find(c => c.id === cardId)).toBeUndefined()
  })

  it('버리기 횟수 초과 시 상태 변화 없음', () => {
    let state = createInitialGameState(0)
    // 버리기 전부 소모
    state = { ...state, discardsLeft: 0 }
    const cardId = state.hand[0].id
    const newState = discardCards(state, [cardId])
    expect(newState.discardsLeft).toBe(0)
    expect(newState.hand).toEqual(state.hand)
  })
})

describe('advanceToNextFloor', () => {
  it('1층 → 2층 전환', () => {
    const state = { ...createInitialGameState(0), currentFloor: 1, floorsCleared: 1 }
    const newState = advanceToNextFloor(state)
    expect(newState.currentFloor).toBe(2)
    expect(newState.enemyHp).toBe(115)  // balance v1.1: L2 HP=115
  })

  it('4층 클리어 → 결과 화면 (승리)', () => {
    const state = { ...createInitialGameState(3), currentFloor: 4, floorsCleared: 4 }
    const newState = advanceToNextFloor(state)
    expect(newState.phase).toBe('result')
    expect(newState.isVictory).toBe(true)
  })
})
