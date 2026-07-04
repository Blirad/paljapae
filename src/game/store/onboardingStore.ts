/**
 * 온보딩 Zustand 스토어
 * 리라 스펙 v1.0 — 온보딩 완료 후 주 오행·영웅·덱 저장
 */

import { create } from 'zustand'
import type { FiveElement } from '@/types/elements'
import type { OnboardingStep, HeroData, OnboardingResult } from '@/types/onboarding'
import type { Card } from '@/types/cards'

interface OnboardingStore {
  // 화면 단계
  step: OnboardingStep

  // 입력값
  birthYear: number
  birthMonth: number | null
  birthDay: number | null

  // 계산 결과
  onboardingResult: OnboardingResult | null

  // 액션
  setStep: (step: OnboardingStep) => void
  setBirthYear: (year: number) => void
  setBirthMonth: (month: number | null) => void
  setBirthDay: (day: number | null) => void
  setOnboardingResult: (result: OnboardingResult) => void
  reset: () => void
}

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_YEAR = CURRENT_YEAR - 25

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  step: 1,
  birthYear: DEFAULT_YEAR,
  birthMonth: null,
  birthDay: null,
  onboardingResult: null,

  setStep: (step) => set({ step }),
  setBirthYear: (year) => set({ birthYear: year }),
  setBirthMonth: (month) => set({ birthMonth: month, birthDay: null }),
  setBirthDay: (day) => set({ birthDay: day }),
  setOnboardingResult: (result) => set({ onboardingResult: result }),
  reset: () => set({
    step: 1,
    birthYear: DEFAULT_YEAR,
    birthMonth: null,
    birthDay: null,
    onboardingResult: null,
  }),
}))

// ────────────────────────────────────────────────────
// 영웅 데이터 (오행별 5종) — 리라 스펙 §4 카피
// ────────────────────────────────────────────────────

export const HERO_DATA: Record<FiveElement, HeroData> = {
  木: {
    element: '木',
    name: '청룡도사 (靑龍道士)',
    nickname: '청룡',
    strategyTag: '🎓컨트롤',
    playstyleTag: '📚어드밴티지',
    description: '강물처럼 흐르며 적의 허점을 찾아드립니다. 드로우로 패를 쌓고, 버프로 병사를 키워 압도하는 스타일. 급할 것 없습니다, 시간이 곧 무기입니다.',
    flavorText: '제자들은 그를 도사라 불렀다. 사실 그냥 책을 많이 읽었을 뿐이다.',
  },
  火: {
    element: '火',
    name: '화염검객 (火焰劍客)',
    nickname: '불검',
    strategyTag: '⚡어그로',
    playstyleTag: '💨페이스',
    description: '망설임은 패배의 시작. 돌진 유닛과 직접 딜 주문으로 상대가 생각하기 전에 끝냅니다. 이기거나, 화려하게 지거나.',
    flavorText: '검을 뽑기 전에 생각하냐고? 뽑은 다음에 생각한다. 지금도.',
  },
  土: {
    element: '土',
    name: '황토장군 (黃土將軍)',
    nickname: '황장군',
    strategyTag: '🛡탱킹',
    playstyleTag: '⏳지속전',
    description: '산은 흔들리지 않습니다. 도발 유닛으로 벽을 세우고 회복하며 상대가 지쳐 쓰러질 때를 기다립니다. 인내는 강함입니다.',
    flavorText: '황장군은 오늘도 지지 않았다. 이기지도 않았지만, 지지는 않았다.',
  },
  金: {
    element: '金',
    name: '백금사형 (白金師兄)',
    nickname: '백사형',
    strategyTag: '🎯미드레인지',
    playstyleTag: '🔄카운터',
    description: '쓸데없는 유닛은 없애고, 필요한 유닛만 남깁니다. 제거기로 판을 정리하고 카운터로 역전을 노리는 계산형 스타일.',
    flavorText: '사형은 말이 없다. 칼만 있다. 칼값은 엄청 비싸다.',
  },
  水: {
    element: '水',
    name: '흑수선인 (黑水仙人)',
    nickname: '흑선인',
    strategyTag: '🎭콤보',
    playstyleTag: '🌀기믹',
    description: '패를 쌓고, 연쇄하고, 비용을 낮추고, 또 연쇄합니다. 복잡한 콤보가 완성되는 순간의 쾌감을 아는 플레이어를 위한 선택.',
    flavorText: '흑선인은 언제 어디서 나타났는지 모른다. 본인도 잘 모른다고 했다.',
  },
}

/** 오행별 화면 4 서브카피 (리라 스펙 §5) */
export const DECK_FLAVOR: Record<FiveElement, string> = {
  木: '운명이 이미 카드를 골랐습니다. 책을 많이 읽은 청룡의 덱입니다.',
  火: '운명이 이미 카드를 골랐습니다. 일단 불부터 지르고 봅시다.',
  土: '운명이 이미 카드를 골랐습니다. 안 죽으면 이기는 덱입니다.',
  金: '운명이 이미 카드를 골랐습니다. 조용하지만 날카롭습니다.',
  水: '운명이 이미 카드를 골랐습니다. 뭔가 복잡해 보이지만 일단 해보세요.',
}

/** 오행별 시작 덱 생성 (마스터플랜 §5-4: 主 12 + 상생 6 + 중립 2) */
export function createStartingDeck(element: FiveElement): Card[] {
  // 동적 import 대신 직접 sampleCards에서 생성
  // 각 오행별 카드를 조합 (M1 sampleCards 활용)
  return getStartingDeckForElement(element)
}

import {
  W01, W02, W03, W04, W05,
  F01, F02, F03, F04, F06, LEGEND_FIRE,
  T01, T02, T03,
  G01, G04, G05,
  H01, H03, H04, LEGEND_WATER,
  N01, N02,
} from '@/data/sampleCards'
import type { Card as CardType } from '@/types/cards'

function getStartingDeckForElement(element: FiveElement): CardType[] {
  switch (element) {
    case '火':
      return [
        // 火 12장
        F01, { ...F01, id: 'F-01b' },
        F02, { ...F02, id: 'F-02b' },
        F03, { ...F03, id: 'F-03b' },
        F04, { ...F04, id: 'F-04b' },
        F06, { ...F06, id: 'F-06b' },
        LEGEND_FIRE,
        { ...F01, id: 'F-01c' },
        // 木→火 상생 6장
        W01, { ...W01, id: 'W-01b' },
        W05, { ...W05, id: 'W-05b' },
        W02,
        { ...W03, id: 'W-03b' },
        // 중립 2장
        N01, N02,
      ]
    case '木':
      return [
        // 木 12장
        W01, { ...W01, id: 'W-01b' },
        W02, { ...W02, id: 'W-02b' },
        W03, { ...W03, id: 'W-03b' },
        W04, { ...W04, id: 'W-04b' },
        W05, { ...W05, id: 'W-05b' },
        { ...W01, id: 'W-01c' },
        { ...W02, id: 'W-02c' },
        // 水→木 상생 6장
        H01, { ...H01, id: 'H-01b' },
        H04, { ...H04, id: 'H-04b' },
        H03,
        { ...H01, id: 'H-01c' },
        // 중립 2장
        N01, N02,
      ]
    case '土':
      return [
        // 土 12장 (T01×4, T02×4, T03×4)
        T01, { ...T01, id: 'T-01b' }, { ...T01, id: 'T-01c' }, { ...T01, id: 'T-01d' },
        T02, { ...T02, id: 'T-02b' }, { ...T02, id: 'T-02c' }, { ...T02, id: 'T-02d' },
        T03, { ...T03, id: 'T-03b' }, { ...T03, id: 'T-03c' }, { ...T03, id: 'T-03d' },
        // 火→土 상생 6장
        F01, { ...F01, id: 'F-01b' },
        F02, { ...F02, id: 'F-02b' },
        F06, { ...F06, id: 'F-06b' },
        // 중립 2장
        N01, N02,
      ]
    case '金':
      return [
        // 金 12장 (G01×4, G04×4, G05×4)
        G01, { ...G01, id: 'G-01b' }, { ...G01, id: 'G-01c' }, { ...G01, id: 'G-01d' },
        G04, { ...G04, id: 'G-04b' }, { ...G04, id: 'G-04c' }, { ...G04, id: 'G-04d' },
        G05, { ...G05, id: 'G-05b' }, { ...G05, id: 'G-05c' }, { ...G05, id: 'G-05d' },
        // 土→金 상생 6장
        T01, { ...T01, id: 'T-01b' },
        T02, { ...T02, id: 'T-02b' },
        T03, { ...T03, id: 'T-03b' },
        // 중립 2장
        N01, N02,
      ]
    case '水':
    default:
      return [
        // 水 12장 (H01×3, H03×3, H04×4, LEGEND×1, H04e×1)
        H01, { ...H01, id: 'H-01b' }, { ...H01, id: 'H-01c' },
        H03, { ...H03, id: 'H-03b' }, { ...H03, id: 'H-03c' },
        H04, { ...H04, id: 'H-04b' }, { ...H04, id: 'H-04c' }, { ...H04, id: 'H-04d' },
        LEGEND_WATER,
        { ...H04, id: 'H-04e' },
        // 金→水 상생 6장
        G01, { ...G01, id: 'G-01b' },
        G04, { ...G04, id: 'G-04b' },
        G05, { ...G05, id: 'G-05b' },
        // 중립 2장
        N01, N02,
      ]
  }
}
