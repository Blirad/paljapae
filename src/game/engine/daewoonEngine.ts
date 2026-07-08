/**
 * 대운 카드 효과 엔진 — Phase 3-2
 *
 * 대운 카드 4종의 특수 효과 실행 + undo 메커니즘
 *
 * 설계 원칙:
 * - 순수 함수 (side-effect 없음)
 * - GameState 받아 새 GameState 반환
 * - stateHistory 최대 3개 유지
 */

import type { GameState } from '@/types/game'
import { DAEWOON_CARD_IDS } from '@/data/daewoonCards'

// ────────────────────────────────────────────────────
// 히스토리 관리
// ────────────────────────────────────────────────────

/** 최대 히스토리 보관 수 */
const MAX_HISTORY = 3

/**
 * 현재 GameState를 히스토리에 저장 (undo용)
 * stateHistory 내부의 stateHistory는 순환 참조 방지를 위해 제거
 */
export function pushHistory(state: GameState): GameState {
  // stateHistory를 제외한 스냅샷 저장 (순환 참조 방지)
  const snapshot: GameState = { ...state, stateHistory: undefined }
  const prev = state.stateHistory ?? []
  const newHistory = [...prev, snapshot].slice(-MAX_HISTORY)
  return { ...state, stateHistory: newHistory }
}

/**
 * undo: 히스토리에서 직전 상태 복원
 * 히스토리가 없으면 state 그대로 반환
 */
export function undoLastAction(state: GameState): GameState {
  const history = state.stateHistory ?? []
  if (history.length === 0) {
    return {
      ...state,
      log: [...state.log, '[대운] 시간역행: 되돌릴 기록 없음'],
    }
  }
  const prev = history[history.length - 1]
  const newHistory = history.slice(0, -1)
  return {
    ...prev,
    stateHistory: newHistory,
    log: [...(prev.log ?? []), '[대운] 시간역행: 직전 상태 복원 완료'],
  }
}

// ────────────────────────────────────────────────────
// 대운 카드 효과 실행
// ────────────────────────────────────────────────────

export type DaewoonResult =
  | { success: true; state: GameState }
  | { success: false; reason: string }

/**
 * 대운 카드 효과 실행
 * @param cardId - DAEWOON-01~04
 * @param state - 현재 게임 상태
 * @returns 효과 적용 후 GameState 또는 실패 이유
 */
export function applyDaewoonEffect(cardId: string, state: GameState): DaewoonResult {
  // 대운 카드 여부 확인
  if (!DAEWOON_CARD_IDS.has(cardId)) {
    return { success: false, reason: '대운 카드가 아님' }
  }

  // 전투당 1회 제한 확인
  const used = state.usedDaewoon ?? []
  if (used.includes(cardId)) {
    return { success: false, reason: `${cardId}: 이미 이번 전투에서 사용함 (1회 제한)` }
  }

  // 히스토리에 현재 상태 저장 (undo 준비)
  const stateWithHistory = pushHistory(state)

  // 사용 기록 업데이트
  const newUsed = [...used, cardId]

  switch (cardId) {
    case 'DAEWOON-01': {
      // 시간역행: undo — 히스토리에서 직전 상태 복원
      // 단, 자신의 사용 기록 자체도 히스토리에서 꺼내므로 스택에서 pop
      const restoredState = undoLastAction(stateWithHistory)
      // 사용 기록은 복원 후 상태에서도 유지 (같은 전투 내이므로)
      return {
        success: true,
        state: {
          ...restoredState,
          usedDaewoon: [...(restoredState.usedDaewoon ?? []), 'DAEWOON-01'],
        },
      }
    }

    case 'DAEWOON-02': {
      // 월운가속: 다음 2턴 에너지 +2
      return {
        success: true,
        state: {
          ...stateWithHistory,
          usedDaewoon: newUsed,
          energyBonusNextTurns: 2,
          log: [...stateWithHistory.log, '[대운] 월운가속: 다음 2턴 에너지 +2'],
        },
      }
    }

    case 'DAEWOON-03': {
      // 시운정지: AI 다음 턴 스킵 (aiTurnSkipped 플래그)
      // GameState에 aiTurnSkipped 필드가 없으므로 log로 표시하고 별도 필드 추가
      return {
        success: true,
        state: {
          ...stateWithHistory,
          usedDaewoon: newUsed,
          aiTurnSkipped: true,
          log: [...stateWithHistory.log, '[대운] 시운정지: AI 다음 턴 건너뜀'],
        },
      }
    }

    case 'DAEWOON-04': {
      // 운명반전: 2턴간 오행 상성 역전
      return {
        success: true,
        state: {
          ...stateWithHistory,
          usedDaewoon: newUsed,
          elementalReversedTurns: 2,
          log: [...stateWithHistory.log, '[대운] 운명반전: 2턴간 오행 상성 역전'],
        },
      }
    }

    default:
      return { success: false, reason: `알 수 없는 대운 카드: ${cardId}` }
  }
}

// ────────────────────────────────────────────────────
// 턴 시작 시 대운 버프 적용
// ────────────────────────────────────────────────────

/**
 * 턴 시작 시 월운가속 에너지 보너스 적용 + 카운터 감소
 * turnEngine의 executeEnergyCharge 이후 호출
 */
export function applyDaewoonTurnStart(state: GameState): GameState {
  const bonus = state.energyBonusNextTurns ?? 0
  if (bonus <= 0) return state

  const newEnergy = Math.min(5, state.player.currentEnergy + 2)
  const newBonusTurns = bonus - 1

  return {
    ...state,
    player: { ...state.player, currentEnergy: newEnergy },
    energyBonusNextTurns: newBonusTurns > 0 ? newBonusTurns : undefined,
    log: [...state.log, `[대운] 월운가속: 에너지 +2 (남은 ${newBonusTurns}턴)`],
  }
}

/**
 * 오행 역전 턴 카운터 감소 (턴 종료 시)
 */
export function applyDaewoonTurnEnd(state: GameState): GameState {
  const reversed = state.elementalReversedTurns ?? 0
  if (reversed <= 0) return state

  const newReversed = reversed - 1
  return {
    ...state,
    elementalReversedTurns: newReversed > 0 ? newReversed : undefined,
    log: newReversed > 0
      ? [...state.log, `[대운] 운명반전: 상성 역전 ${newReversed}턴 남음`]
      : [...state.log, '[대운] 운명반전: 상성 역전 종료'],
  }
}

/**
 * 오행 상성 역전 여부 확인
 */
export function isElementalReversed(state: GameState): boolean {
  return (state.elementalReversedTurns ?? 0) > 0
}
