/**
 * M4 언락 시스템 단위 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useUnlockStore, STAGE_UNLOCK_TREE, COMBO_UNLOCKS } from '@/stores/unlockStore'

// Zustand 스토어를 테스트 간 격리하기 위해 beforeEach에서 resetUnlocks 호출
beforeEach(() => {
  useUnlockStore.getState().resetUnlocks()
})

describe('initUnlocks — 초기화', () => {
  it('木 오행으로 초기화 시 ownedCardIds가 비어있지 않음', () => {
    useUnlockStore.getState().initUnlocks('木')
    const owned = useUnlockStore.getState().ownedCardIds
    expect(owned.size).toBeGreaterThan(0)
  })

  it('火 오행으로 초기화 시 currentDeckIds가 20개', () => {
    useUnlockStore.getState().initUnlocks('火')
    const deckIds = useUnlockStore.getState().currentDeckIds
    expect(deckIds.length).toBe(20)
  })

  it('초기화 후 pendingReward는 null', () => {
    useUnlockStore.getState().initUnlocks('土')
    expect(useUnlockStore.getState().pendingReward).toBeNull()
  })
})

describe('applyStageUnlock — 스테이지 클리어 카드 해금', () => {
  it('Stage 1 클리어 시 木 카드 3종 추가', () => {
    useUnlockStore.getState().initUnlocks('木')
    const before = useUnlockStore.getState().ownedCardIds.size

    useUnlockStore.getState().applyStageUnlock(1)
    const after = useUnlockStore.getState().ownedCardIds.size

    const unlocked = STAGE_UNLOCK_TREE[1]
    // 이미 보유하고 있을 수 있으므로 최소 동일하거나 증가
    expect(after).toBeGreaterThanOrEqual(before)
    // 언락된 카드 ID들이 보유 목록에 있어야 함
    unlocked.forEach(card => {
      expect(useUnlockStore.getState().ownedCardIds.has(card.id)).toBe(true)
    })
  })

  it('Stage 2 클리어 시 土 카드 3종 추가', () => {
    useUnlockStore.getState().initUnlocks('土')
    useUnlockStore.getState().applyStageUnlock(2)

    const unlocked = STAGE_UNLOCK_TREE[2]
    unlocked.forEach(card => {
      expect(useUnlockStore.getState().ownedCardIds.has(card.id)).toBe(true)
    })
  })
})

describe('offerReward + selectReward — 보상 선택 플로우', () => {
  it('offerReward 호출 시 pendingReward가 설정됨', () => {
    useUnlockStore.getState().initUnlocks('火')
    const pool = STAGE_UNLOCK_TREE[1]
    useUnlockStore.getState().offerReward(1, pool)

    const reward = useUnlockStore.getState().pendingReward
    expect(reward).not.toBeNull()
    expect(reward?.fromStageId).toBe(1)
    expect(reward?.cards.length).toBeGreaterThan(0)
    expect(reward?.cards.length).toBeLessThanOrEqual(3)
  })

  it('selectReward 호출 시 pendingReward 해소 + 카드 추가', () => {
    useUnlockStore.getState().initUnlocks('火')
    const pool = STAGE_UNLOCK_TREE[1]
    useUnlockStore.getState().offerReward(1, pool)

    const reward = useUnlockStore.getState().pendingReward!
    const cardToSelect = reward.cards[0]
    const beforeSize = useUnlockStore.getState().ownedCardIds.size

    useUnlockStore.getState().selectReward(cardToSelect.id)

    expect(useUnlockStore.getState().pendingReward).toBeNull()
    expect(useUnlockStore.getState().ownedCardIds.has(cardToSelect.id)).toBe(true)
    expect(useUnlockStore.getState().ownedCardIds.size).toBeGreaterThanOrEqual(beforeSize)
  })
})

describe('checkComboUnlocks — 콤보 언락', () => {
  it('Stage 1+2 모두 클리어 시 콤보 언락 발동', () => {
    useUnlockStore.getState().initUnlocks('木')
    const comboCards = COMBO_UNLOCKS[0].unlockCards

    useUnlockStore.getState().checkComboUnlocks([1, 2])

    comboCards.forEach(card => {
      expect(useUnlockStore.getState().ownedCardIds.has(card.id)).toBe(true)
    })
  })

  it('콤보 언락은 중복 발동되지 않음', () => {
    useUnlockStore.getState().initUnlocks('木')
    useUnlockStore.getState().checkComboUnlocks([1, 2])
    const sizeAfterFirst = useUnlockStore.getState().ownedCardIds.size

    useUnlockStore.getState().checkComboUnlocks([1, 2])
    const sizeAfterSecond = useUnlockStore.getState().ownedCardIds.size

    expect(sizeAfterFirst).toBe(sizeAfterSecond)
  })

  it('조건 미충족 시 콤보 발동 안 됨', () => {
    useUnlockStore.getState().initUnlocks('木')
    const comboCards = COMBO_UNLOCKS[1].unlockCards // [3, 4] 필요

    useUnlockStore.getState().checkComboUnlocks([1]) // 조건 미충족

    // 콤보 카드들이 보유에 없어도 무방 (초기 풀에 없으면)
    const owned = useUnlockStore.getState().ownedCardIds
    const comboCardNotIn = comboCards.filter(c => !owned.has(c.id))
    // 조건 미충족이므로 추가된 콤보 카드가 없어야 함
    expect(comboCardNotIn.length).toBe(comboCards.length)
  })
})

describe('saveDeck + getCurrentDeck', () => {
  it('saveDeck 후 getCurrentDeck으로 복원', () => {
    useUnlockStore.getState().initUnlocks('金')
    const deckIds = useUnlockStore.getState().currentDeckIds.slice(0, 10)
    useUnlockStore.getState().saveDeck(deckIds)

    expect(useUnlockStore.getState().currentDeckIds).toEqual(deckIds)
  })
})

describe('loadUnlocks — 진행 복원', () => {
  it('loadUnlocks로 보유 카드 복원', () => {
    const testIds = ['W-01', 'F-01', 'T-01']
    useUnlockStore.getState().loadUnlocks(testIds, [])

    testIds.forEach(id => {
      expect(useUnlockStore.getState().ownedCardIds.has(id)).toBe(true)
    })
  })

  it('loadUnlocks로 덱 ID 복원', () => {
    const deckIds = ['W-01', 'W-02', 'F-01']
    useUnlockStore.getState().loadUnlocks([], deckIds)

    expect(useUnlockStore.getState().currentDeckIds).toEqual(deckIds)
  })
})

describe('resetUnlocks — 초기화', () => {
  it('resetUnlocks 후 상태 초기화', () => {
    useUnlockStore.getState().initUnlocks('水')
    useUnlockStore.getState().resetUnlocks()

    expect(useUnlockStore.getState().ownedCardIds.size).toBe(0)
    expect(useUnlockStore.getState().currentDeckIds.length).toBe(0)
    expect(useUnlockStore.getState().pendingReward).toBeNull()
  })
})
