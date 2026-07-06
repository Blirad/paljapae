/**
 * 팔자패 — Slay the Spire 클론 타입 시스템
 */

import type { FiveElement } from './elements'

// ─── 버프/디버프 ─────────────────────────────────

export type BuffId =
  | 'strength'      // 공격 데미지 +N
  | 'dexterity'     // 블록 +N
  | 'vulnerable'    // 받는 데미지 50% 증가 (턴 기반)
  | 'weak'          // 주는 데미지 25% 감소 (턴 기반)
  | 'frail'         // 얻는 블록 25% 감소 (턴 기반)
  | 'poison'        // 턴 시작 시 N 데미지, 1 감소
  | 'ritual'        // 턴 종료 시 힘 +N
  | 'metallicize'   // 턴 종료 시 블록 +N
  | 'thorns'        // 공격받을 때 N 반사 데미지
  | 'regen'         // 턴 종료 시 HP +N, 1 감소
  | 'barricade'     // 블록 턴 리셋 안 됨
  | 'elementBoost'  // 오행 보너스 (팔자패 고유)
  | 'phoenixRevive' // 불사조 부활 (HP 0 → 10, 1회)
  | 'bladeDance'    // 공격 사용 시 랜덤적 2 데미지

export interface Buff {
  id: BuffId
  amount: number
  duration?: number  // 턴 기반 디버프 (vulnerable, weak, frail 등)
}

export const BUFF_INFO: Record<BuffId, { name: string; icon: string; isBuff: boolean; description: string }> = {
  strength:      { name: '힘',       icon: '💪', isBuff: true,  description: '공격 데미지 +{N}' },
  dexterity:     { name: '민첩',     icon: '🏃', isBuff: true,  description: '블록 +{N}' },
  vulnerable:    { name: '취약',     icon: '💔', isBuff: false, description: '받는 데미지 50% 증가' },
  weak:          { name: '약화',     icon: '😵', isBuff: false, description: '주는 데미지 25% 감소' },
  frail:         { name: '허약',     icon: '🦴', isBuff: false, description: '얻는 블록 25% 감소' },
  poison:        { name: '독',       icon: '☠️', isBuff: false, description: '턴 시작 시 {N} 데미지' },
  ritual:        { name: '의식',     icon: '🕯️', isBuff: true,  description: '턴 종료 시 힘 +{N}' },
  metallicize:   { name: '금속화',   icon: '🛡️', isBuff: true,  description: '턴 종료 시 블록 +{N}' },
  thorns:        { name: '가시',     icon: '🌵', isBuff: true,  description: '공격받을 때 {N} 반사' },
  regen:         { name: '재생',     icon: '💚', isBuff: true,  description: '턴 종료 시 HP +{N}' },
  barricade:     { name: '바리케이드', icon: '🏰', isBuff: true, description: '블록 유지' },
  elementBoost:  { name: '오행공명', icon: '☯️', isBuff: true,  description: '오행 보너스 +20%' },
  phoenixRevive: { name: '불사조',   icon: '🔥', isBuff: true,  description: 'HP 0 시 HP 10으로 부활' },
  bladeDance:    { name: '검의춤',   icon: '⚔️', isBuff: true,  description: '공격 시 랜덤적 2 데미지' },
}

// ─── 카드 ────────────────────────────────────────

export type CardType = 'attack' | 'skill' | 'power'
export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'curse'

export interface CardEffect {
  type: 'damage' | 'block' | 'applyBuff' | 'draw' | 'gainEnergy' | 'exhaust' | 'heal' | 'selfDamage'
  value: number
  target?: 'enemy' | 'self' | 'all_enemies' | 'random'
  buffId?: BuffId
  times?: number  // 다중 타격
  buffDuration?: number
}

export interface CardDef {
  id: string
  name: string
  cost: number
  type: CardType
  rarity: CardRarity
  element: FiveElement | 'neutral'
  description: string
  effects: CardEffect[]
  upgradedId?: string     // 업그레이드 시 변환 ID
  exhaustOnUse?: boolean  // 사용 후 소멸
  unplayable?: boolean    // 저주: 사용 불가
  icon: string
}

/** 런타임 카드 인스턴스 (같은 CardDef 여러 장 구분용) */
export interface CardInstance {
  instanceId: string  // 유니크 ID (uuid)
  defId: string       // CardDef.id 참조
  upgraded: boolean
}

// ─── 적 ─────────────────────────────────────────

export type IntentType = 'attack' | 'defend' | 'buff' | 'debuff' | 'attackDebuff' | 'attackBuff' | 'unknown'

export interface Intent {
  type: IntentType
  damage?: number
  hits?: number
  block?: number
  isHeavy?: boolean
}

export const INTENT_ICONS: Record<IntentType, string> = {
  attack:       '⚔️',
  defend:       '🛡️',
  buff:         '⬆️',
  debuff:       '⬇️',
  attackDebuff: '⚔️⬇️',
  attackBuff:   '⚔️⬆️',
  unknown:      '❓',
}

export interface EnemyMove {
  intent: Intent
  execute: (ctx: { enemy: EnemyState; player: PlayerState }) => BattleAction[]
}

export interface EnemyDef {
  id: string
  name: string
  maxHp: number
  element: FiveElement | 'neutral'
  icon: string
  moves: EnemyMove[]
  patternType: 'sequential' | 'random_weighted'
  weights?: number[]  // random_weighted 시
}

export interface EnemyState {
  def: EnemyDef
  hp: number
  maxHp: number
  block: number
  buffs: Buff[]
  moveIndex: number
  currentIntent: Intent
}

// ─── 포션 ────────────────────────────────────────

export interface PotionDef {
  id: string
  name: string
  icon: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare'
  execute: (ctx: { player: PlayerState; enemy: EnemyState }) => BattleAction[]
}

// ─── 유물 ────────────────────────────────────────

export interface RelicDef {
  id: string
  name: string
  icon: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'boss'
  // 유물 효과는 엔진 내 하드코딩 (StS 방식)
}

// ─── 플레이어 ────────────────────────────────────

export interface PlayerState {
  hp: number
  maxHp: number
  block: number
  energy: number
  maxEnergy: number
  buffs: Buff[]

  drawPile: CardInstance[]
  hand: CardInstance[]
  discardPile: CardInstance[]
  exhaustPile: CardInstance[]

  relics: string[]        // RelicDef.id 목록
  potions: (string | null)[]  // PotionDef.id 목록, 빈 슬롯은 null

  element: FiveElement
  gold: number
}

// ─── 전투 액션 (엔진 이벤트) ─────────────────────

export type BattleAction =
  | { type: 'damage'; target: 'player' | 'enemy'; amount: number; element?: FiveElement }
  | { type: 'block'; target: 'player' | 'enemy'; amount: number }
  | { type: 'heal'; target: 'player' | 'enemy'; amount: number }
  | { type: 'applyBuff'; target: 'player' | 'enemy'; buffId: BuffId; amount: number; duration?: number }
  | { type: 'draw'; amount: number }
  | { type: 'gainEnergy'; amount: number }
  | { type: 'exhaust'; cardInstanceId: string }
  | { type: 'removeBlock'; target: 'player' | 'enemy' }
  | { type: 'selfDamage'; amount: number }

// ─── 전투 상태 ───────────────────────────────────

export type BattlePhase = 'playerTurn' | 'enemyTurn' | 'victory' | 'defeat' | 'init'

export interface BattleState {
  phase: BattlePhase
  turn: number
  player: PlayerState
  enemy: EnemyState

  // 애니메이션/UI용 로그
  actionLog: BattleLogEntry[]

  // 오행 연속 사용 추적 (상생 보너스)
  lastPlayedElement: FiveElement | null
  sameElementCount: number  // 오행 공명 카운트
}

export interface BattleLogEntry {
  id: string
  message: string
  type: 'damage' | 'block' | 'heal' | 'buff' | 'debuff' | 'info' | 'cardPlay'
  timestamp: number
}

// ─── 데미지 팝업 ─────────────────────────────────

export interface DamagePopup {
  id: string
  amount: number
  type: 'damage' | 'block' | 'heal' | 'poison' | 'buff'
  target: 'player' | 'enemy'
  x: number
  y: number
}
