/**
 * 오행 상성 계산 단위 테스트
 * 마스터플랜 §6-2
 */

import { describe, it, expect } from 'vitest'
import {
  isDominating,
  isDefenderGeneratingAttacker,
  getCombatModifier,
  calculateDamage,
} from '@/game/engine/elementalCombat'
import type { FiveElement } from '@/types/elements'

describe('오행 상성 — 상극 관계 isDominating()', () => {
  it('木 → 土 상극 (木克土)', () => {
    expect(isDominating('木', '土')).toBe(true)
  })
  it('土 → 水 상극 (土克水)', () => {
    expect(isDominating('土', '水')).toBe(true)
  })
  it('水 → 火 상극 (水克火)', () => {
    expect(isDominating('水', '火')).toBe(true)
  })
  it('火 → 金 상극 (火克金)', () => {
    expect(isDominating('火', '金')).toBe(true)
  })
  it('金 → 木 상극 (金克木)', () => {
    expect(isDominating('金', '木')).toBe(true)
  })

  it('火 → 土 는 상극 아님', () => {
    expect(isDominating('火', '土')).toBe(false)
  })
  it('木 → 水 는 상극 아님', () => {
    expect(isDominating('木', '水')).toBe(false)
  })
  it('동일 오행은 상극 아님', () => {
    expect(isDominating('火', '火')).toBe(false)
  })
})

describe('오행 상성 — 상생 방어 isDefenderGeneratingAttacker()', () => {
  // 상생: 木→火→土→金→水→木
  // 방어자 木이 공격자 火를 상생 → 피해 감소
  it('木 방어자 vs 火 공격자 — 상생 방어 (木生火)', () => {
    expect(isDefenderGeneratingAttacker('火', '木')).toBe(true)
  })
  it('火 방어자 vs 土 공격자 — 상생 방어 (火生土)', () => {
    expect(isDefenderGeneratingAttacker('土', '火')).toBe(true)
  })
  it('土 방어자 vs 金 공격자 — 상생 방어 (土生金)', () => {
    expect(isDefenderGeneratingAttacker('金', '土')).toBe(true)
  })
  it('金 방어자 vs 水 공격자 — 상생 방어 (金生水)', () => {
    expect(isDefenderGeneratingAttacker('水', '金')).toBe(true)
  })
  it('水 방어자 vs 木 공격자 — 상생 방어 (水生木)', () => {
    expect(isDefenderGeneratingAttacker('木', '水')).toBe(true)
  })

  it('火 방어자 vs 木 공격자 — 상생 방어 아님', () => {
    expect(isDefenderGeneratingAttacker('木', '火')).toBe(false)
  })
})

describe('getCombatModifier() — 복합 판별', () => {
  it('상극 → dominate', () => {
    expect(getCombatModifier('木', '土')).toBe('dominate')
    expect(getCombatModifier('火', '金')).toBe('dominate')
  })
  it('상생 방어 → generate_defense', () => {
    expect(getCombatModifier('火', '木')).toBe('generate_defense')
    expect(getCombatModifier('金', '土')).toBe('generate_defense')
  })
  it('중립 관계 → neutral', () => {
    expect(getCombatModifier('火', '土')).toBe('neutral')
    expect(getCombatModifier('水', '水')).toBe('neutral')
  })
  it('null 오행 (중립 카드) → neutral', () => {
    expect(getCombatModifier(null, '火')).toBe('neutral')
    expect(getCombatModifier('木', null)).toBe('neutral')
    expect(getCombatModifier(null, null)).toBe('neutral')
  })
})

describe('calculateDamage() — 실제 피해량 계산', () => {
  it('상극 공격: 기본 3 → 1.5배 = 4.5 → 반올림 5 (마스터플랜 §6-2 예시)', () => {
    // 火(공격력 3) → 金(체력 4): 3 × 1.5 = 4.5 → 반올림 5
    expect(calculateDamage(3, '火', '金')).toBe(5)
  })
  it('상극 공격: 기본 2 → 1.5배 = 3 (마스터플랜 §6-2 예시)', () => {
    // 水(공격력 2) → 火: 2 × 1.5 = 3
    expect(calculateDamage(2, '水', '火')).toBe(3)
  })
  it('상생 방어: 기본 4 → 0.75배 = 3 (반올림)', () => {
    // 火 공격자 → 木 방어자 (木이 火를 생성): 4 × 0.75 = 3
    expect(calculateDamage(4, '火', '木')).toBe(3)
  })
  it('상생 방어: 기본 2 → 0.75배 = 1.5 → 반올림 2', () => {
    expect(calculateDamage(2, '火', '木')).toBe(2)
  })
  it('상생 방어: 기본 1 → 0.75배 = 0.75 → 반올림 1', () => {
    expect(calculateDamage(1, '木', '水')).toBe(1)
  })
  it('중립: 피해량 변화 없음', () => {
    expect(calculateDamage(5, '火', '土')).toBe(5)
    expect(calculateDamage(3, null, null)).toBe(3)
  })
  it('기본 공격력 0 → 상극이어도 0', () => {
    expect(calculateDamage(0, '木', '土')).toBe(0)
  })
})

describe('calculateDamage() — 다양한 오행 쌍 검증', () => {
  const dominatePairs: [FiveElement, FiveElement][] = [
    ['木', '土'],
    ['土', '水'],
    ['水', '火'],
    ['火', '金'],
    ['金', '木'],
  ]

  dominatePairs.forEach(([atk, def]) => {
    it(`상극 ${atk}→${def}: 기본 2 → 3`, () => {
      expect(calculateDamage(2, atk, def)).toBe(3)
    })
  })
})
