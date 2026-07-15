/**
 * T13: selectTalismanBySaju 유닛 테스트 5건
 *
 * 사주별 최적 가호 2종 선택 검증
 * 실행: npm test -- src/test/t13TalismanBySaju.test.ts
 */

import { describe, it, expect } from 'vitest'
import { selectTalismanBySaju } from '../engine/fullCapBot'
import type { Element } from '../types/game'

// 오행 분포 헬퍼: 특정 원소에 집중된 분포 생성
function makeDist(dominant: Element, value = 8): Record<Element, number> {
  const base: Record<Element, number> = { mok: 1, hwa: 1, to: 1, geum: 1, su: 1 }
  base[dominant] = value
  return base
}

describe('T13: selectTalismanBySaju — 사주별 가호 선택', () => {

  it('목(木) 집중 사주 → geoptae(겁재) 반드시 포함', () => {
    // 겁재: 목 포함 첫 공격 +30% — 목 비율 가중치 최대
    const dist = makeDist('mok', 10)
    const result = selectTalismanBySaju(dist)
    expect(result).toHaveLength(2)
    expect(result).toContain('geoptae')
  })

  it('화(火) 집중 사주 → sanggwan(상관) 반드시 포함', () => {
    // 상관: 화 2장 이상 ×1.5 — 화 비율 가중치 최대
    const dist = makeDist('hwa', 10)
    const result = selectTalismanBySaju(dist)
    expect(result).toHaveLength(2)
    expect(result).toContain('sanggwan')
  })

  it('토(土) 집중 사주 → pyeonin(편인) 반드시 포함', () => {
    // 편인: 토 모으기 마지막 공격 +50% — 토 비율 가중치 최대
    const dist = makeDist('to', 10)
    const result = selectTalismanBySaju(dist)
    expect(result).toHaveLength(2)
    expect(result).toContain('pyeonin')
  })

  it('수(水) 집중 사주 → jeongjae(정재) 반드시 포함', () => {
    // 정재: 수 포함 연환 배율 +2 — 수 비율 가중치 최대
    const dist = makeDist('su', 10)
    const result = selectTalismanBySaju(dist)
    expect(result).toHaveLength(2)
    expect(result).toContain('jeongjae')
  })

  it('균등 분포 사주 → 상위 2종 반환 (sikshin, bigyeon 포함 가능)', () => {
    // 균등 분포: 각 원소 20% → sikshin(범용 18점) vs 원소계수×0.2 점수 비교
    const dist: Record<Element, number> = { mok: 4, hwa: 4, to: 4, geum: 4, su: 4 }
    const result = selectTalismanBySaju(dist)
    expect(result).toHaveLength(2)
    // 2개 다 유효한 가호 id여야 함
    const validIds = ['sikshin', 'bigyeon', 'geoptae', 'sanggwan', 'pyeonjae', 'jeongjae', 'pyeonin']
    for (const id of result) {
      expect(validIds).toContain(id)
    }
    // 중복 없어야 함
    expect(new Set(result).size).toBe(2)
  })

})
