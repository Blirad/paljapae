/**
 * v3MainSim3000.test.ts
 * balance-v3 재기준선 발사 — 3000판 × 3종
 *
 * 발사 조건: 작업 1~4 완료 후 실행.
 *
 * 측정 6줄 (§2 dispatch 규격):
 *  1. 판수×프리셋: 3000판 × 3종 (목화/금수/토단일)
 *  2. 기본 지표: 클리어율 (Wilson 95% CI) + 프리셋 간 격차
 *  3. 효과 채택률: 자양/잔불/채굴/응축 옵션별 선택 비율 (enableEffectMode=true)
 *  4. 연환 발생률: ×8 연환 발생 횟수/판
 *  5. 모으기 장수 분포: 각 층에서 선택된 gather 조합 장수 분포 (1장~5장)
 *  6. 응축 투입값 분포: 응축 발동 시 condenseCount 분포 (화N + 토M 조합별)
 *
 * 시드: i * 12345 + 7777
 * enableFloorReward: true
 * enableEffectMode: true (balance-v3 기준선)
 * activePassiveIds: selectTalismanBySaju(dist)
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

describe('balance-v3 재기준선 — 3000판 × 3종 (enableEffectMode=true)', () => {
  it(
    '§2 dispatch 6줄 측정 (클리어율/효과채택률/연환/모으기/응축)',
    { timeout: 600000 },
    () => {
      const RUNS = 3000

      interface PresetResult {
        label: string
        selectedTalismans: string[]
        cleared: number
        total: number
        ci: ReturnType<typeof wilsonCI>
        deathsByFloor: Record<number, number>
        // §2 효과 채택률
        effectUsed: Record<string, number>
        attackUsed: Record<string, number>
        // §2 연환 발생률
        yeonhwanCount: number
        // §2 모으기 장수 분포
        gatherDist: Record<string, number>
        // §2 응축 발동 횟수
        condenseTotal: number
        // 전체 traitCounts
        traitCounts: Record<string, number>
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        const effectUsed: Record<string, number> = {}
        const attackUsed: Record<string, number> = {}
        let yeonhwanCount = 0
        const gatherDist: Record<string, number> = {
          gather2: 0, gather3: 0, gather4: 0, gather5: 0,
        }
        let condenseTotal = 0
        const traitCounts: Record<string, number> = {}

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const r = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds: selectedTalismans,
            enableFloorReward: true,
            enableEffectMode: true,  // balance-v3 기준선
          })

          if (r.victory) {
            cleared++
          } else if (r.deathFloor !== null) {
            deathsByFloor[r.deathFloor] = (deathsByFloor[r.deathFloor] ?? 0) + 1
          }

          if (r.traitCounts) {
            for (const [k, v] of Object.entries(r.traitCounts)) {
              traitCounts[k] = (traitCounts[k] ?? 0) + v

              // 효과/공격 채택 분류
              if (k.startsWith('effect_')) effectUsed[k] = (effectUsed[k] ?? 0) + v
              else if (k.startsWith('attack_')) attackUsed[k] = (attackUsed[k] ?? 0) + v

              // 연환 발생
              if (k === 'ohang-yeonhwan') yeonhwanCount += v

              // 모으기 분포
              if (k === 'gather2') gatherDist.gather2 += v
              if (k === 'gather3') gatherDist.gather3 += v
              if (k === 'gather4') gatherDist.gather4 += v
              if (k === 'gather5') gatherDist.gather5 += v

              // 응축
              if (k === 'yonggigama') condenseTotal += v
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
          effectUsed,
          attackUsed,
          yeonhwanCount,
          gatherDist,
          condenseTotal,
          traitCounts,
        })
      }

      // ─── 출력 ───────────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(70))
      console.log('balance-v3 재기준선 — 3000판 × 3종 (enableEffectMode=true)')
      console.log('='.repeat(70))

      // §2-1: 클리어율 + Wilson 95% CI
      console.log('\n[§2-1] 클리어율 + Wilson 95% CI\n')
      console.log('| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | ±CI |')
      console.log('|--------|--------|----------|---------|---------|-----|')
      for (const r of results) {
        const ciW = ((r.ci.high - r.ci.low) * 100 / 2).toFixed(2)
        console.log(
          `| ${r.label.padEnd(6)} | ${r.cleared}/${r.total} ` +
          `| ${(r.ci.point * 100).toFixed(2).padStart(7)}% ` +
          `| ${(r.ci.low * 100).toFixed(2).padStart(6)}% ` +
          `| ${(r.ci.high * 100).toFixed(2).padStart(6)}% ` +
          `| ±${ciW}%p |`
        )
      }

      const rates = results.map(r => r.ci.point * 100)
      const maxRate = Math.max(...rates)
      const minRate = Math.min(...rates)
      const gap = maxRate - minRate
      console.log(`\n프리셋 간 격차: ${gap.toFixed(2)}%p`)
      console.log(`R10 기준선 (enableEffectMode=false): 목화 37.53% / 금수 32.73% / 토단일 31.23%`)

      // §2-2: 층별 사망 분포
      console.log('\n| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |')
      console.log('|--------|----------|----------|----------|----------|--------|')
      for (const r of results) {
        const cols = [1, 2, 3, 4].map(f => {
          const cnt = r.deathsByFloor[f] ?? 0
          return `${cnt}(${(cnt / r.total * 100).toFixed(1)}%)`
        })
        console.log(`| ${r.label.padEnd(6)} | ${cols.join(' | ')} | ${r.cleared} |`)
      }

      // §2-3: 효과 채택률
      const traitNames = ['wildfire', 'nourish', 'mining', 'purification']
      console.log('\n[§2-3] 효과 채택률 (effectMode=true 조건)\n')
      console.log('| 프리셋 | wildfire | nourish | mining | purification |')
      console.log('|--------|----------|---------|--------|--------------|')
      for (const r of results) {
        const fmt = (name: string) => {
          const eff = r.effectUsed[`effect_${name}_used`] ?? 0
          const atk = r.attackUsed[`attack_${name}_used`] ?? 0
          const total = eff + atk
          if (total === 0) return '  N/A  '
          return `${((eff / total) * 100).toFixed(1).padStart(5)}%`
        }
        console.log(`| ${r.label.padEnd(6)} | ${fmt('wildfire')} | ${fmt('nourish')} | ${fmt('mining')} | ${fmt('purification')} |`)
      }
      console.log('\n  목표: 5~60% 자연 분포 (0%=사장/70%+=독식 경고)')

      // §2-4: 연환 발생률 (×8 YEONHWAN)
      console.log('\n[§2-4] 오행연환 발생률 (×8 YEONHWAN)\n')
      console.log('| 프리셋 | 연환 총합 | 발생률/판 | 판정 |')
      console.log('|--------|-----------|-----------|------|')
      for (const r of results) {
        const rate = r.yeonhwanCount / r.total
        const pctStr = (rate * 100).toFixed(2)
        const judge = rate >= 0.05 && rate <= 0.20 ? 'OK(5~20%)' : rate < 0.05 ? '낮음' : '높음'
        console.log(`| ${r.label.padEnd(6)} | ${r.yeonhwanCount.toString().padStart(8)} | ${pctStr.padStart(8)}% | ${judge} |`)
      }

      // §2-5: 모으기 장수 분포
      console.log('\n[§2-5] 모으기 장수 분포 (발동/판)\n')
      console.log('| 프리셋 | 2장 | 3장 | 4장 | 5장 | 합계/판 |')
      console.log('|--------|-----|-----|-----|-----|---------|')
      for (const r of results) {
        const g2 = (r.gatherDist.gather2 / r.total).toFixed(2)
        const g3 = (r.gatherDist.gather3 / r.total).toFixed(2)
        const g4 = (r.gatherDist.gather4 / r.total).toFixed(2)
        const g5 = (r.gatherDist.gather5 / r.total).toFixed(2)
        const tot = (Object.values(r.gatherDist).reduce((a, b) => a + b, 0) / r.total).toFixed(2)
        console.log(`| ${r.label.padEnd(6)} | ${g2} | ${g3} | ${g4} | ${g5} | ${tot} |`)
      }

      // §2-6: 응축 투입값 분포 (발동 횟수/판)
      console.log('\n[§2-6] 응축 발동 횟수/판 (yonggigama trait)\n')
      console.log('| 프리셋 | 응축 총합 | 응축/판 |')
      console.log('|--------|-----------|---------|')
      for (const r of results) {
        const perRun = r.condenseTotal / r.total
        console.log(`| ${r.label.padEnd(6)} | ${r.condenseTotal.toString().padStart(8)} | ${perRun.toFixed(3).padStart(6)} |`)
      }

      // 가호 선택 확인
      console.log('\n[가호 선택] selectTalismanBySaju 결과\n')
      for (const r of results) {
        console.log(`  ${r.label}: ${r.selectedTalismans.join('+')}`)
      }

      // 전체 trait 키 상위 15 (목화 기준)
      console.log('\n[traitCounts 상위 15 — 목화]\n')
      const mokResult = results[0]
      if (mokResult) {
        const sorted = Object.entries(mokResult.traitCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 15)
        for (const [k, v] of sorted) {
          console.log(`  ${k}: ${(v / RUNS).toFixed(3)}/판`)
        }
      }

      console.log('\n' + '='.repeat(70))
      console.log('balance-v3 기준선 완료')
      console.log('='.repeat(70))

      // 검증: 시뮬 정상 완료 확인
      for (const r of results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared).toBeGreaterThanOrEqual(0)
        expect(r.cleared).toBeLessThanOrEqual(RUNS)
        // 최소 클리어율 10% 이상 (완전 붕괴 방지)
        expect(r.cleared / RUNS).toBeGreaterThan(0.10)
      }

      console.log('\n판정: PASS')
    },
  )
})
