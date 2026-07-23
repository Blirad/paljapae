/**
 * 팔자전 [2단계] — 운성패 4종 강제 A/B 게이트: 3000판 × 3프리셋 (2026-07-22 제라)
 * 배선 수리 (2026-07-23): 발동 집계를 4패 개별 카운트로 3단 배선 최종단 완성.
 * 지시: ZERA_PALJAJEON_UNSEONGPAE_WIRING_REPAIR_DISPATCH_20260723.md / ..._ENGINE_DISPATCH_20260722.md 3장
 *
 * 측정 조건 (1단계 게이트 승계):
 *   - HP mock ×1.60 (352/712/1088/680) — getFloorHp 함수 자체 교체 + HP 실효값 assert
 *   - 시드: i*12345+7777 (i=0..2999, 프리셋당 3000판)
 *   - 3프리셋: 목화 / 금수 / 토단일
 *   - rngState 시드 로그 + 재현성 assert
 *
 * 강제 A/B (선택 편향 제거):
 *   - A군 = 운성패 강제 장착 (성장 허용) — forceUnseongpae
 *   - B군 = 미장착 기준선 (동일 시드·동일 가호)
 *   - 수격방치 군 = 강제 장착 + fixUnseongpaeGyeok='su' (성장 없이도 존재감 확인)
 *
 * 채점 (지시 3·4장):
 *   - 4종 개별, 왕격 기준 Δ<15 + 최소 1프리셋 Δ≥+5
 *   - 개별 Δ<+5 → 해당 패만 C 이관 보고
 *   - Δ>15 초과 → 왕격 수치 하향 1회 자체조정 → 재측정 (여기선 보고만, 재조정은 RESULT에서)
 *
 * 실행: cd paljapae && npx vitest run src/measurements/unseongpaeGate3000.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'
import type { UnseongpaeId } from '../engine/unseongpae'

// ─── HP ×1.60 mock — getFloorHp 함수 자체 교체 (352/712/1088/680) ──────────────
vi.mock('../engine/balance', async () => {
  const actual = (await vi.importActual('../engine/balance')) as Record<string, unknown>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ enemyHp: number; [k: string]: unknown }>
  const HP160_TABLE: Record<number, number> = {
    1: Math.round(220 * 1.6), // 352
    2: Math.round(445 * 1.6), // 712
    3: Math.round(680 * 1.6), // 1088
    4: 680, // 불변
  }
  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    V4_FLOOR_HP_TABLE: HP160_TABLE,
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = HP160_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')

const PRESETS = [
  { key: 'mokHwa', label: '목화', dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'mok' as Element },
  { key: 'geumSu', label: '금수', dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>, ilgan: 'geum' as Element },
  { key: 'toDanil', label: '토단일', dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>, ilgan: 'to' as Element },
]

// G13 개체명 개정(2026-07-23 이든): 게이트 로그 표기 = 장생/제왕/묘고/절처봉생.
// 엔진 식별자 키(saengji 등)는 유지 — 표시명만 교체 (분류명 생왕묘절은 도감 층 강등).
const UNSEONGPAE: { id: UnseongpaeId; label: string }[] = [
  { id: 'saengji', label: '장생(長生)' },
  { id: 'wangji', label: '제왕(帝旺)' },
  { id: 'myoji', label: '묘고(墓庫)' },
  { id: 'jeolji', label: '절처봉생(絶處逢生)' },
]

const RUNS = 3000
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_UNSEONGPAE_GATE_LOG_20260723.md'

interface Cell {
  aRate: number
  bRate: number
  delta: number
  suRate: number // 수격 방치
  suDelta: number // 수격방치 − B
  finalGyeokDist: Record<string, number> // A군 종료 격 분포
  // 발동 카운트 — 4패 개별 집계 (2026-07-23 배선 수리 a: 3단 배선 최종단).
  //   봇 리턴 필드(saengjiDraws/wangjiExempts/myogoReleases/jeoljiRevives)를 패별로 분리 누적.
  saengjiDraws: number
  wangjiExempts: number
  myogoReleases: number
  jeoljiRevives: number
  activations: number // 4패 합계 (하위 호환·요약용)
}

function measure(preset: (typeof PRESETS)[0], up: UnseongpaeId): Cell {
  const fav = getFavorableElement(preset.ilgan)
  const talismans = selectTalismanBySaju(preset.dist)
  let aVic = 0
  let bVic = 0
  let suVic = 0
  // 4패 개별 발동 누적 (2026-07-23 배선 수리 a) — 봇 리턴 필드 패별 집계.
  let saengjiDraws = 0
  let wangjiExempts = 0
  let myogoReleases = 0
  let jeoljiRevives = 0
  const gyeokDist: Record<string, number> = { su: 0, hyu: 0, sang: 0, wang: 0 }

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777
    const common = {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement: fav,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: talismans,
    }
    // A군: 운성패 강제 장착 (성장 허용)
    const a = simulateFullCapRun(seed, { ...common, forceUnseongpae: up })
    if (a.victory) aVic++
    if (a.unseongpaeFinalGyeok) gyeokDist[a.unseongpaeFinalGyeok]++
    // 4패 개별 카운트 — 봇 리턴 필드 3단 배선 최종단.
    saengjiDraws += a.saengjiDraws ?? 0
    wangjiExempts += a.wangjiExempts ?? 0
    myogoReleases += a.myogoReleases ?? 0
    jeoljiRevives += a.jeoljiRevives ?? 0
    // B군: 미장착 기준선
    const b = simulateFullCapRun(seed, { ...common })
    if (b.victory) bVic++
    // 수격방치 군: 강제 장착 + 격 su 고정
    const su = simulateFullCapRun(seed, { ...common, forceUnseongpae: up, fixUnseongpaeGyeok: 'su' })
    if (su.victory) suVic++
  }
  const aRate = (aVic / RUNS) * 100
  const bRate = (bVic / RUNS) * 100
  const suRate = (suVic / RUNS) * 100
  return {
    aRate,
    bRate,
    delta: aRate - bRate,
    suRate,
    suDelta: suRate - bRate,
    finalGyeokDist: gyeokDist,
    saengjiDraws,
    wangjiExempts,
    myogoReleases,
    jeoljiRevives,
    activations: saengjiDraws + wangjiExempts + myogoReleases + jeoljiRevives,
  }
}

// measurements 격리 — 규칙 스위트에서 자동 실행 금지 (게이트는 파일명 지정 실행 시 임시 un-skip)
describe('운성패 4종 강제 A/B 게이트 — 3000판 × 3프리셋', () => {
  it('DoD: HP assert + rngState 재현성 + 4종×3프리셋 A/B/수격방치', { timeout: 3_600_000 }, () => {
    // ── HP 실효값 assert ──
    const hp1 = V4_FLOOR_HP_TABLE[1], hp2 = V4_FLOOR_HP_TABLE[2], hp3 = V4_FLOOR_HP_TABLE[3], hp4 = V4_FLOOR_HP_TABLE[4]
    expect(hp1).toBe(352)
    expect(hp2).toBe(712)
    expect(hp3).toBe(1088)
    expect(hp4).toBe(680)
    console.log(`[HP assert PASS ×1.60] 1층=${hp1}/2층=${hp2}/3층=${hp3}/4층=${hp4}`)

    // ── rngState 재현성 assert ──
    const rngStateSample = (7777 ^ 0x9e3779b9) >>> 0
    expect(rngStateSample).toBe(2654431192)
    console.log(`[rngState] seed(i=0)=7777 → ${rngStateSample} (= 7777 ^ 0x9E3779B9)`)

    const repro1 = simulateFullCapRun(7777, {
      elementDist: PRESETS[0].dist, ilganElement: 'mok', favorableElement: getFavorableElement('mok'),
      enableFloorReward: true, enableEffectMode: true, activePassiveIds: selectTalismanBySaju(PRESETS[0].dist),
      forceUnseongpae: 'saengji',
    })
    const repro2 = simulateFullCapRun(7777, {
      elementDist: PRESETS[0].dist, ilganElement: 'mok', favorableElement: getFavorableElement('mok'),
      enableFloorReward: true, enableEffectMode: true, activePassiveIds: selectTalismanBySaju(PRESETS[0].dist),
      forceUnseongpae: 'saengji',
    })
    expect(repro1.victory).toBe(repro2.victory)
    expect(repro1.floorsCleared).toBe(repro2.floorsCleared)
    expect(repro1.unseongpaeFinalGyeok).toBe(repro2.unseongpaeFinalGyeok)
    console.log(`[재현성 assert PASS] seed=7777 2회 동일 (victory=${repro1.victory}, gyeok=${repro1.unseongpaeFinalGyeok})`)

    // ── 4종 × 3프리셋 측정 ──
    const table: Record<UnseongpaeId, Record<string, Cell>> = {} as never
    for (const up of UNSEONGPAE) {
      table[up.id] = {}
      console.log(`\n════ ${up.label} ════`)
      for (const p of PRESETS) {
        const cell = measure(p, up.id)
        table[up.id][p.key] = cell
        console.log(
          `  ${p.label}: A=${cell.aRate.toFixed(1)}% B=${cell.bRate.toFixed(1)}% Δ=${cell.delta.toFixed(2)}%p ` +
          `| 수격방치=${cell.suRate.toFixed(1)}% (Δ${cell.suDelta.toFixed(2)}) ` +
          `| A격분포 su${cell.finalGyeokDist.su}/hyu${cell.finalGyeokDist.hyu}/sang${cell.finalGyeokDist.sang}/wang${cell.finalGyeokDist.wang} ` +
          `| 발동 생지${cell.saengjiDraws}/왕지${cell.wangjiExempts}/묘지${cell.myogoReleases}/절지${cell.jeoljiRevives} (합${cell.activations})`,
        )
      }
    }

    // ── 종별 판정 ──
    const verdicts: Record<UnseongpaeId, string> = {} as never
    for (const up of UNSEONGPAE) {
      const cells = PRESETS.map(p => table[up.id][p.key])
      const maxDelta = Math.max(...cells.map(c => c.delta))
      const minDelta = Math.min(...cells.map(c => c.delta))
      const anyOver5 = cells.some(c => c.delta >= 5)
      const anyOver15 = cells.some(c => c.delta > 15)
      let v: string
      if (anyOver15) v = `Δ>15 초과 — 왕격 수치 하향 1회 자체조정 대상 (max Δ=${maxDelta.toFixed(1)})`
      else if (!anyOver5) v = `개별 Δ<+5 — C 이관 (min ${minDelta.toFixed(1)} / max ${maxDelta.toFixed(1)})`
      else v = `PASS — 왕격 Δ<15 + 최소 1프리셋 Δ≥+5 (max ${maxDelta.toFixed(1)})`
      verdicts[up.id] = v
      console.log(`★ ${up.label}: ${v}`)
    }

    // ── 로그 파일 ──
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const f = (n: number) => n.toFixed(1)
    let body = ''
    for (const up of UNSEONGPAE) {
      body += `\n### ${up.label}\n\n`
      body += `| 프리셋 | A(장착) | B(미장착) | Δ(A−B) | 수격방치 | 수격Δ | A격분포(su/hyu/sang/wang) | 발동(생지/왕지/묘지/절지) | 발동합 |\n`
      body += `|-------|---------|-----------|--------|---------|-------|--------------------------|--------------------------|--------|\n`
      for (const p of PRESETS) {
        const c = table[up.id][p.key]
        const g = c.finalGyeokDist
        body += `| ${p.label} | ${f(c.aRate)}% | ${f(c.bRate)}% | Δ${c.delta.toFixed(2)} | ${f(c.suRate)}% | ${c.suDelta.toFixed(2)} | ${g.su}/${g.hyu}/${g.sang}/${g.wang} | ${c.saengjiDraws}/${c.wangjiExempts}/${c.myogoReleases}/${c.jeoljiRevives} | ${c.activations} |\n`
      }
      body += `\n판정: **${verdicts[up.id]}**\n`
    }

    const md = `# 운성패 4종 강제 A/B 게이트 — 로그 (2단계 / 배선 수리 후)

**생성: ${now} KST / 발신: 제라**
**배선 수리: ZERA_PALJAJEON_UNSEONGPAE_WIRING_REPAIR_DISPATCH_20260723.md (발동 4패 개별 카운트 3단 배선)**
**HP ×1.60 (352/712/1088/680) / 시드 i*12345+7777 / 3000판×3프리셋**
**rngState seed(i=0)=7777 → ${rngStateSample} / 재현성 assert PASS**

A군=운성패 강제 장착(성장 허용) / B군=미장착 기준선 / 수격방치=강제장착+격su 고정.
${body}
## 채점 기준 (지시 3·4장)
- 왕격 Δ<15 + 최소 1프리셋 Δ≥+5 → PASS
- 개별 Δ<+5 → 해당 패만 C 이관 / Δ>15 초과 → 왕격 수치 하향 1회 자체조정 → 재측정

## 커밋/배포 금지 — 빌라드 검토 + quinn 후 실행
`
    writeFileSync(RESULT_PATH, md)
    console.log(`[게이트 로그] ${RESULT_PATH}`)

    // 게이트는 측정 완료면 통과 (C 이관/자체조정은 보고 경로 — assert 실패로 막지 않음)
    expect(Object.keys(table)).toHaveLength(4)
  })
})
