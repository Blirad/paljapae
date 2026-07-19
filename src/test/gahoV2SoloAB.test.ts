/**
 * 가호 v2 단독 장착 A/B 재측정 — solo_ab 모드
 * 커밋: 0c34738 (편관 턴당 1회 발동 제한 수정 후)
 *
 * 이전 3000판 게이트에서 편관 Δ49~56 과강 판정.
 * 편관 "턴당 1회" 제한 코드 수정 후 순수 기여도 재측정.
 *
 * 설계 (이든 §1-2단계 solo_ab):
 *   A군: 해당 가호 1개만 강제 장착 (activePassiveIds = [gahoId] 단독)
 *   B군: 가호 0개 (activePassiveIds = [] 완전 기준선)
 *   동일 조건: 시드 i*12345+7777, 2000판 × 3프리셋 × 10종
 *
 * 채점 기준 (§4 규격):
 *   ✓ 단독 델타 < 15%p (편관 과강 여부 판정)
 *   ✓ 3프리셋 중 1개 이상 ≥+5%p (사문화 방지)
 *   ✓ 감소 가호 0종 (음수 델타 금지)
 *
 * 산출: ZERA_PALJAJEON_GAHO_V2_SOLO_TABLE_RESULT_20260719.md
 *
 * 실행: cd paljapae && npx vitest run src/test/gahoV2SoloAB.test.ts
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
const { simulateFullCapRun } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')

// ─── 가호 10종 ID (정본 명칭, passive.ts 기준) ────────────────────────────────
const GAHO_IDS = [
  'sikshin',    // 식신(食神)
  'bigyeon',    // 비견(比肩)
  'geoptae',    // 겁재(劫財)
  'sanggwan',   // 상관(傷官)
  'pyeonjae',   // 편재(偏財)
  'jeongjae',   // 정재(正財)
  'pyeonin',    // 편인(偏印)
  'pyeongwan',  // 편관(偏官) — 턴당 1회 제한 수정 대상 (커밋 0c34738)
  'jeonggwan',  // 정관(正官)
  'jeongin',    // 정인(正印)
] as const

const GAHO_NAMES: Record<string, string> = {
  sikshin:   '식신(食神)',
  bigyeon:   '비견(比肩)',
  geoptae:   '겁재(劫財)',
  sanggwan:  '상관(傷官)',
  pyeonjae:  '편재(偏財)',
  jeongjae:  '정재(正財)',
  pyeonin:   '편인(偏印)',
  pyeongwan: '편관(偏官)',
  jeonggwan: '정관(正官)',
  jeongin:   '정인(正印)',
}

// ─── 프리셋 3종 ────────────────────────────────────────────────────────────────
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

const RUNS = 2000  // 프리셋당 2000판 (이든 지시: 2000판 × 3프리셋 × 10종)
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_GAHO_V2_SOLO_TABLE_RESULT_20260719.md'

// ─── solo_ab 측정 함수 ─────────────────────────────────────────────────────────
// A군: activePassiveIds = [gahoId] (해당 가호 1개만)
// B군: activePassiveIds = []       (가호 0개, 완전 기준선)
// selectTalismanBySaju 미사용 — 순수 단독 기여도 측정
function measureSoloAB(gahoId: string, preset: typeof PRESETS[0]): {
  clearRateA: number
  clearRateB: number
  pureDelta: number
} {
  const favorableElement = getFavorableElement(preset.ilgan)

  let victoriesA = 0
  let victoriesB = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // A군: 해당 가호 1개만 단독 장착
    const aResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: [gahoId],
    })
    if (aResult.victory) victoriesA++

    // B군: 가호 0개 (완전 기준선)
    const bResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: [],
    })
    if (bResult.victory) victoriesB++
  }

  const clearRateA = (victoriesA / RUNS) * 100
  const clearRateB = (victoriesB / RUNS) * 100
  const pureDelta = clearRateA - clearRateB

  return { clearRateA, clearRateB, pureDelta }
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe('가호 v2 단독 A/B 재측정 — solo_ab (편관 수정 후, 2026-07-19)', () => {
  it(
    '10종 × 3프리셋 단독 델타 표 + 채점 (편관 Δ 추이 확인)',
    { timeout: 3600000 },  // 60분 타임아웃
    () => {
      // ── HP 실효값 assert (유령 측정 방지 — 2026-07-18 이든 규격) ──────────────
      const hp1 = V4_FLOOR_HP_TABLE[1]
      const hp2 = V4_FLOOR_HP_TABLE[2]
      const hp3 = V4_FLOOR_HP_TABLE[3]
      const hp4 = V4_FLOOR_HP_TABLE[4]
      expect(hp1).toBe(374)   // Math.round(220 × 1.70)
      expect(hp2).toBe(757)   // Math.round(445 × 1.70)
      expect(hp3).toBe(1156)  // Math.round(680 × 1.70)
      expect(hp4).toBe(680)   // 불변
      console.log(`\n[HP assert PASS] 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4}`)

      console.log('\n════════════════════════════════════════════════════════')
      console.log('가호 v2 단독 A/B 재측정 (solo_ab 모드, 편관 수정 후)')
      console.log('커밋: 0c34738 — 편관 턴당 1회 발동 제한 추가')
      console.log(`시드: i*12345+7777 (i=0..1999) / 프리셋: 목화·금수·토단일`)
      console.log('A군: activePassiveIds=[gahoId] (단독 1개) / B군: [] (0개, 기준선)')
      console.log(`판수: 2000×2(A/B)×3프리셋×10가호 = 120,000판`)
      console.log('════════════════════════════════════════════════════════')

      // ── 측정 실행 ─────────────────────────────────────────────────────────────
      type CellResult = { clearRateA: number; clearRateB: number; pureDelta: number }
      const deltaTable: Record<string, Record<string, CellResult>> = {}

      for (const gahoId of GAHO_IDS) {
        deltaTable[gahoId] = {}
        for (const preset of PRESETS) {
          console.log(`  [측정] ${GAHO_NAMES[gahoId]} × ${preset.label}...`)
          const result = measureSoloAB(gahoId, preset)
          deltaTable[gahoId][preset.label] = result
          const tag = gahoId === 'pyeongwan' ? ' ← 편관 (핵심 추이)' : ''
          console.log(`    → A=${result.clearRateA.toFixed(1)}% / B=${result.clearRateB.toFixed(1)}% / Δ=${result.pureDelta.toFixed(1)}%p${tag}`)
        }
      }

      // ── 채점 ─────────────────────────────────────────────────────────────────
      // 기준 1: 단독 델타 < 15%p (과강 방지)
      // 기준 2: 3프리셋 중 1개 이상 ≥+5%p (사문화 방지)
      // 기준 3: 감소 가호 0종 (전 프리셋 음수 금지)
      const violations_overcap: string[] = []   // 기준 1 위반 (≥15)
      const violations_dead: string[] = []       // 기준 2 위반 (전 프리셋 <+5)
      const violations_negative: string[] = []   // 기준 3 위반 (전 프리셋 음수)

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
        // 기준 3: 전 프리셋 음수 (감소 가호)
        const allNeg = cells.every(c => c.pureDelta < 0)
        if (allNeg) {
          violations_negative.push(`${GAHO_NAMES[gahoId]} (전 프리셋 음수: ${cells.map(c => c.pureDelta.toFixed(1)).join('/')})`)
        }
      }

      const gatePass = violations_overcap.length === 0 && violations_dead.length === 0 && violations_negative.length === 0

      // 편관 추이 별도 로그
      const pyeongwanCells = PRESETS.map(p => deltaTable['pyeongwan'][p.label])
      console.log('\n────────────────────────────────────────────────────────')
      console.log('[편관 Δ 추이 핵심 확인]')
      console.log(`  이전 (30bc6c9, 수정 전): 목화=51.8 / 금수=49.0 / 토단일=56.2`)
      console.log(`  현재 (0c34738, 수정 후): 목화=${pyeongwanCells[0].pureDelta.toFixed(1)} / 금수=${pyeongwanCells[1].pureDelta.toFixed(1)} / 토단일=${pyeongwanCells[2].pureDelta.toFixed(1)}`)
      const maxDelta = Math.max(...pyeongwanCells.map(c => c.pureDelta))
      if (maxDelta < 15) {
        console.log(`  판정: Δ${maxDelta.toFixed(1)} < 15 → 편관 코드 결함이 과강의 전부였음 (수정 완료)`)
      } else {
        console.log(`  판정: Δ${maxDelta.toFixed(1)} ≥ 15 → "15% 문턱" 자체 재조정 필요 (다음 게이트)`)
      }
      console.log('────────────────────────────────────────────────────────')

      console.log('\n════════════════════════════════════════════════════════')
      console.log(`채점 결과: ${gatePass ? 'PASS' : 'FAIL'}`)
      if (violations_overcap.length > 0) console.log('[과강 위반]', violations_overcap)
      if (violations_dead.length > 0) console.log('[사문화 위반]', violations_dead)
      if (violations_negative.length > 0) console.log('[감소 위반]', violations_negative)
      console.log('════════════════════════════════════════════════════════')

      // ── 보고서 생성 ───────────────────────────────────────────────────────────
      const f1 = (n: number) => n.toFixed(1)
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      function tableRow(gahoId: string): string {
        const cells = PRESETS.map(p => {
          const c = deltaTable[gahoId][p.label]
          const overcap = c.pureDelta >= 15 ? ' **OVER**' : ''
          return `Δ${f1(c.pureDelta)}${overcap} (A${f1(c.clearRateA)}/B${f1(c.clearRateB)})`
        })
        const name = GAHO_NAMES[gahoId].padEnd(10)
        return `| ${name} | ${cells[0].padEnd(36)} | ${cells[1].padEnd(36)} | ${cells[2].padEnd(36)} |`
      }

      // 편관 이전/현재 비교
      const pw = pyeongwanCells
      const pyeongwanCompare = [
        `| 편관(偏官) | 이전(30bc6c9) | Δ51.8 (A73.8/B22.0) | Δ49.0 (A76.4/B27.4) | Δ56.2 (A82.8/B26.6) |`,
        `| 편관(偏官) | 현재(0c34738) | Δ${f1(pw[0].pureDelta)} (A${f1(pw[0].clearRateA)}/B${f1(pw[0].clearRateB)}) | Δ${f1(pw[1].pureDelta)} (A${f1(pw[1].clearRateA)}/B${f1(pw[1].clearRateB)}) | Δ${f1(pw[2].pureDelta)} (A${f1(pw[2].clearRateA)}/B${f1(pw[2].clearRateB)}) |`,
      ].join('\n')

      // 이든 판정 기준
      const maxPwDelta = Math.max(...pw.map(c => c.pureDelta))
      const edenJudgeLine = maxPwDelta < 15
        ? `Δ${maxPwDelta.toFixed(1)} < 15 → **편관 코드 결함이 과강의 전부** (수정 완료, 이든 §1 판정 기준 A)`
        : `Δ${maxPwDelta.toFixed(1)} ≥ 15 → **"15% 문턱" 자체 재조정 필요** (다음 게이트, 이든 §1 판정 기준 B)`

      const md = `# 가호 v2 단독 A/B 재측정 결과 (solo_ab) — 2026-07-19

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**배포 금지 — 이든 판정 대기**

---

## 6줄 실측 헤더

| 항목 | 값 |
|------|-----|
| 커밋 해시 | \`0c34738\` (편관 턴당 1회 발동 제한 수정) |
| 시드 | \`i*12345+7777\` (i=0..1999, 프리셋당 2000판) |
| 3프리셋 정의 | 목화(mok4·hwa4·to2·geum2·su2) / 금수(mok2·hwa2·to2·geum4·su4) / 토단일(mok1·hwa1·to14·geum2·su2) |
| 측정 모드 | solo_ab — A군: activePassiveIds=[gahoId] (단독 1개) / B군: [] (0개, 완전 기준선) |
| 판수 | 2000×2(A/B)×3프리셋×10가호 = 120,000판 |
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

## 핵심 확인: 편관 Δ 추이 (이든 §1 판정 기준)

| 가호 | 구분 | 목화 프리셋 | 금수 프리셋 | 토단일 프리셋 |
|------|------|------------|------------|------------|
${pyeongwanCompare}

**이든 판정**: ${edenJudgeLine}

---

## 단독 A/B 표 — 가호 10종 × 3프리셋 순수 델타 (solo_ab 모드)

- **측정법**: 동일 시드 2000판 × A군(단독 1개 장착) / B군(0개, 완전 기준선)
- **순수 델타** = A군 클리어율 − B군 클리어율 (가호 단독 기여도)
- **표기**: Δ=순수델타 / A=A군 클리어율% / B=B군 클리어율%
- **OVER 표시**: Δ ≥ 15 (과강 위반)

| 가호 | 목화 프리셋 | 금수 프리셋 | 토단일 프리셋 |
|------|------------|------------|------------|
${GAHO_IDS.map(id => tableRow(id)).join('\n')}

---

## 채점 판정 (이든 §4 규격)

| 채점 기준 | 기준값 | 판정 |
|----------|--------|------|
| 1. 단독 델타 < 15%p (과강 방지) | 모든 셀 Δ < 15 | **${violations_overcap.length === 0 ? 'PASS' : 'FAIL'}** |
| 2. 3프리셋 중 1개 이상 ≥+5%p (사문화 방지) | 각 가호별 최소 1프리셋 Δ ≥ +5 | **${violations_dead.length === 0 ? 'PASS' : 'FAIL'}** |
| 3. 감소 가호 0종 (전 프리셋 음수 금지) | 전 프리셋 동시 음수인 가호 없음 | **${violations_negative.length === 0 ? 'PASS' : 'FAIL'}** |

${violations_overcap.length > 0 ? `### 과강 위반 (기준 1 — Δ ≥ 15)\n${violations_overcap.map(v => `- ${v}`).join('\n')}\n` : ''}
${violations_dead.length > 0 ? `### 사문화 위반 (기준 2 — 전 프리셋 Δ < +5)\n${violations_dead.map(v => `- ${v}`).join('\n')}\n` : ''}
${violations_negative.length > 0 ? `### 감소 위반 (기준 3 — 전 프리셋 음수)\n${violations_negative.map(v => `- ${v}`).join('\n')}\n` : ''}

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
    },
  )
})
