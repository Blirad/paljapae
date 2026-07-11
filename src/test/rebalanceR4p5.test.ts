/**
 * 팔자전 재밸런스 R4.5 — 덱 영속 아키텍처 회귀 테스트 (2026-07-11)
 *
 * 작업 1 회귀 테스트 3케이스:
 *  1. 강화 카드가 층 전환 후에도 유지된다
 *  2. 제거 카드가 층 전환 후 덱에 없다
 *  3. 추가 카드가 층 전환 후 드로우 가능하다
 *
 * + 작업 3 R4.5 시뮬 결과 (b/c 정상화 단일 변수)
 * + 작업 4 예산표 실측 성장 배율 기반 재계산
 */

import { describe, it, expect } from 'vitest'
import {
  applyRewardOption,
  advanceToNextFloor,
  createInitialGameState,
} from '../engine/paljajeonEngine'
import { runFullCapSimulation, simulateFullCapRun } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import { FLOOR_CONFIGS } from '../engine/balance'
import type { Element, Card } from '../types/game'

// ─────────────────────────────────────────────────────────────────────────────
// 작업 1 회귀 테스트 3케이스
// ─────────────────────────────────────────────────────────────────────────────

describe('R4.5 덱 영속 아키텍처 회귀 테스트', () => {
  /**
   * 케이스 1: 강화 카드가 층 전환 후에도 유지된다
   * 시나리오:
   *  1. 목화 덱으로 런 시작
   *  2. 1층 클리어 직전 상태에서 b(카드 강화) 보상 선택 — 특정 카드 id에 ×1.5 적용
   *  3. advanceToNextFloor()로 2층 진입
   *  4. 해당 카드의 value가 강화된 값인지 확인
   */
  it('강화 카드가 층 전환 후에도 유지된다', () => {
    const heroProfile = {
      id: 'test',
      name: '테스트',
      elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
      deckSeed: 42,
      ilganElement: 'mok' as Element,
      createdAt: Date.now(),
    }

    // 1. 런 시작 상태 생성 (1층)
    let state = createInitialGameState(0, heroProfile)

    // 2. 덱에서 카드 1장 선택해 강화 대상으로 지정
    const allCards1 = [...state.hand, ...state.deck, ...state.discardPile]
    const targetCard = allCards1[0]
    const originalValue = targetCard.value
    const targetId = targetCard.id

    // b 보상: 강화 적용 → 영속 덱에 적용
    const upgradedAllCards = applyRewardOption(allCards1, {
      type: 'upgrade-card',
      targetId,
      bonusPct: 50,
    })

    // 강화된 덱으로 state 갱신 (보상 적용 후 시뮬 방식)
    state = {
      ...state,
      deck: upgradedAllCards,
      hand: [],
      discardPile: [],
      phase: 'floor-reward',
    }

    // 3. 2층으로 전환 (advanceToNextFloor — 영속 덱 유지)
    const state2 = advanceToNextFloor(state)

    // 4. 2층 덱(hand + deck + discardPile)에서 해당 카드 id 조회
    const nextFloorAllCards = [...state2.hand, ...state2.deck, ...state2.discardPile]
    const upgradedCard = nextFloorAllCards.find(c => c.id === targetId)

    // 검증: 해당 카드가 2층에도 존재하고, value가 ×1.5 적용된 값
    expect(upgradedCard).toBeDefined()
    expect(upgradedCard!.value).toBeCloseTo(Math.round(originalValue * 1.5), 0)
  })

  /**
   * 케이스 2: 제거 카드가 층 전환 후 덱에 없다
   * 시나리오:
   *  1. c(카드 제거) 보상 선택 → 특정 카드 id 제거
   *  2. advanceToNextFloor()로 2층 진입
   *  3. 2층 덱에서 해당 카드 id 미존재 확인
   */
  it('제거 카드가 층 전환 후 덱에 없다', () => {
    const heroProfile = {
      id: 'test',
      name: '테스트',
      elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
      deckSeed: 99,
      ilganElement: 'mok' as Element,
      createdAt: Date.now(),
    }

    let state = createInitialGameState(0, heroProfile)

    // c 보상: 카드 제거
    const allCards1 = [...state.hand, ...state.deck, ...state.discardPile]
    const removedId = allCards1[0].id

    const removedAllCards = applyRewardOption(allCards1, {
      type: 'remove-card',
      targetId: removedId,
    })

    state = {
      ...state,
      deck: removedAllCards,
      hand: [],
      discardPile: [],
      phase: 'floor-reward',
    }

    // 2층 진입
    const state2 = advanceToNextFloor(state)
    const nextFloorDeck = [...state2.hand, ...state2.deck, ...state2.discardPile]

    // 검증: 제거된 카드가 2층 덱에 없어야 함
    expect(nextFloorDeck.find(c => c.id === removedId)).toBeUndefined()
  })

  /**
   * 케이스 3: 추가 카드가 층 전환 후 드로우 가능하다
   * 시나리오:
   *  1. a(카드 추가) 보상 선택 → 새 카드 추가
   *  2. advanceToNextFloor()로 2층 진입
   *  3. 2층 덱에 해당 카드 존재 확인
   */
  it('추가 카드가 층 전환 후 드로우 가능하다', () => {
    const heroProfile = {
      id: 'test',
      name: '테스트',
      elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
      deckSeed: 7,
      ilganElement: 'mok' as Element,
      createdAt: Date.now(),
    }

    let state = createInitialGameState(0, heroProfile)

    const addedCard: Card = {
      id: 'reward-persist-test-001',
      element: 'su',
      polarity: 'yang',
      value: 9,
      type: 'soldier',
      rarity: 'common',
    }

    const allCards1 = [...state.hand, ...state.deck, ...state.discardPile]
    const addedAllCards = applyRewardOption(allCards1, {
      type: 'add-card',
      card: addedCard,
    })

    state = {
      ...state,
      deck: addedAllCards,
      hand: [],
      discardPile: [],
      phase: 'floor-reward',
    }

    // 2층 진입
    const state2 = advanceToNextFloor(state)
    const nextFloorDeck = [...state2.hand, ...state2.deck, ...state2.discardPile]

    // 검증: 추가된 카드가 2층 덱에 존재해야 함
    expect(nextFloorDeck.find(c => c.id === addedCard.id)).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 작업 3: R4.5-A/B/C 재시뮬 (b/c 정상화 단일 변수)
// + 작업 4: 예산표 실측 성장 배율 기반 재계산
// ─────────────────────────────────────────────────────────────────────────────

/** R4.5-A: 목화 우세 (il=mok, 용신=su) — 영속 덱 + 3택 정상화 */
const R4P5_A = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  ilganElement: 'mok' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

/** R4.5-B: 금수 우세 (il=geum, 용신=to) */
const R4P5_B = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  ilganElement: 'geum' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

/** R4.5-C: 토단일 (il=to, 용신=hwa) */
const R4P5_C = {
  elementDist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
  ilganElement: 'to' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

describe('팔자전 재밸런스 R4.5 — b/c 정상화 단일 변수 재시뮬', () => {
  it('R4.5 전체: 영속 덱 + 예산표 실측 + 최종 판정', () => {
    const RUNS = 1000

    console.log('\n========== 팔자전 재밸런스 R4.5 시뮬레이션 ==========')
    console.log('변경: 덱 영속 아키텍처 (b/c 정상화 단일 변수)')
    console.log('동결: HP(1층180/2층400/3층560/4층520) + maxPlays(5/5/5/6) + 배율')
    console.log(`판 수: ${RUNS}판 × 각 프리셋`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 4: 실측 성장 배율 측정
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 4: 실측 성장 배율 측정 (층별 평균 콤보 데미지) ===')

    // 층별 데미지 통계 수집용 — simulateFullCapRun 반환값으로 floorStats 활용
    // 정확한 층별 평균 콤보 데미지는 봇 내부 attackCount와 floorStats로 역산
    // 실측 평균: (적HP_클리어된_케이스 기준 역산) = HP / 평균_공격횟수
    const FLOOR_HP = [180, 400, 560, 520]
    const FLOOR_MAXPLAYS = [5, 5, 5, 6]

    // 층별 공격 횟수 통계 수집 (클리어 케이스만)
    type FloorData = { totalAttacks: number; count: number }
    const floorDataA: Record<number, FloorData> = { 1: { totalAttacks: 0, count: 0 }, 2: { totalAttacks: 0, count: 0 }, 3: { totalAttacks: 0, count: 0 }, 4: { totalAttacks: 0, count: 0 } }
    const floorDataB: Record<number, FloorData> = { 1: { totalAttacks: 0, count: 0 }, 2: { totalAttacks: 0, count: 0 }, 3: { totalAttacks: 0, count: 0 }, 4: { totalAttacks: 0, count: 0 } }
    const floorDataC: Record<number, FloorData> = { 1: { totalAttacks: 0, count: 0 }, 2: { totalAttacks: 0, count: 0 }, 3: { totalAttacks: 0, count: 0 }, 4: { totalAttacks: 0, count: 0 } }

    for (let i = 0; i < RUNS; i++) {
      const seed = i * 12345 + 7777
      const rA = simulateFullCapRun(seed, R4P5_A)
      const rB = simulateFullCapRun(seed, R4P5_B)
      const rC = simulateFullCapRun(seed, R4P5_C)
      for (const fs of rA.floorStats) {
        if (fs.cleared) {
          floorDataA[fs.floor].totalAttacks += fs.attackCount
          floorDataA[fs.floor].count++
        }
      }
      for (const fs of rB.floorStats) {
        if (fs.cleared) {
          floorDataB[fs.floor].totalAttacks += fs.attackCount
          floorDataB[fs.floor].count++
        }
      }
      for (const fs of rC.floorStats) {
        if (fs.cleared) {
          floorDataC[fs.floor].totalAttacks += fs.attackCount
          floorDataC[fs.floor].count++
        }
      }
    }

    // 실측 평균 콤보 = 적HP / 평균공격횟수 (클리어 케이스 기준)
    // 성장 배율 = 각 층 실측 평균콤보 / 1층 실측 평균콤보
    const PRESETS = [
      { label: 'R4.5-A 목화', data: floorDataA },
      { label: 'R4.5-B 금수', data: floorDataB },
      { label: 'R4.5-C 토단일', data: floorDataC },
    ]

    // R4 계산 기반 성장 배율 (이전 기준값, 병기용)
    const R4_CALC_GROWTH = [1.00, 1.12, 1.25, 1.40]

    for (const preset of PRESETS) {
      console.log(`--- ${preset.label} 실측 성장 배율 ---`)
      const avgCombos: (number | null)[] = []
      for (let f = 1; f <= 4; f++) {
        const d = preset.data[f]
        const avgAttacks = d.count > 0 ? d.totalAttacks / d.count : null
        const avgCombo = avgAttacks !== null && avgAttacks > 0
          ? Math.round(FLOOR_HP[f - 1] / avgAttacks)
          : null
        avgCombos.push(avgCombo)
      }
      const base = avgCombos[0]
      console.log(`| 층 | maxPlays | 적HP | R4계산배율 | 실측배율 | 실측평균콤보 | 총예산 | 반격손실 | 필요데미지 | 여유(+)/부족(-) | 부족률 |`)
      console.log(`|----|---------|-----|----------|---------|------------|------|---------|---------|--------------|------|`)

      // 반격손실 간이 계산 (FLOOR_CONFIGS 기준)
      const COUNTER_LOSS = [5, 5, 18, 60]  // R4 기준 (동결)

      for (let fi = 0; fi < 4; fi++) {
        const floor = fi + 1
        const hp = FLOOR_HP[fi]
        const maxPlays = FLOOR_MAXPLAYS[fi]
        const r4Calc = R4_CALC_GROWTH[fi]
        const avgCombo = avgCombos[fi]
        const measuredGrowth = (base && avgCombo) ? (avgCombo / base) : null
        const totalBudget = avgCombo !== null ? maxPlays * avgCombo : null
        const counterLoss = COUNTER_LOSS[fi]
        const needed = hp + counterLoss
        const margin = totalBudget !== null ? totalBudget - needed : null
        const shortfallPct = (margin !== null && needed > 0) ? ((needed - totalBudget!) / needed * 100) : null

        const measuredStr = measuredGrowth !== null ? `×${measuredGrowth.toFixed(2)}` : 'N/A'
        const avgComboStr = avgCombo !== null ? String(avgCombo) : 'N/A'
        const budgetStr = totalBudget !== null ? String(totalBudget) : 'N/A'
        const marginStr = margin !== null ? (margin >= 0 ? `+${margin}` : String(margin)) : 'N/A'
        const shortStr = shortfallPct !== null ? (shortfallPct > 0 ? `${shortfallPct.toFixed(1)}%` : `-${(-shortfallPct).toFixed(1)}%`) : 'N/A'

        console.log(
          `| ${floor}층 | ${String(maxPlays).padStart(7)} | ${String(hp).padStart(4)} ` +
          `| ×${r4Calc.toFixed(2)} | ${measuredStr.padStart(7)} ` +
          `| ${avgComboStr.padStart(12)} | ${budgetStr.padStart(5)} ` +
          `| ${String(counterLoss).padStart(7)} | ${String(needed).padStart(9)} ` +
          `| ${marginStr.padStart(14)} | ${shortStr.padStart(6)} |`
        )
      }
      console.log('')
    }

    // ──────────────────────────────────────────────────────────────
    // 작업 3: R4.5-A/B/C 1000판 시뮬
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 3: R4.5-A/B/C 재시뮬 (1000판 × 3) ===')
    console.log('조건: R4.5 영속 덱(b/c 정상화) + R4 HP 동결 + R2 랜덤화 + 용신 함수 도출')
    console.log('')

    const yongsinMok = getFavorableElement('mok')
    const yongsinGeum = getFavorableElement('geum')
    const yongsinTo = getFavorableElement('to')

    const reportA = runFullCapSimulation(RUNS, R4P5_A)
    const reportB = runFullCapSimulation(RUNS, R4P5_B)
    const reportC = runFullCapSimulation(RUNS, R4P5_C)

    const clearRates = {
      A: reportA.clearRate,
      B: reportB.clearRate,
      C: reportC.clearRate,
    }

    console.log('--- R4.5 시뮬 결과 ---')
    console.log('프리셋                         | 용신(도출값) | 클리어율 | 1층사망 | 2층사망 | 3층사망 | 4층사망 | 응축/판 | 융합/판')
    for (const [label, yongsin, report] of [
      ['R4.5-A 목화우세(il=mok)', yongsinMok, reportA],
      ['R4.5-B 금수우세(il=geum)', yongsinGeum, reportB],
      ['R4.5-C 토단일(il=to)', yongsinTo, reportC],
    ] as const) {
      const d = report.deathsByFloor
      console.log(
        `  ${label.padEnd(31)} | ${yongsin.padEnd(12)} | ${report.clearRate.toFixed(1).padStart(5)}% | ` +
        `${String(d[1] ?? 0).padStart(5)} | ${String(d[2] ?? 0).padStart(5)} | ` +
        `${String(d[3] ?? 0).padStart(5)} | ${String(d[4] ?? 0).padStart(5)} | ` +
        `${report.condensesPerRun.toFixed(2)} | ${report.fusionsPerRun.toFixed(2)}`,
      )
    }
    console.log('')

    // R4 vs R4.5 비교
    console.log('--- R3 → R4 → R4.5 클리어율 변화 ---')
    const R3_RATES = { A: 4.0, B: 2.4, C: 10.0 }
    const R4_RATES = { A: 15.7, B: 9.5, C: 19.3 }
    for (const [key, label] of [['A', '목화'], ['B', '금수'], ['C', '토단일']] as const) {
      const r3 = R3_RATES[key]
      const r4 = R4_RATES[key]
      const r4p5 = clearRates[key]
      const r3tor4 = r4 - r3 > 0 ? `+${(r4 - r3).toFixed(1)}%p` : `${(r4 - r3).toFixed(1)}%p`
      const r4tor4p5 = r4p5 - r4 > 0 ? `+${(r4p5 - r4).toFixed(1)}%p` : `${(r4p5 - r4).toFixed(1)}%p`
      console.log(`  ${label}: R3 ${r3}% → R4 ${r4}% (${r3tor4}) → R4.5 ${r4p5.toFixed(1)}% (${r4tor4p5})`)
    }
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 최종 판정
    // ──────────────────────────────────────────────────────────────
    const targetMin = 25
    const targetMax = 40
    const targetGap = 15

    const allValues = Object.values(clearRates)
    const maxRate = Math.max(...allValues)
    const minRate = Math.min(...allValues)
    const gap = maxRate - minRate

    const allInRange = allValues.every(r => r >= targetMin && r <= targetMax)
    const gapOk = gap <= targetGap

    console.log('=== 최종 판정 (R4.5-A/B/C 기준) ===')
    console.log(`  목표: 전 사주 ${targetMin}~${targetMax}% + 격차 ${targetGap}%p 이내`)
    for (const [label, rate] of [
      ['R4.5-A 목화', clearRates.A],
      ['R4.5-B 금수', clearRates.B],
      ['R4.5-C 토단일', clearRates.C],
    ]) {
      const inRange = (rate as number) >= targetMin && (rate as number) <= targetMax
      console.log(
        `  ${label}: ${(rate as number).toFixed(1)}% ` +
        `${inRange ? '[범위내]' : `[범위외 — 목표: ${targetMin}~${targetMax}%]`}`,
      )
    }
    console.log(`  격차: ${gap.toFixed(1)}%p ${gapOk ? '[OK]' : `[초과 — 목표: ${targetGap}%p 이내]`}`)
    console.log(`  종합: ${allInRange && gapOk ? 'PASS' : 'FAIL — 추가 조정 필요 (수치 자의적 변경 금지, 이든 판단 후 진행)'}`)
    console.log('')
    console.log('=======================================================')
    console.log('R4.5 시뮬레이션 완료')
    console.log('=======================================================\n')

    // FLOOR_CONFIGS 로드 확인 (타입 안정성)
    expect(FLOOR_CONFIGS.length).toBe(4)
    // 테스트는 판정 결과 무관하게 PASS (판정 결과를 보고서로 보고)
    expect(true).toBe(true)
  }, 600000)
})
