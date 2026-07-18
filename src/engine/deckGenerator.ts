/**
 * 팔자전 — 사주 기반 덱 생성 (Phase 2)
 * 바이블 §2-4: 사주 오행 분포 비율대로 20장 배분
 *
 * 규칙:
 *  - 사주 글자 오행 분포 비율대로 속성 배분 (반올림, 최소 각 속성 1장 보장)
 *  - 음양 비율도 동일 원칙
 *  - 카드 값 1~10 균등 분포에서 시드 랜덤
 */

import type { Card, Element } from '../types/game'

const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
const DECK_SIZE = 20

/** LCG 난수 생성기 */
function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/**
 * 오행 분포 → 각 오행 카드 수 배분 (20장)
 *
 * T21-a 변경: 사주 오행이 0인 원소는 시작 덱에도 0장
 * 설계 의도: "부족 오행은 런 중 보상으로 수급" — 사주 특색을 덱 구성에 직접 반영
 * (이전: Math.max(1, ...) 최소 1장 보장 → 제거)
 */
function distributeCards(
  elementDist: Record<Element, number>,
  total: number,
): Record<Element, number> {
  const sum = ELEMENTS.reduce((acc, el) => acc + (elementDist[el] ?? 0), 0)
  if (sum === 0) {
    // 분포 없음 → 균등 (4,4,4,4,4)
    const even = Math.floor(total / ELEMENTS.length)
    const result = {} as Record<Element, number>
    ELEMENTS.forEach(el => { result[el] = even })
    return result
  }

  // 비율 계산 후 반올림 (0인 오행은 그대로 0)
  const rawCounts: Record<Element, number> = {} as Record<Element, number>
  let assigned = 0
  ELEMENTS.forEach(el => {
    const raw = ((elementDist[el] ?? 0) / sum) * total
    // T21-a: 사주 0인 오행 = 덱 0장 (최소 1장 보장 폐지)
    rawCounts[el] = (elementDist[el] ?? 0) === 0 ? 0 : Math.max(1, Math.round(raw))
    assigned += rawCounts[el]
  })

  // 합산이 total과 다를 경우 조정 (0이 아닌 원소 중 가장 많은/적은 원소에 ±1)
  let diff = total - assigned
  const nonZeroEls = ELEMENTS.filter(el => rawCounts[el] > 0)
  while (diff !== 0 && nonZeroEls.length > 0) {
    if (diff > 0) {
      // 0이 아닌 원소 중 가장 적은 원소 +1
      const minEl = nonZeroEls.reduce((a, b) => rawCounts[a] <= rawCounts[b] ? a : b)
      rawCounts[minEl]++
      diff--
    } else {
      // 2 이상인 가장 많은 원소 -1
      const maxEl = nonZeroEls.reduce((a, b) => rawCounts[a] >= rawCounts[b] ? a : b)
      if (rawCounts[maxEl] > 1) {
        rawCounts[maxEl]--
        diff++
      } else {
        break
      }
    }
  }

  return rawCounts
}

/**
 * 사주 오행 분포 → 20장 덱 생성
 * @param elementDist 오행 분포 (getSajuElementDistribution 결과)
 * @param seed 덱 랜덤 시드 (calcDeckSeed 결과)
 */
export function generateSajuDeck(
  elementDist: Record<Element, number>,
  seed: number,
): Card[] {
  const rng = makeLCG(seed)

  const countByElement = distributeCards(elementDist, DECK_SIZE)

  // 음양 비율도 동일 원칙 — 오행 분포와 동일하게 yang/yin 배분
  // 천간 음양 분포를 elementDist로부터 구성 (간이: 양 vs 음 균등)
  // 바이블에 음양 분포 별도 데이터 없음 → 1:1 균등 (임의 결정 로그 항목)

  const cards: Card[] = []
  let idCounter = 0

  ELEMENTS.forEach(el => {
    const count = countByElement[el] ?? 1
    for (let i = 0; i < count; i++) {
      // 값 2~10 균등 분포 (배치 2 §1: 값 1 삭제)
      const value = Math.floor(rng() * 9) + 2
      // 음양 속성 삭제 (배치 2 §1) — 평민은 'yang' 고정 (왕·여왕에서만 음양 존속)
      const polarity = 'yang' as const

      cards.push({
        id: `saju-${el}-${idCounter++}`,
        element: el,
        polarity,
        value,
        type: 'soldier',
        rarity: 'common',
      })
    }
  })

  return cards
}

export { distributeCards }
