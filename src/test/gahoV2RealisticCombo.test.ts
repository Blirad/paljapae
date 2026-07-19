/**
 * 가호 v2 현실 조합 측정 (사주 기반 초기 가호 1~2개)
 * 지시: ZERA_PALJAJEON_GAHO_V2_AB_SOLO_DISPATCH_20260719.md — 2단계
 *
 * 구조:
 *   사주 계산 기반 초기 가호 1~2개 장착 (실제 게임 규칙 그대로)
 *   selectTalismanBySaju()로 프리셋별 최적 2종 자동 선택
 *   3000판 × 3프리셋
 *   시드: i*12345+7777
 *
 * 채점 기준:
 *   - 전 프리셋 클리어율 25~40%
 *   - 프리셋 간 격차 ≤ 15%p
 *
 * 산출: ZERA_PALJAJEON_GAHO_V2_REALISTIC_RESULT_20260719.md
 *
 * 실행: cd paljapae && npx vitest run src/test/gahoV2RealisticCombo.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── v4 mock — getFloorHp 함수 자체 교체 (클로저 이슈 우회, 유령 측정 방지) ──
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const V4_FLOOR_HP_TABLE = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    // 함수 자체 교체 — 배열 mock 아님 (2026-07-18 이든 규격)
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = V4_FLOOR_HP_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

// mock 이후 await import
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')

// ─── 프리셋 3종 ───────────────────────────────────────────────────────────────
const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
  },
]

const RUNS = 3000  // 프리셋당 3000판 (이든 지시)
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_GAHO_V2_REALISTIC_RESULT_20260719.md'

// ─── 현실 조합 측정: 사주 기반 초기 가호 1~2개 ─────────────────────────────
// selectTalismanBySaju()로 프리셋별 최적 2종 선택 → 실제 게임 규칙 그대로
function measureRealisticCombo(preset: typeof PRESETS[0]): {
  clearRate: number
  victories: number
  selectedTalismans: string[]
} {
  const favorableElement = getFavorableElement(preset.ilgan)
  // 실제 게임 규칙: 사주 기반 자동 선택 (최적 2종)
  const selectedTalismans = selectTalismanBySaju(preset.dist)

  let victories = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    const result = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: selectedTalismans,  // 사주 기반 자동 선택 1~2종
    })
    if (result.victory) victories++
  }

  const clearRate = (victories / RUNS) * 100
  return { clearRate, victories, selectedTalismans }
}

// ─── 95% 신뢰구간 계산 (이항분포 Wilson interval) ─────────────────────────
function wilsonCI(victories: number, total: number, z = 1.96): { lo: number; hi: number } {
  const p = victories / total
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin = (z * Math.sqrt(p * (1 - p) / total + (z * z) / (4 * total * total))) / denom
  return { lo: Math.max(0, (center - margin) * 100), hi: Math.min(100, (center + margin) * 100) }
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe('가호 v2 현실 조합 측정 (사주 기반 초기 가호, 3000판 × 3프리셋, 2026-07-19)', () => {
  it(
    '전 프리셋 25~40% + 격차 ≤ 15%p 채점',
    { timeout: 3600000 },  // 60분 타임아웃
    () => {
      // ── HP 실효값 assert (유령 측정 방지 — 2026-07-18 이든 규격) ──────────────
      const hp1 = V4_FLOOR_HP_TABLE[1]
      const hp2 = V4_FLOOR_HP_TABLE[2]
      const hp3 = V4_FLOOR_HP_TABLE[3]
      const hp4 = V4_FLOOR_HP_TABLE[4]
      expect(hp1).toBe(374)
      expect(hp2).toBe(757)
      expect(hp3).toBe(1156)
      expect(hp4).toBe(680)
      console.log(`\n[HP assert PASS] 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4}`)

      console.log('\n════════════════════════════════════════════════════════')
      console.log('가호 v2 현실 조합 측정 (사주 기반 초기 가호 1~2개)')
      console.log('커밋: 0c34738 — 편관 턴당 1회 발동 제한 포함')
      console.log(`시드: i*12345+7777 (i=0..${RUNS - 1}) / 3프리셋 각 ${RUNS}판`)
      console.log('가호 선택: selectTalismanBySaju(preset.dist) — 실제 게임 규칙 동일')
      console.log(`총 판수: ${RUNS * 3}판`)
      console.log('채점: 전 프리셋 25~40% + 프리셋 간 격차 ≤ 15%p')
      console.log('════════════════════════════════════════════════════════')

      // ── 측정 실행 ─────────────────────────────────────────────────────────────
      type PresetResult = {
        label: string
        clearRate: number
        victories: number
        selectedTalismans: string[]
        ci: { lo: number; hi: number }
      }
      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        console.log(`  [측정] ${preset.label} 프리셋 (${RUNS}판)...`)
        const measured = measureRealisticCombo(preset)
        const ci = wilsonCI(measured.victories, RUNS)
        results.push({
          label: preset.label,
          clearRate: measured.clearRate,
          victories: measured.victories,
          selectedTalismans: measured.selectedTalismans,
          ci,
        })
        console.log(`    → 클리어율=${measured.clearRate.toFixed(1)}% (95%CI: ${ci.lo.toFixed(1)}~${ci.hi.toFixed(1)}%)`)
        console.log(`    → 사주 선택 가호: [${measured.selectedTalismans.join(', ')}]`)
      }

      // ── 채점 ─────────────────────────────────────────────────────────────────
      const clearRates = results.map(r => r.clearRate)
      const minRate = Math.min(...clearRates)
      const maxRate = Math.max(...clearRates)
      const gap = maxRate - minRate

      const violations: string[] = []

      // 기준 1: 전 프리셋 클리어율 25~40%
      for (const r of results) {
        if (r.clearRate < 25) {
          violations.push(`${r.label}: ${r.clearRate.toFixed(1)}% < 25% (하한 미달)`)
        }
        if (r.clearRate > 40) {
          violations.push(`${r.label}: ${r.clearRate.toFixed(1)}% > 40% (상한 초과)`)
        }
      }

      // 기준 2: 프리셋 간 격차 ≤ 15%p
      if (gap > 15) {
        violations.push(`프리셋 간 격차: ${gap.toFixed(1)}%p > 15%p`)
      }

      const gatePass = violations.length === 0

      console.log('\n════════════════════════════════════════════════════════')
      console.log(`채점 결과: ${gatePass ? 'PASS' : 'FAIL'}`)
      console.log(`  클리어율 범위: ${minRate.toFixed(1)}~${maxRate.toFixed(1)}% (목표: 25~40%)`)
      console.log(`  프리셋 간 격차: ${gap.toFixed(1)}%p (목표: ≤ 15%p)`)
      if (violations.length > 0) {
        console.log('[위반 항목]', violations)
      }
      console.log('════════════════════════════════════════════════════════')

      // ── 보고서 생성 ───────────────────────────────────────────────────────────
      const f1 = (n: number) => n.toFixed(1)
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      function resultRow(r: PresetResult): string {
        const rangeFlag =
          r.clearRate < 25 ? ' **⚠LOW**' :
          r.clearRate > 40 ? ' **⚠HIGH**' : ''
        return `| ${r.label} | ${f1(r.clearRate)}%${rangeFlag} | ${f1(r.ci.lo)}~${f1(r.ci.hi)}% | ${r.victories}/${RUNS} | [${r.selectedTalismans.join(', ')}] |`
      }

      const md = `# 가호 v2 현실 조합 측정 결과 — 2026-07-19

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**배포 금지 — 이든 판정 대기**

---

## 6줄 실측 헤더

| 항목 | 값 |
|------|-----|
| 커밋 해시 | \`0c34738\` (편관 턴당 1회 발동 제한 포함) |
| 시드 | \`i*12345+7777\` (i=0..${RUNS - 1}, 프리셋당 ${RUNS}판) |
| 3프리셋 정의 | 목화(mok4·hwa4·to2·geum2·su2) / 금수(mok2·hwa2·to2·geum4·su4) / 토단일(mok1·hwa1·to14·geum2·su2) |
| 가호 선택 방식 | \`selectTalismanBySaju(preset.dist)\` — 실제 게임 규칙 동일 (최적 2종 자동 선택) |
| 총 판수 | ${RUNS * 3}판 (3프리셋 × ${RUNS}판) |
| mock 검증 결과 | getFloorHp 함수 자체 교체(클로저 우회) — HP 실효값 assert PASS: 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4} |

---

## v4 HP 테이블 (mock 검증)

| 층 | HP |
|----|-----|
| 1층 | ${hp1} (=Math.round(220×1.70)) |
| 2층 | ${hp2} (=Math.round(445×1.70)) |
| 3층 | ${hp3} (=Math.round(680×1.70)) |
| 4층 | ${hp4} (불변) |

---

## 현실 조합 클리어율 (3프리셋)

- **가호 선택**: \`selectTalismanBySaju()\` — 사주 기반 자동 선택 (실제 게임 규칙 그대로)
- **판수**: 프리셋당 ${RUNS}판
- **95% CI**: Wilson interval

| 프리셋 | 클리어율 | 95% CI | 성공/전체 | 사주 선택 가호 |
|-------|---------|--------|----------|-------------|
${results.map(r => resultRow(r)).join('\n')}

---

## 채점 판정

| 채점 기준 | 기준값 | 측정값 | 판정 |
|----------|--------|--------|------|
| 전 프리셋 클리어율 ≥ 25% | 25% | 최저=${f1(minRate)}% | **${results.every(r => r.clearRate >= 25) ? 'PASS' : 'FAIL'}** |
| 전 프리셋 클리어율 ≤ 40% | 40% | 최고=${f1(maxRate)}% | **${results.every(r => r.clearRate <= 40) ? 'PASS' : 'FAIL'}** |
| 프리셋 간 격차 ≤ 15%p | 15%p | 격차=${f1(gap)}%p | **${gap <= 15 ? 'PASS' : 'FAIL'}** |

${violations.length > 0 ? `### 위반 항목\n${violations.map(v => `- ${v}`).join('\n')}\n` : ''}

## ★ 게이트 종합 판정: **${gatePass ? 'PASS' : 'FAIL'}**

---

## 커밋/배포 금지 — 이든 판정 대기

본 보고서는 밸런스 게이트 측정 결과 산출물입니다. 이든 판정 전까지 커밋/배포 절대 금지.
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[보고서] ${RESULT_PATH} 저장 완료`)

      // vitest assert
      expect(hp1).toBe(374)
      expect(hp2).toBe(757)
      expect(hp3).toBe(1156)
      expect(hp4).toBe(680)
      expect(results).toHaveLength(3)
    },
  )
})
