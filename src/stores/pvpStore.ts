/**
 * pvpStore — PvP 전용 Zustand 스토어
 * Phase 4 WebSocket 실제 연결 대응
 *
 * 변경사항 (Phase 4 WS):
 *   - serverView: ServerPlayerView | null 추가 (서버 STATE_UPDATE 수신 시 갱신)
 *   - currentGameId: string | null 추가
 *   - opponentId: string | null 추가
 *   - isServerConnected: boolean 추가
 *   - dispatch(action): pvpClient 통해 서버 전송 (Phase 4)
 *   - setServerView / setCurrentGameId / setOpponentId / setIsServerConnected 추가
 */

import { create } from 'zustand'
import type { FiveElement } from '@/types/elements'
import type { ServerPlayerView } from '@/services/pvpClient'

// ────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────

export interface PvPOpponent {
  nickname: string
  heroElement: FiveElement
  currentHp: number
  handCount: number
  deckCount: number
  rank: string
}

export interface PvPResult {
  isWin: boolean
  eloChange: number
  oldRank: string
  newRank: string
  expGained: number
  goldGained: number
  totalTurns: number
  killCount: number
  maxCombo: string
}

export type PvPMatchStatus =
  | 'idle'
  | 'searching'
  | 'found'
  | 'playing'
  | 'waiting'
  | 'result'

// Phase 4: pvpClient dispatch 액션 타입
export type PvPDispatchAction =
  | { type: 'PLAY_CARD'; cardId: string; targetUnitId?: string; fieldSlot?: number }
  | { type: 'ATTACK_UNIT'; attackerUnitId: string; targetUnitId: string }
  | { type: 'ATTACK_HERO'; attackerUnitId: string }
  | { type: 'END_TURN' }
  | { type: 'CONCEDE' }

interface PvPState {
  // 매칭 상태
  matchStatus: PvPMatchStatus

  // 상대 플레이어 정보 [SERVER]
  opponent: PvPOpponent | null

  // 내 정보 [SERVER]
  myRank: string
  myElo: number
  myWins: number
  myLosses: number

  // 대기자 수 [SERVER]
  waitingCount: number

  // 현재 게임 상태
  isMyTurn: boolean
  turnSecondsLeft: number

  // 게임 결과 [SERVER]
  result: PvPResult | null

  // 로그 (최근 20줄)
  pvpLog: string[]

  // Phase 4 WebSocket 추가 상태
  /** 서버에서 수신한 최신 PlayerView (ServerPlayerView 구조) */
  serverView: ServerPlayerView | null
  /** 현재 진행 중인 gameId */
  currentGameId: string | null
  /** 상대 playerId */
  opponentId: string | null
  /** WebSocket 연결 여부 */
  isServerConnected: boolean
  /** 상대 재연결 대기 중 여부 */
  opponentReconnecting: boolean
  /** 상대 재연결 타임아웃 (초) */
  opponentReconnectTimeout: number
  /** 최근 거부된 액션 사유 */
  lastRejectionReason: string | null

  // ── 기존 액션 ──────────────────────────────────────

  setMatchStatus: (status: PvPMatchStatus) => void
  setOpponent: (opponent: PvPOpponent | null) => void
  setIsMyTurn: (val: boolean) => void
  setTurnSecondsLeft: (val: number) => void
  addPvPLog: (entry: string) => void
  setResult: (result: PvPResult | null) => void
  reset: () => void

  // ── Phase 4 추가 액션 ──────────────────────────────

  setServerView: (view: ServerPlayerView | null) => void
  setCurrentGameId: (gameId: string | null) => void
  setOpponentId: (opponentId: string | null) => void
  setIsServerConnected: (val: boolean) => void
  setOpponentReconnecting: (val: boolean, timeoutSec?: number) => void
  setLastRejectionReason: (reason: string | null) => void

  /**
   * pvpClient를 통해 서버에 액션 전송
   * 서버 미연결 상태에서는 로그만 남기고 로컬 battleStore가 처리
   */
  dispatch: (action: PvPDispatchAction) => void
}

// ────────────────────────────────────────────────────
// 목 초기값
// ────────────────────────────────────────────────────

const MOCK_OPPONENT: PvPOpponent = {
  nickname: '대전 상대',
  heroElement: '木',
  currentHp: 30,
  handCount: 3,
  deckCount: 17,
  rank: 'Unranked',
}

const INITIAL_STATE = {
  matchStatus: 'idle' as PvPMatchStatus,
  opponent: null,
  myRank: 'Bronze I',
  myElo: 1000,
  myWins: 29,
  myLosses: 25,
  waitingCount: 12,
  isMyTurn: false,
  turnSecondsLeft: 60,
  result: null,
  pvpLog: [] as string[],
  // Phase 4
  serverView: null,
  currentGameId: null,
  opponentId: null,
  isServerConnected: false,
  opponentReconnecting: false,
  opponentReconnectTimeout: 0,
  lastRejectionReason: null,
}

// ────────────────────────────────────────────────────
// 스토어
// ────────────────────────────────────────────────────

export const usePvPStore = create<PvPState>((set, get) => ({
  ...INITIAL_STATE,

  // ── 기존 액션 ──────────────────────────────────────

  setMatchStatus: (status) => set({ matchStatus: status }),

  setOpponent: (opponent) => set({ opponent }),

  setIsMyTurn: (val) => set({ isMyTurn: val }),

  setTurnSecondsLeft: (val) => set({ turnSecondsLeft: val }),

  addPvPLog: (entry) =>
    set((state) => ({
      pvpLog: [entry, ...state.pvpLog].slice(0, 20),
    })),

  setResult: (result) => set({ result }),

  reset: () => set({ ...INITIAL_STATE }),

  // ── Phase 4 액션 ───────────────────────────────────

  setServerView: (view) => {
    if (!view) {
      set({ serverView: null })
      return
    }
    // ServerPlayerView → PvPOpponent 동기화
    const opponentFromView: PvPOpponent = {
      nickname: view.opponent.hero.nickname ?? view.opponent.playerId,
      heroElement: (view.opponent.hero.element as FiveElement) ?? '火',
      currentHp: view.opponent.currentHp,
      handCount: view.opponent.handSize,
      deckCount: view.opponent.deckSize,
      rank: 'Unranked',
    }
    set({
      serverView: view,
      opponent: opponentFromView,
      isMyTurn: view.activePlayer === view.viewOwner,
      turnSecondsLeft: view.turnTimeRemaining,
    })
  },

  setCurrentGameId: (gameId) => set({ currentGameId: gameId }),

  setOpponentId: (opponentId) => set({ opponentId }),

  setIsServerConnected: (val) => set({ isServerConnected: val }),

  setOpponentReconnecting: (val, timeoutSec = 0) =>
    set({ opponentReconnecting: val, opponentReconnectTimeout: timeoutSec }),

  setLastRejectionReason: (reason) => set({ lastRejectionReason: reason }),

  dispatch: (action) => {
    const state = get()

    if (!state.isServerConnected) {
      // 서버 미연결: 로그만 남김 (로컬 battleStore가 처리)
      state.addPvPLog(`[목 모드] ${action.type}`)
      return
    }

    // pvpClient를 동적으로 임포트하여 순환 의존성 방지
    // (pvpClient는 module-level singleton이므로 import()가 아닌 직접 import 사용)
    import('@/services/pvpClient').then(({ pvpClient }) => {
      switch (action.type) {
        case 'PLAY_CARD':
          pvpClient.playCard(action.cardId, action.targetUnitId, action.fieldSlot).catch(err =>
            console.error('[pvpStore.dispatch] PLAY_CARD 실패:', err),
          )
          break
        case 'ATTACK_UNIT':
          pvpClient.attackUnit(action.attackerUnitId, action.targetUnitId).catch(err =>
            console.error('[pvpStore.dispatch] ATTACK_UNIT 실패:', err),
          )
          break
        case 'ATTACK_HERO':
          pvpClient.attackHero(action.attackerUnitId).catch(err =>
            console.error('[pvpStore.dispatch] ATTACK_HERO 실패:', err),
          )
          break
        case 'END_TURN':
          pvpClient.endTurn().catch(err =>
            console.error('[pvpStore.dispatch] END_TURN 실패:', err),
          )
          break
        case 'CONCEDE':
          pvpClient.concede().catch(err =>
            console.error('[pvpStore.dispatch] CONCEDE 실패:', err),
          )
          break
        default:
          break
      }
    }).catch(err => console.error('[pvpStore.dispatch] 모듈 로드 실패:', err))
  },
}))

// ────────────────────────────────────────────────────
// 목 데이터 헬퍼 (서버 미연결 fallback)
// ────────────────────────────────────────────────────

/** 목 매칭 시뮬레이션: 3~5초 후 상대 찾음 */
export function mockStartMatching(): () => void {
  const store = usePvPStore.getState()
  store.setMatchStatus('searching')

  const delay = 3000 + Math.random() * 2000
  const timer = setTimeout(() => {
    const elements: FiveElement[] = ['木', '火', '土', '金', '水']
    const randomEl = elements[Math.floor(Math.random() * elements.length)]
    const mockNicknames = ['천명검객', '오행술사', '운명전사', '팔자패왕', '사주무림']
    const randomName = mockNicknames[Math.floor(Math.random() * mockNicknames.length)]

    usePvPStore.getState().setOpponent({
      ...MOCK_OPPONENT,
      nickname: randomName,
      heroElement: randomEl,
      rank: 'Bronze II',
    })
    usePvPStore.getState().setMatchStatus('found')
  }, delay)

  return () => clearTimeout(timer)
}

/** 목 상대 턴 시뮬레이션: 5~8초 후 내 턴 전환 */
export function mockOpponentTurn(onMyTurn: () => void): () => void {
  const delay = 5000 + Math.random() * 3000
  const timer = setTimeout(() => {
    usePvPStore.getState().setIsMyTurn(true)
    usePvPStore.getState().setTurnSecondsLeft(60)
    onMyTurn()
  }, delay)

  return () => clearTimeout(timer)
}

/** 목 결과 생성 */
export function mockGenerateResult(isWin: boolean): PvPResult {
  return {
    isWin,
    eloChange: isWin ? 20 : -20,
    oldRank: 'Bronze II',
    newRank: isWin ? 'Bronze I' : 'Bronze III',
    expGained: isWin ? 50 : 20,
    goldGained: isWin ? 15 : 5,
    totalTurns: 7 + Math.floor(Math.random() * 6),
    killCount: 3 + Math.floor(Math.random() * 4),
    maxCombo: '木木木',
  }
}
