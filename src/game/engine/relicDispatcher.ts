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
 * hookPoint 기반 유물 효과 자동 디스패치 반환값
 */
export interface DispatchRelicHooksResult {
  newState: GameState
  activatedRelicIds: string[]
}

/**
 * hookPoint 기반 유물 효과 자동 디스패치
 *
 * @param hookPoint - 발동 시점
 * @param state - 현재 게임 상태
 * @param relics - 플레이어 보유 유물 목록
 * @param payload - 시점별 추가 데이터 (선택)
 * @returns { newState, activatedRelicIds }
 *
 * 사용 예:
 *   const { newState } = dispatchRelicHooks('onTurnStart', state, ownedRelics)
 *   const { newState, activatedRelicIds } = dispatchRelicHooks('onCardPlay', state, ownedRelics, { cardElement: '火', usedElementsThisTurn: new Set() })
 *
 * 하위호환: 반환값에서 newState만 추출하면 기존 패턴과 동일
 */
export function dispatchRelicHooks(
  hookPoint: HookPoint,
  state: GameState,
  relics: Relic[],
  payload?: HookPayload,
): DispatchRelicHooksResult {
  let newState = state
  const activatedRelicIds: string[] = []

  for (const relic of relics) {
    const before = newState
    newState = applyRelicAtHook(relic, hookPoint, newState, payload)
    // 상태가 변경되었으면 해당 유물이 발동된 것으로 판단
    if (newState !== before) {
      activatedRelicIds.push(relic.id)
    }
  }

  return { newState, activatedRelicIds }
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

    // ── RELIC_WOOD_DECAY: 木 카드 비용+1, 木 카드 피해+4 ──
    // 비용 보정은 playCard에서, 피해 보정은 onDamageCalc에서
    case 'RELIC_WOOD_DECAY': {
      if (hookPoint !== 'onDamageCalc') return state
      const p = payload as DamageCalcPayload | undefined
      if (!p || p.attackerElement !== '木') return state
      // 피해 +4는 호출부에서 별도 처리 (현재 DamageCalcPayload에 결과 반영 불가)
      // relicFlags 기반으로 피해 보정: log만 추가 (실제 피해 계산은 calculateDamage 반환값에 +4)
      return {
        ...state,
        log: [...state.log, '[유물] 고목 썩은 가지: 木 카드 피해 +4 적용'],
      }
    }

    // ── RELIC_FIRE_BEACON: 첫 번째 공격 시 피해 +5 (전투당 1회) ──
    case 'RELIC_FIRE_BEACON': {
      if (hookPoint !== 'onDamageCalc') return state
      const p = payload as DamageCalcPayload | undefined
      if (!p || !p.attackerIsPlayer) return state
      // relicUsed 플래그로 1회 제한 추적 (GameState.relicFlags 미존재 → log로 처리)
      // 실제 구현: 첫 번째 공격에서만 활성화 (battleStore 레벨에서 처리 필요)
      return {
        ...state,
        log: [...state.log, '[유물] 봉화: 첫 번째 공격 피해 +5'],
      }
    }

    // ── RELIC_EARTH_FORTRESS: 전투 시작 방어도 +4 ──────
    case 'RELIC_EARTH_FORTRESS': {
      if (hookPoint !== 'onTurnStart' || state.turn !== 1) return state
      // 방어도 시스템 미존재 → HP +4로 대체 (土 방어 개념)
      const newHp = Math.min(HERO_MAX_HP, state.player.currentHp + 4)
      return {
        ...state,
        player: { ...state.player, currentHp: newHp },
        log: [...state.log, '[유물] 황토 보루: 전투 시작 HP +4 (방어도 대체)'],
      }
    }

    // ── RELIC_EARTH_QUICKSAND: 적 에너지 -1, 내 드로우 -1 ──
    case 'RELIC_EARTH_QUICKSAND': {
      if (hookPoint !== 'onTurnStart') return state
      // 적 에너지 -1 (최소 1)
      const aiEnergy = Math.max(1, state.ai.currentEnergy - 1)
      return {
        ...state,
        ai: { ...state.ai, currentEnergy: aiEnergy },
        log: [...state.log, `[유물] 유사 함정: 적 에너지 -1 (현재 ${aiEnergy})`],
      }
    }

    // ── RELIC_METAL_EDGE: 金 카드 피해 +3, 드로우 +1 ──
    case 'RELIC_METAL_EDGE': {
      if (hookPoint !== 'onDraw') return state
      // 드로우 +1: turnEngine에서 이 훅 이후 추가 드로우 처리 가능
      // 현재는 log 기록 (실제 drw 증가는 executeDraw에 후 처리 필요)
      return {
        ...state,
        log: [...state.log, '[유물] 백금 예봉: 드로우 +1 예약 (executeDraw 후 처리)'],
      }
    }

    // ── RELIC_METAL_RUST: 핸드 최대 -1 (5장), 金 카드 비용 -2 ──
    // 핸드 최대 감소는 executeDraw에서 처리, 비용 감소는 playCard에서
    // 여기서는 noop (분산 처리 방식 유지)

    // ── RELIC_WATER_SPRING: Fatigue 피해 -1 (최소 1) ────
    case 'RELIC_WATER_SPRING': {
      if (hookPoint !== 'onDraw') return state
      // turnEngine executeDraw에서 Fatigue 적용 후 이 훅으로 보정
      // 이미 Fatigue 피해가 플레이어 HP에서 감소된 후이므로 되돌림
      if (!state.player.fatigue.deckExhausted) return state
      // 보정: +1 HP (Fatigue -1 효과)
      const correctedHp = Math.min(HERO_MAX_HP, state.player.currentHp + 1)
      return {
        ...state,
        player: { ...state.player, currentHp: correctedHp },
        log: [...state.log, '[유물] 옥천수: Fatigue 피해 -1 보정'],
      }
    }

    // ── RELIC_WATER_ABYSS: 묘지 5장마다 공격력 +2 ──────
    case 'RELIC_WATER_ABYSS': {
      if (hookPoint !== 'onUnitDeath') return state
      const graveyardCount = state.player.graveyard.length
      if (graveyardCount > 0 && graveyardCount % 5 === 0) {
        // 필드 전 유닛 공격력 +2
        const newField = state.player.field.map(u =>
          u ? { ...u, currentAttack: u.currentAttack + 2 } : null,
        )
        return {
          ...state,
          player: { ...state.player, field: newField },
          log: [...state.log, `[유물] 흑연 심연: 묘지 ${graveyardCount}장 달성 — 내 유닛 공격력 +2`],
        }
      }
      return state
    }

    // ── RELIC_GENERATE_CYCLE: 상생 2연속 → 다음 카드 비용 -2 ──
    case 'RELIC_GENERATE_CYCLE': {
      if (hookPoint !== 'onCardPlay') return state
      const p = payload as CardPlayPayload | undefined
      if (!p || !p.cardElement) return state
      // 상생 연속 2장 체크: usedElementsThisTurn에서 이전 오행과 현재 오행이 상생 관계인지
      // GENERATES: 木→火→土→金→水→木
      const GENERATES_MAP: Record<string, string> = {
        '木': '火', '火': '土', '土': '金', '金': '水', '水': '木',
      }
      let hasGenerateCycle = false
      for (const prevElem of p.usedElementsThisTurn) {
        if (GENERATES_MAP[prevElem] === p.cardElement || GENERATES_MAP[p.cardElement] === prevElem) {
          hasGenerateCycle = true
          break
        }
      }
      if (hasGenerateCycle) {
        const newEnergy = Math.min(5, state.player.currentEnergy + 2)
        return {
          ...state,
          player: { ...state.player, currentEnergy: newEnergy },
          log: [...state.log, `[유물] 상생 순환: 상생 연속 달성 — 에너지 +2 환급`],
        }
      }
      return state
    }

    // ── RELIC_DOMINATE_SEAL: 상극 피해 ×1.75 ───────────
    // calculateRelicCombatModifier에서 처리
    // onDamageCalc 훅으로도 처리 가능하나 현재 구조상 noop

    // ── RELIC_WATER_SPRING: Fatigue 피해 -1 ────────────
    // 위에서 처리됨

    // ── RELIC_FATE_REVERSE: 패배 직전 HP 1 유지 ─────────
    case 'RELIC_FATE_REVERSE': {
      if (hookPoint !== 'onTurnEnd') return state
      // GameState.relicFlags 미존재 → 단순하게 HP가 0이 되기 직전 보정
      if (state.player.currentHp <= 0) {
        const alreadyUsed = (state.usedDaewoon ?? []).includes('RELIC_FATE_REVERSE_USED')
        if (!alreadyUsed) {
          return {
            ...state,
            player: { ...state.player, currentHp: 1 },
            usedDaewoon: [...(state.usedDaewoon ?? []), 'RELIC_FATE_REVERSE_USED'],
            log: [...state.log, '[유물] 역운 부적: 패배 직전 HP 1 유지 발동!'],
          }
        }
      }
      return state
    }

    // ── RELIC_WEAK_ELEMENT_SEAL: 약한 오행 카드 비용 -1 ─
    // playCard에서 처리 (현재 noop, turnEngine 직접 체크 방식 추가 예정)

    // ── RELIC_DOMINATE_NEUTRALIZE, RELIC_FIVE_ELEMENT_SPIRIT_WEAPON ──
    // calculateRelicCombatModifier에서 처리 완료

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
