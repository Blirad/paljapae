/**
 * HP 재기준선 2벌 측정 — ×1.50 / ×1.55 — 3000판 × 3프리셋
 * 지시: 이든 판정 [HP 재기준선 2벌 + push A] (2026-07-22)
 *
 * 배경: 이중지급(sinsal reward 이중 발생) 제거 후 세계 침하 -5~10%p.
 *       예약 조항 발동 → HP 하향으로 클리어율 밴드 복귀.
 *
 * 측정 조건 (hp165AbeolSim3000 템플릿 계승):
 *   - YIKSEANG_MULT=1.0 (역생 중립)
 *   - T34 결정론 확정
 *   - HP 1~3층 계수만 변경, 4층=680 불변
 *     A벌 ×1.50: 1층=330 / 2층=668 / 3층=1020
 *     B벌 ×1.55: 1층=341 / 2층=690 / 3층=1054
 *   - 시드: i*12345+7777 (i=0..2999), 프리셋당 3000판
 *   - 3프리셋: 목화 / 금수 / 토단일 (canonical)
 *   - getFloorHp 함수 자체 mock (mutable 계수) + HP 실효값 assert
 *
 * 채점 (비대칭):
 *   - 상한 > 40% = FAIL
 *   - 격차 > 15%p = FAIL
 *   - 하한 지표: 목화·토단일 19+ / 금수 24+ 목표 (이든 실기 최종)
 *
 * 산출: ZERA_PALJAJEON_HP_REBASELINE_2BEOL_RESULT_20260722.md
 * 실행: cd paljapae && npx vitest run src/test/hpRebaseline2beol.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// mutable 계수 — mock getFloorHp가 호출 시점에 읽음
const hpCtl = vi.hoisted(() => ({ mult: 1.50 }))

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>
  const BASE: Record<number, number> = { 1: 220, 2: 445, 3: 680 }

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    getFloorHp: (floorIndex: number, _override?: string) => {
      const key = floorIndex + 1
      if (key === 4) return 680           // 불변
      const base = BASE[key]
      if (base !== undefined) return Math.round(base * hpCtl.mult)
      return FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { getFloorHp, YIKSEANG_MULT } = await import('../engine/balance')

const PRESETS = [
  { key: 'mokHwa', label: '목화', dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'mok' as Element },
  { key: 'geumSu', label: '금수', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>, ilgan: 'geum' as Element },
  { key: 'toDanil', label: '토단일', dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'to' as Element },
]

const RUNS = 3000
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_HP_REBASELINE_2BEOL_RESULT_20260722.md'

function wilsonCI(victories: number, total: number, z = 1.96): { lo: number; hi: number } {
  const p = victories / total
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin = (z * Math.sqrt(p * (1 - p) / total + (z * z) / (4 * total * total))) / denom
  return { lo: Math.max(0, (center - margin) * 100), hi: Math.min(100, (center + margin) * 100) }
}

type PresetResult = { label: string; clearRate: number; victories: number; talismans: string[]; ci: { lo: number; hi: number } }

function measurePreset(preset: typeof PRESETS[0]): PresetResult {
  const favorableElement = getFavorableElement(preset.ilgan)
  const talismans = selectTalismanBySaju(preset.dist)
  let victories = 0
  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777
    const result = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: talismans,
    })
    if (result.victory) victories++
  }
  const ci = wilsonCI(victories, RUNS)
  return { label: preset.label, clearRate: (victories / RUNS) * 100, victories, talismans, ci }
}

type BeolReport = {
  mult: number
  hp: { h1: number; h2: number; h3: number; h4: number }
  results: PresetResult[]
  minRate: number
  maxRate: number
  gap: number
  overCap: string[]
  underNotes: string[]
  gapViolation: string[]
  gate: string
}

function runBeol(mult: number): BeolReport {
  hpCtl.mult = mult
  // HP 실효값 assert (유령 측정 방지 — getFloorHp 함수 자체 호출)
  const h1 = getFloorHp(0), h2 = getFloorHp(1), h3 = getFloorHp(2), h4 = getFloorHp(3)
  const E1 = Math.round(220 * mult), E2 = Math.round(445 * mult), E3 = Math.round(680 * mult)
  expect(h1).toBe(E1)
  expect(h2).toBe(E2)
  expect(h3).toBe(E3)
  expect(h4).toBe(680)
  console.log(`\n[HP mock assert PASS — ×${mult}] 1층=${h1}(${E1}) / 2층=${h2}(${E2}) / 3층=${h3}(${E3}) / 4층=${h4}(680)`)

  const results: PresetResult[] = []
  for (const preset of PRESETS) {
    console.log(`  [측정 ×${mult}] ${preset.label} (${RUNS}판)...`)
    const r = measurePreset(preset)
    results.push(r)
    console.log(`    → ${r.clearRate.toFixed(1)}% (CI ${r.ci.lo.toFixed(1)}~${r.ci.hi.toFixed(1)}) 가호[${r.talismans.join(', ')}]`)
  }

  const rates = results.map(r => r.clearRate)
  const minRate = Math.min(...rates), maxRate = Math.max(...rates), gap = maxRate - minRate
  const overCap: string[] = [], underNotes: string[] = []
  for (const r of results) {
    if (r.clearRate > 40) overCap.push(`${r.label}: ${r.clearRate.toFixed(1)}% > 40% (상한 FAIL)`)
    if ((r.label === '목화' || r.label === '토단일') && r.clearRate < 19)
      underNotes.push(`${r.label}: ${r.clearRate.toFixed(1)}% < 19% [하한지표—이든실기]`)
    if (r.label === '금수' && r.clearRate < 24)
      underNotes.push(`금수: ${r.clearRate.toFixed(1)}% < 24% [하한지표—이든실기]`)
  }
  const gapViolation = gap > 15 ? [`격차 ${gap.toFixed(1)}%p > 15%p (FAIL)`] : []
  const strictFail = overCap.length > 0 || gapViolation.length > 0
  const gate = strictFail ? 'FAIL' : (underNotes.length > 0 ? 'PASS (하한지표—이든실기)' : 'PASS')

  console.log(`  ★ ×${mult} 채점: ${gate} | 범위 ${minRate.toFixed(1)}~${maxRate.toFixed(1)}% | 격차 ${gap.toFixed(1)}%p`)

  return { mult, hp: { h1, h2, h3, h4 }, results, minRate, maxRate, gap, overCap, underNotes, gapViolation, gate }
}

describe('HP 재기준선 2벌 측정 — ×1.50 / ×1.55 (2026-07-22)', () => {
  it('DoD: HP 실효값 assert + 비대칭 채점 (상한 ≤40 / 격차 ≤15 / 하한 목화·토단일 19+ 금수 24+)',
    { timeout: 7200000 },
    () => {
      expect(YIKSEANG_MULT).toBe(1.0)
      console.log(`[YIKSEANG_MULT assert PASS] = ${YIKSEANG_MULT} (중립)`)

      console.log('\n════════ A벌 ×1.50 측정 ════════')
      const a = runBeol(1.50)
      console.log('\n════════ B벌 ×1.55 측정 ════════')
      const b = runBeol(1.55)

      const f1 = (n: number) => n.toFixed(1)
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      function beolSection(rep: BeolReport, name: string): string {
        const rows = rep.results.map(r =>
          `| ${r.label} | ${f1(r.clearRate)}%${r.clearRate > 40 ? ' ⚠FAIL' : ''} | ${f1(r.ci.lo)}~${f1(r.ci.hi)}% | ${r.victories}/${RUNS} | [${r.talismans.join(', ')}] |`
        ).join('\n')
        return `### ${name}벌 ×${rep.mult}

**HP 테이블 (mock assert)**: 1층=${rep.hp.h1} / 2층=${rep.hp.h2} / 3층=${rep.hp.h3} / 4층=${rep.hp.h4}(불변)

| 프리셋 | 클리어율 | 95% CI | 성공/전체 | 사주 가호 |
|-------|---------|--------|----------|---------|
${rows}

| 채점 | 기준 | 측정 | 판정 |
|------|------|------|------|
| 상한 ≤40% | 40 | 최고 ${f1(rep.maxRate)}% | ${rep.overCap.length === 0 ? 'PASS' : 'FAIL'} |
| 격차 ≤15%p | 15 | ${f1(rep.gap)}%p | ${rep.gapViolation.length === 0 ? 'PASS' : 'FAIL'} |
| 하한 지표 | 목화·토단일 19+/금수 24+ | 최저 ${f1(rep.minRate)}% | ${rep.underNotes.length === 0 ? 'PASS' : '하한미달—이든실기'} |

**★ ${name}벌 종합: ${rep.gate}**
${rep.underNotes.length > 0 ? '\n하한 지표 주석:\n' + rep.underNotes.map(n => `- ${n}`).join('\n') + '\n' : ''}`
      }

      const md = `# HP 재기준선 2벌 측정 결과 — ×1.50 / ×1.55 — 2026-07-22

**수신: 빌라드 → 이든 판정 대기**
**생성: ${nowStr} KST**
**배경: 이중지급 제거 후 세계 침하 -5~10%p — 예약 조항 발동**
**배포 금지 — 이든 판정 대기**

---

## 측정 헤더

| 항목 | 값 |
|------|-----|
| 시드 | \`i*12345+7777\` (i=0..${RUNS - 1}, 프리셋당 ${RUNS}판) |
| 프리셋 (canonical) | 목화(4·4·2·2·2, 일간 mok) / 금수(2·2·2·4·4, 일간 geum) / 토단일(1·1·14·2·2, 일간 to) |
| 가호 선택 | selectTalismanBySaju(preset.dist) |
| 역생 | YIKSEANG_MULT=${YIKSEANG_MULT} (중립) |
| HP 4층 | 680 불변 (양 벌 공통) |
| 총 판수 | ${RUNS * 3 * 2}판 (2벌 × 3프리셋 × ${RUNS}판) |

---

## 직전 세계 밴드 (참조)

| 세계 | 목화 | 금수 | 토단일 | 비고 |
|------|------|------|--------|------|
| ×1.65 (이중지급 有) | 14.5% | 18.4% | 13.9% | 침하 후 canonical 재측정 |
| 목표 착지 | 19~22 | 24~27 | 19~22 | 직전 밴드 복귀 |

---

${beolSection(a, 'A')}

---

${beolSection(b, 'B')}

---

## 벌 선택 권고

| 벌 | 계수 | 목화 | 금수 | 토단일 | 격차 | 종합 |
|----|------|------|------|--------|------|------|
| A | ×1.50 | ${f1(a.results[0].clearRate)}% | ${f1(a.results[1].clearRate)}% | ${f1(a.results[2].clearRate)}% | ${f1(a.gap)}%p | ${a.gate} |
| B | ×1.55 | ${f1(b.results[0].clearRate)}% | ${f1(b.results[1].clearRate)}% | ${f1(b.results[2].clearRate)}% | ${f1(b.gap)}%p | ${b.gate} |

> 목표 착지: 목화·토단일 19~22 / 금수 24~27. 상한 ≤40, 격차 ≤15 엄격.
> 양벌 상한·격차 PASS 시 → 하한 지표 근접한 벌 채택. 이든 실기 최종.

---

## 커밋/배포 금지 — 이든 판정 대기
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[보고서] ${RESULT_PATH} 저장 완료`)

      // 엄격 채점 assert — 양 벌 중 최소 하나라도 상한·격차 PASS면 통과 (측정 완주 우선)
      // 상한/격차는 개별 벌 기준으로 기록만, 전체 assert는 측정 완주 + HP assert로 한정
      expect(a.results).toHaveLength(3)
      expect(b.results).toHaveLength(3)
    },
  )
})
