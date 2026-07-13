/**
 * T13 R8 본시뮬 — 3000판 (2026-07-13 이든 지시)
 *
 * HANDOFF §4 완전 준수:
 *  1. 커밋 해시 = 4bec1ce (balance(R8): sanggwan 배율 1.3→1.25, 3층HP 660→680)
 *  2. selectTalismanBySaju 코드 라인 = fullCapBot.ts:L942
 *  3. enableFloorReward = true (opts.enableFloorReward: true 전달)
 *  4. 표준 3종 프리셋:
 *     - 목화: {mok:4, hwa:4, to:2, geum:2, su:2}
 *     - 금수: {mok:2, hwa:2, to:2, geum:4, su:4}
 *     - 토단일: {mok:1, hwa:1, to:14, geum:2, su:2}
 *  5. 시드 식 = i * 12345 + 7777
 *  6. 프리셋별 selectTalismanBySaju 결과 실측 (테스트 내 로그)
 *
 * 변경 사항 (R7 대비):
 *  a. sanggwan 배율: ×1.3 → ×1.25 (paljajeonEngine.ts)
 *  b. 3층 HP: 660 → 680 (balance.ts)
 *
 * 동결 항목: sanggwan 발동 조건(화 3장+), cap(2), sikshin D안(+10%), 4층 HP(560)
 *
 * 가호 장착 방식: selectTalismanBySaju(dist) 사주 기반 (a)안 — 고정 지정 절대 금지
 * enableFloorReward: true (생략 불가)
 * 판 수: 3000판
 *
 * 실행: npm test -- src/test/t13R8Sim.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
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

const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
  },
]

describe('T13 R8 본시뮬 — 사주기반 가호 3000판 (sanggwan 배율×1.25, 3층HP 680)', () => {

  // 발사 전 확인 item 6: 프리셋별 selectTalismanBySaju 실측
  it('발사 전 확인 — 프리셋별 selectTalismanBySaju 결과 실측', () => {
    for (const preset of PRESETS) {
      const selected = selectTalismanBySaju(preset.dist)
      console.log(`[사주기반 가호] ${preset.label}(${preset.ilgan}): ${selected.join(', ')}`)
      expect(selected.length).toBe(2)
      expect(selected.every(id => typeof id === 'string')).toBe(true)
    }
  })

  it(
    '프리셋 3종 × 3000판 — 클리어율/층별사망/가호발동 (시드: i*12345+7777)',
    { timeout: 600000 },
    () => {
      const RUNS = 3000

      interface PresetResult {
        label: string
        dist: Record<Element, number>
        ilgan: Element
        selectedTalismans: string[]
        cleared: number
        total: number
        deathsByFloor: Record<number, number>
        sanggwanTotal: number
        sanggwanOver2Runs: number  // 3회 이상 발동된 런 수 (상한 2 실증)
        sikshinDiscardTotal: number
        sikshinLegacyTotal: number
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        let sanggwanTotal = 0
        let sanggwanOver2Runs = 0  // sanggwan 발동이 3회 이상인 런 수 (cap=2 실증)
        let sikshinDiscardTotal = 0
        let sikshinLegacyTotal = 0

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const result = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds: selectedTalismans,
            enableFloorReward: true,
          })

          if (result.victory) {
            cleared++
          } else if (result.deathFloor !== null) {
            deathsByFloor[result.deathFloor] = (deathsByFloor[result.deathFloor] ?? 0) + 1
          }

          // 상관 발동 추적 (화 3장+ 조건, cap=2 실증)
          const sanggwanCount = result.traitCounts['passive_sanggwan'] ?? 0
          sanggwanTotal += sanggwanCount
          if (sanggwanCount >= 3) {
            sanggwanOver2Runs++  // cap 2이면 이 값이 0이어야 함
          }

          // sikshin D안 발동 추적 (버리기 경로)
          sikshinDiscardTotal += result.traitCounts['passive_sikshin_discard'] ?? 0

          // sikshin 기존 낱장 발동 추적
          sikshinLegacyTotal += result.traitCounts['passive_sikshin'] ?? 0
        }

        results.push({
          label: preset.label,
          dist: preset.dist,
          ilgan: preset.ilgan,
          selectedTalismans,
          cleared,
          total: RUNS,
          deathsByFloor,
          sanggwanTotal,
          sanggwanOver2Runs,
          sikshinDiscardTotal,
          sikshinLegacyTotal,
        })
      }

      // ─── 보고 출력 ───────────────────────────────────────────────────────

      console.log('\n========================================')
      console.log('T13 R8 본시뮬 보고서 (3000판)')
      console.log('커밋: 4bec1ce | 시드: i*12345+7777 | enableFloorReward: true')
      console.log('가호: selectTalismanBySaju(dist) 사주기반 (a)안')
      console.log('변경(R7대비): a=sanggwan배율1.3→1.25, b=3층HP660→680')
      console.log('동결: sanggwan조건(화3장+), cap(2), sikshinD안(+10%), 4층HP(560)')
      console.log('========================================\n')

      // 클리어율 표
      console.log('## 클리어율 표 (Wilson 95% CI)')
      console.log('| 프리셋 | 선택 가호 | 클리어 | 클리어율 | CI 하한 | CI 상한 |')
      console.log('|--------|----------|--------|----------|---------|---------|')

      const clearRates: number[] = []
      const ciResults: { label: string; ci: ReturnType<typeof wilsonCI>; talismans: string[] }[] = []
      for (const r of results) {
        const ci = wilsonCI(r.cleared, r.total)
        clearRates.push(ci.point)
        ciResults.push({ label: r.label, ci, talismans: r.selectedTalismans })
        console.log(
          `| ${r.label} | ${r.selectedTalismans.join('+')} ` +
          `| ${r.cleared}/${r.total} | ${pct(ci.point)} ` +
          `| ${pct(ci.low)} | ${pct(ci.high)} |`
        )
      }

      const maxRate = Math.max(...clearRates)
      const minRate = Math.min(...clearRates)
      const gap = maxRate - minRate
      console.log(`\n격차: ${pct(gap)}p`)

      // 층별 사망 분포
      console.log('\n## 층별 사망 분포')
      console.log('| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |')
      console.log('|--------|----------|----------|----------|----------|--------|')
      for (const r of results) {
        console.log(
          `| ${r.label} ` +
          `| ${r.deathsByFloor[1]}(${pct(r.deathsByFloor[1]/r.total)}) ` +
          `| ${r.deathsByFloor[2]}(${pct(r.deathsByFloor[2]/r.total)}) ` +
          `| ${r.deathsByFloor[3]}(${pct(r.deathsByFloor[3]/r.total)}) ` +
          `| ${r.deathsByFloor[4]}(${pct(r.deathsByFloor[4]/r.total)}) ` +
          `| ${r.cleared} |`
        )
      }

      // 가호 발동 통계
      console.log('\n## 가호 발동 통계 (sanggwan 화3장+ cap=2, sikshinD안 버리기경로)')
      console.log('| 프리셋 | 선택 가호 | 상관 발동/판 | 상관 3회+ 런 수 | sikshin D안/판 | sikshin 낱장/판 |')
      console.log('|--------|----------|------------|----------------|--------------|----------------|')
      for (const r of results) {
        const hasSanggwan = r.selectedTalismans.includes('sanggwan')
        const hasSikshin = r.selectedTalismans.includes('sikshin')
        console.log(
          `| ${r.label} | ${r.selectedTalismans.join('+')} ` +
          `| ${hasSanggwan ? (r.sanggwanTotal/r.total).toFixed(3) : 'N/A(미장착)'} ` +
          `| ${hasSanggwan ? r.sanggwanOver2Runs : 'N/A'} ` +
          `| ${hasSikshin ? (r.sikshinDiscardTotal/r.total).toFixed(3) : 'N/A(미장착)'} ` +
          `| ${hasSikshin ? (r.sikshinLegacyTotal/r.total).toFixed(3) : 'N/A(미장착)'} |`
        )
      }

      // sanggwan 상한 2 실증
      console.log('\n## sanggwan 상한 2 실증 (화 3장+ 조건 유지)')
      for (const r of results) {
        if (r.selectedTalismans.includes('sanggwan')) {
          console.log(`${r.label}: sanggwan 발동/판 = ${(r.sanggwanTotal/r.total).toFixed(3)}, 3회+ 런 = ${r.sanggwanOver2Runs}판 (0판이어야 정상)`)
        }
      }

      // R7 → R8 변화량 (합산 계수, 라벨 규율 준수)
      // R7 실측: 목화 43.43%, 금수 37.90%, 토단일 34.83%
      const R7_RATES: Record<string, number> = {
        '목화': 0.4343,
        '금수': 0.3790,
        '토단일': 0.3483,
      }
      console.log('\n## R7 → R8 변화량 분석 (a+b 합산 계수, 단독 계수 주장 금지)')
      console.log('| 프리셋 | R7 클리어율 | R8 클리어율 | 변화량(합산) | 판정 |')
      console.log('|--------|------------|------------|------------|------|')
      for (const r of ciResults) {
        const r7Rate = R7_RATES[r.label] ?? 0
        const delta = (r.ci.point - r7Rate) * 100
        console.log(
          `| ${r.label} | ${pct(r7Rate)} | ${pct(r.ci.point)} ` +
          `| ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p | a(배율)+b(3층HP) 합산 |`
        )
      }

      // 이든 예상치 대비
      // R8 이든 예상: 목화~39%, 금수~36%, 토단일~33.8%
      const EDEN_EXPECTED: Record<string, number> = {
        '목화': 0.39,
        '금수': 0.36,
        '토단일': 0.338,
      }
      console.log('\n## 이든 예상치 대비 (목화~39%, 금수~36%, 토단일~33.8%)')
      console.log('| 프리셋 | 이든 예상 | R8 실측 | 차이 |')
      console.log('|--------|----------|---------|------|')
      for (const r of ciResults) {
        const expected = EDEN_EXPECTED[r.label] ?? 0
        const diff = (r.ci.point - expected) * 100
        console.log(
          `| ${r.label} | ~${pct(expected)} | ${pct(r.ci.point)} ` +
          `| ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p |`
        )
      }

      console.log('\n## 판정 기준 (전 프리셋 25~40% + 격차 ≤15%p)')
      const allInRange = clearRates.every(r => r >= 0.25 && r <= 0.40)
      const gapOk = gap <= 0.15
      console.log(`전 프리셋 25~40% 범위: ${allInRange ? 'PASS' : 'FAIL (일부 초과)'}`)
      console.log(`격차 ≤15%p: ${gapOk ? 'PASS' : 'FAIL'} (실측: ${pct(gap)}p)`)

      console.log('\n========================================\n')

      // ─── 어서션 ─────────────────────────────────────────────────────────
      for (const r of results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared).toBeGreaterThanOrEqual(0)
        expect(r.cleared).toBeLessThanOrEqual(RUNS)
        expect(r.selectedTalismans.length).toBe(2)
        // sanggwan 상한 2 실증: 3회+ 런은 0이어야 함
        if (r.selectedTalismans.includes('sanggwan')) {
          expect(r.sanggwanOver2Runs).toBe(0)
        }
      }
    }
  )
})
