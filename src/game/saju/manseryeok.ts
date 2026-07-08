/**
 * 만세력 사주 계산 모듈
 * yhj1024/manseryeok (MIT) 라이브러리 기반
 * M2 구현 — 생년월일 → 천간지지(년·월·일 3주) → 오행 빈도 집계 → 주 오행 결정
 *
 * W3 크로스체크 완료 (manseryeok.test.ts 참조)
 */

/**
 * 일주 계산 수학적 검증 기록 (W3 독립 검증 — 2026-07-04)
 *
 * 기준 앵커: 1900-01-01 = 甲戌日 (60갑자 index 10, 0-indexed 甲子=0)
 * 출처: 전통 만세력 공통 기준일, 복수 만세력 교차 확인된 앵커
 *
 * 검증 공식: index = (10 + days_from_19000101) mod 60
 *
 * 검증 케이스 (빌라드 독립 계산 → 라이브러리 출력값과 일치 확인):
 * - 1990-03-15: days=32945 → (10+32945)%60=15 → 己卯 ✓ (library: 己卯)
 * - 1985-08-20: days=31277 → (10+31277)%60=27 → 辛卯 ✓ (library: 辛卯)
 * ※ 케일 보고서의 도리안 수동계산(丙辰, 甲辰)은 오류였음.
 *   라이브러리 값이 수학적으로 정확함을 독립 검증으로 확인.
 *
 * 입춘 경계일 처리: manseryeok 라이브러리가 절기 분단위 정밀도로 처리.
 * 야자시(夜子時) 선택: 현재 자정 기준 채택 (M3 출생시간 기능 추가 시 재검토).
 */

import { calculateFourPillars } from 'manseryeok'
import type { FiveElement, ElementScore } from '@/types/elements'
import {
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from '@/types/elements'

// ────────────────────────────────────────────────────
// 내부 타입 — 만세력 라이브러리 반환 구조
// ────────────────────────────────────────────────────

/** 한글 천간명 → 漢字 천간 매핑 */
const HANGUL_STEM_TO_HANJA: Record<string, string> = {
  갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊',
  기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸',
}

/** 한글 지지명 → 漢字 지지 매핑 */
const HANGUL_BRANCH_TO_HANJA: Record<string, string> = {
  자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳',
  오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥',
}

/** 한글 오행 → FiveElement 매핑 */
const HANGUL_ELEMENT_TO_FIVE: Record<string, FiveElement> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
}

// ────────────────────────────────────────────────────
// 공개 타입
// ────────────────────────────────────────────────────

/** 년·월·일 3주 천간지지 */
export interface ThreePillars {
  year: { stem: string; branch: string; stemElement: FiveElement; branchElement: FiveElement }
  month: { stem: string; branch: string; stemElement: FiveElement; branchElement: FiveElement }
  day: { stem: string; branch: string; stemElement: FiveElement; branchElement: FiveElement }
}

/** 오행 분포 및 주 오행 결과 */
export interface SajuResult {
  pillars: ThreePillars
  elementScore: ElementScore
  primaryElement: FiveElement
  isTied: boolean
  tiedElements: FiveElement[]
  dayElement: FiveElement  // 동점 시 일간 우선 룰에 사용된 오행
}

// ────────────────────────────────────────────────────
// 내부 헬퍼
// ────────────────────────────────────────────────────

/**
 * 라이브러리 반환 한글 오행 문자열 → FiveElement 변환
 * 라이브러리는 '목'/'화'/'토'/'금'/'수' 형태로 반환한다
 */
function resolveElementFromHangul(hangul: string): FiveElement {
  const el = HANGUL_ELEMENT_TO_FIVE[hangul]
  if (!el) throw new Error(`알 수 없는 오행 한글: ${hangul}`)
  return el
}

/**
 * 라이브러리 반환 한글 천간/지지 → 오행 변환 (STEM_TO_ELEMENT / BRANCH_TO_ELEMENT 활용)
 * 라이브러리가 element를 직접 제공하므로 이를 우선 사용하되 타입 안전하게 변환
 */
function buildPillar(
  stemHangul: string,
  branchHangul: string,
  stemElementHangul: string,
  branchElementHangul: string,
): ThreePillars['year'] {
  const stemHanja = HANGUL_STEM_TO_HANJA[stemHangul]
  const branchHanja = HANGUL_BRANCH_TO_HANJA[branchHangul]

  let stemElement: FiveElement
  let branchElement: FiveElement

  // 라이브러리 제공 오행 문자열 우선 사용
  stemElement = resolveElementFromHangul(stemElementHangul)
  branchElement = resolveElementFromHangul(branchElementHangul)

  // fallback: 직접 매핑 (라이브러리 결과와 교차 검증 목적)
  if (stemHanja && STEM_TO_ELEMENT[stemHanja as keyof typeof STEM_TO_ELEMENT]) {
    const mapped = STEM_TO_ELEMENT[stemHanja as keyof typeof STEM_TO_ELEMENT]
    if (mapped !== stemElement) {
      // 불일치 시 elements.ts 매핑 우선 (전통 사주 기준)
      stemElement = mapped
    }
  }
  if (branchHanja && BRANCH_TO_ELEMENT[branchHanja as keyof typeof BRANCH_TO_ELEMENT]) {
    const mapped = BRANCH_TO_ELEMENT[branchHanja as keyof typeof BRANCH_TO_ELEMENT]
    if (mapped !== branchElement) {
      branchElement = mapped
    }
  }

  return {
    stem: stemHanja ?? stemHangul,
    branch: branchHanja ?? branchHangul,
    stemElement,
    branchElement,
  }
}

/** 빈 오행 점수 생성 */
function emptyScore(): ElementScore {
  return { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
}

// ────────────────────────────────────────────────────
// 공개 함수
// ────────────────────────────────────────────────────

/**
 * 생년월일로 3주(년·월·일) 천간지지 및 오행 분포를 계산하고 주 오행을 결정한다.
 *
 * @param year  양력 연도 (1800~2300)
 * @param month 양력 월 (1~12)
 * @param day   양력 일 (1~31)
 * @returns SajuResult
 *
 * 주 오행 결정 규칙:
 * 1. 년주 천간·지지 + 월주 천간·지지 + 일주 천간·지지 = 총 6 오행 점수 집계
 * 2. 점수 최고 오행이 주 오행
 * 3. 동점 시 일주 천간(일간) 오행 우선 선택
 * 4. 일간도 동점이면 그 중 오행 순서(木→火→土→金→水) 앞 오행 선택
 */
export function calculateSaju(year: number, month: number, day: number): SajuResult {
  // manseryeok 라이브러리 호출 (시간은 정오 12:00으로 고정 — 년·월·일만 사용하므로 시주 불필요)
  const raw = calculateFourPillars({
    year,
    month,
    day,
    hour: 12,
    minute: 0,
  })

  // 3주 구성
  const pillars: ThreePillars = {
    year: buildPillar(
      raw.year.heavenlyStem,
      raw.year.earthlyBranch,
      raw.yearElement.stem,
      raw.yearElement.branch,
    ),
    month: buildPillar(
      raw.month.heavenlyStem,
      raw.month.earthlyBranch,
      raw.monthElement.stem,
      raw.monthElement.branch,
    ),
    day: buildPillar(
      raw.day.heavenlyStem,
      raw.day.earthlyBranch,
      raw.dayElement.stem,
      raw.dayElement.branch,
    ),
  }

  // 오행 점수 집계 (6점 만점: 3주 × 천간·지지 각 1점)
  const elementScore = emptyScore()
  const elements: FiveElement[] = [
    pillars.year.stemElement,
    pillars.year.branchElement,
    pillars.month.stemElement,
    pillars.month.branchElement,
    pillars.day.stemElement,
    pillars.day.branchElement,
  ]
  for (const el of elements) {
    elementScore[el] += 1
  }

  // 최고 점수 확인
  const maxScore = Math.max(...Object.values(elementScore))
  const ORDER: FiveElement[] = ['木', '火', '土', '金', '水']
  const topElements = ORDER.filter(e => elementScore[e] === maxScore)

  const isTied = topElements.length > 1
  const dayElement = pillars.day.stemElement  // 일간(일주 천간) 오행

  let primaryElement: FiveElement
  if (!isTied) {
    primaryElement = topElements[0]
  } else if (topElements.includes(dayElement)) {
    // 동점 시 일간 우선
    primaryElement = dayElement
  } else {
    // 일간도 동점 중 없으면 오행 순서 앞 선택
    primaryElement = topElements[0]
  }

  return {
    pillars,
    elementScore,
    primaryElement,
    isTied,
    tiedElements: isTied ? topElements : [],
    dayElement,
  }
}

/**
 * 오늘 날짜의 일진(日辰) 천간 오행을 반환한다.
 *
 * 리라 스펙 §DailyElementBanner: manseryeok.ts의 calculateSaju(year,month,day)를
 * 오늘 날짜로 호출 → pillars.day.stemElement(일간 오행)를 일진 오행으로 채택.
 *
 * @param date - 기준 날짜 (기본값: 오늘)
 * @returns 오늘 일진의 천간 오행
 */
export function getDailyElement(date: Date = new Date()): FiveElement {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const result = calculateSaju(year, month, day)
  return result.pillars.day.stemElement
}

/**
 * 오늘 날짜의 일진 전체 데이터를 반환한다.
 * 배너 표시용 (천간 한자 + 오행)
 *
 * @param date - 기준 날짜 (기본값: 오늘)
 * @returns { stem: '甲', stemElement: '木' } 형태
 */
export function getDailyPillarInfo(date: Date = new Date()): {
  stem: string
  stemElement: FiveElement
} {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const result = calculateSaju(year, month, day)
  return {
    stem: result.pillars.day.stem,
    stemElement: result.pillars.day.stemElement,
  }
}

/**
 * 오행 점수를 백분율로 변환 (합계 6점 기준)
 * 바 차트 표시용
 */
export function elementScoreToPercent(score: ElementScore): Record<FiveElement, number> {
  const total = Object.values(score).reduce((a, b) => a + b, 0)
  if (total === 0) {
    return { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  }
  const ORDER: FiveElement[] = ['木', '火', '土', '金', '水']
  const result: Record<FiveElement, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  for (const el of ORDER) {
    result[el] = Math.round((score[el] / total) * 1000) / 10  // 소수 1자리
  }
  return result
}
