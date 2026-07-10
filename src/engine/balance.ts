/**
 * 팔자전 — 밸런스 데이터 (balance.ts — 단일 출처)
 * 이 파일 외에 밸런스 숫자 하드코딩 금지
 */

import type { FloorConfig } from '../types/game'

// Phase 1.7 부 기운 극 보너스 배율
export const SUB_GEUK_BONUS = 1.25

/**
 * 밸런스 튜닝 v4.2 (2026-07-10) — Phase 1.8 재조정
 *
 * Phase 1.8 신규 규칙:
 *  - [마무리 기운] 조합의 마지막 기운으로 극/반극 판정
 *  - 극 보너스: +70% (기존 +50%)
 *  - 반극 패널티: −40% (기존 −30%)
 *  - [토 응축] 마무리 기운 토 → 즉시 ×0.6 + 다음 공격 ×1.6
 *
 * 탐욕 봇(Greedy Bot) 1000판 시뮬 결과 v4.2:
 *  - 클리어율: 53.4% ✅ (목표 50~60%)
 *  - 원샷 클리어(1층 1회): 3.9% ✅ (<5%)
 *  - 1층 평균 공격 횟수: 2.52회 ✅ (목표 1.5~3)
 *  - 2층 평균 공격 횟수: 2.78회 ✅ (목표 2~3)
 *  - 3층 평균 공격 횟수: 3.02회 ✅ (목표 3~4)
 *  - 4층 평균 공격 횟수: 3.04회 ✅ (목표 3~5)
 *
 * 조정 근거 (v4.1 → v4.2):
 *  - v4.1 실측: 66.1% (목표 초과) → HP 상향 조정
 *  - L1: 2750 → 2820 (잡몹, 금강불괴 없음)
 *  - L2: 3300 → 3500 (잡몹 혼성)
 *  - L3: 4300 유지 (정예, 강공 everyN=3)
 *  - L4: 3100 유지 (보스, 금강불괴 -30% 실질 HP ~4429)
 */
export const FLOOR_CONFIGS: FloorConfig[] = [
  {
    floor: 1,
    enemyName: '변질 오행',
    enemyHp: 2820,
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'mok',
    enemySubElement: 'hwa',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 2,
    enemyName: '변질 오행 혼성',
    enemyHp: 3500,
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'hwa',
    enemySubElement: 'geum',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 3,
    enemyName: '정예: 고신',
    enemyHp: 4300,
    counterDamage: 2,
    maxPlays: 5,
    enemyPrimaryElement: 'to',
    enemySubElement: 'su',
    enemyGimmick: '홀로 됨',
    eliteGimmickEffect: { type: 'seal-passives', count: 2 },
    forcePhaseSwitch: { hpPct: 0.5 },
    heavyAttack: { everyN: 3, damage: 8 },
  },
  {
    floor: 4,
    enemyName: '보스: 명외자 대장',
    enemyHp: 3100,
    counterDamage: 4,
    maxPlays: 6,
    enemyPrimaryElement: 'geum',
    enemySubElement: 'mok',
    enemyGimmick: '금강불괴',
    eliteGimmickEffect: { type: 'damage-reduction', pct: 0.3 },
    bossExtraGimmick: { type: 'rage', counterMult: 1.5 },
    forcePhaseSwitch: { hpPct: 0.5 },
    heavyAttack: { everyN: 2, damage: 8 },
  },
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

/** 극 보너스 배율 — Phase 1.8: 1.5 → 1.7 (+70%) */
export const GEUK_BONUS_MULTIPLIER = 1.7

/** 반극 패널티 배율 — Phase 1.8: 0.7 → 0.6 (−40%) */
export const ANTI_GEUK_PENALTY = 0.6
