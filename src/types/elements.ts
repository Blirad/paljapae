/**
 * 오행 (五行) 타입 정의
 * M2 만세력 라이브러리(yhj1024/manseryeok)와 호환되는 구조
 * W1/M0 결정문 §2-4 기준
 */

/** 오행 기본 타입 */
export type FiveElement = '木' | '火' | '土' | '金' | '水'

/** 오행 영문 키 (Tailwind 클래스 연동용) */
export type FiveElementKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water'

/** 오행 → 영문 키 매핑 */
export const ELEMENT_KEY_MAP: Record<FiveElement, FiveElementKey> = {
  '木': 'wood',
  '火': 'fire',
  '土': 'earth',
  '金': 'metal',
  '水': 'water',
}

/** 오행 표시 정보 (리라 스펙 §1-1 디자인 토큰) */
export const ELEMENT_DISPLAY: Record<FiveElement, {
  label: string
  icon: string
  color: string
  gradient: string
}> = {
  '木': {
    label: '木 목',
    icon: '🌿',
    color: '#3D7A3A',
    gradient: 'linear-gradient(135deg, #1A2F1A 0%, #0D1A0D 100%)',
  },
  '火': {
    label: '火 화',
    icon: '🔥',
    color: '#C0392B',
    gradient: 'linear-gradient(135deg, #2F1A1A 0%, #1A0D0D 100%)',
  },
  '土': {
    label: '土 토',
    icon: '🏔',
    color: '#C07A1A',
    gradient: 'linear-gradient(135deg, #2F2510 0%, #1A1508 100%)',
  },
  '金': {
    label: '金 금',
    icon: '⚔',
    color: '#8B7536',
    gradient: 'linear-gradient(135deg, #252520 0%, #151510 100%)',
  },
  '水': {
    label: '水 수',
    icon: '💧',
    color: '#2563A8',
    gradient: 'linear-gradient(135deg, #1A1F2F 0%, #0D1220 100%)',
  },
}

/**
 * 상극 (相剋) 관계 — 왼쪽이 오른쪽을 이긴다
 * 木克土 / 土克水 / 水克火 / 火克金 / 金克木
 * 마스터플랜 §6-1
 */
export const DOMINATES: Record<FiveElement, FiveElement> = {
  '木': '土',
  '土': '水',
  '水': '火',
  '火': '金',
  '金': '木',
}

/**
 * 상생 (相生) 관계 — 왼쪽이 오른쪽을 생성한다
 * 木→火→土→金→水→木
 * 마스터플랜 §6-1
 */
export const GENERATES: Record<FiveElement, FiveElement> = {
  '木': '火',
  '火': '土',
  '土': '金',
  '金': '水',
  '水': '木',
}

/**
 * M2 만세력 호환 인터페이스 (yhj1024/manseryeok 타입 구조 참고)
 * 실제 라이브러리 통합은 M2에서 수행
 */
export interface Ganzhi {
  stem: HeavenlyStem    // 천간
  branch: EarthlyBranch // 지지
  element: FiveElement  // 오행
}

/** 천간 (天干) 10개 */
export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'

/** 지지 (地支) 12개 */
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'

/** 천간 → 오행 매핑 (마스터플랜 §5-1) */
export const STEM_TO_ELEMENT: Record<HeavenlyStem, FiveElement> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
}

/** 지지 → 오행 매핑 (마스터플랜 §5-1) */
export const BRANCH_TO_ELEMENT: Record<EarthlyBranch, FiveElement> = {
  '子': '水', '丑': '土',
  '寅': '木', '卯': '木',
  '辰': '土', '巳': '火',
  '午': '火', '未': '土',
  '申': '金', '酉': '金',
  '戌': '土', '亥': '水',
}

/** 오행 점수 분포 */
export type ElementScore = Record<FiveElement, number>
