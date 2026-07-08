/**
 * 운명카드전 영웅 시스템 타입 정의
 * Phase 1 — 10천간(天干) × 2성별 = 20명 영웅
 */

import type { FiveElement } from './elements'

// ────────────────────────────────────────────────────
// 기본 타입
// ────────────────────────────────────────────────────

export type Gender = 'male' | 'female'

export type HeavenlyStemKey =
  | 'jiamuk'
  | 'yimuk'
  | 'bingfire'
  | 'jungfire'
  | 'mootu'
  | 'gitu'
  | 'genggold'
  | 'singold'
  | 'imsuil'
  | 'guishui'

export type WuXing = FiveElement

// ────────────────────────────────────────────────────
// HeroData 인터페이스
// ────────────────────────────────────────────────────

export interface HeroData {
  /** 고유 ID (예: "jiamuk_male") */
  id: string
  /** 천간 키 */
  stem: HeavenlyStemKey
  /** 성별 */
  gender: Gender
  /** 한글 이름 */
  name: string
  /** 오행 속성 */
  wuxing: WuXing
  /** 대표 색상 hex */
  color: string
  /** 기본 체력 */
  baseHP: number
  /** 기본 에너지 */
  baseEnergy: number
  /** 이미지 경로 (없으면 색상 placeholder) */
  imagePath?: string
  /** 캐릭터 설명 */
  description: string
}

// ────────────────────────────────────────────────────
// 천간 메타데이터 (한자 · 오행 · 색상)
// ────────────────────────────────────────────────────

export interface StemMeta {
  /** 한자 */
  hanja: string
  /** 오행 */
  wuxing: WuXing
  /** 대표 색상 hex */
  color: string
}

export const STEM_META: Record<HeavenlyStemKey, StemMeta> = {
  jiamuk:   { hanja: '甲木', wuxing: '木', color: '#1a5c3a' },
  yimuk:    { hanja: '乙木', wuxing: '木', color: '#4db84d' },
  bingfire: { hanja: '丙火', wuxing: '火', color: '#cc0000' },
  jungfire: { hanja: '丁火', wuxing: '火', color: '#ff6600' },
  mootu:    { hanja: '戊土', wuxing: '土', color: '#8b6914' },
  gitu:     { hanja: '己土', wuxing: '土', color: '#c8a96e' },
  genggold: { hanja: '庚金', wuxing: '金', color: '#c0c0c0' },
  singold:  { hanja: '辛金', wuxing: '金', color: '#ffd700' },
  imsuil:   { hanja: '壬水', wuxing: '水', color: '#1a3a5c' },
  guishui:  { hanja: '癸水', wuxing: '水', color: '#4169e1' },
}
