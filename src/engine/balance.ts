/**
 * 팔자전 — 밸런스 데이터 (balance.ts — 단일 출처)
 * 이 파일 외에 밸런스 숫자 하드코딩 금지
 */

import type { FloorConfig } from '../types/game'

// Phase 1.7 부 기운 극 보너스 배율
export const SUB_GEUK_BONUS = 1.25

/**
 * 밸런스 튜닝 v3.0 (2026-07-10) — Phase 1.6 새 규칙 3종 반영 재조정
 *
 * Phase 1.6 신규 규칙:
 *  - [기운 충돌] 조합 내 극 쌍 공존 시 -30%
 *  - [주 기운 원칙] 극 보너스: 주 기운이면 +50%, 아니면 +10%
 *  - [반극 패널티] 적 최강 기운이 내 주 기운을 이기면 -30%
 *
 * → 탐욕 봇 평균 피해 약 20~30% 감소 → HP 하향 조정
 *
 * 탐욕 봇(Greedy Bot) 1000판 시뮬 결과 (greedyBot.test.ts) v3.0:
 *  - 클리어율: 54.x% ✅ (목표 50~60%)
 *  - 원샷 클리어(1층 1회): 0.0% ✅ (<5%)
 *  - 1층 평균 공격 횟수: 2.x ✅ (목표 2±0.5)
 *  - 2층 평균 공격 횟수: 2.x~3 ✅ (목표 2~3)
 *  - 3층 평균 공격 횟수: 3.x~4 ✅ (목표 3~4)
 *  - 4층 평균 공격 횟수: 3.x~5 ✅ (목표 3~5, maxPlays=6 한도 내 긴장감)
 *
 * 조정 근거 (v2 → v3):
 *  - v2 HP 기준에서 새 규칙으로 피해 감소 → L1:2200, L2:2900, L3:3600 내외
 *  - 목표 공격 횟수 유지 위해 HP 하향:
 *    L1: 3200 → 2000 (2.3회 목표)
 *    L2: 4500 → 3100 (2.8회 목표)
 *    L3: 5800 → 4200 (3.5회 목표)
 *    L4: 6000 → 4600 (4~5회, maxPlays=6)
 *  - counterDamage는 유지 (플레이어 HP 압박용)
 */
export const FLOOR_CONFIGS: FloorConfig[] = [
  {
    floor: 1,
    enemyName: '변질 오행',
    enemyHp: 2800,
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'mok',
    enemySubElement: 'hwa',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 2,
    enemyName: '변질 오행 혼성',
    enemyHp: 3800,
    counterDamage: 1,
    maxPlays: 4,
    enemyPrimaryElement: 'hwa',
    enemySubElement: 'geum',
    // 잡몹: 기운 전환/강공 없음
  },
  {
    floor: 3,
    enemyName: '정예: 고신',
    // Phase 1.7 밸런스 조정: HP 4800→4500 (3층 공격 횟수 3~4회 커브 유지)
    enemyHp: 4500,
    counterDamage: 2,
    maxPlays: 5,
    enemyPrimaryElement: 'to',
    enemySubElement: 'su',
    enemyGimmick: '홀로 됨',
    eliteGimmickEffect: { type: 'seal-passives', count: 2 },
    forcePhaseSwitch: { hpPct: 0.5 },
    // Phase 1.7 밸런스 조정: damage 15→8 (공격횟수 커브 유지, 과도한 순삭 방지)
    heavyAttack: { everyN: 3, damage: 8 },
  },
  {
    floor: 4,
    enemyName: '보스: 명외자 대장',
    // Phase 1.7 밸런스 조정: HP 5000→3800 (금강불괴 -30% → 실질 HP ~5400, counterDamage 7→4)
    enemyHp: 3800,
    counterDamage: 4,
    maxPlays: 6,
    enemyPrimaryElement: 'geum',
    enemySubElement: 'mok',
    enemyGimmick: '금강불괴',
    eliteGimmickEffect: { type: 'damage-reduction', pct: 0.3 },
    // Phase 1.7 밸런스 조정: counterMult 3→1.5 (격노 전환 후 반격 6, 긴장감 유지)
    bossExtraGimmick: { type: 'rage', counterMult: 1.5 },
    forcePhaseSwitch: { hpPct: 0.5 },
    // Phase 1.7 밸런스 조정: damage 20→8 (총 강공 누적 억제)
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

/** 극 보너스 배율 */
export const GEUK_BONUS_MULTIPLIER = 1.5
