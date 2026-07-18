/**
 * 배치2 §6 파일럿 시뮬 — 왕·여왕 20장 덱 측정 (2026-07-18 이든 지시)
 *
 * 목적: 왕1+여왕1 포함 20장 덱에서 5원소 재료 밀도 하강 폭 측정
 * 스펙 정본: paljapae/docs/SPEC_deck_batch2.md §6
 *
 * 측정 4종:
 *   ① 기본 연환 성립률 (현행 A벌 대비 하강 폭 — 50% 미달 시 플래그)
 *   ② 5장 대융합 발동률 변화 (A벌 현행 81.0% 대비)
 *   ③ 클리어율 (게이트 25~40% + 격차 ≤15%p)
 *   ④ 왕 승격 / 여왕 증폭 발동 분포 (회/판 ± σ)
 *
 * 시드: i×12345+7777
 * 덱: 왕1(주오행, value=12, yang, type=commander) +
 *     여왕1(부오행, value=12, yin, type=commander) + 평민18장
 * 커밋 금지 — 측정 전용 파일. 프로덕션 코드 불변.
 *
 * 왕·여왕 효과 (정본 §2):
 *   왕(양의 인장): 포함된 융합의 비율 판정 한 계단 승격
 *   여왕(음의 인장): 포함된 융합의 효과량 ×1.5
 *   오행 판정: 왕·여왕은 해당 오행 카드로 취급
 *
 * 왕족 발동 분포 측정:
 *   judgeCombo mock 내부 전역 카운터 사용.
 *   단, fullCapBot은 봇 스코어링 시에도 judgeCombo를 호출함 →
 *   카운터는 "왕족 포함 조합이 judgeCombo에 입력된 횟수"로 정의
 *   (봇 스코어링 + 실제 플레이 합산).
 *   이는 봇이 왕족 효과를 얼마나 많이 평가했는지 보여주는 지표.
 *   실제 플레이 기반 정확한 측정은 현 구조상 추가 엔진 수정 없이 불가.
 *   → 판당 발동 횟수는 "봇 평가 포함 전체" 기준으로 보고.
 *
 * 비교 대조: 왕족 없음(현행 A벌) vs 왕족 20장덱 수치 병기
 * 결과: workspace root ZERA_PALJAJEON_BATCH2_PILOT_RESULT_20260718.md
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element, Card } from '../types/game'

// ─── 왕족 발동 전역 카운터 ──────────────────────────────────────────────────
const G = { king: 0, queen: 0 }
function resetG() { G.king = 0; G.queen = 0 }

// ─── 왕족 카드 생성 ──────────────────────────────────────────────────────────
type RoyalRole = 'king' | 'queen'
function makeRoyalCard(role: RoyalRole, element: Element, id: string): Card {
  return {
    id,
    element,
    polarity: role === 'king' ? 'yang' : 'yin',
    value: 12,
    type: 'commander',
    rarity: 'rare',
    name: role === 'king' ? `왕(${element})` : `여왕(${element})`,
  }
}

// ─── balance mock — v4 룰셋 + A벌 + V4 HP ──────────────────────────────────
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const V4_HP = actual['V4_FLOOR_HP_TABLE'] as Record<number, number>
  const origConfigs = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>
  const v4Configs = origConfigs.map(cfg => ({
    ...cfg,
    enemyHp: V4_HP[cfg.floor] ?? cfg.enemyHp,
  }))
  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    FLOOR_CONFIGS: v4Configs,
    V4_RATIO_CORRECTION: { peak: 1.0, step1: 0.70, step2: 0.45 },
  }
})

// ─── deckGenerator mock — 왕1+여왕1 삽입 ─────────────────────────────────────
vi.mock('../engine/deckGenerator', async () => {
  const actual = await vi.importActual('../engine/deckGenerator') as Record<string, unknown>
  const origGen = actual['generateSajuDeck'] as (d: Record<Element, number>, s: number) => Card[]
  return {
    ...actual,
    generateSajuDeck: (dist: Record<Element, number>, seed: number): Card[] => {
      const base = origGen(dist, seed)
      const kingEl: Element = (globalThis as any).__b2King ?? 'mok'
      const queenEl: Element = (globalThis as any).__b2Queen ?? 'hwa'
      const runId: string = (globalThis as any).__b2RunId ?? '0'

      // 최솟값 평민 2장 제거 → 왕족 2장 삽입 (20장 유지)
      const sorted = [...base].sort((a, b) => a.value - b.value)
      const rm = new Set([sorted[0].id, sorted[1].id])
      const pruned = base.filter(c => !rm.has(c.id))
      return [
        ...pruned,
        makeRoyalCard('king', kingEl, `k-${runId}`),
        makeRoyalCard('queen', queenEl, `q-${runId}`),
      ]
    },
  }
})

// ─── judgeCombo mock — 왕 승격 + 여왕 증폭 (봇 미러링 포함) ─────────────────
// judgeCombo는 봇 스코어링에도 호출되므로 카운터는 전체(봇+플레이) 기준
vi.mock('../engine/pokerHandJudge', async () => {
  const actual = await vi.importActual('../engine/pokerHandJudge') as Record<string, unknown>
  const orig = actual['judgeCombo'] as (
    cards: Card[], rm?: Record<string, number>
  ) => { type: string; baseScore: number; multiplier: number; totalScore: number; finishingElement: Element; description: string; name: string; isRatioPeak?: boolean }

  const AT = { peak: 1.0, step1: 0.70, step2: 0.45 }
  const TM: Record<number, number> = { 2: 1.5, 3: 3.0, 4: 4.0, 5: 5.5 }

  return {
    ...actual,
    judgeCombo: (cards: Card[], rm?: Record<string, number>) => {
      const r = orig(cards, rm)
      const isFusion = r.type === 'fusion-birth' || r.type === 'fusion-hone'
      if (!isFusion) return r

      const hasKing = cards.some(c => c.type === 'commander' && c.polarity === 'yang')
      const hasQueen = cards.some(c => c.type === 'commander' && c.polarity === 'yin')
      if (!hasKing && !hasQueen) return r

      let { multiplier, totalScore, isRatioPeak } = r

      // 왕 승격: 비율 판정 한 계단 승격
      if (hasKing) {
        G.king++
        if (isRatioPeak === false) {
          const tierMult = TM[cards.length] ?? 1.0
          if (tierMult > 0) {
            const corr = multiplier / tierMult
            let upgraded: number
            if (Math.abs(corr - AT.step2) < 0.06) {
              upgraded = AT.step1  // step2 → step1
            } else if (Math.abs(corr - AT.step1) < 0.06) {
              upgraded = AT.peak  // step1 → peak
              isRatioPeak = true
            } else {
              upgraded = corr
            }
            multiplier = Math.round(tierMult * upgraded * 100) / 100
            totalScore = Math.round(r.baseScore * multiplier)
          }
        }
      }

      // 여왕 증폭: ×1.5
      if (hasQueen) {
        G.queen++
        totalScore = Math.round(totalScore * 1.5)
      }

      return { ...r, multiplier, totalScore, isRatioPeak }
    },
  }
})

// ─── 임포트 ──────────────────────────────────────────────────────────────────
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { FLOOR_CONFIGS, V4_FLOOR_HP_TABLE } = await import('../engine/balance')

// ─── 프리셋 ──────────────────────────────────────────────────────────────────
const PRESETS = [
  { key: 'mokHwa',  label: '목화',  dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'mok' as Element, kingEl: 'mok' as Element, queenEl: 'hwa' as Element },
  { key: 'geumSu',  label: '금수',  dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>, ilgan: 'geum' as Element, kingEl: 'geum' as Element, queenEl: 'su' as Element },
  { key: 'toDanil', label: '토단일', dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'to' as Element, kingEl: 'to' as Element, queenEl: 'to' as Element },
]

const RUNS = 1000
const GATE_MIN = 25
const GATE_MAX = 40
const GATE_SPREAD = 15

// 현행 A벌 기준선 (왕족 없음, ZERA_PALJAJEON_V4_SCARCITY_VAR_A_RESULT 기준)
// v4ScarcityVarA.test.ts 실측: 목화 / 금수 / 토단일 / 5장융합률
const BASELINE = {
  clearRates: { mokHwa: 34.9, geumSu: 34.7, toDanil: 37.9 },
  spread: 3.0,
  fusion5Rate: 81.0,
  yeonhwanRate65: 65.0,
}

describe('배치2 §6 파일럿 시뮬 — 왕1+여왕1 20장덱 측정 (2026-07-18)', () => {
  it(
    '왕족 20장덱 1000판 × 3프리셋 — 측정 4종 + 왕족 없음 대조',
    { timeout: 900000 },
    () => {
      const hp = V4_FLOOR_HP_TABLE as Record<number, number>
      const fc = FLOOR_CONFIGS as Array<{ floor: number; enemyHp: number }>
      console.log('\n배치2 §6 파일럿 시뮬 — 왕1+여왕1 20장덱 측정')
      console.log(`V4_HP: 1층=${hp[1]} / 2층=${hp[2]} / 3층=${hp[3]} / 4층=${hp[4]}`)
      console.log(`FLOOR_CONFIGS HP: ${fc.map(c => `${c.floor}층=${c.enemyHp}`).join(' / ')}`)
      console.log('A벌 (step1=0.70 / step2=0.45)')

      // 전체 집계
      let totStep0 = 0, totStep1 = 0, totStep2 = 0
      let tot2Exempt = 0, tot5Card = 0, totYeonhwan = 0
      let totAttacks = 0
      let totKing = 0, totQueen = 0

      const presResults: Array<{
        label: string; victories: number; clearRate: number; gatePass: boolean
        kingTotal: number; queenTotal: number
        kingMean: number; queenMean: number
        kingStd: number; queenStd: number
      }> = []

      for (const p of PRESETS) {
        ;(globalThis as any).__b2King = p.kingEl
        ;(globalThis as any).__b2Queen = p.queenEl
        resetG()

        const fav = getFavorableElement(p.ilgan)
        const tals = selectTalismanBySaju(p.dist)
        let wins = 0
        const kArr: number[] = [], qArr: number[] = []

        for (let i = 0; i < RUNS; i++) {
          ;(globalThis as any).__b2RunId = `${p.key}-${i}`
          const bk = G.king, bq = G.queen

          const res = simulateFullCapRun(i * 12345 + 7777, {
            elementDist: p.dist, ilganElement: p.ilgan,
            favorableElement: fav, enableFloorReward: true,
            enableEffectMode: true, activePassiveIds: tals,
          })

          kArr.push(G.king - bk); qArr.push(G.queen - bq)
          if (res.victory) wins++

          const tc = res.traitCounts ?? {}
          totStep0 += tc['v4_fusion_step0'] ?? 0
          totStep1 += tc['v4_fusion_step1'] ?? 0
          totStep2 += tc['v4_fusion_step2'] ?? 0
          tot2Exempt += tc['v4_fusion_2card_exempt'] ?? 0
          tot5Card += tc['v4_fusion_5card'] ?? 0
          totYeonhwan += tc['ohang-yeonhwan'] ?? 0
          for (const fs of (res.floorStats ?? []))
            totAttacks += (fs as { attackCount: number }).attackCount
        }

        const cr = (wins / RUNS) * 100
        const gp = cr >= GATE_MIN && cr <= GATE_MAX
        const kTot = G.king, qTot = G.queen
        totKing += kTot; totQueen += qTot

        const km = kTot / RUNS, qm = qTot / RUNS
        const kstd = Math.sqrt(kArr.reduce((s, v) => s + (v - km) ** 2, 0) / RUNS)
        const qstd = Math.sqrt(qArr.reduce((s, v) => s + (v - qm) ** 2, 0) / RUNS)

        presResults.push({ label: p.label, victories: wins, clearRate: cr, gatePass: gp, kingTotal: kTot, queenTotal: qTot, kingMean: km, queenMean: qm, kingStd: kstd, queenStd: qstd })
        console.log(`[${p.label}] 클리어율: ${cr.toFixed(1)}% (${wins}/${RUNS}) 게이트${gp ? 'PASS' : 'FAIL'} | 왕${km.toFixed(1)}/판(σ=${kstd.toFixed(1)}) 여왕${qm.toFixed(1)}/판(σ=${qstd.toFixed(1)})`)
      }

      const allPass = presResults.every(r => r.gatePass)
      const maxCr = Math.max(...presResults.map(r => r.clearRate))
      const minCr = Math.min(...presResults.map(r => r.clearRate))
      const spread = maxCr - minCr
      const spreadPass = spread <= GATE_SPREAD

      const totalRuns = RUNS * PRESETS.length
      const totN3 = totStep0 + totStep1 + totStep2
      const totFusionIncl = totN3 + tot2Exempt
      const f5rate = totFusionIncl > 0 ? (tot5Card / totFusionIncl) * 100 : 0
      const f5delta = f5rate - BASELINE.fusion5Rate

      const yRate = totAttacks > 0 ? (totYeonhwan / totAttacks) * 100 : 0
      const yDelta = yRate - BASELINE.yeonhwanRate65
      const yFlag = yRate < 50

      console.log('\n═══ ① 클리어율 게이트 ═══════════════════════════')
      console.log('프리셋\t왕족덱\t게이트\t기준선\t대비')
      presResults.forEach((r, idx) => {
        const presetKey = PRESETS[idx]?.key as keyof typeof BASELINE.clearRates | undefined
        const base = presetKey ? BASELINE.clearRates[presetKey] : undefined
        const d = typeof base === 'number' ? (r.clearRate - base).toFixed(1) : '-'
        console.log(`${r.label}\t${r.clearRate.toFixed(1)}%\t${r.gatePass ? 'PASS' : 'FAIL'}\t${base ?? '-'}%\t${typeof base === 'number' ? (parseFloat(d) >= 0 ? '+' : '') + d + '%p' : '-'}`)
      })
      console.log(`격차: ${spread.toFixed(1)}%p — ${spreadPass ? 'PASS' : 'FAIL'}`)
      console.log(`클리어율 게이트: ${allPass && spreadPass ? 'PASS' : 'FAIL'}`)

      console.log('\n═══ ② 5장 대융합 발동률 ═════════════════════════')
      console.log(`  기준선(왕족없음): ${BASELINE.fusion5Rate}% | 왕족덱: ${f5rate.toFixed(1)}% | 변화: ${f5delta >= 0 ? '+' : ''}${f5delta.toFixed(1)}%p`)
      console.log(`  N≥3 융합: ${totN3} | 2장면제: ${tot2Exempt} | 전체: ${totFusionIncl} | 5장: ${tot5Card}회`)

      console.log('\n═══ ③ 기본 연환 성립률 ══════════════════════════')
      console.log(`  연환: ${totYeonhwan}회 / 공격 ${totAttacks}회 = ${yRate.toFixed(2)}% (회/판: ${(totYeonhwan / totalRuns).toFixed(3)})`)
      console.log(`  이전 기준(65%) 대비: ${yDelta >= 0 ? '+' : ''}${yDelta.toFixed(2)}%p`)
      if (yFlag) {
        console.log(`  FLAG: ${yRate.toFixed(2)}% < 50% — 추가 레버 재논의 조건`)
      }

      console.log('\n═══ ④ 왕 승격 / 여왕 증폭 발동 분포 ═══════════')
      console.log(`  전체 왕승격: ${totKing}회 = ${(totKing / totalRuns).toFixed(3)}/판`)
      console.log(`  전체 여왕증폭: ${totQueen}회 = ${(totQueen / totalRuns).toFixed(3)}/판`)
      console.log('  프리셋\t왕/판(σ)\t여왕/판(σ)')
      for (const r of presResults) {
        console.log(`  ${r.label}\t${r.kingMean.toFixed(3)} (σ=${r.kingStd.toFixed(3)})\t${r.queenMean.toFixed(3)} (σ=${r.queenStd.toFixed(3)})`)
      }

      console.log('\n═══ 정점/비정점 분포 ════════════════════════════')
      console.log(`  총공격: ${totAttacks} | N≥3 융합: ${totN3}`)
      if (totN3 > 0) {
        console.log(`    step0 정점: ${totStep0} (${((totStep0 / totN3) * 100).toFixed(1)}%)`)
        console.log(`    step1: ${totStep1} (${((totStep1 / totN3) * 100).toFixed(1)}%)`)
        console.log(`    step2: ${totStep2} (${((totStep2 / totN3) * 100).toFixed(1)}%)`)
      }

      console.log('\n═══ 게이트 판정 ══════════════════════════════════')
      console.log(`  클리어율: ${allPass && spreadPass ? 'PASS' : 'FAIL'}`)
      console.log(`  연환 50% 미달: ${yFlag ? 'FLAG' : 'PASS'}`)
      console.log(`  왕족 발동: ${totKing > 0 || totQueen > 0 ? 'PASS' : 'WARN'}`)

      // ─── 결과 저장 ────────────────────────────────────────────────────────
      const output = {
        report: '배치2 §6 파일럿 시뮬 — 왕1+여왕1 20장덱 측정',
        date: '2026-07-18',
        config: {
          runs: RUNS,
          ratioCorrectionTable: { peak: 1.0, step1: 0.70, step2: 0.45 },
          deckComposition: '왕1(주오행 value=12 yang commander) + 여왕1(부오행 value=12 yin commander) + 평민18장',
          note: '왕족 카드는 시작덱 미포함(정본 §2) 조건 측정용으로 인위 삽입. 실제 배치2에서는 런 중 획득.',
        },
        measurement1_yeonhwan: {
          totalYeonhwan: totYeonhwan,
          totalAttacks: totAttacks,
          rateVsAttacks: parseFloat(yRate.toFixed(2)),
          yeonhwanPerRun: parseFloat((totYeonhwan / totalRuns).toFixed(3)),
          attacksPerRun: parseFloat((totAttacks / totalRuns).toFixed(2)),
          prevBaseline65: BASELINE.yeonhwanRate65,
          delta: parseFloat(yDelta.toFixed(2)),
          flag50pct: yFlag,
          gate: yFlag ? 'FLAG: 50% 미달 — 추가 레버 재논의' : 'PASS',
        },
        measurement2_fusion5: {
          total5Card: tot5Card,
          totalFusion: totFusionIncl,
          totalN3: totN3,
          fusion5Rate: parseFloat(f5rate.toFixed(1)),
          baselineNoRoyal: BASELINE.fusion5Rate,
          delta: parseFloat(f5delta.toFixed(1)),
          direction: f5delta < -0.5 ? '하강(왕족 덱 밀도 압박 확인)' : f5delta > 0.5 ? '상승' : '유지(변화 미미)',
        },
        measurement3_clearRate: {
          gate: `${GATE_MIN}~${GATE_MAX}% + 격차≤${GATE_SPREAD}%p`,
          presets: presResults.map((r, idx) => {
            const presetKey = PRESETS[idx]?.key as keyof typeof BASELINE.clearRates | undefined
            const base = presetKey ? BASELINE.clearRates[presetKey] : undefined
            return {
              label: r.label,
              clearRate: parseFloat(r.clearRate.toFixed(1)),
              victories: r.victories,
              gatePass: r.gatePass,
              baselineNoRoyal: base ?? null,
              delta: typeof base === 'number' ? parseFloat((r.clearRate - base).toFixed(1)) : null,
            }
          }),
          spread: parseFloat(spread.toFixed(1)),
          spreadPass,
          allPresetPass: allPass,
          gate: allPass && spreadPass ? 'PASS' : 'FAIL',
          note: allPass ? '' : `클리어율 ${maxCr.toFixed(1)}% — 왕족 value=12가 덱 딜 상승 유발. 상한 초과 예상 결과.`,
        },
        measurement4_royalDistribution: {
          note: '카운터는 봇 스코어링(후보 조합 평가) 포함 전체 기준. 실제 플레이만 측정 불가(엔진 수정 없이).',
          totalRuns: totalRuns,
          totalKingPromote: totKing,
          totalQueenAmplify: totQueen,
          kingPerRunAll: parseFloat((totKing / totalRuns).toFixed(3)),
          queenPerRunAll: parseFloat((totQueen / totalRuns).toFixed(3)),
          presets: presResults.map(r => ({
            label: r.label,
            kingTotal: r.kingTotal,
            queenTotal: r.queenTotal,
            kingPerRun: parseFloat(r.kingMean.toFixed(3)),
            queenPerRun: parseFloat(r.queenMean.toFixed(3)),
            kingStdDev: parseFloat(r.kingStd.toFixed(3)),
            queenStdDev: parseFloat(r.queenStd.toFixed(3)),
          })),
        },
        distribution: {
          totalAttacks: totAttacks,
          totalFusionAll: totFusionIncl,
          exempt2Card: tot2Exempt,
          n3plus: totN3,
          step0Peak: totStep0,
          step1: totStep1,
          step2: totStep2,
          step0Pct: totN3 > 0 ? parseFloat(((totStep0 / totN3) * 100).toFixed(1)) : 0,
          step1Pct: totN3 > 0 ? parseFloat(((totStep1 / totN3) * 100).toFixed(1)) : 0,
          step2Pct: totN3 > 0 ? parseFloat(((totStep2 / totN3) * 100).toFixed(1)) : 0,
        },
        comparisonTable: {
          header: ['항목', '왕족없음(현행A벌)', '왕족20장덱', '변화'],
          rows: [
            ['목화 클리어율', `${BASELINE.clearRates.mokHwa}%`, `${presResults[0]?.clearRate.toFixed(1) ?? '-'}%`, presResults[0] ? `${(presResults[0].clearRate - BASELINE.clearRates.mokHwa >= 0 ? '+' : '')}${(presResults[0].clearRate - BASELINE.clearRates.mokHwa).toFixed(1)}%p` : '-'],
            ['금수 클리어율', `${BASELINE.clearRates.geumSu}%`, `${presResults[1]?.clearRate.toFixed(1) ?? '-'}%`, presResults[1] ? `${(presResults[1].clearRate - BASELINE.clearRates.geumSu >= 0 ? '+' : '')}${(presResults[1].clearRate - BASELINE.clearRates.geumSu).toFixed(1)}%p` : '-'],
            ['토단일 클리어율', `${BASELINE.clearRates.toDanil}%`, `${presResults[2]?.clearRate.toFixed(1) ?? '-'}%`, presResults[2] ? `${(presResults[2].clearRate - BASELINE.clearRates.toDanil >= 0 ? '+' : '')}${(presResults[2].clearRate - BASELINE.clearRates.toDanil).toFixed(1)}%p` : '-'],
            ['격차', `${BASELINE.spread}%p`, `${spread.toFixed(1)}%p`, `${(spread - BASELINE.spread).toFixed(1)}%p`],
            ['5장 대융합률', `${BASELINE.fusion5Rate}%`, `${f5rate.toFixed(1)}%`, `${f5delta >= 0 ? '+' : ''}${f5delta.toFixed(1)}%p`],
            ['연환 성립률(공격대비)', `${BASELINE.yeonhwanRate65}%(이든지시기준)`, `${yRate.toFixed(2)}%`, `${yDelta >= 0 ? '+' : ''}${yDelta.toFixed(2)}%p`],
          ],
        },
        gateOverall: {
          clearRateGate: allPass && spreadPass ? 'PASS' : 'FAIL',
          yeonhwanFlag: yFlag ? 'FLAG' : 'PASS',
          royalActivated: totKing > 0 || totQueen > 0 ? 'PASS' : 'WARN',
          summary: (allPass && spreadPass && !yFlag)
            ? '전 측정 PASS'
            : `클리어율 게이트 ${allPass && spreadPass ? 'PASS' : 'FAIL'} / 연환 ${yFlag ? 'FLAG' : 'PASS'}`,
        },
      }

      writeFileSync('/tmp/batch2_royal_pilot.json', JSON.stringify(output, null, 2))
      console.log('\n결과 → /tmp/batch2_royal_pilot.json')

      expect(presResults).toHaveLength(3)
      expect(totAttacks).toBeGreaterThan(0)
      expect(spread).toBeGreaterThanOrEqual(0)
    },
  )
})
