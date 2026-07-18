/**
 * 배치 1.5-A-1 검증 — recipe 모드 구 v3 판정 참조 제거
 *
 * 버그: recipe 모드에서 2장 융합·잡탕(2원소 비레시피)이 v3 isFusionCombo 경로로
 *       fusion-birth 판정되어 대응축 +120%(옹기가마 CONDENSE_MATRIX) / 양자택일 효과 버튼 노출.
 *
 * 수정: pokerHandJudge judgeCombo — v3 융합 판정을 ruleset==='v3'에서만 실행.
 *       paljajeonEngine getCondenseAvailability — recipe 모드 null 반환.
 *
 * 필수 케이스 3종 (이든 지시):
 *   1. 2장 효과 버튼 부재  → 화1토1 = type 'none'(일반기), fusion-birth 아님
 *   2. 잡탕 3장 일반기      → 화2토1(비레시피) = type 'none'(일반기)
 *   3. 촉매 2장 소형 불성립 → 촉매2+연료2 = 소형/대형 모두 불성립 → 일반기
 */
import { describe, it, expect, vi } from 'vitest'

// COMBO_RULESET_VERSION='recipe' 오버라이드 (vi.mock 최상단 필수)
vi.mock('../engine/balance', async (importActual) => {
  const actual = await importActual<typeof import('../engine/balance')>()
  return { ...(actual as Record<string, unknown>), COMBO_RULESET_VERSION: 'recipe' as const }
})

const { judgeCombo } = await import('../engine/pokerHandJudge')
const { getCondenseAvailability } = await import('../engine/paljajeonEngine')

type El = 'mok' | 'hwa' | 'to' | 'geum' | 'su'
let uid = 0
function card(element: El, value = 5, polarity: 'yang' | 'yin' = 'yang') {
  return { id: `c${uid++}`, element, value, polarity, name: `${element}${value}` } as any
}

describe('배치 1.5-A-1: recipe 모드 v3 판정 참조 제거', () => {
  it('필수①: 2장 융합(화1토1)은 일반기 — fusion-birth 아님, 대응축 없음', () => {
    const cards = [card('hwa'), card('to')]
    const r = judgeCombo(cards)
    expect(r.type).toBe('none') // 양자택일 효과 버튼 조건(fusion-birth) 불성립
    expect(r.type).not.toBe('fusion-birth')
    // 대응축(옹기가마 응축) 경로 봉쇄
    expect(getCondenseAvailability(r.name ?? '', r.finishingElement)).toBeNull()
  })

  it('필수②: 잡탕 3장(화2토1, 비레시피)은 일반기 — v3 옹기가마 fusion-birth로 새지 않음', () => {
    const cards = [card('hwa'), card('hwa'), card('to')]
    const r = judgeCombo(cards)
    // 화2토1: 촉매(화)=2,연료(토)=1 → 소형(촉매1)·대형(연료3) 모두 불성립 → 일반기
    expect(r.type).toBe('none')
    expect(getCondenseAvailability(r.name ?? '', r.finishingElement)).toBeNull()
  })

  it('필수③: 촉매 2장+연료 2장은 소형/대형 모두 불성립 → 일반기', () => {
    // 옹기가마 촉매=화(elem1), 연료=토(elem2). 촉매2+연료2: isSmall(촉매1) ✗, isLarge(연료3) ✗
    const cards = [card('hwa'), card('hwa'), card('to'), card('to')]
    const r = judgeCombo(cards)
    expect(r.type).toBe('none')
  })

  it('대조: 소형 성립(3장 촉매1+연료2)은 정상 레시피 판정 유지', () => {
    // 숲(fusion_forest): 촉매 수1(elem1) + 연료 목2(elem2) = 3장 isSmall 성립
    const cards = [card('su'), card('mok'), card('mok')]
    const r = judgeCombo(cards)
    expect(r.type === 'fusion-birth' || r.type === 'fusion-hone').toBe(true)
    expect(r.multiplier).toBeGreaterThan(1)
  })

  it('대조: gather5(같은 기운 5장)는 recipe 위계 유지 (일반기로 안 새림)', () => {
    const cards = [card('su'), card('su'), card('su'), card('su'), card('su')]
    const r = judgeCombo(cards)
    expect(r.type).toBe('gather')
  })
})
