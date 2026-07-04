/**
 * 턴 엔진
 * 마스터플랜 §3-2 턴 구조 구현
 *
 * 드로우(3장/턴, 핸드 6초과 번) → 에너지충전 → 메인페이즈 → 전투페이즈 → 종료 → AI턴 골격
 * W1 Fatigue 반영 확정
 */

import type { GameState, PlayerState } from '@/types/game'
import type { Card, FieldUnit } from '@/types/cards'
import {
  DRAW_PER_TURN,
  ENERGY_CAP,
  FIELD_SLOTS,
  HAND_MAX_SIZE,
  HERO_MAX_HP,
} from '@/types/game'
import { advanceFatigue, calculateFatigueDamage } from './fatigue'
import { calculateDamage } from './elementalCombat'

// ────────────────────────────────────────────────────
// 초기화 헬퍼
// ────────────────────────────────────────────────────

/**
 * 빈 필드 생성 (FIELD_SLOTS개의 null 슬롯)
 */
export function createEmptyField(): (FieldUnit | null)[] {
  return Array(FIELD_SLOTS).fill(null)
}

// ────────────────────────────────────────────────────
// 드로우 페이즈
// ────────────────────────────────────────────────────

export interface DrawResult {
  /** 업데이트된 플레이어 상태 */
  player: PlayerState
  /** 번(burn)된 카드 수 */
  burnedCount: number
  /** 적용된 Fatigue 피해 */
  fatigueDamage: number
  /** 실제 드로우된 카드 수 */
  drawnCount: number
}

/**
 * 드로우 페이즈 실행
 * 1. 덱이 비어있으면 Fatigue 처리
 * 2. 덱에서 최대 DRAW_PER_TURN장 드로우
 * 3. 핸드 초과분은 번(burn)
 */
export function executeDraw(player: PlayerState, _turn: number): DrawResult {
  let updatedPlayer = { ...player }
  let burnedCount = 0
  let drawnCount = 0
  let fatigueDamage = 0

  // 드로우 실행
  const newDeck = [...player.deck]
  const newHand = [...player.hand]
  const newGraveyard = [...player.graveyard]

  for (let i = 0; i < DRAW_PER_TURN; i++) {
    if (newDeck.length === 0) break

    const card = newDeck.shift() as Card
    drawnCount++

    if (newHand.length >= HAND_MAX_SIZE) {
      // 핸드 초과 → 번(burn)
      newGraveyard.push(card)
      burnedCount++
    } else {
      newHand.push(card)
    }
  }

  updatedPlayer = {
    ...updatedPlayer,
    deck: newDeck,
    hand: newHand,
    graveyard: newGraveyard,
  }

  // Fatigue 처리 (W1 확정 규칙)
  //
  // 케이스 A: 드로우 전 덱이 이미 비어있었음 (player.deck.length=0)
  //   → 카운터 증가 + 피해 적용 (N번째 턴 = N 피해)
  //
  // 케이스 B: 드로우 전 덱에 카드가 있었으나 드로우 중 소진됨
  //   → deckExhausted=true 기록만, 이 턴엔 피해 없음
  //   → 다음 턴부터 케이스 A로 처리
  if (player.deck.length === 0 && !player.fatigue.deckExhausted) {
    // 케이스 A-init: 이미 덱 비어있고 아직 exhausted 플래그 없음 → 첫 소진 턴
    const newFatigue = advanceFatigue(player.fatigue, 0)
    fatigueDamage = calculateFatigueDamage(newFatigue)
    updatedPlayer = {
      ...updatedPlayer,
      fatigue: newFatigue,
      currentHp: Math.max(0, updatedPlayer.currentHp - fatigueDamage),
    }
  } else if (player.fatigue.deckExhausted) {
    // 케이스 A: 이미 소진 상태였음 — 소진 후 N번째 턴
    const newFatigue = advanceFatigue(player.fatigue, 0)
    fatigueDamage = calculateFatigueDamage(newFatigue)
    updatedPlayer = {
      ...updatedPlayer,
      fatigue: newFatigue,
      currentHp: Math.max(0, updatedPlayer.currentHp - fatigueDamage),
    }
  } else if (newDeck.length === 0) {
    // 케이스 B: 이번 드로우로 덱 소진 — deckExhausted=true, count=0, 피해 없음
    updatedPlayer = {
      ...updatedPlayer,
      fatigue: { deckExhausted: true, exhaustedTurnsCount: 0 },
    }
  }

  return { player: updatedPlayer, burnedCount, fatigueDamage, drawnCount }
}

// ────────────────────────────────────────────────────
// 에너지 충전 페이즈
// ────────────────────────────────────────────────────

/**
 * 해당 턴의 에너지 계산
 * 턴 1: 1, 턴 2: 2, ..., 턴 5+: 5 (상한 고정)
 */
export function calculateEnergy(turn: number): number {
  return Math.min(turn, ENERGY_CAP)
}

/**
 * 에너지 충전 페이즈 실행
 */
export function executeEnergyCharge(player: PlayerState, turn: number): PlayerState {
  return {
    ...player,
    currentEnergy: calculateEnergy(turn),
  }
}

// ────────────────────────────────────────────────────
// 카드 플레이 (메인 페이즈)
// ────────────────────────────────────────────────────

export type PlayCardResult =
  | { success: true; player: PlayerState }
  | { success: false; reason: string }

/**
 * 카드 플레이 유효성 검사 및 실행
 * @param player - 현재 플레이어 상태
 * @param cardIndex - 핸드에서의 카드 인덱스
 * @param fieldSlot - 병사 카드의 경우 배치할 필드 슬롯 (0~3)
 */
export function playCard(
  player: PlayerState,
  cardIndex: number,
  fieldSlot?: number,
): PlayCardResult {
  const card = player.hand[cardIndex]
  if (!card) return { success: false, reason: '유효하지 않은 카드 인덱스' }

  if (player.currentEnergy < card.cost) {
    return { success: false, reason: `에너지 부족 (필요: ${card.cost}, 현재: ${player.currentEnergy})` }
  }

  const newHand = [...player.hand]
  newHand.splice(cardIndex, 1)

  let newField = [...player.field]
  let newGraveyard = [...player.graveyard]

  if (card.cardType === 'soldier') {
    // 병사 카드 → 필드에 소환
    const slot = fieldSlot !== undefined ? fieldSlot : newField.findIndex(s => s === null)
    if (slot === -1 || slot >= FIELD_SLOTS) {
      return { success: false, reason: '필드가 가득 찼습니다 (최대 4슬롯)' }
    }
    if (newField[slot] !== null) {
      return { success: false, reason: '해당 슬롯이 이미 점유되어 있습니다' }
    }

    const unit: FieldUnit = {
      card,
      currentHealth: card.maxHealth,
      currentAttack: card.attack,
      canAttack: card.keywords.includes('rush'), // 돌진 키워드 있으면 즉시 공격 가능
      frozen: false,
      rebornUsed: false,
      summonedOnTurn: 0, // 실제 턴 번호는 GameState에서 주입
      temporaryKeywords: [],
    }

    newField = [...newField]
    newField[slot] = unit
  } else {
    // 효과 카드 → 즉시 발동 후 묘지 (실제 효과 실행은 M3에서 구현)
    newGraveyard.push(card)
  }

  return {
    success: true,
    player: {
      ...player,
      hand: newHand,
      field: newField,
      graveyard: newGraveyard,
      currentEnergy: player.currentEnergy - card.cost,
    },
  }
}

// ────────────────────────────────────────────────────
// 전투 페이즈 (자동 공격)
// ────────────────────────────────────────────────────

export interface CombatResult {
  attackerState: GameState
  log: string[]
}

/**
 * 전투 페이즈 실행 — 공격자 필드의 유닛이 순서대로 자동 공격
 * 도발 유닛이 있으면 반드시 도발 유닛을 먼저 공격
 * @param state - 현재 게임 상태
 * @param attackerIsPlayer - true: 플레이어 공격, false: AI 공격
 */
export function executeCombatPhase(
  state: GameState,
  attackerIsPlayer: boolean,
): GameState {
  const attacker = attackerIsPlayer ? state.player : state.ai
  const defender = attackerIsPlayer ? state.ai : state.player
  const combatLog: string[] = []

  let newDefender = { ...defender }
  let newAttacker = { ...attacker }

  const attackerField = newAttacker.field

  for (let i = 0; i < FIELD_SLOTS; i++) {
    const unit = attackerField[i]
    if (!unit) continue
    if (!unit.canAttack) continue
    if (unit.frozen) continue

    // 도발 유닛 확인
    const tauntUnits = newDefender.field
      .map((u, idx) => ({ u, idx }))
      .filter(({ u }) => u !== null && hasKeyword(u, 'taunt'))

    let targetUnitIdx: number | null = null
    let targetHero = false

    // 관통(pierce) 키워드는 도발을 무시하고 영웅 직접 타격 가능
    // 마스터플랜 §4-2: "적 유닛이 있어도 영웅에게 직접 데미지 가능"
    if (hasKeyword(unit, 'pierce')) {
      targetHero = true
    } else if (tauntUnits.length > 0) {
      // 도발 유닛 우선 공격 (관통 아닌 경우)
      targetUnitIdx = tauntUnits[0].idx
    } else {
      // 방어 유닛이 있으면 유닛 공격, 없으면 영웅
      const firstEnemyUnit = newDefender.field.findIndex(u => u !== null)
      if (firstEnemyUnit !== -1) {
        targetUnitIdx = firstEnemyUnit
      } else {
        targetHero = true
      }
    }

    if (targetHero) {
      // 영웅 직접 공격
      const damage = calculateDamage(
        unit.currentAttack,
        unit.card.element,
        newDefender.hero.element,
      )
      newDefender = {
        ...newDefender,
        currentHp: Math.max(0, newDefender.currentHp - damage),
      }
      combatLog.push(`${unit.card.name} → 영웅 공격 (${damage} 피해)`)

      // 생명흡수
      if (hasKeyword(unit, 'lifesteal')) {
        newAttacker = {
          ...newAttacker,
          currentHp: Math.min(HERO_MAX_HP, newAttacker.currentHp + damage),
        }
      }
    } else if (targetUnitIdx !== null) {
      // 유닛 공격
      const targetUnit = newDefender.field[targetUnitIdx]!
      const damage = calculateDamage(
        unit.currentAttack,
        unit.card.element,
        targetUnit.card.element,
      )

      let updatedTarget: FieldUnit | null = {
        ...targetUnit,
        currentHealth: targetUnit.currentHealth - damage,
      }

      // 독성 처리 (공격 시 무조건 파괴)
      if (hasKeyword(unit, 'poison')) {
        updatedTarget = { ...updatedTarget, currentHealth: 0 }
        combatLog.push(`${unit.card.name} → ${targetUnit.card.name} 독성 파괴`)
      } else {
        combatLog.push(`${unit.card.name} → ${targetUnit.card.name} (${damage} 피해)`)
      }

      // 냉기: 공격당한 유닛은 다음 턴 공격 불가
      if (hasKeyword(unit, 'freeze')) {
        updatedTarget = { ...updatedTarget, frozen: true }
      }

      // 피격 처리 (역공)
      const counterDamage = calculateDamage(
        targetUnit.currentAttack,
        targetUnit.card.element,
        unit.card.element,
      )
      const attackerUnit = newAttacker.field[i]!
      let updatedAttackerUnit: FieldUnit | null = {
        ...attackerUnit,
        currentHealth: attackerUnit.currentHealth - counterDamage,
      }

      // 생명흡수
      if (hasKeyword(unit, 'lifesteal') && targetUnitIdx !== null) {
        newAttacker = {
          ...newAttacker,
          currentHp: Math.min(HERO_MAX_HP, newAttacker.currentHp + damage),
        }
      }

      // 유닛 사망 처리
      // 공격자가 소각(incinerate) 보유 시 피격 유닛 부활 방지 + 묘지 제외
      const attackerHasIncinerate = hasKeyword(unit, 'incinerate')
      const defResult = resolveUnitDeath(updatedTarget, newDefender.graveyard, attackerHasIncinerate)
      updatedTarget = defResult.unit
      const newDefGraveyard = defResult.graveyard

      const atkResult = resolveUnitDeath(updatedAttackerUnit, newAttacker.graveyard, false)
      updatedAttackerUnit = atkResult.unit

      const newDefField = [...newDefender.field]
      newDefField[targetUnitIdx] = updatedTarget
      const newAtkField = [...newAttacker.field]
      newAtkField[i] = updatedAttackerUnit

      newDefender = {
        ...newDefender,
        field: newDefField,
        graveyard: newDefGraveyard,
      }
      newAttacker = {
        ...newAttacker,
        field: newAtkField,
        graveyard: atkResult.graveyard,
      }
    }
  }

  if (attackerIsPlayer) {
    return {
      ...state,
      player: newAttacker,
      ai: newDefender,
      log: [...state.log, ...combatLog],
    }
  } else {
    return {
      ...state,
      ai: newAttacker,
      player: newDefender,
      log: [...state.log, ...combatLog],
    }
  }
}

// ────────────────────────────────────────────────────
// 유닛 사망 처리
// ────────────────────────────────────────────────────

interface UnitDeathResult {
  /** 살아남은 유닛(부활 포함) 또는 null(완전 사망) */
  unit: FieldUnit | null
  /** 업데이트된 묘지 */
  graveyard: Card[]
}

/**
 * 유닛 HP가 0 이하이면 사망 처리
 * 부활(reborn) 키워드 처리 포함
 * 소각(incinerate) 처리: 처치자가 소각 보유 시 부활 발동 차단 + 묘지 미이동
 * @param unit - 사망 판정할 유닛
 * @param graveyard - 현재 묘지 배열
 * @param killerHasIncinerate - 처치자가 소각 키워드를 보유하는지 여부
 * @returns 유닛 상태와 업데이트된 묘지
 */
function resolveUnitDeath(
  unit: FieldUnit | null,
  graveyard: Card[],
  killerHasIncinerate: boolean,
): UnitDeathResult {
  if (unit === null) return { unit: null, graveyard }
  if (unit.currentHealth > 0) return { unit, graveyard }

  // 소각(incinerate): 처치자가 소각 보유 시 부활 발동 불가 + 묘지에 추가하지 않음
  // 마스터플랜 §4-2: "처치된 적을 묘지에 보내지 않고 제거 (부활 방지)"
  if (killerHasIncinerate) {
    return { unit: null, graveyard }
  }

  // 부활(reborn) 처리: 소각이 아닌 경우에만 발동
  if (
    (unit.card.keywords.includes('reborn') || unit.temporaryKeywords.includes('reborn'))
    && !unit.rebornUsed
  ) {
    return {
      unit: {
        ...unit,
        currentHealth: 1,
        rebornUsed: true,
      },
      graveyard,
    }
  }

  // 정상 사망 → 묘지에 카드 추가 후 null 반환
  return { unit: null, graveyard: [...graveyard, unit.card] }
}

// ────────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────────

function hasKeyword(unit: FieldUnit, keyword: string): boolean {
  return (
    unit.card.keywords.includes(keyword as Parameters<typeof unit.card.keywords.includes>[0])
    || unit.temporaryKeywords.includes(keyword as Parameters<typeof unit.temporaryKeywords.includes>[0])
  )
}

// ────────────────────────────────────────────────────
// 승패 판정
// ────────────────────────────────────────────────────

import type { GameResult } from '@/types/game'

export function checkGameResult(state: GameState): GameResult {
  const playerDead = state.player.currentHp <= 0
  const aiDead = state.ai.currentHp <= 0

  if (playerDead && aiDead) return 'draw'
  if (playerDead) return 'player_lose'
  if (aiDead) return 'player_win'
  return null
}

// ────────────────────────────────────────────────────
// 턴 종료 처리
// ────────────────────────────────────────────────────

/**
 * 턴 종료 시 필드 유닛들의 공격 가능 상태 리셋
 * 냉기(동결) 상태도 해제
 */
export function resetFieldForNewTurn(player: PlayerState, currentTurn: number): PlayerState {
  const newField = player.field.map(unit => {
    if (!unit) return null
    return {
      ...unit,
      canAttack: true,
      frozen: false,
      summonedOnTurn: unit.summonedOnTurn || currentTurn,
    }
  })
  return { ...player, field: newField }
}

// ────────────────────────────────────────────────────
// AI 턴 골격 (M3에서 로직 구현)
// ────────────────────────────────────────────────────

/**
 * AI 턴 실행 골격
 * M3에서 실제 로직 구현 예정
 * 현재는 인터페이스만 정의하고 턴 종료만 처리
 */
export function executeAITurn(state: GameState): GameState {
  // M3 구현 예약: AI 행동 결정 로직
  // 현재는 드로우 + 에너지충전 + 턴 종료만 처리

  const aiDrawResult = executeDraw(state.ai, state.turn)
  const aiWithEnergy = executeEnergyCharge(aiDrawResult.player, state.turn)
  const aiForNextTurn = resetFieldForNewTurn(aiWithEnergy, state.turn)

  return {
    ...state,
    ai: aiForNextTurn,
    log: [...state.log, '[AI 턴] 드로우 완료 (M3에서 전략 로직 구현 예정)'],
  }
}
