/**
 * STS 핵심 전투 엔진
 *
 * Phase 1 — STS 재작성 (BattleState 전용, GameState 의존 없음)
 *
 * 의존성:
 *   - deckCycle.ts  : drawCards, discardCard, exhaustCard
 *   - buffEngine.ts : applyBuff, decrementBuffs, getDamageModifier, getBlockModifier,
 *                     getDealModifier, processTurnEndBuffs, getBuffValue
 *   - elementalCombat.ts : calculateDamage (오행 상성)
 */

import type { BattleState, CardDef, CardEffect, BattleLogEntry } from '@/types/stsTypes'
import type { FiveElement } from '@/types/elements'
import { drawCards, discardCard, exhaustCard } from './deckCycle'
import {
  applyBuff,
  decrementBuffs,
  getDamageModifier,
  getBlockModifier,
  getDealModifier,
  processTurnEndBuffs,
  getBuffValue,
} from './buffEngine'
import { calculateDamage } from './elementalCombat'

// ─── 카드 정의 레지스트리 (런타임 주입) ──────────────
// 테스트 및 스토어에서 주입. 기본값은 빈 맵.
let _cardRegistry: Map<string, CardDef> = new Map()

export function registerCardDefs(defs: CardDef[]): void {
  _cardRegistry = new Map(defs.map(d => [d.id, d]))
}

export function getCardDef(defId: string): CardDef | undefined {
  return _cardRegistry.get(defId)
}

// ─── 로그 헬퍼 ────────────────────────────────────────

let _logIdCounter = 0

function makeLogId(): string {
  return `log_${Date.now()}_${_logIdCounter++}`
}

function addLog(
  state: BattleState,
  message: string,
  type: BattleLogEntry['type'],
): BattleState {
  const entry: BattleLogEntry = {
    id: makeLogId(),
    message,
    type,
    timestamp: Date.now(),
  }
  return { ...state, actionLog: [...state.actionLog, entry] }
}

// ─── 데미지 ──────────────────────────────────────────

/**
 * 데미지 적용
 * - 블록 먼저 차감, 나머지가 HP 감소
 * - 취약(vulnerable) 수신 수정자 반영
 * - 오행 상성(elementalCombat) 반영 (element 제공 시)
 * - 약화(weak)는 playCard 쪽에서 적용 — 직접 호출 시 source 수정자 없음
 */
export function dealDamage(
  state: BattleState,
  target: 'enemy' | 'player',
  amount: number,
  element?: FiveElement,
): BattleState {
  let finalAmount = amount

  if (target === 'enemy') {
    const enemy = state.enemy
    // 취약 수정자
    const vulnMod = getDamageModifier(enemy)
    // 오행 상성 수정자
    const defElement = enemy.def.element === 'neutral' ? null : enemy.def.element
    const atkElement = element ?? null
    // calculateDamage는 상성 계산 + relic/daily 인자 포함
    // 여기서는 상성만 적용 (relicModifier=1.0, dailyElement=null)
    const elementalDamage = calculateDamage(finalAmount, atkElement, defElement, 1.0)
    // 취약 수정자는 elementalCombat과 별도 적용 (STS 규칙)
    finalAmount = Math.floor(elementalDamage * vulnMod)

    const newBlock = Math.max(0, enemy.block - finalAmount)
    const overflow = Math.max(0, finalAmount - enemy.block)
    const newHp = Math.max(0, enemy.hp - overflow)

    const newEnemy = { ...enemy, block: newBlock, hp: newHp }
    let newState = { ...state, enemy: newEnemy }
    newState = addLog(newState, `적에게 ${finalAmount} 데미지 (HP: ${enemy.hp} → ${newHp}, 블록: ${enemy.block} → ${newBlock})`, 'damage')

    // 적 사망 확인
    if (newHp <= 0) {
      newState = { ...newState, phase: 'victory' }
      newState = addLog(newState, '전투 승리!', 'info')
    }

    return newState
  } else {
    const player = state.player
    const vulnMod = getDamageModifier(player)
    finalAmount = Math.floor(finalAmount * vulnMod)

    const newBlock = Math.max(0, player.block - finalAmount)
    const overflow = Math.max(0, finalAmount - player.block)
    const newHp = Math.max(0, player.hp - overflow)

    // 불사조 부활 처리
    let actualHp = newHp
    let newBuffs = player.buffs
    if (newHp <= 0) {
      const phoenixBuff = player.buffs.find(b => b.id === 'phoenixRevive' && b.amount > 0)
      if (phoenixBuff) {
        actualHp = 10
        newBuffs = player.buffs.filter(b => b.id !== 'phoenixRevive')
      }
    }

    const newPlayer = { ...player, block: newBlock, hp: actualHp, buffs: newBuffs }
    let newState = { ...state, player: newPlayer }
    newState = addLog(newState, `플레이어에게 ${finalAmount} 데미지 (HP: ${player.hp} → ${actualHp})`, 'damage')

    if (actualHp <= 0) {
      newState = { ...newState, phase: 'defeat' }
      newState = addLog(newState, '전투 패배', 'info')
    }

    return newState
  }
}

// ─── 블록 ────────────────────────────────────────────

/**
 * 블록 적용
 * - 허약(frail) 수신 수정자 반영 (Math.floor)
 * - barricade 미보유 시 일반 블록 (턴 초기화됨)
 */
export function applyBlock(
  state: BattleState,
  target: 'enemy' | 'player',
  amount: number,
): BattleState {
  if (target === 'player') {
    const player = state.player
    const frailMod = getBlockModifier(player)
    // dexterity 버프: 블록 +N
    const dexBonus = getBuffValue(player, 'dexterity')
    const finalBlock = Math.floor((amount + dexBonus) * frailMod)
    const newPlayer = { ...player, block: player.block + finalBlock }
    let newState = { ...state, player: newPlayer }
    newState = addLog(newState, `플레이어 블록 +${finalBlock} (총 ${newPlayer.block})`, 'block')
    return newState
  } else {
    const enemy = state.enemy
    const frailMod = getBlockModifier(enemy)
    const finalBlock = Math.floor(amount * frailMod)
    const newEnemy = { ...enemy, block: enemy.block + finalBlock }
    let newState = { ...state, enemy: newEnemy }
    newState = addLog(newState, `적 블록 +${finalBlock} (총 ${newEnemy.block})`, 'block')
    return newState
  }
}

// ─── 카드 이펙트 실행 ────────────────────────────────

/**
 * 단일 CardEffect 실행
 * source: 카드를 사용하는 측 (Phase 1에서는 항상 player)
 */
function executeEffect(state: BattleState, effect: CardEffect, cardElement?: FiveElement | 'neutral'): BattleState {
  const player = state.player
  const element = cardElement === 'neutral' ? undefined : cardElement

  switch (effect.type) {
    case 'damage': {
      // 타겟 처리 (Phase 1: enemy만)
      const targetSide: 'enemy' | 'player' = effect.target === 'self' ? 'player' : 'enemy'
      const times = effect.times ?? 1
      // 강화(strength) 버프: 공격 데미지 +N (attack 타입 카드에만)
      const strengthBonus = getBuffValue(player, 'strength')
      const basePerHit = effect.value + strengthBonus
      // 약화(weak) 수정자
      const dealMod = getDealModifier(player)
      const damagePerHit = Math.floor(basePerHit * dealMod)
      let s = state
      for (let i = 0; i < times; i++) {
        s = dealDamage(s, targetSide, damagePerHit, element)
        if (s.phase === 'victory' || s.phase === 'defeat') break
      }
      return s
    }

    case 'block': {
      return applyBlock(state, 'player', effect.value)
    }

    case 'applyBuff': {
      if (!effect.buffId) return state
      const applyTarget: 'player' | 'enemy' = effect.target === 'enemy' ? 'enemy' : 'player'
      if (applyTarget === 'player') {
        const newPlayer = applyBuff(player, effect.buffId, effect.value, effect.buffDuration) as typeof player
        return addLog(
          { ...state, player: newPlayer },
          `플레이어 버프: ${effect.buffId} +${effect.value}`,
          'buff',
        )
      } else {
        const newEnemy = applyBuff(state.enemy, effect.buffId, effect.value, effect.buffDuration) as typeof state.enemy
        return addLog(
          { ...state, enemy: newEnemy },
          `적 버프: ${effect.buffId} +${effect.value}`,
          'debuff',
        )
      }
    }

    case 'draw': {
      return drawCards(state, effect.value)
    }

    case 'gainEnergy': {
      const newPlayer = {
        ...player,
        energy: Math.min(player.maxEnergy, player.energy + effect.value),
      }
      return { ...state, player: newPlayer }
    }

    case 'heal': {
      const healTarget: 'player' | 'enemy' = effect.target === 'enemy' ? 'enemy' : 'player'
      if (healTarget === 'player') {
        const newPlayer = { ...player, hp: Math.min(player.maxHp, player.hp + effect.value) }
        return addLog({ ...state, player: newPlayer }, `플레이어 HP +${effect.value}`, 'heal')
      } else {
        const newEnemy = { ...state.enemy, hp: Math.min(state.enemy.maxHp, state.enemy.hp + effect.value) }
        return addLog({ ...state, enemy: newEnemy }, `적 HP +${effect.value}`, 'heal')
      }
    }

    case 'selfDamage': {
      // 플레이어 자해 (블록/취약 무시)
      const newHp = Math.max(0, player.hp - effect.value)
      const newPlayer = { ...player, hp: newHp }
      return addLog({ ...state, player: newPlayer }, `자해 ${effect.value} (HP: ${player.hp} → ${newHp})`, 'damage')
    }

    case 'exhaust': {
      // 핸드 첫 번째 카드 소진 (구체적 instanceId는 playCard에서 처리)
      return state
    }

    default:
      return state
  }
}

// ─── 카드 플레이 ──────────────────────────────────────

/**
 * 핸드의 카드를 사용
 * - 에너지 차감
 * - CardEffect 순서대로 실행
 * - 카드 → discardPile (exhaustOnUse면 exhaustPile)
 */
export function playCard(state: BattleState, instanceId: string): BattleState {
  const player = state.player
  const cardInstance = player.hand.find(c => c.instanceId === instanceId)
  if (!cardInstance) return state

  // 카드 def 조회
  const defId = cardInstance.upgraded ? (cardInstance.defId + '_upgraded') : cardInstance.defId
  const def = getCardDef(defId) ?? getCardDef(cardInstance.defId)
  if (!def) return state

  // 사용 불가 카드 (저주)
  if (def.unplayable) return state

  // 에너지 확인
  if (player.energy < def.cost) return state

  // 에너지 차감
  let newState: BattleState = {
    ...state,
    player: {
      ...player,
      energy: player.energy - def.cost,
    },
  }

  // 오행 공명 추적
  const element = def.element === 'neutral' ? null : def.element as FiveElement
  if (element !== null) {
    const isSameElement = element === newState.lastPlayedElement
    newState = {
      ...newState,
      lastPlayedElement: element,
      sameElementCount: isSameElement ? newState.sameElementCount + 1 : 1,
    }
  }

  newState = addLog(newState, `카드 사용: ${def.name}`, 'cardPlay')

  // CardEffect 순서대로 실행
  for (const effect of def.effects) {
    if (newState.phase === 'victory' || newState.phase === 'defeat') break
    newState = executeEffect(newState, effect, def.element)
  }

  // 카드 이동 (exhaustOnUse → 소진더미, 나머지 → 버리기더미)
  if (def.exhaustOnUse) {
    newState = exhaustCard(newState, instanceId)
  } else {
    newState = discardCard(newState, instanceId)
  }

  return newState
}

// ─── 턴 관리 ─────────────────────────────────────────

/**
 * 플레이어 턴 시작
 * - 블록 초기화 (barricade 없을 경우)
 * - 에너지 3 충전
 * - 5장 드로우
 */
export function startPlayerTurn(state: BattleState): BattleState {
  const player = state.player

  // barricade: 블록 초기화 건너뜀
  const hasBarricade = player.buffs.some(b => b.id === 'barricade' && b.amount > 0)
  const newBlock = hasBarricade ? player.block : 0

  let newState: BattleState = {
    ...state,
    phase: 'playerTurn',
    turn: state.turn + 1,
    player: {
      ...player,
      block: newBlock,
      energy: player.maxEnergy,
    },
  }

  // 5장 드로우
  newState = drawCards(newState, 5)
  newState = addLog(newState, `턴 ${newState.turn} 시작 — 에너지 ${player.maxEnergy}, 5장 드로우`, 'info')

  return newState
}

/**
 * 플레이어 턴 종료
 * - 핸드 전체 버리기더미로
 * - 버프 duration 감소 (vulnerable, weak, frail)
 * - 턴 종료 버프 처리 (poison, regen, ritual, metallicize)
 */
export function endPlayerTurn(state: BattleState): BattleState {
  const player = state.player

  // 핸드 전체 discard
  const newDiscardPile = [...player.discardPile, ...player.hand]
  let newState: BattleState = {
    ...state,
    player: {
      ...player,
      hand: [],
      discardPile: newDiscardPile,
    },
  }

  // 턴 종료 버프 처리 (poison, regen, ritual, metallicize)
  newState = processTurnEndBuffs(newState, 'player')

  // duration 기반 버프 감소
  const newPlayer = decrementBuffs(newState.player) as typeof player
  newState = { ...newState, player: newPlayer }

  newState = addLog(newState, '플레이어 턴 종료', 'info')

  return newState
}

/**
 * 적 턴 시작
 * - 적 블록 초기화
 * - Intent 실행 (enemyEngine에서 처리 — Phase 2)
 *   Phase 1에서는 Intent 구조만 참조, 실제 실행은 enemyEngine에 위임
 */
export function startEnemyTurn(state: BattleState): BattleState {
  let newState: BattleState = {
    ...state,
    phase: 'enemyTurn',
    enemy: {
      ...state.enemy,
      block: 0,
    },
  }

  newState = addLog(newState, '적 턴 시작', 'info')
  return newState
}

/**
 * 적 턴 종료
 * - 적 버프 duration 감소
 * - 턴 종료 버프 처리 (poison, regen, ritual, metallicize)
 * - 다음 Intent 계산 (moveIndex 증가)
 */
export function endEnemyTurn(state: BattleState): BattleState {
  let newState = state

  // 턴 종료 버프 처리
  newState = processTurnEndBuffs(newState, 'enemy')

  // duration 기반 버프 감소
  const newEnemy = decrementBuffs(newState.enemy) as typeof state.enemy
  newState = { ...newState, enemy: newEnemy }

  // 다음 Intent 계산 (moveIndex 증가)
  const enemy = newState.enemy
  const moves = enemy.def.moves
  if (moves.length > 0) {
    let nextIndex: number
    if (enemy.def.patternType === 'sequential') {
      nextIndex = (enemy.moveIndex + 1) % moves.length
    } else {
      // random_weighted: 가중치 기반 선택
      const weights = enemy.def.weights ?? moves.map(() => 1)
      const total = weights.reduce((a, b) => a + b, 0)
      let rand = Math.random() * total
      nextIndex = 0
      for (let i = 0; i < weights.length; i++) {
        rand -= weights[i]
        if (rand <= 0) { nextIndex = i; break }
      }
    }

    const nextIntent = moves[nextIndex].intent
    newState = {
      ...newState,
      enemy: {
        ...newState.enemy,
        moveIndex: nextIndex,
        currentIntent: nextIntent,
      },
    }
  }

  newState = addLog(newState, '적 턴 종료', 'info')
  return newState
}
