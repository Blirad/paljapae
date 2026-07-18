/**
 * 감사 c — α OFF 대조 측정
 * gatherUsedInBattle 기능을 무력화하고 동일 환경에서 재측정
 * 목표: 31.1/39.2/40.7 재현 여부 확인
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../engine/devSettings', () => ({
  getDevComboRuleset: () => 'v4',
  getDevDescentEnabled: () => true,
}))

// α OFF: getGather5Multiplier를 항상 6.5 반환하도록 mock
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as any
  return {
    ...actual,
    getGather5Multiplier: () => 6.5,  // α OFF — 항상 첫회 배율
  }
})

import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import type { Element } from '../types/game'

// v4FinalHP 동일 프리셋
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

describe('감사 c — α OFF 대조 (정본 조건)', () => {
  it(`α OFF 1000판 — 동일 조건 baseline 확인`, () => {
    const results: Record<string, number> = {}

    for (const [key, preset] of Object.entries(PRESETS)) {
      const favorableElement = getFavorableElement(preset.ilganElement)
      const activePassiveIds = selectTalismanBySaju(preset.elementDist)
      let wins = 0
      for (let i = 0; i < GAMES; i++) {
        const sim = simulateFullCapRun(i * 12345 + 7777, {
          elementDist: preset.elementDist,
          ilganElement: preset.ilganElement,
          favorableElement,
          enableFloorReward: true,
          enableEffectMode: true,
          activePassiveIds,
        })
        if (sim.victory) wins++
      }
      results[key] = wins / GAMES * 100
    }

    console.log('\n====== 감사 c: α OFF 대조 결과 (정본 조건) ======')
    console.log(`조건: v4 + B벌 HP (319/645/986/680) + 강림 ON + 층보상 + 가호 + α OFF(6.5 고정)`)
    console.log('---')
    console.log(`목화: ${results.mokhwa.toFixed(1)}%`)
    console.log(`금수: ${results.geumsu.toFixed(1)}%`)
    console.log(`토단일: ${results.todanil.toFixed(1)}%`)
    console.log('---')
    console.log('α ON과의 차이 (α 효과 격리):')
    console.log(`  목화: α OFF ${results.mokhwa.toFixed(1)}% → α ON 29.5% (Δ${(29.5 - results.mokhwa).toFixed(1)}%p)`)
    console.log(`  금수: α OFF ${results.geumsu.toFixed(1)}% → α ON 34.9% (Δ${(34.9 - results.geumsu).toFixed(1)}%p)`)
    console.log(`  토단일: α OFF ${results.todanil.toFixed(1)}% → α ON 26.8% (Δ${(26.8 - results.todanil).toFixed(1)}%p)`)
  }, 180_000)
})
