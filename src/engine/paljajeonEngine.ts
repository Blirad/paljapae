/**
 * 팔자전 — 턴 시뮬레이션 엔진
 * 순수 함수 모듈 — UI 의존 없음
 */

import type { Card, GameState, Element, SavedHeroProfile } from '../types/game'
import {
  judgeHand,
  GEUK_MAP,
  detectElementClash,
} from './pokerHandJudge'
import { FLOOR_CONFIGS, PLAYER_BASE_HP, HAND_SIZE, BASE_DISCARDS, SUB_GEUK_BONUS, ANTI_GEUK_PENALTY } from './balance'
import { generateSajuDeck } from './deckGenerator'

/**
 * C10(d): 오행 속성별 기믹 정의 (balance.ts 수치 변경 없이 새로운 로직 추가)
 * 부록 2-1. 변질 오행 5종 기믹 — 이든 지시 수치 그대로 적용
 * - 고목령(木): 매 턴 자신 체력 15 회복
 * - 잔화령(火): 반격 피해 +50% (×1.5배)
 * - 붕토령(土): 받는 피해 -20%
 * - 녹철령(金): 매 턴 무작위 핸드 카드 1장 값 -1 (녹)
 * - 탁수령(水): 플레이어 버리기 1회당 피해 3
 */
export type FloorGimmick =
  | { type: 'heal'; amount: number }           // 매 턴 체력 회복
  | { type: 'damage-reduction'; pct: number }  // 받는 피해 감소 (0~1)
  | { type: 'counter-boost'; pct: number }     // 반격 피해 증가 (배율, ×N배)
  | { type: 'card-rust'; amount: number }      // 매 턴 핸드 카드 값 감소 (녹)
  | { type: 'discard-punish'; damage: number } // 버리기 시 피해

/** 오행 속성별 기믹 맵 (1~2층 잡몹용) */
export const ELEMENT_GIMMICKS: Record<string, FloorGimmick[]> = {
  mok: [{ type: 'heal', amount: 15 }],                // 고목령 — 매 턴 15 회복 (이든 지시 수치)
  hwa: [{ type: 'counter-boost', pct: 1.5 }],         // 잔화령 — 반격 +50%
  to:  [{ type: 'damage-reduction', pct: 0.2 }],      // 붕토령 — 받는 피해 -20%
  geum: [{ type: 'card-rust', amount: 1 }],            // 녹철령 — 매 턴 핸드 카드 1장 값 -1
  su:  [{ type: 'discard-punish', damage: 3 }],        // 탁수령 — 버리기 1회당 피해 3
}

/** 층별 적 속성 (1~2층: 잡몹, 3~4층: 정예/보스) */
export const FLOOR_ENEMY_ELEMENTS: Record<number, string> = {
  1: 'mok',   // 고목령(木)
  2: 'hwa',   // 잔화령(火)
  3: 'to',    // 정예: 고신(土) — 기믹은 패시브 봉인 (엔진 별도 처리)
  4: 'geum',  // 보스: 명외자 대장(金) — 기믹은 3번째 출수 배율 고정 (엔진 별도 처리)
}

/** 현재 층의 기믹 목록 반환 (1~2층 잡몹만 ELEMENT_GIMMICKS 적용) */
function getFloorGimmicks(floor: number): FloorGimmick[] {
  const element = FLOOR_ENEMY_ELEMENTS[floor]
  // 1~2층만 잡몹 기믹 적용 (3~4층 정예/보스는 별도 로직)
  if (floor <= 2 && element) {
    return ELEMENT_GIMMICKS[element] ?? []
  }
  return []
}

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
export function createInitialGameState(floorIndex = 0, heroProfile?: SavedHeroProfile | null): GameState {
  const floorConfig = FLOOR_CONFIGS[floorIndex]
  let deck: Card[]
  if (heroProfile?.elementDist && heroProfile?.deckSeed) {
    deck = shuffleDeck(generateSajuDeck(heroProfile.elementDist, heroProfile.deckSeed))
  } else {
    deck = shuffleDeck(createFixedDeck())
  }
  const hand = deck.slice(0, HAND_SIZE)
  const remainDeck = deck.slice(HAND_SIZE)

  // balance.ts 수치 그대로 사용 (기믹은 전투 중 별도 로직으로 적용)
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
    talismans: [],
    amplifyActive: false,
    attackCount: 0,
    enemyPhaseSwitch: false,
    condenseActive: false,
  }
}

/** 역극 여부 판단: 플레이어 카드들이 적 오행에 의해 극 당하면 역극 */
export function isYeokgeuk(card: Card, enemyElement: Element): boolean {
  return GEUK_MAP[enemyElement] === card.element
}

/** 출수 실행 → 새로운 GameState 반환 */
export function playCards(state: GameState, cardIds: string[]): GameState {
  const floorConfig = FLOOR_CONFIGS[state.currentFloor - 1]
  const gimmicks = getFloorGimmicks(state.currentFloor)
  const playedCards = state.hand.filter(c => cardIds.includes(c.id))
  const remainHand = state.hand.filter(c => !cardIds.includes(c.id))

  const result = judgeHand(playedCards)
  let damage = result.totalScore

  // Phase 1.7 — 기운 전환 반영: 전환 시 주/부 기운 교대
  const primaryEl = (!state.enemyPhaseSwitch)
    ? floorConfig.enemyPrimaryElement
    : floorConfig.enemySubElement
  const subEl = (!state.enemyPhaseSwitch)
    ? floorConfig.enemySubElement
    : floorConfig.enemyPrimaryElement

  // Phase 1.6 A — 전투 규칙 3종 (floorEnemyEl = 현재 주 기운)
  const floorEnemyEl = primaryEl as Element | undefined

  // A-1: [기운 충돌] 조합 내 서로 극하는 기운 공존 시 -30%
  const clashes = detectElementClash(playedCards)
  if (clashes.length > 0) {
    damage = Math.round(damage * 0.7)
  }

  // Phase 1.8: 마무리 기운 기준 극/반극 판정
  const finishEl = result.finishingElement

  // A-2: [마무리 기운 원칙] 마무리 기운이 적 주 기운을 극하면 +70%, 아닌 기운이 극하면 +10%
  let mainGeukApplied = false
  if (floorEnemyEl) {
    const finishGeuksEnemy = GEUK_MAP[finishEl] === floorEnemyEl
    const anyGeuksEnemy = playedCards.some(c => GEUK_MAP[c.element] === floorEnemyEl)
    if (finishGeuksEnemy) {
      damage = Math.round(damage * 1.7)
      mainGeukApplied = true
    } else if (anyGeuksEnemy) {
      damage = Math.round(damage * 1.1)
      mainGeukApplied = true
    }
  }

  // Phase 1.7 신규: 부 기운 극 보너스 +25% (주 기운 극 적용 안 된 경우만)
  if (!mainGeukApplied && subEl) {
    const hasSubGeuk = playedCards.some(c => GEUK_MAP[c.element] === subEl)
    if (hasSubGeuk) {
      damage = Math.round(damage * SUB_GEUK_BONUS)
    }
  }

  // A-3: [적의 반극] 마무리 기운이 적 주 기운에 의해 극 당하면 -40% (Phase 1.8)
  if (floorEnemyEl) {
    const enemyGeuksFinish = GEUK_MAP[floorEnemyEl] === finishEl
    if (enemyGeuksFinish) {
      damage = Math.round(damage * ANTI_GEUK_PENALTY)
    }
  }

  // Phase 1.7: 4층 보스 금강불괴 — 받는 피해 -30%
  if (floorConfig.eliteGimmickEffect?.type === 'damage-reduction' && state.currentFloor >= 3) {
    damage = Math.round(damage * (1 - floorConfig.eliteGimmickEffect.pct))
  }

  // Phase 1.6 B — 증폭부: 다음 공격 ×2
  if (state.amplifyActive) {
    damage = damage * 2
  }

  // Phase 1.8 — 토 응축 소모: 이전 응축 상태이면 ×1.6
  let newCondenseActive = state.condenseActive
  if (state.condenseActive) {
    damage = Math.round(damage * 1.6)
    newCondenseActive = false
  }

  // Phase 1.8 — 토 응축 적립: 마무리 기운이 토이면 즉시 피해 ×0.6 + 응축 활성
  if (finishEl === 'to' && !state.condenseActive) {
    damage = Math.round(damage * 0.6)
    newCondenseActive = true
  }

  // C10(d): 붕토령 — 받는 피해 -20%
  const reductionGimmick = gimmicks.find(g => g.type === 'damage-reduction')
  if (reductionGimmick && reductionGimmick.type === 'damage-reduction') {
    damage = Math.round(damage * (1 - reductionGimmick.pct))
  }

  // C10(d): 고목령 — 매 턴 체력 15 회복 (피해 적용 후, 생존 시에만)
  const healGimmick = gimmicks.find(g => g.type === 'heal')
  const afterDamageHp = Math.max(0, state.enemyHp - damage)
  const enemyHealAmount = (healGimmick && healGimmick.type === 'heal' && afterDamageHp > 0)
    ? healGimmick.amount : 0

  const newEnemyHp = Math.min(state.enemyMaxHp, afterDamageHp + enemyHealAmount)
  let counterDamage = floorConfig.counterDamage

  // C10(d): 잔화령 — 반격 +50%
  const counterBoostGimmick = gimmicks.find(g => g.type === 'counter-boost')
  if (counterBoostGimmick && counterBoostGimmick.type === 'counter-boost') {
    counterDamage = Math.round(counterDamage * counterBoostGimmick.pct)
  }

  // Phase 1.7: 강공(heavyAttack) 시스템 — 3~4층
  const newAttackCount = state.attackCount + 1
  const heavyAttackConf = floorConfig.heavyAttack
  let heavyAttackDamage = 0
  if (heavyAttackConf && newAttackCount % heavyAttackConf.everyN === 0) {
    heavyAttackDamage = heavyAttackConf.damage
  }

  // Phase 1.7: 격노(rage) 보스 효과 — 반격 배율 강화 (체력 전환 후)
  const rageEffect = floorConfig.bossExtraGimmick?.type === 'rage'
    ? floorConfig.bossExtraGimmick
    : null
  if (rageEffect && state.enemyPhaseSwitch) {
    counterDamage = Math.round(counterDamage * rageEffect.counterMult)
  }

  // lifesteal: 출수한 카드 중 lifesteal 카드가 있으면 데미지의 30%를 HP 회복
  const hasLifesteal = playedCards.some(c => c.lifesteal === true)
  const lifestealHeal = hasLifesteal ? Math.floor(damage * 0.3) : 0
  const newPlayerHp = Math.min(
    state.playerMaxHp,
    Math.max(0, state.playerHp - counterDamage - heavyAttackDamage + lifestealHeal)
  )
  const newPlaysLeft = state.playsLeft - 1

  // 덱에서 플레이한 장수만큼 다시 뽑기
  const newDeck = [...state.deck]
  const drawnCards: Card[] = []
  for (let i = 0; i < playedCards.length && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }
  let newHand = [...remainHand, ...drawnCards]

  // C10(d): 녹철령(金) — 매 턴 무작위 핸드 카드 1장 값 -1 (적 생존 시만 발동)
  const rustGimmick = gimmicks.find(g => g.type === 'card-rust')
  if (rustGimmick && rustGimmick.type === 'card-rust' && newHand.length > 0 && afterDamageHp > 0) {
    const rustIdx = Math.floor(Math.random() * newHand.length)
    newHand = newHand.map((c, i) =>
      i === rustIdx ? { ...c, value: Math.max(1, c.value - rustGimmick.amount) } : c
    )
  }

  const floorCleared = newEnemyHp <= 0
  const playerDead = newPlayerHp <= 0
  const outOfPlays = newPlaysLeft <= 0 && newEnemyHp > 0

  // Phase 1.7: 기운 전환 판정 (3~4층, 1회만)
  const phaseSwitchThreshold = floorConfig.forcePhaseSwitch?.hpPct ?? null
  const newEnemyPhaseSwitch =
    state.enemyPhaseSwitch ||
    (phaseSwitchThreshold !== null && !floorCleared && newEnemyHp <= state.enemyMaxHp * phaseSwitchThreshold)

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
    amplifyActive: false,  // 증폭부 1회 소모
    attackCount: newAttackCount,
    enemyPhaseSwitch: newEnemyPhaseSwitch,
    condenseActive: newCondenseActive,
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

  // C10(d): 탁수령(水) — 버리기 1회당 플레이어 피해 3
  const gimmicks = getFloorGimmicks(state.currentFloor)
  const punishGimmick = gimmicks.find(g => g.type === 'discard-punish')
  const punishDamage = (punishGimmick && punishGimmick.type === 'discard-punish')
    ? punishGimmick.damage
    : 0
  const newPlayerHp = Math.max(0, state.playerHp - punishDamage)

  return {
    ...state,
    hand: [...remainHand, ...drawnCards],
    deck: newDeck,
    discardPile: [...state.discardPile, ...discarded],
    selectedCards: [],
    discardsLeft: state.discardsLeft - 1,
    playerHp: newPlayerHp,
  }
}

// --------------- Phase 1.6 B — 부적술 발동 함수 ---------------

/**
 * 정화부(淨化符) 발동: 무덤 맨 위 카드 최대 3장을 손으로 복구
 */
export function activateJeonghwa(state: GameState): GameState {
  if (!state.talismans.includes('jeonghwa')) return state
  if (state.discardPile.length === 0) return state

  const recoverCount = Math.min(3, state.discardPile.length)
  const recovered = state.discardPile.slice(-recoverCount)
  const newDiscard = state.discardPile.slice(0, state.discardPile.length - recoverCount)
  const newHand = [...state.hand, ...recovered]
  const newTalismans = state.talismans.filter(id => id !== 'jeonghwa')

  return {
    ...state,
    hand: newHand,
    discardPile: newDiscard,
    talismans: newTalismans,
  }
}

/**
 * 환패부(換牌符) 발동: 핸드 전체를 버리고 덱에서 같은 수만큼 다시 뽑음
 */
export function activateHwanpae(state: GameState): GameState {
  if (!state.talismans.includes('hwanpae')) return state

  const handSize = state.hand.length
  const newDiscard = [...state.discardPile, ...state.hand]
  const newDeck = [...state.deck]
  const drawnCards: Card[] = []
  for (let i = 0; i < handSize && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }
  const newTalismans = state.talismans.filter(id => id !== 'hwanpae')

  return {
    ...state,
    hand: drawnCards,
    deck: newDeck,
    discardPile: newDiscard,
    talismans: newTalismans,
  }
}

/**
 * 증폭부(增幅符) 발동: 다음 공격 데미지 ×2 버프 활성화
 */
export function activateJeungpok(state: GameState): GameState {
  if (!state.talismans.includes('jeungpok')) return state
  const newTalismans = state.talismans.filter(id => id !== 'jeungpok')
  return {
    ...state,
    talismans: newTalismans,
    amplifyActive: true,
  }
}

/**
 * 부적 획득: 부적 id를 talismans 목록에 추가
 */
export function acquireTalisman(state: GameState, talismanId: string): GameState {
  if (state.talismans.includes(talismanId)) return state  // 중복 불가
  return {
    ...state,
    talismans: [...state.talismans, talismanId],
  }
}

// --------------- 다음 층으로 전환 ---------------

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
    attackCount: 0,
    enemyPhaseSwitch: false,
    condenseActive: false,
  }
}
