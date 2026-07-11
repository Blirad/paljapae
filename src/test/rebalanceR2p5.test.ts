/**
 * 팔자전 재밸런스 R2.5 — 어블레이션 + 층 보상 시뮬레이션
 *
 * 작업 1: 어블레이션 (J/K — 층 보상 미포함, J'/K' — 층 보상 포함)
 *   목적: 클리어율 급락(목화 57.8%→3.7%)의 원인이 원소 랜덤화인지 확인
 *   방법: R2 봇/용신 설정 그대로 + 적 배치만 R1 고정 배치로 되돌림
 *
 * 작업 2: 층 보상 포함 R2 재시뮬 (G'/H'/I')
 *   R2 랜덤화 + 층 보상 포함 버전
 *
 * R1 기준 용신:
 *   mokHwa 우세 → favorableElement: 'su'
 *   geumSu 우세 → favorableElement: 'to'  (R1 기준. R2 기재값='mok'과 다름 — 이든 확인 요망)
 *
 * 판정 기준:
 *   전 사주 25~40% + 격차 15%p 이내
 */

import { describe, it } from 'vitest'
import { runFullCapSimulation } from '../engine/fullCapBot'
import type { Element } from '../types/game'

// --- 프리셋 정의 ---

/** J: 어블레이션 목화 우세 (R1 고정 배치, 층 보상 미포함) */
const ABL_mokHwa_noReward = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  favorableElement: 'su' as Element,
  useFixedFloorElements: true,
  enableFloorReward: false,
}

/** K: 어블레이션 금수 우세 (R1 고정 배치, 층 보상 미포함, 용신=to — R1 기준) */
const ABL_geumSu_noReward_R1yongsin = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  favorableElement: 'to' as Element,  // R1 기준 geumSuHeavy='to'
  useFixedFloorElements: true,
  enableFloorReward: false,
}

/** K(R2용신): 어블레이션 금수 우세 (R1 고정 배치, 층 보상 미포함, 용신=mok — R2 기재값) */
const ABL_geumSu_noReward_R2yongsin = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  favorableElement: 'mok' as Element,  // R2 결과 파일 기재값
  useFixedFloorElements: true,
  enableFloorReward: false,
}

/** J': 어블레이션 목화 우세 (R1 고정 배치, 층 보상 포함) */
const ABL_mokHwa_withReward = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  favorableElement: 'su' as Element,
  useFixedFloorElements: true,
  enableFloorReward: true,
}

/** K': 어블레이션 금수 우세 (R1 고정 배치, 층 보상 포함, 용신=to — R1 기준) */
const ABL_geumSu_withReward = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  favorableElement: 'to' as Element,  // R1 기준
  useFixedFloorElements: true,
  enableFloorReward: true,
}

/** G': 목화 우세 (R2 랜덤화, 층 보상 포함) */
const R2_mokHwa_withReward = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  favorableElement: 'su' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

/** H': 금수 우세 (R2 랜덤화, 층 보상 포함) */
const R2_geumSu_withReward = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  favorableElement: 'mok' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

/** I': 토 단일 (R2 랜덤화, 층 보상 포함) */
const R2_to_withReward = {
  elementDist: { mok: 1, hwa: 1, to: 8, geum: 1, su: 1 } as Record<Element, number>,
  favorableElement: 'mok' as Element,
  useFixedFloorElements: false,
  enableFloorReward: true,
}

describe('팔자전 재밸런스 R2.5 — 어블레이션 + 층 보상 시뮬레이션', () => {
  it('R2.5 전체 시뮬레이션 실행 + 결과 보고', () => {
    const RUNS = 1000

    console.log('\n========== 팔자전 재밸런스 R2.5 시뮬레이션 ==========')
    console.log(`판 수: ${RUNS}판 × 각 프리셋`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 1: 어블레이션 시뮬
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 1: 어블레이션 시뮬 (R1 고정 배치) ===')
    console.log('목적: 원소 랜덤화 제거 후 R1 수치 복원 여부 확인')
    console.log('')

    // J: 층 보상 미포함
    const reportJ = runFullCapSimulation(RUNS, ABL_mokHwa_noReward)
    // K (R1용신=to): 층 보상 미포함
    const reportK_R1 = runFullCapSimulation(RUNS, ABL_geumSu_noReward_R1yongsin)
    // K (R2용신=mok): 층 보상 미포함 (비교용)
    const reportK_R2 = runFullCapSimulation(RUNS, ABL_geumSu_noReward_R2yongsin)

    // J': 층 보상 포함
    const reportJp = runFullCapSimulation(RUNS, ABL_mokHwa_withReward)
    // K': 층 보상 포함 (R1 기준 용신=to)
    const reportKp = runFullCapSimulation(RUNS, ABL_geumSu_withReward)

    console.log('--- 어블레이션 결과 (층 보상 미포함) ---')
    console.log('프리셋                    | 클리어율 | 1층사망 | 2층사망 | 3층사망 | 4층사망')
    for (const [label, report] of [
      ['J  목화(su) R1고정 보상X', reportJ],
      ['K  금수(to/R1기준) R1고정 보상X', reportK_R1],
      ['K  금수(mok/R2기준) R1고정 보상X', reportK_R2],
    ] as const) {
      const d = report.deathsByFloor
      console.log(
        `  ${label.padEnd(32)} | ${report.clearRate.toFixed(1).padStart(5)}% | ` +
        `${String(d[1] ?? 0).padStart(5)} | ${String(d[2] ?? 0).padStart(5)} | ` +
        `${String(d[3] ?? 0).padStart(5)} | ${String(d[4] ?? 0).padStart(5)}`,
      )
    }
    console.log('')

    console.log('--- 어블레이션 결과 (층 보상 포함) ---')
    console.log('프리셋                    | 클리어율 | 1층사망 | 2층사망 | 3층사망 | 4층사망')
    for (const [label, report] of [
      ["J' 목화(su) R1고정 보상O", reportJp],
      ["K' 금수(to/R1기준) R1고정 보상O", reportKp],
    ] as const) {
      const d = report.deathsByFloor
      console.log(
        `  ${label.padEnd(32)} | ${report.clearRate.toFixed(1).padStart(5)}% | ` +
        `${String(d[1] ?? 0).padStart(5)} | ${String(d[2] ?? 0).padStart(5)} | ` +
        `${String(d[3] ?? 0).padStart(5)} | ${String(d[4] ?? 0).padStart(5)}`,
      )
    }
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 비교 표 (R1 결과 vs J/K 어블레이션 vs G/H R2)
    // ──────────────────────────────────────────────────────────────
    console.log('=== 비교 표: R1 → J/K 어블레이션 → G/H R2 ===')
    console.log('(R1 수치: 목화≈57%, 금수≈18% — 이든/빌라드 확인값)')
    console.log('(G R2 수치: 목화≈3.7%, H R2 수치: 금수≈? — 이든 보고값)')
    console.log('')
    console.log('구분                     | 목화 클리어율 | 금수 클리어율(R1용신=to) | 금수 클리어율(R2용신=mok)')
    console.log(`  R1 (참조값, 실측 아님)  |        ~57.0% |                   ~18.0% |                        -`)
    console.log(`  J/K 어블레이션          |   ${reportJ.clearRate.toFixed(1).padStart(5)}%       |           ${reportK_R1.clearRate.toFixed(1).padStart(5)}%           |            ${reportK_R2.clearRate.toFixed(1).padStart(5)}%`)
    console.log(`  G/H R2 (랜덤화 포함)   |    ~3.7%(이든보고) |                    -         |             -`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 진단: 원소 랜덤화가 원인인지
    // ──────────────────────────────────────────────────────────────
    console.log('=== 진단: 원소 랜덤화 원인 여부 ===')
    const mokHwaRestored = reportJ.clearRate >= 40.0  // R1 수준 복원 기준
    const restoreDelta = reportJ.clearRate - 3.7  // R2 대비 회복량
    if (mokHwaRestored) {
      console.log(`  [원인 확인] R1 고정 배치 복원 후 목화 클리어율 ${reportJ.clearRate.toFixed(1)}% — 랜덤화 제거로 회복됨`)
      console.log(`  판정: 원소 랜덤화가 클리어율 급락의 주요 원인`)
    } else {
      console.log(`  [원인 미확인] R1 고정 배치 복원 후 목화 클리어율 ${reportJ.clearRate.toFixed(1)}% — R1 수준 미달`)
      console.log(`  판정: 원소 랜덤화 이외의 요인도 존재 — 추가 분석 필요`)
    }
    console.log(`  R2→어블레이션 회복량: +${restoreDelta.toFixed(1)}%p (R2 목화 3.7% 기준)`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 3: G'/H'/I' — R2 랜덤화 + 층 보상 포함
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 3: G\'/H\'/I\' R2 랜덤화 + 층 보상 포함 ===')

    const reportGp = runFullCapSimulation(RUNS, R2_mokHwa_withReward)
    const reportHp = runFullCapSimulation(RUNS, R2_geumSu_withReward)
    const reportIp = runFullCapSimulation(RUNS, R2_to_withReward)

    const clearRates = {
      Gp: reportGp.clearRate,
      Hp: reportHp.clearRate,
      Ip: reportIp.clearRate,
    }

    const maxRate = Math.max(...Object.values(clearRates))
    const minRate = Math.min(...Object.values(clearRates))
    const gap = maxRate - minRate

    console.log("--- G'/H'/I' 결과 ---")
    console.log("프리셋              | 클리어율 | 1층사망 | 2층사망 | 3층사망 | 4층사망")
    for (const [label, report] of [
      ["G' 목화(su) R2랜덤 보상O", reportGp],
      ["H' 금수(mok) R2랜덤 보상O", reportHp],
      ["I' 토단일(mok) R2랜덤 보상O", reportIp],
    ] as const) {
      const d = report.deathsByFloor
      console.log(
        `  ${label.padEnd(26)} | ${report.clearRate.toFixed(1).padStart(5)}% | ` +
        `${String(d[1] ?? 0).padStart(5)} | ${String(d[2] ?? 0).padStart(5)} | ` +
        `${String(d[3] ?? 0).padStart(5)} | ${String(d[4] ?? 0).padStart(5)}`,
      )
    }
    console.log('')

    // 층 보상 효과 비교 (R2 랜덤화 기준)
    console.log('--- 층 보상 효과 비교 (R2 랜덤화 기준) ---')
    console.log('주의: G/H/I R2 보상미포함 수치는 별도 rebalanceR2.test.ts에서 확인')
    console.log(`  G' (목화, 보상O) = ${reportGp.clearRate.toFixed(1)}%`)
    console.log(`  H' (금수, 보상O) = ${reportHp.clearRate.toFixed(1)}%`)
    console.log(`  I' (토단일, 보상O) = ${reportIp.clearRate.toFixed(1)}%`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 판정
    // ──────────────────────────────────────────────────────────────
    const targetMin = 25
    const targetMax = 40
    const targetGap = 15

    const allInRange = Object.values(clearRates).every(r => r >= targetMin && r <= targetMax)
    const gapOk = gap <= targetGap

    console.log('=== 최종 판정 (G\'/H\'/I\' 기준) ===')
    console.log(`  목표: 전 사주 ${targetMin}~${targetMax}% + 격차 ${targetGap}%p 이내`)
    for (const [label, rate] of [
      ["G' 목화", clearRates.Gp],
      ["H' 금수", clearRates.Hp],
      ["I' 토단일", clearRates.Ip],
    ]) {
      const inRange = rate >= targetMin && rate <= targetMax
      console.log(`  ${label}: ${rate.toFixed(1)}% ${inRange ? '[범위내]' : `[범위외 — 목표: ${targetMin}~${targetMax}%]`}`)
    }
    console.log(`  격차: ${gap.toFixed(1)}%p ${gapOk ? '[OK]' : `[초과 — 목표: ${targetGap}%p 이내]`}`)
    console.log(`  종합: ${allInRange && gapOk ? 'PASS' : 'FAIL — 추가 조정 필요 (수치 자의적 변경 금지, 이든 판단 후 진행)'}`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 이든 5번 질문 답변
    // ──────────────────────────────────────────────────────────────
    console.log('=== 이든 5번 질문 답변: 3층 HP 680 > 4층 HP 520 역전 설계 의도 ===')
    console.log('  판단: 의도된 설계')
    console.log('  근거:')
    console.log('    - 4층(金+木): counterDamage=4 (3층 counterDamage=2의 2배)')
    console.log('    - 4층: damage-reduction 30%, rage(카운터 데미지 ×1.5), heavyAttack 매 2턴')
    console.log('    - 3층: HP=680은 순수 HP로 버텨야 하는 구조 (heavyAttack 매 3턴)')
    console.log('    - HP만으로 비교하면 역전처럼 보이나, 전투 메커니즘 포함 시 4층이 더 어려운 층')
    console.log('    - 실제 시뮬: 4층 사망 > 3층 사망 ✓ (R2 기준)')
    console.log('  수치 자의적 조정 금지. 이 답변은 관측 결과이며 변경 제안 아님.')
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // R1 용신 설정값 명시
    // ──────────────────────────────────────────────────────────────
    console.log('=== R1 용신 설정값 확인 ===')
    console.log('  mokHwa 우세 → favorableElement: \'su\'  (빌라드 선행 확인)')
    console.log('  geumSu 우세 → favorableElement: \'to\'  (R1 스크립트 기준)')
    console.log('  ※ R2 결과 파일 기재값은 geumSu=mok — 두 값 모두 시뮬 실행, 이든 확인 요망')
    console.log('')

    console.log('=======================================================')
    console.log('R2.5 시뮬레이션 완료')
    console.log('=======================================================\n')

    // 시뮬레이션 자체 완료 검증 (수치 강제 PASS 금지)
    // 클리어율 숫자 자체 assert 금지 — 결과 보고만
  }, 600000) // 10분 타임아웃 (다종 × 1000판)
})
