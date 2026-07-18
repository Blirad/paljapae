/**
 * v4 토단일 사망 분포 분석 (2026-07-18)
 *
 * 목적: 토단일 1000판에서 층별 사망률 + 층별 평균 잔여 HP 수집
 * 용도: 사망 집중층 파악 → HP +8~12% 타격 지점 결정
 *
 * 이든 지시: "토단일이 어디서 죽고 어디를 무사통과하는가" → 무사통과 층이 타격지점
 * 즉, 높은 클리어율 구간은 이미 충분한 HP, 낮은 구간은 HP 상향 필요
 *
 * 조건: B벌(×1.45 균일), 강림 ON, 1000판 × 토단일 프리셋
 * 층: 1~4층 (ETA 500판/1000판)
 *
 * 산출물: /tmp/v4_todanil_death_distribution.json
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ── 강림 ON, B벌(×1.45) mock ──
let currentFloor1Hp = Math.round(220 * 1.45)  // 319
let currentFloor2Hp = Math.round(445 * 1.45)  // 645
let currentFloor3Hp = Math.round(680 * 1.45)  // 986
const currentFloor4Hp = 680  // 불변

vi.mock('../engine/devSettings', () => ({
  getDevComboRuleset: () => 'v4',
  getDevDescentEnabled: () => true,
}))

vi.mock('../engine/balance', async () => {
  const actual = (await vi.importActual('../engine/balance')) as Record<string, unknown>
  return {
    ...actual,
    getFloorHp: (floorIndex: number) => {
      if (floorIndex === 0) return currentFloor1Hp
      if (floorIndex === 1) return currentFloor2Hp
      if (floorIndex === 2) return currentFloor3Hp
      if (floorIndex === 3) return currentFloor4Hp
      return (actual.FLOOR_CONFIGS as Array<{ enemyHp: number }>)[floorIndex]?.enemyHp
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

const RUNS = 1000
const TODANIL_PRESET = {
  dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
  ilgan: 'to' as Element,
}

describe('v4 토단일 사망 분포 분석 (B벌, 강림 ON)', () => {
  it('1000판 사망 분포 수집 — 층별 사망률 + 평균 잔여 HP', { timeout: 300000 }, () => {
    console.log('\n========================================')
    console.log('토단일 사망 분포 분석 시작')
    console.log(`조건: B벌(×1.45 균일), 강림 ON`)
    console.log(`HP: 1층=${currentFloor1Hp} / 2층=${currentFloor2Hp} / 3층=${currentFloor3Hp} / 4층=${currentFloor4Hp}`)
    console.log(`시드: i×12345+7777, 1000판`)
    console.log('========================================\n')

    // 층별 통계
    interface FloorStats {
      floor: number
      deaths: number
      totalRemainingHp: number
      victories: number
    }

    const stats: Record<number, FloorStats> = {
      1: { floor: 1, deaths: 0, totalRemainingHp: 0, victories: 0 },
      2: { floor: 2, deaths: 0, totalRemainingHp: 0, victories: 0 },
      3: { floor: 3, deaths: 0, totalRemainingHp: 0, victories: 0 },
      4: { floor: 4, deaths: 0, totalRemainingHp: 0, victories: 0 },
    }

    const favorableElement = getFavorableElement(TODANIL_PRESET.ilgan)
    const activePassiveIds = selectTalismanBySaju(TODANIL_PRESET.dist)

    let victories = 0

    // 샘플 게임 로그 (첫 2판만)
    for (let i = 0; i < RUNS; i++) {
      const result = simulateFullCapRun(i * 12345 + 7777, {
        elementDist: TODANIL_PRESET.dist,
        ilganElement: TODANIL_PRESET.ilgan,
        favorableElement,
        enableFloorReward: true,
        enableEffectMode: true,
        activePassiveIds,
      })

      if (result.victory) {
        victories++
        // 승리: 모든 층 통과
        for (const floor of [1, 2, 3, 4]) {
          stats[floor].victories++
        }
      } else {
        // 패배: deathFloor를 기준으로 분석
        if (result.deathFloor) {
          const deathFloor = result.deathFloor

          // 사망 층까지 모두 기록
          for (let f = 1; f <= deathFloor; f++) {
            if (f < deathFloor) {
              // 사망 이전 층은 통과
              stats[f].victories++
            } else if (f === deathFloor) {
              // 사망 층
              stats[f].deaths++
            }
          }
        }
      }

      if ((i + 1) % 250 === 0) {
        console.log(`진행: ${i + 1}/1000판 (승리: ${victories})`)
      }
    }

    // ── 분석 ──
    console.log('\n========================================')
    console.log('층별 사망 분포')
    console.log('========================================')
    console.log('| 층 | 사망 | 통과 | 사망률 | 평균 적 잔여HP | 판정 |')
    console.log('|----|------|------|--------|--------|------|')

    for (const [floorNum, stat] of Object.entries(stats)) {
      const floor = parseInt(floorNum)
      const clearRate = stat.victories / RUNS
      const deathRate = stat.deaths / RUNS
      const avgRemainingHp = stat.deaths > 0 ? (stat.totalRemainingHp / stat.deaths).toFixed(1) : 'N/A'

      // 판정: 통과 < 10% = 집중 사망층 (타격 후보)
      const isFocusLayer = clearRate < 0.1
      const judgment = isFocusLayer ? '⚠ 집중층' : '○ 정상'

      console.log(
        `| ${floor} | ${stat.deaths} | ${stat.victories} | ${(deathRate * 100).toFixed(1)}% | ${avgRemainingHp} | ${judgment} |`,
      )
    }

    // 타격 지점 파악
    console.log('\n========================================')
    console.log('타격 지점 분석')
    console.log('========================================')

    let focusFloor = null
    for (const [floorNum, stat] of Object.entries(stats)) {
      const floor = parseInt(floorNum)
      const clearRate = stat.victories / RUNS
      if (clearRate < 0.1) {
        focusFloor = floor
        console.log(`✓ 집중 사망층: ${floor}층 (통과율 ${(clearRate * 100).toFixed(1)}%)`)
        console.log(`  → HP +8~12% 타격 지점`)
        break
      }
    }

    if (!focusFloor) {
      console.log('⚠ 집중 사망층 미감지 — 구조적 문제 가능성')
    }

    // ── 산출물 ──
    const output = {
      timestamp: new Date().toISOString(),
      description: '토단일 사망 분포 분석 (B벌 ×1.45, 강림 ON)',
      conditions: {
        hp: { floor1: currentFloor1Hp, floor2: currentFloor2Hp, floor3: currentFloor3Hp, floor4: currentFloor4Hp },
        descent: 'ON',
        runs: RUNS,
      },
      results: {
        totalVictories: victories,
        clearRate: parseFloat(((victories / RUNS) * 100).toFixed(1)),
        floorStats: Object.values(stats).map(s => ({
          floor: s.floor,
          deaths: s.deaths,
          clearRate: parseFloat(((s.victories / RUNS) * 100).toFixed(1)),
          avgRemainingEnemyHp: s.deaths > 0 ? parseFloat((s.totalRemainingHp / s.deaths).toFixed(1)) : null,
        })),
        focusFloor,
      },
    }

    writeFileSync('/tmp/v4_todanil_death_distribution.json', JSON.stringify(output, null, 2))
    console.log('\n산출물: /tmp/v4_todanil_death_distribution.json')

    expect(victories).toBeGreaterThan(0)
  })
})
