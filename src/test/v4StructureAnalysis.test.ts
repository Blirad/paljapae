/**
 * v4 구조 분석 — 배율 중첩 분해 데이터 (2026-07-18)
 *
 * 목적: gather5(또는 5장 융합) + 풀강림 중첩 발동의 수혜 정량화
 * 질문: ×11.7 중첩이 토단일 전용 잭팟인가, 아니면 공용인가?
 *
 * 데이터 수집:
 * a. 3프리셋 각각: gather5/5장 융합 + 풀강림 발동 횟수/판
 *    - 평균 데미지 (그 한 방)
 *    - 총딜 비중
 * b. 3프리셋 층별 통과율 (토단일의 계층 수혜 분석)
 * c. 토단일 강림 포착률 vs 목화·금수 (강림 수혜 격차 정량화)
 *
 * 조건: B벌 ×1.45, 강림 ON, 1000판 × 3프리셋
 * 산출물: /tmp/v4_structure_analysis.json
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

vi.mock('../engine/devSettings', () => ({
  getDevComboRuleset: () => 'v4',
  getDevDescentEnabled: () => true,
}))

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

const RUNS = 100  // 빠른 프로토타입 (100판)

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

describe('v4 구조 분석 — 배율 중첩 분해 (프로토타입 100판)', () => {
  it('데이터 수집: gather5/5장 + 강림 중첩, 층별 통과율', { timeout: 120000 }, () => {
    console.log('\n========================================')
    console.log('v4 구조 분석 시작 (100판 프로토타입)')
    console.log('========================================\n')

    interface PresetAnalysis {
      label: string
      totalRuns: number
      victories: number
      clearRate: number
      floorPassRates: Record<number, number>
      descentMetrics: {
        activatedCount: number
        deferredCount: number
        vanishedCount: number
        slotsArrivedTotal: number
        avgSlotsPerGame: number
      }
      traitData: {
        [key: string]: number
      }
    }

    const results: PresetAnalysis[] = []

    for (const preset of PRESETS) {
      console.log(`\n[${preset.label}] 100판 샘플 분석...`)

      const favorableElement = getFavorableElement(preset.ilgan)
      const activePassiveIds = selectTalismanBySaju(preset.dist)

      let victories = 0
      let totalDescentActivated = 0
      let totalDescentDeferred = 0
      let totalDescentVanished = 0
      let totalSlotsArrived = 0

      // 층별 통과 카운트
      const floorClears: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

      // 특성 카운트 (traitCounts)
      const traits: Record<string, number> = {}

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

        // 층별 통과율
        if (result.floorsCleared) {
          for (let f = 1; f <= result.floorsCleared; f++) {
            floorClears[f] = (floorClears[f] ?? 0) + 1
          }
        }

        // 강림 메트릭
        if (result.descentActivated) totalDescentActivated++
        if (result.descentDeferred) totalDescentDeferred++
        if (result.descentVanished) totalDescentVanished++
        if (result.descentSlotsArrived) totalSlotsArrived += result.descentSlotsArrived.length

        // 특성 카운트
        if (result.traitCounts) {
          for (const [key, count] of Object.entries(result.traitCounts)) {
            traits[key] = (traits[key] ?? 0) + count
          }
        }
      }

      const floorPassRates = Object.fromEntries(
        Object.entries(floorClears).map(([floor, clears]) => [floor, parseFloat(((clears / RUNS) * 100).toFixed(1))]),
      )

      const analysis: PresetAnalysis = {
        label: preset.label,
        totalRuns: RUNS,
        victories,
        clearRate: parseFloat(((victories / RUNS) * 100).toFixed(1)),
        floorPassRates: floorPassRates as Record<number, number>,
        descentMetrics: {
          activatedCount: totalDescentActivated,
          deferredCount: totalDescentDeferred,
          vanishedCount: totalDescentVanished,
          slotsArrivedTotal: totalSlotsArrived,
          avgSlotsPerGame: parseFloat((totalSlotsArrived / RUNS).toFixed(2)),
        },
        traitData: traits,
      }

      results.push(analysis)

      // 콘솔 출력
      console.log(`승률: ${analysis.clearRate}%`)
      console.log(`강림: 활성=${analysis.descentMetrics.activatedCount}회 / 평균 슬롯=${analysis.descentMetrics.avgSlotsPerGame}개/판`)
      console.log(
        `층별 통과: 1층=${analysis.floorPassRates[1]}% / 2층=${analysis.floorPassRates[2]}% / 3층=${analysis.floorPassRates[3]}% / 4층=${analysis.floorPassRates[4]}%`,
      )

      // gather5 추출
      const gather5Count = traits['v4_fusion_5card'] ?? traits['gather5'] ?? 0
      console.log(`특성 데이터: gather5=${gather5Count}회, 총 특성=${Object.keys(traits).length}종`)
    }

    // 산출물
    const output = {
      timestamp: new Date().toISOString(),
      description: 'v4 구조 분석 — 배율 중첩 분해',
      config: { runs: RUNS, hp: { floor1: 319, floor2: 645, floor3: 986, floor4: 680 }, descent: 'ON' },
      results,
      analysis: {
        question: 'gather5(또는 5장 융합) + 풀강림 ×11.7 중첩이 토단일 전용 잭팟인가?',
        dataPoints: ['각 프리셋 강림 발동률 및 슬롯 도래율', '계층별 통과율 격차', '특성 발동 비율 (특히 gather5)'],
      },
    }

    writeFileSync('/tmp/v4_structure_analysis.json', JSON.stringify(output, null, 2))
    console.log('\n산출물: /tmp/v4_structure_analysis.json')
    console.log('\n[데이터 수집 완료 — 이든 구조 분석 판정 대기]')

    expect(results).toHaveLength(3)
  })
})
