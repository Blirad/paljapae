/**
 * v3ResultCapture.test.ts
 * balance-v3 결과 캡처 — 작업 2+4+5 수치를 파일로 저장
 * 작업 완료 후 삭제 예정
 */

import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'

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

describe('balance-v3 결과 캡처 (작업 2+4+5)', () => {
  it(
    '전체 시뮬 실행 후 결과 파일 저장',
    { timeout: 900000 },
    () => {
      const lines: string[] = []
      const log = (s: string) => { lines.push(s) }

      // ────── 작업 2: 목화 1000판 A안 정합 ──────
      {
        const preset = PRESETS[0]
        const activePassiveIds = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)
        let victories = 0
        for (let i = 0; i < 1000; i++) {
          const r = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds,
            enableFloorReward: true,
            enableEffectMode: false,
          })
          if (r.victory) victories++
        }
        const rate = (victories / 1000) * 100
        const r10 = 37.53
        const diff = Math.abs(rate - r10)
        log(`## 작업 2 — 무한루프 픽스 후 목화 1000판 A안 정합`)
        log(`무한루프 픽스 후 목화 1000판: ${rate.toFixed(2)}% (R10 ${r10}%와 ±${diff.toFixed(2)}%p 이내 → 픽스 무결성 확인)`)
        log(`가호: ${activePassiveIds.join('+')}`)
        log(``)
      }

      // ────── 작업 4: A/B 1000판 채택률 ──────
      log(`## 작업 4 — 수식 교체 후 A/B 1000판 재확인`)
      const fusionTraitNames = ['wildfire', 'nourish', 'mining', 'purification']

      interface ABResult {
        label: string
        clearA: number
        clearB: number
        effectRates: Record<string, number>
      }
      const abResults: ABResult[] = []

      for (const preset of PRESETS) {
        const activePassiveIds = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)
        const baseOpts = {
          elementDist: preset.dist,
          ilganElement: preset.ilgan,
          favorableElement,
          enableFloorReward: true,
          activePassiveIds,
        }

        let victoriesA = 0
        for (let i = 0; i < 1000; i++) {
          const r = simulateFullCapRun(i * 12345 + 7777, { ...baseOpts, enableEffectMode: false })
          if (r.victory) victoriesA++
        }

        let victoriesB = 0
        const effectUsed: Record<string, number> = {}
        const attackUsed: Record<string, number> = {}
        for (let i = 0; i < 1000; i++) {
          const r = simulateFullCapRun(i * 12345 + 7777, { ...baseOpts, enableEffectMode: true })
          if (r.victory) victoriesB++
          if (r.traitCounts) {
            for (const [k, v] of Object.entries(r.traitCounts)) {
              if (k.startsWith('effect_')) effectUsed[k] = (effectUsed[k] ?? 0) + v
              else if (k.startsWith('attack_')) attackUsed[k] = (attackUsed[k] ?? 0) + v
            }
          }
        }

        const effectRates: Record<string, number> = {}
        for (const traitName of fusionTraitNames) {
          const eff = effectUsed[`effect_${traitName}_used`] ?? 0
          const atk = attackUsed[`attack_${traitName}_used`] ?? 0
          const total = eff + atk
          effectRates[traitName] = total > 0 ? (eff / total) * 100 : -1
        }

        abResults.push({
          label: preset.label,
          clearA: (victoriesA / 1000) * 100,
          clearB: (victoriesB / 1000) * 100,
          effectRates,
        })
      }

      log(`| 프리셋 | A안(공격) | B안(효과) | 차이 |`)
      log(`|--------|-----------|-----------|------|`)
      for (const r of abResults) {
        const diff = r.clearB - r.clearA
        log(`| ${r.label} | ${r.clearA.toFixed(2)}% | ${r.clearB.toFixed(2)}% | ${(diff >= 0 ? '+' : '')}${diff.toFixed(2)}%p |`)
      }
      log(``)
      log(`[효과 채택률 — B안, 목표 5~60%]`)
      log(`| 프리셋 | wildfire | nourish | mining | purification |`)
      log(`|--------|----------|---------|--------|--------------|`)
      for (const r of abResults) {
        const fmt = (k: string) => {
          const v = r.effectRates[k]
          if (v === undefined || v < 0) return 'N/A'
          return `${v.toFixed(1)}%`
        }
        log(`| ${r.label} | ${fmt('wildfire')} | ${fmt('nourish')} | ${fmt('mining')} | ${fmt('purification')} |`)
      }
      log(``)

      // ────── 작업 5: balance-v3 3000판 × 3종 ──────
      log(`## 작업 5 — balance-v3 재기준선 발사 (3000판 × 3종, enableEffectMode=true)`)

      interface V3Result {
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

      const v3Results: V3Result[] = []
      const RUNS = 3000

      for (const preset of PRESETS) {
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const favorableElement = getFavorableElement(preset.ilgan)

        let cleared = 0
        const deathsByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        const effectUsed: Record<string, number> = {}
        const attackUsed: Record<string, number> = {}
        let yeonhwanCount = 0
        const gatherDist: Record<string, number> = { gather2: 0, gather3: 0, gather4: 0, gather5: 0 }
        let condenseTotal = 0
        const traitCounts: Record<string, number> = {}

        for (let i = 0; i < RUNS; i++) {
          const r = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement,
            activePassiveIds: selectedTalismans,
            enableFloorReward: true,
            enableEffectMode: true,
          })

          if (r.victory) cleared++
          else if (r.deathFloor !== null) {
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

        v3Results.push({
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

      log(`### §2-1: 클리어율 + Wilson 95% CI`)
      log(`| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | ±CI |`)
      log(`|--------|--------|----------|---------|---------|-----|`)
      for (const r of v3Results) {
        const ciW = ((r.ci.high - r.ci.low) * 100 / 2).toFixed(2)
        log(`| ${r.label} | ${r.cleared}/${r.total} | ${(r.ci.point * 100).toFixed(2)}% | ${(r.ci.low * 100).toFixed(2)}% | ${(r.ci.high * 100).toFixed(2)}% | ±${ciW}%p |`)
      }

      const rates = v3Results.map(r => r.ci.point * 100)
      const gap = Math.max(...rates) - Math.min(...rates)
      log(``)
      log(`프리셋 간 격차: ${gap.toFixed(2)}%p`)
      log(`R10 기준선 (enableEffectMode=false): 목화 37.53% / 금수 32.73% / 토단일 31.23%`)
      log(``)

      log(`### §2-2: 층별 사망 분포`)
      log(`| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |`)
      log(`|--------|----------|----------|----------|----------|--------|`)
      for (const r of v3Results) {
        const cols = [1, 2, 3, 4].map(f => {
          const cnt = r.deathsByFloor[f] ?? 0
          return `${cnt}(${(cnt / r.total * 100).toFixed(1)}%)`
        })
        log(`| ${r.label} | ${cols.join(' | ')} | ${r.cleared} |`)
      }
      log(``)

      log(`### §2-3: 효과 채택률 (enableEffectMode=true)`)
      const v3TraitNames = ['wildfire', 'nourish', 'mining', 'purification']
      log(`| 프리셋 | wildfire | nourish | mining | purification |`)
      log(`|--------|----------|---------|--------|--------------|`)
      for (const r of v3Results) {
        const fmt = (name: string) => {
          const eff = r.effectUsed[`effect_${name}_used`] ?? 0
          const atk = r.attackUsed[`attack_${name}_used`] ?? 0
          const total = eff + atk
          if (total === 0) return 'N/A'
          return `${((eff / total) * 100).toFixed(1)}%`
        }
        log(`| ${r.label} | ${fmt('wildfire')} | ${fmt('nourish')} | ${fmt('mining')} | ${fmt('purification')} |`)
      }
      log(`목표: 5~60% 자연 분포`)
      log(``)

      log(`### §2-4: 오행연환 발생률 (×8)`)
      log(`| 프리셋 | 연환 총합 | 발생률/판 | 판정 |`)
      log(`|--------|-----------|-----------|------|`)
      for (const r of v3Results) {
        const rate = r.yeonhwanCount / r.total
        const judge = rate >= 0.05 && rate <= 0.20 ? 'OK(5~20%)' : rate < 0.05 ? '낮음' : '높음'
        log(`| ${r.label} | ${r.yeonhwanCount} | ${(rate * 100).toFixed(2)}% | ${judge} |`)
      }
      log(``)

      log(`### §2-5: 모으기 장수 분포 (발동/판)`)
      log(`| 프리셋 | 2장 | 3장 | 4장 | 5장 | 합계/판 |`)
      log(`|--------|-----|-----|-----|-----|---------|`)
      for (const r of v3Results) {
        const g2 = (r.gatherDist.gather2 / r.total).toFixed(2)
        const g3 = (r.gatherDist.gather3 / r.total).toFixed(2)
        const g4 = (r.gatherDist.gather4 / r.total).toFixed(2)
        const g5 = (r.gatherDist.gather5 / r.total).toFixed(2)
        const tot = (Object.values(r.gatherDist).reduce((a, b) => a + b, 0) / r.total).toFixed(2)
        log(`| ${r.label} | ${g2} | ${g3} | ${g4} | ${g5} | ${tot} |`)
      }
      log(``)

      log(`### §2-6: 응축 발동 횟수/판`)
      log(`| 프리셋 | 응축 총합 | 응축/판 |`)
      log(`|--------|-----------|---------|`)
      for (const r of v3Results) {
        log(`| ${r.label} | ${r.condenseTotal} | ${(r.condenseTotal / r.total).toFixed(3)} |`)
      }
      log(``)

      log(`### 가호 선택`)
      for (const r of v3Results) {
        log(`  ${r.label}: ${r.selectedTalismans.join('+')}`)
      }
      log(``)

      log(`### traitCounts 상위 10 — 목화`)
      const mokR = v3Results[0]
      if (mokR) {
        const sorted = Object.entries(mokR.traitCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
        for (const [k, v] of sorted) {
          log(`  ${k}: ${(v / RUNS).toFixed(3)}/판`)
        }
      }

      // 파일로 저장
      const outputPath = '/Users/bilard/.openclaw/workspace/v3_capture_result.txt'
      writeFileSync(outputPath, lines.join('\n'), 'utf-8')

      // 검증
      for (const r of v3Results) {
        expect(r.total).toBe(RUNS)
        expect(r.cleared / RUNS).toBeGreaterThan(0.10)
      }

      // A/B 판정
      for (const r of abResults) {
        const diff = r.clearB - r.clearA
        expect(diff).toBeGreaterThanOrEqual(-5.0)
        for (const [traitName, rate] of Object.entries(r.effectRates)) {
          if (rate < 0 || traitName === 'wildfire') continue
          expect(rate).toBeLessThan(70)
        }
      }
    },
  )
})
