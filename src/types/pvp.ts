/**
 * PvP 타입 정의
 * Phase 4 — PlayerView / ServerGameState 분리 설계
 *
 * 목적:
 *   - 서버는 양측 핸드(hand)를 모두 보유 (ServerGameState)
 *   - 클라이언트는 자신의 핸드만 수신 (PlayerView)
 *   - 기존 GameState를 직접 수정하지 않고 별도 타입으로 분리
 *
 * 주의: 리라 UX 스펙 / 도리안 서버 설계 수신 전까지 구현 금지.
 *       본 파일은 타입 정의 스켈레톤 전용입니다.
 */

import type { HeroData } from './hero'
import type { FieldUnit, Card } from './cards'
import type { GameState } from './game'

// ────────────────────────────────────────────────────
// 공유 유닛 타입 (PvP 전용 별칭)
// ────────────────────────────────────────────────────

/** PvP 필드 유닛 (기존 FieldUnit 재사용) */
export type Unit = FieldUnit

// ────────────────────────────────────────────────────
// 게임 액션 로그
// ────────────────────────────────────────────────────

export type GameActionType =
  | 'play_card'       // 카드 사용
  | 'attack'          // 유닛 공격
  | 'hero_attack'     // 영웅 직접 공격
  | 'end_turn'        // 턴 종료
  | 'draw'            // 드로우
  | 'turn_timeout'    // 턴 타이머 만료

export interface GameAction {
  type: GameActionType
  /** 액션 발생 주체 ('player1' | 'player2') */
  actor: 'player1' | 'player2'
  /** 관련 카드 ID (있을 경우) */
  cardId?: string
  /** 관련 유닛 ID (있을 경우) */
  unitId?: string
  /** 타겟 유닛 ID (있을 경우) */
  targetUnitId?: string
  /** 액션 발생 시각 (Unix ms) */
  timestamp: number
}

// ────────────────────────────────────────────────────
// PlayerView — 클라이언트가 수신하는 상태
// ────────────────────────────────────────────────────

/**
 * 플레이어가 볼 수 있는 상태 (상대 핸드 숨김)
 *
 * - myHand: 자신의 핸드 카드 전체 공개
 * - enemyHandCount: 상대 핸드 개수만 공개 (카드 내용 비공개)
 */
export interface PlayerView {
  /** 내 영웅 정보 */
  myHero: HeroData
  /** 내 영웅 현재 HP */
  myHeroHP: number
  /** 내 현재 에너지 */
  myEnergy: number
  /** 내 에너지 최대치 */
  myEnergyMax: number
  /** 내 필드 유닛 (공개) */
  myFieldUnits: Unit[]
  /** 내 핸드 카드 (자신만 볼 수 있음) */
  myHand: Card[]
  /** 상대 영웅 정보 (필드 공개, 핸드 비공개) */
  enemyHero: HeroData
  /** 상대 영웅 현재 HP */
  enemyHeroHP: number
  /** 상대 필드 유닛 (공개) */
  enemyFieldUnits: Unit[]
  /** 상대 핸드 카드 수 (개수만, 카드 내용 비공개) */
  enemyHandCount: number
  /** 현재 턴 주인 */
  turnOwner: 'me' | 'enemy'
  /** 남은 턴 시간 (초, 리라 스펙 §x 60초 타이머) */
  turnTimeRemaining: number
  /** 게임 로그 (공개 가능한 액션만 포함) */
  gameLog: GameAction[]
}

// ────────────────────────────────────────────────────
// ServerGameState — 서버만 보유하는 전체 상태
// ────────────────────────────────────────────────────

/**
 * 서버 전용 완전한 게임 상태
 *
 * - 양측 GameState를 모두 보유
 * - 클라이언트에 직접 전송하지 않음
 * - PlayerView로 변환 후 각 클라이언트에 전달
 */
export interface ServerGameState {
  /** 플레이어 1 (호스트) 상태 */
  player1: GameState
  /** 플레이어 2 (게스트) 상태 */
  player2: GameState
  /** 현재 턴 플레이어 (1 또는 2) */
  currentTurn: 1 | 2
  /** 현재 턴 시작 시각 (Unix ms) */
  turnStartTime: number
  /** 게임 ID */
  gameId: string
  /** 게임 시작 시각 (Unix ms) */
  gameStartTime: number
}

// ────────────────────────────────────────────────────
// 매칭 상태 (LobbyScreen 용)
// ────────────────────────────────────────────────────

export type MatchmakingStatus =
  | 'idle'        // 대기 중
  | 'searching'   // 매칭 탐색 중
  | 'found'       // 매칭 성공, 게임 준비 중
  | 'ready'       // 게임 시작 직전
  | 'in_game'     // 게임 중
  | 'error'       // 에러

export interface MatchmakingState {
  status: MatchmakingStatus
  /** 매칭 탐색 시작 시각 (Unix ms) */
  searchStartTime?: number
  /** 매칭된 상대 ID */
  opponentId?: string
  /** 할당된 게임 ID */
  gameId?: string
  /** 에러 메시지 */
  errorMessage?: string
}
