/**
 * 팔자전 — 만세력 간이 계산
 * 사주 입력 처리 (Phase 1: 간단한 오행 배분)
 * 주의: 실제 만세력은 검증된 오픈소스 라이브러리 사용 필수 (개발 바이블 §2-1)
 * Phase 1에서는 생년월일 → 오행 분포 근사값 계산
 */

import type { Element, FortuneLevel } from '../types/game'

// 천간 → 오행 매핑
const CHEONGAN_ELEMENTS: Element[] = [
  'mok', 'mok',  // 갑, 을
  'hwa', 'hwa',  // 병, 정
  'to',  'to',   // 무, 기
  'geum','geum', // 경, 신
  'su',  'su',   // 임, 계
]

// 지지 → 오행 매핑
const JIJI_ELEMENTS: Element[] = [
  'su',   // 자
  'to',   // 축
  'mok',  // 인
  'mok',  // 묘
  'to',   // 진
  'hwa',  // 사
  'hwa',  // 오
  'to',   // 미
  'geum', // 신
  'geum', // 유
  'to',   // 술
  'su',   // 해
]

/** 연도 → 천간 (0=갑자기준) */
export function yearToCheongan(year: number): Element {
  return CHEONGAN_ELEMENTS[(year - 4) % 10]
}

/** 연도 → 지지 */
export function yearToJiji(year: number): Element {
  return JIJI_ELEMENTS[(year - 4) % 12]
}

/** 월 → 지지 오행 */
export function monthToElement(month: number): Element {
  const monthJiji = [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  return JIJI_ELEMENTS[monthJiji[month - 1]]
}

/** 일 → 천간 (60갑자 근사 — Phase 1 간이) */
export function dayToElement(year: number, month: number, day: number): Element {
  // 율리우스 일련 번호 근사
  const a = Math.floor((14 - month) / 12)
  const y = year - a
  const m = month + 12 * a - 2
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
  return CHEONGAN_ELEMENTS[((jdn % 10) + 10) % 10]
}

/** 오늘 일진 계산 (간이) */
export function getTodayElement(): Element {
  const now = new Date()
  return dayToElement(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** 생년월일 → 오행 분포 */
export function getSajuElementDistribution(
  year: number,
  month: number,
  day: number
): Record<Element, number> {
  const dist: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
  dist[yearToCheongan(year)]++
  dist[yearToJiji(year)]++
  dist[monthToElement(month)]++
  dist[dayToElement(year, month, day)]++
  return dist
}

/** 오늘 운세 등급 계산: 일진 오행 vs 일간 오행 */
export function getDailyFortune(ilganElement: Element, todayElement: Element): FortuneLevel {
  // 일진이 일간을 생함 → 대길
  if (ELEMENT_SAENGCHAE[todayElement] === ilganElement) return 'daegil'
  // 같은 오행 → 길
  if (todayElement === ilganElement) return 'gil'
  // 일간이 일진을 생함 → 평
  if (ELEMENT_SAENGCHAE[ilganElement] === todayElement) return 'pyeong'
  // 일간이 일진을 극함 → 흉
  if (ELEMENT_GEUK[ilganElement] === todayElement) return 'hyung'
  // 일진이 일간을 극함 → 대흉
  return 'daehyung'
}

const ELEMENT_SAENGCHAE: Record<Element, Element> = {
  mok: 'hwa', hwa: 'to', to: 'geum', geum: 'su', su: 'mok',
}

const ELEMENT_GEUK: Record<Element, Element> = {
  mok: 'to', hwa: 'geum', to: 'su', geum: 'mok', su: 'hwa',
}
