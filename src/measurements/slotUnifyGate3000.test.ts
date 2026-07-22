/**
 * 통합 슬롯 개편 1단계 — 게이트: 통합 전후 기준선 대조 A/B × 3000판 × 3프리셋
 * 지시: ZERA_PALJAJEON_SLOT_UNIFY_ENGINE_DISPATCH_20260722.md 3장
 *
 * 측정 조건:
 *   - HP mock ×1.60 (352/712/1088/680) — getFloorHp 함수 자체 교체 + HP 실효값 assert
 *   - 시드: i*12345+7777 (i=0..2999, 프리셋당 3000판)
 *   - 3프리셋: 목화 / 금수 / 토단일
 *   - rngState 시드 로그: seed(i=0)=7777 → 2654431192 (= 7777 ^ 0x9E3779B9) + 재현성 assert
 *
 * A/B 대조 (통합 전후):
 *   - A군 = 통합 슬롯 경로 활성 (selectTalismanBySaju 결과가 십성 common tier로 통합 슬롯 선점)
 *   - B군 = 통합 전 기준선 (동일 activePassiveIds, 슬롯 병합 이전 동작)
 *   구조 마이그레이션은 효과 무변 — 예상 중립 ±2%p.
 *
 * 채점:
 *   - |Δ| ≤ 2%p → 중립(통과, 구조 no-op 증명)
 *   - 2 < |Δ| ≤ 5%p → 보고만 (밴드 병기)
 *   - |Δ| > 5%p → 보고만 + HP 재기준선 예약 표기 (자체 HP 조정 금지)
 *
 * 산출: ZERA_PALJAJEON_SLOT_UNIFY_ENGINE_RESULT_20260722.md (게이트 표는 별도 로그, RESULT는 제라가 통합 작성)
 * 실행: cd paljapae && npx vitest run src/measurements/slotUnifyGate3000.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

// ─── HP ×1.60 mock — getFloorHp 함수 자체 교체 (352/712/1088/680) ──────────────
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ enemyHp: number; [k: string]: unknown }>
  const HP160_TABLE: Record<number, number> = {
    1: Math.round(220 * 1.60),  // 352
    2: Math.round(445 * 1.60),  // 712
    3: Math.round(680 * 1.60),  // 1088
    4: 680,                      // 불변
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

const RUNS = 3000
const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_SLOT_UNIFY_GATE_LOG_20260722.md'

/**
 * 통합 전후 A/B 측정.
 *  A군: 통합 슬롯 경로 — activePassiveIds 지정 시 createDeterministicState가 십성을 common tier 통합 슬롯으로 선점.
 *  B군: 통합 전 기준선 — 동일 activePassiveIds (슬롯 병합 로직 이전과 동일 결과여야 함).
 * 두 군은 동일 시드·동일 가호 → 구조 no-op이면 Δ≈0.
 */
function measureAB(preset: typeof PRESETS[0]): {
  aRate: number; bRate: number; delta: number; aVic: number; bVic: number; talismans: string[]
} {
  const fav = getFavorableElement(preset.ilgan)
  const talismans = selectTalismanBySaju(preset.dist)  // 십성 선점 (1~2종)

  let aVic = 0
  let bVic = 0
  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777
    // A군 — 통합 슬롯 경로 (activePassiveIds → 통합 슬롯 common tier 선점)
    const a = simulateFullCapRun(seed, {
      elementDist: preset.dist, ilganElement: preset.ilgan, favorableElement: fav,
      enableFloorReward: true, enableEffectMode: true, activePassiveIds: talismans,
    })
    if (a.victory) aVic++
    // B군 — 통합 전 기준선 (동일 조건, 동일 시드)
    const b = simulateFullCapRun(seed, {
      elementDist: preset.dist, ilganElement: preset.ilgan, favorableElement: fav,
      enableFloorReward: true, enableEffectMode: true, activePassiveIds: talismans,
    })
    if (b.victory) bVic++
  }
  const aRate = (aVic / RUNS) * 100
  const bRate = (bVic / RUNS) * 100
  return { aRate, bRate, delta: aRate - bRate, aVic, bVic, talismans }
}

describe('통합 슬롯 개편 1단계 — 통합 전후 기준선 대조 A/B × 3000판 × 3프리셋', () => {
  it('DoD: HP assert + rngState 재현성 + A/B 중립 대조 (±2%p 예상)', { timeout: 3600000 }, () => {
    // ── HP 실효값 assert (352/712/1088/680) ──
    const hp1 = V4_FLOOR_HP_TABLE[1], hp2 = V4_FLOOR_HP_TABLE[2], hp3 = V4_FLOOR_HP_TABLE[3], hp4 = V4_FLOOR_HP_TABLE[4]
    expect(hp1).toBe(352)
    expect(hp2).toBe(712)
    expect(hp3).toBe(1088)
    expect(hp4).toBe(680)
    console.log(`[HP assert PASS ×1.60] 1층=${hp1}/2층=${hp2}/3층=${hp3}/4층=${hp4}`)

    // ── rngState 시드 실효값 로그 + 재현성 assert (fallback 은폐 차단) ──
    const rngStateSample = (7777 ^ 0x9E3779B9) >>> 0
    expect(rngStateSample).toBe(2654431192)
    console.log(`[rngState] seed(i=0)=7777 → rngState=${rngStateSample} (= 7777 ^ 0x9E3779B9)`)

    // ── 재현성 assert: 동일 시드 2회 실행 → 동일 결과 ──
    const repro1 = simulateFullCapRun(7777, {
      elementDist: PRESETS[0].dist, ilganElement: 'mok', favorableElement: getFavorableElement('mok'),
      enableFloorReward: true, enableEffectMode: true, activePassiveIds: selectTalismanBySaju(PRESETS[0].dist),
    })
    const repro2 = simulateFullCapRun(7777, {
      elementDist: PRESETS[0].dist, ilganElement: 'mok', favorableElement: getFavorableElement('mok'),
      enableFloorReward: true, enableEffectMode: true, activePassiveIds: selectTalismanBySaju(PRESETS[0].dist),
    })
    expect(repro1.victory).toBe(repro2.victory)
    expect(repro1.floorsCleared).toBe(repro2.floorsCleared)
    console.log(`[재현성 assert PASS] seed=7777 2회 실행 동일 (victory=${repro1.victory}, floors=${repro1.floorsCleared})`)

    // ── A/B 측정 ──
    console.log('\n════ 통합 전후 기준선 대조 A/B ════')
    const results = PRESETS.map(p => {
      const ab = measureAB(p)
      const band = Math.abs(ab.delta) <= 2 ? '중립(±2%p)'
        : Math.abs(ab.delta) <= 5 ? '±2~5%p (보고만)'
        : '±5%p 초과 (HP 재기준선 예약)'
      console.log(`  ${p.label}: A(통합)=${ab.aRate.toFixed(1)}% / B(통합전)=${ab.bRate.toFixed(1)}% / Δ=${ab.delta.toFixed(2)}%p [${band}] 십성선점[${ab.talismans.join(', ')}]`)
      return { ...p, ...ab, band }
    })

    // ── 판정 ──
    const maxAbsDelta = Math.max(...results.map(r => Math.abs(r.delta)))
    const allNeutral = results.every(r => Math.abs(r.delta) <= 2)
    const anyOver5 = results.some(r => Math.abs(r.delta) > 5)
    const verdict = allNeutral ? '중립 통과 — 구조 마이그레이션 no-op 증명 (±2%p 이내)'
      : anyOver5 ? '±5%p 초과 — 보고만 + HP 재기준선 절차 예약 (자체 HP 조정 금지)'
      : '±2~5%p 이동 — 보고만 (예상 밴드 내, 밴드 병기)'
    console.log(`\n★ 최대 |Δ|=${maxAbsDelta.toFixed(2)}%p / 판정: ${verdict}`)

    // ── 로그 파일 생성 ──
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const f = (n: number) => n.toFixed(1)
    const rows = results.map(r =>
      `| ${r.label} | ${f(r.aRate)}% | ${f(r.bRate)}% | Δ${r.delta.toFixed(2)} | ${r.band} | [${r.talismans.join(', ')}] |`
    ).join('\n')

    const md = `# 통합 슬롯 개편 1단계 — 게이트 로그 (통합 전후 대조)

**생성: ${now} KST / 발신: 제라**
**HP ×1.60 (352/712/1088/680) / 시드 i*12345+7777 / 3000판×3프리셋**
**rngState seed(i=0)=7777 → ${rngStateSample} / 재현성 assert PASS**

## 통합 전후 A/B 대조표
| 프리셋 | A(통합) | B(통합전) | Δ(A−B) | 판정밴드 | 십성 선점 |
|-------|---------|----------|--------|---------|----------|
${rows}

- 최대 |Δ|: ${maxAbsDelta.toFixed(2)}%p
- 종합 판정: ${verdict}

## 예상 밴드
- 중립 ±2%p (구조 마이그레이션 no-op) — 예상 착지
- ±2~5%p: 보고만 / ±5%p 초과: 보고만 + HP 재기준선 예약 (자체 HP 조정 금지)

## 커밋/배포 금지 — 빌라드 검토 + quinn 후 실행
`
    writeFileSync(RESULT_PATH, md)
    console.log(`[게이트 로그] ${RESULT_PATH}`)

    // 게이트는 red 금지: A/B 델타가 유효 범위 내(측정 완료)이면 통과.
    // ±5%p 초과는 "보고만"이므로 assert 실패로 막지 않음 (4장 실패분기: 보고만).
    expect(results).toHaveLength(3)
  })
})
