/**
 * 카드 언락 시스템 Zustand 스토어 — M4
 * 마스터플랜 §8-3 기반
 *
 * - 보유 카드 풀 관리
 * - 승리 보상: 무작위 3장 제시 → 1장 선택 → 풀 추가
 * - 스테이지 클리어 언락 트리
 * - LocalStorage 연동 (persistence.ts와 협력)
 */

import { create } from 'zustand'
import type { Card } from '@/types/cards'
import type { FiveElement } from '@/types/elements'
import { saveCurrentDeckIds, saveStarterDeckIds, loadStarterDeckIds } from '@/utils/persistence'
import {
  // 초기 보유 풀 카드
  W01, W02, W03, W04, W05, W07,
  F01, F02, F03, F06, F07, F08, F11,
  T01, T02, T03, T04, T05, T06, T09,
  G01, G05, G06, G07, G09,
  H01, H04, H05, H07, H08, H10,
  N01, N02, N04, N05,
  // 언락 트리 카드
  W06, W08, W09, W10,
  F04, F09, F12,
  T07, T08, T10, T12,
  G02, G03, G08, G10,
  H02, H06, H09, H11,
  N03,
  LEGEND_WOOD, LEGEND_FIRE, LEGEND_EARTH, LEGEND_METAL, LEGEND_WATER,
  // 콤보 언락 카드
  N06, N07, N08,
  // 전체 카드 + 유틸
  ALL_CARDS,
  createStarterDeck,
} from '@/data/cards'

// ────────────────────────────────────────────────────
// 초기 보유 카드 풀 (오행별 기본 카드)
// 마스터플랜 §8-3: 초보 구간 고정 덱, 매 승리마다 카드 1장 언락
// ────────────────────────────────────────────────────

const INITIAL_UNLOCK_POOL: Card[] = [
  // 木 초기 (common)
  W01, W02, W03, W04, W05, W07,
  // 火 초기 (common)
  F01, F02, F03, F06, F07, F08, F11,
  // 土 초기 (common)
  T01, T02, T03, T04, T05, T06, T09,
  // 金 초기 (common)
  G01, G05, G06, G07, G09,
  // 水 초기 (common)
  H01, H04, H05, H07, H08, H10,
  // 중립 기본
  N01, N02, N04, N05,
]

// ────────────────────────────────────────────────────
// 스테이지 클리어 언락 트리
// ────────────────────────────────────────────────────

/** 스테이지 클리어 시 해금되는 카드 목록 */
export const STAGE_UNLOCK_TREE: Record<number, Card[]> = {
  1: [W06, W08, W09],               // Stage 1 클리어 → 木 카드 3종
  2: [T07, T10, T12],               // Stage 2 클리어 → 土 카드 3종
  3: [H02, H06, H11],               // Stage 3 클리어 → 水 카드 3종
  4: [G02, G08, G10],               // Stage 4 클리어 → 金 카드 3종 + 덱 편집
  5: [F04, F09, F12],               // Stage 5 클리어 → 火 고급 3종
  6: [LEGEND_WOOD, LEGEND_EARTH, LEGEND_METAL], // Stage 6 클리어 → 전설 3종
}

/** 복합 언락 조건 (여러 스테이지 모두 클리어 시) */
export interface ComboUnlock {
  requiredStageIds: number[]
  unlockCards: Card[]
  description: string
}

export const COMBO_UNLOCKS: ComboUnlock[] = [
  {
    requiredStageIds: [1, 2],
    unlockCards: [W10, T08, N03],
    description: '1지역 전체 클리어 → 희귀 카드 해금',
  },
  {
    requiredStageIds: [3, 4],
    unlockCards: [H09, G03, N06],
    description: '2지역 전체 클리어 → 고급 카드 해금',
  },
  {
    requiredStageIds: [1, 2, 3, 4, 5],
    unlockCards: [LEGEND_FIRE, LEGEND_WATER, N07, N08],
    description: '최종 보스 전 전체 클리어 → 전설 추가 해금',
  },
]

// ────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────

export interface RewardOffer {
  /** 제시된 3장 카드 */
  cards: Card[]
  /** 보상 출처 스테이지 ID */
  fromStageId: number
}

interface UnlockStore {
  /** 보유 카드 풀 (덱 편집에서 사용 가능한 전체 카드) */
  ownedCardIds: Set<string>

  /** 현재 덱 구성 (카드 ID 배열, 20장) */
  currentDeckIds: string[]

  /** 스타터 덱 카드 ID 목록 (initUnlocks 시 고정 — 제거 불가 보호) */
  starterDeckIds: string[]

  /** 진행 중인 보상 제시 (null = 없음) */
  pendingReward: RewardOffer | null

  /** 처리된 콤보 언락 ID (재발동 방지) */
  processedComboIds: Set<string>

  // ─── 액션 ───────────────────────────────────────

  /** 초기화: 오행에 맞는 시작 풀 + 덱 설정 */
  initUnlocks: (playerElement: FiveElement) => void

  /** 보상 제시 (스테이지 클리어 시) */
  offerReward: (stageId: number, pool: Card[]) => void

  /** 보상 카드 선택 */
  selectReward: (cardId: string) => void

  /** 스테이지 클리어 언락 처리 */
  applyStageUnlock: (stageId: number) => void

  /** 콤보 언락 체크 + 처리 */
  checkComboUnlocks: (clearedStageIds: number[]) => void

  /** 덱에서 카드 1장 제거 (P1-A: ownedCardIds 유지, currentDeckIds에서만 제거) */
  removeCardFromDeck: (cardId: string) => void

  /** 덱에서 카드 1장을 강화 버전으로 교체 (P1-B: upgradeCardInDeck) */
  upgradeCardInDeck: (deckId: string, upgradedCard: Card) => void

  /** 덱 구성 저장 */
  saveDeck: (cardIds: string[]) => void

  /** 보유 카드 목록 반환 (ID → Card 변환) */
  getOwnedCards: () => Card[]

  /** 현재 덱 카드 목록 반환 */
  getCurrentDeck: () => Card[]

  /** 진행 상태 불러오기 */
  loadUnlocks: (ownedCardIds: string[], deckIds: string[], starterIds?: string[]) => void

  /** 일일 뽑기에서 획득한 카드 ID 목록을 ownedCardIds에 추가 (M8 P1) */
  addOwnedCards: (cardIds: string[]) => void

  /** 초기화 */
  resetUnlocks: () => void
}

// ────────────────────────────────────────────────────
// 카드 ID → Card 매핑 (전체 카드 풀에서 조회)
// ────────────────────────────────────────────────────

const ALL_CARDS_MAP: Map<string, Card> = new Map(
  ALL_CARDS.map(c => [c.id, c])
)

function lookupCard(id: string): Card | undefined {
  // 원본 ID로 먼저 찾기
  if (ALL_CARDS_MAP.has(id)) return ALL_CARDS_MAP.get(id)
  // 스타터 덱 접미사 제거 후 찾기 (e.g., 'F-01_s0' → 'F-01')
  const baseId = id.replace(/_(?:s\d+|ai\d+|[a-z])$/, '')
  return ALL_CARDS_MAP.get(baseId)
}

// ────────────────────────────────────────────────────
// 무작위 보상 3장 선택 (중복 없이)
// ────────────────────────────────────────────────────

function pickRandomRewards(pool: Card[], ownedIds: Set<string>, count = 3): Card[] {
  // 아직 보유하지 않은 카드 우선
  const notOwned = pool.filter(c => !ownedIds.has(c.id))
  const source = notOwned.length >= count ? notOwned : pool
  const shuffled = [...source].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

// ────────────────────────────────────────────────────
// 스토어 구현
// ────────────────────────────────────────────────────

export const useUnlockStore = create<UnlockStore>((set, get) => ({
  ownedCardIds: new Set<string>(),
  currentDeckIds: [],
  starterDeckIds: [],
  pendingReward: null,
  processedComboIds: new Set<string>(),

  initUnlocks: (playerElement: FiveElement) => {
    // 초기 보유 풀: 공통 풀 전체
    const ownedCardIds = new Set(INITIAL_UNLOCK_POOL.map(c => c.id))
    // 시작 덱: 오행별 자동 생성
    const starterDeck = createStarterDeck(playerElement)
    const currentDeckIds = starterDeck.map(c => c.id)
    // P1-A: 스타터 덱 ID 목록 보존 (제거 불가 보호용)
    const starterDeckIds = [...currentDeckIds]
    saveStarterDeckIds(starterDeckIds)

    set({
      ownedCardIds,
      currentDeckIds,
      starterDeckIds,
      pendingReward: null,
      processedComboIds: new Set<string>(),
    })
  },

  offerReward: (stageId: number, pool: Card[]) => {
    const { ownedCardIds } = get()
    const offered = pickRandomRewards(pool, ownedCardIds, 3)
    set({
      pendingReward: {
        cards: offered,
        fromStageId: stageId,
      },
    })
  },

  selectReward: (cardId: string) => {
    const { pendingReward, ownedCardIds } = get()
    if (!pendingReward) return

    const newOwned = new Set(ownedCardIds)
    newOwned.add(cardId)

    set({
      ownedCardIds: newOwned,
      pendingReward: null,
    })
  },

  applyStageUnlock: (stageId: number) => {
    const unlockCards = STAGE_UNLOCK_TREE[stageId] ?? []
    if (unlockCards.length === 0) return

    set(state => {
      const newOwned = new Set(state.ownedCardIds)
      unlockCards.forEach(c => newOwned.add(c.id))
      return { ownedCardIds: newOwned }
    })
  },

  checkComboUnlocks: (clearedStageIds: number[]) => {
    const { processedComboIds } = get()
    const clearedSet = new Set(clearedStageIds)

    for (const combo of COMBO_UNLOCKS) {
      const comboKey = combo.requiredStageIds.sort().join(',')
      if (processedComboIds.has(comboKey)) continue
      if (combo.requiredStageIds.every(id => clearedSet.has(id))) {
        set(state => {
          const newOwned = new Set(state.ownedCardIds)
          combo.unlockCards.forEach(c => newOwned.add(c.id))
          const newProcessed = new Set(state.processedComboIds)
          newProcessed.add(comboKey)
          return { ownedCardIds: newOwned, processedComboIds: newProcessed }
        })
      }
    }
  },

  removeCardFromDeck: (cardId: string) => {
    // P1-A: currentDeckIds에서만 제거, ownedCardIds 유지
    // 방어 1: 덱 최솟값 8장 — 이하면 제거 불가
    const { currentDeckIds, starterDeckIds } = get()
    if (currentDeckIds.length <= 8) {
      console.warn('[unlockStore] removeCardFromDeck: 덱 최솟값(8장) 도달, 제거 차단')
      return
    }
    // 방어 2: starterDeck 카드 ID 개별 차단 (CRIT-01 수정)
    if (starterDeckIds.includes(cardId)) {
      console.warn('[unlockStore] removeCardFromDeck: starterDeck 카드 제거 차단', cardId)
      return
    }
    // 첫 번째 일치 항목만 제거 (중복 카드 고려)
    const idx = currentDeckIds.indexOf(cardId)
    if (idx === -1) {
      console.warn('[unlockStore] removeCardFromDeck: 카드 ID를 덱에서 찾지 못함', cardId)
      return
    }
    const newDeckIds = [...currentDeckIds.slice(0, idx), ...currentDeckIds.slice(idx + 1)]
    set({ currentDeckIds: newDeckIds })
    saveCurrentDeckIds(newDeckIds)
  },

  upgradeCardInDeck: (deckId: string, upgradedCard: Card) => {
    // P1-B: currentDeckIds에서 deckId를 찾아 upgradedCard.id로 교체
    // ownedCardIds에 강화 카드 ID 추가 (selectReward 패턴)
    const { currentDeckIds, ownedCardIds } = get()
    const idx = currentDeckIds.indexOf(deckId)
    if (idx === -1) {
      console.warn('[unlockStore] upgradeCardInDeck: 카드 ID를 덱에서 찾지 못함', deckId)
      return
    }
    const newDeckIds = [
      ...currentDeckIds.slice(0, idx),
      upgradedCard.id,
      ...currentDeckIds.slice(idx + 1),
    ]
    const newOwned = new Set(ownedCardIds)
    newOwned.add(upgradedCard.id)
    set({ currentDeckIds: newDeckIds, ownedCardIds: newOwned })
    saveCurrentDeckIds(newDeckIds)
  },

  saveDeck: (cardIds: string[]) => {
    set({ currentDeckIds: cardIds })
  },

  getOwnedCards: (): Card[] => {
    const { ownedCardIds } = get()
    const result: Card[] = []
    ownedCardIds.forEach(id => {
      const card = lookupCard(id)
      if (card) result.push(card)
    })
    return result
  },

  getCurrentDeck: (): Card[] => {
    const { currentDeckIds } = get()
    return currentDeckIds
      .map(id => lookupCard(id))
      .filter((c): c is Card => c !== undefined)
  },

  loadUnlocks: (ownedCardIds: string[], deckIds: string[], starterIds?: string[]) => {
    // starterIds가 전달되지 않으면 localStorage에서 복원 시도
    const resolvedStarterIds = starterIds ?? loadStarterDeckIds()
    set({
      ownedCardIds: new Set(ownedCardIds),
      currentDeckIds: deckIds,
      starterDeckIds: resolvedStarterIds,
    })
  },

  addOwnedCards: (cardIds: string[]) => {
    // M8 P1: 일일 뽑기 카드를 ownedCardIds + currentDeckIds에 추가
    set(state => {
      const newOwned = new Set(state.ownedCardIds)
      const newDeckIds = [...state.currentDeckIds]
      cardIds.forEach(id => {
        newOwned.add(id)
        // 덱이 20장 미만이면 자동으로 덱에도 추가
        if (newDeckIds.length < 20) {
          newDeckIds.push(id)
        }
      })
      saveCurrentDeckIds(newDeckIds)
      return { ownedCardIds: newOwned, currentDeckIds: newDeckIds }
    })
  },

  resetUnlocks: () => {
    set({
      ownedCardIds: new Set<string>(),
      currentDeckIds: [],
      starterDeckIds: [],
      pendingReward: null,
      processedComboIds: new Set<string>(),
    })
  },
}))

// ────────────────────────────────────────────────────
// 셀렉터
// ────────────────────────────────────────────────────

export const selectOwnedCount = (s: UnlockStore): number => s.ownedCardIds.size
export const selectHasPendingReward = (s: UnlockStore): boolean => s.pendingReward !== null
export const selectPendingReward = (s: UnlockStore): RewardOffer | null => s.pendingReward
