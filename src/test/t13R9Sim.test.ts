/**
 * T13 R9 작업 3: 본시뮬 3000판 × 3종 (HANDOFF §4 완전 준수)
 *
 * 발사 전 확인 6줄:
 *  1. 커밋 해시    = 475d6ae (balance(R9): SIKSHIN_BASE_SCORE 18.0→3.9)
 *  2. 사주기반 코드 = fullCapBot.ts:L942 selectTalismanBySaju(dist)
 *  3. enableFloorReward = true
 *  4. 표준 3종 프리셋 dist 값:
 *     - 목화: {mok:4, hwa:4, to:2, geum:2, su:2}
 *     - 금수: {mok:2, hwa:2, to:2, geum:4, su:4}
 *     - 토단일: {mok:1, hwa:1, to:14, geum:2, su:2}
 *  5. 시드 = i * 12345 + 7777
 *  6. 가호 실측 (채점 보정 후 변경 확인):
 *     - 목화: sanggwan, geoptae  (R8: sikshin+sanggwan → R9: sanggwan+geoptae)
 *     - 금수: jeongjae, bigyeon  (R8: sikshin+jeongjae → R9: jeongjae+bigyeon)
 *     - 토단일: pyeonin, bigyeon (R8: pyeonin+sikshin  → R9: pyeonin+bigyeon)
 *     ⚠ 전 프리셋에서 sikshin 탈락 — 채점 보정 효과 직접 비교 불가 (가호 조합 변경)
 *
 * 변경 사항 (R8 대비):
 *  - SIKSHIN_BASE_SCORE: 18.0 → 3.9 (채점 보정 — 게임 수치 전면 동결)
 *  - 게임 수치 동결: sanggwan 배율(×1.25), HP(3층 680/4층 560), cap(2), sikshin D안(+10%)
 *
 * 가호 장착 방식: selectTalismanBySaju(dist) 사주 기반 (고정 지정 절대 금지)
 * enableFloorReward: true (생략 불가)
 * 판 수: 3000판
 *
 * 실행: npm test -- src/test/t13R9Sim.test.ts
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

// R8 실측 기준값 (비교용)
const R8_RATES: Record<string, number> = {
  '목화': 0.4187,
  '금수': 0.3600,
  '토단일': 0.3397,
}
const R8_TALISMANS: Record<string, string> = {
  '목화': 'sikshin+sanggwan',
  '금수': 'sikshin+jeongjae',
  '토단일': 'pyeonin+sikshin',
}

describe('T13 R9 본시뮬 — 사주기반 가호 3000판 (SIKSHIN_BASE_SCORE 3.9, 채점보정)', () => {

  // 발사 전 확인 item 6: 프리셋별 selectTalismanBySaju 실측
  it('발사 전 확인 — 프리셋별 selectTalismanBySaju 결과 실측 (채점 보정 후)', () => {
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
        let sanggwanOver2Runs = 0
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

          const sanggwanCount = result.traitCounts['passive_sanggwan'] ?? 0
          sanggwanTotal += sanggwanCount
          if (sanggwanCount >= 3) {
            sanggwanOver2Runs++
          }

          sikshinDiscardTotal += result.traitCounts['passive_sikshin_discard'] ?? 0
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
      console.log('T13 R9 본시뮬 보고서 (3000판)')
      console.log('커밋: 475d6ae | 시드: i*12345+7777 | enableFloorReward: true')
      console.log('가호: selectTalismanBySaju(dist) 사주기반')
      console.log('변경(R8대비): SIKSHIN_BASE_SCORE 18.0→3.9 (채점보정)')
      console.log('동결: sanggwan배율(×1.25), 3층HP(680), 4층HP(560), cap(2), sikshinD안(+10%)')
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

      // 가호 선택 변경 여부
      console.log('\n## 가호 선택 결과 (R8→R9 변경 여부)')
      console.log('| 프리셋 | R8 가호 | R9 가호 | 변경 여부 |')
      console.log('|--------|---------|---------|----------|')
      for (const r of results) {
        const r8 = R8_TALISMANS[r.label] ?? 'N/A'
        const r9 = r.selectedTalismans.join('+')
        const changed = r8 !== r9
        console.log(`| ${r.label} | ${r8} | ${r9} | ${changed ? '변경됨 (sikshin 탈락)' : '동일'} |`)
      }

      // 가호 발동 통계
      console.log('\n## 가호 발동 통계 (sanggwan/sikshin)')
      console.log('| 프리셋 | 선택 가호 | sanggwan 발동/판 | sanggwan 3회+ 런 | sikshin D안/판 | sikshin 낱장/판 |')
      console.log('|--------|----------|----------------|----------------|--------------|----------------|')
      for (const r of results) {
        const hasSanggwan = r.selectedTalismans.includes('sanggwan')
        const hasSikshin = r.selectedTalismans.includes('sikshin')
        console.log(
          `| ${r.label} | ${r.selectedTalismans.join('+')} ` +
          `| ${hasSanggwan ? (r.sanggwanTotal/r.total).toFixed(3) : 'N/A(미장착)'} ` +
          `| ${hasSanggwan ? r.sanggwanOver2Runs : 'N/A'} ` +
          `| ${hasSikshin ? (r.sikshinDiscardTotal/r.total).toFixed(3) : 'N/A(미장착/탈락)'} ` +
          `| ${hasSikshin ? (r.sikshinLegacyTotal/r.total).toFixed(3) : 'N/A(미장착/탈락)'} |`
        )
      }

      // R8→R9 변화량
      console.log('\n## R8→R9 변화량 분석 (채점 보정 단독 효과)')
      console.log('⚠ 가호 조합 변경으로 직접 비교 불가 — 반드시 명시')
      console.log('| 프리셋 | R8 클리어율 (가호) | R9 클리어율 (가호) | 변화량 | 비고 |')
      console.log('|--------|------------------|------------------|--------|------|')
      for (const r of ciResults) {
        const r8Rate = R8_RATES[r.label] ?? 0
        const r8Tal = R8_TALISMANS[r.label] ?? 'N/A'
        const delta = (r.ci.point - r8Rate) * 100
        const r9Tal = r.talismans.join('+')
        const gapNote = r8Tal !== r9Tal ? '가호 변경 — 단독 계수 비교 불가' : '가호 동일'
        console.log(
          `| ${r.label} | ${pct(r8Rate)} (${r8Tal}) | ${pct(r.ci.point)} (${r9Tal}) ` +
          `| ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p | ${gapNote} |`
        )
      }

      // 이든 판정 기준
      console.log('\n## 이든 판정 기준')
      for (const r of ciResults) {
        if (r.label === '목화') {
          const rate = r.ci.point * 100
          let verdict = ''
          if (rate <= 40) verdict = 'a: 목화 ≤40% → PASS (balance-v2 태그 후보)'
          else if (rate <= 42) verdict = 'b: 40~42% → 잔여는 진짜 게임 초과'
          else verdict = 'c: 42% 초과 → 가호 풀 구조 문제'
          console.log(`목화 ${pct(r.ci.point)}: ${verdict}`)
        }
      }
      console.log(`\n이든 예상 베팅: b (41 근방 유지) — 식신 기여 0이면 빼도 더해도 숫자는 크게 안 움직임`)

      // 판정
      console.log('\n## 전체 판정 기준 (25~40% + 격차 ≤15%p)')
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
        if (r.selectedTalismans.includes('sanggwan')) {
          expect(r.sanggwanOver2Runs).toBe(0)
        }
      }
    }
  )
})
