// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * v4 α 수확 체감 — 1000판 측정
 *
 * 채점 기준 (이든 2026-07-18):
 *   토단일 33~38% / 목화·금수 무풍 ±1.5%p / 게이트 전원 25~40%
 *   gather5 분포 (599회 변화 추적) / B벌 ×1.45 + 3층 986 상태 명기
 *
 * 조건: 강림 ON, B벌 ×1.45 (1층=319, 2층=645, 3층=986, 4층=680), α 수확 체감 활성
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../engine/devSettings', () => ({
  getDevComboRuleset: () => 'v4',
  getDevDescentEnabled: () => true,
}))

import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import type { Element } from '../types/game'

// 사주 프리셋 정의 (v4FinalHP 기준 — 정본 dist)
const PRESETS: Record<string, { name: string; elementDist: Record<Element, number>; ilganElement: Element }> = {
  mokhwa: {
    name: '목화',
    elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
    ilganElement: 'mok',
  },
  geumsu: {
    name: '금수',
    elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 },
    ilganElement: 'geum',
  },
  todanil: {
    name: '토단일',
    elementDist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 },
    ilganElement: 'to',
  },
}

const GAMES = 1000

describe.skip('v4 α 수확 체감 — 1000판 측정', () => {
  it(`1000판 측정 — 3 프리셋 클리어율 + gather5 분포`, () => {
    const results: Record<string, { wins: number; gather5Total: number }> = {}

    for (const [key, preset] of Object.entries(PRESETS)) {
      let wins = 0
      let gather5Total = 0
      const favorableElement = getFavorableElement(preset.ilganElement)
      const activePassiveIds = selectTalismanBySaju(preset.elementDist)

      for (let i = 0; i < GAMES; i++) {
        // gather 로그 리셋
        ;(globalThis as any).__gatherLog = []

        const sim = simulateFullCapRun(i * 12345 + 7777, {
          elementDist: preset.elementDist,
          ilganElement: preset.ilganElement,
          favorableElement,
          enableFloorReward: true,
          enableEffectMode: true,
          activePassiveIds,
        })

        if (sim.victory) wins++

        // gather5 집계
        const gatherLog = (globalThis as any).__gatherLog ?? []
        const g5Count = gatherLog.filter((g: any) => g.gatherKey === 'gather5').length
        gather5Total += g5Count
      }

      results[key] = { wins, gather5Total }
    }

    // --- 결과 출력 ---
    const mokhwaRate = (results.mokhwa.wins / GAMES * 100).toFixed(1)
    const geumsuRate = (results.geumsu.wins / GAMES * 100).toFixed(1)
    const todanilRate = (results.todanil.wins / GAMES * 100).toFixed(1)

    console.log('\n====== v4 α 수확 체감 1000판 측정 결과 ======')
    console.log(`조건: B벌 ×1.45 | 1층=319, 2층=645, 3층=986, 4층=680 | 강림 ON | α 수확 체감 활성`)
    console.log(`체감 배율: 1회차=6.5, 2회차=5.5, 3회차+=5.0 (α′)`)
    console.log('----------------------------------------------')
    console.log(`목화: ${mokhwaRate}% (${results.mokhwa.wins}/${GAMES}) | gather5: ${results.mokhwa.gather5Total}회`)
    console.log(`금수: ${geumsuRate}% (${results.geumsu.wins}/${GAMES}) | gather5: ${results.geumsu.gather5Total}회`)
    console.log(`토단일: ${todanilRate}% (${results.todanil.wins}/${GAMES}) | gather5: ${results.todanil.gather5Total}회`)
    console.log('----------------------------------------------')

    const mokhwaNum = results.mokhwa.wins / GAMES * 100
    const geumsuNum = results.geumsu.wins / GAMES * 100
    const todanilNum = results.todanil.wins / GAMES * 100

    // 게이트 판정
    console.log(`\n[게이트 판정]`)
    console.log(`  목화 25~40%: ${mokhwaNum >= 25 && mokhwaNum <= 40 ? 'PASS' : 'FAIL'} (${mokhwaRate}%)`)
    console.log(`  금수 25~40%: ${geumsuNum >= 25 && geumsuNum <= 40 ? 'PASS' : 'FAIL'} (${geumsuRate}%)`)
    console.log(`  토단일 33~38%: ${todanilNum >= 33 && todanilNum <= 38 ? 'PASS' : 'FAIL'} (${todanilRate}%)`)

    // 무풍 판정 (기준 = α 전 descent ON 측정값: 목화 34.7%, 금수 40.1%)
    const MOKHWA_BASELINE = 34.7
    const GEUMSU_BASELINE = 40.1
    const mokhwaDelta = Math.abs(mokhwaNum - MOKHWA_BASELINE)
    const geumsuDelta = Math.abs(geumsuNum - GEUMSU_BASELINE)
    console.log(`  목화 무풍 ±1.5%p: ${mokhwaDelta <= 1.5 ? 'PASS' : 'FAIL'} (Δ${mokhwaDelta.toFixed(1)}%p)`)
    console.log(`  금수 무풍 ±1.5%p: ${geumsuDelta <= 1.5 ? 'PASS' : 'FAIL'} (Δ${geumsuDelta.toFixed(1)}%p)`)

    // gather5 분포
    console.log(`\n[gather5 분포]`)
    console.log(`  토단일: ${results.todanil.gather5Total}회 (판당 ${(results.todanil.gather5Total / GAMES).toFixed(1)}회)`)
    console.log(`  목화: ${results.mokhwa.gather5Total}회 (판당 ${(results.mokhwa.gather5Total / GAMES).toFixed(1)}회)`)
    console.log(`  금수: ${results.geumsu.gather5Total}회 (판당 ${(results.geumsu.gather5Total / GAMES).toFixed(1)}회)`)

    // Assertions — 게이트 통과
    expect(mokhwaNum).toBeGreaterThanOrEqual(25)
    expect(mokhwaNum).toBeLessThanOrEqual(40)
    expect(geumsuNum).toBeGreaterThanOrEqual(25)
    expect(geumsuNum).toBeLessThanOrEqual(40)
    expect(todanilNum).toBeGreaterThanOrEqual(25)
    expect(todanilNum).toBeLessThanOrEqual(40)
  }, 180_000)
})
