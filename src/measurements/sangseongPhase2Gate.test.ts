// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * 상성 개정 2단계 — 감쇠 ON 클리어율 측정 게이트
 * 지시문: ZERA_PALJAJEON_SANGSEONG_PHASE2_GATE_DISPATCH_20260719.md
 *
 * 목적: DONGGI_MULTIPLIER=0.85 적용 후 3프리셋 × 1000판 클리어율 측정
 *       Stage 1 (OFF, 가호 v2 게이트 B군 기준) 대비 순수 감쇠 Δ 산출
 *
 * 조건:
 *   - 커밋 30bc6c9 + DONGGI_MULTIPLIER = 0.85 (balance.ts L415 확인)
 *   - paljajeonEngine.ts L314: damage = Math.round(damage * DONGGI_MULTIPLIER)
 *   - 가호: selectTalismanBySaju 기반 2종 (가호 v2 게이트 B군 동일 조건)
 *   - 시드: i*12345+7777 (i=0..999, 프리셋당 1000판)
 *
 * 프리셋:
 *   목화:  { mok:4, hwa:4, to:2, geum:2, su:2 }
 *   금수:  { mok:2, hwa:2, to:2, geum:4, su:4 }
 *   토단일: { mok:1, hwa:1, to:14, geum:2, su:2 }
 *
 * 실행: cd paljapae && npx vitest run src/test/sangseongPhase2Gate.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── v4 mock — getFloorHp 함수 자체 교체 (클로저 이슈 우회, 유령 측정 방지) ──
// 2026-07-18 이든 규격: 배열 mock 아닌 함수 자체 교체 + HP 실효값 assert 1건
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

const RUNS = 1000
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_SANGSEONG_PHASE2_GATE_RESULT_20260719.md'

// Stage 1 (OFF) 기준값 — 가호 v2 게이트 B군 클리어율 평균 (편관 제외)
// 출처: ZERA_PALJAJEON_GAHO_V2_3000_GATE_RESULT_20260719.md 표 A
// 편관(偏官) B군은 이상치(22.0/27.4/26.6 — 편관이 방어 기믹 억제 가호이므로 배제 시 클리어율 급락)
// 나머지 9종 B군 평균을 Stage 1 기저선으로 사용
const STAGE1_B_RATES: Record<string, number[]> = {
  // 가호별 목화 B군 클리어율 (편관=22.0 제외)
  목화: [71.5, 70.1, 71.9, 68.5, 70.7, 70.9, 70.2, 67.3, 70.0],
  // 가호별 금수 B군 클리어율 (편관=27.4 제외)
  금수: [76.8, 75.9, 76.1, 75.6, 76.9, 76.9, 72.7, 77.8, 76.1],
  // 가호별 토단일 B군 클리어율 (편관=26.6 제외)
  토단일: [81.9, 83.3, 84.3, 83.2, 81.6, 81.2, 81.6, 82.1, 84.2],
}

function avgB(label: string): number {
  const arr = STAGE1_B_RATES[label]
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ─── 단일 프리셋 클리어율 측정 ───────────────────────────────────────────────
// 가호 v2 게이트 B군과 동일 조건: selectTalismanBySaju 기반 2종 가호 포함
function measureClearRate(preset: typeof PRESETS[0]): {
  victories: number
  clearRate: number
} {
  const favorableElement = getFavorableElement(preset.ilgan)
  const basePassiveIds = selectTalismanBySaju(preset.dist)
  let victories = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777
    const result = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: basePassiveIds,
    })
    if (result.victory) victories++
  }

  return { victories, clearRate: (victories / RUNS) * 100 }
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe.skip('상성 개정 2단계 — 감쇠 ON 클리어율 측정 게이트 (DONGGI_MULTIPLIER=0.85)', () => {
  it(
    '3프리셋 × 1000판 클리어율 측정 + 순수 감쇠 Δ 산출',
    { timeout: 1800000 },  // 30분 타임아웃
    () => {
      // ── HP 실효값 assert (유령 측정 방지 — 2026-07-18 이든 규격) ──────────────
      const hp1 = V4_FLOOR_HP_TABLE[1]
      const hp2 = V4_FLOOR_HP_TABLE[2]
      const hp3 = V4_FLOOR_HP_TABLE[3]
      const hp4 = V4_FLOOR_HP_TABLE[4]
      expect(hp1).toBe(374)   // Math.round(220 * 1.70)
      expect(hp2).toBe(757)   // Math.round(445 * 1.70)
      expect(hp3).toBe(1156)  // Math.round(680 * 1.70)
      expect(hp4).toBe(680)   // 불변
      console.log(`\n[HP assert PASS] 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4}`)

      console.log('\n════════════════════════════════════════════════════════')
      console.log('상성 개정 2단계 측정 — DONGGI_MULTIPLIER=0.85 (감쇠 ON)')
      console.log('시드: i*12345+7777 (i=0..999), 프리셋당 1000판, 총 3000판')
      console.log('가호: selectTalismanBySaju 기반 2종 (가호 v2 게이트 B군 동일 조건)')
      console.log('════════════════════════════════════════════════════════')

      // ── 3프리셋 측정 ──────────────────────────────────────────────────────────
      const results: {
        label: string
        victories: number
        clearRate: number
        stage1: number
        delta: number
      }[] = []

      for (const preset of PRESETS) {
        console.log(`\n[${preset.label}] 1000판 측정 중...`)
        const { victories, clearRate } = measureClearRate(preset)
        const stage1 = avgB(preset.label)
        const delta = clearRate - stage1
        results.push({ label: preset.label, victories, clearRate, stage1, delta })
        console.log(`  -> 클리어율: ${clearRate.toFixed(1)}% (${victories}/1000)`)
        console.log(`  -> Stage1(OFF): ${stage1.toFixed(1)}% | Δ: ${delta.toFixed(1)}%p`)
      }

      // ── 분석 ─────────────────────────────────────────────────────────────────
      const deltas = results.map(r => r.delta)
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length
      const TARGET_MIN = -5.0
      const TARGET_MAX = -3.0
      const inRange = avgDelta >= TARGET_MIN && avgDelta <= TARGET_MAX

      console.log('\n════════════════════════════════════════════════════════')
      console.log(`평균 순수 Δ: ${avgDelta.toFixed(2)}%p`)
      console.log(`목표 범위: −3~5%p → ${inRange ? 'RANGE OK' : 'OUT OF RANGE'}`)
      console.log('════════════════════════════════════════════════════════')

      // ── 보고서 생성 ───────────────────────────────────────────────────────────
      const f1 = (n: number) => n.toFixed(1)
      const f2 = (n: number) => n.toFixed(2)
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      // 클리어율 표 행
      function clearRateRow(r: typeof results[0]): string {
        return `| ${r.label} | ${f1(r.clearRate)}% |`
      }

      // 순수 감쇠 델타 표 행
      function deltaRow(r: typeof results[0]): string {
        return `| ${r.label} | ${f1(r.stage1)}% | ${f1(r.clearRate)}% | ${f1(r.delta)}%p |`
      }

      const md = `# 상성 개정 2단계 — 감쇠 ON 측정 게이트 결과

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**배포 금지 — 빌라드 검토 후 이든 전달**

---

## 6줄 실측 헤더

| 항목 | 값 |
|------|-----|
| 커밋 해시 | \`30bc6c9\` + DONGGI_MULTIPLIER=0.85 적용 (balance.ts L415 + paljajeonEngine.ts L314) |
| 시드 | \`i*12345+7777\` (i=0..999, 프리셋당 1000판) |
| 3프리셋 정의 | 목화(mok4·hwa4·to2·geum2·su2) / 금수(mok2·hwa2·to2·geum4·su4) / 토단일(mok1·hwa1·to14·geum2·su2) |
| 가호 조건 | selectTalismanBySaju 기반 2종 (가호 v2 게이트 B군 동일 조건) |
| mock 검증 | getFloorHp 함수 자체 교체(클로저 우회) — HP assert PASS: 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4} |
| Stage1 기준값 출처 | ZERA_PALJAJEON_GAHO_V2_3000_GATE_RESULT_20260719.md 표A B군 평균 (편관 제외 9종) |

---

## 표 1: Stage 2 클리어율 (감쇠 ON, 3프리셋)

| 프리셋 | 클리어율(%) |
|--------|----------|
${results.map(r => clearRateRow(r)).join('\n')}

---

## 표 2: 순수 감쇠 델타 (Stage 2 − Stage 1)

- **Stage 1 (OFF)**: 가호 v2 게이트 B군 클리어율 평균 (편관 제외 9종)
- **Stage 2 (ON)**: 본 측정 (DONGGI_MULTIPLIER=0.85 활성)
- **Δ = Stage 2 − Stage 1** (음수 = 감쇠로 인한 클리어율 손실)

| 프리셋 | 1단계(OFF) | 2단계(ON) | Δ(2-1) |
|--------|----------|----------|--------|
${results.map(r => deltaRow(r)).join('\n')}

---

## 분석

### 평균 순수 Δ

- 프리셋별 Δ: ${results.map(r => `${r.label} ${f1(r.delta)}%p`).join(' / ')}
- **평균 Δ = ${f2(avgDelta)}%p**

### 목표 범위 (−3~5%p) 판정

- 목표: Δ ≈ −3~5%p (감쇠 도입의 순수 피해 손실 예상 범위)
- 실측 평균 Δ: ${f2(avgDelta)}%p
- 판정: **${inRange ? 'RANGE OK — 목표 범위 내' : `OUT OF RANGE — 목표 −3~5%p 벗어남`}**

### 예상 vs 실측

- 선행 데이터 예상 (동기 조우율 ≈20% × 감쇠 15%): 약 −3%p
- 실측 평균 Δ: ${f2(avgDelta)}%p
- 편차 해석: ${Math.abs(avgDelta) < 3.0
    ? '감쇠 효과가 예상보다 작음 — 동기 조우 조건이 실제 딜 계산에서 제한적으로 작용하거나 Stage 1 기준값(B군 평균) 특성 차이'
    : Math.abs(avgDelta) <= 5.0
      ? '예상 범위(−3~5%p) 내 — 감쇠 효과 정상 발현'
      : '감쇠 효과가 예상보다 큼 — 동기 조우 빈도가 높거나 Stage 1 기준값 조건 차이 영향 가능성'}

### 판정 예고

${inRange
  ? '- Δ ≈ −3~5%p 범위 내 → **"재기준선 축소판"** (감쇠 유지, HP 소폭 하향 흡수 검토)'
  : `- Δ 범위 이탈 (${f2(avgDelta)}%p) → **추가 분석 필요**
- 범위 이탈 원인: Stage 1 기준값(B군 평균)과 Stage 2 측정 조건의 구조적 차이 가능성`}

---

*이든에게 직접 보고 금지 — 빌라드 검토 후 전달.*
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[보고서] ${RESULT_PATH} 저장 완료`)

      // vitest assert
      expect(hp1).toBe(374)
      expect(hp2).toBe(757)
      expect(hp3).toBe(1156)
      expect(hp4).toBe(680)
      expect(results).toHaveLength(3)
      for (const r of results) {
        expect(r.victories).toBeGreaterThanOrEqual(0)
        expect(r.victories).toBeLessThanOrEqual(RUNS)
      }
    },
  )
})
