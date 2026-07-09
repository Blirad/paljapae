/**
 * STS 전투 엔진 Phase 1 단위 테스트
 *
 * 필수 케이스 10개:
 *  1. drawCards(state, 5) — 5장 드로우 후 hand 크기 확인
 *  2. 드로우 시 drawPile 소진 → discardPile 재셔플 → 드로우 계속
 *  3. applyBuff(player, 'vulnerable', 1) + getDamageModifier() → 1.5
 *  4. applyBuff(player, 'weak', 1) + getDealModifier() → 0.75
 *  5. dealDamage(state, 'enemy', 10) — enemy HP 정확히 감소
 *  6. applyBlock(state, 'player', 5) + dealDamage(state, 'player', 3) — 블록 먼저 차감
 *  7. startPlayerTurn — energy=3, hand.length=5, player.block=0
 *  8. endPlayerTurn — hand 전체 discardPile로, 버프 처리
 *  9. 오행 상성: 木 카드 vs 土 적 → 데미지 ×1.5 (상극, elementalCombat 기준)
 * 10. playCard — energy 차감 + CardEffect 실행
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { BattleState, PlayerState, EnemyState, CardDef, CardInstance, EnemyDef } from '@/types/stsTypes'
import { drawCards, discardCard, exhaustCard } from '@/game/engine/deckCycle'
import {
  applyBuff,
  getDamageModifier,
  getDealModifier,
  getBlockModifier,
  processTurnEndBuffs,
  getBuffValue,
} from '@/game/engine/buffEngine'
import {
  dealDamage,
  applyBlock,
  startPlayerTurn,
  endPlayerTurn,
  startEnemyTurn,
  endEnemyTurn,
  playCard,
  registerCardDefs,
} from '@/game/engine/stsEngine'

// ─── 테스트 픽스처 ────────────────────────────────────

function makeCardInstance(id: string): CardInstance {
  return { instanceId: id, defId: id, upgraded: false }
}

function makeCardInstances(count: number, prefix = 'card'): CardInstance[] {
  return Array.from({ length: count }, (_, i) => makeCardInstance(`${prefix}_${i}`))
}

const testEnemyDef: EnemyDef = {
  id: 'test_enemy',
  name: '테스트 적',
  maxHp: 50,
  element: '土',
  icon: '👹',
  moves: [
    {
      intent: { type: 'attack', damage: 6 },
      execute: (_ctx) => [
        { type: 'damage' as const, target: 'player' as const, amount: 6 },
      ],
    },
    {
      intent: { type: 'defend', block: 5 },
      execute: (_ctx) => [
        { type: 'block' as const, target: 'enemy' as const, amount: 5 },
      ],
    },
  ],
  patternType: 'sequential',
}

function makeEnemyState(overrides?: Partial<EnemyState> & { element?: EnemyDef['element'] }): EnemyState {
  const element = overrides?.element
  const def: EnemyDef = element !== undefined
    ? { ...testEnemyDef, element }
    : testEnemyDef
  const { element: _el, ...rest } = overrides ?? {}
  return {
    def,
    hp: 50,
    maxHp: 50,
    block: 0,
    buffs: [],
    moveIndex: 0,
    currentIntent: def.moves[0].intent,
    ...rest,
  }
}

function makePlayerState(overrides?: Partial<PlayerState>): PlayerState {
  return {
    hp: 70,
    maxHp: 70,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    buffs: [],
    drawPile: makeCardInstances(10, 'draw'),
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

type EnemyOverrides = Partial<EnemyState> & { element?: EnemyDef['element'] }

function makeBattleState(
  playerOverrides?: Partial<PlayerState>,
  enemyOverrides?: EnemyOverrides,
): BattleState {
  return {
    phase: 'playerTurn',
    turn: 1,
    player: makePlayerState(playerOverrides),
    enemy: makeEnemyState(enemyOverrides),
    actionLog: [],
    lastPlayedElement: null,
    sameElementCount: 0,
  }
}

// ─── 테스트 카드 def 등록 ─────────────────────────────

const testStrikeDef: CardDef = {
  id: 'strike_test',
  name: '타격',
  cost: 1,
  type: 'attack',
  rarity: 'starter',
  element: '木',
  description: '6 데미지',
  effects: [{ type: 'damage', value: 6, target: 'enemy' }],
  icon: '⚔️',
}

const testDefendDef: CardDef = {
  id: 'defend_test',
  name: '방어',
  cost: 1,
  type: 'skill',
  rarity: 'starter',
  element: 'neutral',
  description: '5 블록',
  effects: [{ type: 'block', value: 5, target: 'self' }],
  icon: '🛡️',
}

const testDrawDef: CardDef = {
  id: 'draw_test',
  name: '집중',
  cost: 1,
  type: 'skill',
  rarity: 'common',
  element: 'neutral',
  description: '2장 드로우',
  effects: [{ type: 'draw', value: 2 }],
  icon: '📖',
}

beforeEach(() => {
  registerCardDefs([testStrikeDef, testDefendDef, testDrawDef])
})

// ─── 1. drawCards — 5장 드로우 ────────────────────────

describe('drawCards()', () => {
  it('[케이스 1] 5장 드로우 후 hand 크기 = 5', () => {
    const state = makeBattleState({ drawPile: makeCardInstances(10), hand: [] })
    const result = drawCards(state, 5)
    expect(result.player.hand).toHaveLength(5)
    expect(result.player.drawPile).toHaveLength(5)
  })

  it('[케이스 2] drawPile 소진 → discardPile 재셔플 → 드로우 계속', () => {
    // drawPile 2장, discardPile 8장 → 총 5장 드로우 가능
    const state = makeBattleState({
      drawPile: makeCardInstances(2, 'draw'),
      discardPile: makeCardInstances(8, 'disc'),
      hand: [],
    })
    const result = drawCards(state, 5)
    // 2장 drawPile + 재셔플 후 3장 더 = 5장
    expect(result.player.hand).toHaveLength(5)
    // discardPile에서 3장 소진, 나머지 5장이 drawPile에
    expect(result.player.drawPile).toHaveLength(5)
    expect(result.player.discardPile).toHaveLength(0)
  })

  it('drawPile + discardPile 모두 소진 시 가능한 만큼만 드로우', () => {
    const state = makeBattleState({
      drawPile: makeCardInstances(2, 'draw'),
      discardPile: makeCardInstances(1, 'disc'),
      hand: [],
    })
    const result = drawCards(state, 5)
    expect(result.player.hand).toHaveLength(3)
  })

  it('핸드 10장 한도 초과 시 드로우 중단', () => {
    const state = makeBattleState({
      drawPile: makeCardInstances(5, 'draw'),
      hand: makeCardInstances(8, 'hand'),
    })
    const result = drawCards(state, 5)
    expect(result.player.hand).toHaveLength(10)
    expect(result.player.drawPile).toHaveLength(3)
  })
})

// ─── 3. getDamageModifier — 취약 ──────────────────────

describe('[케이스 3] applyBuff + getDamageModifier()', () => {
  it('취약(vulnerable) 1 적용 시 getDamageModifier = 1.5', () => {
    const player = makePlayerState()
    const buffed = applyBuff(player, 'vulnerable', 1, 2) as PlayerState
    expect(getDamageModifier(buffed)).toBe(1.5)
  })

  it('버프 없을 때 getDamageModifier = 1.0', () => {
    const player = makePlayerState()
    expect(getDamageModifier(player)).toBe(1.0)
  })
})

// ─── 4. getDealModifier — 약화 ────────────────────────

describe('[케이스 4] applyBuff + getDealModifier()', () => {
  it('약화(weak) 1 적용 시 getDealModifier = 0.75', () => {
    const player = makePlayerState()
    const buffed = applyBuff(player, 'weak', 1, 2) as PlayerState
    expect(getDealModifier(buffed)).toBe(0.75)
  })

  it('버프 없을 때 getDealModifier = 1.0', () => {
    const player = makePlayerState()
    expect(getDealModifier(player)).toBe(1.0)
  })
})

// ─── getBlockModifier — 허약 ──────────────────────────

describe('getBlockModifier()', () => {
  it('허약(frail) 1 적용 시 getBlockModifier = 0.75', () => {
    const player = makePlayerState()
    const buffed = applyBuff(player, 'frail', 1, 2) as PlayerState
    expect(getBlockModifier(buffed)).toBe(0.75)
  })
})

// ─── 5. dealDamage — enemy HP 감소 ────────────────────

describe('[케이스 5] dealDamage(state, enemy, 10)', () => {
  it('적 HP 정확히 감소 (블록 없음)', () => {
    const state = makeBattleState()
    const result = dealDamage(state, 'enemy', 10)
    expect(result.enemy.hp).toBe(40)
    expect(result.enemy.block).toBe(0)
  })

  it('적 블록이 데미지 흡수 후 HP 차감', () => {
    const state = makeBattleState({}, { block: 8 })
    const result = dealDamage(state, 'enemy', 10)
    expect(result.enemy.block).toBe(0)
    expect(result.enemy.hp).toBe(48) // 10 - 8 = 2 overflow → 50 - 2 = 48
  })

  it('취약 적 → 데미지 1.5배 (floor)', () => {
    const baseState = makeBattleState()
    const enemyWithVuln = applyBuff(baseState.enemy, 'vulnerable', 1, 2) as EnemyState
    const state = { ...baseState, enemy: enemyWithVuln }
    // 10 × 1.5 = 15
    const result = dealDamage(state, 'enemy', 10)
    expect(result.enemy.hp).toBe(35)
  })

  it('적 HP 0 이하 → phase = victory', () => {
    const state = makeBattleState({}, { hp: 5 })
    const result = dealDamage(state, 'enemy', 10)
    expect(result.enemy.hp).toBe(0)
    expect(result.phase).toBe('victory')
  })
})

// ─── 6. applyBlock + dealDamage — 블록 먼저 차감 ────────

describe('[케이스 6] applyBlock + dealDamage — 블록 먼저 차감', () => {
  it('블록 5 → 데미지 3 수신 → 블록 2 남음, HP 그대로', () => {
    const state = makeBattleState({ hp: 70, block: 0 })
    const withBlock = applyBlock(state, 'player', 5)
    expect(withBlock.player.block).toBe(5)
    const after = dealDamage(withBlock, 'player', 3)
    expect(after.player.block).toBe(2)
    expect(after.player.hp).toBe(70)
  })

  it('블록 3 → 데미지 7 수신 → 블록 0, HP 70-4=66', () => {
    const state = makeBattleState({ hp: 70, block: 0 })
    const withBlock = applyBlock(state, 'player', 3)
    const after = dealDamage(withBlock, 'player', 7)
    expect(after.player.block).toBe(0)
    expect(after.player.hp).toBe(66)
  })
})

// ─── 7. startPlayerTurn ────────────────────────────────

describe('[케이스 7] startPlayerTurn', () => {
  it('energy=3, hand.length=5, player.block=0 확인', () => {
    // 사전: 블록 5, 에너지 1, 핸드 0
    const baseState = makeBattleState({
      block: 5,
      energy: 1,
      hand: [],
      drawPile: makeCardInstances(10, 'draw'),
    })
    // turn을 0으로 설정해서 startPlayerTurn 후 1이 됨
    const initState: BattleState = { ...baseState, turn: 0 }
    const result = startPlayerTurn(initState)
    expect(result.player.energy).toBe(3)
    expect(result.player.hand).toHaveLength(5)
    expect(result.player.block).toBe(0)
    expect(result.turn).toBe(1)
  })

  it('barricade 보유 시 블록 유지', () => {
    const player = makePlayerState({ block: 8 })
    const buffed = applyBuff(player, 'barricade', 1) as PlayerState
    const state: BattleState = {
      ...makeBattleState(),
      player: buffed,
      turn: 0,
    }
    const result = startPlayerTurn(state)
    expect(result.player.block).toBe(8)
  })
})

// ─── 8. endPlayerTurn ──────────────────────────────────

describe('[케이스 8] endPlayerTurn', () => {
  it('hand 전체 discardPile로 이동', () => {
    const state = makeBattleState({
      hand: makeCardInstances(4, 'h'),
      discardPile: makeCardInstances(2, 'd'),
    })
    const result = endPlayerTurn(state)
    expect(result.player.hand).toHaveLength(0)
    expect(result.player.discardPile).toHaveLength(6)
  })

  it('독(poison) 버프 턴 종료 시 HP 감소', () => {
    const player = makePlayerState({ hp: 70, hand: [] })
    const poisoned = applyBuff(player, 'poison', 5) as PlayerState
    const state: BattleState = { ...makeBattleState(), player: poisoned }
    const result = endPlayerTurn(state)
    expect(result.player.hp).toBe(65)
    expect(getBuffValue(result.player, 'poison')).toBe(4)
  })

  it('약화(weak) duration 감소', () => {
    const player = makePlayerState({ hand: [] })
    const weakened = applyBuff(player, 'weak', 1, 2) as PlayerState
    const state: BattleState = { ...makeBattleState(), player: weakened }
    const result = endPlayerTurn(state)
    const weakBuff = result.player.buffs.find(b => b.id === 'weak')
    expect(weakBuff?.duration).toBe(1)
  })

  it('취약(vulnerable) duration=1 → 턴 종료 후 제거됨', () => {
    const player = makePlayerState({ hand: [] })
    const vuln = applyBuff(player, 'vulnerable', 1, 1) as PlayerState
    const state: BattleState = { ...makeBattleState(), player: vuln }
    const result = endPlayerTurn(state)
    const buff = result.player.buffs.find(b => b.id === 'vulnerable')
    expect(buff).toBeUndefined()
  })
})

// ─── 9. 오행 상성: 木 카드 vs 土 적 ────────────────────

describe('[케이스 9] 오행 상성 dealDamage', () => {
  it('木 카드(상극) vs 土 적 → 데미지 ×1.5 (상극, Math.round 10 → 15)', () => {
    // elementalCombat.calculateDamage: 木 vs 土 = dominate → ×1.5 → round(15) = 15
    const state = makeBattleState({}, { element: '土', hp: 50, block: 0 })
    const result = dealDamage(state, 'enemy', 10, '木')
    expect(result.enemy.hp).toBe(35) // 50 - 15 = 35
  })

  it('水 카드(상극) vs 火 적 → 데미지 ×1.5 (Math.round 10 → 15)', () => {
    const state = makeBattleState({}, { element: '火', hp: 50, block: 0 })
    const result = dealDamage(state, 'enemy', 10, '水')
    expect(result.enemy.hp).toBe(35)
  })

  it('중립 상성 → 데미지 그대로 (×1.0)', () => {
    const state = makeBattleState({}, { element: '土', hp: 50, block: 0 })
    const result = dealDamage(state, 'enemy', 10, '火') // 火 vs 土 = neutral
    expect(result.enemy.hp).toBe(40)
  })
})

// ─── 10. playCard — energy 차감 + CardEffect 실행 ────────

describe('[케이스 10] playCard()', () => {
  it('타격 카드(cost=1) 사용 → energy 2, 적 HP 감소', () => {
    const strikeCard = makeCardInstance('strike_test')
    const state = makeBattleState({
      energy: 3,
      hand: [strikeCard],
      drawPile: makeCardInstances(5, 'draw'),
    })
    const result = playCard(state, 'strike_test')
    expect(result.player.energy).toBe(2)
    // 6 데미지 vs 土 적 → elementalCombat: 木 상극 土 → ×1.5 → 9
    // 취약 없음 → 최종 9
    expect(result.enemy.hp).toBe(41) // 50 - 9 = 41
    expect(result.player.hand).toHaveLength(0)
    expect(result.player.discardPile).toHaveLength(1)
  })

  it('방어 카드(cost=1) 사용 → energy 2, 플레이어 블록 증가', () => {
    const defendCard = makeCardInstance('defend_test')
    const state = makeBattleState({
      energy: 3,
      hand: [defendCard],
    })
    const result = playCard(state, 'defend_test')
    expect(result.player.energy).toBe(2)
    expect(result.player.block).toBe(5)
    expect(result.player.hand).toHaveLength(0)
    expect(result.player.discardPile).toHaveLength(1)
  })

  it('에너지 부족 시 카드 사용 불가 — 상태 변경 없음', () => {
    const strikeCard = makeCardInstance('strike_test')
    const state = makeBattleState({
      energy: 0,
      hand: [strikeCard],
    })
    const result = playCard(state, 'strike_test')
    expect(result.player.energy).toBe(0)
    expect(result.player.hand).toHaveLength(1)
  })

  it('드로우 카드 사용 → hand에 2장 추가됨', () => {
    const drawCard = makeCardInstance('draw_test')
    const state = makeBattleState({
      energy: 3,
      hand: [drawCard],
      drawPile: makeCardInstances(5, 'draw'),
    })
    const result = playCard(state, 'draw_test')
    expect(result.player.energy).toBe(2)
    // drawCard는 discard로, draw 2장 → hand 2장
    expect(result.player.hand).toHaveLength(2)
    expect(result.player.discardPile).toHaveLength(1)
  })
})

// ─── 추가: startEnemyTurn + endEnemyTurn ─────────────────

describe('startEnemyTurn / endEnemyTurn', () => {
  it('startEnemyTurn → phase = enemyTurn, 적 블록 초기화', () => {
    const state = makeBattleState({}, { block: 10 })
    const result = startEnemyTurn(state)
    expect(result.phase).toBe('enemyTurn')
    expect(result.enemy.block).toBe(0)
  })

  it('endEnemyTurn → moveIndex 증가, 다음 Intent 설정', () => {
    const state = makeBattleState()
    // moveIndex=0 (attack) → 다음은 1 (defend)
    const result = endEnemyTurn(state)
    expect(result.enemy.moveIndex).toBe(1)
    expect(result.enemy.currentIntent.type).toBe('defend')
  })

  it('endEnemyTurn → sequential 순환 (moveIndex 2개일 때 0→1→0)', () => {
    const state1 = makeBattleState()
    const state2 = endEnemyTurn(state1) // moveIndex → 1
    const state3 = endEnemyTurn(state2) // moveIndex → 0
    expect(state3.enemy.moveIndex).toBe(0)
    expect(state3.enemy.currentIntent.type).toBe('attack')
  })
})

// ─── 추가: discardCard, exhaustCard ──────────────────────

describe('discardCard / exhaustCard', () => {
  it('discardCard → hand에서 제거, discardPile에 추가', () => {
    const hand = makeCardInstances(3, 'h')
    const state = makeBattleState({ hand, discardPile: [] })
    const result = discardCard(state, 'h_1')
    expect(result.player.hand).toHaveLength(2)
    expect(result.player.discardPile).toHaveLength(1)
    expect(result.player.discardPile[0].instanceId).toBe('h_1')
  })

  it('exhaustCard → hand에서 제거, exhaustPile에 추가', () => {
    const hand = makeCardInstances(3, 'h')
    const state = makeBattleState({ hand, exhaustPile: [] })
    const result = exhaustCard(state, 'h_0')
    expect(result.player.hand).toHaveLength(2)
    expect(result.player.exhaustPile).toHaveLength(1)
  })
})

// ─── 추가: processTurnEndBuffs ────────────────────────────

describe('processTurnEndBuffs()', () => {
  it('metallicize → 턴 종료 시 블록 +N', () => {
    const player = makePlayerState({ block: 0, hand: [] })
    const buffed = applyBuff(player, 'metallicize', 3) as PlayerState
    const state: BattleState = { ...makeBattleState(), player: buffed }
    const result = processTurnEndBuffs(state, 'player')
    expect(result.player.block).toBe(3)
  })

  it('ritual → 턴 종료 시 strength 증가', () => {
    const player = makePlayerState({ hand: [] })
    const buffed = applyBuff(player, 'ritual', 2) as PlayerState
    const state: BattleState = { ...makeBattleState(), player: buffed }
    const result = processTurnEndBuffs(state, 'player')
    expect(getBuffValue(result.player, 'strength')).toBe(2)
  })
})
