/**
 * Zustand 게임 상태 스토어
 * 마스터플랜 §3 보드/필드 구조, 에너지, 턴 카운터 관리
 */

import { create } from 'zustand'
import type { GameState, PlayerState, HeroId } from '@/types/game'
import {
  HEROES,
  HERO_MAX_HP,
} from '@/types/game'
import type { Card } from '@/types/cards'
import { createInitialFatigue } from '@/game/engine/fatigue'
import {
  executeDraw,
  executeEnergyCharge,
  executeCombatPhase,
  executeAITurn,
  resetFieldForNewTurn,
  playCard as enginePlayCard,
  checkGameResult,
  createEmptyField,
} from '@/game/engine/turnEngine'

// ────────────────────────────────────────────────────
// 초기 플레이어 상태 생성
// ────────────────────────────────────────────────────

function createPlayerState(heroId: HeroId, deck: Card[]): PlayerState {
  return {
    hero: HEROES[heroId],
    currentHp: HERO_MAX_HP,
    deck: [...deck],
    hand: [],
    graveyard: [],
    field: createEmptyField() as (import('@/types/cards').FieldUnit | null)[],
    currentEnergy: 0,
    fatigue: createInitialFatigue(),
  }
}

// ────────────────────────────────────────────────────
// 스토어 타입
// ────────────────────────────────────────────────────

interface GameStore {
  gameState: GameState | null

  /** 게임 초기화 */
  initGame: (
    playerHeroId: HeroId,
    playerDeck: Card[],
    aiHeroId: HeroId,
    aiDeck: Card[],
  ) => void

  /** 드로우 페이즈 실행 */
  executeDraw: () => void

  /** 에너지 충전 */
  chargeEnergy: () => void

  /** 카드 플레이 */
  playCard: (cardIndex: number, fieldSlot?: number) => string | null

  /** 전투 페이즈 실행 (플레이어 공격) */
  executePlayerCombat: () => void

  /** 턴 종료 */
  endTurn: () => void

  /** AI 턴 실행 */
  executeAITurn: () => void

  /** 페이즈 전환 */
  setPhase: (phase: GameState['phase']) => void

  /** 로그 클리어 */
  clearLog: () => void
}

// ────────────────────────────────────────────────────
// 스토어 구현
// ────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,

  initGame: (playerHeroId, playerDeck, aiHeroId, aiDeck) => {
    const playerState = createPlayerState(playerHeroId, playerDeck)
    const aiState = createPlayerState(aiHeroId, aiDeck)

    const initialState: GameState = {
      turn: 1,
      phase: 'draw',
      player: playerState,
      ai: aiState,
      result: null,
      log: ['게임 시작!'],
      currentCombo: { element: null, count: 0 },
    }

    set({ gameState: initialState })
  },

  executeDraw: () => {
    const { gameState } = get()
    if (!gameState) return

    const { player: updatedPlayer, burnedCount, fatigueDamage, drawnCount } = executeDraw(
      gameState.player,
      gameState.turn,
    )

    const logEntries: string[] = []
    if (drawnCount > 0) logEntries.push(`카드 ${drawnCount}장 드로우`)
    if (burnedCount > 0) logEntries.push(`카드 ${burnedCount}장 번(over draw)`)
    if (fatigueDamage > 0) logEntries.push(`Fatigue ${fatigueDamage} 피해! (소진 후 ${updatedPlayer.fatigue.exhaustedTurnsCount}번째 턴)`)

    const newState: GameState = {
      ...gameState,
      player: updatedPlayer,
      phase: 'energy',
      log: [...gameState.log, ...logEntries],
    }

    set({ gameState: { ...newState, result: checkGameResult(newState) } })
  },

  chargeEnergy: () => {
    const { gameState } = get()
    if (!gameState) return

    const updatedPlayer = executeEnergyCharge(gameState.player, gameState.turn)

    set({
      gameState: {
        ...gameState,
        player: updatedPlayer,
        phase: 'main',
        log: [...gameState.log, `에너지 ${updatedPlayer.currentEnergy} 충전`],
      },
    })
  },

  playCard: (cardIndex, fieldSlot) => {
    const { gameState } = get()
    if (!gameState) return '게임이 시작되지 않았습니다'
    if (gameState.phase !== 'main') return '메인 페이즈가 아닙니다'

    const result = enginePlayCard(gameState.player, cardIndex, fieldSlot)

    if (!result.success) return result.reason

    const card = gameState.player.hand[cardIndex]
    set({
      gameState: {
        ...gameState,
        player: result.player,
        log: [...gameState.log, `[플레이] ${card.name} (비용: ${card.cost})`],
      },
    })

    return null
  },

  executePlayerCombat: () => {
    const { gameState } = get()
    if (!gameState) return

    const newState = executeCombatPhase(gameState, true)
    const result = checkGameResult(newState)

    set({
      gameState: {
        ...newState,
        phase: 'end',
        result,
      },
    })
  },

  endTurn: () => {
    const { gameState } = get()
    if (!gameState) return

    // 다음 턴으로 이동, AI 턴 시작
    const newTurn = gameState.turn + 1
    const playerForNextTurn = resetFieldForNewTurn(gameState.player, gameState.turn)

    set({
      gameState: {
        ...gameState,
        player: playerForNextTurn,
        turn: newTurn,
        phase: 'ai_turn',
        log: [...gameState.log, `--- 턴 ${newTurn} 시작 ---`],
      },
    })
  },

  executeAITurn: () => {
    const { gameState } = get()
    if (!gameState) return

    const newState = executeAITurn(gameState)
    const aiCombatState = executeCombatPhase(newState, false)
    const result = checkGameResult(aiCombatState)

    set({
      gameState: {
        ...aiCombatState,
        phase: 'draw',
        result,
      },
    })
  },

  setPhase: (phase) => {
    const { gameState } = get()
    if (!gameState) return
    set({ gameState: { ...gameState, phase } })
  },

  clearLog: () => {
    const { gameState } = get()
    if (!gameState) return
    set({ gameState: { ...gameState, log: [] } })
  },
}))

// ────────────────────────────────────────────────────
// 편의 셀렉터
// ────────────────────────────────────────────────────

export const selectPlayer = (s: GameStore) => s.gameState?.player
export const selectAI = (s: GameStore) => s.gameState?.ai
export const selectTurn = (s: GameStore) => s.gameState?.turn
export const selectPhase = (s: GameStore) => s.gameState?.phase
export const selectResult = (s: GameStore) => s.gameState?.result
export const selectLog = (s: GameStore) => s.gameState?.log ?? []
