/**
 * T13-R2 재시뮬 — 엔진 확장 4종 + 3000판 × 3 프리셋
 *
 * 이든 지시 (2026-07-13):
 *  1. 연환 발생률 추적 → /tmp/tbb_combo_trigger_rate_t13.jsonl
 *  2. 모으기 장수 분포 수집 → /tmp/tbb_collection_dist_t13.jsonl
 *  3. 들불 vs 옹기가마 선택률 (수치화) → /tmp/tbb_card_selection_rate_t13.jsonl
 *  4. 가호 기여도 프리셋별 분해 → /tmp/tbb_blessing_contrib_t13.jsonl
 *
 * 원인 진단:
 *  가설 A = 상관 가호 쏠림 (가호 기여도 분해로 판정)
 *  가설 B = 들불 과성능 (선택률+딜 기여로 판정)
 *
 * 실행: npm test -- src/test/t13ResimR2.test.ts
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import type { Element } from '../types/game'
import { simulateFullCapRun, selectTalismanBySaju } from '../engine/fullCapBot'
import { getFavorableElement } from '../engine/manseryeok'

// ─── Wilson 95% CI ─────────────────────────────────────────────────────────
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

// ─── JSONL 쓰기 유틸 ──────────────────────────────────────────────────────
function writeJsonl(path: string, lines: object[]): void {
  const content = lines.map(l => JSON.stringify(l)).join('\n') + '\n'
  fs.writeFileSync(path, content, 'utf-8')
}

// ─── 프리셋 3종 정의 ───────────────────────────────────────────────────────
const PRESETS = [
  {
    key: 'mokHwa',
    label: '목화',
    preset: 1,
    dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'mok' as Element,
  },
  {
    key: 'geumSu',
    label: '금수',
    preset: 2,
    dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    ilgan: 'geum' as Element,
  },
  {
    key: 'toDanil',
    label: '토단일',
    preset: 3,
    dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    ilgan: 'to' as Element,
  },
]

const RUNS = 3000
const LOG_PATHS = {
  comboTriggerRate: '/tmp/tbb_combo_trigger_rate_t13.jsonl',
  collectionDist: '/tmp/tbb_collection_dist_t13.jsonl',
  cardSelectionRate: '/tmp/tbb_card_selection_rate_t13.jsonl',
  blessingContrib: '/tmp/tbb_blessing_contrib_t13.jsonl',
}

// ─── 가호 기여도 추정 로직 ─────────────────────────────────────────────────
// traitCounts에서 각 가호의 발동 횟수를 확인해 기여도 추정
// 가호별 피해 기여 추정: 실제 엔진의 각 가호 효과를 기반으로 정규화
const BLESSING_DAMAGE_WEIGHT: Record<string, number> = {
  sikshin:  0.20,   // 낱장 +20%
  bigyeon:  0.05,   // 반격 감소 (직접 피해 기여 낮음)
  geoptae:  0.30,   // 첫 공격 +30%
  sanggwan: 0.50,   // 화 2장 이상 ×1.5 → 피해의 50% 기여 (강력)
  pyeonjae: 0.03,   // HP 3 회복 (피해 기여 없음, 생존 기여)
  jeongjae: 0.25,   // 연환 배율 +2 (연환 발생 시)
  pyeonin:  0.50,   // 마지막 공격 +50%
}

describe('T13-R2 재시뮬 — 엔진 확장 4종 + 3000판 × 3 프리셋', () => {
  it(
    'T13-R2: 엔진 확장 4종 추적 포함 3000판 × 3 프리셋 시뮬레이션',
    { timeout: 600000 },
    () => {
      // ─── 1. 누적 데이터 구조 ─────────────────────────────────────────────
      interface PresetAccum {
        label: string
        preset: number
        cleared: number
        total: number
        // 1-1: 연환 발생률
        yeonhwanCount: number
        // 1-2: 모으기 장수 분포 [gather2~5]
        gatherDist: Record<string, number>
        // 1-3: 카드(특성) 선택률 — wildfire(들불), yonggigama(옹기가마) + 기타
        cardSelectCounts: Record<string, number>
        totalTraitOpportunities: number
        // 1-4: 가호 기여도 — 가호별 발동 횟수 및 추정 기여
        blessingFireCounts: Record<string, number>
        totalDamageOps: number
        // 응축 선택률
        condenseCount: number
        // 전체 트레잇 카운트 (원본 보관)
        rawTraitCounts: Record<string, number>
        // 사망 층별
        deathByFloor: Record<number, number>
      }

      const accums: PresetAccum[] = PRESETS.map(p => ({
        label: p.label,
        preset: p.preset,
        cleared: 0,
        total: 0,
        yeonhwanCount: 0,
        gatherDist: { gather2: 0, gather3: 0, gather4: 0, gather5: 0 },
        cardSelectCounts: {},
        totalTraitOpportunities: 0,
        blessingFireCounts: {},
        totalDamageOps: 0,
        condenseCount: 0,
        rawTraitCounts: {},
        deathByFloor: { 1: 0, 2: 0, 3: 0, 4: 0 },
      }))

      // ─── 2. 시뮬 루프 ─────────────────────────────────────────────────────
      for (let pi = 0; pi < PRESETS.length; pi++) {
        const preset = PRESETS[pi]
        const acc = accums[pi]
        const yongsin = getFavorableElement(preset.ilgan)
        // 사주 기반 가호 장착 (T13 이든 지시 — 가호 장착 상태로 시뮬)
        const selectedTalismans = selectTalismanBySaju(preset.dist)

        for (let i = 0; i < RUNS; i++) {
          const seed = i * 12345 + 7777
          const result = simulateFullCapRun(seed, {
            elementDist: preset.dist,
            ilganElement: preset.ilgan,
            favorableElement: yongsin,
            useFixedFloorElements: false,
            enableFloorReward: true,
            activePassiveIds: selectedTalismans,
          })

          acc.total++
          if (result.victory) acc.cleared++
          else {
            const df = result.deathFloor ?? 1
            acc.deathByFloor[df] = (acc.deathByFloor[df] ?? 0) + 1
          }

          acc.condenseCount += result.condenseCount

          // 트레잇 카운트 누적
          if (result.traitCounts) {
            for (const [t, c] of Object.entries(result.traitCounts)) {
              acc.rawTraitCounts[t] = (acc.rawTraitCounts[t] ?? 0) + c
              acc.cardSelectCounts[t] = (acc.cardSelectCounts[t] ?? 0) + c
              acc.totalTraitOpportunities += c

              // 1-1: 연환 발생 카운트
              if (t === 'ohang-yeonhwan' || t === 'yeonhwan' || t === 'ohang') {
                acc.yeonhwanCount += c
              }

              // 1-2: 모으기 장수 분포
              if (t === 'gather2') acc.gatherDist['gather2'] += c
              if (t === 'gather3') acc.gatherDist['gather3'] += c
              if (t === 'gather4') acc.gatherDist['gather4'] += c
              if (t === 'gather5') acc.gatherDist['gather5'] += c

              // 1-4: 가호 기여도 추적 — 'passive_' 접두사 키로 추적
              if (t.startsWith('passive_')) {
                const blessingId = t.replace('passive_', '')
                acc.blessingFireCounts[blessingId] = (acc.blessingFireCounts[blessingId] ?? 0) + c
                acc.totalDamageOps += c
              }
            }
          }

          // 연환 발생 추가 수집: traitCounts에 없는 경우 fusionCount에서 근사
          // (ohang-yeonhwan이 없으면 0으로 처리 — 이미 위에서 확인)
        }
      }

      // ─── 3. JSONL 파일 생성 ───────────────────────────────────────────────

      // 1-1: 연환 발생률 로그
      // 비율 기준: 전체 출수 횟수(totalTraitOpportunities) 대비 연환 발생 횟수
      const comboTriggerLines: object[] = []
      for (const acc of accums) {
        const totalOps = acc.totalTraitOpportunities  // 전체 출수(트레잇 발동) 기회
        const perRun = acc.yeonhwanCount / acc.total  // 판당 연환 발생 횟수
        const rateVsOps = totalOps > 0 ? (acc.yeonhwanCount / totalOps) * 100 : 0  // 출수 대비 연환률
        comboTriggerLines.push({
          preset: acc.preset,
          label: acc.label,
          total_runs: acc.total,
          total_trait_ops: totalOps,
          yeonhwan_count: acc.yeonhwanCount,
          yeonhwan_per_run: parseFloat(perRun.toFixed(3)),
          yeonhwan_rate_vs_ops_pct: parseFloat(rateVsOps.toFixed(3)),
          judgment_per_run: perRun >= 0.5 && perRun <= 2.0 ? 'OK(0.5~2.0/판)' : perRun < 0.5 ? '낮음' : '높음',
        })
        // 1000판 기준 구간별도 기록
        for (let chunk = 0; chunk < 3; chunk++) {
          const chunkRuns = Math.min(1000, acc.total - chunk * 1000)
          if (chunkRuns <= 0) break
          const chunkYeonhwan = Math.round((acc.yeonhwanCount / acc.total) * chunkRuns)
          comboTriggerLines.push({
            preset: acc.preset,
            label: acc.label,
            chunk_index: chunk,
            chunk_runs: chunkRuns,
            estimated_yeonhwan: chunkYeonhwan,
            estimated_per_run: parseFloat((chunkYeonhwan / chunkRuns).toFixed(3)),
          })
        }
      }
      writeJsonl(LOG_PATHS.comboTriggerRate, comboTriggerLines)

      // 1-2: 모으기 장수 분포 로그
      const collectionDistLines: object[] = []
      for (const acc of accums) {
        const totalGather = acc.gatherDist['gather2'] + acc.gatherDist['gather3'] +
          acc.gatherDist['gather4'] + acc.gatherDist['gather5']
        for (const [key, count] of Object.entries(acc.gatherDist)) {
          const unitCount = parseInt(key.replace('gather', ''))
          collectionDistLines.push({
            preset: acc.preset,
            label: acc.label,
            unit_count: unitCount,
            frequency: count,
            per_run: parseFloat((count / acc.total).toFixed(4)),
            percentage_of_gather: totalGather > 0
              ? parseFloat(((count / totalGather) * 100).toFixed(2))
              : 0,
          })
        }
        // 합계 행
        collectionDistLines.push({
          preset: acc.preset,
          label: acc.label,
          unit_count: 'total',
          frequency: totalGather,
          per_run: parseFloat((totalGather / acc.total).toFixed(4)),
          percentage_of_gather: 100,
        })
      }
      writeJsonl(LOG_PATHS.collectionDist, collectionDistLines)

      // 1-3: 카드 선택률 로그 (들불/옹기가마 포함 전체 특성)
      const cardSelectionLines: object[] = []
      const MAJOR_TRAITS = [
        'wildfire',      // 들불
        'yonggigama',    // 옹기가마
        'mining',        // 광맥
        'purification',  // 샘
        'nourish',       // 숲
        'keen',          // 벼린 검
        'snipe',         // 깎은 화살
        'harvest',       // 일군 밭
        'mirror',        // 맑은 못
        'quench',        // 담금불
      ]
      for (const acc of accums) {
        const totalChoices = acc.totalTraitOpportunities
        for (const cardName of MAJOR_TRAITS) {
          const selectCount = acc.cardSelectCounts[cardName] ?? 0
          const rate = totalChoices > 0 ? (selectCount / totalChoices) * 100 : 0
          cardSelectionLines.push({
            preset: acc.preset,
            label: acc.label,
            card_name: cardName,
            select_count: selectCount,
            total_choices: totalChoices,
            rate_pct: parseFloat(rate.toFixed(3)),
            // 들불/옹기가마 상대 비율
            wildfire_vs_yonggigama: cardName === 'wildfire' || cardName === 'yonggigama'
              ? (() => {
                  const wf = acc.cardSelectCounts['wildfire'] ?? 0
                  const yg = acc.cardSelectCounts['yonggigama'] ?? 0
                  const pair = wf + yg
                  return pair > 0
                    ? `${((wf / pair) * 100).toFixed(1)}% : ${((yg / pair) * 100).toFixed(1)}%`
                    : 'N/A'
                })()
              : null,
          })
        }
        // 들불 과성능 판정: 선택률 25% 이상이면 가설 B 채택
        const wfCount = acc.cardSelectCounts['wildfire'] ?? 0
        const wfRate = totalChoices > 0 ? (wfCount / totalChoices) * 100 : 0
        cardSelectionLines.push({
          preset: acc.preset,
          label: acc.label,
          card_name: '_wildfire_hypothesis_B',
          wildfire_rate_pct: parseFloat(wfRate.toFixed(3)),
          threshold: 25.0,
          hypothesis_b_signal: wfRate >= 25 ? 'POSITIVE' : 'NEGATIVE',
        })
      }
      writeJsonl(LOG_PATHS.cardSelectionRate, cardSelectionLines)

      // 1-4: 가호 기여도 프리셋별 분해 로그
      const blessingContribLines: object[] = []
      const ALL_BLESSINGS = ['sikshin', 'bigyeon', 'geoptae', 'sanggwan', 'pyeonjae', 'jeongjae', 'pyeonin']
      for (const acc of accums) {
        const totalFires = Object.values(acc.blessingFireCounts).reduce((s, v) => s + v, 0)
        let dominantBlessing = 'none'
        let dominantPct = 0

        for (const bid of ALL_BLESSINGS) {
          const fires = acc.blessingFireCounts[bid] ?? 0
          const weight = BLESSING_DAMAGE_WEIGHT[bid] ?? 0
          const estimatedDmgContrib = fires * weight
          const contribPct = totalFires > 0
            ? parseFloat(((fires / totalFires) * 100).toFixed(2))
            : 0

          blessingContribLines.push({
            preset: acc.preset,
            label: acc.label,
            blessing_name: bid,
            fire_count: fires,
            per_run: parseFloat((fires / acc.total).toFixed(4)),
            damage_weight: weight,
            estimated_damage_contribution: parseFloat(estimatedDmgContrib.toFixed(2)),
            contribution_rate_pct: contribPct,
          })

          if (contribPct > dominantPct) {
            dominantPct = contribPct
            dominantBlessing = bid
          }
        }

        // 가설 A 판정: 특정 가호 기여도 50% 이상이면 쏠림 신호
        blessingContribLines.push({
          preset: acc.preset,
          label: acc.label,
          blessing_name: '_hypothesis_a_summary',
          dominant_blessing: dominantBlessing,
          dominant_pct: parseFloat(dominantPct.toFixed(2)),
          threshold: 50.0,
          hypothesis_a_signal: dominantPct >= 50 ? 'POSITIVE' : 'NEGATIVE',
        })
      }
      writeJsonl(LOG_PATHS.blessingContrib, blessingContribLines)

      // ─── 4. 출력: 게임 결과 요약 ────────────────────────────────────────
      console.log('\n')
      console.log('='.repeat(70))
      console.log('T13-R2 재시뮬 결과 — 3000판 × 3 프리셋 (엔진 확장 4종 포함)')
      console.log('='.repeat(70))

      console.log('\n[결과 1] 게임 클리어율 요약\n')
      console.log('| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | 판정 |')
      console.log('|--------|--------|----------|---------|---------|------|')
      for (const acc of accums) {
        const ci = wilsonCI(acc.cleared, acc.total)
        const rate = ci.point * 100
        const pass = rate >= 25 && rate <= 40 ? 'PASS' : 'FAIL'
        console.log(
          `| ${acc.label.padEnd(6)} | ${acc.cleared.toString().padStart(4)}/${acc.total} ` +
          `| ${rate.toFixed(2).padStart(7)}% ` +
          `| ${(ci.low * 100).toFixed(2).padStart(6)}% ` +
          `| ${(ci.high * 100).toFixed(2).padStart(6)}% ` +
          `| ${pass} |`
        )
      }

      console.log('\n[결과 2] 응축 선택률\n')
      console.log('| 프리셋 | 응축 선택(총) | 응축/판 | 비고 |')
      console.log('|--------|-------------|---------|------|')
      for (const acc of accums) {
        const perRun = acc.condenseCount / acc.total
        console.log(
          `| ${acc.label.padEnd(6)} | ${acc.condenseCount.toString().padStart(11)} ` +
          `| ${perRun.toFixed(3).padStart(7)} ` +
          `| 응축(옹기가마) 선택 횟수 |`
        )
      }

      console.log('\n[추적 1-1] 오행연환 발생률\n')
      console.log('| 프리셋 | 연환 총수 | 연환/판 | 출수대비률% | 판정(연환/판) |')
      console.log('|--------|---------|---------|-----------|------------|')
      for (const acc of accums) {
        const perRun = acc.yeonhwanCount / acc.total
        const rateVsOps = acc.totalTraitOpportunities > 0
          ? (acc.yeonhwanCount / acc.totalTraitOpportunities) * 100
          : 0
        const judge = perRun >= 0.5 && perRun <= 2.0 ? 'OK(0.5~2/판)' : perRun < 0.5 ? '낮음' : '높음'
        console.log(
          `| ${acc.label.padEnd(6)} | ${acc.yeonhwanCount.toString().padStart(7)} ` +
          `| ${perRun.toFixed(3).padStart(7)} ` +
          `| ${rateVsOps.toFixed(2).padStart(9)}% ` +
          `| ${judge} |`
        )
      }

      console.log('\n[추적 1-2] 모으기 장수 분포 (발동/판)\n')
      console.log('| 프리셋 | 2장/판 | 3장/판 | 4장/판 | 5장/판 | 합계/판 |')
      console.log('|--------|--------|--------|--------|--------|---------|')
      for (const acc of accums) {
        const g2 = (acc.gatherDist['gather2'] / acc.total).toFixed(3)
        const g3 = (acc.gatherDist['gather3'] / acc.total).toFixed(3)
        const g4 = (acc.gatherDist['gather4'] / acc.total).toFixed(3)
        const g5 = (acc.gatherDist['gather5'] / acc.total).toFixed(3)
        const total = (acc.gatherDist['gather2'] + acc.gatherDist['gather3'] +
          acc.gatherDist['gather4'] + acc.gatherDist['gather5']) / acc.total
        console.log(
          `| ${acc.label.padEnd(6)} | ${g2} | ${g3} | ${g4} | ${g5} | ${total.toFixed(3)} |`
        )
      }
      console.log('\n  * gather2~5 값이 0이면 엔진이 모으기 유형을 traitCounts에 미등록된 것')
      console.log('  * 이 경우 원시 트레잇 키 목록에서 gather 관련 키를 확인할 것')

      console.log('\n  [보조] 목화 프리셋 전체 트레잇 키 목록:')
      const refAcc = accums[0]
      const sortedTraits = Object.entries(refAcc.rawTraitCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
      for (const [k, v] of sortedTraits) {
        console.log(`    ${k}: ${v}회 / ${(v / refAcc.total).toFixed(3)}판`)
      }

      console.log('\n[추적 1-3] 카드 선택률 — 들불 vs 옹기가마\n')
      console.log('| 프리셋 | 들불(wildfire) | 옹기가마(yonggigama) | 비율(들불:옹기가마) | 들불 가설B |')
      console.log('|--------|--------------|---------------------|-------------------|---------|')
      for (const acc of accums) {
        const total = acc.totalTraitOpportunities
        const wf = acc.cardSelectCounts['wildfire'] ?? 0
        const yg = acc.cardSelectCounts['yonggigama'] ?? 0
        const wfRate = total > 0 ? (wf / total) * 100 : 0
        const ygRate = total > 0 ? (yg / total) * 100 : 0
        const pair = wf + yg
        const ratio = pair > 0
          ? `${((wf / pair) * 100).toFixed(1)}% : ${((yg / pair) * 100).toFixed(1)}%`
          : 'N/A'
        const hypoB = wfRate >= 25 ? 'POSITIVE(>25%)' : `NEGATIVE(${wfRate.toFixed(1)}%)`
        console.log(
          `| ${acc.label.padEnd(6)} ` +
          `| ${wfRate.toFixed(2).padStart(12)}% ` +
          `| ${ygRate.toFixed(2).padStart(19)}% ` +
          `| ${ratio.padStart(19)} ` +
          `| ${hypoB} |`
        )
      }

      console.log('\n[추적 1-4] 가호 기여도 분해 (프리셋별)\n')
      for (const acc of accums) {
        console.log(`  [${acc.label}] 장착 가호 기여도:`)
        const totalFires = Object.values(acc.blessingFireCounts).reduce((s, v) => s + v, 0)
        let dominantBlessing = 'none'
        let dominantPct = 0
        for (const bid of ALL_BLESSINGS) {
          const fires = acc.blessingFireCounts[bid] ?? 0
          const contribPct = totalFires > 0 ? (fires / totalFires) * 100 : 0
          const weight = BLESSING_DAMAGE_WEIGHT[bid] ?? 0
          const estimated = fires * weight
          console.log(
            `    ${bid}: 발동 ${fires}회(${(fires / acc.total).toFixed(3)}/판) / ` +
            `기여율 ${contribPct.toFixed(1)}% / 추정 데미지 기여: ${estimated.toFixed(0)}`
          )
          if (contribPct > dominantPct) {
            dominantPct = contribPct
            dominantBlessing = bid
          }
        }
        const hypoA = dominantPct >= 50 ? 'POSITIVE(쏠림 감지)' : `NEGATIVE(${dominantPct.toFixed(1)}%)`
        console.log(`    -> 지배적 가호: ${dominantBlessing} (${dominantPct.toFixed(1)}%) — 가설A: ${hypoA}`)
      }

      // ─── 5. 원인 진단 분석 ──────────────────────────────────────────────
      console.log('\n' + '='.repeat(70))
      console.log('원인 진단 분석 — 가설 A vs B 판정')
      console.log('='.repeat(70))

      let hypothesisAPositive = 0
      let hypothesisBPositive = 0

      for (const acc of accums) {
        const totalFires = Object.values(acc.blessingFireCounts).reduce((s, v) => s + v, 0)
        let dominantPct = 0
        for (const bid of ALL_BLESSINGS) {
          const fires = acc.blessingFireCounts[bid] ?? 0
          const contribPct = totalFires > 0 ? (fires / totalFires) * 100 : 0
          if (contribPct > dominantPct) dominantPct = contribPct
        }

        const wfCount = acc.cardSelectCounts['wildfire'] ?? 0
        const wfRate = acc.totalTraitOpportunities > 0
          ? (wfCount / acc.totalTraitOpportunities) * 100
          : 0

        const aSignal = dominantPct >= 50 ? 'POSITIVE' : 'NEGATIVE'
        const bSignal = wfRate >= 25 ? 'POSITIVE' : 'NEGATIVE'

        if (aSignal === 'POSITIVE') hypothesisAPositive++
        if (bSignal === 'POSITIVE') hypothesisBPositive++

        console.log(`\n[${acc.label}]`)
        console.log(`  가설 A (상관 가호 쏠림): ${aSignal} (지배 가호 기여 ${dominantPct.toFixed(1)}% / 임계 50%)`)
        console.log(`  가설 B (들불 과성능):    ${bSignal} (들불 선택률 ${wfRate.toFixed(2)}% / 임계 25%)`)
      }

      console.log('\n' + '-'.repeat(70))
      console.log('최종 판정:')

      if (hypothesisBPositive >= 2) {
        console.log('=> 가설 B 채택 — 들불 과성능 신호 감지 (2+ 프리셋에서 들불 >25%)')
        console.log('   권고: 들불 수치 조정 또는 융합 논의 재개')
      } else if (hypothesisAPositive >= 2) {
        console.log('=> 가설 A 채택 — 상관 가호 쏠림 신호 감지 (2+ 프리셋에서 기여 >50%)')
        console.log('   권고: 가호 풀/수치 조정')
      } else if (hypothesisAPositive === 0 && hypothesisBPositive === 0) {
        console.log('=> 가설 C (기타) — A, B 모두 음성')
        console.log('   권고: 3층 HP 미세 상향 검토')
      } else {
        console.log(`=> 혼합 신호 (A: ${hypothesisAPositive}/3 프리셋 양성, B: ${hypothesisBPositive}/3 프리셋 양성)`)
        console.log('   추가 데이터 수집 필요')
      }

      // ─── 6. JSONL 파일 행수 확인 ─────────────────────────────────────────
      console.log('\n' + '='.repeat(70))
      console.log('로그 파일 생성 확인')
      console.log('='.repeat(70))
      for (const [key, path] of Object.entries(LOG_PATHS)) {
        try {
          const content = fs.readFileSync(path, 'utf-8')
          const lines = content.trim().split('\n').filter(l => l.length > 0)
          console.log(`  ${key}: ${path}`)
          console.log(`    -> ${lines.length}행`)
        } catch (e) {
          console.log(`  ${key}: ${path} — 오류: ${e}`)
        }
      }

      console.log('\n' + '='.repeat(70))
      console.log('T13-R2 재시뮬 완료')
      console.log('='.repeat(70) + '\n')

      // ─── 검증 ────────────────────────────────────────────────────────────
      for (const acc of accums) {
        expect(acc.total).toBe(RUNS)
      }

      // 로그 파일 4종 생성 확인
      for (const path of Object.values(LOG_PATHS)) {
        expect(fs.existsSync(path)).toBe(true)
        const content = fs.readFileSync(path, 'utf-8')
        const lines = content.trim().split('\n').filter(l => l.length > 0)
        expect(lines.length).toBeGreaterThan(0)
      }
    },
  )
})
