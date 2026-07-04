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
 * 실제 피해량 계산 (순수 함수)
 * @param baseDamage - 기본 공격력
 * @param attackerElement - 공격자 오행 (null = 중립)
 * @param defenderElement - 방어자 오행 (null = 중립)
 * @returns 최종 피해량 (반올림)
 */
export function calculateDamage(
  baseDamage: number,
  attackerElement: FiveElement | null,
  defenderElement: FiveElement | null,
): number {
  const modifier = getCombatModifier(attackerElement, defenderElement)

  switch (modifier) {
    case 'dominate':
      // 상극: × 1.5, 반올림
      return Math.round(baseDamage * 1.5)
    case 'generate_defense':
      // 상생 방어: × 0.75, 반올림
      return Math.round(baseDamage * 0.75)
    case 'neutral':
      return baseDamage
  }
}
