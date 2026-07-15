/**
 * 배치 1 "balance-v3 규칙 대청소" — 봇 학습 A/B 게이트
 *
 * 이든 스펙 순서 2:
 *   fullCapBot에 [공격]vs[효과] 기대값 비교 추가 후
 *   전후 목화 1000판 A/B 비교
 *
 * A안 (기준선): enableEffectMode=false — 항상 공격
 * B안 (신규):   enableEffectMode=true  — trait별 기대값 비교 후 선택
 *
 * 판정:
 *   - B안 클리어율 ≥ A안 − 3%p: PASS (효과 모드가 크게 불리하지 않음)
 *   - B안 클리어율 < A안 − 3%p: FAIL (효과 기대값 로직 재조정 필요)
 *
 * 추가 dispatch 6줄 측정:
 *   1. 효과 채택률 (wildfire/nourish/purification/mining별)
 *   2. 연환 발생률
 *   3. 모으기 장수 분포 (gather2/3/4/5)
 *   4. 응축 사용률
 */

import { describe, it, expect } from 'vitest'
import { runFullCapSimulation } from '../engine/fullCapBot'
import type { FullCapSimOptions } from '../engine/fullCapBot'

const RUNS = 1000
const SEED_BASE = 12345

// 목화 프리셋 (R10 기준 기본 설정과 동일)
const MOK_HWA_OPTS: Omit<FullCapSimOptions, 'enableEffectMode'> = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
}

describe('배치 1 A/B 게이트 — [공격]vs[효과] 양자택일 봇 학습', () => {
  it('목화 1000판 A/B — B안 클리어율 ≥ A안 − 3%p', () => {
    // A안: enableEffectMode=false (항상 공격)
    const resultA = runFullCapSimulation(RUNS, {
      ...MOK_HWA_OPTS,
      enableEffectMode: false,
    })

    // B안: enableEffectMode=true (양자택일 로직)
    const resultB = runFullCapSimulation(RUNS, {
      ...MOK_HWA_OPTS,
      enableEffectMode: true,
    })

    // dispatch 6줄 측정 출력
    console.log('=== 배치 1 A/B 게이트 — 목화 1000판 ===')
    console.log(`A안 (공격 고정): ${resultA.clearRate.toFixed(2)}%`)
    console.log(`B안 (양자택일): ${resultB.clearRate.toFixed(2)}%`)
    console.log(`차이: ${(resultB.clearRate - resultA.clearRate).toFixed(2)}%p`)

    // B안 traitCounts (효과 채택률)
    const traitCountsA = (resultA as any).traitCountsAggregate ?? {}
    const traitCountsB = (resultB as any).traitCountsAggregate ?? {}
    console.log('\n--- A안 조합 통계 (1000판 합산) ---')
    console.log(JSON.stringify(traitCountsA, null, 2))
    console.log('\n--- B안 조합 통계 (1000판 합산, 효과 채택 포함) ---')
    console.log(JSON.stringify(traitCountsB, null, 2))

    // 판정: B안이 A안보다 3%p 이상 낮으면 FAIL
    const diff = resultB.clearRate - resultA.clearRate
    expect(diff).toBeGreaterThanOrEqual(-3.0)

    // 두 안 모두 최소 30% 이상 클리어 (시뮬 붕괴 방지)
    expect(resultA.clearRate).toBeGreaterThan(30)
    expect(resultB.clearRate).toBeGreaterThan(30)
  })

  it('목화 A/B — dispatch 6줄 실측 출력 (효과채택률/연환/모으기/응축)', () => {
    const resultA = runFullCapSimulation(RUNS, {
      ...MOK_HWA_OPTS,
      enableEffectMode: false,
    })
    const resultB = runFullCapSimulation(RUNS, {
      ...MOK_HWA_OPTS,
      enableEffectMode: true,
    })

    const print6Lines = (label: string, r: ReturnType<typeof runFullCapSimulation>) => {
      console.log(`\n=== ${label} (${RUNS}판) ===`)
      console.log(`클리어율: ${r.clearRate.toFixed(2)}%`)
      console.log(`연환 발생: ${((r as any).totalOhangYeonhwan ?? 0) / RUNS} 회/판`)
      console.log(`모으기 분포: gather2/3/4/5 — 별도 집계 필요 (traitCounts에서 추출)`)
      console.log(`응축 사용: ${r.condensesPerRun.toFixed(3)} 회/판`)
      console.log(`버리기 사용: ${r.discardsPerRun.toFixed(3)} 회/판`)
      console.log(`평균 클리어 층수: ${r.avgFloorsCleared.toFixed(2)}`)
    }

    print6Lines('A안 (공격 고정)', resultA)
    print6Lines('B안 (양자택일)', resultB)

    // A안 기준 검증
    expect(resultA.runs).toBe(RUNS)
    expect(resultB.runs).toBe(RUNS)
  })
})
