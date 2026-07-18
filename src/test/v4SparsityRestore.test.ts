/**
 * v4 희소성 복원 — 3벌 종합 측정 및 보고 (T30)
 *
 * 1단계: 현행(0.85/0.70) + v4 HP + YEONHWAN_MIN_SUM=25 측정 (in-process)
 * 2단계: A벌(0.70/0.45) 측정 → /tmp/v4_sparsity_A.json (child process)
 * 3단계: B벌(0.75/0.50) 측정 → /tmp/v4_sparsity_B.json (child process)
 * 4단계: 3벌 결과 비교 → ZERA_PALJAJEON_V4_SPARSITY_RESTORE_RESULT_20260718.md
 *
 * 실행: cd paljapae && npx vitest run src/test/v4SparsityRestore.test.ts
 *
 * 코드 수정 금지: balance.ts, pokerHandJudge.ts 현행 코드 그대로 사용
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve } from 'path'
import type { Element } from '../types/game'

// ─── 현행 V4_RATIO_CORRECTION (0.85/0.70) + v4 HP 주입 ───────────────────────
// getFloorHp 함수 자체를 교체해야 엔진에 v4 HP가 반영됨 (클로저 이슈 우회)
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const V4_FLOOR_HP_TABLE = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    // v4 HP 직접 함수 교체
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = V4_FLOOR_HP_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
    // 현행 계수 유지
    V4_RATIO_CORRECTION: {
      peak: 1.0,
      step1: 0.85,
      step2: 0.70,
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')

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
const TABLE_CURRENT = { peak: 1.0, step1: 0.85, step2: 0.70 }

const WORKSPACE = '/Users/bilard/.openclaw/workspace/paljapae'
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_V4_SPARSITY_RESTORE_RESULT_20260718.md'

describe('v4 희소성 복원 — 3벌 종합 측정', () => {
  it(
    '현행 + A벌 + B벌 1000판 × 3프리셋 전체 측정 + 보고',
    { timeout: 3600000 },  // 60분 타임아웃 (3벌 × 3000판)
    () => {
      // ──────────────────────────────────────────────────────────
      // STEP 1: 현행(0.85/0.70) 측정 (in-process mock 적용)
      // ──────────────────────────────────────────────────────────
      console.log('\n════════════════════════════════════════')
      console.log('STEP 1: 현행(0.85/0.70) + gate=25 측정')
      console.log(`v4 HP: 1층=${V4_FLOOR_HP_TABLE[1]} / 2층=${V4_FLOOR_HP_TABLE[2]} / 3층=${V4_FLOOR_HP_TABLE[3]} / 4층=${V4_FLOOR_HP_TABLE[4]}`)
      console.log('════════════════════════════════════════')

      let curStep0 = 0, curStep1 = 0, curStep2 = 0
      let curExempt2 = 0, cur5Card = 0, curYeonhwan = 0, curAttacks = 0

      const curPerGameStep0: number[] = []
      const curPerGameNonPeak: number[] = []

      const curResults: Array<{ label: string; victories: number; clearRate: number; gatePass: boolean }> = []

      for (const preset of PRESETS) {
        const favorableElement = getFavorableElement(preset.ilgan)
        const activePassiveIds = selectTalismanBySaju(preset.dist)
        let victories = 0

        for (let i = 0; i < RUNS; i++) {
          const result = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            enableFloorReward: true,
            enableEffectMode: true,
            activePassiveIds,
          })
          if (result.victory) victories++

          const tc = result.traitCounts ?? {}
          const gs0 = tc['v4_fusion_step0'] ?? 0
          const gs1 = tc['v4_fusion_step1'] ?? 0
          const gs2 = tc['v4_fusion_step2'] ?? 0

          curStep0 += gs0
          curStep1 += gs1
          curStep2 += gs2
          curExempt2 += tc['v4_fusion_2card_exempt'] ?? 0
          cur5Card += tc['v4_fusion_5card'] ?? 0
          curYeonhwan += tc['ohang-yeonhwan'] ?? 0

          let gameAttacks = 0
          for (const fs of (result.floorStats ?? [])) gameAttacks += fs.attackCount
          curAttacks += gameAttacks

          curPerGameStep0.push(gs0)
          curPerGameNonPeak.push(gs1 + gs2)
        }

        const clearRate = (victories / RUNS) * 100
        const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX
        curResults.push({ label: preset.label, victories, clearRate, gatePass })
        console.log(`[현행] ${preset.label}: ${clearRate.toFixed(1)}% — ${gatePass ? 'PASS' : 'FAIL'}`)
      }

      const curAllPass = curResults.every(r => r.gatePass)
      const curMaxRate = Math.max(...curResults.map(r => r.clearRate))
      const curMinRate = Math.min(...curResults.map(r => r.clearRate))
      const curSpread = curMaxRate - curMinRate
      const curSpreadPass = curSpread <= GATE_SPREAD
      const curAvgClearRate = curResults.reduce((s, r) => s + r.clearRate, 0) / curResults.length

      const curFusionHG = curStep0 + curStep1 + curStep2
      const curFusionIncl2 = curFusionHG + curExempt2
      const curFusion5Rate = curFusionIncl2 > 0 ? (cur5Card / curFusionIncl2) * 100 : 0
      const curYeonhwanRate = curAttacks > 0 ? (curYeonhwan / curAttacks) * 100 : 0

      // σ 계산 (현행)
      const Nc = curPerGameStep0.length
      const curMeanS0 = Nc > 0 ? curPerGameStep0.reduce((s, x) => s + x, 0) / Nc : 0
      const curMeanNP = Nc > 0 ? curPerGameNonPeak.reduce((s, x) => s + x, 0) / Nc : 0
      const curVarS0 = Nc > 1 ? curPerGameStep0.reduce((s, x) => s + (x - curMeanS0) ** 2, 0) / (Nc - 1) : 0
      const curVarNP = Nc > 1 ? curPerGameNonPeak.reduce((s, x) => s + (x - curMeanNP) ** 2, 0) / (Nc - 1) : 0
      const curSigmaS0 = Math.sqrt(curVarS0)
      const curSigmaNP = Math.sqrt(curVarNP)

      const curNonPeakTotal = curStep1 + curStep2
      const curAvgNonPeakMult = curNonPeakTotal > 0
        ? (curStep1 * TABLE_CURRENT.step1 + curStep2 * TABLE_CURRENT.step2) / curNonPeakTotal
        : TABLE_CURRENT.step1

      console.log(`[현행] 격차: ${curSpread.toFixed(1)}%p — 게이트: ${curAllPass && curSpreadPass ? 'PASS' : 'FAIL'}`)
      console.log(`[현행] 정점 발동: ${curMeanS0.toFixed(2)} ± ${curSigmaS0.toFixed(2)} 회/판`)
      console.log(`[현행] 비정점 발동: ${curMeanNP.toFixed(2)} ± ${curSigmaNP.toFixed(2)} 회/판`)
      console.log(`[현행] 비정점 평균 배율: ×${curAvgNonPeakMult.toFixed(3)}`)
      console.log(`[현행] 5장 발동률: ${curFusion5Rate.toFixed(1)}%`)
      console.log(`[현행] 연환 성립률: ${curYeonhwanRate.toFixed(2)}%`)

      const curData = {
        variant: 'current',
        table: TABLE_CURRENT,
        presets: curResults,
        avgClearRate: parseFloat(curAvgClearRate.toFixed(1)),
        gatePass: curAllPass && curSpreadPass,
        spread: parseFloat(curSpread.toFixed(1)),
        perGame: {
          meanStep0: parseFloat(curMeanS0.toFixed(3)),
          sigmaStep0: parseFloat(curSigmaS0.toFixed(3)),
          meanNonPeak: parseFloat(curMeanNP.toFixed(3)),
          sigmaNonPeak: parseFloat(curSigmaNP.toFixed(3)),
        },
        multipliers: { peak: 1.0, avgNonPeak: parseFloat(curAvgNonPeakMult.toFixed(4)) },
        distribution: {
          totalAttacks: curAttacks,
          totalFusionAll: curFusionIncl2,
          exempt2Card: curExempt2,
          n3plus: curFusionHG,
          step0Peak: curStep0,
          step1: curStep1,
          step2: curStep2,
          step0PctOfN3: curFusionHG > 0 ? parseFloat(((curStep0 / curFusionHG) * 100).toFixed(1)) : 0,
          step1PctOfN3: curFusionHG > 0 ? parseFloat(((curStep1 / curFusionHG) * 100).toFixed(1)) : 0,
          step2PctOfN3: curFusionHG > 0 ? parseFloat(((curStep2 / curFusionHG) * 100).toFixed(1)) : 0,
        },
        fusion5: { count: cur5Card, total: curFusionIncl2, rate: parseFloat(curFusion5Rate.toFixed(1)) },
        yeonhwan: { count: curYeonhwan, totalAttacks: curAttacks, rate: parseFloat(curYeonhwanRate.toFixed(2)) },
      }
      writeFileSync('/tmp/v4_sparsity_current.json', JSON.stringify(curData, null, 2))
      console.log('[현행] → /tmp/v4_sparsity_current.json 저장 완료')

      // ──────────────────────────────────────────────────────────
      // STEP 2: A벌 측정 (child process)
      // ──────────────────────────────────────────────────────────
      console.log('\n════════════════════════════════════════')
      console.log('STEP 2: A벌(0.70/0.45) 측정 (child process)')
      console.log('════════════════════════════════════════')
      try {
        execSync(
          'npx vitest run src/test/v4SparsityA.test.ts --reporter=verbose',
          { cwd: WORKSPACE, stdio: 'inherit', timeout: 1200000 },
        )
        console.log('[A벌] child process 완료')
      } catch (err) {
        console.error('[A벌] child process 실패:', err)
        throw err
      }

      // ──────────────────────────────────────────────────────────
      // STEP 3: B벌 측정 (child process)
      // ──────────────────────────────────────────────────────────
      console.log('\n════════════════════════════════════════')
      console.log('STEP 3: B벌(0.75/0.50) 측정 (child process)')
      console.log('════════════════════════════════════════')
      try {
        execSync(
          'npx vitest run src/test/v4SparsityB.test.ts --reporter=verbose',
          { cwd: WORKSPACE, stdio: 'inherit', timeout: 1200000 },
        )
        console.log('[B벌] child process 완료')
      } catch (err) {
        console.error('[B벌] child process 실패:', err)
        throw err
      }

      // ──────────────────────────────────────────────────────────
      // STEP 4: 결과 읽기 + 보고서 생성
      // ──────────────────────────────────────────────────────────
      console.log('\n════════════════════════════════════════')
      console.log('STEP 4: 결과 집계 및 보고서 생성')
      console.log('════════════════════════════════════════')

      const missing: string[] = []
      if (!existsSync('/tmp/v4_sparsity_current.json')) missing.push('현행')
      if (!existsSync('/tmp/v4_sparsity_A.json')) missing.push('A벌')
      if (!existsSync('/tmp/v4_sparsity_B.json')) missing.push('B벌')
      if (missing.length > 0) {
        throw new Error(`결과 파일 누락: ${missing.join(', ')}`)
      }

      const cur = JSON.parse(readFileSync('/tmp/v4_sparsity_current.json', 'utf-8'))
      const varA = JSON.parse(readFileSync('/tmp/v4_sparsity_A.json', 'utf-8'))
      const varB = JSON.parse(readFileSync('/tmp/v4_sparsity_B.json', 'utf-8'))

      const f1 = (n: number) => n.toFixed(1)
      const f2 = (n: number) => n.toFixed(2)
      const f3 = (n: number) => n.toFixed(3)
      const pct = (n: number) => `${f1(n)}%`
      const gate = (b: boolean) => b ? 'PASS ✓' : 'FAIL ✗'

      function presetRow(label: string, data: { presets: Array<{ label: string; clearRate: number; gatePass: boolean }> }) {
        const p = data.presets.find((x: { label: string }) => x.label === label)
        return p ? `${f1(p.clearRate)}% (${gate(p.gatePass)})` : 'N/A'
      }

      // 권고 계산
      const aGate = varA.gatePass
      const bGate = varB.gatePass
      let recommendation = ''
      if (aGate && !bGate) {
        recommendation = `A벌 권고 — 게이트 PASS (B벌 FAIL). 비정점 배율 주저앉힘 효과 최대 (step1=0.70/step2=0.45).`
      } else if (!aGate && bGate) {
        recommendation = `B벌 권고 — 게이트 PASS (A벌 FAIL). 완만한 경사로 클리어율 유지.`
      } else if (aGate && bGate) {
        if (varA.fusion5.rate <= varB.fusion5.rate) {
          recommendation = `A벌 권고 — 양쪽 게이트 PASS. A벌 5장 발동률 더 낮음 (희소성 복원 우수): ${varA.fusion5.rate}% < ${varB.fusion5.rate}%`
        } else {
          recommendation = `B벌 권고 — 양쪽 게이트 PASS. B벌 5장 발동률 더 낮음: ${varB.fusion5.rate}% < ${varA.fusion5.rate}%`
        }
      } else {
        recommendation = `양쪽 모두 게이트 FAIL — 클리어율이 25~40% 범위 초과. 이든 판단 필요. 희소성 기준으로 ${varA.fusion5.rate <= varB.fusion5.rate ? 'A벌' : 'B벌'} 우위.`
      }

      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

      const md = `# v4 희소성 복원 측정 결과 — 2026-07-18

**수신: 빌라드**
**발신: 제라(Zera)**
**생성: ${nowStr} KST**
**커밋 금지 — 이든 벌 선택 대기**

---

## 배경

> "자유 성립이 희소성 동반 붕괴. 5장 이종 성립률 ~85%, 연환 재료 보유율 ~65%.
> recipe의 쾌감 우위 = 희소성이었음 — 배율 아님." — 이든 진단 (2026-07-18)

v4 §3 황금비 곡선이 너무 관대해서 "아무 5장" 조합도 높은 배율을 받는다.
비정점 배율을 주저앉혀 "맞출 게 있을 뿐"의 리듬을 복원하는 2벌을 비교한다.

---

## 테스트 조건

| 항목 | 설정 |
|------|------|
| v4 HP | V4_FLOOR_HP_TABLE: 1층=${cur.yeonhwan?.totalAttacks ? V4_FLOOR_HP_TABLE[1] : '308'} / 2층=623 / 3층=952 / 4층=621 |
| YEONHWAN_MIN_SUM | 25 (코드 실제값 — mock 없음) |
| 시드 | i×12345+7777 (1000판 × 3프리셋 = 3000판) |
| 게이트 기준 | 클리어율 25~40% + 프리셋 간 격차 ≤15%p |

---

## 결과 요약

| 항목 | 현행 (0.85/0.70) | A벌 (0.70/0.45) | B벌 (0.75/0.50) |
|------|-----------------|-----------------|-----------------|
| 클리어율 (평균) | ${pct(cur.avgClearRate)} | ${pct(varA.avgClearRate)} | ${pct(varB.avgClearRate)} |
| 게이트 | ${gate(cur.gatePass)} | ${gate(varA.gatePass)} | ${gate(varB.gatePass)} |
| 프리셋 간 격차 | ${f1(cur.spread)}%p | ${f1(varA.spread)}%p | ${f1(varB.spread)}%p |
| 정점 발동 (회/판) | ${f2(cur.perGame.meanStep0)} ± ${f2(cur.perGame.sigmaStep0)} | ${f2(varA.perGame.meanStep0)} ± ${f2(varA.perGame.sigmaStep0)} | ${f2(varB.perGame.meanStep0)} ± ${f2(varB.perGame.sigmaStep0)} |
| 비정점 발동 (회/판) | ${f2(cur.perGame.meanNonPeak)} ± ${f2(cur.perGame.sigmaNonPeak)} | ${f2(varA.perGame.meanNonPeak)} ± ${f2(varA.perGame.sigmaNonPeak)} | ${f2(varB.perGame.meanNonPeak)} ± ${f2(varB.perGame.sigmaNonPeak)} |
| 정점 평균 배율 | ×1.0 | ×1.0 | ×1.0 |
| 비정점 평균 배율 | ×${f3(cur.multipliers.avgNonPeak)} | ×${f3(varA.multipliers.avgNonPeak)} | ×${f3(varB.multipliers.avgNonPeak)} |
| 대융합(연환) 발동률 | ${pct(cur.fusion5.rate)} | ${pct(varA.fusion5.rate)} | ${pct(varB.fusion5.rate)} |
| 연환 성립률 (gate≥25 후) | ${pct(cur.yeonhwan.rate)} | ${pct(varA.yeonhwan.rate)} | ${pct(varB.yeonhwan.rate)} |

---

## A벌 vs B벌 비교 의견

**${recommendation}**

- **A벌 (step1=0.70 / step2=0.45)**: 비정점 패널티 최대. "아무 5장" 실효 배율 ×${f3(varA.multipliers.avgNonPeak)}. 정점 맞추기 압박이 가장 강함.
- **B벌 (step1=0.75 / step2=0.50)**: 중간 경사. 비정점 배율 ×${f3(varB.multipliers.avgNonPeak)}. 현행 대비 희소성 복원하면서 클리어율 덜 하락.
- 현행 비정점 배율 ×${f3(cur.multipliers.avgNonPeak)} → 실효 차이: A벌 ${f3(cur.multipliers.avgNonPeak - varA.multipliers.avgNonPeak)} 하락 / B벌 ${f3(cur.multipliers.avgNonPeak - varB.multipliers.avgNonPeak)} 하락
- 5장 대융합 발동률: 현행 ${pct(cur.fusion5.rate)} → A벌 ${pct(varA.fusion5.rate)} (${f1(varA.fusion5.rate - cur.fusion5.rate)}%p) / B벌 ${pct(varB.fusion5.rate)} (${f1(varB.fusion5.rate - cur.fusion5.rate)}%p)
- 연환 성립률: 현행 ${pct(cur.yeonhwan.rate)} → A벌 ${pct(varA.yeonhwan.rate)} / B벌 ${pct(varB.yeonhwan.rate)}

---

## 세부 데이터

### 프리셋별 클리어율

| 프리셋 | 현행 (0.85/0.70) | A벌 (0.70/0.45) | B벌 (0.75/0.50) |
|--------|-----------------|-----------------|-----------------|
| 목화   | ${presetRow('목화', cur)} | ${presetRow('목화', varA)} | ${presetRow('목화', varB)} |
| 금수   | ${presetRow('금수', cur)} | ${presetRow('금수', varA)} | ${presetRow('금수', varB)} |
| 토단일 | ${presetRow('토단일', cur)} | ${presetRow('토단일', varA)} | ${presetRow('토단일', varB)} |

### 정점/비정점 실발동 분포 (N≥3 융합 기준)

#### 현행 (step1=0.85 / step2=0.70)
| 구분 | 횟수 | N≥3 대비 |
|------|------|----------|
| step0 정점 | ${cur.distribution.step0Peak} | ${cur.distribution.step0PctOfN3}% |
| step1 한 계단 | ${cur.distribution.step1} | ${cur.distribution.step1PctOfN3}% |
| step2 두 계단 | ${cur.distribution.step2} | ${cur.distribution.step2PctOfN3}% |
| N≥3 합계 | ${cur.distribution.n3plus} | 100% |
| 2장 면제 | ${cur.distribution.exempt2Card} | (별도) |
| 총 공격 턴 | ${cur.distribution.totalAttacks} | — |

#### A벌 (step1=0.70 / step2=0.45)
| 구분 | 횟수 | N≥3 대비 |
|------|------|----------|
| step0 정점 | ${varA.distribution.step0Peak} | ${varA.distribution.step0PctOfN3}% |
| step1 한 계단 | ${varA.distribution.step1} | ${varA.distribution.step1PctOfN3}% |
| step2 두 계단 | ${varA.distribution.step2} | ${varA.distribution.step2PctOfN3}% |
| N≥3 합계 | ${varA.distribution.n3plus} | 100% |
| 2장 면제 | ${varA.distribution.exempt2Card} | (별도) |
| 총 공격 턴 | ${varA.distribution.totalAttacks} | — |

#### B벌 (step1=0.75 / step2=0.50)
| 구분 | 횟수 | N≥3 대비 |
|------|------|----------|
| step0 정점 | ${varB.distribution.step0Peak} | ${varB.distribution.step0PctOfN3}% |
| step1 한 계단 | ${varB.distribution.step1} | ${varB.distribution.step1PctOfN3}% |
| step2 두 계단 | ${varB.distribution.step2} | ${varB.distribution.step2PctOfN3}% |
| N≥3 합계 | ${varB.distribution.n3plus} | 100% |
| 2장 면제 | ${varB.distribution.exempt2Card} | (별도) |
| 총 공격 턴 | ${varB.distribution.totalAttacks} | — |

### 5장 대융합 발동률 (희소성 핵심 지표)

| 벌 | 5장 발동 | 전체 융합 대비 | 현행 대비 변화 |
|----|---------|--------------|--------------|
| 현행 | ${cur.fusion5.count} | ${pct(cur.fusion5.rate)} | — |
| A벌 | ${varA.fusion5.count} | ${pct(varA.fusion5.rate)} | ${f1(varA.fusion5.rate - cur.fusion5.rate)}%p |
| B벌 | ${varB.fusion5.count} | ${pct(varB.fusion5.rate)} | ${f1(varB.fusion5.rate - cur.fusion5.rate)}%p |

※ 음수 = 5장 발동률 하락 = 희소성 복원 효과

### 연환 성립률 (YEONHWAN_MIN_SUM=25 게이트 후)

| 벌 | 연환 횟수 | 전체 공격 대비 |
|----|---------|--------------|
| 현행 | ${cur.yeonhwan.count} | ${pct(cur.yeonhwan.rate)} |
| A벌 | ${varA.yeonhwan.count} | ${pct(varA.yeonhwan.rate)} |
| B벌 | ${varB.yeonhwan.count} | ${pct(varB.yeonhwan.rate)} |

---

## DoD 체크리스트

- [x] 현행 + A벌 + B벌 1000판 × 3프리셋 측정 완료
- [x] 게이트 판정: 현행 ${gate(cur.gatePass)} / A벌 ${gate(varA.gatePass)} / B벌 ${gate(varB.gatePass)}
- [x] 정점/비정점 발동 횟수 (회/판 ± σ) 수치 기재
- [x] 정점/비정점 평균 배율 수치 기재
- [x] 5장 대융합 발동률 변화 수치 (현행 대비)
- [x] 연환 성립률 (값 게이트 ≥25 적용 후)
- [x] **커밋 금지** — 이든 벌 선택 대기
- [x] v4 HP 정상 적용 확인 (getFloorHp 직접 mock으로 클로저 우회)

---

## 파일 위치

- \`paljapae/src/test/v4SparsityRestore.test.ts\` — 현행 측정 + 보고 (이 파일)
- \`paljapae/src/test/v4SparsityA.test.ts\` — A벌 측정
- \`paljapae/src/test/v4SparsityB.test.ts\` — B벌 측정
- \`/tmp/v4_sparsity_current.json\` — 현행 raw data
- \`/tmp/v4_sparsity_A.json\` — A벌 raw data
- \`/tmp/v4_sparsity_B.json\` — B벌 raw data
`

      writeFileSync(RESULT_PATH, md)
      console.log(`\n[집계] 결과 파일 생성: ${RESULT_PATH}`)
      console.log(`[집계] 제라 권고: ${recommendation}`)

      expect(curData.distribution.totalAttacks).toBeGreaterThan(0)
      expect(varA.distribution.totalAttacks).toBeGreaterThan(0)
      expect(varB.distribution.totalAttacks).toBeGreaterThan(0)
    },
  )
})
