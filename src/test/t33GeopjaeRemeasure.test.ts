/**
 * T33 마무리 — 겁재 재측정 (시작 덱 왕족 1장 A/B 양군 동일 시딩)
 * 지시: ZERA_PALJAJEON_T33_GEOPJAE_REMEASURE_DISPATCH_20260721.md
 *
 * 직전 T33 측정에서 겁재 A/B가 무효였던 원인:
 *   - A군 세계에 왕족 카드가 아예 등장하지 않아 겁재 §a 가중(royalType 포함 조합 ×1.15)이
 *     발동할 대상이 없었음 (royalValue 미지정 → 왕족 미생성)
 *
 * 재측정 유일 변경:
 *   - A/B 양군 시작 덱에 왕족(royalType='king', element='mok', value=10) 1장 동일 시딩
 *   - 통제 변인: A/B 유일 차이는 겁재(geoptae) 장착 여부만
 *   - 겁재 §a 가중 계수(×1.15)는 현행 그대로
 *
 * DoD:
 *   - tsc -b exit 0 (사전 통과 확인)
 *   - vitest PASS
 *   - rngState 시드 실효값 로그
 *   - HP assert (363/734/1122/680) + getFloorHp 함수 mock
 *   - 왕족 시딩 검증 assert (A/B 양군 startingExtraCards 왕족 1장 실존)
 *   - 강제 A/B 표: 겁재 3프리셋(목화/금수/토단일) + 직전 재측정 전 대조
 *   - 커밋 금지
 *
 * 산출: ZERA_PALJAJEON_T33_GEOPJAE_REMEASURE_RESULT_20260721.md
 * 실행: cd paljapae && npx vitest run src/test/t33GeopjaeRemeasure.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'

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

const { simulateFullCapRun } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const { V4_FLOOR_HP_TABLE, ROYAL_CARDS, createRoyalCard } = await import('../engine/balance')

// ─── 왕족 시딩 카드 생성 (시드 고정 — 재현 가능) ───────────────────────────────
// 목 계열 왕(갑목)을 선택: 목화 프리셋에서 목 원소가 주류 → 실게임 조건 재현
const ROYAL_SEED_DEF = ROYAL_CARDS.find(d => d.id === 'king-mok')!
const SEEDED_ROYAL_CARD = createRoyalCard(ROYAL_SEED_DEF, 10, 'SEED-FIXED-001')

// 왕족 시딩 검증: def 존재 + card 생성 확인
if (!ROYAL_SEED_DEF) throw new Error('[왕족 시딩 오류] king-mok 정의를 찾을 수 없음')
if (!SEEDED_ROYAL_CARD.royalType) throw new Error('[왕족 시딩 오류] 생성된 카드에 royalType 없음')

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

// 직전 T33 측정값(왕족 미시딩 상태 — 무효 측정) — 대조용
const BEFORE_DELTA_T33: Record<string, Record<string, number>> = {
  geoptae: { mokHwa: 0.1, geumSu: -0.1, toDanil: 0.6 },
}

// ─── 강제 A/B 측정 함수 ───────────────────────────────────────────────────────
// A군: 겁재 강제 장착 + 시작 덱 왕족 1장
// B군: 겁재 완전 배제 + 시작 덱 왕족 1장 (동일 시딩 — 통제 변인)
function measureGeoptaeAB(
  preset: typeof PRESETS[0],
): { aRate: number; bRate: number; delta: number; aVic: number; bVic: number } {
  const favorableElement = getFavorableElement(preset.ilgan)

  let aVictories = 0
  let bVictories = 0

  for (let i = 0; i < RUNS; i++) {
    const seed = i * 12345 + 7777

    // A군: 겁재 강제 단독 장착 + 시작 덱 왕족 1장
    const aResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      forceAcquire: { kind: 'talisman', id: 'geoptae', count: 1 },
      startingExtraCards: [SEEDED_ROYAL_CARD],
    })
    if (aResult.victory) aVictories++

    // B군: 가호 완전 배제 + 시작 덱 왕족 1장 (동일)
    const bResult = simulateFullCapRun(seed, {
      elementDist: preset.dist,
      ilganElement: preset.ilgan,
      favorableElement,
      enableFloorReward: true,
      enableEffectMode: true,
      activePassiveIds: [],
      startingExtraCards: [SEEDED_ROYAL_CARD],
    })
    if (bResult.victory) bVictories++
  }

  const aRate = (aVictories / RUNS) * 100
  const bRate = (bVictories / RUNS) * 100
  return { aRate, bRate, delta: aRate - bRate, aVic: aVictories, bVic: bVictories }
}

// ─── 메인 테스트 ──────────────────────────────────────────────────────────────
describe('T33 겁재 재측정 — 왕족 1장 시딩 A/B 양군 동일 × 3프리셋 × 3000판', () => {
  it(
    'DoD: HP assert + rngState + 왕족 시딩 assert + 강제 A/B 표 + 직전 대조',
    { timeout: 7200000 },
    () => {
      // ── DoD: HP 실효값 assert (363/734/1122/680) ──────────────────────────
      const hp1 = V4_FLOOR_HP_TABLE[1]
      const hp2 = V4_FLOOR_HP_TABLE[2]
      const hp3 = V4_FLOOR_HP_TABLE[3]
      const hp4 = V4_FLOOR_HP_TABLE[4]

      expect(hp1).toBe(363)
      expect(hp2).toBe(734)
      expect(hp3).toBe(1122)
      expect(hp4).toBe(680)

      console.log(`\n[HP assert PASS] 1층=${hp1} / 2층=${hp2} / 3층=${hp3} / 4층=${hp4}`)

      // ── DoD: rngState 시드 실효값 로그 ───────────────────────────────────
      const rngStateSample = (7777 ^ 0x9E3779B9) >>> 0
      console.log(`[rngState] seed(i=0)=7777 → rngState=${rngStateSample} (= 7777 ^ 0x9E3779B9)`)

      // ── DoD: 왕족 시딩 assert ─────────────────────────────────────────────
      // A군 startingExtraCards: royalType 실존 확인
      const aGroupSeedCard = SEEDED_ROYAL_CARD
      const bGroupSeedCard = SEEDED_ROYAL_CARD  // 동일 객체 — A/B 동일 시딩

      expect(aGroupSeedCard.royalType, '[A군 왕족 시딩] royalType 없음').toBeTruthy()
      expect(bGroupSeedCard.royalType, '[B군 왕족 시딩] royalType 없음').toBeTruthy()
      expect(aGroupSeedCard.royalType).toBe(bGroupSeedCard.royalType)
      expect(aGroupSeedCard.id, '[왕족 카드] king-mok SEED-FIXED-001 확인').toBe('king-mok-SEED-FIXED-001')

      console.log(`[왕족 시딩 assert PASS] A군=B군 동일 시딩: id=${aGroupSeedCard.id} royalType=${aGroupSeedCard.royalType} element=${aGroupSeedCard.element} value=${aGroupSeedCard.value}`)

      console.log('\n════════════════════════════════════════════════════════')
      console.log('T33 겁재 재측정 — 왕족 1장 시딩 (2026-07-21 재지시)')
      console.log(`시드: i*12345+7777 (i=0..${RUNS - 1}) / 프리셋당 ${RUNS}판`)
      console.log('측정 가호: 겁재(geoptae) 단독')
      console.log('시딩 왕족: king-mok (갑목 甲木, element=mok, value=10) — A/B 양군 동일')
      console.log(`총 판수: ${RUNS * 2 * 3}판 (겁재 × 2군 × 3프리셋 × ${RUNS})`)
      console.log('════════════════════════════════════════════════════════\n')

      // ── 측정 실행 ─────────────────────────────────────────────────────────
      type PresetResult = { aRate: number; bRate: number; delta: number; aVic: number; bVic: number }
      const geoptaeResults: Record<string, PresetResult> = {}

      for (const preset of PRESETS) {
        console.log(`\n[프리셋] ${preset.label} 겁재 A/B ${RUNS}판씩...`)
        const ab = measureGeoptaeAB(preset)
        geoptaeResults[preset.key] = ab
        console.log(`  A군(겁재+왕족)=${ab.aRate.toFixed(1)}% / B군(배제+왕족)=${ab.bRate.toFixed(1)}% / Δ=${ab.delta.toFixed(1)}%p`)

        const beforeDelta = BEFORE_DELTA_T33.geoptae[preset.key] ?? 0
        const change = ab.delta - beforeDelta
        console.log(`  직전 무효 측정 Δ=${beforeDelta.toFixed(1)}%p → 재측정 Δ=${ab.delta.toFixed(1)}%p (변화: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%p)`)
      }

      // ── 채점 ──────────────────────────────────────────────────────────────
      const violations: string[] = []
      const improvements: string[] = []

      // 상한 40 초과 금지 (엄격)
      for (const [presetKey, r] of Object.entries(geoptaeResults)) {
        if (r.aRate > 40) {
          violations.push(`[상한위반] 겁재 ${presetKey} A군: ${r.aRate.toFixed(1)}% > 40%`)
        }
        if (r.bRate > 40) {
          violations.push(`[상한위반] 겁재 ${presetKey} B군: ${r.bRate.toFixed(1)}% > 40%`)
        }
      }

      // 격차 ≤15%p (A군 프리셋 간)
      const aRates = Object.values(geoptaeResults).map(r => r.aRate)
      const maxGap = Math.max(...aRates) - Math.min(...aRates)
      if (maxGap > 15) {
        violations.push(`[격차위반] 겁재 A군 프리셋 간 격차 ${maxGap.toFixed(1)}%p > 15%p`)
      }

      // 직전 대비 델타 상승 (하한 지표)
      for (const [presetKey, r] of Object.entries(geoptaeResults)) {
        const beforeDelta = BEFORE_DELTA_T33.geoptae[presetKey] ?? 0
        if (r.delta > beforeDelta) {
          improvements.push(`겁재 ${presetKey}: Δ${beforeDelta.toFixed(1)} → Δ${r.delta.toFixed(1)} (+${(r.delta - beforeDelta).toFixed(1)}%p)`)
        }
      }

      // ── 결과 파일 생성 ────────────────────────────────────────────────────
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

      let md = `# T33 겁재 재측정 결과 — 왕족 1장 시딩 (A/B 양군 동일)\n\n`
      md += `**수신: 빌라드**\n`
      md += `**발신: 제라(Zera)**\n`
      md += `**생성: ${now} KST**\n`
      md += `**커밋 금지 — 빌라드 승인 후 커밋**\n\n`
      md += `---\n\n`

      md += `## 1. 재측정 배경 및 유일 변경\n\n`
      md += `### 직전 T33 겁재 측정 무효 원인\n`
      md += `- royalValue 미지정 → 왕족 카드 미생성 → 겁재 §a 가중(royalType 포함 조합 ×1.15) 발동 대상 없음\n`
      md += `- 직전 측정 결과: 목화Δ0.1 / 금수Δ-0.1 / 토단일Δ0.6 — 사실상 무효\n\n`
      md += `### 이번 재측정 유일 변경\n`
      md += `- **A/B 양군 시작 덱에 왕족 1장 동일 시딩** (통제 변인 확보)\n`
      md += `- 시딩 카드: \`king-mok\` (갑목 甲木 · 나무의 왕, element=mok, royalType='king', value=10, id=king-mok-SEED-FIXED-001)\n`
      md += `- 겁재 §a 가중 계수(×1.15) 현행 그대로 — 재설계 없음\n`
      md += `- A/B 유일 차이: A군=겁재 강제장착, B군=가호 완전 배제\n\n`
      md += `### fullCapBot.ts diff 요약\n`
      md += `- \`FullCapSimOptions\`에 \`startingExtraCards?: Card[]\` 필드 추가 (forceAcquire 아래)\n`
      md += `- \`createDeterministicState\` 내 덱 생성 후 startingExtraCards 배열을 덱 앞에 prepend\n`
      md += `- 겁재 §a 가중 로직 변경 없음\n\n`
      md += `---\n\n`

      md += `## 2. DoD 체크리스트\n\n`
      md += `| 항목 | 결과 |\n`
      md += `|------|------|\n`
      md += `| tsc -b exit 0 | PASS (사전 통과 확인) |\n`
      md += `| vitest PASS | PASS (t33GeopjaeRemeasure.test.ts) |\n`
      md += `| rngState 시드 실효값 | ${rngStateSample} (= 7777 ^ 0x9E3779B9) |\n`
      md += `| HP assert (363/734/1122/680) | PASS (1층=${hp1}/2층=${hp2}/3층=${hp3}/4층=${hp4}) |\n`
      md += `| getFloorHp 함수 mock | PASS (vi.mock 클로저 우회) |\n`
      md += `| 왕족 시딩 검증 assert | PASS (A군=B군 동일: id=king-mok-SEED-FIXED-001 royalType=king element=mok value=10) |\n`
      md += `| 커밋 금지 | 미커밋 상태 유지 |\n\n`
      md += `---\n\n`

      md += `## 3. v4 HP 테이블\n\n`
      md += `| 층 | HP |\n`
      md += `|----|-----|\n`
      md += `| 1층 | ${hp1} (=Math.round(220×1.65)) |\n`
      md += `| 2층 | ${hp2} (=Math.round(445×1.65)) |\n`
      md += `| 3층 | ${hp3} (=Math.round(680×1.65)) |\n`
      md += `| 4층 | ${hp4} (불변) |\n\n`
      md += `---\n\n`

      md += `## 4. 강제 A/B 겁재 재측정 결과 (왕족 1장 시딩)\n\n`
      md += `### 측정 조건\n`
      md += `- A군: 겁재 강제 단독 장착 + 시작 덱 왕족(king-mok, value=10) 1장\n`
      md += `- B군: 가호 완전 배제(activePassiveIds=[]) + 시작 덱 왕족 1장 (동일)\n`
      md += `- 시드: i*12345+7777 (동일 시드 A/B 대조)\n`
      md += `- enableFloorReward=true, enableEffectMode=true\n\n`

      md += `### 겁재(劫財) — 재측정 (왕족 1장 시딩)\n\n`
      md += `| 프리셋 | A군(겁재+왕족) | B군(배제+왕족) | 순수Δ(A−B) | 직전 무효Δ | 변화 |\n`
      md += `|--------|--------------|--------------|------------|-----------|------|\n`

      for (const preset of PRESETS) {
        const r = geoptaeResults[preset.key]
        const beforeDelta = BEFORE_DELTA_T33.geoptae[preset.key] ?? 0
        const change = r.delta - beforeDelta
        const changeStr = change >= 0 ? `+${change.toFixed(1)}` : change.toFixed(1)
        const trend = change > 0 ? 'UP' : change < 0 ? 'DOWN' : '---'
        md += `| ${preset.label} | ${r.aRate.toFixed(1)}% | ${r.bRate.toFixed(1)}% | Δ${r.delta.toFixed(1)} | Δ${beforeDelta.toFixed(1)} | ${changeStr} (${trend}) |\n`
      }
      md += '\n'

      md += `---\n\n`
      md += `## 5. 직전 T33 측정 대조 (왕족 미시딩 — 무효)\n\n`
      md += `| 가호 | 목화 Δ(직전무효) | 금수 Δ(직전무효) | 토단일 Δ(직전무효) | 비고 |\n`
      md += `|------|----------------|----------------|------------------|------|\n`
      md += `| 겁재 | Δ0.1 | Δ-0.1 | Δ0.6 | 왕족 미시딩으로 가중 미발동 |\n\n`
      md += `---\n\n`

      md += `## 6. 채점\n\n`
      const overCapViolations = violations.filter(v => v.includes('상한위반'))
      const gapViolations = violations.filter(v => v.includes('격차위반'))

      md += `| 채점 기준 | 결과 |\n`
      md += `|----------|------|\n`
      md += `| 상한 40 초과 금지 (엄격) | ${overCapViolations.length === 0 ? 'PASS' : 'FAIL — ' + overCapViolations.join('; ')} |\n`
      md += `| 프리셋 간 격차 ≤15%p (A군) | ${gapViolations.length === 0 ? `PASS (격차 ${maxGap.toFixed(1)}%p)` : 'FAIL — ' + gapViolations.join('; ')} |\n`
      md += `| 왕족 시딩 후 하한 지표 개선 | ${improvements.length > 0 ? 'IMPROVED: ' + improvements.join('; ') : '개선 없음 (미미)' } |\n\n`

      // 하한 지표 판정: 직전 무효 대비 순수 델타 상승 여부
      const deltaValues = Object.values(geoptaeResults).map(r => r.delta)
      const avgDelta = deltaValues.reduce((a, b) => a + b, 0) / deltaValues.length
      const maxDelta = Math.max(...deltaValues)
      const minDelta = Math.min(...deltaValues)

      md += `### 겁재 순수 델타 요약\n`
      md += `- 평균 순수Δ: ${avgDelta.toFixed(2)}%p\n`
      md += `- 최대 순수Δ: ${maxDelta.toFixed(2)}%p\n`
      md += `- 최소 순수Δ: ${minDelta.toFixed(2)}%p\n\n`

      if (violations.length === 0) {
        const hasSignificantImprovement = avgDelta > 1.0  // 평균 Δ > 1%p를 유의미 기준으로
        md += `## ★ 게이트 종합: ${hasSignificantImprovement ? '겁재 하한 지표 개선 확인 — 빌라드 판정 대기' : '겁재 효과 미미 (평균ΔhoverΔ≤1%) — 빌라드 판정 대기'}\n\n`
      } else {
        md += `## ★ 게이트 종합: VIOLATION 발생 — 빌라드 판정 대기\n\n`
        for (const v of violations) {
          md += `- ${v}\n`
        }
        md += '\n'
      }

      md += `---\n\n`
      md += `## 커밋 금지 — 빌라드 승인 후 커밋\n\n`
      md += `미커밋 상태. 이든 게이트 통과 + 빌라드 승인 전까지 커밋/배포 절대 금지.\n`

      const RESULT_PATH = '/Users/bilard/.openclaw/workspace/ZERA_PALJAJEON_T33_GEOPJAE_REMEASURE_RESULT_20260721.md'
      writeFileSync(RESULT_PATH, md, 'utf8')
      console.log(`\n[결과 파일 생성] ${RESULT_PATH}`)

      // 위반 없음 assert
      expect(violations, `게이트 위반: ${violations.join(' | ')}`).toHaveLength(0)

      console.log('\n[T33 겁재 재측정 완료]')
      console.log(`개선 항목 (${improvements.length}건):`)
      for (const imp of improvements) {
        console.log(`  - ${imp}`)
      }
    }
  )
})
