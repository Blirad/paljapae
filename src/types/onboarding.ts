/**
 * 온보딩 관련 타입 정의
 * 리라 스펙 v1.0 기반
 */

import type { FiveElement } from './elements'
import type { Card } from './cards'

/** 온보딩 화면 번호 (1~4) */
export type OnboardingStep = 1 | 2 | 3 | 4

/** 영웅 데이터 */
export interface HeroData {
  element: FiveElement
  name: string       // 한글 이름 (한자 포함)
  nickname: string   // 별칭
  strategyTag: string
  playstyleTag: string
  description: string
  flavorText: string
}

/** 온보딩 완료 후 게임 스토어에 저장하는 데이터 */
export interface OnboardingResult {
  birthYear: number
  birthMonth: number
  birthDay: number
  primaryElement: FiveElement
  hero: HeroData
  startingDeck: Card[]
}
