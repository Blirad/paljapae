/**
 * T13 재현성 검증 — 이든 직접 지시 (2026-07-13)
 *
 * 검증 1: R2 조건(selectedTalismans) + 추적 코드 비개입 확인 → 1000판
 *   - t13ResimR2.test.ts와 동일한 설정
 *   - traitCounts 집계는 하되, JSONL 쓰기 없음 (fs 미사용)
 *   - 목표: R2(61%) 재현 → 추적 코드 무관 / R1(44.6%) → 추적 코드 범인
 *
 * 검증 2: 가호 제거(activePassiveIds=[]) → 1000판
 *   - 검증 1과 동일하되 activePassiveIds = []
 *   - 목표: ~44%면 가호 장착이 R1→R2 차이 원인 확정
 *
 * 주의: 원본 t13ResimR2.test.ts 수정 없음. 이 파일은 임시 검증용.
 *
 * 실행: npm test -- src/test/t13ReproCheck.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'

// Wilson 95% CI
function wilsonCI(successes: number, total: number) {
  const p = successes / total
  const z = 1.96
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    point: p,
  }
}

// 목화 프리셋만 사용 (R1 vs R2 핵심 비교 대상)
const MOK_HWA_PRESET = {
  key: 'mokHwa',
  label: '목화',
  dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  ilgan: 'mok' as Element,
}

const RUNS = 1000

describe('T13 재현성 검증', () => {
  it(
    '검증 1: R2 조건(가호 장착) + JSONL 쓰기 없음 — 1000판',
    { timeout: 120000 },
    () => {
      const preset = MOK_HWA_PRESET
      const yongsin = getFavorableElement(preset.ilgan)
      // R2와 동일: 사주 기반 가호 장착
      const selectedTalismans = selectTalismanBySaju(preset.dist)

      let cleared = 0

      for (let i = 0; i < RUNS; i++) {
        const seed = i * 12345 + 7777
        // R2와 완전히 동일한 인자 — JSONL 쓰기만 없음 (추적 집계는 engine 내부에서 동일하게 발생)
        const result = simulateFullCapRun(seed, {
          elementDist: preset.dist,
          ilganElement: preset.ilgan,
          favorableElement: yongsin,
          useFixedFloorElements: false,
          enableFloorReward: true,
          activePassiveIds: selectedTalismans,
        })
        if (result.victory) cleared++
      }

      const ci = wilsonCI(cleared, RUNS)
      const rate = ci.point * 100

      console.log('\n')
      console.log('='.repeat(60))
      console.log('T13 재현성 검증 — 검증 1 결과')
      console.log('='.repeat(60))
      console.log(`장착 가호: [${selectedTalismans.join(', ')}]`)
      console.log(`클리어: ${cleared}/${RUNS} = ${rate.toFixed(2)}%`)
      console.log(`Wilson 95% CI: [${(ci.low * 100).toFixed(2)}%, ${(ci.high * 100).toFixed(2)}%]`)
      console.log('')
      console.log('판정 기준:')
      console.log('  R2 재현(>55%): 추적 코드 무관 확인')
      console.log('  R1 수준(<50%): 추적 코드가 R2 수치를 끌어올린 것')
      if (rate >= 55) {
        console.log(`=> RESULT: R2 재현 (${rate.toFixed(2)}%) — 추적 코드는 게임 로직에 무관`)
      } else if (rate <= 50) {
        console.log(`=> RESULT: R1 수준 (${rate.toFixed(2)}%) — 추적 코드가 R2 수치를 인위적으로 높였을 가능성`)
      } else {
        console.log(`=> RESULT: 중간 수치 (${rate.toFixed(2)}%) — 추가 분석 필요`)
      }
      console.log('='.repeat(60) + '\n')

      expect(cleared).toBeGreaterThanOrEqual(0)
      expect(cleared).toBeLessThanOrEqual(RUNS)
    },
  )

  it(
    '검증 2: 가호 제거(activePassiveIds=[]) + JSONL 쓰기 없음 — 1000판',
    { timeout: 120000 },
    () => {
      const preset = MOK_HWA_PRESET
      const yongsin = getFavorableElement(preset.ilgan)

      let cleared = 0

      for (let i = 0; i < RUNS; i++) {
        const seed = i * 12345 + 7777
        // 가호 제거: activePassiveIds = []
        const result = simulateFullCapRun(seed, {
          elementDist: preset.dist,
          ilganElement: preset.ilgan,
          favorableElement: yongsin,
          useFixedFloorElements: false,
          enableFloorReward: true,
          activePassiveIds: [],
        })
        if (result.victory) cleared++
      }

      const ci = wilsonCI(cleared, RUNS)
      const rate = ci.point * 100

      console.log('\n')
      console.log('='.repeat(60))
      console.log('T13 재현성 검증 — 검증 2 결과')
      console.log('='.repeat(60))
      console.log(`장착 가호: [] (없음)`)
      console.log(`클리어: ${cleared}/${RUNS} = ${rate.toFixed(2)}%`)
      console.log(`Wilson 95% CI: [${(ci.low * 100).toFixed(2)}%, ${(ci.high * 100).toFixed(2)}%]`)
      console.log('')
      console.log('판정 기준:')
      console.log('  R1 수준(~44%): 가호 장착이 R1→R2 차이의 원인')
      console.log('  R2 수준(~61%): 가호 외 다른 변수가 원인')
      if (rate >= 55) {
        console.log(`=> RESULT: R2 수준 유지 (${rate.toFixed(2)}%) — 가호 이외 다른 변수가 원인`)
      } else if (rate <= 50) {
        console.log(`=> RESULT: 가호 제거 시 R1 수준 복귀 (${rate.toFixed(2)}%) — 가호 장착이 R1→R2 차이의 원인 확정`)
      } else {
        console.log(`=> RESULT: 중간 수치 (${rate.toFixed(2)}%) — 가호 부분 기여`)
      }
      console.log('='.repeat(60) + '\n')

      expect(cleared).toBeGreaterThanOrEqual(0)
      expect(cleared).toBeLessThanOrEqual(RUNS)
    },
  )
})
