/**
 * M8 P0 테스트
 * - P0-1: 유물 20종 데이터 정의, RelicId 유니온 타입
 * - P0-2: Challenge 모드 타입, 규칙 수치, challengeStore, fatigue 배율
 * - advantage.ts 역류 분기
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ALL_RELICS } from '@/types/relics'
import type { RelicId } from '@/types/relics'
import {
  CHALLENGE_RULES,
  CHALLENGE_DISPLAY_NAME,
  CHALLENGE_DESCRIPTION,
  hasSealedElement,
  isMaxChallenge,
  getFatigueMultiplier,
  pickRandomElement,
} from '@/types/challengeMode'
import type { ChallengeMode } from '@/types/challengeMode'
import { useChallengeStore } from '@/stores/challengeStore'
import { calculateFatigueDamage } from '@/game/engine/fatigue'
import type { FatigueState } from '@/types/game'
import { getAdvantageRelation, getAdvantageText } from '@/utils/advantage'

// ────────────────────────────────────────────────────
// P0-1: 유물 20종 데이터
// ────────────────────────────────────────────────────

describe('P0-1: 유물 20종 데이터', () => {
  const ALL_IDS: RelicId[] = [
    // 기존 5종
    'RELIC_HERB_POUCH', 'RELIC_DUEL_CREST', 'RELIC_JADE_BEAD', 'RELIC_ELEMENT_SEAL', 'RELIC_HELL_TALISMAN',
    // 신규 15종
    'RELIC_WOOD_SPROUT', 'RELIC_WOOD_DECAY',
    'RELIC_FIRE_BEACON', 'RELIC_FIRE_BACKFIRE',
    'RELIC_EARTH_FORTRESS', 'RELIC_EARTH_QUICKSAND',
    'RELIC_METAL_EDGE', 'RELIC_METAL_RUST',
    'RELIC_WATER_SPRING', 'RELIC_WATER_ABYSS',
    'RELIC_GENERATE_CYCLE', 'RELIC_DOMINATE_SEAL', 'RELIC_TWIN_ELEMENT',
    'RELIC_CHAOS_PENTA', 'RELIC_FATE_REVERSE',
  ]

  it('ALL_RELICS에 20종 정의됨', () => {
    expect(Object.keys(ALL_RELICS)).toHaveLength(20)
  })

  it.each(ALL_IDS)('%s: 필수 필드 존재', (id) => {
    const relic = ALL_RELICS[id]
    expect(relic).toBeDefined()
    expect(relic.id).toBe(id)
    expect(relic.name).toBeTruthy()
    expect(relic.nameKey).toBeTruthy()
    expect(relic.icon).toBeTruthy()
    expect(relic.description).toBeTruthy()
    expect(relic.flavorText).toBeTruthy()
    expect(relic.hookPoints.length).toBeGreaterThan(0)
    expect(['吉', '凶', '複']).toContain(relic.alignment)
  })

  it('木 계열 유물: 길 + 흉 각 1종', () => {
    expect(ALL_RELICS['RELIC_WOOD_SPROUT'].alignment).toBe('吉')
    expect(ALL_RELICS['RELIC_WOOD_DECAY'].alignment).toBe('凶')
    expect(ALL_RELICS['RELIC_WOOD_SPROUT'].element).toBe('木')
    expect(ALL_RELICS['RELIC_WOOD_DECAY'].element).toBe('木')
  })

  it('火 계열 유물: 길 + 흉 각 1종', () => {
    expect(ALL_RELICS['RELIC_FIRE_BEACON'].alignment).toBe('吉')
    expect(ALL_RELICS['RELIC_FIRE_BACKFIRE'].alignment).toBe('凶')
  })

  it('복합 유물 5종은 alignment === 複', () => {
    const complexIds: RelicId[] = [
      'RELIC_GENERATE_CYCLE', 'RELIC_DOMINATE_SEAL', 'RELIC_TWIN_ELEMENT',
      'RELIC_CHAOS_PENTA', 'RELIC_FATE_REVERSE',
    ]
    complexIds.forEach(id => {
      expect(ALL_RELICS[id].alignment).toBe('複')
    })
  })

  it('복합 유물은 element 필드가 없음', () => {
    expect(ALL_RELICS['RELIC_GENERATE_CYCLE'].element).toBeUndefined()
    expect(ALL_RELICS['RELIC_FATE_REVERSE'].element).toBeUndefined()
  })

  it('역운 부적(RELIC_FATE_REVERSE): hookPoints에 battle_start + combat_attack 모두 포함', () => {
    const relic = ALL_RELICS['RELIC_FATE_REVERSE']
    expect(relic.hookPoints).toContain('battle_start')
    expect(relic.hookPoints).toContain('combat_attack')
  })
})

// ────────────────────────────────────────────────────
// P0-2: Challenge 모드 타입 + 규칙
// ────────────────────────────────────────────────────

describe('P0-2: Challenge 모드 타입 및 규칙 수치', () => {
  const ALL_MODES: ChallengeMode[] = [
    'normal', 'challenge1', 'challenge2', 'challenge3', 'challenge4', 'challenge5',
  ]

  it('6개 모드 규칙이 모두 정의됨', () => {
    ALL_MODES.forEach(m => {
      expect(CHALLENGE_RULES[m]).toBeDefined()
    })
  })

  it('Normal: 모든 패널티 없음', () => {
    const r = CHALLENGE_RULES['normal']
    expect(r.playerStartHp).toBeNull()
    expect(r.fatigueMultiplier).toBe(1)
    expect(r.sealedElementCostAdd).toBe(0)
    expect(r.aiHpBonus).toBe(0)
  })

  it('Challenge 1: HP 21, 기타 패널티 없음', () => {
    const r = CHALLENGE_RULES['challenge1']
    expect(r.playerStartHp).toBe(21)
    expect(r.fatigueMultiplier).toBe(1)
    expect(r.sealedElementCostAdd).toBe(0)
    expect(r.aiHpBonus).toBe(0)
  })

  it('Challenge 2: HP 기본, 오행 봉인 비용 +2', () => {
    const r = CHALLENGE_RULES['challenge2']
    expect(r.playerStartHp).toBeNull()
    expect(r.sealedElementCostAdd).toBe(2)
    expect(r.aiHpBonus).toBe(0)
  })

  it('Challenge 3: Fatigue ×1.5', () => {
    const r = CHALLENGE_RULES['challenge3']
    expect(r.fatigueMultiplier).toBe(1.5)
    expect(r.playerStartHp).toBeNull()
  })

  it('Challenge 4: HP 24, 봉인 비용 +1, AI HP +3', () => {
    const r = CHALLENGE_RULES['challenge4']
    expect(r.playerStartHp).toBe(24)
    expect(r.sealedElementCostAdd).toBe(1)
    expect(r.aiHpBonus).toBe(3)
  })

  it('Challenge 5: HP 18, Fatigue ×2, AI HP +5, 봉인 비용 +2', () => {
    const r = CHALLENGE_RULES['challenge5']
    expect(r.playerStartHp).toBe(18)
    expect(r.fatigueMultiplier).toBe(2)
    expect(r.aiHpBonus).toBe(5)
    expect(r.sealedElementCostAdd).toBe(2)
  })

  it('hasSealedElement: normal/challenge1/challenge3는 false', () => {
    expect(hasSealedElement('normal')).toBe(false)
    expect(hasSealedElement('challenge1')).toBe(false)
    expect(hasSealedElement('challenge3')).toBe(false)
  })

  it('hasSealedElement: challenge2/4/5는 true', () => {
    expect(hasSealedElement('challenge2')).toBe(true)
    expect(hasSealedElement('challenge4')).toBe(true)
    expect(hasSealedElement('challenge5')).toBe(true)
  })

  it('isMaxChallenge: challenge5만 true', () => {
    expect(isMaxChallenge('challenge5')).toBe(true)
    expect(isMaxChallenge('challenge4')).toBe(false)
    expect(isMaxChallenge('normal')).toBe(false)
  })

  it('getFatigueMultiplier: normal=1, challenge3=1.5, challenge5=2', () => {
    expect(getFatigueMultiplier('normal')).toBe(1)
    expect(getFatigueMultiplier('challenge3')).toBe(1.5)
    expect(getFatigueMultiplier('challenge5')).toBe(2)
  })

  it('pickRandomElement: FiveElement 중 하나 반환', () => {
    const el = pickRandomElement()
    expect(['木', '火', '土', '金', '水']).toContain(el)
  })

  it('CHALLENGE_DISPLAY_NAME: 6개 모두 정의됨', () => {
    ALL_MODES.forEach(m => {
      expect(CHALLENGE_DISPLAY_NAME[m]).toBeTruthy()
    })
  })

  it('CHALLENGE_DESCRIPTION: 6개 모두 정의됨', () => {
    ALL_MODES.forEach(m => {
      expect(typeof CHALLENGE_DESCRIPTION[m]).toBe('string')
    })
  })
})

// ────────────────────────────────────────────────────
// P0-2: challengeStore
// ────────────────────────────────────────────────────

describe('P0-2: challengeStore', () => {
  beforeEach(() => {
    useChallengeStore.getState().resetChallenge()
  })

  it('초기 모드는 normal', () => {
    expect(useChallengeStore.getState().mode).toBe('normal')
  })

  it('setMode: 모드 변경', () => {
    useChallengeStore.getState().setMode('challenge3')
    expect(useChallengeStore.getState().mode).toBe('challenge3')
  })

  it('initRun: normal 모드에서 sealedElement = null', () => {
    useChallengeStore.getState().setMode('normal')
    useChallengeStore.getState().initRun()
    expect(useChallengeStore.getState().sealedElement).toBeNull()
  })

  it('initRun: challenge2 모드에서 sealedElement가 FiveElement 값', () => {
    useChallengeStore.getState().setMode('challenge2')
    useChallengeStore.getState().initRun()
    const el = useChallengeStore.getState().sealedElement
    expect(el).not.toBeNull()
    expect(['木', '火', '土', '金', '水']).toContain(el)
  })

  it('initRun: challenge1 모드에서 sealedElement = null (봉인 없음)', () => {
    useChallengeStore.getState().setMode('challenge1')
    useChallengeStore.getState().initRun()
    expect(useChallengeStore.getState().sealedElement).toBeNull()
  })

  it('resetChallenge: 초기값 복원', () => {
    useChallengeStore.getState().setMode('challenge5')
    useChallengeStore.getState().initRun()
    useChallengeStore.getState().resetChallenge()
    expect(useChallengeStore.getState().mode).toBe('normal')
    expect(useChallengeStore.getState().sealedElement).toBeNull()
    expect(useChallengeStore.getState().fateReverseUsed).toBe(false)
  })

  it('useFateReverse: fateReverseUsed = true', () => {
    useChallengeStore.getState().useFateReverse()
    expect(useChallengeStore.getState().fateReverseUsed).toBe(true)
  })
})

// ────────────────────────────────────────────────────
// P0-2: calculateFatigueDamage 배율 (M8 확장)
// ────────────────────────────────────────────────────

describe('P0-2: calculateFatigueDamage 배율', () => {
  const fatigueAt3: FatigueState = { deckExhausted: true, exhaustedTurnsCount: 3 }
  const fatigueAt4: FatigueState = { deckExhausted: true, exhaustedTurnsCount: 4 }

  it('기본 배율(1): 소진 3턴 = 3 피해', () => {
    expect(calculateFatigueDamage(fatigueAt3)).toBe(3)
  })

  it('배율 1.5 (Challenge 3): 소진 3턴 = round(3×1.5) = 5', () => {
    expect(calculateFatigueDamage(fatigueAt3, 1.5)).toBe(5)
  })

  it('배율 2 (Challenge 5): 소진 3턴 = 6', () => {
    expect(calculateFatigueDamage(fatigueAt3, 2)).toBe(6)
  })

  it('배율 1.5: 소진 4턴 = round(4×1.5) = 6', () => {
    expect(calculateFatigueDamage(fatigueAt4, 1.5)).toBe(6)
  })

  it('배율 2: 소진 4턴 = 8', () => {
    expect(calculateFatigueDamage(fatigueAt4, 2)).toBe(8)
  })

  it('덱 소진 전이면 배율 무관 0 반환', () => {
    const notExhausted: FatigueState = { deckExhausted: false, exhaustedTurnsCount: 0 }
    expect(calculateFatigueDamage(notExhausted, 2)).toBe(0)
  })
})

// ────────────────────────────────────────────────────
// P0-2: advantage.ts 역류 분기 (Challenge 4)
// ────────────────────────────────────────────────────

describe('P0-2: advantage.ts 역류 분기', () => {
  it('기본 상극: 木克土 → 木이 advantage', () => {
    expect(getAdvantageRelation('木', '土')).toBe('advantage')
  })

  it('기본 상극: 木 vs 土, 역류 적용 시 disadvantage로 반전', () => {
    expect(getAdvantageRelation('木', '土', true)).toBe('disadvantage')
  })

  it('역류: 土克木 → 기본에선 土가 advantage, 역류 시 disadvantage', () => {
    expect(getAdvantageRelation('土', '木')).toBe('disadvantage')
    expect(getAdvantageRelation('土', '木', true)).toBe('advantage')
  })

  it('역류: 중립 케이스(木 vs 火)는 역류 무관 neutral', () => {
    expect(getAdvantageRelation('木', '火')).toBe('neutral')
    expect(getAdvantageRelation('木', '火', true)).toBe('neutral')
  })

  it('getAdvantageText 역류 시 [역류] 텍스트 포함', () => {
    const text = getAdvantageText('木', '土', true)
    expect(text).toContain('[역류]')
  })

  it('getAdvantageText 기본 모드는 [역류] 미포함', () => {
    const text = getAdvantageText('木', '土', false)
    expect(text).not.toContain('[역류]')
  })
})
