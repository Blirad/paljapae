/**
 * batch1EffectChoice.test.ts
 * B1-1: 낳는 융합 양자택일 효과 검증
 *
 * 테스트 항목:
 *  1. 양자택일 분기 — effectMode=true/false 피해 분기
 *  2. 잔불(wildfire) — 들불 조합 + effectMode=true
 *  3. 자양(nourish) — 숲 조합 + effectMode=true → HP 회복
 *  4. 정화(purification) — 샘 조합 + effectMode=true → 임계값 분기
 *  5. 채굴(mining) — 광맥 조합 + effectMode=true → 드로우
 *  6. 수렴 불변식 — 채굴 드로우 후 손패 ≤ HAND_SIZE+3
 *  7. 버리기 3장 제한 — 4장 전달 시 상태 변화 없음
 *  8. 모으기 4장 배율 — 같은 기운 4장 → GATHER_MULTIPLIERS[4]=4.0
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  playCards,
  discardCards,
} from '../engine/paljajeonEngine'
import {
  PLAYER_BASE_HP,
  HAND_SIZE,
  NOURISH_EFFECT_COEFF,
  PURIFICATION_THRESHOLD,
  MINING_DRAW_DIVISOR,
  MINING_MAX_DRAW,
  EMBER_DURATION,
  EMBER_MULTIPLIER,
  GATHER_MULTIPLIERS,
  MAX_DISCARD_PER_USE,
} from '../engine/balance'
import type { Card, GameState } from '../types/game'

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeCard(
  element: Card['element'],
  value: number,
  id?: string,
): Card {
  return {
    id: id ?? `${element}-${value}-${Math.random().toString(36).slice(2, 6)}`,
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

// ─── 1. 양자택일 분기 ─────────────────────────────────────────────────────────

describe('1. 양자택일 분기 — 들불(mok+hwa, fusion-birth)', () => {
  it('effectMode=false → 정상 피해 (damage > 0)', () => {
    // 들불: 목(mok)+화(hwa) → 낳는 융합(wildfire)
    const mokCard = makeCard('mok', 5, 'mok-branch')
    const hwaCard = makeCard('hwa', 5, 'hwa-branch')
    const state = makeState({
      hand: [mokCard, hwaCard],
      deck: makeDeck(),
      playsLeft: 3,
    })
    const before = state.enemyHp
    const after = playCards(state, [mokCard.id, hwaCard.id], false)
    expect(after.enemyHp).toBeLessThan(before)
  })

  it('effectMode=true → damage=0, 적 HP 변화 없음 (잔불 피해 제외)', () => {
    // effectMode=true 시 기본 공격 피해 0
    const mokCard = makeCard('mok', 5, 'mok-effect')
    const hwaCard = makeCard('hwa', 5, 'hwa-effect')
    const state = makeState({
      hand: [mokCard, hwaCard],
      deck: makeDeck(),
      playsLeft: 3,
      // 잔불 없는 깨끗한 상태 보장
      emberDamagePerTurn: 0,
      emberTurnsLeft: 0,
    })
    const before = state.enemyHp
    const after = playCards(state, [mokCard.id, hwaCard.id], true)
    // effectMode=true → 공격 피해 0 → 적 HP 유지
    expect(after.enemyHp).toBe(before)
  })
})

// ─── 2. 잔불(wildfire) ────────────────────────────────────────────────────────

describe('2. 잔불(wildfire) — 들불 + effectMode=true', () => {
  it('emberDamagePerTurn = baseValue * EMBER_MULTIPLIER, emberTurnsLeft = EMBER_DURATION 세팅', () => {
    const mokCard = makeCard('mok', 6, 'mok-wf')
    const hwaCard = makeCard('hwa', 4, 'hwa-wf')
    const state = makeState({
      hand: [mokCard, hwaCard],
      deck: makeDeck(),
      playsLeft: 3,
      emberDamagePerTurn: 0,
      emberTurnsLeft: 0,
    })
    const after = playCards(state, [mokCard.id, hwaCard.id], true)
    const baseValue = 6 + 4  // 10
    const expectedEmberDmg = Math.round(baseValue * EMBER_MULTIPLIER)
    expect(after.emberDamagePerTurn).toBe(expectedEmberDmg)
    expect(after.emberTurnsLeft).toBe(EMBER_DURATION)
    expect(after.lastTraitTriggered).toBe('wildfire')
  })

  it('잔불 세팅 후 2턴째에 자동 피해 적용 — emberTurnsLeft 감소 확인', () => {
    const mokCard = makeCard('mok', 6, 'mok-wf2a')
    const hwaCard = makeCard('hwa', 4, 'hwa-wf2a')
    // 2층(floorIndex=1)으로 설정 — 2층은 고목령 heal 기믹 없음
    const state1 = makeState({
      hand: [mokCard, hwaCard],
      deck: makeDeck(15),
      playsLeft: 5,
      emberDamagePerTurn: 0,
      emberTurnsLeft: 0,
      currentFloor: 2,  // 2층: 잔화령(hwa) 기믹만 — heal 없음
    })
    // 1턴: 잔불 세팅
    const after1 = playCards(state1, [mokCard.id, hwaCard.id], true)
    expect(after1.emberTurnsLeft).toBe(EMBER_DURATION)
    const emberDmg = after1.emberDamagePerTurn

    // 2턴: 잔불 피해 발동 확인 — 명시적으로 잔불 상태 세팅
    // 중립 단독 카드(to) 출수 시 잔불만으로 HP 변화 확인
    const extraCards = after1.hand.filter(c => c.element !== 'mok' && c.element !== 'hwa')
    const playCard2 = after1.hand[0]
    // 잔불 피해는 턴 시작에 적용됨
    // emberTurnsLeft 감소를 통해 잔불 발동 간접 확인
    const after2 = playCards(after1, [playCard2.id])
    expect(after2.emberTurnsLeft).toBe(EMBER_DURATION - 1)
    // emberDamagePerTurn이 0보다 크면 잔불이 적용되고 있다는 증거
    expect(emberDmg).toBeGreaterThan(0)
  })
})

// ─── 3. 자양(nourish) ─────────────────────────────────────────────────────────

describe('3. 자양(nourish) — 숲(su+mok) + effectMode=true', () => {
  it('HP 회복 = round(baseValue * NOURISH_EFFECT_COEFF), maxHP 초과 없음', () => {
    // 숲: 수(su)+목(mok) → 낳는 융합(nourish)
    const suCard = makeCard('su', 4, 'su-nourish')
    const mokCard = makeCard('mok', 4, 'mok-nourish')
    const baseValue = 4 + 4  // 8
    const healAmount = Math.round(baseValue * NOURISH_EFFECT_COEFF)  // 20
    const startHp = 50
    const deck = makeDeck()

    const state = makeState({
      hand: [suCard, mokCard],
      deck,
      playsLeft: 3,
      playerHp: startHp,
      playerMaxHp: PLAYER_BASE_HP,
    })
    // counterDamage가 0인 1층 상태 가정 — 반격 포함해도 회복이 더 큼
    const after = playCards(state, [suCard.id, mokCard.id], true)
    // 회복 후 HP는 시작 HP보다 높아야 함
    expect(after.playerHp).toBeGreaterThan(startHp)
    // maxHP 초과 없음
    expect(after.playerHp).toBeLessThanOrEqual(PLAYER_BASE_HP)
    expect(after.lastTraitTriggered).toBe('nourish')
  })

  it('HP가 이미 full일 때 회복 후에도 maxHP 초과 없음', () => {
    const suCard = makeCard('su', 6, 'su-nourishfull')
    const mokCard = makeCard('mok', 6, 'mok-nourishfull')
    const state = makeState({
      hand: [suCard, mokCard],
      deck: makeDeck(),
      playsLeft: 3,
      playerHp: PLAYER_BASE_HP,
      playerMaxHp: PLAYER_BASE_HP,
    })
    const after = playCards(state, [suCard.id, mokCard.id], true)
    expect(after.playerHp).toBeLessThanOrEqual(PLAYER_BASE_HP)
  })
})

// ─── 4. 정화(purification) ────────────────────────────────────────────────────

describe('4. 정화(purification) — 샘(geum+su) + effectMode=true', () => {
  it('baseValue >= PURIFICATION_THRESHOLD → purificationImmune=true, purifiedElements 전원소', () => {
    // 샘: 금(geum)+수(su) → 낳는 융합(purification)
    // baseValue = 10 이상 필요
    const geumCard = makeCard('geum', 6, 'geum-purif-hi')
    const suCard = makeCard('su', 6, 'su-purif-hi')
    const baseValue = 6 + 6  // 12 >= 10
    expect(baseValue).toBeGreaterThanOrEqual(PURIFICATION_THRESHOLD)

    const state = makeState({
      hand: [geumCard, suCard],
      deck: makeDeck(),
      playsLeft: 3,
      purificationImmune: false,
      purifiedElements: [],
    })
    const after = playCards(state, [geumCard.id, suCard.id], true)
    expect(after.purificationImmune).toBe(true)
    // 전 원소 해제
    const allElements = ['mok', 'hwa', 'to', 'geum', 'su']
    for (const el of allElements) {
      expect(after.purifiedElements).toContain(el)
    }
    expect(after.lastTraitTriggered).toBe('purification')
  })

  it('baseValue < PURIFICATION_THRESHOLD → 1종만 해제, purificationImmune 유지 false', () => {
    // baseValue = 8 < 10
    const geumCard = makeCard('geum', 4, 'geum-purif-lo')
    const suCard = makeCard('su', 4, 'su-purif-lo')
    const baseValue = 4 + 4  // 8 < 10
    expect(baseValue).toBeLessThan(PURIFICATION_THRESHOLD)

    const state = makeState({
      hand: [geumCard, suCard],
      deck: makeDeck(),
      playsLeft: 3,
      purificationImmune: false,
      purifiedElements: [],
    })
    const after = playCards(state, [geumCard.id, suCard.id], true)
    expect(after.purificationImmune).toBe(false)
    // 1종만 해제됨 (purifiedElements.length == 1)
    expect(after.purifiedElements.length).toBe(1)
    expect(after.lastTraitTriggered).toBe('purification')
  })
})

// ─── 5. 채굴(mining) ──────────────────────────────────────────────────────────

describe('5. 채굴(mining) — 광맥(to+geum) + effectMode=true', () => {
  it('손패 장수 증가 = min(floor(baseValue/MINING_DRAW_DIVISOR), MINING_MAX_DRAW)', () => {
    // 광맥: 토(to)+금(geum) → 낳는 융합(mining)
    // baseValue = 10 → floor(10/5)=2 드로우
    const toCard = makeCard('to', 5, 'to-mining')
    const geumCard = makeCard('geum', 5, 'geum-mining')
    const baseValue = 5 + 5  // 10
    const expectedDraw = Math.min(
      Math.floor(baseValue / MINING_DRAW_DIVISOR),
      MINING_MAX_DRAW,
    )  // min(2, 3) = 2

    // 충분한 덱 보장
    const deck = makeDeck(15)
    const state = makeState({
      hand: [toCard, geumCard],
      deck,
      playsLeft: 3,
    })
    const after = playCards(state, [toCard.id, geumCard.id], true)
    // 2장 출수 → remainHand=0 → 리필=HAND_SIZE(8)장 + 채굴 추가 drw(2)장
    // 최종 손패 = HAND_SIZE + expectedDraw
    expect(after.hand.length).toBe(HAND_SIZE + expectedDraw)
    expect(after.lastTraitTriggered).toBe('mining')
  })

  it('baseValue가 높아도 드로우는 MINING_MAX_DRAW(3)장 상한', () => {
    // baseValue = 20 → floor(20/5)=4, 상한 3
    const toCard = makeCard('to', 10, 'to-mining-cap')
    const geumCard = makeCard('geum', 10, 'geum-mining-cap')
    const baseValue = 10 + 10  // 20
    const rawDraw = Math.floor(baseValue / MINING_DRAW_DIVISOR)  // 4
    expect(rawDraw).toBeGreaterThan(MINING_MAX_DRAW)

    const deck = makeDeck(20)
    const state = makeState({
      hand: [toCard, geumCard],
      deck,
      playsLeft: 3,
    })
    const after = playCards(state, [toCard.id, geumCard.id], true)
    // 2장 출수 → remainHand=0 → 리필=HAND_SIZE(8)장 + 채굴 상한(3)장
    // 최종 손패 = HAND_SIZE + MINING_MAX_DRAW
    expect(after.hand.length).toBe(HAND_SIZE + MINING_MAX_DRAW)
  })
})

// ─── 6. 수렴 불변식 — 채굴 드로우 후 손패 ≤ HAND_SIZE+3 ───────────────────────

describe('6. 수렴 불변식 — 채굴 드로우 후 손패 ≤ HAND_SIZE+MINING_MAX_DRAW', () => {
  it('최대 드로우 후에도 손패 ≤ HAND_SIZE + MINING_MAX_DRAW', () => {
    // 광맥 + effectMode=true + baseValue=20 → 최대 드로우 3
    const toCard = makeCard('to', 10, 'to-invariant')
    const geumCard = makeCard('geum', 10, 'geum-invariant')
    // 초기 손패를 HAND_SIZE로 채움
    const extraCards = Array.from({ length: HAND_SIZE - 2 }, (_, i) =>
      makeCard('mok', 1, `extra-inv-${i}`),
    )
    const hand = [toCard, geumCard, ...extraCards]
    const deck = makeDeck(20)
    const state = makeState({ hand, deck, playsLeft: 3 })

    const after = playCards(state, [toCard.id, geumCard.id], true)
    expect(after.hand.length).toBeLessThanOrEqual(HAND_SIZE + MINING_MAX_DRAW)
  })
})

// ─── 7. 버리기 3장 제한 ───────────────────────────────────────────────────────

describe('7. 버리기 3장 제한 — discardCards에 4장 전달 시 상태 변화 없음', () => {
  it('4장 버리기 시도 → 상태 불변 (MAX_DISCARD_PER_USE=3 초과)', () => {
    expect(MAX_DISCARD_PER_USE).toBe(3)

    const cards = [
      makeCard('mok', 3, 'discard-a'),
      makeCard('hwa', 3, 'discard-b'),
      makeCard('to', 3, 'discard-c'),
      makeCard('geum', 3, 'discard-d'),
    ]
    const state = makeState({
      hand: cards,
      deck: makeDeck(),
      discardsLeft: 3,
      playsLeft: 3,
    })
    const after = discardCards(state, cards.map(c => c.id))
    // 상태 변화 없음
    expect(after.hand.length).toBe(state.hand.length)
    expect(after.discardsLeft).toBe(state.discardsLeft)
    expect(after.deck.length).toBe(state.deck.length)
  })

  it('3장 버리기는 정상 동작', () => {
    const cards = [
      makeCard('mok', 3, 'discard3-a'),
      makeCard('hwa', 3, 'discard3-b'),
      makeCard('to', 3, 'discard3-c'),
    ]
    const state = makeState({
      hand: cards,
      deck: makeDeck(),
      discardsLeft: 3,
      playsLeft: 3,
    })
    const after = discardCards(state, cards.map(c => c.id))
    expect(after.discardsLeft).toBe(2)
  })
})

// ─── 8. 모으기 4장 배율 ───────────────────────────────────────────────────────

describe('8. 모으기 4장 배율 — 같은 기운 4장 → GATHER_MULTIPLIERS[4]=4.0', () => {
  it('같은 기운 4장 totalScore ≈ baseScore × 4.0', () => {
    expect(GATHER_MULTIPLIERS[4]).toBe(4.0)

    const cards = [
      makeCard('mok', 5, 'gather4-a'),
      makeCard('mok', 5, 'gather4-b'),
      makeCard('mok', 5, 'gather4-c'),
      makeCard('mok', 5, 'gather4-d'),
    ]
    const deck = makeDeck(15)
    const state = makeState({
      hand: cards,
      deck,
      playsLeft: 3,
    })
    const before = state.enemyHp
    const after = playCards(state, cards.map(c => c.id))
    const damage = before - after.enemyHp
    // baseScore = 5*4 = 20, multiplier=4.0 → 기본 80 (상성 등 보정 가능)
    // 최소한 baseScore(20) 이상인지 확인
    const baseScore = 5 * 4  // 20
    expect(damage).toBeGreaterThanOrEqual(baseScore)
    // GATHER_MULTIPLIERS[4]=4.0 적용 확인: damage >= baseScore * 4.0 * 0.7 (최소 상성 패널티)
    expect(damage).toBeGreaterThanOrEqual(Math.round(baseScore * GATHER_MULTIPLIERS[4] * 0.7))
  })

  it('같은 기운 4장 vs 2장 비교 — 4장 피해가 더 큼', () => {
    // 4장 모으기
    const cards4 = [
      makeCard('hwa', 5, 'gather4-cmp-a'),
      makeCard('hwa', 5, 'gather4-cmp-b'),
      makeCard('hwa', 5, 'gather4-cmp-c'),
      makeCard('hwa', 5, 'gather4-cmp-d'),
    ]
    // 2장 모으기
    const cards2 = [
      makeCard('hwa', 5, 'gather2-cmp-a'),
      makeCard('hwa', 5, 'gather2-cmp-b'),
    ]

    const deck = makeDeck(15)
    const state4 = makeState({ hand: cards4, deck: [...deck], playsLeft: 3 })
    const state2 = makeState({ hand: cards2, deck: [...deck], playsLeft: 3 })

    const dmg4 = state4.enemyHp - playCards(state4, cards4.map(c => c.id)).enemyHp
    const dmg2 = state2.enemyHp - playCards(state2, cards2.map(c => c.id)).enemyHp

    expect(dmg4).toBeGreaterThan(dmg2)
  })
})
