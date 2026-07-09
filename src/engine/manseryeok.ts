/**
 * 팔자전 — 만세력 엔진 (Phase 2)
 * lunar-javascript 라이브러리 기반 — 검증 완료 (10건 공인 만세력 대조)
 *
 * 경계 규칙 (개발 바이블 §2-2):
 *  - 일주 경계: 자정(00:00) 기준 (야자시 미채택)
 *  - 월주 경계: 라이브러리의 절기 기준 그대로
 *  - 양력 입력 기본, 음력 변환 지원
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — lunar-javascript has no bundled type declarations
import { Solar, Lunar } from 'lunar-javascript'

import type { Element, FortuneLevel } from '../types/game'

/** 천간 한자 → 인덱스 (0=甲 … 9=癸) */
const CHEONGAN_CHARS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

/** 지지 한자 → 인덱스 (0=子 … 11=亥) */
const JIJI_CHARS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/** 천간 인덱스 → 오행 */
const CHEONGAN_ELEMENTS: Element[] = [
  'mok', 'mok',   // 甲 乙
  'hwa', 'hwa',   // 丙 丁
  'to',  'to',    // 戊 己
  'geum','geum',  // 庚 辛
  'su',  'su',    // 壬 癸
]

/** 천간 인덱스 → 음양 */
const CHEONGAN_POLARITY: Array<'yang' | 'yin'> = [
  'yang', 'yin',  // 甲 乙
  'yang', 'yin',  // 丙 丁
  'yang', 'yin',  // 戊 己
  'yang', 'yin',  // 庚 辛
  'yang', 'yin',  // 壬 癸
]

/** 지지 인덱스 → 오행 */
const JIJI_ELEMENTS: Element[] = [
  'su',   // 子
  'to',   // 丑
  'mok',  // 寅
  'mok',  // 卯
  'to',   // 辰
  'hwa',  // 巳
  'hwa',  // 午
  'to',   // 未
  'geum', // 申
  'geum', // 酉
  'to',   // 戌
  'su',   // 亥
]

/** 지지 인덱스 → 음양 */
const JIJI_POLARITY: Array<'yang' | 'yin'> = [
  'yang', 'yin',  // 子 丑
  'yang', 'yin',  // 寅 卯
  'yang', 'yin',  // 辰 巳
  'yang', 'yin',  // 午 未
  'yang', 'yin',  // 申 酉
  'yang', 'yin',  // 戌 亥
]

export interface PillarInfo {
  char: string       // 한자 2글자 (예: 壬寅)
  cheonganIdx: number
  jijiIdx: number
  cheonganElement: Element
  jijiElement: Element
  cheonganChar: string
  jijiChar: string
}

export interface SajuResult {
  year: PillarInfo
  month: PillarInfo
  day: PillarInfo
  hour?: PillarInfo
}

/** 한자 1글자 → 천간 인덱스 */
function cheonganIdx(ch: string): number {
  return CHEONGAN_CHARS.indexOf(ch)
}

/** 한자 1글자 → 지지 인덱스 */
function jijiIdx(ch: string): number {
  return JIJI_CHARS.indexOf(ch)
}

function parsePillar(twoChar: string): PillarInfo {
  const cg = twoChar[0]
  const jj = twoChar[1]
  const ci = cheonganIdx(cg)
  const ji = jijiIdx(jj)
  return {
    char: twoChar,
    cheonganIdx: ci,
    jijiIdx: ji,
    cheonganElement: CHEONGAN_ELEMENTS[ci] ?? 'to',
    jijiElement: JIJI_ELEMENTS[ji] ?? 'to',
    cheonganChar: cg,
    jijiChar: jj,
  }
}

/**
 * 양력 날짜 → 사주 4주 계산
 * hour 없으면 시주 미반환
 */
export function getSajuFromSolar(
  year: number,
  month: number,
  day: number,
  hour?: number,
): SajuResult {
  const solar = Solar.fromYmd(year, month, day)
  const ec = solar.getLunar().getEightChar()

  const result: SajuResult = {
    year:  parsePillar(ec.getYear()),
    month: parsePillar(ec.getMonth()),
    day:   parsePillar(ec.getDay()),
  }

  if (hour !== undefined) {
    result.hour = parsePillar(ec.getTime(hour, 0))
  }

  return result
}

/**
 * 음력 날짜 → 사주 4주 계산
 */
export function getSajuFromLunar(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  isLeap = false,
  hour?: number,
): SajuResult {
  const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay, isLeap)
  const solar = lunar.getSolar()
  return getSajuFromSolar(solar.getYear(), solar.getMonth(), solar.getDay(), hour)
}

/**
 * 오늘 일간 오행 (사주 일주의 천간 오행)
 */
export function getTodayDayElement(): Element {
  const today = new Date()
  const result = getSajuFromSolar(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  )
  return result.day.cheonganElement
}

/**
 * 생년월일(+시간) → 오행 분포
 * 시간 있으면 8글자, 없으면 6글자 기준
 */
export function getSajuElementDistribution(
  year: number,
  month: number,
  day: number,
  hour?: number,
  isLunar = false,
): Record<Element, number> {
  const dist: Record<Element, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }

  const saju = isLunar
    ? getSajuFromLunar(year, month, day, false, hour)
    : getSajuFromSolar(year, month, day, hour)

  for (const pillar of [saju.year, saju.month, saju.day, saju.hour].filter(Boolean)) {
    if (pillar) {
      dist[pillar.cheonganElement]++
      dist[pillar.jijiElement]++
    }
  }
  return dist
}

/** 생(相生) 관계: key가 value를 생함 */
export const ELEMENT_SAENGCHAE: Record<Element, Element> = {
  mok: 'hwa',
  hwa: 'to',
  to: 'geum',
  geum: 'su',
  su: 'mok',
}

/** 극(克) 관계: key가 value를 극함 */
export const ELEMENT_GEUK: Record<Element, Element> = {
  mok: 'to',
  hwa: 'geum',
  to: 'su',
  geum: 'mok',
  su: 'hwa',
}

/** 오늘 운세 등급 계산 (바이블 §2-4) */
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

/** ±1단계 랜덤 보정 20% (바이블 §2-4) */
const FORTUNE_ORDER: FortuneLevel[] = ['daehyung', 'hyung', 'pyeong', 'gil', 'daegil']

export function applyFortuneJitter(base: FortuneLevel): FortuneLevel {
  if (Math.random() >= 0.2) return base
  const idx = FORTUNE_ORDER.indexOf(base)
  const dir = Math.random() < 0.5 ? -1 : 1
  const newIdx = Math.max(0, Math.min(FORTUNE_ORDER.length - 1, idx + dir))
  return FORTUNE_ORDER[newIdx]
}

/** 오늘 운세 (일진 오행 계산 + 유저 일간 기준) */
export function getTodayFortune(ilganElement: Element): FortuneLevel {
  const todayElement = getTodayDayElement()
  const base = getDailyFortune(ilganElement, todayElement)
  return applyFortuneJitter(base)
}

/**
 * 음력 → 양력 변환 (UI 표시용)
 */
export function lunarToSolar(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  isLeap = false,
): { year: number; month: number; day: number } {
  const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay, isLeap)
  const solar = lunar.getSolar()
  return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() }
}

// 폴리필 — 천간/지지 한자 이름 export (heroes.ts에서 사용)
export {
  CHEONGAN_CHARS,
  JIJI_CHARS,
  CHEONGAN_ELEMENTS,
  JIJI_ELEMENTS,
  CHEONGAN_POLARITY,
  JIJI_POLARITY,
}
