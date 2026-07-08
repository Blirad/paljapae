/**
 * Phase 3 UI 테스트
 * - P0: AI 난이도 선택 (persistence saveAIDifficulty / loadAIDifficulty)
 * - P1: relicDispatcher 반환값 { newState, activatedRelicIds }
 * - P3: GameState daewoonUsed 필드, DaewoonSlot 로직
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { saveAIDifficulty, loadAIDifficulty } from '@/utils/persistence'

// ────────────────────────────────────────────────────
// localStorage mock (node 환경)
// ────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})
import { dispatchRelicHooks } from '@/game/engine/relicDispatcher'
import type { GameState, PlayerState } from '@/types/game'
import { HEROES, HERO_MAX_HP } from '@/types/game'
import { ALL_RELICS } from '@/types/relics'
import { createInitialFatigue } from '@/game/engine/fatigue'
import { createEmptyField } from '@/game/engine/turnEngine'

// ────────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    hero: HEROES['fire_hero'],
    currentHp: HERO_MAX_HP,
    deck: [],
    hand: [],
    graveyard: [],
    field: createEmptyField() as PlayerState['field'],
    currentEnergy: 3,
    fatigue: createInitialFatigue(),
    ...overrides,
  }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    turn: 1,
    phase: 'main',
    player: makePlayer(),
    ai: makePlayer(),
    result: null,
    log: [],
    currentCombo: { element: null, count: 0 },
    ...overrides,
  }
}

// ────────────────────────────────────────────────────
// P0: AI 난이도 persistence
// ────────────────────────────────────────────────────

describe('P0: AI 난이도 localStorage persistence', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('loadAIDifficulty — 저장 없을 때 기본값 normal 반환', () => {
    expect(loadAIDifficulty()).toBe('normal')
  })

  it('saveAIDifficulty(novice) → loadAIDifficulty() === novice', () => {
    saveAIDifficulty('novice')
    expect(loadAIDifficulty()).toBe('novice')
  })

  it('saveAIDifficulty(expert) → loadAIDifficulty() === expert', () => {
    saveAIDifficulty('expert')
    expect(loadAIDifficulty()).toBe('expert')
  })

  it('saveAIDifficulty(normal) → loadAIDifficulty() === normal', () => {
    saveAIDifficulty('normal')
    expect(loadAIDifficulty()).toBe('normal')
  })

  it('잘못된 값이 저장되어도 loadAIDifficulty는 normal 반환', () => {
    localStorageMock.setItem('unmyeong_ai_difficulty', JSON.stringify('invalid_value'))
    expect(loadAIDifficulty()).toBe('normal')
  })
})

// ────────────────────────────────────────────────────
// P1: dispatchRelicHooks 반환값 구조 검증
// ────────────────────────────────────────────────────

describe('P1: dispatchRelicHooks 반환값 { newState, activatedRelicIds }', () => {
  it('발동된 유물 ID가 activatedRelicIds에 포함됨', () => {
    const state = makeState({ turn: 1, player: makePlayer({ currentHp: 20 }) })
    const relic = ALL_RELICS['RELIC_EARTH_FORTRESS']
    const { newState, activatedRelicIds } = dispatchRelicHooks('onTurnStart', state, [relic])
    expect(newState.player.currentHp).toBe(24)
    expect(activatedRelicIds).toContain('RELIC_EARTH_FORTRESS')
  })

  it('발동되지 않은 유물은 activatedRelicIds에 없음', () => {
    const state = makeState({ turn: 2, player: makePlayer({ currentHp: 20 }) })
    const relic = ALL_RELICS['RELIC_EARTH_FORTRESS'] // 턴1에만 발동
    const { newState, activatedRelicIds } = dispatchRelicHooks('onTurnStart', state, [relic])
    expect(newState.player.currentHp).toBe(20) // 변화 없음
    expect(activatedRelicIds).toHaveLength(0)
  })

  it('여러 유물 중 발동된 것만 activatedRelicIds에 포함됨', () => {
    const state = makeState({
      turn: 1,
      player: makePlayer({ currentHp: 10 }),
      ai: makePlayer({ currentEnergy: 3 }),
    })
    const relics = [ALL_RELICS['RELIC_EARTH_FORTRESS'], ALL_RELICS['RELIC_EARTH_QUICKSAND']]
    const { activatedRelicIds } = dispatchRelicHooks('onTurnStart', state, relics)
    expect(activatedRelicIds).toContain('RELIC_EARTH_FORTRESS')
    expect(activatedRelicIds).toContain('RELIC_EARTH_QUICKSAND')
  })

  it('빈 유물 목록 → activatedRelicIds가 빈 배열', () => {
    const state = makeState()
    const { newState, activatedRelicIds } = dispatchRelicHooks('onTurnStart', state, [])
    expect(newState).toBe(state) // 동일 참조
    expect(activatedRelicIds).toHaveLength(0)
  })
})

// ────────────────────────────────────────────────────
// P3: GameState daewoonUsed 필드
// ────────────────────────────────────────────────────

describe('P3: GameState daewoonUsed 필드', () => {
  it('daewoonUsed 기본값 undefined — 옵셔널 필드', () => {
    const state = makeState()
    expect(state.daewoonUsed).toBeUndefined()
  })

  it('daewoonUsed 모든 필드 false로 초기화 가능', () => {
    const state = makeState({
      daewoonUsed: {
        daewoonje: false,
        seunJeonhwan: false,
        wolunGasok: false,
        siunJeongji: false,
      },
    })
    expect(state.daewoonUsed?.daewoonje).toBe(false)
    expect(state.daewoonUsed?.seunJeonhwan).toBe(false)
    expect(state.daewoonUsed?.wolunGasok).toBe(false)
    expect(state.daewoonUsed?.siunJeongji).toBe(false)
  })

  it('daewoonUsed.wolunGasok을 true로 설정 가능', () => {
    const state = makeState({
      daewoonUsed: {
        daewoonje: false,
        seunJeonhwan: false,
        wolunGasok: true,
        siunJeongji: false,
      },
    })
    expect(state.daewoonUsed?.wolunGasok).toBe(true)
    expect(state.daewoonUsed?.daewoonje).toBe(false)
  })

  it('wolunGasokTurnsRemaining — 옵셔널 number 필드', () => {
    const state = makeState({ wolunGasokTurnsRemaining: 2 })
    expect(state.wolunGasokTurnsRemaining).toBe(2)
  })

  it('previousState — 옵셔널 GameState | null', () => {
    const prevState = makeState({ turn: 1 })
    const state = makeState({ turn: 2, previousState: prevState })
    expect(state.previousState?.turn).toBe(1)
  })

  it('previousState === null 설정 가능', () => {
    const state = makeState({ previousState: null })
    expect(state.previousState).toBeNull()
  })
})
