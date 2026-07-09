import type { PaljapaeCard, HandRank, HandResult, Element } from '@/types/paljapaeTypes'
import { BALANCE } from '@/data/balance'

// 상생 순서: 木→火→土→金→水→木 (순환)
const SHENG_ORDER: Element[] = ['木', '火', '土', '金', '水']

// 상극: 木克土 / 火克金 / 土克水 / 金克木 / 水克火
const DOMINATES: Record<Element, Element> = {
  '木': '土',
  '火': '金',
  '土': '水',
  '金': '木',
  '水': '火',
}

// 상생 여부: a가 b를 생하는가 (a → b)
function shengNext(a: Element): Element {
  const idx = SHENG_ORDER.indexOf(a)
  return SHENG_ORDER[(idx + 1) % 5]
}

// 상생 체인 여부 확인 (순서 중요: 목화토금수)
// elements 배열이 연속 상생 관계를 이루는지 확인
export function isShengChain(elements: Element[]): boolean {
  if (elements.length < 2) return false
  for (let i = 0; i < elements.length - 1; i++) {
    if (shengNext(elements[i]) !== elements[i + 1]) return false
  }
  return true
}

// 주어진 원소 집합에서 최장 상생 체인을 찾는다
// 중복 원소는 한 번만 사용 (체인용)
function findLongestShengChain(elements: Element[]): Element[] {
  const uniqueElements = [...new Set(elements)]
  let best: Element[] = []

  // 상생 순서에서 연속 부분 수열 탐색
  for (let start = 0; start < SHENG_ORDER.length; start++) {
    const chain: Element[] = []
    for (let len = 0; len < SHENG_ORDER.length; len++) {
      const el = SHENG_ORDER[(start + len) % SHENG_ORDER.length]
      if (uniqueElements.includes(el)) {
        chain.push(el)
      } else {
        break
      }
    }
    if (chain.length > best.length) best = chain
  }
  return best
}

// 족보 판정 (최고 족보 1개 반환)
export function judgeHand(cards: PaljapaeCard[]): HandResult {
  if (cards.length === 0) {
    return { rank: 'none', baseDamage: 0, multiplier: 1 }
  }

  const elements = cards.map(c => c.element)
  const cardValueSum = cards.reduce((s, c) => s + c.value, 0)

  // 1. 오행연환 (5종 모두 포함 시)
  const uniqueEls = new Set(elements)
  if (uniqueEls.size === 5) {
    const b = BALANCE.HANDS.fiveElements
    return {
      rank: 'fiveElements',
      baseDamage: b.baseDamage + cardValueSum,
      multiplier: b.multiplier,
      chainElements: ['木', '火', '土', '金', '水'],
    }
  }

  // 원소별 카드 그루핑
  const elGroups: Map<Element, PaljapaeCard[]> = new Map()
  for (const c of cards) {
    if (!elGroups.has(c.element)) elGroups.set(c.element, [])
    elGroups.get(c.element)!.push(c)
  }

  // 최대 그룹 크기
  let maxGroupSize = 0
  for (const [, group] of elGroups) {
    if (group.length > maxGroupSize) {
      maxGroupSize = group.length
    }
  }

  // 2. 순수결집5 (같은 오행 5장)
  if (maxGroupSize >= 5) {
    const b = BALANCE.HANDS.gather5
    return {
      rank: 'gather5',
      baseDamage: b.baseDamage + cardValueSum,
      multiplier: b.multiplier,
    }
  }

  // 3. 결집4
  if (maxGroupSize >= 4) {
    const b = BALANCE.HANDS.gather4
    return {
      rank: 'gather4',
      baseDamage: b.baseDamage + cardValueSum,
      multiplier: b.multiplier,
    }
  }

  // 4. 상생4체인
  const chain4 = findLongestShengChain(elements)
  if (chain4.length >= 4) {
    const b = BALANCE.HANDS.chain4
    return {
      rank: 'chain4',
      baseDamage: b.baseDamage + cardValueSum,
      multiplier: b.multiplier,
      chainElements: chain4.slice(0, 4),
    }
  }

  // 5. 상생3체인
  if (chain4.length >= 3) {
    const b = BALANCE.HANDS.chain3
    return {
      rank: 'chain3',
      baseDamage: b.baseDamage + cardValueSum,
      multiplier: b.multiplier,
      chainElements: chain4.slice(0, 3),
    }
  }

  // 6. 결집3
  if (maxGroupSize >= 3) {
    const b = BALANCE.HANDS.gather3
    return {
      rank: 'gather3',
      baseDamage: b.baseDamage + cardValueSum,
      multiplier: b.multiplier,
    }
  }

  // 7. 상생2체인
  if (chain4.length >= 2) {
    const b = BALANCE.HANDS.chain2
    return {
      rank: 'chain2',
      baseDamage: b.baseDamage + cardValueSum,
      multiplier: b.multiplier,
      chainElements: chain4.slice(0, 2),
    }
  }

  // 8. 음양쌍: 같은 오행 음+양 2장
  for (const [el, group] of elGroups) {
    if (group.length >= 2) {
      const hasYang = group.some(c => c.yinYang === '양')
      const hasYin = group.some(c => c.yinYang === '음')
      if (hasYang && hasYin) {
        const b = BALANCE.HANDS.yinYangPair
        return {
          rank: 'yinYangPair',
          baseDamage: b.baseDamage + cardValueSum,
          multiplier: b.multiplier,
          chainElements: [el],
        }
      }
    }
  }

  // 9. none: 족보 없음
  return {
    rank: 'none',
    baseDamage: cardValueSum,
    multiplier: 1,
  }
}

// 극 보너스 계산
// 반환: 0 (없음) 또는 BALANCE.DOMINATE_BONUS
export function getDominateBonus(handElements: Element[], enemyElement: Element | null): number {
  if (enemyElement === null) return 0
  // 핸드에 적의 오행을 극하는 원소가 있으면 보너스
  for (const el of handElements) {
    if (DOMINATES[el] === enemyElement) return BALANCE.DOMINATE_BONUS
  }
  return 0
}

// 역극 페널티 계산
// 일진 오행이 내 카드 오행을 극하면 페널티
// 반환: 0 (없음) 또는 BALANCE.REVERSE_PENALTY (기본치에 적용)
export function getReversePenalty(handElements: Element[], dayElement: Element): number {
  // dayElement가 handElements 중 하나를 극하는 경우
  for (const el of handElements) {
    if (DOMINATES[dayElement] === el) return BALANCE.REVERSE_PENALTY
  }
  return 0
}

// 최종 피해 계산
export function calcDamage(
  cards: PaljapaeCard[],
  handResult: HandResult,
  enemyElement: Element | null,
  dayElement: Element,
  relics: string[],
  passives: string[]
): number {
  let baseDamage = handResult.baseDamage
  let multiplier = handResult.multiplier

  // 역극 페널티: 기본치에 적용
  const handElements = cards.map(c => c.element)
  const reversePenalty = getReversePenalty(handElements, dayElement)
  baseDamage = baseDamage * (1 + reversePenalty)

  // 극 보너스: 최종 배율에 적용
  const dominateBonus = getDominateBonus(handElements, enemyElement)

  // 패시브 적용
  if (passives.includes('sikshin')) {
    // 식신: 결집 족보 배율 +1
    const isGather = ['gather3', 'gather4', 'gather5'].includes(handResult.rank)
    if (isGather) multiplier += 1
  }
  if (passives.includes('bigyeon')) {
    // 비견: 결집 족보 기본치 +20
    const isGather = ['gather3', 'gather4', 'gather5'].includes(handResult.rank)
    if (isGather) baseDamage += 20
  }

  // 유물 적용
  if (relics.includes('ochsaek')) {
    // 오색실: 체인 족보 기본치 +15
    const isChain = ['chain2', 'chain3', 'chain4', 'fiveElements'].includes(handResult.rank)
    if (isChain) baseDamage += 15
  }
  if (relics.includes('pacheol')) {
    // 패철: 극 보너스 자동 (이미 getDominateBonus로 처리되지만 패철은 항상 적용)
    // 임의 결정: 패철은 적 속성 무관 극 보너스 +50% 고정
    if (!dominateBonus) multiplier *= (1 + BALANCE.DOMINATE_BONUS)
  }

  // 호리병: 체력 30 이하일 때 모든 배율 +1
  // (호리병 적용은 paljapaeEngine에서 state 참조 후 전달, 여기서는 relics 배열 체크로만)
  if (relics.includes('holibyeong')) {
    multiplier += 1
  }

  const finalMultiplier = multiplier * (1 + dominateBonus)
  const total = Math.floor(baseDamage * finalMultiplier)
  return Math.max(1, total)
}

// 오행 표시명
export const ELEMENT_DISPLAY: Record<Element, string> = {
  '木': '목(木)',
  '火': '화(火)',
  '土': '토(土)',
  '金': '금(金)',
  '水': '수(水)',
}

// 족보 표시명
export const HAND_RANK_DISPLAY: Record<HandRank, string> = {
  yinYangPair: '음양쌍',
  gather3: '결집 3',
  gather4: '결집 4',
  gather5: '순수결집 5',
  chain2: '상생 2체인',
  chain3: '상생 3체인',
  chain4: '상생 4체인',
  fiveElements: '오행연환',
  none: '낙수',
}
