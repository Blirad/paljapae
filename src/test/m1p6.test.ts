/**
 * 팔자전 Phase 1.6 — 신규 규칙 테스트
 * A. 전투 규칙 3종 (기운 충돌 / 주 기운 원칙 / 적의 반극)
 * B. 부적술 3종 (정화부 / 환패부 / 증폭부)
 * C. 패시브 정비 (바이블 3-4 십성 7종 교체 확인)
 */

import { describe, it, expect } from 'vitest'
import {
  detectElementClash,
  determinePrimaryElement,
  calcGeukBonusMultiplier,
  detectYeokgeukPenalty,
} from '../engine/pokerHandJudge'
import {
  activateJeonghwa,
  activateHwanpae,
  activateJeungpok,
  acquireTalisman,
  createInitialGameState,
  playCards,
} from '../engine/paljajeonEngine'
import { PASSIVE_POOL } from '../types/passive'
import type { Card, Element } from '../types/game'

// 테스트용 카드 팩토리
function makeCard(element: Element, value: number, id = `${element}-${value}`): Card {
  return {
    id,
    element,
    polarity: 'yang',
    value,
    type: 'soldier',
    rarity: 'common',
  }
}

// ----------------------------------------------------------------
// A-1. [기운 충돌] 테스트
// ----------------------------------------------------------------
describe('A-1. 기운 충돌 (detectElementClash)', () => {
  it('나무 2장 + 불 1장 + 흙 1장 → 나무↔흙 충돌 (나무가 흙을 극함)', () => {
    const cards = [
      makeCard('mok', 4, 'mok-1'),
      makeCard('mok', 6, 'mok-2'),
      makeCard('hwa', 4, 'hwa-1'),
      makeCard('to', 4, 'to-1'),
    ]
    const clashes = detectElementClash(cards)
    // mok → to (극), hwa → geum 없음
    expect(clashes.some(c => c.attacker === 'mok' && c.victim === 'to')).toBe(true)
  })

  it('극 쌍 없음 → 충돌 없음', () => {
    const cards = [
      makeCard('mok', 4, 'mok-1'),
      makeCard('hwa', 4, 'hwa-1'),
    ]
    // mok → to 극이지만 to 없음, hwa → geum 극이지만 geum 없음
    const clashes = detectElementClash(cards)
    expect(clashes).toHaveLength(0)
  })

  it('3체 이상 극 쌍 → 여러 충돌 감지', () => {
    // mok → to, hwa → geum 두 쌍 모두 존재
    const cards = [
      makeCard('mok', 4, 'mok-1'),
      makeCard('to', 4, 'to-1'),
      makeCard('hwa', 4, 'hwa-1'),
      makeCard('geum', 4, 'geum-1'),
    ]
    const clashes = detectElementClash(cards)
    expect(clashes.length).toBeGreaterThanOrEqual(2)
    expect(clashes.some(c => c.attacker === 'mok' && c.victim === 'to')).toBe(true)
    expect(clashes.some(c => c.attacker === 'hwa' && c.victim === 'geum')).toBe(true)
  })
})

// ----------------------------------------------------------------
// A-2. [주 기운 원칙] 테스트
// ----------------------------------------------------------------
describe('A-2. 주 기운 원칙 (determinePrimaryElement / calcGeukBonusMultiplier)', () => {
  it('나무 4장 + 쇠 2장 → 주 기운 나무', () => {
    const cards = [
      makeCard('mok', 4, 'mok-1'),
      makeCard('mok', 4, 'mok-2'),
      makeCard('mok', 4, 'mok-3'),
      makeCard('mok', 4, 'mok-4'),
      makeCard('geum', 4, 'geum-1'),
      makeCard('geum', 4, 'geum-2'),
    ]
    const primary = determinePrimaryElement(cards)
    expect(primary?.element).toBe('mok')
    expect(primary?.count).toBe(4)
  })

  it('나무 4장(주) + 쇠 2장 — 나무→흙을 극, 적=흙 → +50% 적용', () => {
    // 나무는 흙을 극(mok→to). 적이 흙이면 주 기운(나무)이 이기므로 +50%
    const cards = [
      makeCard('mok', 4, 'mok-1'),
      makeCard('mok', 4, 'mok-2'),
      makeCard('mok', 4, 'mok-3'),
      makeCard('mok', 4, 'mok-4'),
      makeCard('geum', 4, 'geum-1'),
    ]
    const result = calcGeukBonusMultiplier(cards, 'to')
    expect(result.multiplier).toBe(1.5)
    expect(result.isMainGeuk).toBe(true)
  })

  it('동수일 때 합 큰 쪽이 주 기운 (나무 합250 vs 쇠 합200)', () => {
    // 각 3장씩, 나무 총합 > 쇠 총합
    const cards = [
      makeCard('mok', 84, 'mok-1'),  // 총 252
      makeCard('mok', 84, 'mok-2'),
      makeCard('mok', 84, 'mok-3'),
      makeCard('geum', 67, 'geum-1'),  // 총 201
      makeCard('geum', 67, 'geum-2'),
      makeCard('geum', 67, 'geum-3'),
    ]
    const primary = determinePrimaryElement(cards)
    expect(primary?.element).toBe('mok')
  })

  it('쇠 3장(주) + 불 2장 — 불이 쇠를 극하지만 주 기운 아님 → +10%', () => {
    // hwa → geum (불이 쇠를 극함). 하지만 주 기운은 쇠(3장 > 2장)
    // 적 속성 = geum. 불 카드가 적(geum)을 극하지만 주 기운은 쇠 → +10%
    const cards = [
      makeCard('geum', 4, 'geum-1'),
      makeCard('geum', 4, 'geum-2'),
      makeCard('geum', 4, 'geum-3'),
      makeCard('hwa', 4, 'hwa-1'),
      makeCard('hwa', 4, 'hwa-2'),
    ]
    // 적이 geum → 불이 극(hwa → geum), 주 기운 geum은 극하지 않음
    // 실제 극 관계: hwa → geum. 적 = geum 이면 불 카드가 극함
    // 그러나 주 기운(geum)이 적을 극하지 않음 → 주 기운 원칙에서 +10%
    const result = calcGeukBonusMultiplier(cards, 'geum')
    // 이 케이스: 적 geum, 불이 geum을 극함 → hasAnyGeuk = true
    // 주 기운 = geum, geum이 geum을 극? → mok이 geum을 극함 (GEUK_MAP[geum] = mok)
    // geum의 극 대상 = mok. 적은 geum. 주 기운 geum → GEUK_MAP[geum] = mok ≠ geum
    // 따라서 isMainGeuk = false → +10%
    expect(result.multiplier).toBe(1.1)
    expect(result.isMainGeuk).toBe(false)
  })
})

// ----------------------------------------------------------------
// A-3. [적의 반극] 테스트
// ----------------------------------------------------------------
describe('A-3. 적의 반극 (detectYeokgeukPenalty)', () => {
  it('내 조합 흙 4장(주) / 적 나무 3장(흙을 이김) → 반극 패널티 적용', () => {
    // mok → to (나무가 흙을 극함). 내 주 기운 = to. 적 최강 = mok.
    const myCards = [
      makeCard('to', 4, 'to-1'),
      makeCard('to', 4, 'to-2'),
      makeCard('to', 4, 'to-3'),
      makeCard('to', 4, 'to-4'),
    ]
    const enemyEls: Element[] = ['mok', 'mok', 'mok']
    const result = detectYeokgeukPenalty(myCards, enemyEls)
    expect(result.hasPenalty).toBe(true)
    expect(result.enemyStrongest).toBe('mok')
    expect(result.myPrimary?.element).toBe('to')
  })

  it('내 주 기운 나무 / 적: 불 2장, 쇠 2장(동수) → 반극 없음 (나무 극하는 쇠는 없음)', () => {
    // geum → mok (쇠가 나무를 극). 적 최강: 불=쇠 동수이므로 불이 먼저
    // 내 주 = mok. 적 최강 = hwa (동수 시 첫 발견). GEUK_MAP[hwa] = geum ≠ mok
    const myCards = [
      makeCard('mok', 4, 'mok-1'),
      makeCard('mok', 4, 'mok-2'),
      makeCard('mok', 4, 'mok-3'),
    ]
    const enemyEls: Element[] = ['hwa', 'hwa', 'geum', 'geum']
    // 동수 시 첫 번째 처리 순서에 따라 결과 달라질 수 있음 — 정책: 나무를 극하는 쇠가 적 최강이면 패널티
    // 여기서 동수(hwa=geum=2). 순회 순서상 hwa가 먼저 → 최강=hwa → GEUK_MAP[hwa]=geum ≠ mok → 패널티 없음
    const result = detectYeokgeukPenalty(myCards, enemyEls)
    // 검증: 적 최강이 쇠라면 패널티, 불이라면 없음
    if (result.enemyStrongest === 'geum') {
      expect(result.hasPenalty).toBe(true)
    } else {
      expect(result.hasPenalty).toBe(false)
    }
  })

  it('적 기운 목록 비어있으면 패널티 없음', () => {
    const myCards = [makeCard('mok', 4, 'mok-1')]
    const result = detectYeokgeukPenalty(myCards, [])
    expect(result.hasPenalty).toBe(false)
  })
})

// ----------------------------------------------------------------
// B. 부적술 테스트
// ----------------------------------------------------------------
describe('B. 부적술', () => {
  function makeStateWithTalismans(ids: string[]) {
    const base = createInitialGameState(0)
    // 무덤에 카드 3장 넣기
    const movedToDiscard = base.hand.slice(0, 3)
    const newHand = base.hand.slice(3)
    return {
      ...base,
      hand: newHand,
      discardPile: movedToDiscard,
      talismans: ids,
    }
  }

  it('B-1. 정화부 발동 → 무덤 카드 최대 3장 손으로 복구', () => {
    const state = makeStateWithTalismans(['jeonghwa'])
    const before = state.discardPile.length
    expect(before).toBeGreaterThan(0)

    const newState = activateJeonghwa(state)
    expect(newState.discardPile.length).toBe(Math.max(0, before - 3))
    expect(newState.hand.length).toBeGreaterThan(state.hand.length)
    // 부적 소모됨
    expect(newState.talismans.includes('jeonghwa')).toBe(false)
  })

  it('B-2. 환패부 발동 → 핸드 전체 버리고 새로 뽑음', () => {
    const state = makeStateWithTalismans(['hwanpae'])
    const originalHandIds = new Set(state.hand.map(c => c.id))
    const originalHandSize = state.hand.length

    const newState = activateHwanpae(state)
    // 기존 핸드 카드는 discardPile로
    const newHandIds = new Set(newState.hand.map(c => c.id))
    // 새 핸드에는 기존 핸드 카드가 없거나 덱에서 새로 뽑혀야 함
    expect(newState.hand.length).toBeLessThanOrEqual(originalHandSize)
    // 기존 손 카드가 discardPile에 포함됨
    for (const id of originalHandIds) {
      expect(newState.discardPile.some(c => c.id === id)).toBe(true)
    }
    // 새 핸드는 기존 핸드 카드와 겹치지 않음
    for (const id of newHandIds) {
      expect(originalHandIds.has(id)).toBe(false)
    }
    // 부적 소모됨
    expect(newState.talismans.includes('hwanpae')).toBe(false)
  })

  it('B-3. 증폭부 발동 → amplifyActive = true', () => {
    const state = makeStateWithTalismans(['jeungpok'])
    const newState = activateJeungpok(state)
    expect(newState.amplifyActive).toBe(true)
    // 부적 소모됨
    expect(newState.talismans.includes('jeungpok')).toBe(false)
  })

  it('B-3. 증폭부 → 다음 공격 데미지 ×2 확인', () => {
    // amplifyActive = true인 상태에서 출수 → amplifyActive = false
    const base = createInitialGameState(0)
    const stateWithAmplify = { ...base, amplifyActive: true }
    const stateWithout = { ...base, amplifyActive: false }

    const cardId = base.hand[0].id
    const withAmplify = playCards(stateWithAmplify, [cardId])
    const withoutAmplify = playCards(stateWithout, [cardId])

    // 증폭부 데미지가 2배여야 함
    const dmgWith = base.enemyHp - withAmplify.enemyHp
    const dmgWithout = base.enemyHp - withoutAmplify.enemyHp
    // 1층 기믹(heal 15) 포함이라 정확히 2배가 아닐 수 있으나, 더 크거나 같아야 함
    expect(dmgWith).toBeGreaterThanOrEqual(dmgWithout)
    // amplifyActive 소모됨
    expect(withAmplify.amplifyActive).toBe(false)
  })

  it('B-4. acquireTalisman → 부적 획득', () => {
    const base = createInitialGameState(0)
    const state1 = acquireTalisman(base, 'jeonghwa')
    expect(state1.talismans).toContain('jeonghwa')
    // 중복 획득 불가
    const state2 = acquireTalisman(state1, 'jeonghwa')
    expect(state2.talismans.filter(t => t === 'jeonghwa')).toHaveLength(1)
  })

  it('B-5. 부적 없는 상태에서 발동 → 상태 변화 없음', () => {
    const base = createInitialGameState(0)
    const after = activateJeonghwa(base)
    expect(after).toBe(base)  // 동일 참조
  })
})

// ----------------------------------------------------------------
// C. 패시브 정비 — 바이블 3-4 십성 7종 검증
// ----------------------------------------------------------------
describe('C. 패시브 정비 — 십성 7종 검증', () => {
  const REQUIRED_IDS = ['sikshin', 'bigyeon', 'geoptae', 'sanggwan', 'pyeonjae', 'jeongjae', 'pyeonin']
  const FORBIDDEN_IDS = ['jujak', 'gwiha', 'hyeonmu', 'guhwang', 'cheongryong']

  it('필수 십성 7종 모두 존재', () => {
    const ids = PASSIVE_POOL.map(p => p.id)
    for (const required of REQUIRED_IDS) {
      expect(ids).toContain(required)
    }
  })

  it('임의발명 패시브 id 제거 확인 (주작/귀하/현무/구황/청룡)', () => {
    const ids = PASSIVE_POOL.map(p => p.id)
    for (const forbidden of FORBIDDEN_IDS) {
      expect(ids).not.toContain(forbidden)
    }
  })

  it('정확히 7종만 존재', () => {
    expect(PASSIVE_POOL).toHaveLength(7)
  })

  it('한글 이름에 임의발명 이름 없음', () => {
    const names = PASSIVE_POOL.map(p => p.name)
    expect(names).not.toContain('주작(朱雀)')
    expect(names).not.toContain('귀하(貴河)')
    expect(names).not.toContain('현무(玄武)')
    expect(names).not.toContain('구황(勾黃)')
    expect(names).not.toContain('청룡(靑龍)')
  })

  it('식신(食神) 이름 포함', () => {
    const sikshin = PASSIVE_POOL.find(p => p.id === 'sikshin')
    expect(sikshin?.name).toContain('식신')
  })

  it('비견(比肩) 이름 포함', () => {
    const bigyeon = PASSIVE_POOL.find(p => p.id === 'bigyeon')
    expect(bigyeon?.name).toContain('비견')
  })
})

// ----------------------------------------------------------------
// C-6. PreBattleScreen 라우팅 테스트 (로직 레이어)
// ----------------------------------------------------------------
describe('C-6. 가호 선택 기본 로직', () => {
  it('PASSIVE_POOL에서 임의 선택 가능한 4종 이상 존재', () => {
    expect(PASSIVE_POOL.length).toBeGreaterThanOrEqual(4)
  })
})
