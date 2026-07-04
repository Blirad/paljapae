/**
 * 팔자패 6스테이지 데이터 — M4
 * 마스터플랜 §7-4, §8-1 기반
 *
 * Stage 1: 취권 술꾼 (木 AI, 하수)
 * Stage 2: 밥통 백정 (土 AI, 하수)
 * Stage 3: 절연 닌자 (水 AI, 강호인) — 마스터플랜 §8-1과 §7-4 교차 확인, 水로 배정
 * Stage 4: 냉철 검사 (金 AI, 강호인)
 * Stage 5: 오의 사마 = 폭렬 마교주 (火 AI, 고수)
 * Stage 6: 팔황제 (전 오행, 어드밴스드 AI)
 */

import type { FiveElement } from '@/types/elements'
import type { HeroId, AIDifficulty } from '@/types/game'
import type { Card } from '@/types/cards'
import {
  W01, W02, W03, W04, W05, W06, W07, W08, W09, W10,
  F01, F02, F03, F04, F05, F06, F07, F08, F09, F10, F12,
  T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T12,
  G01, G02, G03, G04, G05, G06, G07, G08, G09, G10, G11, G12,
  H01, H02, H03, H04, H05, H06, H07, H08, H09, H10, H11, H12,
  N01, N02, N03, N04,
  LEGEND_WOOD, LEGEND_FIRE, LEGEND_EARTH, LEGEND_METAL, LEGEND_WATER,
} from '@/data/cards'

// ────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────

/** AI 티어 (§7-2) */
export type AITier = 'GRUNT' | 'STRATEGIST' | 'ADVANCED'

/** 클리어 보상 카드 풀 (3종 제시) */
export interface RewardPool {
  cards: Card[]
  description: string
}

/** 스테이지 정의 */
export interface Stage {
  id: number
  /** 보스명 */
  bossName: string
  /** 보스 타이틀 */
  bossTitle: string
  /** 보스 오행 */
  element: FiveElement | 'neutral'
  /** 영웅 ID (AI가 사용할 영웅) */
  aiHeroId: HeroId
  /** 난이도 별점 (1~4) */
  difficulty: 1 | 2 | 3 | 4
  /** AI 티어 */
  aiTier: AITier
  /** AI 난이도 (배틀 엔진용) */
  aiDifficulty: AIDifficulty
  /** AI 영웅 HP 조정 (기본 30에서 가감) */
  aiHpBonus: number
  /** AI 시작 덱 */
  aiDeck: Card[]
  /** 언락 조건: 이전 스테이지 ID 배열 (빈 배열 = 시작부터 해금) */
  unlockRequires: number[]
  /** 클리어 보상 카드 풀 */
  rewardPool: RewardPool
  /** 유머 포인트 */
  humorHint: string
  /** 지역명 */
  region: string
}

// ────────────────────────────────────────────────────
// 헬퍼: 덱 빌드
// ────────────────────────────────────────────────────

function repeat<T>(card: T, times: number): T[] {
  return Array.from({ length: times }, (_, i) => ({
    ...(card as object),
    id: `${(card as { id: string }).id}_ai${i}`,
  })) as T[]
}

// ────────────────────────────────────────────────────
// Stage 1 — 취권 술꾼 (醉拳酒客)
// 木 AI, 하수 (GRUNT), 드로우+버프 전략
// ────────────────────────────────────────────────────

const stage1Deck: Card[] = [
  ...repeat(W01, 3),
  ...repeat(W02, 2),
  ...repeat(W03, 2),
  ...repeat(W05, 3),
  ...repeat(W07, 2),
  ...repeat(W08, 2),
  ...repeat(W06, 1),
  ...repeat(N01, 2),
  ...repeat(N04, 3),
]

const stage1: Stage = {
  id: 1,
  bossName: '취권 술꾼 (醉拳酒客)',
  bossTitle: '만취 강호 초심자',
  element: '木',
  aiHeroId: 'wood_hero',
  difficulty: 1,
  aiTier: 'GRUNT',
  aiDifficulty: 'novice',
  aiHpBonus: -5, // AI HP = 25
  aiDeck: stage1Deck,
  unlockRequires: [],
  rewardPool: {
    cards: [W03, W06, W09],
    description: '木 카드 3종 해금',
  },
  humorHint: '술 냄새가 나는 덱',
  region: '중원 초입',
}

// ────────────────────────────────────────────────────
// Stage 2 — 밥통 백정 (飯桶白丁)
// 土 AI, 하수 (GRUNT), 도발+방어 전략
// ────────────────────────────────────────────────────

const stage2Deck: Card[] = [
  ...repeat(T01, 3),
  ...repeat(T02, 2),
  ...repeat(T03, 2),
  ...repeat(T04, 2),
  ...repeat(T05, 2),
  ...repeat(T06, 2),
  ...repeat(T09, 2),
  ...repeat(N01, 2),
  ...repeat(N02, 2),
  ...repeat(N04, 1),
]

const stage2: Stage = {
  id: 2,
  bossName: '밥통 백정 (飯桶白丁)',
  bossTitle: '철옹성 수비 전문가',
  element: '土',
  aiHeroId: 'earth_hero',
  difficulty: 1,
  aiTier: 'GRUNT',
  aiDifficulty: 'novice',
  aiHpBonus: 0, // AI HP = 30
  aiDeck: stage2Deck,
  unlockRequires: [1],
  rewardPool: {
    cards: [T07, T10, T12],
    description: '土 카드 3종 해금',
  },
  humorHint: '느리지만 안 죽는 남자',
  region: '중원 초입',
}

// ────────────────────────────────────────────────────
// Stage 3 — 절연 닌자 (絶緣忍者)
// 水 AI, 강호인 (STRATEGIST), 콤보+제어 전략
// ────────────────────────────────────────────────────

const stage3Deck: Card[] = [
  ...repeat(H01, 3),
  ...repeat(H02, 2),
  ...repeat(H04, 3),
  ...repeat(H05, 2),
  ...repeat(H07, 2),
  ...repeat(H08, 2),
  ...repeat(H10, 2),
  ...repeat(H12, 2),
  ...repeat(N02, 2),
]

const stage3: Stage = {
  id: 3,
  bossName: '절연 닌자 (絶緣忍者)',
  bossTitle: '물처럼 스며드는 자',
  element: '水',
  aiHeroId: 'water_hero',
  difficulty: 2,
  aiTier: 'STRATEGIST',
  aiDifficulty: 'normal',
  aiHpBonus: 0,
  aiDeck: stage3Deck,
  unlockRequires: [2],
  rewardPool: {
    cards: [H06, H09, H11],
    description: '水 카드 3종 해금',
  },
  humorHint: '그가 언제 움직였는지 모른다',
  region: '서역 사막',
}

// ────────────────────────────────────────────────────
// Stage 4 — 냉철 검사 (冷鐵劍士)
// 金 AI, 강호인 (STRATEGIST), 제거+카운터 전략
// ────────────────────────────────────────────────────

const stage4Deck: Card[] = [
  ...repeat(G01, 2),
  ...repeat(G02, 2),
  ...repeat(G04, 2),
  ...repeat(G05, 2),
  ...repeat(G06, 2),
  ...repeat(G07, 2),
  ...repeat(G09, 2),
  ...repeat(G11, 2),
  ...repeat(G12, 2),
  ...repeat(N03, 2),
]

const stage4: Stage = {
  id: 4,
  bossName: '냉철 검사 (冷鐵劍士)',
  bossTitle: '감정 없는 제거 전문가',
  element: '金',
  aiHeroId: 'metal_hero',
  difficulty: 2,
  aiTier: 'STRATEGIST',
  aiDifficulty: 'normal',
  aiHpBonus: 2, // AI HP = 32 (강호인 약간 강화)
  aiDeck: stage4Deck,
  unlockRequires: [3],
  rewardPool: {
    cards: [G03, G08, G10],
    description: '金 카드 3종 해금 + 덱 편집 해금',
  },
  humorHint: '칼보다 말이 더 날카롭다',
  region: '서역 사막',
}

// ────────────────────────────────────────────────────
// Stage 5 — 오의 사마 (爆裂魔敎主)
// 火 AI, 고수 (ADVANCED), 어그로+버스트 전략
// ────────────────────────────────────────────────────

const stage5Deck: Card[] = [
  ...repeat(F01, 3),
  ...repeat(F02, 2),
  ...repeat(F03, 2),
  ...repeat(F05, 2),
  ...repeat(F06, 2),
  ...repeat(F07, 2),
  ...repeat(F08, 2),
  ...repeat(F09, 1),
  ...repeat(F10, 1),
  ...repeat(F12, 1),
  LEGEND_FIRE,
]

const stage5: Stage = {
  id: 5,
  bossName: '오의 사마 (五義邪魔)',
  bossTitle: '불꽃 어그로의 신',
  element: '火',
  aiHeroId: 'fire_hero',
  difficulty: 3,
  aiTier: 'ADVANCED',
  aiDifficulty: 'expert',
  aiHpBonus: 0,
  aiDeck: stage5Deck,
  unlockRequires: [4],
  rewardPool: {
    cards: [F04, F09, F12],
    description: '火 고급 카드 3종 해금',
  },
  humorHint: '세상이 불타면 내가 이기지',
  region: '북방 빙원',
}

// ────────────────────────────────────────────────────
// Stage 6 — 팔황제 (八皇帝)
// 전 오행, 어드밴스드 AI (최종 보스)
// ────────────────────────────────────────────────────

const stage6Deck: Card[] = [
  // 전 오행 + 전설 카드
  ...repeat(W04, 1),
  ...repeat(F04, 1),
  ...repeat(T08, 1),
  ...repeat(G03, 1),
  ...repeat(H03, 1),
  ...repeat(W09, 1),
  ...repeat(H09, 1),
  ...repeat(G08, 1),
  ...repeat(T07, 1),
  ...repeat(F09, 1),
  ...repeat(W10, 1),
  ...repeat(H06, 1),
  ...repeat(G10, 1),
  LEGEND_WOOD,
  LEGEND_FIRE,
  LEGEND_EARTH,
  LEGEND_METAL,
  LEGEND_WATER,
  ...repeat(N03, 2),
]

const stage6: Stage = {
  id: 6,
  bossName: '팔황제 (八皇帝)',
  bossTitle: '모든 오행의 지배자',
  element: 'neutral',
  aiHeroId: 'fire_hero', // 가장 공격적 영웅으로 보스 구현
  difficulty: 4,
  aiTier: 'ADVANCED',
  aiDifficulty: 'expert',
  aiHpBonus: 5, // AI HP = 35 (최종 보스)
  aiDeck: stage6Deck,
  unlockRequires: [5],
  rewardPool: {
    cards: [LEGEND_WOOD, LEGEND_EARTH, LEGEND_METAL],
    description: '전설 카드 3종 해금',
  },
  humorHint: "운명? 나는 운명을 만드는 자다",
  region: '마교 본산',
}

// ────────────────────────────────────────────────────
// 전체 스테이지 목록
// ────────────────────────────────────────────────────

export const ALL_STAGES: Stage[] = [
  stage1,
  stage2,
  stage3,
  stage4,
  stage5,
  stage6,
]

export const STAGES_BY_ID: Record<number, Stage> = Object.fromEntries(
  ALL_STAGES.map(s => [s.id, s])
)

/** 난이도 별점 텍스트 */
export function getDifficultyStars(difficulty: 1 | 2 | 3 | 4): string {
  return '★'.repeat(difficulty) + '☆'.repeat(4 - difficulty)
}

/** AI 티어 한국어 */
export const AI_TIER_LABEL: Record<AITier, string> = {
  GRUNT: '하수 (下手)',
  STRATEGIST: '강호인 (江湖人)',
  ADVANCED: '고수 (高手)',
}
