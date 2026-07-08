/**
 * 유물 효과 디스패처 — Phase 1-C
 * hookPoint 기반 유물 효과 적용 시스템
 * elementalCombat 상성 배율을 유물이 조정 가능하게 함
 */

import type { FiveElement } from '@/types/elements'
import type { Relic } from '@/types/relics'
import type { CombatModifier } from './elementalCombat'

/**
 * 유물 기반 상성 배율 수정자 계산
 * @param relics - 플레이어 보유 유물 목록
 * @param modifier - 기본 상성 판정 ('dominate' | 'generate_defense' | 'neutral')
 * @param attackerElement - 공격자 오행
 * @param defenderElement - 방어자 오행
 * @param playerElement - 플레이어(주인) 오행 (약한 오행 판별용)
 * @param playerElementScore - 플레이어 오행 점수 (약한 오행 판별용)
 * @returns 수정된 배율 multiplier (1.0 = 무수정)
 */
export function calculateRelicCombatModifier(
  relics: Relic[],
  modifier: CombatModifier,
  attackerElement: FiveElement | null,
  _defenderElement: FiveElement | null,
  playerElement?: FiveElement,
  playerElementScore?: Record<FiveElement, number>,
): number {
  let multiplier = 1.0

  // Phase 1-C: 상극 중화 부적 (RELIC_DOMINATE_NEUTRALIZE)
  // 피상극 관계일 때 (generate_defense) 배율 0.75 → 0.9로 완화
  if (modifier === 'generate_defense') {
    const hasNeutralize = relics.some(r => r.id === 'RELIC_DOMINATE_NEUTRALIZE')
    if (hasNeutralize) {
      // 0.75 → 0.9로 개선 (damage / 0.75 * 0.9 = damage * 1.2)
      // 직접 배율로 반환: 0.9 / 0.75 = 1.2
      multiplier *= (0.9 / 0.75)
    }
  }

  // Phase 1-C: 신살 무기 (RELIC_FIVE_ELEMENT_SPIRIT_WEAPON)
  // 없는 오행에 공격 시 중립 처리 (0.75 페널티 면제)
  if (
    playerElement &&
    playerElementScore &&
    modifier === 'generate_defense' &&
    attackerElement === playerElement
  ) {
    const hasWeapon = relics.some(r => r.id === 'RELIC_FIVE_ELEMENT_SPIRIT_WEAPON')
    if (hasWeapon && playerElementScore[playerElement] === 0) {
      // 약한 오행 공격 시 neutral로 처리 (0.75 → 1.0)
      multiplier *= (1.0 / 0.75)
    }
  }

  return multiplier
}

/**
 * 약한 오행 (점수 0) 판별
 */
export function getWeakElements(
  elementScore: Record<FiveElement, number>,
): FiveElement[] {
  return (Object.entries(elementScore) as [FiveElement, number][])
    .filter(([_, score]) => score === 0)
    .map(([elem]) => elem)
}
