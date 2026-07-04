/**
 * M5 신규 기능 테스트
 *
 * 커버리지:
 *   - advantage.ts: 상성 계산 (getAdvantageRelation)
 *   - persistence.ts: M5 추가 함수 (saveHeroState, loadHeroState, relativeTime, hasSaveData)
 *   - App.tsx scene 분기 로직 (getInitialScene과 동등한 조건 검증)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getAdvantageRelation, getAdvantageText } from '../utils/advantage'
import {
  saveHeroState,
  loadHeroState,
  relativeTime,
  hasSaveData,
  savePlayerElement,
  saveClearedStageIds,
  clearAllProgress,
} from '../utils/persistence'
import type { FiveElement } from '../types/elements'

// ─── localStorage mock ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// ─── advantage.ts 테스트 ─────────────────────────────────────────────────────

describe('getAdvantageRelation', () => {
  it('木克土: 플레이어 木 vs AI 土 → advantage', () => {
    expect(getAdvantageRelation('木', '土')).toBe('advantage')
  })

  it('土克水: 플레이어 土 vs AI 水 → advantage', () => {
    expect(getAdvantageRelation('土', '水')).toBe('advantage')
  })

  it('水克火: 플레이어 水 vs AI 火 → advantage', () => {
    expect(getAdvantageRelation('水', '火')).toBe('advantage')
  })

  it('火克金: 플레이어 火 vs AI 金 → advantage', () => {
    expect(getAdvantageRelation('火', '金')).toBe('advantage')
  })

  it('金克木: 플레이어 金 vs AI 木 → advantage', () => {
    expect(getAdvantageRelation('金', '木')).toBe('advantage')
  })

  it('반대: 플레이어 土 vs AI 木 → disadvantage (木克土)', () => {
    expect(getAdvantageRelation('土', '木')).toBe('disadvantage')
  })

  it('반대: 플레이어 水 vs AI 土 → disadvantage (土克水)', () => {
    expect(getAdvantageRelation('水', '土')).toBe('disadvantage')
  })

  it('반대: 플레이어 火 vs AI 水 → disadvantage (水克火)', () => {
    expect(getAdvantageRelation('火', '水')).toBe('disadvantage')
  })

  it('반대: 플레이어 金 vs AI 火 → disadvantage (火克金)', () => {
    expect(getAdvantageRelation('金', '火')).toBe('disadvantage')
  })

  it('반대: 플레이어 木 vs AI 金 → disadvantage (金克木)', () => {
    expect(getAdvantageRelation('木', '金')).toBe('disadvantage')
  })

  it('중립: 플레이어 木 vs AI 火 → neutral', () => {
    expect(getAdvantageRelation('木', '火')).toBe('neutral')
  })

  it('중립: 플레이어 火 vs AI 土 → neutral', () => {
    expect(getAdvantageRelation('火', '土')).toBe('neutral')
  })

  it('중립: 동일 오행 木 vs 木 → neutral', () => {
    expect(getAdvantageRelation('木', '木')).toBe('neutral')
  })

  it('중립: 동일 오행 水 vs 水 → neutral', () => {
    expect(getAdvantageRelation('水', '水')).toBe('neutral')
  })
})

describe('getAdvantageText', () => {
  it('advantage 시 유리 텍스트 포함', () => {
    const text = getAdvantageText('木', '土')
    expect(text).toContain('유리')
  })

  it('disadvantage 시 전략 텍스트 포함', () => {
    const text = getAdvantageText('土', '木')
    expect(text).toContain('전략')
  })

  it('neutral 시 중립 텍스트 포함', () => {
    const text = getAdvantageText('木', '火')
    expect(text).toContain('중립')
  })
})

// ─── persistence.ts M5 테스트 ────────────────────────────────────────────────

describe('saveHeroState / loadHeroState', () => {
  beforeEach(() => localStorageMock.clear())

  it('저장 후 복원 정상', () => {
    saveHeroState(25, 30, '화염검객')
    const loaded = loadHeroState()
    expect(loaded).not.toBeNull()
    expect(loaded!.hp).toBe(25)
    expect(loaded!.maxHp).toBe(30)
    expect(loaded!.name).toBe('화염검객')
  })

  it('hp=0 저장 시 복원값은 1 (에러 핸들링)', () => {
    saveHeroState(0, 30, '화염검객')
    const loaded = loadHeroState()
    expect(loaded!.hp).toBe(1)
  })

  it('데이터 없으면 null 반환', () => {
    expect(loadHeroState()).toBeNull()
  })

  it('name 미저장 시 null 반환', () => {
    localStorage.setItem('paljapae_hero_hp', '25')
    localStorage.setItem('paljapae_hero_max_hp', '30')
    // name 없음
    expect(loadHeroState()).toBeNull()
  })
})

describe('relativeTime', () => {
  it('30초 전 → 방금 전', () => {
    expect(relativeTime(Date.now() - 30000)).toBe('방금 전')
  })

  it('5분 전 → 5분 전', () => {
    expect(relativeTime(Date.now() - 5 * 60 * 1000)).toBe('5분 전')
  })

  it('59분 전 → 59분 전', () => {
    expect(relativeTime(Date.now() - 59 * 60 * 1000)).toBe('59분 전')
  })

  it('2시간 전 → 날짜 형식', () => {
    const twoHoursAgo = Date.now() - 2 * 3600000
    const result = relativeTime(twoHoursAgo)
    // 날짜 형식 포함 여부 (연도 또는 월 포함)
    expect(result).toMatch(/\d{4}|\d{1,2}/)
  })
})

describe('hasSaveData', () => {
  beforeEach(() => localStorageMock.clear())

  it('데이터 없으면 false', () => {
    expect(hasSaveData()).toBe(false)
  })

  it('element만 있으면 false', () => {
    savePlayerElement('火')
    expect(hasSaveData()).toBe(false)
  })

  it('element + clearedStages 모두 있으면 true', () => {
    savePlayerElement('火')
    saveClearedStageIds([1, 2])
    expect(hasSaveData()).toBe(true)
  })

  it('clearAllProgress 후 false', () => {
    savePlayerElement('火')
    saveClearedStageIds([1])
    saveHeroState(28, 30, '화염검객')
    clearAllProgress()
    expect(hasSaveData()).toBe(false)
  })
})

// ─── 상성 전수 검증 (5×5 = 25 케이스) ─────────────────────────────────────

describe('getAdvantageRelation 전수 검증 (5×5)', () => {
  const elements: FiveElement[] = ['木', '火', '土', '金', '水']

  // 상극 관계 정의
  const advantages: Array<[FiveElement, FiveElement]> = [
    ['木', '土'],
    ['土', '水'],
    ['水', '火'],
    ['火', '金'],
    ['金', '木'],
  ]

  elements.forEach(playerEl => {
    elements.forEach(aiEl => {
      it(`${playerEl} vs ${aiEl}`, () => {
        const result = getAdvantageRelation(playerEl, aiEl)
        const isAdv = advantages.some(([p, a]) => p === playerEl && a === aiEl)
        const isDisadv = advantages.some(([p, a]) => p === aiEl && a === playerEl)
        if (isAdv) expect(result).toBe('advantage')
        else if (isDisadv) expect(result).toBe('disadvantage')
        else expect(result).toBe('neutral')
      })
    })
  })
})
