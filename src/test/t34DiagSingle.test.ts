/**
 * T34 결정론 진단 — 단일 판 2회 비교 (원인 추적용, 임시 파일)
 */
import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const V4_FLOOR_HP_TABLE = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>
  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = V4_FLOOR_HP_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

const PRESET = {
  dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  ilgan: 'mok' as Element,
}

describe('T34 결정론 진단 — 단일 판', () => {
  it('다중 시드 10개 2회씩 동일 여부', () => {
    const favorableElement = getFavorableElement(PRESET.ilgan)
    const activePassiveIds = selectTalismanBySaju(PRESET.dist)
    const opts = {
      elementDist: PRESET.dist,
      ilganElement: PRESET.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds,
    }

    let mismatches = 0
    for (let i = 0; i < 20; i++) {
      const seed = i * 12345 + 7777
      const r1 = simulateFullCapRun(seed, opts)
      const r2 = simulateFullCapRun(seed, opts)
      if (r1.victory !== r2.victory || r1.floorsCleared !== r2.floorsCleared) {
        console.log(`MISMATCH seed=${seed}: r1.victory=${r1.victory}(${r1.floorsCleared}층), r2.victory=${r2.victory}(${r2.floorsCleared}층)`)
        mismatches++
      }
    }
    console.log(`20판 중 불일치: ${mismatches}`)
    expect(mismatches).toBe(0)
  })
})
