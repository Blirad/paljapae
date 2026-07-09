/**
 * 팔자전 — 족보 판정 엔진
 * 디자인 문서 C-3 기준 (PALJAPAE_DEV_BIBLE_V1)
 * 순수 함수 모듈 — UI 의존 없음, vitest 가능
 */

import type { Card, Element, HandJudgeResult, HandRank } from '../types/game'

// 오행 상생 관계: 목→화→토→금→수→목
const SAENGCHAE_MAP: Record<Element, Element> = {
  mok: 'hwa',
  hwa: 'to',
  to: 'geum',
  geum: 'su',
  su: 'mok',
}

// 오행 상극 관계: 목극토, 화극금, 토극수, 금극목, 수극화
const GEUK_MAP: Record<Element, Element> = {
  mok: 'to',
  hwa: 'geum',
  to: 'su',
  geum: 'mok',
  su: 'hwa',
}

// 족보 기본점수 및 배율 (A1: 용어 한글화 — 사주 모르는 사람 기준)
const RANK_CONFIG: Record<HandRank, { baseScore: number; multiplier: number; description: string }> = {
  'ohang-yeonhwan':  { baseScore: 200, multiplier: 10, description: '오행연환(五行連環) — 천지를 뒤흔들다' },
  'saengchae-chain': { baseScore: 120, multiplier: 7,  description: '기운 잇기 4 — 오행이 흐르다' },
  'geukchae-chain':  { baseScore: 100, multiplier: 6,  description: '이기는 기운 3단 — 힘이 꺾이다' },
  'eumyang-pair-3':  { baseScore: 80,  multiplier: 5,  description: '음양 짝 × 3 — 셋이 짝지다' },
  'jipgyeol-5':      { baseScore: 60,  multiplier: 4,  description: '같은 기운 모으기 5 — 뭉쳐 하나가 되다' },
  'saengchae-3':     { baseScore: 50,  multiplier: 3,  description: '기운 잇기 3 — 기운이 전하다' },
  'eumyang-pair-2':  { baseScore: 40,  multiplier: 2.5,description: '음양 짝 × 2 — 둘이 짝지다' },
  'jipgyeol-4':      { baseScore: 30,  multiplier: 2,  description: '같은 기운 모으기 4 — 모이다' },
  'geuk-bonas':      { baseScore: 20,  multiplier: 1.5,description: '이기는 기운 — 힘이 누른다' },
  'eumyang-pair-1':  { baseScore: 15,  multiplier: 1.3,description: '음양 짝 — 짝이 맞다' },
  'jipgyeol-3':      { baseScore: 10,  multiplier: 1.2,description: '같은 기운 모으기 3 — 셋이 모이다' },
  'none':            { baseScore: 5,   multiplier: 1,  description: '기세 없음' },
}

/** 상생 체인 길이 계산 */
function getSaengchaeChainLength(cards: Card[]): number {
  if (cards.length < 2) return 0
  const elements = cards.map(c => c.element)

  // 최장 상생 체인 탐색 (순서 무관)
  let maxChain = 0
  for (let start = 0; start < elements.length; start++) {
    let chain = 1
    let current = elements[start]
    const used = new Set([start])
    while (true) {
      const next = SAENGCHAE_MAP[current]
      const nextIdx = elements.findIndex((e, i) => e === next && !used.has(i))
      if (nextIdx === -1) break
      used.add(nextIdx)
      current = next
      chain++
    }
    maxChain = Math.max(maxChain, chain)
  }
  return maxChain
}

/** 오행연환 확인: 5장 전부, 5종 오행, 극/상생 순환 */
function isOhangYeonhwan(cards: Card[]): boolean {
  if (cards.length < 5) return false
  const elements = new Set(cards.map(c => c.element))
  return elements.size >= 5
}

/** 극 체인 확인 */
function getGeukChainLength(cards: Card[]): number {
  if (cards.length < 2) return 0
  const elements = cards.map(c => c.element)
  let maxChain = 0
  for (let start = 0; start < elements.length; start++) {
    let chain = 1
    let current = elements[start]
    const used = new Set([start])
    while (true) {
      const next = GEUK_MAP[current]
      const nextIdx = elements.findIndex((e, i) => e === next && !used.has(i))
      if (nextIdx === -1) break
      used.add(nextIdx)
      current = next
      chain++
    }
    maxChain = Math.max(maxChain, chain)
  }
  return maxChain
}

/** 음양쌍 개수 */
function countEumyangPairs(cards: Card[]): number {
  const byElement: Record<string, { yang: number; yin: number }> = {}
  for (const card of cards) {
    if (!byElement[card.element]) byElement[card.element] = { yang: 0, yin: 0 }
    byElement[card.element][card.polarity === 'yang' ? 'yang' : 'yin']++
  }
  let pairs = 0
  for (const el of Object.values(byElement)) {
    pairs += Math.min(el.yang, el.yin)
  }
  return pairs
}

/** 결집(동류) 최대 그룹 크기 */
function getMaxJipgyeol(cards: Card[]): number {
  const counts: Record<string, number> = {}
  for (const card of cards) {
    counts[card.element] = (counts[card.element] || 0) + 1
  }
  return Math.max(...Object.values(counts), 0)
}

/** 카드 합산 기본치 */
function sumValues(cards: Card[]): number {
  return cards.reduce((acc, c) => acc + c.value, 0)
}

/**
 * 족보 판정 메인 함수
 * @param selectedCards 출수할 카드 목록 (1~5장)
 * @returns HandJudgeResult
 */
export function judgeHand(selectedCards: Card[]): HandJudgeResult {
  if (selectedCards.length === 0) {
    return { rank: 'none', baseScore: 0, multiplier: 1, totalScore: 0, description: '카드 없음' }
  }

  const cardSum = sumValues(selectedCards)
  let rank: HandRank = 'none'

  // 우선순위 순서로 판정
  if (isOhangYeonhwan(selectedCards)) {
    rank = 'ohang-yeonhwan'
  } else {
    const saengchaeLen = getSaengchaeChainLength(selectedCards)
    const geukLen = getGeukChainLength(selectedCards)
    const eumyangPairs = countEumyangPairs(selectedCards)
    const jipgyeol = getMaxJipgyeol(selectedCards)

    if (saengchaeLen >= 4) {
      rank = 'saengchae-chain'
    } else if (geukLen >= 3) {
      rank = 'geukchae-chain'
    } else if (eumyangPairs >= 3) {
      rank = 'eumyang-pair-3'
    } else if (jipgyeol >= 5) {
      rank = 'jipgyeol-5'
    } else if (saengchaeLen >= 3) {
      rank = 'saengchae-3'
    } else if (eumyangPairs >= 2) {
      rank = 'eumyang-pair-2'
    } else if (jipgyeol >= 4) {
      rank = 'jipgyeol-4'
    } else if (eumyangPairs >= 1) {
      rank = 'eumyang-pair-1'
    } else if (jipgyeol >= 3) {
      rank = 'jipgyeol-3'
    } else if (geukLen >= 1) {
      rank = 'geuk-bonas'
    }
  }

  const config = RANK_CONFIG[rank]
  const baseScore = config.baseScore + cardSum
  const totalScore = Math.round(baseScore * config.multiplier)

  return {
    rank,
    baseScore,
    multiplier: config.multiplier,
    totalScore,
    description: config.description,
  }
}

export { SAENGCHAE_MAP, GEUK_MAP }
