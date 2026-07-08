/**
 * 게임 상태 타입 정의
 * 마스터플랜 §3 보드/턴 구조, 자원 시스템
 */

import type { Card, FieldUnit } from './cards'
import type { FiveElement } from './elements'

// ────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────

/** 영웅 기본 HP */
export const HERO_MAX_HP = 30

/** 필드 슬롯 수 */
export const FIELD_SLOTS = 4

/** 핸드 최대 카드 수 */
export const HAND_MAX_SIZE = 6

/** 매 턴 드로우 수 */
export const DRAW_PER_TURN = 3

/** 에너지 상한 (마스터플랜 §3-3) */
export const ENERGY_CAP = 5

/** 최대 게임 턴 (W1 Fatigue 정합, 덱 소진 후 8턴 → 총 15턴) */
export const MAX_TURNS = 15

// ────────────────────────────────────────────────────
// 영웅 정보
// ────────────────────────────────────────────────────

export type HeroId = 'wood_hero' | 'fire_hero' | 'earth_hero' | 'metal_hero' | 'water_hero'

export interface Hero {
  id: HeroId
  name: string
  nickname: string
  element: FiveElement
  maxHp: number
}

export const HEROES: Record<HeroId, Hero> = {
  wood_hero: {
    id: 'wood_hero',
    name: '청룡도사 (靑龍道士)',
    nickname: '청룡',
    element: '木',
    maxHp: HERO_MAX_HP,
  },
  fire_hero: {
    id: 'fire_hero',
    name: '화염검객 (火焰劍客)',
    nickname: '불검',
    element: '火',
    maxHp: HERO_MAX_HP,
  },
  earth_hero: {
    id: 'earth_hero',
    name: '황토장군 (黃土將軍)',
    nickname: '황장군',
    element: '土',
    maxHp: HERO_MAX_HP,
  },
  metal_hero: {
    id: 'metal_hero',
    name: '백금사형 (白金師兄)',
    nickname: '백사형',
    element: '金',
    maxHp: HERO_MAX_HP,
  },
  water_hero: {
    id: 'water_hero',
    name: '흑수선인 (黑水仙人)',
    nickname: '흑선인',
    element: '水',
    maxHp: HERO_MAX_HP,
  },
}

// ────────────────────────────────────────────────────
// Fatigue 상태 (W1 확정 규칙)
// ────────────────────────────────────────────────────

/**
 * Fatigue (소진) 상태
 * 덱 소진 후 N번째 턴에 N 피해 (턴 단위 1회 적용)
 * W1/M0 결정문 §1-3 확정안
 */
export interface FatigueState {
  /** 덱이 소진되었는지 여부 */
  deckExhausted: boolean
  /** 덱 소진 후 경과 턴 수 (0 = 소진 직후 아직 패널티 없음) */
  exhaustedTurnsCount: number
}

// ────────────────────────────────────────────────────
// 플레이어 상태
// ────────────────────────────────────────────────────

export interface PlayerState {
  /** 영웅 정보 */
  hero: Hero
  /** 현재 HP */
  currentHp: number
  /** 덱 (순서 있음, [0] = 다음 드로우 카드) */
  deck: Card[]
  /** 핸드 */
  hand: Card[]
  /** 묘지 */
  graveyard: Card[]
  /** 필드 유닛 (최대 4슬롯, null = 빈 슬롯) */
  field: (FieldUnit | null)[]
  /** 현재 에너지 */
  currentEnergy: number
  /** Fatigue 상태 */
  fatigue: FatigueState
}

// ────────────────────────────────────────────────────
// 턴 페이즈
// ────────────────────────────────────────────────────

export type TurnPhase =
  | 'draw'       // 드로우 페이즈
  | 'energy'     // 에너지 충전
  | 'main'       // 메인 페이즈 (카드 플레이)
  | 'combat'     // 전투 페이즈 (자동 공격)
  | 'end'        // 턴 종료
  | 'ai_turn'    // AI 턴 (M3에서 로직 구현)

// ────────────────────────────────────────────────────
// 게임 승패 상태
// ────────────────────────────────────────────────────

export type GameResult = 'player_win' | 'player_lose' | 'draw' | null

// ────────────────────────────────────────────────────
// 전체 게임 상태
// ────────────────────────────────────────────────────

export interface GameState {
  /** 현재 턴 번호 (1부터 시작) */
  turn: number
  /** 현재 페이즈 */
  phase: TurnPhase
  /** 플레이어 상태 */
  player: PlayerState
  /** AI 상태 */
  ai: PlayerState
  /** 게임 결과 (null = 진행 중) */
  result: GameResult
  /** 로그 (디버그용) */
  log: string[]
  /**
   * Phase 2-1: 오늘 일진(日辰) 천간 오행
   * 일일 전투 버프 계산에 사용 (상생 × 1.2, 상극 × 0.8)
   * undefined이면 일진 미적용 (계산 실패 등 방어 케이스)
   */
  dailyElement?: FiveElement
  /**
   * Phase 2-4: 오행 콤보 상태
   * 같은 오행 카드 연속 플레이 시 count 증가
   * 3회 달성 시 해당 오행 카드 비용 -1 (그 턴)
   */
  currentCombo: {
    element: FiveElement | null
    count: number
  }
  /**
   * Phase 3-2: undo용 히스토리 스택 (최대 3개)
   * 대운 카드 '시간역행' 사용 시 직전 상태로 복원
   */
  stateHistory?: GameState[]
  /**
   * Phase 3-2: 이미 사용한 대운 카드 ID 목록 (전투당 1회 제한)
   */
  usedDaewoon?: string[]
  /**
   * Phase 3-2: 남은 에너지 보너스 턴 수 (월운가속: 다음 N턴 에너지 +2)
   */
  energyBonusNextTurns?: number
  /**
   * Phase 3-2: 오행 상성 역전 남은 턴 수 (운명반전: 상극/상생 뒤바뀜)
   */
  elementalReversedTurns?: number
  /**
   * Phase 3-2: AI 다음 턴 스킵 플래그 (시운정지 카드)
   */
  aiTurnSkipped?: boolean
  /**
   * Phase 3 UI: 대운 카드 4종 사용 여부 추적 (리라 스펙 §1-5)
   */
  daewoonUsed?: {
    daewoonje: boolean    // 대운제 (大運制) — undo
    seunJeonhwan: boolean // 세운 전환 (歲運轉換) — dailyElement 변경
    wolunGasok: boolean   // 월운 가속 (月運加速) — 에너지 +2 2턴
    siunJeongji: boolean  // 시운 정지 (時運停止) — AI 턴 스킵
  }
  /**
   * Phase 3 UI: 월운 가속 남은 턴 수
   */
  wolunGasokTurnsRemaining?: number
  /**
   * Phase 3 UI: undo용 직전 상태 (최대 1개)
   */
  previousState?: GameState | null
}

// ────────────────────────────────────────────────────
// AI 인터페이스 (M3 구현 예약)
// ────────────────────────────────────────────────────

export type AIDifficulty = 'novice' | 'normal' | 'expert'

export interface AIAction {
  type: 'play_card' | 'attack' | 'end_turn'
  cardIndex?: number
  targetIndex?: number
}

/** AI 턴 실행 인터페이스 — M3에서 구현 */
export interface IAIPlayer {
  difficulty: AIDifficulty
  chooseBestAction(state: GameState): AIAction
}
