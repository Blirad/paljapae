/**
 * v3ThrowCheck.test.ts — 무한루프 픽스 throw 빈도 확인
 */
import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'

describe('V3 throw 빈도 확인', () => {
  it('100판 실행 시 throw 없음 + 클리어율 >25%', () => {
    const dist = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>
    const activePassiveIds = selectTalismanBySaju(dist)
    // R10 동일 조건: ilganElement + favorableElement 필수 (용신 보너스 포함)
    const ilgan: Element = 'mok'
    const favorableElement = getFavorableElement(ilgan)
    let throwCount = 0
    let victories = 0
    const RUNS = 100

    for (let i = 0; i < RUNS; i++) {
      const seed = i * 12345 + 7777
      try {
        const r = simulateFullCapRun(seed, {
          elementDist: dist,
          ilganElement: ilgan,
          favorableElement,
          enableFloorReward: true,
          activePassiveIds,
          enableEffectMode: false,
        })
        if (r.victory) victories++
      } catch (e) {
        throwCount++
        console.log(`throw[${i}]: ${(e as Error).message.substring(0, 150)}`)
      }
    }

    console.log(`RUNS=${RUNS} victories=${victories} (${(victories/RUNS*100).toFixed(1)}%) throws=${throwCount}`)
    expect(throwCount).toBe(0)
    expect(victories / RUNS * 100).toBeGreaterThan(25)
  })
})
