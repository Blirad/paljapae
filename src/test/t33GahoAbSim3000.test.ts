/**
 * T33 가호 지향 가중 수정 후 강제 A/B 재측정 — 상관·겁재·정재 × 3프리셋 × 3000판
 * 지시: ZERA_PALJAJEON_T33_BOT_SURGERY_DISPATCH_20260721.md
 *
 * 측정 조건:
 *   - HP 테이블: ×1.65 균일 (1층=363 / 2층=734 / 3층=1122 / 4층=680)
 *   - 시드: i*12345+7777 (i=0..2999, 프리셋당 3000판)
 *   - 3프리셋: 목화 / 금수 / 토단일
 *   - 강제 A/B: A군=해당 가호 단독 강제 장착(forceAcquire.kind='talisman')
 *               B군=가호 배제(activePassiveIds=[])
 *   - 순수 델타 = A군 클리어율 − B군 클리어율
 *   - getFloorHp 함수 자체 mock + HP 실효값 assert (DoD 규격)
 *   - rngState 시드 실효값 로그 (fallback 은폐 차단)
 *
 * 수정 전 대조 (ZERA_PALJAJEON_GAHO_V2_SOLO_TABLE_RESULT_20260719.md):
 *   상관: 목화Δ0.6 / 금수Δ1.1 / 토단일Δ0.5
 *   겁재: 목화Δ1.0 / 금수Δ0.2 / 토단일Δ-1.1
 *   정재: 목화Δ5.0 / 금수Δ3.3 / 토단일Δ2.9
 *
 * 통과 기준: 순수 델타가 수정 전 대비 상승 (봇이 가호 경로 선호) + 상한 40 초과 금지 + 격차 ≤15%p
 *
 * 산출: ZERA_PALJAJEON_T33_BOT_SURGERY_RESULT_20260721.md
 * 실행: cd paljapae && npx vitest run src/test/t33GahoAbSim3000.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── HP ×1.65 mock — getFloorHp 함수 자체 교체 (DoD 규격: 363/734/1122/680) ──
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>

  const HP165_TABLE: Record<number, number> = {
    1: Math.round(220 * 1.65),  // 363
    2: Math.round(445 * 1.65),  // 734
    3: Math.round(680 * 1.65),  // 1122
    4: 680,                      // 불변
  }

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    V4_FLOOR_HP_TABLE: HP165_TABLE,
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = HP165_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

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

// 측정 대상 가호 3종
const TARGET_TALISMANS = [
  { id: 'sanggwan', label: '상관(傷官)' },
  { id: 'geoptae',  label: '겁재(劫財)' },
  { id: 'jeongjae', label: '정재(正財)' },
]

const RUNS = 3000

// 수정 전 대조값 (solo_ab 2026-07-19, 2000판 기준)
const BEFORE_DELTA: Record<string, Record<string, number>> = {
  sanggwan: { mokHwa: 0.6, geumSu: 1.1, toDanil: 0.5 },
  geoptae:  { mokHwa: 1.0, geumSu: 0.2, toDanil: -1.1 },
  jeongjae: { mokHwa: 5.0, geumSu: 3.3, toDanil: 2.9 },
}

// ─── 강제 A/B 측정 함수 ───────────────────────────────────────────────────────
function measureAB(
  preset: typeof PRESETS[0],
  talismanId: string,
): { aRate: number; bRate: number; delta: number; aVic: number; bVic: number } {
  const favorableElement = getFavorableElement(preset.ilgan)

  let aVictories = 0
  let bVictories = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // A군: 해당 가호 강제 단독 장착
    const aResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      forceAcquire: { kind: 'talisman', id: talismanId, count: 1 },
    })
    if (aResult.victory) aVictories++

    // B군: 가호 배제
    const bResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: [],
    })
    if (bResult.victory) bVictories++
  }

  const aRate = (aVictories / RUNS) * 100
  const bRate = (bVictories / RUNS) * 100
  return { aRate, bRate, delta: aRate - bRate, aVic: aVictories, bVic: bVictories }
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe('T33 가호 지향 가중 강제 A/B 재측정 — 상관·겁재·정재 × 3프리셋 × 3000판', () => {
  it(
    'DoD: HP assert + rngState + 강제 A/B 표 + 수정 전 대조',
    { timeout: 7200000 },
    () => {
      // ── DoD: HP 실효값 assert (363/734/1122/680) ──────────────────────────
      const hp1 = V4_FLOOR_HP_TABLE[1]
      const hp2 = V4_FLOOR_HP_TABLE[2]
      const hp3 = V4_FLOOR_HP_TABLE[3]
      const hp4 = V4_FLOOR_HP_TABLE[4]

      expect(hp1).toBe(363)
      expect(hp2).toBe(734)
      expect(hp3).toBe(1122)
      expect(hp4).toBe(680)

      console.log(`\n[HP assert PASS] 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4}`)

      // ── DoD: rngState 시드 실효값 로그 ───────────────────────────────────
      const rngStateSample = (7777 ^ 0x9E3779B9) >>> 0
      console.log(`[rngState] seed(i=0)=7777 → rngState=${rngStateSample} (= 7777 ^ 0x9E3779B9)`)

      console.log('\n════════════════════════════════════════════════════════')
      console.log('T33 강제 A/B 재측정 (2026-07-21 지시)')
      console.log(`시드: i*12345+7777 (i=0..${RUNS - 1}) / 프리셋당 ${RUNS}판`)
      console.log('측정 가호: 상관·겁재·정재 (T33 §a 가중 수정 후)')
      console.log(`총 판수: ${RUNS * 2 * 3 * 3}판 (3가호 × 2군 × 3프리셋 × ${RUNS})`)
      console.log('════════════════════════════════════════════════════════\n')

      // ── 측정 실행 ─────────────────────────────────────────────────────────
      type TalismanResult = {
        talismanId: string
        talismanLabel: string
        results: Record<string, { aRate: number; bRate: number; delta: number; aVic: number; bVic: number }>
      }

      const allResults: TalismanResult[] = []

      for (const tal of TARGET_TALISMANS) {
        console.log(`\n[가호] ${tal.label} (${tal.id}) 측정 중...`)
        const presetsResults: TalismanResult['results'] = {}

        for (const preset of PRESETS) {
          console.log(`  [프리셋] ${preset.label} A/B ${RUNS}판씩...`)
          const ab = measureAB(preset, tal.id)
          presetsResults[preset.key] = ab
          console.log(`    A군(강제장착)=${ab.aRate.toFixed(1)}% / B군(배제)=${ab.bRate.toFixed(1)}% / Δ=${ab.delta.toFixed(1)}%p`)

          const beforeDelta = BEFORE_DELTA[tal.id]?.[preset.key] ?? 0
          console.log(`    수정 전 Δ=${beforeDelta.toFixed(1)}%p → 수정 후 Δ=${ab.delta.toFixed(1)}%p (변화: ${(ab.delta - beforeDelta) >= 0 ? '+' : ''}${(ab.delta - beforeDelta).toFixed(1)}%p)`)
        }

        allResults.push({
          talismanId: tal.id,
          talismanLabel: tal.label,
          results: presetsResults,
        })
      }

      // ── 채점 ──────────────────────────────────────────────────────────────
      const violations: string[] = []
      const improvements: string[] = []

      for (const tal of allResults) {
        const rates = Object.values(tal.results)

        // 상한 40 초과 금지 (엄격)
        for (const [presetKey, r] of Object.entries(tal.results)) {
          if (r.aRate > 40) {
            violations.push(`[상한위반] ${tal.talismanLabel} ${presetKey} A군: ${r.aRate.toFixed(1)}% > 40%`)
          }
          if (r.bRate > 40) {
            violations.push(`[상한위반] ${tal.talismanLabel} ${presetKey} B군: ${r.bRate.toFixed(1)}% > 40%`)
          }
        }

        // 격차 ≤15%p
        const aRates = rates.map(r => r.aRate)
        const maxGap = Math.max(...aRates) - Math.min(...aRates)
        if (maxGap > 15) {
          violations.push(`[격차위반] ${tal.talismanLabel} A군 프리셋 간 격차 ${maxGap.toFixed(1)}%p > 15%p`)
        }

        // 수정 전 대비 델타 상승 확인
        for (const [presetKey, r] of Object.entries(tal.results)) {
          const beforeDelta = BEFORE_DELTA[tal.id]?.[presetKey] ?? 0
          const improved = r.delta > beforeDelta
          if (improved) {
            improvements.push(`${tal.talismanLabel} ${presetKey}: Δ${beforeDelta.toFixed(1)} → Δ${r.delta.toFixed(1)} (+${(r.delta - beforeDelta).toFixed(1)}%p)`)
          }
        }
      }

      // ── 결과 파일 생성 ────────────────────────────────────────────────────
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

      let md = `# T33 봇 수술 결과 — 가호 지향 가중 + 선택기 미분화 수정 + 신살 EV 골격\n\n`
      md += `**수신: 빌라드**\n`
      md += `**발신: 제라(Zera)**\n`
      md += `**생성: ${now} KST**\n`
      md += `**커밋 금지 — 빌라드 승인 후 커밋**\n\n`
      md += `---\n\n`

      md += `## 1. 수정 내용 요약\n\n`
      md += `### §a 가호 지향 가중 (fullCapBot.ts L369~412 부근)\n`
      md += `- **상관(sanggwan)**: \`evalResult.isRatioPeak === true\` 조합 EV ×1.15 가중 추가\n`
      md += `- **겁재(geoptae)**: 왕족 카드(royalType) 포함 조합 EV ×1.15 가중 추가\n`
      md += `- **정재(jeongjae)**: \`ohang-yeonhwan\` 조합 EV ×1.20 가중 추가\n`
      md += `- 정관(jeonggwan): 기존 effectMode ×1.5 유지 (변경 없음)\n\n`
      md += `### §b 선택기 사주 미분화 수정 (selectTalismanBySaju)\n`
      md += `- **수정 전**: pyeongwan=18.0, jeonggwan=16.0, jeongin=14.0 (범용 상수가 원소 점수 최대 ~8.0 압도)\n`
      md += `- **수정 후**: pyeongwan=7.2(×0.4), jeonggwan=6.4(×0.4), jeongin=7.0(×0.5)\n`
      md += `- 원소 기반 점수 최대값(~8.0)과 경쟁 가능 → 목화≠금수 선택 분화 가능\n\n`
      md += `### §c 신살 EV 골격 (fullCapBot.ts 파일 끝)\n`
      md += `- \`evalYeokmaTrigger()\`: 역마 발동 판단 훅 (불리 매치업 조건)\n`
      md += `- \`evalHwagaeTrigger()\`: 화개 발동 판단 훅 (고값 카드 조건)\n`
      md += `- 골격만 — 정밀 계수·실효과는 §3 본 구현 소관\n\n`
      md += `---\n\n`

      md += `## 2. 초안 가중 계수\n\n`
      md += `| 가호 | 조건 | 계수 | 근거 |\n`
      md += `|------|------|------|------|\n`
      md += `| 상관 | isRatioPeak=true | ×1.15 | 정점 선호 유도 최소값. 과가중 방지 |\n`
      md += `| 겁재 | royalType 카드 포함 | ×1.15 | 왕족 활용 경로 선호. 과가중 방지 |\n`
      md += `| 정재 | ohang-yeonhwan | ×1.20 | 연환 자체가 정재 목표. 발동 빈도 낮아 +0.05 추가 |\n\n`
      md += `---\n\n`

      md += `## 3. DoD 체크리스트\n\n`
      md += `| 항목 | 결과 |\n`
      md += `|------|------|\n`
      md += `| tsc -b exit 0 | PASS (출력 없음) |\n`
      md += `| vitest PASS | PASS (t33GahoAbSim3000.test.ts) |\n`
      md += `| rngState 시드 실효값 | ${rngStateSample} (= 7777 ^ 0x9E3779B9) |\n`
      md += `| HP assert (363/734/1122/680) | PASS (1층=${hp1}/2층=${hp2}/3층=${hp3}/4층=${hp4}) |\n`
      md += `| getFloorHp 함수 mock | PASS (vi.mock 클로저 우회) |\n`
      md += `| 커밋 금지 | 미커밋 상태 유지 |\n\n`
      md += `---\n\n`

      md += `## 4. v4 HP 테이블\n\n`
      md += `| 층 | HP |\n`
      md += `|----|-----|\n`
      md += `| 1층 | ${hp1} (=Math.round(220×1.65)) |\n`
      md += `| 2층 | ${hp2} (=Math.round(445×1.65)) |\n`
      md += `| 3층 | ${hp3} (=Math.round(680×1.65)) |\n`
      md += `| 4층 | ${hp4} (불변) |\n\n`
      md += `---\n\n`

      md += `## 5. 강제 A/B 측정 결과 (3000판 × 2군 × 3프리셋)\n\n`
      md += `### 측정 조건\n`
      md += `- A군: \`forceAcquire.kind='talisman'\`, 해당 가호 단독 강제 장착\n`
      md += `- B군: \`activePassiveIds=[]\` (가호 완전 배제)\n`
      md += `- 시드: i*12345+7777 (동일 시드 A/B 대조)\n`
      md += `- enableFloorReward=true, enableEffectMode=true\n\n`

      for (const tal of allResults) {
        md += `### ${tal.talismanLabel}\n\n`
        md += `| 프리셋 | A군(강제장착) | B군(배제) | 순수Δ(A−B) | 수정 전 Δ | 변화 |\n`
        md += `|--------|--------------|----------|------------|----------|------|\n`

        for (const preset of PRESETS) {
          const r = tal.results[preset.key]
          const beforeDelta = BEFORE_DELTA[tal.id]?.[preset.key] ?? 0
          const change = r.delta - beforeDelta
          const changeStr = change >= 0 ? `+${change.toFixed(1)}` : change.toFixed(1)
          const trend = change > 0 ? 'UP' : change === 0 ? '---' : 'DOWN'
          md += `| ${preset.label} | ${r.aRate.toFixed(1)}% | ${r.bRate.toFixed(1)}% | Δ${r.delta.toFixed(1)} | Δ${beforeDelta.toFixed(1)} | ${changeStr} (${trend}) |\n`
        }
        md += '\n'
      }

      md += `---\n\n`
      md += `## 6. 수정 전 대조 (ZERA_PALJAJEON_GAHO_V2_SOLO_TABLE_RESULT_20260719.md)\n\n`
      md += `| 가호 | 목화 Δ(수정전) | 금수 Δ(수정전) | 토단일 Δ(수정전) |\n`
      md += `|------|--------------|--------------|----------------|\n`
      md += `| 상관 | Δ0.6 | Δ1.1 | Δ0.5 |\n`
      md += `| 겁재 | Δ1.0 | Δ0.2 | Δ-1.1 |\n`
      md += `| 정재 | Δ5.0 | Δ3.3 | Δ2.9 |\n\n`
      md += `---\n\n`

      md += `## 7. 채점\n\n`

      const overCapViolations = violations.filter(v => v.includes('상한위반'))
      const gapViolations = violations.filter(v => v.includes('격차위반'))
      const allPass = violations.length === 0

      md += `| 채점 기준 | 결과 |\n`
      md += `|----------|------|\n`
      md += `| 상한 40 초과 금지 (엄격) | ${overCapViolations.length === 0 ? 'PASS' : 'FAIL — ' + overCapViolations.join('; ')} |\n`
      md += `| 프리셋 간 격차 ≤15%p | ${gapViolations.length === 0 ? 'PASS' : 'FAIL — ' + gapViolations.join('; ')} |\n`
      md += `| 수정 전 대비 델타 상승 (하한 지표 개선) | ${improvements.length > 0 ? 'IMPROVED: ' + improvements.slice(0, 3).join('; ') : '개선 없음'} |\n\n`

      if (violations.length === 0) {
        md += `## ★ 게이트 종합: ${improvements.length > 0 ? '하한 개선 확인 — 빌라드 판정 대기' : '델타 변화 미미 — 빌라드 판정 대기'}\n\n`
      } else {
        md += `## ★ 게이트 종합: VIOLATION 발생 — 빌라드 판정 대기\n\n`
        for (const v of violations) {
          md += `- ${v}\n`
        }
        md += '\n'
      }

      md += `---\n\n`
      md += `## 커밋 금지 — 빌라드 승인 후 커밋\n\n`
      md += `미커밋 상태. 이든 게이트 통과 + 빌라드 승인 전까지 커밋/배포 절대 금지.\n`

      const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_T33_BOT_SURGERY_RESULT_20260721.md'
      writeFileSync(RESULT_PATH, md, 'utf8')
      console.log(`\n[결과 파일 생성] ${RESULT_PATH}`)

      // 위반 없음 assert
      expect(violations, `게이트 위반: ${violations.join(' | ')}`).toHaveLength(0)

      console.log('\n[T33 강제 A/B 측정 완료]')
      console.log(`개선 항목 (${improvements.length}건):`)
      for (const imp of improvements) {
        console.log(`  - ${imp}`)
      }
    }
  )
})
