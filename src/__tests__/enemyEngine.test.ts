/**
 * enemyEngine.ts 단위 테스트
 *
 * Phase 2 — 적 시스템 (EnemyDef + Intent 엔진)
 *
 * 테스트 케이스 10개:
 *  1. createEnemyState(def) — maxHp, element, moveIndex=0 초기화 확인
 *  2. computeNextIntent sequential — 순서대로 순환 (0→1→2→0)
 *  3. computeNextIntent random_weighted — weight 총합 범위 내 반환 (100회 반복)
 *  4. executeEnemyTurn attack — 플레이어 HP 감소 확인
 *  5. executeEnemyTurn defend — 적 블록 증가 확인
 *  6. executeEnemyTurn buff — 적 버프 스택 증가 확인
 *  7. 오행 상성: 火 적 attack vs 金 플레이어 → 데미지 ×1.5 (火克金)
 *  8. 오행 상성: 木 적 attack vs 水 플레이어 → 데미지 ×0.75 (水生木 — 방어자 수가 공격자 목을 생성)
 *  9. 보스 3페이즈 패턴 — moveIndex 기반 페이즈 전환 확인
 * 10. 블록 선공제: 플레이어 블록 5 상태에서 적 attack 7 → HP는 2만 감소
 */

import { describe, it, expect } from 'vitest'
import type { BattleState, PlayerState, EnemyState, EnemyDef } from '@/types/stsTypes'
import { createEnemyState, computeNextIntent, executeEnemyTurn } from '@/game/engine/enemyEngine'
import {
  ENEMY_QINGLONG_SOLDIER,
  ENEMY_WOOD_SHAMAN,
  ENEMY_PHOENIX_GUARD,
  ENEMY_FIVE_ELEMENT_EMPEROR,
  ALL_ENEMIES,
} from '@/data/enemies'

// ─── 테스트 픽스처 ────────────────────────────────────

function makePlayerState(overrides?: Partial<PlayerState>): PlayerState {
  return {
    hp: 70,
    maxHp: 70,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    buffs: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    relics: [],
    potions: [null, null],
    element: '木',
    gold: 99,
    ...overrides,
  }
}

function makeBattleState(
  playerOverrides?: Partial<PlayerState>,
  enemyState?: EnemyState,
): BattleState {
  const def = ENEMY_QINGLONG_SOLDIER
  const enemy = enemyState ?? createEnemyState(def)
  return {
    phase: 'enemyTurn',
    turn: 1,
    player: makePlayerState(playerOverrides),
    enemy,
    actionLog: [],
    lastPlayedElement: null,
    sameElementCount: 0,
  }
}

// ─── 케이스 1: createEnemyState 초기화 ───────────────

describe('createEnemyState', () => {
  it('maxHp, element, moveIndex=0 초기화', () => {
    const def = ENEMY_QINGLONG_SOLDIER
    const state = createEnemyState(def)

    expect(state.hp).toBe(def.maxHp)
    expect(state.maxHp).toBe(def.maxHp)
    expect(state.block).toBe(0)
    expect(state.buffs).toHaveLength(0)
    expect(state.moveIndex).toBe(0)
    expect(state.currentIntent).toEqual(def.moves[0].intent)
    expect(state.def.element).toBe('木')
  })

  it('엘리트 적 createEnemyState — 보스 HP 정확성', () => {
    const def = ENEMY_FIVE_ELEMENT_EMPEROR
    const state = createEnemyState(def)
    expect(state.hp).toBe(150)
    expect(state.maxHp).toBe(150)
    expect(state.moveIndex).toBe(0)
  })
})

// ─── 케이스 2: computeNextIntent sequential 순환 ─────

describe('computeNextIntent — sequential', () => {
  it('0→1→2→0 순환', () => {
    const def = ENEMY_QINGLONG_SOLDIER // 3개 move, sequential
    expect(def.moves).toHaveLength(3)

    // moveIndex=0 → moves[0] (attack 8)
    const state0: EnemyState = { ...createEnemyState(def), moveIndex: 0 }
    expect(computeNextIntent(state0, def).intent.type).toBe('attack')

    // moveIndex=1 → moves[1] (attack 8)
    const state1: EnemyState = { ...createEnemyState(def), moveIndex: 1 }
    expect(computeNextIntent(state1, def).intent.type).toBe('attack')

    // moveIndex=2 → moves[2] (defend 6)
    const state2: EnemyState = { ...createEnemyState(def), moveIndex: 2 }
    expect(computeNextIntent(state2, def).intent.type).toBe('defend')

    // moveIndex=3 → moves[3 % 3 = 0] (attack 8) — 순환
    const state3: EnemyState = { ...createEnemyState(def), moveIndex: 3 }
    expect(computeNextIntent(state3, def).intent.type).toBe('attack')

    // moveIndex=5 → moves[5 % 3 = 2] (defend)
    const state5: EnemyState = { ...createEnemyState(def), moveIndex: 5 }
    expect(computeNextIntent(state5, def).intent.type).toBe('defend')
  })

  it('봉황 근위대 sequential: buff → attack → attack → buff (순환)', () => {
    const def = ENEMY_PHOENIX_GUARD
    expect(def.patternType).toBe('sequential')

    const getType = (idx: number) => {
      const s: EnemyState = { ...createEnemyState(def), moveIndex: idx }
      return computeNextIntent(s, def).intent.type
    }

    expect(getType(0)).toBe('buff')
    expect(getType(1)).toBe('attack')
    expect(getType(2)).toBe('attack')
    expect(getType(3)).toBe('buff') // 3 % 3 = 0
  })
})

// ─── 케이스 3: computeNextIntent random_weighted ─────

describe('computeNextIntent — random_weighted', () => {
  it('100회 반복 시 유효한 move만 반환', () => {
    const def = ENEMY_WOOD_SHAMAN
    expect(def.patternType).toBe('random_weighted')
    expect(def.weights).toEqual([3, 2, 2])

    const state = createEnemyState(def)
    const validTypes = new Set(def.moves.map(m => m.intent.type))

    for (let i = 0; i < 100; i++) {
      const move = computeNextIntent(state, def)
      expect(validTypes.has(move.intent.type)).toBe(true)
    }
  })

  it('random_weighted 결과가 moves 배열 내 인덱스에 해당', () => {
    const def = ENEMY_WOOD_SHAMAN
    const state = createEnemyState(def)

    for (let i = 0; i < 50; i++) {
      const move = computeNextIntent(state, def)
      const found = def.moves.includes(move)
      expect(found).toBe(true)
    }
  })
})

// ─── 케이스 4: executeEnemyTurn attack — 플레이어 HP 감소 ─

describe('executeEnemyTurn — attack', () => {
  it('플레이어 HP가 정확히 감소한다', () => {
    // 청룡 병사 moveIndex=0: attack 8
    const def = ENEMY_QINGLONG_SOLDIER
    const enemyState = createEnemyState(def)
    const battleState = makeBattleState({ hp: 70, element: '土' }, enemyState)

    const result = executeEnemyTurn(battleState, ALL_ENEMIES)

    // 木 적 attack vs 土 플레이어: 木克土 → ×1.5 → Math.round(8 × 1.5) = 12
    expect(result.player.hp).toBe(70 - 12)
  })

  it('플레이어 HP 감소 후 actionLog에 damage 로그 추가', () => {
    const def = ENEMY_QINGLONG_SOLDIER
    const enemyState = createEnemyState(def)
    const battleState = makeBattleState({ hp: 70, element: '中性' as never }, enemyState)

    const result = executeEnemyTurn(battleState, ALL_ENEMIES)

    const damageLog = result.actionLog.find(l => l.type === 'damage')
    expect(damageLog).toBeDefined()
  })
})

// ─── 케이스 5: executeEnemyTurn defend — 적 블록 증가 ─

describe('executeEnemyTurn — defend', () => {
  it('적 블록이 증가한다', () => {
    // 청룡 병사 moveIndex=2: defend 6
    const def = ENEMY_QINGLONG_SOLDIER
    const enemyState: EnemyState = { ...createEnemyState(def), moveIndex: 2 }
    const battleState = makeBattleState(undefined, enemyState)

    expect(battleState.enemy.block).toBe(0)

    const result = executeEnemyTurn(battleState, ALL_ENEMIES)

    expect(result.enemy.block).toBe(6)
  })
})

// ─── 케이스 6: executeEnemyTurn buff — 적 버프 스택 증가 ─

describe('executeEnemyTurn — buff', () => {
  it('봉황 근위대 moveIndex=0: strength +2 버프 적용', () => {
    const def = ENEMY_PHOENIX_GUARD
    const enemyState: EnemyState = { ...createEnemyState(def), moveIndex: 0 }
    const battleState = makeBattleState(undefined, enemyState)

    const result = executeEnemyTurn(battleState, ALL_ENEMIES)

    const strengthBuff = result.enemy.buffs.find(b => b.id === 'strength')
    expect(strengthBuff).toBeDefined()
    expect(strengthBuff?.amount).toBe(2)
  })
})

// ─── 케이스 7: 오행 상성 — 火克金 → ×1.5 ────────────

describe('오행 상성 — 火 적 attack vs 金 플레이어', () => {
  it('火克金: 데미지 ×1.5 적용', () => {
    // 화염 무사 (火 원소) moveIndex=0: attack 10
    const def = {
      id: 'flame_warrior_test',
      name: '화염 무사',
      maxHp: 35,
      element: '火' as const,
      icon: '🔥',
      patternType: 'sequential' as const,
      moves: [
        {
          intent: { type: 'attack' as const, damage: 10 },
          execute: (_ctx: { enemy: EnemyState; player: PlayerState }) => [
            { type: 'damage' as const, target: 'player' as const, amount: 10 },
          ],
        },
      ],
    } satisfies EnemyDef

    const enemyState = createEnemyState(def)
    // 플레이어: 金 오행
    const battleState = makeBattleState({ hp: 70, element: '金', block: 0 }, enemyState)

    const result = executeEnemyTurn(battleState, [def])

    // 火克金 → ×1.5 → Math.round(10 × 1.5) = 15
    expect(result.player.hp).toBe(70 - 15)
  })
})

// ─── 케이스 8: 오행 상성 — 水生木(방어) → ×0.75 ──────

describe('오행 상성 — 木 적 attack vs 水 플레이어', () => {
  it('水生木(방어): 데미지 ×0.75 적용 (水가 木을 생성 — 방어자 유리)', () => {
    // 木 오행 적, attack 8
    const def: EnemyDef = {
      id: 'wood_test',
      name: '목 테스트',
      maxHp: 30,
      element: '木',
      icon: '🌿',
      patternType: 'sequential',
      moves: [
        {
          intent: { type: 'attack', damage: 8 },
          execute: (_ctx: { enemy: EnemyState; player: PlayerState }) => [
            { type: 'damage', target: 'player', amount: 8 },
          ],
        },
      ],
    }

    const enemyState = createEnemyState(def)
    // 플레이어: 水 오행
    const battleState = makeBattleState({ hp: 70, element: '水', block: 0 }, enemyState)

    const result = executeEnemyTurn(battleState, [def])

    // generateDefense: GENERATES['水']==='木' → 水生木 방어 → ×0.75
    // Math.round(8 × 0.75) = 6
    expect(result.player.hp).toBe(70 - 6)
  })
})

// ─── 케이스 9: 보스 3페이즈 패턴 — moveIndex 전환 ────

describe('보스 3페이즈 패턴', () => {
  it('오행황: Phase A(0~2), Phase B(3~5), Phase C(6~8) 각 phase 의도 타입 확인', () => {
    const def = ENEMY_FIVE_ELEMENT_EMPEROR
    expect(def.moves).toHaveLength(9)

    const getIntentType = (idx: number) => def.moves[idx].intent.type

    // Phase A
    expect(getIntentType(0)).toBe('attack')   // index 0
    expect(getIntentType(1)).toBe('defend')   // index 1
    expect(getIntentType(2)).toBe('debuff')   // index 2

    // Phase B
    expect(getIntentType(3)).toBe('attackBuff')   // index 3
    expect(getIntentType(4)).toBe('attack')        // index 4
    expect(getIntentType(5)).toBe('attack')        // index 5

    // Phase C
    expect(getIntentType(6)).toBe('attackDebuff') // index 6
    expect(getIntentType(7)).toBe('attack')        // index 7
    expect(getIntentType(8)).toBe('attackBuff')   // index 8
  })

  it('보스 sequential 패턴: moveIndex 8 다음 0으로 순환', () => {
    const def = ENEMY_FIVE_ELEMENT_EMPEROR
    const state8: EnemyState = { ...createEnemyState(def), moveIndex: 8 }
    const state9: EnemyState = { ...createEnemyState(def), moveIndex: 9 } // 9 % 9 = 0

    const move8 = computeNextIntent(state8, def)
    const move9 = computeNextIntent(state9, def)

    expect(move8.intent.type).toBe('attackBuff') // index 8
    expect(move9.intent.type).toBe('attack')     // index 0 (순환)
  })

  it('보스 Phase B 실행: strength 버프 + 데미지 적용', () => {
    const def = ENEMY_FIVE_ELEMENT_EMPEROR
    const enemyState: EnemyState = { ...createEnemyState(def), moveIndex: 3 }
    const battleState = makeBattleState({ hp: 100, maxHp: 100, element: '木' }, enemyState)

    const result = executeEnemyTurn(battleState, ALL_ENEMIES)

    // index 3: applyBuff(strength, 3) 먼저 적용 후 damage(player, 15) 실행
    // strength +3이 이미 적용된 상태에서 데미지 계산 → 15 + 3(strength) = 18
    const strengthBuff = result.enemy.buffs.find(b => b.id === 'strength')
    expect(strengthBuff?.amount).toBe(3)
    // 土 적 vs 木 플레이어: neutral (×1.0)
    // strength +3 반영: 15 + 3 = 18
    expect(result.player.hp).toBe(100 - 18)
  })
})

// ─── 케이스 10: 블록 선공제 ──────────────────────────

describe('블록 선공제', () => {
  it('플레이어 블록 5, 적 attack 7 → HP 2 감소 (7-5=2)', () => {
    // 중립 원소 적, attack 7 — 오행 상성 없음
    const def: EnemyDef = {
      id: 'neutral_test',
      name: '중립 테스트',
      maxHp: 30,
      element: 'neutral',
      icon: '👹',
      patternType: 'sequential',
      moves: [
        {
          intent: { type: 'attack', damage: 7 },
          execute: (_ctx: { enemy: EnemyState; player: PlayerState }) => [
            { type: 'damage', target: 'player', amount: 7 },
          ],
        },
      ],
    }

    const enemyState = createEnemyState(def)
    // 플레이어: 블록 5
    const battleState = makeBattleState({ hp: 70, block: 5, element: '木' }, enemyState)

    const result = executeEnemyTurn(battleState, [def])

    // 블록 5 선공제: 7 - 5 = 2 HP 감소
    expect(result.player.block).toBe(0)
    expect(result.player.hp).toBe(68)
  })

  it('플레이어 블록 10, 적 attack 7 → HP 변화 없음 (블록 3 남음)', () => {
    const def: EnemyDef = {
      id: 'neutral_test2',
      name: '중립 테스트2',
      maxHp: 30,
      element: 'neutral',
      icon: '👹',
      patternType: 'sequential',
      moves: [
        {
          intent: { type: 'attack', damage: 7 },
          execute: (_ctx: { enemy: EnemyState; player: PlayerState }) => [
            { type: 'damage', target: 'player', amount: 7 },
          ],
        },
      ],
    }

    const enemyState = createEnemyState(def)
    const battleState = makeBattleState({ hp: 70, block: 10, element: '木' }, enemyState)

    const result = executeEnemyTurn(battleState, [def])

    expect(result.player.hp).toBe(70) // HP 변화 없음
    expect(result.player.block).toBe(3) // 블록 3 남음
  })
})

// ─── 추가: 전체 적 목록 유효성 검증 ──────────────────

describe('ALL_ENEMIES 데이터 무결성', () => {
  it('전체 적 12종 로드 확인 (일반 7 + 엘리트 3 + 보스 2)', () => {
    expect(ALL_ENEMIES).toHaveLength(12)
  })

  it('모든 적이 유효한 EnemyDef 구조를 가진다', () => {
    for (const def of ALL_ENEMIES) {
      expect(def.id).toBeTruthy()
      expect(def.name).toBeTruthy()
      expect(def.maxHp).toBeGreaterThan(0)
      expect(def.moves.length).toBeGreaterThan(0)
      expect(['sequential', 'random_weighted']).toContain(def.patternType)
    }
  })

  it('createEnemyState가 모든 적에 대해 성공한다', () => {
    for (const def of ALL_ENEMIES) {
      const state = createEnemyState(def)
      expect(state.hp).toBe(def.maxHp)
      expect(state.moveIndex).toBe(0)
    }
  })
})
