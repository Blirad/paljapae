/**
 * sikshin D안 유닛 테스트
 * 버리기(discard) 1회 사용 시 다음 공격 +15% (1회 소모, 스택 불가 갱신 가능)
 *
 * 실행: npm test -- src/test/sikshinDAnTest.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Card, Element, GameState } from '../types/game'
import { playCards, discardCards, createInitialGameState } from '../engine/paljajeonEngine'

function makeCard(id: string, element: Element, value: number): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

function makeBaseState(hand: Card[], passiveIds: string[]): GameState {
  const base = createInitialGameState(0)
  return {
    ...base,
    deck: hand.map((c, i) => makeCard(`deck-${i}`, 'hwa', 5)),
    discardPile: [],
    selectedCards: [],
    playsLeft: 10,
    discardsLeft: 5,
    enemyHp: 500,
    enemyMaxHp: 500,
    playerHp: 100,
    playerMaxHp: 100,
    attackCount: 0,
    currentFloor: 2,  // 2층: 잔화령(hwa), 반격만 있음
    activePassiveIds: passiveIds,
    hand,
    sikshinDiscardBonus: false,
  }
}

describe('sikshin D안 — 버리기 후 다음 공격 +15%', () => {

  it('케이스 1: sikshin 장착 + 버리기 후 다음 공격 x1.15 적용', () => {
    // 준비: sikshin 장착, discard 1회, 이후 공격
    const attackCard = makeCard('a1', 'hwa', 10)
    const discardTargetCard = makeCard('d1', 'mok', 3)

    // 기준선: sikshin 장착이지만 버리기 없이 바로 공격
    const stateNoDiscard = makeBaseState([attackCard, discardTargetCard], ['sikshin'])
    const afterNoDiscard = playCards(stateNoDiscard, ['a1'])
    const dmgNoDiscard = stateNoDiscard.enemyHp - afterNoDiscard.enemyHp

    // 버리기 후 공격: sikshinDiscardBonus = true → 공격 시 x1.15
    const stateBeforeDiscard = makeBaseState([attackCard, discardTargetCard], ['sikshin'])
    const stateAfterDiscard = discardCards(stateBeforeDiscard, ['d1'])
    expect(stateAfterDiscard.sikshinDiscardBonus).toBe(true)
    const stateAfterAttack = playCards(stateAfterDiscard, ['a1'])
    const dmgWithDiscard = stateBeforeDiscard.enemyHp - stateAfterAttack.enemyHp

    // 버리기 후 공격이 더 커야 하고, x1.15 배율이어야 함
    expect(dmgWithDiscard).toBeGreaterThan(dmgNoDiscard)
    expect(dmgWithDiscard).toBe(Math.round(dmgNoDiscard * 1.15))
  })

  it('케이스 2: 버리기 후 첫 공격에서 소멸 — 그 다음 공격은 +15% 미적용', () => {
    const attackCard1 = makeCard('a1', 'hwa', 10)
    const attackCard2 = makeCard('a2', 'hwa', 10)
    const discardTarget = makeCard('d1', 'mok', 3)

    const state0 = makeBaseState([attackCard1, attackCard2, discardTarget], ['sikshin'])

    // 버리기 실행 → sikshinDiscardBonus = true
    const state1 = discardCards(state0, ['d1'])
    expect(state1.sikshinDiscardBonus).toBe(true)

    // 첫 공격 → 보너스 적용 후 false로 리셋
    const state2 = playCards(state1, ['a1'])
    expect(state2.sikshinDiscardBonus).toBe(false)

    // 두 번째 공격 기준선 (버리기 없이)
    const stateBase = makeBaseState([attackCard1, attackCard2], ['sikshin'])
    const afterBase = playCards(stateBase, ['a2'])
    const dmgBase = stateBase.enemyHp - afterBase.enemyHp

    // 두 번째 공격 (보너스 소멸 후)
    const dmg2nd = state1.enemyHp - state2.enemyHp - (state2.enemyHp - playCards(state2, ['a2']).enemyHp)
    // 직접 비교: state2에서 a2 공격
    const state3 = playCards(state2, ['a2'])
    const dmg2ndActual = state2.enemyHp - state3.enemyHp

    // 두 번째 공격은 보너스 없음 = 기준선과 동일
    expect(dmg2ndActual).toBe(dmgBase)
    // void dmg2nd warning suppression
    void dmg2nd
  })

  it('케이스 3: 버리기 2회 연속 → 다음 공격은 x1.15만 (중첩 없음)', () => {
    const attackCard = makeCard('a1', 'hwa', 10)
    const d1 = makeCard('d1', 'mok', 3)
    const d2 = makeCard('d2', 'mok', 3)

    const state0 = makeBaseState([attackCard, d1, d2], ['sikshin'])

    // 첫 번째 버리기 → sikshinDiscardBonus = true
    const state1 = discardCards(state0, ['d1'])
    expect(state1.sikshinDiscardBonus).toBe(true)

    // 두 번째 버리기 → 여전히 true (갱신, 중첩 아님)
    const state2 = discardCards(state1, ['d2'])
    expect(state2.sikshinDiscardBonus).toBe(true)

    // 기준선: 버리기 없이 공격
    const stateBase = makeBaseState([attackCard], ['sikshin'])
    const afterBase = playCards(stateBase, ['a1'])
    const dmgBase = stateBase.enemyHp - afterBase.enemyHp

    // 버리기 2회 후 공격
    const state3 = playCards(state2, ['a1'])
    const dmgAfter2Discard = state2.enemyHp - state3.enemyHp

    // x1.15만 적용 (x1.30 아님)
    expect(dmgAfter2Discard).toBe(Math.round(dmgBase * 1.15))
    expect(state3.sikshinDiscardBonus).toBe(false)
  })

})
