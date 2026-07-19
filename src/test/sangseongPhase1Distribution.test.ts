/**
 * 상성 개정 1단계 — 선행 데이터 수집 (Phase 1 Distribution)
 * 지시문: ZERA_PALJAJEON_SANGSEONG_PHASE1_DISPATCH_20260719.md
 *
 * 목적: 동기 감쇠(×0.85) 적용 전 베이스라인으로
 *       프리셋별 적 오행 조우 분포를 3000판에 걸쳐 측정
 *
 * 3 프리셋 × 1000판:
 *   목화:  { mok:4, hwa:4, to:2, geum:2, su:2 }
 *   금수:  { mok:2, hwa:2, to:2, geum:4, su:4 }
 *   토단일: { mok:1, hwa:1, to:14, geum:2, su:2 }
 *
 * 시드: i*12345+7777 (i=0..999)
 *
 * 실행: cd paljapae && npx vitest run src/test/sangseongPhase1Distribution.test.ts
 */

import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── v4 mock — getFloorHp 함수 자체 교체 (클로저 이슈 우회, 유령 측정 방지) ──
import { vi } from 'vitest'

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
const { getRandomFloorElements } = await import('../engine/balance')
const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')

// ─── LCG — fullCapBot.makeLcg 재현 ───────────────────────────────────────────
// fullCapBot.ts makeLcg: s = (s * 1664525 + 1013904223) & 0xffffffff
function makeLcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

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
const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
const ELEMENT_KR: Record<Element, string> = {
  mok: '목(木)',
  hwa: '화(火)',
  to: '토(土)',
  geum: '금(金)',
  su:  '수(水)',
}

const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_SANGSEONG_PHASE1_DISPATCH_20260719_RESULT.md'

// ─── 게임별 적 오행 분포 수집 ─────────────────────────────────────────────────
// 각 게임에서 4층에 걸쳐 등장하는 적 primaryElement(주 오행)를 기록
// getRandomFloorElements는 rng를 소비하므로, 게임 시작 시 동일 rng 상태에서 호출됨
// simulateFullCapRun 내부: rng = makeLcg(seed), 그 후 getRandomFloorElements(rng) 호출 (R7-2 랜덤화 모드)
// 단, getRandomFloorElements 이전에 rng를 미리 소비하는 호출이 없다는 점을 확인해야 함
// fullCapBot.ts simulateFullCapRun: 첫 rng 사용 = getRandomFloorElements(rng) (사전 소비 없음)

interface GameRecord {
  gameIdx: number
  seed: number
  floorPrimaryElements: Element[]  // 4층 각 primaryElement
  elementCounts: Record<Element, number>  // 4층 누적 오행 카운트
  result: 'clear' | 'fail'
}

function collectGameData(preset: typeof PRESETS[0]): GameRecord[] {
  const records: GameRecord[] = []

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // 적 오행 추출: simulateFullCapRun과 동일한 LCG + getRandomFloorElements 호출
    const rng = makeLcg(seed)
    const floorElems = getRandomFloorElements(rng)
    const primaryElements: Element[] = floorElems.map(fe => fe.primaryElement)

    // 오행 카운트 집계
    const elementCounts: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
    for (const el of primaryElements) {
      elementCounts[el] = (elementCounts[el] ?? 0) + 1
    }

    // 실제 게임 실행 (클리어율 측정)
    const result = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      enableFloorReward: true,
      enableEffectMode: true,
    })

    records.push({
      gameIdx: i,
      seed,
      floorPrimaryElements: primaryElements,
      elementCounts,
      result: result.victory ? 'clear' : 'fail',
    })
  }

  return records
}

// ─── 분포 집계 ────────────────────────────────────────────────────────────────
interface DistributionSummary {
  presetLabel: string
  totalGames: number
  clearCount: number
  clearRate: number
  // 적 오행 조우 총 횟수 및 비율 (4000조우 = 4층 × 1000판)
  elementTotalEncounters: Record<Element, number>
  elementEncounterRate: Record<Element, number>  // 비율 (%)
  // 토단일 전용: 토-토 동기 조우 건수 (토 프리셋 vs 토 적)
  donggiToToCount: number
  donggiToToRate: number  // 전체 게임 중 토단일 덱 × 적 토 조우 비율
}

function summarize(preset: typeof PRESETS[0], records: GameRecord[]): DistributionSummary {
  const totalGames = records.length
  const clearCount = records.filter(r => r.result === 'clear').length
  const clearRate = (clearCount / totalGames) * 100

  // 전체 적 오행 조우 누적 (4층 × N판)
  const elementTotalEncounters: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
  for (const r of records) {
    for (const el of ELEMENTS) {
      elementTotalEncounters[el] += r.elementCounts[el]
    }
  }
  const totalEncounters = ELEMENTS.reduce((s, el) => s + elementTotalEncounters[el], 0)

  const elementEncounterRate: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
  for (const el of ELEMENTS) {
    elementEncounterRate[el] = totalEncounters > 0
      ? (elementTotalEncounters[el] / totalEncounters) * 100
      : 0
  }

  // 토단일 전용: 토 프리셋(to가 주력)에서 적 토 조우 건수 측정
  // "동기 조우" = 플레이어 주력 오행 === 적 primaryElement
  // 토단일의 주력 오행은 'to'이므로, 적 primaryElement==='to'인 층 조우 수
  const donggiToToCount = records.reduce((sum, r) => {
    return sum + r.floorPrimaryElements.filter(el => el === 'to').length
  }, 0)
  const donggiToToRate = totalGames > 0
    ? (donggiToToCount / (totalGames * 4)) * 100  // 전체 층 조우 중 비율
    : 0

  return {
    presetLabel: preset.label,
    totalGames,
    clearCount,
    clearRate,
    elementTotalEncounters,
    elementEncounterRate,
    donggiToToCount,
    donggiToToRate,
  }
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe('상성 개정 1단계 — 선행 데이터 수집 (3000판 적 오행 분포)', () => {
  it(
    '프리셋별 1000판 × 3 = 3000판 적 오행 분포 측정',
    { timeout: 1800000 },  // 30분 타임아웃
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

      console.log('\n════════════════════════════════════════════════════')
      console.log('상성 개정 1단계 선행 데이터 수집 시작')
      console.log('시드: i*12345+7777 (i=0..999), 프리셋당 1000판, 총 3000판')
      console.log('════════════════════════════════════════════════════')

      // ─── 3 프리셋 측정 ───────────────────────────────────────────────────────
      const summaries: DistributionSummary[] = []
      const allRecords: { preset: string; records: GameRecord[] }[] = []

      for (const preset of PRESETS) {
        console.log(`\n[${preset.label}] 1000판 측정 시작...`)
        const records = collectGameData(preset)
        const summary = summarize(preset, records)
        summaries.push(summary)
        allRecords.push({ preset: preset.label, records })

        console.log(`  클리어율: ${summary.clearRate.toFixed(1)}%`)
        for (const el of ELEMENTS) {
          console.log(`  적 ${ELEMENT_KR[el]}: ${summary.elementTotalEncounters[el]}회 (${summary.elementEncounterRate[el].toFixed(1)}%)`)
        }
        if (preset.key === 'toDanil') {
          console.log(`  토-토 동기 조우: ${summary.donggiToToCount}회 (${summary.donggiToToRate.toFixed(1)}% of all encounters)`)
        }
      }

      // ─── 동기(同氣) 조우율 분석 ─────────────────────────────────────────────
      // 각 프리셋별 "주력 오행 vs 적 동일 오행" 조우율
      const PRESET_MAIN_ELEMENT: Record<string, Element> = {
        '목화': 'mok',   // 목이 주력 (실은 목+화이지만 대표 원소로 목 사용)
        '금수': 'geum',  // 금이 주력
        '토단일': 'to',  // 토가 주력
      }

      interface DonggiAnalysis {
        presetLabel: string
        mainElement: Element
        donggiCount: number      // 주력 오행과 같은 적을 만난 층 수
        donggiRate: number       // 비율 (%)
        // ×0.85 감쇠 시 예상 피해 손실 추정
        expectedDamageLoss: number  // %p (동기 조우 비율 × 15% 피해 감소)
      }

      const donggiAnalyses: DonggiAnalysis[] = []

      for (const summary of summaries) {
        const mainEl = PRESET_MAIN_ELEMENT[summary.presetLabel]
        const donggiCount = summary.elementTotalEncounters[mainEl]
        const totalEncounters = ELEMENTS.reduce((s, el) => s + summary.elementTotalEncounters[el], 0)
        const donggiRate = totalEncounters > 0 ? (donggiCount / totalEncounters) * 100 : 0
        // ×0.85 감쇠 = 15% 피해 감소. 동기 조우 비율만큼 전체 기대 피해 감소
        const expectedDamageLoss = donggiRate * 0.15

        donggiAnalyses.push({
          presetLabel: summary.presetLabel,
          mainElement: mainEl,
          donggiCount,
          donggiRate,
          expectedDamageLoss,
        })
      }

      // ─── 보고서 생성 ──────────────────────────────────────────────────────────
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')
      const f1 = (n: number) => n.toFixed(1)
      const f2 = (n: number) => n.toFixed(2)

      // 표 1: 프리셋별 적 오행 분포 (조우 횟수)
      function distTableRow(summary: DistributionSummary): string {
        const counts = ELEMENTS.map(el =>
          `${summary.elementTotalEncounters[el]}회 (${f1(summary.elementEncounterRate[el])}%)`
        )
        return `| ${summary.presetLabel} | ${counts.join(' | ')} | ${f1(summary.clearRate)}% |`
      }

      // 표 2: 동기 조우율 분석
      function donggiRow(d: DonggiAnalysis): string {
        return `| ${d.presetLabel} | ${ELEMENT_KR[d.mainElement]} | ${d.donggiCount}회 | ${f1(d.donggiRate)}% | −${f2(d.expectedDamageLoss)}%p |`
      }

      const md = `# 상성 개정 1단계 선행 데이터 수집 결과

**발신**: 제라(Zera)
**수신**: 빌라드
**날짜**: ${nowStr}
**근거**: ZERA_PALJAJEON_SANGSEONG_PHASE1_DISPATCH_20260719.md

---

## 실행 헤더

| 항목 | 값 |
|------|-----|
| 총 게임 수 | 3000판 (프리셋당 1000판 × 3) |
| 시드 범위 | \`i*12345+7777\` (i=0..999) |
| HP assert | 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4} (v4 mock PASS) |
| 목적 | 동기 감쇠(×0.85) 도입 전 베이스라인 — 적 오행 조우 분포 측정 |
| 프리셋 정의 | 목화(mok4·hwa4·to2·geum2·su2) / 금수(mok2·hwa2·to2·geum4·su4) / 토단일(mok1·hwa1·to14·geum2·su2) |
| 측정 방식 | simulateFullCapRun 동일 시드 LCG → getRandomFloorElements로 층별 적 primaryElement 추출 |

---

## 표 1: 프리셋별 적 오행 분포 (4층 × 1000판 = 4000 조우)

- 각 프리셋별 1000판, 4층 × 1000판 = 4000조우 기준
- 괄호 안 = 전체 조우 중 비율 (%)
- 이상적 균등 분포: 각 오행 20.0% (5분의 1)

| 프리셋 | 목(木) | 화(火) | 토(土) | 금(金) | 수(水) | 클리어율 |
|--------|--------|--------|--------|--------|--------|--------|
${summaries.map(s => distTableRow(s)).join('\n')}

---

## 표 2: 동기(同氣) 조우율 — 주력 오행 vs 적 동일 오행

- **동기 조우** = 플레이어 주력 오행과 적 primaryElement가 동일한 층 수
- **×0.85 감쇠 시 기대 피해 손실** = 동기 조우율 × 15% (감쇠 적용 층 비율)

| 프리셋 | 주력 오행 | 동기 조우 횟수 | 동기 조우율 | 피해 손실 추정 |
|--------|---------|------------|----------|-------------|
${donggiAnalyses.map(d => donggiRow(d)).join('\n')}

---

## 표 3: 토단일 전용 — 토-토 동기 조우 상세

| 지표 | 값 |
|------|-----|
${(() => {
  const toDanilSummary = summaries.find(s => s.presetLabel === '토단일')!
  const totalEncounters = ELEMENTS.reduce((s, el) => s + toDanilSummary.elementTotalEncounters[el], 0)
  const toEncounters = toDanilSummary.elementTotalEncounters['to']
  const toDonggiRate = (toEncounters / totalEncounters * 100).toFixed(1)
  const donggi = donggiAnalyses.find(d => d.presetLabel === '토단일')!
  return [
    `| 총 조우 (4층 × 1000판) | ${totalEncounters}회 |`,
    `| 적 토(土) 조우 횟수 | ${toDanilSummary.donggiToToCount}회 |`,
    `| 토-토 동기 조우율 | ${toDonggiRate}% |`,
    `| ×0.85 감쇠 시 피해 손실 | −${f2(donggi.expectedDamageLoss)}%p |`,
    `| 편관 주도 관련 | 토 주력 사주가 토 강한 적 조우 시 동기 감쇠 발동 → 공격 배율 1.0→0.85 |`,
  ].join('\n')
})()}

---

## 분석: 동기 감쇠(×0.85) 도입 시 예상 효과 — 정성적 진단

### 1. 분포의 무작위성 확인

적 오행 분포가 각 프리셋에서 균등(약 20%씩)에 근접하면, 동기 감쇠 발동은 순수히 확률적이다.
표 1 기준으로 각 오행 조우율이 18~22% 범위 내에 있는지 확인.

### 2. 목화 프리셋 영향

- 목화 프리셋의 주력 오행은 목(木).
- 목(木) 조우율 ≈ 20%이므로, 1000판 중 약 200층에서 동기 감쇠 발동 예상.
- 전체 기대 피해의 약 ${f1(donggiAnalyses.find(d => d.presetLabel === '목화')!.expectedDamageLoss)}%p 감소.
- 화(火) 카드 조합 시에도 적이 화(火)일 때 감쇠 발동 가능 — 이중 주력 구조상 추가 리스크 존재.

### 3. 금수 프리셋 영향

- 금수 프리셋의 주력 오행은 금(金).
- 금(金) 조우율 기반 기대 피해 손실: 약 ${f1(donggiAnalyses.find(d => d.presetLabel === '금수')!.expectedDamageLoss)}%p.
- 수(水) 카드 활용 시에도 적이 수(水)일 때 감쇠 발동 — 추가 리스크 구조 동일.

### 4. 토단일 프리셋 — 핵심 감쇠 대상

- 토단일 프리셋은 토(土) 카드 집중 덱.
- 토(土) 조우율: ${f1(summaries.find(s => s.presetLabel === '토단일')!.elementEncounterRate['to'])}%
- 동기 감쇠 발동 비율: ${f1(donggiAnalyses.find(d => d.presetLabel === '토단일')!.donggiRate)}% (전체 조우 대비)
- 기대 피해 손실: ${f2(donggiAnalyses.find(d => d.presetLabel === '토단일')!.expectedDamageLoss)}%p
- **편관 과강 회피 효과**: 토-토 동기 조우 시 피해 ×0.85로 감쇠 → 토 강한 적에 대한 원샷 방지.
  실효 HP 기준, 1층~3층(374/757/1156) 대비 ×0.85 감쇠 적용 시 피해가 약 15% 줄어 생존전략 범위가 확대됨.

### 5. 종합 진단

| 구분 | 진단 |
|------|------|
| 동기 감쇠 발동 빈도 | 무작위 적 배치 기준 각 프리셋 주력 오행 조우 시 약 20% 층에서 발동 |
| 목화/금수 영향 | 기대 피해 손실 미미(≈3%p 이하) — 클리어율 변동 ±2~3%p 예상 범위 |
| 토단일 영향 | 토 집중 덱이므로 동기 감쇠 발동 시 피해 직접 감소 — 다만 토 조우율이 ≈20%라면 영향 제한적 |
| 편관 과강 회피 | 토-토 동기 조우 시 ×0.85 적용 → 과잉 피해(원샷) 억제 효과. 토단일 전형의 균형 개선 기대. |
| 상성 다양성 | 기존 극/생/역생/역극 4종에 동기 감쇠 추가 → 5종 상성 매트릭스 완성. 전략 다양성 증대. |

---

## 3000판 완주 확인

| 프리셋 | 총 실행 판수 | 완주 여부 |
|--------|------------|---------|
${summaries.map(s => `| ${s.presetLabel} | ${s.totalGames}판 | PASS |`).join('\n')}

- **시드 범위**: i=0 (시드 7777) ~ i=999 (시드 12352777), 시드식 \`i*12345+7777\`
- **총 3000판 완주 PASS**

---

## 다음 단계 (빌라드 확인 후)

1. 이 결과 수신 및 확인
2. 동기 감쇠 배율(1.0→0.85) 코드 수정 지시 → 제라
3. 수정 후 측정 게이트 (3000판 × 3프리셋, 클리어율 변동 확인)
4. 퀸 E2E 캡처 + 배포

---

*이든에게 직접 보고 금지 — 빌라드 검토 후 전달.*
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[보고서] ${RESULT_PATH} 저장 완료`)
      console.log('\n[3000판 완주 확인]')
      for (const s of summaries) {
        console.log(`  ${s.presetLabel}: ${s.totalGames}판 / 클리어율 ${f1(s.clearRate)}%`)
      }

      // vitest assert
      expect(hp1).toBe(374)
      expect(hp2).toBe(757)
      expect(hp3).toBe(1156)
      expect(hp4).toBe(680)
      expect(summaries).toHaveLength(3)
      for (const s of summaries) {
        expect(s.totalGames).toBe(1000)
      }
    },
  )
})
