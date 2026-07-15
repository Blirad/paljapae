/**
 * 1판 타이밍 측정 — 빠른 진단용
 */
import { describe, it } from 'vitest'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import type { Element } from '../types/game'

const DIST: Record<Element, number> = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 }
const FAVORABLE = getFavorableElement('mok')
const TALISMANS = selectTalismanBySaju(DIST)

describe('1판 타이밍', () => {
  it('게임 1판 — 핸드 크기 추적', { timeout: 120000 }, () => {
    console.log(`가호: ${TALISMANS.join(',')}`)
    console.log(`용신: ${FAVORABLE}`)
    const t = performance.now()
    const r = simulateFullCapRun(12345, {
      elementDist: DIST,
      favorableElement: FAVORABLE,
      activePassiveIds: TALISMANS,
      enableFloorReward: true,
      enableEffectMode: false,
    })
    const ms = performance.now() - t
    console.log(`결과: ${r.victory ? '클리어' : '실패'} ${ms.toFixed(1)}ms`)
    console.log(`층별 공격수: ${JSON.stringify(r.floorStats)}`)
  })
})
