/**
 * 픽스 후 A/B 1000판 — enableEffectMode false vs true
 *
 * 이든 지시:
 *  1. 동일 시드 10게임 전후 일치 확인
 *  2. 1000판 A/B 발사 (300판 금지 — CI ±5.5%p는 측정이 아님)
 *
 * 목화 프리셋 (R10 기준)
 * A안: enableEffectMode=false (항상 공격)
 * B안: enableEffectMode=true  (양자택일 효과 선택)
 *
 * 실행: npm test -- src/test/profileAB1000.test.ts --reporter=verbose
 */

import { describe, it, expect } from 'vitest'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import type { Element } from '../types/game'

// Wilson 95% CI
function wilsonCI(successes: number, total: number) {
  const p = successes / total
  const z = 1.96
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    point: p,
  }
}

function pct(v: number, d = 2): string {
  return (v * 100).toFixed(d) + '%'
}

const DIST: Record<Element, number> = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }
const ILGAN: Element = 'mok'
const FAVORABLE = getFavorableElement(ILGAN)
const TALISMANS = selectTalismanBySaju(DIST)

describe('픽스 후 A/B 1000판 — 봇 학습 게이트', () => {

  it('동일 시드 10게임 — A/B 클리어 결과 기록 (일치성 확인)', { timeout: 60000 }, () => {
    const N = 10
    const BASE = 54321

    console.log('\n=== 동일 시드 10게임 A/B 결과 ===')
    console.log('시드 | A안(공격) | B안(양자택일)')
    console.log('-----|----------|-------------')

    let sameCount = 0
    for (let i = 0; i < N; i++) {
      const seed = BASE + i * 9999
      const rA = simulateFullCapRun(seed, {
        elementDist: DIST, favorableElement: FAVORABLE,
        activePassiveIds: TALISMANS, enableFloorReward: true,
        enableEffectMode: false,
      })
      const rB = simulateFullCapRun(seed, {
        elementDist: DIST, favorableElement: FAVORABLE,
        activePassiveIds: TALISMANS, enableFloorReward: true,
        enableEffectMode: true,
      })
      const same = rA.victory === rB.victory ? '일치' : '불일치'
      if (rA.victory === rB.victory) sameCount++
      console.log(`${seed.toString().padEnd(6)} | ${rA.victory ? 'CLEAR' : 'FAIL'} (${rA.floorsCleared}층) | ${rB.victory ? 'CLEAR' : 'FAIL'} (${rB.floorsCleared}층) → ${same}`)
    }
    console.log(`\n일치율: ${sameCount}/${N}`)
    console.log('(A/B 차이는 효과 모드 분기 결과 — 불일치는 정상)')
    console.log('===================================')
  })

  it('1000판 A/B — B안 ≥ A안 − 3%p 판정', { timeout: 180000 }, () => {
    const RUNS = 1000
    const BASE = 77777

    let clearedA = 0
    let clearedB = 0
    const tA = performance.now()

    for (let i = 0; i < RUNS; i++) {
      const seed = BASE + i * 13337
      const r = simulateFullCapRun(seed, {
        elementDist: DIST, favorableElement: FAVORABLE,
        activePassiveIds: TALISMANS, enableFloorReward: true,
        enableEffectMode: false,
      })
      if (r.victory) clearedA++
    }
    const msA = performance.now() - tA

    const tB = performance.now()
    for (let i = 0; i < RUNS; i++) {
      const seed = BASE + i * 13337
      const r = simulateFullCapRun(seed, {
        elementDist: DIST, favorableElement: FAVORABLE,
        activePassiveIds: TALISMANS, enableFloorReward: true,
        enableEffectMode: true,
      })
      if (r.victory) clearedB++
    }
    const msB = performance.now() - tB

    const ciA = wilsonCI(clearedA, RUNS)
    const ciB = wilsonCI(clearedB, RUNS)
    const diff = ciB.point - ciA.point

    console.log('\n=== 1000판 A/B 최종 보고 ===')
    console.log(`프리셋: 목화 (mok:4,hwa:4,to:2,geum:2,su:2)`)
    console.log(`가호:   ${TALISMANS.join('+')} | 용신: ${FAVORABLE}`)
    console.log(`시드:   BASE=${BASE}, step=13337`)
    console.log('')
    console.log(`A안 (공격고정): ${clearedA}/${RUNS} = ${pct(ciA.point)} [${pct(ciA.low)} ~ ${pct(ciA.high)}]  ${msA.toFixed(0)}ms`)
    console.log(`B안 (양자택일): ${clearedB}/${RUNS} = ${pct(ciB.point)} [${pct(ciB.low)} ~ ${pct(ciB.high)}]  ${msB.toFixed(0)}ms`)
    console.log(`차이(B-A): ${diff >= 0 ? '+' : ''}${pct(diff)}p`)
    console.log(`속도 비율 B/A: ${(msB / msA).toFixed(2)}x`)
    console.log('')

    const verdict = diff >= -0.03
      ? `PASS — B안이 A안보다 ${pct(Math.abs(diff))}p ${diff >= 0 ? '높음' : '낮지만 허용 범위 내'}`
      : `FAIL — B안이 A안보다 ${pct(Math.abs(diff))}p 낮음 (효과 기대값 재조정 필요)`
    console.log(`판정: ${verdict}`)
    console.log('===========================')

    // 어서션
    expect(clearedA).toBeGreaterThan(0)
    expect(clearedB).toBeGreaterThan(0)
    // B안 ≥ A안 − 3%p
    expect(diff * 100).toBeGreaterThanOrEqual(-3.0)
  })
})
