/**
 * W1 Fatigue 단위 테스트
 * 확정 규칙: 덱 소진 후 N번째 턴에 N 피해
 * W1/M0 결정문 §1-3
 *
 * 핵심 검증: HP30 기준 턴15 치사 여부
 */

import { describe, it, expect } from 'vitest'
import {
  calculateFatigueDamage,
  advanceFatigue,
  createInitialFatigue,
  calculateTotalFatigueDamage,
  findFatigueFatalTurn,
} from '@/game/engine/fatigue'
import type { FatigueState } from '@/types/game'
import { HERO_MAX_HP } from '@/types/game'

describe('createInitialFatigue() — 초기 상태', () => {
  it('덱 소진 플래그 false', () => {
    const f = createInitialFatigue()
    expect(f.deckExhausted).toBe(false)
  })
  it('소진 턴 카운터 0', () => {
    const f = createInitialFatigue()
    expect(f.exhaustedTurnsCount).toBe(0)
  })
})

describe('calculateFatigueDamage() — 피해량 계산', () => {
  it('덱이 소진되지 않으면 0 피해', () => {
    const f = createInitialFatigue()
    expect(calculateFatigueDamage(f)).toBe(0)
  })
  it('소진 후 1번째 턴 → 1 피해', () => {
    const f: FatigueState = { deckExhausted: true, exhaustedTurnsCount: 1 }
    expect(calculateFatigueDamage(f)).toBe(1)
  })
  it('소진 후 2번째 턴 → 2 피해', () => {
    const f: FatigueState = { deckExhausted: true, exhaustedTurnsCount: 2 }
    expect(calculateFatigueDamage(f)).toBe(2)
  })
  it('소진 후 7번째 턴 → 7 피해', () => {
    const f: FatigueState = { deckExhausted: true, exhaustedTurnsCount: 7 }
    expect(calculateFatigueDamage(f)).toBe(7)
  })
  it('소진 후 8번째 턴 → 8 피해', () => {
    const f: FatigueState = { deckExhausted: true, exhaustedTurnsCount: 8 }
    expect(calculateFatigueDamage(f)).toBe(8)
  })
})

describe('advanceFatigue() — 상태 전이', () => {
  it('덱에 카드가 있으면 Fatigue 없음', () => {
    const f = createInitialFatigue()
    const result = advanceFatigue(f, 5)
    expect(result.deckExhausted).toBe(false)
    expect(result.exhaustedTurnsCount).toBe(0)
  })
  it('덱이 비어있으면 소진 상태 전환 + 카운터 1 증가', () => {
    const f = createInitialFatigue()
    const result = advanceFatigue(f, 0)
    expect(result.deckExhausted).toBe(true)
    expect(result.exhaustedTurnsCount).toBe(1)
  })
  it('이미 소진 상태에서 덱 계속 0이면 카운터 누적', () => {
    let f: FatigueState = { deckExhausted: true, exhaustedTurnsCount: 3 }
    f = advanceFatigue(f, 0)
    expect(f.exhaustedTurnsCount).toBe(4)
    f = advanceFatigue(f, 0)
    expect(f.exhaustedTurnsCount).toBe(5)
  })
})

describe('calculateTotalFatigueDamage() — 누적 피해 시뮬레이션', () => {
  // 덱 소진 시점 턴 7 기준 (결정문 §1-3)
  const FATIGUE_START = 7

  it('소진 턴 이전(또는 동일)이면 피해 0', () => {
    expect(calculateTotalFatigueDamage(FATIGUE_START, 7)).toBe(0)
    expect(calculateTotalFatigueDamage(FATIGUE_START, 6)).toBe(0)
  })
  it('소진 후 1턴(게임 턴 8): 누적 1', () => {
    expect(calculateTotalFatigueDamage(FATIGUE_START, 8)).toBe(1)
  })
  it('소진 후 2턴(게임 턴 9): 누적 1+2=3', () => {
    expect(calculateTotalFatigueDamage(FATIGUE_START, 9)).toBe(3)
  })
  it('소진 후 3턴(게임 턴 10): 누적 1+2+3=6', () => {
    expect(calculateTotalFatigueDamage(FATIGUE_START, 10)).toBe(6)
  })
  it('소진 후 4턴(게임 턴 11): 누적 10', () => {
    expect(calculateTotalFatigueDamage(FATIGUE_START, 11)).toBe(10)
  })
  it('소진 후 5턴(게임 턴 12): 누적 15', () => {
    expect(calculateTotalFatigueDamage(FATIGUE_START, 12)).toBe(15)
  })
  it('소진 후 6턴(게임 턴 13): 누적 21', () => {
    expect(calculateTotalFatigueDamage(FATIGUE_START, 13)).toBe(21)
  })
  it('소진 후 7턴(게임 턴 14): 누적 28', () => {
    expect(calculateTotalFatigueDamage(FATIGUE_START, 14)).toBe(28)
  })
  it('소진 후 8턴(게임 턴 15): 누적 36 (HP30 초과 → 사망)', () => {
    const totalDamage = calculateTotalFatigueDamage(FATIGUE_START, 15)
    expect(totalDamage).toBe(36)
    expect(totalDamage).toBeGreaterThan(HERO_MAX_HP)
  })
})

describe('findFatigueFatalTurn() — 치사 턴 계산 (핵심 검증: HP30 기준 턴15)', () => {
  it('HP30, 소진 턴7 → 치사 턴 15', () => {
    const fatalTurn = findFatigueFatalTurn(HERO_MAX_HP, 7)
    expect(fatalTurn).toBe(15)
  })

  it('HP30, 소진 턴7: 턴15에서 누적 피해 36 >= 30 — 사망 조건 충족', () => {
    // 수치 직접 검증
    const totalAt15 = calculateTotalFatigueDamage(7, 15)
    expect(totalAt15).toBeGreaterThanOrEqual(HERO_MAX_HP)
  })

  it('HP30, 소진 턴7: 턴14에서 누적 피해 28 < 30 — 아직 생존', () => {
    const totalAt14 = calculateTotalFatigueDamage(7, 14)
    expect(totalAt14).toBeLessThan(HERO_MAX_HP)
  })

  it('HP30, 소진 턴7: 최대 게임 턴 15와 정확히 일치', () => {
    const fatalTurn = findFatigueFatalTurn(HERO_MAX_HP, 7)
    const MAX_TURNS = 15
    expect(fatalTurn).toBe(MAX_TURNS)
  })

  it('HP1 이면 소진 후 1번째 턴에 치사', () => {
    const fatalTurn = findFatigueFatalTurn(1, 7)
    expect(fatalTurn).toBe(8)
  })

  it('HP6 이면 소진 후 3번째 턴에 치사 (1+2+3=6)', () => {
    const fatalTurn = findFatigueFatalTurn(6, 7)
    expect(fatalTurn).toBe(10)
  })
})

describe('Fatigue 전체 시뮬레이션 — 결정문 §1-3 표 재현', () => {
  /**
   * 결정문 §1-3 표:
   * 소진 후 턴 | 피해 | 누적피해 | 잔여HP
   *     1       1       1        29
   *     2       2       3        27
   *     3       3       6        24
   *     4       4      10        20
   *     5       5      15        15
   *     6       6      21         9
   *     7       7      28         2
   *     8       8      36    -6 → 사망
   */
  const FATIGUE_START = 7
  const startHp = HERO_MAX_HP // 30

  const expected = [
    { turn: 8,  damage: 1, accumulated: 1,  hp: 29 },
    { turn: 9,  damage: 2, accumulated: 3,  hp: 27 },
    { turn: 10, damage: 3, accumulated: 6,  hp: 24 },
    { turn: 11, damage: 4, accumulated: 10, hp: 20 },
    { turn: 12, damage: 5, accumulated: 15, hp: 15 },
    { turn: 13, damage: 6, accumulated: 21, hp: 9  },
    { turn: 14, damage: 7, accumulated: 28, hp: 2  },
    { turn: 15, damage: 8, accumulated: 36, hp: -6 },
  ]

  expected.forEach(({ turn, accumulated, hp }) => {
    it(`턴 ${turn}: 누적 피해 ${accumulated}, 잔여HP ${hp > 0 ? hp : '사망'}`, () => {
      const total = calculateTotalFatigueDamage(FATIGUE_START, turn)
      expect(total).toBe(accumulated)
      expect(startHp - total).toBe(hp)
    })
  })
})
