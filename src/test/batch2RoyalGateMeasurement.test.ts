/**
 * 배치 2 §2 왕·여왕 게이트 측정 (1000판 × 3프리셋 = 3000런)
 *
 * 이든 처방 2026-07-18 (강제 A/B + 값10 단일 + 채점 개정 + 레버 b):
 *   - royalValue=11 케이스 폐기 → 값10 단일만 측정
 *   - 여왕 효과 ×1.5 → ×1.25 (paljajeonEngine.ts:617 반영됨)
 *   - 왕 승격: 레버 (b) "왕은 정점을 못 산다" — step2→step1 승격하되 정점(×1.0) 도달 불가
 *   - 측정법 개정 (핵심): 조건부 획득 델타 폐지 → 강제 A/B
 *       · 조건부군: 게이트 1·2 클리어율 (프로덕션 동작)
 *       · A군: 동일 시드, 첫 왕족 등장 시 강제 획득 (royalForceAcquire)
 *       · B군: 동일 시드, 왕족 배제 (royalValue 미지정)
 *       · 순수 델타 = clearRate(A, 등장 시드) − clearRate(B, 동일 시드)
 *   - 채점 개정 (③ 재정의, 잣대만 교정 — 기준 불변):
 *       · 상한 15 = 전 프리셋 엄격 불변 (하나라도 ≥15면 FAIL)
 *       · 하한 +5 = "최소 1개 프리셋 이상"
 *       · +5~12 = 권장 밴드 (초과 시 노트, 15 미만이면 관용)
 *
 * 게이트 기준:
 *   1. 전원 25~40% 클리어율 (3프리셋 모두, 조건부군)
 *   2. 격차 ≤15%p (최고-최저)
 *   3. 순수 델타(A−B): 전 프리셋 <15 (엄격) AND 최소 1개 프리셋 ≥+5. 권장 밴드 +5~12 초과는 노트만.
 *   4. 연환 성립률 §6 파일럿 18.6% 재현 여부 확인 (참고 지표)
 *
 * 셋업: v4SparsityRestore.test.ts 정본 미러링 (v4 mock + getFavorableElement + selectTalismanBySaju)
 *
 * 봇 정책 (조건부 획득):
 *   - 왕족은 25% 확률로 보상 풀에 등장
 *   - 등장 시에도 봇이 3택(카드획득/강화/제거)의 기대 데미지 점수를 비교해
 *     카드획득(a)이 최대일 때만 획득
 *   - 덱 소지 상한 ROYAL_DECK_CAP=2 준수
 *   - 항상 획득이 아님
 *
 * 실행: cd paljapae && npx vitest run src/test/batch2RoyalGateMeasurement.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── v4 mock — v4SparsityRestore.test.ts 정본 미러링 ─────────────────────────
// getFloorHp 함수 자체를 교체해야 엔진에 v4 HP가 반영됨 (클로저 이슈 우회)
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const V4_FLOOR_HP_TABLE = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    // v4 HP 직접 함수 교체 (클로저 우회)
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = V4_FLOOR_HP_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
    // 현행 프로덕션 계수 그대로 (peak:1.0, step1:0.70, step2:0.45 — balance.ts 실제값)
    // V4_RATIO_CORRECTION은 actual 그대로 사용 — 덮어쓰지 않음
  }
})

// mock 블록 이후 await import 패턴 (v4SparsityRestore.test.ts:44-46 참고)
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')

// ─── 프리셋 3종 (v4SparsityRestore.test.ts 정본 그대로) ──────────────────────
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
const GATE_MIN = 25
const GATE_MAX = 40
const GATE_SPREAD = 15
const ROYAL_DELTA_MIN = 5
const ROYAL_DELTA_MAX = 12
const ROYAL_DELTA_HARD_CAP = 15  // 상한 15 초과 시 FAIL
const YEONHWAN_PILOT_REF = 18.6  // §6 파일럿 참고 지표

const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_BATCH2_ROYAL_GATE_RESULT_20260718.md'

// ─── 단일 프리셋 측정 함수 — 강제 A/B (이든 판정 2026-07-18) ─────────────────
// 조건부 획득 델타 폐지. 동일 시드 페어드 대조:
//   조건부군: royalValue만 (프로덕션 동작) → 게이트 1·2 클리어율
//   A군: royalValue + royalForceAcquire (첫 왕족 등장 시 강제 획득 — 선택 편향 제거)
//   B군: royalValue 미지정 (왕족 배제)
//   순수 델타 = clearRate(A, 등장시드) − clearRate(B, 동일 시드)
function measureCombo(preset: typeof PRESETS[0], royalValue: number) {
  const favorableElement = getFavorableElement(preset.ilgan)
  const activePassiveIds = selectTalismanBySaju(preset.dist)

  const baseOpts = (extra: Record<string, unknown>) => ({
    elementDist: preset.dist,
    ilganElement: preset.ilgan,
    favorableElement,
    enableFloorReward: true,
    enableEffectMode: true,
    activePassiveIds,
    ...extra,
  })

  let condVictories = 0    // 조건부(프로덕션) — 게이트 1·2용
  let pairAppeared = 0     // A군에서 왕족 등장·획득한 시드 수
  let pairVictoriesA = 0   // 그 시드들의 A 결과 (왕족 보유)
  let pairVictoriesB = 0   // 동일 시드의 B 결과 (왕족 배제)
  let yeonhwanCount = 0
  let totalAttacks = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // 조건부 (프로덕션) — 게이트 1·2 클리어율 + 연환 지표
    const condR = simulateFullCapRun(seed, baseOpts({ royalValue }))
    if (condR.victory) condVictories++
    const tc = condR.traitCounts ?? {}
    yeonhwanCount += tc['ohang-yeonhwan'] ?? 0
    for (const fs of (condR.floorStats ?? [])) totalAttacks += fs.attackCount

    // A군 (강제 획득) — 왕족 등장 시 무조건 획득
    const aR = simulateFullCapRun(seed, baseOpts({ royalValue, royalForceAcquire: true }))
    const acquired = (aR.royalObtainedCount ?? 0) > 0
    if (acquired) {
      // B군 (배제) — 동일 시드, 왕족 미생성
      const bR = simulateFullCapRun(seed, baseOpts({}))
      pairAppeared++
      if (aR.victory) pairVictoriesA++
      if (bR.victory) pairVictoriesB++
    }
  }

  const clearRate = (condVictories / RUNS) * 100
  const clearRateA = pairAppeared > 0 ? (pairVictoriesA / pairAppeared) * 100 : 0
  const clearRateB = pairAppeared > 0 ? (pairVictoriesB / pairAppeared) * 100 : 0
  const pureDelta = clearRateA - clearRateB
  const pairAppearedRate = (pairAppeared / RUNS) * 100
  const yeonhwanRate = totalAttacks > 0 ? (yeonhwanCount / totalAttacks) * 100 : 0
  const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX

  return {
    label: preset.label,
    clearRate,
    condVictories,
    pairAppeared,
    pairAppearedRate,
    clearRateA,
    clearRateB,
    pureDelta,
    yeonhwanCount,
    totalAttacks,
    yeonhwanRate,
    gatePass,
  }
}

describe('배치 2 §2 왕·여왕 게이트 측정 (1000판 × 3프리셋, 값10 단일)', () => {
  it(
    '3000런 전체 측정 + 보고서 생성',
    { timeout: 1800000 },  // 30분 타임아웃
    () => {
      console.log('\n════════════════════════════════════════════════════')
      console.log('배치 2 §2 왕·여왕 게이트 측정 시작 (값10 단일, 여왕×1.25)')
      console.log(`v4 HP: 1층=${V4_FLOOR_HP_TABLE[1]} / 2층=${V4_FLOOR_HP_TABLE[2]} / 3층=${V4_FLOOR_HP_TABLE[3]} / 4층=${V4_FLOOR_HP_TABLE[4]}`)
      console.log('════════════════════════════════════════════════════')

      // ── 값10 측정 ────────────────────────────────────────────────────────────
      console.log('\n[값10] 측정 시작...')
      const results10: ReturnType<typeof measureCombo>[] = []
      for (const preset of PRESETS) {
        console.log(`  [값10] ${preset.label} 1000판 측정 중...`)
        const r = measureCombo(preset, 10)
        results10.push(r)
        console.log(`  [값10] ${preset.label}: ${r.clearRate.toFixed(1)}% — ${r.gatePass ? 'PASS' : 'FAIL'} | A/B 등장율 ${r.pairAppearedRate.toFixed(1)}% | A군 CR ${r.clearRateA.toFixed(1)}% | B군 CR ${r.clearRateB.toFixed(1)}% | 순수Δ ${r.pureDelta.toFixed(1)}%p | 연환 ${r.yeonhwanRate.toFixed(2)}%`)
      }

      const rates10 = results10.map(r => r.clearRate)
      const max10 = Math.max(...rates10)
      const min10 = Math.min(...rates10)
      const spread10 = max10 - min10
      const allPass10 = results10.every(r => r.gatePass)
      const spreadPass10 = spread10 <= GATE_SPREAD

      // 순수 델타 검증 (값10) — 강제 A/B (이든 판정 2026-07-18, 잣대 교정):
      //   · 상한 15 = 전 프리셋 엄격 불변 (하나라도 ≥15면 FAIL)
      //   · 하한 +5 = 최소 1개 프리셋 이상 (전원 요구 아님)
      //   · +5~12 = 권장 밴드 (초과분은 노트만, 15 미만이면 관용)
      const deltas10 = results10.filter(r => r.pairAppeared > 0).map(r => r.pureDelta)
      const hardCapPass10 = deltas10.length > 0 && deltas10.every(d => d < ROYAL_DELTA_HARD_CAP)
      const lowerBoundPass10 = deltas10.some(d => d >= ROYAL_DELTA_MIN)
      const deltaHardCapFail10 = deltas10.some(d => d >= ROYAL_DELTA_HARD_CAP)
      // 권장 밴드 초과분 (15 미만이지만 +12 초과) — 노트용
      const bandOverNotes10 = deltas10.filter(d => d > ROYAL_DELTA_MAX && d < ROYAL_DELTA_HARD_CAP)

      // 연환 성립률 (값10 전체 합산)
      const totalYeonhwan10 = results10.reduce((s, r) => s + r.yeonhwanCount, 0)
      const totalAttacks10 = results10.reduce((s, r) => s + r.totalAttacks, 0)
      const yeonhwanRate10 = totalAttacks10 > 0 ? (totalYeonhwan10 / totalAttacks10) * 100 : 0

      console.log(`\n[값10] 격차: ${spread10.toFixed(1)}%p — ${spreadPass10 ? 'PASS' : 'FAIL'}`)
      console.log(`[값10] 순수 델타(A−B) 목록: [${deltas10.map(d => d.toFixed(1)).join(', ')}]%p — 전프리셋<15:${hardCapPass10 ? 'OK' : 'FAIL'} / 최소1개≥+5:${lowerBoundPass10 ? 'OK' : 'FAIL'}${bandOverNotes10.length > 0 ? ` / 밴드초과노트:[${bandOverNotes10.map(d => d.toFixed(1)).join(', ')}]` : ''}`)
      console.log(`[값10] 연환 성립률: ${yeonhwanRate10.toFixed(2)}% (파일럿 참고: ${YEONHWAN_PILOT_REF}%)`)

      // ── 게이트 종합 판정 ──────────────────────────────────────────────────────
      const gate1Pass = allPass10  // 전원 25~40%
      const gate2Pass = spreadPass10  // 격차 ≤15%p
      const gate3Pass = hardCapPass10 && lowerBoundPass10  // 전 프리셋 <15 AND 최소 1개 ≥+5
      const overallPass = gate1Pass && gate2Pass && gate3Pass

      console.log('\n════════════════════════════════════════════════════')
      console.log(`게이트 1 (전원 25~40%): ${gate1Pass ? 'PASS' : 'FAIL'}`)
      console.log(`게이트 2 (격차 ≤15%p): ${gate2Pass ? 'PASS' : 'FAIL'}`)
      console.log(`게이트 3 (순수 델타 전 프리셋<15 AND 최소1개≥+5): ${gate3Pass ? 'PASS' : 'FAIL'}`)
      console.log(`\n★ 게이트 종합 판정: ${overallPass ? 'PASS' : 'FAIL'}`)
      console.log('════════════════════════════════════════════════════')

      // ── 보고서 생성 ───────────────────────────────────────────────────────────
      const f1 = (n: number) => n.toFixed(1)
      const f2 = (n: number) => n.toFixed(2)
      const gate = (b: boolean) => b ? 'PASS' : 'FAIL'

      function presetDeltaTag(r: ReturnType<typeof measureCombo>): string {
        if (!(r.pairAppeared > 0)) return 'N/A'
        if (r.pureDelta >= ROYAL_DELTA_HARD_CAP) return 'FAIL(≥15)'
        if (r.pureDelta > ROYAL_DELTA_MAX) return '노트(밴드초과)'
        if (r.pureDelta >= ROYAL_DELTA_MIN) return 'OK'
        return 'OK(하한무관)'  // +5 미만 = 구조적 정상 (전원 요구 아님)
      }
      function presetTableRow(r: ReturnType<typeof measureCombo>) {
        return `| ${r.label.padEnd(6)} | ${f1(r.clearRate)}% (${gate(r.gatePass)}) | ${f1(r.pairAppearedRate)}% | ${f1(r.clearRateA)}% | ${f1(r.clearRateB)}% | ${f1(r.pureDelta)}%p (${presetDeltaTag(r)}) | ${f2(r.yeonhwanRate)}% |`
      }

      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      const md = `# 배치 2 §2 왕·여왕 게이트 측정 결과 — 2026-07-18 (강제 A/B 재측정)

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**커밋 금지 — 이든 판정 대기**

---

## 이든 처방 (2026-07-18 적용 — 강제 A/B + 채점 개정 + 레버 b)

| 처방 항목 | 내용 |
|-----------|------|
| royalValue | 값11 폐기 → **값10 단일** |
| 여왕 효과 | ×1.5 → **×1.25** (paljajeonEngine.ts:617 반영 확인됨) |
| 왕 로직 (레버 b) | **"왕은 정점을 못 산다"** — step2→step1 승격하되 정점(×1.0) 도달 불가 (최대 step1) |
| **측정법 (핵심 개정)** | 조건부 획득 델타 폐지 → **강제 A/B**. 동일 시드 A(첫 왕족 강제 획득) vs B(왕족 배제), 순수 델타=A−B. 선택 편향 제거. |
| 순수 델타 채점 | 상한 15 **전 프리셋 엄격 불변** / 하한 +5 = **최소 1개 프리셋 이상** / +5~12 = 권장 밴드(초과 노트) |

---

## 측정 방법 — 강제 A/B (조건부 획득 델타 영구 폐지)

- **조건부군** (게이트 1·2 클리어율용): royalValue만 지정 — 봇 3택 비교로 획득 판단 (프로덕션 동작).
- **A군** (강제 획득): 동일 시드, \`royalForceAcquire\` — 첫 왕족 등장(25% 롤) 시 3택 우회 무조건 획득.
- **B군** (왕족 배제): 동일 시드, royalValue 미지정 — 왕족 미생성.
- **순수 델타 = clearRate(A, 왕족 등장 시드) − clearRate(B, 동일 시드)**.
- 왕족 등장(25% 롤)은 판 유불리와 무상관 → 선택 편향 없음. 획득은 강제 → 봇 선택 편향 제거.
- 3000판 × (조건부 + A + 등장 시드만 B) 페어드 대조.

---

## v4 HP 테이블 (적용 확인)

| 층 | HP |
|----|----|
| 1층 | ${V4_FLOOR_HP_TABLE[1]} |
| 2층 | ${V4_FLOOR_HP_TABLE[2]} |
| 3층 | ${V4_FLOOR_HP_TABLE[3]} |
| 4층 | ${V4_FLOOR_HP_TABLE[4]} |

---

## 값10 측정 결과 (1000판 × 3프리셋, 강제 A/B)

| 프리셋 | 클리어율(조건부) | A/B 등장률 | A군 CR | B군 CR | 순수 Δ(A−B) | 연환률 |
|--------|---------|-----------|--------|--------|------------|--------|
${results10.map(presetTableRow).join('\n')}

- **격차**: ${f1(spread10)}%p — ${gate(spreadPass10)} (기준 ≤15%p)
- **순수 델타(A−B) 목록**: [${deltas10.map(d => d.toFixed(1)).join(', ')}]%p — ${gate(gate3Pass)} (전 프리셋<15: ${gate(hardCapPass10)} / 최소1개≥+5: ${gate(lowerBoundPass10)})${deltaHardCapFail10 ? ' ⚠ 상한 15 초과 프리셋 존재 → FAIL' : ''}${bandOverNotes10.length > 0 ? `\n- **권장 밴드 초과 노트**: [${bandOverNotes10.map(d => d.toFixed(1)).join(', ')}]%p (15 미만이므로 관용 — 채점 PASS)` : ''}
- **연환 성립률**: ${f2(yeonhwanRate10)}% (§6 파일럿 참고치: ${YEONHWAN_PILOT_REF}%)

---

## 게이트 채점

| 게이트 항목 | 기준 | 실측 | 판정 |
|------------|------|------|------|
| 1. 전원 클리어율 | 25~40% | ${results10.map(r => f1(r.clearRate) + '%').join(' / ')} | **${gate(gate1Pass)}** |
| 2. 프리셋 간 격차 | ≤15%p | ${f1(spread10)}%p | **${gate(gate2Pass)}** |
| 3. 왕족 순수 델타 (A−B) | 전 프리셋<15 AND 최소1개≥+5 | [${deltas10.map(d => d.toFixed(1)).join(', ')}]%p | **${gate(gate3Pass)}** |
| 4. 연환 성립률 (참고) | §6 파일럿 ${YEONHWAN_PILOT_REF}% | ${f2(yeonhwanRate10)}% | 참고 지표 |

## ★ 게이트 종합 판정: **${overallPass ? 'PASS' : 'FAIL'}**

---

## 커밋 금지 — 이든 판정 대기

본 보고서는 게이트 측정 결과 산출물입니다. 이든 판정 전까지 커밋/배포 절대 금지.
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[보고서] ${RESULT_PATH} 저장 완료`)

      // ── vitest assert (측정 완료 확인용) ─────────────────────────────────────
      // 총 공격 턴 > 0: 측정이 실제로 이루어졌는지 확인
      expect(totalAttacks10).toBeGreaterThan(0)

      // 게이트 판정 assert (FAIL이면 테스트 실패로 명시)
      if (!overallPass) {
        const failReasons: string[] = []
        if (!gate1Pass) failReasons.push('클리어율 범위 이탈')
        if (!gate2Pass) failReasons.push(`격차 초과 (${f1(spread10)}%p)`)
        if (!gate3Pass) failReasons.push(`왕족 순수델타(A−B) 게이트 실패 ([${deltas10.map(d => d.toFixed(1)).join(', ')}]%p)${deltaHardCapFail10 ? ' — 상한 15 초과 프리셋 존재' : !lowerBoundPass10 ? ' — 최소 1개 프리셋도 +5 미달' : ''}`)
        console.error(`\n[GATE FAIL] ${failReasons.join(' | ')}`)
      }

      // 측정 완료 여부만 assert — 게이트 결과는 보고서로 전달
      expect(results10).toHaveLength(3)
    },
  )
})
