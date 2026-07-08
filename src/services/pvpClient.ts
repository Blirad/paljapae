/**
 * PvP WebSocket 클라이언트 — 실제 구현체
 * Phase 4 — 녹스 API 스펙 기반 (api-spec-for-kail.ts)
 *
 * 연결 엔드포인트: VITE_PVP_SERVER_URL (기본: ws://localhost:8080)
 *
 * 구현 내용:
 *   - WebSocketPvPClient: 실제 WS 연결 (자동 재연결 3회)
 *   - MockPvPClient: 서버 미연결 시 fallback (기존 목 데이터)
 *   - pvpClientInstance: 앱 전역 싱글턴
 */

import type { PlayerView, MatchmakingState } from '@/types/pvp'

// ────────────────────────────────────────────────────
// 서버 메시지 타입 (녹스 messages.ts 기반)
// ────────────────────────────────────────────────────

/** 서버 PlayerView (녹스 messages.ts 구조 — self/opponent 분리) */
export interface ServerPlayerView {
  viewOwner: 'player1' | 'player2'
  gameId: string
  self: {
    playerId: string
    hero: { id: string; name: string; nickname: string; element: string; maxHp: number }
    currentHp: number
    hand: ServerCard[]
    handSize: number
    deckSize: number
    graveyardSize: number
    field: (ServerFieldUnit | null)[]
    currentEnergy: number
    maxEnergy: number
    fatigue: { deckExhausted: boolean; exhaustedTurnsCount: number }
  }
  opponent: {
    playerId: string
    hero: { id: string; name: string; nickname: string; element: string; maxHp: number }
    currentHp: number
    handSize: number
    deckSize: number
    graveyardSize: number
    field: (ServerFieldUnit | null)[]
    currentEnergy: number
    fatigue: { deckExhausted: boolean; exhaustedTurnsCount: number }
  }
  turn: number
  phase: string
  activePlayer: 'player1' | 'player2'
  result: string | null
  dailyElement: string | null
  log: unknown[]
  turnTimeRemaining: number
}

export interface ServerCard {
  id: string
  name: string
  cost: number
  element: string | null
  rarity: string
  flavorText: string
  cardType: 'soldier' | 'commander' | 'spell'
  attack?: number
  maxHealth?: number
  keywords?: string[]
  effectText?: string
}

export interface ServerFieldUnit {
  card: ServerCard
  currentHealth: number
  currentAttack: number
  canAttack: boolean
  frozen: boolean
  rebornUsed: boolean
  summonedOnTurn: number
  temporaryKeywords: string[]
  unitId: string
}

// 서버 → 클라이언트 메시지 유니온
type ServerMsg =
  | { type: 'MATCHMAKING_WAIT'; position: number }
  | { type: 'MATCHMAKING_FOUND'; gameId: string; opponentId: string }
  | { type: 'GAME_START'; gameId: string; initialView: ServerPlayerView; goesFirst: boolean; dailyElement: string | null }
  | { type: 'STATE_UPDATE'; gameId: string; view: ServerPlayerView }
  | { type: 'ACTION_REJECTED'; gameId: string; rejectedSeq: number; reason: string; message: string }
  | { type: 'TURN_TIMER_UPDATE'; gameId: string; activePlayer: 'player1' | 'player2'; secondsLeft: number }
  | { type: 'OPPONENT_DISCONNECTED'; gameId: string; waitingForReconnect: boolean; reconnectTimeoutIn: number }
  | { type: 'TURN_CHANGE'; gameId: string; currentTurn: 'player1' | 'player2' }
  | { type: 'GAME_END'; gameId: string; winner: 'player1' | 'player2' | 'draw'; reason: string; finalView: ServerPlayerView }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'PONG'; serverTimestamp: number; clientTimestamp: number }

// ────────────────────────────────────────────────────
// 게임 종료 페이로드 (클라이언트 내부 인터페이스)
// ────────────────────────────────────────────────────

export interface GameEndPayload {
  result: 'win' | 'lose' | 'draw'
  finalView: PlayerView
}

// ────────────────────────────────────────────────────
// PvPClient 인터페이스
// ────────────────────────────────────────────────────

export interface PvPClient {
  connect(userId: string): Promise<void>
  playCard(cardId: string, targetUnitId?: string, fieldSlot?: number): Promise<void>
  attackUnit(attackerUnitId: string, targetUnitId: string): Promise<void>
  attackHero(attackerUnitId: string): Promise<void>
  endTurn(): Promise<void>
  concede(): Promise<void>
  joinMatchmaking(heroId: string, deckIds: string[]): Promise<void>
  leaveMatchmaking(): Promise<void>
  onStateUpdate(callback: (view: ServerPlayerView) => void): void
  onGameStart(callback: (gameId: string, view: ServerPlayerView, goesFirst: boolean, dailyElement: string | null) => void): void
  onTurnTimeout(callback: () => void): void
  onMatchmakingUpdate(callback: (state: MatchmakingState) => void): void
  onGameEnd(callback: (payload: { winner: string; reason: string; finalView: ServerPlayerView }) => void): void
  onActionRejected(callback: (reason: string, message: string, rejectedSeq: number) => void): void
  onOpponentDisconnected(callback: (reconnectTimeoutIn: number) => void): void
  onTurnTimerUpdate(callback: (secondsLeft: number, activePlayer: string) => void): void
  disconnect(): void
  isConnected(): boolean
  getCurrentGameId(): string | null
  getPlayerId(): string | null
}

// ────────────────────────────────────────────────────
// WebSocketPvPClient — 실제 연결 구현체
// ────────────────────────────────────────────────────

const SERVER_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_PVP_SERVER_URL ?? 'ws://localhost:8080'

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 3000

export class WebSocketPvPClient implements PvPClient {
  private ws: WebSocket | null = null
  private playerId: string | null = null
  private gameId: string | null = null
  private seq = 0

  // 재연결
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalDisconnect = false

  // 콜백 레지스트리
  private cbStateUpdate: ((view: ServerPlayerView) => void) | null = null
  private cbGameStart: ((gameId: string, view: ServerPlayerView, goesFirst: boolean, dailyElement: string | null) => void) | null = null
  private cbTurnTimeout: (() => void) | null = null
  private cbMatchmakingUpdate: ((state: MatchmakingState) => void) | null = null
  private cbGameEnd: ((payload: { winner: string; reason: string; finalView: ServerPlayerView }) => void) | null = null
  private cbActionRejected: ((reason: string, message: string, rejectedSeq: number) => void) | null = null
  private cbOpponentDisconnected: ((reconnectTimeoutIn: number) => void) | null = null
  private cbTurnTimerUpdate: ((secondsLeft: number, activePlayer: string) => void) | null = null

  // ── 연결 ──────────────────────────────────────────

  async connect(userId: string): Promise<void> {
    this.playerId = userId
    this.seq = 0
    this.intentionalDisconnect = false
    this.reconnectAttempts = 0
    return this._openConnection()
  }

  private _openConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(SERVER_URL)
      } catch (err) {
        reject(err)
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('[pvpClient] WebSocket 연결 타임아웃 (5초)'))
        this.ws?.close()
      }, 5000)

      this.ws.onopen = () => {
        clearTimeout(timeout)
        this.reconnectAttempts = 0
        console.log('[pvpClient] WebSocket 연결 완료:', SERVER_URL)
        resolve()
      }

      this.ws.onmessage = (event: MessageEvent) => {
        this._handleMessage(event)
      }

      this.ws.onerror = (event) => {
        clearTimeout(timeout)
        console.warn('[pvpClient] WebSocket 에러:', event)
        reject(new Error('[pvpClient] WebSocket 연결 실패'))
      }

      this.ws.onclose = () => {
        clearTimeout(timeout)
        if (!this.intentionalDisconnect) {
          this._scheduleReconnect()
        }
      }
    })
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[pvpClient] 재연결 최대 시도 초과. 연결 포기.')
      return
    }
    this.reconnectAttempts++
    console.log(`[pvpClient] ${RECONNECT_DELAY_MS / 1000}초 후 재연결 시도 (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
    this.reconnectTimer = setTimeout(() => {
      this._openConnection().catch(err => {
        console.warn('[pvpClient] 재연결 실패:', err)
      })
    }, RECONNECT_DELAY_MS)
  }

  disconnect(): void {
    this.intentionalDisconnect = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.playerId = null
    this.gameId = null
    this.seq = 0
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  getCurrentGameId(): string | null {
    return this.gameId
  }

  getPlayerId(): string | null {
    return this.playerId
  }

  // ── 메시지 발신 헬퍼 ──────────────────────────────

  private _nextSeq(): number {
    this.seq += 1
    return this.seq
  }

  private _send(msg: Record<string, unknown>): void {
    if (!this.isConnected()) {
      console.warn('[pvpClient] 연결 없음. 메시지 전송 불가:', msg.type)
      return
    }
    this.ws!.send(JSON.stringify(msg))
  }

  // ── 수신 처리 ─────────────────────────────────────

  private _handleMessage(event: MessageEvent): void {
    let msg: ServerMsg
    try {
      msg = JSON.parse(event.data as string) as ServerMsg
    } catch {
      console.warn('[pvpClient] 메시지 파싱 실패:', event.data)
      return
    }

    switch (msg.type) {
      case 'MATCHMAKING_WAIT':
        this.cbMatchmakingUpdate?.({
          status: 'searching',
          searchStartTime: Date.now(),
        })
        break

      case 'MATCHMAKING_FOUND':
        this.gameId = msg.gameId
        this.cbMatchmakingUpdate?.({
          status: 'found',
          opponentId: msg.opponentId,
          gameId: msg.gameId,
        })
        break

      case 'GAME_START':
        this.gameId = msg.gameId
        this.cbGameStart?.(msg.gameId, msg.initialView, msg.goesFirst, msg.dailyElement)
        break

      case 'STATE_UPDATE':
        this.cbStateUpdate?.(msg.view)
        break

      case 'ACTION_REJECTED':
        this.cbActionRejected?.(msg.reason, msg.message, msg.rejectedSeq)
        break

      case 'TURN_TIMER_UPDATE':
        if (msg.secondsLeft === 0) {
          this.cbTurnTimeout?.()
        }
        this.cbTurnTimerUpdate?.(msg.secondsLeft, msg.activePlayer)
        break

      case 'OPPONENT_DISCONNECTED':
        this.cbOpponentDisconnected?.(msg.reconnectTimeoutIn)
        break

      case 'GAME_END':
        this.cbGameEnd?.({ winner: msg.winner, reason: msg.reason, finalView: msg.finalView })
        this.gameId = null
        break

      case 'ERROR':
        this._handleServerError(msg.code, msg.message)
        break

      case 'PONG':
        // 연결 유지 확인 — 추가 처리 없음
        break

      default:
        console.warn('[pvpClient] 알 수 없는 서버 메시지:', (msg as { type: string }).type)
    }
  }

  private _handleServerError(code: string, message: string): void {
    console.error(`[pvpClient] 서버 에러 [${code}]: ${message}`)
    switch (code) {
      case 'ALREADY_IN_GAME':
        console.log('[pvpClient] 기존 게임 재연결 시도')
        break
      case 'INVALID_DECK':
        console.warn('[pvpClient] 덱 재구성 후 재요청 필요')
        break
      case 'ROOM_NOT_FOUND':
        console.warn('[pvpClient] 게임 종료됨. 로비로 이동 필요')
        this.gameId = null
        break
      default:
        break
    }
  }

  // ── 액션 발신 ─────────────────────────────────────

  async joinMatchmaking(heroId: string, deckIds: string[]): Promise<void> {
    this._send({
      type: 'JOIN_MATCHMAKING',
      playerId: this.playerId!,
      seq: this._nextSeq(),
      heroId,
      deckList: deckIds,
    })
  }

  async leaveMatchmaking(): Promise<void> {
    this._send({
      type: 'LEAVE_MATCHMAKING',
      playerId: this.playerId!,
      seq: this._nextSeq(),
    })
  }

  async playCard(cardId: string, targetUnitId?: string, fieldSlot?: number): Promise<void> {
    this._send({
      type: 'PLAY_CARD',
      playerId: this.playerId!,
      gameId: this.gameId!,
      seq: this._nextSeq(),
      cardId,
      ...(fieldSlot !== undefined ? { fieldSlot } : {}),
      ...(targetUnitId ? { targetUnitId } : {}),
    })
  }

  async attackUnit(attackerUnitId: string, targetUnitId: string): Promise<void> {
    this._send({
      type: 'ATTACK_UNIT',
      playerId: this.playerId!,
      gameId: this.gameId!,
      seq: this._nextSeq(),
      attackerUnitId,
      targetUnitId,
    })
  }

  async attackHero(attackerUnitId: string): Promise<void> {
    this._send({
      type: 'ATTACK_HERO',
      playerId: this.playerId!,
      gameId: this.gameId!,
      seq: this._nextSeq(),
      attackerUnitId,
    })
  }

  async endTurn(): Promise<void> {
    this._send({
      type: 'END_TURN',
      playerId: this.playerId!,
      gameId: this.gameId!,
      seq: this._nextSeq(),
    })
  }

  async concede(): Promise<void> {
    this._send({
      type: 'CONCEDE',
      playerId: this.playerId!,
      gameId: this.gameId!,
      seq: this._nextSeq(),
    })
  }

  // ── 콜백 등록 ─────────────────────────────────────

  onStateUpdate(callback: (view: ServerPlayerView) => void): void {
    this.cbStateUpdate = callback
  }

  onGameStart(callback: (gameId: string, view: ServerPlayerView, goesFirst: boolean, dailyElement: string | null) => void): void {
    this.cbGameStart = callback
  }

  onTurnTimeout(callback: () => void): void {
    this.cbTurnTimeout = callback
  }

  onMatchmakingUpdate(callback: (state: MatchmakingState) => void): void {
    this.cbMatchmakingUpdate = callback
  }

  onGameEnd(callback: (payload: { winner: string; reason: string; finalView: ServerPlayerView }) => void): void {
    this.cbGameEnd = callback
  }

  onActionRejected(callback: (reason: string, message: string, rejectedSeq: number) => void): void {
    this.cbActionRejected = callback
  }

  onOpponentDisconnected(callback: (reconnectTimeoutIn: number) => void): void {
    this.cbOpponentDisconnected = callback
  }

  onTurnTimerUpdate(callback: (secondsLeft: number, activePlayer: string) => void): void {
    this.cbTurnTimerUpdate = callback
  }
}

// ────────────────────────────────────────────────────
// MockPvPClient — 서버 미연결 시 fallback
// ────────────────────────────────────────────────────

export class MockPvPClient implements PvPClient {
  private cbMatchmakingUpdate: ((state: MatchmakingState) => void) | null = null
  private matchTimer: ReturnType<typeof setTimeout> | null = null

  async connect(_userId: string): Promise<void> {
    console.log('[MockPvPClient] 목 연결. 서버가 없으므로 목 데이터로 동작합니다.')
  }

  async joinMatchmaking(_heroId: string, _deckIds: string[]): Promise<void> {
    this.cbMatchmakingUpdate?.({ status: 'searching', searchStartTime: Date.now() })
    // 3~5초 후 매칭 성공 시뮬레이션
    this.matchTimer = setTimeout(() => {
      this.cbMatchmakingUpdate?.({
        status: 'found',
        opponentId: 'mock_opponent',
        gameId: `mock_game_${Date.now()}`,
      })
    }, 3000 + Math.random() * 2000)
  }

  async leaveMatchmaking(): Promise<void> {
    if (this.matchTimer) clearTimeout(this.matchTimer)
    this.cbMatchmakingUpdate?.({ status: 'idle' })
  }

  async playCard(_cardId: string, _targetUnitId?: string, _fieldSlot?: number): Promise<void> {
    // 목: 로컬 battleStore가 처리
  }

  async attackUnit(_attackerUnitId: string, _targetUnitId: string): Promise<void> {
    // 목: 로컬 battleStore가 처리
  }

  async attackHero(_attackerUnitId: string): Promise<void> {
    // 목: 로컬 battleStore가 처리
  }

  async endTurn(): Promise<void> {
    // 목: 로컬 battleStore가 처리
  }

  async concede(): Promise<void> {
    // 목: 로컬 처리
  }

  onStateUpdate(_callback: (view: ServerPlayerView) => void): void {
    // 목: STATE_UPDATE 없음
  }

  onGameStart(_callback: (gameId: string, view: ServerPlayerView, goesFirst: boolean, dailyElement: string | null) => void): void {
    // 목: GAME_START 없음
  }

  onTurnTimeout(_callback: () => void): void {
    // 목 모드: 발화 없음
  }

  onMatchmakingUpdate(callback: (state: MatchmakingState) => void): void {
    this.cbMatchmakingUpdate = callback
  }

  onGameEnd(_callback: (payload: { winner: string; reason: string; finalView: ServerPlayerView }) => void): void {
    // 목 모드: 발화 없음
  }

  onActionRejected(_callback: (reason: string, message: string, rejectedSeq: number) => void): void {
    // 목 모드: 발화 없음
  }

  onOpponentDisconnected(_callback: (reconnectTimeoutIn: number) => void): void {
    // 목 모드: 발화 없음
  }

  onTurnTimerUpdate(_callback: (secondsLeft: number, activePlayer: string) => void): void {
    // 목 모드: 발화 없음
  }

  disconnect(): void {
    if (this.matchTimer) clearTimeout(this.matchTimer)
  }

  isConnected(): boolean {
    return true // 목은 항상 연결된 것으로 간주
  }

  getCurrentGameId(): string | null {
    return null
  }

  getPlayerId(): string | null {
    return null
  }
}

// ────────────────────────────────────────────────────
// 앱 전역 싱글턴
// ────────────────────────────────────────────────────

/**
 * 앱 전역 pvpClient 싱글턴.
 *
 * 사용:
 *   import { pvpClient } from '@/services/pvpClient'
 *   await pvpClient.connect(userId)
 *   pvpClient.joinMatchmaking(heroId, deckIds)
 */
export const pvpClient: PvPClient = new WebSocketPvPClient()

/** 서버 미연결 환경(테스트/목) 전용 fallback */
export const mockPvpClient: PvPClient = new MockPvPClient()
