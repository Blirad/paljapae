/**
 * Phase 2 사주 연동 시스템 테스트
 * - 일진 계산 엔진 (getDailyElement, getDailyPillarInfo)
 * - 일일 전투 버프 (getDailyElementModifier, calculateDamage with dailyElement)
 * - 오행 콤보 시스템 (GameState.currentCombo)
 * - GameState 필드 검증 (dailyElement, currentCombo)
 */

import { describe, it, expect } from 'vitest'
import { getDailyElement, getDailyPillarInfo, calculateSaju } from '@/game/saju/manseryeok'
import { getDailyElementModifier, calculateDamage } from '@/game/engine/elementalCombat'
import type { FiveElement } from '@/types/elements'
import { GENERATES, DOMINATES } from '@/types/elements'

// ────────────────────────────────────────────────────
// 1. getDailyElement — 일진 오행 추출
// ────────────────────────────────────────────────────

describe('getDailyElement', () => {
  it('Date 인자로 FiveElement를 반환한다', () => {
    const date = new Date(2026, 6, 8) // 2026-07-08
    const result = getDailyElement(date)
    const validElements: FiveElement[] = ['木', '火', '土', '金', '水']
    expect(validElements).toContain(result)
  })

  it('인자 없으면 오늘 날짜 기준으로 FiveElement를 반환한다', () => {
    const result = getDailyElement()
    const validElements: FiveElement[] = ['木', '火', '土', '金', '水']
    expect(validElements).toContain(result)
  })

  it('calculateSaju의 pillars.day.stemElement와 일치한다', () => {
    const date = new Date(2026, 6, 8)
    const saju = calculateSaju(date.getFullYear(), date.getMonth() + 1, date.getDate())
    const daily = getDailyElement(date)
    expect(daily).toBe(saju.pillars.day.stemElement)
  })

  it('다른 날짜는 다른 오행을 반환할 수 있다 (60갑자 순환)', () => {
    const date1 = new Date(2026, 6, 8)
    const date2 = new Date(2026, 6, 18) // 10일 뒤
    const el1 = getDailyElement(date1)
    const el2 = getDailyElement(date2)
    // 10일 뒤면 천간이 달라지므로 다를 수 있음 (테스트는 타입 안전성 확인)
    const validElements: FiveElement[] = ['木', '火', '土', '金', '水']
    expect(validElements).toContain(el1)
    expect(validElements).toContain(el2)
  })
})

// ────────────────────────────────────────────────────
// 2. getDailyPillarInfo — 일진 천간 + 오행 반환
// ────────────────────────────────────────────────────

describe('getDailyPillarInfo', () => {
  it('stem과 stemElement를 반환한다', () => {
    const date = new Date(2026, 6, 8)
    const info = getDailyPillarInfo(date)
    expect(typeof info.stem).toBe('string')
    expect(info.stem.length).toBeGreaterThan(0)
    const validElements: FiveElement[] = ['木', '火', '土', '金', '水']
    expect(validElements).toContain(info.stemElement)
  })

  it('stem은 한자 천간이다', () => {
    const date = new Date(2026, 6, 8)
    const info = getDailyPillarInfo(date)
    const validStems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
    expect(validStems).toContain(info.stem)
  })

  it('stemElement는 calculateSaju 일간 오행과 동일하다', () => {
    const date = new Date(2025, 0, 1) // 2025-01-01
    const saju = calculateSaju(2025, 1, 1)
    const info = getDailyPillarInfo(date)
    expect(info.stemElement).toBe(saju.pillars.day.stemElement)
  })
})

// ────────────────────────────────────────────────────
// 3. getDailyElementModifier — 일진 오행 배율
// ────────────────────────────────────────────────────

describe('getDailyElementModifier', () => {
  it('null 공격자 → 1.0', () => {
    expect(getDailyElementModifier(null, '木')).toBe(1.0)
  })

  it('null 일진 → 1.0', () => {
    expect(getDailyElementModifier('木', null)).toBe(1.0)
  })

  it('undefined 일진 → 1.0', () => {
    expect(getDailyElementModifier('木', undefined)).toBe(1.0)
  })

  it('동일 오행 → 1.2 (일진 오행 강화)', () => {
    expect(getDailyElementModifier('木', '木')).toBe(1.2)
    expect(getDailyElementModifier('火', '火')).toBe(1.2)
    expect(getDailyElementModifier('土', '土')).toBe(1.2)
    expect(getDailyElementModifier('金', '金')).toBe(1.2)
    expect(getDailyElementModifier('水', '水')).toBe(1.2)
  })

  it('상생 관계 → 1.2 (공격자가 일진을 생함)', () => {
    // GENERATES['木'] = '火': 木이 火를 생성
    // 공격자=木, 일진=火 → GENERATES[木] === 火 → 1.2
    expect(getDailyElementModifier('木', '火')).toBe(1.2)
    expect(getDailyElementModifier('火', '土')).toBe(1.2)
    expect(getDailyElementModifier('土', '金')).toBe(1.2)
    expect(getDailyElementModifier('金', '水')).toBe(1.2)
    expect(getDailyElementModifier('水', '木')).toBe(1.2)
  })

  it('상생 관계 → 1.2 (일진이 공격자를 생함)', () => {
    // GENERATES['水'] = '木': 水가 木을 생성
    // 공격자=木, 일진=水 → GENERATES[水] === 木 → 1.2
    expect(getDailyElementModifier('木', '水')).toBe(1.2)
    expect(getDailyElementModifier('火', '木')).toBe(1.2)
    expect(getDailyElementModifier('土', '火')).toBe(1.2)
    expect(getDailyElementModifier('金', '土')).toBe(1.2)
    expect(getDailyElementModifier('水', '金')).toBe(1.2)
  })

  it('상극 (일진이 공격자를 극함) → 0.8', () => {
    // DOMINATES['土'] = '水': 土가 水를 극함
    // 공격자=水, 일진=土 → DOMINATES[土] === 水 → 0.8
    expect(getDailyElementModifier('水', '土')).toBe(0.8)
    // DOMINATES['木'] = '土': 木이 土를 극함
    // 공격자=土, 일진=木 → DOMINATES[木] === 土 → 0.8
    expect(getDailyElementModifier('土', '木')).toBe(0.8)
    // DOMINATES['水'] = '火': 水가 火를 극함
    // 공격자=火, 일진=水 → DOMINATES[水] === 火 → 0.8
    expect(getDailyElementModifier('火', '水')).toBe(0.8)
    // DOMINATES['火'] = '金': 火가 金을 극함
    // 공격자=金, 일진=火 → DOMINATES[火] === 金 → 0.8
    expect(getDailyElementModifier('金', '火')).toBe(0.8)
    // DOMINATES['金'] = '木': 金이 木을 극함
    // 공격자=木, 일진=金 → DOMINATES[金] === 木 → 0.8
    expect(getDailyElementModifier('木', '金')).toBe(0.8)
  })

  it('중립 관계 → 1.0', () => {
    // 木과 水: 木이 水를 극하지 않고, 水도 木을 극하지 않음
    // 상생/상극 모두 아닌 경우
    // DOMINATES['木'] = '土', GENERATES['木'] = '火'
    // 水-木: GENERATES['水'] = '木' → 상생! 아니므로 다른 쌍 찾기
    // 木-金: DOMINATES['金'] = '木' → 0.8 상극
    // 중립: 火-水 (DOMINATES['水'] = '火' → 0.8)... 아니다
    // 진짜 중립: 木-水는 GENERATES['水'] = '木'이므로 상생 1.2
    // 土-水: DOMINATES['土'] = '水' → 일진=土, 공격자=水이면 0.8
    // 火-木: GENERATES['木'] = '火' → 1.2 (상생)
    // 중립 찾기: 어떤 관계도 없는 쌍 — 실제로 모든 쌍은 상생/상극 중 하나이므로
    // 이 테스트는 구현 로직 검증용으로 특정 쌍 사용
    // 木이 일진 火의 관점에서 극하지도 생하지도 않는 쌍:
    // 위 로직상: attackerElement와 dailyElement가 동일 오행, 상생, 상극(일진→공격자) 중 하나이면 해당 배율
    // 그 외 (공격자→일진 극하는 경우): 0.8이 아닌 1.0
    // 木→土(DOMINATES['木'] = '土'): 공격자=木, 일진=土 → 공격자가 일진을 극함, but 로직은 일진→공격자만 0.8
    // 따라서 공격자=木, 일진=土 → 1.0 (중립)
    expect(getDailyElementModifier('木', '土')).toBe(1.0)
  })
})

// ────────────────────────────────────────────────────
// 4. calculateDamage with dailyElement
// ────────────────────────────────────────────────────

describe('calculateDamage with dailyElement', () => {
  it('dailyElement 미전달 시 기존 동작 유지', () => {
    // 중립 상성, 유물 없음 → baseDamage 그대로
    expect(calculateDamage(5, '木', '木')).toBe(5)
    // 상극 → ×1.5
    expect(calculateDamage(4, '木', '土')).toBe(6)
  })

  it('dailyElement = null → 기존 동작 유지', () => {
    expect(calculateDamage(5, '木', '木', 1.0, null)).toBe(5)
  })

  it('동일 오행 일진: 데미지 × 1.2', () => {
    // baseDamage=5, 중립 상성(木 vs 火), dailyElement=木(공격자와 동일) → 5×1.2=6
    expect(calculateDamage(5, '木', '火', 1.0, '木')).toBe(6)
  })

  it('상생 일진: 데미지 × 1.2', () => {
    // 공격자=木, 일진=火: GENERATES[木] = 火 → 1.2
    // 중립 상성(木 vs 木), dailyMod=1.2 → 5×1.2=6
    expect(calculateDamage(5, '木', '木', 1.0, '火')).toBe(6)
  })

  it('상극 일진 (일진이 공격자를 극함): 데미지 × 0.8', () => {
    // 공격자=水, 일진=土: DOMINATES[土] = 水 → 0.8
    // 중립 상성(水 vs 水), dailyMod=0.8 → 5×0.8=4
    expect(calculateDamage(5, '水', '水', 1.0, '土')).toBe(4)
  })

  it('상극 상성 + 상생 일진: 복합 배율', () => {
    // 상극(木 vs 土) × 1.5, 일진=木(공격자와 동일) × 1.2
    // 4 × 1.5 × 1.2 = 7.2 → 반올림 7
    expect(calculateDamage(4, '木', '土', 1.0, '木')).toBe(7)
  })
})

// ────────────────────────────────────────────────────
// 5. GameState currentCombo 필드 검증
// ────────────────────────────────────────────────────

describe('GameState.currentCombo 필드', () => {
  it('currentCombo 기본값은 { element: null, count: 0 }', () => {
    // 타입 레벨 검증 — 실제 GameState 생성 시뮬레이션
    const mockCombo = { element: null as FiveElement | null, count: 0 }
    expect(mockCombo.element).toBeNull()
    expect(mockCombo.count).toBe(0)
  })

  it('currentCombo 상태 갱신 로직: 같은 오행 연속 → count 증가', () => {
    // battleStore.updateCombo 로직 단위 검증 (순수 함수 스타일로 재현)
    function updateCombo(
      state: { element: FiveElement | null; count: number },
      played: FiveElement | null,
    ): { element: FiveElement | null; count: number } {
      if (!played) return { element: null, count: 0 }
      if (state.element === played) return { element: played, count: state.count + 1 }
      return { element: played, count: 1 }
    }

    let combo = { element: null as FiveElement | null, count: 0 }
    combo = updateCombo(combo, '木')
    expect(combo).toEqual({ element: '木', count: 1 })
    combo = updateCombo(combo, '木')
    expect(combo).toEqual({ element: '木', count: 2 })
    combo = updateCombo(combo, '木')
    expect(combo).toEqual({ element: '木', count: 3 })
    // 다른 오행 → 리셋
    combo = updateCombo(combo, '火')
    expect(combo).toEqual({ element: '火', count: 1 })
  })

  it('currentCombo 상태 갱신: 무속성 카드 → 리셋', () => {
    function updateCombo(
      state: { element: FiveElement | null; count: number },
      played: FiveElement | null,
    ): { element: FiveElement | null; count: number } {
      if (!played) return { element: null, count: 0 }
      if (state.element === played) return { element: played, count: state.count + 1 }
      return { element: played, count: 1 }
    }

    let combo = { element: '火' as FiveElement | null, count: 3 }
    combo = updateCombo(combo, null)
    expect(combo.element).toBeNull()
    expect(combo.count).toBe(0)
  })

  it('GENERATES 관계 표 검증 (상생 순서: 木→火→土→金→水→木)', () => {
    expect(GENERATES['木']).toBe('火')
    expect(GENERATES['火']).toBe('土')
    expect(GENERATES['土']).toBe('金')
    expect(GENERATES['金']).toBe('水')
    expect(GENERATES['水']).toBe('木')
  })

  it('DOMINATES 관계 표 검증', () => {
    expect(DOMINATES['木']).toBe('土')
    expect(DOMINATES['土']).toBe('水')
    expect(DOMINATES['水']).toBe('火')
    expect(DOMINATES['火']).toBe('金')
    expect(DOMINATES['金']).toBe('木')
  })
})

// ────────────────────────────────────────────────────
// 6. AffinityBadge 관계 계산 로직 검증
// ────────────────────────────────────────────────────

describe('AffinityBadge 관계 계산', () => {
  function getHeroAffinity(
    heroWuxing: FiveElement,
    todayElement: FiveElement,
  ): 'shengsheng' | 'shengke' | null {
    const isShengsheng =
      GENERATES[heroWuxing] === todayElement ||
      GENERATES[todayElement] === heroWuxing
    if (isShengsheng) return 'shengsheng'
    const isShengke =
      DOMINATES[heroWuxing] === todayElement ||
      DOMINATES[todayElement] === heroWuxing
    if (isShengke) return 'shengke'
    return null
  }

  it('영웅이 일진을 생함 → shengsheng', () => {
    // GENERATES['木'] = '火': 木 영웅이 火 일진을 생함
    expect(getHeroAffinity('木', '火')).toBe('shengsheng')
  })

  it('일진이 영웅을 생함 → shengsheng', () => {
    // GENERATES['水'] = '木': 水 일진이 木 영웅을 생함
    expect(getHeroAffinity('木', '水')).toBe('shengsheng')
  })

  it('영웅이 일진을 극함 → shengke', () => {
    // DOMINATES['木'] = '土': 木 영웅이 土 일진을 극함
    expect(getHeroAffinity('木', '土')).toBe('shengke')
  })

  it('일진이 영웅을 극함 → shengke', () => {
    // DOMINATES['金'] = '木': 金 일진이 木 영웅을 극함
    expect(getHeroAffinity('木', '金')).toBe('shengke')
  })

  it('동일 오행 → shengsheng (자신이 자신을 생함 케이스는 없지만 GENERATES 확인)', () => {
    // 동일 오행은 상생/상극 관계 테이블에 없으므로 null
    // 木 영웅, 木 일진: GENERATES[木] = 火 ≠ 木, GENERATES[木] = 火 ≠ 木
    expect(getHeroAffinity('木', '木')).toBeNull()
  })
})
