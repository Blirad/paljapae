/**
 * v3R12AblationSim.test.ts
 * balance-v3 R12 — 연환 어블레이션 (enableYeonhwan=false, 1000판 × 3종)
 *
 * 목적: 연환 비활성화 시 클리어율 측정 → 인과 방향 판정 (의존 vs 상관)
 *
 * 구현:
 *   OHANG_YEONHWAN_MULTIPLIER를 0으로 임시 설정한 상태에서 이 파일 실행.
 *   연환 배율 0 = 연환 조합이 성립해도 데미지 0 (사실상 연환 없는 상태 재현)
 *
 * 시드: i×12345+7777 (i=0~999)
 * 커밋 기준: 632c30a (balance-v3 고정)
 *
 * 작업 2 — 연환 데미지 비중 분포:
 *   현행 ×8 상태에서 연환 횟수 × 추정 baseScore로 연환 기여분 추정.
 *   총 데미지는 층별 HP 감소량으로 역산 (fullCapBot traitCounts 기반 추정).
 *
 * 주의: 이 파일 실행 전 balance.ts의 OHANG_YEONHWAN_MULTIPLIER를 0으로 임시 변경.
 *       실행 후 반드시 8로 복원할 것.
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import { OHANG_YEONHWAN_MULTIPLIER } from '../engine/balance'

function wilsonCI(successes: number, total: number) {
  const p = successes / total
  const z = 1.96
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    point: p,
  }
}

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

// R11 §3 기준선 (1000판, ×8 현행)
const BASELINE_R11_1000 = {
  '목화': 38.50,
  '금수': 36.60,
  '토단일': 26.30,
}

describe(`balance-v3 R12 — 연환 어블레이션 (×${OHANG_YEONHWAN_MULTIPLIER}, 1000판 × 3종)`, () => {
  it(
    `R12: enableYeonhwan=false 어블레이션 (OHANG_YEONHWAN_MULTIPLIER=×${OHANG_YEONHWAN_MULTIPLIER})`,
    { timeout: 300000 },
    () => {
      const RUNS = 1000

      interface PresetResult {
        label: string
        selectedTalismans: string[]
        cleared: number
        total: number
        ci: ReturnType<typeof wilsonCI>
        deathsByFloor: Record<number, number>
        yeonhwanCount: number
        // 연환 발생 여부별 승률 추적
        yeonhwanWins: number
        yeonhwanGames: number
        noYeonhwanWins: number
        noYeonhwanGames: number
        traitCounts: Record<string, number>
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        let yeonhwanCount = 0
        let yeonhwanWins = 0
        let yeonhwanGames = 0
        let noYeonhwanWins = 0
        let noYeonhwanGames = 0
        const traitCounts: Record<string, number> = {}

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const r = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds: selectedTalismans,
            enableFloorReward: true,
            enableEffectMode: true,
          })

          if (r.victory) {
            cleared++
          } else if (r.deathFloor !== null) {
            deathsByFloor[r.deathFloor] = (deathsByFloor[r.deathFloor] ?? 0) + 1
          }

          if (r.traitCounts) {
            for (const [k, v] of Object.entries(r.traitCounts)) {
              traitCounts[k] = (traitCounts[k] ?? 0) + v
              if (k === 'ohang-yeonhwan') yeonhwanCount += v
            }

            const gameYeonhwan = r.traitCounts['ohang-yeonhwan'] ?? 0
            if (gameYeonhwan > 0) {
              yeonhwanGames++
              if (r.victory) yeonhwanWins++
            } else {
              noYeonhwanGames++
              if (r.victory) noYeonhwanWins++
            }
          }
        }

        results.push({
          label: preset.label,
          selectedTalismans,
          cleared,
          total: RUNS,
          ci: wilsonCI(cleared, RUNS),
          deathsByFloor,
          yeonhwanCount,
          yeonhwanWins,
          yeonhwanGames,
          noYeonhwanWins,
          noYeonhwanGames,
          traitCounts,
        })
      }

      // ─── 출력 ────────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(70))
      console.log('balance-v3 R12 — 연환 어블레이션 (enableYeonhwan=false)')
      console.log(`OHANG_YEONHWAN_MULTIPLIER=×${OHANG_YEONHWAN_MULTIPLIER} | 1000판 × 3종`)
      console.log('='.repeat(70))

      // §1: 클리어율 + 기준선 비교
      console.log('\n[§1] 클리어율 + Wilson 95% CI\n')
      console.log('| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | ±CI |')
      console.log('|--------|--------|----------|---------|---------|-----|')
      for (const r of results) {
        const ciW = ((r.ci.high - r.ci.low) * 100 / 2).toFixed(2)
        console.log(
          `| ${r.label.padEnd(6)} | ${r.cleared}/${r.total} ` +
          `| ${(r.ci.point * 100).toFixed(2).padStart(7)}% ` +
          `| ${(r.ci.low * 100).toFixed(2).padStart(6)}% ` +
          `| ${(r.ci.high * 100).toFixed(2).padStart(6)}% ` +
          `| ±${ciW}%p |`
        )
      }

      // §1-비교: R11 기준선(1000판, ×8) vs 어블레이션(×0)
      console.log('\n[§1-비교] R11 기준선(×8, 1000판) vs 어블레이션(×0)\n')
      console.log('| 프리셋 | R11 기준선(×8) | 어블레이션(×0) | 변화 |')
      console.log('|--------|---------------|----------------|------|')
      for (const r of results) {
        const baseline = BASELINE_R11_1000[r.label as keyof typeof BASELINE_R11_1000]
        const actual = r.ci.point * 100
        const delta = actual - baseline
        console.log(
          `| ${r.label.padEnd(6)} | ${baseline.toFixed(2)}% | ${actual.toFixed(2)}% ` +
          `| ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p |`
        )
      }

      // §2: 연환 발생 여부별 승률 (배율=0이므로 연환 조합은 성립하지만 데미지 0)
      console.log('\n[§2] 연환 조합 성립 여부별 승률 (배율=0 어블레이션)\n')
      console.log('| 프리셋 | 연환 조합 성립 시 승률 | 미성립 시 승률 | 차이 |')
      console.log('|--------|----------------------|----------------|------|')
      for (const r of results) {
        const winRateYeonhwan = r.yeonhwanGames > 0
          ? (r.yeonhwanWins / r.yeonhwanGames * 100).toFixed(2)
          : 'N/A'
        const winRateNo = r.noYeonhwanGames > 0
          ? (r.noYeonhwanWins / r.noYeonhwanGames * 100).toFixed(2)
          : 'N/A'
        const diff = (r.yeonhwanGames > 0 && r.noYeonhwanGames > 0)
          ? ((r.yeonhwanWins / r.yeonhwanGames - r.noYeonhwanWins / r.noYeonhwanGames) * 100).toFixed(2)
          : 'N/A'
        console.log(
          `| ${r.label.padEnd(6)} | ${winRateYeonhwan}% (n=${r.yeonhwanGames}) ` +
          `| ${winRateNo}% (n=${r.noYeonhwanGames}) | ${diff}%p |`
        )
      }

      // §3: 연환 발생률 (배율=0에서도 조합 성립 횟수는 측정됨)
      console.log('\n[§3] 연환 조합 성립률 (배율=0 어블레이션)\n')
      console.log('| 프리셋 | 연환 총합 | 성립률/판 | 성립 게임 수 |')
      console.log('|--------|-----------|-----------|------------|')
      for (const r of results) {
        const perRun = (r.yeonhwanCount / r.total).toFixed(3)
        console.log(
          `| ${r.label.padEnd(6)} | ${r.yeonhwanCount.toString().padStart(8)} ` +
          `| ${perRun.padStart(8)}회/판 ` +
          `| ${r.yeonhwanGames}판(${(r.yeonhwanGames / r.total * 100).toFixed(1)}%) |`
        )
      }

      // §4: 층별 사망 분포
      console.log('\n[§4] 층별 사망 분포 (어블레이션)\n')
      console.log('| 프리셋 | 1층 | 2층 | 3층 | 4층 | 클리어 |')
      console.log('|--------|-----|-----|-----|-----|--------|')
      for (const r of results) {
        console.log(
          `| ${r.label.padEnd(6)} ` +
          `| ${r.deathsByFloor[1] ?? 0} ` +
          `| ${r.deathsByFloor[2] ?? 0} ` +
          `| ${r.deathsByFloor[3] ?? 0} ` +
          `| ${r.deathsByFloor[4] ?? 0} ` +
          `| ${r.cleared} |`
        )
      }

      // §5: 인과 방향 판정
      console.log('\n[§5] 인과 방향 판정\n')
      console.log(`현행 OHANG_YEONHWAN_MULTIPLIER = ×${OHANG_YEONHWAN_MULTIPLIER}`)
      console.log('※ OHANG_YEONHWAN_MULTIPLIER=0이면 어블레이션 (연환 없는 상태)')
      console.log('※ OHANG_YEONHWAN_MULTIPLIER=8이면 현행 기준선')
      console.log('')

      for (const r of results) {
        const baseline = BASELINE_R11_1000[r.label as keyof typeof BASELINE_R11_1000]
        const actual = r.ci.point * 100
        const delta = actual - baseline
        const judgement = actual < 15
          ? '10%대 붕괴 → 의존 확정 증거'
          : actual >= 25 && actual <= 35
          ? '25~35% 유지 → 상관 증거'
          : actual < 25
          ? '25% 미만 하락 → 의존 경향'
          : '35% 초과 → 추가 분석 필요'
        console.log(`${r.label}: ${actual.toFixed(2)}% (R11 기준선 ${baseline}%, 변화 ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p) → ${judgement}`)
      }

      // §6: 가호 선택
      console.log('\n[§6] 가호 선택\n')
      for (const r of results) {
        console.log(`${r.label}: ${r.selectedTalismans.join(' + ')}`)
      }

      console.log('\n' + '='.repeat(70))
      console.log('R12 어블레이션 완료')
      console.log(`OHANG_YEONHWAN_MULTIPLIER=×${OHANG_YEONHWAN_MULTIPLIER} 확인 필수`)
      console.log('실행 후 balance.ts를 ×8로 복원할 것')
      console.log('='.repeat(70))

      // 검증
      for (const r of results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared).toBeGreaterThanOrEqual(0)
        expect(r.cleared).toBeLessThanOrEqual(RUNS)
      }

      console.log('\n판정: PASS')
    },
  )
})
