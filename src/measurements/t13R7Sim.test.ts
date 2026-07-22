// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * T13 R7 본시뮬 — 3000판 (2026-07-13 이든 지시)
 *
 * HANDOFF §4 완전 준수:
 *  1. 커밋 해시 = f2a4422 (balance(R7): sanggwan 발동조건 2→3장, 3층HP 620→660, 4층HP 520→560)
 *  2. selectTalismanBySaju 코드 라인 = fullCapBot.ts:L942
 *  3. enableFloorReward = true (opts.enableFloorReward: true 전달)
 *  4. 표준 3종 프리셋:
 *     - 목화: {mok:4, hwa:4, to:2, geum:2, su:2}
 *     - 금수: {mok:2, hwa:2, to:2, geum:4, su:4}
 *     - 토단일: {mok:1, hwa:1, to:14, geum:2, su:2}
 *  5. 시드 식 = i * 12345 + 7777
 *  6. 프리셋별 selectTalismanBySaju 결과 실측 (테스트 내 로그)
 *
 * 변경 사항 (R6 대비):
 *  a. sanggwan 발동 조건: hwaCount >= 2 → hwaCount >= 3 (paljajeonEngine.ts)
 *  b. 3층 HP: 620 → 660 (balance.ts)
 *  c. 4층 HP: 520 → 560 (balance.ts)
 *
 * 가호 장착 방식: selectTalismanBySaju(dist) 사주 기반 (a)안 — 고정 지정 절대 금지
 * enableFloorReward: true (생략 불가)
 * 판 수: 3000판
 *
 * 실행: npm test -- src/test/t13R7Sim.test.ts
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

describe.skip('T13 R7 본시뮬 — 사주기반 가호 3000판 (sanggwan 조건 3장+, 3층 660, 4층 560)', () => {

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

          // 상관 발동 추적 (화 3장+ 조건 변경 후 실발동 횟수 실측)
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
      console.log('T13 R7 본시뮬 보고서 (3000판)')
      console.log('커밋: f2a4422 | 시드: i*12345+7777 | enableFloorReward: true')
      console.log('가호: selectTalismanBySaju(dist) 사주기반 (a)안')
      console.log('변경(R6대비): a=sanggwan조건2→3장, b=3층HP620→660, c=4층HP520→560')
      console.log('========================================\n')

      // 클리어율 표
      console.log('## 클리어율 표 (Wilson 95% CI)')
      console.log('| 프리셋 | 선택 가호 | 클리어 | 클리어율 | CI 하한 | CI 상한 |')
      console.log('|--------|----------|--------|----------|---------|---------|')

      const clearRates: number[] = []
      for (const r of results) {
        const ci = wilsonCI(r.cleared, r.total)
        clearRates.push(ci.point)
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

      // 가호 발동 통계 (R7: sanggwan 화 3장+ 조건 변경 후 실발동 횟수 실측 필수)
      console.log('\n## 가호 발동 통계 (sanggwan 화3장+ 조건 변경 후 실발동 실측)')
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

      // sanggwan 3회+ 런 수 = 0 실증 (cap=2)
      console.log('\n## sanggwan 상한 2 실증 (화 3장+ 조건 변경 후)')
      for (const r of results) {
        if (r.selectedTalismans.includes('sanggwan')) {
          console.log(`${r.label}: sanggwan 발동/판 = ${(r.sanggwanTotal/r.total).toFixed(3)}, 3회+ 런 = ${r.sanggwanOver2Runs}판 (0판이어야 정상)`)
        }
      }

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
