/**
 * 챌린지 모드 타입 정의 — M8 P0-2
 * 리라 M8 스펙 P0-2 + 도리안 M8 로드맵 섹션 3 기반
 */

import type { FiveElement } from './elements'

/** 챌린지 모드 식별자 */
export type ChallengeMode = 'normal' | 'challenge1' | 'challenge2' | 'challenge3' | 'challenge4' | 'challenge5'

/** 챌린지 배지 표시 텍스트 */
export const CHALLENGE_BADGE_TEXT: Record<ChallengeMode, string> = {
  normal: '',
  challenge1: '체력 시련 CH1',
  challenge2: '오행 봉인 CH2',
  challenge3: '소진 가속 CH3',
  challenge4: '복합 CH4',
  challenge5: '황천지옥 CH5',
}

/** 챌린지 모드 표시명 (RunStartScreen용) */
export const CHALLENGE_DISPLAY_NAME: Record<ChallengeMode, string> = {
  normal: 'Normal — 보통',
  challenge1: 'Challenge 1 — 체력 시련',
  challenge2: 'Challenge 2 — 오행 봉인',
  challenge3: 'Challenge 3 — 소진 가속',
  challenge4: 'Challenge 4 — 복합 시련',
  challenge5: 'Challenge 5 — 황천지옥',
}

/** 챌린지 모드 한자 부제 */
export const CHALLENGE_SUBTITLE: Record<ChallengeMode, string> = {
  normal: '',
  challenge1: '',
  challenge2: '',
  challenge3: '',
  challenge4: '',
  challenge5: '(天命)',
}

/** 챌린지 모드 설명 */
export const CHALLENGE_DESCRIPTION: Record<ChallengeMode, string> = {
  normal: '6 Stage 기본. 제약 없음.',
  challenge1: '시작 HP가 21로 줄어듭니다. (기본 30의 -30%)',
  challenge2: '세션 시작 시 랜덤 오행 1개 봉인 — 해당 오행 카드 비용 +2.',
  challenge3: 'Fatigue 피해 공식이 N×1.5로 상향됩니다. 장기전 불가.',
  challenge4: '시작 HP 24 (-20%) + 랜덤 오행 봉인 (비용 +1) + AI HP +3.',
  challenge5: '시작 HP 18 (-40%) + Fatigue ×2 + AI HP +5 + 랜덤 오행 봉인 (비용 +2). 최고 난이도.',
}

/**
 * 챌린지 규칙 설정값
 * 도리안 M8 로드맵 섹션 3 수치 기준
 */
export interface ChallengeRules {
  /** 플레이어 시작 HP (null이면 기본값 30 사용) */
  playerStartHp: number | null
  /** Fatigue 배율 (1 = 기본, 1.5 = CH3, 2 = CH5) */
  fatigueMultiplier: number
  /** 봉인 오행 비용 추가량 (0 = 봉인 없음) */
  sealedElementCostAdd: number
  /** AI HP 추가량 */
  aiHpBonus: number
}

export const CHALLENGE_RULES: Record<ChallengeMode, ChallengeRules> = {
  normal: {
    playerStartHp: null,
    fatigueMultiplier: 1,
    sealedElementCostAdd: 0,
    aiHpBonus: 0,
  },
  challenge1: {
    playerStartHp: 21,
    fatigueMultiplier: 1,
    sealedElementCostAdd: 0,
    aiHpBonus: 0,
  },
  challenge2: {
    playerStartHp: null,
    fatigueMultiplier: 1,
    sealedElementCostAdd: 2,
    aiHpBonus: 0,
  },
  challenge3: {
    playerStartHp: null,
    fatigueMultiplier: 1.5,
    sealedElementCostAdd: 0,
    aiHpBonus: 0,
  },
  challenge4: {
    playerStartHp: 24,
    fatigueMultiplier: 1,
    sealedElementCostAdd: 1,
    aiHpBonus: 3,
  },
  challenge5: {
    playerStartHp: 18,
    fatigueMultiplier: 2,
    sealedElementCostAdd: 2,
    aiHpBonus: 5,
  },
}

/** 오행 봉인이 있는 챌린지인지 확인 */
export function hasSealedElement(mode: ChallengeMode): boolean {
  return CHALLENGE_RULES[mode].sealedElementCostAdd > 0
}

/** 챌린지 5 여부 확인 */
export function isMaxChallenge(mode: ChallengeMode): boolean {
  return mode === 'challenge5'
}

/** Fatigue 배율 계산 (챌린지 적용) */
export function getFatigueMultiplier(mode: ChallengeMode): number {
  return CHALLENGE_RULES[mode].fatigueMultiplier
}

/** 챌린지 배지 색상 타입 */
export type ChallengeBadgeVariant = 'normal' | 'standard' | 'max'

export function getChallengeBadgeVariant(mode: ChallengeMode): ChallengeBadgeVariant {
  if (mode === 'normal') return 'normal'
  if (mode === 'challenge5') return 'max'
  return 'standard'
}

/** 세션 시작 시 랜덤 오행 선정 */
export function pickRandomElement(): FiveElement {
  const elements: FiveElement[] = ['木', '火', '土', '金', '水']
  return elements[Math.floor(Math.random() * elements.length)]
}
