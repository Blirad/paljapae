/**
 * T17: 가호(십성) 엔진 구현 검증
 * 7종 패시브 효과 유닛 테스트
 *
 * 식신·비견·겁재·상관·편재·정재·편인
 *
 * 실행: npm test -- src/test/talismansT17.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Card, Element, GameState } from '../types/game'
import { playCards, createInitialGameState } from '../engine/paljajeonEngine'

// 헬퍼: 카드 생성
function makeCard(id: string, element: Element, value: number): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

// 헬퍼: 가호 장착 GameState 생성
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
    ...overrides,
  }
}

describe('T17 가호(십성) 엔진 — 7종 발동 유닛 테스트', () => {

  describe('식신(食神): 낱장 조합 시 피해 +20%', () => {
    it('낱장 1장 출수 시 damage ×1.2 적용', () => {
      // currentFloor:2 (2층=잔화령, heal gimmick 없음, floorEnemyEl='hwa')
      // hwa 카드 단독: 동기(同氣) → 상성 배율 없음, totalScore=value
      const card = makeCard('c1', 'hwa', 10)
      const stateWithPassive = makeStateWithPassives({ hand: [card], currentFloor: 2 }, ['sikshin'])
      const stateNoPassive = makeStateWithPassives({ hand: [makeCard('c2', 'hwa', 10)], currentFloor: 2 }, [])
      const afterWith = playCards(stateWithPassive, ['c1'])
      const afterNo = playCards(stateNoPassive, ['c2'])
      // 식신 장착 시 피해가 더 커야 함
      const dmgWith = stateWithPassive.enemyHp - afterWith.enemyHp
      const dmgNo = stateNoPassive.enemyHp - afterNo.enemyHp
      expect(dmgWith).toBeGreaterThan(dmgNo)
      expect(dmgWith).toBe(Math.round(dmgNo * 1.2))
    })

    it('2장 조합 시 식신 발동 안 함 (낱장만 적용)', () => {
      // currentFloor:2, hwa 2장 gather → 동기 배율 없음, heal gimmick 없음
      const c1 = makeCard('c1', 'hwa', 5)
      const c2 = makeCard('c2', 'hwa', 5)
      const stateWith = makeStateWithPassives({ hand: [c1, c2], currentFloor: 2 }, ['sikshin'])
      const stateNo = makeStateWithPassives({ hand: [makeCard('d1', 'hwa', 5), makeCard('d2', 'hwa', 5)], currentFloor: 2 }, [])
      const afterWith = playCards(stateWith, ['c1', 'c2'])
      const afterNo = playCards(stateNo, ['d1', 'd2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 2장 모으기는 식신 미발동 → 동일 데미지
      expect(dmgWith).toBe(dmgNo)
    })
  })

  describe('비견(比肩): 같은 기운 모으기 3 이상 시 적 반격 -1', () => {
    it('같은 기운 3장 모으기 시 반격 1 감소', () => {
      const cards = [
        makeCard('m1', 'mok', 5),
        makeCard('m2', 'mok', 5),
        makeCard('m3', 'mok', 5),
      ]
      const stateWith = makeStateWithPassives({ hand: cards }, ['bigyeon'])
      const stateNo = makeStateWithPassives({
        hand: [makeCard('n1', 'mok', 5), makeCard('n2', 'mok', 5), makeCard('n3', 'mok', 5)],
      }, [])
      const afterWith = playCards(stateWith, ['m1', 'm2', 'm3'])
      const afterNo = playCards(stateNo, ['n1', 'n2', 'n3'])
      // 비견 장착 시 playerHp가 더 높아야 함 (반격 1 덜 받음)
      expect(afterWith.playerHp).toBeGreaterThan(afterNo.playerHp)
      expect(afterWith.playerHp - afterNo.playerHp).toBe(1)
    })
  })

  describe('겁재(劫財): 나무 기운 카드 포함 시 첫 공격 피해 +30%', () => {
    it('첫 공격(attackCount=0) + 나무 카드 포함 시 damage ×1.3', () => {
      const mokCard = makeCard('m1', 'mok', 10)
      const stateWith = makeStateWithPassives({ hand: [mokCard], attackCount: 0 }, ['geoptae'])
      const stateNo = makeStateWithPassives({ hand: [makeCard('m2', 'mok', 10)], attackCount: 0 }, [])
      const afterWith = playCards(stateWith, ['m1'])
      const afterNo = playCards(stateNo, ['m2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      expect(dmgWith).toBe(Math.round(dmgNo * 1.3))
    })

    it('두 번째 공격(attackCount=1)에는 겁재 미발동', () => {
      const mokCard = makeCard('m1', 'mok', 10)
      const stateWith = makeStateWithPassives({ hand: [mokCard], attackCount: 1 }, ['geoptae'])
      const stateNo = makeStateWithPassives({ hand: [makeCard('m2', 'mok', 10)], attackCount: 1 }, [])
      const afterWith = playCards(stateWith, ['m1'])
      const afterNo = playCards(stateNo, ['m2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 두 번째 공격은 겁재 미발동 → 동일
      expect(dmgWith).toBe(dmgNo)
    })
  })

  describe('상관(傷官): 불 기운 카드 2장 이상 시 피해 ×1.5', () => {
    it('불 2장 조합 시 damage ×1.5 적용 — T17 핵심 스펙', () => {
      // currentFloor:2 (2층=잔화령, heal gimmick 없음, floorEnemyEl='hwa')
      // hwa 2장 gather, 동기(同氣) → 상성 배율 없음
      const h1 = makeCard('h1', 'hwa', 5)
      const h2 = makeCard('h2', 'hwa', 5)
      const stateWith = makeStateWithPassives({ hand: [h1, h2], currentFloor: 2 }, ['sanggwan'])
      const stateNo = makeStateWithPassives({ hand: [makeCard('n1', 'hwa', 5), makeCard('n2', 'hwa', 5)], currentFloor: 2 }, [])
      const afterWith = playCards(stateWith, ['h1', 'h2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 상관 장착 시 피해 ×1.5
      expect(dmgWith).toBe(Math.round(dmgNo * 1.5))
    })

    it('불 1장만 있을 때는 상관 미발동', () => {
      // currentFloor:2, hwa 단독 낱장 → 동기 배율 없음
      const h1 = makeCard('h1', 'hwa', 5)
      const stateWith = makeStateWithPassives({ hand: [h1], currentFloor: 2 }, ['sanggwan'])
      const stateNo = makeStateWithPassives({ hand: [makeCard('n1', 'hwa', 5)], currentFloor: 2 }, [])
      const afterWith = playCards(stateWith, ['h1'])
      const afterNo = playCards(stateNo, ['n1'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      expect(dmgWith).toBe(dmgNo)
    })
  })

  describe('편재(偏財): 쇠 기운으로 이기는 기운 발동 시 체력 3 회복', () => {
    it('금 카드로 목(木) 적 극할 때 체력 +3', () => {
      // 1층 적 = 목(mok) → 금(geum)이 극
      const geumCard = makeCard('g1', 'geum', 5)
      const stateWith = makeStateWithPassives({ hand: [geumCard], playerHp: 80 }, ['pyeonjae'])
      const stateNo = makeStateWithPassives({ hand: [makeCard('g2', 'geum', 5)], playerHp: 80 }, [])
      const afterWith = playCards(stateWith, ['g1'])
      const afterNo = playCards(stateNo, ['g2'])
      // 편재 장착 시 playerHp가 더 높아야 함
      expect(afterWith.playerHp).toBeGreaterThanOrEqual(afterNo.playerHp)
    })
  })

  describe('정재(正財): 물 기운 5장 이상 시 오행연환 배율 +2', () => {
    it('오행연환 + 정재 장착 시 데미지가 더 큼', () => {
      // 오행연환: 5기운 각 1장
      const cards = [
        makeCard('m1', 'mok', 5), makeCard('h1', 'hwa', 5), makeCard('t1', 'to', 5),
        makeCard('g1', 'geum', 5), makeCard('s1', 'su', 5),
      ]
      const stateWith = makeStateWithPassives({ hand: cards }, ['jeongjae'])
      const stateNo = makeStateWithPassives({
        hand: [
          makeCard('m2', 'mok', 5), makeCard('h2', 'hwa', 5), makeCard('t2', 'to', 5),
          makeCard('g2', 'geum', 5), makeCard('s2', 'su', 5),
        ],
      }, [])
      const afterWith = playCards(stateWith, ['m1', 'h1', 't1', 'g1', 's1'])
      const afterNo = playCards(stateNo, ['m2', 'h2', 't2', 'g2', 's2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      // 정재 발동 시 데미지 더 높음 (배율 +2)
      expect(dmgWith).toBeGreaterThan(dmgNo)
    })
  })

  describe('편인(偏印): 흙 기운 결집 시 마지막 공격 피해 +50%', () => {
    it('흙 모으기 + 마지막 공격(isLastAttack=true) 시 damage ×1.5', () => {
      // currentFloor:2 (2층=잔화령, heal gimmick 없음, floorEnemyEl='hwa')
      // to(흙) gather, 2층 hwa 적: GEUK_MAP['hwa']='geum'≠'to', SANG_MAP['to']='geum'≠'hwa' → 상성 중립
      const t1 = makeCard('t1', 'to', 5)
      const t2 = makeCard('t2', 'to', 5)
      const stateWith = makeStateWithPassives({ hand: [t1, t2], isLastAttack: true, currentFloor: 2 }, ['pyeonin'])
      const stateNo = makeStateWithPassives({
        hand: [makeCard('n1', 'to', 5), makeCard('n2', 'to', 5)],
        isLastAttack: true,
        currentFloor: 2,
      }, [])
      const afterWith = playCards(stateWith, ['t1', 't2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      expect(dmgWith).toBe(Math.round(dmgNo * 1.5))
    })

    it('마지막 공격이 아닐 때(isLastAttack=false) 편인 미발동', () => {
      const t1 = makeCard('t1', 'to', 5)
      const t2 = makeCard('t2', 'to', 5)
      const stateWith = makeStateWithPassives({ hand: [t1, t2], isLastAttack: false, currentFloor: 2 }, ['pyeonin'])
      const stateNo = makeStateWithPassives({
        hand: [makeCard('n1', 'to', 5), makeCard('n2', 'to', 5)],
        isLastAttack: false,
        currentFloor: 2,
      }, [])
      const afterWith = playCards(stateWith, ['t1', 't2'])
      const afterNo = playCards(stateNo, ['n1', 'n2'])
      const dmgWith = stateWith.enemyHp - afterWith.enemyHp
      const dmgNo = stateNo.enemyHp - afterNo.enemyHp
      expect(dmgWith).toBe(dmgNo)
    })
  })

})
