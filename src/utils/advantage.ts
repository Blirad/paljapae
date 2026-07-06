/**
 * 상성(상극) 계산 유틸 — M5 + M8 P0-2 (Challenge 4 역류 지원)
 * 리라 스펙 §3-6 / M4 스펙 §3 AdvantageNote
 *
 * 상극 오행 (기본):
 *   木克土 / 土克水 / 水克火 / 火克金 / 金克木
 *
 * Challenge 4 역류(逆行): 상극 관계가 반전됨
 */

import type { FiveElement } from '@/types/elements'

export type AdvantageResult = 'advantage' | 'disadvantage' | 'neutral'

/** 각 오행이 克하는 오행 (왼쪽이 오른쪽을 이긴다) — 기본 */
const DOMINATES_MAP: Record<FiveElement, FiveElement> = {
  '木': '土',
  '土': '水',
  '水': '火',
  '火': '金',
  '金': '木',
}

/** 역류(逆行) 상극 맵 — 상극 관계 반전 */
const DOMINATES_MAP_REVERSED: Record<FiveElement, FiveElement> = {
  '土': '木',
  '水': '土',
  '火': '水',
  '金': '火',
  '木': '金',
}

/**
 * 플레이어 오행 vs AI 오행 상성 판정
 * @param playerEl - 플레이어 오행
 * @param aiEl - AI 오행
 * @param reversed - Challenge 4 역류 적용 여부 (기본: false)
 * @returns 'advantage' | 'disadvantage' | 'neutral'
 */
export function getAdvantageRelation(
  playerEl: FiveElement,
  aiEl: FiveElement,
  reversed = false,
): AdvantageResult {
  const map = reversed ? DOMINATES_MAP_REVERSED : DOMINATES_MAP
  if (map[playerEl] === aiEl) return 'advantage'
  if (map[aiEl] === playerEl) return 'disadvantage'
  return 'neutral'
}

/** 상성 안내 텍스트 생성 */
export function getAdvantageText(
  playerEl: FiveElement,
  aiEl: FiveElement,
  reversed = false,
): string {
  const result = getAdvantageRelation(playerEl, aiEl, reversed)
  if (reversed) {
    switch (result) {
      case 'advantage':
        return `[역류] 내 ${playerEl} 덱이 ${aiEl}에 유리합니다! (상극 역전 중)`
      case 'disadvantage':
        return `[역류] ${aiEl}이 내 ${playerEl}에 유리합니다. (상극 역전 중)`
      case 'neutral':
        return '[역류] 상성 중립. 실력으로 승부합니다.'
    }
  }
  switch (result) {
    case 'advantage':
      return `내 ${playerEl} 덱이 ${aiEl}에 유리합니다!`
    case 'disadvantage':
      return `${aiEl}이 내 ${playerEl}에 유리합니다. 전략이 필요합니다.`
    case 'neutral':
      return '상성 중립. 실력으로 승부합니다.'
  }
}
