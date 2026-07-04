/**
 * M4 스테이지 시스템 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import { ALL_STAGES, STAGES_BY_ID, getDifficultyStars, AI_TIER_LABEL } from '@/data/stages'

describe('스테이지 데이터 기본 검증', () => {
  it('스테이지가 6개', () => {
    expect(ALL_STAGES.length).toBe(6)
  })

  it('스테이지 ID가 1~6', () => {
    const ids = ALL_STAGES.map(s => s.id)
    expect(ids).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('STAGES_BY_ID로 ID 조회 가능', () => {
    for (let i = 1; i <= 6; i++) {
      expect(STAGES_BY_ID[i]).toBeDefined()
      expect(STAGES_BY_ID[i].id).toBe(i)
    }
  })

  it('각 스테이지 AI 덱이 최소 18장 이상', () => {
    ALL_STAGES.forEach(stage => {
      expect(stage.aiDeck.length).toBeGreaterThanOrEqual(18)
    })
  })

  it('각 스테이지 보상 카드 풀이 3종', () => {
    ALL_STAGES.forEach(stage => {
      expect(stage.rewardPool.cards.length).toBe(3)
    })
  })
})

describe('스테이지 언락 체인 검증', () => {
  it('Stage 1은 언락 조건 없음 (시작부터 해금)', () => {
    expect(ALL_STAGES[0].unlockRequires).toEqual([])
  })

  it('Stage 2는 Stage 1 클리어 필요', () => {
    expect(ALL_STAGES[1].unlockRequires).toContain(1)
  })

  it('Stage 3는 Stage 2 클리어 필요', () => {
    expect(ALL_STAGES[2].unlockRequires).toContain(2)
  })

  it('Stage 4는 Stage 3 클리어 필요', () => {
    expect(ALL_STAGES[3].unlockRequires).toContain(3)
  })

  it('Stage 5는 Stage 4 클리어 필요', () => {
    expect(ALL_STAGES[4].unlockRequires).toContain(4)
  })

  it('Stage 6은 Stage 5 클리어 필요', () => {
    expect(ALL_STAGES[5].unlockRequires).toContain(5)
  })
})

describe('스테이지 난이도 분포', () => {
  it('Stage 1, 2 — 별 1개 (하수)', () => {
    expect(ALL_STAGES[0].difficulty).toBe(1)
    expect(ALL_STAGES[1].difficulty).toBe(1)
  })

  it('Stage 3, 4 — 별 2개 (강호인)', () => {
    expect(ALL_STAGES[2].difficulty).toBe(2)
    expect(ALL_STAGES[3].difficulty).toBe(2)
  })

  it('Stage 5 — 별 3개 (고수)', () => {
    expect(ALL_STAGES[4].difficulty).toBe(3)
  })

  it('Stage 6 — 별 4개 (최종 보스)', () => {
    expect(ALL_STAGES[5].difficulty).toBe(4)
  })
})

describe('AI 티어 배정', () => {
  it('Stage 1, 2 — GRUNT', () => {
    expect(ALL_STAGES[0].aiTier).toBe('GRUNT')
    expect(ALL_STAGES[1].aiTier).toBe('GRUNT')
  })

  it('Stage 3, 4 — STRATEGIST', () => {
    expect(ALL_STAGES[2].aiTier).toBe('STRATEGIST')
    expect(ALL_STAGES[3].aiTier).toBe('STRATEGIST')
  })

  it('Stage 5, 6 — ADVANCED', () => {
    expect(ALL_STAGES[4].aiTier).toBe('ADVANCED')
    expect(ALL_STAGES[5].aiTier).toBe('ADVANCED')
  })
})

describe('AI 오행 배정 (마스터플랜 §7-4)', () => {
  it('Stage 1 — 木', () => {
    expect(ALL_STAGES[0].element).toBe('木')
  })

  it('Stage 2 — 土', () => {
    expect(ALL_STAGES[1].element).toBe('土')
  })

  it('Stage 5 — 火', () => {
    expect(ALL_STAGES[4].element).toBe('火')
  })

  it('Stage 6 — neutral (전 오행)', () => {
    expect(ALL_STAGES[5].element).toBe('neutral')
  })
})

describe('유틸 함수', () => {
  it('getDifficultyStars(1) = "★☆☆☆"', () => {
    expect(getDifficultyStars(1)).toBe('★☆☆☆')
  })

  it('getDifficultyStars(4) = "★★★★"', () => {
    expect(getDifficultyStars(4)).toBe('★★★★')
  })

  it('AI_TIER_LABEL에 3개 키 존재', () => {
    expect(Object.keys(AI_TIER_LABEL)).toHaveLength(3)
    expect(AI_TIER_LABEL['GRUNT']).toBeTruthy()
    expect(AI_TIER_LABEL['STRATEGIST']).toBeTruthy()
    expect(AI_TIER_LABEL['ADVANCED']).toBeTruthy()
  })
})
