/**
 * 적 Intent 실행 엔진
 *
 * Phase 2 — EnemyDef + EnemyMove 기반 적 행동 처리
 *
 * 의존성:
 *   - stsTypes.ts       : BattleState, EnemyState, EnemyDef, EnemyMove, BattleAction
 *   - buffEngine.ts     : applyBuff, getDealModifier, getBuffValue
 *   - stsEngine.ts      : dealDamage, applyBlock
 *   - elementalCombat.ts: calculateDamage (오행 상성)
 */

import type { BattleState, EnemyState, EnemyDef, EnemyMove, BattleAction, BattleLogEntry } from '@/types/stsTypes'
import type { FiveElement } from '@/types/elements'
import { applyBuff, getDealModifier, getBuffValue } from './buffEngine'
import { dealDamage, applyBlock } from './stsEngine'
import { calculateDamage } from './elementalCombat'

// ─── 로그 헬퍼 ────────────────────────────────────────

let _logIdCounter = 0

function makeLogId(): string {
  return `enemy_log_${Date.now()}_${_logIdCounter++}`
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

// ─── EnemyDef → 초기 EnemyState 생성 ─────────────────

/**
 * EnemyDef로부터 초기 EnemyState를 생성한다.
 *
 * - hp = maxHp
 * - block = 0
 * - buffs = []
 * - moveIndex = 0
 * - currentIntent = 첫 번째 move의 intent
 */
export function createEnemyState(def: EnemyDef): EnemyState {
  if (def.moves.length === 0) {
    throw new Error(`EnemyDef "${def.id}"에 moves가 없다`)
  }
  return {
    def,
    hp: def.maxHp,
    maxHp: def.maxHp,
    block: 0,
    buffs: [],
    moveIndex: 0,
    currentIntent: def.moves[0].intent,
  }
}

// ─── 다음 Intent 계산 ────────────────────────────────

/**
 * 현재 moveIndex 기반으로 다음 실행할 EnemyMove를 반환한다.
 *
 * sequential : moves[moveIndex % moves.length]
 * random_weighted : weights 배열 기반 가중치 랜덤 선택
 *
 * 주의: moveIndex 증가는 stsEngine.endEnemyTurn이 담당한다.
 */
export function computeNextIntent(enemy: EnemyState, def: EnemyDef): EnemyMove {
  const moves = def.moves

  if (moves.length === 0) {
    throw new Error(`EnemyDef "${def.id}"에 moves가 없다`)
  }

  if (def.patternType === 'sequential') {
    return moves[enemy.moveIndex % moves.length]
  }

  // random_weighted
  const weights = def.weights ?? moves.map(() => 1)
  const total = weights.reduce((acc, w) => acc + w, 0)

  if (total <= 0) {
    return moves[0]
  }

  let rand = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i]
    if (rand <= 0) {
      return moves[i]
    }
  }

  // fallback — 부동소수점 오차 대비
  return moves[moves.length - 1]
}

// ─── BattleAction 배열 적용 ──────────────────────────

/**
 * BattleAction 배열을 순차적으로 BattleState에 적용한다.
 *
 * 오행 상성 연결 (핵심):
 *   적이 플레이어에게 damage 액션을 실행할 때:
 *   1. 적 strength 버프 + weak 수정자 적용
 *   2. calculateDamage(base, enemy.element, player.element, 1.0) 호출
 *      → 火 적 vs 金 플레이어: 火克金 → ×1.5
 *      → 木 적 vs 水 플레이어: 水克木 — 방어자(水)가 공격자(木)를 생성? 아니다.
 *        GENERATES: 水→木이므로 水가 木을 생성 = isDefenderGeneratingAttacker(木, 水) = GENERATES[水]===木 = true
 *        → generate_defense = ×0.75
 *   3. 취약(vulnerable) 수정자는 dealDamage 내부에서 추가 적용
 */
export function applyBattleActions(
  state: BattleState,
  actions: BattleAction[],
): BattleState {
  let s = state

  for (const action of actions) {
    if (s.phase === 'victory' || s.phase === 'defeat') break

    switch (action.type) {
      case 'damage': {
        if (action.target === 'player') {
          // 적 → 플레이어 공격: 오행 상성 사전 계산 후 dealDamage 호출
          const enemy = s.enemy
          const enemyElement: FiveElement | null =
            enemy.def.element === 'neutral' ? null : (enemy.def.element as FiveElement)
          const playerElement: FiveElement = s.player.element

          // 약화(weak) 수정자: 적에게 weak 버프가 있으면 딜 감소
          const dealMod = getDealModifier(enemy)
          // 강화(strength) 버프: 적 공격력 +N
          const strengthBonus = getBuffValue(enemy, 'strength')
          const adjustedBase = Math.floor((action.amount + strengthBonus) * dealMod)

          // 오행 상성 계산 (취약은 dealDamage 내부에서 추가 적용)
          const elementalAmount = calculateDamage(adjustedBase, enemyElement, playerElement, 1.0)

          // dealDamage(state, 'player', amount) — 내부에서 취약 수정자 추가 반영
          s = dealDamage(s, 'player', elementalAmount)
        } else {
          // 플레이어 → 적 (드문 케이스)
          s = dealDamage(s, 'enemy', action.amount, action.element)
        }
        break
      }

      case 'block': {
        const blockTarget = action.target === 'enemy' ? 'enemy' : 'player'
        s = applyBlock(s, blockTarget, action.amount)
        break
      }

      case 'heal': {
        if (action.target === 'player') {
          const player = s.player
          const newHp = Math.min(player.maxHp, player.hp + action.amount)
          s = addLog(
            { ...s, player: { ...player, hp: newHp } },
            `플레이어 HP 회복 +${action.amount}`,
            'heal',
          )
        } else {
          const enemy = s.enemy
          const newHp = Math.min(enemy.maxHp, enemy.hp + action.amount)
          s = addLog(
            { ...s, enemy: { ...enemy, hp: newHp } },
            `적 HP 회복 +${action.amount}`,
            'heal',
          )
        }
        break
      }

      case 'applyBuff': {
        if (action.target === 'player') {
          const newPlayer = applyBuff(
            s.player,
            action.buffId,
            action.amount,
            action.duration,
          ) as typeof s.player
          s = addLog(
            { ...s, player: newPlayer },
            `플레이어 상태이상: ${action.buffId} +${action.amount}`,
            'debuff',
          )
        } else {
          const newEnemy = applyBuff(
            s.enemy,
            action.buffId,
            action.amount,
            action.duration,
          ) as typeof s.enemy
          s = addLog(
            { ...s, enemy: newEnemy },
            `적 버프: ${action.buffId} +${action.amount}`,
            'buff',
          )
        }
        break
      }

      case 'removeBlock': {
        if (action.target === 'player') {
          s = { ...s, player: { ...s.player, block: 0 } }
        } else {
          s = { ...s, enemy: { ...s.enemy, block: 0 } }
        }
        break
      }

      // draw / gainEnergy / exhaust / selfDamage — 적 턴에서는 미사용
      default:
        break
    }
  }

  return s
}

// ─── 적 턴 실행 ──────────────────────────────────────

/**
 * 현재 적의 moveIndex에 해당하는 EnemyMove를 실행한다.
 *
 * 실행 순서:
 * 1. moveIndex % moves.length 로 현재 move 선택
 * 2. move.execute({ enemy, player }) 로 BattleAction[] 생성
 * 3. applyBattleActions() 로 순차 적용
 *
 * @param state     현재 BattleState (phase === 'enemyTurn' 권장)
 * @param enemyDefs 전체 EnemyDef 목록 (현재 enemy의 def를 포함)
 */
export function executeEnemyTurn(state: BattleState, enemyDefs: EnemyDef[]): BattleState {
  const enemy = state.enemy
  const def = enemyDefs.find(d => d.id === enemy.def.id) ?? enemy.def
  const moves = def.moves

  if (moves.length === 0) return state

  const moveIndex = enemy.moveIndex % moves.length
  const move = moves[moveIndex]

  const actions = move.execute({ enemy, player: state.player })
  let newState = applyBattleActions(state, actions)
  newState = addLog(newState, `적 "${enemy.def.name}" 행동: ${move.intent.type}`, 'info')

  return newState
}
