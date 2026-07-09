// 오행
export type Element = '木' | '火' | '土' | '金' | '水'
// 음양
export type YinYang = '양' | '음'

// 카드 등급
export type CardRarity = 'normal' | 'rare' | 'hero'

// 카드 (속성×음양×값)
export interface PaljapaeCard {
  id: string
  element: Element
  yinYang: YinYang
  value: number  // 1~10
  rarity?: CardRarity  // 기본값 'normal'
}

// 족보 타입 (C-3 전체)
export type HandRank =
  | 'yinYangPair'      // 음양쌍: 같은 오행 음+양 2장
  | 'gather3'          // 결집3: 같은 오행 3장
  | 'gather4'          // 결집4: 같은 오행 4장
  | 'gather5'          // 순수결집5
  | 'chain2'           // 상생2체인
  | 'chain3'           // 상생3체인
  | 'chain4'           // 상생4체인
  | 'fiveElements'     // 오행연환 (최고)
  | 'none'             // 족보 없음

export interface HandResult {
  rank: HandRank
  baseDamage: number    // 기본치 보너스
  multiplier: number    // 배율
  chainElements?: Element[]  // 체인 순서 (빛줄기 연출용)
}

// 전투 상태
export interface BattleState {
  floor: number           // 1~4
  hand: PaljapaeCard[]    // 현재 핸드 (최대 8장)
  deck: PaljapaeCard[]    // 남은 덱
  discarded: PaljapaeCard[] // 버린 카드
  selected: string[]      // 선택된 카드 id
  playerHp: number
  playerMaxHp: number
  enemyHp: number
  enemyMaxHp: number
  enemyName: string
  enemyElement: Element | null  // null = 무속성(명외자)
  playsLeft: number       // 남은 출수 횟수 (최대 4, 보스 5)
  discardsLeft: number    // 남은 버리기 횟수 (최대 3)
  dayElement: Element     // 오늘 일진 속성
  relics: RelicId[]
  passives: PassiveId[]
  score: number           // 누적 피해량
}

// 유물
export type RelicId = 'pacheol' | 'ochsaek' | 'haetae' | 'holibyeong'

// 패시브 (일반 7종)
export type PassiveId =
  | 'sikshin'   // 식신
  | 'bigyeon'   // 비견
  | 'geobje'    // 겁재
  | 'sangkwan'  // 상관
  | 'pyeonjae'  // 편재
  | 'jeongjae'  // 정재
  | 'pyeonin'   // 편인
