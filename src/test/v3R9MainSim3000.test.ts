/**
 * v3R9MainSim3000.test.ts
 * balance-v3 R9 본시뮬 — 3000판 × 3종
 *
 * R9 변경:
 *  - CONDENSE_SCALE_BASE: 10 → 8
 *  - 2층 HP: 430 → 445
 *
 * 커밋: e40e0c8
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

describe('balance-v3 R9 본시뮬 — 3000판 × 3종', () => {
  it(
    'R9: CONDENSE_SCALE_BASE=8 + 2층HP=445 시뮬 결과',
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
      console.log('balance-v3 R9 본시뮬 — 3000판 × 3종')
      console.log('커밋: e40e0c8 | CONDENSE_SCALE_BASE=8 | 2층HP=445')
      console.log('='.repeat(70))

      // §4 dispatch 6줄
      console.log('\n[§4 dispatch 6줄]')
      console.log('커밋: e40e0c8')
      console.log('프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}')
      console.log('조건: enableEffectMode=true/enableFloorReward=true/enableCondenseClamp=true(기준8,하한0.6)')
      console.log('시드: i×12345+7777 (i=0~2999)')
      const talismanLine = results.map(r => `${r.label}[${r.selectedTalismans.join('+')}]`).join('/')
      console.log(`가호: selectTalismanBySaju(dist) — ${talismanLine}`)
      console.log('채택률 단위: "%" — (count/n)×100')

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
      const traitNames = ['wildfire', 'nourish', 'mining', 'purification']
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

      // R8 vs R9 비교표 (R8 기준값 하드코딩)
      console.log('\n[R8 vs R9 비교표]\n')
      console.log('| 지표 | R8 (커밋 34f2830) | R9 (커밋 e40e0c8) | 변화 |')
      console.log('|------|-------------------|-------------------|------|')
      const R8 = { mok: 40.03, geum: 37.03, to: 24.30, gap: 15.73 }
      const mokR9 = results.find(r => r.label === '목화')
      const geumR9 = results.find(r => r.label === '금수')
      const toR9 = results.find(r => r.label === '토단일')
      if (mokR9 && geumR9 && toR9) {
        const mokR9pct = mokR9.ci.point * 100
        const geumR9pct = geumR9.ci.point * 100
        const toR9pct = toR9.ci.point * 100
        const gapR9 = Math.max(mokR9pct, geumR9pct, toR9pct) - Math.min(mokR9pct, geumR9pct, toR9pct)
        console.log(`| 목화 클리어율 | ${R8.mok}% | ${mokR9pct.toFixed(2)}% | ${(mokR9pct - R8.mok).toFixed(2)}%p |`)
        console.log(`| 금수 클리어율 | ${R8.geum}% | ${geumR9pct.toFixed(2)}% | ${(geumR9pct - R8.geum).toFixed(2)}%p |`)
        console.log(`| 토단일 클리어율 | ${R8.to}% | ${toR9pct.toFixed(2)}% | ${(toR9pct - R8.to).toFixed(2)}%p |`)
        console.log(`| 프리셋 간 격차 | ${R8.gap}%p | ${gapR9.toFixed(2)}%p | ${(gapR9 - R8.gap).toFixed(2)}%p |`)
        // 2층 사망 변화 (R8 기준: 목화 959, 금수 673, 토단일 582)
        const R8_floor2 = { mok: 959, geum: 673, to: 582 }
        console.log(`| 2층 사망 (목화) | ${R8_floor2.mok}(32.0%) | ${mokR9.deathsByFloor[2]}(${(mokR9.deathsByFloor[2]/3000*100).toFixed(1)}%) | ${mokR9.deathsByFloor[2] - R8_floor2.mok}판 |`)
        console.log(`| 2층 사망 (금수) | ${R8_floor2.geum}(22.4%) | ${geumR9.deathsByFloor[2]}(${(geumR9.deathsByFloor[2]/3000*100).toFixed(1)}%) | ${geumR9.deathsByFloor[2] - R8_floor2.geum}판 |`)
        console.log(`| 2층 사망 (토단일) | ${R8_floor2.to}(19.4%) | ${toR9.deathsByFloor[2]}(${(toR9.deathsByFloor[2]/3000*100).toFixed(1)}%) | ${toR9.deathsByFloor[2] - R8_floor2.to}판 |`)
        // 응축/판 변화 (R8: 목화 0.167, 금수 0.136, 토단일 0.219)
        const R8_condense = { mok: 0.167, geum: 0.136, to: 0.219 }
        console.log(`| 응축/판 (목화) | ${R8_condense.mok} | ${(mokR9.condenseTotal/3000).toFixed(3)} | ${((mokR9.condenseTotal/3000) - R8_condense.mok).toFixed(3)} |`)
        console.log(`| 응축/판 (금수) | ${R8_condense.geum} | ${(geumR9.condenseTotal/3000).toFixed(3)} | ${((geumR9.condenseTotal/3000) - R8_condense.geum).toFixed(3)} |`)
        console.log(`| 응축/판 (토단일) | ${R8_condense.to} | ${(toR9.condenseTotal/3000).toFixed(3)} | ${((toR9.condenseTotal/3000) - R8_condense.to).toFixed(3)} |`)
      }

      console.log('\n' + '='.repeat(70))
      console.log('R9 시뮬 완료')
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
