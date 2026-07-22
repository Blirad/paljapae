/**
 * 통합 슬롯 개편 1단계 — E2E 규칙 스위트 (2026-07-22 제라)
 * 지시: ZERA_PALJAJEON_SLOT_UNIFY_ENGINE_DISPATCH_20260722.md 3장
 *
 * 5종 검증:
 *  ① 슬롯 통합 장착·해제·소멸(잔존0 assert) + 십성 선점(common tier 1~2칸)
 *  ② 신살 액티브 발동 후 슬롯 비움(빈 슬롯 assert)
 *  ③ 화개 마이그레이션 효과 불변(+3 영구·hwagaeMarked·1회 소비)
 *  ④ 슬롯 5칸 full 시 교체(해제 소멸 → 장착) 경로
 *  ⑤ 전투 중 장착/해제 거부
 *
 * 유령 측정 금지 — 발동·마이그레이션 실효값 assert 필수.
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  seedCommonSlots,
  equipSlot,
  unequipSlot,
  acquireSinsal,
  useSinsal,
  deriveActivePassiveIds,
  deriveSinsalInventory,
  MAX_SLOTS,
} from '../engine/paljajeonEngine'
import { selectTalismanBySaju } from '../engine/fullCapBot'
import type { Card, GameState, Element } from '../types/game'

/** 테스트용 초기 상태 팩토리 — 기본 phase를 floor-reward(전투 밖)로 두어 장착 허용 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return { ...base, phase: 'floor-reward', ...overrides }
}

function makeCard(id: string, value: number): Card {
  return { id, element: 'mok', polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

// ─────────────────────────────────────────────────────────────────────────────
// ① 슬롯 통합 장착·해제·소멸 + 십성 선점
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ① 슬롯 통합 장착·해제·소멸 + 십성 선점', () => {
  it('십성 가호 선점 — 시작 시 selectTalismanBySaju 결과가 common tier 1~2칸 선점', () => {
    const dist: Record<Element, number> = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }
    const talismans = selectTalismanBySaju(dist)  // 상위 2종
    const state = seedCommonSlots(makeState(), talismans)

    // 1~2칸 선점 (십성)
    expect(state.unifiedSlots.length).toBeGreaterThanOrEqual(1)
    expect(state.unifiedSlots.length).toBeLessThanOrEqual(2)
    // 전부 common tier
    expect(state.unifiedSlots.every(s => s.tier === 'common')).toBe(true)
    // 레거시 파생 필드 동기화
    expect(state.activePassiveIds).toEqual(talismans.slice(0, MAX_SLOTS))
    // 신살(rare)은 아직 없음
    expect(deriveSinsalInventory(state.unifiedSlots)).toEqual([])
  })

  it('장착 → 해제 = 소멸(잔존 0): 해제한 카드가 어떤 필드에도 남지 않음', () => {
    let state = makeState()
    // 가호 1개 장착
    const r1 = equipSlot(state, { tier: 'common', cardId: 'geoptae' })
    expect(r1.rejected).toBe(false)
    state = r1.state
    expect(state.unifiedSlots.length).toBe(1)
    expect(deriveActivePassiveIds(state.unifiedSlots)).toEqual(['geoptae'])

    // 해제(index 0) = 소멸
    const r2 = unequipSlot(state, 0)
    expect(r2.rejected).toBe(false)
    state = r2.state

    // 잔존 0 — 통합 슬롯·레거시 파생 필드 어디에도 없음
    expect(state.unifiedSlots.length).toBe(0)
    expect(state.unifiedSlots.some(s => s.cardId === 'geoptae')).toBe(false)
    expect(state.activePassiveIds).toEqual([])
    expect(state.sinsalInventory).toEqual([])
  })

  it('3층 위계 동시 장착 — common/rare/legendary 한 줄 경쟁', () => {
    let state = makeState()
    state = equipSlot(state, { tier: 'common', cardId: 'sanggwan' }).state
    state = equipSlot(state, { tier: 'rare', cardId: 'hwagae' }).state
    state = equipSlot(state, { tier: 'legendary', cardId: 'saengji' }).state

    expect(state.unifiedSlots.length).toBe(3)
    expect(deriveActivePassiveIds(state.unifiedSlots)).toEqual(['sanggwan'])
    expect(deriveSinsalInventory(state.unifiedSlots)).toEqual(['hwagae'])
    expect(state.unifiedSlots.filter(s => s.tier === 'legendary').length).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ② 신살 액티브 발동 후 슬롯 비움
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ② 신살 액티브 발동 후 슬롯 비움', () => {
  it('화개(rare) 발동 후 해당 슬롯 제거 — 발동 전 1칸 → 발동 후 0칸', () => {
    const card = makeCard('c1', 6)
    let state = makeState({ hand: [card], unifiedSlots: [{ tier: 'rare', cardId: 'hwagae' }] })
    expect(state.unifiedSlots.length).toBe(1)

    // 신살 발동 (전투 중 발동은 useSinsal 자체가 액션 — phase 무관, 유저 시점 선택)
    state = useSinsal(state, 'hwagae', 'c1')

    // 발동 후 rare 슬롯 비워짐 (제거)
    expect(state.unifiedSlots.length).toBe(0)
    expect(state.unifiedSlots.some(s => s.tier === 'rare')).toBe(false)
    expect(deriveSinsalInventory(state.unifiedSlots)).toEqual([])
    // 발동 실효값 assert — 카드 +3 실제 적용 (유령측정 차단)
    expect(state.hand.find(c => c.id === 'c1')!.value).toBe(9)
  })

  it('common 가호 + rare 신살 공존 — 신살만 발동 소멸, 가호는 슬롯 유지', () => {
    const card = makeCard('c1', 5)
    let state = makeState({
      hand: [card],
      unifiedSlots: [
        { tier: 'common', cardId: 'geoptae' },
        { tier: 'rare', cardId: 'hwagae' },
      ],
    })
    state = useSinsal(state, 'hwagae', 'c1')

    // 신살 소멸, 가호 유지
    expect(state.unifiedSlots.length).toBe(1)
    expect(state.unifiedSlots[0]).toEqual({ tier: 'common', cardId: 'geoptae' })
    expect(state.hand.find(c => c.id === 'c1')!.value).toBe(8)  // 5 + 3
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ③ 화개 마이그레이션 효과 불변
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ③ 화개 마이그레이션 효과 불변', () => {
  it('마이그레이션 후에도 +3 영구·hwagaeMarked·1회 소비 — 기존 효과와 동일값', () => {
    const card = makeCard('c1', 7)
    let state = makeState({
      hand: [card, makeCard('c2', 4)],
      deck: [makeCard('c1', 7)],  // 영속 덱 동일 ID
      unifiedSlots: [{ tier: 'rare', cardId: 'hwagae' }],
    })

    state = useSinsal(state, 'hwagae', 'c1')

    // +3 영구 (손패)
    const handCard = state.hand.find(c => c.id === 'c1')!
    expect(handCard.value).toBe(10)  // 7 + 3 (불변)
    // hwagaeMarked 플래그 (불변)
    expect(handCard.hwagaeMarked).toBe(true)
    // 덱 동일 ID도 +3 (영속 덱 대응, 불변)
    expect(state.deck.find(c => c.id === 'c1')!.value).toBe(10)
    expect(state.deck.find(c => c.id === 'c1')!.hwagaeMarked).toBe(true)
    // 미지정 카드는 불변
    expect(state.hand.find(c => c.id === 'c2')!.value).toBe(4)
    expect(state.hand.find(c => c.id === 'c2')!.hwagaeMarked).toBeFalsy()
    // 1회 소비 — 슬롯 비움
    expect(state.unifiedSlots.length).toBe(0)
  })

  it('마이그레이션 회귀 방지 — 재발동 무효(이미 소비된 슬롯), 값 재증가 없음', () => {
    const card = makeCard('c1', 7)
    let state = makeState({
      hand: [card],
      unifiedSlots: [{ tier: 'rare', cardId: 'hwagae' }],
    })
    state = useSinsal(state, 'hwagae', 'c1')
    expect(state.hand.find(c => c.id === 'c1')!.value).toBe(10)

    // 소비 후 재발동 시도 — 슬롯 없으므로 무효 (동일 참조 반환)
    const again = useSinsal(state, 'hwagae', 'c1')
    expect(again).toBe(state)  // 변경 없음
    expect(again.hand.find(c => c.id === 'c1')!.value).toBe(10)  // 재증가 없음
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ④ 슬롯 5칸 full 시 교체(해제 소멸 → 장착)
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ④ 슬롯 5칸 full 교체 경로', () => {
  it('full 상태 신규 장착 — replaceIndex로 기존 칸 소멸 후 장착', () => {
    const fullSlots = [
      { tier: 'common' as const, cardId: 'g0' },
      { tier: 'common' as const, cardId: 'g1' },
      { tier: 'common' as const, cardId: 'g2' },
      { tier: 'common' as const, cardId: 'g3' },
      { tier: 'common' as const, cardId: 'g4' },
    ]
    let state = makeState({ unifiedSlots: fullSlots })
    expect(state.unifiedSlots.length).toBe(MAX_SLOTS)

    // full 상태에서 replaceIndex 없이 장착 → 거부
    const rejected = equipSlot(state, { tier: 'rare', cardId: 'hwagae' })
    expect(rejected.rejected).toBe(true)
    expect(rejected.reason).toBe('full-no-replace-index')

    // replaceIndex=2로 교체 (g2 소멸 → hwagae 장착)
    const r = equipSlot(state, { tier: 'rare', cardId: 'hwagae' }, 2)
    expect(r.rejected).toBe(false)
    state = r.state

    // 여전히 5칸 (교체이므로 증가 없음)
    expect(state.unifiedSlots.length).toBe(MAX_SLOTS)
    // g2 소멸 — 잔존 0
    expect(state.unifiedSlots.some(s => s.cardId === 'g2')).toBe(false)
    // 신규 hwagae 장착됨
    expect(state.unifiedSlots[2]).toEqual({ tier: 'rare', cardId: 'hwagae' })
    // 나머지 4칸 보존
    expect(state.unifiedSlots.map(s => s.cardId)).toEqual(['g0', 'g1', 'hwagae', 'g3', 'g4'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ 전투 중 장착/해제 거부
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ⑤ 전투 중 장착/해제 거부', () => {
  it('전투 phase(select/play/enemy)에서 장착 거부', () => {
    for (const phase of ['select', 'play', 'enemy', 'draw'] as const) {
      const state = makeState({ phase, unifiedSlots: [] })
      const r = equipSlot(state, { tier: 'common', cardId: 'geoptae' })
      expect(r.rejected).toBe(true)
      expect(r.reason).toBe('combat-locked')
      // 슬롯 불변
      expect(r.state.unifiedSlots.length).toBe(0)
    }
  })

  it('전투 phase에서 해제 거부', () => {
    const state = makeState({
      phase: 'select',
      unifiedSlots: [{ tier: 'common', cardId: 'geoptae' }],
    })
    const r = unequipSlot(state, 0)
    expect(r.rejected).toBe(true)
    expect(r.reason).toBe('combat-locked')
    // 슬롯 불변 (소멸 안 됨)
    expect(r.state.unifiedSlots.length).toBe(1)
  })

  it('전투 밖(floor-reward/result)에서는 장착·해제 허용', () => {
    for (const phase of ['floor-reward', 'result'] as const) {
      let state = makeState({ phase, unifiedSlots: [] })
      const eq = equipSlot(state, { tier: 'common', cardId: 'geoptae' })
      expect(eq.rejected).toBe(false)
      state = eq.state
      const uneq = unequipSlot(state, 0)
      expect(uneq.rejected).toBe(false)
      expect(uneq.state.unifiedSlots.length).toBe(0)
    }
  })
})
