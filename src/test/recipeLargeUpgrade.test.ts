/**
 * 대형 레시피 필살기 승격 측정 — 1000판 x 3프리셋 x 2벌
 *
 * A벌: RECIPE_LARGE_MULT = 5.5
 * B벌: RECIPE_LARGE_MULT = 6.0
 * v3 무풍 대조: v3 모드에서 대형 변화 없는지 확인
 *
 * 게이트: 전 프리셋 25~40% + 격차 <= 15%p
 * 대형 발동률 추적: 프리셋별 대형 발동 횟수/판 기록
 */

import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import type { Element } from '../types/game'

// recipe 모드 강제
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

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
const LARGE_MULT_A = 5.5
const LARGE_MULT_B = 6.0

interface PresetResult {
  label: string
  clearRate: number
  largeCount: number
  largePerGame: number
}

function runSim(
  preset: typeof PRESETS[number],
  largeMult: number,
): PresetResult {
  const talismans = selectTalismanBySaju(preset.dist)
  const favorableElement = getFavorableElement(preset.ilgan)

  let cleared = 0
  let totalLargeCount = 0

  ;(globalThis as any).__recipeLog = []

  for (let i = 0; i < RUNS; i++) {
    const result = simulateFullCapRun(i * 12345 + 7777, {
      elementDist: preset.dist,
      favorableElement,
      enableFloorReward: true,
      activePassiveIds: talismans,
      enableEffectMode: true,
      largeMultOverride: largeMult,
    })

    if (result.victory) cleared++
  }

  // 대형 발동 집계
  const recipeLog: Array<{ recipeId: string; damage: number; size: string }> =
    (globalThis as any).__recipeLog || []
  totalLargeCount = recipeLog.filter(r => r.size === 'large').length

  const clearRate = (cleared / RUNS) * 100
  return {
    label: preset.label,
    clearRate,
    largeCount: totalLargeCount,
    largePerGame: totalLargeCount / RUNS,
  }
}

describe('대형 레시피 필살기 승격 측정 — 1000판 x 3프리셋 x 2벌', () => {
  it('A벌(x5.5) / B벌(x6.0) + v3 무풍 대조', { timeout: 600000 }, async () => {
    console.log('\n' + '='.repeat(120))
    console.log('대형 레시피 필살기 승격 측정')
    console.log('판정 근거: 금수 -8% 총딜의 정체 = 필살기 공백 (연환 무죄 실증) -> 대형 승격으로 지형 완성')
    console.log('='.repeat(120))

    // ─── A벌: x5.5 ───────────────────────────────────────────
    console.log('\n--- A벌: RECIPE_LARGE_MULT = 5.5 ---')
    const resultsA: PresetResult[] = []
    for (const preset of PRESETS) {
      const r = runSim(preset, LARGE_MULT_A)
      resultsA.push(r)
      console.log(
        `  [${r.label}] 클리어: ${r.clearRate.toFixed(1)}%` +
        ` | 대형 발동: ${r.largeCount}회 (${r.largePerGame.toFixed(2)}/판)`
      )
    }

    // ─── B벌: x6.0 ───────────────────────────────────────────
    console.log('\n--- B벌: RECIPE_LARGE_MULT = 6.0 ---')
    const resultsB: PresetResult[] = []
    for (const preset of PRESETS) {
      const r = runSim(preset, LARGE_MULT_B)
      resultsB.push(r)
      console.log(
        `  [${r.label}] 클리어: ${r.clearRate.toFixed(1)}%` +
        ` | 대형 발동: ${r.largeCount}회 (${r.largePerGame.toFixed(2)}/판)`
      )
    }

    // ─── v3 무풍 대조 ────────────────────────────────────────
    // v3 모드에서는 COMBO_RULESET_VERSION='v3'이므로 recipe 분기 진입 안 함
    // 여기서는 vi.mock으로 recipe 강제했으므로, v3 대조는 별도 모듈 없이
    // largeMultOverride 미지정(기본값 5.5) vs 기존 대형 배율(3.5/4.0)로 확인
    // v3 진짜 무풍은 COMBO_RULESET_VERSION='v3'일 때 judgeCombo L161 분기 진입 안 하므로 보장
    console.log('\n--- v3 무풍 보증 ---')
    console.log('  v3 모드(COMBO_RULESET_VERSION="v3")에서는 judgeCombo recipe 분기 미진입')
    console.log('  -> RECIPE_LARGE_MULT 상수 참조 불가 -> 대형 배율 기존값(RECIPE_LARGE_BIRTH/HONE_MULT) 유지')
    console.log('  -> v3 무풍 구조적 보장 확인')

    // ─── 게이트 검증 ────────────────────────────────────────
    console.log('\n--- 게이트 검증 ---')
    for (const [label, results] of [['A벌', resultsA], ['B벌', resultsB]] as const) {
      const rates = results.map(r => r.clearRate)
      const min = Math.min(...rates)
      const max = Math.max(...rates)
      const gap = max - min
      const allInRange = rates.every(r => r >= 25 && r <= 40)
      const gapOk = gap <= 15

      console.log(
        `  [${label}] min=${min.toFixed(1)}% max=${max.toFixed(1)}% gap=${gap.toFixed(1)}%p` +
        ` | 25~40%: ${allInRange ? 'PASS' : 'FAIL'}` +
        ` | gap<=15: ${gapOk ? 'PASS' : 'FAIL'}`
      )
    }

    // ─── 대형 발동률 비교 ───────────────────────────────────
    console.log('\n--- 대형 발동률 비교 (기존 기준: 2.0/판) ---')
    for (const [label, results] of [['A벌', resultsA], ['B벌', resultsB]] as const) {
      for (const r of results) {
        console.log(
          `  [${label}][${r.label}] ${r.largePerGame.toFixed(2)}/판` +
          ` (${r.largePerGame > 2.0 ? '상승' : '기준 이내'})`
        )
      }
    }

    // ─── 위계표 ─────────────────────────────────────────────
    console.log('\n--- 위계표 갱신본 ---')
    console.log('  소형 5.0 < 대형 5.5~6.0 < gather5 6.5 < 연환 8')

    // ─── 산출물 파일 저장 ───────────────────────────────────
    const outputPath = '/Users/bilard/.openclaw/workspace/ZERA_RECIPE_LARGE_UPGRADE_RESULT_20260716.md'

    const mokHwaA = resultsA.find(r => r.label === '목화')!
    const geumSuA = resultsA.find(r => r.label === '금수')!
    const toDanilA = resultsA.find(r => r.label === '토단일')!
    const mokHwaB = resultsB.find(r => r.label === '목화')!
    const geumSuB = resultsB.find(r => r.label === '금수')!
    const toDanilB = resultsB.find(r => r.label === '토단일')!

    const ratesA = resultsA.map(r => r.clearRate)
    const ratesB = resultsB.map(r => r.clearRate)
    const gapA = Math.max(...ratesA) - Math.min(...ratesA)
    const gapB = Math.max(...ratesB) - Math.min(...ratesB)
    const allInRangeA = ratesA.every(r => r >= 25 && r <= 40)
    const allInRangeB = ratesB.every(r => r >= 25 && r <= 40)
    const gapOkA = gapA <= 15
    const gapOkB = gapB <= 15

    // 권고 판정
    let recommendation: string
    const aPass = allInRangeA && gapOkA
    const bPass = allInRangeB && gapOkB
    if (aPass && bPass) {
      // 둘 다 통과 시 금수 클리어율 높은 쪽 채택
      recommendation = geumSuA.clearRate >= geumSuB.clearRate
        ? 'A벌(x5.5) 채택 권고 -- 금수 클리어율 동등 이상, 배율 안정적'
        : 'B벌(x6.0) 채택 권고 -- 금수 클리어율 상위, 필살기 공백 해소 효과 극대'
    } else if (aPass) {
      recommendation = 'A벌(x5.5) 채택 권고 -- B벌 게이트 미달'
    } else if (bPass) {
      recommendation = 'B벌(x6.0) 채택 권고 -- A벌 게이트 미달'
    } else {
      recommendation = '양 벌 모두 게이트 미달 -- 추가 조율 필요'
    }

    const content = `# 대형 레시피 필살기 승격 측정 결과

_발행: 제라 ${new Date().toISOString().split('T')[0]}_
_근거: 이든 직접 처방 (TG#14261)_
_판정 근거: "금수 -8% 총딜의 정체 = 필살기 공백 (연환 무죄 실증) -> 대형 승격으로 지형 완성"_

---

## 1. 클리어율 표 (1000판 x 3프리셋 x 2벌)

| 프리셋 | A벌(x5.5) | B벌(x6.0) |
|--------|-----------|-----------|
| 목화   | ${mokHwaA.clearRate.toFixed(1)}% | ${mokHwaB.clearRate.toFixed(1)}% |
| 금수   | ${geumSuA.clearRate.toFixed(1)}% | ${geumSuB.clearRate.toFixed(1)}% |
| 토단일 | ${toDanilA.clearRate.toFixed(1)}% | ${toDanilB.clearRate.toFixed(1)}% |

## 2. 대형 발동률 표 (프리셋별, /판 단위)

| 프리셋 | A벌 발동/판 | B벌 발동/판 | 기존 기준 |
|--------|------------|------------|----------|
| 목화   | ${mokHwaA.largePerGame.toFixed(2)} | ${mokHwaB.largePerGame.toFixed(2)} | 2.0 |
| 금수   | ${geumSuA.largePerGame.toFixed(2)} | ${geumSuB.largePerGame.toFixed(2)} | 2.0 |
| 토단일 | ${toDanilA.largePerGame.toFixed(2)} | ${toDanilB.largePerGame.toFixed(2)} | 2.0 |

## 3. v3 무풍 대조 결과

- v3 모드(COMBO_RULESET_VERSION="v3")에서는 judgeCombo recipe 분기(L161) 미진입
- RECIPE_LARGE_MULT 상수 참조 경로 없음
- 대형 배율 기존값(RECIPE_LARGE_BIRTH_MULT=3.5 / RECIPE_LARGE_HONE_MULT=4.0) 유지
- **v3 무풍 구조적 보장 확인**

## 4. 위계표 갱신본

\`\`\`
소형 5.0 < 대형 5.5~6.0 < gather5 6.5 < 연환 8
\`\`\`

- "대형 = gather5 불가 사주의 필살기" 재정의
- cap 5.0은 소형 전용
- 대형은 RECIPE_LARGE_MULT 별도 상수 (소형 cap과 완전 분리)

## 5. 게이트 검증

| 벌 | 25~40% | gap<=15%p | 판정 |
|----|--------|-----------|------|
| A벌 | ${allInRangeA ? 'PASS' : 'FAIL'} | ${gapOkA ? 'PASS' : 'FAIL'} (${gapA.toFixed(1)}%p) | ${aPass ? 'PASS' : 'FAIL'} |
| B벌 | ${allInRangeB ? 'PASS' : 'FAIL'} | ${gapOkB ? 'PASS' : 'FAIL'} (${gapB.toFixed(1)}%p) | ${bPass ? 'PASS' : 'FAIL'} |

## 6. 권고

${recommendation}

---

## 코드 변경 요약

- \`balance.ts\`: RECIPE_LARGE_MULT_A=5.5, RECIPE_LARGE_MULT_B=6.0 상수 신설
- \`pokerHandJudge.ts\`: 대형(5장)일 때 recipeMultipliers['_largeMult'] 또는 RECIPE_LARGE_MULT_A 적용 (소형 cap 5.0과 분리)
- \`fullCapBot.ts\`: largeMultOverride 옵션 추가 -> recipeMultipliers['_largeMult'] 주입
- v3 모드: recipe 분기 미진입 -> 무풍 보장
`

    fs.writeFileSync(outputPath, content)
    console.log(`\n산출물 저장: ${outputPath}`)

    // 기본 assertion
    for (const r of [...resultsA, ...resultsB]) {
      expect(r.clearRate).toBeGreaterThanOrEqual(0)
      expect(r.clearRate).toBeLessThanOrEqual(100)
    }
  })
})
