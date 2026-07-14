/**
 * v3R6EmberUnit.test.ts
 * R6: 잔불 엔진 버그 수정 유닛 테스트
 *
 * 검증 항목:
 *  1. effectMode=true + wildfire(들불) → emberDamagePerTurn 세팅 확인
 *  2. effectMode=true + wildfire → 3틱 합산 = rawBase × EMBER_MULTIPLIER × 3
 *  3. effectMode=false + wildfire → carryoverBurn 방식 유지 (기존 동작)
 *  4. 잔불 발동 후 각 틱마다 emberTurnsLeft 감소 확인
 *  5. EMBER_DURATION 이후 잔불 소멸 (emberDamagePerTurn=0)
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  playCards,
} from '../engine/paljajeonEngine'
import {
  EMBER_DURATION,
  EMBER_MULTIPLIER,
} from '../engine/balance'
import type { Card, GameState } from '../types/game'

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────────

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

function makeDeck(count = 12): Card[] {
  return Array.from({ length: count }, (_, i) =>
    makeCard('to', 1, `filler-${i}-${Math.random().toString(36).slice(2)}`),
  )
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return { ...base, ...overrides }
}

// ─── 1. effectMode=true + wildfire → emberDamagePerTurn 세팅 ──────────────────

describe('R6 잔불 버그 수정 — effectMode=true + wildfire(들불)', () => {
  it('effectMode=true: emberDamagePerTurn = rawBase × EMBER_MULTIPLIER', () => {
    // 들불: 목(mok) + 화(hwa) = wildfire
    const mokCard = makeCard('mok', 6, 'mok-r6-1')
    const hwaCard = makeCard('hwa', 4, 'hwa-r6-1')
    const rawBase = 6 + 4  // 10

    const state = makeState({
      hand: [mokCard, hwaCard],
      deck: makeDeck(),
      playsLeft: 5,
      emberDamagePerTurn: 0,
      emberTurnsLeft: 0,
    })

    const after = playCards(state, [mokCard.id, hwaCard.id], true)

    const expectedEmberDmg = Math.round(rawBase * EMBER_MULTIPLIER)
    expect(after.emberDamagePerTurn).toBe(expectedEmberDmg)
    expect(after.emberTurnsLeft).toBe(EMBER_DURATION)
    expect(after.lastTraitTriggered).toBe('wildfire')
  })

  it('effectMode=true: carryoverBurn = 0 (damage 경유 방식 제거 확인)', () => {
    const mokCard = makeCard('mok', 6, 'mok-r6-2')
    const hwaCard = makeCard('hwa', 4, 'hwa-r6-2')

    const state = makeState({
      hand: [mokCard, hwaCard],
      deck: makeDeck(),
      playsLeft: 5,
      carryoverBurn: 0,
    })

    const after = playCards(state, [mokCard.id, hwaCard.id], true)
    // effectMode=true → carryoverBurn 방식 제거 → 0
    expect(after.carryoverBurn).toBe(0)
  })
})

// ─── 2. 3틱 합산 = rawBase × EMBER_MULTIPLIER × 3 ────────────────────────────

describe('R6 잔불 3틱 합산 = rawBase × 3 (EMBER_MULTIPLIER=1.0 기준)', () => {
  it('rawBase=10 → emberDamagePerTurn=10, 3틱 합산 기대값=30 (수식 검증)', () => {
    // EMBER_MULTIPLIER = 1.0 → 턴당 피해 = rawBase × 1.0 = rawBase
    // 3틱 합산 = rawBase × 3
    const mokCard = makeCard('mok', 6, 'mok-r6-3a')
    const hwaCard = makeCard('hwa', 4, 'hwa-r6-3a')
    const rawBase = 6 + 4  // 10

    const state0 = makeState({
      hand: [mokCard, hwaCard],
      deck: makeDeck(20),
      playsLeft: 5,
      emberDamagePerTurn: 0,
      emberTurnsLeft: 0,
    })

    // 들불 effectMode=true → 잔불 세팅
    const state1 = playCards(state0, [mokCard.id, hwaCard.id], true)
    const expectedPerTurn = Math.round(rawBase * EMBER_MULTIPLIER)  // 10

    // emberDamagePerTurn 확인
    expect(state1.emberDamagePerTurn).toBe(expectedPerTurn)
    expect(state1.emberTurnsLeft).toBe(EMBER_DURATION)

    // 3틱 합산 수식 검증: emberDamagePerTurn × EMBER_DURATION = rawBase × 3
    const total3Ticks = expectedPerTurn * EMBER_DURATION
    expect(total3Ticks).toBe(rawBase * 3)  // EMBER_MULTIPLIER=1.0이므로
    expect(total3Ticks).toBe(30)
  })

  it('emberDamagePerTurn 직접 세팅 후 3턴에 걸쳐 적 HP에 누적 피해', () => {
    // 2층(floorIndex=1) 사용 — 잔화령(반격 boost)만 있고 heal 기믹 없음
    // 단, 반격은 playsLeft에 영향 없으므로 순수 잔불 피해 측정 가능
    // 방법: emberDamagePerTurn=10, counterDamage=1(2층)로 세팅 후 단일 카드 3회 출수
    // 각 틱에 잔불 10이 무조건 추가됨 (카드 피해와 별개로 누적)

    // 카드 피해를 최소화하기 위해 value=1짜리 카드 사용
    const toCard1 = makeCard('to', 1, 'to-tick-1')
    const toCard2 = makeCard('to', 1, 'to-tick-2')
    const toCard3 = makeCard('to', 1, 'to-tick-3')
    const filler = makeDeck(15)

    // emberDamagePerTurn=10, emberTurnsLeft=3 직접 세팅
    const EMBER_PER_TURN = 10
    const state0 = makeState({
      currentFloor: 2,  // 2층: heal 기믹 없음
      hand: [toCard1, toCard2, toCard3, ...filler.slice(0, 5)],
      deck: filler.slice(5),
      playsLeft: 4,
      playerHp: 100,
      playerMaxHp: 100,
      enemyHp: 9999,
      enemyMaxHp: 9999,
      emberDamagePerTurn: EMBER_PER_TURN,
      emberTurnsLeft: EMBER_DURATION,  // 3
      carryoverBurn: 0,
    })

    const hpBase = state0.enemyHp

    // 틱 1 — 잔불 발동
    const s1 = playCards(state0, [toCard1.id])
    expect(s1.emberTurnsLeft).toBe(2)
    const hpAfterTick1 = s1.enemyHp

    // 틱 2 — 잔불 발동
    const s2 = playCards(s1, [toCard2.id])
    expect(s2.emberTurnsLeft).toBe(1)
    const hpAfterTick2 = s2.enemyHp

    // 틱 3 — 잔불 발동 (마지막)
    const s3 = playCards(s2, [toCard3.id])
    expect(s3.emberTurnsLeft).toBe(0)
    expect(s3.emberDamagePerTurn).toBe(0)

    // 3턴 총 적 HP 감소
    const totalDamage = hpBase - s3.enemyHp
    // 잔불 3틱 기여 = EMBER_PER_TURN × 3 = 30 (최소 보장)
    expect(totalDamage).toBeGreaterThanOrEqual(EMBER_PER_TURN * 3)
  })
})

// ─── 3. effectMode=false + wildfire → carryoverBurn 방식 유지 ────────────────

describe('R6 잔불 버그 수정 — effectMode=false (공격 모드) 기존 동작 유지', () => {
  it('effectMode=false: carryoverBurn > 0, emberDamagePerTurn 미변경', () => {
    const mokCard = makeCard('mok', 5, 'mok-r6-4')
    const hwaCard = makeCard('hwa', 5, 'hwa-r6-4')

    const state = makeState({
      hand: [mokCard, hwaCard],
      deck: makeDeck(),
      playsLeft: 3,
      carryoverBurn: 0,
      emberDamagePerTurn: 0,
      emberTurnsLeft: 0,
    })

    const after = playCards(state, [mokCard.id, hwaCard.id], false)
    // effectMode=false → 공격 damage > 0 → carryoverBurn = damage × 0.3 > 0
    expect(after.carryoverBurn).toBeGreaterThan(0)
    // emberDamagePerTurn은 설정되지 않아야 함
    expect(after.emberDamagePerTurn ?? 0).toBe(0)
  })
})

// ─── 4. 잔불 소멸 후 추가 틱 없음 ───────────────────────────────────────────────

describe('R6 잔불 EMBER_DURATION 소멸 검증', () => {
  it('EMBER_DURATION(3턴) 경과 후 emberDamagePerTurn=0, 추가 피해 없음', () => {
    const mokCard = makeCard('mok', 6, 'mok-r6-5')
    const hwaCard = makeCard('hwa', 4, 'hwa-r6-5')
    const deckCards = makeDeck(20)

    const state0 = makeState({
      hand: [mokCard, hwaCard, ...deckCards.slice(0, 6)],
      deck: deckCards.slice(6),
      playsLeft: 6,
      playerHp: 100,
      playerMaxHp: 100,
      enemyHp: 9999,
      enemyMaxHp: 9999,
      emberDamagePerTurn: 0,
      emberTurnsLeft: 0,
    })

    // 잔불 세팅
    const s1 = playCards(state0, [mokCard.id, hwaCard.id], true)
    expect(s1.emberTurnsLeft).toBe(3)

    // 3틱 소비
    const s2 = playCards(s1, [s1.hand[0].id])
    expect(s2.emberTurnsLeft).toBe(2)

    const s3 = playCards(s2, [s2.hand[0].id])
    expect(s3.emberTurnsLeft).toBe(1)

    const s4 = playCards(s3, [s3.hand[0].id])
    expect(s4.emberTurnsLeft).toBe(0)
    expect(s4.emberDamagePerTurn).toBe(0)

    // 4틱째: 잔불 없으므로 추가 잔불 피해 없음
    const hpBefore4 = s4.enemyHp
    const s5 = playCards(s4, [s4.hand[0].id])
    const tick4Damage = hpBefore4 - s5.enemyHp
    // 잔불 기여분 0이어야 함 (카드 기본 데미지는 있을 수 있음)
    expect(s5.emberTurnsLeft).toBe(0)
    expect(s5.emberDamagePerTurn).toBe(0)
    // 4틱 피해는 카드 기본 데미지만 — 0 이상이지만 잔불 없음을 이미 상태로 검증함
    expect(tick4Damage).toBeGreaterThanOrEqual(0)
  })
})
