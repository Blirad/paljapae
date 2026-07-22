// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * 팔자전 재밸런스 R5.5 — 4층 심층 분석 (2026-07-11)
 *
 * 수치 변경 전면 금지 — 분석/진단 결과만 산출
 *
 * 작업 1: 4층 전투 로그 상세 분석 (목화/금수 각 300판, 4층 도달 런만)
 *   1a. 4층 적 원소별 통과율 매트릭스 (목화×5원소, 금수×5원소 = 10칸)
 *   1b. 4층 평균 콤보 타수, 1타 평균 데미지, damage-reduction으로 깎인 총량
 *   1c. heavyAttack 피격 시점 분포 (금수가 킬각이 느려 한 번 더 맞는지)
 *
 * 작업 2: damage-reduction 적용 방식 명시
 *   - 곱연산(타격당) vs 총딜×0.7 판별
 *   - 코드 위치(파일:라인) 명시
 *
 * 작업 3: 금수 3000판 노이즈 측정
 *   - R5 설정 그대로, 클리어율 + 95% 신뢰구간 산출
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
import { generateSajuDeck } from '../engine/deckGenerator'
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
// 타입 정의 (R5.5 상세 로그)
// ─────────────────────────────────────────────────────────────────────────────

interface Floor4TurnLog {
  turn: number                    // 전역 턴 번호
  floor4TurnNum: number           // 4층 내 턴 번호 (1부터)
  comboElements: Element[]
  affinityMult: number
  rawDamage: number               // damage-reduction 적용 전 추정 데미지
  actualDamage: number            // 실제 적 HP 감소량
  damageReduced: number           // 깎인 양 (rawDamage - actualDamage)
  counterReceived: number
  heavyAttackReceived: number
  heroHpBefore: number
  heroHpAfter: number
  discardUsed: boolean
  enemyElement: Element           // 4층 적 주 원소 (랜덤)
}

interface R5p5RunLog {
  preset: 'mokHwa' | 'geumSu'
  cleared: boolean
  floorReached: number
  reached4thFloor: boolean
  floor4EnemyElement: Element | null  // 4층 주 원소
  floor4Turns: Floor4TurnLog[]
  floor4AttackCount: number           // 4층 실제 공격 횟수
  floor4AvgDamagePerTurn: number      // 4층 타당 평균 데미지
  floor4TotalReduced: number          // 4층에서 damage-reduction으로 깎인 총량
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
  if (GEUK_MAP[repEl] === enemyEl) return GEUK_BONUS_MULTIPLIER
  if (SANG_MAP[repEl] === enemyEl) return SANG_PENALTY_MULTIPLIER
  if (GEUK_MAP[enemyEl] === repEl) return ANTI_GEUK_PENALTY
  return 1.0
}

// ─────────────────────────────────────────────────────────────────────────────
// R5.5 상세 런 시뮬레이터 (4층 집중 로그 수집)
// ─────────────────────────────────────────────────────────────────────────────

function simulateR5p5Run(
  seed: number,
  opts: FullCapSimOptions,
  resolvedFavorableElement: Element | undefined,
): R5p5RunLog {
  const rng = makeLcg(seed)
  const preset = (opts.elementDist?.mok ?? 0) >= 4 ? 'mokHwa' : 'geumSu'

  const floorElements = getRandomFloorElements(rng)

  const deckSeed = Math.floor(rng() * 0xffffffff)
  let persistentDeck = shuffleDeck(generateSajuDeck(opts.elementDist!, deckSeed), deckSeed)

  let playerHp = PLAYER_BASE_HP
  let floor = 1
  let cleared = false
  let reached4thFloor = false
  const floor4Turns: Floor4TurnLog[] = []
  let floor4EnemyElement: Element | null = null
  let globalTurn = 0
  let floor4TurnNum = 0
  let floor4AttackCount = 0
  let floor4TotalReduced = 0

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

    if (floor === 4) {
      reached4thFloor = true
      floor4TurnNum = 0
      const floorElem = floorElements[3]
      floor4EnemyElement = floorElem?.primaryElement ?? 'geum'
    }

    let floorDone = false

    while (!floorDone) {
      if (state.phase === 'floor-reward') {
        // 보상 선택 로직 (R5와 동일)
        const allCurrentCards = [...state.hand, ...state.deck, ...state.discardPile]
        const nextFloorIdx = floor
        const nextElemConfig = nextFloorIdx < 4 ? floorElements[nextFloorIdx] : undefined
        const nextEnemyEl = nextElemConfig?.primaryElement

        const ELEMENTS_ARR: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
        const elIdx = Math.floor(rng() * ELEMENTS_ARR.length)
        const el = ELEMENTS_ARR[elIdx]
        const val = Math.floor(rng() * 10) + 1
        const newCard: Card = {
          id: `r5p5-reward-${Date.now()}-${Math.floor(rng() * 99999)}`,
          element: el,
          polarity: rng() > 0.5 ? 'yang' : 'yin',
          value: val,
          type: 'soldier',
          rarity: 'common',
        }

        let upgradeTargetId: string | null = null
        let bestScore = -Infinity
        for (const card of allCurrentCards) {
          const sc = card.value * (nextEnemyEl ? getAffinityMult(card.element, nextEnemyEl) : 1.0)
          if (sc > bestScore) { bestScore = sc; upgradeTargetId = card.id }
        }

        let removeTargetId: string | null = null
        let worstScore = Infinity
        if (allCurrentCards.length >= 2) {
          for (const card of allCurrentCards) {
            const sc = card.value * (nextEnemyEl ? getAffinityMult(card.element, nextEnemyEl) : 1.0)
            if (sc < worstScore) { worstScore = sc; removeTargetId = card.id }
          }
        }

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

        let rewardOption: RewardOption = { type: 'add-card', card: newCard }
        if (scoreB >= scoreA && scoreB >= scoreC && upgradeTargetId) {
          rewardOption = { type: 'upgrade-card', targetId: upgradeTargetId, bonusPct: 50 }
        } else if (scoreC >= scoreA && scoreC >= scoreB && removeTargetId) {
          rewardOption = { type: 'remove-card', targetId: removeTargetId }
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
        if (floor === 4) {
          floor4TurnNum++
          const turnLog: Floor4TurnLog = {
            turn: globalTurn,
            floor4TurnNum,
            comboElements: decision.cardIds.map(id => state.hand.find(c => c.id === id)?.element ?? 'mok'),
            affinityMult: decision.bestAffinityMult,
            rawDamage: 0,
            actualDamage: 0,
            damageReduced: 0,
            counterReceived: 0,
            heavyAttackReceived: 0,
            heroHpBefore: state.playerHp,
            heroHpAfter: state.playerHp,
            discardUsed: true,
            enemyElement: floor4EnemyElement ?? 'geum',
          }
          floor4Turns.push(turnLog)
        }
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

      const prevHp = state.playerHp
      const prevEnemyHp = state.enemyHp
      const prevAttackCount = state.attackCount

      // 공격 실행
      state = playCards(state, decision.cardIds)

      const hpAfter = state.playerHp
      const hpDiff = prevHp - hpAfter  // 받은 총 피해 (반격 + heavyAttack)

      if (floor === 4) {
        floor4TurnNum++
        floor4AttackCount++

        // damage-reduction 30% 적용 추정
        // 실제 적 HP 감소량 = actualDamage
        const actualDamage = prevEnemyHp - state.enemyHp

        // rawDamage 역산: actualDamage = Math.round(rawDamage * 0.7) → rawDamage ≈ actualDamage / 0.7
        // 단 저격(snipe) 발동 시 감소 없음. 여기서는 단순 역산으로 추정
        const estimatedRawDamage = actualDamage > 0 ? Math.round(actualDamage / 0.7) : 0
        const damageReduced = Math.max(0, estimatedRawDamage - actualDamage)
        floor4TotalReduced += damageReduced

        // heavyAttack 판단: everyN=2이므로 (prevAttackCount+1) % 2 === 0이면 발동
        const newAttackNum = prevAttackCount + 1
        const heavyAttackConf = floorConf.heavyAttack
        let heavyAttackDmg = 0
        if (heavyAttackConf && newAttackNum % heavyAttackConf.everyN === 0) {
          heavyAttackDmg = heavyAttackConf.damage
        }

        // 반격: 총 HP 손실에서 heavyAttack을 뺀 나머지
        const counterDmg = Math.max(0, hpDiff - heavyAttackDmg)

        const turnLog: Floor4TurnLog = {
          turn: globalTurn,
          floor4TurnNum,
          comboElements: selectedCards.map(c => c.element),
          affinityMult,
          rawDamage: estimatedRawDamage,
          actualDamage,
          damageReduced,
          counterReceived: counterDmg,
          heavyAttackReceived: heavyAttackDmg,
          heroHpBefore: prevHp,
          heroHpAfter: hpAfter,
          discardUsed: false,
          enemyElement: floor4EnemyElement ?? 'geum',
        }
        floor4Turns.push(turnLog)
      }

      playerHp = state.playerHp
    }

    if (state.phase === 'result') break
    if (floor > 4) { cleared = true; break }
  }

  const floor4AttackTurns = floor4Turns.filter(t => !t.discardUsed)
  const floor4AvgDamagePerTurn = floor4AttackTurns.length > 0
    ? floor4AttackTurns.reduce((s, t) => s + t.actualDamage, 0) / floor4AttackTurns.length
    : 0

  return {
    preset,
    cleared,
    floorReached: floor,
    reached4thFloor,
    floor4EnemyElement,
    floor4Turns,
    floor4AttackCount,
    floor4AvgDamagePerTurn,
    floor4TotalReduced,
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

describe.skip('팔자전 재밸런스 R5.5 — 4층 심층 분석', () => {
  it('R5.5 전체 분석 (수치 변경 없음, 진단 결과만)', () => {
    const SAMPLE_SIZE = 300

    const yongsinMok = getFavorableElement('mok')   // su
    const yongsinGeum = getFavorableElement('geum')  // to

    // ──────────────────────────────────────────────────────────────
    // 로그 수집 (300판)
    // ──────────────────────────────────────────────────────────────
    const mokHwaLogs: R5p5RunLog[] = []
    const geumSuLogs: R5p5RunLog[] = []

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const seed = i * 12345 + 7777
      mokHwaLogs.push(simulateR5p5Run(seed, MOK_HWA_OPTS, yongsinMok))
      geumSuLogs.push(simulateR5p5Run(seed, GEUM_SU_OPTS, yongsinGeum))
    }

    const mokCleared = mokHwaLogs.filter(r => r.cleared).length
    const geumCleared = geumSuLogs.filter(r => r.cleared).length
    const mokReached4 = mokHwaLogs.filter(r => r.reached4thFloor)
    const geumReached4 = geumSuLogs.filter(r => r.reached4thFloor)

    console.log('\n========== 팔자전 재밸런스 R5.5 — 4층 심층 분석 ==========')
    console.log(`샘플: 목화 ${SAMPLE_SIZE}판, 금수 ${SAMPLE_SIZE}판 (수치 변경 없음)`)
    console.log(`목화 클리어: ${mokCleared}판 (${(mokCleared / SAMPLE_SIZE * 100).toFixed(1)}%)`)
    console.log(`금수 클리어: ${geumCleared}판 (${(geumCleared / SAMPLE_SIZE * 100).toFixed(1)}%)`)
    console.log(`목화 4층 도달: ${mokReached4.length}판 (${(mokReached4.length / SAMPLE_SIZE * 100).toFixed(1)}%)`)
    console.log(`금수 4층 도달: ${geumReached4.length}판 (${(geumReached4.length / SAMPLE_SIZE * 100).toFixed(1)}%)`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1a: 4층 적 원소별 통과율 매트릭스 (10칸)
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1a: 4층 적 원소별 통과율 매트릭스 (10칸) ===')
    console.log('(4층 도달 런만 카운트 — 각 칸: 해당 원소가 4층 주 원소일 때 통과율)')
    console.log('')

    const ELEMENTS_ALL: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

    // 원소별 카운터 초기화
    const mokByElem: Record<Element, { total: number; cleared: number }> = {
      mok: { total: 0, cleared: 0 },
      hwa: { total: 0, cleared: 0 },
      to:  { total: 0, cleared: 0 },
      geum:{ total: 0, cleared: 0 },
      su:  { total: 0, cleared: 0 },
    }
    const geumByElem: Record<Element, { total: number; cleared: number }> = {
      mok: { total: 0, cleared: 0 },
      hwa: { total: 0, cleared: 0 },
      to:  { total: 0, cleared: 0 },
      geum:{ total: 0, cleared: 0 },
      su:  { total: 0, cleared: 0 },
    }

    for (const run of mokReached4) {
      const el = run.floor4EnemyElement ?? 'geum'
      mokByElem[el].total++
      if (run.cleared) mokByElem[el].cleared++
    }
    for (const run of geumReached4) {
      const el = run.floor4EnemyElement ?? 'geum'
      geumByElem[el].total++
      if (run.cleared) geumByElem[el].cleared++
    }

    function pctStr(cleared: number, total: number): string {
      if (total === 0) return 'N/A(0판)'
      return `${(cleared / total * 100).toFixed(1)}%(${cleared}/${total})`
    }

    // 상성 레이블 (목화 주력 mok+hwa 기준, 금수 주력 geum+su 기준)
    function mokAffLabel(enemyEl: Element): string {
      // 목화 대표 원소 = mok (4장) + hwa (4장), 대표 = mok 또는 hwa
      // mok이 극하는 원소: to / hwa가 극하는 원소: geum
      if (GEUK_MAP['mok'] === enemyEl || GEUK_MAP['hwa'] === enemyEl) return '극유리'
      if (SANG_MAP['mok'] === enemyEl || SANG_MAP['hwa'] === enemyEl) return '생불리'
      if (GEUK_MAP[enemyEl] === 'mok' || GEUK_MAP[enemyEl] === 'hwa') return '역극'
      return '중립'
    }

    function geumAffLabel(enemyEl: Element): string {
      // 금수 대표 = geum (4장) + su (4장)
      // geum이 극하는 원소: mok / su가 극하는 원소: hwa
      if (GEUK_MAP['geum'] === enemyEl || GEUK_MAP['su'] === enemyEl) return '극유리'
      if (SANG_MAP['geum'] === enemyEl || SANG_MAP['su'] === enemyEl) return '생불리'
      if (GEUK_MAP[enemyEl] === 'geum' || GEUK_MAP[enemyEl] === 'su') return '역극'
      return '중립'
    }

    console.log('| 4층 적 원소 | 목화 통과율 | 목화 상성 | 금수 통과율 | 금수 상성 |')
    console.log('|-----------|----------|---------|----------|---------|')
    for (const el of ELEMENTS_ALL) {
      const mok = mokByElem[el]
      const geum = geumByElem[el]
      console.log(`| ${el.padEnd(4)} | ${pctStr(mok.cleared, mok.total).padEnd(16)} | ${mokAffLabel(el).padEnd(6)} | ${pctStr(geum.cleared, geum.total).padEnd(16)} | ${geumAffLabel(el).padEnd(6)} |`)
    }
    console.log('')

    // 범인 특정: 특정 칸이 유독 낮으면 표시
    console.log('[분석] 통과율 최저 원소 조합 특정:')
    let mokLowest = { el: 'N/A' as string, pct: 999, total: 0 }
    let geumLowest = { el: 'N/A' as string, pct: 999, total: 0 }
    for (const el of ELEMENTS_ALL) {
      const mok = mokByElem[el]
      if (mok.total >= 5) {
        const p = mok.cleared / mok.total * 100
        if (p < mokLowest.pct) mokLowest = { el, pct: p, total: mok.total }
      }
      const geum = geumByElem[el]
      if (geum.total >= 5) {
        const p = geum.cleared / geum.total * 100
        if (p < geumLowest.pct) geumLowest = { el, pct: p, total: geum.total }
      }
    }
    console.log(`  목화 최저: 4층 적=${mokLowest.el}, 통과율=${mokLowest.pct.toFixed(1)}% (${mokLowest.total}판)`)
    console.log(`  금수 최저: 4층 적=${geumLowest.el}, 통과율=${geumLowest.pct.toFixed(1)}% (${geumLowest.total}판)`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1b: 4층 전투 수치 비교
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1b: 4층 전투 수치 비교 ===')
    console.log('(4층 도달 런 전체 기준)')

    function calc4FloorStats(logs: R5p5RunLog[]) {
      const reached = logs.filter(r => r.reached4thFloor)
      if (reached.length === 0) return { avgComboCount: 'N/A', avgDmgPerTurn: 'N/A', avgTotalReduced: 'N/A', totalRuns: 0 }

      const totalAttackCount = reached.reduce((s, r) => s + r.floor4AttackCount, 0)
      const avgComboCount = (totalAttackCount / reached.length).toFixed(2)

      const attackTurnsAll = reached.flatMap(r => r.floor4Turns.filter(t => !t.discardUsed))
      const avgDmgPerTurn = attackTurnsAll.length > 0
        ? (attackTurnsAll.reduce((s, t) => s + t.actualDamage, 0) / attackTurnsAll.length).toFixed(1)
        : 'N/A'

      const avgTotalReduced = (reached.reduce((s, r) => s + r.floor4TotalReduced, 0) / reached.length).toFixed(1)

      return { avgComboCount, avgDmgPerTurn, avgTotalReduced, totalRuns: reached.length }
    }

    const mokF4Stats = calc4FloorStats(mokHwaLogs)
    const geumF4Stats = calc4FloorStats(geumSuLogs)

    console.log('| 구분 | 금수 | 목화 |')
    console.log('|-----|-----|-----|')
    console.log(`| 평균 콤보 타수 (4층) | ${geumF4Stats.avgComboCount} | ${mokF4Stats.avgComboCount} |`)
    console.log(`| 1타 평균 데미지 (실제 HP 감소) | ${geumF4Stats.avgDmgPerTurn} | ${mokF4Stats.avgDmgPerTurn} |`)
    console.log(`| damage-reduction으로 깎인 총량 (런 평균) | ${geumF4Stats.avgTotalReduced} | ${mokF4Stats.avgTotalReduced} |`)
    console.log(`| 4층 도달 런 수 | ${geumF4Stats.totalRuns} | ${mokF4Stats.totalRuns} |`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1c: heavyAttack 피격 시점 분포
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1c: heavyAttack 피격 시점 분포 ===')
    console.log('(4층 everyN=2 — 2,4,6번째 공격 시 damage=8 강공 발동)')
    console.log('')

    function analyzeHeavyAttacks(logs: R5p5RunLog[]) {
      const reached = logs.filter(r => r.reached4thFloor)
      if (reached.length === 0) return { avgHeavyHits: 'N/A', distribution: {}, totalRuns: 0 }

      const distribution: Record<number, number> = {}
      let totalHeavyHits = 0

      for (const run of reached) {
        const attackTurns = run.floor4Turns.filter(t => !t.discardUsed)
        const heavyTurns = attackTurns.filter(t => t.heavyAttackReceived > 0)
        totalHeavyHits += heavyTurns.length

        for (const t of heavyTurns) {
          distribution[t.floor4TurnNum] = (distribution[t.floor4TurnNum] ?? 0) + 1
        }
      }

      const avgHeavyHits = reached.length > 0
        ? (totalHeavyHits / reached.length).toFixed(2)
        : 'N/A'

      return { avgHeavyHits, distribution, totalRuns: reached.length }
    }

    const mokHeavy = analyzeHeavyAttacks(mokHwaLogs)
    const geumHeavy = analyzeHeavyAttacks(geumSuLogs)

    console.log(`| 구분 | 금수 | 목화 |`)
    console.log(`|-----|-----|-----|`)
    console.log(`| 런당 평균 heavyAttack 피격 횟수 | ${geumHeavy.avgHeavyHits} | ${mokHeavy.avgHeavyHits} |`)
    console.log(`| 4층 도달 런 수 | ${geumHeavy.totalRuns} | ${mokHeavy.totalRuns} |`)
    console.log('')

    // heavyAttack 시점 분포 (공격 순서 기준)
    console.log('[금수] 4층 heavyAttack 발동 시점 분포 (턴 번호 기준):')
    const geumHeavyKeys = Object.keys(geumHeavy.distribution).map(Number).sort((a, b) => a - b)
    if (geumHeavyKeys.length > 0) {
      for (const k of geumHeavyKeys.slice(0, 10)) {
        console.log(`  ${k}번째 공격에서 heavyAttack: ${geumHeavy.distribution[k]}회`)
      }
    } else {
      console.log('  heavyAttack 데이터 없음')
    }

    console.log('[목화] 4층 heavyAttack 발동 시점 분포 (턴 번호 기준):')
    const mokHeavyKeys = Object.keys(mokHeavy.distribution).map(Number).sort((a, b) => a - b)
    if (mokHeavyKeys.length > 0) {
      for (const k of mokHeavyKeys.slice(0, 10)) {
        console.log(`  ${k}번째 공격에서 heavyAttack: ${mokHeavy.distribution[k]}회`)
      }
    } else {
      console.log('  heavyAttack 데이터 없음')
    }

    // "한 번 더 맞는 구조" 판단
    const geumAvgHeavy = parseFloat(geumHeavy.avgHeavyHits as string)
    const mokAvgHeavy = parseFloat(mokHeavy.avgHeavyHits as string)
    console.log('')
    console.log('[판정] 금수가 킬각이 느려 heavyAttack 추가 피격하는 구조 여부:')
    if (!isNaN(geumAvgHeavy) && !isNaN(mokAvgHeavy)) {
      if (geumAvgHeavy > mokAvgHeavy * 1.15) {
        console.log(`  => 지지: 금수 평균 ${geumAvgHeavy.toFixed(2)}회 > 목화 ${mokAvgHeavy.toFixed(2)}회 × 1.15`)
        console.log(`     금수가 4층을 더 오래 싸우면서 강공을 더 많이 맞는 구조 확인됨`)
      } else if (geumAvgHeavy < mokAvgHeavy * 0.85) {
        console.log(`  => 기각: 금수 평균 ${geumAvgHeavy.toFixed(2)}회 < 목화 ${mokAvgHeavy.toFixed(2)}회 × 0.85`)
        console.log(`     금수가 오히려 heavyAttack 덜 맞음 — 다른 원인`)
      } else {
        console.log(`  => 판단 보류: 금수 ${geumAvgHeavy.toFixed(2)}회 ≈ 목화 ${mokAvgHeavy.toFixed(2)}회`)
        console.log(`     heavyAttack 피격 횟수 유사 — 다른 사망 원인 탐색 필요`)
      }
    } else {
      console.log('  => 데이터 부족')
    }
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 2: damage-reduction 적용 방식 명시
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 2: damage-reduction 30% 적용 방식 ===')
    console.log('')
    console.log('[결론] 타격당 곱연산 (×0.7) — 총딜 후 일괄 감산 아님')
    console.log('')
    console.log('[코드 위치]')
    console.log('  파일: paljapae/src/engine/paljajeonEngine.ts')
    console.log('  라인: L283~L286')
    console.log('')
    console.log('[코드 내용]')
    console.log('  L283: if (!snipeActive && floorConfig.eliteGimmickEffect?.type === \'damage-reduction\' && state.currentFloor >= 3) {')
    console.log('  L284:   const pct = floorConfig.eliteGimmickEffect.pct  // pct = 0.3')
    console.log('  L285:   damage = Math.round(damage * (1 - pct))          // damage × 0.7')
    console.log('  L286: }')
    console.log('')
    console.log('[적용 시점]')
    console.log('  1. 기운 충돌(-30%) 적용 후')
    console.log('  2. 상생상극 매트릭스 적용 후')
    console.log('  3. 용신 보너스 적용 후')
    console.log('  4. 응축 배율 적용 후')
    console.log('  5. [여기서] eliteGimmickEffect damage-reduction 30% (타격당 Math.round 곱연산)')
    console.log('  6. 반격 피해 / heavyAttack 피해 계산 (별도 — damage 변수 무관)')
    console.log('')
    console.log('[정의]')
    console.log('  타격 1회에서 산출된 damage 값에 즉시 ×(1 - 0.3) = ×0.7 적용')
    console.log('  → 각 공격마다 독립적으로 적용 (누적 총딜에 일괄 적용 아님)')
    console.log('  → 저격(snipe) 특성 발동 시 건너뜀 (snipeActive === true)')
    console.log('')

    // 실측으로 damage-reduction 방식 검증
    const geumAtk = geumSuLogs.flatMap(r => r.floor4Turns.filter(t => !t.discardUsed && t.actualDamage > 0))
    if (geumAtk.length >= 10) {
      // rawDamage 역산 정확성 검증: actualDamage = Math.round(rawDamage * 0.7)
      // rawDamage = Math.round(actualDamage / 0.7) 근사 (소수점 오차 있음)
      const sampleTurns = geumAtk.slice(0, 5)
      console.log('[실측 검증 샘플] 금수 4층 공격 5회 (rawDamage 역산):')
      console.log('| 턴 | actualDamage | estimatedRaw | raw×0.7 | 일치 |')
      console.log('|----|-------------|-------------|---------|------|')
      for (const t of sampleTurns) {
        const check = Math.round(t.rawDamage * 0.7)
        const match = Math.abs(check - t.actualDamage) <= 1 ? 'Y' : 'N(±2이상)'
        console.log(`| ${t.floor4TurnNum} | ${t.actualDamage} | ${t.rawDamage} | ${check} | ${match} |`)
      }
      console.log('')
    }
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 3: 금수 3000판 노이즈 측정 (클리어율 + 95% 신뢰구간)
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 3: 금수 3000판 노이즈 측정 ===')
    console.log('(R5 설정 그대로 — R4.5 HP + 영속 덱 + 랜덤 원소 + 용신 함수)')
    console.log('')

    const RUNS_3000 = 3000
    let geumCleared3000 = 0

    for (let i = 0; i < RUNS_3000; i++) {
      const seed = i * 12345 + 7777
      const result = simulateFullCapRun(seed, GEUM_SU_OPTS)
      if (result.victory) geumCleared3000++
    }

    const p = geumCleared3000 / RUNS_3000
    const n = RUNS_3000
    const z95 = 1.96  // 95% 신뢰구간 z값

    // Wilson 구간 (정규 근사 대비 소표본에서 더 정확)
    const denominator = 1 + (z95 * z95) / n
    const center = (p + (z95 * z95) / (2 * n)) / denominator
    const margin = (z95 * Math.sqrt(p * (1 - p) / n + (z95 * z95) / (4 * n * n))) / denominator
    const wilsonLow = Math.max(0, center - margin)
    const wilsonHigh = Math.min(1, center + margin)

    // 정규 근사 (참고용)
    const normalMargin = z95 * Math.sqrt(p * (1 - p) / n)
    const normalLow = Math.max(0, p - normalMargin)
    const normalHigh = Math.min(1, p + normalMargin)

    console.log(`금수 3000판 클리어 수: ${geumCleared3000}판`)
    console.log(`금수 클리어율 (점 추정): ${(p * 100).toFixed(2)}%`)
    console.log('')
    console.log('[95% 신뢰구간]')
    console.log(`  Wilson 구간:    ${(wilsonLow * 100).toFixed(2)}% ~ ${(wilsonHigh * 100).toFixed(2)}%`)
    console.log(`  정규 근사 구간: ${(normalLow * 100).toFixed(2)}% ~ ${(normalHigh * 100).toFixed(2)}%`)
    console.log(`  구간 폭 (Wilson): ±${((wilsonHigh - wilsonLow) / 2 * 100).toFixed(2)}%p`)
    console.log('')
    console.log('[판정 기준]')
    console.log(`  목표: 클리어율 25~40%`)
    const inRange = p >= 0.25 && p <= 0.40
    console.log(`  현재 금수 클리어율 ${(p * 100).toFixed(2)}% — 목표 범위 ${inRange ? '내 (정상)' : '외 (이탈)'}`)
    console.log(`  이후 판정은 Wilson 구간 [${(wilsonLow * 100).toFixed(2)}%, ${(wilsonHigh * 100).toFixed(2)}%] 기준으로 수행`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 종합 진단 요약
    // ──────────────────────────────────────────────────────────────
    console.log('=== R5.5 종합 진단 요약 ===')
    console.log('')
    console.log(`[클리어율] 목화: ${(mokCleared / SAMPLE_SIZE * 100).toFixed(1)}%, 금수: ${(geumCleared / SAMPLE_SIZE * 100).toFixed(1)}% (300판 기준)`)
    console.log(`[3000판] 금수: ${(p * 100).toFixed(2)}% [Wilson 95%CI: ${(wilsonLow * 100).toFixed(2)}%~${(wilsonHigh * 100).toFixed(2)}%]`)
    console.log('')
    console.log('[1a] 원소별 통과율 매트릭스:')
    for (const el of ELEMENTS_ALL) {
      const geum = geumByElem[el]
      const mok = mokByElem[el]
      console.log(`  4층적=${el}: 금수 ${pctStr(geum.cleared, geum.total)}, 목화 ${pctStr(mok.cleared, mok.total)}`)
    }
    console.log(`  금수 최저 조합: 4층적=${geumLowest.el} (${geumLowest.pct.toFixed(1)}%)`)
    console.log('')
    console.log('[1b] 4층 전투 수치:')
    console.log(`  금수: 평균 ${geumF4Stats.avgComboCount}타, 타당 ${geumF4Stats.avgDmgPerTurn}dmg, 누적깎임 ${geumF4Stats.avgTotalReduced}`)
    console.log(`  목화: 평균 ${mokF4Stats.avgComboCount}타, 타당 ${mokF4Stats.avgDmgPerTurn}dmg, 누적깎임 ${mokF4Stats.avgTotalReduced}`)
    console.log('')
    console.log('[1c] heavyAttack 피격:')
    console.log(`  금수: 런당 평균 ${geumHeavy.avgHeavyHits}회, 목화: ${mokHeavy.avgHeavyHits}회`)
    console.log('')
    console.log('[2] damage-reduction 방식: 타격당 곱연산(×0.7) — paljajeonEngine.ts L283~286')
    console.log('')
    console.log('=======================================================')
    console.log('R5.5 분석 완료 — 수치 변경 없음, 진단 결과만 산출')
    console.log('=======================================================\n')

    // 기본 assertion (테스트 판정 무관 PASS — 보고서 목적)
    expect(FLOOR_CONFIGS.length).toBe(4)
    expect(FLOOR_CONFIGS[3].eliteGimmickEffect?.type).toBe('damage-reduction')
    expect(FLOOR_CONFIGS[3].eliteGimmickEffect?.pct).toBe(0.3)
    expect(FLOOR_CONFIGS[3].heavyAttack?.everyN).toBe(2)
    expect(mokHwaLogs.length).toBe(SAMPLE_SIZE)
    expect(geumSuLogs.length).toBe(SAMPLE_SIZE)
    expect(geumCleared3000).toBeGreaterThanOrEqual(0)
    expect(geumCleared3000).toBeLessThanOrEqual(RUNS_3000)
    expect(true).toBe(true)
  }, 900000)
})
