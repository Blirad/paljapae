/**
 * v4 토단일 4층 HP 스윕 측정 (2026-07-18)
 *
 * 목적: A벌 경사(step1=0.70 / step2=0.45) 고정 + 4층 HP 스윕으로
 *        토단일 44.7%→25~40% 착지 후보 탐색
 *
 * 후보 3개: 680 / 730 / 780
 * 고정 조건: 1층=308 / 2층=623 / 3층=952 / A벌 곡선(peak=1.0/step1=0.70/step2=0.45)
 * 게이트: 전 프리셋 25~40% + 격차 ≤15%p
 * 경보: 목화 하한 25% 미달 시 BELOW_MIN_FLAG 명시
 *
 * 정본 mock 규격 (1차 무효 사고 재발 방지):
 *   - getFloorHp 함수 자체를 mock (배열 교체 금지)
 *   - V4_RATIO_CORRECTION: A벌 값 명시 주입
 *   - 측정 루프 진입 전 HP 실효값 assert 4건 (4층은 후보값으로)
 *
 * 시드: i×12345+7777 (1000판 × 3프리셋 × 3후보 = 9000판)
 * 산출물: /tmp/v4_todanil_hp_sweep.json
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ── 후보 4층 HP 목록 ──
const FLOOR4_CANDIDATES = [680, 730, 780]

// ── 고정 HP (1~3층) ──
const HP1 = 308
const HP2 = 623
const HP3 = 952

// ── A벌 곡선 ──
const TABLE_A = { peak: 1.0, step1: 0.70, step2: 0.45 }

// ── 게이트 기준 ──
const GATE_MIN = 25
const GATE_MAX = 40
const GATE_SPREAD = 15
const RUNS = 1000

// ── 프리셋 ──
const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
  },
  {
    key: 'geumSu',
    label: '금수',
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
  },
  {
    key: 'toDanil',
    label: '토단일',
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
  },
]

// ────────────────────────────────────────────────────────────────
// 후보별 측정 함수
// vi.mock은 모듈 단위로 한 번만 등록 가능하므로
// 3후보를 단일 테스트 파일 내에서 모두 측정한다.
// getFloorHp mock이 현재_floor4Hp 클로저 변수를 참조하도록 구성한다.
// ────────────────────────────────────────────────────────────────

let currentFloor4Hp = FLOOR4_CANDIDATES[0]  // 초기값 (측정 루프에서 갱신)

vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const V4_FLOOR_HP_TABLE_actual = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{
    floor: number
    enemyHp: number
    [k: string]: unknown
  }>

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',

    // ── 정본 mock 핵심: getFloorHp 함수 자체 교체 ──
    // 1~3층: 고정값(308/623/952) 반환
    // 4층: currentFloor4Hp 클로저 변수 참조 (후보 전환 시 갱신)
    getFloorHp: (floorIndex: number, _override?: string) => {
      if (floorIndex === 0) return HP1
      if (floorIndex === 1) return HP2
      if (floorIndex === 2) return HP3
      if (floorIndex === 3) return currentFloor4Hp
      // 안전망: 정의 외 층은 실제 테이블 참조
      const hp = V4_FLOOR_HP_TABLE_actual[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },

    // ── A벌 비율 보정 계수 명시 주입 ──
    V4_RATIO_CORRECTION: {
      peak: TABLE_A.peak,
      step1: TABLE_A.step1,
      step2: TABLE_A.step2,
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { getFloorHp } = await import('../engine/balance')

// ────────────────────────────────────────────────────────────────
// 측정 유틸
// ────────────────────────────────────────────────────────────────

interface PresetResult {
  label: string
  clearRate: number
  gatePass: boolean
  belowMin: boolean   // 목화 하한 25% 미달 경보
}

interface CandidateResult {
  floor4Hp: number
  presets: PresetResult[]
  spread: number
  spreadPass: boolean
  allPresetPass: boolean
  gatePass: boolean   // 전 프리셋 PASS + 격차 PASS
  step0: number
  step1: number
  step2: number
  fusion5Rate: number
  yeonhwanRate: number
}

function runCandidate(floor4Hp: number): CandidateResult {
  // 후보 HP 전환
  currentFloor4Hp = floor4Hp

  // ── HP assert (측정 루프 진입 전 필수) ──
  const hp1 = getFloorHp(0)
  const hp2 = getFloorHp(1)
  const hp3 = getFloorHp(2)
  const hp4 = getFloorHp(3)

  console.log(`\n[HP ASSERT] 4층HP=${floor4Hp} 후보`)
  console.log(`  1층=${hp1}(expect:${HP1}) / 2층=${hp2}(expect:${HP2}) / 3층=${hp3}(expect:${HP3}) / 4층=${hp4}(expect:${floor4Hp})`)

  expect(hp1, `[HP mock 결함] 1층 HP !== ${HP1}`).toBe(HP1)
  expect(hp2, `[HP mock 결함] 2층 HP !== ${HP2}`).toBe(HP2)
  expect(hp3, `[HP mock 결함] 3층 HP !== ${HP3}`).toBe(HP3)
  expect(hp4, `[HP mock 결함] 4층 HP !== ${floor4Hp}`).toBe(floor4Hp)

  console.log(`  HP assert 4건 PASS`)

  let totalStep0 = 0, totalStep1 = 0, totalStep2 = 0
  let total2CardExempt = 0, total5Card = 0
  let totalYeonhwan = 0, totalAttacks = 0, totalFusionAll = 0

  const presets: PresetResult[] = []

  for (const preset of PRESETS) {
    const favorableElement = getFavorableElement(preset.ilgan)
    const activePassiveIds = selectTalismanBySaju(preset.dist)
    let victories = 0

    for (let i = 0; i < RUNS; i++) {
      const result = simulateFullCapRun(i * 12345 + 7777, {
        elementDist: preset.dist,
        ilganElement: preset.ilgan,
        favorableElement,
        enableFloorReward: true,
        enableEffectMode: true,
        activePassiveIds,
      })
      if (result.victory) victories++

      const tc = result.traitCounts ?? {}
      const gs0 = tc['v4_fusion_step0'] ?? 0
      const gs1 = tc['v4_fusion_step1'] ?? 0
      const gs2 = tc['v4_fusion_step2'] ?? 0

      totalStep0 += gs0
      totalStep1 += gs1
      totalStep2 += gs2
      total2CardExempt += tc['v4_fusion_2card_exempt'] ?? 0
      total5Card += tc['v4_fusion_5card'] ?? 0
      totalYeonhwan += tc['ohang-yeonhwan'] ?? 0

      for (const fs of result.floorStats ?? []) totalAttacks += fs.attackCount
    }

    const clearRate = parseFloat(((victories / RUNS) * 100).toFixed(1))
    const gatePass = clearRate >= GATE_MIN && clearRate <= GATE_MAX
    const belowMin = clearRate < GATE_MIN

    presets.push({ label: preset.label, clearRate, gatePass, belowMin })

    const flag = belowMin ? ' ⚠ BELOW_MIN_FLAG' : ''
    console.log(`  [4층HP=${floor4Hp}] ${preset.label}: ${clearRate}% — ${gatePass ? 'PASS' : 'FAIL'}${flag}`)
  }

  const totalFusionHG = totalStep0 + totalStep1 + totalStep2
  totalFusionAll = totalFusionHG + total2CardExempt
  const fusion5Rate = totalFusionAll > 0 ? parseFloat(((total5Card / totalFusionAll) * 100).toFixed(1)) : 0
  const yeonhwanRate = totalAttacks > 0 ? parseFloat(((totalYeonhwan / totalAttacks) * 100).toFixed(2)) : 0

  const rates = presets.map(p => p.clearRate)
  const spread = parseFloat((Math.max(...rates) - Math.min(...rates)).toFixed(1))
  const spreadPass = spread <= GATE_SPREAD
  const allPresetPass = presets.every(p => p.gatePass)
  const gatePass = allPresetPass && spreadPass

  console.log(`  [4층HP=${floor4Hp}] 격차=${spread}%p — ${spreadPass ? 'PASS' : 'FAIL'} / 종합=${gatePass ? 'PASS' : 'FAIL'}`)
  console.log(`  step0=${totalStep0} / step1=${totalStep1} / step2=${totalStep2} / 5장발동률=${fusion5Rate}% / 연환성립률=${yeonhwanRate}%`)

  return {
    floor4Hp,
    presets,
    spread,
    spreadPass,
    allPresetPass,
    gatePass,
    step0: totalStep0,
    step1: totalStep1,
    step2: totalStep2,
    fusion5Rate,
    yeonhwanRate,
  }
}

// ────────────────────────────────────────────────────────────────
// 테스트 본문
// ────────────────────────────────────────────────────────────────

describe('v4 토단일 4층 HP 스윕 — A벌 경사 고정 (2026-07-18)', () => {
  it(
    '4층HP 3후보(680/730/780) × A벌(0.70/0.45) × 1000판 × 3프리셋',
    { timeout: 5400000 },
    () => {
      console.log('\n========================================')
      console.log('v4 토단일 4층 HP 스윕 측정 시작')
      console.log(`곡선: A벌 (step1=${TABLE_A.step1} / step2=${TABLE_A.step2})`)
      console.log(`고정 HP: 1층=${HP1} / 2층=${HP2} / 3층=${HP3}`)
      console.log(`후보: ${FLOOR4_CANDIDATES.join(' / ')}`)
      console.log(`시드: i×12345+7777 / 1000판 × 3프리셋 × 3후보`)
      console.log('========================================\n')

      const results: CandidateResult[] = []

      for (const hp4 of FLOOR4_CANDIDATES) {
        const r = runCandidate(hp4)
        results.push(r)
      }

      // ── step2 실집계 확인 (1차 결함 직접 검증) ──
      const totalStep2Sum = results.reduce((s, r) => s + r.step2, 0)
      expect(totalStep2Sum, 'step2 = 0건 — V4_RATIO_CORRECTION mock 결함').toBeGreaterThan(0)
      expect(results).toHaveLength(3)

      // ── 결과 출력 ──
      console.log('\n========================================')
      console.log('게이트 판정표')
      console.log('========================================')
      console.log('| 프리셋 | 4층HP=680 | 4층HP=730 | 4층HP=780 |')
      console.log('|--------|-----------|-----------|-----------|')

      for (const preset of PRESETS) {
        const cells = results.map(r => {
          const p = r.presets.find(x => x.label === preset.label)!
          const flag = p.belowMin ? '⚠' : ''
          return `${p.clearRate}%(${p.gatePass ? 'PASS' : 'FAIL'}${flag})`
        })
        console.log(`| ${preset.label.padEnd(6)} | ${cells[0].padEnd(17)} | ${cells[1].padEnd(17)} | ${cells[2].padEnd(17)} |`)
      }

      const spreadCells = results.map(r => `${r.spread}%p(${r.spreadPass ? 'PASS' : 'FAIL'})`)
      console.log(`| 격차    | ${spreadCells[0].padEnd(17)} | ${spreadCells[1].padEnd(17)} | ${spreadCells[2].padEnd(17)} |`)

      const gateCells = results.map(r => r.gatePass ? 'PASS' : 'FAIL')
      console.log(`| 종합    | ${gateCells[0].padEnd(17)} | ${gateCells[1].padEnd(17)} | ${gateCells[2].padEnd(17)} |`)

      // ── 최적 후보 권고 ──
      console.log('\n========================================')
      console.log('최적 후보 권고')
      console.log('========================================')

      const passCandidates = results.filter(r => r.gatePass)
      if (passCandidates.length > 0) {
        // 전 프리셋 게이트 만족 후보 중 토단일 클리어율이 가장 낮은(안전한) 값 선택
        passCandidates.sort((a, b) => {
          const toA = a.presets.find(p => p.label === '토단일')!.clearRate
          const toB = b.presets.find(p => p.label === '토단일')!.clearRate
          return toA - toB
        })
        const best = passCandidates[0]
        const toRate = best.presets.find(p => p.label === '토단일')!.clearRate
        const mokRate = best.presets.find(p => p.label === '목화')!.clearRate
        const geumRate = best.presets.find(p => p.label === '금수')!.clearRate
        console.log(`권고: 4층 HP = ${best.floor4Hp}`)
        console.log(`  목화 ${mokRate}% / 금수 ${geumRate}% / 토단일 ${toRate}% / 격차 ${best.spread}%p`)
        console.log('  전 프리셋 25~40% + 격차 ≤15%p 만족')
      } else {
        // 게이트 만족 없음 — 가장 근접한 후보 선택 (토단일 40% 미만 중 가장 높은 것)
        console.log('전 프리셋 게이트 만족 후보 없음 — 근접값 및 추가 스윕 방향 제시')

        // 각 후보별 토단일 클리어율 확인
        results.forEach(r => {
          const to = r.presets.find(p => p.label === '토단일')!
          const mok = r.presets.find(p => p.label === '목화')!
          const geum = r.presets.find(p => p.label === '금수')!
          const issues: string[] = []
          if (!to.gatePass) issues.push(`토단일 ${to.clearRate}%`)
          if (!mok.gatePass) issues.push(`목화 ${mok.clearRate}%`)
          if (!geum.gatePass) issues.push(`금수 ${geum.clearRate}%`)
          if (!r.spreadPass) issues.push(`격차 ${r.spread}%p`)
          console.log(`  4층HP=${r.floor4Hp}: 미달 항목 = [${issues.join(', ')}]`)
        })

        // 토단일이 40% 이하인 후보 중 목화가 25 이상인 가장 작은 HP 권고
        const toBelow40 = results.filter(r => {
          const to = r.presets.find(p => p.label === '토단일')!
          const mok = r.presets.find(p => p.label === '목화')!
          return to.clearRate <= 40 && mok.clearRate >= GATE_MIN
        })

        if (toBelow40.length > 0) {
          toBelow40.sort((a, b) => a.floor4Hp - b.floor4Hp)
          const best = toBelow40[0]
          console.log(`\n근접값 권고: 4층 HP = ${best.floor4Hp}`)
          console.log('  토단일≤40% + 목화≥25% 조건 만족. 금수 또는 격차 추가 조정 필요.')

          // 추가 스윕 방향
          const toRate = best.presets.find(p => p.label === '토단일')!.clearRate
          if (toRate > 35) {
            console.log(`  추가 스윕 방향: 4층 HP ${best.floor4Hp + 25}~${best.floor4Hp + 50} 범위 상향 탐색 (토단일 추가 하락 필요)`)
          } else {
            console.log(`  추가 스윕 방향: 현재 범위 내 격차/목화 개선 확인 필요`)
          }
        } else {
          // 토단일 40% 이하 없음 — 더 큰 HP 필요
          const maxHp = Math.max(...FLOOR4_CANDIDATES)
          const minTo = Math.min(...results.map(r => r.presets.find(p => p.label === '토단일')!.clearRate))
          console.log(`\n토단일 최저값 ${minTo}% (4층HP=${maxHp}) — 아직 40% 초과`)
          console.log(`추가 스윕 방향: 4층 HP ${maxHp + 50}~${maxHp + 100} 상향 스윕 필요`)
        }
      }

      // ── JSON 산출물 ──
      const output = {
        meta: {
          date: '2026-07-18',
          curve: 'A벌',
          table: TABLE_A,
          fixedHp: { floor1: HP1, floor2: HP2, floor3: HP3 },
          candidates: FLOOR4_CANDIDATES,
          runs: RUNS,
          seed: 'i×12345+7777',
          gateMin: GATE_MIN,
          gateMax: GATE_MAX,
          gateSpread: GATE_SPREAD,
        },
        hpAssertLog: {
          floor1: { expected: HP1, checked: 'PASS' },
          floor2: { expected: HP2, checked: 'PASS' },
          floor3: { expected: HP3, checked: 'PASS' },
          floor4: { candidates: FLOOR4_CANDIDATES, checked: 'PASS' },
        },
        results: results.map(r => ({
          floor4Hp: r.floor4Hp,
          presets: r.presets,
          spread: r.spread,
          spreadPass: r.spreadPass,
          allPresetPass: r.allPresetPass,
          gatePass: r.gatePass,
          distribution: {
            step0: r.step0,
            step1: r.step1,
            step2: r.step2,
            fusion5Rate: r.fusion5Rate,
            yeonhwanRate: r.yeonhwanRate,
          },
        })),
        recommendation: (() => {
          const pass = results.filter(r => r.gatePass)
          if (pass.length > 0) {
            pass.sort((a, b) => {
              const toA = a.presets.find(p => p.label === '토단일')!.clearRate
              const toB = b.presets.find(p => p.label === '토단일')!.clearRate
              return toA - toB
            })
            return { type: 'PASS', floor4Hp: pass[0].floor4Hp }
          }
          return { type: 'NONE_PASS', note: '전 프리셋 게이트 미달 — 추가 스윕 필요' }
        })(),
      }

      writeFileSync('/tmp/v4_todanil_hp_sweep.json', JSON.stringify(output, null, 2))
      console.log('\n산출물 → /tmp/v4_todanil_hp_sweep.json 저장 완료')
    },
  )
})
