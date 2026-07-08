/**
 * 효과 실행 엔진 — Phase 1-4
 *
 * CardEffect[] 배열을 받아 GameState에 적용하는 순수 함수 엔진.
 * cards.ts의 effectText/battlecry에 담긴 효과들을 실제 실행 가능하게 연결한다.
 *
 * 설계 원칙:
 * - 모든 함수는 순수 함수 (side-effect 없음)
 * - GameState를 받아 새 GameState를 반환
 * - 타입 안전: CardEffect 유니온으로 타입별 처리
 */

import type { GameState, PlayerState } from '@/types/game'
import { HERO_MAX_HP, FIELD_SLOTS } from '@/types/game'
import type { Card, FieldUnit, Keyword } from '@/types/cards'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// 효과 타입 정의
// ────────────────────────────────────────────────────

/** 효과 대상 */
export type EffectTarget =
  | 'enemy_unit'       // 단일 적 유닛 (context.targetUnitIdx 필요)
  | 'enemy_hero'       // 적 영웅
  | 'all_enemies'      // 적 필드 전체 유닛
  | 'self_unit'        // 시전 유닛 자신 (context.casterSlot 필요)
  | 'all_friendly'     // 내 필드 전체 유닛
  | 'self_hero'        // 내 영웅
  | 'adjacent_enemies' // 타겟 양옆 적 유닛 (context.targetUnitIdx 필요)

/** 카드 효과 유니온 타입 */
export type CardEffect =
  | { type: 'damage';    target: EffectTarget; value: number }
  | { type: 'heal';      target: EffectTarget; value: number }
  | { type: 'buff_atk';  target: EffectTarget; value: number }
  | { type: 'buff_hp';   target: EffectTarget; value: number }
  | { type: 'draw';      count: number }
  | { type: 'add_keyword'; target: EffectTarget; keyword: Keyword }
  | { type: 'summon';    attack: number; health: number; keywords?: Keyword[]; element?: FiveElement | null }
  | { type: 'energy_refund'; amount: number }

/** 효과 실행 컨텍스트 */
export interface EffectContext {
  /** 효과를 시전한 플레이어 ('player' | 'ai') */
  casterSide: 'player' | 'ai'
  /** 시전 유닛의 필드 슬롯 (병사 battlecry용, 없으면 undefined) */
  casterSlot?: number
  /** 타겟 유닛의 필드 슬롯 (단일 타겟 효과용, 없으면 undefined) */
  targetUnitIdx?: number
  /** 시전한 카드 데이터 (소환 효과에서 원본 카드 참조용) */
  sourceCard?: Card
}

// ────────────────────────────────────────────────────
// 메인 함수: 효과 배열 적용
// ────────────────────────────────────────────────────

/**
 * CardEffect[] 배열을 받아 GameState에 순차 적용하는 순수 함수
 *
 * @param effects - 적용할 효과 배열
 * @param state - 현재 게임 상태
 * @param context - 시전자/타겟 등 실행 컨텍스트
 * @returns 효과 적용 후 새 GameState
 *
 * 사용 예 (병사 battlecry):
 *   const effects = parseEffectText(card.battlecry)
 *   newState = applyEffects(effects, state, { casterSide: 'player', casterSlot: slotIdx })
 *
 * 사용 예 (주문 카드):
 *   const effects = parseEffectText(spellCard.effectText)
 *   newState = applyEffects(effects, state, { casterSide: 'player', targetUnitIdx: selectedTarget })
 */
export function applyEffects(
  effects: CardEffect[],
  state: GameState,
  context: EffectContext,
): GameState {
  let newState = state

  for (const effect of effects) {
    newState = applySingleEffect(effect, newState, context)
  }

  return newState
}

// ────────────────────────────────────────────────────
// 단일 효과 적용
// ────────────────────────────────────────────────────

function applySingleEffect(
  effect: CardEffect,
  state: GameState,
  context: EffectContext,
): GameState {
  const casterPlayer = context.casterSide === 'player' ? state.player : state.ai
  const defenderPlayer = context.casterSide === 'player' ? state.ai : state.player

  switch (effect.type) {

    case 'damage': {
      return applyDamageEffect(effect, state, context, casterPlayer, defenderPlayer)
    }

    case 'heal': {
      return applyHealEffect(effect, state, context, casterPlayer, defenderPlayer)
    }

    case 'buff_atk': {
      return applyBuffEffect('atk', effect.value, effect.target, state, context, casterPlayer)
    }

    case 'buff_hp': {
      return applyBuffEffect('hp', effect.value, effect.target, state, context, casterPlayer)
    }

    case 'draw': {
      // 드로우는 turnEngine.executeDraw를 사용하므로 여기서는 로그만 추가
      // 실제 드로우는 호출부에서 executeDraw로 처리
      return {
        ...state,
        log: [...state.log, `[효과] 카드 ${effect.count}장 드로우`],
      }
    }

    case 'add_keyword': {
      return applyAddKeywordEffect(effect.keyword, effect.target, state, context, casterPlayer)
    }

    case 'summon': {
      return applySummonEffect(effect, state, context, casterPlayer)
    }

    case 'energy_refund': {
      const newCasterPlayer: PlayerState = {
        ...casterPlayer,
        currentEnergy: Math.min(5, casterPlayer.currentEnergy + effect.amount),
      }
      return updatePlayerInState(state, context.casterSide, newCasterPlayer, [
        `[효과] 에너지 +${effect.amount} 환급`,
      ])
    }

    default:
      return state
  }
}

// ────────────────────────────────────────────────────
// 효과 타입별 처리 함수
// ────────────────────────────────────────────────────

function applyDamageEffect(
  effect: Extract<CardEffect, { type: 'damage' }>,
  state: GameState,
  context: EffectContext,
  _casterPlayer: PlayerState,
  defenderPlayer: PlayerState,
): GameState {
  const dmg = effect.value
  const logEntries: string[] = []

  switch (effect.target) {
    case 'enemy_hero': {
      const newHp = Math.max(0, defenderPlayer.currentHp - dmg)
      logEntries.push(`[효과] 적 영웅 ${dmg} 피해`)
      return updatePlayerInState(
        state,
        context.casterSide === 'player' ? 'ai' : 'player',
        { ...defenderPlayer, currentHp: newHp },
        logEntries,
      )
    }

    case 'enemy_unit': {
      if (context.targetUnitIdx === undefined) return state
      const target = defenderPlayer.field[context.targetUnitIdx]
      if (!target) return state
      const newField = [...defenderPlayer.field]
      const newHp = target.currentHealth - dmg
      if (newHp <= 0) {
        newField[context.targetUnitIdx] = null
        defenderPlayer.graveyard.push(target.card)
        logEntries.push(`[효과] ${target.card.name} 처치 (${dmg} 피해)`)
      } else {
        newField[context.targetUnitIdx] = { ...target, currentHealth: newHp }
        logEntries.push(`[효과] ${target.card.name} ${dmg} 피해`)
      }
      return updatePlayerInState(
        state,
        context.casterSide === 'player' ? 'ai' : 'player',
        { ...defenderPlayer, field: newField, graveyard: [...defenderPlayer.graveyard] },
        logEntries,
      )
    }

    case 'all_enemies': {
      const newField = defenderPlayer.field.map((unit): FieldUnit | null => {
        if (!unit) return null
        const newHp = unit.currentHealth - dmg
        if (newHp <= 0) {
          defenderPlayer.graveyard.push(unit.card)
          return null
        }
        return { ...unit, currentHealth: newHp }
      })
      logEntries.push(`[효과] 적 전체 ${dmg} 피해`)
      return updatePlayerInState(
        state,
        context.casterSide === 'player' ? 'ai' : 'player',
        { ...defenderPlayer, field: newField, graveyard: [...defenderPlayer.graveyard] },
        logEntries,
      )
    }

    case 'adjacent_enemies': {
      if (context.targetUnitIdx === undefined) return state
      const adjacentIdxs = [context.targetUnitIdx - 1, context.targetUnitIdx + 1].filter(
        i => i >= 0 && i < FIELD_SLOTS && defenderPlayer.field[i] !== null,
      )
      if (adjacentIdxs.length === 0) return state
      const newField = [...defenderPlayer.field]
      for (const idx of adjacentIdxs) {
        const unit = newField[idx]
        if (!unit) continue
        const newHp = unit.currentHealth - dmg
        if (newHp <= 0) {
          defenderPlayer.graveyard.push(unit.card)
          newField[idx] = null
        } else {
          newField[idx] = { ...unit, currentHealth: newHp }
        }
      }
      logEntries.push(`[효과] 인접 적 ${adjacentIdxs.length}개에 ${dmg} 피해`)
      return updatePlayerInState(
        state,
        context.casterSide === 'player' ? 'ai' : 'player',
        { ...defenderPlayer, field: newField, graveyard: [...defenderPlayer.graveyard] },
        logEntries,
      )
    }

    default:
      return state
  }
}

function applyHealEffect(
  effect: Extract<CardEffect, { type: 'heal' }>,
  state: GameState,
  context: EffectContext,
  casterPlayer: PlayerState,
  _defenderPlayer: PlayerState,
): GameState {
  const amount = effect.value

  switch (effect.target) {
    case 'self_hero': {
      const newHp = Math.min(HERO_MAX_HP, casterPlayer.currentHp + amount)
      return updatePlayerInState(
        state,
        context.casterSide,
        { ...casterPlayer, currentHp: newHp },
        [`[효과] 영웅 HP +${amount} 회복`],
      )
    }

    default:
      return state
  }
}

function applyBuffEffect(
  buffType: 'atk' | 'hp',
  value: number,
  target: EffectTarget,
  state: GameState,
  context: EffectContext,
  casterPlayer: PlayerState,
): GameState {
  const logEntries: string[] = []

  switch (target) {
    case 'self_unit': {
      if (context.casterSlot === undefined) return state
      const unit = casterPlayer.field[context.casterSlot]
      if (!unit) return state
      const newField = [...casterPlayer.field]
      if (buffType === 'atk') {
        newField[context.casterSlot] = { ...unit, currentAttack: unit.currentAttack + value }
        logEntries.push(`[효과] ${unit.card.name} 공격력 +${value}`)
      } else {
        newField[context.casterSlot] = { ...unit, currentHealth: unit.currentHealth + value }
        logEntries.push(`[효과] ${unit.card.name} 체력 +${value}`)
      }
      return updatePlayerInState(state, context.casterSide, { ...casterPlayer, field: newField }, logEntries)
    }

    case 'enemy_unit': {
      // 디버프 (음수 value)용
      const defSide = context.casterSide === 'player' ? 'ai' : 'player'
      const defPlayer = defSide === 'player' ? state.player : state.ai
      if (context.targetUnitIdx === undefined) return state
      const unit = defPlayer.field[context.targetUnitIdx]
      if (!unit) return state
      const newField = [...defPlayer.field]
      if (buffType === 'atk') {
        newField[context.targetUnitIdx] = { ...unit, currentAttack: Math.max(0, unit.currentAttack + value) }
        logEntries.push(`[효과] ${unit.card.name} 공격력 ${value > 0 ? '+' : ''}${value}`)
      } else {
        const newHp = unit.currentHealth + value
        if (newHp <= 0) {
          defPlayer.graveyard.push(unit.card)
          newField[context.targetUnitIdx] = null
        } else {
          newField[context.targetUnitIdx] = { ...unit, currentHealth: newHp }
        }
        logEntries.push(`[효과] ${unit.card.name} 체력 ${value > 0 ? '+' : ''}${value}`)
      }
      return updatePlayerInState(state, defSide, { ...defPlayer, field: newField, graveyard: [...defPlayer.graveyard] }, logEntries)
    }

    case 'all_friendly': {
      const newField = casterPlayer.field.map((unit): FieldUnit | null => {
        if (!unit) return null
        if (buffType === 'atk') return { ...unit, currentAttack: unit.currentAttack + value }
        return { ...unit, currentHealth: unit.currentHealth + value }
      })
      logEntries.push(`[효과] 내 전체 유닛 ${buffType === 'atk' ? '공격력' : '체력'} +${value}`)
      return updatePlayerInState(state, context.casterSide, { ...casterPlayer, field: newField }, logEntries)
    }

    default:
      return state
  }
}

function applyAddKeywordEffect(
  keyword: Keyword,
  target: EffectTarget,
  state: GameState,
  context: EffectContext,
  casterPlayer: PlayerState,
): GameState {
  const logEntries: string[] = []

  switch (target) {
    case 'self_unit': {
      if (context.casterSlot === undefined) return state
      const unit = casterPlayer.field[context.casterSlot]
      if (!unit) return state
      if (unit.temporaryKeywords.includes(keyword)) return state
      const newField = [...casterPlayer.field]
      newField[context.casterSlot] = {
        ...unit,
        temporaryKeywords: [...unit.temporaryKeywords, keyword],
      }
      logEntries.push(`[효과] ${unit.card.name}에 ${keyword} 부여`)
      return updatePlayerInState(state, context.casterSide, { ...casterPlayer, field: newField }, logEntries)
    }

    case 'all_friendly': {
      const newField = casterPlayer.field.map((unit): FieldUnit | null => {
        if (!unit) return null
        if (unit.temporaryKeywords.includes(keyword)) return unit
        return { ...unit, temporaryKeywords: [...unit.temporaryKeywords, keyword] }
      })
      logEntries.push(`[효과] 내 전체 유닛에 ${keyword} 부여`)
      return updatePlayerInState(state, context.casterSide, { ...casterPlayer, field: newField }, logEntries)
    }

    default:
      return state
  }
}

function applySummonEffect(
  effect: Extract<CardEffect, { type: 'summon' }>,
  state: GameState,
  context: EffectContext,
  casterPlayer: PlayerState,
): GameState {
  // 빈 슬롯 찾기
  const emptySlot = casterPlayer.field.findIndex(u => u === null)
  if (emptySlot === -1) {
    return {
      ...state,
      log: [...state.log, '[효과] 필드 가득 참 — 소환 불가'],
    }
  }

  // 임시 유닛 카드 생성 (소환 효과로 생성된 토큰)
  const tokenCard: import('@/types/cards').SoldierCard = {
    id: `token_${Date.now()}`,
    name: '토큰',
    cost: 0,
    element: effect.element ?? null,
    rarity: 'common',
    cardType: 'soldier',
    attack: effect.attack,
    maxHealth: effect.health,
    keywords: (effect.keywords ?? []) as Keyword[],
    flavorText: '',
  }

  const newUnit: FieldUnit = {
    card: tokenCard,
    currentHealth: effect.health,
    currentAttack: effect.attack,
    canAttack: (effect.keywords ?? []).includes('rush'),
    frozen: false,
    rebornUsed: false,
    summonedOnTurn: 0,
    temporaryKeywords: [],
  }

  const newField = [...casterPlayer.field]
  newField[emptySlot] = newUnit

  return updatePlayerInState(
    state,
    context.casterSide,
    { ...casterPlayer, field: newField },
    [`[효과] ${effect.attack}/${effect.health} 토큰 소환`],
  )
}

// ────────────────────────────────────────────────────
// effectText 파서 — 텍스트 → CardEffect[] 변환
// ────────────────────────────────────────────────────

/**
 * 카드의 effectText/battlecry 문자열을 CardEffect[] 배열로 파싱
 *
 * 지원 패턴 (추가 패턴은 여기에 확장):
 * - "적 유닛 or 영웅에 N 피해"
 * - "적 필드 모든 유닛에 N 피해"
 * - "내 영웅 HP N 회복" / "영웅 HP +N 회복"
 * - "카드 N드로우" / "소환시 카드 N드로우"
 * - "내 유닛 1개 +N/0" (공격력 버프)
 * - "내 유닛 1개에 +0/+N" (체력 버프)
 * - "N/N 도발 유닛 소환"
 * - "주변 유닛에도 N 피해" (인접 피해, 단독 사용 불가 — 앞 효과와 세트)
 */
export function parseEffectText(text: string | undefined): CardEffect[] {
  if (!text) return []

  const effects: CardEffect[] = []
  const lower = text.toLowerCase()

  // 1. 적 유닛 or 영웅에 N 피해 (attack 주문용)
  const heroOrUnitMatch = lower.match(/적\s*유닛\s*or\s*영웅에\s*(\d+)\s*피해/)
  if (heroOrUnitMatch) {
    // or 타겟 — 컨텍스트에서 targetUnitIdx가 있으면 유닛, 없으면 영웅
    effects.push({ type: 'damage', target: 'enemy_unit', value: parseInt(heroOrUnitMatch[1]) })
  }

  // 2. 적 필드 모든 유닛에 N 피해
  const allEnemiesMatch = lower.match(/적\s*필드\s*모든\s*유닛에\s*(\d+)\s*피해/)
  if (allEnemiesMatch) {
    effects.push({ type: 'damage', target: 'all_enemies', value: parseInt(allEnemiesMatch[1]) })
  }

  // 3. 적 유닛 1개에 N 피해 (단일 타겟)
  const singleUnitDmgMatch = lower.match(/적\s*유닛\s*1개에\s*(\d+)\s*피해/)
  if (singleUnitDmgMatch) {
    effects.push({ type: 'damage', target: 'enemy_unit', value: parseInt(singleUnitDmgMatch[1]) })
    // 주변 유닛 추가 피해 체크
    const adjacentMatch = text.match(/주변\s*유닛에도\s*(\d+)\s*피해/)
    if (adjacentMatch) {
      effects.push({ type: 'damage', target: 'adjacent_enemies', value: parseInt(adjacentMatch[1]) })
    }
  }

  // 4. 영웅 HP 회복
  const healMatch = lower.match(/(?:내\s*영웅\s*hp|영웅\s*hp)\s*\+?(\d+)\s*회복/)
    || lower.match(/소환시\s*(?:내\s*)?영웅\s*hp\s*(\d+)\s*회복/)
  if (healMatch) {
    effects.push({ type: 'heal', target: 'self_hero', value: parseInt(healMatch[1]) })
  }

  // 5. 카드 드로우
  const drawMatch = lower.match(/(?:소환시\s*)?카드\s*(\d+)드로우/)
    || lower.match(/카드\s*(\d+)\s*장\s*드로우/)
  if (drawMatch) {
    effects.push({ type: 'draw', count: parseInt(drawMatch[1]) })
  }

  // 6. 내 유닛 공격력 버프 (+N/0)
  const atkBuffMatch = text.match(/내\s*유닛\s*1개\s*\+(\d+)\/0/)
  if (atkBuffMatch) {
    effects.push({ type: 'buff_atk', target: 'self_unit', value: parseInt(atkBuffMatch[1]) })
    // 돌진 부여 체크
    if (lower.includes('돌진')) {
      effects.push({ type: 'add_keyword', target: 'self_unit', keyword: 'rush' })
    }
  }

  // 7. 내 유닛 체력 버프 (+0/+N 또는 체력 +N)
  const hpBuffMatch = text.match(/내\s*유닛\s*1개에\s*\+0\/\+(\d+)/)
  if (hpBuffMatch) {
    effects.push({ type: 'buff_hp', target: 'self_unit', value: parseInt(hpBuffMatch[1]) })
    // 도발 부여 체크
    if (lower.includes('도발')) {
      effects.push({ type: 'add_keyword', target: 'self_unit', keyword: 'taunt' })
    }
  }

  // 8. 내 필드 모든 유닛 체력 버프
  const allHpBuffMatch = text.match(/내\s*필드\s*모든\s*유닛\s*체력\s*\+(\d+)/)
  if (allHpBuffMatch) {
    effects.push({ type: 'buff_hp', target: 'all_friendly', value: parseInt(allHpBuffMatch[1]) })
  }

  // 9. 도발 유닛 소환 (N/M)
  const summonMatch = text.match(/(\d+)\/(\d+)\s*도발\s*유닛\s*소환/)
  if (summonMatch) {
    effects.push({
      type: 'summon',
      attack: parseInt(summonMatch[1]),
      health: parseInt(summonMatch[2]),
      keywords: ['taunt'],
    })
  }

  return effects
}

// ────────────────────────────────────────────────────
// 카드 effectText → GameState 직접 적용 (편의 함수)
// ────────────────────────────────────────────────────

/**
 * 카드의 effectText 문자열을 파싱하여 GameState에 즉시 적용
 * 주문 카드 사용 시 편의 래퍼
 */
export function applyCardEffectText(
  effectText: string,
  state: GameState,
  context: EffectContext,
): GameState {
  const effects = parseEffectText(effectText)
  if (effects.length === 0) return state
  return applyEffects(effects, state, context)
}

// ────────────────────────────────────────────────────
// 내부 헬퍼
// ────────────────────────────────────────────────────

function updatePlayerInState(
  state: GameState,
  side: 'player' | 'ai',
  updatedPlayer: PlayerState,
  logEntries: string[],
): GameState {
  if (side === 'player') {
    return {
      ...state,
      player: updatedPlayer,
      log: [...state.log, ...logEntries],
    }
  }
  return {
    ...state,
    ai: updatedPlayer,
    log: [...state.log, ...logEntries],
  }
}
