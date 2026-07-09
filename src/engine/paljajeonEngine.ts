/**
 * 팔자전 — 턴 시뮬레이션 엔진
 * 순수 함수 모듈 — UI 의존 없음
 */

import type { Card, GameState, Element } from '../types/game'
import { judgeHand, GEUK_MAP } from './pokerHandJudge'
import { FLOOR_CONFIGS, PLAYER_BASE_HP, HAND_SIZE, BASE_DISCARDS } from './balance'

/** 고정 임시 덱 생성 (Phase 1 — 사주 계산 없이 균형 덱) */
export function createFixedDeck(): Card[] {
  const elements: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
  const cards: Card[] = []
  let id = 0
  // 각 오행 × 음/양 × 값 1~10 × 1장씩 = 100장 풀에서 20장 샘플
  for (let e = 0; e < elements.length; e++) {
    for (let v = 1; v <= 4; v++) {
      cards.push({
        id: `card-${id++}`,
        element: elements[e],
        polarity: v % 2 === 0 ? 'yang' : 'yin',
        value: v * 2,
        type: 'soldier',
        rarity: 'common',
      })
    }
  }
  return cards  // 20장
}

/** 덱 셔플 (Fisher-Yates) */
export function shuffleDeck(deck: Card[], seed?: number): Card[] {
  const arr = [...deck]
  // 시드 기반 단순 LCG 난수 (재현 가능)
  let rng = seed ?? Date.now()
  const nextRandom = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff
    return (rng >>> 0) / 0xffffffff
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 초기 게임 상태 생성 */
export function createInitialGameState(floorIndex = 0): GameState {
  const floorConfig = FLOOR_CONFIGS[floorIndex]
  const deck = shuffleDeck(createFixedDeck())
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

/** 역극 여부 판단: 플레이어 카드들이 적 오행에 의해 극 당하면 역극 */
export function isYeokgeuk(card: Card, enemyElement: Element): boolean {
  return GEUK_MAP[enemyElement] === card.element
}

/** 출수 실행 → 새로운 GameState 반환 */
export function playCards(state: GameState, cardIds: string[]): GameState {
  const floorConfig = FLOOR_CONFIGS[state.currentFloor - 1]
  const playedCards = state.hand.filter(c => cardIds.includes(c.id))
  const remainHand = state.hand.filter(c => !cardIds.includes(c.id))

  const result = judgeHand(playedCards)
  const damage = result.totalScore

  const newEnemyHp = Math.max(0, state.enemyHp - damage)
  const counterDamage = floorConfig.counterDamage

  // lifesteal: 출수한 카드 중 lifesteal 카드가 있으면 데미지의 30%를 HP 회복
  const hasLifesteal = playedCards.some(c => c.lifesteal === true)
  const lifestealHeal = hasLifesteal ? Math.floor(damage * 0.3) : 0
  const newPlayerHp = Math.min(
    state.playerMaxHp,
    Math.max(0, state.playerHp - counterDamage + lifestealHeal)
  )
  const newPlaysLeft = state.playsLeft - 1

  // 덱에서 플레이한 장수만큼 다시 뽑기
  const newDeck = [...state.deck]
  const drawnCards: Card[] = []
  for (let i = 0; i < playedCards.length && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }
  const newHand = [...remainHand, ...drawnCards]

  const floorCleared = newEnemyHp <= 0
  const playerDead = newPlayerHp <= 0
  const outOfPlays = newPlaysLeft <= 0 && newEnemyHp > 0

  let phase = state.phase
  let isVictory = state.isVictory
  let floorsCleared = state.floorsCleared

  if (floorCleared) {
    floorsCleared = state.floorsCleared + 1
    if (state.currentFloor >= 4) {
      phase = 'result'
      isVictory = true
    } else {
      phase = 'floor-reward'
    }
  } else if (playerDead || outOfPlays) {
    phase = 'result'
    isVictory = false
  }

  return {
    ...state,
    enemyHp: newEnemyHp,
    playerHp: newPlayerHp,
    hand: newHand,
    deck: newDeck,
    discardPile: [...state.discardPile, ...playedCards],
    selectedCards: [],
    playsLeft: newPlaysLeft,
    phase,
    isVictory,
    floorsCleared,
  }
}

/** 버리기 실행 */
export function discardCards(state: GameState, cardIds: string[]): GameState {
  if (state.discardsLeft <= 0) return state

  const discarded = state.hand.filter(c => cardIds.includes(c.id))
  const remainHand = state.hand.filter(c => !cardIds.includes(c.id))
  const newDeck = [...state.deck]
  const drawnCards: Card[] = []
  for (let i = 0; i < discarded.length && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }

  return {
    ...state,
    hand: [...remainHand, ...drawnCards],
    deck: newDeck,
    discardPile: [...state.discardPile, ...discarded],
    selectedCards: [],
    discardsLeft: state.discardsLeft - 1,
  }
}

/** 다음 층으로 전환 */
export function advanceToNextFloor(state: GameState): GameState {
  const nextFloor = state.currentFloor + 1
  if (nextFloor > 4) {
    return { ...state, phase: 'result', isVictory: true }
  }
  const floorConfig = FLOOR_CONFIGS[nextFloor - 1]
  const deck = shuffleDeck(createFixedDeck())
  const hand = deck.slice(0, HAND_SIZE)
  const remainDeck = deck.slice(HAND_SIZE)

  return {
    ...state,
    currentFloor: nextFloor,
    enemyHp: floorConfig.enemyHp,
    enemyMaxHp: floorConfig.enemyHp,
    hand,
    deck: remainDeck,
    discardPile: [],
    selectedCards: [],
    discardsLeft: BASE_DISCARDS,
    playsLeft: floorConfig.maxPlays,
    phase: 'select',
  }
}
