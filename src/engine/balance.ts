/**
 * 팔자전 — 밸런스 데이터 (balance.ts — 단일 출처)
 * 이 파일 외에 밸런스 숫자 하드코딩 금지
 */

import type { FloorConfig } from '../types/game'

/**
 * 밸런스 튜닝 v2.0 (2026-07-09) — 탐욕 봇 기준 재조정
 *
 * 탐욕 봇(Greedy Bot) 1000판 시뮬 결과 (greedyBot.test.ts):
 *  - 클리어율: 58.9% ✅ (목표 50~60%)
 *  - 원샷 클리어(1층 1회): 0.0% ✅ (<5%)
 *  - 1층 평균 공격 횟수: 2.23 ✅ (목표 2±0.5)
 *  - 2층 평균 공격 횟수: 2.92 ✅ (목표 2~3)
 *  - 3층 평균 공격 횟수: 3.63 ✅ (목표 3~4)
 *  - 4층 평균 공격 횟수: 3.59 ✅ (목표 3~5, maxPlays=6 한도 내 긴장감)
 *
 * 조정 근거:
 *  - 탐욕 봇은 5장 오행연환(200+cardSum)×10 → 데미지 avg ~2200 (52.8% 확률)
 *  - 기존 값(L1:90 / L2:115 / L3:155 / L4:162)은 1회 출수로 전부 격파 (클리어율 100%)
 *  - 적 HP를 대폭 상향, counterDamage는 플레이어 HP 소진 압박용으로 유지
 *  - L4: maxPlays=6, HP=6000 → 탐욕봇 클리어율 59.2%, 공격 3.59회 (보스 긴장감)
 *  - 무작위 봇(simulation.test.ts)은 낮은 클리어율 → 참고용으로만 유지
 *  - 완전 결정론적 시뮬레이션 — 시드: i*12345+7777
 */
export const FLOOR_CONFIGS: FloorConfig[] = [
  { floor: 1, enemyName: '변질 오행',          enemyHp: 3200,  counterDamage: 1,  maxPlays: 4 },
  { floor: 2, enemyName: '변질 오행 혼성',      enemyHp: 4500,  counterDamage: 1,  maxPlays: 4 },
  { floor: 3, enemyName: '정예: 고신',          enemyHp: 5800,  counterDamage: 2,  maxPlays: 5 },
  { floor: 4, enemyName: '보스: 명외자 대장',   enemyHp: 6000,  counterDamage: 7,  maxPlays: 6 },
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
