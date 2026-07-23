/**
 * 팔자전 [2단계] — 금고 봇 즉석 조립 방출 시점 로그 assert (2026-07-23 5차 재설계)
 * 지시: ZERA_PALJAJEON_MYOGO_INSTANT_ASSEMBLY_DISPATCH_20260723.md §2
 *
 * 검증 계약: 신 문법(즉석 조립 배율 ≥4.5 시 즉시 방출) 하에서 myogoReleases>0 발생 +
 *   방출 시점(묘고 적재수 / 즉석조립 콤보·배율 / 타격딜)이 [MYOGO-RELEASE] 로그로 캡처됨을 assert.
 *   유령 측정 금지 — 방출 실발생(로그 라인 존재 + 즉석조립 배율 파싱값 >=4.5) 확인.
 *
 * HP ×1.60 mock (getFloorHp 함수 자체 교체) — 유령 측정 차단(simulation_mock_spec).
 * 실행: cd paljapae && npx vitest run src/measurements/_myogoReleaseTiming.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element } from '../types/game'

// ── HP ×1.60 mock — getFloorHp 함수 자체 교체 (352/712/1088/680) ──
vi.mock('../engine/balance', async () => {
  const actual = (await vi.importActual('../engine/balance')) as Record<string, unknown>
  const FC = actual['FLOOR_CONFIGS'] as Array<{ enemyHp: number }>
  const T: Record<number, number> = { 1: 352, 2: 712, 3: 1088, 4: 680 }
  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    V4_FLOOR_HP_TABLE: T,
    getFloorHp: (fi: number) => T[fi + 1] ?? FC[fi].enemyHp,
  }
})

const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')

const dist = { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>

describe('금고 즉석 조립 방출 — 방출 시점 로그 assert (5차 재설계)', () => {
  it('즉석 조립 배율 ≥4.5 조건에서 방출 실발생 + 적재수/즉석조립/타격딜 로그 캡처', () => {
    const tal = selectTalismanBySaju(dist)
    const common = {
      elementDist: dist,
      ilganElement: 'mok' as Element,
      favorableElement: getFavorableElement('mok'),
      enableFloorReward: true,
      enableEffectMode: true, // [MYOGO-RELEASE] 로그 조건
      activePassiveIds: tal,
    }

    // 콘솔 캡처 — [MYOGO-RELEASE] 로그 라인만 수집
    const releaseLogs: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      const line = args.map(String).join(' ')
      if (line.includes('[MYOGO-RELEASE]')) releaseLogs.push(line)
    })

    let totalReleases = 0
    const RUNS = 800
    for (let i = 0; i < RUNS; i++) {
      const seed = i * 12345 + 7777
      const r = simulateFullCapRun(seed, { ...common, forceUnseongpae: 'myoji' })
      totalReleases += r.myogoReleases ?? 0
    }
    spy.mockRestore()

    // ── 방출 실발생 assert (유령 아님) ──
    expect(totalReleases).toBeGreaterThan(0)
    expect(releaseLogs.length).toBeGreaterThan(0)

    // ── 방출 시점 값 파싱: 묘고적재, 즉석조립 콤보명·배율, 타격딜 존재 ──
    const sample = releaseLogs[0]
    const loadMatch = sample.match(/묘고적재=(\d+)장/)
    const comboMatch = sample.match(/즉석조립=(.+?)\(×([\d.]+)\)/)
    const dmgMatch = sample.match(/타격딜=(\d+)/)
    expect(loadMatch).not.toBeNull()
    expect(comboMatch).not.toBeNull()
    expect(dmgMatch).not.toBeNull()
    const loaded = Number(loadMatch![1])
    const instantMult = Number(comboMatch![2])
    expect(loaded).toBeGreaterThanOrEqual(1) // 방출은 재료 ≥1장
    expect(instantMult).toBeGreaterThanOrEqual(4.5) // 신 문법: 즉석 조립 배율 ≥4.5 시 방출

    // 로그 캡처 요약 (게이트 근거)
    console.info(
      `[assert PASS] 방출 ${totalReleases}회 / 로그 ${releaseLogs.length}건 / ` +
      `예시: 적재=${loaded}장 즉석조립=${comboMatch![1]}(×${instantMult}) 타격딜=${dmgMatch![1]}`,
    )
  }, 300_000)
})
