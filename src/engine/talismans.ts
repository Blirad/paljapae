/**
 * 팔자전 — 부적술(符籍術) 시스템
 * Phase 1.6 B항목: 3종 부적 도입
 *
 * 1. 정화부(淨化符) — 무덤 카드를 손으로 복구
 * 2. 환패부(換牌符) — 핸드 전체 교체
 * 3. 증폭부(增幅符) — 다음 조합 데미지 ×2 (1회 소모)
 */

export type TalismanId = 'jeonghwa' | 'hwanpae' | 'jeungpok'

export interface Talisman {
  id: TalismanId
  name: string        // 한글 이름
  hanja: string       // 한자
  effect: string      // 효과 설명
  color: string       // 대표 색상 (오방색)
}

export const TALISMAN_DATA: Record<TalismanId, Talisman> = {
  jeonghwa: {
    id: 'jeonghwa',
    name: '정화부',
    hanja: '淨化符',
    effect: '무덤의 카드를 손으로 되돌린다',
    color: '#3D5A80',  // 수(水) — 정화 이미지
  },
  hwanpae: {
    id: 'hwanpae',
    name: '환패부',
    hanja: '換牌符',
    effect: '현재 손의 카드를 모두 버리고 새로 뽑는다',
    color: '#4A9B6E',  // 목(木) — 순환 이미지
  },
  jeungpok: {
    id: 'jeungpok',
    name: '증폭부',
    hanja: '增幅符',
    effect: '다음 공격 데미지가 2배가 된다 (1회 소모)',
    color: '#C63D2F',  // 화(火) — 폭발 이미지
  },
}

export const ALL_TALISMANS: Talisman[] = Object.values(TALISMAN_DATA)
