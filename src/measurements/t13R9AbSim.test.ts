// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * T13 R9 작업 1: sikshin 실기여 어블레이션 (1000판 A/B)
 *
 * 목적: sikshin이 클리어율에 실제로 얼마나 기여하는지 측정.
 *
 * A: 목화 프리셋, sanggwan만 장착 (activePassiveIds: ['sanggwan']), enableFloorReward=true, 1000판
 * B: 목화 프리셋, sikshin+sanggwan 장착 (activePassiveIds: ['sikshin','sanggwan']), enableFloorReward=true, 1000판
 * 시드: i * 12345 + 7777 (A/B 동일)
 *
 * 보고 항목:
 *  1. 클리어율 A vs B (Wilson 95% CI)
 *  2. sikshin D안 버리기/판 (A=0, B=?)
 *  3. sanggwan 발동/판 (A vs B 비교)
 *  4. A/B 차이 = sikshin 단독 기여 추정치
 *
 * 실행: npm test -- src/test/t13R9AbSim.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'

// Wilson 95% CI
function wilsonCI(successes: number, total: number) {
  const p = successes / total
  const z = 1.96
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    point: p,
  }
}

function pct(v: number, digits = 2): string {
  return (v * 100).toFixed(digits) + '%'
}

const MOK_HWA_DIST: Record<Element, number> = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }
const MOK_HWA_ILGAN: Element = 'mok'
const RUNS = 1000

describe.skip('T13 R9 작업 1 — sikshin 실기여 어블레이션 (목화 1000판 A/B)', () => {
  it(
    'A(sanggwan만) vs B(sikshin+sanggwan) 클리어율 비교 — sikshin 단독 기여 측정',
    { timeout: 600000 },
    () => {
      const favorableElement = getFavorableElement(MOK_HWA_ILGAN)

      // ─── 그룹 A: sanggwan만 ──────────────────────────────────────────────
      const aPassives = ['sanggwan']
      let aCleared = 0
      let aSanggwanTotal = 0
      let aSanggwanOver2Runs = 0
      let aSikshinDiscardTotal = 0

      for (let i = 0; i < RUNS; i++) {
        const seed = i * 12345 + 7777
        const result = simulateFullCapRun(seed, {
          elementDist: MOK_HWA_DIST,
          ilganElement: MOK_HWA_ILGAN,
          favorableElement,
          activePassiveIds: aPassives,
          enableFloorReward: true,
        })
        if (result.victory) aCleared++
        const sg = result.traitCounts['passive_sanggwan'] ?? 0
        aSanggwanTotal += sg
        if (sg >= 3) aSanggwanOver2Runs++
        aSikshinDiscardTotal += result.traitCounts['passive_sikshin_discard'] ?? 0
      }

      // ─── 그룹 B: sikshin+sanggwan ────────────────────────────────────────
      const bPassives = ['sikshin', 'sanggwan']
      let bCleared = 0
      let bSanggwanTotal = 0
      let bSanggwanOver2Runs = 0
      let bSikshinDiscardTotal = 0

      for (let i = 0; i < RUNS; i++) {
        const seed = i * 12345 + 7777
        const result = simulateFullCapRun(seed, {
          elementDist: MOK_HWA_DIST,
          ilganElement: MOK_HWA_ILGAN,
          favorableElement,
          activePassiveIds: bPassives,
          enableFloorReward: true,
        })
        if (result.victory) bCleared++
        const sg = result.traitCounts['passive_sanggwan'] ?? 0
        bSanggwanTotal += sg
        if (sg >= 3) bSanggwanOver2Runs++
        bSikshinDiscardTotal += result.traitCounts['passive_sikshin_discard'] ?? 0
      }

      // ─── 보고 출력 ───────────────────────────────────────────────────────
      const aCI = wilsonCI(aCleared, RUNS)
      const bCI = wilsonCI(bCleared, RUNS)
      const delta = (bCI.point - aCI.point) * 100

      console.log('\n========================================')
      console.log('T13 R9 작업 1 — sikshin 실기여 어블레이션')
      console.log('목화 프리셋 | 1000판 | 시드: i*12345+7777 | enableFloorReward: true')
      console.log('A: sanggwan만  |  B: sikshin+sanggwan')
      console.log('========================================\n')

      console.log('## 클리어율 (Wilson 95% CI)')
      console.log('| 그룹 | 가호 | 클리어 | 클리어율 | CI 하한 | CI 상한 |')
      console.log('|------|------|--------|----------|---------|---------|')
      console.log(`| A | sanggwan | ${aCleared}/${RUNS} | ${pct(aCI.point)} | ${pct(aCI.low)} | ${pct(aCI.high)} |`)
      console.log(`| B | sikshin+sanggwan | ${bCleared}/${RUNS} | ${pct(bCI.point)} | ${pct(bCI.low)} | ${pct(bCI.high)} |`)

      console.log(`\n## sikshin 단독 기여 추정 (B − A)`)
      console.log(`Δ 클리어율 = ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p`)
      const ciOverlap = aCI.high >= bCI.low && bCI.high >= aCI.low
      console.log(`CI 교차 여부: ${ciOverlap ? '교차 (통계적 유의성 불분명)' : '미교차 (유의)'}`)

      console.log('\n## sikshin D안 버리기/판')
      console.log('| 그룹 | sikshin D안 버리기/판 |')
      console.log('|------|---------------------|')
      console.log(`| A (sanggwan만) | ${(aSikshinDiscardTotal / RUNS).toFixed(3)} (sikshin 미장착 — 0이어야 정상) |`)
      console.log(`| B (sikshin+sanggwan) | ${(bSikshinDiscardTotal / RUNS).toFixed(3)} |`)

      console.log('\n## sanggwan 발동/판 (A vs B 비교)')
      console.log('| 그룹 | 가호 | sanggwan 발동/판 | 3회+ 런 수(cap=2 실증) |')
      console.log('|------|------|----------------|----------------------|')
      console.log(`| A | sanggwan | ${(aSanggwanTotal / RUNS).toFixed(3)} | ${aSanggwanOver2Runs} |`)
      console.log(`| B | sikshin+sanggwan | ${(bSanggwanTotal / RUNS).toFixed(3)} | ${bSanggwanOver2Runs} |`)

      console.log('\n## SIKSHIN_BASE_SCORE 재산정 근거')
      console.log(`sikshin 기여 Δ = ${delta.toFixed(2)}%p`)
      // 목화 sanggwan 점수: 30.0 × (4/14) = 8.571
      const sanggwanScore = 30.0 * (4 / 14)
      console.log(`sanggwan 목화 점수 = 30.0 × (4/14) = ${sanggwanScore.toFixed(3)}`)
      // sanggwan R5→R8 합산 효과 추정: R5 목화 52.13% → R8 41.87% = -10.26%p
      // 하지만 이는 a(배율)+b(HP)+c(조건)+d(cap) 합산. sanggwan만의 효과를 직접 추정 불가.
      // 대신 A 그룹 자체가 sanggwan 단독 베이스라인이므로, B-A = sikshin 단독 기여.
      // sanggwan 기여: R5(sanggwan cap=3,배율1.5) vs R8(cap=2,배율1.25) 변화가 누적됨.
      // sanggwan 단독 기여 직접 측정 불가 (어블레이션 없음).
      // sikshin 기여 / sanggwan 기여 비율 추정:
      //   sanggwan 기여 추정: 목화 A vs sanggwan 미장착 기준이 없어 직접 측정 불가.
      //   보수적 추정: R8 목화(sikshin+sanggwan) 41.87% vs R8 금수(sikshin+jeongjae) 36.00%
      //   목화-금수 차이 5.87%p는 sanggwan vs jeongjae 차이 + 원소 분포 차이 혼재.
      //   sikshin 기여 Δ를 sanggwan 목화 점수(8.571) 기준으로 환산.
      const sikshinDeltaPct = delta  // %p 단위
      // sanggwan 기여 추정: A 그룹(sanggwan만) 클리어율 자체가 sanggwan 베이스라인.
      // sikshin 기여(Δ)를 sanggwan 점수(8.571) 대비 비율로 환산.
      // sanggwan 기여 직접 측정 불가 → 지시 원칙에 따라 비율 계산.
      // 지시: sanggwan 기여 약 5%p 추정 시 sikshin 점수 ≈ 8.57 × (Δ/5)
      // 실측 Δ를 기준으로 공식 적용:
      const sanggwanEstimatedContribPct = 5.0  // 지시 예시 값 (R5→R8 합산에서 추정)
      const sikshinNewScore = Math.max(0.5, Math.round((sanggwanScore * (sikshinDeltaPct / sanggwanEstimatedContribPct)) * 10) / 10)
      console.log(`\nsikshin Δ = ${sikshinDeltaPct.toFixed(2)}%p, sanggwan 기여 추정 = ${sanggwanEstimatedContribPct}%p (R5→R8 합산 계수)`)
      console.log(`SIKSHIN_BASE_SCORE 재산정: 8.571 × (${sikshinDeltaPct.toFixed(2)} / ${sanggwanEstimatedContribPct}) = ${(sanggwanScore * (sikshinDeltaPct / sanggwanEstimatedContribPct)).toFixed(2)}`)
      console.log(`최솟값 0.5 적용 후: ${sikshinNewScore.toFixed(1)}`)

      console.log('\n========================================\n')

      // ─── 어서션 ─────────────────────────────────────────────────────────
      expect(aCleared).toBeGreaterThanOrEqual(0)
      expect(aCleared).toBeLessThanOrEqual(RUNS)
      expect(bCleared).toBeGreaterThanOrEqual(0)
      expect(bCleared).toBeLessThanOrEqual(RUNS)
      // sikshin 미장착(A) 시 D안 버리기 = 0
      expect(aSikshinDiscardTotal).toBe(0)
      // sanggwan cap 2 실증: 3회+ 런 = 0
      expect(aSanggwanOver2Runs).toBe(0)
      expect(bSanggwanOver2Runs).toBe(0)
    }
  )
})
