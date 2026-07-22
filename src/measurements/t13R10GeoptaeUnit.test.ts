// ============================================================
// [시대물 격리] 2026-07-22 (v4 정본 전환)
// 시대: v3 시대 가정 (기본모드=v3 전제)
// 대체: v4 정식 전환 (devSettings v4+강림 ON)
// 이유: LEDGER 마감된 v4 전환으로 이 가정은 무효화됨
// ============================================================
/**
 * T13 R10: 겁재(geoptae) v2 유닛 테스트
 * 배치 2 §1 v2: 전투 시작 시 25% 실패 판정 (advanceToNextFloor 훅)
 *  성공 → 첫 공격 stealDamage = round(enemyMaxHp*0.08) 가산
 *  실패 → playerHp -5
 *  층마다 리셋 (새 전투 시 새 RNG 판정)
 *
 * v1 동작 (목카드 포함 첫 공격 ×1.3, 런 내내 geoptaeUsed 유지) 폐기 → v2로 재작성
 *
 * 실행: npm test -- src/test/t13R10GeoptaeUnit.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { GameState, Card } from '../types/game'
import { FLOOR_CONFIGS, getFloorHp } from '../engine/balance'
import { playCards, advanceToNextFloor, nextRng } from '../engine/paljajeonEngine'

// 최소 카드 생성
function makeMokCard(id: string): Card {
  return { id, element: 'mok', polarity: 'yang', value: 5, type: 'soldier', rarity: 'common' }
}

// 겁재 v2 테스트용 최소 GameState 생성 (v2 필드 포함)
function makeGeoptaeState(overrides: Partial<GameState> = {}): GameState {
  const floorConfig = FLOOR_CONFIGS[0]  // 1층
  const mokCard = makeMokCard('mok-1')
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
    activePassiveIds: ['geoptae'],
    sikshinDiscardBonus: false,
    geoptaeUsed: false,
    // v2 필드
    rngState: 0x9E3779B9,
    geoptaeStealDamage: 0,
    sikshinRicegrains: 0,
    bigyeonCopyUsed: false,
    jeonginUsed: false,
    jeonginBuff: false,
    ...overrides,
  }
}

describe.skip('T13 R10: geoptae v2 유닛 테스트', () => {

  it('stealDamage>0 + 첫 공격: 가산 후 geoptaeUsed=true, stealDamage=0', () => {
    // v2: stealDamage가 있을 때만 첫 공격에 가산 (목카드 조건 폐기)
    const mokCard = makeMokCard('mok-test')
    const state = makeGeoptaeState({
      hand: [mokCard, ...Array.from({ length: 7 }, (_, i) => ({
        id: `e${i}`, element: 'hwa' as const, polarity: 'yin' as const,
        value: 3, type: 'soldier' as const, rarity: 'common' as const,
      }))],
      geoptaeStealDamage: 16,
      geoptaeUsed: false,
    })

    const newState = playCards(state, [mokCard.id])

    expect(newState.geoptaeUsed).toBe(true)
    expect(newState.geoptaeStealDamage).toBe(0)  // 소비됨
    expect(newState.attackCount).toBe(1)
  })

  it('두 번째 공격(geoptaeUsed=true): stealDamage 가산 없음 — damage 동일', () => {
    // v2: geoptaeUsed=true이면 stealDamage 재가산 없음
    const mokCard = makeMokCard('mok-2nd')
    const stateUsed = makeGeoptaeState({
      hand: [mokCard, ...Array.from({ length: 7 }, (_, i) => ({
        id: `e2${i}`, element: 'hwa' as const, polarity: 'yin' as const,
        value: 3, type: 'soldier' as const, rarity: 'common' as const,
      }))],
      geoptaeStealDamage: 0,  // 이미 소비됨
      geoptaeUsed: true,
      currentFloor: 2,  // 잔화령 — heal gimmick 없음
      enemyHp: 500,
      enemyMaxHp: 500,
    })
    const stateRef = makeGeoptaeState({
      hand: [makeMokCard('ref-card'), ...Array.from({ length: 7 }, (_, i) => ({
        id: `ref${i}`, element: 'hwa' as const, polarity: 'yin' as const,
        value: 3, type: 'soldier' as const, rarity: 'common' as const,
      }))],
      geoptaeStealDamage: 0,
      geoptaeUsed: false,  // 차이: 첫 공격이지만 stealDamage=0
      currentFloor: 2,
      enemyHp: 500,
      enemyMaxHp: 500,
    })

    const afterUsed = playCards(stateUsed, [mokCard.id])
    const afterRef = playCards(stateRef, ['ref-card'])
    const dmgUsed = stateUsed.enemyHp - afterUsed.enemyHp
    const dmgRef = stateRef.enemyHp - afterRef.enemyHp

    // stealDamage=0 이면 동일 damage
    expect(dmgUsed).toBe(dmgRef)
  })

  it('advanceToNextFloor: geoptaeUsed 리셋 (v2: 층마다 리셋)', () => {
    // v2: 층 전환 시 새 전투 시작 → geoptaeUsed=false 리셋 + 새 RNG 판정
    // 성공 seed 사용: value >= 0.25
    let seedSuccess: number | null = null
    let s = 1
    for (let i = 0; i < 10000; i++) {
      const r = nextRng(s)
      if (r.value >= 0.25) { seedSuccess = s; break }
      s = r.next
    }
    if (seedSuccess === null) return

    const stateFloor1Clear: GameState = {
      ...makeGeoptaeState({
        geoptaeUsed: true,  // 1층에서 사용됨
        rngState: seedSuccess,
      }),
      currentFloor: 1,
      enemyHp: 0,
      phase: 'floor-reward',
      floorsCleared: 1,
    }

    const stateFloor2 = advanceToNextFloor(stateFloor1Clear)
    const expectedHp = getFloorHp(1)  // 2층(index=1) 실제 HP (v4 모드 적용)

    // v2: 층 전환 시 geoptaeUsed 리셋 (새 전투 시작)
    expect(stateFloor2.currentFloor).toBe(2)
    expect(stateFloor2.geoptaeUsed).toBe(false)  // 리셋됨 (v2 변경)
    expect(stateFloor2.enemyHp).toBe(expectedHp)
  })

  it('advanceToNextFloor 성공: geoptaeStealDamage = round(nextEnemyMaxHp*0.08)', () => {
    // v2: 성공(value>=0.25) → stealDamage 계산
    let seedSuccess: number | null = null
    let s = 1
    for (let i = 0; i < 10000; i++) {
      const r = nextRng(s)
      if (r.value >= 0.25) { seedSuccess = s; break }
      s = r.next
    }
    if (seedSuccess === null) return

    const stateFloor1: GameState = {
      ...makeGeoptaeState({ rngState: seedSuccess }),
      currentFloor: 1,
      enemyHp: 0,
      phase: 'floor-reward',
    }

    const stateFloor2 = advanceToNextFloor(stateFloor1)
    const expectedSteal = Math.round(stateFloor2.enemyMaxHp * 0.08)
    expect(stateFloor2.geoptaeStealDamage).toBe(expectedSteal)
    expect(stateFloor2.playerHp).toBe(100)  // HP 손실 없음
  })

  it('advanceToNextFloor 실패(value<0.25): playerHp -5, stealDamage=0', () => {
    // v2: 실패 → playerHp-5, stealDamage=0
    let seedFail: number | null = null
    let s = 1
    for (let i = 0; i < 10000; i++) {
      const r = nextRng(s)
      if (r.value < 0.25) { seedFail = s; break }
      s = r.next
    }
    if (seedFail === null) return

    const stateFloor1: GameState = {
      ...makeGeoptaeState({ rngState: seedFail }),
      currentFloor: 1,
      enemyHp: 0,
      phase: 'floor-reward',
    }

    const stateFloor2 = advanceToNextFloor(stateFloor1)
    expect(stateFloor2.geoptaeStealDamage).toBe(0)
    expect(stateFloor2.playerHp).toBe(95)  // 100-5
  })

  it('geoptaeUsed 초기값 확인: 런 시작 시 false', () => {
    const state = makeGeoptaeState()
    expect(state.geoptaeUsed).toBe(false)
  })

})
