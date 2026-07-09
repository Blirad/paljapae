/**
 * 팔자전 — 밸런스 데이터 (balance.ts — 단일 출처)
 * 이 파일 외에 밸런스 숫자 하드코딩 금지
 */

import type { FloorConfig } from '../types/game'

/**
 * 밸런스 튜닝 v1.1 (2026-07-09)
 * vitest 1000판 봇 시뮬레이션 기준: 클리어율 42.0% (목표 35~45% ✅)
 * 1층 통과율 99.8% (목표 ≥90% ✅)
 * 3~4층 사망 집중: 55.7% ✅
 *
 * 조정 근거:
 * - 기존 값(L1:150/8, L2:280/12, L3:450/18, L4:700/25): 클리어율 0%
 * - 봇 평균 데미지 per play = 38, 4플레이 합계 avg = 152
 * - L3 HP=155: 47.5% 통과율 (3층 사망 집중)
 * - L4 HP=162: 3층 통과자의 88.4%가 클리어 (42.0% 총 클리어율)
 * - counterDamage를 대폭 낮춰 HP 고갈이 아닌 plays 고갈로 사망 유도
 * - 완전 결정론적 시뮬레이션 — 시드: i*12345+7777 (simulation.test.ts 동일)
 */
export const FLOOR_CONFIGS: FloorConfig[] = [
  { floor: 1, enemyName: '변질 오행',          enemyHp: 90,  counterDamage: 2,  maxPlays: 4 },
  { floor: 2, enemyName: '변질 오행 혼성',      enemyHp: 115, counterDamage: 3,  maxPlays: 4 },
  { floor: 3, enemyName: '정예: 고신',          enemyHp: 155, counterDamage: 5,  maxPlays: 4 },
  { floor: 4, enemyName: '보스: 명외자 대장',   enemyHp: 162, counterDamage: 8,  maxPlays: 5 },
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
