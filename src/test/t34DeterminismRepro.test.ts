/**
 * T34 결정론 재현성 테스트 — 회귀 가드
 * 지시: ZERA_PALJAJEON_T34_DETERMINISM_DISPATCH_20260719.md (작업 2)
 *
 * 검증:
 *   - 동일 시드로 동일 프리셋을 2회 독립 실행 → 성공 카운트 완전 동일 assert
 *   - 이 테스트가 향후 결정론 붕괴의 회귀 가드 역할
 *
 * 실행: cd paljapae && npx vitest run src/test/t34DeterminismRepro.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

// ─── v4 mock — getFloorHp 함수 자체 교체 (클로저 이슈 우회) ──
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const V4_FLOOR_HP_TABLE = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = V4_FLOOR_HP_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

// mock 이후 await import
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE, YIKSEANG_MULT } = await import('../engine/balance')

// ─── 재현성 검증용 프리셋 (목화 — 기준 프리셋) ───────────────────────────────
const REPRO_PRESET = {
  key: 'mokHwa',
  label: '목화',
  dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  ilgan: 'mok' as Element,
}

const REPRO_RUNS = 100  // 재현성 검증용 — 빠른 실행 (100판 × 2회)

// ─── 단일 실행 함수 (동일 코드 경로, 2회 호출 비교) ─────────────────────────
function runOnce(preset: typeof REPRO_PRESET): { victories: number; results: boolean[] } {
  const favorableElement = getFavorableElement(preset.ilgan)
  const activePassiveIds = selectTalismanBySaju(preset.dist)

  const results: boolean[] = []
  for (let i = 0; i < REPRO_RUNS; i++) {
    const seed = i * 12345 + 7777
    const result = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds,
    })
    results.push(result.victory)
  }

  const victories = results.filter(Boolean).length
  return { victories, results }
}

describe('T34 결정론 재현성 — 회귀 가드 (2026-07-19)', () => {
  it(
    'HP assert: getFloorHp mock 검증 (352/712/1088/680, ×1.60 재기준선)',
    () => {
      expect(V4_FLOOR_HP_TABLE[1]).toBe(352)   // ×1.60 재기준선 (구 374=×1.70 → 352)
      expect(V4_FLOOR_HP_TABLE[2]).toBe(712)   // ×1.60 (구 757 → 712)
      expect(V4_FLOOR_HP_TABLE[3]).toBe(1088)  // ×1.60 (구 1156 → 1088)
      expect(V4_FLOOR_HP_TABLE[4]).toBe(680)   // 불변
      console.log('[HP assert PASS] 1층=352 / 2층=712 / 3층=1088 / 4층=680')
    },
  )

  it(
    'YIKSEANG_MULT assert: 역생 ×1.0 중립 확인',
    () => {
      expect(YIKSEANG_MULT).toBe(1.0)
      console.log(`[YIKSEANG_MULT assert PASS] YIKSEANG_MULT = ${YIKSEANG_MULT}`)
    },
  )

  it(
    '재현성 assert: 동일 시드 2회 실행 → 성공 카운트 + 판별 시퀀스 완전 동일 (목화 100판)',
    { timeout: 120000 },
    () => {
      console.log('\n[T34 재현성 검증] 동일 시드 목화 프리셋 2회 독립 실행...')

      // 1회차 실행
      const run1 = runOnce(REPRO_PRESET)
      // 2회차 실행 (완전히 동일한 인자)
      const run2 = runOnce(REPRO_PRESET)

      console.log(`  1회차: ${run1.victories}/${REPRO_RUNS} 승리`)
      console.log(`  2회차: ${run2.victories}/${REPRO_RUNS} 승리`)
      console.log(`  성공 카운트 동일: ${run1.victories === run2.victories ? 'PASS' : 'FAIL'}`)

      // 판별 시퀀스 비교 (판마다 승/패 동일 여부)
      const seqMismatch = run1.results.filter((v, i) => v !== run2.results[i])
      console.log(`  판별 시퀀스 불일치 수: ${seqMismatch.length} (0이어야 PASS)`)

      // assert: 성공 카운트 완전 동일
      expect(run1.victories).toBe(run2.victories)
      // assert: 판별 시퀀스 완전 동일 (i번째 판 승패가 1회차=2회차)
      expect(seqMismatch.length).toBe(0)

      console.log('[T34 재현성 assert PASS] — 결정론 복원 확인')
    },
  )
})
