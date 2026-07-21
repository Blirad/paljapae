/**
 * §3 신살 공용 인프라 + 화개(華蓋) 실게임 엔진 E2E 테스트
 * 2026-07-21 — 제라 실장
 *
 * 검증 경로:
 *  1. 획득(보상 3택) → 소지(inventory에 적재)
 *  2. 사용(손패 1장 지정 → +3) → 효과 지속(다음 전투에서도 +3 유지)
 *  3. 소지 상한 3 초과 거부 assert
 *  4. 華 마크 데이터 플래그 assert
 *  5. 봇 evalHwagaeTrigger 정합 확인
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  acquireSinsal,
  useSinsal,
  advanceToNextFloor,
  SINSAL_INVENTORY_MAX,
} from '../engine/paljajeonEngine'
import { evalHwagaeTrigger } from '../engine/fullCapBot'
import type { Card, GameState } from '../types/game'

/** 테스트용 초기 상태 팩토리 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return { ...base, ...overrides }
}

/** 테스트용 카드 팩토리 */
function makeCard(id: string, value: number): Card {
  return {
    id,
    element: 'mok',
    polarity: 'yang',
    value,
    type: 'soldier',
    rarity: 'common',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 획득 → 소지 경로
// ─────────────────────────────────────────────────────────────────────────────

describe('신살 획득 → 소지', () => {
  it('화개 acquireSinsal: 빈 인벤토리에 hwagae 획득 시 sinsalInventory에 적재', () => {
    const state = makeState()
    expect(state.sinsalInventory).toEqual([])

    const result = acquireSinsal(state, 'hwagae')
    expect(result.rejected).toBe(false)
    expect(result.state.sinsalInventory).toEqual(['hwagae'])
  })

  it('소지 상한 3 — 정확히 3개까지 허용', () => {
    let state = makeState()
    let result = acquireSinsal(state, 'hwagae')
    state = result.state
    result = acquireSinsal(state, 'hwagae')
    state = result.state
    result = acquireSinsal(state, 'hwagae')
    state = result.state

    expect(state.sinsalInventory.length).toBe(3)
    expect(result.rejected).toBe(false)
  })

  it('소지 상한 초과 거부 — 4번째 획득 시 rejected=true, 인벤토리 불변', () => {
    let state = makeState({ sinsalInventory: ['hwagae', 'hwagae', 'hwagae'] })
    const result = acquireSinsal(state, 'hwagae')

    expect(result.rejected).toBe(true)
    expect(result.state.sinsalInventory).toEqual(['hwagae', 'hwagae', 'hwagae'])
    expect(result.state.sinsalInventory.length).toBe(SINSAL_INVENTORY_MAX)
  })

  it('상한 SINSAL_INVENTORY_MAX = 3', () => {
    expect(SINSAL_INVENTORY_MAX).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 사용(+3) → 효과 지속
// ─────────────────────────────────────────────────────────────────────────────

describe('화개 사용 — 값 +3 효과', () => {
  it('useSinsal: 손패 카드 1장 지정 → 값 +3', () => {
    const card = makeCard('c1', 6)
    const state = makeState({
      hand: [card, makeCard('c2', 4)],
      sinsalInventory: ['hwagae'],
    })

    const next = useSinsal(state, 'hwagae', 'c1')
    const updated = next.hand.find(c => c.id === 'c1')!
    expect(updated.value).toBe(9)  // 6 + 3
  })

  it('useSinsal: 사용 후 소지 목록에서 소비 (인벤토리 -1)', () => {
    const card = makeCard('c1', 6)
    const state = makeState({
      hand: [card],
      sinsalInventory: ['hwagae'],
    })

    const next = useSinsal(state, 'hwagae', 'c1')
    expect(next.sinsalInventory).toEqual([])
  })

  it('useSinsal: 미소지 시 원본 상태 반환 (무시)', () => {
    const card = makeCard('c1', 6)
    const state = makeState({
      hand: [card],
      sinsalInventory: [],
    })

    const next = useSinsal(state, 'hwagae', 'c1')
    expect(next).toBe(state)  // 동일 참조 (변경 없음)
  })

  it('useSinsal: targetCardId 미전달 시 원본 반환', () => {
    const state = makeState({
      hand: [makeCard('c1', 6)],
      sinsalInventory: ['hwagae'],
    })

    const next = useSinsal(state, 'hwagae', undefined)
    expect(next).toBe(state)
  })

  it('useSinsal: 덱에 있는 카드에도 +3 영속 적용 (런 영구)', () => {
    const card = makeCard('c1', 6)
    const state = makeState({
      hand: [],
      deck: [card, makeCard('c2', 4)],
      sinsalInventory: ['hwagae'],
    })

    const next = useSinsal(state, 'hwagae', 'c1')
    const updatedInDeck = next.deck.find(c => c.id === 'c1')!
    expect(updatedInDeck.value).toBe(9)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. 華 마크 플래그 assert
// ─────────────────────────────────────────────────────────────────────────────

describe('화개 각인 플래그 (hwagaeMarked)', () => {
  it('useSinsal 적용 카드에 hwagaeMarked: true 플래그 설정', () => {
    const card = makeCard('c1', 6)
    const state = makeState({
      hand: [card],
      sinsalInventory: ['hwagae'],
    })

    const next = useSinsal(state, 'hwagae', 'c1')
    const marked = next.hand.find(c => c.id === 'c1')!
    expect(marked.hwagaeMarked).toBe(true)
  })

  it('未지정 카드에는 hwagaeMarked 없음', () => {
    const c1 = makeCard('c1', 6)
    const c2 = makeCard('c2', 4)
    const state = makeState({
      hand: [c1, c2],
      sinsalInventory: ['hwagae'],
    })

    const next = useSinsal(state, 'hwagae', 'c1')
    const unmarked = next.hand.find(c => c.id === 'c2')!
    expect(unmarked.hwagaeMarked).toBeFalsy()
  })

  it('덱에서도 동일 ID 카드에 hwagaeMarked 적용', () => {
    const card = makeCard('c1', 6)
    const state = makeState({
      hand: [],
      deck: [card],
      sinsalInventory: ['hwagae'],
    })

    const next = useSinsal(state, 'hwagae', 'c1')
    const inDeck = next.deck.find(c => c.id === 'c1')!
    expect(inDeck.hwagaeMarked).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. 효과 지속 — 다음 전투(층 전환 후)에서도 +3 유지
// ─────────────────────────────────────────────────────────────────────────────

describe('화개 효과 지속 — 층 전환 후 유지', () => {
  it('useSinsal 후 advanceToNextFloor: +3 값이 다음 층 덱에서도 유지', () => {
    // 1층에서 화개 사용
    const card = makeCard('c1', 6)
    const others = Array.from({ length: 10 }, (_, i) => makeCard(`other-${i}`, 4))
    const state = makeState({
      hand: [card, ...others.slice(0, 4)],
      deck: [...others.slice(4)],
      currentFloor: 1,
      sinsalInventory: ['hwagae'],
    })

    // 화개 사용: c1에 +3
    const afterUse = useSinsal(state, 'hwagae', 'c1')
    const c1AfterUse = [...afterUse.hand, ...afterUse.deck].find(c => c.id === 'c1')!
    expect(c1AfterUse.value).toBe(9)  // 6 + 3

    // 층 전환
    // advanceToNextFloor는 hand+deck+discardPile을 셔플해 재배분
    // c1은 반드시 hand 또는 deck 어딘가에 존재
    const nextFloor = advanceToNextFloor(afterUse)
    const c1InNext = [...nextFloor.hand, ...nextFloor.deck].find(c => c.id === 'c1')
    expect(c1InNext).toBeDefined()
    expect(c1InNext!.value).toBe(9)   // 다음 층에서도 +3 유지
    expect(c1InNext!.hwagaeMarked).toBe(true)  // 각인 플래그도 유지
  })

  it('층 전환 후 sinsalInventory 유지 (화개 소비 후 빈 배열 유지)', () => {
    const card = makeCard('c1', 6)
    const others = Array.from({ length: 10 }, (_, i) => makeCard(`other-${i}`, 4))
    const state = makeState({
      hand: [card, ...others.slice(0, 4)],
      deck: [...others.slice(4)],
      currentFloor: 1,
      sinsalInventory: ['hwagae'],
    })

    const afterUse = useSinsal(state, 'hwagae', 'c1')
    expect(afterUse.sinsalInventory).toEqual([])

    const nextFloor = advanceToNextFloor(afterUse)
    // 소비 후 빈 인벤토리가 다음 층에서도 유지
    expect(nextFloor.sinsalInventory).toEqual([])
  })

  it('층 전환 후 미사용 화개 인벤토리 유지 (소비 전 층 전환 가정)', () => {
    const others = Array.from({ length: 10 }, (_, i) => makeCard(`other-${i}`, 4))
    const state = makeState({
      hand: [...others.slice(0, 5)],
      deck: [...others.slice(5)],
      currentFloor: 1,
      sinsalInventory: ['hwagae'],
    })

    // 화개 미사용 상태로 층 전환
    const nextFloor = advanceToNextFloor(state)
    expect(nextFloor.sinsalInventory).toEqual(['hwagae'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. 봇 evalHwagaeTrigger 정합 확인 — 최고값 카드 지정 규칙
// ─────────────────────────────────────────────────────────────────────────────

describe('evalHwagaeTrigger 정합 — 실게임 효과와 동일 규칙', () => {
  it('최고값 카드에 사용 시 true (분식 효과 극대화)', () => {
    expect(evalHwagaeTrigger(10, 10)).toBe(true)  // value === max
    expect(evalHwagaeTrigger(8, 8)).toBe(true)
  })

  it('최고값 이상 카드에 사용 시 true', () => {
    expect(evalHwagaeTrigger(9, 8)).toBe(true)  // >= handMaxValue
  })

  it('최고값 미만 카드에 사용 시 false', () => {
    expect(evalHwagaeTrigger(4, 8)).toBe(false)
    expect(evalHwagaeTrigger(7, 10)).toBe(false)
  })

  it('실게임 useSinsal +3 효과와 봇 정책 정합: 최고값 카드 지정 → 기댓값 극대화', () => {
    // 봇: 최고값 카드에 화개 적용 (evalHwagaeTrigger)
    // 실게임: 최고값 카드에 +3 부여 → 동일 결과
    const highCard = makeCard('c-high', 8)
    const lowCard = makeCard('c-low', 4)
    const state = makeState({
      hand: [highCard, lowCard],
      sinsalInventory: ['hwagae'],
    })

    // 봇이 권장하는 카드 (최고값)
    const handMaxValue = Math.max(...state.hand.map(c => c.value))
    const botTarget = state.hand.find(c => evalHwagaeTrigger(c.value, handMaxValue))!
    expect(botTarget.id).toBe('c-high')  // 봇이 최고값 카드를 선택

    // 실게임 적용
    const next = useSinsal(state, 'hwagae', botTarget.id)
    const applied = next.hand.find(c => c.id === 'c-high')!
    expect(applied.value).toBe(11)  // 8 + 3
    expect(applied.hwagaeMarked).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. createInitialGameState sinsalInventory 초기화 검증
// ─────────────────────────────────────────────────────────────────────────────

describe('createInitialGameState — sinsalInventory 초기화', () => {
  it('초기 상태 sinsalInventory는 빈 배열', () => {
    const state = createInitialGameState(0)
    expect(state.sinsalInventory).toBeDefined()
    expect(Array.isArray(state.sinsalInventory)).toBe(true)
    expect(state.sinsalInventory).toEqual([])
  })
})
