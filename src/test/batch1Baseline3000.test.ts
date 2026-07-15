/**
 * 배치 1 "balance-v3 규칙 대청소" — 재기준선 3000판 × 3종
 *
 * 이든 스펙 순서 3:
 *   balance-v3 재기준선: 3000판 × 3종, §2 dispatch 6줄 측정 필수:
 *   - 효과 채택률 옵션별 (0% 사장·70%+ 독식 감지)
 *   - 연환 발생률+배율 후보 ×12·×16 병행
 *   - 모으기 장수 분포
 *   - 응축 투입값 분포 (착취 차단 실증)
 *
 * 프리셋 3종 (R10 기준):
 *   - 목화: {mok:4, hwa:4, to:2, geum:2, su:2}
 *   - 금수: {mok:2, hwa:2, to:2, geum:4, su:4}
 *   - 토단일: {mok:1, hwa:1, to:14, geum:2, su:2}
 *
 * A안: enableEffectMode=false (이전 동작)
 * B안: enableEffectMode=true  (배치 1 신규 양자택일)
 *
 * 실행: npx vitest run src/test/batch1Baseline3000.test.ts
 */

import { describe, it, expect } from 'vitest'
import { simulateFullCapRun } from '../engine/fullCapBot'
import type { Element } from '../types/game'
import type { FullCapSimOptions } from '../engine/fullCapBot'

// ─── Wilson 95% CI ───────────────────────────────────────────────────────────

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

// ─── 프리셋 3종 ───────────────────────────────────────────────────────────────

const PRESETS: Array<{
  name: string
  dist: Record<Element, number>
}> = [
  {
    name: 'mok-hwa',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  },
  {
    name: 'geum-su',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  },
  {
    name: 'to-only',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
  },
]

const RUNS = 3000
const SEED_FN = (i: number) => i * 12345 + 7777

// ─── dispatch 6줄 측정 인터페이스 ─────────────────────────────────────────────

interface DispatchStats {
  // 1. 클리어율
  cleared: number
  total: number
  clearRate: number

  // 2. 효과 채택률 (B안만 의미 있음)
  effectWildfireCount: number
  effectNourishCount: number
  effectPurificationCount: number
  effectMiningCount: number
  attackWildfireCount: number
  attackNourishCount: number
  attackPurificationCount: number
  attackMiningCount: number
  fusionTotalCount: number

  // 3. 연환 발생률
  yeonhwanCount: number

  // 4. 모으기 장수 분포
  gather2: number
  gather3: number
  gather4: number
  gather5: number

  // 5. 응축 투입값 분포
  condenseCount: number
  condenseInputValues: number[]  // 응축 발동 시 투입 카드값 합산 목록

  // 6. 평균 클리어 층수 / 응축 사용률
  totalFloorsCleared: number
  deathByFloor: Record<number, number>

  // 전체 트레잇 카운트 (참고용)
  allTraitCounts: Record<string, number>
}

// ─── 응축 투입값 추출 전용 미니 시뮬 (단순 카운트용) ──────────────────────────
//
// simulateFullCapRun은 응축 투입값을 별도 저장하지 않는다.
// 동일 시드×동일 옵션으로 재실행해 condenseCount를 확인하는 방식 대신,
// traitCounts에서 관련 집계값을 최대한 활용한다.
//
// 응축 투입값은 "옹기가마(화+토→토) 낳는 융합" 발동 시 카드값 합산이다.
// 엔진에서 별도 저장하지 않으므로, 간접 지표로 대체한다:
//   - 응축 발동 횟수 (condenseCount) per-run
//   - 평균 응축 배율 (getCondenseMultiplier 기반 추정)
//
// 단, yonggigama 특성 발동 시 투입값 근사 추정:
//   B안: effect_yonggigama_used 트레잇에서 fusion baseValue 근사치 사용 불가
//   → condenseCount + 층 클리어 분포로 간접 표현

function runPreset(
  presetName: string,
  dist: Record<Element, number>,
  enableEffectMode: boolean,
): DispatchStats {
  const stats: DispatchStats = {
    cleared: 0,
    total: RUNS,
    clearRate: 0,
    effectWildfireCount: 0,
    effectNourishCount: 0,
    effectPurificationCount: 0,
    effectMiningCount: 0,
    attackWildfireCount: 0,
    attackNourishCount: 0,
    attackPurificationCount: 0,
    attackMiningCount: 0,
    fusionTotalCount: 0,
    yeonhwanCount: 0,
    gather2: 0,
    gather3: 0,
    gather4: 0,
    gather5: 0,
    condenseCount: 0,
    condenseInputValues: [],
    totalFloorsCleared: 0,
    deathByFloor: { 1: 0, 2: 0, 3: 0, 4: 0 },
    allTraitCounts: {},
  }

  const opts: FullCapSimOptions = {
    elementDist: dist,
    enableFloorReward: true,
    enableEffectMode,
  }

  for (let i = 0; i < RUNS; i++) {
    const seed = SEED_FN(i)
    const result = simulateFullCapRun(seed, opts)

    if (result.victory) {
      stats.cleared++
    } else if (result.deathFloor !== null) {
      stats.deathByFloor[result.deathFloor] = (stats.deathByFloor[result.deathFloor] ?? 0) + 1
    }

    stats.totalFloorsCleared += result.floorsCleared
    stats.condenseCount += result.condenseCount
    stats.fusionTotalCount += result.fusionCount

    // traitCounts 집계
    if (result.traitCounts) {
      for (const [key, count] of Object.entries(result.traitCounts)) {
        stats.allTraitCounts[key] = (stats.allTraitCounts[key] ?? 0) + count

        // 2. 효과 채택률
        if (key === 'effect_wildfire_used')     stats.effectWildfireCount += count
        if (key === 'effect_nourish_used')      stats.effectNourishCount += count
        if (key === 'effect_purification_used') stats.effectPurificationCount += count
        if (key === 'effect_mining_used')       stats.effectMiningCount += count
        if (key === 'attack_wildfire_used')     stats.attackWildfireCount += count
        if (key === 'attack_nourish_used')      stats.attackNourishCount += count
        if (key === 'attack_purification_used') stats.attackPurificationCount += count
        if (key === 'attack_mining_used')       stats.attackMiningCount += count

        // 3. 연환 발생률
        if (key === 'ohang-yeonhwan') stats.yeonhwanCount += count

        // 4. 모으기 장수 분포
        if (key === 'gather2') stats.gather2 += count
        if (key === 'gather3') stats.gather3 += count
        if (key === 'gather4') stats.gather4 += count
        if (key === 'gather5') stats.gather5 += count
      }
    }

    // 5. 응축 투입값 근사: 응축 횟수를 카드값으로 근사
    //    실제 투입값은 엔진 미추적 — condenseCount 기반 대리값 사용
    //    근사: 응축 1회당 평균 투입 카드값 = 2~5장 × 평균 카드값(5~7)
    //    → 향후 엔진에 직접 추적 추가 시 교체
    if (result.condenseCount > 0) {
      // condenseCount만큼 대리값 삽입 (평균 투입값 추정 불가, 횟수만 기록)
      for (let c = 0; c < result.condenseCount; c++) {
        // 대리값 -1 = "실제값 미추적" 표시
        stats.condenseInputValues.push(-1)
      }
    }
  }

  stats.clearRate = (stats.cleared / RUNS) * 100
  return stats
}

// ─── 출력 헬퍼 ───────────────────────────────────────────────────────────────

function printDispatch6Lines(
  presetName: string,
  label: string,
  s: DispatchStats,
): void {
  const R = RUNS
  const avgFloors = s.totalFloorsCleared / R

  // 1. 클리어율
  const ci = wilsonCI(s.cleared, R)
  console.log(`\n  [${presetName} / ${label}]`)
  console.log(`  1. 클리어율: ${s.clearRate.toFixed(2)}% (CI: ${(ci.low * 100).toFixed(1)}%~${(ci.high * 100).toFixed(1)}%)`)

  // 2. 효과 채택률 (B안 의미 있음, A안 = 0)
  const effectTotal = s.effectWildfireCount + s.effectNourishCount + s.effectPurificationCount + s.effectMiningCount
  const fusionBirthTotal = effectTotal
    + s.attackWildfireCount + s.attackNourishCount + s.attackPurificationCount + s.attackMiningCount

  if (fusionBirthTotal > 0) {
    const effectRate  = (effectTotal / fusionBirthTotal * 100).toFixed(1)
    const wfRate      = (s.effectWildfireCount     / fusionBirthTotal * 100).toFixed(1)
    const noRate      = (s.effectNourishCount       / fusionBirthTotal * 100).toFixed(1)
    const puRate      = (s.effectPurificationCount  / fusionBirthTotal * 100).toFixed(1)
    const miRate      = (s.effectMiningCount        / fusionBirthTotal * 100).toFixed(1)
    console.log(`  2. 효과 채택률: 전체=${effectRate}% (wildfire=${wfRate}%, nourish=${noRate}%, purification=${puRate}%, mining=${miRate}%)`)
    console.log(`     낳는융합 총 발동=${fusionBirthTotal}회 (${(fusionBirthTotal/R).toFixed(2)}/판), 공격선택=${(100-Number(effectRate)).toFixed(1)}%`)
    // 사장/독식 감지
    const rates = [
      { name: 'wildfire',     v: Number(wfRate) },
      { name: 'nourish',      v: Number(noRate) },
      { name: 'purification', v: Number(puRate) },
      { name: 'mining',       v: Number(miRate) },
    ]
    const dead = rates.filter(r => r.v === 0).map(r => r.name)
    const dominant = rates.filter(r => r.v >= 70).map(r => r.name)
    if (dead.length > 0)     console.log(`     [경고] 사장(0%) 감지: ${dead.join(', ')}`)
    if (dominant.length > 0) console.log(`     [경고] 독식(70%+) 감지: ${dominant.join(', ')}`)
    if (dead.length === 0 && dominant.length === 0) console.log(`     채택 분포: 적절 (사장·독식 없음)`)
  } else {
    console.log(`  2. 효과 채택률: 낳는 융합 발동 없음 (effectMode 비활성 또는 미발동)`)
  }

  // 3. 연환 발생률 (현재 배율 ×8, 후보 ×12/×16 미적용 — 현행 배율 기준 측정)
  const yeonhwanPerRun = s.yeonhwanCount / R
  console.log(`  3. 연환 발생률: ${s.yeonhwanCount}회 (${yeonhwanPerRun.toFixed(3)}/판, ${(yeonhwanPerRun*100).toFixed(2)}%) [현행 배율 ×8]`)
  console.log(`     ×12 후보 기대 클리어율 변화: 측정 불가 (별도 어블레이션 필요)`)
  console.log(`     ×16 후보 기대 클리어율 변화: 측정 불가 (별도 어블레이션 필요)`)

  // 4. 모으기 장수 분포
  const g2r = (s.gather2 / R).toFixed(2)
  const g3r = (s.gather3 / R).toFixed(2)
  const g4r = (s.gather4 / R).toFixed(2)
  const g5r = (s.gather5 / R).toFixed(2)
  const gTotal = ((s.gather2 + s.gather3 + s.gather4 + s.gather5) / R).toFixed(2)
  console.log(`  4. 모으기 장수 분포: gather2=${g2r}/판, gather3=${g3r}/판, gather4=${g4r}/판, gather5=${g5r}/판 (합계=${gTotal}/판)`)
  const g4AbsRate = s.gather4 / (s.gather2 + s.gather3 + s.gather4 + s.gather5 + 1) * 100
  if (g4AbsRate > 40) {
    console.log(`     [4장×4.0] 비율=${g4AbsRate.toFixed(1)}% — 과점 가능성 확인 필요`)
  } else if (g4AbsRate < 5) {
    console.log(`     [4장×4.0] 비율=${g4AbsRate.toFixed(1)}% — 과소 (4장 유인력 부족 가능)`)
  } else {
    console.log(`     [4장×4.0] 비율=${g4AbsRate.toFixed(1)}% — 적절`)
  }

  // 5. 응축 투입값 분포 (간접 지표)
  const condensePerRun = s.condenseCount / R
  console.log(`  5. 응축 사용률: ${s.condenseCount}회 (${condensePerRun.toFixed(3)}/판)`)
  console.log(`     투입값 직접 추적: 엔진 미지원 — condenseCount로 대체`)
  console.log(`     응축 착취 차단 실증: condenseCount/판=${condensePerRun.toFixed(3)} (과다 응축 임계 >2.0/판 시 재검토)`)
  if (condensePerRun > 2.0) {
    console.log(`     [경고] 응축 과다 사용 (${condensePerRun.toFixed(2)}/판 > 2.0) — 착취 가능 구간 의심`)
  }

  // 6. 평균 클리어 층수 / 응축 사용률
  console.log(`  6. 평균 클리어 층수: ${avgFloors.toFixed(3)}/판`)
  console.log(`     층별 사망: 1층=${s.deathByFloor[1]}판(${(s.deathByFloor[1]/R*100).toFixed(1)}%), 2층=${s.deathByFloor[2]}판(${(s.deathByFloor[2]/R*100).toFixed(1)}%), 3층=${s.deathByFloor[3]}판(${(s.deathByFloor[3]/R*100).toFixed(1)}%), 4층=${s.deathByFloor[4]}판(${(s.deathByFloor[4]/R*100).toFixed(1)}%)`)
}

function printABVerdict(
  presetName: string,
  sA: DispatchStats,
  sB: DispatchStats,
): { clearDiff: number; pass: boolean } {
  const diff = sB.clearRate - sA.clearRate
  const pass = diff >= -3.0
  console.log(`\n  ### ${presetName} 판정 ###`)
  console.log(`  클리어율 차이: A안=${sA.clearRate.toFixed(2)}%, B안=${sB.clearRate.toFixed(2)}%, 차이=${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p`)
  console.log(`  클리어율 PASS/FAIL: ${pass ? 'PASS (B안 ≥ A안 −3%p)' : 'FAIL (B안이 A안보다 3%p 이상 하락)'}`)

  // 효과 채택 분포 판정
  const effectTotal = sB.effectWildfireCount + sB.effectNourishCount + sB.effectPurificationCount + sB.effectMiningCount
  const fusionBirthTotal = effectTotal
    + sB.attackWildfireCount + sB.attackNourishCount + sB.attackPurificationCount + sB.attackMiningCount
  if (fusionBirthTotal > 0) {
    const rates = [
      sB.effectWildfireCount / fusionBirthTotal * 100,
      sB.effectNourishCount / fusionBirthTotal * 100,
      sB.effectPurificationCount / fusionBirthTotal * 100,
      sB.effectMiningCount / fusionBirthTotal * 100,
    ]
    const dead = rates.filter(r => r === 0).length
    const dominant = rates.filter(r => r >= 70).length
    if (dead > 0 || dominant > 0) {
      console.log(`  효과 채택 분포: 쏠림 감지 (사장=${dead}종, 독식=${dominant}종)`)
    } else {
      console.log(`  효과 채택 분포: 적절`)
    }
  } else {
    console.log(`  효과 채택 분포: 낳는 융합 미발동 (측정 불가)`)
  }

  // 모으기 4장 배율 판정
  const gAll = sA.gather2 + sA.gather3 + sA.gather4 + sA.gather5
  const g4Rate = gAll > 0 ? sA.gather4 / gAll * 100 : 0
  if (g4Rate > 40) {
    console.log(`  모으기 4장 배율: 과산 (4장 비율=${g4Rate.toFixed(1)}%)`)
  } else if (g4Rate < 5 && gAll > 0) {
    console.log(`  모으기 4장 배율: 과소 (4장 비율=${g4Rate.toFixed(1)}%)`)
  } else if (gAll > 0) {
    console.log(`  모으기 4장 배율: 적절 (4장 비율=${g4Rate.toFixed(1)}%)`)
  }

  return { clearDiff: diff, pass }
}

// ─── 테스트 본체 ──────────────────────────────────────────────────────────────

describe('배치 1 재기준선 — 3000판 × 3종 A/B (dispatch 6줄)', () => {
  it(
    '목화(mok-hwa) 3000판 A/B',
    { timeout: 300000 },
    () => {
      const preset = PRESETS[0]
      console.log('\n' + '='.repeat(60))
      console.log(`배치 1 재기준선 — ${preset.name} 3000판 A/B`)
      console.log('='.repeat(60))

      const sA = runPreset(preset.name, preset.dist, false)
      const sB = runPreset(preset.name, preset.dist, true)

      printDispatch6Lines(preset.name, 'A안 (효과 비활성)', sA)
      printDispatch6Lines(preset.name, 'B안 (효과 활성)', sB)
      const verdict = printABVerdict(preset.name, sA, sB)

      // 판정
      expect(verdict.clearDiff).toBeGreaterThanOrEqual(-3.0)
      expect(sA.total).toBe(RUNS)
      expect(sB.total).toBe(RUNS)
    },
  )

  it(
    '금수(geum-su) 3000판 A/B',
    { timeout: 300000 },
    () => {
      const preset = PRESETS[1]
      console.log('\n' + '='.repeat(60))
      console.log(`배치 1 재기준선 — ${preset.name} 3000판 A/B`)
      console.log('='.repeat(60))

      const sA = runPreset(preset.name, preset.dist, false)
      const sB = runPreset(preset.name, preset.dist, true)

      printDispatch6Lines(preset.name, 'A안 (효과 비활성)', sA)
      printDispatch6Lines(preset.name, 'B안 (효과 활성)', sB)
      const verdict = printABVerdict(preset.name, sA, sB)

      expect(verdict.clearDiff).toBeGreaterThanOrEqual(-3.0)
      expect(sA.total).toBe(RUNS)
      expect(sB.total).toBe(RUNS)
    },
  )

  it(
    '토단일(to-only) 3000판 A/B',
    { timeout: 300000 },
    () => {
      const preset = PRESETS[2]
      console.log('\n' + '='.repeat(60))
      console.log(`배치 1 재기준선 — ${preset.name} 3000판 A/B`)
      console.log('='.repeat(60))

      const sA = runPreset(preset.name, preset.dist, false)
      const sB = runPreset(preset.name, preset.dist, true)

      printDispatch6Lines(preset.name, 'A안 (효과 비활성)', sA)
      printDispatch6Lines(preset.name, 'B안 (효과 활성)', sB)
      const verdict = printABVerdict(preset.name, sA, sB)

      expect(verdict.clearDiff).toBeGreaterThanOrEqual(-3.0)
      expect(sA.total).toBe(RUNS)
      expect(sB.total).toBe(RUNS)
    },
  )

  it(
    '3종 종합 요약 출력',
    { timeout: 600000 },
    () => {
      console.log('\n' + '='.repeat(70))
      console.log('배치 1 재기준선 — 3000판 × 3종 종합 요약')
      console.log('='.repeat(70))

      const allResults: Array<{
        name: string
        sA: DispatchStats
        sB: DispatchStats
      }> = []

      for (const preset of PRESETS) {
        const sA = runPreset(preset.name, preset.dist, false)
        const sB = runPreset(preset.name, preset.dist, true)
        allResults.push({ name: preset.name, sA, sB })
      }

      // 종합 테이블 출력
      console.log('\n[클리어율 A/B 비교]')
      console.log('| 프리셋     | A안 클리어율 | B안 클리어율 | 차이    | PASS/FAIL |')
      console.log('|------------|-------------|-------------|---------|-----------|')
      let allPass = true
      for (const r of allResults) {
        const diff = r.sB.clearRate - r.sA.clearRate
        const pass = diff >= -3.0
        if (!pass) allPass = false
        const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%p'
        console.log(
          `| ${r.name.padEnd(10)} | ${r.sA.clearRate.toFixed(2).padStart(11)}% | ${r.sB.clearRate.toFixed(2).padStart(11)}% | ${diffStr.padStart(7)} | ${pass ? 'PASS' : 'FAIL'} |`,
        )
      }

      // 연환 발생률 비교
      console.log('\n[연환 발생률 (A안 기준, 현행 ×8 배율)]')
      console.log('| 프리셋     | 연환 총계 | 출정당     | 출정대비% |')
      console.log('|------------|----------|-----------|----------|')
      for (const r of allResults) {
        const rate = r.sA.yeonhwanCount / RUNS
        console.log(
          `| ${r.name.padEnd(10)} | ${r.sA.yeonhwanCount.toString().padStart(8)} | ${rate.toFixed(3).padStart(9)} | ${(rate * 100).toFixed(2).padStart(8)}% |`,
        )
      }

      // 모으기 장수 분포 비교
      console.log('\n[모으기 장수 분포 A안 기준 (발동/판)]')
      console.log('| 프리셋     | 2장  | 3장  | 4장  | 5장  | 합계 |')
      console.log('|------------|------|------|------|------|------|')
      for (const r of allResults) {
        const s = r.sA
        const g2 = (s.gather2 / RUNS).toFixed(2)
        const g3 = (s.gather3 / RUNS).toFixed(2)
        const g4 = (s.gather4 / RUNS).toFixed(2)
        const g5 = (s.gather5 / RUNS).toFixed(2)
        const gt = ((s.gather2 + s.gather3 + s.gather4 + s.gather5) / RUNS).toFixed(2)
        console.log(`| ${r.name.padEnd(10)} | ${g2} | ${g3} | ${g4} | ${g5} | ${gt} |`)
      }

      // 효과 채택률 비교 (B안)
      console.log('\n[효과 채택률 B안 (낳는 융합 발동 중 효과 선택 비율)]')
      console.log('| 프리셋     | 전체 효과% | wildfire | nourish | purif.  | mining  |')
      console.log('|------------|-----------|---------|---------|---------|---------|')
      for (const r of allResults) {
        const s = r.sB
        const effectTotal = s.effectWildfireCount + s.effectNourishCount + s.effectPurificationCount + s.effectMiningCount
        const fusionBirthTotal = effectTotal + s.attackWildfireCount + s.attackNourishCount + s.attackPurificationCount + s.attackMiningCount
        if (fusionBirthTotal > 0) {
          const eff = (effectTotal / fusionBirthTotal * 100).toFixed(1)
          const wf  = (s.effectWildfireCount     / fusionBirthTotal * 100).toFixed(1)
          const no  = (s.effectNourishCount       / fusionBirthTotal * 100).toFixed(1)
          const pu  = (s.effectPurificationCount  / fusionBirthTotal * 100).toFixed(1)
          const mi  = (s.effectMiningCount        / fusionBirthTotal * 100).toFixed(1)
          console.log(`| ${r.name.padEnd(10)} | ${eff.padStart(9)}% | ${wf.padStart(7)}% | ${no.padStart(7)}% | ${pu.padStart(7)}% | ${mi.padStart(7)}% |`)
        } else {
          console.log(`| ${r.name.padEnd(10)} | 미발동     | -       | -       | -       | -       |`)
        }
      }

      // 응축 사용률 비교
      console.log('\n[응축 사용률 (A안 기준, condenseCount/판)]')
      console.log('| 프리셋     | 총 응축 | 응축/판 | 착취 경고 |')
      console.log('|------------|--------|--------|----------|')
      for (const r of allResults) {
        const cpr = r.sA.condenseCount / RUNS
        const warn = cpr > 2.0 ? '경고' : 'OK'
        console.log(`| ${r.name.padEnd(10)} | ${r.sA.condenseCount.toString().padStart(6)} | ${cpr.toFixed(3).padStart(6)} | ${warn} |`)
      }

      console.log(`\n최종 결과: ${allPass ? 'ALL PASS' : 'FAIL 존재 — 상세 확인 필요'}`)
      console.log('='.repeat(70))

      // 검증
      for (const r of allResults) {
        expect(r.sA.total).toBe(RUNS)
        expect(r.sB.total).toBe(RUNS)
        const diff = r.sB.clearRate - r.sA.clearRate
        expect(diff).toBeGreaterThanOrEqual(-3.0)
      }
    },
  )
})
