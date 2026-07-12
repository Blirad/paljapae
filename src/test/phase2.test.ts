/**
 * 팔자전 Phase 2 — 테스트
 * - 만세력 10건 검증 (lunar-javascript)
 * - 영웅 시스템
 * - 덱 생성 (사주 기반)
 * - 운세 계산
 * - fortuneTexts 75개 확인
 */

import { describe, it, expect } from 'vitest'
import { getSajuFromSolar, getSajuFromLunar, getSajuElementDistribution, getDailyFortune, ELEMENT_SAENGCHAE, ELEMENT_GEUK } from '../engine/manseryeok'
import { getArchetypeByChar, getSpiritByChar, calcDeckSeed, DAYSTEM_ARCHETYPES, EARTHLY_BRANCH_SPIRITS } from '../engine/heroes'
import { generateSajuDeck, distributeCards } from '../engine/deckGenerator'
import { getFortuneText, getDailyVariant, FORTUNE_TEXTS } from '../data/fortuneTexts'
import type { Element } from '../types/game'

// ─── 1. 만세력 검증 10건 ───
describe('만세력 검증 (lunar-javascript)', () => {
  const cases: [number, number, number, string][] = [
    [1960, 1, 15, '壬寅'],
    [1975, 8, 20, '戊戌'],
    [1988, 12, 31, '庚申'],
    [1990, 6, 1,  '丁酉'],
    [1995, 2, 28, '庚寅'],
    [2000, 10, 10, '辛丑'],
    [2005, 3, 15, '戊戌'],
    [2010, 7, 7,  '戊午'],
    [2020, 1, 1,  '癸卯'],
    [2024, 9, 30, '丁酉'],
  ]

  cases.forEach(([y, m, d, expected]) => {
    it(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')} 일주 = ${expected}`, () => {
      const result = getSajuFromSolar(y, m, d)
      expect(result.day.char).toBe(expected)
    })
  })
})

// ─── 2. 음력 변환 ───
describe('음력→양력 사주 계산', () => {
  it('음력 1990-01-01 → 양력 변환 후 일주 산출', () => {
    // 음력 1990년 1월 1일 → 양력 1990-01-27
    const result = getSajuFromLunar(1990, 1, 1, false)
    expect(result.day.char).toBeTruthy()
    expect(result.day.char.length).toBe(2)
  })
})

// ─── 3. 오행 분포 ───
describe('오행 분포 계산', () => {
  it('1990-06-01 오행 분포 합산 = 6 (시주 없음)', () => {
    const dist = getSajuElementDistribution(1990, 6, 1)
    const total = Object.values(dist).reduce((a, b) => a + b, 0)
    expect(total).toBe(6) // 연간+연지+월간+월지+일간+일지 = 6
  })

  it('시주 포함 시 오행 분포 합산 = 8', () => {
    const dist = getSajuElementDistribution(1990, 6, 1, 9)
    const total = Object.values(dist).reduce((a, b) => a + b, 0)
    expect(total).toBe(8)
  })

  it('모든 오행 키 존재', () => {
    const dist = getSajuElementDistribution(1988, 12, 31)
    expect(Object.keys(dist).sort()).toEqual(['geum', 'hwa', 'mok', 'su', 'to'])
  })
})

// ─── 4. 영웅 시스템 ───
describe('영웅 시스템', () => {
  it('10종 천간 원형 정의', () => {
    expect(DAYSTEM_ARCHETYPES.length).toBe(10)
  })

  it('12종 지지 영물 정의', () => {
    expect(EARTHLY_BRANCH_SPIRITS.length).toBe(12)
  })

  it('甲 → 갑목 대장군', () => {
    const archetype = getArchetypeByChar('甲')
    expect(archetype?.title).toBe('대장군')
    expect(archetype?.element).toBe('mok')
  })

  it('壬 → 임수 대해', () => {
    const archetype = getArchetypeByChar('壬')
    expect(archetype?.title).toBe('대해')
    expect(archetype?.element).toBe('su')
  })

  it('寅 → 호랑이', () => {
    const spirit = getSpiritByChar('寅')
    expect(spirit?.animal).toBe('호랑이')
  })

  it('酉 → 닭 (금 오행)', () => {
    const spirit = getSpiritByChar('酉')
    expect(spirit?.animal).toBe('닭')
    expect(spirit?.element).toBe('geum')
  })

  it('1988-12-31(庚申) → 경금 장검 + 원숭이', () => {
    const result = getSajuFromSolar(1988, 12, 31)
    expect(result.day.cheonganChar).toBe('庚')
    const arch = getArchetypeByChar(result.day.cheonganChar)
    expect(arch?.title).toBe('장검')
    const spirit = getSpiritByChar(result.day.jijiChar)
    expect(spirit?.animal).toBe('원숭이')
  })

  it('덱 시드 생성', () => {
    const seed = calcDeckSeed(1990, 6, 1)
    expect(typeof seed).toBe('number')
    expect(seed).toBeGreaterThan(0)
    // 동일 입력 → 동일 시드
    expect(calcDeckSeed(1990, 6, 1)).toBe(seed)
  })
})

// ─── 5. 사주 기반 덱 생성 ───
describe('사주 기반 덱 생성', () => {
  it('20장 생성', () => {
    const dist: Record<Element, number> = { mok: 2, hwa: 1, to: 2, geum: 1, su: 0 }
    const deck = generateSajuDeck(dist, 12345)
    expect(deck.length).toBe(20)
  })

  it('T21-a: 사주 0인 오행 = 덱 0장 (최소 1장 보장 폐지)', () => {
    // 설계 의도: 부족 오행은 런 중 보상으로 수급
    const dist: Record<Element, number> = { mok: 5, hwa: 0, to: 0, geum: 0, su: 0 }
    const counts = distributeCards(dist, 20)
    // 0인 오행은 덱에도 0장
    expect(counts['hwa']).toBe(0)
    expect(counts['to']).toBe(0)
    expect(counts['geum']).toBe(0)
    expect(counts['su']).toBe(0)
    // 유일하게 분포 있는 mok는 20장 전부
    expect(counts['mok']).toBe(20)
  })

  it('배분 합산 = 20', () => {
    const dist: Record<Element, number> = { mok: 3, hwa: 3, to: 2, geum: 1, su: 1 }
    const counts = distributeCards(dist, 20)
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(20)
  })

  it('카드 값 1~10 범위', () => {
    const dist: Record<Element, number> = { mok: 2, hwa: 2, to: 2, geum: 2, su: 2 }
    const deck = generateSajuDeck(dist, 99999)
    deck.forEach(card => {
      expect(card.value).toBeGreaterThanOrEqual(1)
      expect(card.value).toBeLessThanOrEqual(10)
    })
  })

  it('균등 분포 케이스', () => {
    const dist: Record<Element, number> = { mok: 2, hwa: 2, to: 2, geum: 2, su: 2 }
    const counts = distributeCards(dist, 20)
    Object.values(counts).forEach(c => expect(c).toBe(4))
  })

  it('T21-a: 극단 케이스 — su=0이면 덱에도 su 0장, 합산 20 유지', () => {
    const dist: Record<Element, number> = { mok: 7, hwa: 1, to: 1, geum: 1, su: 0 }
    const counts = distributeCards(dist, 20)
    // mok이 가장 많아야 함
    expect(counts['mok']).toBeGreaterThan(counts['hwa'])
    // T21-a: su는 0 (사주 0인 오행)
    expect(counts['su']).toBe(0)
    // 비율 있는 원소는 최소 1장
    expect(counts['mok']).toBeGreaterThanOrEqual(1)
    expect(counts['hwa']).toBeGreaterThanOrEqual(1)
    expect(counts['to']).toBeGreaterThanOrEqual(1)
    expect(counts['geum']).toBeGreaterThanOrEqual(1)
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(20)
  })

  it('동일 시드 → 동일 덱', () => {
    const dist: Record<Element, number> = { mok: 2, hwa: 2, to: 2, geum: 2, su: 2 }
    const d1 = generateSajuDeck(dist, 42)
    const d2 = generateSajuDeck(dist, 42)
    expect(d1.map(c => c.value)).toEqual(d2.map(c => c.value))
  })
})

// ─── 6. 운세 계산 ───
describe('오늘의 운세 계산', () => {
  it('일진=일간 같은 오행 → 길', () => {
    expect(getDailyFortune('mok', 'mok')).toBe('gil')
  })

  it('일진이 일간을 생함 → 대길 (수→목)', () => {
    expect(getDailyFortune('mok', 'su')).toBe('daegil')
  })

  it('일간이 일진을 생함 → 평 (목→화)', () => {
    expect(getDailyFortune('mok', 'hwa')).toBe('pyeong')
  })

  it('일간이 일진을 극함 → 흉 (목극토)', () => {
    expect(getDailyFortune('mok', 'to')).toBe('hyung')
  })

  it('일진이 일간을 극함 → 대흉 (금극목)', () => {
    expect(getDailyFortune('mok', 'geum')).toBe('daehyung')
  })

  it('생(相生) 관계 5종 모두 확인', () => {
    const pairs: [Element, Element][] = [
      ['su', 'mok'], ['mok', 'hwa'], ['hwa', 'to'], ['to', 'geum'], ['geum', 'su'],
    ]
    pairs.forEach(([from, to]) => {
      expect(ELEMENT_SAENGCHAE[from]).toBe(to)
    })
  })

  it('극(克) 관계 5종 모두 확인', () => {
    const pairs: [Element, Element][] = [
      ['mok', 'to'], ['to', 'su'], ['su', 'hwa'], ['hwa', 'geum'], ['geum', 'mok'],
    ]
    pairs.forEach(([from, to]) => {
      expect(ELEMENT_GEUK[from]).toBe(to)
    })
  })
})

// ─── 7. 운세 텍스트 75개 ───
describe('운세 풀이 텍스트', () => {
  it('25조합 × 3변형 = 75개 텍스트 정의', () => {
    expect(FORTUNE_TEXTS.length).toBe(25)
    FORTUNE_TEXTS.forEach(ft => {
      expect(ft.texts.length).toBe(3)
    })
    const totalTexts = FORTUNE_TEXTS.reduce((acc, ft) => acc + ft.texts.length, 0)
    expect(totalTexts).toBe(75)
  })

  it('5 등급 × 5 오행 = 25 조합 완전 커버', () => {
    const levels = ['daegil', 'gil', 'pyeong', 'hyung', 'daehyung']
    const elements = ['mok', 'hwa', 'to', 'geum', 'su']
    levels.forEach(level => {
      elements.forEach(element => {
        const found = FORTUNE_TEXTS.find(ft => ft.level === level && ft.element === element)
        expect(found).toBeDefined()
      })
    })
  })

  it('getFortuneText 정상 반환', () => {
    const text = getFortuneText('daegil', 'mok', 0)
    expect(text.length).toBeGreaterThan(10)
  })

  it('getDailyVariant 0~2 반환', () => {
    for (let d = 1; d <= 31; d++) {
      const v = getDailyVariant(2026, 7, d)
      expect([0, 1, 2]).toContain(v)
    }
  })

  it('모든 텍스트에 이모지/현대구어 없음 (간이 검사)', () => {
    FORTUNE_TEXTS.forEach(ft => {
      ft.texts.forEach(text => {
        // 이모지 범위 간이 체크
        expect(/[\u{1F300}-\u{1F9FF}]/u.test(text)).toBe(false)
        // 인터넷 밈 샘플
        expect(text).not.toContain('ㅋㅋ')
        expect(text).not.toContain('ㅎㅎ')
      })
    })
  })
})

// ─── 8. localStorage 프로필 직렬화/역직렬화 ───
describe('HeroProfile 직렬화', () => {
  it('JSON 직렬화 왕복', () => {
    const profile = {
      sajuInfo: { birthYear: 1990, birthMonth: 6, birthDay: 1, isLunar: false },
      dayPillarChar: '丁酉',
      ilganChar: '丁',
      ilganElement: 'hwa' as Element,
      iljiChar: '酉',
      elementDist: { mok: 1, hwa: 2, to: 1, geum: 1, su: 1 },
      deckSeed: 12345,
      savedAt: '2026-07-10T00:00:00.000Z',
    }
    const serialized = JSON.stringify(profile)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.dayPillarChar).toBe('丁酉')
    expect(deserialized.ilganElement).toBe('hwa')
    expect(deserialized.elementDist.hwa).toBe(2)
  })
})
