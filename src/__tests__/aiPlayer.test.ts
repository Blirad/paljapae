/**
 * AI 플레이어 단위 테스트 — M3
 * AI가 유효한 수를 두는지 검증
 */

import { describe, it, expect } from 'vitest'
import { decideAITurn } from '@/game/ai/aiPlayer'
import type { GameState, PlayerState } from '@/types/game'
import { HEROES, ENERGY_CAP } from '@/types/game'
import type { FieldUnit, SoldierCard } from '@/types/cards'
import { createInitialFatigue } from '@/game/engine/fatigue'
import { createEmptyField } from '@/game/engine/turnEngine'
import { F01, F03, T01, G01 } from '@/data/sampleCards'

// ────────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────────

function makeUnit(card: SoldierCard, canAttack = true, frozen = false): FieldUnit {
  return {
    card,
    currentHealth: card.maxHealth,
    currentAttack: card.attack,
    canAttack,
    frozen,
    rebornUsed: false,
    summonedOnTurn: 1,
    temporaryKeywords: [],
  }
}

function makeState(
  aiHand: SoldierCard[],
  aiField: (FieldUnit | null)[],
  playerField: (FieldUnit | null)[],
  aiEnergy = ENERGY_CAP,
): GameState {
  const ai: PlayerState = {
    hero: HEROES.fire_hero,
    currentHp: 30,
    deck: [],
    hand: aiHand,
    graveyard: [],
    field: [...aiField, ...Array(4 - aiField.length).fill(null)] as PlayerState['field'],
    currentEnergy: aiEnergy,
    fatigue: createInitialFatigue(),
  }
  const player: PlayerState = {
    hero: HEROES.earth_hero,
    currentHp: 30,
    deck: [],
    hand: [],
    graveyard: [],
    field: [...playerField, ...Array(4 - playerField.length).fill(null)] as PlayerState['field'],
    currentEnergy: 5,
    fatigue: createInitialFatigue(),
  }
  return {
    turn: 3,
    phase: 'ai_turn',
    player,
    ai,
    result: null,
    log: [],
  }
}

// ────────────────────────────────────────────────────
// 테스트: AI 기본 행동
// ────────────────────────────────────────────────────

describe('decideAITurn() — 기본 유효성', () => {
  it('항상 end_turn 액션으로 마무리한다', () => {
    const state = makeState([], [], [])
    const actions = decideAITurn(state)
    expect(actions[actions.length - 1].type).toBe('end_turn')
  })

  it('빈 필드 + 카드 있음: play_card 액션 포함', () => {
    const state = makeState([F01], [], []) // 에너지 5, 카드 비용 1
    const actions = decideAITurn(state)
    const playCounts = actions.filter(a => a.type === 'play_card').length
    expect(playCounts).toBeGreaterThan(0)
  })

  it('에너지 부족 시 비용 초과 카드 소환 안 함', () => {
    const state = makeState([F03], [], [], 1) // F03 비용 3, 에너지 1
    const actions = decideAITurn(state)
    const playCards = actions.filter(a => a.type === 'play_card')
    expect(playCards.length).toBe(0)
  })

  it('공격 가능한 유닛이 있으면 attack 액션 포함', () => {
    const attacker = makeUnit(F01, true) // canAttack: true
    const target = makeUnit(T01, false)
    const state = makeState([], [attacker], [target])
    const actions = decideAITurn(state)
    const attackActions = actions.filter(a => a.type === 'attack')
    expect(attackActions.length).toBeGreaterThan(0)
  })

  it('동결된 유닛은 공격 액션 생성 안 함', () => {
    const frozenUnit = makeUnit(F01, true, true) // frozen: true
    const target = makeUnit(T01, false)
    const state = makeState([], [frozenUnit], [target])
    const actions = decideAITurn(state)
    const attackActions = actions.filter(a => a.type === 'attack')
    expect(attackActions.length).toBe(0)
  })

  it('canAttack=false인 유닛은 attack 액션 안 만듦', () => {
    const exhaustedUnit = makeUnit(F01, false) // canAttack: false
    const target = makeUnit(T01, false)
    const state = makeState([], [exhaustedUnit], [target])
    const actions = decideAITurn(state)
    const attackActions = actions.filter(a => a.type === 'attack')
    expect(attackActions.length).toBe(0)
  })

  it('적 필드 비어있으면 영웅 직접 공격 (targetIndex: -1)', () => {
    const attacker = makeUnit(F01, true)
    const state = makeState([], [attacker], []) // 플레이어 필드 빔
    const actions = decideAITurn(state)
    const heroAttack = actions.find(a => a.type === 'attack' && a.targetIndex === -1)
    expect(heroAttack).toBeDefined()
  })

  it('관통(pierce) 유닛은 도발 유닛 있어도 영웅 공격 (targetIndex: -1)', () => {
    const pierceUnit = makeUnit(G01, true) // G01: pierce
    const tauntUnit = makeUnit(T01, false) // T01: taunt
    const state = makeState([], [pierceUnit], [tauntUnit])
    const actions = decideAITurn(state)
    const heroAttack = actions.find(a => a.type === 'attack' && a.targetIndex === -1)
    expect(heroAttack).toBeDefined()
  })

  it('도발 유닛 있으면 도발 유닛 타겟 (관통 없는 경우)', () => {
    const normalUnit = makeUnit(F01, true) // 관통 없음
    const tauntUnit = makeUnit(T01, false) // taunt
    const nonTauntTarget = makeUnit(F01, false)
    const state = makeState([], [normalUnit], [tauntUnit, nonTauntTarget])
    const actions = decideAITurn(state)
    const attackAction = actions.find(a => a.type === 'attack')
    // 타겟이 taunt 유닛 슬롯(0)이어야 함
    expect(attackAction?.targetIndex).toBe(0)
  })

  it('play_card 액션의 cardIndex가 유효한 핸드 인덱스', () => {
    const state = makeState([F01, F01], [], [])
    const actions = decideAITurn(state)
    const playCards = actions.filter(a => a.type === 'play_card')
    for (const action of playCards) {
      expect(action.cardIndex).toBeGreaterThanOrEqual(0)
      expect(action.cardIndex).toBeLessThan(2)
    }
  })

  it('필드 가득 찼을 때 추가 소환 안 함', () => {
    const fullField = [
      makeUnit(F01, false),
      makeUnit(F01, false),
      makeUnit(F01, false),
      makeUnit(F01, false),
    ]
    const state = makeState([F01], fullField, [])
    const actions = decideAITurn(state)
    const playCards = actions.filter(a => a.type === 'play_card')
    expect(playCards.length).toBe(0)
  })
})

// ────────────────────────────────────────────────────
// 테스트: 배틀 스토어 통합
// ────────────────────────────────────────────────────

describe('battleStore — 초기화', () => {
  it('initBattle 후 gameState가 null이 아님', async () => {
    const { useBattleStore } = await import('@/game/store/battleStore')
    const store = useBattleStore.getState()
    store.initBattle('fire_hero', [F01, F01, F01], 'earth_hero', [T01, T01, T01])
    const { gameState } = useBattleStore.getState()
    expect(gameState).not.toBeNull()
    expect(gameState?.player.hero.id).toBe('fire_hero')
    expect(gameState?.ai.hero.id).toBe('earth_hero')
    expect(gameState?.phase).toBe('main')
  })

  it('카드 선택 시 interaction이 card_selected로 바뀜', async () => {
    const { useBattleStore } = await import('@/game/store/battleStore')
    const store = useBattleStore.getState()
    store.initBattle('fire_hero', [F01, F01, F01], 'earth_hero', [T01, T01, T01])

    const gs = useBattleStore.getState().gameState
    expect(gs).not.toBeNull()

    if (gs && gs.player.currentEnergy >= 1) {
      store.selectCard(0)
      const { interaction } = useBattleStore.getState()
      expect(interaction).toBe('card_selected')
    }
  })

  it('소환 성공 시 필드에 유닛 등록됨', async () => {
    const { useBattleStore } = await import('@/game/store/battleStore')
    const store = useBattleStore.getState()
    store.initBattle('fire_hero', [F01, F01, F01], 'earth_hero', [T01, T01, T01])

    const gs0 = useBattleStore.getState().gameState!
    useBattleStore.setState({
      gameState: { ...gs0, player: { ...gs0.player, currentEnergy: 5 } },
    })

    store.selectCard(0)
    const err = store.summonCard(0)
    expect(err).toBeNull()

    const afterGs = useBattleStore.getState().gameState!
    expect(afterGs.player.field[0]).not.toBeNull()
  })
})

// ────────────────────────────────────────────────────
// 테스트: createEmptyField (기존 엔진 회귀)
// ────────────────────────────────────────────────────

describe('createEmptyField() — 회귀 테스트', () => {
  it('4개의 null 슬롯을 생성한다', () => {
    const field = createEmptyField()
    expect(field).toHaveLength(4)
    expect(field.every(s => s === null)).toBe(true)
  })
})

// ────────────────────────────────────────────────────
// CRIT-1 회귀 테스트: rush 유닛 소환 후 즉시 공격 생성
// ────────────────────────────────────────────────────

describe('[CRIT-1] rush 유닛 소환 후 AI 공격 단계 — 소환된 필드 참조', () => {
  it('rush 카드를 핸드에서 소환하면 AI 행동에 attack 액션이 포함된다', () => {
    // F01: rush 키워드 보유, AI 필드 비어있음 → 소환 후 즉시 공격 가능해야 함
    const state = makeState([F01], [], [makeUnit(T01, false)])
    const actions = decideAITurn(state)
    // play_card 다음에 attack 액션이 있어야 함
    const playIdx = actions.findIndex(a => a.type === 'play_card')
    const attackIdx = actions.findIndex(a => a.type === 'attack')
    expect(playIdx).toBeGreaterThanOrEqual(0)
    expect(attackIdx).toBeGreaterThan(playIdx) // 소환 후 공격
  })

  it('rush 유닛을 소환한 슬롯의 공격이 end_turn 전에 나온다', () => {
    const state = makeState([F01], [], [makeUnit(T01, false)])
    const actions = decideAITurn(state)
    const endTurnIdx = actions.findIndex(a => a.type === 'end_turn')
    const attackIdx = actions.findIndex(a => a.type === 'attack')
    expect(attackIdx).toBeGreaterThanOrEqual(0)
    expect(attackIdx).toBeLessThan(endTurnIdx)
  })

  it('rush 없는 카드를 소환하면 attack 액션이 포함되지 않는다 (T01: no rush)', () => {
    const state = makeState([T01], [], [makeUnit(F01, false)])
    const actions = decideAITurn(state)
    const attackActions = actions.filter(a => a.type === 'attack')
    // T01은 rush 없음 — 소환 턴에 canAttack=false이므로 attack 없어야 함
    expect(attackActions.length).toBe(0)
  })
})

// ────────────────────────────────────────────────────
// CRIT-2 회귀 테스트: AI Fatigue 사망 시 즉시 판정
// ────────────────────────────────────────────────────

describe('[CRIT-2] AI Fatigue 사망 즉시 판정 — battleStore 통합', () => {
  it('endPlayerTurn 후 AI가 Fatigue로 HP 0이 되면 gameState.result가 설정된다', async () => {
    const { useBattleStore } = await import('@/game/store/battleStore')
    const { createInitialFatigue: cif } = await import('@/game/engine/fatigue')
    const store = useBattleStore.getState()

    // 양측 덱 소진 + AI HP를 Fatigue 1 피해로 사망 직전으로 설정
    store.initBattle('fire_hero', [F01], 'earth_hero', [T01])
    const gs = useBattleStore.getState().gameState!

    // AI HP를 1로, 덱을 비워 Fatigue 1 피해로 사망하는 상태 조작
    const fatigue = { ...cif(), exhaustedTurnsCount: 0, isExhausted: true }
    useBattleStore.setState({
      gameState: {
        ...gs,
        turn: 2,
        phase: 'main',
        player: { ...gs.player, hand: [], deck: [] },
        ai: { ...gs.ai, currentHp: 1, deck: [], fatigue },
      },
    })

    await useBattleStore.getState().endPlayerTurn()

    const afterGs = useBattleStore.getState().gameState
    // AI HP 0 → result가 null이 아니어야 함 (player_win)
    expect(afterGs?.result).not.toBeNull()
    expect(afterGs?.result).toBe('player_win')
  })
})

// ────────────────────────────────────────────────────
// CRIT-3 회귀 테스트: AI incinerate temporaryKeywords 처리
// ────────────────────────────────────────────────────

describe('[CRIT-3] AI 공격 incinerate temporaryKeywords 비대칭 — battleStore 통합', () => {
  it('AI 유닛이 temporaryKeywords incinerate를 보유한 상태에서 적 reborn 유닛 공격 시 부활 없이 소멸', async () => {
    const { useBattleStore } = await import('@/game/store/battleStore')
    const store = useBattleStore.getState()

    store.initBattle('fire_hero', [F01], 'earth_hero', [T01])
    const gs = useBattleStore.getState().gameState!

    // AI 필드: F01 + temporaryKeywords: ['incinerate'], canAttack: true
    // currentAttack: 4 → reborn 타겟(HP 3) 치사 → incinerate 발동 검증
    const aiAttacker: FieldUnit = {
      card: F01,
      currentHealth: 2,
      currentAttack: 4,
      canAttack: true,
      frozen: false,
      rebornUsed: false,
      summonedOnTurn: 1,
      temporaryKeywords: ['incinerate'],
    }

    // 플레이어 필드: T01 + reborn 키워드
    const rebornTarget: FieldUnit = {
      card: { ...T01, keywords: ['reborn'] as typeof T01.keywords },
      currentHealth: 3,
      currentAttack: 1,
      canAttack: false,
      frozen: false,
      rebornUsed: false,
      summonedOnTurn: 1,
      temporaryKeywords: [],
    }

    const newField: [FieldUnit | null, FieldUnit | null, FieldUnit | null, FieldUnit | null] = [aiAttacker, null, null, null]
    const playerField: [FieldUnit | null, FieldUnit | null, FieldUnit | null, FieldUnit | null] = [rebornTarget, null, null, null]

    useBattleStore.setState({
      gameState: {
        ...gs,
        phase: 'main',
        ai: { ...gs.ai, field: newField, currentEnergy: 0, hand: [] },
        player: { ...gs.player, field: playerField, hand: [], deck: [] },
      },
    })

    await useBattleStore.getState().endPlayerTurn()

    const afterGs = useBattleStore.getState().gameState
    // incinerate가 temporaryKeywords로 발동 → reborn 유닛이 부활 없이 null이어야 함
    expect(afterGs?.player.field[0]).toBeNull()
  })
})
