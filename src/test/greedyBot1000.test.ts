/**
 * 팔자전 Phase 1.9 — A-3 재밸런스: 탐욕 봇 1000판 시뮬레이션
 *
 * 목표:
 *  - 클리어율 50~60%
 *  - 원샷(1턴 사망) <5%
 *  - 융합 10종 사용률 분포
 *  - 3% 미만 조합 → 상향안
 */

import { describe, it } from 'vitest'
import {
  runGreedySimulation,
  simulateGreedyRun,
  greedySelectCards,
  makeLcg,
} from '../engine/greedyBot'
import {
  createFixedDeck,
  shuffleDeck,
} from '../engine/paljajeonEngine'
import { judgeCombo } from '../engine/pokerHandJudge'
import { FLOOR_CONFIGS, HAND_SIZE, FUSION_COMBOS } from '../engine/balance'
import type { Card, Element } from '../types/game'

// 단일 런에서 선택된 융합 이름 수집
function collectFusionNames(hand: Card[], enemyEl: Element, condenseActive: boolean): string | null {
  const selectedIds = greedySelectCards(hand, enemyEl, undefined, condenseActive)
  const selectedCards = hand.filter(c => selectedIds.includes(c.id))
  if (selectedCards.length !== 2) return null
  const result = judgeCombo(selectedCards)
  if (result.type === 'fusion-birth' || result.type === 'fusion-hone') {
    return result.name
  }
  return null
}

describe('A-3 재밸런스: 탐욕 봇 1000판 — Phase 1.9', () => {
  it('1000판 완료 + 클리어율/원샷/층별/융합 사용률 분석', () => {
    const RUNS = 1000

    // 기본 1000판 시뮬레이션
    const report = runGreedySimulation(RUNS)

    // 융합 사용률 추적 (별도 패스: 각 런의 첫 턴 핸드에서 최선 선택 확인)
    const fusionUsage: Record<string, number> = {}
    FUSION_COMBOS.forEach(f => { fusionUsage[f.name] = 0 })
    let fusionTotalSelections = 0

    // 1000번 런 × 4개 층 × 4번 플레이 = 최대 16000 핸드 평가
    // 대신 대표 샘플: 각 시드별로 1층 첫 핸드에서 융합 선택 여부 수집
    for (let i = 0; i < RUNS; i++) {
      const seed = i * 12345 + 7777
      const rng = makeLcg(seed)

      for (let floor = 0; floor < 4; floor++) {
        const deckSeed = Math.floor(rng() * 0xffffffff)
        const deck = shuffleDeck(createFixedDeck(), deckSeed)
        const hand = deck.slice(0, HAND_SIZE)
        const enemyEl = FLOOR_CONFIGS[floor].enemyPrimaryElement as Element

        // 최대 4번 플레이 시뮬
        for (let play = 0; play < (FLOOR_CONFIGS[floor].maxPlays ?? 4); play++) {
          const fusionName = collectFusionNames(hand, enemyEl, false)
          if (fusionName && fusionName in fusionUsage) {
            fusionUsage[fusionName]++
            fusionTotalSelections++
          }
        }
      }
    }

    // 층별 승률 계산 (deathsByFloor + clears)
    const layerClears: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    // runGreedySimulation 내부에서 층별 클리어 수를 직접 추출하기 위해 재계산
    const layerAttempts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

    for (let i = 0; i < RUNS; i++) {
      const result = simulateGreedyRun(i * 12345 + 7777)
      for (const fs of result.floorStats) {
        layerAttempts[fs.floor] = (layerAttempts[fs.floor] ?? 0) + 1
        if (fs.cleared) {
          layerClears[fs.floor] = (layerClears[fs.floor] ?? 0) + 1
        }
      }
    }

    const layerWinRates: Record<number, string> = {}
    for (let f = 1; f <= 4; f++) {
      const attempts = layerAttempts[f] ?? 0
      const clears = layerClears[f] ?? 0
      layerWinRates[f] = attempts > 0 ? `${((clears / attempts) * 100).toFixed(1)}%` : 'N/A'
    }

    // 원샷 판별: 플레이어가 1턴에 사망 = playsLeft가 maxPlays-1인 상태에서 패배
    // report.oneShotClearRate는 1층 1회 격파 비율 (전체/RUNS 기준)
    // 대신 "1턴 패배" = 첫 턴에 HP 0 또는 플레이 소진
    let oneShotDeaths = 0
    for (let i = 0; i < RUNS; i++) {
      const result = simulateGreedyRun(i * 12345 + 7777)
      if (!result.victory && result.deathFloor === 1) {
        const f1Stats = result.floorStats.find(fs => fs.floor === 1)
        if (f1Stats && f1Stats.attackCount === 1) {
          oneShotDeaths++
        }
      }
    }

    // 융합 사용률 %
    const fusionRates: Record<string, string> = {}
    for (const name of Object.keys(fusionUsage)) {
      const rate = fusionTotalSelections > 0
        ? ((fusionUsage[name] / fusionTotalSelections) * 100)
        : 0
      fusionRates[name] = `${rate.toFixed(1)}%`
    }

    // 3% 미만 조합
    const lowUsageFusions: string[] = []
    for (const [name, count] of Object.entries(fusionUsage)) {
      const rate = fusionTotalSelections > 0 ? (count / fusionTotalSelections) * 100 : 0
      if (rate < 3) lowUsageFusions.push(name)
    }

    // 결과 출력
    console.log('\n========== A-3 탐욕 봇 1000판 결과 ==========')
    console.log(`총 판 수: ${RUNS}`)
    console.log(`클리어율: ${report.clearRate.toFixed(1)}% (목표: 50~60%)`)
    console.log(`원샷 패배(1층 1턴 사망): ${((oneShotDeaths / RUNS) * 100).toFixed(1)}% (${oneShotDeaths}판)`)
    console.log('')
    console.log('--- 층별 승률 커브 ---')
    for (let f = 1; f <= 4; f++) {
      console.log(`  ${f}층: ${layerWinRates[f]} (시도 ${layerAttempts[f] ?? 0}판, 클리어 ${layerClears[f] ?? 0}판)`)
    }
    console.log('')
    console.log('--- 융합 10종 사용률 ---')
    for (const [name, rate] of Object.entries(fusionRates)) {
      const lowTag = lowUsageFusions.includes(name) ? ' [3% 미만]' : ''
      console.log(`  ${name}: ${rate}${lowTag}`)
    }
    console.log(`  (총 융합 선택 수: ${fusionTotalSelections})`)
    console.log('')

    if (lowUsageFusions.length > 0) {
      console.log('--- 3% 미만 조합 + 상향안 ---')
      for (const name of lowUsageFusions) {
        const fusion = FUSION_COMBOS.find(f => f.name === name)
        if (fusion) {
          const currentMult = fusion.multiplier
          const proposedMult = fusion.type === 'birth' ? (currentMult + 0.5) : (currentMult + 0.3)
          console.log(`  [${name}] 현재 ×${currentMult} → 상향안 ×${proposedMult.toFixed(1)}`)
          console.log(`    원인: ${fusion.element1}+${fusion.element2}→${fusion.result} 조합이 탐욕 봇 최적 경로에서 누락`)
        }
      }
    } else {
      console.log('--- 3% 미만 조합 없음 ---')
    }

    console.log('')
    console.log('--- 층별 공격 횟수 통계 ---')
    for (let f = 1; f <= 4; f++) {
      const s = report.floorAttacks[f]
      console.log(`  ${f}층 격파 공격 횟수: 평균 ${s.mean.toFixed(2)}, 최소 ${s.min}, 최대 ${s.max}, stddev ${s.stddev.toFixed(2)}`)
    }
    console.log('')
    console.log('--- 층별 사망 분포 ---')
    for (let f = 1; f <= 4; f++) {
      console.log(`  ${f}층 사망: ${report.deathsByFloor[f] ?? 0}판`)
    }
    console.log('')
    console.log('--- 미실행 경위 ---')
    console.log('  Phase 1.9 신 조합 체계 검증(v1.0) 단계에서 greedyBot.test.ts가 100판 크래시 방지')
    console.log('  테스트만 통과 처리됐고, 1000판 결과 분석 및 융합 사용률 측정은 미수행됨.')
    console.log('')
    console.log('--- 밸런스 진단 ---')
    if (report.clearRate < 1) {
      console.log('  [CRITICAL] 클리어율 0% — 적 HP 대비 최대 딜이 극도로 부족')
      console.log('  1층 적 HP 2820 vs 4턴 최대 딜 ~280 (기운 4장 모으기 ×3.5 + 극 보너스 ×1.7 = 약 70×4=280)')
      console.log('  상향 필요: enemyHp 대폭 감소 OR 카드 기본값 증가 OR maxPlays 증가')
      console.log('  제안: 1층 enemyHp 2820 → 400~600 (10배 이상 축소 필요)')
    }
    console.log('================================================\n')
  }, 120000) // 2분 타임아웃
})
