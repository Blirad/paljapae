/**
 * 운명카드전 영웅 시스템 테스트
 * Phase 1 — HeroData, heroStore, ALL_HEROES 검증
 */

import { describe, it, expect } from 'vitest'
import {
  ALL_HEROES,
  HEROES_BY_WUXING,
  getHeroById,
} from '@/data/heroes'
import { HERO_CARDS } from '@/data/heroCards'
import { ALL_CARDS } from '@/data/cards'
import { STEM_META } from '@/types/hero'

// ────────────────────────────────────────────────────
// 1. 전체 영웅 수 검증
// ────────────────────────────────────────────────────

describe('전체 영웅 수 (20명)', () => {
  it('ALL_HEROES가 정확히 20명을 포함', () => {
    expect(ALL_HEROES.length).toBe(20)
  })

  it('각 천간(10개) × 성별(2) = 20명 구성 확인', () => {
    const stemKeys = Object.keys(STEM_META)
    expect(stemKeys.length).toBe(10)

    const maleCnt = ALL_HEROES.filter(h => h.gender === 'male').length
    const femaleCnt = ALL_HEROES.filter(h => h.gender === 'female').length
    expect(maleCnt).toBe(10)
    expect(femaleCnt).toBe(10)
  })
})

// ────────────────────────────────────────────────────
// 2. 영웅 ID 고유성
// ────────────────────────────────────────────────────

describe('영웅 ID 고유성', () => {
  it('모든 영웅 ID가 고유하다', () => {
    const ids = ALL_HEROES.map(h => h.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ALL_HEROES.length)
  })

  it('영웅 ID 형식: stem_gender', () => {
    for (const hero of ALL_HEROES) {
      expect(hero.id).toMatch(/^[a-z]+_(male|female)$/)
    }
  })
})

// ────────────────────────────────────────────────────
// 3. 오행별 영웅 풀
// ────────────────────────────────────────────────────

describe('오행별 영웅 풀 (HEROES_BY_WUXING)', () => {
  it('각 오행별로 정확히 4명', () => {
    const wuxings = ['木', '火', '土', '金', '水'] as const
    for (const wx of wuxings) {
      expect(HEROES_BY_WUXING[wx].length).toBe(4)
    }
  })

  it('오행이 올바르게 매핑됨', () => {
    expect(HEROES_BY_WUXING['木'].every(h => h.wuxing === '木')).toBe(true)
    expect(HEROES_BY_WUXING['火'].every(h => h.wuxing === '火')).toBe(true)
    expect(HEROES_BY_WUXING['土'].every(h => h.wuxing === '土')).toBe(true)
    expect(HEROES_BY_WUXING['金'].every(h => h.wuxing === '金')).toBe(true)
    expect(HEROES_BY_WUXING['水'].every(h => h.wuxing === '水')).toBe(true)
  })
})

// ────────────────────────────────────────────────────
// 4. HeroData 필드 완전성
// ────────────────────────────────────────────────────

describe('HeroData 필드 완전성', () => {
  it('모든 영웅이 필수 필드를 보유', () => {
    for (const hero of ALL_HEROES) {
      expect(hero.id).toBeTruthy()
      expect(hero.stem).toBeTruthy()
      expect(hero.gender === 'male' || hero.gender === 'female').toBe(true)
      expect(hero.name).toBeTruthy()
      expect(['木', '火', '土', '金', '水']).toContain(hero.wuxing)
      expect(hero.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(hero.baseHP).toBeGreaterThan(0)
      expect(hero.baseEnergy).toBeGreaterThan(0)
      expect(hero.description).toBeTruthy()
    }
  })

  it('baseHP 범위: 24 ~ 35', () => {
    for (const hero of ALL_HEROES) {
      expect(hero.baseHP).toBeGreaterThanOrEqual(24)
      expect(hero.baseHP).toBeLessThanOrEqual(35)
    }
  })

  it('baseEnergy 범위: 3 ~ 5', () => {
    for (const hero of ALL_HEROES) {
      expect(hero.baseEnergy).toBeGreaterThanOrEqual(3)
      expect(hero.baseEnergy).toBeLessThanOrEqual(5)
    }
  })
})

// ────────────────────────────────────────────────────
// 5. getHeroById 함수
// ────────────────────────────────────────────────────

describe('getHeroById 함수', () => {
  it('존재하는 ID로 조회 시 영웅 반환', () => {
    const hero = getHeroById('jiamuk_male')
    expect(hero).toBeDefined()
    expect(hero?.id).toBe('jiamuk_male')
    expect(hero?.wuxing).toBe('木')
  })

  it('존재하지 않는 ID로 조회 시 undefined 반환', () => {
    const hero = getHeroById('nonexistent_hero')
    expect(hero).toBeUndefined()
  })

  it('이미지가 있는 영웅들이 올바른 imagePath를 보유', () => {
    const jiamukMale = getHeroById('jiamuk_male')
    expect(jiamukMale?.imagePath).toBeDefined()
    expect(jiamukMale?.imagePath).toContain('jiamuk_male')

    const yimukFemale = getHeroById('yimuk_female')
    expect(yimukFemale?.imagePath).toBeDefined()
    expect(yimukFemale?.imagePath).toContain('yimuk_female')
  })
})

// ────────────────────────────────────────────────────
// 6. 영웅 카드풀 (HERO_CARDS)
// ────────────────────────────────────────────────────

describe('영웅 카드풀 (HERO_CARDS)', () => {
  it('HERO_CARDS가 25장', () => {
    expect(HERO_CARDS.length).toBe(25)
  })

  it('Commander 카드가 11장 포함됨 (10 + celestial 1)', () => {
    const commanders = HERO_CARDS.filter(c => c.cardType === 'commander')
    expect(commanders.length).toBe(11)
  })

  it('Celestial 카드가 1장 포함됨', () => {
    const celestials = HERO_CARDS.filter(c => c.rarity === 'celestial')
    expect(celestials.length).toBe(1)
  })

  it('Epic 카드가 8장 이상 포함됨 (Commander 포함)', () => {
    const epics = HERO_CARDS.filter(c => c.rarity === 'epic')
    expect(epics.length).toBeGreaterThanOrEqual(8)
  })

  it('모든 카드 ID가 고유함', () => {
    const ids = HERO_CARDS.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(HERO_CARDS.length)
  })
})

// ────────────────────────────────────────────────────
// 7. ALL_CARDS 통합 검증 (100장)
// ────────────────────────────────────────────────────

describe('ALL_CARDS 통합 (100장 목표)', () => {
  it('ALL_CARDS가 98장 (기존 73 + 영웅카드 25)', () => {
    expect(ALL_CARDS.length).toBe(98)
  })

  it('ALL_CARDS 전체 ID 고유성', () => {
    const ids = ALL_CARDS.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ALL_CARDS.length)
  })

  it('Celestial 카드가 ALL_CARDS에 포함됨', () => {
    const celestials = ALL_CARDS.filter(c => c.rarity === 'celestial')
    expect(celestials.length).toBeGreaterThanOrEqual(1)
  })

  it('Commander 카드가 ALL_CARDS에 포함됨', () => {
    const commanders = ALL_CARDS.filter(c => c.cardType === 'commander')
    expect(commanders.length).toBeGreaterThanOrEqual(10)
  })
})

// ────────────────────────────────────────────────────
// 8. STEM_META 검증
// ────────────────────────────────────────────────────

describe('STEM_META 메타데이터', () => {
  it('10개 천간 모두 정의됨', () => {
    const stems = [
      'jiamuk', 'yimuk', 'bingfire', 'jungfire', 'mootu',
      'gitu', 'genggold', 'singold', 'imsuil', 'guishui',
    ] as const
    expect(Object.keys(STEM_META).length).toBe(10)
    for (const stem of stems) {
      expect(STEM_META[stem]).toBeDefined()
      expect(STEM_META[stem].hanja).toBeTruthy()
      expect(STEM_META[stem].color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('오행이 5종 정확히 분포 (각 2개씩)', () => {
    const wuxingCounts: Record<string, number> = {}
    for (const meta of Object.values(STEM_META)) {
      wuxingCounts[meta.wuxing] = (wuxingCounts[meta.wuxing] ?? 0) + 1
    }
    for (const count of Object.values(wuxingCounts)) {
      expect(count).toBe(2)
    }
  })
})

// ────────────────────────────────────────────────────
// 9. heroStore 기본 동작 (직접 상태 검증)
// ────────────────────────────────────────────────────

describe('heroStore 기본 동작', () => {
  // Zustand store를 직접 import하여 테스트
  it('선택 전 selectedHero가 null', async () => {
    const { useHeroStore } = await import('@/stores/heroStore')
    const store = useHeroStore.getState()
    store.clearHero()
    expect(useHeroStore.getState().selectedHero).toBeNull()
  })

  it('selectHero 후 selectedHero가 설정됨', async () => {
    const { useHeroStore } = await import('@/stores/heroStore')
    const testHero = ALL_HEROES[0]
    useHeroStore.getState().selectHero(testHero)
    expect(useHeroStore.getState().selectedHero).toEqual(testHero)
  })

  it('clearHero 후 selectedHero가 null로 리셋', async () => {
    const { useHeroStore } = await import('@/stores/heroStore')
    useHeroStore.getState().selectHero(ALL_HEROES[0])
    useHeroStore.getState().clearHero()
    expect(useHeroStore.getState().selectedHero).toBeNull()
  })
})

// ────────────────────────────────────────────────────
// 10. 영웅 색상 고유성 (오행 내에서)
// ────────────────────────────────────────────────────

describe('영웅 색상 (같은 천간 남녀 동일 색상)', () => {
  it('같은 천간(stem) 남녀는 동일한 color를 보유', () => {
    const stems = ['jiamuk', 'yimuk', 'bingfire', 'jungfire', 'mootu', 'gitu', 'genggold', 'singold', 'imsuil', 'guishui'] as const
    for (const stem of stems) {
      const stemHeroes = ALL_HEROES.filter(h => h.stem === stem)
      expect(stemHeroes.length).toBe(2)
      expect(stemHeroes[0].color).toBe(stemHeroes[1].color)
    }
  })
})
