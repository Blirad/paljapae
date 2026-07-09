/**
 * STS 버프/디버프 스택 관리 엔진
 *
 * Phase 1 — STS 재작성 (BattleState 전용, GameState 의존 없음)
 */

import type { BattleState, PlayerState, EnemyState, Buff, BuffId } from '@/types/stsTypes'

// ─── 버프 적용 ────────────────────────────────────────

/**
 * 버프 스택 적용 (순수 함수)
 * - 기존 버프가 있으면 amount 증가, duration 최대값 유지
 * - 없으면 새로 추가
 */
export function applyBuff(
  target: PlayerState | EnemyState,
  buffId: BuffId,
  stacks: number,
  duration?: number,
): PlayerState | EnemyState {
  const existing = target.buffs.find(b => b.id === buffId)

  let newBuffs: Buff[]
  if (existing) {
    newBuffs = target.buffs.map(b => {
      if (b.id !== buffId) return b
      return {
        ...b,
        amount: b.amount + stacks,
        // duration이 있을 경우 최대값 유지
        duration:
          duration !== undefined && b.duration !== undefined
            ? Math.max(b.duration, duration)
            : b.duration ?? duration,
      }
    })
  } else {
    const newBuff: Buff = { id: buffId, amount: stacks }
    if (duration !== undefined) newBuff.duration = duration
    newBuffs = [...target.buffs, newBuff]
  }

  return { ...target, buffs: newBuffs }
}

// ─── 버프 수치 조회 ───────────────────────────────────

/**
 * 특정 버프의 현재 amount 반환 (없으면 0)
 */
export function getBuffValue(target: PlayerState | EnemyState, buffId: BuffId): number {
  const buff = target.buffs.find(b => b.id === buffId)
  return buff ? buff.amount : 0
}

// ─── 수정자 계산 ──────────────────────────────────────

/**
 * 데미지 수신 수정자 — 취약(vulnerable) ×1.5
 * 다른 수신 수정자가 추가될 경우 여기서 확장
 */
export function getDamageModifier(target: PlayerState | EnemyState): number {
  const hasVulnerable = target.buffs.some(b => b.id === 'vulnerable' && b.amount > 0)
  return hasVulnerable ? 1.5 : 1.0
}

/**
 * 블록 수신 수정자 — 허약(frail) ×0.75
 */
export function getBlockModifier(target: PlayerState | EnemyState): number {
  const hasFrail = target.buffs.some(b => b.id === 'frail' && b.amount > 0)
  return hasFrail ? 0.75 : 1.0
}

/**
 * 데미지 딜 수정자 — 약화(weak) ×0.75
 */
export function getDealModifier(source: PlayerState | EnemyState): number {
  const hasWeak = source.buffs.some(b => b.id === 'weak' && b.amount > 0)
  return hasWeak ? 0.75 : 1.0
}

// ─── 턴 기반 버프 감소 ────────────────────────────────

/**
 * 턴 기반 버프 duration 감소 및 만료된 버프 제거
 * vulnerable, weak, frail 등 duration 기반 디버프에 적용
 */
export function decrementBuffs(target: PlayerState | EnemyState): PlayerState | EnemyState {
  const newBuffs = target.buffs
    .map(b => {
      if (b.duration === undefined) return b
      return { ...b, duration: b.duration - 1 }
    })
    .filter(b => {
      // duration 있는 버프: 0 이하가 되면 제거
      if (b.duration !== undefined && b.duration <= 0) return false
      // amount 0인 버프도 제거 (poison 등)
      if (b.amount <= 0) return false
      return true
    })

  return { ...target, buffs: newBuffs }
}

// ─── 턴 종료 버프 처리 ────────────────────────────────

/**
 * 턴 종료 시 버프 효과 처리 (BattleState 레벨)
 * - poison: target HP 감소, amount 1 감소
 * - regen: target HP 증가, amount 1 감소
 * - ritual: strength amount 증가
 * - metallicize: block 증가
 *
 * @param state - 현재 BattleState
 * @param side - 처리할 대상 ('player' | 'enemy')
 */
export function processTurnEndBuffs(state: BattleState, side: 'player' | 'enemy'): BattleState {
  if (side === 'player') {
    let player = { ...state.player }

    // poison: HP 감소 + amount 1 감소
    const poisonBuff = player.buffs.find(b => b.id === 'poison')
    if (poisonBuff && poisonBuff.amount > 0) {
      player = {
        ...player,
        hp: Math.max(0, player.hp - poisonBuff.amount),
        buffs: player.buffs.map(b =>
          b.id === 'poison' ? { ...b, amount: b.amount - 1 } : b
        ).filter(b => !(b.id === 'poison' && b.amount <= 0)),
      }
    }

    // regen: HP 증가 + amount 1 감소
    const regenBuff = player.buffs.find(b => b.id === 'regen')
    if (regenBuff && regenBuff.amount > 0) {
      player = {
        ...player,
        hp: Math.min(player.maxHp, player.hp + regenBuff.amount),
        buffs: player.buffs.map(b =>
          b.id === 'regen' ? { ...b, amount: b.amount - 1 } : b
        ).filter(b => !(b.id === 'regen' && b.amount <= 0)),
      }
    }

    // ritual: 힘(strength) 변환
    const ritualBuff = player.buffs.find(b => b.id === 'ritual')
    if (ritualBuff && ritualBuff.amount > 0) {
      player = {
        ...player,
        buffs: applyBuff(player, 'strength', ritualBuff.amount).buffs,
      }
    }

    // metallicize: 블록 추가
    const metallicizeBuff = player.buffs.find(b => b.id === 'metallicize')
    if (metallicizeBuff && metallicizeBuff.amount > 0) {
      player = {
        ...player,
        block: player.block + metallicizeBuff.amount,
      }
    }

    return { ...state, player }
  } else {
    let enemy = { ...state.enemy }

    // poison: HP 감소 + amount 1 감소
    const poisonBuff = enemy.buffs.find(b => b.id === 'poison')
    if (poisonBuff && poisonBuff.amount > 0) {
      enemy = {
        ...enemy,
        hp: Math.max(0, enemy.hp - poisonBuff.amount),
        buffs: enemy.buffs.map(b =>
          b.id === 'poison' ? { ...b, amount: b.amount - 1 } : b
        ).filter(b => !(b.id === 'poison' && b.amount <= 0)),
      }
    }

    // regen: HP 증가 + amount 1 감소
    const regenBuff = enemy.buffs.find(b => b.id === 'regen')
    if (regenBuff && regenBuff.amount > 0) {
      enemy = {
        ...enemy,
        hp: Math.min(enemy.maxHp, enemy.hp + regenBuff.amount),
        buffs: enemy.buffs.map(b =>
          b.id === 'regen' ? { ...b, amount: b.amount - 1 } : b
        ).filter(b => !(b.id === 'regen' && b.amount <= 0)),
      }
    }

    // ritual: 힘(strength) 변환
    const ritualBuff = enemy.buffs.find(b => b.id === 'ritual')
    if (ritualBuff && ritualBuff.amount > 0) {
      enemy = {
        ...enemy,
        buffs: applyBuff(enemy, 'strength', ritualBuff.amount).buffs,
      }
    }

    // metallicize: 블록 추가
    const metallicizeBuff = enemy.buffs.find(b => b.id === 'metallicize')
    if (metallicizeBuff && metallicizeBuff.amount > 0) {
      enemy = {
        ...enemy,
        block: enemy.block + metallicizeBuff.amount,
      }
    }

    return { ...state, enemy }
  }
}
