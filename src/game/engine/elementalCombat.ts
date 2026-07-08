/**
 * 오행 상성 전투 계산
 * 마스터플랜 §6-2 방식 A: 카드 vs 카드 상성
 *
 * 상극 관계 공격 = 데미지 × 1.5 (반올림)
 * 상생 관계 방어 = 받는 데미지 × 0.75 (반올림, 방어자가 생성자일 때)
 */

import type { FiveElement } from '@/types/elements'
import { DOMINATES, GENERATES } from '@/types/elements'

/**
 * 공격 오행이 방어 오행을 상극하는지 확인
 * 木克土 / 土克水 / 水克火 / 火克金 / 金克木
 */
export function isDominating(attacker: FiveElement, defender: FiveElement): boolean {
  return DOMINATES[attacker] === defender
}

/**
 * 방어 오행이 공격 오행을 상생(생성)하는지 확인
 * (방어자가 생성자일 때 피해 감소)
 * 예: 木 방어자 → 火 공격자를 상생 → 받는 피해 0.75배
 */
export function isDefenderGeneratingAttacker(
  attacker: FiveElement,
  defender: FiveElement,
): boolean {
  return GENERATES[defender] === attacker
}

export type CombatModifier = 'dominate' | 'generate_defense' | 'neutral'

/**
 * 상성 관계 판별
 */
export function getCombatModifier(
  attackerElement: FiveElement | null,
  defenderElement: FiveElement | null,
): CombatModifier {
  if (attackerElement === null || defenderElement === null) return 'neutral'
  if (isDominating(attackerElement, defenderElement)) return 'dominate'
  if (isDefenderGeneratingAttacker(attackerElement, defenderElement)) return 'generate_defense'
  return 'neutral'
}

/**
 * Phase 2-1: 일진(日辰) 오행 vs 공격자 오행 배율 계산
 * - 일진과 공격자가 상생 관계: × 1.2 (공격자가 일진의 기운을 받음)
 * - 일진과 공격자가 상극 관계: × 0.8 (공격자가 일진에 억눌림)
 * - 동일 오행: × 1.2 (일진 오행 강화)
 * - 중립: × 1.0
 *
 * 상생 조건:
 *   GENERATES[attackerElement] === dailyElement (공격자가 일진을 생함)
 *   OR GENERATES[dailyElement] === attackerElement (일진이 공격자를 생함)
 * 상극 조건:
 *   DOMINATES[dailyElement] === attackerElement (일진이 공격자를 극함)
 */
export function getDailyElementModifier(
  attackerElement: FiveElement | null,
  dailyElement: FiveElement | null | undefined,
): number {
  if (!attackerElement || !dailyElement) return 1.0
  // 동일 오행: 일진 오행 강화
  if (attackerElement === dailyElement) return 1.2
  // 상생: 공격자↔일진 간 상생 관계
  if (GENERATES[attackerElement] === dailyElement || GENERATES[dailyElement] === attackerElement) return 1.2
  // 상극: 일진이 공격자를 극함
  if (DOMINATES[dailyElement] === attackerElement) return 0.8
  return 1.0
}

/**
 * 실제 피해량 계산 (순수 함수)
 * @param baseDamage - 기본 공격력
 * @param attackerElement - 공격자 오행 (null = 중립)
 * @param defenderElement - 방어자 오행 (null = 중립)
 * @param relicModifier - Phase 1-C: 유물 기반 배율 수정자 (기본값 1.0)
 * @param dailyElement - Phase 2-1: 오늘 일진 오행 (undefined/null = 미적용)
 * @returns 최종 피해량 (반올림)
 */
export function calculateDamage(
  baseDamage: number,
  attackerElement: FiveElement | null,
  defenderElement: FiveElement | null,
  relicModifier: number = 1.0,
  dailyElement?: FiveElement | null,
): number {
  const modifier = getCombatModifier(attackerElement, defenderElement)
  let finalDamage = baseDamage

  switch (modifier) {
    case 'dominate':
      // 상극: × 1.5, 반올림
      finalDamage = baseDamage * 1.5
      break
    case 'generate_defense':
      // 상생 방어: × 0.75, 반올림
      finalDamage = baseDamage * 0.75
      break
    case 'neutral':
      finalDamage = baseDamage
      break
  }

  // Phase 1-C: 유물 기반 배율 수정 적용
  finalDamage *= relicModifier

  // Phase 2-1: 일진 오행 배율 적용
  if (dailyElement !== undefined && dailyElement !== null) {
    finalDamage *= getDailyElementModifier(attackerElement, dailyElement)
  }

  return Math.round(finalDamage)
}
