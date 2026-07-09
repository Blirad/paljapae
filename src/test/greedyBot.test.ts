/**
 * 팔자전 — 탐욕 봇(Greedy Bot) 시뮬레이션 테스트
 *
 * 목표:
 *  - 탐욕 봇 전체 클리어율: 50~60%
 *  - 원샷 클리어(1층 1회 격파): <5%
 *  - 1층 평균 공격 횟수: 2 (±0.5)
 *  - 2층 평균: 2~3회
 *  - 3층 평균: 3~4회
 *  - 4층 평균: 4~5회
 */

import { describe, it, expect } from 'vitest'
import { runGreedySimulation } from '../engine/greedyBot'

describe('탐욕 봇 시뮬레이션 1000회 — Phase 1 G1 2차 밸런스 검증', () => {
  const report = runGreedySimulation(1000)

  it('시뮬레이션 1000판 완료', () => {
    expect(report.runs).toBe(1000)
  })

  it('탐욕 봇 클리어율 50~60% 목표', () => {
    console.log('\n=== 탐욕 봇 시뮬레이션 결과 (1000판) ===')
    console.log(`클리어율: ${report.clearRate.toFixed(1)}%`)
    console.log(`원샷 클리어(1층 1회): ${report.oneShotClearRate.toFixed(1)}%`)
    for (let f = 1; f <= 4; f++) {
      const s = report.floorAttacks[f]
      console.log(`${f}층 격파 공격 횟수: 평균 ${s.mean.toFixed(2)}, 최소 ${s.min}, 최대 ${s.max}, 표준편차 ${s.stddev.toFixed(2)}`)
    }
    console.log(`층별 사망: 1층=${report.deathsByFloor[1]} 2층=${report.deathsByFloor[2]} 3층=${report.deathsByFloor[3]} 4층=${report.deathsByFloor[4]}`)
    console.log('\nCSV:')
    report.csvLines.forEach(l => console.log(l))

    expect(report.clearRate).toBeGreaterThanOrEqual(50)
    expect(report.clearRate).toBeLessThanOrEqual(60)
  })

  it('원샷 클리어 <5%', () => {
    console.log(`원샷 클리어율: ${report.oneShotClearRate.toFixed(1)}% (목표: <5%)`)
    expect(report.oneShotClearRate).toBeLessThan(5)
  })

  it('1층 평균 공격 횟수 1.5~2.5회', () => {
    const s = report.floorAttacks[1]
    console.log(`1층 평균 공격 횟수: ${s.mean.toFixed(2)} (목표: 1.5~2.5)`)
    expect(s.mean).toBeGreaterThanOrEqual(1.5)
    expect(s.mean).toBeLessThanOrEqual(2.5)
  })

  it('2층 평균 공격 횟수 2~3회', () => {
    const s = report.floorAttacks[2]
    console.log(`2층 평균 공격 횟수: ${s.mean.toFixed(2)} (목표: 2~3)`)
    expect(s.mean).toBeGreaterThanOrEqual(2)
    expect(s.mean).toBeLessThanOrEqual(3)
  })

  it('3층 평균 공격 횟수 3~4회', () => {
    const s = report.floorAttacks[3]
    console.log(`3층 평균 공격 횟수: ${s.mean.toFixed(2)} (목표: 3~4)`)
    expect(s.mean).toBeGreaterThanOrEqual(3)
    expect(s.mean).toBeLessThanOrEqual(4)
  })

  it('4층 평균 공격 횟수 3~5회 (maxPlays 한도 내 아슬하게)', () => {
    const s = report.floorAttacks[4]
    console.log(`4층 평균 공격 횟수: ${s.mean.toFixed(2)} (목표: 3~5, 한도 내 긴장감)`)
    expect(s.mean).toBeGreaterThanOrEqual(3)
    expect(s.mean).toBeLessThanOrEqual(5)
  })
})
