/**
 * T17: 가호(십성) 엔진 구현 검증 — v2 기준
 * 배치 2 §1 10종 패시브 효과 유닛 테스트
 *
 * 식신·비견·겁재·상관·편재·정재·편인 (v2 효과 기준 재작성)
 *
 * 실행: npm test -- src/test/talismansT17.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Card, Element, GameState } from '../types/game'
import { playCards, createInitialGameState, discardCards } from '../engine/paljajeonEngine'

// 헬퍼: 카드 생성
function makeCard(id: string, element: Element, value: number): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

// 헬퍼: 가호 장착 GameState 생성 (v2 필드 포함)
function makeStateWithPassives(
  overrides: Partial<GameState> & { hand: Card[] },
  passiveIds: string[],
): GameState {
  const base = createInitialGameState(0)
  return {
    ...base,
    deck: [],
    discardPile: [],
    selectedCards: [],
    playsLeft: 10,
    discardsLeft: 3,
    enemyHp: 200,
    enemyMaxHp: 200,
    playerHp: 100,
    playerMaxHp: 100,
    attackCount: 0,
    activePassiveIds: passiveIds,
    rngState: 0x9E3779B9,
    geoptaeStealDamage: 0,
    sikshinRicegrains: 0,
    bigyeonCopyUsed: false,
    jeonginUsed: false,
    jeonginBuff: false,
    ...overrides,
  }
}

describe('T17 가호(십성) 엔진 — v2 효과 유닛 테스트', () => {

  describe('식신(食神) v2: 융합 시 밥알 5개 소비 ×1.3', () => {
    it('밥알 0개 + 융합: 식신 미발동 (단일 장도 보너스 없음)', () => {
      // v2: 낱장 ×1.2 보너스 폐지. 융합(ricegrains<5) 시에도 미발동.
      const card = makeCard('c1', 'hwa', 10)
      const stateWith = makeStateWithPassives(
        { hand: [card], currentFloor: 2, sikshinRicegrains: 0 },
        ['sikshin'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('c2', 'hwa', 10)], currentFloor: 2, sikshinRicegrains: 0 },
        [],
      )
      const afterWith = playCards(stateWith, ['c1'])
      const afterNo = playCards(stateNo, ['c2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // v2: 밥알 0개 → 식신 미발동 → 동일 damage
      expect(dmgWith).toBe(dmgNo)
    })

    it('밥알 5개 이상 + 융합: ×1.3 적용 후 밥알 -5', () => {
      // v2: 융합(2장) + ricegrains≥5 → ×1.3, ricegrains-=5
      const c1 = makeCard('c1', 'mok', 5)
      const c2 = makeCard('c2', 'hwa', 5)
      const stateWith = makeStateWithPassives(
        { hand: [c1, c2], currentFloor: 2, sikshinRicegrains: 5 },
        ['sikshin'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('n1', 'mok', 5), makeCard('n2', 'hwa', 5)], currentFloor: 2, sikshinRicegrains: 5 },
        [],
      )
      const afterWith = playCards(stateWith, ['c1', 'c2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 식신 발동: 더 큰 damage
      expect(dmgWith).toBeGreaterThan(dmgNo)
      // 밥알 소비: 5 → 0
      expect(afterWith.sikshinRicegrains).toBe(0)
    })

    it('버리기 시 sikshinRicegrains += 버린 장수', () => {
      // v2: discardCards → sikshinRicegrains 증가
      const c1 = makeCard('c1', 'mok', 5)
      const c2 = makeCard('c2', 'hwa', 5)
      const deck = [makeCard('d1', 'geum', 3), makeCard('d2', 'su', 3)]
      const state = makeStateWithPassives(
        { hand: [c1, c2], deck, sikshinRicegrains: 0 },
        ['sikshin'],
      )
      const after = discardCards(state, ['c1', 'c2'])
      expect(after.sikshinRicegrains).toBe(2)
    })
  })

  describe('비견(比肩) v2: 이번 전투 첫 융합 시 복제타 (damage의 50%)', () => {
    it('첫 융합 시 복제타 적용 → 적HP 추가 감소', () => {
      // v2: gather가 아닌 fusion 시 복제타 적용
      const c1 = makeCard('c1', 'mok', 5)
      const c2 = makeCard('c2', 'hwa', 5)
      const stateWith = makeStateWithPassives(
        { hand: [c1, c2], bigyeonCopyUsed: false },
        ['bigyeon'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('n1', 'mok', 5), makeCard('n2', 'hwa', 5)] },
        [],
      )
      const afterWith = playCards(stateWith, ['c1', 'c2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 비견: 복제타(50%) 추가 → damage 더 큼
      expect(dmgWith).toBeGreaterThan(dmgNo)
      // bigyeonCopyUsed = true (이번 전투 첫 융합 완료)
      expect(afterWith.bigyeonCopyUsed).toBe(true)
    })

    it('두 번째 융합: bigyeonCopyUsed=true → 복제 없음', () => {
      // v2: 이번 전투에서 이미 첫 복제 사용됨 → 이후 융합은 복제 없음
      const c1 = makeCard('c1', 'mok', 5)
      const c2 = makeCard('c2', 'hwa', 5)
      const deck = [makeCard('d1', 'su', 3), makeCard('d2', 'geum', 3), makeCard('d3', 'to', 3), makeCard('d4', 'mok', 3)]
      const stateWithUsed = makeStateWithPassives(
        { hand: [c1, c2], deck, bigyeonCopyUsed: true },
        ['bigyeon'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('n1', 'mok', 5), makeCard('n2', 'hwa', 5)], deck: [...deck] },
        [],
      )
      const afterWith = playCards(stateWithUsed, ['c1', 'c2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWithUsed.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 두 번째 융합은 복제 없음 → 동일 damage
      expect(dmgWith).toBeLessThanOrEqual(dmgNo + 1)  // 반올림 오차 허용
    })
  })

  describe('겁재(劫財) v2: 전투 시작 stealDamage 첫 공격 가산', () => {
    it('stealDamage > 0 일 때 첫 공격에 가산 → damage 증가 + geoptaeUsed=true', () => {
      // v2: geoptaeStealDamage가 있을 때 첫 공격에 가산, geoptaeUsed=true 설정
      // currentFloor=2(잔화령): heal gimmick 없음 → 순수 steal 기여 측정 가능
      const card = makeCard('m1', 'mok', 10)  // value=10
      const stateWith = makeStateWithPassives(
        { hand: [card], geoptaeStealDamage: 16, geoptaeUsed: false, currentFloor: 2 },
        ['geoptae'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('m2', 'mok', 10)], geoptaeStealDamage: 0, geoptaeUsed: false, currentFloor: 2 },
        ['geoptae'],
      )
      const afterWith = playCards(stateWith, ['m1'])
      const afterNo = playCards(stateNo, ['m2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // stealDamage=16 가산 시 damage가 더 큼
      expect(dmgWith).toBeGreaterThan(dmgNo)
      // 잔화령(hwa) 반격 boost 기믹 존재하지만 damage 자체에는 영향 없음 → diff=16
      expect(dmgWith - dmgNo).toBe(16)
      // geoptaeUsed = true (첫 공격 소비됨)
      expect(afterWith.geoptaeUsed).toBe(true)
      // stealDamage 소비 후 0
      expect(afterWith.geoptaeStealDamage).toBe(0)
    })

    it('두 번째 공격(geoptaeUsed=true): stealDamage 가산 없음', () => {
      // v2: 이미 소비됨 → 두 번째 공격은 보너스 없음
      const card = makeCard('m1', 'mok', 5)
      const stateUsed = makeStateWithPassives(
        { hand: [card], geoptaeStealDamage: 16, geoptaeUsed: true },
        ['geoptae'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('m2', 'mok', 5)], geoptaeStealDamage: 0, geoptaeUsed: false },
        ['geoptae'],
      )
      const afterUsed = playCards(stateUsed, ['m1'])
      const afterNo = playCards(stateNo, ['m2'])
      const dmgUsed = stateUsed.enemyHp - afterUsed.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 이미 사용됨 → 추가 없음
      expect(dmgUsed).toBe(dmgNo)
    })
  })

  describe('상관(傷官) v2: 황금비 정점(isRatioPeak) 시 RNG 배율', () => {
    it('상관 장착 시 정점 외 조합에서는 상관 효과 없음 (일반 조합)', () => {
      // v2: isRatioPeak가 true여야 발동. 일반 gather에서는 발동 안 함.
      const h1 = makeCard('h1', 'hwa', 5)
      const h2 = makeCard('h2', 'hwa', 5)
      const h3 = makeCard('h3', 'hwa', 5)
      const stateWith = makeStateWithPassives(
        { hand: [h1, h2, h3], currentFloor: 2 },
        ['sanggwan'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('n1', 'hwa', 5), makeCard('n2', 'hwa', 5), makeCard('n3', 'hwa', 5)], currentFloor: 2 },
        [],
      )
      const afterWith = playCards(stateWith, ['h1', 'h2', 'h3'])
      const afterNo = playCards(stateNo, ['n1', 'n2', 'n3'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // gather(모으기) 조합은 isRatioPeak=false → 상관 미발동 → 동일 damage
      expect(dmgWith).toBe(dmgNo)
    })

    it('불 2장이하 상관 미발동', () => {
      const h1 = makeCard('h1', 'hwa', 5)
      const h2 = makeCard('h2', 'hwa', 5)
      const stateWith = makeStateWithPassives({ hand: [h1, h2], currentFloor: 2 }, ['sanggwan'])
      const stateNo = makeStateWithPassives({ hand: [makeCard('n1', 'hwa', 5), makeCard('n2', 'hwa', 5)], currentFloor: 2 }, [])
      const afterWith = playCards(stateWith, ['h1', 'h2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // gather(모으기) → isRatioPeak=false → 동일
      expect(dmgWith).toBe(dmgNo)
    })

    it('불 1장 상관 미발동', () => {
      const h1 = makeCard('h1', 'hwa', 5)
      const stateWith = makeStateWithPassives({ hand: [h1], currentFloor: 2 }, ['sanggwan'])
      const stateNo = makeStateWithPassives({ hand: [makeCard('n1', 'hwa', 5)], currentFloor: 2 }, [])
      const afterWith = playCards(stateWith, ['h1'])
      const afterNo = playCards(stateNo, ['n1'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 낱장 → 미발동 → 동일
      expect(dmgWith).toBe(dmgNo)
    })
  })

  describe('편재(偏財) v2: 턴 종료 20% 확률 손패 추가', () => {
    it('금 카드로 목 적 극할 때 — v2: 턴 종료 훅(RNG 기반) 발동', () => {
      // v2: geuk 시 HP 회복 → RNG 기반 턴 종료 훅으로 변경
      // 1층 적 = mok → 금(geum)이 극 (v1 동작). v2에서는 효과가 다름.
      // 단순히 crash 없이 완료되는지 확인 (pyeonjae는 엔진 내 턴 종료 훅)
      const geumCard = makeCard('g1', 'geum', 5)
      const state = makeStateWithPassives(
        { hand: [geumCard], playerHp: 80, currentFloor: 1 },
        ['pyeonjae'],
      )
      // throw 없이 완료되어야 함
      const after = playCards(state, ['g1'])
      expect(after.playerHp).toBeGreaterThanOrEqual(0)
    })
  })

  describe('정재(正財) v2: 오행연환 발동 시 2장 드로우', () => {
    it('오행연환 + 정재 장착 시 손패에 카드 2장 추가 (드로우)', () => {
      // v2: 오행연환 시 damage 추가 없음 → 덱에서 2장 드로우
      const cards = [
        makeCard('m1', 'mok', 5), makeCard('h1', 'hwa', 5), makeCard('t1', 'to', 5),
        makeCard('g1', 'geum', 5), makeCard('s1', 'su', 5),
      ]
      const deck = [makeCard('d1', 'mok', 3), makeCard('d2', 'hwa', 3)]
      const stateWith = makeStateWithPassives({ hand: cards, deck }, ['jeongjae'])
      const stateNo = makeStateWithPassives({
        hand: [
          makeCard('m2', 'mok', 5), makeCard('h2', 'hwa', 5), makeCard('t2', 'to', 5),
          makeCard('g2', 'geum', 5), makeCard('s2', 'su', 5),
        ],
        deck: [makeCard('d3', 'mok', 3), makeCard('d4', 'hwa', 3)],
      }, [])
      const afterWith = playCards(stateWith, ['m1', 'h1', 't1', 'g1', 's1'])
      const afterNo = playCards(stateNo, ['m2', 'h2', 't2', 'g2', 's2'])
      // 정재 발동: 손패에 2장 추가 (드로우)
      expect(afterWith.hand.length).toBe(afterNo.hand.length + 2)
    })
  })

  describe('편인(偏印) v2: 소융합(2장) 시 피해 ×1.6', () => {
    it('2장 융합 시 damage ×1.6 적용 (소융합)', () => {
      // v2: isSmallFusion(2장 fusion-birth/hone) 시 ×1.6
      // currentFloor=2(잔화령): heal gimmick 없음 → 순수 damage 비교 가능
      const t1 = makeCard('t1', 'mok', 5)
      const t2 = makeCard('t2', 'hwa', 5)
      const stateWith = makeStateWithPassives(
        { hand: [t1, t2], enemyHp: 999, enemyMaxHp: 999, currentFloor: 2 },
        ['pyeonin'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('n1', 'mok', 5), makeCard('n2', 'hwa', 5)], enemyHp: 999, enemyMaxHp: 999, currentFloor: 2 },
        [],
      )
      const afterWith = playCards(stateWith, ['t1', 't2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 편인(소융합 2장) ×1.6
      expect(dmgWith).toBeGreaterThan(dmgNo)
      expect(dmgWith).toBe(Math.round(dmgNo * 1.6))
    })

    it('마지막 공격이 아닐 때 2장 소융합도 ×1.6 적용됨 (v2 변경)', () => {
      // v2: isLastAttack 조건 삭제 — 2장 융합이면 항상 ×1.6
      // currentFloor=2(잔화령): heal gimmick 없음
      const t1 = makeCard('t1', 'mok', 5)
      const t2 = makeCard('t2', 'hwa', 5)
      const stateWith = makeStateWithPassives(
        { hand: [t1, t2], isLastAttack: false, enemyHp: 999, enemyMaxHp: 999, currentFloor: 2 },
        ['pyeonin'],
      )
      const stateNo = makeStateWithPassives(
        { hand: [makeCard('n1', 'mok', 5), makeCard('n2', 'hwa', 5)], isLastAttack: false, enemyHp: 999, enemyMaxHp: 999, currentFloor: 2 },
        [],
      )
      const afterWith = playCards(stateWith, ['t1', 't2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // v2: isLastAttack 무관하게 소융합(2장)이면 ×1.6
      expect(dmgWith).toBeGreaterThan(dmgNo)
      expect(dmgWith).toBe(Math.round(dmgNo * 1.6))
    })
  })

})
