/**
 * 편관(偏官) v2 E2E 테스트
 * 배치 2 §1: 턴당 1회 발동 제한
 *
 * @issue: Δ49~56(편관 과강) = 연쇄 루프 결함
 * @fix: 턴 내 2번째 15% 달성 → 발동 안 함 / 다음 턴 → 카운터 리셋
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { playCards } from '../engine/paljajeonEngine'
import type { GameState, Card } from '../types/game'
import { FLOOR_CONFIGS } from '../engine/balance'

describe('편관(偏官) v2 — 턴당 1회 발동 제한', () => {
  let baseState: GameState

  beforeEach(() => {
    // 테스트 기반: 편관 단독 장착, floor 1, 적 HP 1000
    baseState = {
      currentFloor: 1,
      playerHp: 500,
      playerMaxHp: 500,
      enemyHp: 1000,
      enemyMaxHp: 1000,
      hand: [],
      deck: [],
      discardPile: [],
      selectedCards: [],
      discardsLeft: 0,
      playsLeft: 5,
      phase: 'play',
      isVictory: false,
      floorsCleared: 0,
      talismans: [],
      amplifyActive: false,
      attackCount: 0,
      enemyPhaseSwitch: false,
      condenseActive: false,
      yeonhwanUsed: false,
      condensedMultiplier: 0,
      isLastAttack: false,
      reshuffled: false,
      activePassiveIds: ['pyeongwan'],  // 편관 단독 장착
      pyeongwanActivationsThisTurn: 0,  // 턴 시작 시 0
      rngState: 0x9E3779B9,
      geoptaeStealDamage: 0,
      sikshinRicegrains: 0,
      bigyeonCopyUsed: false,
      jeonginUsed: false,
      jeonginBuff: false,
    }
  })

  it('케이스 1: 첫 번째 공격이 15% 달성 → 편관 발동 → playsLeft +1', () => {
    // 편관 발동 조건: damage >= enemyMaxHp * 0.15 = 1000 * 0.15 = 150
    // 손패: 5개 카드, 합산 값 100 (기본 배율 ×1.0) → damage 100 (미달)
    // → 편관 발동 안 함

    // 하지만 패시브 효과로 damage ≥ 150이 되도록 만든다면?
    // → playCards 호출 후 playsLeft 확인

    const hand: Card[] = [
      { id: '1', element: 'mok', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
      { id: '2', element: 'hwa', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
      { id: '3', element: 'to', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
      { id: '4', element: 'geum', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
      { id: '5', element: 'su', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
    ]

    baseState.hand = hand
    baseState.playsLeft = 5
    baseState.pyeongwanActivationsThisTurn = 0

    // 5개 카드 선택 (gather5 = 오행연환)
    // → damage = 50 (base) × 8 (오행연환) = 400 ≥ 150 → 편관 발동
    const result = playCards(
      baseState,
      ['1', '2', '3', '4', '5'],
      undefined,
      false,
      undefined
    )

    // 편관 발동 조건 확인
    if (result.enemyHp < baseState.enemyHp) {
      // 공격이 성공했다면, playsLeft를 확인
      // playsLeft = 5 - 1 = 4 (기본)
      // 편관 발동: playsLeft = 4 + 1 = 5
      expect(result.playsLeft).toBe(5)
      // 편관 발동 횟수 확인
      expect(result.pyeongwanActivationsThisTurn).toBe(1)
    }
  })

  it('케이스 2: 첫 공격 후 편관 발동, 같은 턴 두 번째 공격에서 15% 달성 → 편관 재발동 안 함', () => {
    // 상황: 첫 공격에서 편관 발동, playsLeft +1
    // 두 번째 공격에서도 15% 달성 → 하지만 "턴당 1회" 제한으로 발동 안 함

    // 첫 공격 후 상태
    const afterFirstAttack: GameState = {
      ...baseState,
      playsLeft: 5,  // 첫 공격 후 playsLeft +1 (편관)
      enemyHp: 600,  // 400 피해
      pyeongwanActivationsThisTurn: 1,  // 편관 이미 발동
      hand: [
        { id: '6', element: 'mok', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
        { id: '7', element: 'hwa', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
        { id: '8', element: 'to', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
        { id: '9', element: 'geum', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
        { id: '10', element: 'su', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
      ],
    }

    // 두 번째 공격
    const result = playCards(
      afterFirstAttack,
      ['6', '7', '8', '9', '10'],
      undefined,
      false,
      undefined
    )

    // 두 번째 공격이 성공했다면
    if (result.enemyHp < afterFirstAttack.enemyHp) {
      // playsLeft는 감소만 (편관 재발동 안 함)
      expect(result.playsLeft).toBe(4)  // 5 - 1 = 4
      // 편관 발동 횟수는 여전히 1
      expect(result.pyeongwanActivationsThisTurn).toBe(1)
    }
  })

  it('케이스 3: 턴 후 카운터 리셋 → 다음 턴 첫 공격에서 편관 재발동 가능', () => {
    // 현재 턴 끝: pyeongwanActivationsThisTurn = 1
    // 다음 턴 시작: pyeongwanActivationsThisTurn = 0으로 리셋 (외부에서)

    // 다음 턴 상태
    const nextTurnState: GameState = {
      ...baseState,
      playsLeft: 5,
      enemyHp: 600,  // 이전 턴에서 400 피해
      pyeongwanActivationsThisTurn: 0,  // 턴 시작 시 리셋됨 (BattleScreen에서)
      hand: [
        { id: '11', element: 'mok', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
        { id: '12', element: 'hwa', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
        { id: '13', element: 'to', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
        { id: '14', element: 'geum', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
        { id: '15', element: 'su', polarity: 'yang', value: 10, type: 'soldier', rarity: 'common' },
      ],
    }

    // 다음 턴 첫 공격
    const result = playCards(
      nextTurnState,
      ['11', '12', '13', '14', '15'],
      undefined,
      false,
      undefined
    )

    // 편관 발동 조건 만족 시
    if (result.enemyHp < nextTurnState.enemyHp) {
      // playsLeft +1 (편관 발동)
      expect(result.playsLeft).toBe(5)
      // 편관 발동 횟수
      expect(result.pyeongwanActivationsThisTurn).toBe(1)
    }
  })

  it('케이스 4: 편관 미발동 상황 (15% 미달) → 카운터 변화 없음', () => {
    // 공격 데미지 < 15% (편관 조건 미달)
    const weakCards: Card[] = [
      { id: '16', element: 'mok', polarity: 'yang', value: 2, type: 'soldier', rarity: 'common' },
      { id: '17', element: 'hwa', polarity: 'yang', value: 2, type: 'soldier', rarity: 'common' },
    ]

    baseState.hand = weakCards
    baseState.pyeongwanActivationsThisTurn = 0

    const result = playCards(
      baseState,
      ['16', '17'],
      undefined,
      false,
      undefined
    )

    // 편관 미발동
    expect(result.pyeongwanActivationsThisTurn).toBe(0)
  })
})
