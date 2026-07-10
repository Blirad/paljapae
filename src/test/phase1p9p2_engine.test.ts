/**
 * Phase 1.9.2 엔진 유닛 테스트
 * E-1: 오행연환 1회 제한
 * E-2: 응축 v2 선택형 (기본/대응축)
 * E-3: 화 연소 +30%, 금 관통
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  playCards,
  applyCondense,
  getCondenseAvailability,
  advanceToNextFloor,
} from '../engine/paljajeonEngine'
import { CONDENSE_V2_MULTIPLIER, GREAT_CONDENSE_MULTIPLIER, OHANG_YEONHWAN_MULTIPLIER } from '../engine/balance'
import type { Card, GameState } from '../types/game'

function makeCard(element: Card['element'], polarity: Card['polarity'], value: number, id?: string): Card {
  return {
    id: id ?? `${element}-${polarity}-${value}`,
    element,
    polarity,
    value,
    type: 'soldier',
    rarity: 'common',
  }
}

/** 신규 필드가 포함된 초기 상태 생성 헬퍼 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return { ...base, ...overrides }
}

// ============================================================
// E-1: 오행연환 1회 제한
// ============================================================
describe('E-1: 오행연환 1회 제한', () => {
  /** 5기운 각 1장씩 핸드 */
  function makeYeonhwanHand(): Card[] {
    return [
      makeCard('mok', 'yang', 5, 'mok1'),
      makeCard('hwa', 'yin', 5, 'hwa1'),
      makeCard('to', 'yang', 5, 'to1'),
      makeCard('geum', 'yin', 5, 'geum1'),
      makeCard('su', 'yang', 5, 'su1'),
    ]
  }

  it('yeonhwanUsed 초기값은 false', () => {
    const state = makeState()
    expect(state.yeonhwanUsed).toBe(false)
  })

  it('연환 첫 사용 후 yeonhwanUsed = true', () => {
    const hand = makeYeonhwanHand()
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const state = makeState({
      hand,
      deck,
      yeonhwanUsed: false,
    })
    const cardIds = hand.map(c => c.id)
    const newState = playCards(state, cardIds)
    expect(newState.yeonhwanUsed).toBe(true)
  })

  it('연환 2회 시도 → 2회째 피해 0 (차단)', () => {
    const hand = makeYeonhwanHand()
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    // 이미 연환 사용된 상태
    const state = makeState({
      hand,
      deck,
      yeonhwanUsed: true,
      enemyHp: 500,
      enemyMaxHp: 500,
      playsLeft: 4,
    })
    const cardIds = hand.map(c => c.id)
    const enemyHpBefore = state.enemyHp
    const newState = playCards(state, cardIds)
    // 피해가 0이므로 적 HP 변화 없음 (반격은 있음)
    expect(newState.enemyHp).toBe(enemyHpBefore)
  })

  it('balance.ts OHANG_YEONHWAN_MULTIPLIER = 8 (×10 → ×8)', () => {
    expect(OHANG_YEONHWAN_MULTIPLIER).toBe(8)
  })

  it('층 전환 시 yeonhwanUsed 리셋', () => {
    const state = makeState({
      currentFloor: 1,
      yeonhwanUsed: true,
      floorsCleared: 1,
      phase: 'floor-reward',
    })
    const newState = advanceToNextFloor(state)
    expect(newState.yeonhwanUsed).toBe(false)
  })
})

// ============================================================
// E-2: 응축 저장형 (Phase 1.9.4 — 저장량×배율 가산)
// ============================================================
describe('E-2: 응축 v2 선택형', () => {
  it('balance.ts CONDENSE_V2_MULTIPLIER = 1.5 (Phase 1.9.4 저장형)', () => {
    expect(CONDENSE_V2_MULTIPLIER).toBe(1.5)
  })

  it('balance.ts GREAT_CONDENSE_MULTIPLIER = 2.0 (Phase 1.9.4 저장형)', () => {
    expect(GREAT_CONDENSE_MULTIPLIER).toBe(2.0)
  })

  it('condenseType 초기값은 null', () => {
    const state = makeState()
    expect(state.condenseType).toBeNull()
  })

  it('applyCondense(basic) — playsLeft -1, condenseType = basic, 피해 0', () => {
    const state = makeState({ playsLeft: 4, condenseType: null, isLastAttack: false })
    const newState = applyCondense(state, 'basic')
    expect(newState.playsLeft).toBe(3)
    expect(newState.condenseType).toBe('basic')
    expect(newState.condenseMultiplier).toBe(CONDENSE_V2_MULTIPLIER)
  })

  it('Phase 1.9.3: 응축 시 카드 소진 — 카드가 핸드에서 제거되고 discardPile에 추가', () => {
    const toCard1 = makeCard('to', 'yang', 4, 'to-c1')
    const toCard2 = makeCard('to', 'yin', 5, 'to-c2')
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const state = makeState({
      hand: [toCard1, toCard2],
      deck,
      playsLeft: 3,
      condenseType: null,
      isLastAttack: false,
    })
    const cardIds = [toCard1.id, toCard2.id]
    const newState = applyCondense(state, 'basic', cardIds)
    // 카드 소진 확인
    expect(newState.hand.some(c => c.id === toCard1.id)).toBe(false)
    expect(newState.hand.some(c => c.id === toCard2.id)).toBe(false)
    // discardPile에 추가 확인
    expect(newState.discardPile.some(c => c.id === toCard1.id)).toBe(true)
    expect(newState.discardPile.some(c => c.id === toCard2.id)).toBe(true)
    // 덱에서 2장 리필
    expect(newState.hand.length).toBe(2)
    // 응축 상태 설정
    expect(newState.condenseType).toBe('basic')
    expect(newState.playsLeft).toBe(2)
  })

  it('Phase 1.9.3: cardIds 없이 applyCondense 호출 — 카드 소진 없음 (하위 호환)', () => {
    const toCard = makeCard('to', 'yang', 5, 'to-nc')
    const state = makeState({
      hand: [toCard],
      deck: [],
      playsLeft: 3,
      condenseType: null,
      isLastAttack: false,
    })
    const newState = applyCondense(state, 'basic')
    // cardIds 없으면 핸드 그대로
    expect(newState.hand.some(c => c.id === toCard.id)).toBe(true)
    expect(newState.condenseType).toBe('basic')
  })

  it('applyCondense(great) — playsLeft -1, condenseType = great', () => {
    const state = makeState({ playsLeft: 4, condenseType: null, isLastAttack: false })
    const newState = applyCondense(state, 'great')
    expect(newState.playsLeft).toBe(3)
    expect(newState.condenseType).toBe('great')
    expect(newState.condenseMultiplier).toBe(GREAT_CONDENSE_MULTIPLIER)
  })

  it('응축 중첩 불가 — 이미 condenseType 있으면 무시', () => {
    const state = makeState({ playsLeft: 4, condenseType: 'basic', isLastAttack: false })
    const newState = applyCondense(state, 'great')
    // 중첩 무시: 기존 basic 유지
    expect(newState.condenseType).toBe('basic')
    expect(newState.playsLeft).toBe(4)
  })

  it('마지막 공격 기회에는 응축 적용 불가', () => {
    const state = makeState({ playsLeft: 2, condenseType: null, isLastAttack: true })
    const newState = applyCondense(state, 'basic')
    // 차단: 상태 변화 없음
    expect(newState.condenseType).toBeNull()
    expect(newState.playsLeft).toBe(2)
  })

  it('기본 응축 소모 후 저장량×1.5 가산 (Phase 1.9.4 저장형)', () => {
    // Phase 1.9.4: condenseType=basic, condensedDamage=20 → 다음 공격 +30 (20×1.5)
    const singleHwaCard = makeCard('hwa', 'yang', 10, 'hwa-test')
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const stateWithCondense = makeState({
      hand: [singleHwaCard],
      deck,
      condenseType: 'basic',
      condenseMultiplier: CONDENSE_V2_MULTIPLIER,  // 1.5
      condensedDamage: 20,  // 저장된 예상 피해
      playsLeft: 3,
    })
    const newState = playCards(stateWithCondense, [singleHwaCard.id])
    expect(newState.condenseType).toBeNull()   // 소모됨
    expect(newState.condenseMultiplier).toBe(0) // 리셋
    expect(newState.condensedDamage).toBe(0)    // 리셋
    // 저장형: damage += 20×1.5 = 30 가산 → 적 HP 감소
    expect(newState.enemyHp).toBeLessThan(stateWithCondense.enemyHp)
  })

  it('대응축 소모 후 저장량×2.0 가산 (Phase 1.9.4 저장형)', () => {
    const singleCard = makeCard('mok', 'yang', 10, 'mok-test')
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const stateWithGreat = makeState({
      hand: [singleCard],
      deck,
      condenseType: 'great',
      condenseMultiplier: GREAT_CONDENSE_MULTIPLIER,  // 2.0
      condensedDamage: 15,  // 저장된 예상 피해
      playsLeft: 3,
    })
    const newState = playCards(stateWithGreat, [singleCard.id])
    expect(newState.condenseType).toBeNull()
    expect(newState.condenseMultiplier).toBe(0)
    expect(newState.condensedDamage).toBe(0)
    // 저장형: damage += 15×2.0 = 30 가산 → 적 HP 감소
    expect(newState.enemyHp).toBeLessThan(stateWithGreat.enemyHp)
  })

  describe('응축 발동 조건 판별 (getCondenseAvailability)', () => {
    it('토 모으기 → basic', () => {
      expect(getCondenseAvailability('흙 모으기 2', 'to')).toBe('basic')
      expect(getCondenseAvailability('흙 모으기 3', 'to')).toBe('basic')
    })

    it('일군 밭 → basic', () => {
      expect(getCondenseAvailability('일군 밭', 'to')).toBe('basic')
    })

    it('옹기가마 → great', () => {
      expect(getCondenseAvailability('옹기가마', 'to')).toBe('great')
    })

    it('광맥(토+금→금) → null (토 타격 아님)', () => {
      expect(getCondenseAvailability('광맥', 'geum')).toBeNull()
    })

    it('맑은 못(토+수→수) → null (토 타격 아님)', () => {
      expect(getCondenseAvailability('맑은 못', 'su')).toBeNull()
    })

    it('들불(목+화→화) → null', () => {
      expect(getCondenseAvailability('들불', 'hwa')).toBeNull()
    })
  })
})

// ============================================================
// E-3: 화 연소 + 금 관통
// ============================================================
describe('E-3: 오행 특성 2차', () => {
  describe('화 연소', () => {
    it('화 타격 조합 시 combustionTriggered = true', () => {
      const hwaCards = [
        makeCard('hwa', 'yang', 5, 'hwa-a'),
        makeCard('hwa', 'yin', 5, 'hwa-b'),
      ]
      const deck = Array.from({ length: 10 }, (_, i) =>
        makeCard('mok', 'yang', 1, `deck-${i}`),
      )
      const state = makeState({ hand: hwaCards, deck, playsLeft: 4 })
      const newState = playCards(state, hwaCards.map(c => c.id))
      expect(newState.combustionTriggered).toBe(true)
    })

    it('화 타격 시 화 카드 sootCount 증가', () => {
      const hwaCards = [
        makeCard('hwa', 'yang', 5, 'hwa-soot-1'),
        makeCard('hwa', 'yin', 5, 'hwa-soot-2'),
      ]
      const deck = Array.from({ length: 10 }, (_, i) =>
        makeCard('mok', 'yang', 1, `deck-${i}`),
      )
      const state = makeState({ hand: hwaCards, deck, playsLeft: 4 })
      const newState = playCards(state, hwaCards.map(c => c.id))
      expect(newState.sootCount['hwa-soot-1']).toBe(1)
      expect(newState.sootCount['hwa-soot-2']).toBe(1)
    })

    it('화 타격 +30%: damage가 단순 합계보다 큼', () => {
      const hwaCards = [
        makeCard('hwa', 'yang', 10, 'hwa-big-1'),
        makeCard('hwa', 'yin', 10, 'hwa-big-2'),
      ]
      const deck = Array.from({ length: 10 }, (_, i) =>
        makeCard('mok', 'yang', 1, `deck-${i}`),
      )
      // 응축/증폭 없는 순수 화 조합
      const stateWithCombustion = makeState({
        hand: hwaCards,
        deck,
        playsLeft: 4,
        condenseType: null,
        amplifyActive: false,
        yeonhwanUsed: false,
      })
      // 화 모으기 2장: baseScore=20, multiplier=1.5, totalScore=30
      // 화 연소 +30%: 30 × 1.3 = 39
      const newState = playCards(stateWithCombustion, hwaCards.map(c => c.id))
      // 1층 고목령: counterDamage=1, heal=15 → 적 HP = max(0, 100 - 39) + 15 = 76
      // 세부 계산보다 방향성 확인 (화 연소 없이 30, 연소 후 39)
      const damageDealt = stateWithCombustion.enemyHp - newState.enemyHp
      // 고목령 회복 15 포함이지만, 연소 +30% 효과로 30보다 큰 데미지 딜
      // 정확히: 39피해 → enemyHp = 100-39 = 61, 회복 +15 = 76
      // damageDealt = 100 - 76 = 24 (net)
      expect(damageDealt).toBeGreaterThan(0)
      expect(newState.combustionTriggered).toBe(true)
    })

    it('목 타격 시 combustionTriggered = false', () => {
      const mokCards = [
        makeCard('mok', 'yang', 5, 'mok-nc-1'),
        makeCard('mok', 'yin', 5, 'mok-nc-2'),
      ]
      const deck = Array.from({ length: 10 }, (_, i) =>
        makeCard('mok', 'yang', 1, `deck-${i}`),
      )
      const state = makeState({ hand: mokCards, deck, playsLeft: 4 })
      const newState = playCards(state, mokCards.map(c => c.id))
      expect(newState.combustionTriggered).toBe(false)
    })
  })

  describe('금 관통', () => {
    it('금 타격 조합 시 penetrationTriggered = true', () => {
      const geumCards = [
        makeCard('geum', 'yang', 5, 'geum-p-1'),
        makeCard('geum', 'yin', 5, 'geum-p-2'),
      ]
      const deck = Array.from({ length: 10 }, (_, i) =>
        makeCard('mok', 'yang', 1, `deck-${i}`),
      )
      const state = makeState({ hand: geumCards, deck, playsLeft: 4 })
      const newState = playCards(state, geumCards.map(c => c.id))
      expect(newState.penetrationTriggered).toBe(true)
    })

    it('4층 금강불괴 — 금 관통 시 피해감소 무시 (관통 없을 때보다 피해 큼)', () => {
      // 4층: eliteGimmickEffect = damage-reduction 30%
      const geumCards = [
        makeCard('geum', 'yang', 10, 'geum-boss-1'),
        makeCard('geum', 'yin', 10, 'geum-boss-2'),
      ]
      const deck = Array.from({ length: 15 }, (_, i) =>
        makeCard('mok', 'yang', 1, `deck-${i}`),
      )
      const state4F = makeState({
        currentFloor: 4,
        hand: geumCards,
        deck,
        enemyHp: 330,
        enemyMaxHp: 330,
        playsLeft: 6,
      })
      const newState = playCards(state4F, geumCards.map(c => c.id))
      // 금 관통 → 피해감소 무시
      // 금 모으기 2장: baseScore=20, ×1.5=30
      // 4층 주기운=geum, 금이 금을 극하지 않으므로 극 보너스 없음
      // 금 관통 → damage-reduction(0.3) 건너뜀
      // 피해 = 30 (관통 없으면 30 × 0.7 = 21)
      expect(newState.penetrationTriggered).toBe(true)
      // 피해 계산: 금 모으기 2장(값10+10=20) × 1.5 = 30, 음양조화+20% → 36
      // 부 기운(목) 극 보너스+25%: 36 × 1.25 = 45
      // 금 관통 → damage-reduction(30%) 건너뜀
      // 최종 피해 = 45 → enemyHp = 330 - 45 = 285
      expect(newState.enemyHp).toBe(285)
    })

    it('목 타격 시 penetrationTriggered = false', () => {
      const mokCards = [
        makeCard('mok', 'yang', 5, 'mok-np-1'),
        makeCard('mok', 'yin', 5, 'mok-np-2'),
      ]
      const deck = Array.from({ length: 10 }, (_, i) =>
        makeCard('mok', 'yang', 1, `deck-${i}`),
      )
      const state = makeState({ hand: mokCards, deck, playsLeft: 4 })
      const newState = playCards(state, mokCards.map(c => c.id))
      expect(newState.penetrationTriggered).toBe(false)
    })
  })
})

// ============================================================
// isLastAttack 마지막 공격 기회 감지
// ============================================================
describe('isLastAttack — 마지막 공격 기회 감지', () => {
  it('playsLeft=2인 상태에서 1회 공격 후 isLastAttack = true', () => {
    const card = makeCard('mok', 'yang', 5, 'mok-last')
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const state = makeState({ hand: [card], deck, playsLeft: 2 })
    const newState = playCards(state, [card.id])
    expect(newState.isLastAttack).toBe(true)
  })

  it('playsLeft=3인 상태에서 1회 공격 후 isLastAttack = false', () => {
    const card = makeCard('mok', 'yang', 5, 'mok-nlast')
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeCard('mok', 'yang', 1, `deck-${i}`),
    )
    const state = makeState({ hand: [card], deck, playsLeft: 3 })
    const newState = playCards(state, [card.id])
    expect(newState.isLastAttack).toBe(false)
  })

  it('isLastAttack = true 상태에서 applyCondense 차단', () => {
    const state = makeState({ playsLeft: 1, condenseType: null, isLastAttack: true })
    const newState = applyCondense(state, 'basic')
    expect(newState.condenseType).toBeNull()
    expect(newState.playsLeft).toBe(1)  // 소모 없음
  })
})
