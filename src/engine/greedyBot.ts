/**
 * 팔자전 — 탐욕 봇 (Greedy Bot)
 * 매 턴 가능한 모든 조합을 열거해 최고 데미지 조합을 선택한다.
 *
 * 목표:
 *  - 1층 평균 격파 공격 횟수: 2회 (±0.5)
 *  - 2층: 2~3회, 3층: 3~4회, 4층: 4~5회
 *  - 탐욕 봇 전체 클리어율: 50~60%
 *  - 원샷 클리어(1층 1회): <5%
 *
 * 엔진 불변 원칙: pokerHandJudge.ts, paljajeonEngine.ts 수정 없음.
 * 탐욕 봇은 표현/시뮬레이션 레이어만 담당.
 */

import { judgeHand } from './pokerHandJudge'
import type { Card, GameState } from '../types/game'

/**
 * 조합(combination) 유틸: n장 중 k장 뽑기
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(combo => [first, ...combo])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

/**
 * 탐욕 봇 핸드 선택:
 *  1. 현재 핸드(1~5장)의 모든 조합 열거
 *  2. 각 조합의 judgeHand totalScore 계산
 *  3. 최고 점수 조합 반환
 *
 * 동점 시 카드 수가 적은 쪽 선택 (버리기 보존)
 */
export function greedySelectCards(hand: Card[]): string[] {
  if (hand.length === 0) return []

  let bestIds: string[] = []
  let bestScore = -1

  const maxCards = Math.min(5, hand.length)
  for (let k = 1; k <= maxCards; k++) {
    const combos = combinations(hand, k)
    for (const combo of combos) {
      const result = judgeHand(combo)
      if (
        result.totalScore > bestScore ||
        (result.totalScore === bestScore && combo.length < bestIds.length)
      ) {
        bestScore = result.totalScore
        bestIds = combo.map(c => c.id)
      }
    }
  }

  return bestIds
}

/**
 * LCG 난수 생성기 (재현 가능)
 */
export function makeLcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

/**
 * 단일 런 시뮬레이션 (탐욕 봇 — 매 층 공격 횟수 추적)
 */
import {
  createFixedDeck,
  shuffleDeck,
  playCards,
} from './paljajeonEngine'
import { FLOOR_CONFIGS, PLAYER_BASE_HP, HAND_SIZE, BASE_DISCARDS } from './balance'

export interface FloorStats {
  floor: number
  attackCount: number  // 해당 층 격파까지 사용한 공격 횟수 (격파 실패 시 maxPlays)
  cleared: boolean
}

export interface RunResult {
  victory: boolean
  floorsCleared: number
  deathFloor: number | null
  floorStats: FloorStats[]
}

function createDeterministicState(floorIndex: number, rng: () => number): GameState {
  const floorConfig = FLOOR_CONFIGS[floorIndex]
  const seed = Math.floor(rng() * 0xffffffff)
  const deck = shuffleDeck(createFixedDeck(), seed)
  const hand = deck.slice(0, HAND_SIZE)
  const remainDeck = deck.slice(HAND_SIZE)

  return {
    currentFloor: floorConfig.floor,
    playerHp: PLAYER_BASE_HP,
    playerMaxHp: PLAYER_BASE_HP,
    enemyHp: floorConfig.enemyHp,
    enemyMaxHp: floorConfig.enemyHp,
    hand,
    deck: remainDeck,
    discardPile: [],
    selectedCards: [],
    discardsLeft: BASE_DISCARDS,
    playsLeft: floorConfig.maxPlays,
    phase: 'select',
    isVictory: false,
    floorsCleared: 0,
  }
}

export function simulateGreedyRun(seed: number): RunResult {
  const rng = makeLcg(seed)

  let floor = 1
  let deathFloor: number | null = null
  let floorsCleared = 0
  const floorStats: FloorStats[] = []

  let state = createDeterministicState(0, rng)
  let playerHp = PLAYER_BASE_HP

  while (floor <= 4) {
    // 층 전환 시 상태 재구성
    if (floor > 1) {
      const nextSeed = Math.floor(rng() * 0xffffffff)
      const deck = shuffleDeck(createFixedDeck(), nextSeed)
      const hand = deck.slice(0, HAND_SIZE)
      const floorConfig = FLOOR_CONFIGS[floor - 1]
      state = {
        ...state,
        currentFloor: floor,
        enemyHp: floorConfig.enemyHp,
        enemyMaxHp: floorConfig.enemyHp,
        hand,
        deck: deck.slice(HAND_SIZE),
        discardPile: [],
        selectedCards: [],
        discardsLeft: BASE_DISCARDS,
        playsLeft: floorConfig.maxPlays,
        playerHp,
        phase: 'select',
      }
    } else {
      state = { ...state, playerHp }
    }

    let attackCount = 0
    let floorDone = false

    while (!floorDone) {
      // 종료 조건 확인
      if (state.phase === 'floor-reward') {
        floorsCleared++
        floorStats.push({ floor, attackCount, cleared: true })
        playerHp = state.playerHp
        floor++
        floorDone = true
        break
      }

      if (state.phase === 'result') {
        if (state.isVictory) {
          floorsCleared = state.floorsCleared
          floorStats.push({ floor, attackCount, cleared: true })
        } else {
          deathFloor = floor
          floorStats.push({ floor, attackCount, cleared: false })
        }
        return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats }
      }

      if (state.playsLeft <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats }
      }

      if (state.playerHp <= 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats }
      }

      // 탐욕 봇: 버리기는 사용하지 않음 (항상 최선 조합 출수)
      const selectedIds = greedySelectCards(state.hand)
      if (selectedIds.length === 0) {
        deathFloor = floor
        floorStats.push({ floor, attackCount, cleared: false })
        return { victory: false, floorsCleared, deathFloor, floorStats }
      }

      state = playCards(state, selectedIds)
      attackCount++
      playerHp = state.playerHp
    }
  }

  return { victory: state.isVictory, floorsCleared: state.floorsCleared, deathFloor, floorStats }
}

/**
 * 분포 통계 계산
 */
export interface DistStats {
  mean: number
  min: number
  max: number
  stddev: number
}

function calcStats(values: number[]): DistStats {
  if (values.length === 0) return { mean: 0, min: 0, max: 0, stddev: 0 }
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const min = Math.min(...values)
  const max = Math.max(...values)
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n
  const stddev = Math.sqrt(variance)
  return { mean, min, max, stddev }
}

/**
 * 탐욕 봇 1000판 시뮬레이션 실행
 * @returns 층별 공격 횟수 분포, 클리어율, 원샷 클리어율
 */
export interface SimulationReport {
  runs: number
  clearRate: number          // %
  oneShotClearRate: number   // % — 1층 1회 격파
  floorAttacks: Record<number, DistStats>   // floor → 격파 성공 시 공격 횟수 분포
  deathsByFloor: Record<number, number>
  csvLines: string[]         // CSV 출력용
}

export function runGreedySimulation(runs = 1000): SimulationReport {
  let victories = 0
  let oneShotClears = 0
  const floorAttackData: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] }
  const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

  for (let i = 0; i < runs; i++) {
    const result = simulateGreedyRun(i * 12345 + 7777)
    if (result.victory) victories++

    for (const fs of result.floorStats) {
      if (fs.cleared) {
        floorAttackData[fs.floor].push(fs.attackCount)
        if (fs.floor === 1 && fs.attackCount === 1) oneShotClears++
      } else if (result.deathFloor === fs.floor) {
        deathsByFloor[fs.floor] = (deathsByFloor[fs.floor] || 0) + 1
      }
    }
  }

  const clearRate = (victories / runs) * 100
  const oneShotClearRate = (oneShotClears / runs) * 100
  const floorAttacks: Record<number, DistStats> = {}
  for (let f = 1; f <= 4; f++) {
    floorAttacks[f] = calcStats(floorAttackData[f])
  }

  // CSV 생성
  const csvLines = [
    'floor,mean_attacks,min_attacks,max_attacks,stddev_attacks,cleared_runs',
    ...([1, 2, 3, 4].map(f => {
      const s = floorAttacks[f]
      const cleared = floorAttackData[f].length
      return `${f},${s.mean.toFixed(2)},${s.min},${s.max},${s.stddev.toFixed(2)},${cleared}`
    })),
  ]

  return {
    runs,
    clearRate,
    oneShotClearRate,
    floorAttacks,
    deathsByFloor,
    csvLines,
  }
}
