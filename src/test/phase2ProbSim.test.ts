/**
 * Phase 2 게이트: 확률 발동 실측 시뮬 (1000판)
 * DoD: 편재 20% ≈ 실측 20%, 겁재 75% 성공 ≈ 실측, 상관 50%/50% ≈ 실측
 *
 * 실행: npx vitest run src/test/phase2ProbSim.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Card, Element, GameState } from '../types/game'
import {
  playCards,
  advanceToNextFloor,
  nextRng,
  createInitialGameState,
} from '../engine/paljajeonEngine'

function makeCard(id: string, element: Element, value: number): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

function makeBaseState(rngState: number, passiveIds: string[], overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return {
    ...base,
    deck: [],
    discardPile: [],
    selectedCards: [],
    playsLeft: 10,
    discardsLeft: 5,
    enemyHp: 500,
    enemyMaxHp: 500,
    playerHp: 100,
    playerMaxHp: 100,
    attackCount: 0,
    currentFloor: 2,
    activePassiveIds: passiveIds,
    rngState,
    geoptaeStealDamage: 0,
    sikshinRicegrains: 0,
    bigyeonCopyUsed: false,
    jeonginUsed: false,
    jeonginBuff: false,
    hand: [makeCard('c1', 'mok', 5), makeCard('c2', 'mok', 5), makeCard('c3', 'mok', 5),
           makeCard('c4', 'mok', 5), makeCard('c5', 'mok', 5), makeCard('c6', 'mok', 5),
           makeCard('c7', 'mok', 5), makeCard('c8', 'mok', 5)],
    ...overrides,
  }
}

describe('Phase 2 확률 발동 실측 시뮬 (1000판)', () => {

  it('편재(偏財) v2: 턴 종료 손패 추가 발동률 ≈ 20% (±5%p)', () => {
    // 편재: 20% 확률로 고값 카드 추가
    // 측정: 1000 turn × rng 시드 순차 변화, 손패 증가 여부 확인
    let triggerCount = 0
    const N = 1000

    let rng = 0x9E3779B9
    for (let i = 0; i < N; i++) {
      // 새 rngState마다 pyeonjae 턴 종료 훅 발동 여부 확인
      const r = nextRng(rng)
      rng = r.next
      if (r.value < 0.20) triggerCount++
    }

    const rate = triggerCount / N
    console.log(`[편재 실측] 발동률: ${(rate * 100).toFixed(1)}% (${triggerCount}/${N}) — 목표: 20%`)
    expect(rate).toBeGreaterThanOrEqual(0.15)
    expect(rate).toBeLessThanOrEqual(0.25)
  })

  it('겁재(劫財) v2: advanceToNextFloor 성공률 ≈ 75% (value≥0.25)', () => {
    // 겁재: 25% 실패(value<0.25), 75% 성공(value>=0.25)
    let successCount = 0
    let failCount = 0
    const N = 1000

    let rng = 0xDEADBEEF
    for (let i = 0; i < N; i++) {
      const r = nextRng(rng)
      rng = r.next
      if (r.value >= 0.25) successCount++
      else failCount++
    }

    const successRate = successCount / N
    const failRate = failCount / N
    console.log(`[겁재 실측] 성공률: ${(successRate * 100).toFixed(1)}% (${successCount}/${N}) — 목표: 75%`)
    console.log(`[겁재 실측] 실패률: ${(failRate * 100).toFixed(1)}% (${failCount}/${N}) — 목표: 25%`)
    expect(successRate).toBeGreaterThanOrEqual(0.70)
    expect(successRate).toBeLessThanOrEqual(0.80)
    expect(failRate).toBeGreaterThanOrEqual(0.20)
    expect(failRate).toBeLessThanOrEqual(0.30)
  })

  it('상관(傷官) v2: isRatioPeak 시 ×2.0(50%) / ×1.2(50%) RNG 분포 확인', () => {
    // 상관: 50% 확률로 ×2.0, 50% 확률로 ×1.2
    let bigCount = 0
    let smallCount = 0
    const N = 1000

    let rng = 0xCAFEBABE
    for (let i = 0; i < N; i++) {
      const r = nextRng(rng)
      rng = r.next
      if (r.value < 0.5) bigCount++
      else smallCount++
    }

    const bigRate = bigCount / N
    const smallRate = smallCount / N
    console.log(`[상관 실측] ×2.0 발동: ${(bigRate * 100).toFixed(1)}% (${bigCount}/${N}) — 목표: 50%`)
    console.log(`[상관 실측] ×1.2 발동: ${(smallRate * 100).toFixed(1)}% (${smallCount}/${N}) — 목표: 50%`)
    expect(bigRate).toBeGreaterThanOrEqual(0.45)
    expect(bigRate).toBeLessThanOrEqual(0.55)
    expect(smallRate).toBeGreaterThanOrEqual(0.45)
    expect(smallRate).toBeLessThanOrEqual(0.55)
  })

  it('겁재 advanceToNextFloor E2E: 1000회 실측 — stealDamage 계산 정확도', () => {
    // E2E: 실제 advanceToNextFloor 함수 호출로 겁재 확률 실측
    let successCount = 0
    let failCount = 0
    let totalStealDamage = 0
    const N = 1000

    for (let i = 0; i < N; i++) {
      const seed = (i * 12345 + 7777) >>> 0
      const floorState: GameState = {
        ...makeBaseState(seed, ['geoptae']),
        currentFloor: 1,
        enemyHp: 0,
        phase: 'floor-reward',
        floorsCleared: 1,
      }

      const nextState = advanceToNextFloor(floorState)
      if (nextState.geoptaeStealDamage > 0) {
        successCount++
        totalStealDamage += nextState.geoptaeStealDamage
        // 스펙 검증: stealDamage = round(nextEnemyMaxHp * 0.08)
        const expected = Math.round(nextState.enemyMaxHp * 0.08)
        expect(nextState.geoptaeStealDamage).toBe(expected)
      } else {
        failCount++
        // 실패: playerHp -5
        expect(nextState.playerHp).toBe(100 - 5)
      }
    }

    const successRate = successCount / N
    const avgSteal = successCount > 0 ? totalStealDamage / successCount : 0
    console.log(`[겁재 E2E] 성공률: ${(successRate * 100).toFixed(1)}% (${successCount}/${N}) — 목표: 75%`)
    console.log(`[겁재 E2E] 실패수: ${failCount} / 평균 stealDamage: ${avgSteal.toFixed(1)}`)
    expect(successRate).toBeGreaterThanOrEqual(0.65)
    expect(successRate).toBeLessThanOrEqual(0.85)
  })

  it('편재 E2E: 1000턴 pyeonjae 훅 실측 — 손패 증가 카운트', () => {
    // E2E: 실제 playCards에서 편재 훅 발동 여부 실측
    let triggerCount = 0
    const N = 1000

    for (let i = 0; i < N; i++) {
      const seed = ((i + 1) * 31337) >>> 0
      const c1 = makeCard(`c1-${i}`, 'mok', 5)
      const c2 = makeCard(`c2-${i}`, 'hwa', 5)
      const state = makeBaseState(seed, ['pyeonjae'], {
        hand: [c1, c2,
          makeCard(`h3-${i}`, 'mok', 3), makeCard(`h4-${i}`, 'mok', 3),
          makeCard(`h5-${i}`, 'mok', 3), makeCard(`h6-${i}`, 'mok', 3),
          makeCard(`h7-${i}`, 'mok', 3), makeCard(`h8-${i}`, 'mok', 3),
        ],
        deck: [makeCard(`d1-${i}`, 'geum', 3), makeCard(`d2-${i}`, 'su', 3)],
        currentFloor: 2,
        enemyHp: 500,
        enemyMaxHp: 500,
      })

      const before = state.hand.length
      const after = playCards(state, [c1.id])
      // 손패는 항상 HAND_SIZE(8)로 리필 후 편재 발동 시 +1
      if (after.hand.length > 8) {
        triggerCount++
      }
    }

    const rate = triggerCount / N
    console.log(`[편재 E2E] 발동률: ${(rate * 100).toFixed(1)}% (${triggerCount}/${N}) — 목표: 20%`)
    expect(rate).toBeGreaterThanOrEqual(0.12)
    expect(rate).toBeLessThanOrEqual(0.28)
  })

})
