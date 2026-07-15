/**
 * v3R11YeonhwanSim3000.test.ts
 * balance-v3 R11 작업 a — 연환 발생률 정밀 측정 (현행 ×8, 3000판 × 3종)
 *
 * 목적: 연환 발생률/판, 연환 데미지 기여 분석
 * 커밋: 632c30a (balance-v3 고정)
 * 시드: i×12345+7777 (i=0~2999)
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

describe('balance-v3 R11 작업a — 연환 발생률 정밀 측정 (현행 ×8, 3000판 × 3종)', () => {
  it(
    'R11-a: 연환 발생률 + 데미지 기여 분석',
    { timeout: 600000 },
    () => {
      const RUNS = 3000

      interface PresetResult {
        label: string
        selectedTalismans: string[]
        cleared: number
        total: number
        ci: ReturnType<typeof wilsonCI>
        deathsByFloor: Record<number, number>
        yeonhwanCount: number
        // 연환 발생 시 승률 추적
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

            // 연환 발생 여부로 그룹 분리
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

      // ─── 출력 ───────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(70))
      console.log('balance-v3 R11 작업a — 연환 발생률 정밀 측정')
      console.log(`커밋: 632c30a | OHANG_YEONHWAN_MULTIPLIER=×${OHANG_YEONHWAN_MULTIPLIER} | 3000판 × 3종`)
      console.log('='.repeat(70))

      // §1: 연환 발생률 정밀 집계
      console.log('\n[§1] 연환 발생률 정밀 집계 (현행 ×8, 3000판)\n')
      console.log('| 프리셋 | 연환 총합 | 발생률/판 | 연환 발생 게임 | 연환 미발생 게임 |')
      console.log('|--------|-----------|-----------|----------------|-----------------|')
      for (const r of results) {
        const perRun = (r.yeonhwanCount / r.total).toFixed(3)
        console.log(
          `| ${r.label.padEnd(6)} | ${r.yeonhwanCount.toString().padStart(8)} ` +
          `| ${perRun.padStart(8)}회/판 ` +
          `| ${r.yeonhwanGames}판(${(r.yeonhwanGames / r.total * 100).toFixed(1)}%) ` +
          `| ${r.noYeonhwanGames}판(${(r.noYeonhwanGames / r.total * 100).toFixed(1)}%) |`
        )
      }

      // §2: 연환 데미지 기여 분석
      console.log('\n[§2] 연환 데미지 기여 분석\n')
      // baseScore 추정: 연환은 5원소 각 1장 이상 = 최소 5장
      // 실제 baseScore를 추적하지 않으므로 이론적 추정치 제공
      console.log(`연환 배율: ×${OHANG_YEONHWAN_MULTIPLIER} (현행)`)
      console.log('※ fullCapBot traitCounts는 발동 횟수만 추적 (데미지 합산 미지원)')
      console.log('※ 연환 1회당 평균 데미지: baseScore × 배율. baseScore 추정 = 핸드 합산 (약 20~35 추정)')
      console.log('| 프리셋 | 연환/판 | 추정 1회평균(baseScore≈25) | 추정 기여데미지/판 |')
      console.log('|--------|---------|---------------------------|-------------------|')
      for (const r of results) {
        const perRun = r.yeonhwanCount / r.total
        const estDmgPerOcc = 25 * OHANG_YEONHWAN_MULTIPLIER  // baseScore≈25 추정
        const estDmgPerRun = (perRun * estDmgPerOcc).toFixed(1)
        console.log(
          `| ${r.label.padEnd(6)} | ${perRun.toFixed(3).padStart(7)} ` +
          `| ≈${estDmgPerOcc} (×${OHANG_YEONHWAN_MULTIPLIER}) ` +
          `| ≈${estDmgPerRun}/판 |`
        )
      }

      // §3: 연환 발생 시 승률 vs 미발생 시 승률
      console.log('\n[§3] 연환 발생 여부별 승률\n')
      console.log('| 프리셋 | 연환 발생 시 승률 | 연환 미발생 시 승률 | 차이 |')
      console.log('|--------|------------------|---------------------|------|')
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
        console.log(`| ${r.label.padEnd(6)} | ${winRateYeonhwan}% (n=${r.yeonhwanGames}) | ${winRateNo}% (n=${r.noYeonhwanGames}) | ${diff}%p |`)
      }

      // §4: 클리어율 (현행 ×8 기준선 — 1000판 후보 시뮬 비교용)
      console.log('\n[§4] 클리어율 + Wilson 95% CI (현행 ×8, 3000판 기준선)\n')
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

      // §5: 가호 선택
      console.log('\n[§5] 가호 선택\n')
      for (const r of results) {
        console.log(`${r.label}: ${r.selectedTalismans.join(' + ')}`)
      }

      console.log('\n' + '='.repeat(70))
      console.log('R11 작업a 완료 — 결과를 R11 결과 파일에 반영')
      console.log('='.repeat(70))

      // 검증
      for (const r of results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared).toBeGreaterThanOrEqual(0)
        expect(r.cleared).toBeLessThanOrEqual(RUNS)
        expect(r.cleared / RUNS).toBeGreaterThan(0.10)
        // 연환이 0회면 이상 — 3000판에서 연환 발생 게임이 있어야 함
        expect(r.yeonhwanGames).toBeGreaterThan(0)
      }

      console.log('\n판정: PASS')
    },
  )
})
