/**
 * W1 Fatigue (소진) 엔진
 * 확정 규칙: 덱 소진 후 N번째 턴에 N 피해 (턴 단위 1회 적용)
 * W1/M0 결정문 §1-3 확정안
 *
 * 수치 검증 (결정문 §1-3 표):
 *   덱 소진 시점: 턴 7 (20장 ÷ 3장/턴 = 6.67 → 올림)
 *   소진 후 8턴 경과(게임 턴 15)에 HP30 기준 사망:
 *   누적 피해 = 1+2+3+4+5+6+7+8 = 36 > 30
 */

import type { FatigueState } from '@/types/game'

/**
 * Fatigue 피해량 계산
 * N = exhaustedTurnsCount (덱 소진 후 경과 턴 수)
 * 소진 직후(count=0)이면 아직 피해 없음, count=1부터 1씩 증가
 */
export function calculateFatigueDamage(fatigue: FatigueState): number {
  if (!fatigue.deckExhausted) return 0
  // 소진 후 1번째 턴 = 1 피해, 2번째 = 2 피해, ...
  return fatigue.exhaustedTurnsCount
}

/**
 * 드로우 페이즈에 덱이 비어있으면 Fatigue 카운터 증가
 * 반환값: 업데이트된 FatigueState
 */
export function advanceFatigue(
  fatigue: FatigueState,
  deckSize: number,
): FatigueState {
  if (deckSize === 0) {
    // 덱이 비어있으면 소진 상태 확정 + 카운터 증가
    return {
      deckExhausted: true,
      exhaustedTurnsCount: fatigue.exhaustedTurnsCount + 1,
    }
  }
  // 덱에 카드가 있으면 Fatigue 없음
  return fatigue
}

/**
 * 초기 Fatigue 상태
 */
export function createInitialFatigue(): FatigueState {
  return {
    deckExhausted: false,
    exhaustedTurnsCount: 0,
  }
}

/**
 * HP 30 기준 턴별 Fatigue 누적 피해 시뮬레이션
 * 단위 테스트 검증용 순수 함수
 *
 * @param startHp - 시작 HP
 * @param fatigueStartTurn - Fatigue가 시작되는 턴 (덱 소진 턴)
 * @param currentTurn - 현재 게임 턴
 * @returns 현재까지 Fatigue로 인한 총 피해량
 */
export function calculateTotalFatigueDamage(
  fatigueStartTurn: number,
  currentTurn: number,
): number {
  if (currentTurn <= fatigueStartTurn) return 0

  let total = 0
  for (let t = fatigueStartTurn + 1; t <= currentTurn; t++) {
    const n = t - fatigueStartTurn // 소진 후 N번째 턴
    total += n
  }
  return total
}

/**
 * Fatigue만으로 HP가 0 이하가 되는 턴 계산
 * @param startHp - 시작 HP
 * @param fatigueStartTurn - Fatigue 시작 턴
 * @returns 사망하는 게임 턴 번호 (사망 안 하면 null)
 */
export function findFatigueFatalTurn(
  startHp: number,
  fatigueStartTurn: number,
): number | null {
  let accumulated = 0
  for (let n = 1; n <= 100; n++) {
    accumulated += n
    if (accumulated >= startHp) {
      return fatigueStartTurn + n
    }
  }
  return null
}
