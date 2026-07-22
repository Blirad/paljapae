/**
 * HP ×1.60 추가 측정 — 3000판 × 3프리셋
 * 지시: 이든 [판정 2건] (2026-07-22) — B벌 ×1.55 경계위 PASS 기각, 밴드 착지 조준
 *
 * 채점: 밴드 착지(목화·토단일 19~22 / 금수 24~27) 우선 + strict(상한 ≤40 / 격차 ≤15 / 하한)
 *   - ×1.60 밴드 안착 → 채택
 *   - 밴드 하회 → B벌 ×1.55로 복귀 (추가측정 없이 종결, 2회 마감)
 *
 * 실행: cd paljapae && npx vitest run src/test/hp160.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

const MULT = 1.60

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ enemyHp: number; [k: string]: unknown }>
  const BASE: Record<number, number> = { 1: 220, 2: 445, 3: 680 }
  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    getFloorHp: (floorIndex: number) => {
      const key = floorIndex + 1
      if (key === 4) return 680
      const base = BASE[key]
      if (base !== undefined) return Math.round(base * 1.60)
      return FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { getFloorHp, YIKSEANG_MULT } = await import('../engine/balance')

const PRESETS = [
  { label: '목화', dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'mok' as Element, band: [19, 22] },
  { label: '금수', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>, ilgan: 'geum' as Element, band: [24, 27] },
  { label: '토단일', dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'to' as Element, band: [19, 22] },
]

const RUNS = 3000
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_HP160_RESULT_20260722.md'

function wilsonCI(v: number, n: number, z = 1.96) {
  const p = v / n, d = 1 + z * z / n
  const c = (p + z * z / (2 * n)) / d
  const m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
  return { lo: Math.max(0, (c - m) * 100), hi: Math.min(100, (c + m) * 100) }
}

describe('HP ×1.60 추가 측정 — 3000판 × 3프리셋 (2026-07-22)', () => {
  it('밴드 착지 우선 채점 (19~22/24~27) + strict 병행', { timeout: 3600000 }, () => {
    const h1 = getFloorHp(0), h2 = getFloorHp(1), h3 = getFloorHp(2), h4 = getFloorHp(3)
    expect(h1).toBe(Math.round(220 * 1.60)) // 352
    expect(h2).toBe(Math.round(445 * 1.60)) // 712
    expect(h3).toBe(Math.round(680 * 1.60)) // 1088
    expect(h4).toBe(680)
    expect(YIKSEANG_MULT).toBe(1.0)
    console.log(`[HP mock assert PASS ×1.60] 1층=${h1}(352)/2층=${h2}(712)/3층=${h3}(1088)/4층=${h4}(680)`)

    const results = PRESETS.map(p => {
      const fav = getFavorableElement(p.ilgan)
      const tal = selectTalismanBySaju(p.dist)
      let v = 0
      for (let i = 0; i < RUNS; i++) {
        const r = simulateFullCapRun(i * 12345 + 7777, {
          elementDist: p.dist, ilganElement: p.ilgan, favorableElement: fav,
          enableFloorReward: true, enableEffectMode: true, activePassiveIds: tal,
        })
        if (r.victory) v++
      }
      const rate = v / RUNS * 100
      const ci = wilsonCI(v, RUNS)
      const inBand = rate >= p.band[0] && rate <= p.band[1]
      console.log(`  ${p.label}: ${rate.toFixed(1)}% (CI ${ci.lo.toFixed(1)}~${ci.hi.toFixed(1)}) 밴드[${p.band[0]}~${p.band[1]}] ${inBand ? '안착' : rate < p.band[0] ? '하회' : '상단초과'} 가호[${tal.join(', ')}]`)
      return { label: p.label, rate, v, ci, band: p.band, inBand, tal }
    })

    const rates = results.map(r => r.rate)
    const gap = Math.max(...rates) - Math.min(...rates)
    const overCap = results.filter(r => r.rate > 40)
    const allInBand = results.every(r => r.inBand)
    const anyBelow = results.some(r => r.rate < r.band[0])
    const verdict = allInBand ? '×1.60 채택 (전 프리셋 밴드 안착)'
      : anyBelow ? 'B벌 ×1.55 복귀 채택 (밴드 하회 — 2회 마감)'
      : '전 프리셋 밴드 상단 초과 (이든 판정 필요)'

    console.log(`\n★ 격차=${gap.toFixed(1)}%p / 상한위반=${overCap.length} / 전밴드안착=${allInBand} / 하회=${anyBelow}`)
    console.log(`★ 판정: ${verdict}`)

    const f = (n: number) => n.toFixed(1)
    const rows = results.map(r =>
      `| ${r.label} | ${f(r.rate)}% | ${f(r.ci.lo)}~${f(r.ci.hi)}% | [${r.band[0]}~${r.band[1]}] | ${r.inBand ? '✅안착' : r.rate < r.band[0] ? '⬇하회' : '⬆상단초과'} | [${r.tal.join(', ')}] |`
    ).join('\n')

    const md = `# HP ×1.60 추가 측정 결과 — 2026-07-22

**수신: 빌라드 → 이든 판정 대기**
**배경: B벌 ×1.55 경계위 PASS 기각 → 밴드 착지 조준 (×1.60)**

## HP 테이블 (mock assert)
| 층 | HP | 계산식 |
|----|-----|--------|
| 1층 | ${h1} | Math.round(220×1.60) |
| 2층 | ${h2} | Math.round(445×1.60) |
| 3층 | ${h3} | Math.round(680×1.60) |
| 4층 | ${h4} | 불변 |

## 클리어율 (3000판×3프리셋)
| 프리셋 | 클리어율 | 95% CI | 목표밴드 | 착지 | 사주 가호 |
|-------|---------|--------|---------|------|---------|
${rows}

- 격차: ${f(gap)}%p (≤15 ${gap <= 15 ? 'PASS' : 'FAIL'})
- 상한 위반(>40): ${overCap.length}건 ${overCap.length === 0 ? 'PASS' : 'FAIL'}

## ★ 판정: ${verdict}

## 참조 — 3벌 비교
| 벌 | 계수 | 목화 | 금수 | 토단일 |
|----|------|------|------|--------|
| A | ×1.50 | 27.2 | 32.3 | 27.1 |
| B | ×1.55 | 23.9 | 29.8 | 24.1 |
| C | ×1.60 | ${f(results[0].rate)} | ${f(results[1].rate)} | ${f(results[2].rate)} |
| — | 밴드 | 19~22 | 24~27 | 19~22 |

## 커밋/배포 금지 — 이든 판정 대기
`
    writeFileSync(RESULT_PATH, md)
    console.log(`[보고서] ${RESULT_PATH}`)
    expect(results).toHaveLength(3)
  })
})
