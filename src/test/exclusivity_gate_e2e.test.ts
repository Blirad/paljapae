/**
 * exclusivity_gate_e2e.test.ts — 긴급2 (2026-07-22)
 * 융합 양자택일 배타성 gate 8종 전수 E2E.
 * 제라(Zera) Opus 재실행 — fresh 구현 (Sonnet 참고물 미사용).
 *
 * 정본(이든 2026-07-21): 융합 발동 시 attack / effect 택1.
 *   - attack 모드(effectMode=false): 공격 데미지만 지급, 특성 효과 미발동.
 *   - effect 모드(effectMode=true): 특성 효과만 발동.
 *       · 낳는 융합(fusion-birth): playCards L571 damage=0 → 딜 미발생까지 검증.
 *       · 벼리는 융합(fusion-hone): L571 범위 밖(원 로직 보존) → 효과 발동만 검증(딜=0 assert 없음).
 *
 * 오염 회귀 봉인: R5 커밋(2369662) 이후 mining/nourish/harvest/quench/purification/keen/mirror 7종은
 *   attack 모드에서도 무조건 발동(이중지급)했다. 본 스위트는 attack 모드에서 각 특성의 실제 상태
 *   변화가 "미발동"함을 assert한다. (lastTraitTriggered는 gate 이전에 세팅되므로 지표로 쓰지 않고,
 *   실제 효과 상태값만 검증한다.)
 *
 * 조합 구성: 3장 융합(촉매 2 + 연료 1, 정확히 2원소)을 사용한다.
 *   - v3/v4 공통으로 2원소·2~5장이면 isFusionCombo 성립.
 *   - v4에서 2장/5장은 접두(소/대)가 붙어 FUSION_TRAIT_MAP 조회가 실패하므로 3장으로 접두를 없앤다.
 *   - 층 2(잔화령: 반격 부스트만, heal/피해감소 기믹 없음)에서 공격 딜을 안정 확보.
 *
 * 8종 × 2방향(attack 미발동 / effect 발동) 전수:
 *   birth: wildfire(들불 mok+hwa) · mining(광맥 to+geum) · purification(샘 geum+su) · nourish(숲 su+mok)
 *   hone : keen(주물 hwa+geum) · harvest(개간 mok+to) · mirror(제방 to+su) · quench(담금질 su+hwa)
 *
 * 실행: npx vitest run src/test/exclusivity_gate_e2e.test.ts
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState, playCards } from '../engine/paljajeonEngine'
import { HAND_SIZE, PLAYER_BASE_HP } from '../engine/balance'
import type { Card, Element, GameState } from '../types/game'

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function makeCard(element: Element, value: number, id: string): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

/** 리필 시 우발적 융합을 피하는 단일 원소 채움 덱 */
function fillerDeck(count = 16, filler: Element = 'mok'): Card[] {
  return Array.from({ length: count }, (_, i) => makeCard(filler, 1, `filler-${i}`))
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return {
    ...base,
    currentFloor: 2,         // 잔화령: heal/피해감소 없음 → 딜 안정
    deck: fillerDeck(),
    playsLeft: 3,
    emberDamagePerTurn: 0,
    emberTurnsLeft: 0,
    carryoverBurn: 0,
    ...overrides,
  }
}

/** 3장 융합 카드셋(촉매 el1 ×2 + 연료 el2 ×1) — 접두 없는 이름 확보 */
function fusion3(el1: Element, el2: Element, value: number, tag: string): Card[] {
  return [
    makeCard(el1, value, `${tag}-1`),
    makeCard(el1, value, `${tag}-2`),
    makeCard(el2, value, `${tag}-3`),
  ]
}

const ids = (cards: Card[]) => cards.map(c => c.id)

// ── 1. wildfire (들불 mok+hwa, birth) ─────────────────────────────────────────

describe('1. wildfire (들불, birth)', () => {
  it('attack → 잔불(효과) 미발동 + 딜 발생', () => {
    const cards = fusion3('mok', 'hwa', 8, 'wf-a')
    const state = makeState({ hand: cards })
    const after = playCards(state, ids(cards), false)
    expect(after.enemyHp).toBeLessThan(state.enemyHp)      // 딜 발생
    expect(after.emberDamagePerTurn).toBe(0)                // 잔불 미발동
  })
  it('effect → 잔불 발동 + 딜 미발생', () => {
    const cards = fusion3('mok', 'hwa', 8, 'wf-e')
    const state = makeState({ hand: cards })
    const after = playCards(state, ids(cards), true)
    expect(after.emberDamagePerTurn).toBeGreaterThan(0)
    expect(after.enemyHp).toBe(state.enemyHp)               // 딜 미발생 (birth damage=0)
  })
})

// ── 2. mining (광맥 to+geum, birth) ───────────────────────────────────────────

describe('2. mining (광맥, birth)', () => {
  it('attack → 추가 드로우 미발동(손패=리필 기준) + 딜 발생', () => {
    const cards = fusion3('to', 'geum', 8, 'mn-a')
    const state = makeState({ hand: cards })
    const after = playCards(state, ids(cards), false)
    expect(after.enemyHp).toBeLessThan(state.enemyHp)
    expect(after.hand.length).toBe(HAND_SIZE)               // 채굴 스택 없음
  })
  it('effect → 추가 드로우 발동(손패>리필) + 딜 미발생', () => {
    const cards = fusion3('to', 'geum', 8, 'mn-e')
    const state = makeState({ hand: cards })
    const after = playCards(state, ids(cards), true)
    expect(after.hand.length).toBeGreaterThan(HAND_SIZE)
    expect(after.enemyHp).toBe(state.enemyHp)
  })
})

// ── 3. purification (샘 geum+su, birth) ───────────────────────────────────────

describe('3. purification (샘, birth)', () => {
  it('attack → 기세죽음 해제/immune 미발동 + 딜 발생', () => {
    const cards = fusion3('geum', 'su', 8, 'pf-a')
    const state = makeState({ hand: cards, purifiedElements: [], purificationImmune: false })
    const after = playCards(state, ids(cards), false)
    expect(after.enemyHp).toBeLessThan(state.enemyHp)
    expect(after.purifiedElements.length).toBe(0)           // 해제 미발동
    expect(after.purificationImmune).toBe(false)
  })
  it('effect → 정화 발동(해제 + immune)', () => {
    const cards = fusion3('geum', 'su', 8, 'pf-e')
    const state = makeState({ hand: cards, purifiedElements: [], purificationImmune: false })
    const after = playCards(state, ids(cards), true)
    expect(after.purifiedElements.length).toBeGreaterThan(0)
    expect(after.purificationImmune).toBe(true)
  })
})

// ── 4. nourish (숲 su+mok, birth) ─────────────────────────────────────────────

describe('4. nourish (숲, birth)', () => {
  it('attack → 체력 회복 미발동(HP 증가 없음) + 딜 발생', () => {
    const cards = fusion3('su', 'mok', 8, 'nr-a')
    const startHp = 50
    const state = makeState({ hand: cards, playerHp: startHp, playerMaxHp: PLAYER_BASE_HP })
    const after = playCards(state, ids(cards), false)
    expect(after.enemyHp).toBeLessThan(state.enemyHp)
    expect(after.playerHp).toBeLessThanOrEqual(startHp)     // 회복 미발동
  })
  it('effect → 체력 회복 발동(HP 증가) + 딜 미발생', () => {
    const cards = fusion3('su', 'mok', 8, 'nr-e')
    const startHp = 50
    const state = makeState({ hand: cards, playerHp: startHp, playerMaxHp: PLAYER_BASE_HP })
    const after = playCards(state, ids(cards), true)
    expect(after.playerHp).toBeGreaterThan(startHp)
    expect(after.playerHp).toBeLessThanOrEqual(PLAYER_BASE_HP)
    expect(after.enemyHp).toBe(state.enemyHp)
  })
})

// ── 5. keen (주물 hwa+geum, hone) ─────────────────────────────────────────────
// hone: L571 damage=0 범위 밖 → effect 방향은 효과 발동만 검증(딜=0 assert 생략).

describe('5. keen (주물, hone)', () => {
  it('attack → keenActive 미발동 + 딜 발생', () => {
    const cards = fusion3('hwa', 'geum', 8, 'kn-a')
    const state = makeState({ hand: cards, keenActive: false })
    const after = playCards(state, ids(cards), false)
    expect(after.enemyHp).toBeLessThan(state.enemyHp)
    expect(after.keenActive).toBe(false)                   // 미발동
  })
  it('effect → keenActive 발동', () => {
    const cards = fusion3('hwa', 'geum', 8, 'kn-e')
    const state = makeState({ hand: cards, keenActive: false })
    const after = playCards(state, ids(cards), true)
    expect(after.keenActive).toBe(true)
  })
})

// ── 6. harvest (개간 mok+to, hone) ────────────────────────────────────────────

describe('6. harvest (개간, hone)', () => {
  it('attack → 목·토 카드 값 상승 미발동 + 딜 발생', () => {
    const cards = fusion3('mok', 'to', 8, 'hv-a')
    const target = makeCard('mok', 4, 'hv-target')          // 손패 잔류 대상
    const state = makeState({ hand: [...cards, target] })
    const after = playCards(state, ids(cards), false)
    expect(after.enemyHp).toBeLessThan(state.enemyHp)
    const found = [...after.hand, ...after.deck, ...after.discardPile].find(c => c.id === 'hv-target')
    expect(found?.value).toBe(4)                            // 원값 유지 (미발동)
  })
  it('effect → 손패 목·토 카드 값 +1 발동', () => {
    const cards = fusion3('mok', 'to', 8, 'hv-e')
    // 리필 filler를 to로 → 리필된 손패 to 카드(1)가 +1(→2) 되어야 함
    const state = makeState({ hand: cards, deck: fillerDeck(16, 'to') })
    const after = playCards(state, ids(cards), true)
    const toCards = after.hand.filter(c => c.element === 'to')
    expect(toCards.length).toBeGreaterThan(0)
    expect(toCards.every(c => c.value >= 2)).toBe(true)     // +1 적용
  })
})

// ── 7. mirror (제방 to+su, hone) ──────────────────────────────────────────────

describe('7. mirror (제방, hone)', () => {
  it('attack → mirrorShieldActive 미발동 + 딜 발생', () => {
    const cards = fusion3('to', 'su', 8, 'mr-a')
    const state = makeState({ hand: cards, mirrorShieldActive: false })
    const after = playCards(state, ids(cards), false)
    expect(after.enemyHp).toBeLessThan(state.enemyHp)
    expect(after.mirrorShieldActive).toBe(false)           // 미발동
  })
  it('effect → mirrorShieldActive 발동', () => {
    const cards = fusion3('to', 'su', 8, 'mr-e')
    const state = makeState({ hand: cards, mirrorShieldActive: false })
    const after = playCards(state, ids(cards), true)
    expect(after.mirrorShieldActive).toBe(true)
  })
})

// ── 8. quench (담금질 su+hwa, hone) ───────────────────────────────────────────

describe('8. quench (담금질, hone)', () => {
  it('attack → 출수 카드 영구 값 상승 미발동 + 딜 발생', () => {
    const cards = fusion3('su', 'hwa', 8, 'qc-a')
    const state = makeState({ hand: cards })
    const after = playCards(state, ids(cards), false)
    expect(after.enemyHp).toBeLessThan(state.enemyHp)
    const all = [...after.hand, ...after.deck, ...after.discardPile]
    for (const c of cards) {
      expect(all.find(x => x.id === c.id)?.value).toBe(8)   // 원값 유지
    }
  })
  it('effect → 출수 카드 영구 값 +1 발동', () => {
    const cards = fusion3('su', 'hwa', 8, 'qc-e')
    const state = makeState({ hand: cards })
    const after = playCards(state, ids(cards), true)
    const all = [...after.hand, ...after.deck, ...after.discardPile]
    for (const c of cards) {
      expect(all.find(x => x.id === c.id)?.value).toBe(9)   // 8 → +1
    }
  })
})
