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

// --- A. 전투 규칙 3종 ---

/**
 * [기운 충돌] 판정: 조합 내 서로 극하는 기운이 공존하는 카드 쌍 탐색
 * 반환: 충돌하는 (공격자, 피해자) 오행 쌍 목록
 */
export interface ClashPair {
  attacker: Element  // 극하는 기운
  victim: Element    // 극 당하는 기운
}

export function detectElementClash(cards: Card[]): ClashPair[] {
  const elements = new Set(cards.map(c => c.element))
  const clashes: ClashPair[] = []
  for (const el of elements) {
    const target = GEUK_MAP[el]
    if (elements.has(target)) {
      clashes.push({ attacker: el, victim: target })
    }
  }
  return clashes
}

/**
 * [주 기운 원칙] 주 기운 결정:
 * 카드 수 최다 → 동수 시 합산값 최대 → 동점 시 첫 번째
 */
export interface PrimaryElement {
  element: Element
  count: number
  totalValue: number
}

export function determinePrimaryElement(cards: Card[]): PrimaryElement | null {
  if (cards.length === 0) return null
  const map: Record<string, { count: number; totalValue: number }> = {}
  for (const card of cards) {
    if (!map[card.element]) map[card.element] = { count: 0, totalValue: 0 }
    map[card.element].count++
    map[card.element].totalValue += card.value
  }
  let best: PrimaryElement | null = null
  for (const [el, stats] of Object.entries(map)) {
    if (
      !best ||
      stats.count > best.count ||
      (stats.count === best.count && stats.totalValue > best.totalValue)
    ) {
      best = { element: el as Element, count: stats.count, totalValue: stats.totalValue }
    }
  }
  return best
}

/**
 * [주 기운 원칙] 극 보너스 배율 계산:
 * 내 주 기운이 적 속성을 극하면 +50%, 아니면 +10%
 * (적을 이기는 기운이 존재하지만 주 기운이 아닌 경우 +10%)
 */
export function calcGeukBonusMultiplier(
  cards: Card[],
  enemyElement: Element,
): { multiplier: number; isMainGeuk: boolean; primaryElement: PrimaryElement | null } {
  // 조합에 극 관계가 있는지 확인
  const hasAnyGeuk = cards.some(c => GEUK_MAP[c.element] === enemyElement)
  if (!hasAnyGeuk) {
    return { multiplier: 1.0, isMainGeuk: false, primaryElement: null }
  }
  const primary = determinePrimaryElement(cards)
  if (!primary) {
    return { multiplier: 1.1, isMainGeuk: false, primaryElement: null }
  }
  const isMainGeuk = GEUK_MAP[primary.element] === enemyElement
  return {
    multiplier: isMainGeuk ? 1.5 : 1.1,
    isMainGeuk,
    primaryElement: primary,
  }
}

/**
 * [적의 반극] 판정:
 * 적의 주요 기운(카운트 최다)이 내 주 기운을 이기면 -30% 패널티
 */
export function detectYeokgeukPenalty(
  myCards: Card[],
  enemyElements: Element[],  // 적이 보유한 기운 목록
): { hasPenalty: boolean; enemyStrongest: Element | null; myPrimary: PrimaryElement | null } {
  if (enemyElements.length === 0) return { hasPenalty: false, enemyStrongest: null, myPrimary: null }
  const myPrimary = determinePrimaryElement(myCards)
  if (!myPrimary) return { hasPenalty: false, enemyStrongest: null, myPrimary: null }

  // 적의 최강 기운: 카운트 최다 기운
  const enemyCount: Record<string, number> = {}
  for (const el of enemyElements) {
    enemyCount[el] = (enemyCount[el] || 0) + 1
  }
  let enemyStrongest: Element | null = null
  let maxCount = 0
  for (const [el, cnt] of Object.entries(enemyCount)) {
    if (cnt > maxCount) {
      maxCount = cnt
      enemyStrongest = el as Element
    }
  }
  if (!enemyStrongest) return { hasPenalty: false, enemyStrongest: null, myPrimary }

  const hasPenalty = GEUK_MAP[enemyStrongest] === myPrimary.element
  return { hasPenalty, enemyStrongest, myPrimary }
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
