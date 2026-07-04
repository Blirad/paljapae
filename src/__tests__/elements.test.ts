/**
 * 오행 데이터 모델 단위 테스트
 * 마스터플랜 §5-1, §6-1
 */

import { describe, it, expect } from 'vitest'
import {
  DOMINATES,
  GENERATES,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
  ELEMENT_KEY_MAP,
} from '@/types/elements'
import type { FiveElement, HeavenlyStem, EarthlyBranch } from '@/types/elements'

describe('DOMINATES — 상극 관계 완전성 검증', () => {
  const ALL_ELEMENTS: FiveElement[] = ['木', '火', '土', '金', '水']

  it('모든 오행이 상극 대상을 가짐', () => {
    ALL_ELEMENTS.forEach(el => {
      expect(DOMINATES[el]).toBeDefined()
    })
  })

  it('상극은 가위바위보 구조 (순환)', () => {
    // 木→土→水→火→金→木
    expect(DOMINATES['木']).toBe('土')
    expect(DOMINATES['土']).toBe('水')
    expect(DOMINATES['水']).toBe('火')
    expect(DOMINATES['火']).toBe('金')
    expect(DOMINATES['金']).toBe('木')
  })

  it('자기 자신을 상극하는 오행 없음', () => {
    ALL_ELEMENTS.forEach(el => {
      expect(DOMINATES[el]).not.toBe(el)
    })
  })
})

describe('GENERATES — 상생 관계 완전성 검증', () => {
  const ALL_ELEMENTS: FiveElement[] = ['木', '火', '土', '金', '水']

  it('모든 오행이 상생 대상을 가짐', () => {
    ALL_ELEMENTS.forEach(el => {
      expect(GENERATES[el]).toBeDefined()
    })
  })

  it('상생 순환: 木→火→土→金→水→木', () => {
    expect(GENERATES['木']).toBe('火')
    expect(GENERATES['火']).toBe('土')
    expect(GENERATES['土']).toBe('金')
    expect(GENERATES['金']).toBe('水')
    expect(GENERATES['水']).toBe('木')
  })

  it('자기 자신을 상생하는 오행 없음', () => {
    ALL_ELEMENTS.forEach(el => {
      expect(GENERATES[el]).not.toBe(el)
    })
  })
})

describe('STEM_TO_ELEMENT — 천간 오행 매핑', () => {
  const stems: [HeavenlyStem, FiveElement][] = [
    ['甲', '木'], ['乙', '木'],
    ['丙', '火'], ['丁', '火'],
    ['戊', '土'], ['己', '土'],
    ['庚', '金'], ['辛', '金'],
    ['壬', '水'], ['癸', '水'],
  ]

  stems.forEach(([stem, expected]) => {
    it(`천간 ${stem} → 오행 ${expected}`, () => {
      expect(STEM_TO_ELEMENT[stem]).toBe(expected)
    })
  })

  it('10개 천간 전체 매핑 존재', () => {
    expect(Object.keys(STEM_TO_ELEMENT).length).toBe(10)
  })
})

describe('BRANCH_TO_ELEMENT — 지지 오행 매핑', () => {
  const branches: [EarthlyBranch, FiveElement][] = [
    ['子', '水'], ['丑', '土'],
    ['寅', '木'], ['卯', '木'],
    ['辰', '土'], ['巳', '火'],
    ['午', '火'], ['未', '土'],
    ['申', '金'], ['酉', '金'],
    ['戌', '土'], ['亥', '水'],
  ]

  branches.forEach(([branch, expected]) => {
    it(`지지 ${branch} → 오행 ${expected}`, () => {
      expect(BRANCH_TO_ELEMENT[branch]).toBe(expected)
    })
  })

  it('12개 지지 전체 매핑 존재', () => {
    expect(Object.keys(BRANCH_TO_ELEMENT).length).toBe(12)
  })
})

describe('ELEMENT_KEY_MAP — 오행 영문 키 매핑', () => {
  it('木 → wood', () => expect(ELEMENT_KEY_MAP['木']).toBe('wood'))
  it('火 → fire', () => expect(ELEMENT_KEY_MAP['火']).toBe('fire'))
  it('土 → earth', () => expect(ELEMENT_KEY_MAP['土']).toBe('earth'))
  it('金 → metal', () => expect(ELEMENT_KEY_MAP['金']).toBe('metal'))
  it('水 → water', () => expect(ELEMENT_KEY_MAP['水']).toBe('water'))
})
