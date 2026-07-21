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

export type RoyalType = 'king' | 'queen'

export interface Card {
  id: string
  element: Element
  polarity: Polarity
  value: number       // 2~10 (배치 2 §1: 값1 삭제). 왕·여왕: 10~11 (§2 게이트 확정)
  type: CardType
  rarity: Rarity
  name?: string
  flavorText?: string
  lifesteal?: boolean  // lifesteal: 데미지의 30%를 HP 회복으로 전환
  royalType?: RoyalType  // 배치 2 §2: 왕(양간) / 여왕(음간). 평민=undefined
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
  // 배치 1.5: 강림제 상태
  yongsinDescent?: {
    descentCount: number                  // 이 출정에서 강림 횟수 (2~3)
    slots: number[]                       // 강림 슬롯 인덱스 ([3, 8, 14] 형태)
    usedCount: number                     // 현재까지 사용한 강림 횟수
    pendingDescent: boolean               // 1회 이월 상태 (0단계: 1턴 이월 / B-1: 대기창 활성)
    yongsinAttackCount?: number           // (폐기 예정) B-1 구버전 카운터
    waitWindowRemaining?: number          // B-1 대기창: 남은 공격 수 (3→2→1→0=소멸)
  }
  // 배치 1.5: 레시피 사주별 배율 (출정 시 고정, 런 중 재계산 금지)
  recipeMultipliers?: Record<string, number>   // { fusion_forest: 2.75, fusion_keen: 2.75, ... }
  // Phase 1.9.6 신규 — 유물 시스템
  relics: Relic[]                         // 획득한 유물 목록 (런 한정 특수 효과)
  // T17: 가호(십성) 시스템 — 선택된 패시브 ID 목록
  activePassiveIds?: string[]             // 장착 가호 ID (런 내내 유지, 없으면 빈 배열)
  // R4: 상관(傷官) 출정당 발동 횟수 추적
  sanggwanUsed?: number                   // 현재 출정에서 상관 발동 횟수 (층 전환 시 리셋)
  // sikshin D안: 버리기 사용 시 다음 공격 +15% (1회 소모, 스택 불가 갱신 가능)
  sikshinDiscardBonus?: boolean           // true = 다음 공격에 ×1.15 적용 후 false로 리셋
  // R10: 겁재(劫財) 출정당 1회 제한 추적
  // 2026-07-18: α 수확 체감 — gather5 반복 발동 시 배율 체감
  gatherUsedInBattle?: number  // 현재 전투에서 gather5 발동 횟수 (전투 종료 시 리셋)
  geoptaeUsed?: boolean                   // true = 겁재 첫 공격 가산 소비됨 (층마다 리셋)
  // B1-1: 잔불(들불 재정의) 상태
  emberDamagePerTurn?: number              // 잔불 턴당 고정 피해 (0 = 비활성)
  emberTurnsLeft?: number                  // 잔불 남은 턴 수
  // B1-1: 정화 면역 상태
  purificationImmune?: boolean             // true = 출정 내 기세 죽음 재발 면역
  // 배치 2 §1: 가호 v2 신규 필드
  rngState: number                         // 결정론 LCG 시드 상태 (확률 효과 재현성)
  geoptaeStealDamage: number               // 겁재 성공 시 첫 공격 가산값 (전투 시작 시 계산)
  sikshinRicegrains: number                // 식신 밥알 누적 (버린 카드 수, 층마다 리셋)
  bigyeonCopyUsed: boolean                 // 비견 이번 전투 첫 융합 복제 사용 여부 (층마다 리셋)
  jeonginUsed: boolean                     // 정인 사망 가로채기 사용 여부 (런 내내 유지)
  jeonginBuff: boolean                     // 정인 다음 융합 ×1.5 버프 (발동 후 소비)
  pyeongwanActivationsThisTurn?: number    // 배치 2 §1: 편관 이번 턴 발동 횟수 (최대 1, 턴당 1회 제한)
  // §3 신살(驛馬·華蓋) 상태 — 보상 3택으로 획득, 기본 탑재 금지
  yeokmaCharges?: number    // 역마 남은 발동 횟수 (런 스코프, 초기 3회)
  hwagaeApplied?: boolean   // 화개 부여 여부 (런 영구, 최고값 카드에 1회 부여)
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
