/**
 * 팔자전 — 게임 타입 정의
 * CardType: soldier(졸) / commander(장수) / spell(술법)
 * Rarity: 6단계
 */

export type Element = 'mok' | 'hwa' | 'to' | 'geum' | 'su'  // 목화토금수
export type Polarity = 'yang' | 'yin'  // 양음
export type CardType = 'soldier' | 'commander' | 'spell'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'celestial'

export interface Relic {
  id: string
  name: string
  description: string
}

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
  // Phase 1.9 신규 조합 체계
  | 'ohang-yeonhwan'   // 오행연환 — 5기운 모두
  | 'gather'           // 기운 모으기 — 같은 기운 2~5장
  | 'fusion-birth'     // 융합(낳는) — 서로 다른 기운 2장, 배율 ×2.5
  | 'fusion-hone'      // 융합(벼리는) — 서로 다른 기운 2장, 배율 ×3.5
  // Phase 1.8 호환성 (사용 불가, 변경 예정)
  | 'saengchae-chain'  // [deprecated] 상생 4체인
  | 'geukchae-chain'   // [deprecated] 극 체인 3단
  | 'eumyang-pair-3'   // [deprecated] 음양쌍 × 3
  | 'jipgyeol-5'       // [deprecated] 결집 5동류
  | 'saengchae-3'      // [deprecated] 상생 3체인
  | 'eumyang-pair-2'   // [deprecated] 음양쌍 × 2
  | 'jipgyeol-4'       // [deprecated] 결집 4동류
  | 'geuk-bonas'       // [deprecated] 극 보너스 (단독 극)
  | 'eumyang-pair-1'   // [deprecated] 음양쌍 × 1
  | 'jipgyeol-3'       // [deprecated] 결집 3동류
  | 'none'             // 해당 없음

export interface HandJudgeResult {
  rank: HandRank
  baseScore: number
  multiplier: number
  totalScore: number
  description: string
  finishingElement: Element  // 마무리 기운 (Phase 1.8)
  name?: string  // 조합 이름 (Phase 1.9 — 응축 조건 판정용)
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
  // Phase 1.8 신규 (deprecated: condenseActive boolean → Phase 1.9.2에서 v2로 교체)
  condenseActive: boolean   // 하위 호환 필드 (항상 false, v2 필드로 대체됨)
  // Phase 1.9.2 신규 — E-1: 연환 희소화
  yeonhwanUsed: boolean     // 오행연환 출정당 1회 제한 (true = 이미 사용됨)
  // Phase 1.9.5: 응축 확정판 (옹기가마 전용, % 방식)
  condensedMultiplier: number             // 0 = 비활성, 1.2~2.4 = 다음 공격에 적용될 % 배율
  isLastAttack: boolean                   // attacksRemaining === 1 (UI 버튼 비활성 처리용)
  // Phase 1.9.5: 10종 융합 특성
  lastTraitTriggered?: string             // 마지막 발동 특성 ID ('wildfire', 'mining', ...)
  carryoverBurn?: number                  // 번짐 이월 피해 수치
  // R10: 미구현 3종 융합 특성 상태
  purifiedElements?: Element[]            // 정화(샘): 기세 죽음 해제된 원소 목록
  keenActive?: boolean                    // 예리(벼린 검): 다음 극 보너스 ×1.5
  mirrorShieldActive?: boolean            // 비침(맑은 못): 다음 강공 피해 50% 감소
  disabledTraits?: string[]               // R10-5 어블레이션: 비활성화할 특성 ID 목록
  // Phase 1.9.4 신규 — 덱 재순환
  reshuffled: boolean                     // 이번 턴 덱 재순환 발동 여부 (UI 배너용)
  // 스펙 v2 — 용신 원소 (일간 기반 계산)
  favorableElement?: Element              // 플레이어 용신 원소 (없으면 undefined)
  // Phase 1.9.6 신규 — 유물 시스템
  relics: Relic[]                         // 획득한 유물 목록 (런 한정 특수 효과)
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
