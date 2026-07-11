/**
 * 팔자전 재밸런스 R2 — 3종 × 1000판 시뮬레이션
 *
 * 프리셋:
 *  G: 목화 우세 { mok:4, hwa:4, to:2, geum:2, su:2 }, 용신=su
 *  H: 금수 우세 { mok:2, hwa:2, to:2, geum:4, su:4 }, 용신=mok
 *  I: 토 단일   { mok:1, hwa:1, to:8, geum:1, su:1 }, 용신=mok
 *
 * 판정 기준:
 *  - 전 사주 클리어율 25~40%
 *  - 사주간 격차 15%p 이내
 *  - 700+/1000 집중층 → HP 검토 신호
 */

import { describe, it } from 'vitest'
import { runFullCapSimulation } from '../engine/fullCapBot'
import type { Element } from '../types/game'

// --- 프리셋 정의 ---

/** G: 목화 우세 */
const R2_mokHwa = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  favorableElement: 'su' as Element,
}

/** H: 금수 우세 */
const R2_geumSu = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  favorableElement: 'mok' as Element,
}

/** I: 토 단일 */
const R2_to = {
  elementDist: { mok: 1, hwa: 1, to: 8, geum: 1, su: 1 } as Record<Element, number>,
  favorableElement: 'mok' as Element,
}

describe('팔자전 재밸런스 R2 — 3종 × 1000판 시뮬레이션', () => {
  it('R2 전체 시뮬레이션 실행 + 결과 보고', () => {
    const RUNS = 1000

    const reportG = runFullCapSimulation(RUNS, R2_mokHwa)
    const reportH = runFullCapSimulation(RUNS, R2_geumSu)
    const reportI = runFullCapSimulation(RUNS, R2_to)

    const clearRates = {
      G: reportG.clearRate,
      H: reportH.clearRate,
      I: reportI.clearRate,
    }

    const maxRate = Math.max(...Object.values(clearRates))
    const minRate = Math.min(...Object.values(clearRates))
    const gap = maxRate - minRate

    // 층별 사망 집중 여부 (700+/1000 기준)
    function heavyFloor(deathsByFloor: Record<number, number>): number | null {
      for (const [f, count] of Object.entries(deathsByFloor)) {
        if (count >= 700) return Number(f)
      }
      return null
    }

    const heavyG = heavyFloor(reportG.deathsByFloor)
    const heavyH = heavyFloor(reportH.deathsByFloor)
    const heavyI = heavyFloor(reportI.deathsByFloor)

    // 판정
    const targetMin = 25
    const targetMax = 40
    const targetGap = 15

    const allInRange =
      Object.values(clearRates).every(r => r >= targetMin && r <= targetMax)
    const gapOk = gap <= targetGap

    // --- 출력 ---
    console.log('\n========== 팔자전 재밸런스 R2 시뮬레이션 결과 ==========')
    console.log(`판 수: ${RUNS}판 × 3종`)
    console.log('')
    console.log('[ 주의: fullCapBot은 시작 덱(20장)만으로 4층 전체 플레이 ]')
    console.log('  실제 유저는 런 중 층 보상으로 덱 보강 → 실제 클리어율 > 시뮬 클리어율')
    console.log('')

    // 3종 결과 표
    console.log('--- 3종 시뮬 결과 ---')
    console.log('덱 / 용신 | 클리어율 | 1층사망 | 2층사망 | 3층사망 | 4층사망 | 집중층신호')
    for (const [label, report, heavy] of [
      ['G 목화(su)', reportG, heavyG],
      ['H 금수(mok)', reportH, heavyH],
      ['I 토단일(mok)', reportI, heavyI],
    ] as const) {
      const d = report.deathsByFloor
      const heavySignal = heavy !== null ? `[${heavy}층 ${report.deathsByFloor[heavy]}판 집중 — HP 검토]` : ''
      console.log(
        `  ${label.padEnd(14)} | ${report.clearRate.toFixed(1).padStart(5)}% | ` +
        `${String(d[1] ?? 0).padStart(5)} | ${String(d[2] ?? 0).padStart(5)} | ` +
        `${String(d[3] ?? 0).padStart(5)} | ${String(d[4] ?? 0).padStart(5)} | ${heavySignal}`,
      )
    }
    console.log('')

    // 사주간 격차
    console.log(`--- 사주간 격차 ---`)
    console.log(`  최대 클리어율: ${maxRate.toFixed(1)}%  최소: ${minRate.toFixed(1)}%`)
    console.log(`  격차: ${gap.toFixed(1)}%p`)
    console.log('')

    // 판정
    console.log('--- 판정 ---')
    console.log(`  목표: 전 사주 ${targetMin}~${targetMax}% + 격차 ${targetGap}%p 이내`)
    for (const [label, rate] of [
      ['G 목화', clearRates.G],
      ['H 금수', clearRates.H],
      ['I 토단일', clearRates.I],
    ]) {
      const inRange = rate >= targetMin && rate <= targetMax
      console.log(`  ${label}: ${rate.toFixed(1)}% ${inRange ? '[범위내]' : `[범위외 — 목표: ${targetMin}~${targetMax}%]`}`)
    }
    console.log(`  격차 판정: ${gap.toFixed(1)}%p ${gapOk ? '[OK]' : `[초과 — 목표: ${targetGap}%p 이내]`}`)
    console.log(`  종합: ${allInRange && gapOk ? 'PASS' : 'FAIL — 추가 조정 필요 (수치 자의적 변경 금지, 이든 판단 후 진행)'}`)
    console.log('')

    // 층별 공격 횟수 통계
    console.log('--- 층별 공격 횟수 (G 목화 기준 클리어 판) ---')
    for (let f = 1; f <= 4; f++) {
      const s = reportG.floorAttackStats[f]
      console.log(`  ${f}층: 평균 ${s.mean.toFixed(2)}, 최소 ${s.min}, 최대 ${s.max}`)
    }
    console.log('')
    console.log('=======================================================\n')

    // 시뮬레이션 자체 완료만 검증 (수치 자의적 강제 PASS 금지)
    // expect(allInRange && gapOk).toBe(true) — 결과 보고만, 판단은 이든에게
  }, 300000) // 5분 타임아웃 (3종 × 1000판)
})
