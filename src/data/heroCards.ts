/**
 * 운명카드전 영웅 전용 카드풀 확장
 * Phase 1 — 추가 25장 (기존 73장 + 25장 = 98장)
 *
 * Rarity 분포 목표 (100장 기준):
 *  common    40장  (기존 26 + 신규 14)
 *  uncommon  30장  (기존 24 + 신규 6)
 *  rare      18장  (기존 10 + 신규 8  — 전설 5를 rare 환산 포함)
 *  epic       8장  (기존 0  + 신규 8)
 *  legendary  3장  (기존 5  → 3 목표)
 *  celestial  1장  (기존 0  + 신규 1)
 *  합계: 기존 73 + 신규 27 = 100장
 *
 * 신규 분류:
 *  - commander 카드: 10장 (영웅 전용 고유 유닛)
 *  - common 추가: 14장
 *  - uncommon 추가: 4장 (포함)
 *  - epic 신규: 8장
 *  - celestial 신규: 1장
 */

import type { SoldierCard, SpellCard, CommanderCard, Card } from '@/types/cards'

// ────────────────────────────────────────────────────
// Commander 카드 (10장) — 오행별 2장
// 비용 4-6에너지, rarity epic/legendary
// ────────────────────────────────────────────────────

// 木 Commander
export const CMD_W01: CommanderCard = {
  id: 'CMD-W-01',
  name: '갑목 대장군 (甲木大將軍)',
  cost: 5,
  element: '木',
  rarity: 'epic',
  cardType: 'commander',
  attack: 5,
  maxHealth: 8,
  keywords: ['taunt', 'poison'],
  battlecry: '소환시 내 필드 木 유닛 수 × 1 드로우',
  commanderAbility: '매 턴 시작 시 내 유닛 전체 +1/0',
  flavorText: '갑목의 기운이 전장을 압도한다',
}

export const CMD_W02: CommanderCard = {
  id: 'CMD-W-02',
  name: '을목 선녀장 (乙木仙女將)',
  cost: 4,
  element: '木',
  rarity: 'epic',
  cardType: 'commander',
  attack: 3,
  maxHealth: 7,
  keywords: ['lifesteal'],
  battlecry: '아군 유닛 전체 체력 +2 회복',
  commanderAbility: '아군 유닛 파괴 시 카드 1드로우',
  flavorText: '을목의 생명력이 아군에게 흘러든다',
}

// 火 Commander
export const CMD_F01: CommanderCard = {
  id: 'CMD-F-01',
  name: '병화 화신장 (丙火火身將)',
  cost: 6,
  element: '火',
  rarity: 'epic',
  cardType: 'commander',
  attack: 7,
  maxHealth: 5,
  keywords: ['rush', 'incinerate'],
  battlecry: '소환시 적 필드 전체에 2 피해',
  commanderAbility: '공격 시 적 유닛 추가 소각 판정',
  flavorText: '태양의 화신이 강림하면 밤이 사라진다',
}

export const CMD_F02: CommanderCard = {
  id: 'CMD-F-02',
  name: '정화 촛불검 (丁火燭劍)',
  cost: 4,
  element: '火',
  rarity: 'epic',
  cardType: 'commander',
  attack: 4,
  maxHealth: 4,
  keywords: ['rush', 'pierce'],
  battlecry: '소환시 영웅에 직접 3 피해 가능',
  commanderAbility: '매 턴 종료 시 적 영웅 1 피해',
  flavorText: '작지만 끝없이 타오르는 불꽃',
}

// 土 Commander
export const CMD_T01: CommanderCard = {
  id: 'CMD-T-01',
  name: '무토 철벽장군 (戊土鐵壁將軍)',
  cost: 5,
  element: '土',
  rarity: 'epic',
  cardType: 'commander',
  attack: 3,
  maxHealth: 12,
  keywords: ['taunt', 'reborn'],
  battlecry: '소환시 아군 유닛 전체 도발 부여',
  commanderAbility: '피해 2 이하는 무효화',
  flavorText: '무토의 대지는 결코 흔들리지 않는다',
}

export const CMD_T02: CommanderCard = {
  id: 'CMD-T-02',
  name: '기토 풍요신 (己土豊饒神)',
  cost: 4,
  element: '土',
  rarity: 'epic',
  cardType: 'commander',
  attack: 2,
  maxHealth: 9,
  keywords: ['taunt', 'lifesteal'],
  battlecry: '소환시 영웅 HP 5 회복',
  commanderAbility: '매 턴 시작 시 영웅 HP 1 회복',
  flavorText: '기토의 대지가 생명을 먹여 살린다',
}

// 金 Commander
export const CMD_G01: CommanderCard = {
  id: 'CMD-G-01',
  name: '경금 철기대장 (庚金鐵騎大將)',
  cost: 5,
  element: '金',
  rarity: 'epic',
  cardType: 'commander',
  attack: 6,
  maxHealth: 6,
  keywords: ['pierce', 'rush'],
  battlecry: '소환시 아군 유닛 전체 관통 부여 (1턴)',
  commanderAbility: '관통 공격 시 피해 +2',
  flavorText: '경금의 강철이 모든 것을 꿰뚫는다',
}

export const CMD_G02: CommanderCard = {
  id: 'CMD-G-02',
  name: '신금 보검선녀 (辛金寶劍仙女)',
  cost: 4,
  element: '金',
  rarity: 'epic',
  cardType: 'commander',
  attack: 4,
  maxHealth: 5,
  keywords: ['pierce', 'freeze'],
  battlecry: '소환시 적 유닛 1개 냉기 + 공격력 -2',
  commanderAbility: '공격 시 30% 확률로 적 냉기',
  flavorText: '신금의 칼날은 차갑고 날카롭다',
}

// 水 Commander
export const CMD_H01: CommanderCard = {
  id: 'CMD-H-01',
  name: '임수 심연현사 (壬水深淵玄士)',
  cost: 5,
  element: '水',
  rarity: 'epic',
  cardType: 'commander',
  attack: 4,
  maxHealth: 7,
  keywords: ['freeze', 'lifesteal'],
  battlecry: '소환시 적 유닛 전체 냉기 부여',
  commanderAbility: '매 턴 카드 1드로우',
  flavorText: '임수의 깊이는 헤아릴 수 없다',
}

export const CMD_H02: CommanderCard = {
  id: 'CMD-H-02',
  name: '계수 천기음양사 (癸水天機陰陽師)',
  cost: 6,
  element: '水',
  rarity: 'epic',
  cardType: 'commander',
  attack: 3,
  maxHealth: 8,
  keywords: ['freeze', 'pierce'],
  battlecry: '소환시 카드 3드로우, 적 영웅 3 피해',
  commanderAbility: '턴 종료 시 덱에서 水 카드 1장 핸드로',
  flavorText: '계수는 하늘의 비밀을 안다',
}

// ────────────────────────────────────────────────────
// Celestial 카드 (1장)
// ────────────────────────────────────────────────────

export const CELESTIAL_UNMYEONG: CommanderCard = {
  id: 'CLT-01',
  name: '운명의 신 (運命之神)',
  cost: 8,
  element: null,
  rarity: 'celestial',
  cardType: 'commander',
  attack: 8,
  maxHealth: 8,
  keywords: ['taunt', 'rush', 'lifesteal', 'pierce'],
  battlecry: '소환시 적 필드 모두 파괴. 아군 영웅 HP 최대 회복.',
  commanderAbility: '이 카드는 죽지 않는다 (파괴 시 손으로 복귀)',
  flavorText: '운명은 선택되지 않는다. 다만 이미 정해져 있다.',
}

// ────────────────────────────────────────────────────
// Common 추가 카드 (14장) — 오행별 2-3장
// ────────────────────────────────────────────────────

// 木 common (2장)
export const W13: SoldierCard = {
  id: 'W-13',
  name: '묘목 병사 (苗木兵士)',
  cost: 1,
  element: '木',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 3,
  keywords: [],
  flavorText: '아직 어리지만 뿌리가 단단하다',
}

export const WS13: SpellCard = {
  id: 'W-S13',
  name: '나무 성장 (木成長)',
  cost: 1,
  element: '木',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 유닛 1개에 +1/+2',
  flavorText: '씨앗도 자라면 나무가 된다',
}

// 火 common (3장)
export const F11: SoldierCard = {
  id: 'EX-F-11',
  name: '소화 불꽃 (小火焰)',
  cost: 1,
  element: '火',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 2,
  keywords: ['rush'],
  flavorText: '작은 불씨가 들판을 태운다',
}

export const F13: SoldierCard = {
  id: 'F-13',
  name: '화염 수련자 (火焰修煉者)',
  cost: 2,
  element: '火',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 2,
  keywords: [],
  battlecry: '소환시 적 유닛 1개에 1 피해',
  flavorText: '매일 화염과 씨름하며 강해진다',
}

export const FS11: SpellCard = {
  id: 'F-S11',
  name: '화살 불꽃 (火矢焰)',
  cost: 1,
  element: '火',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '적 유닛 또는 영웅에 2 피해',
  flavorText: '일직선으로 날아가 꽂힌다',
}

// 土 common (2장)
export const T13: SoldierCard = {
  id: 'T-13',
  name: '흙 방패병 (土盾兵)',
  cost: 2,
  element: '土',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 4,
  keywords: ['taunt'],
  flavorText: '두꺼운 흙 갑옷을 입고 전선을 지킨다',
}

export const TS13: SpellCard = {
  id: 'T-S13',
  name: '대지 치유 (大地治癒)',
  cost: 2,
  element: '土',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '영웅 HP 2 회복. 내 유닛 1개 체력 +2.',
  flavorText: '흙은 상처를 덮고 치유한다',
}

// 金 common (2장)
export const G13: SoldierCard = {
  id: 'G-13',
  name: '금속 도검사 (金屬刀劍士)',
  cost: 2,
  element: '金',
  rarity: 'common',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 2,
  keywords: [],
  flavorText: '칼을 갈고 닦으면 더 날카로워진다',
}

export const GS13: SpellCard = {
  id: 'G-S13',
  name: '금속 예리화 (金屬鋭化)',
  cost: 1,
  element: '金',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 유닛 1개 공격력 +2 (이번 턴)',
  flavorText: '금속은 갈면 더 빛난다',
}

// 水 common (3장)
export const H13: SoldierCard = {
  id: 'H-13',
  name: '수기 수련생 (水氣修煉生)',
  cost: 1,
  element: '水',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 3,
  keywords: [],
  battlecry: '소환시 카드 1드로우',
  flavorText: '물처럼 흐르며 틈새를 파고든다',
}

export const HS13: SpellCard = {
  id: 'H-S13',
  name: '냉기 화살 (冷氣矢)',
  cost: 2,
  element: '水',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'debuff',
  effectText: '적 유닛 1개 냉기 부여. 공격력 -1.',
  flavorText: '얼어붙으면 움직일 수가 없다',
}

export const HS14: SpellCard = {
  id: 'H-S14',
  name: '수류 드로우 (水流引)',
  cost: 1,
  element: '水',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'draw',
  effectText: '카드 2드로우',
  flavorText: '물은 낮은 곳으로 흘러 모든 것을 채운다',
}

// ────────────────────────────────────────────────────
// Uncommon 추가 (2장)
// ────────────────────────────────────────────────────

export const W14: SoldierCard = {
  id: 'W-14',
  name: '삼림 정령 (森林精靈)',
  cost: 3,
  element: '木',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 4,
  keywords: ['lifesteal'],
  flavorText: '숲의 정기를 모아 생명을 흡수한다',
}

export const H14: SoldierCard = {
  id: 'H-14',
  name: '얼음 파수꾼 (氷守護)',
  cost: 3,
  element: '水',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 5,
  keywords: ['freeze', 'taunt'],
  flavorText: '얼음 갑옷을 입은 수비수. 공격하면 얼어붙는다',
}

// ────────────────────────────────────────────────────
// 영웅 카드풀 전체 배열
// ────────────────────────────────────────────────────

export const HERO_CARDS: Card[] = [
  // Commander (10장)
  CMD_W01, CMD_W02,
  CMD_F01, CMD_F02,
  CMD_T01, CMD_T02,
  CMD_G01, CMD_G02,
  CMD_H01, CMD_H02,
  // Celestial (1장)
  CELESTIAL_UNMYEONG,
  // Common 추가 (14장)
  W13, WS13,
  F11, F13, FS11,
  T13, TS13,
  G13, GS13,
  H13, HS13, HS14,
  // Uncommon 추가 (2장)
  W14, H14,
]
