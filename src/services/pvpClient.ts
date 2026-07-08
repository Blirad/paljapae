/**
 * PvP WebSocket 클라이언트 인터페이스 스켈레톤
 * Phase 4 — 클라이언트-서버 통신 계층
 *
 * 목적:
 *   - 서버(녹스)가 구현할 WebSocket API 인터페이스를 선행 정의
 *   - 실제 구현은 리라 UX 스펙 + 도리안 서버 설계 완료 후 시작
 *
 * 주의: 본 파일은 인터페이스/타입 정의만 포함합니다.
 *       실제 WebSocket 연결 로직은 구현하지 않습니다.
 */

import type { PlayerView, MatchmakingState } from '@/types/pvp'

// ────────────────────────────────────────────────────
// WebSocket 메시지 스키마
// ────────────────────────────────────────────────────

/** 클라이언트 → 서버 메시지 타입 */
export type ClientMessageType =
  | 'join_matchmaking'    // 매칭 참가 요청
  | 'leave_matchmaking'   // 매칭 취소
  | 'play_card'           // 카드 사용
  | 'attack_unit'         // 유닛으로 타겟 공격
  | 'attack_hero'         // 유닛으로 상대 영웅 공격
  | 'end_turn'            // 턴 종료
  | 'ping'                // 연결 유지 확인

/** 서버 → 클라이언트 메시지 타입 */
export type ServerMessageType =
  | 'matchmaking_update'  // 매칭 상태 업데이트
  | 'game_start'          // 게임 시작
  | 'state_update'        // PlayerView 상태 업데이트
  | 'turn_timeout'        // 상대 턴 타이머 만료
  | 'game_end'            // 게임 종료
  | 'error'               // 에러
  | 'pong'                // ping 응답

// ────────────────────────────────────────────────────
// 클라이언트 → 서버 메시지 페이로드
// ────────────────────────────────────────────────────

export interface PlayCardPayload {
  /** 사용할 카드 ID */
  cardId: string
  /** 타겟 유닛 ID (타겟 필요 카드인 경우) */
  targetUnitId?: string
}

export interface AttackPayload {
  /** 공격하는 내 유닛 ID */
  attackerUnitId: string
  /** 공격 대상 유닛 ID */
  targetUnitId: string
}

export interface AttackHeroPayload {
  /** 공격하는 내 유닛 ID */
  attackerUnitId: string
}

// ────────────────────────────────────────────────────
// 서버 → 클라이언트 메시지 페이로드
// ────────────────────────name──────────────────────────

export interface GameStartPayload {
  /** 게임 ID */
  gameId: string
  /** 이 클라이언트의 플레이어 번호 */
  playerNumber: 1 | 2
  /** 초기 PlayerView */
  initialView: PlayerView
}

export interface GameEndPayload {
  /** 게임 결과 */
  result: 'win' | 'lose' | 'draw'
  /** 최종 PlayerView */
  finalView: PlayerView
}

export interface ServerErrorPayload {
  /** 에러 코드 */
  code: string
  /** 에러 메시지 */
  message: string
}

// ────────────────────────────────────────────────────
// PvPClient 인터페이스
// ────────────────────────────────────────────────────

/**
 * PvP WebSocket 클라이언트 인터페이스
 *
 * 구현 예정 (Phase 4 본 구현 단계):
 *   - WebSocketPvPClient: 실제 WebSocket 연결 구현체
 *   - MockPvPClient: 테스트용 목업 구현체
 */
export interface PvPClient {
  /**
   * WebSocket 연결 및 인증
   * @param userId 현재 로그인한 사용자 ID
   */
  connect(userId: string): Promise<void>

  /**
   * 카드 사용 (서버 판정 요청)
   * @param cardId 사용할 카드 ID
   * @param targetUnitId 타겟 유닛 ID (선택적)
   */
  playCard(cardId: string, targetUnitId?: string): Promise<void>

  /**
   * 유닛 공격 (서버 판정 요청)
   * @param attackerUnitId 공격하는 내 유닛 ID
   * @param targetUnitId 타겟 유닛 ID
   */
  attackUnit(attackerUnitId: string, targetUnitId: string): Promise<void>

  /**
   * 유닛으로 상대 영웅 공격 (서버 판정 요청)
   * @param attackerUnitId 공격하는 내 유닛 ID
   */
  attackHero(attackerUnitId: string): Promise<void>

  /**
   * 턴 종료 선언
   */
  endTurn(): Promise<void>

  /**
   * 매칭 시작
   * @param heroId 선택한 영웅 ID
   * @param deckIds 구성한 덱 카드 ID 목록
   */
  joinMatchmaking(heroId: string, deckIds: string[]): Promise<void>

  /**
   * 매칭 취소
   */
  leaveMatchmaking(): Promise<void>

  /**
   * PlayerView 상태 업데이트 콜백 등록
   * @param callback 상태 업데이트 수신 시 호출
   */
  onStateUpdate(callback: (view: PlayerView) => void): void

  /**
   * 턴 타이머 만료 콜백 등록
   * 상대방 턴이 시간 초과(60초)로 강제 종료될 때 호출
   */
  onTurnTimeout(callback: () => void): void

  /**
   * 매칭 상태 변경 콜백 등록
   * @param callback 매칭 상태 변경 시 호출
   */
  onMatchmakingUpdate(callback: (state: MatchmakingState) => void): void

  /**
   * 게임 종료 콜백 등록
   * @param callback 게임 종료 시 호출
   */
  onGameEnd(callback: (payload: GameEndPayload) => void): void

  /**
   * WebSocket 연결 해제
   */
  disconnect(): void

  /**
   * 현재 연결 상태 확인
   */
  isConnected(): boolean
}
