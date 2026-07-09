/**
 * 팔자전 — 밸런스 데이터 (balance.ts — 단일 출처)
 * 이 파일 외에 밸런스 숫자 하드코딩 금지
 */

import type { FloorConfig } from '../types/game'

export const FLOOR_CONFIGS: FloorConfig[] = [
  { floor: 1, enemyName: '변질 오행',          enemyHp: 150, counterDamage: 8,  maxPlays: 4 },
  { floor: 2, enemyName: '변질 오행 혼성',      enemyHp: 280, counterDamage: 12, maxPlays: 4 },
  { floor: 3, enemyName: '정예: 고신',          enemyHp: 450, counterDamage: 18, maxPlays: 4 },
  { floor: 4, enemyName: '보스: 명외자 대장',   enemyHp: 700, counterDamage: 25, maxPlays: 5 },
]

export const PLAYER_BASE_HP = 100
export const HAND_SIZE = 8
export const BASE_DISCARDS = 3
export const BASE_PLAYS = 4
export const BOSS_FLOOR = 4

/** 오행 연환 특별 배율 */
export const OHANG_YEONHWAN_MULTIPLIER = 10

/** 역극 페널티: 카드 데미지를 절반으로 */
export const YEOKGEUK_PENALTY = 0.5

/** 극 보너스 배율 */
export const GEUK_BONUS_MULTIPLIER = 1.5
