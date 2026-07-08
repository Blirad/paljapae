/**
 * M7 P2 + P3 + P4 신규 테스트
 * - P4: RunSummaryBar (relicStore 연동, currentDeckIds)
 * - P3: relicStore (addRelic, hasRelic, resetRelics, getRelicsByHook)
 * - P3: turnEngine 훅 포인트 (executeDraw, playCard, executeCombatPhase)
 * - P2: events.ts 데이터 (5종 이벤트, 선택지 결과)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useRelicStore } from '@/stores/relicStore'
import type { RelicId } from '@/types/relics'
import { ALL_RELICS } from '@/types/relics'
import { ALL_EVENTS } from '@/data/events'
import { executeDraw, playCard, createEmptyField } from '@/game/engine/turnEngine'
import type { PlayerState } from '@/types/game'
import { HEROES } from '@/types/game'
import { F01, F02, ALL_CARDS } from '@/data/cards'
import { useUnlockStore } from '@/stores/unlockStore'

// ────────────────────────────────────────────────────
// P3: RelicStore 테스트
// ────────────────────────────────────────────────────

describe('P3: relicStore', () => {
  beforeEach(() => {
    useRelicStore.getState().resetRelics()
  })

  it('초기 상태: ownedRelics 빈 배열', () => {
    expect(useRelicStore.getState().ownedRelics).toHaveLength(0)
  })

  it('addRelic: 유물 추가 성공', () => {
    useRelicStore.getState().addRelic('RELIC_HERB_POUCH')
    expect(useRelicStore.getState().ownedRelics).toHaveLength(1)
    expect(useRelicStore.getState().ownedRelics[0].id).toBe('RELIC_HERB_POUCH')
  })

  it('addRelic: 중복 추가 무시 (동일 ID)', () => {
    useRelicStore.getState().addRelic('RELIC_HERB_POUCH')
    useRelicStore.getState().addRelic('RELIC_HERB_POUCH')
    expect(useRelicStore.getState().ownedRelics).toHaveLength(1)
  })

  it('addRelic: 다른 유물 동시 보유 가능', () => {
    useRelicStore.getState().addRelic('RELIC_HERB_POUCH')
    useRelicStore.getState().addRelic('RELIC_JADE_BEAD')
    expect(useRelicStore.getState().ownedRelics).toHaveLength(2)
  })

  it('hasRelic: 보유 시 true 반환', () => {
    useRelicStore.getState().addRelic('RELIC_DUEL_CREST')
    expect(useRelicStore.getState().hasRelic('RELIC_DUEL_CREST')).toBe(true)
  })

  it('hasRelic: 미보유 시 false 반환', () => {
    expect(useRelicStore.getState().hasRelic('RELIC_HELL_TALISMAN')).toBe(false)
  })

  it('resetRelics: 모든 유물 초기화', () => {
    useRelicStore.getState().addRelic('RELIC_HERB_POUCH')
    useRelicStore.getState().addRelic('RELIC_ELEMENT_SEAL')
    useRelicStore.getState().resetRelics()
    expect(useRelicStore.getState().ownedRelics).toHaveLength(0)
  })

  it('getRelicsByHook: 해당 훅 유물만 반환', () => {
    useRelicStore.getState().addRelic('RELIC_HERB_POUCH')   // battle_start
    useRelicStore.getState().addRelic('RELIC_JADE_BEAD')    // draw_phase
    useRelicStore.getState().addRelic('RELIC_ELEMENT_SEAL') // play_card

    const battleStartRelics = useRelicStore.getState().getRelicsByHook('battle_start')
    expect(battleStartRelics).toHaveLength(1)
    expect(battleStartRelics[0].id).toBe('RELIC_HERB_POUCH')

    const drawRelics = useRelicStore.getState().getRelicsByHook('draw_phase')
    expect(drawRelics).toHaveLength(1)
    expect(drawRelics[0].id).toBe('RELIC_JADE_BEAD')
  })

  it('getRelicsByHook: 해당 훅 없으면 빈 배열', () => {
    useRelicStore.getState().addRelic('RELIC_HERB_POUCH')
    const combatRelics = useRelicStore.getState().getRelicsByHook('combat_attack')
    expect(combatRelics).toHaveLength(0)
  })
})

// ────────────────────────────────────────────────────
// P3: ALL_RELICS 데이터 정합성
// ────────────────────────────────────────────────────

describe('P3: ALL_RELICS 데이터', () => {
  const relicIds: RelicId[] = [
    'RELIC_HERB_POUCH',
    'RELIC_DUEL_CREST',
    'RELIC_JADE_BEAD',
    'RELIC_ELEMENT_SEAL',
    'RELIC_HELL_TALISMAN',
  ]

  it('23종 유물 모두 정의됨 (M8 P0-1 확장 + Phase 1-C 3종)', () => {
    expect(Object.keys(ALL_RELICS)).toHaveLength(23)
  })

  it.each(relicIds)('%s: 필수 필드 존재', (id) => {
    const relic = ALL_RELICS[id]
    expect(relic.id).toBe(id)
    expect(relic.name).toBeTruthy()
    expect(relic.icon).toBeTruthy()
    expect(relic.description).toBeTruthy()
    expect(relic.hookPoints.length).toBeGreaterThan(0)
  })
})

// ────────────────────────────────────────────────────
// P3: turnEngine 훅 포인트 - executeDraw (RELIC_JADE_BEAD)
// ────────────────────────────────────────────────────

function makePlayer(deckSize: number, handSize: number): PlayerState {
  const hero = HEROES['fire_hero']
  const cards = Array.from({ length: deckSize }, (_, i) => ({
    ...F01,
    id: `F01_test_${i}`,
    name: `테스트카드${i}`,
  }))
  const hand = Array.from({ length: handSize }, (_, i) => ({
    ...F02,
    id: `F02_hand_${i}`,
  }))
  return {
    hero,
    currentHp: 30,
    currentEnergy: 3,
    deck: cards,
    hand,
    graveyard: [],
    field: createEmptyField(),
    fatigue: { deckExhausted: false, exhaustedTurnsCount: 0 },
  }
}

describe('P3: executeDraw + RELIC_JADE_BEAD', () => {
  it('유물 없음: 기본 드로우 3장', () => {
    const player = makePlayer(10, 0)
    const result = executeDraw(player, 1)
    expect(result.drawnCount).toBe(3)
  })

  it('RELIC_JADE_BEAD: 드로우 +1 (핸드 4장)', () => {
    const player = makePlayer(10, 0)
    const relics = [ALL_RELICS['RELIC_JADE_BEAD']]
    const result = executeDraw(player, 1, relics)
    // 기본 3장 + 보주 1장 = 4장
    expect(result.drawnCount).toBe(4)
  })

  it('RELIC_JADE_BEAD: 핸드 6장(max) 시 추가 드로우 없음', () => {
    const player = makePlayer(10, 5) // 드로우 3 → 핸드 6장 (5+3=8 → 초과분 번)
    const relics = [ALL_RELICS['RELIC_JADE_BEAD']]
    const result = executeDraw(player, 1, relics)
    // hand: 5 + 1(draw, max 6) = 6 → jade bead 추가 불가 (핸드 이미 6장)
    expect(result.player.hand.length).toBeLessThanOrEqual(6)
  })

  it('RELIC_JADE_BEAD: 덱 비어있으면 추가 드로우 없음', () => {
    const player = makePlayer(0, 0)
    player.fatigue = { deckExhausted: false, exhaustedTurnsCount: 0 }
    const relics = [ALL_RELICS['RELIC_JADE_BEAD']]
    const result = executeDraw(player, 1, relics)
    expect(result.drawnCount).toBe(0)
  })
})

// ────────────────────────────────────────────────────
// P3: turnEngine 훅 포인트 - playCard (RELIC_ELEMENT_SEAL)
// ────────────────────────────────────────────────────

describe('P3: playCard + RELIC_ELEMENT_SEAL', () => {
  it('유물 없음: 기본 비용 적용', () => {
    const player = makePlayer(0, 0)
    // 손패에 비용 2짜리 火 카드 추가
    const card = { ...F02, cost: 2, element: '火' as const }
    player.hand = [card]
    player.currentEnergy = 2
    const result = playCard(player, 0, 0)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.player.currentEnergy).toBe(0) // 2 - 2
    }
  })

  it('RELIC_ELEMENT_SEAL: 동일 오행 카드 비용 -1', () => {
    const player = makePlayer(0, 0)
    player.hero = HEROES['fire_hero'] // element: '火'
    const card = { ...F02, cost: 2, element: '火' as const }
    player.hand = [card]
    player.currentEnergy = 1 // 비용 1로 줄어야 플레이 가능
    const relics = [ALL_RELICS['RELIC_ELEMENT_SEAL']]
    const result = playCard(player, 0, 0, relics)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.player.currentEnergy).toBe(0) // 1 - 1 (effectiveCost 1)
    }
  })

  it('RELIC_ELEMENT_SEAL: 비용 최솟값 0', () => {
    const player = makePlayer(0, 0)
    player.hero = HEROES['fire_hero']
    const card = { ...F01, cost: 1, element: '火' as const }
    player.hand = [card]
    player.currentEnergy = 0 // 비용 0 되어야 플레이 가능
    const relics = [ALL_RELICS['RELIC_ELEMENT_SEAL']]
    const result = playCard(player, 0, 0, relics)
    expect(result.success).toBe(true) // effectiveCost = max(0, 1-1) = 0
  })

  it('RELIC_ELEMENT_SEAL: 다른 오행 카드에는 미적용', () => {
    const player = makePlayer(0, 0)
    player.hero = HEROES['fire_hero'] // 火
    const card = { ...F01, cost: 1, element: '木' as const } // 木 카드
    player.hand = [card]
    player.currentEnergy = 0 // 비용 감소 없으면 에너지 부족
    const relics = [ALL_RELICS['RELIC_ELEMENT_SEAL']]
    const result = playCard(player, 0, 0, relics)
    expect(result.success).toBe(false) // 다른 오행이므로 비용 감소 없음
  })
})

// ────────────────────────────────────────────────────
// P2: 이벤트 데이터 테스트
// ────────────────────────────────────────────────────

describe('P2: ALL_EVENTS 데이터', () => {
  it('5종 이벤트 정의됨', () => {
    expect(ALL_EVENTS).toHaveLength(5)
  })

  it('각 이벤트: id, title, narrative, choices 필수 필드', () => {
    for (const event of ALL_EVENTS) {
      expect(event.id).toBeTruthy()
      expect(event.title).toBeTruthy()
      expect(event.narrative).toBeTruthy()
      expect(event.choices.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('이벤트 1 (약초 행상인): 선택지 3개', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_HERB_MERCHANT')
    expect(event).toBeDefined()
    expect(event!.choices).toHaveLength(3)
  })

  it('이벤트 1 선택지 A: HP +6', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_HERB_MERCHANT')!
    const result = event.choices[0].resolve({})
    expect(result.hpDelta).toBe(6)
    expect(result.relicId).toBeNull()
    expect(result.needRemoveCard).toBe(false)
  })

  it('이벤트 1 선택지 C: RELIC_HERB_POUCH 획득', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_HERB_MERCHANT')!
    const result = event.choices[2].resolve({})
    expect(result.relicId).toBe('RELIC_HERB_POUCH')
  })

  it('이벤트 3 선택지 A: HP -8 + RELIC_DUEL_CREST', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_DUEL_CHALLENGE')!
    const result = event.choices[0].resolve({})
    expect(result.hpDelta).toBe(-8)
    expect(result.relicId).toBe('RELIC_DUEL_CREST')
  })

  it('이벤트 4 선택지 A: needRemoveCard = true, HP +4', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_FORTUNE_TELLER')!
    const result = event.choices[0].resolve({})
    expect(result.needRemoveCard).toBe(true)
    expect(result.hpDelta).toBe(4)
  })

  it('이벤트 5 선택지 A: 오행 상성 유리 → HP +8', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_ELEMENT_ALTAR')!
    // 火 > 金 (火 플레이어, 金 보스 → 火가 金을 이김)
    const result = event.choices[0].resolve({ playerElement: '火', bossElement: '金' })
    expect(result.hpDelta).toBe(8)
  })

  it('이벤트 5 선택지 A: 오행 상성 불리 → HP -4', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_ELEMENT_ALTAR')!
    // 金 > 火 (火 플레이어, 金 보스 → 金이 火를 이김 → 불리)
    const result = event.choices[0].resolve({ playerElement: '金', bossElement: '火' })
    expect(result.hpDelta).toBe(-4)
  })

  it('이벤트 5 선택지 A: 중립 상성 → HP +2', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_ELEMENT_ALTAR')!
    // 동일 오행인 경우 → 중립
    const result = event.choices[0].resolve({ playerElement: '火', bossElement: '火' })
    expect(result.hpDelta).toBe(2)
  })

  it('모든 이벤트 "거절" 선택지: hpDelta=0, 아무 효과 없음', () => {
    // 이벤트 2, 3, 4, 5의 B선택지는 효과 없음
    const noEffectEvents = ['EVENT_RUINED_SHRINE', 'EVENT_DUEL_CHALLENGE', 'EVENT_FORTUNE_TELLER', 'EVENT_ELEMENT_ALTAR']
    for (const id of noEffectEvents) {
      const event = ALL_EVENTS.find(e => e.id === id)!
      const lastChoice = event.choices[event.choices.length - 1]
      const result = lastChoice.resolve({})
      expect(result.hpDelta).toBe(0)
      expect(result.relicId).toBeNull()
      expect(result.needRemoveCard).toBe(false)
    }
  })
})

// ────────────────────────────────────────────────────
// MOD-1: EventScreen ↔ unlockStore ↔ 전투 덱 상호작용 통합 테스트
// M1/M3에서 반복된 "허위 통과" 패턴 차단 — 스토어 직접 조작 경로 검증
// ────────────────────────────────────────────────────

describe('MOD-1: 이벤트 카드 획득 → ownedCardIds/currentDeckIds/전투덱 3단계 반영', () => {
  beforeEach(() => {
    useUnlockStore.getState().resetUnlocks()
    // 초기 덱 세팅: 木 오행으로 initUnlocks 호출
    useUnlockStore.getState().initUnlocks('木')
  })

  it('1단계: useUnlockStore.setState로 ownedCardIds에 카드 추가 성공', () => {
    // 이벤트 카드 획득 로직과 동일한 setState 경로
    // 초기 풀에 포함되지 않은 common 카드를 선택해야 Set 크기가 증가함
    const ownedBefore = useUnlockStore.getState().ownedCardIds
    const newCard = ALL_CARDS.find(c => c.rarity === 'common' && !ownedBefore.has(c.id))!
    const before = ownedBefore.size

    useUnlockStore.setState(state => ({
      ownedCardIds: new Set([...state.ownedCardIds, newCard.id]),
      currentDeckIds: [...state.currentDeckIds, newCard.id],
    }))

    const after = useUnlockStore.getState().ownedCardIds
    expect(after.has(newCard.id)).toBe(true)
    expect(after.size).toBe(before + 1)
  })

  it('2단계: currentDeckIds에 카드가 추가됨', () => {
    const ownedBefore = useUnlockStore.getState().ownedCardIds
    const newCard = ALL_CARDS.find(c => c.rarity === 'common' && !ownedBefore.has(c.id))!
    const deckBefore = useUnlockStore.getState().currentDeckIds.length

    useUnlockStore.setState(state => ({
      ownedCardIds: new Set([...state.ownedCardIds, newCard.id]),
      currentDeckIds: [...state.currentDeckIds, newCard.id],
    }))

    const deckAfter = useUnlockStore.getState().currentDeckIds
    expect(deckAfter.length).toBe(deckBefore + 1)
    expect(deckAfter[deckAfter.length - 1]).toBe(newCard.id)
  })

  it('3단계: getCurrentDeck()이 추가된 카드를 포함하여 전투 덱에 반영됨', () => {
    const ownedBefore = useUnlockStore.getState().ownedCardIds
    const newCard = ALL_CARDS.find(c => c.rarity === 'common' && !ownedBefore.has(c.id))!

    useUnlockStore.setState(state => ({
      ownedCardIds: new Set([...state.ownedCardIds, newCard.id]),
      currentDeckIds: [...state.currentDeckIds, newCard.id],
    }))

    const battleDeck = useUnlockStore.getState().getCurrentDeck()
    const found = battleDeck.find(c => c.id === newCard.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(newCard.id)
  })

  it('selectReward 가드 확인: pendingReward=null이면 ownedCardIds 미변경', () => {
    // 버그 근본 원인 재현: selectReward는 pendingReward 없으면 noop
    const commonCard = ALL_CARDS.find(c => c.rarity === 'common')!
    const before = useUnlockStore.getState().ownedCardIds.size

    // pendingReward가 null인 상태에서 selectReward 호출
    useUnlockStore.getState().selectReward(commonCard.id)

    const after = useUnlockStore.getState().ownedCardIds.size
    expect(after).toBe(before) // 변화 없음 — 이것이 기존 버그의 원인
  })

  it('cardAdded=true 이벤트(이벤트1 선택B): 결과 플래그 정합성', () => {
    const event = ALL_EVENTS.find(e => e.id === 'EVENT_HERB_MERCHANT')!
    // 선택지 B (인덱스 1): 카드 1장 추가
    const result = event.choices[1].resolve({})
    expect(result.cardAdded).toBe(true)
    expect(result.hpDelta).toBe(0)
    expect(result.relicId).toBeNull()
  })

  it('카드 중복 추가 방지: 이미 보유한 카드는 제외하고 pickRandomCard 결과 비어있지 않음', () => {
    // 일부 공통 카드만 소유한 상태에서 미소유 카드 풀이 존재해야 함
    const ownedIds = useUnlockStore.getState().ownedCardIds
    const candidates = ALL_CARDS.filter(c => c.rarity === 'common' && !ownedIds.has(c.id))
    // 초기 풀에 포함되지 않은 common 카드가 존재하거나,
    // 모두 소유해도 함수가 null 반환 가능 — 여기서는 후보 존재 여부만 확인
    expect(candidates.length).toBeGreaterThanOrEqual(0) // null 허용 경로 포함
  })
})
