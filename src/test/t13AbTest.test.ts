/**
 * T13: A/B 테스트 — 가호 미장착 vs 가호 사주기반 장착
 *
 * A: fullCapBot 가호 미장착 (activePassiveIds: []) 1000판
 * B: fullCapBot 가호 사주기반 장착 (selectTalismanBySaju) 1000판
 *
 * 비교 지표:
 *  - 클리어율 (victory %)
 *  - 평균 클리어 층수
 *  - 손실 빈도 (층별 사망 분포)
 *  - 가호 활용도 (선택된 가호 종류)
 *
 * 실행: npm test -- src/test/t13AbTest.test.ts
 */

import { describe, it, expect } from 'vitest'
import { simulateFullCapRun } from '../engine/fullCapBot'
import { selectTalismanBySaju } from '../engine/fullCapBot'
import type { Element } from '../types/game'
import type { FullCapSimOptions } from '../engine/fullCapBot'

// 테스트용 사주 3종
const SAJU_CASES: Array<{ name: string; dist: Record<Element, number> }> = [
  {
    name: '화(火) 집중 (화×8, 나머지×1)',
    dist: { mok: 1, hwa: 8, to: 1, geum: 1, su: 1 },
  },
  {
    name: '목(木) 집중 (목×8, 나머지×1)',
    dist: { mok: 8, hwa: 1, to: 1, geum: 1, su: 1 },
  },
  {
    name: '균등 분포 (각 4)',
    dist: { mok: 4, hwa: 4, to: 4, geum: 4, su: 4 },
  },
]

const RUNS = 1000

describe('T13: A/B 시뮬레이션 — 가호 미장착 vs 사주 기반 장착', () => {

  for (const saju of SAJU_CASES) {
    describe(`사주: ${saju.name}`, () => {
      // 선택된 가호
      const selectedTalismans = selectTalismanBySaju(saju.dist)

      it(`selectTalismanBySaju → 2종 선택: ${selectedTalismans.join(', ')}`, () => {
        expect(selectedTalismans).toHaveLength(2)
        expect(new Set(selectedTalismans).size).toBe(2)
      })

      it(`A(미장착) vs B(장착: ${selectedTalismans.join(', ')}) — ${RUNS}판 각각`, { timeout: 60000 }, () => {
        // A: 가호 미장착
        const optsA: FullCapSimOptions = {
          elementDist: saju.dist,
          enableFloorReward: false,
        }

        // B: 가호 사주기반 장착
        // fullCapBot 시뮬은 state.activePassiveIds를 직접 주입하므로
        // simulateFullCapRun 옵션에 activePassiveIds 추가 필요
        // 현재 FullCapSimOptions에 activePassiveIds가 없으므로
        // talismans 필드(부적술 목록)와 별개인 점에 유의
        // → A/B는 activePassiveIds를 시뮬 opts로 전달하는 방식으로 비교
        const optsB: FullCapSimOptions = {
          elementDist: saju.dist,
          enableFloorReward: false,
          // T13: 가호 장착 옵션 (아래 activePassiveIds 확장 후 사용)
          activePassiveIds: selectedTalismans,
        }

        let victoriesA = 0
        let victoriesB = 0
        let floorsA = 0
        let floorsB = 0
        const deathsA: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        const deathsB: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const rA = simulateFullCapRun(seed, optsA)
          const rB = simulateFullCapRun(seed, optsB)

          if (rA.victory) victoriesA++
          floorsA += rA.floorsCleared
          if (!rA.victory && rA.deathFloor !== null) {
            deathsA[rA.deathFloor] = (deathsA[rA.deathFloor] ?? 0) + 1
          }

          if (rB.victory) victoriesB++
          floorsB += rB.floorsCleared
          if (!rB.victory && rB.deathFloor !== null) {
            deathsB[rB.deathFloor] = (deathsB[rB.deathFloor] ?? 0) + 1
          }
        }

        const clearRateA = (victoriesA / RUNS) * 100
        const clearRateB = (victoriesB / RUNS) * 100
        const avgFloorsA = floorsA / RUNS
        const avgFloorsB = floorsB / RUNS

        console.log(`\n[T13 A/B] 사주: ${saju.name}`)
        console.log(`  선택 가호: ${selectedTalismans.join(', ')}`)
        console.log(`  A (미장착): 클리어율 ${clearRateA.toFixed(1)}%, 평균층 ${avgFloorsA.toFixed(2)}, 층별사망 ${JSON.stringify(deathsA)}`)
        console.log(`  B (장착):   클리어율 ${clearRateB.toFixed(1)}%, 평균층 ${avgFloorsB.toFixed(2)}, 층별사망 ${JSON.stringify(deathsB)}`)
        console.log(`  차이: 클리어율 ${(clearRateB - clearRateA).toFixed(1)}%p, 평균층 ${(avgFloorsB - avgFloorsA).toFixed(2)}`)

        // 검증: 양쪽 다 유효한 클리어율 범위 내 (0~100%)
        expect(clearRateA).toBeGreaterThanOrEqual(0)
        expect(clearRateA).toBeLessThanOrEqual(100)
        expect(clearRateB).toBeGreaterThanOrEqual(0)
        expect(clearRateB).toBeLessThanOrEqual(100)
        // 평균 층수: 0~4 범위
        expect(avgFloorsA).toBeGreaterThanOrEqual(0)
        expect(avgFloorsA).toBeLessThanOrEqual(4)
        expect(avgFloorsB).toBeGreaterThanOrEqual(0)
        expect(avgFloorsB).toBeLessThanOrEqual(4)
      })
    })
  }

})
