/**
 * 빠른 이분 탐색 — 10판씩 타이밍 측정 (빠른 판독용)
 *
 * 목적: ① vs ② 중 어느 쪽이 느린지 판독
 * 설정①: enableEffectMode=false (항상 공격)
 * 설정②: enableEffectMode=true  (양자택일)
 *
 * 실행: npm test -- src/test/profileQuick.test.ts --reporter=verbose
 */

import { describe, it } from 'vitest'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import type { Element } from '../types/game'

const DIST: Record<Element, number> = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }
const ILGAN: Element = 'mok'
const TALISMANS = selectTalismanBySaju(DIST)
const FAVORABLE = getFavorableElement(ILGAN)

describe('빠른 이분 탐색 (10판)', () => {
  it('타이밍 10판 × 2설정', { timeout: 300000 }, () => {
    const RUNS = 10
    const SEED = 77777

    // ① enableEffectMode=false
    const t1 = performance.now()
    let c1 = 0
    for (let i = 0; i < RUNS; i++) {
      const r = simulateFullCapRun(SEED + i * 101, {
        elementDist: DIST,
        favorableElement: FAVORABLE,
        activePassiveIds: TALISMANS,
        enableFloorReward: true,
        enableEffectMode: false,
      })
      if (r.victory) c1++
    }
    const ms1 = performance.now() - t1

    // ② enableEffectMode=true
    const t2 = performance.now()
    let c2 = 0
    for (let i = 0; i < RUNS; i++) {
      const r = simulateFullCapRun(SEED + i * 101, {
        elementDist: DIST,
        favorableElement: FAVORABLE,
        activePassiveIds: TALISMANS,
        enableFloorReward: true,
        enableEffectMode: true,
      })
      if (r.victory) c2++
    }
    const ms2 = performance.now() - t2

    console.log('\n=== 이분 탐색 타이밍 결과 (10판) ===')
    console.log(`① enableEffectMode=false : ${ms1.toFixed(1)}ms  (${(ms1/RUNS).toFixed(0)}ms/판)  클리어 ${c1}/${RUNS}`)
    console.log(`② enableEffectMode=true  : ${ms2.toFixed(1)}ms  (${(ms2/RUNS).toFixed(0)}ms/판)  클리어 ${c2}/${RUNS}`)
    console.log(`②/① 배율: ${(ms2/ms1).toFixed(2)}x`)

    if (ms1 / RUNS > 500) {
      console.log('\n★ 판독: ① 자체가 느림 (>500ms/판) → 엔진 변경분 이분 대상')
      console.log('  paljajeonEngine.ts 변경분(293줄) 이분 계속')
    } else if (ms2 / ms1 > 1.5) {
      console.log('\n★ 판독: ② 가 ①보다 느림 → 봇 평가 로직 범인')
      console.log('  fullCapSelectCards의 효과 기대값 계산을 O(1) 닫힌 수식으로 교체')
    } else {
      console.log('\n★ 판독: 둘 다 빠름 — 다른 원인 탐색 필요')
    }
    console.log('===================================')
  })
})
