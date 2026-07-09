/**
 * STS 덱 사이클 엔진
 * 드로우 → 버리기더미 → 소진더미 완전 사이클
 *
 * Phase 1 — STS 재작성 (BattleState 전용, GameState 의존 없음)
 */

import type { BattleState, CardInstance } from '@/types/stsTypes'

// ─── 셔플 ────────────────────────────────────────────

/**
 * Fisher-Yates 셔플 (순수 함수, 불변)
 */
export function shuffleDeck(cards: CardInstance[]): CardInstance[] {
  const arr = [...cards]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── 드로우 ──────────────────────────────────────────

/**
 * n장 드로우
 * - drawPile 소진 시 discardPile 재셔플 후 drawPile로
 * - 핸드 최대 10장 제한 (STS 표준)
 */
export function drawCards(state: BattleState, n: number): BattleState {
  const HAND_MAX = 10
  let player = { ...state.player }
  let drawPile = [...player.drawPile]
  let discardPile = [...player.discardPile]
  let hand = [...player.hand]

  for (let i = 0; i < n; i++) {
    // 핸드 최대치 도달 → 드로우 중단
    if (hand.length >= HAND_MAX) break

    // drawPile 소진 → discardPile 재셔플 → drawPile로
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break // 버리기더미도 없음 → 드로우 불가
      drawPile = shuffleDeck(discardPile)
      discardPile = []
    }

    const card = drawPile.shift()!
    hand.push(card)
  }

  return {
    ...state,
    player: {
      ...player,
      drawPile,
      discardPile,
      hand,
    },
  }
}

// ─── 버리기 ──────────────────────────────────────────

/**
 * 핸드에서 instanceId에 해당하는 카드를 버리기더미로 이동
 */
export function discardCard(state: BattleState, instanceId: string): BattleState {
  const player = state.player
  const cardIndex = player.hand.findIndex(c => c.instanceId === instanceId)
  if (cardIndex === -1) return state

  const newHand = [...player.hand]
  const [card] = newHand.splice(cardIndex, 1)

  return {
    ...state,
    player: {
      ...player,
      hand: newHand,
      discardPile: [...player.discardPile, card],
    },
  }
}

// ─── 소진 ────────────────────────────────────────────

/**
 * 핸드 또는 drawPile에서 instanceId에 해당하는 카드를 소진더미로 이동
 * (주로 핸드에서 호출)
 */
export function exhaustCard(state: BattleState, instanceId: string): BattleState {
  const player = state.player

  // 핸드에서 먼저 탐색
  const handIndex = player.hand.findIndex(c => c.instanceId === instanceId)
  if (handIndex !== -1) {
    const newHand = [...player.hand]
    const [card] = newHand.splice(handIndex, 1)
    return {
      ...state,
      player: {
        ...player,
        hand: newHand,
        exhaustPile: [...player.exhaustPile, card],
      },
    }
  }

  // drawPile에서 탐색 (드로우 중 소진 카드 처리)
  const drawIndex = player.drawPile.findIndex(c => c.instanceId === instanceId)
  if (drawIndex !== -1) {
    const newDrawPile = [...player.drawPile]
    const [card] = newDrawPile.splice(drawIndex, 1)
    return {
      ...state,
      player: {
        ...player,
        drawPile: newDrawPile,
        exhaustPile: [...player.exhaustPile, card],
      },
    }
  }

  return state
}
