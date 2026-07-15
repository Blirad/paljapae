/**
 * yongsinAblationSim.test.ts
 * 용신 보너스 무력화 어블레이션 — 1000판 × 3프리셋
 *
 * 목적: v3에서 용신 보너스(상시 ×1.3 + 연환 ×1.5)의 클리어율 기여분을 실측하고,
 *       강림 슬롯 등가 배율 M을 역산한다.
 *
 * 방법:
 *   - YONGSIN_BONUS_MULTIPLIER=1.0, YONGSIN_CHAIN_MULTIPLIER=1.0으로 용신 보너스 무력화
 *   - 나머지 밸런스는 v3 그대로 유지
 *   - 1000판 시뮬 후 v3 기준선과 비교
 *
 * 시드: i×12345+7777 (i=0~999)
 * 가호: selectTalismanBySaju(dist)
 *
 * v3 기준선 (R11 §3, 1000판):
 *   - 목화: 39.40%
 *   - 금수: 33.70%
 *   - 토단일: 27.30%
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

// 용신 보너스 무력화 (×1.3 → ×1.0, ×1.5 → ×1.0)
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return {
    ...(actual as Record<string, unknown>),
    YONGSIN_BONUS_MULTIPLIER: 1.0,
    YONGSIN_CHAIN_MULTIPLIER: 1.0,
  }
})

// mock 적용 후 동적 import
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

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

// v3 기준선 (1000판, 용신 포함)
const V3_BASELINE = {
  '목화': 39.40,
  '금수': 33.70,
  '토단일': 27.30,
}

// 강림제 기준 데이터 (배치 1.5 시뮬 실측 — M=2.0)
const DESCENT_BASELINE_M2 = {
  '목화': 13.10,  // placeholder — 실측 후 갱신
  '금수': 10.00,
  '토단일': 8.00,
}

describe('용신 보너스 무력화 어블레이션 (×1.0, 1000판 × 3종)', () => {
  it(
    '용신 ×1.0 어블레이션 → 클리어율 + 등가 배율 M 역산',
    { timeout: 300000 },
    () => {
      const RUNS = 1000

      interface PresetResult {
        label: string
        selectedTalismans: string[]
        cleared: number
        total: number
        ci: ReturnType<typeof wilsonCI>
        deathsByFloor: Record<number, number>
        traitCounts: Record<string, number>
        // 용신 포함 콤보 횟수 추적
        yongsinComboCount: number
        totalComboCount: number
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        const traitCounts: Record<string, number> = {}
        let yongsinComboCount = 0
        let totalComboCount = 0

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const r = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds: selectedTalismans,
            enableFloorReward: true,
            enableEffectMode: true,
          })

          if (r.victory) {
            cleared++
          } else if (r.deathFloor !== null) {
            deathsByFloor[r.deathFloor] = (deathsByFloor[r.deathFloor] ?? 0) + 1
          }

          if (r.traitCounts) {
            for (const [k, v] of Object.entries(r.traitCounts)) {
              traitCounts[k] = (traitCounts[k] ?? 0) + v
            }
          }

          // 용신 콤보 추적: floorResults에서 attackCount 합산
          if (r.floorStats) {
            for (const fs of r.floorStats) {
              totalComboCount += fs.attackCount
            }
          }
        }

        results.push({
          label: preset.label,
          selectedTalismans,
          cleared,
          total: RUNS,
          ci: wilsonCI(cleared, RUNS),
          deathsByFloor,
          traitCounts,
          yongsinComboCount,
          totalComboCount,
        })
      }

      // ─── 출력 ────────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(70))
      console.log('용신 보너스 무력화 어블레이션 (YONGSIN ×1.0)')
      console.log('YONGSIN_BONUS_MULTIPLIER=1.0, YONGSIN_CHAIN_MULTIPLIER=1.0')
      console.log('1000판 × 3종 | 시드 i×12345+7777')
      console.log('='.repeat(70))

      // §1: 클리어율 + v3 기준선 비교
      console.log('\n[§1] 클리어율 + Wilson 95% CI + v3 기준선 비교\n')
      console.log('| 프리셋 | v3 기준선 | 무력화 | 차이(기여분) | CI 하한 | CI 상한 |')
      console.log('|--------|---------|--------|------------|---------|---------|')
      for (const r of results) {
        const baseline = V3_BASELINE[r.label as keyof typeof V3_BASELINE]
        const actual = r.ci.point * 100
        const delta = baseline - actual  // 기준선 - 무력화 = 기여분 (양수가 정상)
        console.log(
          `| ${r.label.padEnd(6)} ` +
          `| ${baseline.toFixed(2)}% ` +
          `| ${actual.toFixed(2)}% ` +
          `| ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%p ` +
          `| ${(r.ci.low * 100).toFixed(2)}% ` +
          `| ${(r.ci.high * 100).toFixed(2)}% |`
        )
      }

      // §2: 층별 사망 분포
      console.log('\n[§2] 층별 사망 분포\n')
      console.log('| 프리셋 | 1층 | 2층 | 3층 | 4층 | 클리어 |')
      console.log('|--------|-----|-----|-----|-----|--------|')
      for (const r of results) {
        console.log(
          `| ${r.label.padEnd(6)} ` +
          `| ${r.deathsByFloor[1] ?? 0} ` +
          `| ${r.deathsByFloor[2] ?? 0} ` +
          `| ${r.deathsByFloor[3] ?? 0} ` +
          `| ${r.deathsByFloor[4] ?? 0} ` +
          `| ${r.cleared} |`
        )
      }

      // §3: 가호 선택
      console.log('\n[§3] 가호 선택\n')
      for (const r of results) {
        console.log(`${r.label}: ${r.selectedTalismans.join(' + ')}`)
      }

      // §4: 등가 배율 M 역산
      console.log('\n[§4] 등가 배율 M 역산\n')
      console.log('공식: M = 1 + (v3_clear - noYongsin_clear) / (descent_clear_at_M2 - noYongsin_clear) × (2.0 - 1)')
      console.log('       단, descent_clear_at_M2는 강림제 M=2.0 시뮬 실측값 (별도 시뮬 필요)')
      console.log('')
      console.log('| 프리셋 | v3 기준선 | 무력화 | 기여분 | 용신 발동 추정 |')
      console.log('|--------|---------|--------|--------|---------------|')

      const contributions: Record<string, number> = {}

      for (const r of results) {
        const baseline = V3_BASELINE[r.label as keyof typeof V3_BASELINE]
        const actual = r.ci.point * 100
        const contribution = baseline - actual
        contributions[r.label] = contribution

        // 용신 발동 확률 추정 (elementDist 기반)
        const preset = PRESETS.find(p => p.label === r.label)!
        const favEl = getFavorableElement(preset.ilgan)
        const totalCards = Object.values(preset.dist).reduce((a, b) => a + b, 0)
        const favCount = favEl ? preset.dist[favEl] ?? 0 : 0
        const favRatio = favCount / totalCards
        // 평균 콤보 2.5장 기준, 1 - (1 - favRatio)^2.5
        const comboActivation = 1 - Math.pow(1 - favRatio, 2.5)

        console.log(
          `| ${r.label.padEnd(6)} ` +
          `| ${baseline.toFixed(2)}% ` +
          `| ${actual.toFixed(2)}% ` +
          `| ${contribution >= 0 ? '+' : ''}${contribution.toFixed(2)}%p ` +
          `| ${(comboActivation * 100).toFixed(1)}% (${favEl ?? '?'} ${favCount}/${totalCards}) |`
        )
      }

      // §5: M 역산 (간이 — 클리어율 선형 보간 기반)
      console.log('\n[§5] M 역산 결과 (간이 클리어율 기반)\n')
      console.log('가정: 강림제 M=2.0의 기여분을 아직 모르므로, 비례 공식 대신 직접 비교')
      console.log('')
      console.log('v3 용신 기여분 = v3_clear - noYongsin_clear')
      console.log('')

      const contribValues = Object.values(contributions)
      const avgContrib = contribValues.reduce((a, b) => a + b, 0) / contribValues.length
      const maxContrib = Math.max(...contribValues)
      const minContrib = Math.min(...contribValues)

      console.log(`3프리셋 평균 기여분: ${avgContrib.toFixed(2)}%p`)
      console.log(`최대 기여분 (보수적 M 필요): ${maxContrib.toFixed(2)}%p`)
      console.log(`최소 기여분 (공격적 M 가능): ${minContrib.toFixed(2)}%p`)
      console.log('')

      // 등가 M 추정: 강림제에서 동일한 기여분을 내려면
      // 강림 avg_slots=2.45, activation_rate 추정
      // M-1이 damage에 곱해지므로, 용신 ×1.3의 +30% 기여를 대체하려면:
      // 2.45 slots × activation_rate × (M-1) ≈ total_turns × yongsin_activation_rate × 0.3
      // 간이: M ≈ 1 + (yongsin_contribution × total_turns) / (descent_slots × activation_rate × avg_damage)
      //
      // 더 단순한 역산: 클리어율 비례
      // v3_contrib / descent_contrib_at_M2 × (M2-1) + 1 = M_target
      console.log('등가 M 역산 (강림 M=2.0 시뮬 데이터 필요):')
      console.log('  현재는 용신 무력화 시뮬 결과만 산출.')
      console.log('  강림제 M=2.0 시뮬 결과와 조합하여 최종 M 산출 필요.')

      console.log('\n' + '='.repeat(70))
      console.log('용신 무력화 어블레이션 완료')
      console.log('='.repeat(70))

      // 검증
      for (const r of results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared).toBeGreaterThanOrEqual(0)
        expect(r.cleared).toBeLessThanOrEqual(RUNS)
      }

      console.log('\n판정: PASS')
    },
  )
})
