/**
 * 상성(상극) 계산 유틸 — M5
 * 리라 스펙 §3-6 / M4 스펙 §3 AdvantageNote
 *
 * 상극 오행:
 *   木克土 / 土克水 / 水克火 / 火克金 / 金克木
 */

import type { FiveElement } from '@/types/elements'

export type AdvantageResult = 'advantage' | 'disadvantage' | 'neutral'

/** 각 오행이 克하는 오행 (왼쪽이 오른쪽을 이긴다) */
const DOMINATES_MAP: Record<FiveElement, FiveElement> = {
  '木': '土',
  '土': '水',
  '水': '火',
  '火': '金',
  '金': '木',
}

/**
 * 플레이어 오행 vs AI 오행 상성 판정
 * @returns 'advantage' | 'disadvantage' | 'neutral'
 */
export function getAdvantageRelation(
  playerEl: FiveElement,
  aiEl: FiveElement,
): AdvantageResult {
  if (DOMINATES_MAP[playerEl] === aiEl) return 'advantage'
  if (DOMINATES_MAP[aiEl] === playerEl) return 'disadvantage'
  return 'neutral'
}

/** 상성 안내 텍스트 생성 */
export function getAdvantageText(
  playerEl: FiveElement,
  aiEl: FiveElement,
): string {
  const result = getAdvantageRelation(playerEl, aiEl)
  switch (result) {
    case 'advantage':
      return `내 ${playerEl} 덱이 ${aiEl}에 유리합니다!`
    case 'disadvantage':
      return `${aiEl}이 내 ${playerEl}에 유리합니다. 전략이 필요합니다.`
    case 'neutral':
      return '상성 중립. 실력으로 승부합니다.'
  }
}
