/**
 * 팔자전 재밸런스 R3 — 용신 함수 도출 + 기대 데미지 보상 + 데미지 예산 감사
 *
 * 작업 2: 용신 하드코딩 제거 — ilganElement 방식으로 getFavorableElement() 호출
 * 작업 3: 봇 보상 전략 → 기대 데미지 최대화 (selectFloorRewardCard 개선)
 * 작업 4: 데미지 예산 감사 (계산 기반)
 * 작업 5: R3-A/B/C 1000판 재시뮬 + 최종 판정
 *
 * 판정 기준: 전 사주 25~40% + 격차 15%p 이내
 */

import { describe, it } from 'vitest'
import { runFullCapSimulation } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'
import {
  FLOOR_CONFIGS,
  GEUK_BONUS_MULTIPLIER,
  SANG_PENALTY_MULTIPLIER,
  ANTI_GEUK_PENALTY,
  GATHER_MULTIPLIERS,
  YONGSIN_BONUS_MULTIPLIER,
} from '../engine/balance'
import type { Element } from '../types/game'

// ─────────────────────────────────────────────────────────────────────────────
// 작업 2: 용신 함수 도출 검증
// ─────────────────────────────────────────────────────────────────────────────

/** 목화 우세 — 일간 木 가정 */
const R3_mokHwa = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
  ilganElement: 'mok' as Element,   // getFavorableElement('mok') = 'su'
  useFixedFloorElements: false,
  enableFloorReward: true,
}

/** 금수 우세 — 일간 金 가정 */
const R3_geumSu = {
  elementDist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
  ilganElement: 'geum' as Element,  // getFavorableElement('geum') = 'to'
  useFixedFloorElements: false,
  enableFloorReward: true,
}

/** 토 단일 — 일간 土 가정 */
const R3_to = {
  elementDist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
  ilganElement: 'to' as Element,    // getFavorableElement('to') = 'hwa'
  useFixedFloorElements: false,
  enableFloorReward: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// 작업 4: 데미지 예산 감사 — 순수 계산 (시뮬 아님)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 덱 분포에서 실제 20장 배분 근사 계산
 * balance.ts의 distributeCards 로직과 동일 (독립 구현)
 */
function distributeCards20(dist: Record<Element, number>): Record<Element, number> {
  const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
  const total = 20
  const sum = ELEMENTS.reduce((a, el) => a + (dist[el] ?? 0), 0)
  if (sum === 0) {
    return { mok: 4, hwa: 4, to: 4, geum: 4, su: 4 }
  }
  const raw: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
  let assigned = 0
  for (const el of ELEMENTS) {
    raw[el] = Math.max(1, Math.round(((dist[el] ?? 0) / sum) * total))
    assigned += raw[el]
  }
  let diff = total - assigned
  while (diff !== 0) {
    if (diff > 0) {
      const minEl = ELEMENTS.reduce((a, b) => raw[a] <= raw[b] ? a : b)
      raw[minEl]++
      diff--
    } else {
      const maxEl = ELEMENTS.reduce((a, b) => raw[a] >= raw[b] ? a : b)
      if (raw[maxEl] > 1) { raw[maxEl]--; diff++ } else break
    }
  }
  return raw
}

/**
 * 오행 상성 배율 계산 (balance.ts GEUK_MAP_BALANCE 기준)
 * 木克土, 火克金, 土克水, 金克木, 水克火
 */
function affinityMult(deckEl: Element, enemyEl: Element): number {
  // 내가 적을 극: ×1.5
  const geukMap: Record<Element, Element> = {
    mok: 'to', hwa: 'geum', to: 'su', geum: 'mok', su: 'hwa',
  }
  // 내가 적을 생: ×0.5
  const sangMap: Record<Element, Element> = {
    mok: 'hwa', hwa: 'to', to: 'geum', geum: 'su', su: 'mok',
  }
  if (geukMap[deckEl] === enemyEl) return GEUK_BONUS_MULTIPLIER       // 내가 극 → ×1.5
  if (sangMap[deckEl] === enemyEl) return SANG_PENALTY_MULTIPLIER      // 내가 생 → ×0.5
  if (geukMap[enemyEl] === deckEl) return ANTI_GEUK_PENALTY            // 적이 나를 극 → ×0.75
  return 1.0
}

/**
 * fullCapBot 평균 콤보 데미지 추정 (응축 포함, 계산 기반)
 *
 * 방법:
 * 1. 8장 핸드에서 최선 gather 조합 기대값 계산
 *    - 핸드 내 가장 많은 오행의 기대 장수 = deckCount[el] / 20 * 8
 *    - gather-N 배율 적용
 * 2. 상성 배율: 랜덤화 기준 기댓값 1.0 적용 (지시 4-2)
 * 3. 응축 보정: 토 중심 조합에서 응축 발동률 × 응축 배율 적용
 *    - 응축 발동 조건: 토 모으기(to×2이상), 일군 밭(mok+to), 옹기가마(hwa+to) 3종
 *    - 응축 배율: +120% (2장 조합 기준) ~ +200% (4장)
 *    - 발동률 근사: (토 카드 비율 + 융합 발동 가능성) × 0.3 (보수 추정)
 */
function estimateAvgComboDamage(
  dist: Record<Element, number>,
  enemyEl: Element | null,
): { avgDamage: number; detail: string } {
  const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
  const cardCounts = distributeCards20(dist)

  // 카드 평균값 = 5.5 (1~10 균등)
  const AVG_CARD_VALUE = 5.5
  const HAND_SIZE = 8
  const DECK_SIZE = 20

  // 핸드 내 각 오행의 기대 장수
  const handExpected: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
  for (const el of ELEMENTS) {
    handExpected[el] = (cardCounts[el] / DECK_SIZE) * HAND_SIZE
  }

  // 최선 gather 조합 선택: 기대 장수가 가장 많은 오행
  // fullCapBot은 실제로 gather-N 중 최대 데미지 선택 → 기대값으로 근사
  let bestGatherEl: Element = ELEMENTS[0]
  let bestGatherCount = 0
  for (const el of ELEMENTS) {
    if (handExpected[el] > bestGatherCount) {
      bestGatherCount = handExpected[el]
      bestGatherEl = el
    }
  }

  // gather 배율: 기대 장수 floor/ceil 평균
  const floorN = Math.floor(bestGatherCount)
  const ceilN = Math.ceil(bestGatherCount)
  const frac = bestGatherCount - floorN

  const gatherMultFloor = GATHER_MULTIPLIERS[Math.max(2, Math.min(5, floorN))] ?? 0
  const gatherMultCeil = GATHER_MULTIPLIERS[Math.max(2, Math.min(5, ceilN))] ?? 0
  const gatherMult = (1 - frac) * gatherMultFloor + frac * gatherMultCeil

  // 기본 기대 데미지 (gather 조합)
  const baseGatherDamage = Math.round(bestGatherCount * AVG_CARD_VALUE * gatherMult)

  // 상성 배율: enemyEl이 null이면 기댓값 1.0, 있으면 계산
  const affinityFactor = enemyEl ? affinityMult(bestGatherEl, enemyEl) : 1.0

  // 용신 보너스 가중: 용신 원소 = 지시 기반 (목화=su, 금수=to, 토단일=hwa)
  // 여기서는 평균 데미지 계산이므로 용신 보너스는 별도 적용 안 함 (상성 1.0 기준)

  // 응축 보정
  // 응축 발동 가능 조합: to 카드 포함 시 (토모으기/융합)
  const toRatio = cardCounts['to'] / DECK_SIZE
  const condenseTriggerRate = toRatio * 0.3  // 보수 추정
  const CONDENSE_MULT_AVG = 1.4  // +140% 평균 (2장=1.2, 3장=1.6 중간)
  const condenseFactor = 1 + condenseTriggerRate * CONDENSE_MULT_AVG

  const avgDamage = Math.round(baseGatherDamage * affinityFactor * condenseFactor)

  const detail =
    `주력원소=${bestGatherEl}(${cardCounts[bestGatherEl]}장), ` +
    `기대핸드=${bestGatherCount.toFixed(1)}장, ` +
    `gather배율×${gatherMult.toFixed(2)}, ` +
    `상성×${affinityFactor.toFixed(2)}, ` +
    `응축보정×${condenseFactor.toFixed(2)}`

  return { avgDamage, detail }
}

/**
 * 반격 손실 계산
 * balance.ts 4-3 공식 기준:
 * 총 반격 손실 = (maxPlays × counterDamage) + heavyAttack 손실
 * 4층 rage: counterDamage × 1.5 (rage 발동은 조건부이나 최악 케이스로 1회 적용)
 */
function estimateCounterLoss(floorIdx: number): number {
  const fc = FLOOR_CONFIGS[floorIdx]
  const maxPlays = fc.maxPlays
  const cd = fc.counterDamage

  // rage 발동 여부 (4층 bossExtraGimmick.type === 'rage')
  const rageActive = (fc as { bossExtraGimmick?: { type: string; counterMult: number } }).bossExtraGimmick?.type === 'rage'
  const rageMult = rageActive ? 1.5 : 1.0

  const normalCounterLoss = maxPlays * cd * rageMult

  // heavyAttack 손실
  let heavyLoss = 0
  const ha = fc.heavyAttack
  if (ha) {
    const heavyCount = Math.floor(maxPlays / ha.everyN)
    heavyLoss = heavyCount * ha.damage
  }

  return Math.round(normalCounterLoss + heavyLoss)
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('팔자전 재밸런스 R3 — 용신 함수 도출 + 기대 데미지 보상 + 예산 감사', () => {
  it('R3 전체: 용신 검증 + 예산 감사 + 재시뮬 + 최종 판정', () => {
    const RUNS = 1000

    console.log('\n========== 팔자전 재밸런스 R3 시뮬레이션 ==========')
    console.log(`판 수: ${RUNS}판 × 각 프리셋`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 2: 용신 함수 도출 검증
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 2: 용신 함수 도출 검증 ===')
    console.log('getFavorableElement(ilganElement) 호출 결과:')
    const yongsinMok = getFavorableElement('mok')
    const yongsinGeum = getFavorableElement('geum')
    const yongsinTo = getFavorableElement('to')
    console.log(`  mok 일간 → 용신: ${yongsinMok}  (기대: su, R1 하드코딩 su — 일치: ${yongsinMok === 'su'})`)
    console.log(`  geum 일간 → 용신: ${yongsinGeum}  (기대: to, R1 하드코딩 to — 일치: ${yongsinGeum === 'to'})`)
    console.log(`     ※ R2 test에서 geumSu 용신 'mok'으로 기재된 것은 오류 — 정정값: '${yongsinGeum}'`)
    console.log(`  to 일간 → 용신: ${yongsinTo}  (기대: hwa, R2 test에서 'mok' 기재 — 오류 정정: '${yongsinTo}')`)
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 3: 보상 스킵 옵션 확인 결과
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 3: 보상 스킵 옵션 존재 여부 ===')
    console.log("  paljajeonEngine.ts의 'floor-reward' 페이즈 확인 결과:")
    console.log("  - 'skip' 또는 'skip-reward' 액션: 미존재")
    console.log("  - 게임에 보상 스킵 옵션 없음 → 3장 중 최대 기대 데미지 선택만 구현")
    console.log("  보상 전략 변경: '부족 오행 고정 선택' → '기대 데미지 최대화 선택'")
    console.log("  구현: evaluateDeckDamageScore(tempDeck, nextEnemyEl, favorableEl) 비교")
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 작업 4: 데미지 예산 감사 표
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 4: 데미지 예산 감사 (계산 기반) ===')
    console.log('방법: maxPlays × 평균콤보데미지(응축포함) vs 적HP + 예상반격손실')
    console.log('상성 배율: 랜덤화 기준 기댓값 1.0 적용')
    console.log('')

    const DECK_TYPES = [
      { label: '목화 우세', dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>, yongsin: 'su' as Element },
      { label: '금수 우세', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>, yongsin: 'to' as Element },
      { label: '토 단일',   dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>, yongsin: 'hwa' as Element },
    ]

    const FLOOR_LABELS = ['1층', '2층', '3층', '4층']

    for (const dt of DECK_TYPES) {
      console.log(`--- ${dt.label} (20장 배분, 용신=${dt.yongsin}) ---`)
      const cardDist = distributeCards20(dt.dist)
      console.log(`  덱 구성: mok=${cardDist.mok}, hwa=${cardDist.hwa}, to=${cardDist.to}, geum=${cardDist.geum}, su=${cardDist.su}`)
      console.log('')
      console.log(`  | 층 | maxPlays | 적HP | 적감소 | 실효HP | 평균콤보 | 총예산 | 반격손실 | 필요데미지 | 여유(+)/부족(-) | 부족률 |`)
      console.log(`  |----|---------|-----|--------|-------|---------|------|---------|---------|--------------|------|`)

      const budgetData: Array<{
        floor: number
        maxPlays: number
        enemyHp: number
        effectiveHp: number
        avgCombo: number
        totalBudget: number
        counterLoss: number
        needed: number
        margin: number
        shortfallPct: number
      }> = []

      for (let fi = 0; fi < 4; fi++) {
        const fc = FLOOR_CONFIGS[fi]
        const maxPlays = fc.maxPlays
        const enemyHp = fc.enemyHp

        // 4층 damage-reduction 30%: 실효HP = enemyHp / (1 - 0.3)
        const dmgReduction = (fc as { eliteGimmickEffect?: { type: string; pct?: number } }).eliteGimmickEffect?.pct ?? 0
        const effectiveHp = dmgReduction > 0 ? Math.round(enemyHp / (1 - dmgReduction)) : enemyHp

        const { avgDamage, detail } = estimateAvgComboDamage(dt.dist, null)  // 상성 기댓값 1.0
        const totalBudget = maxPlays * avgDamage
        const counterLoss = estimateCounterLoss(fi)
        const needed = effectiveHp + counterLoss
        const margin = totalBudget - needed
        const shortfallPct = needed > 0 ? ((needed - totalBudget) / needed * 100) : 0

        budgetData.push({ floor: fi + 1, maxPlays, enemyHp, effectiveHp, avgCombo: avgDamage, totalBudget, counterLoss, needed, margin, shortfallPct })

        const reductionStr = dmgReduction > 0 ? `-${Math.round(dmgReduction * 100)}%` : '-'
        const marginStr = margin >= 0 ? `+${margin}` : `${margin}`
        const shortfallStr = shortfallPct > 0 ? `${shortfallPct.toFixed(1)}%` : `-${(-shortfallPct).toFixed(1)}%`

        console.log(
          `  | ${FLOOR_LABELS[fi]} | ${String(maxPlays).padStart(7)} | ${String(enemyHp).padStart(3)} ` +
          `| ${reductionStr.padStart(6)} | ${String(effectiveHp).padStart(5)} ` +
          `| ${String(avgDamage).padStart(7)} | ${String(totalBudget).padStart(5)} ` +
          `| ${String(counterLoss).padStart(7)} | ${String(needed).padStart(9)} ` +
          `| ${marginStr.padStart(14)} | ${shortfallStr.padStart(6)} |`,
        )
        console.log(`    [계산근거] ${detail}`)
      }
      console.log('')

      // 레버 계산 (부족한 층 기준)
      const shortfallFloors = budgetData.filter(d => d.margin < 0)
      if (shortfallFloors.length > 0) {
        console.log(`  [레버 계산 — 이든 판단용, 수치 변경 제안 아님]`)
        for (const d of shortfallFloors) {
          const addPlay = d.avgCombo  // maxPlays +1 시 예산 증가분
          const newShortfallPct = (d.needed - (d.totalBudget + addPlay)) / d.needed * 100
          const hpReductionNeeded = (-d.margin / d.needed * 100)
          console.log(
            `    ${d.floor}층: maxPlays ${d.maxPlays}→${d.maxPlays + 1} 하면 예산 +${addPlay} ` +
            `(부족률 ${d.shortfallPct.toFixed(1)}%→${newShortfallPct.toFixed(1)}%p)`,
          )
          console.log(
            `    ${d.floor}층: 적HP ${d.enemyHp}을 ${hpReductionNeeded.toFixed(1)}% 하향 시 부족 해소`,
          )
        }
      } else {
        console.log(`  → 전 층 예산 여유 있음`)
      }
      console.log('')
    }

    // ──────────────────────────────────────────────────────────────
    // 작업 5: R3-A/B/C 재시뮬
    // ──────────────────────────────────────────────────────────────
    console.log('=== 작업 5: R3-A/B/C 재시뮬 (1000판 × 3) ===')
    console.log('조건: 용신 함수 도출(ilganElement) + 기대 데미지 보상 전략 + R2 랜덤화 + 층 보상 O')
    console.log('')

    const reportA = runFullCapSimulation(RUNS, R3_mokHwa)
    const reportB = runFullCapSimulation(RUNS, R3_geumSu)
    const reportC = runFullCapSimulation(RUNS, R3_to)

    const clearRates = {
      A: reportA.clearRate,
      B: reportB.clearRate,
      C: reportC.clearRate,
    }

    console.log('--- R3 시뮬 결과 ---')
    console.log('프리셋                         | 용신(도출값) | 클리어율 | 1층사망 | 2층사망 | 3층사망 | 4층사망 | 응축/판 | 융합/판')
    for (const [label, yongsin, report] of [
      ['R3-A 목화우세(il=mok)', yongsinMok, reportA],
      ['R3-B 금수우세(il=geum)', yongsinGeum, reportB],
      ['R3-C 토단일(il=to)', yongsinTo, reportC],
    ] as const) {
      const d = report.deathsByFloor
      console.log(
        `  ${label.padEnd(31)} | ${yongsin.padEnd(12)} | ${report.clearRate.toFixed(1).padStart(5)}% | ` +
        `${String(d[1] ?? 0).padStart(5)} | ${String(d[2] ?? 0).padStart(5)} | ` +
        `${String(d[3] ?? 0).padStart(5)} | ${String(d[4] ?? 0).padStart(5)} | ` +
        `${report.condensesPerRun.toFixed(2)} | ${report.fusionsPerRun.toFixed(2)}`,
      )
    }
    console.log('')

    // R2.5 G'/H'/I' vs R3-A/B/C 비교
    console.log('--- R2.5 → R3 변화량 ---')
    console.log('(R2.5 수치는 이전 시뮬 실행 결과 기준, R3는 금회 결과)')
    console.log(`  R3-A 목화: ${clearRates.A.toFixed(1)}%  (R2.5 G' 기준 비교 불가 — 별도 실행 필요)`)
    console.log(`  R3-B 금수: ${clearRates.B.toFixed(1)}%  (R2.5 H' 기준 비교 불가 — 별도 실행 필요)`)
    console.log(`  R3-C 토단일: ${clearRates.C.toFixed(1)}%  (R2.5 I' 기준 비교 불가 — 별도 실행 필요)`)
    console.log('  ※ 용신 변경: geumSu to→to(정정), to mok→hwa(정정) — 변화량은 R3 자체 판정')
    console.log('')

    // ──────────────────────────────────────────────────────────────
    // 최종 판정
    // ──────────────────────────────────────────────────────────────
    const targetMin = 25
    const targetMax = 40
    const targetGap = 15

    const allValues = Object.values(clearRates)
    const maxRate = Math.max(...allValues)
    const minRate = Math.min(...allValues)
    const gap = maxRate - minRate

    const allInRange = allValues.every(r => r >= targetMin && r <= targetMax)
    const gapOk = gap <= targetGap

    console.log('=== 최종 판정 (R3-A/B/C 기준) ===')
    console.log(`  목표: 전 사주 ${targetMin}~${targetMax}% + 격차 ${targetGap}%p 이내`)
    for (const [label, rate] of [
      ['R3-A 목화', clearRates.A],
      ['R3-B 금수', clearRates.B],
      ['R3-C 토단일', clearRates.C],
    ]) {
      const inRange = (rate as number) >= targetMin && (rate as number) <= targetMax
      console.log(
        `  ${label}: ${(rate as number).toFixed(1)}% ` +
        `${inRange ? '[범위내]' : `[범위외 — 목표: ${targetMin}~${targetMax}%]`}`,
      )
    }
    console.log(`  격차: ${gap.toFixed(1)}%p ${gapOk ? '[OK]' : `[초과 — 목표: ${targetGap}%p 이내]`}`)
    console.log(`  종합: ${allInRange && gapOk ? 'PASS' : 'FAIL — 추가 조정 필요 (수치 자의적 변경 금지, 이든 판단 후 진행)'}`)
    console.log('')
    console.log('=======================================================')
    console.log('R3 시뮬레이션 완료')
    console.log('=======================================================\n')

    // 시뮬레이션 자체 완료 검증 (수치 강제 PASS 금지)
  }, 600000)
})
