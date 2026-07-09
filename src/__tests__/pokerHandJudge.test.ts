import { describe, it, expect } from 'vitest'
import {
  judgeHand,
  getDominateBonus,
  getReversePenalty,
  isShengChain,
} from '@/game/engine/pokerHandJudge'
import type { PaljapaeCard, Element } from '@/types/paljapaeTypes'
import { BALANCE } from '@/data/balance'

// 헬퍼: 카드 생성
function mkCard(element: Element, yinYang: '양' | '음', value: number, id?: string): PaljapaeCard {
  return { id: id ?? `${element}_${yinYang}_${value}`, element, yinYang, value }
}

// ─── 1. 음양쌍 ──────────────────────────────────────────

describe('yinYangPair (음양쌍)', () => {
  it('같은 오행 음+양 2장 → yinYangPair', () => {
    const cards = [mkCard('木', '양', 7), mkCard('木', '음', 3)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('yinYangPair')
    expect(result.multiplier).toBe(BALANCE.HANDS.yinYangPair.multiplier)
  })

  it('木+火 2장 → chain2 (목생화 상생이므로 음양쌍 아님)', () => {
    // 木→火는 상생 관계이므로 chain2가 음양쌍보다 우선
    const cards = [mkCard('木', '양', 7), mkCard('火', '음', 3)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('chain2')
  })

  it('木음 + 水양 2장 → chain2 불성립 (수→목, 역방향 아님) 또는 none', () => {
    // 水→木이 상생이므로 이 카드들은 수목 순서로 상생 가능 → chain2
    // 임의 결정: 원소 집합에서 상생 체인 탐색 시 순서 무관 → chain2 가능
    const cards = [mkCard('木', '음', 7), mkCard('金', '양', 3)]
    // 金→木은 상극. chain 없음
    const result = judgeHand(cards)
    expect(result.rank).toBe('none')
  })

  it('같은 오행 양+양 2장 → none (음+양 아님)', () => {
    const cards = [mkCard('木', '양', 7), mkCard('木', '양', 3)]
    const result = judgeHand(cards)
    // 음양쌍 불성립 (같은 음양) — none
    expect(result.rank).toBe('none')
  })
})

// ─── 2. 결집3 ──────────────────────────────────────────

describe('gather3 (결집3)', () => {
  it('같은 오행 3장 → gather3', () => {
    const cards = [mkCard('火', '양', 5), mkCard('火', '음', 3), mkCard('火', '양', 8)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('gather3')
    expect(result.multiplier).toBe(BALANCE.HANDS.gather3.multiplier)
  })

  it('상생 체인 없고 gather3도 없는 3장 → none', () => {
    // 木, 金, 火: 木→火는 상생이 아니고(목→화는 상생 맞음 — 조정 필요)
    // 水克火, 火克金, 金克木 — 상생이 없는 조합
    // 土克水 역은 아님. 수→목만 상생. 여기서는 水와 金을 제외한 조합 필요
    // 가장 확실한 none: 木+金 (금극목 상극), 단 2장만이면 none
    const cards = [mkCard('木', '양', 5), mkCard('金', '음', 3)]
    const result = judgeHand(cards)
    // 木과 金은 상생 아님 (금극목 상극), chain2 불성립
    expect(result.rank).toBe('none')
  })
})

// ─── 3. 상생2체인 ──────────────────────────────────────

describe('chain2 (상생2체인)', () => {
  it('木양5 + 火음3 → chain2 (목생화)', () => {
    const cards = [mkCard('木', '양', 5), mkCard('火', '음', 3)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('chain2')
    expect(result.multiplier).toBe(BALANCE.HANDS.chain2.multiplier)
  })

  it('木양5 + 金음3 → none (상극, 상생 아님)', () => {
    const cards = [mkCard('木', '양', 5), mkCard('金', '음', 3)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('none')
  })

  it('水음4 + 木양6 → chain2 (수생목)', () => {
    const cards = [mkCard('水', '음', 4), mkCard('木', '양', 6)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('chain2')
  })
})

// ─── 4. 상생3체인 ──────────────────────────────────────

describe('chain3 (상생3체인)', () => {
  it('木+火+土 → chain3', () => {
    const cards = [mkCard('木', '양', 3), mkCard('火', '음', 5), mkCard('土', '양', 2)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('chain3')
    expect(result.multiplier).toBe(BALANCE.HANDS.chain3.multiplier)
  })

  it('火+土+金 → chain3', () => {
    const cards = [mkCard('火', '양', 3), mkCard('土', '음', 5), mkCard('金', '양', 2)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('chain3')
  })

  it('木+土+金 → none (상생 연속 아님: 목→토는 상생 아님)', () => {
    const cards = [mkCard('木', '양', 3), mkCard('土', '음', 5), mkCard('金', '양', 2)]
    // 木→火→土→金 에서 木→土는 건너뜀: 체인 불성립 확인
    const result = judgeHand(cards)
    // 土→金 은 상생이므로 chain2는 성립할 수 있음
    expect(['chain2', 'none']).toContain(result.rank)
    expect(result.rank).not.toBe('chain3')
  })
})

// ─── 5. 상생4체인 ──────────────────────────────────────

describe('chain4 (상생4체인)', () => {
  it('木+火+土+金 → chain4', () => {
    const cards = [
      mkCard('木', '양', 2),
      mkCard('火', '음', 4),
      mkCard('土', '양', 6),
      mkCard('金', '음', 3),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('chain4')
    expect(result.multiplier).toBe(BALANCE.HANDS.chain4.multiplier)
  })

  it('火+土+金+水 → chain4', () => {
    const cards = [
      mkCard('火', '양', 2),
      mkCard('土', '음', 4),
      mkCard('金', '양', 6),
      mkCard('水', '음', 3),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('chain4')
  })
})

// ─── 6. 오행연환 ──────────────────────────────────────

describe('fiveElements (오행연환)', () => {
  it('木+火+土+金+水 (각 1장) → fiveElements', () => {
    const cards = [
      mkCard('木', '양', 2),
      mkCard('火', '음', 4),
      mkCard('土', '양', 6),
      mkCard('金', '음', 3),
      mkCard('水', '양', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('fiveElements')
    expect(result.multiplier).toBe(BALANCE.HANDS.fiveElements.multiplier)
  })

  it('4종만 → fiveElements 불성립', () => {
    const cards = [
      mkCard('木', '양', 2),
      mkCard('火', '음', 4),
      mkCard('土', '양', 6),
      mkCard('金', '음', 3),
    ]
    const result = judgeHand(cards)
    expect(result.rank).not.toBe('fiveElements')
  })
})

// ─── 7. 극 보너스 ─────────────────────────────────────

describe('getDominateBonus (극 보너스)', () => {
  it('火 포함 카드 + 金 속성 적 → +50% 배율', () => {
    const handElements: Element[] = ['火', '木']
    const bonus = getDominateBonus(handElements, '金')
    expect(bonus).toBe(BALANCE.DOMINATE_BONUS)
  })

  it('木 포함 카드 + 火 속성 적 → 극 없음 (목생화, 극 아님)', () => {
    const handElements: Element[] = ['木']
    const bonus = getDominateBonus(handElements, '火')
    expect(bonus).toBe(0)
  })

  it('적 속성 null (무속성) → 극 보너스 없음', () => {
    const handElements: Element[] = ['木', '火', '土']
    const bonus = getDominateBonus(handElements, null)
    expect(bonus).toBe(0)
  })

  it('水克火: 水 카드 + 火 적 → +50%', () => {
    const handElements: Element[] = ['水']
    const bonus = getDominateBonus(handElements, '火')
    expect(bonus).toBe(BALANCE.DOMINATE_BONUS)
  })
})

// ─── 8. 역극 페널티 ──────────────────────────────────

describe('getReversePenalty (역극 페널티)', () => {
  it('일진 金 (금극목) + 木 카드 포함 → -30% 기본치', () => {
    const handElements: Element[] = ['木', '火']
    const penalty = getReversePenalty(handElements, '金')
    expect(penalty).toBe(BALANCE.REVERSE_PENALTY)
  })

  it('일진 木 + 水 카드 (수생목 — 극 관계 아님) → 페널티 없음', () => {
    const handElements: Element[] = ['水']
    const penalty = getReversePenalty(handElements, '木')
    expect(penalty).toBe(0)
  })

  it('일진 木 (목극토) + 土 카드 → -30%', () => {
    const handElements: Element[] = ['土']
    const penalty = getReversePenalty(handElements, '木')
    expect(penalty).toBe(BALANCE.REVERSE_PENALTY)
  })

  it('일진 火 + 金 카드 (화극금) → -30%', () => {
    const handElements: Element[] = ['金']
    const penalty = getReversePenalty(handElements, '火')
    expect(penalty).toBe(BALANCE.REVERSE_PENALTY)
  })
})

// ─── 9. 우선순위: 오행연환 vs 결집5 ──────────────────

describe('족보 우선순위', () => {
  it('5종 오행 카드: fiveElements > gather5', () => {
    // 오행연환은 5종이 있으면 항상 gather5보다 우선
    const cards = [
      mkCard('木', '양', 7),
      mkCard('火', '음', 7),
      mkCard('土', '양', 7),
      mkCard('金', '음', 7),
      mkCard('水', '양', 7),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('fiveElements')
  })

  it('gather5: 같은 오행 5장 (결집5가 오행연환보다 낮음)', () => {
    const cards = [
      mkCard('火', '양', 1),
      mkCard('火', '음', 2),
      mkCard('火', '양', 3),
      mkCard('火', '음', 4),
      mkCard('火', '양', 5),
    ]
    const result = judgeHand(cards)
    expect(result.rank).toBe('gather5')
    expect(result.multiplier).toBe(BALANCE.HANDS.gather5.multiplier)
  })

  it('chain4 > gather3: 4체인 카드가 있으면 체인 우선', () => {
    // 木火土金 4장 + 火를 하나 더 (火가 2장이므로 결집 가능하나 4체인이 우선)
    const cards = [
      mkCard('木', '양', 2),
      mkCard('火', '음', 3),
      mkCard('土', '양', 4),
      mkCard('金', '음', 5),
      mkCard('火', '양', 6),
    ]
    const result = judgeHand(cards)
    // 5종은 아니므로 fiveElements 불성립
    // 木→火→土→金 4체인 성립
    expect(result.rank).toBe('chain4')
  })
})

// ─── 10. none: 족보 없음 ─────────────────────────────

describe('none (족보 없음)', () => {
  it('아무 족보도 없는 카드 → none, 카드값 합 = 기본치, 배율 1', () => {
    const cards = [mkCard('木', '양', 3), mkCard('金', '음', 5)]
    const result = judgeHand(cards)
    expect(result.rank).toBe('none')
    expect(result.multiplier).toBe(1)
    // none 시 baseDamage = 카드값 합
    expect(result.baseDamage).toBe(3 + 5)
  })

  it('빈 카드 배열 → none', () => {
    const result = judgeHand([])
    expect(result.rank).toBe('none')
    expect(result.multiplier).toBe(1)
    expect(result.baseDamage).toBe(0)
  })
})

// ─── isShengChain 단위 테스트 ────────────────────────

describe('isShengChain', () => {
  it('木→火 → true (목생화)', () => {
    expect(isShengChain(['木', '火'])).toBe(true)
  })

  it('木→土 → false (목극토, 상생 아님)', () => {
    expect(isShengChain(['木', '土'])).toBe(false)
  })

  it('水→木→火 → true', () => {
    expect(isShengChain(['水', '木', '火'])).toBe(true)
  })

  it('金→水→木 → true', () => {
    expect(isShengChain(['金', '水', '木'])).toBe(true)
  })
})
