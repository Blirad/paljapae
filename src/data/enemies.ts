/**
 * 운명카드전 — 적 데이터 정의
 *
 * Phase 2 — EnemyDef + EnemyMove 패턴 데이터
 *
 * 구성:
 *   - 일반 적 6종 (챕터 1)
 *   - 엘리트 적 3종
 *   - 보스 2종 (챕터 1 보스 + 운명황제)
 */

import type { EnemyDef, EnemyMove, EnemyState, PlayerState, BattleAction, BuffId } from '@/types/stsTypes'

// ─── 행동 팩토리 헬퍼 ─────────────────────────────────

function attackMove(damage: number): EnemyMove {
  return {
    intent: { type: 'attack', damage },
    execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
      { type: 'damage', target: 'player', amount: damage },
    ],
  }
}

function defendMove(block: number): EnemyMove {
  return {
    intent: { type: 'defend', block },
    execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
      { type: 'block', target: 'enemy', amount: block },
    ],
  }
}

function buffEnemyMove(buffId: BuffId, amount: number): EnemyMove {
  return {
    intent: { type: 'buff' },
    execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
      { type: 'applyBuff', target: 'enemy', buffId, amount },
    ],
  }
}

function attackDebuffMove(damage: number, buffId: BuffId, buffAmount: number, duration: number): EnemyMove {
  return {
    intent: { type: 'attackDebuff', damage },
    execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
      { type: 'damage', target: 'player', amount: damage },
      { type: 'applyBuff', target: 'player', buffId, amount: buffAmount, duration },
    ],
  }
}

function poisonAttackMove(damage: number, poisonStacks: number): EnemyMove {
  return {
    intent: { type: 'attackDebuff', damage },
    execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
      { type: 'damage', target: 'player', amount: damage },
      { type: 'applyBuff', target: 'player', buffId: 'poison', amount: poisonStacks },
    ],
  }
}

// ─── 일반 적 6종 (챕터 1) ─────────────────────────────

/** 木 계열 1: 청룡 병사 — 기본 공격/방어 패턴 */
export const ENEMY_QINGLONG_SOLDIER: EnemyDef = {
  id: 'qinglong_soldier',
  name: '청룡 병사',
  maxHp: 30,
  element: '木',
  icon: '🐉',
  patternType: 'sequential',
  moves: [
    attackMove(8),
    attackMove(8),
    defendMove(6),
  ],
}

/** 木 계열 2: 목신 술사 — 독+공격 조합, 가중치 랜덤 */
export const ENEMY_WOOD_SHAMAN: EnemyDef = {
  id: 'wood_shaman',
  name: '목신 술사',
  maxHp: 25,
  element: '木',
  icon: '🌿',
  patternType: 'random_weighted',
  weights: [3, 2, 2],
  moves: [
    poisonAttackMove(5, 2),
    attackMove(8),
    defendMove(5),
  ],
}

/** 火 계열 1: 화염 무사 — 강한 단타 공격 */
export const ENEMY_FLAME_WARRIOR: EnemyDef = {
  id: 'flame_warrior',
  name: '화염 무사',
  maxHp: 35,
  element: '火',
  icon: '🔥',
  patternType: 'sequential',
  moves: [
    attackMove(10),
    defendMove(8),
    attackMove(12),
  ],
}

/** 火 계열 2: 봉황 근위대 — 힘 버프 후 공격 */
export const ENEMY_PHOENIX_GUARD: EnemyDef = {
  id: 'phoenix_guard',
  name: '봉황 근위대',
  maxHp: 32,
  element: '火',
  icon: '🦅',
  patternType: 'sequential',
  moves: [
    buffEnemyMove('strength', 2),
    attackMove(10),
    attackMove(10),
  ],
}

/** 土 계열: 황토 골렘 — 블록+반격 스타일 */
export const ENEMY_EARTH_GOLEM: EnemyDef = {
  id: 'earth_golem',
  name: '황토 골렘',
  maxHp: 40,
  element: '土',
  icon: '🏔️',
  patternType: 'sequential',
  moves: [
    defendMove(10),
    attackMove(9),
    defendMove(8),
  ],
}

/** 金 계열: 철갑 검사 — 취약 디버프+공격 */
export const ENEMY_IRON_SWORDSMAN: EnemyDef = {
  id: 'iron_swordsman',
  name: '철갑 검사',
  maxHp: 28,
  element: '金',
  icon: '⚔️',
  patternType: 'sequential',
  moves: [
    attackDebuffMove(7, 'vulnerable', 1, 2),
    attackMove(10),
    attackMove(8),
  ],
}

/** 水 계열: 심류 어인 — 약화+공격 조합 */
export const ENEMY_WATER_SPECTER: EnemyDef = {
  id: 'water_specter',
  name: '심류 어인',
  maxHp: 27,
  element: '水',
  icon: '💧',
  patternType: 'random_weighted',
  weights: [3, 3, 1],
  moves: [
    attackDebuffMove(6, 'weak', 1, 2),
    attackMove(9),
    defendMove(7),
  ],
}

// ─── 엘리트 적 3종 ────────────────────────────────────

/** 木 엘리트: 산림 장로 — 독+공격 조합, HP 80 */
export const ENEMY_FOREST_ELDER: EnemyDef = {
  id: 'forest_elder',
  name: '산림 장로',
  maxHp: 80,
  element: '木',
  icon: '🌳',
  patternType: 'sequential',
  moves: [
    poisonAttackMove(8, 3),
    {
      intent: { type: 'buff' },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'applyBuff', target: 'enemy', buffId: 'ritual', amount: 1 },
        { type: 'applyBuff', target: 'player', buffId: 'poison', amount: 2 },
      ],
    },
    attackMove(14),
    poisonAttackMove(6, 4),
  ],
}

/** 火 엘리트: 홍련 장군 — 힘 버프+광역 공격, HP 90 */
export const ENEMY_RED_LOTUS_GENERAL: EnemyDef = {
  id: 'red_lotus_general',
  name: '홍련 장군',
  maxHp: 90,
  element: '火',
  icon: '🔴',
  patternType: 'sequential',
  moves: [
    {
      intent: { type: 'attackBuff', damage: 8 },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'applyBuff', target: 'enemy', buffId: 'strength', amount: 3 },
        { type: 'damage', target: 'player', amount: 8 },
      ],
    },
    attackMove(15),
    attackMove(15),
    buffEnemyMove('strength', 2),
    attackMove(18),
  ],
}

/** 水 엘리트: 심해 용왕 — 블록+반격, HP 85 */
export const ENEMY_DEEP_SEA_DRAGON: EnemyDef = {
  id: 'deep_sea_dragon',
  name: '심해 용왕',
  maxHp: 85,
  element: '水',
  icon: '🐲',
  patternType: 'sequential',
  moves: [
    defendMove(15),
    {
      intent: { type: 'attack', damage: 12, isHeavy: true },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'damage', target: 'player', amount: 12 },
        { type: 'applyBuff', target: 'enemy', buffId: 'thorns', amount: 3 },
      ],
    },
    {
      intent: { type: 'attackBuff', damage: 10 },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'damage', target: 'player', amount: 10 },
        { type: 'applyBuff', target: 'enemy', buffId: 'metallicize', amount: 4 },
      ],
    },
    defendMove(12),
  ],
}

// ─── 보스 2종 ─────────────────────────────────────────

/**
 * 챕터 1 보스: 오행황 — HP 150, 3페이즈 패턴
 *
 * 페이즈 구분 (moveIndex 기반):
 *   Phase A (index 0~2): 기본 압박 패턴
 *   Phase B (index 3~5): 강화 패턴 (힘 버프 + 강한 공격)
 *   Phase C (index 6~8): 최후 패턴 (취약 + 연속 공격)
 */
export const ENEMY_FIVE_ELEMENT_EMPEROR: EnemyDef = {
  id: 'five_element_emperor',
  name: '오행황',
  maxHp: 150,
  element: '土',
  icon: '👑',
  patternType: 'sequential',
  moves: [
    // Phase A (index 0~2)
    attackMove(12),
    defendMove(10),
    {
      intent: { type: 'debuff' },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'applyBuff', target: 'player', buffId: 'vulnerable', amount: 1, duration: 2 },
        { type: 'applyBuff', target: 'player', buffId: 'weak', amount: 1, duration: 2 },
      ],
    },
    // Phase B (index 3~5)
    {
      intent: { type: 'attackBuff', damage: 15 },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'applyBuff', target: 'enemy', buffId: 'strength', amount: 3 },
        { type: 'damage', target: 'player', amount: 15 },
      ],
    },
    attackMove(20),
    {
      intent: { type: 'attack', damage: 10, isHeavy: true },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'damage', target: 'player', amount: 10 },
        { type: 'damage', target: 'player', amount: 10 },
      ],
    },
    // Phase C (index 6~8)
    attackDebuffMove(18, 'vulnerable', 2, 3),
    attackMove(25),
    {
      intent: { type: 'attackBuff', damage: 20 },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'applyBuff', target: 'enemy', buffId: 'strength', amount: 4 },
        { type: 'damage', target: 'player', amount: 20 },
      ],
    },
  ],
}

/**
 * 최종 보스: 운명황제 — HP 250, 3페이즈 패턴
 *
 * 페이즈 구분 (moveIndex 기반):
 *   Phase A (index 0~3): 압박 패턴
 *   Phase B (index 4~7): 강화 패턴 (독 + 버프 + 강타)
 *   Phase C (index 8~10): 분노 패턴 (연속 강공)
 */
export const ENEMY_FATE_EMPEROR: EnemyDef = {
  id: 'fate_emperor',
  name: '운명황제',
  maxHp: 250,
  element: '金',
  icon: '⚡',
  patternType: 'sequential',
  moves: [
    // Phase A (index 0~3)
    attackMove(15),
    {
      intent: { type: 'buff' },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'applyBuff', target: 'enemy', buffId: 'ritual', amount: 2 },
        { type: 'applyBuff', target: 'enemy', buffId: 'metallicize', amount: 5 },
      ],
    },
    attackDebuffMove(18, 'vulnerable', 2, 3),
    {
      intent: { type: 'attack', damage: 12, isHeavy: true },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'damage', target: 'player', amount: 12 },
        { type: 'damage', target: 'player', amount: 12 },
      ],
    },
    // Phase B (index 4~7)
    {
      intent: { type: 'attackDebuff', damage: 10 },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'damage', target: 'player', amount: 10 },
        { type: 'applyBuff', target: 'player', buffId: 'poison', amount: 5 },
      ],
    },
    buffEnemyMove('strength', 5),
    attackMove(25),
    attackDebuffMove(20, 'weak', 2, 3),
    // Phase C (index 8~10)
    attackMove(30),
    {
      intent: { type: 'attackBuff', damage: 22 },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'applyBuff', target: 'enemy', buffId: 'strength', amount: 6 },
        { type: 'damage', target: 'player', amount: 22 },
      ],
    },
    {
      intent: { type: 'attack', damage: 18, isHeavy: true },
      execute: (_ctx: { enemy: EnemyState; player: PlayerState }): BattleAction[] => [
        { type: 'damage', target: 'player', amount: 18 },
        { type: 'damage', target: 'player', amount: 18 },
        { type: 'damage', target: 'player', amount: 18 },
      ],
    },
  ],
}

// ─── 전체 적 목록 ─────────────────────────────────────

/** 일반 적 6종 (水 계열 포함 총 7개 항목이나 NORMAL_ENEMIES는 챕터 1 6종) */
export const NORMAL_ENEMIES: EnemyDef[] = [
  ENEMY_QINGLONG_SOLDIER,
  ENEMY_WOOD_SHAMAN,
  ENEMY_FLAME_WARRIOR,
  ENEMY_PHOENIX_GUARD,
  ENEMY_EARTH_GOLEM,
  ENEMY_IRON_SWORDSMAN,
  ENEMY_WATER_SPECTER,
]

/** 엘리트 적 3종 */
export const ELITE_ENEMIES: EnemyDef[] = [
  ENEMY_FOREST_ELDER,
  ENEMY_RED_LOTUS_GENERAL,
  ENEMY_DEEP_SEA_DRAGON,
]

/** 보스 2종 */
export const BOSS_ENEMIES: EnemyDef[] = [
  ENEMY_FIVE_ELEMENT_EMPEROR,
  ENEMY_FATE_EMPEROR,
]

/** 전체 12종 (일반 7 + 엘리트 3 + 보스 2) */
export const ALL_ENEMIES: EnemyDef[] = [
  ...NORMAL_ENEMIES,
  ...ELITE_ENEMIES,
  ...BOSS_ENEMIES,
]

/** id로 EnemyDef 검색 */
export function getEnemyDef(id: string): EnemyDef | undefined {
  return ALL_ENEMIES.find(e => e.id === id)
}
