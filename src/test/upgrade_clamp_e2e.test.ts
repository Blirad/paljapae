/**
 * upgrade_clamp_e2e.test.ts — 긴급1 (2026-07-22)
 * 층 보상 upgrade-card value 상한 15 clamp E2E.
 * 제라(Zera) Opus 재실행 — fresh 구현.
 *
 * 정본: 전 카드 공통 상한 value ≤ 15.
 *   applyRewardOption('upgrade-card') → Math.min(15, round(value × (1 + bonusPct/100)))
 *
 * 봉인 대상: 신금 여왕 10→15→23 오염 (QUEEN23 감사 2026-07-21).
 *   upgrade-card 2회 연속 → round(round(10×1.5)×1.5)=round(22.5)=23. 상한 없으면 무한 누적.
 *
 * 실행: npx vitest run src/test/upgrade_clamp_e2e.test.ts
 */

import { describe, it, expect } from 'vitest'
import { applyRewardOption, MAX_CARD_VALUE, type RewardOption } from '../engine/paljajeonEngine'
import type { Card } from '../types/game'

function makeCard(id: string, value: number, royalType?: 'king' | 'queen'): Card {
  return { id, element: 'mok', polarity: 'yang', value, type: 'soldier', rarity: 'common', royalType }
}

function upgrade(targetId: string, bonusPct = 50): RewardOption {
  return { type: 'upgrade-card', targetId, bonusPct }
}

describe('긴급1 — upgrade-card value 상한 15 clamp', () => {
  it('MAX_CARD_VALUE 상수 == 15', () => {
    expect(MAX_CARD_VALUE).toBe(15)
  })

  it('value 15 카드 upgrade → 15 유지 (상한 초과 없음)', () => {
    const deck = [makeCard('c1', 15)]
    const after = applyRewardOption(deck, upgrade('c1'))
    expect(after[0].value).toBe(15)
  })

  it('value 10 → 1회 upgrade → 15 (round(10×1.5)=15)', () => {
    const deck = [makeCard('c1', 10)]
    const after = applyRewardOption(deck, upgrade('c1'))
    expect(after[0].value).toBe(15)
  })

  it('value 10 → 2회 연속 upgrade → 15 유지 (23 오염 봉인)', () => {
    let deck = [makeCard('c1', 10)]
    deck = applyRewardOption(deck, upgrade('c1'))            // → 15
    expect(deck[0].value).toBe(15)
    deck = applyRewardOption(deck, upgrade('c1'))            // round(15×1.5)=23 → clamp 15
    expect(deck[0].value).toBe(15)
    expect(deck[0].value).not.toBe(23)
  })

  it('value 8 → 1회 upgrade → 12 (상한 미만 정상 상승, clamp 왜곡 없음)', () => {
    const deck = [makeCard('c1', 8)]
    const after = applyRewardOption(deck, upgrade('c1'))     // round(8×1.5)=12
    expect(after[0].value).toBe(12)
  })

  it('value 8 → 2회 연속 upgrade → 12 → 15 (2회차 clamp)', () => {
    let deck = [makeCard('c1', 8)]
    deck = applyRewardOption(deck, upgrade('c1'))            // 12
    expect(deck[0].value).toBe(12)
    deck = applyRewardOption(deck, upgrade('c1'))            // round(18)=18 → clamp 15
    expect(deck[0].value).toBe(15)
  })

  it('큰 계산 결과도 정확히 15로 절단 (value 14 × 1.5 = 21 → 15)', () => {
    const deck = [makeCard('c1', 14)]
    const after = applyRewardOption(deck, upgrade('c1'))
    expect(after[0].value).toBe(15)
  })

  it('queen 카드 value 10 → 2회 upgrade → 15, royalType 스프레드 무결', () => {
    let deck = [makeCard('queen-geum', 10, 'queen')]
    deck = applyRewardOption(deck, upgrade('queen-geum'))
    deck = applyRewardOption(deck, upgrade('queen-geum'))
    expect(deck[0].value).toBe(15)
    expect(deck[0].royalType).toBe('queen')
  })

  it('다중 덱에서 대상 카드만 clamp 적용, 나머지 무변경', () => {
    const deck = [makeCard('a', 10), makeCard('b', 6), makeCard('c', 15)]
    const after = applyRewardOption(deck, upgrade('a'))
    expect(after.find(c => c.id === 'a')!.value).toBe(15)    // clamp
    expect(after.find(c => c.id === 'b')!.value).toBe(6)     // 무변경
    expect(after.find(c => c.id === 'c')!.value).toBe(15)    // 무변경
  })

  it('임의 초기값·5회 반복에도 결과 value는 절대 15 초과 안 함 (fuzz)', () => {
    for (const start of [2, 5, 8, 10, 11, 14, 15]) {
      let deck = [makeCard('c1', start)]
      for (let i = 0; i < 5; i++) {
        deck = applyRewardOption(deck, upgrade('c1'))
        expect(deck[0].value).toBeLessThanOrEqual(MAX_CARD_VALUE)
      }
    }
  })
})
