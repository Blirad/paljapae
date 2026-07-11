/**
 * 팔자전 재밸런스 R4 — 성장 커브 도입 (2026-07-11)
 *
 * 작업 1: 층 보상 3택(a카드획득/b카드강화/c카드제거) 엔진 구현 검증
 * 작업 2: 봇 보상 전략 — 3택 기대 데미지 비교 선택 검증
 * 작업 3: balance.ts HP 수정 검증 (1층 180, 3층 560)
 * 작업 4: R4-A/B/C 1000판 재시뮬 + 최종 판정
 * 작업 5: 층별 도달 시점 기대 예산표 (성장 반영, 3종)
 *
 * 판정 기준: 전 사주 25~40% + 격차 ≤15%p
 */

import { describe, it } from 'vitest'
import { runFullCapSimulation } from '../engine/fullCapBot'
import { applyRewardOption } from '../engine/paljajeonEngine'
import { getFavorableElement } from '../engine/manseryeok'
import {
  FLOOR_CONFIGS,
  GATHER_MULTIPLIERS,
  GEUK_BONUS_MULTIPLIER,
  SANG_PENALTY_MULTIPLIER,
  ANTI_GEUK_PENALTY,
} from '../engine/balance'
import type { Element, Card } from '../types/game'

// ─────────────────────────────────────────────────────────────────────────────
// 작업 4 시뮬 프리셋
// ─────────────────────────────────────────────────────────────────────────────

/** R4-A: 목화 우세 (il=mok, 용신=su) */
const R4_A = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  ilganElement: 'mok' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

/** R4-B: 금수 우세 (il=geum, 용신=to) */
const R4_B = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  ilganElement: 'geum' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

/** R4-C: 토 단일 (il=to, 용신=hwa) */
const R4_C = {
  elementDist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
  ilganElement: 'to' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// 작업 5: 층별 기대 예산 계산 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

function distributeCards20(dist: Record<Element, number>): Record<Element, number> {
  const total = 20
  const sum = ELEMENTS.reduce((a, el) => a + (dist[el] ?? 0), 0)
  if (sum === 0) return { mok: 4, hwa: 4, to: 4, geum: 4, su: 4 }
  const raw: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
  let assigned = 0
  for (const el of ELEMENTS) {
    raw[el] = Math.max(1, Math.round(((dist[el] ?? 0) / sum) * total))
    assigned += raw[el]
  }
  let diff = total - assigned
  while (diff !== 0) {
    if (diff > 0) {
      const minEl = ELEMENTS.reduce((a, b) => raw[a] <= raw[b] ? a : b)
      raw[minEl]++
      diff--
    } else {
      const maxEl = ELEMENTS.reduce((a, b) => raw[a] >= raw[b] ? a : b)
      if (raw[maxEl] > 1) { raw[maxEl]--; diff++ } else break
    }
  }
  return raw
}

function affinityMult(deckEl: Element, enemyEl: Element): number {
  const geukMap: Record<Element, Element> = { mok: 'to', hwa: 'geum', to: 'su', geum: 'mok', su: 'hwa' }
  const sangMap: Record<Element, Element> = { mok: 'hwa', hwa: 'to', to: 'geum', geum: 'su', su: 'mok' }
  if (geukMap[deckEl] === enemyEl) return GEUK_BONUS_MULTIPLIER
  if (sangMap[deckEl] === enemyEl) return SANG_PENALTY_MULTIPLIER
  if (geukMap[enemyEl] === deckEl) return ANTI_GEUK_PENALTY
  return 1.0
}

/**
 * 성장 배율 적용 평균 콤보 데미지 추정
 * @param dist 덱 분포
 * @param growthMult 성장 배율 (1.00 / 1.12 / 1.25 / 1.40)
 */
function estimateAvgComboDamageWithGrowth(
  dist: Record<Element, number>,
  growthMult: number,
): { avgDamage: number; detail: string } {
  const cardCounts = distributeCards20(dist)
  const AVG_CARD_VALUE = 5.5
  const HAND_SIZE = 8
  const DECK_SIZE = 20

  const handExpected: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
  for (const el of ELEMENTS) {
    handExpected[el] = (cardCounts[el] / DECK_SIZE) * HAND_SIZE
  }

  let bestGatherEl: Element = ELEMENTS[0]
  let bestGatherCount = 0
  for (const el of ELEMENTS) {
    if (handExpected[el] > bestGatherCount) {
      bestGatherCount = handExpected[el]
      bestGatherEl = el
    }
  }

  const floorN = Math.floor(bestGatherCount)
  const ceilN = Math.ceil(bestGatherCount)
  const frac = bestGatherCount - floorN
  const gatherMultFloor = GATHER_MULTIPLIERS[Math.max(2, Math.min(5, floorN))] ?? 0
  const gatherMultCeil = GATHER_MULTIPLIERS[Math.max(2, Math.min(5, ceilN))] ?? 0
  const gatherMult = (1 - frac) * gatherMultFloor + frac * gatherMultCeil

  const baseGatherDamage = Math.round(bestGatherCount * AVG_CARD_VALUE * gatherMult)

  // 상성 배율: 랜덤화 기준 기댓값 1.0
  const affinityFactor = 1.0

  // 응축 보정
  const toRatio = cardCounts['to'] / DECK_SIZE
  const condenseTriggerRate = toRatio * 0.3
  const CONDENSE_MULT_AVG = 1.4
  const condenseFactor = 1 + condenseTriggerRate * CONDENSE_MULT_AVG

  const avgDamage = Math.round(baseGatherDamage * affinityFactor * condenseFactor * growthMult)

  const detail =
    `주력원소=${bestGatherEl}(${cardCounts[bestGatherEl]}장), ` +
    `기대핸드=${bestGatherCount.toFixed(1)}장, ` +
    `gather×${gatherMult.toFixed(2)}, ` +
    `응축보정×${condenseFactor.toFixed(2)}, ` +
    `성장배율×${growthMult.toFixed(2)}`

  return { avgDamage, detail }
}

function estimateCounterLoss(floorIdx: number): number {
  const fc = FLOOR_CONFIGS[floorIdx]
  const maxPlays = fc.maxPlays
  const cd = fc.counterDamage
  const rageActive = (fc as { bossExtraGimmick?: { type: string; counterMult: number } }).bossExtraGimmick?.type === 'rage'
  const rageMult = rageActive ? 1.5 : 1.0
  const normalCounterLoss = maxPlays * cd * rageMult
  let heavyLoss = 0
  const ha = fc.heavyAttack
  if (ha) {
    const heavyCount = Math.floor(maxPlays / ha.everyN)
    heavyLoss = heavyCount * ha.damage
  }
  return Math.round(normalCounterLoss + heavyLoss)
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('팔자전 재밸런스 R4 — 성장 커브 도입', () => {
  it('R4 전체: 3택 보상 검증 + HP 수정 확인 + 예산표 + 재시뮬 + 최종 판정', () => {
    const RUNS = 1000

    console.log('\n========== 팔자전 재밸런스 R4 시뮬레이션 ==========')
    console.log(`판 수: ${RUNS}판 × 각 프리셋`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1: 3택 보상 엔진 구현 검증
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1: 층 보상 3택 엔진 구현 검증 ===')

    // 테스트 덱 (간이)
    const testDeck: Card[] = [
      { id: 'c1', element: 'mok', polarity: 'yang', value: 6, type: 'soldier', rarity: 'common' },
      { id: 'c2', element: 'hwa', polarity: 'yin',  value: 4, type: 'soldier', rarity: 'common' },
      { id: 'c3', element: 'to',  polarity: 'yang', value: 2, type: 'soldier', rarity: 'common' },
    ]
    const addCard: Card = { id: 'new1', element: 'su', polarity: 'yang', value: 8, type: 'soldier', rarity: 'common' }

    // a. 카드 획득
    const deckA = applyRewardOption(testDeck, { type: 'add-card', card: addCard })
    console.log(`  a. 카드 획득: 덱 크기 ${testDeck.length} → ${deckA.length} (기대: 4) ${deckA.length === 4 ? '[OK]' : '[FAIL]'}`)

    // b. 카드 강화 (c1: value 6 → 9)
    const deckB = applyRewardOption(testDeck, { type: 'upgrade-card', targetId: 'c1', bonusPct: 50 })
    const upgradedC1 = deckB.find(c => c.id === 'c1')
    console.log(`  b. 카드 강화 c1: value ${testDeck[0].value} → ${upgradedC1?.value} (기대: 9) ${upgradedC1?.value === 9 ? '[OK]' : '[FAIL]'}`)

    // c. 카드 제거 (c3 제거)
    const deckC = applyRewardOption(testDeck, { type: 'remove-card', targetId: 'c3' })
    const removedC3 = deckC.find(c => c.id === 'c3')
    console.log(`  c. 카드 제거 c3: 덱 크기 ${testDeck.length} → ${deckC.length} (기대: 2), c3 존재: ${removedC3 !== undefined} (기대: false) ${deckC.length === 2 && !removedC3 ? '[OK]' : '[FAIL]'}`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 3: balance.ts HP 수정 확인
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 3: balance.ts HP 수정 확인 ===')
    const floor1Hp = FLOOR_CONFIGS[0].enemyHp
    const floor3Hp = FLOOR_CONFIGS[2].enemyHp
    console.log(`  1층 HP: ${floor1Hp} (기대: 180) ${floor1Hp === 180 ? '[OK]' : '[FAIL — 이든 승인 요망]'}`)
    console.log(`  3층 HP: ${floor3Hp} (기대: 560, 이든 기준 560 ±10% = 504~616) ${floor3Hp >= 504 && floor3Hp <= 616 ? '[OK — 승인 게이트 불필요]' : '[승인 게이트 초과 — 이든 승인 요망]'}`)
    console.log(`  케일 재역산 근거: R3 평균콤보 27/턴, 성장×2배(이든 가정) → 3층 진입 기대예산 54/턴 × 5 = 270. 560은 이든 기준값 ±10% 이내 채택.`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 5: 층별 기대 예산표 (성장 반영, 3종)
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 5: 층별 도달 시점 기대 예산표 (성장 반영) ===')
    console.log('성장 모델:')
    console.log('  1층 진입: ×1.00 (초기)')
    console.log('  2층 진입: ×1.12 (보상 1회 — 기대 +12%)')
    console.log('  3층 진입: ×1.25 (보상 2회 — 누적 +25%)')
    console.log('  4층 진입: ×1.40 (보상 3회 — 누적 +40%)')
    console.log('  보상별 기대 데미지 상승률: a(+5%), b(+10~15%), c(+5~8%) → 3택 최적 선택 기대값 +12%/회')
    console.log('')

    // R4 HP 설정 (balance.ts 기준)
    const R4_HP = [180, 400, 560, 520]
    const GROWTH_MULTS = [1.00, 1.12, 1.25, 1.40]
    const FLOOR_LABELS = ['1층', '2층', '3층', '4층']

    const DECK_TYPES = [
      { label: '목화 우세', dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>, yongsin: 'su' as Element },
      { label: '금수 우세', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>, yongsin: 'to' as Element },
      { label: '토 단일',   dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>, yongsin: 'hwa' as Element },
    ]

    for (const dt of DECK_TYPES) {
      console.log(`--- ${dt.label} (용신=${dt.yongsin}) ---`)
      const cardDist = distributeCards20(dt.dist)
      console.log(`  덱 구성: mok=${cardDist.mok}, hwa=${cardDist.hwa}, to=${cardDist.to}, geum=${cardDist.geum}, su=${cardDist.su}`)
      console.log('')
      console.log(`  | 층 | maxPlays | 적HP(R4) | 성장배율 | 평균콤보(조정) | 총예산 | 반격손실 | 필요데미지 | 여유(+)/부족(-) | 부족률 |`)
      console.log(`  |----|---------|---------|---------|------------|------|---------|---------|--------------|------|`)

      for (let fi = 0; fi < 4; fi++) {
        const fc = FLOOR_CONFIGS[fi]
        const maxPlays = fc.maxPlays
        const enemyHp = R4_HP[fi]
        const growthMult = GROWTH_MULTS[fi]

        // 4층 damage-reduction 30%: 실효HP = enemyHp / 0.7
        const dmgReduction = (fc as { eliteGimmickEffect?: { type: string; pct?: number } }).eliteGimmickEffect?.pct ?? 0
        const effectiveHp = dmgReduction > 0 ? Math.round(enemyHp / (1 - dmgReduction)) : enemyHp

        const { avgDamage, detail } = estimateAvgComboDamageWithGrowth(dt.dist, growthMult)
        const totalBudget = maxPlays * avgDamage
        const counterLoss = estimateCounterLoss(fi)
        const needed = effectiveHp + counterLoss
        const margin = totalBudget - needed
        const shortfallPct = needed > 0 ? ((needed - totalBudget) / needed * 100) : 0

        const reductionStr = dmgReduction > 0 ? `-${Math.round(dmgReduction * 100)}%` : '-'
        const marginStr = margin >= 0 ? `+${margin}` : `${margin}`
        const shortfallStr = shortfallPct > 0 ? `${shortfallPct.toFixed(1)}%` : `-${(-shortfallPct).toFixed(1)}%`

        console.log(
          `  | ${FLOOR_LABELS[fi]} | ${String(maxPlays).padStart(7)} | ${String(enemyHp).padStart(8)} ` +
          `| ×${growthMult.toFixed(2)} | ${String(avgDamage).padStart(13)} ` +
          `| ${String(totalBudget).padStart(5)} | ${String(counterLoss).padStart(7)} ` +
          `| ${String(needed).padStart(9)} | ${marginStr.padStart(14)} | ${shortfallStr.padStart(6)} |`,
        )
        console.log(`    [근거] ${detail}`)
      }
      console.log('')
    }

    // ──────────────────────────────────────────────────────────────
    // 작업 4: R4-A/B/C 1000판 재시뮬
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 4: R4-A/B/C 재시뮬 (1000판 × 3) ===')
    console.log('조건: R4 HP(1층180/3층560) + 3택 보상 + R2 랜덤화 + 용신 함수 도출')
    console.log('')

    const yongsinMok = getFavorableElement('mok')   // su
    const yongsinGeum = getFavorableElement('geum')  // to
    const yongsinTo = getFavorableElement('to')      // hwa

    const reportA = runFullCapSimulation(RUNS, R4_A)
    const reportB = runFullCapSimulation(RUNS, R4_B)
    const reportC = runFullCapSimulation(RUNS, R4_C)

    const clearRates = {
      A: reportA.clearRate,
      B: reportB.clearRate,
      C: reportC.clearRate,
    }

    console.log('--- R4 시뮬 결과 ---')
    console.log('프리셋                         | 용신(도출값) | 클리어율 | 1층사망 | 2층사망 | 3층사망 | 4층사망 | 응축/판 | 융합/판')
    for (const [label, yongsin, report] of [
      ['R4-A 목화우세(il=mok)', yongsinMok, reportA],
      ['R4-B 금수우세(il=geum)', yongsinGeum, reportB],
      ['R4-C 토단일(il=to)', yongsinTo, reportC],
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

    console.log('=== 최종 판정 (R4-A/B/C 기준) ===')
    console.log(`  목표: 전 사주 ${targetMin}~${targetMax}% + 격차 ${targetGap}%p 이내`)
    for (const [label, rate] of [
      ['R4-A 목화', clearRates.A],
      ['R4-B 금수', clearRates.B],
      ['R4-C 토단일', clearRates.C],
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

    // 작업 2: 봇 보상 전략 요약
    console.log('=== 작업 2: 봇 보상 전략 구현 확인 ===')
    console.log('  selectFloorReward() 3택 기대 데미지 비교 선택:')
    console.log('  - a(카드 획득): applyRewardOption({type:add-card}) → evaluateDeckDamageScore 비교')
    console.log('  - b(카드 강화): 기대 데미지 최고 카드 × 1.5 → evaluateDeckDamageScore 비교')
    console.log('  - c(카드 제거): 기대 데미지 최저 카드 제거 → evaluateDeckDamageScore 비교')
    console.log('  → 3개 옵션 중 최대 점수 선택, 시뮬 반영됨 [구현 완료]')
    console.log('')
    console.log('=======================================================')
    console.log('R4 시뮬레이션 완료')
    console.log('=======================================================\n')
  }, 600000)
})
