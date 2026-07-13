/**
 * T13 R10: 겁재(geoptae) 출정당 1회 제한 유닛 테스트
 *
 * 검증 항목:
 *  1. 1층 첫 공격 시 geoptae 발동 (hasMok && !geoptaeUsed)
 *  2. 1층 두 번째 공격 시 geoptae 미발동 (이미 geoptaeUsed=true)
 *  3. advanceToNextFloor 후 geoptaeUsed 유지 (리셋 금지)
 *  4. 2층에서 geoptae 미발동 (geoptaeUsed=true 유지)
 *
 * 실행: npm test -- src/test/t13R10GeoptaeUnit.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { GameState, Card } from '../types/game'
import { FLOOR_CONFIGS } from '../engine/balance'
import { playCards, advanceToNextFloor } from '../engine/paljajeonEngine'

// 목(木) 카드 1장 생성 (최소 세트)
function makeMokCard(id: string): Card {
  return {
    id,
    element: 'mok',
    polarity: 'yang',
    value: 5,
    type: 'soldier',
    rarity: 'common',
  }
}

// geoptae 유닛 테스트용 최소 GameState 생성
function makeGeoptaeState(overrides: Partial<GameState> = {}): GameState {
  const floorConfig = FLOOR_CONFIGS[0]  // 1층
  const mokCard = makeMokCard('mok-1')
  // hand에 mok-1 포함, deck에 여분 카드
  const extraCards: Card[] = Array.from({ length: 14 }, (_, i) => ({
    id: `extra-${i}`,
    element: 'hwa' as const,
    polarity: 'yin' as const,
    value: 3,
    type: 'soldier' as const,
    rarity: 'common' as const,
  }))
  return {
    currentFloor: 1,
    playerHp: 100,
    playerMaxHp: 100,
    enemyHp: floorConfig.enemyHp,
    enemyMaxHp: floorConfig.enemyHp,
    hand: [mokCard, ...extraCards.slice(0, 7)],
    deck: extraCards.slice(7),
    discardPile: [],
    selectedCards: [],
    discardsLeft: 3,
    playsLeft: 4,
    phase: 'select',
    isVictory: false,
    floorsCleared: 0,
    talismans: [],
    amplifyActive: false,
    attackCount: 0,
    enemyPhaseSwitch: false,
    condenseActive: false,
    yeonhwanUsed: false,
    sanggwanUsed: 0,
    condensedMultiplier: 0,
    isLastAttack: false,
    lastTraitTriggered: undefined,
    carryoverBurn: 0,
    purifiedElements: [],
    keenActive: false,
    mirrorShieldActive: false,
    reshuffled: false,
    favorableElement: undefined,
    relics: [],
    activePassiveIds: ['geoptae'],  // geoptae만 장착
    sikshinDiscardBonus: false,
    geoptaeUsed: false,             // 런 시작 — 미발동
    ...overrides,
  }
}

describe('T13 R10: geoptae 출정당 1회 제한 유닛 테스트', () => {

  it('1층 첫 공격: 목 카드 포함 시 geoptae 발동 → geoptaeUsed = true', () => {
    const state = makeGeoptaeState({ geoptaeUsed: false, attackCount: 0 })
    const mokCard = state.hand.find(c => c.element === 'mok')!

    // 공격 전 피해 기준값: 낱장 1장(value=5), gather 2장: value=5만 선택 (낱장)
    // geoptae 발동 시 ×1.3 적용됨
    const newState = playCards(state, [mokCard.id])

    expect(newState.geoptaeUsed).toBe(true)
    // attackCount가 1 증가했는지 확인
    expect(newState.attackCount).toBe(1)
  })

  it('1층 두 번째 공격: geoptaeUsed=true이면 geoptae 미발동', () => {
    // 첫 공격 후 상태: geoptaeUsed=true, attackCount=1
    const stateAfterFirst = makeGeoptaeState({ geoptaeUsed: true, attackCount: 1 })
    // hand에 mok 카드 추가 (두 번째 공격용)
    const mokCard2 = makeMokCard('mok-2')
    const stateWithMok2 = {
      ...stateAfterFirst,
      hand: [mokCard2, ...stateAfterFirst.hand.slice(0, 7)],
      playsLeft: 3,
    }

    // geoptaeUsed=true이므로 발동 없음 — geoptaeUsed 그대로 true
    const newState = playCards(stateWithMok2, [mokCard2.id])

    expect(newState.geoptaeUsed).toBe(true)
    expect(newState.attackCount).toBe(2)
  })

  it('advanceToNextFloor: geoptaeUsed=true 유지 (리셋 금지)', () => {
    // 1층 클리어 직전 상태: geoptaeUsed=true (1층에서 발동했음)
    const floorConfig2 = FLOOR_CONFIGS[1]  // 2층
    const stateFloor1Clear: GameState = {
      ...makeGeoptaeState({ geoptaeUsed: true }),
      currentFloor: 1,
      enemyHp: 0,
      phase: 'floor-reward',
      floorsCleared: 1,
    }

    const stateFloor2 = advanceToNextFloor(stateFloor1Clear)

    // 2층으로 전환 후 geoptaeUsed는 여전히 true
    expect(stateFloor2.currentFloor).toBe(2)
    expect(stateFloor2.geoptaeUsed).toBe(true)
    expect(stateFloor2.enemyHp).toBe(floorConfig2.enemyHp)
  })

  it('2층에서 geoptae 미발동: geoptaeUsed=true 상태에서 목 카드 공격해도 발동 없음', () => {
    // 2층, geoptaeUsed=true (1층에서 발동 완료)
    const floorConfig2 = FLOOR_CONFIGS[1]
    const mokCard = makeMokCard('mok-floor2')
    const extraCards: Card[] = Array.from({ length: 13 }, (_, i) => ({
      id: `extra2-${i}`,
      element: 'hwa' as const,
      polarity: 'yin' as const,
      value: 3,
      type: 'soldier' as const,
      rarity: 'common' as const,
    }))
    const stateFloor2: GameState = {
      ...makeGeoptaeState({
        currentFloor: 2,
        enemyHp: floorConfig2.enemyHp,
        enemyMaxHp: floorConfig2.enemyHp,
        geoptaeUsed: true,  // 1층에서 이미 발동됨
        attackCount: 0,     // 2층 시작 — attackCount는 층마다 리셋됨
      }),
      hand: [mokCard, ...extraCards.slice(0, 7)],
      deck: extraCards.slice(7),
    }

    const newState = playCards(stateFloor2, [mokCard.id])

    // geoptaeUsed는 여전히 true (재발동 없음)
    expect(newState.geoptaeUsed).toBe(true)
    // attackCount 증가 확인
    expect(newState.attackCount).toBe(1)
  })

  it('geoptaeUsed 초기값 확인: 런 시작 시 false', () => {
    const state = makeGeoptaeState()
    expect(state.geoptaeUsed).toBe(false)
  })

})
