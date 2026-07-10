/**
 * 팔자전 — 게임 타입 정의
 * CardType: soldier(졸) / commander(장수) / spell(술법)
 * Rarity: 6단계
 */

export type Element = 'mok' | 'hwa' | 'to' | 'geum' | 'su'  // 목화토금수
export type Polarity = 'yang' | 'yin'  // 양음
export type CardType = 'soldier' | 'commander' | 'spell'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'celestial'

export interface Card {
  id: string
  element: Element
  polarity: Polarity
  value: number       // 1~10
  type: CardType
  rarity: Rarity
  name?: string
  flavorText?: string
  lifesteal?: boolean  // lifesteal: 데미지의 30%를 HP 회복으로 전환
}

export type HandRank =
  | 'ohang-yeonhwan'  // 오행연환 — 오행 전부 + 극/상생 완전 순환
  | 'saengchae-chain' // 상생 4체인
  | 'geukchae-chain'  // 극 체인 3단
  | 'eumyang-pair-3'  // 음양쌍 × 3
  | 'jipgyeol-5'      // 결집 5동류
  | 'saengchae-3'     // 상생 3체인
  | 'eumyang-pair-2'  // 음양쌍 × 2
  | 'jipgyeol-4'      // 결집 4동류
  | 'geuk-bonas'      // 극 보너스 (단독 극)
  | 'eumyang-pair-1'  // 음양쌍 × 1
  | 'jipgyeol-3'      // 결집 3동류
  | 'none'            // 해당 없음

export interface HandJudgeResult {
  rank: HandRank
  baseScore: number
  multiplier: number
  totalScore: number
  description: string
}

export type EnemyGimmickEffect =
  | { type: 'seal-passives'; count: number }
  | { type: 'counter-boost'; pct: number }
  | { type: 'discard-punish'; damage: number }
  | { type: 'damage-reduction'; pct: number }
  | { type: 'rage'; counterMult: number }

export interface FloorConfig {
  floor: number
  enemyName: string
  enemyHp: number
  counterDamage: number
  maxPlays: number
  // Phase 1.7 신규
  enemyPrimaryElement: Element
  enemySubElement: Element
  enemyGimmick?: string
  eliteGimmickEffect?: EnemyGimmickEffect
  bossExtraGimmick?: EnemyGimmickEffect
  forcePhaseSwitch?: { hpPct: number }
  heavyAttack?: { everyN: number; damage: number }
}

export interface GameState {
  currentFloor: number
  playerHp: number
  playerMaxHp: number
  enemyHp: number
  enemyMaxHp: number
  hand: Card[]
  deck: Card[]
  discardPile: Card[]
  selectedCards: string[]  // card ids
  discardsLeft: number
  playsLeft: number
  phase: 'draw' | 'select' | 'play' | 'enemy' | 'floor-reward' | 'result'
  isVictory: boolean
  floorsCleared: number
  // Phase 1.6 B — 부적술
  talismans: string[]       // 보유 부적 id 목록 (TalismanId[])
  amplifyActive: boolean    // 증폭부 발동 중 (다음 공격 ×2)
  // Phase 1.7 신규
  attackCount: number       // 내가 공격한 총 횟수 (강공 카운터)
  enemyPhaseSwitch: boolean // 기운 전환 발동 여부 (1회만)
}

export type FortuneLevel = 'daegil' | 'gil' | 'pyeong' | 'hyung' | 'daehyung'

export interface DailyFortune {
  level: FortuneLevel
  description: string
}

export interface SajuInfo {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour?: number
  isLunar: boolean
  gender?: 'male' | 'female'
}

/** localStorage 저장 영웅 프로필 키 */
export const HERO_PROFILE_STORAGE_KEY = 'paljajeon_hero_profile'

/** localStorage 영구 저장 데이터 구조 */
export interface SavedHeroProfile {
  sajuInfo: SajuInfo
  dayPillarChar: string     // 예: 壬寅
  ilganChar: string         // 일간 한자 (甲~癸)
  ilganElement: Element     // 일간 오행
  iljiChar: string          // 일지 한자 (子~亥)
  elementDist: Record<Element, number>
  deckSeed: number
  savedAt: string           // ISO timestamp
}
