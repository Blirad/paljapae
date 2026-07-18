/**
 * 식신(食神) v2 유닛 테스트 — 밥알(ricegrains) 기반
 * 배치 2 §1 v2 효과: 버리기 시 밥알 +버린장수 누적, 융합 시 5밥알 소비 ×1.3
 *
 * v1 D안(sikshinDiscardBonus: 버리기 후 공격 +15%) 폐기 → v2로 재작성
 *
 * 실행: npm test -- src/test/sikshinDAnTest.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Card, Element, GameState } from '../types/game'
import { playCards, discardCards, createInitialGameState } from '../engine/paljajeonEngine'

function makeCard(id: string, element: Element, value: number): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

function makeBaseState(hand: Card[], passiveIds: string[], overrides?: Partial<GameState>): GameState {
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
    currentFloor: 2,  // 2층: 잔화령(hwa), heal gimmick 없음
    activePassiveIds: passiveIds,
    sikshinRicegrains: 0,
    rngState: 0x9E3779B9,
    geoptaeStealDamage: 0,
    bigyeonCopyUsed: false,
    jeonginUsed: false,
    jeonginBuff: false,
    hand,
    ...overrides,
  }
}

describe('식신(食神) v2 — 밥알 누적 + 융합 소비', () => {

  it('케이스 1: 버리기 후 sikshinRicegrains += 버린 장수', () => {
    // v2: discardCards 시 밥알 증가
    const attackCard = makeCard('a1', 'mok', 10)
    const discardCard1 = makeCard('d1', 'hwa', 3)
    const discardCard2 = makeCard('d2', 'hwa', 3)

    const state = makeBaseState([attackCard, discardCard1, discardCard2], ['sikshin'])
    const afterDiscard = discardCards(state, ['d1', 'd2'])

    // 2장 버림 → ricegrains += 2
    expect(afterDiscard.sikshinRicegrains).toBe(2)
    // v1 D안 필드는 항상 false (v2에서 하위 호환 유지)
    expect(afterDiscard.sikshinDiscardBonus).toBe(false)
  })

  it('케이스 2: 밥알 ≥5 + 융합 시 ×1.3, 밥알 -5', () => {
    // v2: ricegrains≥5 + 융합(2장 이상) → ×1.3 후 ricegrains-=5
    const c1 = makeCard('c1', 'mok', 5)
    const c2 = makeCard('c2', 'hwa', 5)

    // 기준선: sikshin 없고 ricegrains=5
    const stateBase = makeBaseState(
      [makeCard('b1', 'mok', 5), makeCard('b2', 'hwa', 5)],
      [],
      { sikshinRicegrains: 5 },
    )
    const afterBase = playCards(stateBase, ['b1', 'b2'])
    const dmgBase = stateBase.enemyHp - afterBase.enemyHp

    // 식신 장착 + ricegrains=5 + 융합
    const stateWith = makeBaseState([c1, c2], ['sikshin'], { sikshinRicegrains: 5 })
    const afterWith = playCards(stateWith, ['c1', 'c2'])
    const dmgWith = stateWith.enemyHp - afterWith.enemyHp

    // ×1.3 적용 → damage 더 큼
    expect(dmgWith).toBeGreaterThan(dmgBase)
    expect(dmgWith).toBe(Math.round(dmgBase * 1.3))
    // 밥알 5 소비 → 0
    expect(afterWith.sikshinRicegrains).toBe(0)
  })

  it('케이스 3: 밥알 <5 + 융합 시 식신 미발동 (×1.3 없음)', () => {
    // v2: ricegrains<5 → 발동 안 함
    const c1 = makeCard('c1', 'mok', 5)
    const c2 = makeCard('c2', 'hwa', 5)

    const stateWith = makeBaseState([c1, c2], ['sikshin'], { sikshinRicegrains: 4 })
    const stateNo = makeBaseState(
      [makeCard('n1', 'mok', 5), makeCard('n2', 'hwa', 5)],
      [],
      { sikshinRicegrains: 4 },
    )

    const afterWith = playCards(stateWith, ['c1', 'c2'])
    const afterNo = playCards(stateNo, ['n1', 'n2'])
    const dmgWith = stateWith.enemyHp - afterWith.enemyHp
    const dmgNo = stateNo.enemyHp - afterNo.enemyHp

    // 밥알 4개 → 미발동 → 동일 damage
    expect(dmgWith).toBe(dmgNo)
    // 밥알은 변화 없음 (버리기 없음)
    expect(afterWith.sikshinRicegrains).toBe(4)
  })

})
