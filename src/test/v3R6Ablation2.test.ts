/**
 * v3R6Ablation2.test.ts
 * R6 설정② 어블레이션 — CONDENSE_SCALE_MIN=0.7
 *
 * balance.ts를 0.7로 변경 후 실행.
 * 프리셋: 목화 / 금수 / 토단일 (1000판)
 * 시드: i×12345+7777 (i=0~999)
 */

import { describe, it } from 'vitest'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import type { Element } from '../types/game'

function wilsonCI(k: number, n: number): { lower: number; upper: number; pm: number } {
  const z = 1.96
  const p = k / n
  const denom = 1 + z * z / n
  const center = (p + z * z / (2 * n)) / denom
  const margin = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
  return { lower: Math.max(0, center - margin) * 100, upper: Math.min(1, center + margin) * 100, pm: margin * 100 }
}

const PRESETS = {
  mokwa:   { name: '목화',   elementDist: { mok: 4, hwa: 4, to: 1, geum: 1, su: 1 } as Record<Element, number>, ilganElement: 'mok' as Element },
  geumsu:  { name: '금수',   elementDist: { mok: 1, hwa: 1, to: 1, geum: 4, su: 4 } as Record<Element, number>, ilganElement: 'geum' as Element },
  todanil: { name: '토단일', elementDist: { mok: 1, hwa: 2, to: 6, geum: 1, su: 1 } as Record<Element, number>, ilganElement: 'to' as Element },
}

function runSim2(presetKey: keyof typeof PRESETS, n: number) {
  const preset = PRESETS[presetKey]
  const activePassiveIds = selectTalismanBySaju(preset.elementDist)
  let victories = 0
  const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  let wildfireEffectCount = 0
  let wildfireAttackCount = 0

  for (let i = 0; i < n; i++) {
    const result = simulateFullCapRun(i * 12345 + 7777, {
      elementDist: preset.elementDist,
      ilganElement: preset.ilganElement,
      enableEffectMode: true,
      enableFloorReward: true,
      activePassiveIds,
    })
    if (result.victory) victories++
    if (!result.victory && result.deathFloor !== null) {
      deathsByFloor[result.deathFloor] = (deathsByFloor[result.deathFloor] ?? 0) + 1
    }
    const tc = result.traitCounts ?? {}
    wildfireEffectCount += tc['effect_wildfire_used'] ?? 0
    wildfireAttackCount += tc['attack_wildfire_used'] ?? 0
  }

  const ci = wilsonCI(victories, n)
  return {
    victories, total: n,
    clearRate: (victories / n) * 100,
    ci,
    deathsByFloor,
    wildfireEffectRate: (wildfireEffectCount / n) * 100,
    wildfireAttackRate: (wildfireAttackCount / n) * 100,
  }
}

const N = 1000

describe('R6 설정② 어블레이션 — CONDENSE_SCALE_MIN=0.7', () => {
  it('목화 1000판', { timeout: 300000 }, () => {
    const r = runSim2('mokwa', N)
    console.log('\n=== R6 설정② 목화 (CONDENSE_SCALE_MIN=0.7) ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })

  it('금수 1000판', { timeout: 300000 }, () => {
    const r = runSim2('geumsu', N)
    console.log('\n=== R6 설정② 금수 (CONDENSE_SCALE_MIN=0.7) ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })

  it('토단일 1000판', { timeout: 300000 }, () => {
    const r = runSim2('todanil', N)
    console.log('\n=== R6 설정② 토단일 (CONDENSE_SCALE_MIN=0.7) ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })
})
