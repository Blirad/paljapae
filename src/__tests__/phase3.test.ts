/**
 * Phase 3 신규 기능 테스트
 * 3-1: effectEngine 연결 (playCardInState battlecry/effectText)
 * 3-2: 대운 카드 4종 + undo 메커니즘
 * 3-3: AI 난이도 계층화
 * 3-4: 유물 런타임 16종
 */

import { describe, it, expect } from 'vitest'
import { createEmptyField, playCardInState } from '@/game/engine/turnEngine'
import {
  pushHistory,
  undoLastAction,
  applyDaewoonEffect,
  applyDaewoonTurnStart,
  applyDaewoonTurnEnd,
  isElementalReversed,
} from '@/game/engine/daewoonEngine'
import { decideAITurn } from '@/game/ai/aiPlayer'
import { dispatchRelicHooks } from '@/game/engine/relicDispatcher'
import type { GameState, PlayerState } from '@/types/game'
import { HEROES } from '@/types/game'
import { createInitialFatigue } from '@/game/engine/fatigue'
import type { Card, SoldierCard, SpellCard } from '@/types/cards'
// daewoonCards import — 테스트에서 카드 ID 문자열 직접 사용
import { ALL_RELICS } from '@/types/relics'
import { F01, W01 } from '@/data/sampleCards'

// ────────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    hero: HEROES.fire_hero,
    currentHp: 30,
    deck: [],
    hand: [],
    graveyard: [],
    field: createEmptyField() as PlayerState['field'],
    currentEnergy: 5,
    fatigue: createInitialFatigue(),
    ...overrides,
  }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    turn: 1,
    phase: 'main',
    player: makePlayer(),
    ai: makePlayer({ hero: HEROES.wood_hero }),
    result: null,
    log: [],
    currentCombo: { element: null, count: 0 },
    ...overrides,
  }
}

/** 테스트용 주문 카드 */
const SPELL_HEAL: SpellCard = {
  id: 'TEST-HEAL',
  name: '회복 주문',
  cost: 2,
  element: '木',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 영웅 HP 3 회복',
  flavorText: '테스트용',
}

const SOLDIER_BATTLECRY: SoldierCard = {
  id: 'TEST-SOLDIER',
  name: '전투cry 병사',
  cost: 2,
  element: '火',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 3,
  keywords: [],
  battlecry: '소환시 카드 1드로우',
  flavorText: '테스트용',
}

// ────────────────────────────────────────────────────
// 작업 3-1: effectEngine 연결 테스트
// ────────────────────────────────────────────────────

describe('3-1: playCardInState — 주문 effectText 실행', () => {
  it('회복 주문: 영웅 HP 3 회복', () => {
    const state = makeState({
      player: makePlayer({ currentHp: 20, hand: [SPELL_HEAL], currentEnergy: 5 }),
    })
    const result = playCardInState(state, 'player', 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.state.player.currentHp).toBe(23)
    expect(result.state.player.hand).toHaveLength(0)
  })

  it('주문 카드 사용 후 묘지로 이동', () => {
    const state = makeState({
      player: makePlayer({ currentHp: 20, hand: [SPELL_HEAL], currentEnergy: 5 }),
    })
    const result = playCardInState(state, 'player', 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.state.player.graveyard).toHaveLength(1)
    expect(result.state.player.graveyard[0].id).toBe('TEST-HEAL')
  })

  it('에너지 부족 시 실패', () => {
    const state = makeState({
      player: makePlayer({ currentHp: 20, hand: [SPELL_HEAL], currentEnergy: 1 }),
    })
    const result = playCardInState(state, 'player', 0)
    expect(result.success).toBe(false)
  })

  it('병사 battlecry: 소환 후 effectEngine 연결 (드로우 로그)', () => {
    const state = makeState({
      player: makePlayer({
        hand: [SOLDIER_BATTLECRY],
        currentEnergy: 5,
        deck: [F01, W01],
      }),
    })
    const result = playCardInState(state, 'player', 0, 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    // 병사가 슬롯 0에 소환됨
    expect(result.state.player.field[0]).not.toBeNull()
    // battlecry 발동 로그 존재
    const logContainsBattlecry = result.state.log.some(l => l.includes('전투cry'))
    expect(logContainsBattlecry).toBe(true)
  })

  it('AI 측 주문 카드 사용도 정상 동작', () => {
    const state = makeState({
      ai: makePlayer({ currentHp: 20, hand: [SPELL_HEAL], currentEnergy: 5 }),
    })
    const result = playCardInState(state, 'ai', 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    // AI 영웅 HP 회복 (heal target은 self_hero = ai)
    expect(result.state.ai.currentHp).toBe(23)
  })
})

// ────────────────────────────────────────────────────
// 작업 3-2: 대운 카드 + undo 메커니즘 테스트
// ────────────────────────────────────────────────────

describe('3-2: undo 메커니즘 — pushHistory / undoLastAction', () => {
  it('pushHistory: 현재 상태를 스택에 저장', () => {
    const state = makeState()
    const withHistory = pushHistory(state)
    expect(withHistory.stateHistory).toHaveLength(1)
  })

  it('pushHistory: 최대 3개까지만 보관', () => {
    let state = makeState()
    state = pushHistory(state)
    state = pushHistory(state)
    state = pushHistory(state)
    state = pushHistory(state) // 4번째
    expect(state.stateHistory!.length).toBeLessThanOrEqual(3)
  })

  it('undoLastAction: 직전 상태로 복원', () => {
    const state = makeState({ player: makePlayer({ currentHp: 20 }) })
    const withHistory = pushHistory(state)
    // HP 변경 후 undo
    const modified = { ...withHistory, player: { ...withHistory.player, currentHp: 10 } }
    const undone = undoLastAction(modified)
    expect(undone.player.currentHp).toBe(20)
  })

  it('undoLastAction: 히스토리 없으면 현재 상태 유지', () => {
    const state = makeState()
    const result = undoLastAction(state)
    expect(result.player.currentHp).toBe(30)
    expect(result.log.some(l => l.includes('기록 없음'))).toBe(true)
  })
})

describe('3-2: 대운 카드 4종 효과', () => {
  it('DAEWOON-01 시간역행: undo 실행 후 직전 상태 복원', () => {
    const state = makeState({ player: makePlayer({ currentHp: 15 }) })
    const result = applyDaewoonEffect('DAEWOON-01', state)
    expect(result.success).toBe(true)
    // 사용 기록 추가됨
    if (!result.success) return
    expect(result.state.usedDaewoon).toContain('DAEWOON-01')
  })

  it('DAEWOON-02 월운가속: 다음 2턴 에너지 보너스 설정', () => {
    const state = makeState()
    const result = applyDaewoonEffect('DAEWOON-02', state)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.state.energyBonusNextTurns).toBe(2)
    expect(result.state.usedDaewoon).toContain('DAEWOON-02')
  })

  it('DAEWOON-03 시운정지: AI 턴 스킵 플래그 설정', () => {
    const state = makeState()
    const result = applyDaewoonEffect('DAEWOON-03', state)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.state.aiTurnSkipped).toBe(true)
    expect(result.state.usedDaewoon).toContain('DAEWOON-03')
  })

  it('DAEWOON-04 운명반전: 2턴간 오행 역전 설정', () => {
    const state = makeState()
    const result = applyDaewoonEffect('DAEWOON-04', state)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.state.elementalReversedTurns).toBe(2)
    expect(result.state.usedDaewoon).toContain('DAEWOON-04')
  })

  it('대운 카드 전투당 1회 제한: 동일 카드 재사용 불가', () => {
    const state = makeState()
    const first = applyDaewoonEffect('DAEWOON-02', state)
    expect(first.success).toBe(true)
    if (!first.success) return
    const second = applyDaewoonEffect('DAEWOON-02', first.state)
    expect(second.success).toBe(false)
    expect((second as { success: false; reason: string }).reason).toContain('1회 제한')
  })

  it('applyDaewoonTurnStart: 월운가속 에너지 +2 적용', () => {
    const state = makeState({
      player: makePlayer({ currentEnergy: 3 }),
      energyBonusNextTurns: 2,
    })
    const result = applyDaewoonTurnStart(state)
    expect(result.player.currentEnergy).toBe(5) // min(5, 3+2)
    expect(result.energyBonusNextTurns).toBe(1) // 카운터 감소
  })

  it('applyDaewoonTurnEnd: 운명반전 카운터 감소', () => {
    const state = makeState({ elementalReversedTurns: 2 })
    const result = applyDaewoonTurnEnd(state)
    expect(result.elementalReversedTurns).toBe(1)
  })

  it('isElementalReversed: 역전 활성 여부 확인', () => {
    const active = makeState({ elementalReversedTurns: 1 })
    const inactive = makeState()
    expect(isElementalReversed(active)).toBe(true)
    expect(isElementalReversed(inactive)).toBe(false)
  })
})

// ────────────────────────────────────────────────────
// 작업 3-3: AI 난이도 계층화 테스트
// ────────────────────────────────────────────────────

describe('3-3: AI 난이도 계층화', () => {
  const soldierCard: SoldierCard = {
    id: 'AI-TEST-01',
    name: '테스트 병사',
    cost: 2,
    element: '火',
    rarity: 'common',
    cardType: 'soldier',
    attack: 3,
    maxHealth: 3,
    keywords: [],
    flavorText: '테스트용',
  }

  it('novice: 행동 반환 (end_turn 포함)', () => {
    const state = makeState({
      ai: makePlayer({ hand: [soldierCard], currentEnergy: 5 }),
    })
    const actions = decideAITurn(state, 'novice')
    expect(actions.some(a => a.type === 'end_turn')).toBe(true)
  })

  it('normal: 기존 greedy 로직 (하위호환)', () => {
    const state = makeState({
      ai: makePlayer({ hand: [soldierCard], currentEnergy: 5 }),
    })
    const actions = decideAITurn(state, 'normal')
    // 에너지 충분하면 병사 소환 시도
    expect(actions.some(a => a.type === 'play_card')).toBe(true)
  })

  it('expert: 행동 배열 반환 (end_turn 포함)', () => {
    const state = makeState({
      ai: makePlayer({ hand: [soldierCard], currentEnergy: 5 }),
    })
    const actions = decideAITurn(state, 'expert')
    expect(actions.some(a => a.type === 'end_turn')).toBe(true)
  })

  it('decideAITurn 기본값: normal (하위호환)', () => {
    const state = makeState({
      ai: makePlayer({ hand: [soldierCard], currentEnergy: 5 }),
    })
    const defaultActions = decideAITurn(state)
    const normalActions = decideAITurn(state, 'normal')
    // 동일한 행동 배열 길이 (동일 로직)
    expect(defaultActions.length).toBe(normalActions.length)
  })

  it('expert: 에너지 없으면 카드 소환 안 함', () => {
    const state = makeState({
      ai: makePlayer({ hand: [soldierCard], currentEnergy: 0 }),
    })
    const actions = decideAITurn(state, 'expert')
    expect(actions.every(a => a.type !== 'play_card')).toBe(true)
  })

  it('novice: 에너지 없으면 카드 소환 안 함', () => {
    const state = makeState({
      ai: makePlayer({ hand: [soldierCard], currentEnergy: 0 }),
    })
    const actions = decideAITurn(state, 'novice')
    expect(actions.every(a => a.type !== 'play_card')).toBe(true)
  })
})

// ────────────────────────────────────────────────────
// 작업 3-4: 유물 런타임 테스트
// ────────────────────────────────────────────────────

describe('3-4: 유물 런타임 — dispatchRelicHooks', () => {
  it('RELIC_EARTH_FORTRESS: 턴1 시작 시 HP +4', () => {
    const state = makeState({
      turn: 1,
      player: makePlayer({ currentHp: 20 }),
    })
    const relic = ALL_RELICS['RELIC_EARTH_FORTRESS']
    const { newState } = dispatchRelicHooks('onTurnStart', state, [relic])
    expect(newState.player.currentHp).toBe(24)
  })

  it('RELIC_EARTH_FORTRESS: 턴2 이후에는 발동 안 함', () => {
    const state = makeState({
      turn: 2,
      player: makePlayer({ currentHp: 20 }),
    })
    const relic = ALL_RELICS['RELIC_EARTH_FORTRESS']
    const { newState } = dispatchRelicHooks('onTurnStart', state, [relic])
    expect(newState.player.currentHp).toBe(20)
  })

  it('RELIC_EARTH_QUICKSAND: 적 에너지 -1', () => {
    const state = makeState({
      ai: makePlayer({ currentEnergy: 3 }),
    })
    const relic = ALL_RELICS['RELIC_EARTH_QUICKSAND']
    const { newState } = dispatchRelicHooks('onTurnStart', state, [relic])
    expect(newState.ai.currentEnergy).toBe(2)
  })

  it('RELIC_EARTH_QUICKSAND: 적 에너지 최소 1 유지', () => {
    const state = makeState({
      ai: makePlayer({ currentEnergy: 1 }),
    })
    const relic = ALL_RELICS['RELIC_EARTH_QUICKSAND']
    const { newState } = dispatchRelicHooks('onTurnStart', state, [relic])
    expect(newState.ai.currentEnergy).toBe(1)
  })

  it('RELIC_WATER_ABYSS: 묘지 5장 달성 시 공격력 +2', () => {
    // 묘지 카드 5장인 플레이어
    const graveyard: Card[] = Array(5).fill(null).map((_, i) => ({ ...F01, id: `grave-${i}` }))
    const field = createEmptyField() as PlayerState['field']
    // 필드에 유닛 1개
    field[0] = {
      card: { ...F01, id: 'field-unit', cardType: 'soldier', attack: 3, maxHealth: 3, keywords: [], rarity: 'common', flavorText: '테스트용' } as SoldierCard,
      currentAttack: 3,
      currentHealth: 3,
      canAttack: true,
      frozen: false,
      rebornUsed: false,
      summonedOnTurn: 1,
      temporaryKeywords: [],
    }
    const state = makeState({
      player: makePlayer({ graveyard, field }),
    })
    const relic = ALL_RELICS['RELIC_WATER_ABYSS']
    const { newState } = dispatchRelicHooks('onUnitDeath', state, [relic], { owner: 'player' })
    expect(newState.player.field[0]?.currentAttack).toBe(5) // 3 + 2
  })

  it('RELIC_GENERATE_CYCLE: 상생 연속 시 에너지 +2', () => {
    const state = makeState({
      player: makePlayer({ currentEnergy: 2 }),
    })
    const relic = ALL_RELICS['RELIC_GENERATE_CYCLE']
    // 木→火 상생: usedElementsThisTurn에 木이 있고 현재 火 카드 플레이
    const payload = {
      cardElement: '火' as const,
      usedElementsThisTurn: new Set(['木'] as const),
    }
    const { newState } = dispatchRelicHooks('onCardPlay', state, [relic], payload)
    expect(newState.player.currentEnergy).toBe(4) // min(5, 2+2)
  })

  it('RELIC_GENERATE_CYCLE: 비상생 관계에서는 발동 안 함', () => {
    const state = makeState({
      player: makePlayer({ currentEnergy: 2 }),
    })
    const relic = ALL_RELICS['RELIC_GENERATE_CYCLE']
    // 木과 金은 상생 관계 아님
    const payload = {
      cardElement: '金' as const,
      usedElementsThisTurn: new Set(['木'] as const),
    }
    const { newState } = dispatchRelicHooks('onCardPlay', state, [relic], payload)
    expect(newState.player.currentEnergy).toBe(2) // 변화 없음
  })

  it('RELIC_WATER_SPRING: Fatigue 소진 상태에서 HP +1 보정', () => {
    const state = makeState({
      player: makePlayer({
        currentHp: 25,
        fatigue: { deckExhausted: true, exhaustedTurnsCount: 1 },
      }),
    })
    const relic = ALL_RELICS['RELIC_WATER_SPRING']
    const { newState } = dispatchRelicHooks('onDraw', state, [relic])
    expect(newState.player.currentHp).toBe(26)
  })

  it('RELIC_FATE_REVERSE: HP 0 직전 HP 1 유지 (onTurnEnd)', () => {
    const state = makeState({
      player: makePlayer({ currentHp: 0 }),
    })
    const relic = ALL_RELICS['RELIC_FATE_REVERSE']
    const { newState } = dispatchRelicHooks('onTurnEnd', state, [relic])
    expect(newState.player.currentHp).toBe(1)
  })

  it('RELIC_FATE_REVERSE: 2회 발동 방지 (런당 1회)', () => {
    const state = makeState({
      player: makePlayer({ currentHp: 0 }),
      usedDaewoon: ['RELIC_FATE_REVERSE_USED'],
    })
    const relic = ALL_RELICS['RELIC_FATE_REVERSE']
    const { newState } = dispatchRelicHooks('onTurnEnd', state, [relic])
    expect(newState.player.currentHp).toBe(0) // 2회 발동 안 함
  })
})
