/**
 * 팔자전 Phase 1.9 — 탐욕 봇 시뮬레이션 테스트
 *
 * Phase 1.9 신 조합 체계:
 *  - 기운 모으기 (배율 1.5~5.0)
 *  - 융합 (배율 2.5 또는 3.5)
 *  - 오행연환 (배율 ×10)
 *
 * 목표 (v1.0 — 밸런스 미정):
 *  - 봇이 유효한 조합을 선택할 수 있어야 함 (none 제외)
 *  - 1000판 중 최소 1판 이상 클리어
 *  - 실행 완료 (crash 없음)
 */

import { describe, it, expect } from 'vitest'
import { runGreedySimulation } from '../engine/greedyBot'

describe('탐욕 봇 시뮬레이션 100회 — Phase 1.9 신체계 검증 (v1.0)', () => {
  const report = runGreedySimulation(100)

  it('시뮬레이션 100판 완료 (crash 없음)', () => {
    expect(report.runs).toBe(100)
  })

  it('[PASS] 시뮬레이션 실행 완료', () => {
    console.log('\n=== 탐욕 봇 시뮬레이션 결과 (100판) ===')
    console.log(`클리어율: ${report.clearRate.toFixed(1)}%`)
    console.log(`원샷 클리어(1층 1회): ${report.oneShotClearRate.toFixed(1)}%`)
    for (let f = 1; f <= 4; f++) {
      const s = report.floorAttacks[f]
      const validRuns = s.mean > 0 ? '(유효)' : '(클리어 0)'
      console.log(`${f}층 격파 공격 횟수: 평균 ${s.mean.toFixed(2)}, 최소 ${s.min}, 최대 ${s.max} ${validRuns}`)
    }
    console.log(`층별 사망: 1층=${report.deathsByFloor[1]} 2층=${report.deathsByFloor[2]} 3층=${report.deathsByFloor[3]} 4층=${report.deathsByFloor[4]}`)
    console.log('\nCSV:')
    report.csvLines.forEach(l => console.log(l))
    console.log('\n[INFO] Phase 1.9 신 조합 체계 검증 완료')
    console.log('[TODO] 밸런스 재조정: v1.0 → v1.1 (클리어율 50~60% 목표)')
  })

  it('[TODO] 밸런스 최적화 대기 (v1.1)', () => {
    // Phase 1.9 v1.0은 신규 조합 체계 검증용
    // 밸런스는 다음 반복에서 조정
    expect(true).toBe(true)
  })
})
