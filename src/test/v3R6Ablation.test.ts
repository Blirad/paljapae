/**
 * v3R6Ablation.test.ts
 * R6 어블레이션 1000판 × 2설정 × 3종 프리셋
 *
 * 설정 ①: 잔불 수정만 (CONDENSE_SCALE_MIN=0.6)
 * 설정 ②: 잔불 수정 + CONDENSE_SCALE_MIN=0.7
 *
 * 프리셋: 목화 / 금수 / 토단일
 * 시드: i×12345+7777 (i=0~999)
 */

import { describe, it } from 'vitest'
import { simulateFullCapRun } from '../engine/fullCapBot'
import { selectTalismanBySaju } from '../engine/fullCapBot'
import type { Element } from '../types/game'

// ─── Wilson 95% CI ───────────────────────────────────────────────────────────

function wilsonCI(k: number, n: number): { lower: number; upper: number; pm: number } {
  const z = 1.96
  const p = k / n
  const denom = 1 + z * z / n
  const center = (p + z * z / (2 * n)) / denom
  const margin = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    pm: margin,
  }
}

// ─── 프리셋 정의 ──────────────────────────────────────────────────────────────

const PRESETS = {
  mokwa: {
    name: '목화',
    elementDist: { mok: 4, hwa: 4, to: 1, geum: 1, su: 1 } as Record<Element, number>,
    ilganElement: 'mok' as Element,
  },
  geumsu: {
    name: '금수',
    elementDist: { mok: 1, hwa: 1, to: 1, geum: 4, su: 4 } as Record<Element, number>,
    ilganElement: 'geum' as Element,
  },
  todanil: {
    name: '토단일',
    elementDist: { mok: 1, hwa: 2, to: 6, geum: 1, su: 1 } as Record<Element, number>,
    ilganElement: 'to' as Element,
  },
}

// ─── 시뮬레이션 실행 함수 ─────────────────────────────────────────────────────

interface SimResult {
  victories: number
  total: number
  clearRate: number
  ci: { lower: number; upper: number; pm: number }
  deathsByFloor: Record<number, number>
  wildfireEffectRate: number
  wildfireAttackRate: number
}

function runSim(
  presetKey: keyof typeof PRESETS,
  n: number,
  condenseScaleMin: number,
): SimResult {
  const preset = PRESETS[presetKey]
  const activePassiveIds = selectTalismanBySaju(preset.elementDist)

  let victories = 0
  const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  let wildfireEffectCount = 0
  let wildfireAttackCount = 0
  let totalPlays = 0

  // balance.ts의 CONDENSE_SCALE_MIN을 런타임 파라미터로 대체하는 방식은
  // 현재 구조에서 직접 주입 불가. 대신 설정②에서 balance.ts 값을 수동 변경 후 실행.
  // 본 함수는 condenseScaleMin 파라미터를 기록 목적으로만 사용.
  void condenseScaleMin  // lint 억제

  for (let i = 0; i < n; i++) {
    const seed = i * 12345 + 7777
    const result = simulateFullCapRun(seed, {
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

    // 효과/공격 채택률 집계
    const tc = result.traitCounts ?? {}
    wildfireEffectCount += tc['effect_wildfire_used'] ?? 0
    wildfireAttackCount += tc['attack_wildfire_used'] ?? 0
    totalPlays++
  }

  const clearRate = (victories / n) * 100
  const ci = wilsonCI(victories, n)
  const wildfireEffectRate = (wildfireEffectCount / n) * 100
  const wildfireAttackRate = (wildfireAttackCount / n) * 100

  return {
    victories,
    total: n,
    clearRate,
    ci: { lower: ci.lower * 100, upper: ci.upper * 100, pm: ci.pm * 100 },
    deathsByFloor,
    wildfireEffectRate,
    wildfireAttackRate,
  }
}

// ─── 어블레이션 실행 ──────────────────────────────────────────────────────────

const N = 1000

describe('R6 어블레이션 — 설정 ① 잔불 수정 (CONDENSE_SCALE_MIN=0.6)', () => {
  it('목화 1000판', { timeout: 300000 }, () => {
    const r = runSim('mokwa', N, 0.6)
    console.log('\n=== R6 설정① 목화 ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })

  it('금수 1000판', { timeout: 300000 }, () => {
    const r = runSim('geumsu', N, 0.6)
    console.log('\n=== R6 설정① 금수 ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })

  it('토단일 1000판', { timeout: 300000 }, () => {
    const r = runSim('todanil', N, 0.6)
    console.log('\n=== R6 설정① 토단일 ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })
})

describe('R6 어블레이션 — 설정 ② 잔불 수정 + CONDENSE_SCALE_MIN=0.7 (별도 실행)', () => {
  it('목화 1000판 (설정② 동일 코드 — balance.ts CONDENSE_SCALE_MIN 변경 후 실행 필요)', { timeout: 300000 }, () => {
    // 주의: 설정②는 balance.ts의 CONDENSE_SCALE_MIN을 0.6→0.7로 변경 후 별도 실행 필요
    // 본 테스트는 설정① 코드와 동일하게 실행됨 (runtime 주입 미지원)
    // 실제 ② 결과는 balance.ts 값 변경 후 v3R6Ablation2.test.ts로 별도 수집
    const r = runSim('mokwa', N, 0.7)
    console.log('\n=== R6 설정② 목화 (현재 CONDENSE_SCALE_MIN 값 사용) ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })

  it('금수 1000판', { timeout: 300000 }, () => {
    const r = runSim('geumsu', N, 0.7)
    console.log('\n=== R6 설정② 금수 ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })

  it('토단일 1000판', { timeout: 300000 }, () => {
    const r = runSim('todanil', N, 0.7)
    console.log('\n=== R6 설정② 토단일 ===')
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRate.toFixed(2)}%`)
    console.log(`CI: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택: ${r.wildfireEffectRate.toFixed(2)}회/판, 공격채택: ${r.wildfireAttackRate.toFixed(2)}회/판`)
  })
})
