/**
 * 팔자전 [2단계] — 운성패 묘지(墓地) 단독 재튜닝 재측정: 3000판 × 3프리셋 (2026-07-23 제라)
 *
 * ⚠️ 임시 측정 파일 (측정 문법 정정 — 이든 2026-07-23):
 *   - 기존 4종 게이트(unseongpaeGate3000.test.ts, 27000시뮬)는 무수정. 이전 런 kill 원인.
 *   - 본 파일은 그 게이트를 복제·축소해 **묘지만** 돌린다 → 3000판×3프리셋×3군 = 6750시뮬. 재kill 리스크 소멸.
 *   - 원칙: 측정 대상과 도구가 안 맞으면 도구를 깎는다 — 대상을 불리지 않는다.
 *   - 재측정 대상: 5차 재설계 "즉석 조립" — 묘고 방출 = 정본 족보 최대 콤보 즉석 계산 → 적 즉시 타격.
 *     손패 무경유·불변, free action, 봇 정책 = 즉석 조립 배율 ≥4.5 시 즉시 방출 (fullCapBot.ts).
 *
 * 측정 조건 (게이트 승계 — 동일 시드·동일 HP mock):
 *   - HP mock ×1.60 (352/712/1088/680) — getFloorHp 함수 자체 교체 + HP 실효값 assert
 *   - 시드: i*12345+7777 (i=0..2999)
 *   - 3프리셋: 목화 / 금수 / 토단일
 *   - 강제 A/B: A=묘지 강제 장착(성장 허용) / B=미장착 기준선 / 수격방치=강제장착+격su 고정
 *
 * 판정 (지시 4장):
 *   - 개별 Δ≥+5 (1프리셋 이상) → PASS / 여전히 Δ<+5 → C 재이관
 *
 * 실행: cd paljapae && npx vitest run src/measurements/_myojiRetune3000.test.ts
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

// 묘지 단독 — 도구를 깎는다 (4종 → 1종)
const MYOJI: UnseongpaeId = 'myoji'

const RUNS = 3000
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_MYOJI_RETUNE_GATE_20260723.md'

interface Cell {
  aRate: number
  bRate: number
  delta: number
  suRate: number
  suDelta: number
  finalGyeokDist: Record<string, number>
  myogoReleases: number
  // 재수사 (2026-07-23): A군 vs B군 판당 버리기 대조 (discardCount는 엔진이 판당 이미 반환)
  aDiscardPerRun: number
  bDiscardPerRun: number
  discardRatio: number // aDiscardPerRun / bDiscardPerRun
}

function measure(preset: (typeof PRESETS)[0]): Cell {
  const fav = getFavorableElement(preset.ilgan)
  const talismans = selectTalismanBySaju(preset.dist)
  let aVic = 0
  let bVic = 0
  let suVic = 0
  let myogoReleases = 0
  // 재수사: A군/B군 판당 버리기 합산 (엔진 반환 discardCount 그대로 읽음)
  let aDiscardTotal = 0
  let bDiscardTotal = 0
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
    // A군: 묘지 강제 장착 (성장 허용)
    const a = simulateFullCapRun(seed, { ...common, forceUnseongpae: MYOJI })
    if (a.victory) aVic++
    if (a.unseongpaeFinalGyeok) gyeokDist[a.unseongpaeFinalGyeok]++
    myogoReleases += a.myogoReleases ?? 0
    aDiscardTotal += a.discardCount
    // B군: 미장착 기준선
    const b = simulateFullCapRun(seed, { ...common })
    if (b.victory) bVic++
    bDiscardTotal += b.discardCount
    // 수격방치 군: 강제 장착 + 격 su 고정
    const su = simulateFullCapRun(seed, { ...common, forceUnseongpae: MYOJI, fixUnseongpaeGyeok: 'su' })
    if (su.victory) suVic++
  }
  const aRate = (aVic / RUNS) * 100
  const bRate = (bVic / RUNS) * 100
  const suRate = (suVic / RUNS) * 100
  const aDiscardPerRun = aDiscardTotal / RUNS
  const bDiscardPerRun = bDiscardTotal / RUNS
  return {
    aRate,
    bRate,
    delta: aRate - bRate,
    suRate,
    suDelta: suRate - bRate,
    finalGyeokDist: gyeokDist,
    myogoReleases,
    aDiscardPerRun,
    bDiscardPerRun,
    discardRatio: bDiscardPerRun > 0 ? aDiscardPerRun / bDiscardPerRun : 0,
  }
}

describe('운성패 묘지 단독 재튜닝 재측정 — 3000판 × 3프리셋', () => {
  it('DoD: HP assert + rngState 재현성 + 묘지 A/B/수격방치', { timeout: 3_600_000 }, () => {
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
      forceUnseongpae: 'myoji',
    })
    const repro2 = simulateFullCapRun(7777, {
      elementDist: PRESETS[0].dist, ilganElement: 'mok', favorableElement: getFavorableElement('mok'),
      enableFloorReward: true, enableEffectMode: true, activePassiveIds: selectTalismanBySaju(PRESETS[0].dist),
      forceUnseongpae: 'myoji',
    })
    expect(repro1.victory).toBe(repro2.victory)
    expect(repro1.floorsCleared).toBe(repro2.floorsCleared)
    expect(repro1.unseongpaeFinalGyeok).toBe(repro2.unseongpaeFinalGyeok)
    console.log(`[재현성 assert PASS] seed=7777 2회 동일 (victory=${repro1.victory}, gyeok=${repro1.unseongpaeFinalGyeok})`)

    // ── 금고 × 3프리셋 측정 (G13 명명 최종: 카드 표면 = 금고(金庫)) ──
    const table: Record<string, Cell> = {}
    console.log(`\n════ 금고(金庫) 즉석 조립 재측정 ════`)
    for (const p of PRESETS) {
      const cell = measure(p)
      table[p.key] = cell
      console.log(
        `  ${p.label}: A=${cell.aRate.toFixed(1)}% B=${cell.bRate.toFixed(1)}% Δ=${cell.delta.toFixed(2)}%p ` +
        `| 수격방치=${cell.suRate.toFixed(1)}% (Δ${cell.suDelta.toFixed(2)}) ` +
        `| A격분포 su${cell.finalGyeokDist.su}/hyu${cell.finalGyeokDist.hyu}/sang${cell.finalGyeokDist.sang}/wang${cell.finalGyeokDist.wang} ` +
        `| 금고방출=${cell.myogoReleases} ` +
        `| 버리기/판 A=${cell.aDiscardPerRun.toFixed(3)} B=${cell.bDiscardPerRun.toFixed(3)} (A/B=${cell.discardRatio.toFixed(3)}×)`,
      )
    }

    // ── 판정 ──
    const cells = PRESETS.map(p => table[p.key])
    const maxDelta = Math.max(...cells.map(c => c.delta))
    const minDelta = Math.min(...cells.map(c => c.delta))
    const anyOver5 = cells.some(c => c.delta >= 5)
    let verdict: string
    if (anyOver5) verdict = `PASS — 최소 1프리셋 Δ≥+5 (max ${maxDelta.toFixed(2)})`
    else verdict = `개별 Δ<+5 — C 재이관 (min ${minDelta.toFixed(2)} / max ${maxDelta.toFixed(2)})`
    console.log(`★ 금고: ${verdict}`)

    // ── 재수사 분기 판정: A군 버리기 vs B군 버리기 (1.25× 임계) ──
    const maxRatio = Math.max(...cells.map(c => c.discardRatio))
    const minRatio = Math.min(...cells.map(c => c.discardRatio))
    let branchVerdict: string
    if (maxRatio >= 1.25) {
      branchVerdict = `(A) A군 버리기 유의 초과 (max A/B=${maxRatio.toFixed(3)}× ≥ 1.25) → 봇 수리 대상`
    } else if (maxRatio < 1.0) {
      branchVerdict = `(B) A군 버리기 동수/미달 (max A/B=${maxRatio.toFixed(3)}× < 1.0) → 묘고 본체 유죄, 수리 안 함`
    } else {
      branchVerdict = `경계 케이스 (max A/B=${maxRatio.toFixed(3)}×, min=${minRatio.toFixed(3)}× / 1.0×~1.25×) → 자동 진행 보류, 표만 반환`
    }
    console.log(`★ 재수사 분기: ${branchVerdict}`)

    // ── 로그 파일 (묘지 단독) ──
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const f = (n: number) => n.toFixed(1)
    let body = `| 프리셋 | A(장착) | B(미장착) | Δ(A−B) | 수격방치 | 수격Δ | A격분포(su/hyu/sang/wang) | 묘고방출 | 버리기/판 A | 버리기/판 B | A/B 배율 |\n`
    body += `|-------|---------|-----------|--------|---------|-------|--------------------------|----------|-----------|-----------|---------|\n`
    for (const p of PRESETS) {
      const c = table[p.key]
      const g = c.finalGyeokDist
      body += `| ${p.label} | ${f(c.aRate)}% | ${f(c.bRate)}% | Δ${c.delta.toFixed(2)} | ${f(c.suRate)}% | ${c.suDelta.toFixed(2)} | ${g.su}/${g.hyu}/${g.sang}/${g.wang} | ${c.myogoReleases} | ${c.aDiscardPerRun.toFixed(3)} | ${c.bDiscardPerRun.toFixed(3)} | ${c.discardRatio.toFixed(3)}× |\n`
    }

    const md = `# 운성패 금고(金庫) 단독 5차 재설계 재측정 — 게이트 로그 (즉석 조립 + G13 명명 최종)

**생성: ${now} KST / 발신: 제라**
**지시: ZERA_PALJAJEON_MYOGO_INSTANT_ASSEMBLY_DISPATCH_20260723.md**
**5차 재설계: 방출 = 묘고 재료로 정본 족보 최대 콤보 즉석 계산 → 적 즉시 타격. 손패 무경유·불변, free action.**
**봇 정책: 묘고 내 성립 콤보 배율 ≥4.5 시 즉시 방출 (fullCapBot.ts).**
**임시 측정 파일: src/measurements/_myojiRetune3000.test.ts (금고만 6750시뮬 — 기존 4종 게이트 무수정)**
**HP ×1.60 (352/712/1088/680) / 시드 i*12345+7777 / 3000판×3프리셋**
**rngState seed(i=0)=7777 → ${rngStateSample} / 재현성 assert PASS**

A군=금고 강제 장착(성장 허용) / B군=미장착 기준선 / 수격방치=강제장착+격su 고정.
(G13 명명 최종 2026-07-23 이든: 카드 표면명 = 금고(金庫). 내부 창고 슬롯 = 묘고(墓庫). 엔진 식별자 키 myoji/myogo 유지.)

### 금고(金庫)

${body}
판정: **${verdict}**

## 재수사 분기 (2026-07-23 이든 판정 보류 재수사 1점)
A군(장착) vs B군(미장착) 판당 버리기(discardCount, 엔진 반환) 대조. 임계 1.25×.
- **분기: ${branchVerdict}**

## 채점 기준 (지시 4장)
- 개별 Δ≥+5 (1프리셋 이상) → PASS / 여전히 Δ<+5 → C 재이관

## 커밋/배포 금지 — 빌라드 검토 후 지시
`
    writeFileSync(RESULT_PATH, md)
    console.log(`[금고 게이트 로그] ${RESULT_PATH}`)

    expect(Object.keys(table)).toHaveLength(3)
  })
})
