/**
 * v3R12YeonhwanDist.test.ts
 * balance-v3 R12 작업 2 — 연환 데미지 비중 분포 집계 (현행 ×8, 1000판 × 3종)
 *
 * 목적: 연환 발생 게임에서 연환 데미지 비중 분포 (구간별 빈도)
 *
 * 추정 방법:
 *   - 연환 데미지 = yeonhwanCount_per_game × 추정_baseScore × OHANG_YEONHWAN_MULTIPLIER
 *   - 총 데미지 = 층별 사망 기준 누적 HP (클리어=1885, 층별 사망은 평균 HP로 추정)
 *   - 비중 = 연환 데미지 / 총 데미지
 *
 * 층별 추정 총 데미지 (적 HP 누적):
 *   1층 사망: 220/2 ≈ 110 (중간값)
 *   2층 사망: 220 + 445/2 ≈ 443
 *   3층 사망: 220 + 445 + 680/2 ≈ 1005
 *   4층 사망: 220 + 445 + 680 + 540/2 ≈ 1615
 *   클리어:   220 + 445 + 680 + 540 = 1885
 *
 * 시드: i×12345+7777 (i=0~999)
 * OHANG_YEONHWAN_MULTIPLIER = 8 (현행)
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import { OHANG_YEONHWAN_MULTIPLIER } from '../engine/balance'

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

// 층별 적 누적 HP (데미지 추정용)
const FLOOR_HP = [220, 445, 680, 540]
const CUMULATIVE_HP = [
  FLOOR_HP[0],
  FLOOR_HP[0] + FLOOR_HP[1],
  FLOOR_HP[0] + FLOOR_HP[1] + FLOOR_HP[2],
  FLOOR_HP[0] + FLOOR_HP[1] + FLOOR_HP[2] + FLOOR_HP[3],
]

/**
 * 게임 결과에서 총 데미지 추정치 계산
 * - 클리어: 모든 층 HP 합산
 * - 층 사망: 해당 층까지 + 사망 층 절반
 */
function estimateTotalDamage(victory: boolean, deathFloor: number | null): number {
  if (victory) return CUMULATIVE_HP[3]
  if (deathFloor === null) return CUMULATIVE_HP[3]
  // deathFloor 1~4
  const prevHP = deathFloor > 1 ? CUMULATIVE_HP[deathFloor - 2] : 0
  const floorHP = FLOOR_HP[deathFloor - 1]
  return prevHP + Math.floor(floorHP / 2)
}

describe(`balance-v3 R12 작업2 — 연환 데미지 비중 분포 (×${OHANG_YEONHWAN_MULTIPLIER}, 1000판 × 3종)`, () => {
  it(
    'R12-2: 연환 데미지 비중 분포 집계 (구간별)',
    { timeout: 300000 },
    () => {
      const RUNS = 1000
      // 연환 1회 baseScore 추정치 (R11 §2: baseScore≈25)
      const EST_BASE_SCORE = 25

      interface DistBuckets {
        below10: number   // 0~10%
        b10to30: number   // 10~30%
        b30to50: number   // 30~50%
        above50: number   // 50%+
        totalYeonhwanGames: number
      }

      interface PresetResult {
        label: string
        selectedTalismans: string[]
        dist: DistBuckets
        perGameRatios: number[]  // 연환 발생 게임들의 비중 값 (정렬됨)
        avgRatio: number
        yeonhwanCountPerGame: number[]  // 연환 발생 게임들의 연환 횟수
        avgYeonhwanPerGame: number
        totalGames: number
        yeonhwanGames: number
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        const dist: DistBuckets = { below10: 0, b10to30: 0, b30to50: 0, above50: 0, totalYeonhwanGames: 0 }
        const perGameRatios: number[] = []
        const yeonhwanCountPerGame: number[] = []

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

          const gameYeonhwan = r.traitCounts?.['ohang-yeonhwan'] ?? 0

          if (gameYeonhwan > 0) {
            dist.totalYeonhwanGames++
            yeonhwanCountPerGame.push(gameYeonhwan)

            // 데미지 추정
            const yeonhwanDmg = gameYeonhwan * EST_BASE_SCORE * OHANG_YEONHWAN_MULTIPLIER
            const totalDmg = estimateTotalDamage(r.victory, r.deathFloor)
            const ratio = yeonhwanDmg / totalDmg

            perGameRatios.push(ratio)

            if (ratio < 0.10) dist.below10++
            else if (ratio < 0.30) dist.b10to30++
            else if (ratio < 0.50) dist.b30to50++
            else dist.above50++
          }
        }

        const avgRatio = perGameRatios.length > 0
          ? perGameRatios.reduce((a, b) => a + b, 0) / perGameRatios.length
          : 0
        const avgYeonhwanPerGame = yeonhwanCountPerGame.length > 0
          ? yeonhwanCountPerGame.reduce((a, b) => a + b, 0) / yeonhwanCountPerGame.length
          : 0

        results.push({
          label: preset.label,
          selectedTalismans,
          dist,
          perGameRatios: [...perGameRatios].sort((a, b) => a - b),
          avgRatio,
          yeonhwanCountPerGame,
          avgYeonhwanPerGame,
          totalGames: RUNS,
          yeonhwanGames: dist.totalYeonhwanGames,
        })
      }

      // ─── 출력 ────────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(70))
      console.log(`balance-v3 R12 작업2 — 연환 데미지 비중 분포 집계`)
      console.log(`OHANG_YEONHWAN_MULTIPLIER=×${OHANG_YEONHWAN_MULTIPLIER} | 1000판 × 3종`)
      console.log(`추정 방법: 연환데미지 = 횟수 × ${EST_BASE_SCORE}(baseScore추정) × ${OHANG_YEONHWAN_MULTIPLIER}`)
      console.log(`총데미지 = 층별사망 중간값 기준 (클리어=1885, 4층사망=1615, 3층사망=1005, 2층사망=443, 1층사망=110)`)
      console.log('='.repeat(70))

      // §2-A: 구간별 빈도
      console.log('\n[§2-A] 연환 데미지 비중 분포 (구간별, 연환 발생 게임 기준)\n')
      console.log('| 프리셋 | 연환 발생 게임 | 0~10% | 10~30% | 30~50% | 50%+ | 평균 비중 |')
      console.log('|--------|--------------|-------|--------|--------|------|-----------|')
      for (const r of results) {
        const n = r.yeonhwanGames
        const b10 = r.dist.below10
        const b10to30 = r.dist.b10to30
        const b30to50 = r.dist.b30to50
        const ab50 = r.dist.above50
        const avg = (r.avgRatio * 100).toFixed(1)
        console.log(
          `| ${r.label.padEnd(6)} | ${n}판 ` +
          `| ${b10}(${n > 0 ? (b10/n*100).toFixed(1) : '0.0'}%) ` +
          `| ${b10to30}(${n > 0 ? (b10to30/n*100).toFixed(1) : '0.0'}%) ` +
          `| ${b30to50}(${n > 0 ? (b30to50/n*100).toFixed(1) : '0.0'}%) ` +
          `| ${ab50}(${n > 0 ? (ab50/n*100).toFixed(1) : '0.0'}%) ` +
          `| ${avg}% |`
        )
      }

      // §2-B: 중앙값 + 사분위
      console.log('\n[§2-B] 연환 비중 사분위 (연환 발생 게임 기준)\n')
      console.log('| 프리셋 | Q1(25%) | 중앙값(50%) | Q3(75%) | 평균 연환/판 |')
      console.log('|--------|---------|------------|---------|------------|')
      for (const r of results) {
        const sorted = r.perGameRatios
        if (sorted.length === 0) {
          console.log(`| ${r.label.padEnd(6)} | N/A | N/A | N/A | N/A |`)
          continue
        }
        const q1 = sorted[Math.floor(sorted.length * 0.25)]
        const med = sorted[Math.floor(sorted.length * 0.50)]
        const q3 = sorted[Math.floor(sorted.length * 0.75)]
        console.log(
          `| ${r.label.padEnd(6)} ` +
          `| ${(q1 * 100).toFixed(1)}% ` +
          `| ${(med * 100).toFixed(1)}% ` +
          `| ${(q3 * 100).toFixed(1)}% ` +
          `| ${r.avgYeonhwanPerGame.toFixed(2)}회/판 |`
        )
      }

      // §2-C: 주요 판정
      console.log('\n[§2-C] 연환 비중 판정\n')
      for (const r of results) {
        const avg = r.avgRatio * 100
        const above30pct = (r.dist.b30to50 + r.dist.above50) / Math.max(r.yeonhwanGames, 1) * 100
        const above50pct = r.dist.above50 / Math.max(r.yeonhwanGames, 1) * 100
        const judgement = avg >= 30
          ? '평균 30%+ → 연환이 주식 (없으면 딜 급감)'
          : avg >= 20
          ? '평균 20~30% → 중요 화력원'
          : '평균 20% 미만 → 보너스 수준'
        console.log(`${r.label}: 평균 비중 ${avg.toFixed(1)}%, 30%+ 게임 ${above30pct.toFixed(1)}%, 50%+ 게임 ${above50pct.toFixed(1)}% → ${judgement}`)
      }

      console.log('\n' + '='.repeat(70))
      console.log('R12 작업2 완료')
      console.log('='.repeat(70))

      // 검증
      for (const r of results) {
        expect(r.totalGames).toBe(RUNS)
        expect(r.yeonhwanGames).toBeGreaterThan(0)
      }

      console.log('\n판정: PASS')
    },
  )
})
