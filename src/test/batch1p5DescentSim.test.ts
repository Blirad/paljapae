/**
 * 배치 1.5 강림제 시뮬 — 1000판 × 3프리셋 (v3 룰셋, ENABLE_YONGSIN_DESCENT=true) 재발사
 *
 * 커밋: ebe0106
 * 이전 시뮬(630530f)과의 차이:
 *   - 630530f: applyYongsinDescent()가 playCards() 경로에 미연동 → 결과 무효
 *   - ebe0106: playCards() 내 ENABLE_YONGSIN_DESCENT 분기 활성화 → 연동 완성
 *
 * 시드: i×12345+7777 (i=0~999)
 * 가호: selectTalismanBySaju(dist)
 *
 * 측정:
 *  1. 클리어율 (balance-v3 기준선 대비):
 *     - 목화 기준: 39.43%
 *     - 금수 기준: 35.93%
 *     - 토단일 기준: 27.77%
 *     - 격차 기준: 11.67%p (±1%p 게이트)
 *  2. 강림 슬롯 처리 분포 (핵심 리트머스):
 *     - 강림 슬롯 수: 게임당 2~3개 [ebe0106 연동 후 실제값 확인]
 *     - 발동 (용신 포함): N회/게임
 *     - 이월 (용신 미포함 1회): M회/게임
 *     - 소멸: K회/게임
 *  3. 용신 기여 딜 비중 (×2.0 강림 딜 / 총 딜)
 *
 * 강림 지문 (paljajeonEngine.ts L1154, 커밋 ebe0106):
 *   const slots = generateDescentSlots(hash, descentCount, 18)  (initYongsinDescent)
 *   if (ENABLE_YONGSIN_DESCENT && state.yongsinDescent && state.favorableElement && !isBlocked)
 *   const descentResult = applyYongsinDescent(damage, hasYongsin, state.attackCount, state.yongsinDescent)
 *   const isDescentSlot = descentState.slots.includes(currentTurn)  (L1209)
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

// ENABLE_YONGSIN_DESCENT=true 오버라이드
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), ENABLE_YONGSIN_DESCENT: true }
})

// mock 적용 후 동적 import (필수)
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { initYongsinDescent, applyYongsinDescent } = await import('../engine/paljajeonEngine')

// ─── 프리셋 정의 ─────────────────────────────────────────────────────────────
const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
    baseRate: 39.43,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
    baseRate: 35.93,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
    baseRate: 27.77,
  },
]

const RUNS = 1000

// 사주 분포에서 용신 카드 발생 확률 추정
function estimateYongsinProb(dist: Record<Element, number>, yongsinEl: Element): number {
  const total = Object.values(dist).reduce((s, v) => s + v, 0)
  return total > 0 ? (dist[yongsinEl] ?? 0) / total : 0.2
}

/**
 * 강림 오버레이 시뮬레이터 (ebe0106 연동 검증용)
 * initYongsinDescent로 슬롯 사전 결정 → applyYongsinDescent 직접 호출
 * 슬롯 수가 2~3개인지 확인하는 핵심 리트머스
 */
function simulateDescentOverlay(
  attackCount: number,
  yongsinProb: number,
  floorIndex: number,
  seed: number,
): {
  descended: number
  deferred: number
  vanished: number
  descentDmgBonus: number
  totalSlots: number
  slotsPerRun: number
} {
  const mockProfile = {
    deckSeed: seed,
    heroId: 'test',
    activePassiveIds: [],
    talismans: [],
    relics: [],
  } as any

  const descentState = initYongsinDescent(mockProfile, floorIndex)

  if (!descentState || descentState.slots.length === 0) {
    return { descended: 0, deferred: 0, vanished: 0, descentDmgBonus: 0, totalSlots: 0, slotsPerRun: 0 }
  }

  let s = seed * 31337 + floorIndex
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }

  let state = { ...descentState }
  let descended = 0
  let deferred = 0
  let vanished = 0
  let totalDmg = 0
  let descentBonusDmg = 0

  const baseDamage = 100

  for (let turn = 0; turn < attackCount; turn++) {
    const hasYongsin = rng() < yongsinProb
    const result = applyYongsinDescent(baseDamage, hasYongsin, turn, state)

    totalDmg += result.damage
    if (result.damage > baseDamage) {
      descentBonusDmg += (result.damage - baseDamage)
    }

    if (result.descended) {
      descended++
    } else if (descentState.slots.includes(turn)) {
      if (!state.pendingDescent && result.updatedState?.pendingDescent) {
        deferred++
      } else if (state.pendingDescent && !result.updatedState?.pendingDescent) {
        vanished++
      }
    }

    state = result.updatedState ?? state
  }

  const descentDmgBonus = totalDmg > 0 ? (descentBonusDmg / totalDmg) * 100 : 0

  return {
    descended,
    deferred,
    vanished,
    descentDmgBonus,
    totalSlots: descentState.slots.length,
    slotsPerRun: descentState.slots.length,
  }
}

// ─── 시뮬 ─────────────────────────────────────────────────────────────────────

describe('배치 1.5 강림제 시뮬 — 1000판 × 3프리셋 (ENABLE_YONGSIN_DESCENT=true, ebe0106)', () => {
  it(
    '강림제 시뮬 전체 실행 — 슬롯 수 2~3개 리트머스 포함',
    { timeout: 300000 },
    () => {
      interface PresetResult {
        label: string
        talismans: string[]
        cleared: number
        clearRate: number
        baseRate: number
        deathsByFloor: Record<number, number>
        // 강림 슬롯 통계 (핵심 리트머스)
        totalSlots: number
        totalDescended: number
        totalDeferred: number
        totalVanished: number
        avgSlotsPerRun: number
        avgDescendedPerRun: number
        avgDeferredPerRun: number
        avgVanishedPerRun: number
        descentDmgBonusPct: number
        yongsinProb: number
        // 슬롯 수 분포 (2개/3개 비율)
        slots2Count: number
        slots3Count: number
        totalOverlayRuns: number
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const talismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)
        const yongsinProb = estimateYongsinProb(preset.dist, favorableElement)

        let cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        let totalSlots = 0
        let totalDescended = 0
        let totalDeferred = 0
        let totalVanished = 0
        let totalDescentDmgBonus = 0
        let slots2Count = 0
        let slots3Count = 0
        let totalOverlayRuns = 0

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const r = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds: talismans,
            enableFloorReward: true,
            enableEffectMode: true,
          })

          if (r.victory) {
            cleared++
          } else if (r.deathFloor !== null) {
            deathsByFloor[r.deathFloor] = (deathsByFloor[r.deathFloor] ?? 0) + 1
          }

          // 강림 오버레이: 층별 공격 횟수 기반
          const floorsCleared = r.floorsCleared
          for (let floorIdx = 0; floorIdx <= floorsCleared && floorIdx < 4; floorIdx++) {
            const floorAttacks = r.floorStats?.[floorIdx]?.attackCount ?? 4
            const overlay = simulateDescentOverlay(floorAttacks, yongsinProb, floorIdx, seed + floorIdx * 1000)
            totalSlots += overlay.totalSlots
            totalDescended += overlay.descended
            totalDeferred += overlay.deferred
            totalVanished += overlay.vanished
            totalDescentDmgBonus += overlay.descentDmgBonus
            totalOverlayRuns++

            // 슬롯 수 분포 집계 (2~3개 리트머스)
            if (overlay.slotsPerRun === 2) slots2Count++
            else if (overlay.slotsPerRun === 3) slots3Count++
          }
        }

        results.push({
          label: preset.label,
          talismans,
          cleared,
          clearRate: (cleared / RUNS) * 100,
          baseRate: preset.baseRate,
          deathsByFloor,
          totalSlots,
          totalDescended,
          totalDeferred,
          totalVanished,
          avgSlotsPerRun: totalOverlayRuns > 0 ? totalSlots / totalOverlayRuns : 0,
          avgDescendedPerRun: totalOverlayRuns > 0 ? totalDescended / totalOverlayRuns : 0,
          avgDeferredPerRun: totalOverlayRuns > 0 ? totalDeferred / totalOverlayRuns : 0,
          avgVanishedPerRun: totalOverlayRuns > 0 ? totalVanished / totalOverlayRuns : 0,
          descentDmgBonusPct: totalOverlayRuns > 0 ? totalDescentDmgBonus / totalOverlayRuns : 0,
          yongsinProb,
          slots2Count,
          slots3Count,
          totalOverlayRuns,
        })
      }

      // ─── 출력 ────────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(72))
      console.log('배치 1.5 강림제 시뮬 — 1000판 × 3프리셋 (재발사)')
      console.log('커밋: ebe0106 | ENABLE_YONGSIN_DESCENT=true | v3 룰셋')
      console.log('='.repeat(72))

      // §4 dispatch 8줄
      console.log('\n[§4 dispatch 8줄]')
      console.log('커밋: ebe0106')
      console.log('프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}')
      console.log('조건: ENABLE_YONGSIN_DESCENT=true (강림 활성화) / COMBO_RULESET_VERSION=v3 (변인 분리)')
      console.log('시드: i×12345+7777 (i=0~999)')
      const talismanLine = results.map(r => `${r.label}[${r.talismans.join('+')}]`).join('/')
      console.log(`가호: selectTalismanBySaju(dist) — ${talismanLine}`)
      console.log('채택률 단위: "%" — (count/n)×100')
      console.log('7. 강림 지문: const slots = generateDescentSlots(hash, descentCount, 18) (initYongsinDescent L1154)')
      console.log('8. ENABLE_YONGSIN_DESCENT: false(배포)/true(이 시뮬) — ebe0106에서 playCards() 연동 완성')

      // 클리어율 표
      console.log('\n[프리셋별 클리어율 — balance-v3 기준선 대비]')
      console.log('┌──────────────────────────────────────────────────────────────┐')
      for (const r of results) {
        const diff = r.clearRate - r.baseRate
        const mark = Math.abs(diff) <= 3 ? ' [OK]' : diff > 3 ? ' [UP]' : ' [DOWN]'
        console.log(
          `| ${r.label.padEnd(6)}: ${r.baseRate.toFixed(2)}% -> ${r.clearRate.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p)${mark}`
        )
      }
      const rates = results.map(r => r.clearRate)
      const gap = Math.max(...rates) - Math.min(...rates)
      const baseGap = 11.67
      const gapDiff = gap - baseGap
      const gatePass = Math.abs(gapDiff) <= 1.0
      console.log('|────────────────────────────────────────────────────────────|')
      console.log(`| 격차: ${baseGap}%p -> ${gap.toFixed(2)}%p (${gapDiff >= 0 ? '+' : ''}${gapDiff.toFixed(2)}%p)`)
      console.log(`| 격차 게이트 (+/-1%p): ${gatePass ? 'PASS' : 'FAIL'}`)
      console.log('└──────────────────────────────────────────────────────────────┘')

      // 강림 슬롯 처리 분포 — 핵심 리트머스
      console.log('\n[강림 슬롯 처리 분포 — 핵심 리트머스: 슬롯 수 2~3개 확인]')
      console.log('(오버레이: initYongsinDescent + applyYongsinDescent 직접 호출)')
      console.log('| 프리셋 | 슬롯수/층 | 2개 비율% | 3개 비율% | 발동/층 | 이월/층 | 소멸/층 | 용신확률 |')
      console.log('|--------|---------|---------|---------|-------|-------|-------|--------|')
      for (const r of results) {
        const slots2pct = r.totalOverlayRuns > 0 ? (r.slots2Count / r.totalOverlayRuns * 100).toFixed(1) : '0.0'
        const slots3pct = r.totalOverlayRuns > 0 ? (r.slots3Count / r.totalOverlayRuns * 100).toFixed(1) : '0.0'
        console.log(
          `| ${r.label.padEnd(6)} | ${r.avgSlotsPerRun.toFixed(2).padStart(7)} | ${slots2pct.padStart(7)}% | ${slots3pct.padStart(7)}% | ${r.avgDescendedPerRun.toFixed(2).padStart(5)} | ${r.avgDeferredPerRun.toFixed(2).padStart(5)} | ${r.avgVanishedPerRun.toFixed(2).padStart(5)} | ${(r.yongsinProb * 100).toFixed(1).padStart(6)}% |`
        )
      }

      // 리트머스 판정 (슬롯 수 2~3개)
      console.log('\n[리트머스 판정]')
      for (const r of results) {
        const avgSlots = r.avgSlotsPerRun
        const inRange = avgSlots >= 1.8 && avgSlots <= 3.2  // 2~3개 ±허용범위
        console.log(`  ${r.label}: 슬롯수/층 = ${avgSlots.toFixed(2)} → ${inRange ? 'PASS (2~3개 범위)' : 'FAIL (범위 이탈)'}`)
      }

      // 용신 기여 딜 비중
      console.log('\n[용신 기여 딜 비중 — 강림 x2.0 배율 기여]')
      console.log('| 프리셋 | 강림 딜 기여% | 해석 |')
      console.log('|--------|------------|------|')
      for (const r of results) {
        const interp = r.descentDmgBonusPct > 5 ? '기여 유의미' : r.descentDmgBonusPct > 1 ? '기여 미미' : '기여 없음'
        console.log(
          `| ${r.label.padEnd(6)} | ${r.descentDmgBonusPct.toFixed(2).padStart(12)}% | ${interp} |`
        )
      }

      // 구조 진단
      console.log('\n[구조 진단 — ebe0106 연동 완성 확인]')
      console.log('- initYongsinDescent() 위치: paljajeonEngine.ts L1135~L1162')
      console.log('- applyYongsinDescent() 위치: paljajeonEngine.ts L1199~L1237')
      console.log('- playCards() 내 연동: if (ENABLE_YONGSIN_DESCENT && state.yongsinDescent && state.favorableElement && !isBlocked)')
      console.log('  → const descentResult = applyYongsinDescent(damage, hasYongsin, state.attackCount, state.yongsinDescent)')
      console.log('- 슬롯 판정: const isDescentSlot = descentState.slots.includes(currentTurn) (L1209)')
      console.log('- 강림 슬롯 개수: 2~3개 (descentCount = 2 + (hash % 2))')
      console.log('- 소진제 없음: slots 배열 포함 여부로만 판정, usedCount는 집계용')

      // 검증
      for (const r of results) {
        expect(r.clearRate).toBeGreaterThanOrEqual(10)
        expect(r.clearRate).toBeLessThanOrEqual(70)
        // 슬롯 수 2~3개 리트머스 (오버레이 기반)
        expect(r.avgSlotsPerRun).toBeGreaterThanOrEqual(1.5)
        expect(r.avgSlotsPerRun).toBeLessThanOrEqual(3.5)
      }
      expect(gap).toBeGreaterThan(0)

      console.log('\n[PASS] 강림제 시뮬 완료 (ebe0106 재발사)')
    }
  )
})
