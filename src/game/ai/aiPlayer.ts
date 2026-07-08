/**
 * AI 플레이어 로직 — Phase 3-3
 * 난이도 계층화: novice / normal / expert
 *
 * novice: 랜덤 카드 선택, 랜덤 공격 타겟
 * normal: 비용 높은 것 우선 (greedy), 처치 가능 > 상극 우선
 * expert: 오행 상성 고려 + 밸류 평가 + 대운 카드 활용
 */

import type { GameState, AIAction, AIDifficulty } from '@/types/game'
import { FIELD_SLOTS } from '@/types/game'
import type { FieldUnit, SoldierCard } from '@/types/cards'
import { getCombatModifier } from '@/game/engine/elementalCombat'
import { DAEWOON_CARD_IDS } from '@/data/daewoonCards'

// ────────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────────

function hasKeyword(unit: FieldUnit, kw: string): boolean {
  return (
    unit.card.keywords.includes(kw as Parameters<typeof unit.card.keywords.includes>[0])
    || unit.temporaryKeywords.includes(kw as Parameters<typeof unit.temporaryKeywords.includes>[0])
  )
}

function firstEmptySlot(field: (FieldUnit | null)[]): number {
  return field.findIndex(s => s === null)
}

// ────────────────────────────────────────────────────
// AI 행동 결정 — AI 턴 전체를 행동 배열로 반환
// ────────────────────────────────────────────────────

/**
 * AI 상태에서 이번 턴 실행할 행동을 순서대로 결정
 * difficulty: 'novice' | 'normal' | 'expert'
 * 기본값 'normal' (하위호환 유지)
 */
export function decideAITurn(state: GameState, difficulty: AIDifficulty = 'normal'): AIAction[] {
  switch (difficulty) {
    case 'novice':
      return decideAINovice(state)
    case 'expert':
      return decideAIExpert(state)
    case 'normal':
    default:
      return decideAINormal(state)
  }
}

/**
 * novice AI: 랜덤 카드 선택, 랜덤 공격
 */
function decideAINovice(state: GameState): AIAction[] {
  const actions: AIAction[] = []
  let energy = state.ai.currentEnergy
  const hand = [...state.ai.hand]
  const field = [...state.ai.field] as (FieldUnit | null)[]

  // 랜덤 순서로 카드 플레이 시도
  const shuffled = hand
    .map((card, i) => ({ card, origIdx: i }))
    .filter(({ card }) => card.cost <= energy)
    .sort(() => Math.random() - 0.5)

  for (const { card, origIdx } of shuffled) {
    if (card.cost > energy) continue
    if (card.cardType === 'soldier') {
      const slot = firstEmptySlot(field)
      if (slot === -1) continue
      actions.push({ type: 'play_card', cardIndex: origIdx, targetIndex: slot })
      energy -= card.cost
      const soldierCard = card as SoldierCard
      field[slot] = {
        card: soldierCard,
        currentHealth: soldierCard.maxHealth,
        currentAttack: soldierCard.attack,
        canAttack: soldierCard.keywords.includes('rush'),
        frozen: false,
        rebornUsed: false,
        summonedOnTurn: state.turn,
        temporaryKeywords: [],
      }
    } else {
      // 주문 카드는 사용 안 함 (novice는 단순)
    }
  }

  // 랜덤 공격
  for (let i = 0; i < FIELD_SLOTS; i++) {
    const unit = field[i]
    if (!unit || !unit.canAttack || unit.frozen) continue

    // 타겟: 적 유닛 중 랜덤, 없으면 영웅
    const targets = state.player.field
      .map((u, idx) => ({ u, idx }))
      .filter(({ u }) => u !== null)

    if (targets.length === 0) {
      actions.push({ type: 'attack', cardIndex: i, targetIndex: -1 })
    } else {
      const randomTarget = targets[Math.floor(Math.random() * targets.length)]
      actions.push({ type: 'attack', cardIndex: i, targetIndex: randomTarget.idx })
    }
  }

  actions.push({ type: 'end_turn' })
  return actions
}

/**
 * normal AI: 기존 greedy 로직 (하위호환 유지)
 */
function decideAINormal(state: GameState): AIAction[] {
  const actions: AIAction[] = []

  // 현재 AI 상태를 시뮬레이션 (실제 state 변경 없이 계획만)
  let energy = state.ai.currentEnergy
  const hand = [...state.ai.hand]
  const field = [...state.ai.field] as (FieldUnit | null)[]

  // 1단계: 병사 카드 소환 — 비용 높은 것 우선 (greedy)
  const soldierEntries = hand
    .map((card, i) => ({ card, origIdx: i }))
    .filter(({ card }) => card.cardType === 'soldier' && card.cost <= energy)
    .sort((a, b) => b.card.cost - a.card.cost)

  for (const { card, origIdx } of soldierEntries) {
    const slot = firstEmptySlot(field)
    if (slot === -1) break
    if (card.cost > energy) continue

    const soldierCard = card as SoldierCard

    actions.push({ type: 'play_card', cardIndex: origIdx, targetIndex: slot })
    energy -= card.cost

    // 시뮬레이션: 슬롯 점유
    const fieldUnit: FieldUnit = {
      card: soldierCard,
      currentHealth: soldierCard.maxHealth,
      currentAttack: soldierCard.attack,
      canAttack: soldierCard.keywords.includes('rush'),
      frozen: false,
      rebornUsed: false,
      summonedOnTurn: state.turn,
      temporaryKeywords: [],
    }
    field[slot] = fieldUnit
  }

  // 주문 카드도 고려 (draw/summon 타입은 타겟 없이 즉시)
  const spellEntries = hand
    .map((card, i) => ({ card, origIdx: i }))
    .filter(({ card }) => card.cardType === 'spell' && card.cost <= energy)
  for (const { card, origIdx } of spellEntries) {
    if (card.cost > energy) continue
    actions.push({ type: 'play_card', cardIndex: origIdx })
    energy -= card.cost
  }

  // 2단계: 공격
  // 소환 시뮬레이션 결과 field를 기준으로 순회 (rush 유닛 포함)
  for (let i = 0; i < FIELD_SLOTS; i++) {
    const unit = field[i]
    if (!unit) continue
    if (!unit.canAttack) continue
    if (unit.frozen) continue

    // 관통이면 영웅 직접 공격
    if (hasKeyword(unit, 'pierce')) {
      actions.push({ type: 'attack', cardIndex: i, targetIndex: -1 }) // -1 = 영웅
      continue
    }

    // 도발 유닛 찾기
    const tauntIdx = state.player.field.findIndex(
      u => u !== null && hasKeyword(u, 'taunt'),
    )
    if (tauntIdx !== -1) {
      actions.push({ type: 'attack', cardIndex: i, targetIndex: tauntIdx })
      continue
    }

    // 최선 타겟 선택: 오행 상성 + 처치 가능 여부 기준
    const targets = state.player.field
      .map((u, idx) => ({ u, idx }))
      .filter(({ u }) => u !== null) as { u: FieldUnit; idx: number }[]

    if (targets.length === 0) {
      // 영웅 직접 공격
      actions.push({ type: 'attack', cardIndex: i, targetIndex: -1 })
    } else {
      // 처치 가능한 것 우선, 그 다음 상극 우선
      const killable = targets.filter(
        ({ u }) => u.currentHealth <= unit.currentAttack,
      )
      if (killable.length > 0) {
        // 처치 가능한 것 중 체력 가장 낮은 것
        killable.sort((a, b) => a.u.currentHealth - b.u.currentHealth)
        actions.push({ type: 'attack', cardIndex: i, targetIndex: killable[0].idx })
      } else {
        // 상극 상대 우선
        const dominated = targets.filter(
          ({ u }) => u.card.element !== null
            && getCombatModifier(unit.card.element, u.card.element) === 'dominate',
        )
        if (dominated.length > 0) {
          actions.push({ type: 'attack', cardIndex: i, targetIndex: dominated[0].idx })
        } else {
          // 체력 낮은 것 우선
          targets.sort((a, b) => a.u.currentHealth - b.u.currentHealth)
          actions.push({ type: 'attack', cardIndex: i, targetIndex: targets[0].idx })
        }
      }
    }
  }

  actions.push({ type: 'end_turn' })
  return actions
}

/**
 * expert AI: 오행 상성 고려 + 밸류 평가 + 대운 카드 활용
 *
 * 카드 밸류 = attack + maxHealth - cost (비용 대비 스탯)
 * 대운 카드: 적 HP가 낮으면 시운정지/운명반전 활용
 */
function decideAIExpert(state: GameState): AIAction[] {
  const actions: AIAction[] = []
  let energy = state.ai.currentEnergy
  const hand = [...state.ai.hand]
  const field = [...state.ai.field] as (FieldUnit | null)[]
  const usedDaewoon = state.usedDaewoon ?? []

  // 대운 카드 처리 (전투당 1회, 우선 고려)
  const daewoonEntries = hand
    .map((card, i) => ({ card, origIdx: i }))
    .filter(({ card }) => DAEWOON_CARD_IDS.has(card.id)
      && card.cost <= energy
      && !usedDaewoon.includes(card.id))

  for (const { card, origIdx } of daewoonEntries) {
    if (card.cost > energy) continue
    // 적 HP 낮으면 시운정지 우선 (마지막 일격 전 시간 확보)
    if (card.id === 'DAEWOON-03' && state.player.currentHp <= 8) {
      actions.push({ type: 'play_card', cardIndex: origIdx })
      energy -= card.cost
      break
    }
    // 운명반전: 현재 오행 상성이 불리할 때
    if (card.id === 'DAEWOON-04') {
      const aiElem = state.ai.hero.element
      const playerElem = state.player.hero.element
      if (getCombatModifier(playerElem, aiElem) === 'dominate') {
        actions.push({ type: 'play_card', cardIndex: origIdx })
        energy -= card.cost
        break
      }
    }
  }

  // 병사 카드: 밸류 높은 것 우선 (attack+maxHealth-cost 기준)
  const soldierEntries = hand
    .map((card, i) => ({ card, origIdx: i }))
    .filter(({ card }) => card.cardType === 'soldier' && card.cost <= energy)
    .sort((a, b) => {
      // 오행 상성 보너스: 플레이어 유닛 중 상극 가능하면 우선순위 +1
      const aBonus = state.player.field.some(
        u => u && getCombatModifier(a.card.element, u.card.element) === 'dominate',
      ) ? 1 : 0
      const bBonus = state.player.field.some(
        u => u && getCombatModifier(b.card.element, u.card.element) === 'dominate',
      ) ? 1 : 0
      const aCard = a.card as SoldierCard
      const bCard = b.card as SoldierCard
      const aValue = aCard.attack + aCard.maxHealth - aCard.cost + aBonus
      const bValue = bCard.attack + bCard.maxHealth - bCard.cost + bBonus
      return bValue - aValue
    })

  for (const { card, origIdx } of soldierEntries) {
    if (card.cost > energy) continue
    const slot = firstEmptySlot(field)
    if (slot === -1) break
    actions.push({ type: 'play_card', cardIndex: origIdx, targetIndex: slot })
    energy -= card.cost
    const soldierCard = card as SoldierCard
    field[slot] = {
      card: soldierCard,
      currentHealth: soldierCard.maxHealth,
      currentAttack: soldierCard.attack,
      canAttack: soldierCard.keywords.includes('rush'),
      frozen: false,
      rebornUsed: false,
      summonedOnTurn: state.turn,
      temporaryKeywords: [],
    }
  }

  // 주문 카드: 에너지 허용 시 사용 (대운 제외)
  const spellEntries = hand
    .map((card, i) => ({ card, origIdx: i }))
    .filter(({ card }) => card.cardType === 'spell' && card.cost <= energy
      && !DAEWOON_CARD_IDS.has(card.id))
  for (const { card, origIdx } of spellEntries) {
    if (card.cost > energy) continue
    actions.push({ type: 'play_card', cardIndex: origIdx })
    energy -= card.cost
  }

  // 공격: 오행 상성 최적화 + pierce/taunt 처리
  for (let i = 0; i < FIELD_SLOTS; i++) {
    const unit = field[i]
    if (!unit || !unit.canAttack || unit.frozen) continue

    if (hasKeyword(unit, 'pierce')) {
      actions.push({ type: 'attack', cardIndex: i, targetIndex: -1 })
      continue
    }

    const tauntIdx = state.player.field.findIndex(u => u !== null && hasKeyword(u, 'taunt'))
    if (tauntIdx !== -1) {
      actions.push({ type: 'attack', cardIndex: i, targetIndex: tauntIdx })
      continue
    }

    const targets = state.player.field
      .map((u, idx) => ({ u, idx }))
      .filter(({ u }) => u !== null) as { u: FieldUnit; idx: number }[]

    if (targets.length === 0) {
      actions.push({ type: 'attack', cardIndex: i, targetIndex: -1 })
    } else {
      // expert: 오행 상성으로 최대 피해 타겟 선택
      const scoredTargets = targets.map(t => {
        const canKill = t.u.currentHealth <= unit.currentAttack
        const isDominated = getCombatModifier(unit.card.element, t.u.card.element) === 'dominate'
        const score = (canKill ? 10 : 0) + (isDominated ? 5 : 0) - t.u.currentHealth * 0.1
        return { ...t, score }
      })
      scoredTargets.sort((a, b) => b.score - a.score)
      actions.push({ type: 'attack', cardIndex: i, targetIndex: scoredTargets[0].idx })
    }
  }

  actions.push({ type: 'end_turn' })
  return actions
}
