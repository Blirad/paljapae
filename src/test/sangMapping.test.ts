/**
 * 오행 상생(生) 매핑 유닛 테스트 — 5종 전수 검증
 *
 * SANG_MAP[X] === enemyEl → X가 적을 생 → ×0.5
 * getSangElement(enemyEl) → 적을 생하는 원소
 *
 * 엔진(balance.ts)·시뮬 하네스·분석 코드 공통 적용 보장
 */

import { describe, it, expect } from 'vitest'
import { SANG_MAP } from '../engine/balance'
import { getSangElement } from './sangTestUtils'

describe('오행 상생 매핑 5종 검증', () => {
  // SANG_MAP 원본 검증: key가 value를 생함
  it('木生火: SANG_MAP[mok] === hwa', () => {
    expect(SANG_MAP['mok']).toBe('hwa')
  })
  it('火生土: SANG_MAP[hwa] === to', () => {
    expect(SANG_MAP['hwa']).toBe('to')
  })
  it('土生金: SANG_MAP[to] === geum', () => {
    expect(SANG_MAP['to']).toBe('geum')
  })
  it('金生水: SANG_MAP[geum] === su', () => {
    expect(SANG_MAP['geum']).toBe('su')
  })
  it('水生木: SANG_MAP[su] === mok', () => {
    expect(SANG_MAP['su']).toBe('mok')
  })

  // getSangElement 역매핑 검증: 적을 생하는 원소 (×0.5 대상)
  it('적=火 → ×0.5 = 木 (木生火)', () => {
    expect(getSangElement('hwa')).toBe('mok')
  })
  it('적=土 → ×0.5 = 火 (火生土)', () => {
    expect(getSangElement('to')).toBe('hwa')
  })
  it('적=金 → ×0.5 = 土 (土生金)', () => {
    expect(getSangElement('geum')).toBe('to')
  })
  it('적=水 → ×0.5 = 金 (金生水)', () => {
    expect(getSangElement('su')).toBe('geum')
  })
  it('적=木 → ×0.5 = 水 (水生木)', () => {
    expect(getSangElement('mok')).toBe('su')
  })
})
