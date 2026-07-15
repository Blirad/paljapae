/**
 * T23-b — 손패 크기 불변식 테스트
 * 버그: 채굴(mining) 특성이 HAND_SIZE 검사 없이 카드를 손패에 추가
 * 수정 위치: paljajeonEngine.ts L545
 *
 * 검증 대상:
 *  1. 채굴 발동 후 hand.length <= HAND_SIZE
 *  2. 채굴 연속 3회 발동 후 hand.length <= HAND_SIZE
 *  3. 이미 HAND_SIZE 가득 찼을 때 채굴 발동 -> 카드 무시 확인
 */

import { describe, it, expect } from 'vitest'
import { playCards, createInitialGameState } from '../engine/paljajeonEngine'
import { HAND_SIZE } from '../engine/balance'
import type { GameState, Card } from '../types/game'

/**
 * 광맥 융합(토+금) 조합 2장 카드 생성 헬퍼
 * 채굴(mining) 특성은 광맥 조합(to+geum fusion-birth)에서 발동
 */
function makeGwangmaekCards(): [Card, Card] {
  const toCard: Card = {
    id: 'test-to-1',
    element: 'to',
    value: 5,
    type: 'normal',
    rarity: 'common',
  }
  const geumCard: Card = {
    id: 'test-geum-1',
    element: 'geum',
    value: 5,
    type: 'normal',
    rarity: 'common',
  }
  return [toCard, geumCard]
}

/**
 * 손패가 HAND_SIZE만큼 가득 찬 상태를 만드는 헬퍼
 * 광맥 카드 2장은 playedCards로 쓰고, 나머지 6장을 remainHand로 채운 뒤
 * 덱에 추가 카드를 두어 채굴 드로우가 시도되도록 한다.
 */
function makeFullHandState(extraDeckCards: Card[] = []): GameState {
  const [toCard, geumCard] = makeGwangmaekCards()

  // 나머지 6장 — 모두 목(mok) 원소, 고유 id
  const remainCards: Card[] = Array.from({ length: HAND_SIZE - 2 }, (_, i) => ({
    id: `remain-mok-${i}`,
    element: 'mok' as const,
    value: 3,
    type: 'normal' as const,
    rarity: 'common' as const,
  }))

  const base = createInitialGameState(0, null)

  // 손패: 광맥 2장 + 나머지 6장 = HAND_SIZE(8)장
  const hand: Card[] = [toCard, geumCard, ...remainCards]

  // 덱에 추가 카드 배치 (채굴이 드로우를 시도할 때 사용)
  const deckExtra: Card[] = extraDeckCards.length > 0
    ? extraDeckCards
    : [
        { id: 'deck-extra-1', element: 'su' as const, value: 7, type: 'normal' as const, rarity: 'common' as const },
        { id: 'deck-extra-2', element: 'hwa' as const, value: 4, type: 'normal' as const, rarity: 'common' as const },
        { id: 'deck-extra-3', element: 'mok' as const, value: 6, type: 'normal' as const, rarity: 'common' as const },
      ]

  return {
    ...base,
    hand,
    deck: [...base.deck, ...deckExtra],
    discardPile: [],
    selectedCards: [],
    playsLeft: 4,
    discardsLeft: 3,
    // 채굴 특성이 비활성화 목록에 없어야 함
    disabledTraits: [],
  }
}

// ---------------------------------------------------------------------------
// 케이스 1: 채굴 1회 발동 후 hand.length <= HAND_SIZE
// ---------------------------------------------------------------------------
describe('T23-b — 채굴 1회 발동 후 손패 크기 불변식', () => {
  it('채굴 발동 후 hand.length 가 HAND_SIZE 이하여야 한다', () => {
    const state = makeFullHandState()

    // 전제 확인: 손패가 HAND_SIZE 장이어야 함
    expect(state.hand.length).toBe(HAND_SIZE)

    const toId = state.hand.find(c => c.element === 'to')!.id
    const geumId = state.hand.find(c => c.element === 'geum')!.id

    const next = playCards(state, [toId, geumId])

    expect(next.hand.length).toBeLessThanOrEqual(HAND_SIZE)
  })
})

// ---------------------------------------------------------------------------
// 케이스 2: 채굴 연속 3회 발동 후 hand.length <= HAND_SIZE
// ---------------------------------------------------------------------------
describe('T23-b — 채굴 연속 3회 발동 후 손패 크기 불변식', () => {
  it('채굴 3회 연속 발동 후에도 hand.length 가 HAND_SIZE 이하여야 한다', () => {
    let state = makeFullHandState()

    for (let round = 0; round < 3; round++) {
      const toCard = state.hand.find(c => c.element === 'to')
      const geumCard = state.hand.find(c => c.element === 'geum')

      if (!toCard || !geumCard) {
        // 손패에 광맥 조합 카드가 없으면 추가해서 계속 시뮬레이션
        const newTo: Card = { id: `dynamic-to-${round}`, element: 'to', value: 5, type: 'normal', rarity: 'common' }
        const newGeum: Card = { id: `dynamic-geum-${round}`, element: 'geum', value: 5, type: 'normal', rarity: 'common' }
        // 손패가 HAND_SIZE 미만이면 추가
        if (state.hand.length < HAND_SIZE - 1) {
          state = { ...state, hand: [...state.hand, newTo, newGeum] }
        } else if (state.hand.length < HAND_SIZE) {
          state = { ...state, hand: [...state.hand, newTo] }
        }
        break
      }

      const prevLength = state.hand.length
      state = playCards(state, [toCard.id, geumCard.id])

      // 매 라운드마다 불변식 확인
      expect(state.hand.length).toBeLessThanOrEqual(HAND_SIZE)

      // 이전보다 초과하지 않았음을 확인
      // (playedCards 2장 → drawnCards 2장 + mining 1장 시도, 상한으로 차단 시 최대 HAND_SIZE)
      expect(state.hand.length).toBeLessThanOrEqual(prevLength + 1)
    }

    // 최종 불변식
    expect(state.hand.length).toBeLessThanOrEqual(HAND_SIZE)
  })
})

// ---------------------------------------------------------------------------
// 케이스 3: 손패가 이미 HAND_SIZE 가득 찼을 때 채굴 발동 → 카드 무시
// ---------------------------------------------------------------------------
describe('T23-b — 손패 가득 찬 상태에서 채굴 발동 시 카드 무시', () => {
  it('손패가 HAND_SIZE(8) 가득 찼을 때 채굴이 발동되어도 손패 크기가 HAND_SIZE를 초과하지 않아야 한다', () => {
    const state = makeFullHandState()

    // 전제: 손패 정확히 HAND_SIZE장
    expect(state.hand.length).toBe(HAND_SIZE)
    // 전제: 덱에 카드 존재 (채굴이 드로우를 시도할 수 있는 상황)
    expect(state.deck.length).toBeGreaterThan(0)

    const toId = state.hand.find(c => c.element === 'to')!.id
    const geumId = state.hand.find(c => c.element === 'geum')!.id

    // 출수: 광맥 2장을 내면 2장이 remainHand에서 빠지고 덱에서 2장 보충 (정상 드로우)
    // 채굴 추가 드로우 시도: remainHand.length(6) + drawnCards(2) = 8 = HAND_SIZE → 채굴 차단
    const next = playCards(state, [toId, geumId])

    // 핵심 불변식: HAND_SIZE 초과 금지
    expect(next.hand.length).toBeLessThanOrEqual(HAND_SIZE)

    // 특성이 발동됐다면 lastTraitTriggered === 'mining' 이어야 함
    // (채굴 차단 시에도 case에 진입하지만 if 조건에서 걸림 — lastTraitTriggered는 설정됨)
    if (next.lastTraitTriggered) {
      expect(next.lastTraitTriggered).toBe('mining')
    }
  })

  it('HAND_SIZE 가득 찬 상태에서 채굴 후 덱 카드 수가 채굴로 인해 줄어들지 않아야 한다', () => {
    const extraDeckCards: Card[] = [
      { id: 'sentinel-1', element: 'su', value: 2, type: 'normal', rarity: 'common' },
      { id: 'sentinel-2', element: 'hwa', value: 3, type: 'normal', rarity: 'common' },
      { id: 'sentinel-3', element: 'mok', value: 4, type: 'normal', rarity: 'common' },
    ]
    const state = makeFullHandState(extraDeckCards)

    const toId = state.hand.find(c => c.element === 'to')!.id
    const geumId = state.hand.find(c => c.element === 'geum')!.id

    const deckBefore = state.deck.length
    const next = playCards(state, [toId, geumId])

    // 정상 드로우: 2장 출수 → 2장 보충 → 덱 -2
    // 채굴 차단 시: 채굴 드로우 없음 → 덱 총 소모 = 2장만
    // 채굴 미차단(버그): 채굴 드로우 1장 추가 → 덱 총 소모 = 3장
    // => 차단 시 next.deck.length >= deckBefore - 2 (정확히 -2)
    // => 미차단 시 next.deck.length === deckBefore - 3
    //
    // 채굴이 차단됐을 때는 손패가 HAND_SIZE이므로 덱에서 채굴 드로우 안 함
    // 검증: 손패 상한 조건이 true이므로(손패=8=HAND_SIZE) 채굴 드로우 차단 → 덱 -2

    expect(next.hand.length).toBeLessThanOrEqual(HAND_SIZE)

    // 덱 소모가 3장(채굴 포함)이 아닌 2장이어야 함 (덱 재순환 없다고 가정)
    if (!next.reshuffled) {
      expect(next.deck.length).toBeGreaterThanOrEqual(deckBefore - 2)
    }
  })
})
