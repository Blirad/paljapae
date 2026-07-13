/**
 * T13 R10 작업 3: 본시뮬 3000판 × 3종 (HANDOFF §4 완전 준수)
 *
 * 발사 전 확인 6줄:
 *  1. 커밋 해시    = R10 (geoptae 출정당 1회 + 2층HP 400→430) — 커밋 후 기록
 *  2. 사주기반 코드 = fullCapBot.ts:L946 selectTalismanBySaju(dist)
 *  3. enableFloorReward = true
 *  4. 표준 3종 프리셋 dist 값:
 *     - 목화: {mok:4, hwa:4, to:2, geum:2, su:2}
 *     - 금수: {mok:2, hwa:2, to:2, geum:4, su:4}
 *     - 토단일: {mok:1, hwa:1, to:14, geum:2, su:2}
 *  5. 시드 = i * 12345 + 7777
 *  6. 가호 실측 = selectTalismanBySaju(dist) 런타임 실측 (하단 it 블록에서 출력)
 *
 * 변경 사항 (R9 대비 — R10 합산):
 *  a. geoptae: 전투당(층마다) 1회 → 출정(런) 전체 1회 (geoptaeUsed 필드)
 *  b. 2층 HP: 400 → 430
 *
 * 동결 항목 (수정 금지):
 *  - sanggwan 배율 ×1.25, 발동조건 화3장+, cap 2회/런
 *  - sikshin D안 +10%
 *  - 3층HP 680, 4층HP 560
 *  - SIKSHIN_BASE_SCORE 3.9
 *
 * 가호 장착 방식: selectTalismanBySaju(dist) 사주 기반 (고정 지정 절대 금지)
 * enableFloorReward: true (생략 불가)
 * 판 수: 3000판
 *
 * 실행: npm test -- src/test/t13R10Sim.test.ts
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

// R9 실측 기준값 (비교용)
const R9_RATES: Record<string, number> = {
  '목화': 0.4517,
  '금수': 0.3540,
  '토단일': 0.3227,
}
const R9_TALISMANS: Record<string, string> = {
  '목화': 'sanggwan+geoptae',
  '금수': 'jeongjae+bigyeon',
  '토단일': 'pyeonin+bigyeon',
}

describe('T13 R10 본시뮬 — 사주기반 가호 3000판 (geoptae 출정당 1회 + 2층HP 430)', () => {

  // 발사 전 확인 item 6: 프리셋별 selectTalismanBySaju 실측
  it('발사 전 확인 — 프리셋별 selectTalismanBySaju 결과 실측 (R10 기준)', () => {
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
        sanggwanOver2Runs: number
        geoptaeTotal: number
        geoptaeOver1Runs: number  // geoptae 출정당 1회 초과 위반 런 수 (= 0 이어야 함)
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        let sanggwanTotal = 0
        let sanggwanOver2Runs = 0
        let geoptaeTotal = 0
        let geoptaeOver1Runs = 0

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

          const sanggwanCount = result.traitCounts['passive_sanggwan'] ?? 0
          sanggwanTotal += sanggwanCount
          if (sanggwanCount >= 3) {
            sanggwanOver2Runs++
          }

          const geoptaeCount = result.traitCounts['passive_geoptae'] ?? 0
          geoptaeTotal += geoptaeCount
          if (geoptaeCount >= 2) {
            geoptaeOver1Runs++  // 출정당 2회 이상 = 스펙 위반 (0이어야 함)
          }
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
          geoptaeTotal,
          geoptaeOver1Runs,
        })
      }

      // ─── 보고 출력 ───────────────────────────────────────────────────────

      console.log('\n========================================')
      console.log('T13 R10 본시뮬 보고서 (3000판)')
      console.log('커밋: R10 | 시드: i*12345+7777 | enableFloorReward: true')
      console.log('가호: selectTalismanBySaju(dist) 사주기반')
      console.log('변경(R9대비 합산): geoptae 출정당 1회 제한(a) + 2층HP 400→430(b)')
      console.log('동결: sanggwan배율(×1.25), 3층HP(680), 4층HP(560), cap(2), sikshinD안(+10%), SIKSHIN_BASE_SCORE(3.9)')
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

      // geoptae 발동/판 실측 (출정당 1회 상한 실증)
      console.log('\n## geoptae 발동/판 실측 (출정당 1회 상한 실증)')
      console.log('| 프리셋 | 선택 가호 | geoptae 발동/판 | 2회+ 런 수(cap=1 실증) |')
      console.log('|--------|----------|----------------|----------------------|')
      for (const r of results) {
        const hasGeoptae = r.selectedTalismans.includes('geoptae')
        console.log(
          `| ${r.label} | ${r.selectedTalismans.join('+')} ` +
          `| ${hasGeoptae ? (r.geoptaeTotal/r.total).toFixed(3) : 'N/A(미장착)'} ` +
          `| ${hasGeoptae ? r.geoptaeOver1Runs : 'N/A'} |`
        )
      }

      // sanggwan 발동 통계
      console.log('\n## sanggwan 발동/판 (sanggwan cap=2 실증)')
      console.log('| 프리셋 | 선택 가호 | sanggwan 발동/판 | 3회+ 런 수(cap=2 실증) |')
      console.log('|--------|----------|----------------|----------------------|')
      for (const r of results) {
        const hasSanggwan = r.selectedTalismans.includes('sanggwan')
        console.log(
          `| ${r.label} | ${r.selectedTalismans.join('+')} ` +
          `| ${hasSanggwan ? (r.sanggwanTotal/r.total).toFixed(3) : 'N/A(미장착)'} ` +
          `| ${hasSanggwan ? r.sanggwanOver2Runs : 'N/A'} |`
        )
      }

      // R9→R10 변화량 (합산, 라벨 규율)
      console.log('\n## R9→R10 변화량 분석 (합산: geoptae수정(a) + 2층HP(b) — 단독 계수 불가)')
      console.log('| 프리셋 | R9 클리어율 (가호) | R10 클리어율 (가호) | 변화량 | 비고 |')
      console.log('|--------|------------------|------------------|--------|------|')
      for (const r of ciResults) {
        const r9Rate = R9_RATES[r.label] ?? 0
        const r9Tal = R9_TALISMANS[r.label] ?? 'N/A'
        const delta = (r.ci.point - r9Rate) * 100
        const r10Tal = r.talismans.join('+')
        const gapNote = r9Tal !== r10Tal ? '가호 변경 — 단독 계수 비교 불가' : '합산(a+b) — 단독 계수 분리 불가'
        console.log(
          `| ${r.label} | ${pct(r9Rate)} (${r9Tal}) | ${pct(r.ci.point)} (${r10Tal}) ` +
          `| ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p | ${gapNote} |`
        )
      }

      // 이든 판정 기준 적용
      console.log('\n## 이든 판정 기준 적용')
      for (const r of ciResults) {
        if (r.label === '목화') {
          const rate = r.ci.point * 100
          let verdict = ''
          if (rate <= 40) {
            verdict = 'PASS → balance-v2 태그 대상'
          } else if (rate <= 41.5) {
            verdict = '조건부 통과 — 이든 근거 3가지 필요 (상한 근사/원인 특정/하한 무결)'
          } else {
            verdict = 'R11 미세 레버 1개 추가 필요 (41.5% 초과)'
          }
          console.log(`목화 ${pct(r.ci.point)}: ${verdict}`)
          console.log(`CI: [${pct(r.ci.low)} ~ ${pct(r.ci.high)}]`)
        }
      }

      // 전체 판정
      console.log('\n## 전체 판정 기준')
      const allInRange40 = clearRates.every(r => r <= 0.40)
      const gapOk = gap <= 0.15
      console.log(`전 프리셋 ≤40%: ${allInRange40 ? 'PASS' : 'FAIL (초과 존재)'}`)
      console.log(`격차 ≤15%p: ${gapOk ? 'PASS' : 'FAIL'} (실측: ${pct(gap)}p)`)

      console.log('\n========================================\n')

      // ─── 어서션 ─────────────────────────────────────────────────────────
      for (const r of results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared).toBeGreaterThanOrEqual(0)
        expect(r.cleared).toBeLessThanOrEqual(RUNS)
        expect(r.selectedTalismans.length).toBe(2)
        // sanggwan cap=2 실증: 3회+ 런 = 0
        if (r.selectedTalismans.includes('sanggwan')) {
          expect(r.sanggwanOver2Runs).toBe(0)
        }
        // geoptae cap=1 실증: 2회+ 런 = 0 (출정당 1회 상한 실증)
        if (r.selectedTalismans.includes('geoptae')) {
          expect(r.geoptaeOver1Runs).toBe(0)
        }
      }
    }
  )
})
