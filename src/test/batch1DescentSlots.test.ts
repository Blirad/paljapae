/**
 * 배치 1.5: 강림제 슬롯 사전결정 테스트
 * - 슬롯 배열이 고정되는지 검증 (일진+시드 기반)
 * - 2~3회 슬롯 범위 검증
 * - 소진제 금지 검증 (slotIndices는 고정, usedCount는 추적용만)
 */

import { describe, it, expect, vi } from 'vitest'
import type { SavedHeroProfile } from '../types/game'

// ENABLE_YONGSIN_DESCENT를 true로 mock (테스트 환경에서만)
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance')
  return { ...(actual as Record<string, unknown>), ENABLE_YONGSIN_DESCENT: true }
})

// mock 적용 후 import
const { initYongsinDescent } = await import('../engine/paljajeonEngine')

describe('배치 1.5: 강림제 슬롯 사전결정', () => {
  const mockProfile: SavedHeroProfile = {
    sajuInfo: {
      birthYear: 2000,
      birthMonth: 1,
      birthDay: 1,
      isLunar: false,
    },
    dayPillarChar: '甲子',
    ilganChar: '甲',
    ilganElement: 'mok',
    iljiChar: '子',
    elementDist: { mok: 1, hwa: 2, to: 1, geum: 1, su: 2 },
    deckSeed: 12345,
    savedAt: new Date().toISOString(),
  }

  it('슬롯 배열이 사전결정됨 (동일 프로필+시드 = 동일 슬롯)', () => {
    const result1 = initYongsinDescent(mockProfile, 0)
    const result2 = initYongsinDescent(mockProfile, 0)

    // 동일한 프로필과 층수 → 동일한 슬롯 배열
    expect(result1.slots).toEqual(result2.slots)
    expect(result1.descentCount).toBe(result2.descentCount)
  })

  it('슬롯 개수는 2~3 범위 내', () => {
    const result = initYongsinDescent(mockProfile, 0)

    // descentCount: 2 또는 3
    expect([2, 3]).toContain(result.descentCount)
    // slots 배열 길이도 동일
    expect(result.slots.length).toBe(result.descentCount)
  })

  it('슬롯 위치는 18턴(maxTurns) 범위 내', () => {
    const result = initYongsinDescent(mockProfile, 0)

    // 모든 슬롯이 0~17 범위 내
    for (const slot of result.slots) {
      expect(slot).toBeGreaterThanOrEqual(0)
      expect(slot).toBeLessThan(18)
    }
  })

  it('슬롯 배열이 정렬된 상태 (오름차순)', () => {
    const result = initYongsinDescent(mockProfile, 0)

    // slots이 정렬되어 있음
    const sorted = [...result.slots].sort((a, b) => a - b)
    expect(result.slots).toEqual(sorted)
  })

  it('초기 상태: usedCount=0, pendingDescent=false', () => {
    const result = initYongsinDescent(mockProfile, 0)

    expect(result.usedCount).toBe(0)
    expect(result.pendingDescent).toBe(false)
  })

  it('다른 프로필 → 다른 슬롯 (비공개성)', () => {
    const profile1 = { ...mockProfile, deckSeed: 12345 }
    const profile2 = { ...mockProfile, deckSeed: 54321 }

    const result1 = initYongsinDescent(profile1, 0)
    const result2 = initYongsinDescent(profile2, 0)

    // 다른 시드 → 대부분 다른 슬롯 (확률적 검증)
    expect(result1.slots).not.toEqual(result2.slots)
  })

  it('슬롯 생성이 항상 유효한 결과 반환', () => {
    const result = initYongsinDescent(mockProfile, 0)

    // mock으로 ENABLE=true이므로 descentCount=2 또는 3
    expect([2, 3]).toContain(result.descentCount)
    expect(result.slots.length).toBe(result.descentCount)
  })

  it('프로필 없음 시 기본 시드로 슬롯 생성', () => {
    const result = initYongsinDescent(null, 0)

    // null 프로필이어도 기본 시드(12345)로 슬롯 생성
    // descentCount와 slots이 초기화됨
    expect(typeof result.descentCount).toBe('number')
    expect(Array.isArray(result.slots)).toBe(true)
  })
})
