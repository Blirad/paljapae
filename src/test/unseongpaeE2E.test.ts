/**
 * 팔자전 [2단계] — 운성패 4종 E2E 규칙 스위트 (2026-07-22 제라)
 * 지시: ZERA_PALJAJEON_UNSEONGPAE_ENGINE_DISPATCH_20260722.md 3장
 *
 * 검증:
 *  ① 격 상승 조건 각각 (생지 융합/왕지 반복/묘지 버리기/절지 승리) — 먹이 누적 → 격 +1
 *  ② 절지 격 꺾임 (부활 시 1격 하락 + 왕격 각성 ×1.5)
 *  ③ 묘고 적재·방출 (버린 카드 묘고 → 발동 시 전체 손패 복귀, 전투당 1회, 왕격 +1 숙성)
 *  ④ 왕지 체감 면제 (상·왕격 → 체감 카운터 무증가 assert)
 *  ⑤ 생지 드로우 수 = 소모 카드 수 (상격, 왕격 15% 잉태)
 *
 * 유령 측정 금지 — 발동·성장 실효값 assert 필수.
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialGameState,
  acquireUnseongpae,
  getUnseongpaeState,
  playCards,
  discardCards,
  releaseMyogo,
  tryJeoljiRevive,
  resetUnseongpaePerFloor,
} from '../engine/paljajeonEngine'
import {
  accrueFeed,
  createUnseongpaeState,
  saengjiDrawCount,
  wangjiEffectiveGatherCount,
  wangjiRepeatMultiplier,
  jeoljiRevive,
  myojiStoreDiscarded,
  myojiRelease,
  FEED_THRESHOLDS,
  JEOLJI_REVIVE_PCT,
} from '../engine/unseongpae'
import type { Card, GameState, Element } from '../types/game'

function makeCard(id: string, element: Element, value: number): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

/** 융합 성립용 손패(서로 다른 두 기운) — playCards로 fusion-birth/hone 유도 */
function makeFusionState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(0)
  return {
    ...base,
    phase: 'select',
    playsLeft: 5,
    discardsLeft: 3,
    enemyHp: 9999,
    enemyMaxHp: 9999,
    playerHp: 100,
    playerMaxHp: 100,
    hand: [
      makeCard('a', 'mok', 8),
      makeCard('b', 'hwa', 8),
      makeCard('c', 'to', 5),
      makeCard('d', 'geum', 5),
      makeCard('e', 'su', 5),
    ],
    deck: Array.from({ length: 20 }, (_, i) => makeCard(`deck${i}`, 'mok', 4)),
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ① 격 상승 조건 각각 (먹이 누적 → 격 +1)
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ① 격 상승 (왕상휴수 성장)', () => {
  it('먹이 임계 도달 시 수→휴 승격 + 초과분 이월', () => {
    const su = createUnseongpaeState('saengji') // su, feed 0
    expect(su.gyeok).toBe('su')
    const need = FEED_THRESHOLDS.saengji[0] // 5
    const r1 = accrueFeed(su, need - 1)
    expect(r1.state.gyeok).toBe('su') // 아직
    expect(r1.leveledUp).toBe(false)
    const r2 = accrueFeed(r1.state, 2) // 총 need+1 → 승격 + 1 이월
    expect(r2.state.gyeok).toBe('hyu')
    expect(r2.state.feed).toBe(1)
    expect(r2.leveledUp).toBe(true)
  })

  it('생지 — 융합 1회당 먹이 +1 (엔진 통합, 실효 성장)', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'saengji').state
    state = { ...makeFusionState(), unifiedSlots: state.unifiedSlots, unseongpaeStates: state.unseongpaeStates }
    const before = getUnseongpaeState(state, 'saengji')!.feed
    state = playCards(state, ['a', 'b']) // 목+화 융합
    const after = getUnseongpaeState(state, 'saengji')!.feed
    expect(after).toBe(before + 1) // 융합 1회 → 먹이 +1
  })

  it('묘지 — 버린 카드 장수만큼 먹이 누적', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'myoji').state
    state = { ...makeFusionState(), unifiedSlots: state.unifiedSlots, unseongpaeStates: state.unseongpaeStates }
    state = discardCards(state, ['c', 'd']) // 2장 버리기
    expect(getUnseongpaeState(state, 'myoji')!.feed).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ② 절지 격 꺾임 (부활 시 1격 하락)
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ② 절지 부활 + 격 꺾임', () => {
  it('상격 절지 부활 — HP 30% 회복 + 상→휴 꺾임 + 런당 1회', () => {
    const sang = { ...createUnseongpaeState('jeolji'), gyeok: 'sang' as const }
    const { state: after, reviveHp } = jeoljiRevive(sang, 100)
    expect(reviveHp).toBe(Math.round(100 * JEOLJI_REVIVE_PCT.sang)) // 30
    expect(after.gyeok).toBe('hyu') // 1격 꺾임
    expect(after.jeoljiUsed).toBe(true)
    // 재부활 불가 (런당 1회)
    const again = jeoljiRevive(after, 100)
    expect(again.reviveHp).toBe(0)
  })

  it('왕격 절지 부활 — 각성(전 융합 ×1.5) 세팅 + 왕→상 꺾임', () => {
    const wang = { ...createUnseongpaeState('jeolji'), gyeok: 'wang' as const }
    const { state: after } = jeoljiRevive(wang, 100)
    expect(after.gyeok).toBe('sang')
    expect(after.jeoljiAwakenBattle).toBe(true) // 각성 활성
  })

  it('엔진 통합 — playerHp 0 시 tryJeoljiRevive로 부활 (전투 지속)', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'jeolji').state
    state = {
      ...makeFusionState(),
      unifiedSlots: state.unifiedSlots,
      unseongpaeStates: state.unseongpaeStates!.map(u => ({ ...u, gyeok: 'sang' as const })),
      playerHp: 0,
      playerMaxHp: 100,
    }
    const { state: revived, revived: ok } = tryJeoljiRevive(state)
    expect(ok).toBe(true)
    expect(revived.playerHp).toBe(30) // 30% of 100
    expect(getUnseongpaeState(revived, 'jeolji')!.gyeok).toBe('hyu') // 꺾임
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ③ 묘고 적재·방출
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ③ 묘지 묘고 적재·방출', () => {
  it('버린 카드 묘고 적재 → 방출 시 전체 손패 복귀 (전투당 1회)', () => {
    const cards = [makeCard('x', 'mok', 6), makeCard('y', 'hwa', 7)]
    let myoji = { ...createUnseongpaeState('myoji'), gyeok: 'sang' as const } // 상격 = 무제한
    myoji = myojiStoreDiscarded(myoji, cards)
    expect(myoji.myogo!.length).toBe(2)
    const { state: after, released } = myojiRelease(myoji)
    expect(released!.length).toBe(2) // 전체 방출
    expect(after.myogo!.length).toBe(0) // 묘고 비움
    expect(after.myogoUsedThisFloor).toBe(true)
    // 재방출 불가 (전투당 1회)
    const again = myojiRelease(after)
    expect(again.released).toBeNull()
  })

  it('왕격 방출 — 묘고 카드 값 +1 숙성', () => {
    let myoji = { ...createUnseongpaeState('myoji'), gyeok: 'wang' as const }
    myoji = myojiStoreDiscarded(myoji, [makeCard('z', 'to', 5)])
    const { released } = myojiRelease(myoji)
    expect(released![0].value).toBe(6) // 5 + 1 숙성
  })

  it('엔진 통합 — discardCards로 묘고 적재 후 releaseMyogo로 손패 복귀', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'myoji').state
    state = {
      ...makeFusionState(),
      unifiedSlots: state.unifiedSlots,
      unseongpaeStates: state.unseongpaeStates!.map(u => ({ ...u, gyeok: 'sang' as const })),
    }
    const handBefore = state.hand.length
    state = discardCards(state, ['c', 'd']) // 2장 버리기 → 묘고 적재
    expect(getUnseongpaeState(state, 'myoji')!.myogo!.length).toBe(2)
    const handAfterDiscard = state.hand.length
    state = releaseMyogo(state) // 방출 → 손패 복귀
    expect(state.hand.length).toBe(handAfterDiscard + 2)
    expect(getUnseongpaeState(state, 'myoji')!.myogo!.length).toBe(0)
    void handBefore
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ④ 왕지 체감 면제 (체감 카운터 무증가 assert)
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ④ 왕지 수확 체감 면제', () => {
  it('상·왕격 — 유효 체감 카운터 항상 0 (완전 면제)', () => {
    expect(wangjiEffectiveGatherCount('sang', 5)).toBe(0)
    expect(wangjiEffectiveGatherCount('wang', 10)).toBe(0)
    // 수·휴격 = 부분 면제 (게이트 튜닝: 수 2단계/휴 3단계 차감)
    expect(wangjiEffectiveGatherCount('su', 3)).toBe(1) // 3-2
    expect(wangjiEffectiveGatherCount('hyu', 5)).toBe(2) // 5-3
  })

  it('엔진 통합 — 왕지 상격 장착 시 gather5 반복해도 gatherUsedInBattle 무증가', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'wangji').state
    // gather5(같은 기운 5장) 손패 구성 + 왕지 상격
    state = {
      ...makeFusionState({
        hand: [
          makeCard('g1', 'mok', 6), makeCard('g2', 'mok', 6), makeCard('g3', 'mok', 6),
          makeCard('g4', 'mok', 6), makeCard('g5', 'mok', 6),
        ],
        deck: Array.from({ length: 30 }, (_, i) => makeCard(`d${i}`, 'mok', 6)),
      }),
      unifiedSlots: state.unifiedSlots,
      unseongpaeStates: state.unseongpaeStates!.map(u => ({ ...u, gyeok: 'sang' as const })),
    }
    expect(state.gatherUsedInBattle ?? 0).toBe(0)
    state = playCards(state, ['g1', 'g2', 'g3', 'g4', 'g5']) // gather5
    // 상격 완전 면제 → 체감 카운터 무증가 assert
    expect(state.gatherUsedInBattle ?? 0).toBe(0)
  })

  it('왕격 반복 배율 — 2회째부터 ×1.1 누적, 그 전엔 1.0', () => {
    expect(wangjiRepeatMultiplier('wang', 0)).toBe(1.0) // 첫 융합
    expect(wangjiRepeatMultiplier('wang', 1)).toBeCloseTo(1.1) // 2회째
    expect(wangjiRepeatMultiplier('wang', 2)).toBeCloseTo(1.21) // 3회째
    expect(wangjiRepeatMultiplier('sang', 3)).toBe(1.0) // 왕격 아니면 무효
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ 생지 드로우 수 = 소모 카드 수
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ⑤ 생지 드로우 = 소모 카드 수', () => {
  it('왕격 — 소모 2장 융합 시 2장 드로우 (배수 1.0)', () => {
    // 게이트 튜닝(2026-07-22): 배수 재조정 (수=0.34/휴=0.5/상=0.75/왕=1.0)
    expect(saengjiDrawCount('wang', 2)).toBe(2) // floor(2)=2
    expect(saengjiDrawCount('wang', 3)).toBe(3) // floor(3)=3
    expect(saengjiDrawCount('sang', 4)).toBe(3) // floor(4*0.75)=3
    expect(saengjiDrawCount('su', 2)).toBe(1) // floor(0.68)=0 → max(1)=1
    expect(saengjiDrawCount('hyu', 4)).toBe(2) // floor(4*0.5)=2
  })

  it('엔진 통합 — 왕격 생지 융합 후 손패가 리필+소모수만큼 증가', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'saengji').state
    state = {
      ...makeFusionState(),
      unifiedSlots: state.unifiedSlots,
      // 게이트 튜닝(2026-07-22): 소모수 = 드로우수(배수 1.0)는 왕격에서 성립
      unseongpaeStates: state.unseongpaeStates!.map(u => ({ ...u, gyeok: 'wang' as const })),
    }
    // 융합 2장(a,b) 소모 → 리필(8까지) + 생지 2장 추가 드로우
    const remainAfterPlay = state.hand.length - 2 // 3장 잔여
    state = playCards(state, ['a', 'b'])
    // 리필: max(0, 8-3)=5 → 8장. 생지 추가 2장 → 10장 (덱 충분)
    expect(state.hand.length).toBe(remainAfterPlay + 5 + 2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ 전투 전환 리셋 (묘고 방출 플래그·절지 각성 해제, 격/먹이/묘고 유지)
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ⑥ 전투 전환 리셋', () => {
  it('resetUnseongpaePerFloor — 방출/각성 플래그 리셋, 격·먹이·묘고 유지', () => {
    let state = createInitialGameState(0)
    state = {
      ...state,
      unseongpaeStates: [
        { id: 'myoji', gyeok: 'sang', feed: 3, myogo: [makeCard('m', 'mok', 5)], myogoUsedThisFloor: true },
        { id: 'jeolji', gyeok: 'sang', feed: 2, jeoljiUsed: true, jeoljiAwakenBattle: true },
      ],
      fusionRepeatCount: 4,
      lastFusionSignature: 'mok-hwa',
    }
    const reset = resetUnseongpaePerFloor(state)
    const myoji = reset.unseongpaeStates!.find(u => u.id === 'myoji')!
    const jeolji = reset.unseongpaeStates!.find(u => u.id === 'jeolji')!
    expect(myoji.myogoUsedThisFloor).toBe(false) // 방출 플래그 리셋
    expect(myoji.myogo!.length).toBe(1) // 묘고 내용물 유지
    expect(myoji.feed).toBe(3) // 먹이 유지
    expect(jeolji.jeoljiAwakenBattle).toBe(false) // 각성 해제
    expect(jeolji.jeoljiUsed).toBe(true) // 부활 소진은 런 유지
    expect(reset.fusionRepeatCount).toBe(0) // 반복 추적 리셋
    expect(reset.lastFusionSignature).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⑦ UI 계약 (Lyra §7) — legendary 슬롯에 격/먹이 파생 필드 투영 (수리 검증)
//   엔진 정본은 unseongpaeStates. 슬롯 필드는 UI 읽기전용 스냅샷 — 유령 아님을 assert.
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ⑦ 슬롯 UI 계약 (gyeok/feedCount/feedTarget)', () => {
  it('획득 직후 — legendary 슬롯에 수격·먹이0·목표치가 채워짐', () => {
    const state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'saengji').state
    const slot = state.unifiedSlots.find(s => s.tier === 'legendary' && s.cardId === 'saengji')!
    expect(slot.gyeok).toBe('su')
    expect(slot.feedCount).toBe(0)
    expect(slot.feedTarget).toBe(FEED_THRESHOLDS.saengji[0]) // 다음 격(휴)까지 목표
  })

  it('common/rare 슬롯은 격/먹이 필드 미투영 (undefined)', () => {
    const state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'myoji').state
    for (const s of state.unifiedSlots) {
      if (s.tier !== 'legendary') {
        expect(s.gyeok).toBeUndefined()
        expect(s.feedCount).toBeUndefined()
        expect(s.feedTarget).toBeUndefined()
      }
    }
  })

  it('전투 중 성장 — 융합 먹이 누적이 슬롯 feedCount에 즉시 반영', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'saengji').state
    state = { ...makeFusionState(), unifiedSlots: state.unifiedSlots, unseongpaeStates: state.unseongpaeStates }
    const before = state.unifiedSlots.find(s => s.cardId === 'saengji')!.feedCount ?? 0
    state = playCards(state, ['a', 'b']) // 융합 1회 → 먹이 +1
    const after = state.unifiedSlots.find(s => s.cardId === 'saengji')!.feedCount ?? 0
    expect(after).toBe(before + 1)
    // 엔진 정본(unseongpaeStates)과 슬롯 투영이 일치 (유령 아님)
    expect(after).toBe(getUnseongpaeState(state, 'saengji')!.feed)
  })

  it('왕격 도달 시 feedTarget=undefined (만렙 표기)', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'wangji').state
    state = {
      ...state,
      unseongpaeStates: state.unseongpaeStates!.map(u => ({ ...u, gyeok: 'wang' as const, feed: 0 })),
    }
    // 슬롯 재투영 (resetUnseongpaePerFloor 경유로 sync 트리거)
    state = resetUnseongpaePerFloor(state)
    const slot = state.unifiedSlots.find(s => s.cardId === 'wangji')!
    expect(slot.gyeok).toBe('wang')
    expect(slot.feedTarget).toBeUndefined() // 만렙 = 목표 없음
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⑧ 절지 부활 훅 엔진 내부 이관 실발동 (2026-07-23 배선 수리 c)
//   playCards 내부에서 사망(newPlayerHp<=0) 판정 직후 부활 훅이 실호출되어
//   HP가 부활량으로 복원되고 phase!=result(전투 계속)임을 assert. 유령 측정 금지.
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E ⑧ 절지 부활 훅 엔진 이관 (배선 수리 c)', () => {
  it('엔진 내부 — 융합 반격으로 사망 유도 시 부활 훅 실발동 (HP 복원 + phase!=result)', () => {
    // 절지 상격 장착 + playerHp=1 → 반격(counterDamage=1, 층0) 시 newPlayerHp=0 → 부활 훅 발동.
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'jeolji').state
    state = {
      ...makeFusionState({
        playerHp: 1,          // 반격 1 → newPlayerHp=0 → 사망 판정
        playerMaxHp: 100,
        enemyHp: 9999,        // 적 생존 → floorCleared=false (부활 훅 조건 충족)
        enemyMaxHp: 9999,
      }),
      unifiedSlots: state.unifiedSlots,
      unseongpaeStates: state.unseongpaeStates!.map(u => ({ ...u, gyeok: 'sang' as const })),
    }
    const jeoljiBefore = getUnseongpaeState(state, 'jeolji')!
    expect(jeoljiBefore.jeoljiUsed).toBeFalsy()

    state = playCards(state, ['a', 'b']) // 융합 → 반격 1 → 사망 → 부활 훅

    // 부활 실효값 assert: 상격 부활 HP = round(100 * 0.30) = 30
    const expectedReviveHp = Math.round(100 * JEOLJI_REVIVE_PCT.sang)
    expect(state.playerHp).toBe(expectedReviveHp) // 실효 HP 복원 (유령 아님)
    expect(state.phase).not.toBe('result')          // phase='result' 회피 → 전투 계속
    const jeoljiAfter = getUnseongpaeState(state, 'jeolji')!
    expect(jeoljiAfter.jeoljiUsed).toBe(true)        // 부활 소진 (런당 1회)
    expect(jeoljiAfter.gyeok).toBe('hyu')            // 1격 꺾임 (상→휴)
  })

  it('부활 소진 후 재사망 — 두 번째 사망은 부활 없이 result (런당 1회 준수)', () => {
    let state = acquireUnseongpae({ ...createInitialGameState(0), phase: 'floor-reward' }, 'jeolji').state
    state = {
      ...makeFusionState({ playerHp: 1, playerMaxHp: 100, enemyHp: 9999, enemyMaxHp: 9999 }),
      unifiedSlots: state.unifiedSlots,
      // 이미 부활 소진 상태로 설정 → 재부활 불가
      unseongpaeStates: state.unseongpaeStates!.map(u => ({ ...u, gyeok: 'sang' as const, jeoljiUsed: true })),
    }
    state = playCards(state, ['a', 'b']) // 사망 → 부활 불가
    expect(state.playerHp).toBe(0)        // 부활 없음
    expect(state.phase).toBe('result')    // 사망 확정
  })
})
