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
import { FLOOR_CONFIGS, PLAYER_BASE_HP, HAND_SIZE, BASE_DISCARDS, SUB_GEUK_BONUS, ANTI_GEUK_PENALTY, CONDENSE_V2_MULTIPLIER, GREAT_CONDENSE_MULTIPLIER } from './balance'
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
    condenseActive: false,         // 하위 호환 (deprecated)
    // Phase 1.9.2 신규 필드 초기화
    yeonhwanUsed: false,
    condenseType: null,
    condenseMultiplier: 0,
    condensedDamage: 0,            // Phase 1.9.4: 저장형 응축
    isLastAttack: floorConfig.maxPlays === 1,
    sootCount: {},
    combustionTriggered: false,
    combustionBonus: 0,
    penetrationTriggered: false,
    penetrationIgnored: 0,
    reshuffled: false,
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

  // E-1: 연환 1회 제한 — 오행연환인데 이미 사용했으면 피해 0 (연환 차단)
  const isYeonhwan = result.rank === 'ohang-yeonhwan'
  if (isYeonhwan && state.yeonhwanUsed) {
    damage = 0
  }
  const newYeonhwanUsed = state.yeonhwanUsed || isYeonhwan
  const isBlocked = isYeonhwan && state.yeonhwanUsed  // 연환 차단 여부

  // Phase 1.6 B — 증폭부: 다음 공격 ×2
  if (state.amplifyActive && !isBlocked) {
    damage = damage * 2
  }

  // Phase 1.9.4 E-2: 응축 저장형 소모 — condenseType이 있으면 저장된 피해 × 배율 가산
  let newCondenseType = state.condenseType
  let newCondenseMultiplier = state.condenseMultiplier
  let newCondensedDamage = state.condensedDamage
  if (state.condenseType !== null && !isBlocked) {
    // 저장형: 저장량 × 배율 가산 (fixed % 방식 → saved × multiplier 방식)
    const addedDamage = Math.round(state.condensedDamage * state.condenseMultiplier)
    damage = damage + addedDamage
    newCondenseType = null
    newCondenseMultiplier = 0
    newCondensedDamage = 0
  }

  // Phase 1.9.2 E-2: 자동 응축 폐지 — 구형 자동 응축 로직 제거
  const newCondenseActive = false  // deprecated 필드, 항상 false 유지

  // Phase 1.9.2 E-3: 금 관통 — finishEl === 'geum' 시 피해감소 무시 플래그
  const penetrationTriggered = (finishEl === 'geum' && !isBlocked)

  // Phase 1.9.2 E-3: 화 연소 — finishEl === 'hwa' 시 +30% + 화 카드 값 -1 (실효화)
  let newSootCount = { ...state.sootCount }
  let combustionTriggered = false
  let combustionBonus = 0
  if (finishEl === 'hwa' && !isBlocked) {
    const beforeCombustion = damage
    damage = Math.round(damage * 1.3)
    combustionBonus = damage - beforeCombustion  // Phase 1.9.4: 연소로 추가된 피해량
    combustionTriggered = true
    for (const card of playedCards) {
      if (card.element === 'hwa') {
        newSootCount[card.id] = (newSootCount[card.id] ?? 0) + 1
      }
    }
  }

  // Phase 1.7: 4층 보스 금강불괴 — 받는 피해 -30% (금 관통 시 건너뜀)
  // Phase 1.9.4: 관통 시 무시된 감소량 계산 (UI 배너용)
  let penetrationIgnored = 0
  if (!penetrationTriggered && floorConfig.eliteGimmickEffect?.type === 'damage-reduction' && state.currentFloor >= 3) {
    const pct = floorConfig.eliteGimmickEffect.pct
    penetrationIgnored += Math.round(damage * pct)
    damage = Math.round(damage * (1 - pct))
  }

  // C10(d): 붕토령 — 받는 피해 -20% (금 관통 시 건너뜀)
  const reductionGimmick = gimmicks.find(g => g.type === 'damage-reduction')
  if (!penetrationTriggered && reductionGimmick && reductionGimmick.type === 'damage-reduction') {
    const pct = reductionGimmick.pct
    penetrationIgnored += Math.round(damage * pct)
    damage = Math.round(damage * (1 - pct))
  }
  // penetrationTriggered === true이면 penetrationIgnored = 위에서 건너뛴 총 감소량
  if (penetrationTriggered) {
    // 방어 효과가 있을 때만 의미 있는 무시량 계산
    let ignoredSum = 0
    if (floorConfig.eliteGimmickEffect?.type === 'damage-reduction' && state.currentFloor >= 3) {
      ignoredSum += Math.round(damage * floorConfig.eliteGimmickEffect.pct)
    }
    if (reductionGimmick && reductionGimmick.type === 'damage-reduction') {
      ignoredSum += Math.round(damage * reductionGimmick.pct)
    }
    penetrationIgnored = ignoredSum
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

  // Phase 1.9.4 수정 1: 덱 부족 시 버림+사용 카드 섞어 재순환 (소프트락 방지)
  // 불변 조건: "공격 기회가 남아 있는 한, 핸드는 항상 리필된다" — 진행 불능 상태 금지
  let newDeck = [...state.deck]
  // 플레이한 카드는 버림더미로 이동 (리필 전 먼저 계산)
  const newDiscardPileBase = [...state.discardPile, ...playedCards]
  let reshuffled = false
  if (newDeck.length < playedCards.length) {
    // 덱 부족: 버림더미(방금 사용한 카드 포함)를 섞어 덱 재구성 (카드 상태 유지)
    const allCards = [...newDeck, ...newDiscardPileBase]
    newDeck = shuffleDeck(allCards)
    reshuffled = true
  }
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

  // Phase 1.9.2 E-3 그을음 실효화: 화 연소 발동 시 핸드 내 화 카드 value -1 적용
  // - sootCount 누적 기준으로 핸드 카드 값 감소 (출수한 화 카드가 핸드에 다시 들어올 경우 포함)
  // - 최소값 1 보장 (0 아래 금지)
  // - 다음 출정(advanceToNextFloor) 시 sootCount 리셋으로 누적 리셋
  if (combustionTriggered) {
    newHand = newHand.map(c => {
      if (c.element === 'hwa' && (newSootCount[c.id] ?? 0) > 0) {
        return { ...c, value: Math.max(1, c.value - 1) }
      }
      return c
    })
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

  // Phase 1.9.2: 마지막 공격 기회 판별 (다음 턴 기준)
  const nextPlaysLeft = newPlaysLeft
  const newIsLastAttack = nextPlaysLeft === 1

  return {
    ...state,
    enemyHp: newEnemyHp,
    playerHp: newPlayerHp,
    hand: newHand,
    deck: newDeck,
    discardPile: reshuffled ? [] : newDiscardPileBase,
    selectedCards: [],
    playsLeft: newPlaysLeft,
    phase,
    isVictory,
    floorsCleared,
    amplifyActive: false,  // 증폭부 1회 소모
    attackCount: newAttackCount,
    enemyPhaseSwitch: newEnemyPhaseSwitch,
    condenseActive: newCondenseActive,         // deprecated, 항상 false
    // Phase 1.9.2 신규 필드
    yeonhwanUsed: newYeonhwanUsed,
    condenseType: newCondenseType,
    condenseMultiplier: newCondenseMultiplier,
    condensedDamage: newCondensedDamage,
    isLastAttack: newIsLastAttack,
    sootCount: newSootCount,
    combustionTriggered,
    combustionBonus,
    penetrationTriggered,
    penetrationIgnored,
    // Phase 1.9.4: 덱 재순환 배너용 플래그
    reshuffled,
  }
}

/** 버리기 실행 */
export function discardCards(state: GameState, cardIds: string[]): GameState {
  if (state.discardsLeft <= 0) return state

  const discarded = state.hand.filter(c => cardIds.includes(c.id))
  const remainHand = state.hand.filter(c => !cardIds.includes(c.id))

  // Phase 1.9.4: 덱 부족 시 재순환 (버리기도 동일 불변 조건 적용)
  const newDiscardPileBase = [...state.discardPile, ...discarded]
  let newDeck = [...state.deck]
  let reshuffled = false
  if (newDeck.length < discarded.length) {
    const allCards = [...newDeck, ...newDiscardPileBase]
    newDeck = shuffleDeck(allCards)
    reshuffled = true
  }
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
    discardPile: reshuffled ? [] : newDiscardPileBase,
    selectedCards: [],
    discardsLeft: state.discardsLeft - 1,
    playerHp: newPlayerHp,
    reshuffled,
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
    // Phase 1.9.2: 층 전환(=출정 시작) 시 연환 사용 리셋
    yeonhwanUsed: false,
    condenseType: null,
    condenseMultiplier: 0,
    condensedDamage: 0,
    isLastAttack: floorConfig.maxPlays === 1,
    // 그을음은 출정마다 초기화 (카드 풀 교체)
    sootCount: {},
    combustionTriggered: false,
    combustionBonus: 0,
    penetrationTriggered: false,
    penetrationIgnored: 0,
    reshuffled: false,
  }
}

// --------------- Phase 1.9.2 신규 함수 ---------------

/**
 * 응축 v2 발동 가능 여부 판별 (토 타격 조합)
 * - 토 모으기 → 'basic' 응축 가능
 * - 일군 밭 → 'basic' 응축 가능
 * - 옹기가마 → 'great' 응축 가능 (대응축)
 * 반환: null = 응축 불가, 'basic' | 'great' = 응축 가능 유형
 */
export function getCondenseAvailability(
  comboName: string | undefined,
  finishingElement: string,
): 'basic' | 'great' | null {
  if (finishingElement !== 'to') return null
  if (!comboName) return null
  if (comboName.includes('흙 모으기')) return 'basic'    // 토 모으기
  if (comboName === '일군 밭') return 'basic'            // 일군 밭 (벼리는)
  if (comboName === '옹기가마') return 'great'           // 옹기가마 (낳는) → 대응축
  return null
}

/**
 * 응축 v2 선택 적용 함수 (UI에서 "응축" 버튼 클릭 시 호출)
 * - Phase 1.9.3: 공격과 동일하게 카드 소진 + 리필 (치명 결함 수정)
 * - Phase 1.9.4: 저장형 전환 — 태운 조합의 예상 피해 저장 (expectedDamage 파라미터)
 * - 공격 횟수 1회 소모 (playsLeft -1)
 * - 실제 피해 0, condenseType/condenseMultiplier/condensedDamage 설정
 * - 중첩 불가 (기존 응축 있으면 무시)
 * - 마지막 공격 기회(isLastAttack)에는 적용 불가
 */
export function applyCondense(state: GameState, type: 'basic' | 'great', cardIds?: string[], expectedDamage?: number): GameState {
  // 마지막 공격 기회에는 응축 불가
  if (state.isLastAttack) return state
  // 중첩 불가
  if (state.condenseType !== null) return state
  // 공격 횟수 없으면 불가
  if (state.playsLeft <= 0) return state

  const multiplier = type === 'basic' ? CONDENSE_V2_MULTIPLIER : GREAT_CONDENSE_MULTIPLIER
  const newPlaysLeft = state.playsLeft - 1

  // Phase 1.9.4: 예상 피해 저장 (파라미터 없으면 0)
  const savedDamage = expectedDamage ?? 0

  // Phase 1.9.3: 카드 소진 + 리필 (공격과 동일)
  const condensedCards = cardIds
    ? state.hand.filter(c => cardIds.includes(c.id))
    : []
  const remainHand = cardIds
    ? state.hand.filter(c => !cardIds.includes(c.id))
    : [...state.hand]

  // Phase 1.9.4: 덱 부족 시 재순환 (applyCondense에도 동일 불변 조건 적용)
  const newDiscardPileBase = [...state.discardPile, ...condensedCards]
  let newDeck = [...state.deck]
  if (newDeck.length < condensedCards.length) {
    const allCards = [...newDeck, ...newDiscardPileBase]
    newDeck = shuffleDeck(allCards)
  }
  const drawnCards: Card[] = []
  for (let i = 0; i < condensedCards.length && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }
  const newHand = [...remainHand, ...drawnCards]

  return {
    ...state,
    hand: newHand,
    deck: newDeck,
    discardPile: newDiscardPileBase,
    playsLeft: newPlaysLeft,
    selectedCards: [],
    condenseType: type,
    condenseMultiplier: multiplier,
    condensedDamage: savedDamage,  // Phase 1.9.4: 저장형
    isLastAttack: newPlaysLeft === 1,
    combustionTriggered: false,
    combustionBonus: 0,
    penetrationTriggered: false,
    penetrationIgnored: 0,
    reshuffled: false,
  }
}
