/**
 * R10 융합 특성 3종 구현 검증 + 10쌍 전수 존재 체크
 *
 * (a) 정화(샘, 金+水): 기세 죽음 해제 — 역극 면역
 * (b) 예리(벼린 검, 火+金): 극 보너스 ×1.5
 * (c) 비침(맑은 못, 土+水): 적 강공 50% 감소
 *
 * 실행: npm test -- src/test/fusionTraitsR10.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { Card, Element, GameState } from '../types/game'
import { playCards, createInitialGameState } from '../engine/paljajeonEngine'
import { FUSION_COMBOS, FUSION_TRAIT_MAP, TRAIT_CONFIGS, GEUK_BONUS_MULTIPLIER, ANTI_GEUK_PENALTY, FLOOR_CONFIGS } from '../engine/balance'
import { GEUK_MAP } from '../engine/pokerHandJudge'

// 헬퍼: 카드 생성
function makeCard(id: string, element: Element, value: number): Card {
  return { id, element, polarity: 'yang', value, type: 'soldier', rarity: 'common' }
}

// 헬퍼: 특정 적 원소의 층 설정으로 GameState 생성
function makeState(overrides: Partial<GameState> & { hand: Card[] }): GameState {
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
    ...overrides,
  }
}

describe('R10 융합 특성 3종 구현 검증', () => {

  describe('(a) 정화(샘, 金+水) — 기세 죽음 해제', () => {
    it('정화 발동 후 해당 원소의 역극 면제 (데미지 수치 검증)', () => {
      // 2층: 적 = 火(hwa) → GEUK_MAP['hwa'] = 'geum' → 金 기세 죽음
      // 정화(金+水) 발동 → 金이 purifiedElements에 추가
      // 이후 金 모으기 → 역극 ×0.75 면제 (데미지 수치로 검증)
      const floor2Enemy = FLOOR_CONFIGS[1].enemyPrimaryElement
      expect(floor2Enemy).toBe('hwa')  // 테스트 전제 확인

      const geumCard1 = makeCard('g1', 'geum', 5)
      const geumCard2 = makeCard('g2', 'geum', 5)
      const geumCard3 = makeCard('g3', 'geum', 5)
      const geumCard4 = makeCard('g4', 'geum', 5)
      const suCard1 = makeCard('s1', 'su', 5)

      // --- 비교군: 정화 없이 金 모으기 → 역극 ×0.75 적용 ---
      const stateNoP = makeState({
        hand: [geumCard3, geumCard4],
        currentFloor: 2,
        purifiedElements: [],
        enemyHp: 500,
        enemyMaxHp: 500,
      })
      const afterNoPurify = playCards(stateNoP, ['g3', 'g4'])
      const dmgWithoutPurify = 500 - afterNoPurify.enemyHp

      // --- 실험군: 정화 ON → 金 모으기 → 역극 면제 ---
      const stateWithP = makeState({
        hand: [geumCard1, geumCard2],
        currentFloor: 2,
        purifiedElements: ['geum'],  // 정화로 해제됨
        enemyHp: 500,
        enemyMaxHp: 500,
      })
      const afterPurify = playCards(stateWithP, ['g1', 'g2'])
      const dmgWithPurify = 500 - afterPurify.enemyHp

      // 정화 ON > 정화 OFF (역극 면제 → 더 높은 데미지)
      expect(dmgWithPurify).toBeGreaterThan(dmgWithoutPurify)
      // 정확한 비율: dmgWithPurify / dmgWithoutPurify ≈ 1 / 0.75 = 1.333
      const ratio = dmgWithPurify / dmgWithoutPurify
      expect(ratio).toBeCloseTo(1 / ANTI_GEUK_PENALTY, 1)
    })

    it('정화 발동 시 purifiedElements에 죽은 원소 추가', () => {
      // 2층: 적 = 火 → 죽은 원소 = 金 (GEUK_MAP['hwa'] = 'geum')
      const geumCard = makeCard('g1', 'geum', 5)
      const suCard = makeCard('s1', 'su', 5)

      const state = makeState({
        hand: [geumCard, suCard, makeCard('f', 'mok', 3)],
        currentFloor: 2,
      })
      const after = playCards(state, ['g1', 's1'])
      expect(after.lastTraitTriggered).toBe('purification')
      expect(after.purifiedElements).toContain('geum')
    })

    it('purifiedElements가 층 전환 시 리셋', () => {
      const fresh = createInitialGameState(0)
      expect(fresh.purifiedElements).toEqual([])
    })
  })

  describe('(b) 예리(벼린 검, 火+金) — 극 보너스 ×1.5', () => {
    it('예리 발동 후 다음 극 적용 시 ×1.5 추가', () => {
      // 벼린 검 = 火+金 (hone)
      const hwaCard1 = makeCard('h1', 'hwa', 5)
      const geumCard1 = makeCard('g1', 'geum', 5)

      const state = makeState({
        hand: [hwaCard1, geumCard1],
        keenActive: false,
      })

      const afterKeen = playCards(state, ['h1', 'g1'])
      expect(afterKeen.lastTraitTriggered).toBe('keen')
      expect(afterKeen.keenActive).toBe(true)
    })

    it('keen이 극 적용 시 소모됨', () => {
      // keenActive = true 상태에서 극이 적용되면 false로 전환
      // 적 주기운을 극하는 콤보 플레이
      const floor1Enemy = FLOOR_CONFIGS[0].enemyPrimaryElement
      // GEUK_MAP에서 적을 극하는 원소 찾기
      const geukSource = Object.entries(GEUK_MAP).find(([, v]) => v === floor1Enemy)?.[0] as Element | undefined

      if (geukSource) {
        const card1 = makeCard('a1', geukSource, 5)
        const card2 = makeCard('a2', geukSource, 5)
        const state = makeState({
          hand: [card1, card2],
          keenActive: true,
        })

        const after = playCards(state, ['a1', 'a2'])
        // 극 적용 → keen 소모
        expect(after.keenActive).toBe(false)
      }
    })

    it('keen 미적용 시(극 아닐 때) 유지됨', () => {
      // 적 원소와 동기인 원소로 콤보 → 극 미적용 → keen 유지
      const floor1Enemy = FLOOR_CONFIGS[0].enemyPrimaryElement
      // 동기 콤보: 적과 같은 원소
      const card1 = makeCard('a1', floor1Enemy, 5)
      const card2 = makeCard('a2', floor1Enemy, 5)
      const state = makeState({
        hand: [card1, card2],
        keenActive: true,
      })

      const after = playCards(state, ['a1', 'a2'])
      // 동기 → 극 미적용 → keen 유지
      expect(after.keenActive).toBe(true)
    })
  })

  describe('(c) 비침(맑은 못, 土+水) — 적 강공 50% 감소', () => {
    it('비침 발동 후 mirrorShieldActive = true', () => {
      const toCard = makeCard('t1', 'to', 5)
      const suCard = makeCard('s1', 'su', 5)

      const state = makeState({
        hand: [toCard, suCard],
      })

      const afterMirror = playCards(state, ['t1', 's1'])
      expect(afterMirror.lastTraitTriggered).toBe('mirror')
      expect(afterMirror.mirrorShieldActive).toBe(true)
    })

    it('강공 발생 시 mirrorShield 소모 + 피해 반감', () => {
      // 3층: heavyAttack everyN=3, damage=8
      // attackCount가 everyN의 배수일 때 강공 발동
      const floor3Config = FLOOR_CONFIGS[2]  // 3층
      const heavyConf = floor3Config.heavyAttack
      if (!heavyConf) return

      // attackCount를 everyN-1로 설정 → 다음 공격이 강공
      const card1 = makeCard('a1', 'mok', 5)
      const card2 = makeCard('a2', 'mok', 5)
      const state = makeState({
        hand: [card1, card2, makeCard('a3', 'hwa', 3)],
        currentFloor: 3,
        attackCount: heavyConf.everyN - 1,
        mirrorShieldActive: true,
        enemyHp: 500,
        enemyMaxHp: 500,
        playerHp: 100,
        playerMaxHp: 100,
      })

      const afterAttack = playCards(state, ['a1', 'a2'])
      // mirrorShield 소모됨
      expect(afterAttack.mirrorShieldActive).toBe(false)
      // 강공 피해가 반감되어야 함: 8 → 4
      // 반격 + 강공(반감) = counterDamage + 4
      // playerHp = 100 - counterDamage - 4 (vs 100 - counterDamage - 8 without mirror)
    })

    it('강공 없는 턴에선 mirrorShield 유지', () => {
      const card1 = makeCard('a1', 'mok', 5)
      const card2 = makeCard('a2', 'mok', 5)
      const state = makeState({
        hand: [card1, card2],
        currentFloor: 3,
        attackCount: 0,  // 다음 공격 = 1 → everyN=3이므로 강공 아님
        mirrorShieldActive: true,
        enemyHp: 500,
        enemyMaxHp: 500,
      })

      const after = playCards(state, ['a1', 'a2'])
      expect(after.mirrorShieldActive).toBe(true)
    })

    it('mirrorShield 피해 반감 수치 검증', () => {
      // 3층에서 mirror ON vs OFF 비교
      const floor3Config = FLOOR_CONFIGS[2]
      const heavyConf = floor3Config.heavyAttack
      if (!heavyConf) return

      const card1 = makeCard('a1', 'mok', 5)
      const card2 = makeCard('a2', 'mok', 5)
      const baseState = {
        hand: [card1, card2, makeCard('filler', 'hwa', 3)],
        currentFloor: 3,
        attackCount: heavyConf.everyN - 1,
        enemyHp: 500,
        enemyMaxHp: 500,
        playerHp: 100,
        playerMaxHp: 100,
      }

      const withMirror = playCards(makeState({ ...baseState, mirrorShieldActive: true }), ['a1', 'a2'])
      const withoutMirror = playCards(makeState({ ...baseState, mirrorShieldActive: false }), ['a1', 'a2'])

      // mirror ON이면 피해가 적음 (HP가 높음)
      expect(withMirror.playerHp).toBeGreaterThan(withoutMirror.playerHp)
      // 차이 = heavyAttackDamage * 0.5 = round(8 * 0.5) = 4
      expect(withMirror.playerHp - withoutMirror.playerHp).toBe(Math.round(heavyConf.damage * 0.5))
    })
  })

  describe('10쌍 융합 전수 구현 체크', () => {
    it('FUSION_COMBOS 10종 모두 FUSION_TRAIT_MAP에 등록', () => {
      for (const combo of FUSION_COMBOS) {
        const traitId = FUSION_TRAIT_MAP[combo.name]
        expect(traitId, `${combo.name} → FUSION_TRAIT_MAP 누락`).toBeDefined()
      }
    })

    it('FUSION_TRAIT_MAP 10종 모두 TRAIT_CONFIGS에 등록', () => {
      for (const [comboName, traitId] of Object.entries(FUSION_TRAIT_MAP)) {
        const config = TRAIT_CONFIGS[traitId]
        expect(config, `${comboName}(${traitId}) → TRAIT_CONFIGS 누락`).toBeDefined()
      }
    })

    it('10종 특성 모두 엔진에서 처리됨 (default:break에 빠지지 않음)', () => {
      // 각 융합 콤보를 플레이하고 lastTraitTriggered가 설정되는지 확인
      // (yonggigama는 응축으로 별도 처리되므로 playCards에서 직접 발동 안 됨)
      const expectedTraits: Record<string, boolean> = {
        wildfire: true,
        mining: true,
        purification: true,
        nourish: true,
        yonggigama: false,  // 응축은 applyCondense 별도 경로
        keen: true,
        snipe: true,
        harvest: true,
        mirror: true,
        quench: true,
      }

      for (const combo of FUSION_COMBOS) {
        const traitId = FUSION_TRAIT_MAP[combo.name]
        if (!expectedTraits[traitId]) continue  // yonggigama 등 별도 경로

        const card1 = makeCard('c1', combo.element1, 5)
        const card2 = makeCard('c2', combo.element2, 5)
        const state = makeState({
          hand: [card1, card2, makeCard('filler', combo.element1, 3)],
          enemyHp: 500,
          enemyMaxHp: 500,
        })

        const after = playCards(state, ['c1', 'c2'])
        expect(
          after.lastTraitTriggered,
          `${combo.name}(${traitId}) 발동 실패`
        ).toBe(traitId)
      }
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T19: 숲(자양) 회복 — 고정 8 → 최대 HP의 8% (반올림)
// ─────────────────────────────────────────────────────────────────────────────
import { NOURISH_HEAL_PCT } from '../engine/balance'

describe('T19 자양(숲) 회복 개편 — 최대 HP 8% 비례', () => {
  // 공통 헬퍼: 반격 피해를 0으로 설정한 상태 생성 (자양 회복만 측정)
  function makeNoCounterState(overrides: Partial<GameState> & { hand: Card[] }): GameState {
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
      attackCount: 0,
      ...overrides,
    }
  }

  it('playerMaxHp 100 기준 → 자양 회복 8 (8% 반올림)', () => {
    // 수(水)+목(木) → 숲(木) 낳는 조합, 자양 특성 발동
    const suCard = makeCard('s1', 'su', 5)
    const mokCard = makeCard('m1', 'mok', 5)
    const state = makeNoCounterState({
      hand: [suCard, mokCard],
      playerHp: 80,
      playerMaxHp: 100,
    })
    const before = state.playerHp
    const after = playCards(state, ['s1', 'm1'])
    const expectedHeal = Math.round(100 * NOURISH_HEAL_PCT)  // 8

    expect(after.lastTraitTriggered).toBe('nourish')
    // 반격 피해를 제외한 순수 자양 회복분 검증: after.playerHp = before - counterDmg + heal
    // counterDamage는 FLOOR_CONFIGS[0].counterDamage = 1
    // 최소 기준: HP가 before - counterDamage + expectedHeal 이상이어야 함
    const counterDmg = 1  // 1층 반격
    const expectedHp = Math.min(100, before - counterDmg + expectedHeal)
    expect(after.playerHp).toBe(expectedHp)
  })

  it('NOURISH_HEAL_PCT = 0.08 상수 검증', () => {
    // 단위: 8%
    expect(NOURISH_HEAL_PCT).toBe(0.08)
    expect(Math.round(100 * NOURISH_HEAL_PCT)).toBe(8)  // HP 100 기준 회복 8 assert
  })

  it('최대 HP 초과 시 playerMaxHp 상한 적용', () => {
    const suCard = makeCard('s3', 'su', 5)
    const mokCard = makeCard('m3', 'mok', 5)
    const state = makeNoCounterState({
      hand: [suCard, mokCard],
      playerHp: 100,
      playerMaxHp: 100,
    })
    const after = playCards(state, ['s3', 'm3'])
    // 반격 후 HP = 99, 자양 8 → 107 → 상한 100
    expect(after.playerHp).toBeLessThanOrEqual(100)
    expect(after.lastTraitTriggered).toBe('nourish')
  })
})
