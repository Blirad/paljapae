/**
 * AI 플레이어 로직 — M3 구현
 * 마스터플랜 §7 AI 설계: novice / normal 난이도
 */

import type { GameState, AIAction } from '@/types/game'
import { FIELD_SLOTS } from '@/types/game'
import type { FieldUnit, SoldierCard } from '@/types/cards'
import { getCombatModifier } from '@/game/engine/elementalCombat'

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
 * 1. 카드 소환 (에너지가 허용하는 한)
 * 2. 공격 (공격 가능한 유닛 모두)
 * 3. 턴 종료
 */
export function decideAITurn(state: GameState): AIAction[] {
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
