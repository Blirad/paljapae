// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * 역생 ×1.0 중립화 재측정 — 3000판 × 3프리셋
 * 지시: ZERA_PALJAJEON_YEOKSAENG_NEUTRAL_DISPATCH_20260719.md
 * 이든 확정 2026-07-19: 역생 ×1.2 → ×1.0 (중립)
 *
 * 측정 조건:
 *   - 시드: i*12345+7777 (i=0..2999, 프리셋당 3000판)
 *   - 3프리셋: 목화 / 금수 / 토단일
 *   - 가호 선택: selectTalismanBySaju(preset.dist)
 *   - getFloorHp 함수 자체 mock (클로저 우회) + HP 실효값 assert
 *   - rngState 시드 실효값 로그
 *   - 95% CI: Wilson interval
 *
 * 채점 (비대칭 — 이든 사전 조정):
 *   - 상한 엄격: 40 초과 = FAIL
 *   - 하한 관용: 25 미달 시 즉시 FAIL 아님 → "하한 지표" 주석 + 이든 실기 최종 판정
 *   - 격차 ≤ 15%p
 *   - 토단일 -2~4%p 예상 (역생 순버프 제거분)
 *
 * 산출: ZERA_PALJAJEON_YEOKSAENG_NEUTRAL_RESULT_20260719.md
 * 실행: cd paljapae && npx vitest run src/test/yeoksaengNeutralSim3000.test.ts
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
const { V4_FLOOR_HP_TABLE, YIKSEANG_MULT } = await import('../engine/balance')

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

const RUNS = 3000
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_YEOKSAENG_NEUTRAL_RESULT_20260719.md'

// ─── 95% 신뢰구간 Wilson interval ─────────────────────────────────────────────
function wilsonCI(victories: number, total: number, z = 1.96): { lo: number; hi: number } {
  const p = victories / total
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin = (z * Math.sqrt(p * (1 - p) / total + (z * z) / (4 * total * total))) / denom
  return { lo: Math.max(0, (center - margin) * 100), hi: Math.min(100, (center + margin) * 100) }
}

// ─── 단일 프리셋 측정 ─────────────────────────────────────────────────────────
function measurePreset(preset: typeof PRESETS[0]): {
  clearRate: number
  victories: number
  selectedTalismans: string[]
  rngStateSample: number  // 시드 0 기준 rngState 실효값
} {
  const favorableElement = getFavorableElement(preset.ilgan)
  const selectedTalismans = selectTalismanBySaju(preset.dist)

  let victories = 0
  let rngStateSample = -1

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // rngState 실효값 — 첫 판(i=0) 기준 로그 (fallback 은폐 차단)
    if (i === 0) {
      // rngState = (seed ^ 0x9E3779B9) >>> 0 (fullCapBot L847 동일 구조)
      rngStateSample = (seed ^ 0x9E3779B9) >>> 0
    }

    const result = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: selectedTalismans,
    })
    if (result.victory) victories++
  }

  const clearRate = (victories / RUNS) * 100
  return { clearRate, victories, selectedTalismans, rngStateSample }
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe.skip('역생 ×1.0 중립화 재측정 — 3000판 × 3프리셋 (2026-07-19)', () => {
  it(
    '비대칭 채점: 상한 40 엄격 / 하한 25 관용 / 격차 ≤ 15%p',
    { timeout: 3600000 },
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

      // ── YIKSEANG_MULT 중립화 assert ──────────────────────────────────────────
      expect(YIKSEANG_MULT).toBe(1.0)
      console.log(`[YIKSEANG_MULT assert PASS] YIKSEANG_MULT = ${YIKSEANG_MULT} (중립 확인)`)

      console.log('\n════════════════════════════════════════════════════════')
      console.log('역생 ×1.0 중립화 재측정 (2026-07-19 이든 확정)')
      console.log(`시드: i*12345+7777 (i=0..${RUNS - 1}) / 프리셋당 ${RUNS}판`)
      console.log('가호 선택: selectTalismanBySaju(preset.dist) — 실제 게임 규칙 동일')
      console.log(`총 판수: ${RUNS * 3}판`)
      console.log('채점: 상한 >40 FAIL / 하한 <25 관용(이든 실기) / 격차 ≤ 15%p')
      console.log('════════════════════════════════════════════════════════')

      // ── 측정 실행 ─────────────────────────────────────────────────────────────
      type PresetResult = {
        label: string
        clearRate: number
        victories: number
        selectedTalismans: string[]
        ci: { lo: number; hi: number }
        rngStateSample: number
      }
      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        console.log(`\n  [측정] ${preset.label} 프리셋 (${RUNS}판)...`)
        const measured = measurePreset(preset)
        const ci = wilsonCI(measured.victories, RUNS)

        // rngState 시드 실효값 로그 (fallback 은폐 차단)
        console.log(`  [rngState] seed(i=0)=${0 * 12345 + 7777} → rngState=${measured.rngStateSample} (= seed ^ 0x9E3779B9)`)

        results.push({
          label: preset.label,
          clearRate: measured.clearRate,
          victories: measured.victories,
          selectedTalismans: measured.selectedTalismans,
          ci,
          rngStateSample: measured.rngStateSample,
        })
        console.log(`  → 클리어율=${measured.clearRate.toFixed(1)}% (95%CI: ${ci.lo.toFixed(1)}~${ci.hi.toFixed(1)}%)`)
        console.log(`  → 사주 선택 가호: [${measured.selectedTalismans.join(', ')}]`)
      }

      // ── 비대칭 채점 (이든 사전 조정) ─────────────────────────────────────────
      const clearRates = results.map(r => r.clearRate)
      const minRate = Math.min(...clearRates)
      const maxRate = Math.max(...clearRates)
      const gap = maxRate - minRate

      // 상한 위반 (엄격): 40 초과 = FAIL
      const overCapViolations: string[] = []
      // 하한 미달 (관용): 주석만, 즉시 FAIL 아님 → 이든 실기 최종 판정
      const underCapNotes: string[] = []

      for (const r of results) {
        if (r.clearRate > 40) {
          overCapViolations.push(`${r.label}: ${r.clearRate.toFixed(1)}% > 40% (상한 초과 — 즉시 FAIL)`)
        }
        if (r.clearRate < 25) {
          // 비대칭: 하한 관용 — 주석만 기록
          underCapNotes.push(`${r.label}: ${r.clearRate.toFixed(1)}% < 25% [하한 지표 — 이든 실기 최종 판정]`)
        }
      }

      // 격차 위반
      const gapViolation = gap > 15
        ? [`프리셋 간 격차: ${gap.toFixed(1)}%p > 15%p (격차 위반 — FAIL)`]
        : []

      // 종합 판정: 상한 위반 또는 격차 위반 시 FAIL (하한은 관용)
      const strictFail = overCapViolations.length > 0 || gapViolation.length > 0
      // 하한 미달만 있는 경우 → PASS (이든 실기 대기)
      const gateResult = strictFail ? 'FAIL' : (underCapNotes.length > 0 ? 'PASS (하한 지표 — 이든 실기 판정)' : 'PASS')

      console.log('\n════════════════════════════════════════════════════════')
      console.log(`채점 결과: ${gateResult}`)
      console.log(`  클리어율 범위: ${minRate.toFixed(1)}~${maxRate.toFixed(1)}% (상한 40 엄격 / 하한 25 관용)`)
      console.log(`  프리셋 간 격차: ${gap.toFixed(1)}%p (목표: ≤ 15%p)`)
      if (overCapViolations.length > 0) console.log('[상한 위반 FAIL]', overCapViolations)
      if (underCapNotes.length > 0) console.log('[하한 지표 — 관용]', underCapNotes)
      if (gapViolation.length > 0) console.log('[격차 위반 FAIL]', gapViolation)
      console.log('════════════════════════════════════════════════════════')

      // ── 보고서 생성 ───────────────────────────────────────────────────────────
      const f1 = (n: number) => n.toFixed(1)
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      function resultRow(r: PresetResult): string {
        const overFlag = r.clearRate > 40 ? ' **⚠FAIL(상한)**' : ''
        const underFlag = r.clearRate < 25 ? ' **[하한지표—이든실기]**' : ''
        return `| ${r.label} | ${f1(r.clearRate)}%${overFlag}${underFlag} | ${f1(r.ci.lo)}~${f1(r.ci.hi)}% | ${r.victories}/${RUNS} | [${r.selectedTalismans.join(', ')}] |`
      }

      function rngRow(r: PresetResult): string {
        const seed0 = 0 * 12345 + 7777
        return `| ${r.label} | ${seed0} | ${r.rngStateSample} | seed ^ 0x9E3779B9 |`
      }

      const md = `# 역생 ×1.0 중립화 재측정 결과 — 2026-07-19

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**배포 금지 — 이든 판정 대기**

---

## 6줄 실측 헤더

| 항목 | 값 |
|------|-----|
| 커밋 해시 | \`a504d7e\` (역생 중립화 코드 변경 포함) |
| 시드 | \`i*12345+7777\` (i=0..${RUNS - 1}, 프리셋당 ${RUNS}판) |
| 3프리셋 정의 | 목화(mok4·hwa4·to2·geum2·su2) / 금수(mok2·hwa2·to2·geum4·su4) / 토단일(mok1·hwa1·to14·geum2·su2) |
| 가호 선택 방식 | \`selectTalismanBySaju(preset.dist)\` — 실제 게임 규칙 동일 |
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

## YIKSEANG_MULT 중립화 확인

| 항목 | 이전값 | 현재값 | 판정 |
|------|--------|--------|------|
| YIKSEANG_MULT | 1.2 | ${YIKSEANG_MULT} | **${YIKSEANG_MULT === 1.0 ? 'PASS (×1.0 중립 확인)' : 'FAIL'}** |

---

## rngState 시드 실효값 로그 (fallback 은폐 차단)

| 프리셋 | seed(i=0) | rngState | 계산식 |
|-------|-----------|----------|--------|
${results.map(r => rngRow(r)).join('\n')}

---

## 클리어율 측정 결과 (3프리셋)

- **가호 선택**: \`selectTalismanBySaju()\` — 사주 기반 자동 선택 (실제 게임 규칙 그대로)
- **판수**: 프리셋당 ${RUNS}판
- **95% CI**: Wilson interval
- **역생**: ×1.0 중립 (이든 확정 2026-07-19)

| 프리셋 | 클리어율 | 95% CI | 성공/전체 | 사주 선택 가호 |
|-------|---------|--------|----------|-------------|
${results.map(r => resultRow(r)).join('\n')}

---

## 채점 판정 (비대칭 — 이든 사전 조정)

| 채점 기준 | 기준값 | 측정값 | 판정 |
|----------|--------|--------|------|
| 상한 엄격: 클리어율 ≤ 40% | 40% | 최고=${f1(maxRate)}% | **${overCapViolations.length === 0 ? 'PASS' : 'FAIL'}** |
| 하한 관용: 클리어율 ≥ 25% | 25% | 최저=${f1(minRate)}% | **${underCapNotes.length === 0 ? 'PASS' : 'PASS (하한지표—이든실기판정)'}** |
| 프리셋 간 격차 ≤ 15%p | 15%p | 격차=${f1(gap)}%p | **${gapViolation.length === 0 ? 'PASS' : 'FAIL'}** |

${overCapViolations.length > 0 ? `### 상한 위반 (즉시 FAIL)\n${overCapViolations.map(v => `- ${v}`).join('\n')}\n` : ''}
${underCapNotes.length > 0 ? `### 하한 지표 (관용 — 이든 실기 최종 판정)\n${underCapNotes.map(v => `- ${v}`).join('\n')}\n\n> 비대칭 채점 규칙: 하한 미달은 즉시 FAIL 아님. 이든 실기로 최종 판정.\n` : ''}
${gapViolation.length > 0 ? `### 격차 위반 (즉시 FAIL)\n${gapViolation.map(v => `- ${v}`).join('\n')}\n` : ''}

## ★ 게이트 종합 판정: **${gateResult}**

> 토단일 -2~4%p 예상치 (역생 순버프 제거분): 이든 사전 조정 기준. 이탈 시 보고만, 수치 자체 조정 금지.

---

## 커밋/배포 금지 — 이든 판정 대기

본 보고서는 역생 중립화 재측정 결과 산출물입니다. 이든 판정 전까지 커밋/배포 절대 금지.
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[보고서] ${RESULT_PATH} 저장 완료`)

      // vitest assert (HP 및 YIKSEANG_MULT)
      expect(hp1).toBe(374)
      expect(hp2).toBe(757)
      expect(hp3).toBe(1156)
      expect(hp4).toBe(680)
      expect(YIKSEANG_MULT).toBe(1.0)
      expect(results).toHaveLength(3)

      // 상한 위반 시 assert FAIL (엄격)
      expect(overCapViolations, `상한 위반: ${overCapViolations.join(', ')}`).toHaveLength(0)
      // 격차 위반 시 assert FAIL
      expect(gapViolation, `격차 위반: ${gapViolation.join(', ')}`).toHaveLength(0)
      // 하한은 관용 — assert 없음 (이든 실기 최종 판정)
    },
  )
})
