/**
 * T23-b — 손패 크기 수렴 불변식 테스트
 *
 * 보충식: refillCount = max(0, HAND_SIZE − remainHand.length)
 * 채굴: 리필된 HAND_SIZE(8)장 위에 최대 MINING_MAX_DRAW(3)장 추가 스택
 *       → 채굴 직후 최대 HAND_SIZE + MINING_MAX_DRAW = 11장
 *       → 다음 공격 시 play N장 → remain(11−N) → 리필 max(0, 8−(11−N))
 *         N≤3이면 remain≥8 → 리필 0 → 수렴 8장
 *
 * 검증 대상:
 *  1. 채굴 발동 후 hand.length ≤ HAND_SIZE + MINING_MAX_DRAW (스택 허용)
 *  2. 채굴 11장 → 3장 사용 → 8장 수렴 (이든 판정 #2)
 *  3. 스택 상태에서 2장 사용 → max(0, 8-9)=0 리필 → 9장 (점진 수렴)
 */

import { describe, it, expect } from 'vitest'
import { playCards, createInitialGameState } from '../engine/paljajeonEngine'
import { HAND_SIZE, MINING_MAX_DRAW, MINING_DRAW_DIVISOR } from '../engine/balance'
import type { GameState, Card } from '../types/game'

/** 광맥 융합(토+금) 조합 2장 카드 생성 헬퍼 */
function makeGwangmaekCards(valueTo = 5, valueGeum = 5): [Card, Card] {
  return [
    { id: 'test-to-1', element: 'to', value: valueTo, type: 'normal', rarity: 'common' },
    { id: 'test-geum-1', element: 'geum', value: valueGeum, type: 'normal', rarity: 'common' },
  ]
}

/** 채굴 발동 가능한 상태 생성 (핸드 8장 = 광맥 2 + 목 6, 덱 충분) */
function makeMiningState(): GameState {
  const [toCard, geumCard] = makeGwangmaekCards()
  const remainCards: Card[] = Array.from({ length: HAND_SIZE - 2 }, (_, i) => ({
    id: `remain-mok-${i}`,
    element: 'mok' as const,
    value: 3,
    type: 'normal' as const,
    rarity: 'common' as const,
  }))
  const deckCards: Card[] = Array.from({ length: 20 }, (_, i) => ({
    id: `deck-${i}`,
    element: (['su', 'hwa', 'mok', 'to', 'geum'] as const)[i % 5],
    value: 3 + (i % 4),
    type: 'normal' as const,
    rarity: 'common' as const,
  }))

  const base = createInitialGameState(0, null)
  return {
    ...base,
    hand: [toCard, geumCard, ...remainCards],
    deck: deckCards,
    discardPile: [],
    selectedCards: [],
    playsLeft: 4,
    discardsLeft: 3,
    disabledTraits: [],
  }
}

// ─── 1. 채굴 발동 후 스택 허용 (≤ HAND_SIZE + MINING_MAX_DRAW) ───────────────

describe('T23-b — 채굴 발동 후 스택 허용 (≤ HAND_SIZE + MINING_MAX_DRAW)', () => {
  it('채굴 발동 후 hand.length ≤ HAND_SIZE + MINING_MAX_DRAW', () => {
    const state = makeMiningState()
    expect(state.hand.length).toBe(HAND_SIZE)

    const toId = state.hand.find(c => c.element === 'to')!.id
    const geumId = state.hand.find(c => c.element === 'geum')!.id
    const next = playCards(state, [toId, geumId])

    // 보충식: 2장 출수 → remain 6 → 리필 max(0, 8-6)=2 → 8장
    // 채굴: floor((5+5)/5) = 2장 추가 → 최대 10장
    expect(next.hand.length).toBeLessThanOrEqual(HAND_SIZE + MINING_MAX_DRAW)
    expect(next.hand.length).toBeGreaterThan(HAND_SIZE)  // 채굴이 실제로 스택됨
  })

  it('채굴 최대 드로우(3장)도 상한 이내', () => {
    // value 높여서 drawCount = min(floor(baseValue/5), 3) 최대치 유도
    const [toCard, geumCard] = makeGwangmaekCards(8, 8)  // baseValue=16 → floor(16/5)=3
    const state = makeMiningState()
    const stateHigh = {
      ...state,
      hand: [toCard, geumCard, ...state.hand.slice(2)],
    }
    const toId = stateHigh.hand.find(c => c.element === 'to')!.id
    const geumId = stateHigh.hand.find(c => c.element === 'geum')!.id
    const next = playCards(stateHigh, [toId, geumId])

    expect(next.hand.length).toBeLessThanOrEqual(HAND_SIZE + MINING_MAX_DRAW)
  })
})

// ─── 2. 수렴 불변식: 채굴 11장 → 3장 사용 → 8장 수렴 ─────────────────────────

describe('T23-b — 수렴 불변식: 채굴 스택 후 공격 → HAND_SIZE 수렴', () => {
  it('채굴 11장 → 3장 사용 → 8장 수렴 (이든 판정 #2)', () => {
    // 1단계: 채굴로 11장 만들기
    const [toCard, geumCard] = makeGwangmaekCards(8, 8)  // baseValue=16 → 3장 채굴
    const state = makeMiningState()
    const stateHigh = {
      ...state,
      hand: [toCard, geumCard, ...state.hand.slice(2)],
    }
    const toId = stateHigh.hand.find(c => c.element === 'to')!.id
    const geumId = stateHigh.hand.find(c => c.element === 'geum')!.id
    const afterMining = playCards(stateHigh, [toId, geumId])

    // 채굴 후 HAND_SIZE(8) + 채굴 드로우 ≤ 11장
    const postMiningSize = afterMining.hand.length
    expect(postMiningSize).toBeLessThanOrEqual(HAND_SIZE + MINING_MAX_DRAW)

    // 2단계: 스택 상태에서 3장 출수 → 수렴
    if (afterMining.playsLeft > 0 && afterMining.hand.length >= 3) {
      const play3 = afterMining.hand.slice(0, 3).map(c => c.id)
      const afterPlay = playCards(afterMining, play3)

      // remain = postMiningSize - 3, 리필 = max(0, 8 - remain)
      // postMiningSize ≤ 11 → remain ≤ 8 → 리필 max(0, 8-remain) → 최종 = 8
      expect(afterPlay.hand.length).toBe(HAND_SIZE)
    }
  })

  it('채굴 10장 → 2장 사용 → 8장 수렴', () => {
    const state = makeMiningState()
    const toId = state.hand.find(c => c.element === 'to')!.id
    const geumId = state.hand.find(c => c.element === 'geum')!.id
    const afterMining = playCards(state, [toId, geumId])

    // 채굴 후 10장 (2장 채굴)
    const postMiningSize = afterMining.hand.length

    if (afterMining.playsLeft > 0 && afterMining.hand.length >= 2) {
      const play2 = afterMining.hand.slice(0, 2).map(c => c.id)
      const afterPlay = playCards(afterMining, play2)

      // remain = postMiningSize - 2, 리필 max(0, 8 - remain)
      // postMiningSize=10 → remain=8 → 리필 0 → 최종 8
      expect(afterPlay.hand.length).toBe(HAND_SIZE)
    }
  })
})

// ─── 3. 점진 수렴: 스택 > HAND_SIZE 상태에서 소량 출수 ──────────────────────

describe('T23-b — 점진 수렴: 스택 상태에서 소량 출수', () => {
  it('9장에서 2장 출수 → remain 7 → 리필 1 → 8장', () => {
    // 9장 핸드를 직접 구성
    const base = createInitialGameState(0, null)
    const hand9: Card[] = Array.from({ length: 9 }, (_, i) => ({
      id: `h9-${i}`,
      element: (['mok', 'hwa', 'to', 'geum', 'su'] as const)[i % 5],
      value: 3,
      type: 'normal' as const,
      rarity: 'common' as const,
    }))
    const deck10: Card[] = Array.from({ length: 10 }, (_, i) => ({
      id: `d10-${i}`,
      element: 'mok' as const,
      value: 4,
      type: 'normal' as const,
      rarity: 'common' as const,
    }))
    const state: GameState = {
      ...base,
      hand: hand9,
      deck: deck10,
      playsLeft: 3,
      discardsLeft: 3,
    }
    expect(state.hand.length).toBe(9)

    const play2 = state.hand.slice(0, 2).map(c => c.id)
    const after = playCards(state, play2)

    // remain=7, 리필 max(0, 8-7)=1 → 최종 8
    expect(after.hand.length).toBe(HAND_SIZE)
  })
})
