/**
 * 오행 상생(生) 공통 유틸 — 엔진·시뮬 하네스·분석 코드 공용
 *
 * SANG_MAP[X] === enemyEl → X가 적을 생 → ×0.5 페널티
 * getSangElement(enemyEl) → 적을 생하는 원소 반환
 *
 * 5종 매핑:
 *   木生火 → 적=火 일 때 ×0.5 = 木
 *   火生土 → 적=土 일 때 ×0.5 = 火
 *   土生金 → 적=金 일 때 ×0.5 = 土
 *   金生水 → 적=水 일 때 ×0.5 = 金
 *   水生木 → 적=木 일 때 ×0.5 = 水
 */

import type { Element } from '../types/game'
import { SANG_MAP } from '../engine/balance'

/**
 * 적 원소를 생하는 원소를 반환 (×0.5 페널티 대상)
 * SANG_MAP[result] === enemyEl
 */
export function getSangElement(enemyEl: Element): Element {
  for (const [attacker, target] of Object.entries(SANG_MAP)) {
    if (target === enemyEl) return attacker as Element
  }
  throw new Error(`No sang source found for enemy=${enemyEl}`)
}
