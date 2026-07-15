/**
 * 이분 탐색 프로파일링 — 50판 × 3설정 타이밍 측정
 *
 * ① R10 엔진 + R10 봇 (enableEffectMode=false, 항상 공격)
 * ② R10 엔진 + batch1 봇 ON (enableEffectMode=true)
 *
 * 판독 기준:
 *  ① 빠르고 ② 느림 → 범인 = 봇 평가 로직 (O(1) 산수로 교체 필요)
 *  ① 이미 느림 → 엔진 변경분 이분 계속
 *
 * 실행: npm test -- src/test/profileBisect.test.ts --reporter=verbose
 */

import { describe, it } from 'vitest'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import type { Element } from '../types/game'

const RUNS = 50
const SEED_BASE = 99991  // 임의 시드

// 목화 프리셋 (대표 측정용)
const DIST: Record<Element, number> = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }
const ILGAN: Element = 'mok'
const TALISMANS = selectTalismanBySaju(DIST)
const FAVORABLE = getFavorableElement(ILGAN)

function runBatch(enableEffectMode: boolean): { ms: number; clearRate: number } {
  let cleared = 0
  const t0 = performance.now()

  for (let i = 0; i < RUNS; i++) {
    const seed = SEED_BASE + i * 13337
    const result = simulateFullCapRun(seed, {
      elementDist: DIST,
      ilganElement: ILGAN,
      favorableElement: FAVORABLE,
      activePassiveIds: TALISMANS,
      enableFloorReward: true,
      enableEffectMode,
    })
    if (result.victory) cleared++
  }

  const ms = performance.now() - t0
  return { ms, clearRate: (cleared / RUNS) * 100 }
}

describe('이분 탐색 프로파일링 (50판 × 2설정)', () => {
  it('① R10 봇 (enableEffectMode=false, 항상 공격)', { timeout: 120000 }, () => {
    console.log(`\n[설정 ①] enableEffectMode=false (항상 공격) | ${RUNS}판`)
    const { ms, clearRate } = runBatch(false)
    const msPerRun = ms / RUNS
    console.log(`총 시간: ${ms.toFixed(1)}ms`)
    console.log(`판당 시간: ${msPerRun.toFixed(2)}ms`)
    console.log(`클리어율: ${clearRate.toFixed(1)}%`)
    console.log(`가호: ${TALISMANS.join('+')}`)
    console.log(`[결과①] ${ms.toFixed(0)}ms / ${msPerRun.toFixed(2)}ms/판`)
  })

  it('② batch1 봇 (enableEffectMode=true, 양자택일)', { timeout: 120000 }, () => {
    console.log(`\n[설정 ②] enableEffectMode=true (양자택일) | ${RUNS}판`)
    const { ms, clearRate } = runBatch(true)
    const msPerRun = ms / RUNS
    console.log(`총 시간: ${ms.toFixed(1)}ms`)
    console.log(`판당 시간: ${msPerRun.toFixed(2)}ms`)
    console.log(`클리어율: ${clearRate.toFixed(1)}%`)
    console.log(`[결과②] ${ms.toFixed(0)}ms / ${msPerRun.toFixed(2)}ms/판`)
  })

  it('① vs ② 동시 비교 (1회 실행, 배율 출력)', { timeout: 300000 }, () => {
    // 웜업 5판
    for (let i = 0; i < 5; i++) {
      simulateFullCapRun(i * 7 + 1, { elementDist: DIST, enableEffectMode: false })
      simulateFullCapRun(i * 7 + 1, { elementDist: DIST, enableEffectMode: true })
    }

    const r1 = runBatch(false)
    const r2 = runBatch(true)

    const speedup = r2.ms / r1.ms

    console.log('\n=== 이분 탐색 프로파일링 최종 보고 ===')
    console.log(`설정 ①  (공격 고정): ${r1.ms.toFixed(1)}ms  (${(r1.ms/RUNS).toFixed(2)}ms/판)  클리어 ${r1.clearRate.toFixed(1)}%`)
    console.log(`설정 ②  (양자택일): ${r2.ms.toFixed(1)}ms  (${(r2.ms/RUNS).toFixed(2)}ms/판)  클리어 ${r2.clearRate.toFixed(1)}%`)
    console.log(`②/① 배율: ${speedup.toFixed(2)}x`)
    console.log('')

    if (speedup > 1.5) {
      console.log('★ 판독: 봇 평가 로직이 느림 (②가 ①보다 50%+ 느림)')
      console.log('  수정 방향: 효과 기대값을 O(1) 닫힌 수식으로 교체')
      console.log('  - 자양: min(기본치×2.5, maxHP-HP) vs HP위험도 가중')
      console.log('  - 잔불: 기본치×3 vs 즉발×배율×상성')
      console.log('  - 채굴: 드로우 기대 화력 (drawCount × 평균카드값)')
      console.log('  - 응축: 다음 공격 추정×실효%')
      console.log('  미래 시뮬·재귀 전면 금지')
    } else if (r1.ms / RUNS > 15) {
      console.log('★ 판독: ① 자체가 느림 → 엔진 변경분(290줄) 이분 계속 필요')
    } else {
      console.log('★ 판독: 둘 다 빠름 (봇 평가 로직 문제 아님)')
    }
    console.log('=================================')

    // 어서션 없음 — 타이밍 측정만
  })
})
