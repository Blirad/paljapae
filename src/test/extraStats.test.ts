/**
 * Phase 1.9.2 추가 집계
 * - 낳는/벼리는 사용 비율
 * - 응축/대응축 발동 기회 수
 * - 연환 원샷(1층 첫 공격이 연환)
 * - Phase 1.9.2 수정 후: 응축/대응축 실선택률, 연소 발동률, 화 덱 승률
 */
import { describe, it } from 'vitest'
import { greedySelectCards, makeLcg, runGreedySimulation, simulateGreedyRun } from '../engine/greedyBot'
import { createFixedDeck, shuffleDeck } from '../engine/paljajeonEngine'
import { judgeCombo } from '../engine/pokerHandJudge'
import { FLOOR_CONFIGS, HAND_SIZE } from '../engine/balance'
import type { Element } from '../types/game'

describe('Phase 1.9.2 추가 집계', () => {
  it('낳는/벼리는 비율, 응축/대응축 기회, 연환 원샷', () => {
    const RUNS = 1000
    let birthCount = 0
    let honeCount = 0
    let condenseOpportunities = 0
    let greatCondenseOpportunities = 0
    let yeonhwanOneshotCount = 0
    let totalFusionSelections = 0

    for (let i = 0; i < RUNS; i++) {
      const seed = i * 12345 + 7777
      const rng = makeLcg(seed)

      for (let floorIdx = 0; floorIdx < 4; floorIdx++) {
        const floorConf = FLOOR_CONFIGS[floorIdx]
        const deckSeed = Math.floor(rng() * 0xffffffff)
        const deck = shuffleDeck(createFixedDeck(), deckSeed)
        const hand = deck.slice(0, HAND_SIZE)
        const enemyEl = floorConf.enemyPrimaryElement as Element
        const maxPlays = floorConf.maxPlays ?? 4

        let condenseActive: 'basic' | 'great' | null = null
        let yeonhwanUsed = false

        for (let play = 0; play < maxPlays; play++) {
          const isLastAttack = play === maxPlays - 1
          const selectedIds = greedySelectCards(
            hand, enemyEl, undefined, condenseActive, yeonhwanUsed, isLastAttack, false
          )
          const selectedCards = hand.filter(c => selectedIds.includes(c.id))
          if (selectedCards.length === 0) continue

          const result = judgeCombo(selectedCards)

          if (result.type === 'fusion-birth') {
            birthCount++
            totalFusionSelections++
            if (result.name === '옹기가마' && !isLastAttack && !condenseActive) {
              greatCondenseOpportunities++
            }
          } else if (result.type === 'fusion-hone') {
            honeCount++
            totalFusionSelections++
            if (result.name === '일군 밭' && !isLastAttack && !condenseActive) {
              condenseOpportunities++
            }
          } else if (result.type === 'ohang-yeonhwan') {
            if (!yeonhwanUsed) {
              yeonhwanUsed = true
              if (floorIdx === 0 && play === 0) {
                yeonhwanOneshotCount++
              }
            }
          }

          // 토 모으기 계열 gather 응축 기회
          if (result.type === 'gather'
              && result.finishingElement === 'to'
              && !isLastAttack && !condenseActive) {
            condenseOpportunities++
          }
        }
      }
    }

    const totalCondense = condenseOpportunities + greatCondenseOpportunities

    console.log('\n=== Phase 1.9.2 추가 집계 (1000판) ===')
    console.log(`총 융합 선택: ${totalFusionSelections}회`)
    if (totalFusionSelections > 0) {
      console.log(`낳는 조합: ${birthCount}회 = ${(birthCount/totalFusionSelections*100).toFixed(1)}%`)
      console.log(`벼리는 조합: ${honeCount}회 = ${(honeCount/totalFusionSelections*100).toFixed(1)}%`)
    }
    console.log(`기본 응축(basic) 기회: ${condenseOpportunities}회`)
    console.log(`대응축(great) 기회: ${greatCondenseOpportunities}회`)
    console.log(`응축+대응축 합계: ${totalCondense}회`)
    if (totalCondense > 0) {
      console.log(`  basic 비율: ${(condenseOpportunities/totalCondense*100).toFixed(1)}%`)
      console.log(`  great 비율: ${(greatCondenseOpportunities/totalCondense*100).toFixed(1)}%`)
    }
    console.log(`연환 원샷(1층 1회 연환): ${yeonhwanOneshotCount}판 = ${(yeonhwanOneshotCount/RUNS*100).toFixed(2)}%`)
  }, 120000)

  it('Phase 1.9.2 수정 후 — 응축 실선택률 + 연소 발동률 + 화덱 승률', () => {
    const RUNS = 1000
    const report = runGreedySimulation(RUNS)

    // 화 덱 승률: 연소가 1회 이상 발동된 런 = 화 덱으로 분류
    let hwaRunVictories = 0
    let hwaRunTotal = 0
    for (let i = 0; i < RUNS; i++) {
      const result = simulateGreedyRun(i * 12345 + 7777)
      if (result.combustionCount > 0) {
        hwaRunTotal++
        if (result.victory) hwaRunVictories++
      }
    }
    const hwaWinRate = hwaRunTotal > 0 ? (hwaRunVictories / hwaRunTotal) * 100 : 0

    console.log('\n=== Phase 1.9.2 수정 후 추가 통계 ===')
    console.log(`총 공격 기회(응축 포함): ${report.totalAttacks + report.condenseTotal + report.greatCondenseTotal}`)
    console.log(`기본 응축 실선택: ${report.condenseTotal}회 → 선택률 ${report.condenseRate.toFixed(2)}%`)
    console.log(`대응축 실선택: ${report.greatCondenseTotal}회 → 선택률 ${report.greatCondenseRate.toFixed(2)}%`)
    console.log(`응축 합산 선택률: ${(report.condenseRate + report.greatCondenseRate).toFixed(2)}% (목표: 3% 이상)`)
    console.log(`화 연소 발동: ${report.combustionTotal}회 → 발동률 ${report.combustionRate.toFixed(2)}%`)
    console.log(`화 연소 런 수: ${hwaRunTotal}판 / 전체 ${RUNS}판`)
    console.log(`화 덱(연소 발동) 승률: ${hwaWinRate.toFixed(1)}% (그을음 실효화 적용 후)`)
    console.log(`전체 승률: ${report.clearRate.toFixed(1)}%`)
    console.log('======================================\n')
  }, 120000)
})
