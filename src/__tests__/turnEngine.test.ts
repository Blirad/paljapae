/**
 * 턴 엔진 단위 테스트
 * 마스터플랜 §3-2 턴 구조
 */

import { describe, it, expect } from 'vitest'
import {
  executeDraw,
  executeEnergyCharge,
  playCard,
  calculateEnergy,
  createEmptyField,
  executeCombatPhase,
} from '@/game/engine/turnEngine'
import type { PlayerState, GameState } from '@/types/game'
import { HEROES, HAND_MAX_SIZE, DRAW_PER_TURN, ENERGY_CAP } from '@/types/game'
import { createInitialFatigue } from '@/game/engine/fatigue'
import type { Card, SoldierCard, FieldUnit } from '@/types/cards'
import { F01, F02, F03, W01, N01, T01, G01, createFireStarterDeck } from '@/data/sampleCards'

// ────────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────────

function makeDeck(size: number): Card[] {
  const base: Card[] = [F01, F02, F03, W01, N01]
  const deck: Card[] = []
  for (let i = 0; i < size; i++) {
    deck.push({ ...base[i % base.length], id: `test-${i}` })
  }
  return deck
}

function makePlayer(deck: Card[] = [], hand: Card[] = []): PlayerState {
  return {
    hero: HEROES.fire_hero,
    currentHp: 30,
    deck,
    hand,
    graveyard: [],
    field: createEmptyField() as PlayerState['field'],
    currentEnergy: 0,
    fatigue: createInitialFatigue(),
  }
}

// ────────────────────────────────────────────────────
// 에너지 계산
// ────────────────────────────────────────────────────

describe('calculateEnergy() — 에너지 상한 시스템', () => {
  it('턴 1: 에너지 1', () => expect(calculateEnergy(1)).toBe(1))
  it('턴 2: 에너지 2', () => expect(calculateEnergy(2)).toBe(2))
  it('턴 3: 에너지 3', () => expect(calculateEnergy(3)).toBe(3))
  it('턴 4: 에너지 4', () => expect(calculateEnergy(4)).toBe(4))
  it('턴 5: 에너지 5 (상한)', () => expect(calculateEnergy(5)).toBe(ENERGY_CAP))
  it('턴 10: 에너지 5 (상한 유지)', () => expect(calculateEnergy(10)).toBe(ENERGY_CAP))
  it('턴 15: 에너지 5 (상한 유지)', () => expect(calculateEnergy(15)).toBe(ENERGY_CAP))
})

describe('executeEnergyCharge() — 에너지 충전', () => {
  it('턴 3에서 플레이어 에너지가 3이 됨', () => {
    const player = makePlayer()
    const result = executeEnergyCharge(player, 3)
    expect(result.currentEnergy).toBe(3)
  })
  it('턴 6에서 에너지 상한 5 적용', () => {
    const player = makePlayer()
    const result = executeEnergyCharge(player, 6)
    expect(result.currentEnergy).toBe(ENERGY_CAP)
  })
})

// ────────────────────────────────────────────────────
// 드로우 페이즈
// ────────────────────────────────────────────────────

describe('executeDraw() — 기본 드로우', () => {
  it('덱에서 DRAW_PER_TURN(3)장 드로우', () => {
    const deck = makeDeck(10)
    const player = makePlayer(deck)
    const { player: result, drawnCount } = executeDraw(player, 1)
    expect(drawnCount).toBe(DRAW_PER_TURN)
    expect(result.hand.length).toBe(DRAW_PER_TURN)
    expect(result.deck.length).toBe(10 - DRAW_PER_TURN)
  })

  it('덱이 2장 남았을 때 2장만 드로우', () => {
    const deck = makeDeck(2)
    const player = makePlayer(deck)
    const { player: result, drawnCount } = executeDraw(player, 1)
    expect(drawnCount).toBe(2)
    expect(result.hand.length).toBe(2)
    expect(result.deck.length).toBe(0)
  })

  it('핸드가 HAND_MAX_SIZE(6) 이상이면 초과분 번(burn)', () => {
    const deck = makeDeck(5)
    const hand = makeDeck(5) // 이미 5장
    const player = makePlayer(deck, hand)
    const { player: result, burnedCount } = executeDraw(player, 1)
    // 5 + 3 = 8 → 핸드 상한 6, 번 2장
    expect(result.hand.length).toBe(HAND_MAX_SIZE)
    expect(burnedCount).toBe(2)
    expect(result.graveyard.length).toBe(2)
  })

  it('핸드가 정확히 HAND_MAX_SIZE이면 모두 번', () => {
    const deck = makeDeck(3)
    const hand = makeDeck(6)
    const player = makePlayer(deck, hand)
    const { player: result, burnedCount } = executeDraw(player, 1)
    expect(result.hand.length).toBe(HAND_MAX_SIZE)
    expect(burnedCount).toBe(DRAW_PER_TURN)
  })
})

describe('executeDraw() — Fatigue 처리', () => {
  it('덱이 ���었을 때 Fatigue 상태 전환 (이미 소진 상태)', () => {
    // 이미 deckExhausted=true인 상태���서 드로우
    const player: PlayerState = {
      ...makePlayer([]),
      fatigue: { deckExhausted: true, exhaustedTurnsCount: 0 },
    }
    const { player: result } = executeDraw(player, 8)
    expect(result.fatigue.deckExhausted).toBe(true)
    expect(result.fatigue.exhaustedTurnsCount).toBe(1)
  })

  it('Fatigue 발생 시 HP 감소', () => {
    const player = makePlayer([]) // 빈 덱
    // 이미 1턴 소진 상태로 만들기
    const fatiguePlayer: PlayerState = {
      ...player,
      fatigue: { deckExhausted: true, exhaustedTurnsCount: 2 },
    }
    const { player: result, fatigueDamage } = executeDraw(fatiguePlayer, 9)
    expect(fatigueDamage).toBe(3) // exhaustedTurnsCount 3이 됨 → 3 피해
    expect(result.currentHp).toBe(30 - 3)
  })

  it('Fatigue 피해로 HP가 0 이하가 되어도 음수로 내려가지 않음', () => {
    const player: PlayerState = {
      ...makePlayer([]),
      currentHp: 2,
      fatigue: { deckExhausted: true, exhaustedTurnsCount: 7 },
    }
    const { player: result } = executeDraw(player, 15)
    // exhaustedTurnsCount = 8 → 8 피해, HP 2 - 8 = -6 → 0
    expect(result.currentHp).toBe(0)
  })
})

// ────────────────────────────────────────────────────
// 카드 플레이
// ────────────────────────────────────────────────────

describe('playCard() — 병사 카드 소환', () => {
  it('에너지 충분 시 병사 카드 소환 성공', () => {
    const hand = [F01] // 비용 1
    const player: PlayerState = {
      ...makePlayer([], hand),
      currentEnergy: 3,
    }
    const result = playCard(player, 0, 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.player.hand.length).toBe(0)
    expect(result.player.field[0]).not.toBeNull()
    expect(result.player.currentEnergy).toBe(2)
  })

  it('에너지 부족 시 실패', () => {
    const hand = [F03] // 비용 3
    const player: PlayerState = {
      ...makePlayer([], hand),
      currentEnergy: 1,
    }
    const result = playCard(player, 0, 0)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.reason).toContain('에너지 부족')
  })

  it('잘못된 인덱스 시 실패', () => {
    const player = makePlayer()
    const result = playCard(player, 5)
    expect(result.success).toBe(false)
  })

  it('필드 슬롯 지정 소환', () => {
    const hand = [F01]
    const player: PlayerState = { ...makePlayer([], hand), currentEnergy: 5 }
    const result = playCard(player, 0, 2) // 슬롯 2에 소환
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.player.field[2]).not.toBeNull()
    expect(result.player.field[2]?.card.id).toBe('F-01')
  })

  it('점유된 슬롯에 소환 시 실패', () => {
    const hand = [F01, { ...F01, id: 'F-01b' }]
    const player: PlayerState = { ...makePlayer([], hand), currentEnergy: 5 }
    const r1 = playCard(player, 0, 0)
    expect(r1.success).toBe(true)
    if (!r1.success) return
    const r2 = playCard(r1.player, 0, 0)
    expect(r2.success).toBe(false)
  })

  it('소환된 유닛의 currentHealth가 maxHealth와 같음', () => {
    const hand = [F03] // attack: 3, maxHealth: 2
    const player: PlayerState = { ...makePlayer([], hand), currentEnergy: 5 }
    const result = playCard(player, 0, 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    const unit = result.player.field[0]
    expect(unit?.currentHealth).toBe(2)
    expect(unit?.currentAttack).toBe(3)
  })
})

describe('playCard() — 돌진(rush) 키워드', () => {
  it('돌진 카드는 소환 즉시 canAttack=true', () => {
    const hand = [F01] // 돌진 키워드 있음
    const player: PlayerState = { ...makePlayer([], hand), currentEnergy: 5 }
    const result = playCard(player, 0, 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.player.field[0]?.canAttack).toBe(true)
  })

  it('돌진 없는 카드는 소환 시 canAttack=false', () => {
    const hand = [W01] // 돌진 없음
    const player: PlayerState = { ...makePlayer([], hand), currentEnergy: 5 }
    const result = playCard(player, 0, 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.player.field[0]?.canAttack).toBe(false)
  })
})

describe('playCard() — 효과 카드', () => {
  it('효과 카드 플레이 성공 시 묘지에 추가', () => {
    const hand = [F02] // 불꽃 화살 (주문)
    const player: PlayerState = { ...makePlayer([], hand), currentEnergy: 5 }
    const result = playCard(player, 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.player.hand.length).toBe(0)
    expect(result.player.graveyard.length).toBe(1)
  })
})

// ────────────────────────────────────────────────────
// 덱 소진 시나리오 통합 검증
// ────────────────────────────────────────────────────

// ────────────────────────────────────────────────────
// 전투 페이즈 — 키워드 상호작용
// ────────────────────────────────────────────────────

/** 전투 페이즈 테스트용 GameState 헬퍼 */
function makeGameState(
  playerField: (FieldUnit | null)[],
  aiField: (FieldUnit | null)[],
  playerHp = 30,
  aiHp = 30,
): GameState {
  const basePlayer: PlayerState = {
    hero: HEROES.fire_hero,
    currentHp: playerHp,
    deck: [],
    hand: [],
    graveyard: [],
    field: [...playerField, ...Array(4 - playerField.length).fill(null)] as PlayerState['field'],
    currentEnergy: 5,
    fatigue: createInitialFatigue(),
  }
  const baseAi: PlayerState = {
    hero: HEROES.earth_hero,
    currentHp: aiHp,
    deck: [],
    hand: [],
    graveyard: [],
    field: [...aiField, ...Array(4 - aiField.length).fill(null)] as PlayerState['field'],
    currentEnergy: 5,
    fatigue: createInitialFatigue(),
  }
  return {
    turn: 3,
    phase: 'combat',
    player: basePlayer,
    ai: baseAi,
    result: null,
    log: [],
    currentCombo: { element: null, count: 0 },
  }
}

/** 공격 가능한 FieldUnit 생성 헬퍼 */
function makeUnit(card: SoldierCard, overrides?: Partial<FieldUnit>): FieldUnit {
  return {
    card,
    currentHealth: card.maxHealth,
    currentAttack: card.attack,
    canAttack: true,
    frozen: false,
    rebornUsed: false,
    summonedOnTurn: 1,
    temporaryKeywords: [],
    ...overrides,
  }
}

/** 테스트 전용 카드 팩토리 */
function makeSoldierCard(id: string, keywords: SoldierCard['keywords']): SoldierCard {
  return {
    id,
    name: `테스트유닛-${id}`,
    cost: 1,
    element: '火',
    rarity: 'common',
    cardType: 'soldier',
    attack: 3,
    maxHealth: 3,
    keywords,
    flavorText: '테스트용',
  }
}

describe('executeCombatPhase() — 관통(pierce) vs 도발(taunt)', () => {
  it('관통 유닛은 상대 도발 유닛이 있어도 영웅을 직접 타격한다', () => {
    // G01: 관통 키워드, 공격력 3
    const pierceUnit = makeUnit(G01)
    // T01: 도발 키워드, 체력 5
    const tauntUnit = makeUnit(T01, { canAttack: false })

    const state = makeGameState([pierceUnit], [tauntUnit], 30, 30)
    const result = executeCombatPhase(state, true)

    // 영웅 HP가 감소해야 함 (관통이 도발을 무시하고 영웅 직격)
    expect(result.ai.currentHp).toBeLessThan(30)
    // 도발 유닛은 피해를 받지 않아야 함 (체력 유지)
    expect(result.ai.field[0]?.currentHealth).toBe(T01.maxHealth)
  })

  it('관통 없는 유닛은 도발 유닛이 있을 때 도발 유닛을 공격한다', () => {
    // F01: 돌진 있지만 관통 없음, 공격력 2
    const normalUnit = makeUnit(F01)
    const tauntUnit = makeUnit(T01, { canAttack: false })

    const state = makeGameState([normalUnit], [tauntUnit], 30, 30)
    const result = executeCombatPhase(state, true)

    // 영웅 HP는 유지
    expect(result.ai.currentHp).toBe(30)
    // 도발 유닛이 피해를 받아야 함
    const defUnit = result.ai.field[0]
    expect(defUnit?.currentHealth).toBeLessThan(T01.maxHealth)
  })
})

describe('executeCombatPhase() — 소각(incinerate) + 부활(reborn) 상호작용', () => {
  it('소각 유닛이 부활 유닛을 처치하면 부활이 발동하지 않는다', () => {
    const incUnit = makeUnit(makeSoldierCard('inc-1', ['incinerate']), { currentAttack: 5 })
    const rebornUnit = makeUnit(
      makeSoldierCard('reborn-1', ['reborn']),
      { currentHealth: 3, canAttack: false },
    )

    const state = makeGameState([incUnit], [rebornUnit], 30, 30)
    const result = executeCombatPhase(state, true)

    // 부활 발동 안 됨 → 슬롯 null
    expect(result.ai.field[0]).toBeNull()
  })

  it('소각으로 처치된 유닛은 묘지에 추가되지 않는다', () => {
    const incUnit = makeUnit(makeSoldierCard('inc-2', ['incinerate']), { currentAttack: 5 })
    const rebornUnit = makeUnit(
      makeSoldierCard('reborn-2', ['reborn']),
      { currentHealth: 3, canAttack: false },
    )

    const state = makeGameState([incUnit], [rebornUnit], 30, 30)
    const result = executeCombatPhase(state, true)

    // 소각 처리 → 묘지에 없음
    expect(result.ai.graveyard.length).toBe(0)
  })
})

describe('executeCombatPhase() — 정상 사망 시 묘지 처리', () => {
  it('일반 사망 유닛은 묘지에 정확히 추가된다', () => {
    // 공격력 10으로 즉사 보장
    const strongUnit = makeUnit(makeSoldierCard('strong-1', []), { currentAttack: 10 })
    const weakUnit = makeUnit(
      makeSoldierCard('weak-1', []),
      { currentHealth: 1, canAttack: false },
    )

    const state = makeGameState([strongUnit], [weakUnit])
    const result = executeCombatPhase(state, true)

    // 사망 유닛이 묘지에 있어야 함
    expect(result.ai.graveyard.length).toBe(1)
    expect(result.ai.graveyard[0].id).toBe('weak-1')
  })

  it('소각이 아닌 일반 처치 후 부활 유닛은 묘지에 없다 (부활로 살아남음)', () => {
    const normalUnit = makeUnit(makeSoldierCard('normal-1', []), { currentAttack: 5 })
    const rebornUnit = makeUnit(
      makeSoldierCard('reborn-3', ['reborn']),
      { currentHealth: 3, canAttack: false },
    )

    const state = makeGameState([normalUnit], [rebornUnit])
    const result = executeCombatPhase(state, true)

    // 부활 발동 → 슬롯에 살아있음
    expect(result.ai.field[0]).not.toBeNull()
    expect(result.ai.field[0]?.currentHealth).toBe(1)
    // 부활 중이므로 묘지에 없음
    expect(result.ai.graveyard.length).toBe(0)
  })
})

// ────────────────────────────────────────────────────
// 덱 소진 시나리오 통합 검증
// ────────────────────────────────────────────────────

describe('덱 소진 시나리오 — 20장 덱 턴7 소진 검증', () => {
  it('20장 덱에서 3장/턴 드로우 시 턴7에 덱 소진', () => {
    let player = makePlayer(createFireStarterDeck())
    expect(player.deck.length).toBe(20)

    // 턴 1~6: 각 3장 드로우 (18장 소진)
    for (let turn = 1; turn <= 6; turn++) {
      const result = executeDraw(player, turn)
      player = result.player
    }

    // 턴 6 종료 시: 20 - 18 = 2장 잔여
    expect(player.deck.length).toBe(2)
    expect(player.fatigue.deckExhausted).toBe(false)

    // 턴 7: 2장 드로우 후 덱 소진 → count=0, 피해 없음 (결정문 §1-3: 소진 턴은 피해 없음)
    const turn7Result = executeDraw(player, 7)
    player = turn7Result.player

    expect(player.deck.length).toBe(0)
    expect(turn7Result.drawnCount).toBe(2) // 2장만 드로우 가능
    expect(player.fatigue.deckExhausted).toBe(true)
    expect(player.fatigue.exhaustedTurnsCount).toBe(0) // 소진 직후 — 아직 피해 없음
    expect(turn7Result.fatigueDamage).toBe(0) // 소진 턴 자체는 피해 없음

    // 턴 8: 소진 후 1번째 턴 → Fatigue 1 피해 (결정문 §1-3 표: turn8=1피해)
    const turn8Result = executeDraw(player, 8)
    player = turn8Result.player

    expect(player.fatigue.deckExhausted).toBe(true)
    expect(player.fatigue.exhaustedTurnsCount).toBe(1)
    expect(turn8Result.fatigueDamage).toBe(1)
    expect(player.currentHp).toBe(30 - 1)

    // 턴 9: 소진 후 2번째 턴 → 2 피해 (누적 3)
    const turn9Result = executeDraw(player, 9)
    player = turn9Result.player

    expect(player.fatigue.exhaustedTurnsCount).toBe(2)
    expect(turn9Result.fatigueDamage).toBe(2)
    expect(player.currentHp).toBe(30 - 1 - 2)
  })
})
