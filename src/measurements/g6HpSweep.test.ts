// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * G6 HP 재기준선 측정 — 시작 왕족 포함 상태에서 HP 2벌 비교
 * A벌: 1~3층 ×1.75 (4층 680 불변)
 * B벌: 1~3층 ×1.85 (4층 680 불변)
 * 채점: 전원 25~40 + 격차 ≤15 + 목표 중앙 28~35
 */
import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

const BASE_HP = [220, 445, 680]
const FLOOR4_HP = 680
const RUNS = 1000

const PRESETS = [
  { label: '목화', dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number> },
  { label: '금수', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number> },
  { label: '토단일', dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number> },
]

// 클로저 변수 — 벌 전환 시 갱신
let hpMult = 1.75

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    getFloorHp: (floorIndex: number) => {
      if (floorIndex === 0) return Math.round(BASE_HP[0] * hpMult)
      if (floorIndex === 1) return Math.round(BASE_HP[1] * hpMult)
      if (floorIndex === 2) return Math.round(BASE_HP[2] * hpMult)
      if (floorIndex === 3) return FLOOR4_HP
      return (actual['FLOOR_CONFIGS'] as any)[floorIndex].enemyHp
    },
  }
})

// 정본 mock 규격: top-level await import AFTER vi.mock
const { simulateFullCapRun } = await import('../engine/fullCapBot')
const { getFloorHp } = await import('../engine/balance')

describe.skip('G6 HP 재기준선 2벌 측정', () => {
  it('A벌 (×1.75) + B벌 (×1.85)', () => {
    const variants = [
      { label: 'A벌 (×1.75)', mult: 1.75 },
      { label: 'B벌 (×1.85)', mult: 1.85 },
    ]

    for (const variant of variants) {
      hpMult = variant.mult

      // HP assert
      const hp1 = Math.round(BASE_HP[0] * hpMult)
      const hp2 = Math.round(BASE_HP[1] * hpMult)
      const hp3 = Math.round(BASE_HP[2] * hpMult)
      expect(getFloorHp(0)).toBe(hp1)
      expect(getFloorHp(1)).toBe(hp2)
      expect(getFloorHp(2)).toBe(hp3)
      expect(getFloorHp(3)).toBe(FLOOR4_HP)

      console.log(`\n=== ${variant.label} ===`)
      console.log(`HP: 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${FLOOR4_HP}`)

      const results: Array<{ label: string; cr: number }> = []

      for (const preset of PRESETS) {
        let victories = 0
        for (let i = 0; i < RUNS; i++) {
          const seed = i * 7919 + 42
          const r = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            royalValue: 10,
          })
          if (r.victory) victories++
        }
        const cr = (victories / RUNS) * 100
        const pass = cr >= 25 && cr <= 40
        const center = cr >= 28 && cr <= 35
        results.push({ label: preset.label, cr })
        console.log(`  ${preset.label}: ${cr.toFixed(1)}% — ${pass ? 'PASS' : 'FAIL'} ${center ? '(중앙)' : ''}`)
      }

      const rates = results.map(r => r.cr)
      const spread = Math.max(...rates) - Math.min(...rates)
      const allPass = rates.every(r => r >= 25 && r <= 40)
      const spreadPass = spread <= 15

      console.log(`  격차: ${spread.toFixed(1)}%p — ${spreadPass ? 'PASS' : 'FAIL'}`)
      console.log(`  ★ 종합: ${allPass && spreadPass ? 'GATE PASS' : 'GATE FAIL'}`)
    }

    expect(true).toBe(true)
  })
})
