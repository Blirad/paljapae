/**
 * R7-2번 게이트 데이터 수집 — 4층 적 원소 강제 시뮬
 * 목표: 생(×0.5) 페널티 콤보 회피 여부 측정
 *
 * 커밋: 871c69d (fullCapBot 정본 버전)
 * 실행: npm test -- src/test/gate2CollectData.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun } from '../engine/fullCapBot'
import { SANG_MAP } from '../engine/balance'
import { getSangElement } from './sangTestUtils'

interface Floor4Run {
  runNum: number
  representativeElement: Element
  playedCount: number
  passed: boolean
}

function getRepresentativeElement(elements: Element[]): Element {
  const counts: Record<string, number> = {}
  for (const el of elements) {
    counts[el] = (counts[el] ?? 0) + 1
  }
  let maxEl = elements[0]
  let maxCount = 0
  for (const [el, cnt] of Object.entries(counts)) {
    if (cnt > maxCount) {
      maxCount = cnt
      maxEl = el as Element
    }
  }
  return maxEl
}

function analyzeFloor4Distribution(runs: Floor4Run[]) {
  const distribution: Record<Element, { count: number; passed: number }> = {
    mok: { count: 0, passed: 0 },
    hwa: { count: 0, passed: 0 },
    to: { count: 0, passed: 0 },
    geum: { count: 0, passed: 0 },
    su: { count: 0, passed: 0 },
  }

  for (const run of runs) {
    distribution[run.representativeElement].count++
    if (run.passed) {
      distribution[run.representativeElement].passed++
    }
  }

  return distribution
}

describe('R7-2 게이트 검증 — 4층 적 원소 강제 검증', () => {
  it('4층 적=土 강제 × mokHwaHeavy 500판 수집 및 분석', () => {
    const RUNS = 500
    const SAJU_PRESET = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }
    const YONGSIN = 'su'
    const ENEMY_EL: Element = 'to'

    // SANG_MAP 기반 ×0.5 원소 결정: X가 적을 생 → SANG_MAP[X] === enemyEl
    const sangEl = getSangElement(ENEMY_EL)

    const floor4Runs: Floor4Run[] = []

    console.log('\n========== R7-2 게이트 검증 [1/2] ==========\n')
    console.log(`--- 4층 적=${ENEMY_EL} 강제 × mokHwaHeavy 500판 ---`)
    console.log(`--- ×0.5 생 원소 = ${sangEl} (${sangEl}生${ENEMY_EL}) ---\n`)

    for (let i = 0; i < RUNS; i++) {
      const result = simulateFullCapRun(i * 12345 + 7777, {
        elementDist: SAJU_PRESET as Record<Element, number>,
        favorableElement: YONGSIN as Element,
        forceFloor4Element: ENEMY_EL,
      })

      if (result.reachedFloor4 && result.floor4PlayedElements) {
        const repEl = getRepresentativeElement(result.floor4PlayedElements)
        floor4Runs.push({
          runNum: i,
          representativeElement: repEl,
          playedCount: result.floor4PlayedElements.length,
          passed: result.victory && result.floorsCleared >= 4,
        })
      }
    }

    const dist_To = analyzeFloor4Distribution(floor4Runs)

    console.log(`4층 도달: ${floor4Runs.length}회\n`)

    console.log('대표 원소 분포:')
    console.log('| 원소 | 콤보 | 비율 | 통과 | 통과율 |')
    console.log('|------|------|------|------|--------|')

    const elements: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
    for (const el of elements) {
      const d = dist_To[el]
      const ratio = d.count > 0 ? ((d.count / floor4Runs.length) * 100).toFixed(1) : '0.0'
      const passRate = d.count > 0 ? ((d.passed / d.count) * 100).toFixed(1) : '0.0'
      console.log(
        `| ${el}  | ${d.count.toString().padStart(4)} | ${ratio.padStart(4)}% | ${d.passed.toString().padStart(4)} | ${passRate.padStart(5)}% |`
      )
    }

    const totalPassed_To = Object.values(dist_To).reduce((sum, d) => sum + d.passed, 0)
    const totalPassRate_To = ((totalPassed_To / floor4Runs.length) * 100).toFixed(1)
    console.log(
      `| 합계 | ${floor4Runs.length.toString().padStart(4)} | 100.0% | ${totalPassed_To.toString().padStart(4)} | ${totalPassRate_To.padStart(5)}% |`
    )

    // ×0.5 분석: SANG_MAP 기반 동적 결정
    const sangCount = dist_To[sangEl].count
    const sangPassRate =
      sangCount > 0 ? ((dist_To[sangEl].passed / sangCount) * 100).toFixed(1) : '0.0'
    const nonSangCount = floor4Runs.length - sangCount
    const nonSangPassed = totalPassed_To - dist_To[sangEl].passed
    const nonSangPassRate =
      nonSangCount > 0 ? ((nonSangPassed / nonSangCount) * 100).toFixed(1) : '0.0'

    console.log(`\n×0.5 콤보(${sangEl}) 분석 — ${sangEl}生${ENEMY_EL}:`)
    console.log(`| 구분 | 콤보 | 통과 | 통과율 |`)
    console.log(`|------|------|------|--------|`)
    console.log(
      `| ×0.5(${sangEl}) | ${sangCount.toString().padStart(4)} | ${dist_To[sangEl].passed.toString().padStart(4)} | ${sangPassRate.padStart(5)}% |`
    )
    console.log(
      `| 비×0.5 | ${nonSangCount.toString().padStart(4)} | ${nonSangPassed.toString().padStart(4)} | ${nonSangPassRate.padStart(5)}% |`
    )

    const passRateDiff = (parseFloat(nonSangPassRate) - parseFloat(sangPassRate)).toFixed(1)
    console.log(`| 차이 | - | - | ${passRateDiff.padStart(5)}%p |`)

    expect(floor4Runs.length).toBeGreaterThan(0)
    expect(sangCount).toBeGreaterThan(-1)
  })

  it('4층 적=木 강제 × mokHwaHeavy 500판 수집 및 분석 (참고치)', () => {
    const RUNS = 500
    const SAJU_PRESET = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }
    const YONGSIN = 'su'
    const ENEMY_EL: Element = 'mok'

    // SANG_MAP 기반 ×0.5 원소 결정
    const sangEl = getSangElement(ENEMY_EL)

    const floor4Runs: Floor4Run[] = []

    console.log(`\n--- 4층 적=${ENEMY_EL} 강제 × mokHwaHeavy 500판 (참고치) ---`)
    console.log(`--- ×0.5 생 원소 = ${sangEl} (${sangEl}生${ENEMY_EL}) ---\n`)

    for (let i = 0; i < RUNS; i++) {
      const result = simulateFullCapRun(i * 12345 + 7777, {
        elementDist: SAJU_PRESET as Record<Element, number>,
        favorableElement: YONGSIN as Element,
        forceFloor4Element: ENEMY_EL,
      })

      if (result.reachedFloor4 && result.floor4PlayedElements) {
        const repEl = getRepresentativeElement(result.floor4PlayedElements)
        floor4Runs.push({
          runNum: i,
          representativeElement: repEl,
          playedCount: result.floor4PlayedElements.length,
          passed: result.victory && result.floorsCleared >= 4,
        })
      }
    }

    const dist_Mok = analyzeFloor4Distribution(floor4Runs)

    console.log(`4층 도달: ${floor4Runs.length}회\n`)

    console.log('대표 원소 분포:')
    console.log('| 원소 | 콤보 | 비율 | 통과 | 통과율 |')
    console.log('|------|------|------|------|--------|')

    const elements: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
    for (const el of elements) {
      const d = dist_Mok[el]
      const ratio = d.count > 0 ? ((d.count / floor4Runs.length) * 100).toFixed(1) : '0.0'
      const passRate = d.count > 0 ? ((d.passed / d.count) * 100).toFixed(1) : '0.0'
      console.log(
        `| ${el}  | ${d.count.toString().padStart(4)} | ${ratio.padStart(4)}% | ${d.passed.toString().padStart(4)} | ${passRate.padStart(5)}% |`
      )
    }

    const totalPassed_Mok = Object.values(dist_Mok).reduce((sum, d) => sum + d.passed, 0)
    const totalPassRate_Mok = ((totalPassed_Mok / floor4Runs.length) * 100).toFixed(1)
    console.log(
      `| 합계 | ${floor4Runs.length.toString().padStart(4)} | 100.0% | ${totalPassed_Mok.toString().padStart(4)} | ${totalPassRate_Mok.padStart(5)}% |`
    )

    // ×0.5 분석: SANG_MAP 기반
    const sangCount = dist_Mok[sangEl].count
    const sangPassRate =
      sangCount > 0 ? ((dist_Mok[sangEl].passed / sangCount) * 100).toFixed(1) : '0.0'
    const nonSangCount = floor4Runs.length - sangCount
    const nonSangPassed = totalPassed_Mok - dist_Mok[sangEl].passed
    const nonSangPassRate =
      nonSangCount > 0 ? ((nonSangPassed / nonSangCount) * 100).toFixed(1) : '0.0'

    console.log(`\n×0.5 콤보(${sangEl}) 분석 — ${sangEl}生${ENEMY_EL}:`)
    console.log(`| 구분 | 콤보 | 통과율 |`)
    console.log(`|------|------|--------|`)
    console.log(`| ×0.5(${sangEl}) | ${sangCount.toString().padStart(4)} | ${sangPassRate.padStart(5)}% |`)
    console.log(`| 비×0.5 | ${nonSangCount.toString().padStart(4)} | ${nonSangPassRate.padStart(5)}% |`)

    const passRateDiff = (parseFloat(nonSangPassRate) - parseFloat(sangPassRate)).toFixed(1)
    console.log(`| 차이 | - | ${passRateDiff.padStart(5)}%p |`)

    console.log('\n========================================\n')

    expect(floor4Runs.length).toBeGreaterThan(0)
    expect(sangCount).toBeGreaterThan(-1)
  })
})
