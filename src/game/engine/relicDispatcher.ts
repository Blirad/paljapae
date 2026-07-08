/**
 * 유물 효과 디스패처 — Phase 1-C + Phase 2 (1-3)
 * hookPoint 기반 유물 효과 자동 디스패치 시스템
 *
 * 기존: calculateRelicCombatModifier (Phase 1-C, 전투 배율 보정)
 * 신규: dispatchRelicHooks (hookPoint → GameState 변환 디스패처)
 *
 * 새로운 유물 추가 시 이 파일의 훅 핸들러만 수정하면 된다.
 */

import type { FiveElement } from '@/types/elements'
import type { Relic } from '@/types/relics'
import type { CombatModifier } from './elementalCombat'
import type { GameState } from '@/types/game'
import { HERO_MAX_HP } from '@/types/game'

// ────────────────────────────────────────────────────
// HookPoint 타입 정의
// ────────────────────────────────────────────────────

/**
 * 유물 효과 발동 시점
 * 새 시점이 필요하면 여기에 추가하고 핸들러를 등록한다
 */
export type HookPoint =
  | 'onCardPlay'    // 카드 플레이 직후
  | 'onUnitDeath'   // 유닛 사망 직후
  | 'onTurnStart'   // 턴 시작 시
  | 'onTurnEnd'     // 턴 종료 시
  | 'onDamageCalc'  // 데미지 계산 시점
  | 'onDraw'        // 드로우 페이즈

// ────────────────────────────────────────────────────
// 페이로드 타입
// ────────────────────────────────────────────────────

export interface CardPlayPayload {
  /** 플레이한 카드의 오행 */
  cardElement: FiveElement | null
  /** 이번 턴에 사용한 오행 집합 (콤보 계산용) */
  usedElementsThisTurn: Set<FiveElement>
}

export interface UnitDeathPayload {
  /** 사망한 유닛의 소유자 */
  owner: 'player' | 'ai'
}

export interface DamageCalcPayload {
  /** 기본 데미지 */
  baseDamage: number
  /** 공격자 오행 */
  attackerElement: FiveElement | null
  /** 방어자 오행 */
  defenderElement: FiveElement | null
  /** 공격자가 플레이어 측인지 */
  attackerIsPlayer: boolean
}

export type HookPayload =
  | CardPlayPayload
  | UnitDeathPayload
  | DamageCalcPayload
  | undefined

// ────────────────────────────────────────────────────
// 메인 디스패처
// ────────────────────────────────────────────────────

/**
 * hookPoint 기반 유물 효과 자동 디스패치
 *
 * @param hookPoint - 발동 시점
 * @param state - 현재 게임 상태
 * @param relics - 플레이어 보유 유물 목록
 * @param payload - 시점별 추가 데이터 (선택)
 * @returns 유물 효과 적용 후 GameState
 *
 * 사용 예:
 *   state = dispatchRelicHooks('onTurnStart', state, ownedRelics)
 *   state = dispatchRelicHooks('onCardPlay', state, ownedRelics, { cardElement: '火', usedElementsThisTurn: new Set() })
 */
export function dispatchRelicHooks(
  hookPoint: HookPoint,
  state: GameState,
  relics: Relic[],
  payload?: HookPayload,
): GameState {
  let newState = state

  for (const relic of relics) {
    newState = applyRelicAtHook(relic, hookPoint, newState, payload)
  }

  return newState
}

// ────────────────────────────────────────────────────
// 유물별 훅 핸들러
// ────────────────────────────────────────────────────

function applyRelicAtHook(
  relic: Relic,
  hookPoint: HookPoint,
  state: GameState,
  payload?: HookPayload,
): GameState {
  switch (relic.id) {

    // ── RELIC_HERB_POUCH: 전투 시작 HP +3 ─────────────
    // battle_start → onTurnStart(턴 1)로 매핑
    // battleStore.applyHerbPouch()가 이미 처리하므로 여기서는 pass

    // ── RELIC_HELL_TALISMAN: HP <= 5 시 공격력 +3 ──────
    // combat_attack → onDamageCalc로 매핑
    // turnEngine.executeCombatPhase()에서 직접 체크 중
    // dispatchRelicHooks('onDamageCalc') 경로로 통합 가능하나
    // 현재는 turnEngine 직접 체크를 유지하고 여기서는 noop

    // ── RELIC_JADE_BEAD: 드로우 +1 ────────────────────
    // draw_phase → onDraw로 매핑
    // turnEngine.executeDraw()에서 직접 체크 중
    // 여기서는 noop (중복 적용 방지)

    // ── RELIC_ELEMENT_SEAL: 동속성 카드 비용 -1 ────────
    // play_card → onCardPlay로 매핑
    // turnEngine.playCard()에서 직접 체크 중
    // 여기서는 noop (중복 적용 방지)

    // ── RELIC_WOOD_SPROUT: 木 카드 플레이 시 HP +1 ─────
    case 'RELIC_WOOD_SPROUT': {
      if (hookPoint !== 'onCardPlay') return state
      const p = payload as CardPlayPayload | undefined
      if (!p || p.cardElement !== '木') return state
      const newHp = Math.min(HERO_MAX_HP, state.player.currentHp + 1)
      return {
        ...state,
        player: { ...state.player, currentHp: newHp },
        log: [...state.log, '[유물] 청목 새싹: HP +1 회복'],
      }
    }

    // ── RELIC_FIRE_BACKFIRE: 火 카드 사용 시 자신 -1 ───
    case 'RELIC_FIRE_BACKFIRE': {
      if (hookPoint !== 'onCardPlay') return state
      const p = payload as CardPlayPayload | undefined
      if (!p || p.cardElement !== '火') return state
      const newHp = Math.max(0, state.player.currentHp - 1)
      return {
        ...state,
        player: { ...state.player, currentHp: newHp },
        log: [...state.log, '[유물] 역화 부적: 자신 1 피해'],
      }
    }

    // ── RELIC_TWIN_ELEMENT: 같은 오행 2연속 에너지 +1 ──
    case 'RELIC_TWIN_ELEMENT': {
      if (hookPoint !== 'onCardPlay') return state
      const p = payload as CardPlayPayload | undefined
      if (!p || !p.cardElement) return state
      // usedElementsThisTurn에 현재 카드 오행이 이미 있으면 연속 사용
      if (p.usedElementsThisTurn.has(p.cardElement)) {
        const newEnergy = Math.min(5, state.player.currentEnergy + 1)
        return {
          ...state,
          player: { ...state.player, currentEnergy: newEnergy },
          log: [...state.log, `[유물] 이원 조화: 에너지 +1 (${p.cardElement} 연속 사용)`],
        }
      }
      return state
    }

    // ── RELIC_CHAOS_PENTA: 3종 오행 사용 시 HP -2 ──────
    case 'RELIC_CHAOS_PENTA': {
      if (hookPoint !== 'onCardPlay') return state
      const p = payload as CardPlayPayload | undefined
      if (!p || !p.cardElement) return state
      // 현재 카드까지 포함한 오행 집합
      const elements = new Set([...p.usedElementsThisTurn, p.cardElement])
      if (elements.size >= 3) {
        const newHp = Math.max(0, state.player.currentHp - 2)
        return {
          ...state,
          player: { ...state.player, currentHp: newHp },
          log: [...state.log, `[유물] 오행 혼돈: HP -2 (${elements.size}종 오행 사용)`],
        }
      }
      return state
    }

    // ── RELIC_WATER_SPRING: Fatigue 피해 -1 ────────────
    // draw_phase → onDraw로 매핑
    // turnEngine.executeDraw()에서 Fatigue 피해 적용 후 이 훅으로 보정 가능
    // 현재는 noop (turnEngine 직접 체크 방식 유지)

    // ── RELIC_FATE_REVERSE: 패배 직전 HP 1 유지 ─────────
    // combat_attack → onDamageCalc / onTurnEnd 등 복합
    // 현재 구조에서는 checkGameResult 호출 전 HP 보정으로 구현 가능
    // 향후 확장용 플레이스홀더 등록
    case 'RELIC_FATE_REVERSE': {
      if (hookPoint !== 'onTurnEnd') return state
      // TODO: 런당 1회 플래그 필요 — 현재 GameState에 relicFlags 필드 없음
      // 이든 결정 후 GameState 확장 시 구현
      return state
    }

    default:
      return state
  }
}

// ────────────────────────────────────────────────────
// 기존 Phase 1-C: 전투 배율 보정 (하위호환 유지)
// ────────────────────────────────────────────────────

/**
 * 유물 기반 상성 배율 수정자 계산
 * @param relics - 플레이어 보유 유물 목록
 * @param modifier - 기본 상성 판정 ('dominate' | 'generate_defense' | 'neutral')
 * @param attackerElement - 공격자 오행
 * @param defenderElement - 방어자 오행
 * @param playerElement - 플레이어(주인) 오행 (약한 오행 판별용)
 * @param playerElementScore - 플레이어 오행 점수 (약한 오행 판별용)
 * @returns 수정된 배율 multiplier (1.0 = 무수정)
 */
export function calculateRelicCombatModifier(
  relics: Relic[],
  modifier: CombatModifier,
  attackerElement: FiveElement | null,
  _defenderElement: FiveElement | null,
  playerElement?: FiveElement,
  playerElementScore?: Record<FiveElement, number>,
): number {
  let multiplier = 1.0

  // Phase 1-C: 상극 중화 부적 (RELIC_DOMINATE_NEUTRALIZE)
  // 피상극 관계일 때 (generate_defense) 배율 0.75 → 0.9로 완화
  if (modifier === 'generate_defense') {
    const hasNeutralize = relics.some(r => r.id === 'RELIC_DOMINATE_NEUTRALIZE')
    if (hasNeutralize) {
      // 0.75 → 0.9로 개선 (damage / 0.75 * 0.9 = damage * 1.2)
      // 직접 배율로 반환: 0.9 / 0.75 = 1.2
      multiplier *= (0.9 / 0.75)
    }
  }

  // Phase 1-C: 신살 무기 (RELIC_FIVE_ELEMENT_SPIRIT_WEAPON)
  // 없는 오행에 공격 시 중립 처리 (0.75 페널티 면제)
  if (
    playerElement &&
    playerElementScore &&
    modifier === 'generate_defense' &&
    attackerElement === playerElement
  ) {
    const hasWeapon = relics.some(r => r.id === 'RELIC_FIVE_ELEMENT_SPIRIT_WEAPON')
    if (hasWeapon && playerElementScore[playerElement] === 0) {
      // 약한 오행 공격 시 neutral로 처리 (0.75 → 1.0)
      multiplier *= (1.0 / 0.75)
    }
  }

  return multiplier
}

/**
 * 약한 오행 (점수 0) 판별
 */
export function getWeakElements(
  elementScore: Record<FiveElement, number>,
): FiveElement[] {
  return (Object.entries(elementScore) as [FiveElement, number][])
    .filter(([_, score]) => score === 0)
    .map(([elem]) => elem)
}
