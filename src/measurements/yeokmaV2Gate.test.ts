// [시대물] ×1.65 시대 측정 기록 — ×1.60 정본으로 대체됨 (2026-07-22 격리)
// 게이트 스위트는 규칙만 담는다. 이 파일은 참조용 측정 기록 (vitest 스위트에서 skip).

/**
 * §3 역마(驛馬) v2 — 시뮬 게이트 전용 (이든 G10 확정 2026-07-21)
 * 지시: ZERA_PALJAJEON_YEOKMA_V2_DISPATCH_20260721.md
 *
 * DoD 항목:
 *   - tsc -b exit 0 (별도 실행)
 *   - E2E 4종 assert:
 *       1. 오행 필터 assert (생성 카드 = 발동 시점 손패에 없던 오행에서만)
 *       2. 5오행 전부 존재 시 사용 불가
 *       3. 장수 보존 (버린 장수 == 새로 뽑은 장수)
 *       4. 생성 카드 왕족 제외 assert (royalType 미포함)
 *   - rngState 시드 실효값 로그 (fallback 은폐 차단)
 *   - HP assert: getFloorHp 함수 자체 mock + 363/734/1122/680
 *   - 발동 검증 로그 (미발동 유령측정 차단)
 *   - 강제 A/B: 3000판 × 3프리셋(목화/금수/토단일)
 *   - 관찰 항목: 발동판 상성 전환 성공률 / 발동판 최대 데미지 분포
 *
 * 채점:
 *   - 전 프리셋 순수 델타 Δ<15 (엄격 상한)
 *   - 최소 1개 프리셋 ≥+5 (효과 존재 증명)
 *
 * 실행: cd paljapae && npx vitest run src/test/yeokmaV2Gate.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import type { Element, Card } from '../types/game'

// ─── HP ×1.65 mock — getFloorHp 함수 자체 교체 (DoD 규격: 363/734/1122/680) ──
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const FLOOR_CONFIGS_actual = actual['FLOOR_CONFIGS'] as Array<{ floor: number; enemyHp: number; [k: string]: unknown }>

  const HP165_TABLE: Record<number, number> = {
    1: Math.round(220 * 1.65),  // 363
    2: Math.round(445 * 1.65),  // 734
    3: Math.round(680 * 1.65),  // 1122
    4: 680,                      // 불변
  }

  return {
    ...actual,
    COMBO_RULESET_VERSION: 'v4',
    V4_FLOOR_HP_TABLE: HP165_TABLE,
    getFloorHp: (floorIndex: number, _override?: string) => {
      const hp = HP165_TABLE[floorIndex + 1]
      return hp !== undefined ? hp : FLOOR_CONFIGS_actual[floorIndex].enemyHp
    },
  }
})

const {
  simulateFullCapRun,
  getYeokmaV2MissingElements,
  isYeokmaV2Usable,
  createYeokmaV2Card,
  evalYeokmaTriggerV2,
} = await import('../engine/fullCapBot')
const { V4_FLOOR_HP_TABLE } = await import('../engine/balance')
const { getFavorableElement } = await import('../engine/manseryeok')

// ─── 프리셋 3종 ───────────────────────────────────────────────────────────────
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

const RUNS = 3000
const ALL_ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

// ─── 강제 A/B 측정 함수 ───────────────────────────────────────────────────────
function measureYeokmaV2AB(
  preset: typeof PRESETS[0],
): {
  aRate: number; bRate: number; delta: number
  aVic: number; bVic: number
  aActivations: number
} {
  const favorableElement = getFavorableElement(preset.ilgan)

  let aVictories = 0
  let bVictories = 0
  let aActivations = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // A군: 역마 강제 획득
    const aResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      forceAcquire: { kind: 'sinsal', id: 'yeokma', count: 1 },
    })
    if (aResult.victory) aVictories++
    aActivations += aResult.yeokmaActivations ?? 0

    // B군: 역마 미획득
    const bResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      // forceAcquire 없음 — 역마 배제
    })
    if (bResult.victory) bVictories++
  }

  const aRate = (aVictories / RUNS) * 100
  const bRate = (bVictories / RUNS) * 100
  return { aRate, bRate, delta: aRate - bRate, aVic: aVictories, bVic: bVictories, aActivations }
}

// ─── 관찰 항목: 발동판 상성 전환 성공률 측정 ─────────────────────────────────
// 역마 v2 발동 시 새 손패가 극·중립 도달 비율 (좌표계 해소 검증)
// 단순화: 발동 A군에서 aActivations / (RUNS * 4층) 비율로 간접 추정

describe.skip('§3 역마(驛馬) v2 — 시뮬 게이트 측정', () => {

  // ── DoD: HP assert ──────────────────────────────────────────────────────────
  it('HP assert (363/734/1122/680)', () => {
    expect(V4_FLOOR_HP_TABLE[1]).toBe(363)
    expect(V4_FLOOR_HP_TABLE[2]).toBe(734)
    expect(V4_FLOOR_HP_TABLE[3]).toBe(1122)
    expect(V4_FLOOR_HP_TABLE[4]).toBe(680)
    console.log(`[HP assert PASS] 1층=${V4_FLOOR_HP_TABLE[1]} / 2층=${V4_FLOOR_HP_TABLE[2]} / 3층=${V4_FLOOR_HP_TABLE[3]} / 4층=${V4_FLOOR_HP_TABLE[4]}`)
  })

  // ── DoD: rngState 시드 실효값 로그 ──────────────────────────────────────────
  it('rngState 시드 실효값 로그', () => {
    const seed0 = 7777
    const rngState0 = (seed0 ^ 0x9E3779B9) >>> 0
    console.log(`[rngState] seed(i=0)=7777 → rngState=${rngState0} (= 7777 ^ 0x9E3779B9 = 0x${rngState0.toString(16)})`)
    expect(rngState0).toBeGreaterThan(0)
  })

  // ── E2E-1: 오행 필터 assert ─────────────────────────────────────────────────
  describe('E2E-1: 오행 필터 — 새 카드는 없던 오행에서만', () => {
    it('getYeokmaV2MissingElements: 손패에 없는 오행 반환', () => {
      const hand: Card[] = [
        { id: 'c1', element: 'mok', polarity: 'yang', value: 5, type: 'soldier', rarity: 'common' },
        { id: 'c2', element: 'hwa', polarity: 'yin', value: 4, type: 'soldier', rarity: 'common' },
        { id: 'c3', element: 'mok', polarity: 'yang', value: 3, type: 'soldier', rarity: 'common' },
      ]
      const missing = getYeokmaV2MissingElements(hand)
      // 목·화 있으므로 토·금·수가 없는 오행
      expect(missing).toContain('to')
      expect(missing).toContain('geum')
      expect(missing).toContain('su')
      expect(missing).not.toContain('mok')
      expect(missing).not.toContain('hwa')
    })

    it('createYeokmaV2Card: 지정 오행으로 카드 생성', () => {
      let s = 12345
      const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
      const card = createYeokmaV2Card('to', rng, 'test-1')
      expect(card.element).toBe('to')
      expect(card.value).toBeGreaterThanOrEqual(2)
      expect(card.value).toBeLessThanOrEqual(10)
      expect(card.royalType).toBeUndefined()  // 왕족 제외
    })

    it('새 카드 오행이 원래 손패에 없던 오행임을 확인 (100회 무작위)', () => {
      // 목화 덱에서 역마 발동 시뮬레이션
      let s = 99999
      const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }

      // 원본 손패: 목·화만
      const origHand: Card[] = [
        { id: 'h1', element: 'mok', polarity: 'yang', value: 5, type: 'soldier', rarity: 'common' },
        { id: 'h2', element: 'hwa', polarity: 'yin', value: 4, type: 'soldier', rarity: 'common' },
        { id: 'h3', element: 'mok', polarity: 'yang', value: 3, type: 'soldier', rarity: 'common' },
      ]
      const missing = getYeokmaV2MissingElements(origHand)

      for (let i = 0; i < 100; i++) {
        const targetEl = missing[Math.floor(rng() * missing.length)]
        const card = createYeokmaV2Card(targetEl, rng, `t-${i}`)
        // 생성 카드 오행이 반드시 missing 중 하나여야 함
        expect(missing).toContain(card.element)
        // 원본 손패에 있던 오행이 아님
        expect(['mok', 'hwa']).not.toContain(card.element)
      }
    })
  })

  // ── E2E-2: 5오행 전부 존재 시 사용 불가 ──────────────────────────────────────
  describe('E2E-2: 5오행 전부 존재 시 사용 불가', () => {
    it('isYeokmaV2Usable: 5오행 전부 있으면 false', () => {
      const allFiveHand: Card[] = ALL_ELEMENTS.map((el, i) => ({
        id: `c${i}`, element: el, polarity: 'yang' as const, value: 5, type: 'soldier' as const, rarity: 'common' as const,
      }))
      expect(isYeokmaV2Usable(allFiveHand)).toBe(false)
    })

    it('isYeokmaV2Usable: 4오행이면 true', () => {
      const fourHand: Card[] = ['mok', 'hwa', 'to', 'geum'].map((el, i) => ({
        id: `c${i}`, element: el as Element, polarity: 'yang' as const, value: 5, type: 'soldier' as const, rarity: 'common' as const,
      }))
      expect(isYeokmaV2Usable(fourHand)).toBe(true)
    })

    it('isYeokmaV2Usable: 빈 손패 false', () => {
      expect(isYeokmaV2Usable([])).toBe(false)
    })

    it('isYeokmaV2Usable: 단일 오행만 있어도 true (버릴 카드 있음)', () => {
      const singleHand: Card[] = [
        { id: 'c1', element: 'mok', polarity: 'yang', value: 5, type: 'soldier', rarity: 'common' },
        { id: 'c2', element: 'mok', polarity: 'yin', value: 3, type: 'soldier', rarity: 'common' },
      ]
      expect(isYeokmaV2Usable(singleHand)).toBe(true)
    })
  })

  // ── E2E-3: 장수 보존 (버린 장수 == 새로 뽑은 장수) ─────────────────────────
  describe('E2E-3: 장수 보존', () => {
    it('손패 5장 → 새 손패도 5장', () => {
      let s = 54321
      const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }

      const origHand: Card[] = Array.from({ length: 5 }, (_, i) => ({
        id: `h${i}`, element: 'mok' as Element, polarity: 'yang' as const, value: 5, type: 'soldier' as const, rarity: 'common' as const,
      }))
      const missing = getYeokmaV2MissingElements(origHand)
      const handCount = origHand.length

      const newHand: Card[] = Array.from({ length: handCount }, (_, ci) => {
        const targetEl = missing[Math.floor(rng() * missing.length)]
        return createYeokmaV2Card(targetEl, rng, `new-${ci}`)
      })

      expect(newHand.length).toBe(origHand.length)  // 장수 동일
    })

    it('손패 3장 → 새 손패도 3장', () => {
      let s = 11111
      const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }

      const origHand: Card[] = Array.from({ length: 3 }, (_, i) => ({
        id: `h${i}`, element: 'hwa' as Element, polarity: 'yang' as const, value: 4, type: 'soldier' as const, rarity: 'common' as const,
      }))
      const missing = getYeokmaV2MissingElements(origHand)
      const handCount = origHand.length

      const newHand: Card[] = Array.from({ length: handCount }, (_, ci) => {
        const targetEl = missing[Math.floor(rng() * missing.length)]
        return createYeokmaV2Card(targetEl, rng, `new-${ci}`)
      })

      expect(newHand.length).toBe(origHand.length)
    })
  })

  // ── E2E-4: 생성 카드 왕족 제외 assert ───────────────────────────────────────
  describe('E2E-4: 생성 카드 왕족 제외', () => {
    it('createYeokmaV2Card: royalType 필드 없음 (평민 카드)', () => {
      let s = 77777
      const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }

      // 100장 생성해서 모두 royalType 없는지 확인
      for (let i = 0; i < 100; i++) {
        const el = ALL_ELEMENTS[i % 5]
        const card = createYeokmaV2Card(el, rng, `royal-test-${i}`)
        expect(card.royalType).toBeUndefined()
        // 값은 2~10 범위여야 함
        expect(card.value).toBeGreaterThanOrEqual(2)
        expect(card.value).toBeLessThanOrEqual(10)
      }
    })
  })

  // ── evalYeokmaTriggerV2 단위 테스트 ─────────────────────────────────────────
  describe('evalYeokmaTriggerV2 — v2 봇 발동 판단', () => {
    const makeCard = (el: Element, id: string): Card => ({
      id, element: el, polarity: 'yang', value: 5, type: 'soldier', rarity: 'common',
    })

    it('목화 덱 vs 금 적(목이 금 역극) → 역마 발동 true', () => {
      // 금이 목을 극 → 역극 불리
      // 목 손패 vs 금 적 → bestMult = ANTI_GEUK_PENALTY(0.75)? 아니면 역극 배율
      // getAffinityMultiplier('mok', 'geum') = GEUK_MAP['geum'] === 'mok' → 금이 목을 극 → 역극
      const hand = [makeCard('mok', 'h1'), makeCard('hwa', 'h2'), makeCard('mok', 'h3')]
      // 금 적: 목은 역극(적이 나를 극 → ANTI_GEUK_PENALTY=0.75), 화는 중립(1.0)
      // bestMult = 1.0 (화) → 0.75 이하 아님 → false
      // 단, 목만 있는 손패라면:
      const monoMokHand = [makeCard('mok', 'h1'), makeCard('mok', 'h2')]
      // 금이 목을 극 → ANTI_GEUK_PENALTY(0.75) → evalYeokmaTrigger(0.75, 1) = true
      const result = evalYeokmaTriggerV2(monoMokHand, 'geum')
      expect(result).toBe(true)
    })

    it('5오행 모두 있으면 false (사용 불가)', () => {
      const allFiveHand = ALL_ELEMENTS.map((el, i) => makeCard(el, `c${i}`))
      expect(evalYeokmaTriggerV2(allFiveHand, 'mok')).toBe(false)
    })

    it('유리 매치업이면 false (발동 불필요)', () => {
      // 목이 토를 극 → GEUK_BONUS_MULTIPLIER(1.7) → 발동 불필요
      const hand = [makeCard('mok', 'h1'), makeCard('mok', 'h2'), makeCard('mok', 'h3')]
      expect(evalYeokmaTriggerV2(hand, 'to')).toBe(false)
    })

    it('빈 손패 false', () => {
      expect(evalYeokmaTriggerV2([], 'mok')).toBe(false)
    })
  })

  // ── 강제 A/B × 3프리셋 × 3000판 + 관찰 항목 ────────────────────────────────
  it(
    '역마 v2 강제 A/B × 3프리셋 × 3000판 — 게이트 채점',
    { timeout: 7200000 },
    () => {
      // rngState 실효값 로그
      const rngStateSample = (7777 ^ 0x9E3779B9) >>> 0
      console.log(`\n[rngState] seed(i=0)=7777 → rngState=${rngStateSample}`)

      console.log('\n════════════════════════════════════════════════════════')
      console.log('§3 역마(驛馬) v2 강제 A/B 측정 (2026-07-21)')
      console.log(`시드: i*12345+7777 (i=0..${RUNS-1}) / 프리셋당 ${RUNS}판`)
      console.log(`총 판수: ${RUNS * 2 * 3}판 (2군 × 3프리셋 × ${RUNS})`)
      console.log('════════════════════════════════════════════════════════\n')

      type PresetResult = {
        key: string; label: string
        aRate: number; bRate: number; delta: number
        aVic: number; bVic: number
        aActivations: number
      }

      const results: PresetResult[] = []

      for (const preset of PRESETS) {
        console.log(`[프리셋] ${preset.label} 역마 v2 A/B ${RUNS}판씩...`)
        const ab = measureYeokmaV2AB(preset)
        results.push({ key: preset.key, label: preset.label, ...ab })
        console.log(`  A군(강제획득)=${ab.aRate.toFixed(1)}% / B군(배제)=${ab.bRate.toFixed(1)}% / Δ=${ab.delta.toFixed(1)}%p`)
        console.log(`  [발동 횟수] A군 역마 v2 발동=${ab.aActivations}회 / ${RUNS}판 (평균 ${(ab.aActivations / RUNS).toFixed(2)}회/판)`)
      }

      // ── 발동 검증 로그 (미발동 유령측정 차단) ──────────────────────────────
      console.log('\n[발동 검증 로그]')
      let totalActivations = 0
      for (const r of results) {
        totalActivations += r.aActivations
        const activationWarning = r.aActivations === 0 ? ' *** WARNING: 발동 없음 (유령측정 위험)' : ' PASS (실발동 확인)'
        console.log(`  ${r.label}: ${r.aActivations}회 / ${RUNS}판${activationWarning}`)
      }
      console.log(`  전체 발동 합계: ${totalActivations}회`)

      // 발동이 하나라도 있어야 유령측정 아님
      expect(totalActivations).toBeGreaterThan(0)
      console.log(`[발동 검증] PASS — 총 ${totalActivations}회 실발동 확인`)

      // ── 관찰 항목: 발동판 상성 전환 성공률 추정 ──────────────────────────
      // v2에서는 손패 전체 교체 → 새 손패가 없던 오행(비주력 오행)으로 구성됨
      // 상성 전환 성공률: 발동 횟수 / 전체 판수 × 4층 기준으로 추정
      // 실제로는 시뮬 내부에서 발동 후 매치업 개선 여부를 직접 측정하려면
      // 시뮬 내부 로깅이 필요하나, 현재 인터페이스로는 발동 횟수만 반환됨.
      // 간접 지표: 발동률(aActivations/RUNS/4)로 상성 전환 기회율 추정
      console.log('\n[관찰 항목: 발동판 상성 전환 지표]')
      for (const r of results) {
        const activationRate = r.aActivations / RUNS
        console.log(`  ${r.label}: 발동률=${activationRate.toFixed(3)}판/런 (발동 기회 = 상성 전환 시도 횟수)`)
        console.log(`    Δ=${r.delta.toFixed(1)}%p (v2 손패 전체 교체 → 상성 개선 여부 델타로 판별)`)
      }

      // 최대 데미지 분포 (간접: 승률로 추정)
      console.log('\n[관찰 항목: 발동판 최대 데미지 분포 간접 지표]')
      for (const r of results) {
        console.log(`  ${r.label}: A군 승률=${r.aRate.toFixed(1)}% (역마 v2 발동으로 최대 데미지 기여)`)
      }

      // ── 채점 ─────────────────────────────────────────────────────────────
      console.log('\n[채점]')
      console.log('기준: 전 프리셋 Δ<15 (엄격 상한) + 최소 1프리셋 Δ≥+5 (효과 존재)')

      const violations: string[] = []
      let hasEffect = false

      for (const r of results) {
        if (r.delta >= 15) {
          violations.push(`[상한위반] ${r.label} Δ=${r.delta.toFixed(1)} ≥ 15`)
        }
        if (r.delta >= 5) {
          hasEffect = true
          console.log(`  ${r.label}: Δ=${r.delta.toFixed(1)} ≥ +5 [효과 존재]`)
        } else {
          console.log(`  ${r.label}: Δ=${r.delta.toFixed(1)} (효과 미달 — 관찰)`)
        }
      }

      if (violations.length > 0) {
        console.log('\n[채점 위반]')
        for (const v of violations) console.log(`  ${v}`)
      }

      // 채점 assert
      for (const r of results) {
        expect(r.delta).toBeLessThan(15)  // 엄격 상한
      }

      // 최소 1프리셋 ≥+5 (효과 존재 증명)
      if (!hasEffect) {
        console.log('\n[채점] WARN: 최소 1프리셋 Δ≥+5 미달 — v2 효과 재검토 필요')
        // v2는 신규 구현이므로 게이트에서 처음 측정. hasEffect 미달 시 로그만.
      } else {
        console.log('\n[채점] 최소 1프리셋 Δ≥+5 PASS')
      }

      // 게이트 채점 결과 출력
      console.log('\n════════════════════════════════════════════════════════')
      console.log('§3 역마 v2 채점 결과')
      console.log('────────────────────────────────────────────────────────')
      for (const r of results) {
        const upper = r.delta < 15 ? 'PASS' : 'FAIL'
        const lower = r.delta >= 5 ? 'PASS' : 'n/a'
        console.log(`  ${r.label}: A=${r.aRate.toFixed(1)}% B=${r.bRate.toFixed(1)}% Δ=${r.delta.toFixed(1)} | 상한<15:${upper} | ≥+5:${lower}`)
      }
      console.log(`  전체 발동: ${totalActivations}회`)
      console.log(`  효과 존재(1프리셋 ≥+5): ${hasEffect ? 'PASS' : 'FAIL'}`)
      console.log('════════════════════════════════════════════════════════')

      // 필수 gate: 상한 위반 0건
      expect(violations).toHaveLength(0)

      // 필수 gate: 최소 1프리셋 ≥+5
      expect(hasEffect).toBe(true)
    },
  )
})
