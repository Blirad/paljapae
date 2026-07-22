// ============================================================
// [시대물 격리] 2026-07-22 (v4 정본 전환)
// 시대: v3 시대 가정 (기본모드=v3 전제)
// 대체: v4 정식 전환 (devSettings v4+강림 ON)
// 이유: LEDGER 마감된 v4 전환으로 이 가정은 무효화됨
// ============================================================
/**
 * Phase 1.9.5 엔진 유닛 테스트
 * 수정 1: 덱 고갈 소프트락 방지 — 재순환 로직 (Phase 1.9.4 유지)
 * 수정 2: 응축 확정판 — condensedMultiplier % 방식
 * 수정 3: 10종 융합 특성 — 번짐/채굴/자양/수확/담금질/저격
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  playCards,
  discardCards,
  applyCondense,
} from '../engine/paljajeonEngine'
import { getCondenseMultiplier } from '../engine/balance'
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
describe.skip('수정 1: 덱 고갈 소프트락 방지', () => {
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
    // 불변 조건: 핸드 리필 발생
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
// 수정 2: 응축 확정판 — condensedMultiplier % 방식
// ============================================================
describe.skip('수정 2: 응축 확정판 — condensedMultiplier % 방식', () => {
  it('getCondenseMultiplier — 장수별 배율 확인', () => {
    expect(getCondenseMultiplier(2)).toBe(1.2)  // +120%
    expect(getCondenseMultiplier(3)).toBe(1.6)  // +160%
    expect(getCondenseMultiplier(4)).toBe(2.0)  // +200%
    expect(getCondenseMultiplier(5)).toBe(2.4)  // +240%
    expect(getCondenseMultiplier(1)).toBe(0)    // 2장 미만 불가
    expect(getCondenseMultiplier(6)).toBe(2.4)  // 5장 상한 클램프
  })

  it('applyCondense — 2장 선택 시 condensedMultiplier = 1.2', () => {
    const cards = [makeCard('hwa', 'yang', 5, 'h1'), makeCard('to', 'yang', 5, 'to1')]
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk-${i}`))
    const state = makeState({ hand: cards, deck, playsLeft: 3, isLastAttack: false, condensedMultiplier: 0 })
    const newState = applyCondense(state, [cards[0].id, cards[1].id])
    expect(newState.condensedMultiplier).toBe(1.2)
    expect(newState.playsLeft).toBe(2)
    expect(newState.selectedCards).toEqual([])
  })

  it('applyCondense — 화2+토2=4장 선택 시 condensedMultiplier = 1.75 (MATRIX[2][2]=175÷100)', () => {
    // 응축은 화+토 조합 필수. 화2+토2 = CONDENSE_MATRIX[2][2] = 175% → 배율 1.75
    const hwaCards = [makeCard('hwa', 'yang', 5, 'hwa-4-0'), makeCard('hwa', 'yin', 5, 'hwa-4-1')]
    const toCards = [makeCard('to', 'yang', 5, 'to-4-0'), makeCard('to', 'yin', 5, 'to-4-1')]
    const cards = [...hwaCards, ...toCards]
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk-${i}`))
    const state = makeState({ hand: cards, deck, playsLeft: 3, isLastAttack: false, condensedMultiplier: 0 })
    const newState = applyCondense(state, cards.map(c => c.id))
    expect(newState.condensedMultiplier).toBeCloseTo(1.75, 2)
  })

  it('applyCondense — 마지막 공격 시 응축 불가 (state 변경 없음)', () => {
    const cards = [makeCard('hwa', 'yang', 5, 'h-la'), makeCard('to', 'yang', 5, 'to-la')]
    const state = makeState({ hand: cards, playsLeft: 1, isLastAttack: true, condensedMultiplier: 0 })
    const newState = applyCondense(state, [cards[0].id, cards[1].id])
    expect(newState.condensedMultiplier).toBe(0)  // 변경 없음
  })

  it('applyCondense — 이미 응축 활성 시 중첩 불가', () => {
    const cards = [makeCard('hwa', 'yang', 5, 'h-dup'), makeCard('to', 'yang', 5, 'to-dup')]
    const state = makeState({ hand: cards, playsLeft: 3, isLastAttack: false, condensedMultiplier: 1.6 })
    const newState = applyCondense(state, [cards[0].id, cards[1].id])
    expect(newState.condensedMultiplier).toBe(1.6)  // 변경 없음
  })

  it('playCards — condensedMultiplier=2.0 적용 후 소모', () => {
    const card = makeCard('mok', 'yang', 10, 'mok-condense')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk-${i}`))
    // condensedMultiplier 없는 상태
    const stateNormal = makeState({ hand: [card], deck: [...deck], playsLeft: 3, condensedMultiplier: 0 })
    // condensedMultiplier=2.0 상태
    const cardB = makeCard('mok', 'yang', 10, 'mok-condense-b')
    const stateCondensed = makeState({
      hand: [cardB],
      deck: Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk2-${i}`)),
      playsLeft: 3,
      condensedMultiplier: 2.0,
    })
    const dmgNormal = stateNormal.enemyHp - playCards(stateNormal, [card.id]).enemyHp
    const dmgCondensed = stateCondensed.enemyHp - playCards(stateCondensed, [cardB.id]).enemyHp
    // 응축 +200% → 피해가 더 커야 함
    expect(dmgCondensed).toBeGreaterThan(dmgNormal)
    // 응축 소모 확인
    const afterCondensed = playCards(stateCondensed, [cardB.id])
    expect(afterCondensed.condensedMultiplier).toBe(0)
  })
})

// ============================================================
// 수정 3: 10종 융합 특성 발동 확인
// ============================================================
describe.skip('수정 3: 10종 융합 특성 발동', () => {
  it('자양(숲) — 水+木 융합 후 체력 8 회복', () => {
    const suCard = makeCard('su', 'yang', 5, 'su-f')
    const mokCard = makeCard('mok', 'yin', 5, 'mok-f')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('to', 'yang', 1, `dk-n-${i}`))
    const state = makeState({ hand: [suCard, mokCard], deck, playsLeft: 3, playerHp: 50 })
    const newState = playCards(state, [suCard.id, mokCard.id])
    // 숲(水+木) 조합 → 자양 특성 → 체력 8 회복
    // 반격 피해 1을 감안하면 hp는 50 - 1 + 8 = 57이어야 함
    expect(newState.playerHp).toBeGreaterThan(50)
    expect(newState.lastTraitTriggered).toBe('nourish')
  })

  it('채굴(광맥) — 土+金 융합 후 수렴 리필 + 채굴 스택', () => {
    const toCard = makeCard('to', 'yang', 5, 'to-m')
    const geumCard = makeCard('geum', 'yin', 5, 'geum-m')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('mok', 'yang', 1, `dk-m-${i}`))
    const state = makeState({ hand: [toCard, geumCard], deck, playsLeft: 3 })
    const newState = playCards(state, [toCard.id, geumCard.id])
    // 수렴 리필: remain=0, 리필 max(0,8-0)=8, deck 5 + discard 2 = 7 (reshuffle) → draw 7
    // 채굴: floor(10/5)=2장 추가 시도, deck 0 → draw 0
    // 최종 핸드 = 7 (수렴식 제약)
    expect(newState.hand.length).toBe(7)
    expect(newState.lastTraitTriggered).toBe('mining')
  })

  it('담금질(담금불) — 水+火 융합 후 쓴 카드 값 영구 +1', () => {
    // 담금질(quench): "이번 공격에 쓴 카드들의 값이 1 영구히 오른다"
    // su(value=3) + hwa(value=3) 사용 → 값 +1 영구 적용
    // 수렴 리필(remain=0→8장 리필) 시 reshuffle 발생 → 카드가 deck에 재편입됨
    const suCard = makeCard('su', 'yang', 3, 'su-q')
    const hwaCard = makeCard('hwa', 'yin', 3, 'hwa-q')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('geum', 'yang', 2, `dk-q-${i}`))
    const state = makeState({ hand: [suCard, hwaCard], deck, playsLeft: 3 })
    const newState = playCards(state, [suCard.id, hwaCard.id])
    // reshuffle 시 카드가 hand/deck에 재분배 → 전체 풀에서 찾기
    const allCards = [...newState.hand, ...newState.deck, ...newState.discardPile]
    const suAfter = allCards.find(c => c.id === 'su-q')
    const hwaAfter = allCards.find(c => c.id === 'hwa-q')
    expect(suAfter?.value).toBe(4)   // 3 → 4
    expect(hwaAfter?.value).toBe(4)  // 3 → 4
    expect(newState.lastTraitTriggered).toBe('quench')
  })

  it('수확(일군 밭) — 木+土 융합 후 손의 목·토 카드 값 +1', () => {
    const mokCard = makeCard('mok', 'yang', 4, 'mok-h')
    const toCard = makeCard('to', 'yin', 4, 'to-h')
    // 손에 목 카드 1장 추가로 남겨두기
    const extraMok = makeCard('mok', 'yang', 3, 'mok-extra')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('geum', 'yang', 2, `dk-h-${i}`))
    const state = makeState({ hand: [mokCard, toCard, extraMok], deck, playsLeft: 3 })
    const newState = playCards(state, [mokCard.id, toCard.id])
    // 수확: 손의 목·토 카드 값 +1
    const extraMokAfter = newState.hand.find(c => c.id === 'mok-extra')
    expect(extraMokAfter?.value).toBe(4)  // 3 → 4
    expect(newState.lastTraitTriggered).toBe('harvest')
  })

  it('저격(깎은 화살) — 金+木 융합 → lastTraitTriggered = snipe', () => {
    const geumCard = makeCard('geum', 'yang', 5, 'geum-s')
    const mokCard = makeCard('mok', 'yin', 5, 'mok-s')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('to', 'yang', 1, `dk-s-${i}`))
    const state = makeState({ hand: [geumCard, mokCard], deck, playsLeft: 3 })
    const newState = playCards(state, [geumCard.id, mokCard.id])
    expect(newState.lastTraitTriggered).toBe('snipe')
  })
})
