/**
 * 상성 개정 1단계 — 밸런스 측정 게이트
 * 지시문: ZERA_PALJAJEON_SANGSEONG_PHASE1_MEASUREMENT_DISPATCH_20260719.md
 *
 * 목적: 동기 감쇠(DONGGI_MULTIPLIER=0.85) 적용 후
 *       3프리셋 × 1000판 클리어율 재측정.
 *       이전 FAIL(편관 과강/사문화) 해결 여부 확인.
 *
 * 게이트 기준:
 *   PASS: 전 프리셋 클리어율 25~40% AND 프리셋 간 격차 ≤15%p
 *   FAIL: 위 조건 중 하나라도 불만족
 *
 * 시드: i*12345+7777 (i=0..999)
 * 프리셋:
 *   목화:  { mok:4, hwa:4, to:2, geum:2, su:2 }
 *   금수:  { mok:2, hwa:2, to:2, geum:4, su:4 }
 *   토단일: { mok:1, hwa:1, to:14, geum:2, su:2 }
 *
 * 실행: cd paljapae && npx vitest run src/test/sangseongPhase1Measurement.test.ts
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
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = V4_FLOOR_HP_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

// mock 이후 await import
const { simulateFullCapRun } = await import('../engine/fullCapBot')
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

const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_SANGSEONG_PHASE1_MEASUREMENT_RESULT_20260719.md'

// ─── 단일 프리셋 클리어율 측정 ───────────────────────────────────────────────
function measureClearRate(preset: typeof PRESETS[0]): {
  victories: number
  clearRate: number
} {
  const favorableElement = getFavorableElement(preset.ilgan)
  let victories = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777
    const result = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
    })
    if (result.victory) victories++
  }

  return { victories, clearRate: (victories / RUNS) * 100 }
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe('상성 개정 1단계 — 클리어율 측정 게이트 (DONGGI_MULTIPLIER=0.85)', () => {
  it(
    '3프리셋 × 1000판 클리어율 측정 + 게이트 채점',
    { timeout: 1800000 },
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
      console.log('상성 개정 1단계 측정 게이트 시작 — DONGGI_MULTIPLIER=0.85')
      console.log('시드: i*12345+7777 (i=0..999), 프리셋당 1000판, 총 3000판')
      console.log('게이트 기준: 전 프리셋 25~40% AND 격차 ≤15%p')
      console.log('════════════════════════════════════════════════════════')

      // ── 3프리셋 측정 ──────────────────────────────────────────────────────────
      const results: { label: string; victories: number; clearRate: number }[] = []

      for (const preset of PRESETS) {
        console.log(`\n[${preset.label}] 1000판 측정 중...`)
        const { victories, clearRate } = measureClearRate(preset)
        results.push({ label: preset.label, victories, clearRate })
        console.log(`  -> 클리어율: ${clearRate.toFixed(1)}% (${victories}/1000)`)
      }

      // ── 게이트 채점 ───────────────────────────────────────────────────────────
      const GATE_MIN = 25
      const GATE_MAX = 40
      const GATE_GAP_MAX = 15

      const clearRates = results.map(r => r.clearRate)
      const maxRate = Math.max(...clearRates)
      const minRate = Math.min(...clearRates)
      const gap = maxRate - minRate

      const rangeViolations: string[] = []
      for (const r of results) {
        if (r.clearRate < GATE_MIN || r.clearRate > GATE_MAX) {
          rangeViolations.push(
            `${r.label}: ${r.clearRate.toFixed(1)}% (기준 ${GATE_MIN}~${GATE_MAX}%)`
          )
        }
      }

      const gapPass = gap <= GATE_GAP_MAX
      const rangePass = rangeViolations.length === 0
      const gatePass = rangePass && gapPass

      console.log('\n════════════════════════════════════════════════════════')
      console.log(`게이트 판정: ${gatePass ? 'PASS' : 'FAIL'}`)
      console.log(`  범위 체크 (25~40%): ${rangePass ? 'PASS' : 'FAIL'}`)
      if (rangeViolations.length > 0) {
        for (const v of rangeViolations) console.log(`    위반: ${v}`)
      }
      console.log(`  격차 체크 (≤15%p): ${gapPass ? 'PASS' : 'FAIL'} (실측 격차 ${gap.toFixed(1)}%p)`)
      console.log('════════════════════════════════════════════════════════')

      // ── 편관 감소량 분석 — 이전 B군(배제) 클리어율 기준 대비 ────────────────
      // 이전 가호 v2 게이트 B군(편관 배제) 클리어율:
      //   목화: 22.0%, 금수: 27.4%, 토단일: 26.6%
      // 이 수치는 편관 없이 순수 3프리셋 기대 클리어율과 다름 (가호 선택 영향)
      // 상성 개정 전 베이스라인이 없으므로, 이전 선행 데이터
      //   (sangseongPhase1Distribution) 클리어율을 참조 비교값으로 사용
      //
      // 선행 측정 결과 (sangseongPhase1Distribution, 시드 i*12345+7777 동일):
      //   측정 파일이 없으므로 현재 측정치가 첫 공식 기준값이 됨.
      //   대신 DONGGI_MULTIPLIER 이전(1.0) vs 이후(0.85) 비교는
      //   이전 가호 v2 게이트 B군 클리어율(편관 제외 기준)을 참조.

      // ── 보고서 생성 ───────────────────────────────────────────────────────────
      const f1 = (n: number) => n.toFixed(1)
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      // 이전 가호 v2 게이트 B군 클리어율 (DONGGI_MULTIPLIER=1.0 시점 추정 기준)
      // 가호 v2 게이트 결과 (2026-07-19 01:38:41) — B군 = 기본 자동 선택 2가호
      // 편관 B군: 목화=22.0%, 금수=27.4%, 토단일=26.6%
      // 단, B군은 기본 가호 2종 포함 상태이므로 완전 무가호 기준이 아님
      // 현재 측정도 동일 조건(기본 가호 없음 — favorableElement 기반)이므로
      // 직접 비교는 부정확. 참조 수준으로만 표기.

      const prevRef = [
        { label: '목화', prevBRate: null as number | null },
        { label: '금수', prevBRate: null as number | null },
        { label: '토단일', prevBRate: null as number | null },
      ]

      function presetRow(r: typeof results[0], prev: typeof prevRef[0]): string {
        const inRange = r.clearRate >= GATE_MIN && r.clearRate <= GATE_MAX
        const rangeStr = inRange ? 'PASS' : 'FAIL'
        const prevStr = prev.prevBRate !== null
          ? `${f1(prev.prevBRate)}% → ${f1(r.clearRate)}% (Δ${f1(r.clearRate - prev.prevBRate)}%p)`
          : `${f1(r.clearRate)}% (이전 기준 없음)`
        return `| ${r.label} | ${f1(r.clearRate)}% | ${r.victories}/1000 | ${prevStr} | ${rangeStr} |`
      }

      const md = `# 상성 개정 1단계 측정 게이트 결과

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**배포 금지 — 빌라드 검토 후 이든 전달**

---

## 실행 헤더

| 항목 | 값 |
|------|-----|
| 커밋 해시 | \`30bc6c9\` (동기 감쇠 적용 포함) |
| DONGGI_MULTIPLIER | \`0.85\` (paljajeonEngine.ts L313-314 확인) |
| 시드 | \`i*12345+7777\` (i=0..999, 프리셋당 1000판) |
| 총 판수 | 3000판 (목화 1000 + 금수 1000 + 토단일 1000) |
| 3프리셋 정의 | 목화(mok4·hwa4·to2·geum2·su2) / 금수(mok2·hwa2·to2·geum4·su4) / 토단일(mok1·hwa1·to14·geum2·su2) |
| mock 검증 | getFloorHp 함수 자체 교체(클로저 우회) — HP assert PASS: 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4} |
| 강제 장착 | 없음 — 정상 선택 진행 (지시문 기준) |

---

## 표: 3프리셋 클리어율 + 게이트 판정

| 프리셋 | 클리어율 | 클리어/총판 | 이전 비교 | 범위 판정 |
|--------|---------|-----------|---------|---------|
${results.map((r, i) => presetRow(r, prevRef[i])).join('\n')}

- **최고**: ${results.reduce((a, b) => a.clearRate > b.clearRate ? a : b).label} ${f1(Math.max(...clearRates))}%
- **최저**: ${results.reduce((a, b) => a.clearRate < b.clearRate ? a : b).label} ${f1(Math.min(...clearRates))}%
- **프리셋 간 격차**: ${f1(gap)}%p (기준 ≤15%p → **${gapPass ? 'PASS' : 'FAIL'}**)

---

## 분석: 편관 감소량 예상 vs 실측

### 배경 (지시문 기준)

- 동기 조우율: ~20% (선행 데이터)
- 피해 손실 예상: 약 3%p (동기 조우율 20% × 감쇠 15%)
- 예상 편관 감소: 3%p 수준 (클리어율 Δ 기준)

### 실측 분석

현재 측정에서 DONGGI_MULTIPLIER=0.85가 적용된 상태로 클리어율을 직접 측정했다.
이전 DONGGI_MULTIPLIER=1.0 기준 동일 조건(무가호, 동일 시드) 측정 데이터가 없으므로
클리어율 Δ를 직접 산출할 수 없다.

참조 수치 (가호 v2 게이트 B군 — 기본 2가호 포함 상태, 부정확한 비교):
- 목화 B군: 22.0% (기본 가호 포함 상태)
- 금수 B군: 27.4% (기본 가호 포함 상태)
- 토단일 B군: 26.6% (기본 가호 포함 상태)

현재 측정(무가호 기준)과 직접 비교 불가 — 조건 불일치.
단, 프리셋 클리어율이 게이트 기준(25~40%) 범위에 있는지가 핵심 판단 기준.

### 사문화 해결 여부

동기 감쇠(×0.85)는 글로벌 상성 조정으로 특정 가호를 타게팅하지 않는다.
가호 개별 효과(사문화 문제)는 이 측정으로 검증 불가 — 가호 v2 게이트(A/B 측정)가 별도 담당.

---

## 게이트 판정

| 채점 기준 | 기준값 | 실측값 | 판정 |
|----------|--------|--------|------|
| 전 프리셋 클리어율 범위 | 25~40% | 목화 ${f1(results[0].clearRate)}% / 금수 ${f1(results[1].clearRate)}% / 토단일 ${f1(results[2].clearRate)}% | **${rangePass ? 'PASS' : 'FAIL'}** |
| 프리셋 간 격차 | ≤15%p | ${f1(gap)}%p (최고 ${f1(maxRate)}% − 최저 ${f1(minRate)}%) | **${gapPass ? 'PASS' : 'FAIL'}** |

${rangeViolations.length > 0 ? `### 범위 위반 항목\n${rangeViolations.map(v => `- ${v}`).join('\n')}` : ''}

## ★ 게이트 종합 판정: **${gatePass ? 'PASS' : 'FAIL'}**

---

## C안 진입 필요 여부

${gatePass
  ? '★ PASS — C안 진입 불필요. 동기 감쇠(×0.85)만으로 게이트 기준 충족.'
  : `★ FAIL — **C안 진입 필요.**

위반 내역:
${rangeViolations.length > 0 ? `- 범위 위반 (${GATE_MIN}~${GATE_MAX}%): ${rangeViolations.join(', ')}` : ''}
${!gapPass ? `- 격차 위반 (≤${GATE_GAP_MAX}%p): 실측 ${f1(gap)}%p` : ''}

동기 감쇠 1단계 단독으로는 클리어율 재균형 불충분.
C안(가호별 타게팅 조정 또는 추가 밸런스 수단) 설계 및 이든 지시 요청 필요.`}

---

## 참고: 지시문 예상 결과 vs 실측

| 항목 | 지시문 예상 | 실측 |
|------|-----------|------|
| 편관 감소량 | 3%p 수준 (부족) | 직접 비교 불가 (이전 기준값 없음) |
| 사문화 해결 | 불가능 (글로벌 감쇠) | 이 측정 범위 외 |
| 게이트 통과 | FAIL 가능성 높음 | **${gatePass ? 'PASS' : 'FAIL'}** |

---

*이든에게 직접 보고 금지 — 빌라드 검토 후 전달.*
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[보고서] ${RESULT_PATH} 저장 완료`)

      // vitest assert (유령 측정 방지 + 완주 확인)
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
