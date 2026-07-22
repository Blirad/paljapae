// ============================================================
// [시대물 격리] 2026-07-22 (v4 정본 전환)
// 시대: v3 시대 가정 (기본모드=v3 전제)
// 대체: v4 정식 전환 (devSettings v4+강림 ON)
// 이유: LEDGER 마감된 v4 전환으로 이 가정은 무효화됨
// ============================================================
/**
 * T8: 유물 엔진 테스트 — 4종 유물 효과 수치 assert
 * 해태상 / 오색실 / 호리병 / 목탁
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  playCards,
  discardCards,
} from '../engine/paljajeonEngine'
import {
  HAETAE_COUNTER_REDUCTION,
  OSAKSHIL_YEONHWAN_BONUS,
  OHANG_YEONHWAN_MULTIPLIER,
  SANG_PENALTY_MULTIPLIER,
  HORYBYEONG_HP_THRESHOLD,
  MOKTAG_DISCARD_HEAL,
} from '../engine/balance'
import type { Card, GameState } from '../types/game'

/** 테스트용 GameState 팩토리 — 유물 주입 가능 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return {
    ...base,
    // hand를 지정하면 deck에서 제거 (중복 방지)
    ...overrides,
    deck: overrides.hand
      ? base.deck.filter(c => !(overrides.hand ?? []).some(h => h.id === c.id))
      : base.deck,
  }
}

/** 특정 기운 카드 1장 생성 */
function makeCard(element: Card['element'], value: number, id = `c-${Math.random()}`): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

/** 오행연환 5장 세트 (각 기운 1장씩) */
function makeYeonhwanHand(): Card[] {
  return [
    makeCard('mok', 4, 'yh-mok'),
    makeCard('hwa', 4, 'yh-hwa'),
    makeCard('to', 4, 'yh-to'),
    makeCard('geum', 4, 'yh-geum'),
    makeCard('su', 4, 'yh-su'),
  ]
}

// ─── 1. 해태상: 반격 피해 -3 ────────────────────────────────────────────────

describe.skip('T8-유물: 해태상 (반격 피해 -3)', () => {
  it('해태상 보유 시 반격 피해가 최대 3 감소한다 (4층 기본 반격=4 → 실감소=3)', () => {
    // 4층 counterDamage=4. 해태상 -3 → max(0, 4-3)=1. 유물 없음: -4, 유물 있음: -1 → 차이=3
    const card = makeCard('geum', 5, 'haetae-test')
    const base4F = createInitialGameState(3)  // floorIndex=3 → 4층

    const stateBase: GameState = {
      ...base4F,
      hand: [card],
      playsLeft: 6,
      relics: [],
    }
    const stateRelic: GameState = {
      ...base4F,
      hand: [card],
      playsLeft: 6,
      relics: [{ id: 'haetae', name: '해태상', description: '' }],
    }

    const resultBase = playCards(stateBase, [card.id])
    const resultWithRelic = playCards(stateRelic, [card.id])

    // 4층 counterDamage=4, 해태상(-3) → 1. 유물로 3만큼 반격 절약
    const hpDiff = resultWithRelic.playerHp - resultBase.playerHp
    expect(hpDiff).toBe(HAETAE_COUNTER_REDUCTION)
  })

  it('해태상으로 반격 피해가 0 미만이 되지 않는다', () => {
    const card = makeCard('mok', 5)
    // 1층 기본 반격=1이므로 해태상(-3) → max(0, 1-3) = 0
    const state = makeState({
      hand: [card],
      playsLeft: 4,
      relics: [{ id: 'haetae', name: '해태상', description: '' }],
    })
    const result = playCards(state, [card.id])
    // playerHp는 반격 0이므로 playerMaxHp 이하, playerHp >= 초기 HP (반격 없음)
    expect(result.playerHp).toBeGreaterThanOrEqual(state.playerHp)
  })
})

// ─── 2. 오색실: 오행연환 시 기본 피해 +15 (배율 전 가산 → 15×N 증폭) ────────

describe.skip('T8-유물: 오색실 (연환 시 기본 피해 +15, 배율 전 가산)', () => {
  it('오색실 보유 + 오행연환 발동 시 피해 기여가 15 × 연환배율 × 상성계수로 증폭된다', () => {
    const hand = makeYeonhwanHand()
    const cardIds = hand.map(c => c.id)

    // 2층(hwa 적): 연환 finishingElement=mok, SANG_MAP[mok]=hwa → 상생 패널티 ×0.5
    // 기대 기여: Math.round(15 × 8 × 0.5) = 60 (단순 +15와 다름)
    const baseState2F = createInitialGameState(1)  // floorIndex=1 → 2층
    const stateBase: GameState = { ...baseState2F, hand, playsLeft: 4, relics: [] }
    const stateRelic: GameState = {
      ...baseState2F,
      hand,
      playsLeft: 4,
      relics: [{ id: 'osakshil', name: '오색실', description: '' }],
    }

    const resultBase = playCards(stateBase, cardIds)
    const resultWithRelic = playCards(stateRelic, cardIds)

    // 2층 오행연환 damage 경로:
    //   totalScore = Math.round(baseScore × 8)
    //   → elementClash(-30%): 오행연환은 5기운 모두 포함 → 항상 발동 → × 0.7
    //   → 상생 패널티(×0.5): finishingElement=mok, 적=hwa, SANG_MAP[mok]=hwa
    //   → sub geuk(×1.25): subEl=geum, GEUK_MAP[hwa]=geum → hwa 카드 있어 발동
    //
    // 오색실 기여: (baseScore+15)×8 경로와 baseScore×8 경로의 최종 diff
    //   baseScore=20 (각 기운 4값 × 5장)
    //   without: Math.round(Math.round(Math.round(160 × 0.7) × 0.5) × 1.25)
    //          = Math.round(Math.round(112 × 0.5) × 1.25)
    //          = Math.round(56 × 1.25) = Math.round(70) = 70
    //   with:   Math.round(Math.round(Math.round(280 × 0.7) × 0.5) × 1.25)
    //          = Math.round(Math.round(196 × 0.5) × 1.25)
    //          = Math.round(98 × 1.25) = Math.round(122.5) = 123
    //   diff = 123 - 70 = 53
    //
    // 53 = 15 × 8 × 0.7 × 0.5 × 1.25 = 52.5 → Math.round → 53
    // 이는 배율 전 가산(×N 증폭)이 올바르게 작동함을 확인
    const enemyHpDiff = resultBase.enemyHp - resultWithRelic.enemyHp
    // 배율 후 +15였다면 diff = 15 × 0.7 × 0.5 × 1.25 = 6.5625 → Math.round → 7 에 불과
    // 배율 전 +15이므로 diff = 53 (×8 증폭이 반영됨)
    expect(enemyHpDiff).toBe(53)
  })

  it('오색실 보유 + 일반 조합(연환 아님)에는 효과 없음', () => {
    const card1 = makeCard('mok', 5, 'n1')
    const card2 = makeCard('mok', 5, 'n2')

    const baseState = makeState({
      hand: [card1, card2],
      playsLeft: 4,
      relics: [],
    })
    const stateWithRelic = makeState({
      hand: [card1, card2],
      playsLeft: 4,
      relics: [{ id: 'osakshil', name: '오색실', description: '' }],
    })

    const resultBase = playCards(baseState, [card1.id, card2.id])
    const resultWithRelic = playCards(stateWithRelic, [card1.id, card2.id])

    // 일반 조합에서는 동일한 피해
    expect(resultBase.enemyHp).toBe(resultWithRelic.enemyHp)
  })
})

// ─── 3. 호리병: HP 30 이하 시 콤보 배율 +1 ───────────────────────────────────

describe.skip('T8-유물: 호리병 (HP 30 이하 시 콤보 배율 +1)', () => {
  it('호리병 보유 + HP 30 이하 시 피해가 증가한다', () => {
    // 2층(hwa — heal 기믹 없음)에서 테스트. gather 2장(같은 기운) 사용
    const card1 = makeCard('hwa', 5, 'h1')
    const card2 = makeCard('hwa', 5, 'h2')
    const base2F = createInitialGameState(1)  // 2층: hwa 적, counter-boost 기믹, heal 없음

    const stateBase: GameState = {
      ...base2F,
      hand: [card1, card2],
      playsLeft: 4,
      playerHp: HORYBYEONG_HP_THRESHOLD,
      playerMaxHp: 100,
      relics: [],
    }
    const stateRelic: GameState = {
      ...base2F,
      hand: [card1, card2],
      playsLeft: 4,
      playerHp: HORYBYEONG_HP_THRESHOLD,
      playerMaxHp: 100,
      relics: [{ id: 'horybyeong', name: '호리병', description: '' }],
    }

    const resultBase = playCards(stateBase, [card1.id, card2.id])
    const resultWithRelic = playCards(stateRelic, [card1.id, card2.id])

    // 호리병: baseScore × 1 추가 → 피해 증가 → 적 HP 더 감소
    expect(resultWithRelic.enemyHp).toBeLessThan(resultBase.enemyHp)
  })

  it('HP가 31 이상이면 호리병 발동 안 됨', () => {
    const card1 = makeCard('hwa', 5, 'h3')
    const card2 = makeCard('hwa', 5, 'h4')
    const base2F = createInitialGameState(1)

    const stateBase: GameState = {
      ...base2F,
      hand: [card1, card2],
      playsLeft: 4,
      playerHp: HORYBYEONG_HP_THRESHOLD + 1,  // 임계값 초과
      playerMaxHp: 100,
      relics: [],
    }
    const stateRelic: GameState = {
      ...base2F,
      hand: [card1, card2],
      playsLeft: 4,
      playerHp: HORYBYEONG_HP_THRESHOLD + 1,
      playerMaxHp: 100,
      relics: [{ id: 'horybyeong', name: '호리병', description: '' }],
    }

    const resultBase = playCards(stateBase, [card1.id, card2.id])
    const resultWithRelic = playCards(stateRelic, [card1.id, card2.id])

    // HP 31이면 효과 없음
    expect(resultBase.enemyHp).toBe(resultWithRelic.enemyHp)
  })
})

// ─── 4. 목탁: 버리기 사용 시 HP 2 회복 ──────────────────────────────────────

describe.skip('T8-유물: 목탁 (버리기 시 HP 2 회복)', () => {
  it('목탁 보유 시 버리기 후 HP가 2 회복된다', () => {
    const card1 = makeCard('mok', 5, 'd1')
    const card2 = makeCard('hwa', 5, 'd2')
    const card3 = makeCard('to', 5, 'd3')
    const card4 = makeCard('geum', 5, 'd4')
    const card5 = makeCard('su', 5, 'd5')

    const initialHp = 50

    const baseState = makeState({
      hand: [card1, card2, card3, card4, card5],
      discardsLeft: 3,
      playerHp: initialHp,
      relics: [],
    })
    const stateWithRelic = makeState({
      hand: [card1, card2, card3, card4, card5],
      discardsLeft: 3,
      playerHp: initialHp,
      relics: [{ id: 'moktag', name: '목탁', description: '' }],
    })

    const resultBase = discardCards(baseState, [card1.id])
    const resultWithRelic = discardCards(stateWithRelic, [card1.id])

    // 목탁으로 HP 2 회복
    const hpDiff = resultWithRelic.playerHp - resultBase.playerHp
    expect(hpDiff).toBe(MOKTAG_DISCARD_HEAL)
  })

  it('목탁 HP 회복은 최대 HP를 초과하지 않는다', () => {
    const card = makeCard('mok', 5)

    const state = makeState({
      hand: [card],
      discardsLeft: 3,
      playerHp: 100,  // 최대 HP (PLAYER_BASE_HP = 100)
      playerMaxHp: 100,
      relics: [{ id: 'moktag', name: '목탁', description: '' }],
    })

    const result = discardCards(state, [card.id])
    expect(result.playerHp).toBeLessThanOrEqual(state.playerMaxHp)
  })
})
