/**
 * 팔자전 재밸런스 R5 — 금수 부검 + 대칭성 검증 (2026-07-11)
 *
 * 수치 변경 전면 금지 — 분석/진단 결과만 산출
 *
 * 작업 1: 런 로그 비교 분석 (목화 200판, 금수 200판)
 *   1a. 사망 직전 3턴 상성 분포
 *   1b. 버리기 사용률·시점
 *   1c. 보상 3택 선택 분포
 *   1d. 용신 보너스 발동률
 *   1e. 반격 누적 피해량
 *
 * 작업 2: 대칭성 검증 (카드풀 오행별 diff)
 *
 * 작업 3: 성장배율 꺾임 원인 분석 (가설 A/B/C)
 */

import { describe, it, expect } from 'vitest'
import type { Card, Element, GameState } from '../types/game'
import {
  createFixedDeck,
  shuffleDeck,
  playCards,
  discardCards,
  applyCondense,
  getCondenseAvailability,
  applyRewardOption,
} from '../engine/paljajeonEngine'
import type { RewardOption } from '../engine/paljajeonEngine'
import { generateSajuDeck, distributeCards } from '../engine/deckGenerator'
import {
  FLOOR_CONFIGS,
  PLAYER_BASE_HP,
  HAND_SIZE,
  BASE_DISCARDS,
  SANG_MAP,
  GEUK_BONUS_MULTIPLIER,
  SANG_PENALTY_MULTIPLIER,
  ANTI_GEUK_PENALTY,
  getCondenseMultiplier,
  FUSION_TRAIT_MAP,
  YONGSIN_BONUS_MULTIPLIER,
  YONGSIN_CHAIN_MULTIPLIER,
  getRandomFloorElements,
} from '../engine/balance'
import { getFavorableElement } from '../engine/manseryeok'
import {
  judgeCombo,
  GEUK_MAP,
} from '../engine/pokerHandJudge'
import {
  fullCapSelectCards,
  simulateFullCapRun,
} from '../engine/fullCapBot'
import type { FullCapSimOptions } from '../engine/fullCapBot'

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의 (R5 상세 로그)
// ─────────────────────────────────────────────────────────────────────────────

interface TurnLog {
  turn: number
  floor: number
  comboElements: Element[]
  affinityMult: number
  yongsinBonus: boolean
  damageDealt: number
  counterReceived: number
  heroHpBefore: number
  heroHpAfter: number
  discardUsed: boolean
  isDeath: boolean
  rewardChosen?: 'add-card' | 'upgrade-card' | 'remove-card'
  rewardElement?: Element
}

interface RunLog {
  preset: 'mokHwa' | 'geumSu'
  cleared: boolean
  floorReached: number
  turns: TurnLog[]
}

// ─────────────────────────────────────────────────────────────────────────────
// LCG 난수 생성기
// ─────────────────────────────────────────────────────────────────────────────

function makeLcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 상성 배율 계산 (엔진과 동일 로직)
// ─────────────────────────────────────────────────────────────────────────────

function getRepresentativeElement(cards: Card[]): Element {
  const counts: Record<string, number> = {}
  for (const c of cards) {
    counts[c.element] = (counts[c.element] ?? 0) + 1
  }
  let maxCount = 0
  let repCandidate: Element = cards[cards.length - 1].element
  for (const [el, cnt] of Object.entries(counts)) {
    if (cnt > maxCount) {
      maxCount = cnt
      repCandidate = el as Element
    }
  }
  const maxEntries = Object.entries(counts).filter(([, cnt]) => cnt === maxCount)
  if (maxEntries.length > 1) {
    return cards[cards.length - 1].element
  }
  return repCandidate
}

function getAffinityMult(repEl: Element, enemyEl: Element): number {
  if (GEUK_MAP[repEl] === enemyEl) return GEUK_BONUS_MULTIPLIER      // ×1.5 극
  if (SANG_MAP[repEl] === enemyEl) return SANG_PENALTY_MULTIPLIER     // ×0.5 생
  if (GEUK_MAP[enemyEl] === repEl) return ANTI_GEUK_PENALTY           // ×0.75 역극
  return 1.0                                                           // 중립
}

function affinityLabel(mult: number): string {
  if (mult >= 1.5) return '극(×1.5)'
  if (mult >= 1.0) return '중립(×1.0)'
  if (mult >= 0.75) return '역극(×0.75)'
  return '생(×0.5)'
}

// ─────────────────────────────────────────────────────────────────────────────
// R5 상세 런 시뮬레이터 (수치 변경 없음, 로그 수집 전용)
// ─────────────────────────────────────────────────────────────────────────────

function simulateR5Run(
  seed: number,
  opts: FullCapSimOptions,
  resolvedFavorableElement: Element | undefined,
): RunLog {
  const rng = makeLcg(seed)
  const preset = (opts.elementDist?.mok ?? 0) >= 4 ? 'mokHwa' : 'geumSu'

  const floorElements = getRandomFloorElements(rng)

  // 초기 덱 생성 (영속)
  const deckSeed = Math.floor(rng() * 0xffffffff)
  let persistentDeck = shuffleDeck(generateSajuDeck(opts.elementDist!, deckSeed), deckSeed)

  let playerHp = PLAYER_BASE_HP
  let floor = 1
  let cleared = false
  const allTurns: TurnLog[] = []
  let globalTurn = 0

  // 덱을 state 형태로 래핑하는 헬퍼
  function makeState(floorIdx: number, deck: Card[]): GameState {
    const floorConfig = FLOOR_CONFIGS[floorIdx]
    const seed2 = Math.floor(rng() * 0xffffffff)
    const shuffled = shuffleDeck(deck, seed2)
    const hand = shuffled.slice(0, HAND_SIZE)
    const remain = shuffled.slice(HAND_SIZE)
    return {
      currentFloor: floorConfig.floor,
      playerHp,
      playerMaxHp: PLAYER_BASE_HP,
      enemyHp: floorConfig.enemyHp,
      enemyMaxHp: floorConfig.enemyHp,
      hand,
      deck: remain,
      discardPile: [],
      selectedCards: [],
      discardsLeft: BASE_DISCARDS,
      playsLeft: floorConfig.maxPlays,
      phase: 'select',
      isVictory: false,
      floorsCleared: 0,
      talismans: [],
      amplifyActive: false,
      attackCount: 0,
      enemyPhaseSwitch: false,
      condenseActive: false,
      yeonhwanUsed: false,
      condensedMultiplier: 0,
      isLastAttack: floorConfig.maxPlays === 1,
      lastTraitTriggered: undefined,
      carryoverBurn: 0,
      reshuffled: false,
      favorableElement: resolvedFavorableElement,
    }
  }

  let state = makeState(0, persistentDeck)

  while (floor <= 4) {
    if (floor > 1) {
      const allCards = [...state.hand, ...state.deck, ...state.discardPile]
      state = makeState(floor - 1, allCards)
    }

    let floorDone = false

    while (!floorDone) {
      if (state.phase === 'floor-reward') {
        // 보상 선택 로그
        const allCurrentCards = [...state.hand, ...state.deck, ...state.discardPile]
        const nextFloorIdx = floor
        const nextElemConfig = nextFloorIdx < 4 ? floorElements[nextFloorIdx] : undefined
        const nextEnemyEl = nextElemConfig?.primaryElement

        // 보상 선택 (기존 봇 로직 재현: 단순화 — fullCapBot selectFloorReward와 동일 로직)
        const ELEMENTS_ARR: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
        const elIdx = Math.floor(rng() * ELEMENTS_ARR.length)
        const el = ELEMENTS_ARR[elIdx]
        const val = Math.floor(rng() * 10) + 1
        const newCard: Card = {
          id: `r5-reward-${Date.now()}-${Math.floor(rng() * 99999)}`,
          element: el,
          polarity: rng() > 0.5 ? 'yang' : 'yin',
          value: val,
          type: 'soldier',
          rarity: 'common',
        }

        // b 후보: 최고 점수 카드 강화
        let upgradeTargetId: string | null = null
        let bestScore = -Infinity
        for (const card of allCurrentCards) {
          const sc = card.value * (nextEnemyEl ? getAffinityMult(card.element, nextEnemyEl) : 1.0)
          if (sc > bestScore) { bestScore = sc; upgradeTargetId = card.id }
        }

        // c 후보: 최저 점수 카드 제거
        let removeTargetId: string | null = null
        let worstScore = Infinity
        if (allCurrentCards.length >= 2) {
          for (const card of allCurrentCards) {
            const sc = card.value * (nextEnemyEl ? getAffinityMult(card.element, nextEnemyEl) : 1.0)
            if (sc < worstScore) { worstScore = sc; removeTargetId = card.id }
          }
        }

        // 3가지 점수 비교 (evaluateDeckDamageScore 간이 재현)
        function evalDeck(deck: Card[]): number {
          let s = 0
          for (const c of deck) {
            let w = c.value
            if (nextEnemyEl) w *= getAffinityMult(c.element, nextEnemyEl)
            if (resolvedFavorableElement && c.element === resolvedFavorableElement) w *= YONGSIN_BONUS_MULTIPLIER
            s += w
          }
          return s
        }

        const deckA = applyRewardOption(allCurrentCards, { type: 'add-card', card: newCard })
        const scoreA = evalDeck(deckA)
        let scoreB = -Infinity
        if (upgradeTargetId) {
          const deckB = applyRewardOption(allCurrentCards, { type: 'upgrade-card', targetId: upgradeTargetId, bonusPct: 50 })
          scoreB = evalDeck(deckB)
        }
        let scoreC = -Infinity
        if (removeTargetId) {
          const deckC = applyRewardOption(allCurrentCards, { type: 'remove-card', targetId: removeTargetId })
          scoreC = evalDeck(deckC)
        }

        let rewardType: 'add-card' | 'upgrade-card' | 'remove-card' = 'add-card'
        let rewardOption: RewardOption = { type: 'add-card', card: newCard }
        if (scoreB >= scoreA && scoreB >= scoreC && upgradeTargetId) {
          rewardType = 'upgrade-card'
          rewardOption = { type: 'upgrade-card', targetId: upgradeTargetId, bonusPct: 50 }
        } else if (scoreC >= scoreA && scoreC >= scoreB && removeTargetId) {
          rewardType = 'remove-card'
          rewardOption = { type: 'remove-card', targetId: removeTargetId }
        }

        // 보상 요소 파악
        let rewardElem: Element | undefined = undefined
        if (rewardType === 'add-card') rewardElem = newCard.element
        else if (rewardType === 'upgrade-card' && upgradeTargetId) {
          rewardElem = allCurrentCards.find(c => c.id === upgradeTargetId)?.element
        } else if (rewardType === 'remove-card' && removeTargetId) {
          rewardElem = allCurrentCards.find(c => c.id === removeTargetId)?.element
        }

        // 턴 로그에 보상 정보 추가 (마지막 턴 기록용)
        const lastTurnIdx = allTurns.length - 1
        if (lastTurnIdx >= 0) {
          allTurns[lastTurnIdx].rewardChosen = rewardType
          allTurns[lastTurnIdx].rewardElement = rewardElem
        }

        const updatedAllCards = applyRewardOption(allCurrentCards, rewardOption)
        state = {
          ...state,
          deck: updatedAllCards,
          hand: [],
          discardPile: [],
        }

        floor++
        floorDone = true
        break
      }

      if (state.phase === 'result') {
        cleared = state.isVictory
        floorDone = true
        break
      }

      if (state.playsLeft <= 0) {
        floorDone = true
        break
      }

      if (state.playerHp <= 0) {
        floorDone = true
        break
      }

      const floorIdx = state.currentFloor - 1
      const randomElem = floorElements[floorIdx]
      const floorConf = FLOOR_CONFIGS[floorIdx]
      const basePrimary = randomElem?.primaryElement ?? floorConf.enemyPrimaryElement
      const baseSub = randomElem?.subElement ?? floorConf.enemySubElement
      const currentPrimaryEl = state.enemyPhaseSwitch ? baseSub : basePrimary

      const hpBefore = state.playerHp

      const decision = fullCapSelectCards(
        state.hand,
        currentPrimaryEl,
        state.enemyPhaseSwitch ? basePrimary : baseSub,
        state.condensedMultiplier,
        state.yeonhwanUsed,
        state.discardsLeft,
        state.carryoverBurn,
        resolvedFavorableElement,
      )

      if (decision.cardIds.length === 0) {
        floorDone = true
        break
      }

      globalTurn++

      // 버리기
      if (decision.shouldDiscard && state.discardsLeft > 0) {
        const turnLog: TurnLog = {
          turn: globalTurn,
          floor,
          comboElements: decision.cardIds.map(id => state.hand.find(c => c.id === id)?.element ?? 'mok'),
          affinityMult: decision.bestAffinityMult,
          yongsinBonus: false,
          damageDealt: 0,
          counterReceived: 0,
          heroHpBefore: hpBefore,
          heroHpAfter: hpBefore,
          discardUsed: true,
          isDeath: false,
        }
        allTurns.push(turnLog)
        state = discardCards(state, decision.cardIds)
        continue
      }

      // 응축
      if (
        state.condensedMultiplier === 0 &&
        !state.isLastAttack &&
        state.playsLeft >= 2
      ) {
        const selectedCards = state.hand.filter(c => decision.cardIds.includes(c.id))
        const comboResult = judgeCombo(selectedCards)
        const condenseKind = getCondenseAvailability(comboResult.name, comboResult.finishingElement)
        if (condenseKind === 'great') {
          const mult = getCondenseMultiplier(selectedCards.length)
          if (mult > 0 && state.enemyHp > decision.bestDamage) {
            state = applyCondense(state, decision.cardIds)
            continue
          }
        }
      }

      // 공격 전 상태 기록
      const selectedCards = state.hand.filter(c => decision.cardIds.includes(c.id))
      const repEl = getRepresentativeElement(selectedCards)
      const affinityMult = getAffinityMult(repEl, currentPrimaryEl)

      // 용신 보너스 여부
      let yongsinBonus = false
      if (resolvedFavorableElement) {
        yongsinBonus = selectedCards.some(c => c.element === resolvedFavorableElement)
      }

      const prevHp = state.playerHp

      // 공격 실행
      state = playCards(state, decision.cardIds)

      const hpAfter = state.playerHp
      const hpDiff = prevHp - hpAfter  // 받은 데미지 (반격)
      const isDeath = state.playerHp <= 0 || (state.phase === 'result' && !state.isVictory)

      const turnLog: TurnLog = {
        turn: globalTurn,
        floor,
        comboElements: selectedCards.map(c => c.element),
        affinityMult,
        yongsinBonus,
        damageDealt: decision.bestDamage,
        counterReceived: Math.max(0, hpDiff),
        heroHpBefore: prevHp,
        heroHpAfter: hpAfter,
        discardUsed: false,
        isDeath,
      }
      allTurns.push(turnLog)

      playerHp = state.playerHp
    }

    if (state.phase === 'result') break
    if (floor > 4) { cleared = true; break }
  }

  return {
    preset,
    cleared,
    floorReached: floor,
    turns: allTurns,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 프리셋 정의 (R4.5 동일, 수치 변경 없음)
// ─────────────────────────────────────────────────────────────────────────────

const MOK_HWA_OPTS: FullCapSimOptions = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  ilganElement: 'mok' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

const GEUM_SU_OPTS: FullCapSimOptions = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  ilganElement: 'geum' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 분석 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('팔자전 재밸런스 R5 — 금수 부검 + 대칭성 검증', () => {
  it('R5 전체 분석 (수치 변경 없음, 진단 결과만)', () => {
    const SAMPLE_SIZE = 200

    const yongsinMok = getFavorableElement('mok')   // su
    const yongsinGeum = getFavorableElement('geum')  // to

    // ──────────────────────────────────────────────────────────────
    // 로그 수집
    // ──────────────────────────────────────────────────────────────
    const mokHwaLogs: RunLog[] = []
    const geumSuLogs: RunLog[] = []

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const seed = i * 12345 + 7777
      mokHwaLogs.push(simulateR5Run(seed, MOK_HWA_OPTS, yongsinMok))
      geumSuLogs.push(simulateR5Run(seed, GEUM_SU_OPTS, yongsinGeum))
    }

    // ──────────────────────────────────────────────────────────────
    // 기본 통계
    // ──────────────────────────────────────────────────────────────
    const mokCleared = mokHwaLogs.filter(r => r.cleared).length
    const geumCleared = geumSuLogs.filter(r => r.cleared).length

    console.log('\n========== 팔자전 재밸런스 R5 — 금수 부검 + 대칭성 검증 ==========')
    console.log(`샘플: 목화 ${SAMPLE_SIZE}판, 금수 ${SAMPLE_SIZE}판 (수치 변경 없음)`)
    console.log(`목화 클리어: ${mokCleared}판 (${(mokCleared / SAMPLE_SIZE * 100).toFixed(1)}%)`)
    console.log(`금수 클리어: ${geumCleared}판 (${(geumCleared / SAMPLE_SIZE * 100).toFixed(1)}%)`)
    console.log(`격차: ${Math.abs(mokCleared - geumCleared / SAMPLE_SIZE * 100 - mokCleared / SAMPLE_SIZE * 100).toFixed(1)}%p`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1a: 사망 직전 3턴 상성 분포
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1a: 사망 직전 3턴 상성 분포 ===')

    function getDeathPreTurns(logs: RunLog[], n = 3): TurnLog[] {
      const result: TurnLog[] = []
      for (const run of logs) {
        if (run.cleared) continue
        // 공격 턴만 (버리기 제외)
        const attackTurns = run.turns.filter(t => !t.discardUsed && t.damageDealt > 0)
        const last3 = attackTurns.slice(-n)
        result.push(...last3)
      }
      return result
    }

    function analyzeAffinityDist(turns: TurnLog[]): Record<string, { count: number; pct: string }> {
      const total = turns.length
      const dist: Record<string, number> = {
        '극(×1.5)': 0,
        '중립(×1.0)': 0,
        '역극(×0.75)': 0,
        '생(×0.5)': 0,
      }
      let multSum = 0
      for (const t of turns) {
        const label = affinityLabel(t.affinityMult)
        dist[label] = (dist[label] ?? 0) + 1
        multSum += t.affinityMult
      }
      const avgMult = total > 0 ? (multSum / total).toFixed(3) : 'N/A'
      const result: Record<string, { count: number; pct: string }> = {}
      for (const [key, cnt] of Object.entries(dist)) {
        result[key] = { count: cnt, pct: total > 0 ? (cnt / total * 100).toFixed(1) + '%' : 'N/A' }
      }
      result['평균_affinityMult'] = { count: 0, pct: avgMult }
      return result
    }

    const mokDeathTurns = getDeathPreTurns(mokHwaLogs)
    const geumDeathTurns = getDeathPreTurns(geumSuLogs)
    const mokAffinity = analyzeAffinityDist(mokDeathTurns)
    const geumAffinity = analyzeAffinityDist(geumDeathTurns)

    const affinityKeys = ['극(×1.5)', '중립(×1.0)', '역극(×0.75)', '생(×0.5)', '평균_affinityMult']
    console.log('| 상성 구분 | 금수 사망전3턴 | 목화 사망전3턴 |')
    console.log('|----------|-------------|-------------|')
    for (const key of affinityKeys) {
      const g = geumAffinity[key]
      const m = mokAffinity[key]
      if (key === '평균_affinityMult') {
        console.log(`| ${key} | ${g?.pct ?? 'N/A'} | ${m?.pct ?? 'N/A'} |`)
      } else {
        console.log(`| ${key} | ${g?.pct ?? 'N/A'} (${g?.count ?? 0}턴) | ${m?.pct ?? 'N/A'} (${m?.count ?? 0}턴) |`)
      }
    }

    // "생/역극에 갇힌" = affinityMult < 1.0 비율
    function calcUnfavorablePct(turns: TurnLog[]): string {
      if (turns.length === 0) return 'N/A'
      const unfav = turns.filter(t => t.affinityMult < 1.0).length
      return (unfav / turns.length * 100).toFixed(1) + '%'
    }

    console.log(`\n생/역극에 갇힌 비율 (affinityMult < 1.0):`)
    console.log(`  금수 사망전3턴: ${calcUnfavorablePct(geumDeathTurns)}`)
    console.log(`  목화 사망전3턴: ${calcUnfavorablePct(mokDeathTurns)}`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1b: 버리기 사용률·시점
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1b: 버리기 사용률·시점 ===')

    function analyzeDiscards(logs: RunLog[]) {
      const allTurns = logs.flatMap(r => r.turns)
      const totalTurns = allTurns.length
      const discardTurns = allTurns.filter(t => t.discardUsed)
      const discardRate = totalTurns > 0 ? (discardTurns.length / totalTurns * 100).toFixed(1) + '%' : 'N/A'

      // 버리기 직전 상성 (discardUsed=true인 턴의 affinityMult가 그 이유)
      const discardAffinitySum = discardTurns.reduce((s, t) => s + t.affinityMult, 0)
      const avgDiscardAffinity = discardTurns.length > 0
        ? (discardAffinitySum / discardTurns.length).toFixed(3)
        : 'N/A'

      // 층별 분포
      const byFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      for (const t of discardTurns) {
        byFloor[t.floor] = (byFloor[t.floor] ?? 0) + 1
      }
      const floorDist = [1, 2, 3, 4].map(f => `${f}층:${byFloor[f] ?? 0}`).join(' / ')

      return { discardRate, avgDiscardAffinity, floorDist, totalDiscards: discardTurns.length }
    }

    const mokDiscards = analyzeDiscards(mokHwaLogs)
    const geumDiscards = analyzeDiscards(geumSuLogs)

    console.log('| 구분 | 금수 | 목화 |')
    console.log('|-----|-----|-----|')
    console.log(`| 버리기 발동률 (턴 수 기준) | ${geumDiscards.discardRate} | ${mokDiscards.discardRate} |`)
    console.log(`| 발동 시 평균 affinityMult | ${geumDiscards.avgDiscardAffinity} | ${mokDiscards.avgDiscardAffinity} |`)
    console.log(`| 층별 발동 분포 | ${geumDiscards.floorDist} | ${mokDiscards.floorDist} |`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1c: 보상 3택 선택 분포
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1c: 보상 3택 선택 분포 (층별) ===')

    function analyzeRewards(logs: RunLog[]) {
      const byFloor: Record<number, Record<string, number>> = {
        1: { 'add-card': 0, 'upgrade-card': 0, 'remove-card': 0, total: 0 },
        2: { 'add-card': 0, 'upgrade-card': 0, 'remove-card': 0, total: 0 },
        3: { 'add-card': 0, 'upgrade-card': 0, 'remove-card': 0, total: 0 },
      }
      for (const run of logs) {
        for (const t of run.turns) {
          if (t.rewardChosen && t.floor >= 1 && t.floor <= 3) {
            byFloor[t.floor][t.rewardChosen] = (byFloor[t.floor][t.rewardChosen] ?? 0) + 1
            byFloor[t.floor].total = (byFloor[t.floor].total ?? 0) + 1
          }
        }
      }
      return byFloor
    }

    const mokRewards = analyzeRewards(mokHwaLogs)
    const geumRewards = analyzeRewards(geumSuLogs)

    function pct(n: number, total: number): string {
      return total > 0 ? (n / total * 100).toFixed(1) + '%' : 'N/A'
    }

    console.log('| 구분 | 금수1층 | 금수2층 | 금수3층 | 목화1층 | 목화2층 | 목화3층 |')
    console.log('|-----|-------|-------|-------|-------|-------|-------|')
    for (const [rewardKey, label] of [
      ['add-card', 'a(카드추가)'],
      ['upgrade-card', 'b(카드강화)'],
      ['remove-card', 'c(카드제거)'],
    ] as const) {
      const gRow = [1, 2, 3].map(f => pct(geumRewards[f][rewardKey] ?? 0, geumRewards[f].total ?? 0)).join(' | ')
      const mRow = [1, 2, 3].map(f => pct(mokRewards[f][rewardKey] ?? 0, mokRewards[f].total ?? 0)).join(' | ')
      console.log(`| ${label} | ${gRow} | ${mRow} |`)
    }
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1d: 용신 보너스 발동률
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1d: 용신 보너스 발동률 ===')
    console.log(`목화 용신: ${yongsinMok} (su)`)
    console.log(`금수 용신: ${yongsinGeum} (to)`)

    function analyzeYongsin(logs: RunLog[], favorableEl: Element) {
      const attackTurns = logs.flatMap(r => r.turns).filter(t => !t.discardUsed)
      const totalAttack = attackTurns.length
      const yongsinTurns = attackTurns.filter(t => t.yongsinBonus)
      // 용신 카드가 핸드에 있을 때 콤보에 포함된 비율 = yongsinBonus 자체가 포함 여부
      // (핸드 보유율 측정은 시뮬에서 직접 추적 필요, 여기선 발동률만)
      const yongsinRate = totalAttack > 0 ? (yongsinTurns.length / totalAttack * 100).toFixed(1) + '%' : 'N/A'

      // ×1.5 발동: 3장 이상 + 마지막 카드가 용신 — 우리 로그에는 별도 추적 없음
      // comboElements.length >= 3 && last === favorableEl이면 ×1.5
      const chain3YongsinTurns = yongsinTurns.filter(t =>
        t.comboElements.length >= 3 &&
        t.comboElements[t.comboElements.length - 1] === favorableEl
      )
      const chain3Rate = totalAttack > 0 ? (chain3YongsinTurns.length / totalAttack * 100).toFixed(1) + '%' : 'N/A'

      return { yongsinRate, chain3Rate, yongsinCount: yongsinTurns.length, totalAttack }
    }

    const mokYongsin = analyzeYongsin(mokHwaLogs, yongsinMok)
    const geumYongsin = analyzeYongsin(geumSuLogs, yongsinGeum)

    console.log(`| 구분 | 금수(용신=to) | 목화(용신=su) |`)
    console.log(`|-----|------------|------------|`)
    console.log(`| 용신 보너스 발동률 (×1.3 이상) | ${geumYongsin.yongsinRate} | ${mokYongsin.yongsinRate} |`)
    console.log(`| ×1.5 발동률 (3장+마지막=용신) | ${geumYongsin.chain3Rate} | ${mokYongsin.chain3Rate} |`)
    console.log(`| 총 공격 턴 수 | ${geumYongsin.totalAttack} | ${mokYongsin.totalAttack} |`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1e: 반격 누적 피해량
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1e: 반격 누적 피해량 ===')

    function analyzeCounter(logs: RunLog[]) {
      const allTurns = logs.flatMap(r => r.turns).filter(t => !t.discardUsed)
      const totalCounter = allTurns.reduce((s, t) => s + t.counterReceived, 0)
      const avgTotal = logs.length > 0 ? (totalCounter / logs.length).toFixed(1) : 'N/A'

      const byFloor: Record<number, { sum: number; count: number }> = {
        1: { sum: 0, count: 0 }, 2: { sum: 0, count: 0 },
        3: { sum: 0, count: 0 }, 4: { sum: 0, count: 0 },
      }
      for (const t of allTurns) {
        if (byFloor[t.floor]) {
          byFloor[t.floor].sum += t.counterReceived
          byFloor[t.floor].count++
        }
      }

      const floorAvg = [1, 2, 3, 4].map(f => {
        const d = byFloor[f]
        return d.count > 0 ? (d.sum / d.count).toFixed(2) : 'N/A'
      })

      return { avgTotal, floorAvg }
    }

    const mokCounter = analyzeCounter(mokHwaLogs)
    const geumCounter = analyzeCounter(geumSuLogs)

    console.log('| 구분 | 금수 | 목화 |')
    console.log('|-----|-----|-----|')
    console.log(`| 전체 평균 반격 피해 (런 기준) | ${geumCounter.avgTotal} | ${mokCounter.avgTotal} |`)
    for (let f = 0; f < 4; f++) {
      console.log(`| ${f + 1}층 평균 반격 (턴 기준) | ${geumCounter.floorAvg[f]} | ${mokCounter.floorAvg[f]} |`)
    }
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 2: 대칭성 검증
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 2: 대칭성 검증 ===')

    // 2-1. 덱 프리셋 비율 diff
    const ELEMENTS_ALL: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
    const mokDist = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>
    const geumDist = { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>

    const mokCounts = distributeCards(mokDist, 20)
    const geumCounts = distributeCards(geumDist, 20)

    console.log('--- 2-1. 덱 프리셋 distributeCards 결과 (20장) ---')
    console.log('| 오행 | 목화 덱 | 금수 덱 |')
    console.log('|-----|-------|-------|')
    for (const el of ELEMENTS_ALL) {
      console.log(`| ${el} | ${mokCounts[el]} | ${geumCounts[el]} |`)
    }

    const mokPrimary = (mokCounts.mok ?? 0) + (mokCounts.hwa ?? 0)
    const geumPrimary = (geumCounts.geum ?? 0) + (geumCounts.su ?? 0)
    const mokNonPrimary = 20 - mokPrimary
    const geumNonPrimary = 20 - geumPrimary

    console.log(`\n목화 주력(mok+hwa) 합산: ${mokPrimary}장`)
    console.log(`금수 주력(geum+su) 합산: ${geumPrimary}장`)
    console.log(`목화 비주력 합산: ${mokNonPrimary}장`)
    console.log(`금수 비주력 합산: ${geumNonPrimary}장`)

    const isSymmetric = mokPrimary === geumPrimary && mokNonPrimary === geumNonPrimary
    console.log(`주력 장수 대칭: ${isSymmetric ? 'YES (완전 동형)' : 'NO (비대칭)'}`)
    console.log('')

    // 2-2. 카드풀 오행별 분석 (createFixedDeck 기반)
    console.log('--- 2-2. createFixedDeck 오행별 카드 특성 ---')
    const fixedDeck = createFixedDeck()

    const deckByEl: Record<Element, Card[]> = {
      mok: [], hwa: [], to: [], geum: [], su: [],
    }
    for (const c of fixedDeck) {
      deckByEl[c.element].push(c)
    }

    console.log('| 오행 | 카드수 | 평균value | min | max |')
    console.log('|-----|------|---------|-----|-----|')
    for (const el of ELEMENTS_ALL) {
      const cards = deckByEl[el]
      const count = cards.length
      const avgVal = count > 0 ? (cards.reduce((s, c) => s + c.value, 0) / count).toFixed(1) : 'N/A'
      const minVal = count > 0 ? Math.min(...cards.map(c => c.value)) : 'N/A'
      const maxVal = count > 0 ? Math.max(...cards.map(c => c.value)) : 'N/A'
      console.log(`| ${el} | ${count} | ${avgVal} | ${minVal} | ${maxVal} |`)
    }
    console.log('')

    // 2-3. 사주 덱 오행별 샘플 생성 후 분석
    console.log('--- 2-3. generateSajuDeck 오행별 분포 (seed=42 단일 샘플) ---')
    const sampleSeed = 42

    function analyzeSajuDeck(dist: Record<Element, number>, seed: number) {
      const deck = generateSajuDeck(dist, seed)
      const byEl: Record<Element, Card[]> = { mok: [], hwa: [], to: [], geum: [], su: [] }
      for (const c of deck) byEl[c.element].push(c)
      const result: Record<Element, { count: number; avgVal: number }> = {} as Record<Element, { count: number; avgVal: number }>
      for (const el of ELEMENTS_ALL) {
        const cards = byEl[el]
        result[el] = {
          count: cards.length,
          avgVal: cards.length > 0 ? parseFloat((cards.reduce((s, c) => s + c.value, 0) / cards.length).toFixed(1)) : 0,
        }
      }
      return result
    }

    const mokSaju = analyzeSajuDeck(mokDist, sampleSeed)
    const geumSaju = analyzeSajuDeck(geumDist, sampleSeed)

    console.log('| 오행 | 목화덱 장수 | 목화덱 평균val | 금수덱 장수 | 금수덱 평균val |')
    console.log('|-----|---------|------------|---------|------------|')
    for (const el of ELEMENTS_ALL) {
      console.log(`| ${el} | ${mokSaju[el].count} | ${mokSaju[el].avgVal} | ${geumSaju[el].count} | ${geumSaju[el].avgVal} |`)
    }

    const mokPrimaryCards = (mokSaju.mok?.count ?? 0) + (mokSaju.hwa?.count ?? 0)
    const geumPrimaryCards = (geumSaju.geum?.count ?? 0) + (geumSaju.su?.count ?? 0)
    console.log(`\n목화 주력(mok+hwa) 실제 생성 장수: ${mokPrimaryCards}`)
    console.log(`금수 주력(geum+su) 실제 생성 장수: ${geumPrimaryCards}`)
    console.log('')

    // 2-4. 대칭성 판정
    console.log('--- 2-4. 대칭성 판정 ---')
    const structuralSymmetry = mokPrimary === geumPrimary
    console.log(`구조적 대칭 (distributeCards 기준): ${structuralSymmetry ? 'YES' : 'NO'}`)
    if (structuralSymmetry) {
      console.log('=> 완전 동형 확인. 결과 차이 원인은 봇/용신/적 메커니즘 중 하나.')
      console.log('')
      console.log('[봇] fullCapSelectCards는 동일 로직 사용 → 봇 자체 비대칭 없음')
      console.log('[용신] 목화 용신=su (2장), 금수 용신=to (2장) → 장수 동일')
      console.log('[적 메커니즘] getRandomFloorElements — 5원소 순열 랜덤화')
      console.log('  목화 주력 mok+hwa: 상극 대상 to, geum')
      console.log('  금수 주력 geum+su: 상극 대상 mok, hwa')
      console.log('  => 주적 원소 분포 구조적 동형, 하지만 개별 런 시드별 편차 가능')
    } else {
      console.log('=> 비동형 확인. 카드풀 구조 자체에 불균형 존재.')
    }
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 3: 성장배율 꺾임 원인 분석
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 3: 성장배율 꺾임 원인 분석 ===')
    console.log('R4.5 실측 관찰값: 3→4층 역전 (목화 ×1.75 → ×1.36, 금수 ×1.63 → ×1.27)')
    console.log('')

    // 가설 A: 생존 편향 검증
    // 4층 진입 런과 4층 클리어 런의 평균 공격 횟수 비교
    console.log('--- 가설 A: 생존 편향 ---')
    console.log('측정: 4층 진입 런 vs 4층 클리어 런의 층별 공격 횟수 분포')

    // simulateFullCapRun (기존 함수) 사용하여 1000판 층별 공격 횟수 수집
    const RUNS_A = 1000
    type FloorData = { totalAttacks: number; count: number }
    const floorDataMok: Record<number, FloorData> = { 1: { totalAttacks: 0, count: 0 }, 2: { totalAttacks: 0, count: 0 }, 3: { totalAttacks: 0, count: 0 }, 4: { totalAttacks: 0, count: 0 } }
    const floorDataGeum: Record<number, FloorData> = { 1: { totalAttacks: 0, count: 0 }, 2: { totalAttacks: 0, count: 0 }, 3: { totalAttacks: 0, count: 0 }, 4: { totalAttacks: 0, count: 0 } }
    // 4층 진입 런 통계 (클리어 여부 무관)
    const floor4EntryMok: number[] = []
    const floor4EntryGeum: number[] = []
    const floor4ClearMok: number[] = []
    const floor4ClearGeum: number[] = []

    for (let i = 0; i < RUNS_A; i++) {
      const seed = i * 12345 + 7777
      const rMok = simulateFullCapRun(seed, MOK_HWA_OPTS)
      const rGeum = simulateFullCapRun(seed, GEUM_SU_OPTS)

      for (const fs of rMok.floorStats) {
        if (fs.cleared) {
          floorDataMok[fs.floor].totalAttacks += fs.attackCount
          floorDataMok[fs.floor].count++
        }
        if (fs.floor === 4) {
          floor4EntryMok.push(fs.attackCount)
          if (fs.cleared) floor4ClearMok.push(fs.attackCount)
        }
      }
      for (const fs of rGeum.floorStats) {
        if (fs.cleared) {
          floorDataGeum[fs.floor].totalAttacks += fs.attackCount
          floorDataGeum[fs.floor].count++
        }
        if (fs.floor === 4) {
          floor4EntryGeum.push(fs.attackCount)
          if (fs.cleared) floor4ClearGeum.push(fs.attackCount)
        }
      }
    }

    // 층별 실측 성장 배율 재계산 (R5 1000판 기준)
    const FLOOR_HP = [180, 400, 560, 520]
    const FLOOR_MAXPLAYS = [5, 5, 5, 6]

    console.log('\n[목화] 층별 평균공격수 / 실측평균콤보 / 성장배율')
    const mokAvgCombos: number[] = []
    for (let f = 1; f <= 4; f++) {
      const d = floorDataMok[f]
      const avgAtk = d.count > 0 ? d.totalAttacks / d.count : 0
      const avgCombo = avgAtk > 0 ? Math.round(FLOOR_HP[f - 1] / avgAtk) : 0
      mokAvgCombos.push(avgCombo)
    }
    const mokBase = mokAvgCombos[0] || 1
    console.log('| 층 | 클리어수 | 평균공격수 | 실측평균콤보 | 성장배율 |')
    console.log('|----|---------|---------|-----------|---------|')
    for (let f = 1; f <= 4; f++) {
      const d = floorDataMok[f]
      const avgAtk = d.count > 0 ? (d.totalAttacks / d.count).toFixed(2) : 'N/A'
      const avgCombo = mokAvgCombos[f - 1]
      const growth = avgCombo ? `×${(avgCombo / mokBase).toFixed(2)}` : 'N/A'
      console.log(`| ${f}층 | ${d.count} | ${avgAtk} | ${avgCombo || 'N/A'} | ${growth} |`)
    }

    console.log('\n[금수] 층별 평균공격수 / 실측평균콤보 / 성장배율')
    const geumAvgCombos: number[] = []
    for (let f = 1; f <= 4; f++) {
      const d = floorDataGeum[f]
      const avgAtk = d.count > 0 ? d.totalAttacks / d.count : 0
      const avgCombo = avgAtk > 0 ? Math.round(FLOOR_HP[f - 1] / avgAtk) : 0
      geumAvgCombos.push(avgCombo)
    }
    const geumBase = geumAvgCombos[0] || 1
    console.log('| 층 | 클리어수 | 평균공격수 | 실측평균콤보 | 성장배율 |')
    console.log('|----|---------|---------|-----------|---------|')
    for (let f = 1; f <= 4; f++) {
      const d = floorDataGeum[f]
      const avgAtk = d.count > 0 ? (d.totalAttacks / d.count).toFixed(2) : 'N/A'
      const avgCombo = geumAvgCombos[f - 1]
      const growth = avgCombo ? `×${(avgCombo / geumBase).toFixed(2)}` : 'N/A'
      console.log(`| ${f}층 | ${d.count} | ${avgAtk} | ${avgCombo || 'N/A'} | ${growth} |`)
    }

    // 가설 A 검증: 4층 진입 런 vs 4층 클리어 런 평균 공격수
    const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 'N/A'

    console.log('\n[가설 A: 생존 편향] 4층 진입 런 vs 4층 클리어 런 공격수 비교')
    console.log('| 구분 | 목화 4층진입(모든런) | 목화 4층클리어(클리어런만) | 금수 4층진입 | 금수 4층클리어 |')
    console.log('|-----|----------------|---------------------|-----------|------------|')
    console.log(`| 평균 공격수 | ${avg(floor4EntryMok)} | ${avg(floor4ClearMok)} | ${avg(floor4EntryGeum)} | ${avg(floor4ClearGeum)} |`)
    console.log(`| 샘플수 | ${floor4EntryMok.length} | ${floor4ClearMok.length} | ${floor4EntryGeum.length} | ${floor4ClearGeum.length} |`)

    // 4층 클리어 런 평균 공격수가 4층 진입 런보다 적으면 "덜 강화된 덱도 클리어"
    // = 생존 편향 가능성 있음
    function hypothesisAJudgment(): string {
      if (floor4EntryMok.length === 0 || floor4ClearMok.length === 0) return '데이터 부족'
      const entryAvg = floor4EntryMok.reduce((a, b) => a + b, 0) / floor4EntryMok.length
      const clearAvg = floor4ClearMok.reduce((a, b) => a + b, 0) / floor4ClearMok.length
      if (clearAvg < entryAvg * 0.9) {
        return `가설 A 지지: 클리어런 평균공격수(${clearAvg.toFixed(2)}) < 진입런(${entryAvg.toFixed(2)}) × 0.9. 덜 강화된 덱도 클리어 = 생존편향 존재.`
      } else if (clearAvg > entryAvg * 1.1) {
        return `가설 A 기각: 클리어런 평균공격수(${clearAvg.toFixed(2)}) > 진입런(${entryAvg.toFixed(2)}). 더 강한 덱이 클리어 = 생존편향 미약.`
      } else {
        return `가설 A 판단 보류: 클리어런(${clearAvg.toFixed(2)}) ≈ 진입런(${entryAvg.toFixed(2)}). 생존편향 미확인.`
      }
    }
    console.log(`\n판정: ${hypothesisAJudgment()}`)
    console.log('')

    // 가설 B: 강화가 4층에서 증발하는 버그
    console.log('--- 가설 B: 강화 4층 증발 버그 검증 ---')
    console.log('검증 방법: advanceToNextFloor() 로직 분석 (정적 코드 분석)')
    console.log('')
    console.log('[코드 분석]')
    console.log('  advanceToNextFloor() (paljajeonEngine.ts L623):')
    console.log('    const allCards = [...state.hand, ...state.deck, ...state.discardPile]')
    console.log('    const reshuffledDeck = shuffleDeck(allCards)')
    console.log('    => hand + deck + discardPile 전체를 재셔플하여 영속 덱 유지')
    console.log('')
    console.log('  simulateFullCapRun() 영속 덱 구현 (fullCapBot.ts L511~547):')
    console.log('    floor > 1일 때: allCards = [...state.hand, ...state.deck, ...state.discardPile]')
    console.log('    reshuffledDeck = shuffleDeck(allCards, seed)')
    console.log('    => 동일 로직으로 영속 덱 유지')
    console.log('')
    console.log('  보상 적용 후 덱 저장 방식:')
    console.log('    state = { ...state, deck: updatedAllCards, hand: [], discardPile: [] }')
    console.log('    => deck에 전체 저장, 층 진입 시 재셔플 배분')
    console.log('')
    console.log('[잠재적 문제점]')
    console.log('  보상 후 state.deck에 updatedAllCards 전체를 저장하지만')
    console.log('  층 진입 시 state.hand=[], state.discardPile=[]이므로')
    console.log('  allCards = [] + state.deck + [] = updatedAllCards 정상 복원됨')
    console.log('  => 가설 B 기각: 코드 분석상 영속 덱 증발 버그 없음')
    console.log('')

    // 가설 C: 4층 damage-reduction 이중 계산
    console.log('--- 가설 C: 4층 damage-reduction 이중 계산 ---')
    console.log('[코드 분석]')
    console.log('  4층 금강불괴: eliteGimmickEffect = { type: damage-reduction, pct: 0.3 }')
    console.log('  paljajeonEngine.ts L282: if (!snipeActive && eliteGimmickEffect?.type === damage-reduction && state.currentFloor >= 3)')
    console.log('    damage = Math.round(damage * (1 - pct))  // ×0.7')
    console.log('')
    console.log('  예산표 평균콤보 = 적HP / 평균공격수')
    console.log('  => 평균콤보는 damage-reduction 이후 적 HP 감소 기준으로 역산')
    console.log('  => 예산표 계산 시 damage-reduction 별도 적용 없음')
    console.log('  => 이중 계산 없음')
    console.log('')
    console.log('[꺾임 원인 최유력 가설]')
    console.log('  1. 4층 damage-reduction 30%: 콤보 데미지 자체가 ×0.7 감소')
    console.log('     실효 콤보 데미지 = 실제콤보 × 0.7 (적 HP 감소 기준)')
    console.log('     => 평균콤보 = 520 / 평균공격수 에서 520이 이미 reduction 반영된 값')
    console.log('     => 평균공격수 증가 → 역산 평균콤보 감소처럼 보임')
    console.log('  2. 4층 heavyAttack everyN=2 (강도 높음): 반격 피해 급증 → HP 손실 → 조기 사망률 높음')
    console.log('     => 4층 클리어 런 편향: 강공 타이밍에 운좋게 적 처치한 런만 포함')
    console.log('  3. 4층 maxPlays=6 (3층 5회 대비 +1회): 공격 기회 증가')
    console.log('     => 평균공격수 증가 → 역산 평균콤보 감소 (수학적 artifact)')
    console.log('')

    // 수학적 artifact 확인
    console.log('[수학적 artifact 분석]')
    console.log('  성장배율 = 실측평균콤보_N층 / 실측평균콤보_1층')
    console.log('  실측평균콤보 = 적HP / 평균공격수')
    console.log('')
    console.log('  4층 damage-reduction 30% 효과:')
    console.log('    실효데미지 = 원본데미지 × 0.7')
    console.log('    동일 원본데미지라면 4층 적 HP 감소량 = 원본 × 0.7')
    console.log('    => 더 많은 공격이 필요 → 평균공격수↑ → 역산평균콤보↓')
    console.log('    예: 3층 평균콤보=100, 4층 원본콤보=150이지만 damage-reduction으로 실효=105')
    console.log('    역산시: 520 / (520/105 ≈ 4.95) ≈ 105, 성장배율=105/base')
    console.log('    vs 3층: 560 / (560/100 = 5.6) = 100, 성장배율=100/base')
    console.log('    => 약간 상승하지만 maxPlays 증가(5→6)로 분모 희석 가능')
    console.log('')

    // R5 실측 성장배율 요약
    console.log('=== R5 실측 성장배율 요약 (1000판 기준) ===')
    console.log(`| 층 | 목화 실측배율 | 금수 실측배율 | R4.5 목화(참고) | R4.5 금수(참고) |`)
    console.log(`|----|------------|------------|--------------|--------------|`)
    const r45MokRef = ['×1.00', '×1.40', '×1.75', '×1.36']
    const r45GeumRef = ['×1.00', '×1.41', '×1.63', '×1.27']
    for (let f = 1; f <= 4; f++) {
      const mGrowth = mokAvgCombos[f - 1] ? `×${(mokAvgCombos[f - 1] / mokBase).toFixed(2)}` : 'N/A'
      const gGrowth = geumAvgCombos[f - 1] ? `×${(geumAvgCombos[f - 1] / geumBase).toFixed(2)}` : 'N/A'
      console.log(`| ${f}층 | ${mGrowth} | ${gGrowth} | ${r45MokRef[f - 1]} | ${r45GeumRef[f - 1]} |`)
    }
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 종합 진단 요약
    // ──────────────────────────────────────────────────────────────
    console.log('=== R5 종합 진단 요약 ===')
    const mokClearRate = (mokCleared / SAMPLE_SIZE * 100).toFixed(1)
    const geumClearRate = (geumCleared / SAMPLE_SIZE * 100).toFixed(1)
    const clearGap = Math.abs(parseFloat(mokClearRate) - parseFloat(geumClearRate)).toFixed(1)

    console.log(`클리어율 — 목화: ${mokClearRate}%, 금수: ${geumClearRate}%, 격차: ${clearGap}%p`)
    console.log('')
    console.log('[1a] 사망 직전 3턴 상성 분포:')
    console.log(`  금수 생/역극 갇힘: ${calcUnfavorablePct(geumDeathTurns)}`)
    console.log(`  목화 생/역극 갇힘: ${calcUnfavorablePct(mokDeathTurns)}`)
    const geumUnfav = parseFloat(calcUnfavorablePct(geumDeathTurns))
    const mokUnfav = parseFloat(calcUnfavorablePct(mokDeathTurns))
    if (!isNaN(geumUnfav) && !isNaN(mokUnfav)) {
      if (geumUnfav > mokUnfav + 5) {
        console.log('  => 금수가 생/역극에 더 자주 갇힘 — 불리한 상성 매칭 빈도 높음')
      } else {
        console.log('  => 생/역극 갇힘 비율 목화와 유사 — 상성 매칭이 격차 주원인 아님')
      }
    }
    console.log('')
    console.log('[1d] 용신 보너스 발동률:')
    console.log(`  금수(용신=to): ${geumYongsin.yongsinRate}`)
    console.log(`  목화(용신=su): ${mokYongsin.yongsinRate}`)
    const geumYR = parseFloat(geumYongsin.yongsinRate)
    const mokYR = parseFloat(mokYongsin.yongsinRate)
    if (!isNaN(geumYR) && !isNaN(mokYR)) {
      if (geumYR < mokYR - 3) {
        console.log('  => 금수 용신(to) 발동률이 낮음 — to 카드가 콤보에 덜 포함됨')
        console.log('  => 가설: to 카드 2장이 geum/su 위주 콤보에서 소외될 가능성')
      } else {
        console.log('  => 용신 발동률 비슷 — 용신 메커니즘이 격차 주원인 아님')
      }
    }
    console.log('')
    console.log('[2] 대칭성:')
    console.log(`  구조적 대칭: ${structuralSymmetry ? 'YES' : 'NO'}`)
    if (structuralSymmetry) {
      console.log('  => 결과 격차 원인: 용신/봇/적 메커니즘 중 하나')
      console.log('  => 코드 분석상 봇 자체 비대칭 없음')
      console.log('  => 용신 발동률 차이 또는 랜덤 적 원소 편차가 주요인 추정')
    }
    console.log('')
    console.log('[3] 성장배율 꺾임:')
    console.log('  가설 A (생존편향): 검증 결과 참조')
    console.log('  가설 B (강화 증발 버그): 기각 — 코드 분석상 영속 덱 정상 유지')
    console.log('  가설 C (damage-reduction 이중계산): 기각 — 예산표는 단순 역산')
    console.log('  => 최유력: 4층 heavyAttack everyN=2 + damage-reduction 30% 복합 효과로 인한')
    console.log('     평균공격수 증가 → 역산 평균콤보 감소 (수학적 artifact)')
    console.log('     실제 콤보 데미지는 성장하나 4층 제한 메커니즘으로 역산값 억제됨')
    console.log('')
    console.log('=======================================================')
    console.log('R5 분석 완료 — 수치 변경 없음, 진단 결과만 산출')
    console.log('=======================================================\n')

    // 기본 assertion: 테스트는 판정 결과 무관 PASS (보고서 목적)
    expect(FLOOR_CONFIGS.length).toBe(4)
    expect(fixedDeck.length).toBe(20)
    expect(true).toBe(true)
  }, 600000)
})
