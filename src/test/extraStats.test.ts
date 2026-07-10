/**
 * Phase 1.9.5 추가 집계 (extraStats)
 * - 낳는/벼리는 사용 비율
 * - 응축(옹기가마 전용) 기회 수 및 실선택률
 * - 번짐(wildfire)/저격(snipe) 발동률
 * - 연환 원샷(1층 첫 공격이 연환)
 */
import { describe, it } from 'vitest'
import { greedySelectCards, makeLcg, runGreedySimulation, simulateGreedyRun } from '../engine/greedyBot'
import { createFixedDeck, shuffleDeck } from '../engine/paljajeonEngine'
import { judgeCombo } from '../engine/pokerHandJudge'
import { FLOOR_CONFIGS, HAND_SIZE } from '../engine/balance'
import type { Element } from '../types/game'

describe('Phase 1.9.2 추가 집계', () => {
  it('낳는/벼리는 비율, 응축(옹기가마) 기회, 연환 원샷', () => {
    const RUNS = 1000
    let birthCount = 0
    let honeCount = 0
    let condenseOpportunities = 0   // 옹기가마 응축 기회 (Phase 1.9.5: 옹기가마 전용)
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

        // Phase 1.9.5: condensedMultiplier % 방식 (0 = 비활성)
        let condensedMultiplier = 0
        let yeonhwanUsed = false

        for (let play = 0; play < maxPlays; play++) {
          const isLastAttack = play === maxPlays - 1
          const selectedIds = greedySelectCards(
            hand, enemyEl, undefined, condensedMultiplier, yeonhwanUsed, isLastAttack, false
          )
          const selectedCards = hand.filter(c => selectedIds.includes(c.id))
          if (selectedCards.length === 0) continue

          const result = judgeCombo(selectedCards)

          if (result.type === 'fusion-birth') {
            birthCount++
            totalFusionSelections++
            // Phase 1.9.5: 응축은 옹기가마(화+토→토)만 발동
            if (result.name === '옹기가마' && !isLastAttack && condensedMultiplier === 0) {
              condenseOpportunities++
            }
          } else if (result.type === 'fusion-hone') {
            honeCount++
            totalFusionSelections++
          } else if (result.type === 'ohang-yeonhwan') {
            if (!yeonhwanUsed) {
              yeonhwanUsed = true
              if (floorIdx === 0 && play === 0) {
                yeonhwanOneshotCount++
              }
            }
          }
        }
      }
    }

    console.log('\n=== Phase 1.9.5 추가 집계 (1000판) ===')
    console.log(`총 융합 선택: ${totalFusionSelections}회`)
    if (totalFusionSelections > 0) {
      console.log(`낳는 조합: ${birthCount}회 = ${(birthCount/totalFusionSelections*100).toFixed(1)}%`)
      console.log(`벼리는 조합: ${honeCount}회 = ${(honeCount/totalFusionSelections*100).toFixed(1)}%`)
    }
    console.log(`옹기가마 응축 기회: ${condenseOpportunities}회 (Phase 1.9.5: 옹기가마 전용)`)
    console.log(`연환 원샷(1층 1회 연환): ${yeonhwanOneshotCount}판 = ${(yeonhwanOneshotCount/RUNS*100).toFixed(2)}%`)
  }, 120000)

  it('Phase 1.9.5 수정 후 — 응축 실선택률 + 번짐/저격 발동률', () => {
    const RUNS = 1000
    const report = runGreedySimulation(RUNS)

    // 번짐(wildfire) 발동 런 승률: 들불(木+火) 융합 런
    let wildfireRunVictories = 0
    let wildfireRunTotal = 0
    for (let i = 0; i < RUNS; i++) {
      const result = simulateGreedyRun(i * 12345 + 7777)
      if (result.wildfireCount > 0) {
        wildfireRunTotal++
        if (result.victory) wildfireRunVictories++
      }
    }
    const wildfireWinRate = wildfireRunTotal > 0 ? (wildfireRunVictories / wildfireRunTotal) * 100 : 0

    console.log('\n=== Phase 1.9.5 수정 후 추가 통계 ===')
    console.log(`총 공격 기회(응축 포함): ${report.totalAttacks + report.condenseTotal}`)
    console.log(`응축(옹기가마) 실선택: ${report.condenseTotal}회 → 선택률 ${report.condenseRate.toFixed(2)}%`)
    console.log(`번짐(wildfire) 발동: ${report.wildfireTotal}회 → 발동률 ${report.wildfireRate.toFixed(2)}%`)
    console.log(`저격(snipe) 발동: ${report.snipeTotal}회 → 발동률 ${report.snipeRate.toFixed(2)}%`)
    console.log(`번짐 발동 런 수: ${wildfireRunTotal}판 / 전체 ${RUNS}판`)
    console.log(`번짐 런 승률: ${wildfireWinRate.toFixed(1)}%`)
    console.log(`전체 승률: ${report.clearRate.toFixed(1)}%`)
    console.log('======================================\n')
  }, 120000)
})
