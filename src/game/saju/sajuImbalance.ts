/**
 * 사주 오행 불균형 지수 계산 모듈 — Phase 1-A
 *
 * 입력: ElementScore = {木:a, 火:b, 土:c, 金:d, 水:e}
 * 합계 S = a+b+c+d+e (항상 6 — 년·월·일 3주 × 천간+지지 2점)
 * 균등값 E = S / 5 = 1.2
 * σ = sqrt( Σ(각 점수 - E)² / 5 ) / E
 *
 * 판정:
 *   σ > 1.5 or ratio ≥ 0.7 → 'extreme' (극단 불균형)
 *   σ 0.6~1.5             → 'moderate' (중간 불균형)
 *   σ < 0.6               → 'balanced' (균형형)
 */

import type { FiveElement } from '@/types/elements'

export type ImbalanceTier = 'extreme' | 'moderate' | 'balanced'

export interface ImbalanceResult {
  sigma: number           // 불균형 지수 (0.0 = 완전 균형, 1.0+ = 극단)
  ratio: number           // 주 오행 비율 (최대 점수 / 합계)
  tier: ImbalanceTier     // 3단계 판정
  dominantElement: FiveElement
}

const ORDER: FiveElement[] = ['木', '火', '土', '金', '水']

/**
 * 불균형 지수(σ) 계산
 *
 * @param elementScore 오행별 점수 분포 (합계 = 6 기준, 다른 합계도 허용)
 * @returns ImbalanceResult
 */
export function calculateImbalance(
  elementScore: Record<FiveElement, number>,
): ImbalanceResult {
  const total = ORDER.reduce((sum, el) => sum + elementScore[el], 0)

  // 합계가 0이면 완전 균형으로 처리
  if (total === 0) {
    return {
      sigma: 0,
      ratio: 0,
      tier: 'balanced',
      dominantElement: '木',
    }
  }

  const E = total / 5  // 균등값 (합계 6 기준 → 1.2)

  // σ = sqrt( Σ(x_i - E)² / 5 ) / E
  const variance = ORDER.reduce((sum, el) => {
    const diff = elementScore[el] - E
    return sum + diff * diff
  }, 0) / 5

  const sigma = Math.sqrt(variance) / E

  // 주 오행 (최고 점수, 동점 시 오행 순서 앞 선택)
  const maxScore = Math.max(...ORDER.map(el => elementScore[el]))
  const dominantElement = ORDER.find(el => elementScore[el] === maxScore) ?? '木'

  // 주 오행 비율
  const ratio = maxScore / total

  // 3단계 판정
  let tier: ImbalanceTier
  if (sigma > 1.5 || ratio >= 0.7) {
    tier = 'extreme'
  } else if (sigma >= 0.6) {
    tier = 'moderate'
  } else {
    tier = 'balanced'
  }

  return { sigma, ratio, tier, dominantElement }
}
