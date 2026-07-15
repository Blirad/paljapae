/**
 * v3R10MainSim3000.test.ts
 * balance-v3 R10 본시뮬 — 3000판 × 3종
 *
 * R10 변경:
 *  - 4층 HP: 560 → 540
 *  - 타 수치 전면 동결 (R9 상태 유지)
 *
 * 커밋: 632c30a
 * 시드: i * 12345 + 7777 (i=0~2999)
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

describe('balance-v3 R10 본시뮬 — 3000판 × 3종', () => {
  it(
    'R10: 4층HP=540 시뮬 결과',
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
        effectUsed: Record<string, number>
        attackUsed: Record<string, number>
        yeonhwanCount: number
        gatherDist: Record<string, number>
        condenseTotal: number
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

              if (k.startsWith('effect_')) effectUsed[k] = (effectUsed[k] ?? 0) + v
              else if (k.startsWith('attack_')) attackUsed[k] = (attackUsed[k] ?? 0) + v

              if (k === 'ohang-yeonhwan') yeonhwanCount += v
              if (k === 'gather2') gatherDist.gather2 += v
              if (k === 'gather3') gatherDist.gather3 += v
              if (k === 'gather4') gatherDist.gather4 += v
              if (k === 'gather5') gatherDist.gather5 += v
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
      console.log('balance-v3 R10 본시뮬 — 3000판 × 3종')
      console.log('커밋: 632c30a | 4층HP=540 | CONDENSE_SCALE_BASE=8 | 2층HP=445')
      console.log('='.repeat(70))

      // §4 dispatch 6줄
      console.log('\n[§4 dispatch 6줄]')
      console.log('커밋: 632c30a')
      console.log('프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}')
      console.log('조건: enableEffectMode=true/enableFloorReward=true/enableCondenseClamp=true(기준8,하한0.6)')
      console.log('시드: i×12345+7777 (i=0~2999)')
      const talismanLine = results.map(r => `${r.label}[${r.selectedTalismans.join('+')}]`).join('/')
      console.log(`가호: selectTalismanBySaju(dist) — ${talismanLine}`)
      console.log('채택률 단위: "%" — (count/n)×100, 단위 "%" 명시')

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

      // §2-2: 층별 사망 분포
      console.log('\n[§2-2] 층별 사망 분포\n')
      console.log('| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |')
      console.log('|--------|----------|----------|----------|----------|--------|')
      for (const r of results) {
        const cols = [1, 2, 3, 4].map(f => {
          const cnt = r.deathsByFloor[f] ?? 0
          return `${cnt}(${(cnt / r.total * 100).toFixed(1)}%)`
        })
        console.log(`| ${r.label.padEnd(6)} | ${cols.join(' | ')} | ${r.cleared} |`)
      }

      // §2-3: 효과 채택률
      console.log('\n[§2-3] wildfire 효과 채택률\n')
      console.log('| 프리셋 | wildfire | nourish | mining | purification |')
      console.log('|--------|----------|---------|--------|--------------|')
      for (const r of results) {
        const fmt = (name: string) => {
          const eff = r.effectUsed[`effect_${name}_used`] ?? 0
          const atk = r.attackUsed[`attack_${name}_used`] ?? 0
          const total = eff + atk
          if (total === 0) return '  0.0%'
          return `${((eff / total) * 100).toFixed(1).padStart(5)}%`
        }
        console.log(`| ${r.label.padEnd(6)} | ${fmt('wildfire')} | ${fmt('nourish')} | ${fmt('mining')} | ${fmt('purification')} |`)
      }

      // §2-4: 오행연환 발생률
      console.log('\n[§2-4] 오행연환 발생률\n')
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

      // §2-6: 응축 발동 횟수/판
      console.log('\n[§2-6] 응축 발동 횟수/판 (R9: CONDENSE_SCALE_BASE=8)\n')
      console.log('| 프리셋 | 응축 총합 | 응축/판 |')
      console.log('|--------|-----------|---------|')
      for (const r of results) {
        const perRun = r.condenseTotal / r.total
        console.log(`| ${r.label.padEnd(6)} | ${r.condenseTotal.toString().padStart(8)} | ${perRun.toFixed(3).padStart(6)} |`)
      }

      // §2-7: 가호 선택
      console.log('\n[§2-7] 가호 선택 (selectTalismanBySaju 실측)\n')
      console.log('| 프리셋 | 가호 |')
      console.log('|--------|------|')
      for (const r of results) {
        console.log(`| ${r.label.padEnd(6)} | ${r.selectedTalismans.join(' + ')} |`)
      }

      // §2-8: traitCounts 상위 15 (목화 기준)
      console.log('\n[§2-8] traitCounts 상위 15 (목화 기준)\n')
      console.log('| 키 | 발생/판 |')
      console.log('|----|---------|')
      const mokResult = results[0]
      if (mokResult) {
        const sorted = Object.entries(mokResult.traitCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 15)
        for (const [k, v] of sorted) {
          console.log(`| ${k} | ${(v / RUNS).toFixed(3)} |`)
        }
      }

      // R9 vs R10 비교표 (R9 기준값 하드코딩)
      console.log('\n[R9 vs R10 비교표]\n')
      console.log('| 지표 | R9 (커밋 e40e0c8) | R10 (커밋 632c30a) | 변화 |')
      console.log('|------|-------------------|-------------------|------|')
      const R9 = { mok: 37.87, geum: 35.60, to: 24.70, gap: 13.17 }
      const R9_floor4 = { mok: 843, geum: 888, to: 810 }
      const mokR10 = results.find(r => r.label === '목화')
      const geumR10 = results.find(r => r.label === '금수')
      const toR10 = results.find(r => r.label === '토단일')
      if (mokR10 && geumR10 && toR10) {
        const mokR10pct = mokR10.ci.point * 100
        const geumR10pct = geumR10.ci.point * 100
        const toR10pct = toR10.ci.point * 100
        const gapR10 = Math.max(mokR10pct, geumR10pct, toR10pct) - Math.min(mokR10pct, geumR10pct, toR10pct)
        console.log(`| 목화 클리어율 | ${R9.mok}% | ${mokR10pct.toFixed(2)}% | ${(mokR10pct - R9.mok >= 0 ? '+' : '')}${(mokR10pct - R9.mok).toFixed(2)}%p |`)
        console.log(`| 금수 클리어율 | ${R9.geum}% | ${geumR10pct.toFixed(2)}% | ${(geumR10pct - R9.geum >= 0 ? '+' : '')}${(geumR10pct - R9.geum).toFixed(2)}%p |`)
        console.log(`| 토단일 클리어율 | ${R9.to}% | ${toR10pct.toFixed(2)}% | ${(toR10pct - R9.to >= 0 ? '+' : '')}${(toR10pct - R9.to).toFixed(2)}%p |`)
        console.log(`| 프리셋 간 격차 | ${R9.gap}%p | ${gapR10.toFixed(2)}%p | ${(gapR10 - R9.gap >= 0 ? '+' : '')}${(gapR10 - R9.gap).toFixed(2)}%p |`)
        // 4층 사망 변화 (R10 핵심 지표)
        console.log(`| 4층 사망 (목화) | ${R9_floor4.mok}(${(R9_floor4.mok/3000*100).toFixed(1)}%) | ${mokR10.deathsByFloor[4]}(${(mokR10.deathsByFloor[4]/3000*100).toFixed(1)}%) | ${mokR10.deathsByFloor[4] - R9_floor4.mok}판 |`)
        console.log(`| 4층 사망 (금수) | ${R9_floor4.geum}(${(R9_floor4.geum/3000*100).toFixed(1)}%) | ${geumR10.deathsByFloor[4]}(${(geumR10.deathsByFloor[4]/3000*100).toFixed(1)}%) | ${geumR10.deathsByFloor[4] - R9_floor4.geum}판 |`)
        console.log(`| 4층 사망 (토단일) | ${R9_floor4.to}(${(R9_floor4.to/3000*100).toFixed(1)}%) | ${toR10.deathsByFloor[4]}(${(toR10.deathsByFloor[4]/3000*100).toFixed(1)}%) | ${toR10.deathsByFloor[4] - R9_floor4.to}판 |`)

        // 이든 예상 착지 vs 실측
        console.log('\n[이든 예상 착지 vs 실측]\n')
        console.log('| 프리셋 | 예상 | 실측 | 차이 |')
        console.log('|--------|------|------|------|')
        const EXPECTED = { mok: 38.7, geum: 36.4, to: 26.2, gap: 12.5 }
        console.log(`| 목화 | ${EXPECTED.mok}% | ${mokR10pct.toFixed(2)}% | ${(mokR10pct - EXPECTED.mok >= 0 ? '+' : '')}${(mokR10pct - EXPECTED.mok).toFixed(2)}%p |`)
        console.log(`| 금수 | ${EXPECTED.geum}% | ${geumR10pct.toFixed(2)}% | ${(geumR10pct - EXPECTED.geum >= 0 ? '+' : '')}${(geumR10pct - EXPECTED.geum).toFixed(2)}%p |`)
        console.log(`| 토단일 | ${EXPECTED.to}% | ${toR10pct.toFixed(2)}% | ${(toR10pct - EXPECTED.to >= 0 ? '+' : '')}${(toR10pct - EXPECTED.to).toFixed(2)}%p |`)
        console.log(`| 격차 | ${EXPECTED.gap}%p | ${gapR10.toFixed(2)}%p | ${(gapR10 - EXPECTED.gap >= 0 ? '+' : '')}${(gapR10 - EXPECTED.gap).toFixed(2)}%p |`)

        // PASS 판정
        console.log('\n[PASS 판정]\n')
        const mokPass = mokR10pct >= 25 && mokR10pct <= 40
        const geumPass = geumR10pct >= 25 && geumR10pct <= 40
        const toPass = toR10pct >= 25 && toR10pct <= 40
        const gapPass = gapR10 <= 15
        console.log(`| 목화 25~40% | ${mokR10pct.toFixed(2)}% | ${mokPass ? 'PASS' : 'FAIL'} |`)
        console.log(`| 금수 25~40% | ${geumR10pct.toFixed(2)}% | ${geumPass ? 'PASS' : 'FAIL'} |`)
        console.log(`| 토단일 25~40% | ${toR10pct.toFixed(2)}% | ${toPass ? 'PASS' : 'FAIL'} |`)
        console.log(`| 격차 ≤15%p | ${gapR10.toFixed(2)}%p | ${gapPass ? 'PASS' : 'FAIL'} |`)

        const allPass = mokPass && geumPass && toPass && gapPass
        console.log(`\n최종 판정: ${allPass ? 'PASS' : 'FAIL'}`)
      }

      console.log('\n' + '='.repeat(70))
      console.log('R10 시뮬 완료')
      console.log('='.repeat(70))

      // 검증
      for (const r of results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared).toBeGreaterThanOrEqual(0)
        expect(r.cleared).toBeLessThanOrEqual(RUNS)
        expect(r.cleared / RUNS).toBeGreaterThan(0.10)
      }

      console.log('\n판정: PASS')
    },
  )
})
