/**
 * throwOnReject.test.ts
 * discard-throw 정식 이관 — 4장 throw + discardsLeft 불변 검증
 *
 * 검증 항목:
 *   1. 4장 throw 조건: discard 시도 시 현 핸드 사이즈 > 3 → throw 발생
 *   2. discardsLeft 불변: throw 발생해도 discardsLeft 값 변경 안 함 (보존)
 *   3. 정상 discard (3장 이하): 정상 작동 + discardsLeft 1 감소
 *   4. discardsLeft 재부팅 로직: 층 전환(advanceToNextFloor) 시 BASE_DISCARDS로 복구
 *   5. MAX_DISCARD_PER_USE 상수 보호 (값 3 고정)
 */

import { describe, it, expect } from 'vitest'
import {
  discardCards,
  createInitialGameState,
  advanceToNextFloor,
} from '../engine/paljajeonEngine'
import { MAX_DISCARD_PER_USE, BASE_DISCARDS } from '../engine/balance'
import type { Card, GameState } from '../types/game'

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeCard(element: Card['element'], value: number, id: string): Card {
  return {
    id,
    element,
    polarity: 'yang',
    value,
    type: 'soldier',
    rarity: 'common',
  }
}

function makeDeck(count = 10): Card[] {
  return Array.from({ length: count }, (_, i) =>
    makeCard('to', 1, `filler-${i}`),
  )
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return { ...base, ...overrides }
}

// ─── 테스트 1: 4장 throw 조건 ──────────────────────────────────────────────────

describe('discard-throw — 4장 throw 조건', () => {
  it('1. discardCards에 4장 전달 시 throw 발생 (/거부/ 메시지 포함)', () => {
    expect(MAX_DISCARD_PER_USE).toBe(3)

    const cards = [
      makeCard('mok', 3, 'throw-a'),
      makeCard('hwa', 3, 'throw-b'),
      makeCard('to', 3, 'throw-c'),
      makeCard('geum', 3, 'throw-d'),  // 4번째 — MAX_DISCARD_PER_USE 초과
    ]
    const state = makeState({
      hand: cards,
      deck: makeDeck(10),
      discardsLeft: 3,
      playsLeft: 4,
    })

    // 4장 버리기 시도 → 엔진 throw (8e444af clamp 회귀 근절)
    expect(() => discardCards(state, cards.map(c => c.id))).toThrow(/거부/)
  })
})

// ─── 테스트 2: discardsLeft 불변 ───────────────────────────────────────────────

describe('discard-throw — discardsLeft 불변', () => {
  it('2. throw 발생 시 discardsLeft 값 보존 (감소 없음)', () => {
    const cards = [
      makeCard('mok', 3, 'inv-a'),
      makeCard('hwa', 3, 'inv-b'),
      makeCard('to', 3, 'inv-c'),
      makeCard('geum', 3, 'inv-d'),
    ]
    const state = makeState({
      hand: cards,
      deck: makeDeck(10),
      discardsLeft: 3,
    })

    const prevDiscardsLeft = state.discardsLeft
    try { discardCards(state, cards.map(c => c.id)) } catch { /* expected */ }

    // throw 이전에 state 변경 없음 (순수 함수 — 원본 state 불변)
    expect(state.discardsLeft).toBe(prevDiscardsLeft)
    expect(state.hand.length).toBe(cards.length)
  })
})

// ─── 테스트 3: 정상 discard (3장 이하) ────────────────────────────────────────

describe('discard-throw — 정상 discard', () => {
  it('3. 3장 이하 버리기 정상 작동: discardsLeft 1 감소 + 패 교체', () => {
    const cards = [
      makeCard('mok', 3, 'ok-a'),
      makeCard('hwa', 3, 'ok-b'),
      makeCard('to', 3, 'ok-c'),
    ]
    const state = makeState({
      hand: cards,
      deck: makeDeck(10),
      discardsLeft: 3,
    })

    const next = discardCards(state, cards.map(c => c.id))
    expect(next.discardsLeft).toBe(2)           // 1 감소
    expect(next.hand.length).toBe(cards.length) // 교체로 동수 유지
  })

  it('3b. 1장 버리기: throw 없이 정상 처리', () => {
    const card = makeCard('su', 5, 'one-a')
    const state = makeState({
      hand: [card, makeCard('geum', 2, 'extra-1')],
      deck: makeDeck(10),
      discardsLeft: 2,
    })

    expect(() => discardCards(state, [card.id])).not.toThrow()
    const next = discardCards(state, [card.id])
    expect(next.discardsLeft).toBe(1)
  })
})

// ─── 테스트 4: discardsLeft 재부팅 (층 전환) ──────────────────────────────────

describe('discard-throw — discardsLeft 재부팅', () => {
  it('4. 층 전환(advanceToNextFloor) 시 discardsLeft BASE_DISCARDS로 복구', () => {
    // 1개만 남은 상태로 층 전환
    const state = makeState({
      discardsLeft: 1,
      currentFloor: 1,
      floorsCleared: 1,
      hand: makeDeck(8),
      deck: makeDeck(12),
      discardPile: [],
      playsLeft: 0,
      phase: 'floor-reward',
      isVictory: false,
      enemyHp: 0,
    })

    const next = advanceToNextFloor(state)
    // 층 전환 후 discardsLeft는 BASE_DISCARDS(=3)로 리셋
    expect(next.discardsLeft).toBe(BASE_DISCARDS)
  })
})

// ─── 테스트 5: MAX_DISCARD_PER_USE 상수 보호 ──────────────────────────────────

describe('discard-throw — 상수 보호', () => {
  it('5. MAX_DISCARD_PER_USE === 3 (고정값 회귀 방지)', () => {
    expect(MAX_DISCARD_PER_USE).toBe(3)
  })
})
