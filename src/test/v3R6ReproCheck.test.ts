/**
 * v3R6ReproCheck.test.ts
 * R6 재현 검증 — R3 기준 프리셋으로 토단일 23%대 재현 여부 확인
 *
 * 발사 전 확인 6줄:
 * 커밋: 2369662dece5809967cd220917bc3432d9d2ddab
 * 프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}
 * 조건: enableEffectMode=true/enableFloorReward=true/enableCondenseClamp=true(기준10,하한0.6)
 * 시드: i×12345+7777 (i=0~999)
 * 가호: selectTalismanBySaju(dist) — 목화[sanggwan,geoptae]/금수[jeongjae,bigyeon]/토단일[pyeonin,bigyeon]
 * 채택률 단위: "%" (wildfireEffectPct = count/n × 100)
 */

import { describe, it } from 'vitest'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import type { Element } from '../types/game'

// ─── Wilson 95% CI ───────────────────────────────────────────────────────────

function wilsonCI(k: number, n: number): { lower: number; upper: number; pm: number } {
  const z = 1.96
  const p = k / n
  const denom = 1 + z * z / n
  const center = (p + z * z / (2 * n)) / denom
  const margin = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
  return {
    lower: Math.max(0, center - margin) * 100,
    upper: Math.min(1, center + margin) * 100,
    pm: margin * 100,
  }
}

// ─── R3 기준 프리셋 (v3MainSim3000.test.ts 실측값) ──────────────────────────

const PRESETS = {
  mokwa: {
    name: '목화',
    elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilganElement: 'mok' as Element,
  },
  geumsu: {
    name: '금수',
    elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilganElement: 'geum' as Element,
  },
  todanil: {
    name: '토단일',
    elementDist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilganElement: 'to' as Element,
  },
}

// ─── 시뮬레이션 함수 ──────────────────────────────────────────────────────────

interface SimResult {
  victories: number
  total: number
  clearRatePct: number
  ci: { lower: number; upper: number; pm: number }
  deathsByFloor: Record<number, number>
  wildfireEffectPct: number   // (count/n)*100 — 단위: %
  wildfireAttackPct: number   // (count/n)*100 — 단위: %
  selectedTalismans: string[]
}

function runSim(presetKey: keyof typeof PRESETS, n: number): SimResult {
  const preset = PRESETS[presetKey]
  const selectedTalismans = selectTalismanBySaju(preset.elementDist)

  let victories = 0
  const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  let wildfireEffectCount = 0
  let wildfireAttackCount = 0

  for (let i = 0; i < n; i++) {
    const seed = i * 12345 + 7777
    const result = simulateFullCapRun(seed, {
      elementDist: preset.elementDist,
      ilganElement: preset.ilganElement,
      enableEffectMode: true,
      enableFloorReward: true,
      activePassiveIds: selectedTalismans,
    })

    if (result.victory) {
      victories++
    } else if (result.deathFloor !== null) {
      deathsByFloor[result.deathFloor] = (deathsByFloor[result.deathFloor] ?? 0) + 1
    }

    const tc = result.traitCounts ?? {}
    wildfireEffectCount += tc['effect_wildfire_used'] ?? 0
    wildfireAttackCount += tc['attack_wildfire_used'] ?? 0
  }

  const clearRatePct = (victories / n) * 100
  const ci = wilsonCI(victories, n)

  // 채택률 단위: % (× 100 적용)
  const wildfireEffectPct = (wildfireEffectCount / n) * 100
  const wildfireAttackPct = (wildfireAttackCount / n) * 100

  return {
    victories,
    total: n,
    clearRatePct,
    ci,
    deathsByFloor,
    wildfireEffectPct,
    wildfireAttackPct,
    selectedTalismans,
  }
}

// ─── 재현 검증 실행 ──────────────────────────────────────────────────────────

const N = 1000

describe('R6 재현 검증 — R3 기준 프리셋 1000판 × 3종', () => {

  it('목화 1000판 (R3 기준 프리셋)', { timeout: 120000 }, () => {
    const r = runSim('mokwa', N)
    console.log('\n=== R6 재현검증 — 목화 ===')
    console.log(`가호 선택: [${r.selectedTalismans.join(', ')}]`)
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRatePct.toFixed(2)}%`)
    console.log(`CI 95%: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택률: ${r.wildfireEffectPct.toFixed(2)}% | 공격채택률: ${r.wildfireAttackPct.toFixed(2)}%`)
    console.log(`[단위: % — (count/n)×100 적용]`)
  })

  it('금수 1000판 (R3 기준 프리셋)', { timeout: 120000 }, () => {
    const r = runSim('geumsu', N)
    console.log('\n=== R6 재현검증 — 금수 ===')
    console.log(`가호 선택: [${r.selectedTalismans.join(', ')}]`)
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRatePct.toFixed(2)}%`)
    console.log(`CI 95%: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택률: ${r.wildfireEffectPct.toFixed(2)}% | 공격채택률: ${r.wildfireAttackPct.toFixed(2)}%`)
    console.log(`[단위: % — (count/n)×100 적용]`)
  })

  it('토단일 1000판 (R3 기준 프리셋 — to:14)', { timeout: 120000 }, () => {
    const r = runSim('todanil', N)
    console.log('\n=== R6 재현검증 — 토단일 ===')
    console.log(`가호 선택: [${r.selectedTalismans.join(', ')}]`)
    console.log(`클리어: ${r.victories}/${r.total} = ${r.clearRatePct.toFixed(2)}%`)
    console.log(`CI 95%: [${r.ci.lower.toFixed(2)}%, ${r.ci.upper.toFixed(2)}%] ±${r.ci.pm.toFixed(2)}%p`)
    console.log(`층별 사망: 1층=${r.deathsByFloor[1]} 2층=${r.deathsByFloor[2]} 3층=${r.deathsByFloor[3]} 4층=${r.deathsByFloor[4]}`)
    console.log(`wildfire 효과채택률: ${r.wildfireEffectPct.toFixed(2)}% | 공격채택률: ${r.wildfireAttackPct.toFixed(2)}%`)
    console.log(`[단위: % — (count/n)×100 적용]`)
    console.log(`[R3 기준 토단일: 23.23% | R6 어블레이션(to:6 오기입): 38.90%]`)
    console.log(`[재현 판정 기준: 토단일 클리어율 20~28% 범위이면 23%대 재현 성공]`)
  })

})
