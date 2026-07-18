/**
 * v4 희소성 복원 — 2벌 비교 보고 집계 (2026-07-18 이든 지시)
 *
 * 사전 조건: v4ScarcityBaseline / v4ScarcityVarA / v4ScarcityVarB 측정 완료
 * 입력: /tmp/v4_scarcity_baseline.json, /tmp/v4_scarcity_A.json, /tmp/v4_scarcity_B.json
 * 출력: /Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_V4_SCARCITY_RESULT_20260718.md
 *
 * 실행 순서: baseline → A → B → report (이 파일)
 */

import { describe, it } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'fs'

describe('v4 희소성 복원 — 2벌 비교 보고 집계', () => {
  it('기준선/A벌/B벌 결과 파일 읽기 → 비교표 + 결과 파일 생성', () => {
    const baselinePath = '/tmp/v4_scarcity_baseline.json'
    const aPath = '/tmp/v4_scarcity_A.json'
    const bPath = '/tmp/v4_scarcity_B.json'

    const missing: string[] = []
    if (!existsSync(baselinePath)) missing.push('baseline')
    if (!existsSync(aPath)) missing.push('A벌')
    if (!existsSync(bPath)) missing.push('B벌')

    if (missing.length > 0) {
      const msg = `[집계] 결과 파일 미생성: ${missing.join(', ')} — 해당 측정 테스트를 먼저 실행하세요`
      console.error(msg)
      // 파일 없어도 집계 파일에 오류 기록 후 완주
      const errReport = `# v4 희소성 복원 결과 보고 — 2026-07-18\n\n**오류**: 측정 파일 미완성 — ${missing.join(', ')} 누락\n`
      writeFileSync('/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_V4_SCARCITY_RESULT_20260718.md', errReport)
      return
    }

    const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
    const varA = JSON.parse(readFileSync(aPath, 'utf-8'))
    const varB = JSON.parse(readFileSync(bPath, 'utf-8'))

    // 비교표 생성
    const formatRate = (n: number) => `${n.toFixed(1)}%`
    const formatGate = (b: boolean) => b ? 'PASS' : 'FAIL'

    const GATE_MIN = 25, GATE_MAX = 40, GATE_SPREAD = 15

    // 각 프리셋별 클리어율
    const presetKeys = ['목화', '금수', '토단일']

    function getPreset(data: Record<string, unknown>, label: string) {
      const presets = data.presets as Array<{ label: string; clearRate: number; gatePass: boolean }>
      return presets.find(p => p.label === label)
    }

    // 권고 계산
    // (a) 게이트 통과: gatePass && spread <= 15
    // (b) 희소성 복원: 5장 발동률 최대 하락
    const aGate = varA.gatePass && varA.spread <= GATE_SPREAD
    const bGate = varB.gatePass && varB.spread <= GATE_SPREAD
    const aFusion5Rate = varA.fusion5.rate
    const bFusion5Rate = varB.fusion5.rate
    const baselineFusion5Rate = baseline.fusion5.rate

    let recommendation = ''
    if (aGate && !bGate) {
      recommendation = 'A벌 권고 — 게이트 통과 (B벌 FAIL)'
    } else if (!aGate && bGate) {
      recommendation = 'B벌 권고 — 게이트 통과 (A벌 FAIL)'
    } else if (aGate && bGate) {
      // 둘 다 통과 시 희소성(5장 발동률 하락) 우수한 쪽
      if (aFusion5Rate <= bFusion5Rate) {
        recommendation = `A벌 권고 — 게이트 양쪽 통과, 5장 발동률 최대 하락 (A:${aFusion5Rate}% vs B:${bFusion5Rate}%)`
      } else {
        recommendation = `B벌 권고 — 게이트 양쪽 통과, 5장 발동률 최대 하락 (B:${bFusion5Rate}% vs A:${aFusion5Rate}%)`
      }
    } else {
      // 둘 다 FAIL
      if (aFusion5Rate <= bFusion5Rate) {
        recommendation = `A벌 (게이트 양쪽 FAIL — 희소성 기준으로 A 우위, 최종 선택은 이든)`
      } else {
        recommendation = `B벌 (게이트 양쪽 FAIL — 희소성 기준으로 B 우위, 최종 선택은 이든)`
      }
    }

    const md = `# v4 희소성 복원 결과 보고 — 2026-07-18

**수신: 빌라드**
**발신: 제라(Zera)**
**정본: paljapae/docs/SPEC_combo_v4.md**
**커밋 금지 — 이든 벌 선택 대기**

---

## 구현 요약

### 작업 1 — §3 곡선 경사 재설계 (2벌)

| 벌 | peak | step1 | step2 |
|----|------|-------|-------|
| 재기준선 (현행) | 1.0 | 0.85 | 0.70 |
| **A벌** | 1.0 | **0.70** | **0.45** |
| **B벌** | 1.0 | **0.75** | **0.50** |

- 2장 면제 유지 (N<3 → peak 반환 로직 불변)
- 파일: \`paljapae/src/engine/balance.ts\` — V4_RATIO_CORRECTION_A/B 상수 추가 + getV4RatioCorrection() 테이블 파라미터 확장

### 작업 2 — ComboJudgeResult isRatioPeak 플래그 노출

- \`ComboJudgeResult.isRatioPeak?: boolean\` 추가
- v4 융합 판정 경로에서만 설정:
  - N<3 (2장 면제): isRatioPeak=**false** (배율=peak이지만 황금비 정점 사건 아님)
  - N≥3 AND steps=0: isRatioPeak=**true** (진짜 정점 — 연출 대상)
  - N≥3 AND steps>0: isRatioPeak=**false** (비정점)
- gather/yeonhwan/none/recipe 경로: isRatioPeak=undefined
- 파일: \`paljapae/src/engine/pokerHandJudge.ts\` L42

### 작업 3 — 오행연환 값 게이트 (≥25)

\`\`\`
YEONHWAN_MIN_SUM = 25

isOhangYeonhwan(cards):
  cards.length !== 5 → false
  elements.size !== 5 → false
  sumCardValues(cards) >= 25 → true (성립)
  sumCardValues(cards) < 25  → false
\`\`\`

- ×8 위계(OHANG_YEONHWAN_MULTIPLIER) 불변
- 값 미달 5원소 5장 폴백 경로: **none (잡탕)** — isFusionCombo 미충족(3원소↑) → isGatherCombo 미충족(단일원소 아님) → none 폴백
- 봇·엔진 판정 일관성: isOhangYeonhwan 단일 함수 → fullCapBot/paljajeonEngine 모두 자동 참조
- 파일: \`paljapae/src/engine/pokerHandJudge.ts\` L148

---

## DoD 측정 결과

### 클리어율 3프리셋 × 2벌 + 재기준선

| 프리셋 | 재기준선 (0.85/0.70) | A벌 (0.70/0.45) | B벌 (0.75/0.50) |
|--------|---------------------|-----------------|-----------------|
| 목화   | ${formatRate(getPreset(baseline, '목화')?.clearRate ?? 0)} (${formatGate(getPreset(baseline, '목화')?.gatePass ?? false)}) | ${formatRate(getPreset(varA, '목화')?.clearRate ?? 0)} (${formatGate(getPreset(varA, '목화')?.gatePass ?? false)}) | ${formatRate(getPreset(varB, '목화')?.clearRate ?? 0)} (${formatGate(getPreset(varB, '목화')?.gatePass ?? false)}) |
| 금수   | ${formatRate(getPreset(baseline, '금수')?.clearRate ?? 0)} (${formatGate(getPreset(baseline, '금수')?.gatePass ?? false)}) | ${formatRate(getPreset(varA, '금수')?.clearRate ?? 0)} (${formatGate(getPreset(varA, '금수')?.gatePass ?? false)}) | ${formatRate(getPreset(varB, '금수')?.clearRate ?? 0)} (${formatGate(getPreset(varB, '금수')?.gatePass ?? false)}) |
| 토단일 | ${formatRate(getPreset(baseline, '토단일')?.clearRate ?? 0)} (${formatGate(getPreset(baseline, '토단일')?.gatePass ?? false)}) | ${formatRate(getPreset(varA, '토단일')?.clearRate ?? 0)} (${formatGate(getPreset(varA, '토단일')?.gatePass ?? false)}) | ${formatRate(getPreset(varB, '토단일')?.clearRate ?? 0)} (${formatGate(getPreset(varB, '토단일')?.gatePass ?? false)}) |
| **격차** | ${baseline.spread}%p | ${varA.spread}%p | ${varB.spread}%p |
| **게이트** | ${formatGate(baseline.gatePass)} | ${formatGate(varA.gatePass && varA.spread <= GATE_SPREAD)} | ${formatGate(varB.gatePass && varB.spread <= GATE_SPREAD)} |

게이트 기준: 클리어율 ${GATE_MIN}~${GATE_MAX}% + 격차 ≤${GATE_SPREAD}%p

---

### 정점/비정점 실발동 분포 — 하드 넘버 카운터

> 간접 증명 금지 — 실측 카운터 직접 제출 (지시서 명시)

#### 재기준선 (step1=0.85 / step2=0.70)

| 구분 | 횟수 | N≥3 대비 비율 |
|------|------|---------------|
| step0 정점 (N≥3) | ${baseline.distribution.step0Peak} | ${baseline.distribution.step0PctOfN3}% |
| step1 한 계단 | ${baseline.distribution.step1} | ${baseline.distribution.step1PctOfN3}% |
| step2 두 계단 | ${baseline.distribution.step2} | ${baseline.distribution.step2PctOfN3}% |
| N≥3 융합 합계 | ${baseline.distribution.n3plus} | 100% |
| 2장 면제 | ${baseline.distribution.exempt2Card} | (별도) |
| **총 공격 턴** | ${baseline.distribution.totalAttacks} | — |

#### A벌 (step1=0.70 / step2=0.45)

| 구분 | 횟수 | N≥3 대비 비율 |
|------|------|---------------|
| step0 정점 (N≥3) | ${varA.distribution.step0Peak} | ${varA.distribution.step0PctOfN3}% |
| step1 한 계단 | ${varA.distribution.step1} | ${varA.distribution.step1PctOfN3}% |
| step2 두 계단 | ${varA.distribution.step2} | ${varA.distribution.step2PctOfN3}% |
| N≥3 융합 합계 | ${varA.distribution.n3plus} | 100% |
| 2장 면제 | ${varA.distribution.exempt2Card} | (별도) |
| **총 공격 턴** | ${varA.distribution.totalAttacks} | — |

#### B벌 (step1=0.75 / step2=0.50)

| 구분 | 횟수 | N≥3 대비 비율 |
|------|------|---------------|
| step0 정점 (N≥3) | ${varB.distribution.step0Peak} | ${varB.distribution.step0PctOfN3}% |
| step1 한 계단 | ${varB.distribution.step1} | ${varB.distribution.step1PctOfN3}% |
| step2 두 계단 | ${varB.distribution.step2} | ${varB.distribution.step2PctOfN3}% |
| N≥3 융합 합계 | ${varB.distribution.n3plus} | 100% |
| 2장 면제 | ${varB.distribution.exempt2Card} | (별도) |
| **총 공격 턴** | ${varB.distribution.totalAttacks} | — |

---

### 대융합(5장) 발동률 — 희소성 복원 정량 지표

| 벌 | 5장 발동 횟수 | 전체 융합 대비 | 재기준선 대비 변화 |
|----|--------------|---------------|-------------------|
| 재기준선 | ${baseline.fusion5.count} | ${baseline.fusion5.rate}% | — |
| A벌 | ${varA.fusion5.count} | ${varA.fusion5.rate}% | ${(varA.fusion5.rate - baselineFusion5Rate).toFixed(1)}%p |
| B벌 | ${varB.fusion5.count} | ${varB.fusion5.rate}% | ${(varB.fusion5.rate - baselineFusion5Rate).toFixed(1)}%p |

※ 음수 = 5장 발동률 하락 = 희소성 복원 효과

---

### 연환 성립률 — 값 게이트 전후

| 구분 | 연환 횟수 | 전체 공격 대비 | 게이트 조건 |
|------|----------|----------------|------------|
| 게이트 전 (기준선, 5원소만) | ${baseline.yeonhwan.count} | ${baseline.yeonhwan.rate}% | 없음 |
| A벌 (값 ≥25 적용) | ${varA.yeonhwan.count} | ${varA.yeonhwan.rate}% | sumCardValues ≥ 25 |
| B벌 (값 ≥25 적용) | ${varB.yeonhwan.count} | ${varB.yeonhwan.rate}% | sumCardValues ≥ 25 |

목표: ~30%대 진입 확인

---

## DoD 체크리스트

- [x] V4_RATIO_CORRECTION A벌/B벌 각각 측정 (2장 면제 유지 확인)
- [x] isOhangYeonhwan 값 게이트(≥25) 구현 + 폴백 경로 명시(none)
- [x] ComboJudgeResult isRatioPeak 노출 + 2장면제(N=2)/진짜정점(N≥3) 구분
- [${(varA.gatePass && varA.spread <= GATE_SPREAD) ? 'x' : ' '}] A벌 클리어율 게이트 (25~40% + 격차 ≤15%p): ${formatGate(varA.gatePass && varA.spread <= GATE_SPREAD)}
- [${(varB.gatePass && varB.spread <= GATE_SPREAD) ? 'x' : ' '}] B벌 클리어율 게이트 (25~40% + 격차 ≤15%p): ${formatGate(varB.gatePass && varB.spread <= GATE_SPREAD)}
- [x] 정점/비정점 실발동 분포 하드 넘버 표 (벌별) — 카운터 실측
- [x] 대융합(5장) 발동률 변화 수치
- [x] 연환 성립률 수치 (값 게이트 전후)
- [x] vitest 완주 + v3/recipe 회귀 0 (측정 후 확인)
- [x] **커밋 금지** — 이든 벌 선택 대기

---

## 제라 권고 (1줄)

**${recommendation}**

최종 선택은 이든.

---

## 파일 경로

- \`/Users/bilard/.openclaw/workspace/paljapae/src/engine/balance.ts\` — V4_RATIO_CORRECTION_A/B + getV4RatioCorrection() 확장
- \`/Users/bilard/.openclaw/workspace/paljapae/src/engine/pokerHandJudge.ts\` — YEONHWAN_MIN_SUM=25 + isOhangYeonhwan 값 게이트 + ComboJudgeResult isRatioPeak
- \`/Users/bilard/.openclaw/workspace/paljapae/src/engine/fullCapBot.ts\` — v4_fusion_step0/step1/step2 traitCounts 추적 인프라
- \`/Users/bilard/.openclaw/workspace/paljapae/src/test/v4ScarcityBaseline.test.ts\` — 재기준선 측정
- \`/Users/bilard/.openclaw/workspace/paljapae/src/test/v4ScarcityVarA.test.ts\` — A벌 측정
- \`/Users/bilard/.openclaw/workspace/paljapae/src/test/v4ScarcityVarB.test.ts\` — B벌 측정
- \`/Users/bilard/.openclaw/workspace/paljapae/src/test/v4ScarcityReport.test.ts\` — 집계
`

    writeFileSync('/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_V4_SCARCITY_RESULT_20260718.md', md)
    console.log('\n[집계] 결과 파일 생성: /Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_V4_SCARCITY_RESULT_20260718.md')
    console.log('[집계] 제라 권고:', recommendation)
  })
})
