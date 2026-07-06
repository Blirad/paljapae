/**
 * 챌린지 모드 스토어 — M8 P0-2
 * 선택된 챌린지 모드와 세션별 봉인 오행 관리
 */

import { create } from 'zustand'
import type { ChallengeMode } from '@/types/challengeMode'
import type { FiveElement } from '@/types/elements'
import {
  CHALLENGE_RULES,
  hasSealedElement,
  pickRandomElement,
} from '@/types/challengeMode'

interface ChallengeStore {
  /** 현재 선택된 챌린지 모드 */
  mode: ChallengeMode
  /** 세션 시작 시 결정된 봉인 오행 (봉인 없는 모드는 null) */
  sealedElement: FiveElement | null
  /** 역운 부적 발동 여부 (런당 1회) */
  fateReverseUsed: boolean

  /** 모드 설정 (RunStartScreen에서 호출) */
  setMode: (mode: ChallengeMode) => void
  /** 런 시작 시 호출 — 봉인 오행 랜덤 결정 */
  initRun: () => void
  /** 역운 부적 발동 처리 */
  useFateReverse: () => void
  /** 런 초기화 */
  resetChallenge: () => void
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  mode: 'normal',
  sealedElement: null,
  fateReverseUsed: false,

  setMode: (mode) => {
    set({ mode })
  },

  initRun: () => {
    const { mode } = get()
    const sealed = hasSealedElement(mode) ? pickRandomElement() : null
    set({ sealedElement: sealed, fateReverseUsed: false })
  },

  useFateReverse: () => {
    set({ fateReverseUsed: true })
  },

  resetChallenge: () => {
    set({ mode: 'normal', sealedElement: null, fateReverseUsed: false })
  },
}))

// ────────────────────────────────────────────────────
// 편의 셀렉터
// ────────────────────────────────────────────────────

/** 현재 챌린지 규칙 반환 */
export function getChallengeRules() {
  const { mode } = useChallengeStore.getState()
  return CHALLENGE_RULES[mode]
}

/** 현재 플레이어 시작 HP (챌린지 반영) */
export function getChallengeStartHp(defaultHp: number): number {
  const rules = getChallengeRules()
  return rules.playerStartHp ?? defaultHp
}

/** 현재 AI HP 보너스 */
export function getChallengeAiHpBonus(): number {
  return getChallengeRules().aiHpBonus
}
