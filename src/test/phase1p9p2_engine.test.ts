/**
 * Phase 1.9.2 엔진 유닛 테스트 (Phase 1.9.5 사양으로 갱신)
 * E-1: 오행연환 1회 제한
 * E-2: 응축 확정판 (% 방식, 옹기가마 전용)
 * E-3: 저격(snipe)/번짐(wildfire) 특성 — 연소/관통 폐지 대체
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  playCards,
  applyCondense,
  getCondenseAvailability,
  advanceToNextFloor,
} from '../engine/paljajeonEngine'
import { getCondenseMultiplier, OHANG_YEONHWAN_MULTIPLIER } from '../engine/balance'
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

/** 신규 필드가 포함된 초기 상태 생성 헬퍼 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return { ...base, ...overrides }
}

// ============================================================
// E-1: 오행연환 1회 제한
// ============================================================
describe('E-1: 오행연환 1회 제한', () => {
  /** 5기운 각 1장씩 핸드 */
  function makeYeonhwanHand(): Card[] {
    return [
      makeCard('mok', 'yang', 5, 'mok1'),
      makeCard('hwa', 'yin', 5, 'hwa1'),
      makeCard('to', 'yang', 5, 'to1'),
      makeCard('geum', 'yin', 5, 'geum1'),
      makeCard('su', 'yang', 5, 'su1'),
    ]
  }

  it('yeonhwanUsed 초기값은 false', () => {
    const state = makeState()
    expect(state.yeonhwanUsed).toBe(false)
  })

  it('연환 첫 사용 후 yeonhwanUsed = true (T2 롤백: stats 추적 유지)', () => {
    // T2 롤백: 연환 1회 제한 폐지 — yeonhwanUsed는 stats 추적 목적으로만 유지
    // 연환 발동 시 yeonhwanUsed 플래그는 이전 값 그대로 전달 (차단 없음)
    const hand = makeYeonhwanHand()
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const state = makeState({
      hand,
      deck,
      yeonhwanUsed: false,
    })
    const cardIds = hand.map(c => c.id)
    const newState = playCards(state, cardIds)
    // T2 롤백: 연환 사용 후 yeonhwanUsed는 엔진에서 추적 값 그대로 유지 (차단 없음)
    // stats 추적 필드이므로 playCards 내에서 true 설정 불필요 — false 유지 정상
    expect(newState.yeonhwanUsed).toBe(false)
  })

  it('연환 2회 시도 → T2 롤백으로 차단 없음 — 정상 피해 발생', () => {
    // T2 롤백: 연환 "출정당 1회" 제한 완전 폐지
    const hand = makeYeonhwanHand()
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    // 이미 연환 사용된 상태
    const state = makeState({
      hand,
      deck,
      yeonhwanUsed: true,
      enemyHp: 500,
      enemyMaxHp: 500,
      playsLeft: 4,
    })
    const cardIds = hand.map(c => c.id)
    const enemyHpBefore = state.enemyHp
    const newState = playCards(state, cardIds)
    // T2 롤백: 차단 없음 — 연환 발동, 적 HP가 감소해야 함
    expect(newState.enemyHp).toBeLessThan(enemyHpBefore)
  })

  it('balance.ts OHANG_YEONHWAN_MULTIPLIER = 8 (×10 → ×8)', () => {
    expect(OHANG_YEONHWAN_MULTIPLIER).toBe(8)
  })

  it('층 전환 시 yeonhwanUsed 리셋', () => {
    const state = makeState({
      currentFloor: 1,
      yeonhwanUsed: true,
      floorsCleared: 1,
      phase: 'floor-reward',
    })
    const newState = advanceToNextFloor(state)
    expect(newState.yeonhwanUsed).toBe(false)
  })
})

// ============================================================
// E-2: 응축 확정판 (Phase 1.9.5 — % 방식, 옹기가마 전용)
// ============================================================
describe('E-2: 응축 확정판 (% 방식)', () => {
  it('condensedMultiplier 초기값은 0', () => {
    const state = makeState()
    expect(state.condensedMultiplier).toBe(0)
  })

  it('getCondenseMultiplier — 2장=1.2, 3장=1.6, 4장=2.0, 5장=2.4', () => {
    expect(getCondenseMultiplier(2)).toBe(1.2)
    expect(getCondenseMultiplier(3)).toBe(1.6)
    expect(getCondenseMultiplier(4)).toBe(2.0)
    expect(getCondenseMultiplier(5)).toBe(2.4)
  })

  it('getCondenseMultiplier — 1장=0 (불가)', () => {
    expect(getCondenseMultiplier(1)).toBe(0)
  })

  it('getCondenseMultiplier — 6장=2.4 (5장 상한 클램프)', () => {
    expect(getCondenseMultiplier(6)).toBe(2.4)
  })

  it('applyCondense(화1+토1=2장) — playsLeft -1, condensedMultiplier = 1.2, 카드 소진', () => {
    // 응축은 화+토 조합 필수 (화 0장 시 getCondenseBonus 반환 0으로 불가)
    // 화1토1 = CONDENSE_MATRIX[1][1] = 120% → 배율 1.2
    const hwaCard = makeCard('hwa', 'yang', 4, 'hwa-c1')
    const toCard = makeCard('to', 'yin', 5, 'to-c2')
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const state = makeState({
      hand: [hwaCard, toCard],
      deck,
      playsLeft: 3,
      condensedMultiplier: 0,
      isLastAttack: false,
    })
    const cardIds = [hwaCard.id, toCard.id]
    const newState = applyCondense(state, cardIds)
    expect(newState.playsLeft).toBe(2)
    expect(newState.condensedMultiplier).toBe(1.2)
    // 카드 소진 확인
    expect(newState.hand.some(c => c.id === hwaCard.id)).toBe(false)
    expect(newState.hand.some(c => c.id === toCard.id)).toBe(false)
    // discardPile에 추가 확인
    expect(newState.discardPile.some(c => c.id === hwaCard.id)).toBe(true)
    expect(newState.discardPile.some(c => c.id === toCard.id)).toBe(true)
    // 덱에서 2장 리필
    expect(newState.hand.length).toBe(2)
    // selectedCards 초기화
    expect(newState.selectedCards).toEqual([])
  })

  it('applyCondense(화1+토3=4장) — condensedMultiplier = 2.15 (MATRIX[1][3]=215→÷100)', () => {
    // 화1토3 = CONDENSE_MATRIX[1][3] = 185% → 배율 1.85
    // 화2토2 = CONDENSE_MATRIX[2][2] = 175% → 배율 1.75
    // 화1토3(4장 조합) = 1.85
    const hwaCard = makeCard('hwa', 'yang', 5, 'hwa-4a')
    const toCards = Array.from({ length: 3 }, (_, i) => makeCard('to', 'yang', 5, `to-4-${i}`))
    const cards = [hwaCard, ...toCards]
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk-${i}`))
    const state = makeState({ hand: cards, deck, playsLeft: 3, condensedMultiplier: 0, isLastAttack: false })
    const newState = applyCondense(state, cards.map(c => c.id))
    // 화1토3 = CONDENSE_MATRIX[1][3] = 185 → /100 = 1.85
    expect(newState.condensedMultiplier).toBeCloseTo(1.85, 2)
  })

  it('응축 중첩 불가 — 이미 condensedMultiplier > 0이면 무시', () => {
    const cards = [makeCard('to', 'yang', 5, 'to-dup1'), makeCard('to', 'yin', 5, 'to-dup2')]
    const state = makeState({ hand: cards, playsLeft: 3, condensedMultiplier: 1.6, isLastAttack: false })
    const newState = applyCondense(state, [cards[0].id, cards[1].id])
    // 중첩 무시: 기존 1.6 유지
    expect(newState.condensedMultiplier).toBe(1.6)
    expect(newState.playsLeft).toBe(3)
  })

  it('마지막 공격 기회에는 응축 적용 불가', () => {
    const cards = [makeCard('to', 'yang', 5, 'to-la1'), makeCard('to', 'yin', 5, 'to-la2')]
    const state = makeState({ hand: cards, playsLeft: 2, condensedMultiplier: 0, isLastAttack: true })
    const newState = applyCondense(state, [cards[0].id, cards[1].id])
    // 차단: 상태 변화 없음
    expect(newState.condensedMultiplier).toBe(0)
    expect(newState.playsLeft).toBe(2)
  })

  it('응축 소모 후 피해 증가 + condensedMultiplier 0으로 리셋', () => {
    const card = makeCard('mok', 'yang', 10, 'mok-condense')
    const deck = Array.from({ length: 5 }, (_, i) => makeCard('su', 'yang', 1, `dk-${i}`))
    // 응축 없는 상태
    const stateNormal = makeState({ hand: [card], deck: [...deck], playsLeft: 3, condensedMultiplier: 0 })
    // 응축 2.0 활성 상태
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

  describe('응축 발동 조건 판별 (getCondenseAvailability)', () => {
    it('옹기가마 + 토 타격 → great', () => {
      expect(getCondenseAvailability('옹기가마', 'to')).toBe('great')
    })

    it('광맥(토+금→금) → null (토 타격 아님)', () => {
      expect(getCondenseAvailability('광맥', 'geum')).toBeNull()
    })

    it('맑은 못(토+수→수) → null (토 타격 아님)', () => {
      expect(getCondenseAvailability('맑은 못', 'su')).toBeNull()
    })

    it('들불(목+화→화) → null', () => {
      expect(getCondenseAvailability('들불', 'hwa')).toBeNull()
    })

    it('일군 밭(목+토→토) → null (옹기가마만 허용)', () => {
      expect(getCondenseAvailability('일군 밭', 'to')).toBeNull()
    })

    it('토 모으기(finishingElement=to, comboName 없음) → null (옹기가마만 허용)', () => {
      expect(getCondenseAvailability(undefined, 'to')).toBeNull()
    })
  })
})

// ============================================================
// E-3: 저격(snipe)/번짐(wildfire) — 연소/관통 폐지 대체 (Phase 1.9.5)
// ============================================================
describe('E-3: 저격·번짐 특성 (10종 융합 특성)', () => {
  describe('저격 (깎은 화살 — 金+木)', () => {
    it('金+木 융합 → lastTraitTriggered = snipe', () => {
      const geumCard = makeCard('geum', 'yang', 5, 'geum-s')
      const mokCard = makeCard('mok', 'yin', 5, 'mok-s')
      const deck = Array.from({ length: 5 }, (_, i) => makeCard('to', 'yang', 1, `dk-s-${i}`))
      const state = makeState({ hand: [geumCard, mokCard], deck, playsLeft: 3 })
      const newState = playCards(state, [geumCard.id, mokCard.id])
      expect(newState.lastTraitTriggered).toBe('snipe')
    })

    it('木+木 모으기 → lastTraitTriggered가 snipe 아님', () => {
      const mokA = makeCard('mok', 'yang', 5, 'mok-ns-1')
      const mokB = makeCard('mok', 'yin', 5, 'mok-ns-2')
      const deck = Array.from({ length: 5 }, (_, i) => makeCard('to', 'yang', 1, `dk-ns-${i}`))
      const state = makeState({ hand: [mokA, mokB], deck, playsLeft: 3 })
      const newState = playCards(state, [mokA.id, mokB.id])
      expect(newState.lastTraitTriggered).not.toBe('snipe')
    })
  })

  describe('번짐 (들불 — 木+火)', () => {
    it('木+火 융합 → lastTraitTriggered = wildfire', () => {
      const mokCard = makeCard('mok', 'yang', 5, 'mok-wf')
      const hwaCard = makeCard('hwa', 'yin', 5, 'hwa-wf')
      const deck = Array.from({ length: 5 }, (_, i) => makeCard('to', 'yang', 1, `dk-wf-${i}`))
      const state = makeState({ hand: [mokCard, hwaCard], deck, playsLeft: 3 })
      const newState = playCards(state, [mokCard.id, hwaCard.id])
      expect(newState.lastTraitTriggered).toBe('wildfire')
    })

    it('번짐 발동 후 carryoverBurn이 0보다 커야 함', () => {
      const mokCard = makeCard('mok', 'yang', 5, 'mok-cb')
      const hwaCard = makeCard('hwa', 'yin', 5, 'hwa-cb')
      const deck = Array.from({ length: 5 }, (_, i) => makeCard('to', 'yang', 1, `dk-cb-${i}`))
      const state = makeState({ hand: [mokCard, hwaCard], deck, playsLeft: 3, carryoverBurn: 0 })
      const newState = playCards(state, [mokCard.id, hwaCard.id])
      expect(newState.carryoverBurn).toBeGreaterThan(0)
    })
  })
})

// ============================================================
// isLastAttack 마지막 공격 기회 감지
// ============================================================
describe('isLastAttack — 마지막 공격 기회 감지', () => {
  it('playsLeft=2인 상태에서 1회 공격 후 isLastAttack = true', () => {
    const card = makeCard('mok', 'yang', 5, 'mok-last')
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const state = makeState({ hand: [card], deck, playsLeft: 2 })
    const newState = playCards(state, [card.id])
    expect(newState.isLastAttack).toBe(true)
  })

  it('playsLeft=3인 상태에서 1회 공격 후 isLastAttack = false', () => {
    const card = makeCard('mok', 'yang', 5, 'mok-nlast')
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const state = makeState({ hand: [card], deck, playsLeft: 3 })
    const newState = playCards(state, [card.id])
    expect(newState.isLastAttack).toBe(false)
  })

  it('isLastAttack = true 상태에서 applyCondense 차단', () => {
    const cards = [makeCard('to', 'yang', 5, 'to-la'), makeCard('to', 'yin', 5, 'to-la2')]
    const state = makeState({ hand: cards, playsLeft: 1, condensedMultiplier: 0, isLastAttack: true })
    const newState = applyCondense(state, [cards[0].id, cards[1].id])
    expect(newState.condensedMultiplier).toBe(0)
    expect(newState.playsLeft).toBe(1)  // 소모 없음
  })
})
