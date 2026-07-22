// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * 가호 v2 밸런스 게이트 — 3000판 강제 A/B
 * 대상 커밋: 30bc6c9
 * 스펙 정본: docs/SPEC_gaho_v2.md
 *
 * 표 A: 가호 10종 × 3프리셋 순수 델타 매트릭스 (30셀)
 *   A군 = 첫 등장 시 강제 장착 (forceAcquire.kind='talisman')
 *   B군 = 해당 가호 배제 (activePassiveIds에서 제거)
 *   순수 델타 = A군 클리어율 − B군 클리어율
 *
 * 표 B: 시너지 상위 10조합 (C(10,2)=45조합)
 *   시너지 델타 = 조합 A클리어율 − (delta1 + delta2) 합산 기대치
 *
 * 필수 규격 (2026-07-18 이든):
 *   - getFloorHp: 함수 자체 mock (클로저 우회)
 *   - 측정 전 HP 실효값 assert 1건
 *   - 조건부 획득 델타 영구 금지 — 강제 A/B만
 *
 * 실행: cd paljapae && npx vitest run src/test/gahoV2BalanceGate3000.test.ts
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

// ─── 가호 10종 ID ─────────────────────────────────────────────────────────────
const GAHO_IDS = [
  'pyeonjae',   // 편재(偏財)
  'geoptae',    // 겁재(劫財)
  'sanggwan',   // 상관(傷官)
  'sikshin',    // 식신(食神)
  'bigyeon',    // 비견(比肩)
  'pyeongwan',  // 편관(偏官)
  'jeonggwan',  // 정관(正官)
  'pyeonin',    // 편인(偏印)
  'jeongjae',   // 정재(正財)
  'jeongin',    // 정인(正印)
] as const

const GAHO_NAMES: Record<string, string> = {
  pyeonjae:  '편재(偏財)',
  geoptae:   '겁재(劫財)',
  sanggwan:  '상관(傷官)',
  sikshin:   '식신(食神)',
  bigyeon:   '비견(比肩)',
  pyeongwan: '편관(偏官)',
  jeonggwan: '정관(正官)',
  pyeonin:   '편인(偏印)',
  jeongjae:  '정재(正財)',
  jeongin:   '정인(正印)',
}

// ─── 프리셋 3종 (v4SparsityRestore.test.ts 정본 미러링) ──────────────────────
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

const RUNS = 1000         // 프리셋당 1000판 × 3 = 3000판
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_GAHO_V2_3000_GATE_RESULT_20260719.md'

// ─── 단일 가호 × 단일 프리셋 강제 A/B 측정 ───────────────────────────────────
// A군: forceAcquire.kind='talisman' → activePassiveIds에 강제 포함
// B군: 해당 가호 activePassiveIds에서 완전 배제
// 순수 델타 = A군 클리어율 − B군 클리어율 (조건부 획득 금지)
function measureGahoAB(gahoId: string, preset: typeof PRESETS[0]): {
  clearRateA: number
  clearRateB: number
  pureDelta: number
} {
  const favorableElement = getFavorableElement(preset.ilgan)
  // selectTalismanBySaju가 반환하는 기본 2종 (사주 기반 자동 선택)
  const basePassiveIds = selectTalismanBySaju(preset.dist)

  let victoriesA = 0
  let victoriesB = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // A군: 해당 가호 강제 장착 (ForcedAcquireSpec kind='talisman')
    const aResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: basePassiveIds,
      forceAcquire: { kind: 'talisman', id: gahoId },
    })
    if (aResult.victory) victoriesA++

    // B군: 해당 가호 배제 (activePassiveIds에서 제거)
    const bPassiveIds = basePassiveIds.filter(id => id !== gahoId)
    const bResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: bPassiveIds,
    })
    if (bResult.victory) victoriesB++
  }

  const clearRateA = (victoriesA / RUNS) * 100
  const clearRateB = (victoriesB / RUNS) * 100
  const pureDelta = clearRateA - clearRateB

  return { clearRateA, clearRateB, pureDelta }
}

// ─── 2가호 조합 A/B 측정 (시너지 표 B용) ────────────────────────────────────
// A군: 두 가호 모두 강제 장착
// B군: 두 가호 모두 배제
function measurePairAB(id1: string, id2: string, preset: typeof PRESETS[0]): {
  clearRateA: number
  clearRateB: number
  pairDelta: number
} {
  const favorableElement = getFavorableElement(preset.ilgan)
  const basePassiveIds = selectTalismanBySaju(preset.dist)

  let victoriesA = 0
  let victoriesB = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // A군: 두 가호 모두 강제 장착 (첫 번째 forceAcquire + 두 번째 basePassiveIds에 포함)
    const aPassiveIds = Array.from(new Set([id1, id2, ...basePassiveIds]))
    const aResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: aPassiveIds,
    })
    if (aResult.victory) victoriesA++

    // B군: 두 가호 모두 배제
    const bPassiveIds = basePassiveIds.filter(id => id !== id1 && id !== id2)
    const bResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: bPassiveIds,
    })
    if (bResult.victory) victoriesB++
  }

  const clearRateA = (victoriesA / RUNS) * 100
  const clearRateB = (victoriesB / RUNS) * 100
  const pairDelta = clearRateA - clearRateB

  return { clearRateA, clearRateB, pairDelta }
}

// ─── C(n,2) 조합 생성기 ───────────────────────────────────────────────────────
function combinations2<T>(arr: T[]): [T, T][] {
  const result: [T, T][] = []
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      result.push([arr[i], arr[j]])
    }
  }
  return result
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe.skip('가호 v2 3000판 밸런스 게이트 (강제 A/B, 2026-07-19)', () => {
  it(
    '표 A(30셀) + 표 B(시너지 10조합) + 채점 판정',
    { timeout: 3600000 },  // 60분 타임아웃 (3000판 A/B + 45조합)
    () => {
      // ── HP 실효값 assert (유령 측정 방지 — 2026-07-18 이든 규격) ──────────────
      const hp1 = V4_FLOOR_HP_TABLE[1]
      const hp2 = V4_FLOOR_HP_TABLE[2]
      const hp3 = V4_FLOOR_HP_TABLE[3]
      const hp4 = V4_FLOOR_HP_TABLE[4]
      // 측정 시작 전 HP 실효값 assert
      expect(hp1).toBe(374)   // Math.round(220 * 1.70)
      expect(hp2).toBe(757)   // Math.round(445 * 1.70)
      expect(hp3).toBe(1156)  // Math.round(680 * 1.70)
      expect(hp4).toBe(680)   // 불변
      console.log(`\n[HP assert PASS] 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4}`)

      console.log('\n════════════════════════════════════════════════════════')
      console.log('가호 v2 3000판 밸런스 게이트 측정 시작')
      console.log(`시드: i*12345+7777 (i=0..999) / 프리셋: 목화·금수·토단일`)
      console.log(`강제 장착 코드 지점: simulateFullCapRun opts.forceAcquire.kind='talisman'`)
      console.log(`A군: forceAcquire{kind:'talisman', id} / B군: 해당 가호 activePassiveIds 배제`)
      console.log(`판수: 1000×2(A/B)×3프리셋×10가호 + 1000×2(A/B)×1프리셋(대표)×45조합`)
      console.log('════════════════════════════════════════════════════════')

      // ── 표 A 측정: 가호 10종 × 3프리셋 ──────────────────────────────────────
      // deltaTable[gahoId][presetLabel] = { clearRateA, clearRateB, pureDelta }
      type CellResult = { clearRateA: number; clearRateB: number; pureDelta: number }
      const deltaTable: Record<string, Record<string, CellResult>> = {}

      for (const gahoId of GAHO_IDS) {
        deltaTable[gahoId] = {}
        for (const preset of PRESETS) {
          console.log(`  [표A] ${GAHO_NAMES[gahoId]} × ${preset.label} 측정 중...`)
          const result = measureGahoAB(gahoId, preset)
          deltaTable[gahoId][preset.label] = result
          console.log(`    → A=${result.clearRateA.toFixed(1)}% / B=${result.clearRateB.toFixed(1)}% / Δ=${result.pureDelta.toFixed(1)}%p`)
        }
      }

      // ── 표 B 측정: 45조합 시너지 (대표 프리셋: 목화) ────────────────────────
      // 대표 프리셋은 목화 (가장 일반적인 분포)
      const REP_PRESET = PRESETS[0]  // 목화
      const pairs = combinations2([...GAHO_IDS])

      type SynergyResult = {
        id1: string
        id2: string
        pairDelta: number
        indivSum: number
        synergyDelta: number
        clearRateA: number
        clearRateB: number
      }
      const synergyResults: SynergyResult[] = []

      console.log('\n  [표B] 45조합 시너지 측정 시작 (대표 프리셋: 목화)...')
      for (const [id1, id2] of pairs) {
        console.log(`  [표B] ${GAHO_NAMES[id1]} + ${GAHO_NAMES[id2]} 측정 중...`)
        const pairRes = measurePairAB(id1, id2, REP_PRESET)

        // 개별 델타(목화 기준)
        const delta1 = deltaTable[id1][REP_PRESET.label].pureDelta
        const delta2 = deltaTable[id2][REP_PRESET.label].pureDelta
        const indivSum = delta1 + delta2
        const synergyDelta = pairRes.pairDelta - indivSum

        synergyResults.push({
          id1,
          id2,
          pairDelta: pairRes.pairDelta,
          indivSum,
          synergyDelta,
          clearRateA: pairRes.clearRateA,
          clearRateB: pairRes.clearRateB,
        })
        console.log(`    → 조합Δ=${pairRes.pairDelta.toFixed(1)}%p / 개별합=${indivSum.toFixed(1)}%p / 시너지Δ=${synergyDelta.toFixed(1)}%p`)
      }

      // 시너지 상위 10조합 정렬
      const top10Synergy = [...synergyResults].sort((a, b) => b.synergyDelta - a.synergyDelta).slice(0, 10)

      // ── 채점 ─────────────────────────────────────────────────────────────────
      // 기준 1: 전 프리셋 순수 델타 < 15 (과강 방지)
      // 기준 2: 1개 이상 프리셋 ≥ +5 (사문화 방지)
      const violations_overcap: string[] = []   // 기준 1 위반 (≥15)
      const violations_dead: string[] = []       // 기준 2 위반 (전 프리셋 <+5)

      for (const gahoId of GAHO_IDS) {
        const cells = PRESETS.map(p => deltaTable[gahoId][p.label])
        // 기준 1: 어느 프리셋이든 delta ≥ 15 이면 위반
        for (const preset of PRESETS) {
          const d = deltaTable[gahoId][preset.label].pureDelta
          if (d >= 15) {
            violations_overcap.push(`${GAHO_NAMES[gahoId]} (${preset.label}: Δ=${d.toFixed(1)}%p ≥ 15)`)
          }
        }
        // 기준 2: 모든 프리셋 delta < 5 이면 사문화 위반
        const hasMin5 = cells.some(c => c.pureDelta >= 5)
        if (!hasMin5) {
          violations_dead.push(`${GAHO_NAMES[gahoId]} (전 프리셋 Δ < +5: ${cells.map(c => c.pureDelta.toFixed(1)).join('/')})`)
        }
      }

      const gatePass = violations_overcap.length === 0 && violations_dead.length === 0

      console.log('\n════════════════════════════════════════════════════════')
      console.log(`채점 결과: ${gatePass ? 'PASS' : 'FAIL'}`)
      if (violations_overcap.length > 0) {
        console.log('[과강 위반]', violations_overcap)
      }
      if (violations_dead.length > 0) {
        console.log('[사문화 위반]', violations_dead)
      }
      console.log('════════════════════════════════════════════════════════')

      // ── 보고서 생성 ───────────────────────────────────────────────────────────
      const f1 = (n: number) => n.toFixed(1)
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      // 표 A 행 생성
      function tableARow(gahoId: string): string {
        const cells = PRESETS.map(p => {
          const c = deltaTable[gahoId][p.label]
          return `Δ${f1(c.pureDelta)} (A${f1(c.clearRateA)}/B${f1(c.clearRateB)})`
        })
        return `| ${GAHO_NAMES[gahoId].padEnd(10)} | ${cells[0].padEnd(32)} | ${cells[1].padEnd(32)} | ${cells[2].padEnd(32)} |`
      }

      // 표 B 행 생성
      function tableBRow(r: SynergyResult, rank: number): string {
        return `| ${rank} | ${GAHO_NAMES[r.id1]} | ${GAHO_NAMES[r.id2]} | ${f1(r.pairDelta)} | ${f1(r.indivSum)} | **${f1(r.synergyDelta)}** | ${f1(r.clearRateA)} | ${f1(r.clearRateB)} |`
      }

      const md = `# 가호 v2 3000판 밸런스 게이트 결과 — 2026-07-19

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**배포 금지 — 이든 판정 대기**

---

## 6줄 실측 헤더

| 항목 | 값 |
|------|-----|
| 커밋 해시 | \`30bc6c9\` |
| 시드 | \`i*12345+7777\` (i=0..999, 프리셋당 1000판) |
| 3프리셋 정의 | 목화(mok4·hwa4·to2·geum2·su2) / 금수(mok2·hwa2·to2·geum4·su4) / 토단일(mok1·hwa1·to14·geum2·su2) |
| 강제 장착 코드 지점 | \`simulateFullCapRun opts.forceAcquire = {kind:'talisman', id}\` → fullCapBot.ts:862 resolvedActivePassiveIds 오버라이드 |
| A/B 판수 | A군 1000판 + B군 1000판 = 2000판 × 3프리셋 × 10가호 (표A) + 2000판 × 1프리셋 × 45조합 (표B) |
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

## 표 A — 가호 10종 × 3프리셋 순수 델타 매트릭스 (30셀)

- **측정법**: 동일 시드 1000판 × A군(강제 장착) / B군(배제). 순수 델타 = A−B 클리어율.
- **표기**: Δ=순수델타 / A=A군 클리어율% / B=B군 클리어율%

| 가호 | 목화 프리셋 | 금수 프리셋 | 토단일 프리셋 |
|------|------------|------------|------------|
${GAHO_IDS.map(id => tableARow(id)).join('\n')}

---

## 표 B — 시너지 상위 10조합 (C(10,2)=45조합 중)

- **대표 프리셋**: 목화 (일반 분포 대표)
- **시너지 델타** = 조합 A클리어율−B클리어율 − (가호1 개별Δ + 가호2 개별Δ) 합산 기대치
- **양수 = 초가법성** (두 가호 동시 장착 시 각자 기여 합산보다 실제 효과가 더 큼)

| 순위 | 가호1 | 가호2 | 조합Δ(%p) | 개별합(%p) | 시너지Δ(%p) | A클리어율% | B클리어율% |
|------|------|------|-----------|-----------|-----------|----------|----------|
${top10Synergy.map((r, i) => tableBRow(r, i + 1)).join('\n')}

---

## 채점 판정 (이든 §2 기준)

| 채점 기준 | 기준값 | 판정 |
|----------|--------|------|
| 1. 전 프리셋 순수 델타 < 15 (과강 방지) | 모든 셀 Δ < 15 | **${violations_overcap.length === 0 ? 'PASS' : 'FAIL'}** |
| 2. 1개 이상 프리셋 ≥ +5 (사문화 방지) | 각 가호별 최소 1프리셋 Δ ≥ +5 | **${violations_dead.length === 0 ? 'PASS' : 'FAIL'}** |

${violations_overcap.length > 0 ? `### 과강 위반 (기준 1 — Δ ≥ 15)\n${violations_overcap.map(v => `- ${v}`).join('\n')}` : ''}
${violations_dead.length > 0 ? `### 사문화 위반 (기준 2 — 전 프리셋 Δ < +5)\n${violations_dead.map(v => `- ${v}`).join('\n')}` : ''}

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
      expect(synergyResults).toHaveLength(45)
      expect(top10Synergy).toHaveLength(10)
    },
  )
})
