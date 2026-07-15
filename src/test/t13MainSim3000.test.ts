/**
 * T13 본시뮬 — 3000판 (2026-07-12 이든 최종 지시)
 *
 * 조건: T8 배포 커밋 3c2f2c3 반영 확인 후 발사
 *
 * 측정 항목:
 *  1. 클리어율 + 층별 분포 (판정: 25~40%, 격차 15%p)
 *  2. 들불 vs 옹기가마 선택률
 *  3. 연환 발생률 (목표: 출정당 10% 내외)
 *  4. 모으기 장수 분포
 *  5. 가호 유무 대조 1000판 (v1 교량)
 *
 * 프리셋 3종 (기준선 미변경):
 *  - 목화: mok×4, hwa×4, to×2, geum×2, su×2, 일간=목
 *  - 금수: mok×2, hwa×2, to×2, geum×4, su×4, 일간=금
 *  - 토단일: mok×1, hwa×1, to×14, geum×2, su×2, 일간=토
 *
 * 실행: npm test -- src/test/t13MainSim3000.test.ts
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

function pct(v: number, digits = 1): string {
  return (v * 100).toFixed(digits) + '%'
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

describe('T13 본시뮬 — 3000판 (T8 배포 커밋 3c2f2c3)', () => {
  it(
    '프리셋 3종 × 3000판 — 측정 5종 + 가호 대조 1000판',
    { timeout: 300000 },
    () => {
      const RUNS = 3000
      const AB_RUNS = 1000

      // ─── 측정용 누적 구조 ──────────────────────────────────────────────
      interface PresetResult {
        label: string
        dist: Record<Element, number>
        ilgan: Element
        cleared: number
        total: number
        ci: ReturnType<typeof wilsonCI>
        deathByFloor: Record<number, number>
        // 2. 들불 vs 옹기가마: traitCounts에서 wildfire / yonggigama 카운트
        wildfireCount: number
        yonggigamaCount: number
        // 3. 연환 발생 (오행연환 특성: 'ohang' 또는 fusionCount 기반)
        yeonhwanCount: number
        // 4. 모으기 장수 분포 — traitCounts에서 gather_2~5 구분은 현재 엔진이 미지원
        //    fullCapBot FullCapRunResult.condenseCount는 응축 횟수 (모으기와 무관)
        //    모으기 장수 분포는 traitCounts 키로 gather2/3/4/5 확인
        gatherDist: Record<string, number>
        // 특성 전체 카운트
        traitCounts: Record<string, number>
      }

      // ─── 시뮬 루프 (프리셋 3종 × 3000판) ─────────────────────────────
      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        const yongsin = getFavorableElement(preset.ilgan)
        let cleared = 0
        const deathByFloor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
        let wildfireCount = 0
        let yonggigamaCount = 0
        let yeonhwanCount = 0
        const gatherDist: Record<string, number> = {
          gather2: 0,
          gather3: 0,
          gather4: 0,
          gather5: 0,
        }
        const traitCounts: Record<string, number> = {}

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const result = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement: yongsin,
            useFixedFloorElements: false,
            enableFloorReward: true,
          })

          if (result.victory) cleared++
          else {
            const df = result.deathFloor ?? 1
            deathByFloor[df] = (deathByFloor[df] ?? 0) + 1
          }

          if (result.traitCounts) {
            for (const [t, c] of Object.entries(result.traitCounts)) {
              traitCounts[t] = (traitCounts[t] ?? 0) + c
              // 2. 들불 / 옹기가마
              if (t === 'wildfire') wildfireCount += c
              if (t === 'yonggigama') yonggigamaCount += c
              // 4. 모으기 장수 분포
              if (t === 'gather2') gatherDist['gather2'] += c
              if (t === 'gather3') gatherDist['gather3'] += c
              if (t === 'gather4') gatherDist['gather4'] += c
              if (t === 'gather5') gatherDist['gather5'] += c
            }
          }
          // 3. 연환 발생: fusionCount(융합 횟수)와 별도로 오행연환 특성으로 카운트
          //    현재 엔진: traitCounts에 ohang-yeonhwan 키가 있으면 합산
          //    없으면 fusionCount를 근사값으로 사용 (모든 융합 포함이라 상한)
          //    연환 특성 키는 'yeonhwan' 또는 'ohang' — 트레잇 발동 추적 키 확인
          const yhKey = result.traitCounts?.['yeonhwan'] ?? 0
          const ohKey = result.traitCounts?.['ohang'] ?? 0
          yeonhwanCount += (yhKey + ohKey)
        }

        results.push({
          label: preset.label,
          dist: preset.dist,
          ilgan: preset.ilgan,
          cleared,
          total: RUNS,
          ci: wilsonCI(cleared, RUNS),
          deathByFloor,
          wildfireCount,
          yonggigamaCount,
          yeonhwanCount,
          gatherDist,
          traitCounts,
        })
      }

      // ─── 가호 유무 대조 1000판 (v1 교량) ─────────────────────────────
      interface AbResult {
        label: string
        talismans: string[]
        clearA: number
        clearB: number
        totalAb: number
      }

      const abResults: AbResult[] = []

      for (const preset of PRESETS) {
        const yongsin = getFavorableElement(preset.ilgan)
        const selectedTalismans = selectTalismanBySaju(preset.dist)

        let clearA = 0
        let clearB = 0

        for (let i = 0; i < AB_RUNS; i++) {
          const seed = i * 12345 + 7777

          // A: 가호 미장착
          const rA = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement: yongsin,
            enableFloorReward: false,
          })
          if (rA.victory) clearA++

          // B: 가호 사주기반 장착
          const rB = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement: yongsin,
            enableFloorReward: false,
            activePassiveIds: selectedTalismans,
          })
          if (rB.victory) clearB++
        }

        abResults.push({
          label: preset.label,
          talismans: selectedTalismans,
          clearA,
          clearB,
          totalAb: AB_RUNS,
        })
      }

      // ─── 출력 시작 ─────────────────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(60))
      console.log('T13 본시뮬 — 3000판 (T8 배포 커밋 3c2f2c3)')
      console.log('='.repeat(60))

      // 1. 클리어율 + Wilson CI
      console.log('\n[1] 클리어율 + 층별 분포 (Wilson 95% CI)\n')
      console.log('판정 기준: 각 25~40%, 격차 ≤15%p\n')
      console.log('| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | CI 폭 |')
      console.log('|--------|--------|----------|---------|---------|-------|')
      for (const r of results) {
        const ciWidth = ((r.ci.high - r.ci.low) * 100 / 2).toFixed(2)
        console.log(
          `| ${r.label.padEnd(6)} | ${r.cleared.toString().padStart(4)}/${r.total} ` +
          `| ${(r.ci.point * 100).toFixed(2).padStart(7)}% ` +
          `| ${(r.ci.low * 100).toFixed(2).padStart(6)}% ` +
          `| ${(r.ci.high * 100).toFixed(2).padStart(6)}% ` +
          `| ±${ciWidth}%p |`
        )
      }

      const rates = results.map(r => r.ci.point * 100)
      const maxRate = Math.max(...rates)
      const minRate = Math.min(...rates)
      const gap = maxRate - minRate
      console.log(`\n격차: ${gap.toFixed(1)}%p`)

      const allInRange = rates.every(r => r >= 25 && r <= 40)
      const gapOk = gap <= 15
      console.log(`판정: ${allInRange ? 'PASS (전 프리셋 25~40%)' : 'FAIL (범위 이탈 존재)'} / 격차 ${gapOk ? 'PASS' : 'FAIL'}`)

      // 층별 분포
      console.log('\n| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |')
      console.log('|--------|----------|----------|----------|----------|--------|')
      for (const r of results) {
        const cols = [1, 2, 3, 4].map(f =>
          ((r.deathByFloor[f] ?? 0)).toString().padStart(4) +
          '(' + ((r.deathByFloor[f] ?? 0) / r.total * 100).toFixed(1) + '%)'
        )
        console.log(`| ${r.label.padEnd(6)} | ${cols.join(' | ')} | ${r.cleared} |`)
      }

      // 2. 들불 vs 옹기가마
      console.log('\n[2] 들불 vs 옹기가마 선택률 (발동/판)\n')
      console.log('| 프리셋 | 들불(wildfire) | 옹기가마(yonggigama) | 들불:옹기가마 비율 |')
      console.log('|--------|---------------|----------------------|-------------------|')
      for (const r of results) {
        const wf = (r.wildfireCount / r.total).toFixed(3)
        const yg = (r.yonggigamaCount / r.total).toFixed(3)
        const total12 = r.wildfireCount + r.yonggigamaCount
        const ratio = total12 > 0
          ? `${((r.wildfireCount / total12) * 100).toFixed(1)}% : ${((r.yonggigamaCount / total12) * 100).toFixed(1)}%`
          : 'N/A'
        console.log(`| ${r.label.padEnd(6)} | ${wf.padStart(13)} | ${yg.padStart(20)} | ${ratio} |`)
      }

      // 3. 연환 발생률
      console.log('\n[3] 오행연환 발생률 (출정당, 목표: 10% 내외)\n')
      console.log('| 프리셋 | 연환 총 발생 | 출정당 발생률 | 판정 |')
      console.log('|--------|-------------|--------------|------|')
      for (const r of results) {
        const rate = (r.yeonhwanCount / r.total * 100).toFixed(2)
        const numRate = r.yeonhwanCount / r.total * 100
        const judge = numRate >= 5 && numRate <= 20 ? 'OK(5~20%)' : numRate < 5 ? '낮음' : '높음'
        console.log(`| ${r.label.padEnd(6)} | ${r.yeonhwanCount.toString().padStart(11)} | ${rate.padStart(12)}% | ${judge} |`)
      }

      // 4. 모으기 장수 분포
      console.log('\n[4] 모으기 장수 분포 (발동/판)\n')
      console.log('| 프리셋 | 2장 | 3장 | 4장 | 5장 | 합계/판 |')
      console.log('|--------|-----|-----|-----|-----|---------|')
      for (const r of results) {
        const g2 = (r.gatherDist['gather2'] / r.total).toFixed(2)
        const g3 = (r.gatherDist['gather3'] / r.total).toFixed(2)
        const g4 = (r.gatherDist['gather4'] / r.total).toFixed(2)
        const g5 = (r.gatherDist['gather5'] / r.total).toFixed(2)
        const totalG =
          (r.gatherDist['gather2'] + r.gatherDist['gather3'] +
           r.gatherDist['gather4'] + r.gatherDist['gather5']) / r.total
        console.log(`| ${r.label.padEnd(6)} | ${g2} | ${g3} | ${g4} | ${g5} | ${totalG.toFixed(2)} |`)
      }
      console.log('\n  * gather2~5 미지원 시 모두 0 표시 (트레잇 키 미등록)')

      // 모으기 장수 분포 보조: 전체 트레잇 카운트도 출력 (키 확인용)
      console.log('\n  전체 트레잇 키 (목화 기준):')
      const refTraits = results[0]?.traitCounts ?? {}
      for (const [k, v] of Object.entries(refTraits).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
        console.log(`    ${k}: ${(v / RUNS).toFixed(3)}/판`)
      }

      // R3 추가: 상관(sanggwan) 발동률 + 기여도 / sikshin 발동률
      console.log('\n[R3-A] 상관(sanggwan) 발동률 + 기여도 (목화 기준)\n')
      {
        const mokHwaResult = results.find(r => r.label === '목화')
        if (mokHwaResult) {
          // passive_sanggwan 또는 sanggwan 키 탐색
          const sanggwanKey = Object.keys(mokHwaResult.traitCounts).find(k =>
            k.toLowerCase().includes('sanggwan'),
          )
          const sanggwanTotal = sanggwanKey ? mokHwaResult.traitCounts[sanggwanKey] : 0
          const sanggwanPerRun = sanggwanTotal / RUNS
          console.log(`상관 트레잇 키: ${sanggwanKey ?? '(미발견 — 미장착 시뮬)'}`)
          console.log(`상관 발동 총계: ${sanggwanTotal}회 / ${RUNS}판`)
          console.log(`상관 발동 평균: ${sanggwanPerRun.toFixed(3)}회/판`)
          // 기여도 추정: sanggwan 발동 시 damage×0.3 추가 — 발동률로 간접 표현
          const approxContribPct = (sanggwanPerRun * 0.3 / (1 + sanggwanPerRun * 0.3) * 100).toFixed(1)
          console.log(`상관 기여도 추정 (발동시 +30%): ~${approxContribPct}% (출정 전체 대비)`)
        }
      }

      console.log('\n[R3-B] sikshin 발동률 (전 프리셋) — T11 미결 종결\n')
      console.log('| 프리셋 | sikshin 키 | 발동 총계 | 평균/판 | 판정 |')
      console.log('|--------|-----------|----------|---------|------|')
      for (const r of results) {
        const sikshinKey = Object.keys(r.traitCounts).find(k =>
          k.toLowerCase().includes('sikshin'),
        )
        const sikshinTotal = sikshinKey ? r.traitCounts[sikshinKey] : 0
        const sikshinPerRun = sikshinTotal / r.total
        const judge = sikshinTotal === 0 ? '미발동(가호 미장착)' : sikshinPerRun > 0 ? '발동확인' : '0'
        console.log(
          `| ${r.label.padEnd(6)} | ${(sikshinKey ?? 'N/A').padEnd(9)} | ` +
          `${sikshinTotal.toString().padStart(8)} | ${sikshinPerRun.toFixed(3).padStart(7)} | ${judge} |`,
        )
      }
      console.log('\n  * sikshin 발동 0 = 본시뮬 enableFloorReward:true이나 activePassiveIds 미지정')
      console.log('    → AB 시뮬(가호 장착) 기준 sikshin 발동 확인 필요')

      // AB 시뮬에서 sikshin 발동 추적 (abResults에 traitCounts 없음 — 별도 AB sikshin 루프)
      console.log('\n[R3-C] AB 시뮬 가호 장착 시 sikshin 발동 (목화 기준 100판 표본)\n')
      {
        const preset = PRESETS[0] // 목화
        const yongsin = getFavorableElement(preset.ilgan)
        const selectedTalismans = selectTalismanBySaju(preset.dist)
        const SAMPLE = 100
        let sikshinFired = 0
        let sanggwanFired = 0
        for (let i = 0; i < SAMPLE; i++) {
          const seed = i * 12345 + 7777
          const r = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement: yongsin,
            enableFloorReward: false,
            activePassiveIds: selectedTalismans,
          })
          if (r.traitCounts) {
            for (const [k, c] of Object.entries(r.traitCounts)) {
              if (k.toLowerCase().includes('sikshin')) sikshinFired += c
              if (k.toLowerCase().includes('sanggwan')) sanggwanFired += c
            }
          }
        }
        console.log(`목화 + 가호(${selectedTalismans.join('+')}) 장착 표본 ${SAMPLE}판:`)
        console.log(`  sikshin 발동: ${sikshinFired}회 (평균 ${(sikshinFired / SAMPLE).toFixed(2)}/판)`)
        console.log(`  sanggwan 발동: ${sanggwanFired}회 (평균 ${(sanggwanFired / SAMPLE).toFixed(2)}/판)`)
        if (sikshinFired === 0) {
          console.log('  → sikshin: 가호 선택 목록에 없거나 엔진 미등록 — 죽은 가호 확인 필요')
        } else {
          console.log('  → sikshin: 활성 가호 정상 발동')
        }
      }

      // 5. 가호 유무 대조
      console.log('\n[5] 가호 유무 대조 1000판 (v1 교량)\n')
      console.log('| 프리셋 | 선택 가호 | A(미장착) 클리어율 | B(장착) 클리어율 | 차이 |')
      console.log('|--------|-----------|-------------------|-----------------|------|')
      for (const r of abResults) {
        const rateA = (r.clearA / r.totalAb * 100).toFixed(1)
        const rateB = (r.clearB / r.totalAb * 100).toFixed(1)
        const diff = (r.clearB - r.clearA) / r.totalAb * 100
        const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%p'
        console.log(
          `| ${r.label.padEnd(6)} | ${r.talismans.join('+')} | ` +
          `${rateA.padStart(17)}% | ${rateB.padStart(15)}% | ${diffStr} |`
        )
      }

      // 최종 판정 요약
      console.log('\n' + '='.repeat(60))
      console.log('최종 판정 요약')
      console.log('='.repeat(60))
      for (const r of results) {
        const rate = r.ci.point * 100
        const ok = rate >= 25 && rate <= 40
        console.log(`${r.label}: ${rate.toFixed(1)}% — ${ok ? 'PASS' : 'FAIL (범위 이탈)'}`)
      }
      console.log(`격차: ${gap.toFixed(1)}%p — ${gapOk ? 'PASS' : 'FAIL (15%p 초과)'}`)
      const finalPass = allInRange && gapOk
      console.log(`\n최종: ${finalPass ? 'PASS' : 'FAIL'}`)
      console.log('='.repeat(60) + '\n')

      // 단순 검증: 판 수 일치
      for (const r of results) expect(r.total).toBe(RUNS)
      for (const r of abResults) expect(r.totalAb).toBe(AB_RUNS)
    },
  )
})
