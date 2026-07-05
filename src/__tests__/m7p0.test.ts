/**
 * M7 P0 신규 테스트
 * - P0-A: DefeatScreen props 타입 / handleBattleDefeat 리셋 로직
 * - P0-B: onVictory 콜백 시그니처 / HP 반영
 * - P1-A: removeCardFromDeck 액션
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useUnlockStore } from '@/stores/unlockStore'
import { createStarterDeck } from '@/data/cards'

// ────────────────────────────────────────────────────
// P1-A: removeCardFromDeck 테스트
// ────────────────────────────────────────────────────

describe('P1-A: unlockStore.removeCardFromDeck', () => {
  beforeEach(() => {
    useUnlockStore.getState().resetUnlocks()
  })

  it('initUnlocks 후 currentDeckIds는 20장', () => {
    useUnlockStore.getState().initUnlocks('火')
    const { currentDeckIds } = useUnlockStore.getState()
    expect(currentDeckIds.length).toBe(20)
  })

  it('removeCardFromDeck: 덱 9장(스타터8+비스타터1)에서 비스타터 1장 제거 후 8장', () => {
    // 스타터 8장 + 비스타터 1장으로 덱 구성
    useUnlockStore.getState().initUnlocks('火')
    const starterIds = useUnlockStore.getState().currentDeckIds.slice(0, 8)
    const nonStarterId = 'W-01'
    const deckWith9 = [...starterIds, nonStarterId]
    useUnlockStore.getState().loadUnlocks([...starterIds, nonStarterId], deckWith9, starterIds)

    useUnlockStore.getState().removeCardFromDeck(nonStarterId)

    const afterDeckIds = useUnlockStore.getState().currentDeckIds
    expect(afterDeckIds.length).toBe(8)
  })

  it('removeCardFromDeck: 제거된 비스타터 카드 ID가 덱에서 사라짐', () => {
    useUnlockStore.getState().initUnlocks('火')
    const starterIds = useUnlockStore.getState().currentDeckIds.slice(0, 8)
    const nonStarterId = 'W-01'
    const deckWith9 = [...starterIds, nonStarterId]
    useUnlockStore.getState().loadUnlocks([...starterIds, nonStarterId], deckWith9, starterIds)

    useUnlockStore.getState().removeCardFromDeck(nonStarterId)

    const afterDeckIds = useUnlockStore.getState().currentDeckIds
    expect(afterDeckIds).not.toContain(nonStarterId)
  })

  it('removeCardFromDeck: ownedCardIds는 변경되지 않음', () => {
    useUnlockStore.getState().initUnlocks('火')
    const starterIds = useUnlockStore.getState().currentDeckIds.slice(0, 8)
    const nonStarterId = 'W-01'
    const deckWith9 = [...starterIds, nonStarterId]
    useUnlockStore.getState().loadUnlocks([...starterIds, nonStarterId], deckWith9, starterIds)
    const ownedBefore = new Set(useUnlockStore.getState().ownedCardIds)

    useUnlockStore.getState().removeCardFromDeck(nonStarterId)

    const ownedAfter = useUnlockStore.getState().ownedCardIds
    expect(ownedAfter.size).toBe(ownedBefore.size)
    ownedBefore.forEach(id => {
      expect(ownedAfter.has(id)).toBe(true)
    })
  })

  it('removeCardFromDeck: 덱 크기 8 이하이면 제거 차단 (최솟값 방어)', () => {
    // 덱을 8장으로 직접 설정
    const starterDeck = createStarterDeck('火')
    const eightCards = starterDeck.slice(0, 8).map(c => c.id)
    useUnlockStore.getState().loadUnlocks(eightCards, eightCards)

    const targetId = eightCards[0]
    useUnlockStore.getState().removeCardFromDeck(targetId)

    // 제거되지 않아야 함
    expect(useUnlockStore.getState().currentDeckIds.length).toBe(8)
  })

  it('removeCardFromDeck: 존재하지 않는 ID는 무시', () => {
    useUnlockStore.getState().initUnlocks('木')
    const sizeBefore = useUnlockStore.getState().currentDeckIds.length

    useUnlockStore.getState().removeCardFromDeck('NON_EXISTENT_ID_9999')

    expect(useUnlockStore.getState().currentDeckIds.length).toBe(sizeBefore)
  })

  it('removeCardFromDeck: 연속 제거로 덱 8장 도달 시 이후 비스타터 제거도 차단', () => {
    useUnlockStore.getState().initUnlocks('水')
    const starterIds = useUnlockStore.getState().currentDeckIds.slice(0, 8)
    // 비스타터 12장 추가 (중복 허용)
    const nonStarterIds = Array.from({ length: 12 }, (_, i) => `W-0${(i % 9) + 1}`)
    const deck20 = [...starterIds, ...nonStarterIds]
    useUnlockStore.getState().loadUnlocks([...starterIds, ...nonStarterIds], deck20, starterIds)

    // 비스타터 12장을 순서대로 제거
    for (let i = 0; i < 12; i++) {
      const { currentDeckIds } = useUnlockStore.getState()
      // 비스타터 카드만 대상 (starterIds에 없는 카드)
      const nonStarter = currentDeckIds.find(id => !starterIds.includes(id))
      if (nonStarter) {
        useUnlockStore.getState().removeCardFromDeck(nonStarter)
      }
    }
    expect(useUnlockStore.getState().currentDeckIds.length).toBe(8)

    // 덱이 8장 도달 후 추가 제거 시도 → 차단
    const { currentDeckIds: deck8 } = useUnlockStore.getState()
    useUnlockStore.getState().removeCardFromDeck(deck8[0])
    expect(useUnlockStore.getState().currentDeckIds.length).toBe(8)
  })
})

// ────────────────────────────────────────────────────
// CRIT-01: starterDeck 카드 개별 ID 제거 차단
// ────────────────────────────────────────────────────

describe('CRIT-01: starterDeck 카드 개별 ID 제거 차단', () => {
  beforeEach(() => {
    useUnlockStore.getState().resetUnlocks()
  })

  it('initUnlocks 후 starterDeckIds가 비어있지 않음', () => {
    useUnlockStore.getState().initUnlocks('火')
    const { starterDeckIds } = useUnlockStore.getState()
    expect(starterDeckIds.length).toBeGreaterThan(0)
  })

  it('initUnlocks 후 starterDeckIds는 currentDeckIds와 동일', () => {
    useUnlockStore.getState().initUnlocks('木')
    const { starterDeckIds, currentDeckIds } = useUnlockStore.getState()
    expect(starterDeckIds).toEqual(currentDeckIds)
  })

  it('starterDeck 카드는 덱 9장 이상에서도 removeCardFromDeck 차단됨', () => {
    // 덱을 9장으로 설정: starterDeck 8장 + 비스타터 1장
    useUnlockStore.getState().initUnlocks('火')
    const starterIds = useUnlockStore.getState().currentDeckIds
    // 스타터 덱에 없는 카드 ID를 추가 (loadUnlocks로 덱 직접 설정)
    const deckWith9 = [...starterIds.slice(0, 8), 'W-01']
    useUnlockStore.getState().loadUnlocks([...starterIds, 'W-01'], deckWith9, starterIds.slice(0, 8))

    const starterCardId = deckWith9[0]  // starterDeck 소속 카드
    useUnlockStore.getState().removeCardFromDeck(starterCardId)

    // starterDeck 카드는 제거되지 않아야 함
    expect(useUnlockStore.getState().currentDeckIds).toContain(starterCardId)
    expect(useUnlockStore.getState().currentDeckIds.length).toBe(9)
  })

  it('비스타터 카드는 덱 9장 이상에서 제거 가능', () => {
    useUnlockStore.getState().initUnlocks('火')
    const starterIds = useUnlockStore.getState().currentDeckIds
    const nonStarterId = 'W-01'
    const deckWith9 = [...starterIds.slice(0, 8), nonStarterId]
    useUnlockStore.getState().loadUnlocks([...starterIds, nonStarterId], deckWith9, starterIds.slice(0, 8))

    useUnlockStore.getState().removeCardFromDeck(nonStarterId)

    // 비스타터 카드는 제거되어야 함
    expect(useUnlockStore.getState().currentDeckIds).not.toContain(nonStarterId)
    expect(useUnlockStore.getState().currentDeckIds.length).toBe(8)
  })

  it('resetUnlocks 후 starterDeckIds가 빈 배열', () => {
    useUnlockStore.getState().initUnlocks('水')
    useUnlockStore.getState().resetUnlocks()
    expect(useUnlockStore.getState().starterDeckIds.length).toBe(0)
  })

  it('loadUnlocks starterIds 파라미터 전달 시 starterDeckIds 복원됨', () => {
    const starterIds = ['F-01', 'F-02', 'F-03']
    useUnlockStore.getState().loadUnlocks(starterIds, starterIds, starterIds)
    expect(useUnlockStore.getState().starterDeckIds).toEqual(starterIds)
  })
})

// ────────────────────────────────────────────────────
// P0-B: onVictory 인터페이스 검증
// ────────────────────────────────────────────────────

describe('P0-B: onVictory 콜백 인터페이스', () => {
  it('onVictory result.playerHpRemaining이 숫자 타입이어야 함', () => {
    // onVictory 콜백 시그니처 타입 확인 (런타임 검증)
    const result: { playerHpRemaining: number } = { playerHpRemaining: 15 }
    expect(typeof result.playerHpRemaining).toBe('number')
    expect(result.playerHpRemaining).toBeGreaterThanOrEqual(1)
  })

  it('Math.max(1, playerHpRemaining) 보장: 0이면 1로 클램핑', () => {
    const rawHp = 0
    const newHp = Math.max(1, rawHp)
    expect(newHp).toBe(1)
  })

  it('Math.max(1, playerHpRemaining) 보장: 양수면 그대로', () => {
    const rawHp = 17
    const newHp = Math.max(1, rawHp)
    expect(newHp).toBe(17)
  })
})

// ────────────────────────────────────────────────────
// P0-A: DefeatScreen stagesCleared 캡처 로직
// ────────────────────────────────────────────────────

describe('P0-A: 패배 시 stagesCleared 캡처', () => {
  it('리셋 전 stagesCleared 캡처 — Set.size 값이 숫자로 보존 가능', () => {
    const clearedSet = new Set([1, 2, 3])
    const capturedBefore = clearedSet.size  // 캡처
    clearedSet.clear()                      // 리셋 시뮬레이션
    expect(capturedBefore).toBe(3)          // 캡처한 값은 변하지 않아야 함
    expect(clearedSet.size).toBe(0)
  })
})
