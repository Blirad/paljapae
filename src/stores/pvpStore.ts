/**
 * pvpStore — PvP 전용 Zustand 스토어
 * 리라 스펙 §pvpStore.ts 명세
 * Phase 4 MVP: 목 데이터 포함, 서버 연동 시 교체
 */

import { create } from 'zustand'
import type { FiveElement } from '@/types/elements'

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

  // 액션
  setMatchStatus: (status: PvPMatchStatus) => void
  setOpponent: (opponent: PvPOpponent | null) => void
  setIsMyTurn: (val: boolean) => void
  setTurnSecondsLeft: (val: number) => void
  addPvPLog: (entry: string) => void
  setResult: (result: PvPResult | null) => void
  reset: () => void
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
}

// ────────────────────────────────────────────────────
// 스토어
// ────────────────────────────────────────────────────

export const usePvPStore = create<PvPState>((set) => ({
  ...INITIAL_STATE,

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
}))

// ────────────────────────────────────────────────────
// 목 데이터 헬퍼 (Phase 4 MVP용)
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
