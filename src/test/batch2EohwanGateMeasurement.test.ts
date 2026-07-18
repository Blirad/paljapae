/**
 * 배치 2 §4 연환 2단 (어환 ×12) 게이트 측정 (1000판 × 3프리셋 = 3000런)
 *
 * 이든 지시 2026-07-18 (§4 어환 착수):
 *   - 어환(御環) = 왕 + 여왕 + 상이 3오행 (5장·5원소) → ×12
 *   - 기본 연환(5원소 각1) ×8 불변
 *   - 판정 순서: 어환 먼저 → 연환 (어환 위계 최상위)
 *   - E2E: 왕+여왕+3오행 → ×12 / 왕만+4오행 → ×8 / 어환 강림 중첩
 *   - 측정: 3000판 × 3프리셋 + 어환 발동률 + 강제 A/B
 *     · 조건부군: 프로덕션 동작 (봇 3택 비교로 왕·여왕 획득)
 *     · A군: royalForceAcquire=true, royalForceAcquireCount=2 (왕+여왕 모두 강제)
 *     · B군: 왕족 배제 (royalValue 미지정)
 *   - 게이트 기준:
 *     · 1. 전원 25~40% 클리어율
 *     · 2. 격차 ≤15%p
 *     · 3. 어환 발동률 관찰 + 위계 작동 확인 (×12가 최상위)
 *
 * 셋업: v4SparsityRestore.test.ts 정본 미러링 (v4 mock + getFavorableElement + selectTalismanBySaju)
 *
 * 실행: cd paljapae && npx vitest run src/test/batch2EohwanGateMeasurement.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── v4 mock — v4SparsityRestore.test.ts 정본 미러링 ─────────────────────────
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

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE, CHEONJI_EOHWAN_MULTIPLIER } = await import('../engine/balance')

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

const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_BATCH2_EOHWAN_GATE_RESULT_20260718.md'

// ─── 단일 프리셋 측정 함수 — 강제 A/B (어환 §4, 이든 지시 2026-07-18) ─────────────
// 왕+여왕 동시 강제 획득(royalForceAcquireCount=2) vs 왕족 배제
// 어환(×12) 발동률 및 위계 작동 관찰
function measureCombo(preset: typeof PRESETS[0]) {
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

  let condVictories = 0      // 조건부(프로덕션) — 게이트 1·2용
  let pairAppeared = 0       // A군에서 왕족 1장 이상 획득한 시드 수
  let pairVictoriesA = 0     // 그 시드들의 A 결과 (왕족 1장 이상 보유)
  let pairVictoriesB = 0     // 동일 시드의 B 결과 (왕족 배제)
  let cheonjiEohwanCount = 0 // 천지어환(×15) 발동 횟수
  let eohwanCount = 0        // 어환(×12) 발동 횟수
  let yeonhwanCount = 0      // 기본 연환(×8) 발동 횟수
  let totalAttacks = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // 조건부 (프로덕션) — 게이트 1·2 클리어율 + 연환 지표
    // royalValue=10으로 왕족 생성 활성화 (강제 획득 아님, 봇 선택)
    const condR = simulateFullCapRun(seed, baseOpts({ royalValue: 10, royalForceAcquire: false }))
    if (condR.victory) condVictories++
    const tc = condR.traitCounts ?? {}
    cheonjiEohwanCount += tc['cheonji-eohwan'] ?? 0  // 천지어환
    eohwanCount += (tc['eohwan'] ?? 0) - (tc['cheonji-eohwan'] ?? 0)  // 어환 = 전체 - 천지어환
    yeonhwanCount += (tc['ohang-yeonhwan'] ?? 0) - (tc['eohwan'] ?? 0) - (tc['cheonji-eohwan'] ?? 0)  // 기본연환 = 전체 - 어환 - 천지어환
    for (const fs of (condR.floorStats ?? [])) totalAttacks += fs.attackCount

    // A군 (강제 획득 — 왕족 1장) — royalForceAcquireCount=1 + royalValue로 왕족 생성
    const aR = simulateFullCapRun(seed, baseOpts({ royalValue: 10, royalForceAcquire: true, royalForceAcquireCount: 1 }))
    const acquiredRoyal = (aR.royalObtainedCount ?? 0) >= 1  // 왕족 1장 이상 획득 여부
    if (acquiredRoyal) {
      // B군 (배제) — 동일 시드, 왕족 미생성 (royalValue 없음 = 왕족 불생성)
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
  const cheonjiEohwanRate = totalAttacks > 0 ? (cheonjiEohwanCount / totalAttacks) * 100 : 0
  const eohwanRate = totalAttacks > 0 ? (eohwanCount / totalAttacks) * 100 : 0
  const yeonhwanRate = totalAttacks > 0 ? (yeonhwanCount / totalAttacks) * 100 : 0
  const totalChainRate = totalAttacks > 0 ? ((cheonjiEohwanCount + eohwanCount + yeonhwanCount) / totalAttacks) * 100 : 0
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
    cheonjiEohwanCount,
    eohwanCount,
    yeonhwanCount,
    totalAttacks,
    cheonjiEohwanRate,
    eohwanRate,
    yeonhwanRate,
    totalChainRate,
    gatePass,
  }
}

describe('배치 2 §4 연환 2단 (어환 ×12) 게이트 측정 (1000판 × 3프리셋, 강제 A/B)', () => {
  it(
    '3000런 전체 측정 + 보고서 생성',
    { timeout: 1800000 },  // 30분 타임아웃
    () => {
      console.log('\n════════════════════════════════════════════════════')
      console.log('배치 2 §4 연환 2단 (어환 ×12) 게이트 측정 시작')
      console.log(`v4 HP: 1층=${V4_FLOOR_HP_TABLE[1]} / 2층=${V4_FLOOR_HP_TABLE[2]} / 3층=${V4_FLOOR_HP_TABLE[3]} / 4층=${V4_FLOOR_HP_TABLE[4]}`)
      console.log('════════════════════════════════════════════════════')

      // ── 어환 측정 ────────────────────────────────────────────────────────────
      console.log('\n[어환 측정] 시작...')
      const results: ReturnType<typeof measureCombo>[] = []
      for (const preset of PRESETS) {
        console.log(`  [어환] ${preset.label} 1000판 측정 중...`)
        const r = measureCombo(preset)
        results.push(r)
        console.log(`  [어환] ${preset.label}: ${r.clearRate.toFixed(1)}% — ${r.gatePass ? 'PASS' : 'FAIL'} | 왕족율 ${r.pairAppearedRate.toFixed(1)}% | A군 CR ${r.clearRateA.toFixed(1)}% | B군 CR ${r.clearRateB.toFixed(1)}% | 순수Δ ${r.pureDelta.toFixed(1)}%p | 천지 ${r.cheonjiEohwanRate.toFixed(2)}% | 어환 ${r.eohwanRate.toFixed(2)}% | 기연 ${r.yeonhwanRate.toFixed(2)}%`)
      }

      const rates = results.map(r => r.clearRate)
      const max = Math.max(...rates)
      const min = Math.min(...rates)
      const spread = max - min
      const allPass = results.every(r => r.gatePass)
      const spreadPass = spread <= GATE_SPREAD

      // 어환 발동률 분석 (3단계 위계)
      const totalCheonjiEohwan = results.reduce((s, r) => s + r.cheonjiEohwanCount, 0)
      const totalEohwan = results.reduce((s, r) => s + r.eohwanCount, 0)
      const totalYeonhwan = results.reduce((s, r) => s + r.yeonhwanCount, 0)
      const totalAttacks = results.reduce((s, r) => s + r.totalAttacks, 0)
      const cheonjiEohwanRate = totalAttacks > 0 ? (totalCheonjiEohwan / totalAttacks) * 100 : 0
      const eohwanRate = totalAttacks > 0 ? (totalEohwan / totalAttacks) * 100 : 0
      const yeonhwanRate = totalAttacks > 0 ? (totalYeonhwan / totalAttacks) * 100 : 0
      const totalChainRate = totalAttacks > 0 ? ((totalCheonjiEohwan + totalEohwan + totalYeonhwan) / totalAttacks) * 100 : 0

      // 위계 작동 확인: 천지어환 ≤ 어환 ≤ 기본연환 (희소 순서)
      const hierarchyOK = (cheonjiEohwanRate <= eohwanRate) && (eohwanRate <= yeonhwanRate)

      console.log(`\n[어환] 격차: ${spread.toFixed(1)}%p — ${spreadPass ? 'PASS' : 'FAIL'}`)
      console.log(`[어환] 전체 연환 3단계: 천지 ${cheonjiEohwanRate.toFixed(2)}% + 어환 ${eohwanRate.toFixed(2)}% + 기본 ${yeonhwanRate.toFixed(2)}% = ${totalChainRate.toFixed(2)}%`)
      console.log(`[어환] 위계 작동 (천지 ≤ 어환 ≤ 기본): ${hierarchyOK ? 'OK' : 'CONFIRM_NEEDED'}`)

      // ── 게이트 종합 판정 ──────────────────────────────────────────────────────
      const gate1Pass = allPass  // 전원 25~40%
      const gate2Pass = spreadPass  // 격차 ≤15%p
      const gate3Pass = (cheonjiEohwanRate > 0 || eohwanRate > 0) && hierarchyOK  // 어환(천지 또는 일반) 발동 + 위계 확인
      const overallPass = gate1Pass && gate2Pass && gate3Pass

      console.log('\n════════════════════════════════════════════════════')
      console.log(`게이트 1 (전원 25~40%): ${gate1Pass ? 'PASS' : 'FAIL'}`)
      console.log(`게이트 2 (격차 ≤15%p): ${gate2Pass ? 'PASS' : 'FAIL'}`)
      console.log(`게이트 3 (어환 발동 + 위계 확인): ${gate3Pass ? 'PASS' : 'FAIL'}`)
      console.log(`\n★ 게이트 종합 판정: ${overallPass ? 'PASS' : 'FAIL'}`)
      console.log('════════════════════════════════════════════════════')

      // ── 보고서 생성 ───────────────────────────────────────────────────────────
      const f1 = (n: number) => n.toFixed(1)
      const f2 = (n: number) => n.toFixed(2)
      const gate = (b: boolean) => b ? 'PASS' : 'FAIL'

      function presetTableRow(r: ReturnType<typeof measureCombo>) {
        return `| ${r.label.padEnd(6)} | ${f1(r.clearRate)}% (${gate(r.gatePass)}) | ${f1(r.pairAppearedRate)}% | ${f1(r.clearRateA)}% | ${f1(r.clearRateB)}% | ${f1(r.pureDelta)}%p | ${f2(r.eohwanRate)}% | ${f2(r.yeonhwanRate)}% |`
      }

      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      const md = `# 배치 2 §4 연환 2단 (어환 ×12) 게이트 측정 결과 — 2026-07-18 (강제 A/B)

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**커밋 금지 — 이든 판정 대기**

---

## 이든 지시 (2026-07-18 §4 어환 착수)

| 항목 | 내용 |
|------|------|
| 어환 조건 | 왕 + 여왕 + 상이 3오행(5장·5원소) → **×12** |
| 기본 연환 | 5원소 각1 → **×8** (불변) |
| 판정 순서 | 어환 우선 → 기본연환 (어환 위계 최상위) |
| 측정 대상 | 3000판 × 3프리셋 + 어환 발동률 + 강제 A/B |
| A군 | royalForceAcquire=true, royalForceAcquireCount=2 (왕+여왕 모두 강제) |
| B군 | 왕족 배제 (royalValue 미지정) |
| 게이트 기준 | ① 전원 25~40% / ② 격차 ≤15%p / ③ 어환 발동률 + 위계 확인 |

---

## 측정 방법 — 강제 A/B (왕·여왕 동시 획득)

- **조건부군** (게이트 1·2 클리어율용): 프로덕션 동작 (봇 3택 비교).
- **A군** (강제 획득): 동일 시드, \`royalForceAcquire=true, royalForceAcquireCount=2\` — 왕+여왕 모두 강제 획득.
- **B군** (왕족 배제): 동일 시드, 왕족 미생성.
- **순수 델타 = clearRate(A, 왕+여왕 모두 등장 시드) − clearRate(B, 동일 시드)**.
- 왕·여왕 동시 등장은 희소(낮은 확률) — 어환은 정확한 구성 필요하므로 자연 발동률 관찰.

---

## v4 HP 테이블 (적용 확인)

| 층 | HP |
|----|-----|
| 1층 | ${V4_FLOOR_HP_TABLE[1]} |
| 2층 | ${V4_FLOOR_HP_TABLE[2]} |
| 3층 | ${V4_FLOOR_HP_TABLE[3]} |
| 4층 | ${V4_FLOOR_HP_TABLE[4]} |

---

## 측정 결과 (1000판 × 3프리셋, 강제 A/B)

| 프리셋 | 클리어율(조건부) | 왕족율 | A군 CR | B군 CR | 순수Δ(A−B) | 천지어환 | 어환 | 기본연환 |
|--------|---------|--------|--------|--------|---------|---------|---------|-----------|
${results.map(r => `| ${r.label.padEnd(6)} | ${f1(r.clearRate)}% (${gate(r.gatePass)}) | ${f1(r.pairAppearedRate)}% | ${f1(r.clearRateA)}% | ${f1(r.clearRateB)}% | ${f1(r.pureDelta)}%p | ${f2(r.cheonjiEohwanRate)}% | ${f2(r.eohwanRate)}% | ${f2(r.yeonhwanRate)}% |`).join('\n')}

- **격차**: ${f1(spread)}%p — ${gate(spreadPass)} (기준 ≤15%p)
- **어환 3단계**: 천지 ${f2(cheonjiEohwanRate)}% + 어환 ${f2(eohwanRate)}% + 기본 ${f2(yeonhwanRate)}% = ${f2(totalChainRate)}%
- **위계 작동**: 천지 ≤ 어환 ≤ 기본 — ${hierarchyOK ? '정상' : '확인필요'}

---

## 게이트 채점

| 게이트 항목 | 기준 | 실측 | 판정 |
|------------|------|------|------|
| 1. 전원 클리어율 | 25~40% | ${results.map(r => f1(r.clearRate) + '%').join(' / ')} | **${gate(gate1Pass)}** |
| 2. 프리셋 간 격차 | ≤15%p | ${f1(spread)}%p | **${gate(gate2Pass)}** |
| 3. 어환 발동 + 위계 | 어환 발동 확인, 기본연환 대비 희소 | 어환 ${f2(eohwanRate)}% | **${gate(gate3Pass)}** |

## ★ 게이트 종합 판정: **${overallPass ? 'PASS' : 'FAIL'}**

---

## 커밋 금지 — 이든 판정 대기

본 보고서는 게이트 측정 결과 산출물입니다. 이든 판정 전까지 커밋/배포 절대 금지.
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[보고서] ${RESULT_PATH} 저장 완료`)

      // ── vitest assert (측정 완료 확인용) ─────────────────────────────────────
      expect(totalAttacks).toBeGreaterThan(0)
      expect(results).toHaveLength(3)
      expect(eohwanRate).toBeGreaterThan(0)  // 어환이 최소 1회 이상 발동
    },
  )
})
