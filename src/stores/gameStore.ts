/**
 * 팔자전 — 게임 상태 Store (Zustand)
 * 층수 / 핸드 / 출수 카운트 관리
 */

import { create } from 'zustand'
import type { GameState, SavedHeroProfile } from '../types/game'
import { HERO_PROFILE_STORAGE_KEY } from '../types/game'
import {
  createInitialGameState,
  playCards,
  discardCards,
  advanceToNextFloor,
  activateJeonghwa,
  activateHwanpae,
  activateJeungpok,
  acquireTalisman,
  applyCondense,
  applyRewardOption,
  acquireSinsal,
  useSinsal,
  equipSlot,
  unequipSlot,
  seedCommonSlots,
} from '../engine/paljajeonEngine'
import type { SinsalId } from '../types/game'
import { HAND_SIZE, RELIC_DEFS, ROYAL_CARDS, ROYAL_DECK_CAP, createRoyalCard, countRoyalCards } from '../engine/balance'
import type { RelicId } from '../engine/balance'
import { judgeHand } from '../engine/pokerHandJudge'
import type { HandJudgeResult, Card, Element, Relic } from '../types/game'

// §2 왕족 등장 확률 (층 보상 카드 획득 시)
const ROYAL_APPEAR_RATE = 0.25

function generateRandomCard(currentDeck: Card[]): Card {
  const ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

  // §2 왕족 등장: 25% 확률 (덱 상한 미달 시)
  const currentRoyalCount = countRoyalCards(currentDeck)
  const canOfferRoyal = currentRoyalCount < ROYAL_DECK_CAP
  const royalRoll = Math.random()

  if (canOfferRoyal && royalRoll < ROYAL_APPEAR_RATE) {
    const el = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
    const isKing = Math.random() > 0.5
    const matchingDef = ROYAL_CARDS.find(d => d.element === el && d.royalType === (isKing ? 'king' : 'queen'))!
    return createRoyalCard(matchingDef, 10, `${Date.now()}-${Math.floor(Math.random() * 99999)}`)
  }

  // 평민 카드 (§1: 값 2~10)
  const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
  const value = Math.floor(Math.random() * 9) + 2
  return {
    id: `reward-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
    element,
    polarity: 'yang',
    value,
    type: 'soldier',
    rarity: 'common',
  }
}

function loadHeroProfileForStore(): SavedHeroProfile | null {
  try {
    const raw = localStorage.getItem(HERO_PROFILE_STORAGE_KEY)
    if (!raw) {
      console.log('[GameStore] ℹ️ localStorage에 사주 정보 없음')
      return null
    }
    const profile = JSON.parse(raw) as SavedHeroProfile
    console.log('[GameStore] ✅ 사주 로드 완료:', {
      ilganChar: profile.ilganChar,
      elementDist: profile.elementDist,
      deckSeed: profile.deckSeed,
    })
    return profile
  } catch (e) {
    console.error('[GameStore] ❌ 사주 로드 실패:', e)
    return null
  }
}

// B9: 전투 통계 (결과 근거)
interface BattleStats {
  totalPlaysUsed: number
  maxSingleDamage: number
  remainingEnemyHpAtEnd: number
}

interface GameStore extends GameState {
  // 실시간 족보 미리보기
  previewResult: HandJudgeResult | null

  // 인라인 안내 3종 플래그 (한 번만 표시)
  hasShownFirstHand: boolean
  hasShownFirstDiscard: boolean
  hasShownFirstAffinity: boolean

  // B9: 전투 통계
  battleStats: BattleStats

  // 액션
  // 통합 슬롯 개편 1단계: seedTalismanIds(선택 십성 가호 ID) 전달 시 common tier 슬롯 선점.
  startGame: (seedTalismanIds?: string[]) => void
  toggleCardSelect: (cardId: string) => void
  playSelectedCards: (effectMode?: boolean) => void
  discardSelectedCards: () => void
  proceedToNextFloor: (rewardIndex: number, selectedRelicId?: string, selectedSinsalId?: string, replaceSlotIndex?: number) => void
  resetGame: () => void
  markFirstHandShown: () => void
  markFirstDiscardShown: () => void
  markFirstAffinityShown: () => void
  updateBattleStats: (stats: Partial<BattleStats>) => void
  // Phase 1.6 B — 부적술
  useJeonghwa: () => void
  useHwanpae: () => void
  useJeungpok: () => void
  gainTalisman: (talismanId: string) => void
  // Phase 1.9.5: 응축 확정판 선택 적용 (장수 기반 % 배율)
  applyCondenseAction: (cardIds: string[]) => void
  // T17: 가호(십성) 장착
  setActivePassiveIds: (ids: string[]) => void
  // T8: 유물 획득 (중복 차단 내장)
  acquireRelic: (relicId: string) => void
  // §3 신살 사용 액션 — 공격·버리기와 별개 액션
  useSinsalAction: (sinsalId: SinsalId, targetCardId?: string) => void
  // 통합 슬롯 개편 1단계: 슬롯 해제(소멸) — 전투 밖에서만
  unequipSlotAction: (index: number) => void
}

const INITIAL_BATTLE_STATS: BattleStats = {
  totalPlaysUsed: 0,
  maxSingleDamage: 0,
  remainingEnemyHpAtEnd: 0,
}

export const useGameStore = create<GameStore>((set, get) => ({
  // DEV: expose store for screenshot automation (remove before release)
  ...(typeof window !== 'undefined' && ((window as any).__GAME_STORE__ = { getState: () => get(), setState: (s: any) => set(s) }), {}),
  ...createInitialGameState(0, loadHeroProfileForStore()),
  previewResult: null,

  // 인라인 안내 플래그 초기값
  hasShownFirstHand: false,
  hasShownFirstDiscard: false,
  hasShownFirstAffinity: false,

  // B9: 전투 통계 초기값
  battleStats: { ...INITIAL_BATTLE_STATS },

  startGame: (seedTalismanIds?: string[]) => {
    const hp = loadHeroProfileForStore()
    // 통합 슬롯 개편 1단계: 선택 십성 가호를 common tier로 슬롯 선점 ("타고남" 물화)
    let initial = createInitialGameState(0, hp)
    if (seedTalismanIds && seedTalismanIds.length > 0) {
      initial = seedCommonSlots(initial, seedTalismanIds)
    }
    set({ ...initial, previewResult: null, hasShownFirstHand: false, hasShownFirstDiscard: false, hasShownFirstAffinity: false, battleStats: { ...INITIAL_BATTLE_STATS } })
  },

  toggleCardSelect: (cardId: string) => {
    const state = get()
    const isSelected = state.selectedCards.includes(cardId)
    let newSelected: string[]

    if (isSelected) {
      newSelected = state.selectedCards.filter(id => id !== cardId)
    } else {
      if (state.selectedCards.length >= 5) return  // 최대 5장
      newSelected = [...state.selectedCards, cardId]
    }

    // 실시간 족보 판정
    const selectedCardObjs = state.hand.filter(c => newSelected.includes(c.id))
    const previewResult = newSelected.length > 0 ? judgeHand(selectedCardObjs) : null

    set({ selectedCards: newSelected, previewResult })
  },

  playSelectedCards: (effectMode?: boolean) => {
    const state = get()
    if (state.selectedCards.length === 0 || state.playsLeft <= 0) return
    const newState = playCards(state, state.selectedCards, effectMode)
    set({ ...newState, previewResult: null, selectedCards: [] })
  },

  discardSelectedCards: () => {
    const state = get()
    if (state.selectedCards.length === 0 || state.discardsLeft <= 0) return
    try {
      const newState = discardCards(state, state.selectedCards)
      set({ ...newState, previewResult: null, selectedCards: [] })
    } catch {
      // UI가 MAX_DISCARD_PER_USE 초과를 사전 차단하므로 여기 도달 불가
      // 방어 코드: throw 발생 시 상태 유지 (사용자에게 오류 노출 방지)
    }
  },

  proceedToNextFloor: (rewardIndex: number, selectedRelicId?: string, selectedSinsalId?: string, replaceSlotIndex?: number) => {
    const state = get()
    // §3 신살 추가: 보상 유형 확장 — add-sinsal 포함
    const REWARD_TYPES = ['add-card', 'upgrade-card', 'remove-card', 'add-relic', 'add-sinsal']
    const rewardType = REWARD_TYPES[rewardIndex] || 'add-card'

    // 현재 덱 수집 (hand + deck + discardPile)
    const allCurrentCards = [...state.hand, ...state.deck, ...state.discardPile]

    // 보상 유형별 적용
    let updatedDeck = allCurrentCards
    let newRelics = state.relics
    let updatedSinsalInventory = state.sinsalInventory ?? []
    // 통합 슬롯 개편 1단계 — 신살 획득 시 통합 슬롯(rare) 반영
    let updatedUnifiedSlots = state.unifiedSlots ?? []

    if (rewardType === 'add-card') {
      const newCard = generateRandomCard(allCurrentCards)
      updatedDeck = applyRewardOption(allCurrentCards, { type: 'add-card', card: newCard })
    } else if (rewardType === 'upgrade-card' && allCurrentCards.length > 0) {
      const upgradeTarget = allCurrentCards.reduce((best, card) =>
        card.value > best.value ? card : best
      )
      updatedDeck = applyRewardOption(allCurrentCards, {
        type: 'upgrade-card',
        targetId: upgradeTarget.id,
        bonusPct: 50
      })
    } else if (rewardType === 'remove-card' && allCurrentCards.length > 1) {
      const removeTarget = allCurrentCards.reduce((worst, card) =>
        card.value < worst.value ? card : worst
      )
      updatedDeck = applyRewardOption(allCurrentCards, {
        type: 'remove-card',
        targetId: removeTarget.id
      })
    } else if (rewardType === 'add-relic' && selectedRelicId) {
      // T8: 실제 유물 획득 — 중복 차단
      const alreadyHas = state.relics.some(r => r.id === selectedRelicId)
      if (!alreadyHas) {
        const relicDef = RELIC_DEFS[selectedRelicId as RelicId]
        if (relicDef) {
          const newRelic: Relic = { id: relicDef.id, name: relicDef.name, description: relicDef.description }
          newRelics = [...state.relics, newRelic]
        }
      }
    } else if (rewardType === 'add-sinsal' && selectedSinsalId) {
      // §3 신살 획득 — 통합 슬롯(rare) 장착
      // full 상태 + replaceSlotIndex 있으면: equipSlot 교체 경로 (기존 칸 소멸)
      // 빈 칸 있으면: acquireSinsal 단순 추가 경로
      const slots = state.unifiedSlots ?? []
      if (slots.length >= 5 && replaceSlotIndex !== undefined) {
        // floor-reward phase이므로 equipSlot이 허용됨
        const { state: nextState } = equipSlot(
          { ...state, phase: 'floor-reward' },
          { tier: 'rare', cardId: selectedSinsalId },
          replaceSlotIndex,
        )
        updatedSinsalInventory = nextState.sinsalInventory
        updatedUnifiedSlots = nextState.unifiedSlots
      } else {
        const result = acquireSinsal(state, selectedSinsalId as SinsalId)
        if (!result.rejected) {
          updatedSinsalInventory = result.state.sinsalInventory
          updatedUnifiedSlots = result.state.unifiedSlots
        }
      }
    }

    // 다음 층으로 진행 (통합 슬롯 반영 후 advance — advanceToNextFloor가 슬롯 런 유지)
    const newState = advanceToNextFloor({ ...state, unifiedSlots: updatedUnifiedSlots })

    // 적용된 덱 설정 (분배는 advanceToNextFloor 이후)
    const handSize = Math.min(HAND_SIZE, updatedDeck.length)
    set({
      ...newState,
      hand: updatedDeck.slice(0, handSize),
      deck: updatedDeck.slice(handSize),
      relics: newRelics,
      // 통합 슬롯 개편 1단계 — 통합 슬롯이 정본. advanceToNextFloor가 슬롯에서 sinsalInventory 파생.
      unifiedSlots: newState.unifiedSlots,
      sinsalInventory: newState.sinsalInventory ?? updatedSinsalInventory,
      previewResult: null,
      selectedCards: [],
    })
  },

  // §3 신살 사용 액션 — 공격·버리기와 별개. 화개(hwagae): targetCardId 필수
  useSinsalAction: (sinsalId: SinsalId, targetCardId?: string) => {
    const state = get()
    const nextState = useSinsal(state, sinsalId, targetCardId)
    set({ ...nextState })
  },

  // 통합 슬롯 개편 1단계: 슬롯 해제(소멸) — 전투 밖(floor-reward/result)에서만
  unequipSlotAction: (index: number) => {
    const state = get()
    const { state: nextState, rejected } = unequipSlot(state, index)
    if (!rejected) {
      set({ ...nextState })
    }
  },

  resetGame: () => {
    const hp = loadHeroProfileForStore()
    set({ ...createInitialGameState(0, hp), previewResult: null, hasShownFirstHand: false, hasShownFirstDiscard: false, hasShownFirstAffinity: false, battleStats: { ...INITIAL_BATTLE_STATS } })
  },

  markFirstHandShown: () => set({ hasShownFirstHand: true }),
  markFirstDiscardShown: () => set({ hasShownFirstDiscard: true }),
  markFirstAffinityShown: () => set({ hasShownFirstAffinity: true }),

  updateBattleStats: (stats: Partial<BattleStats>) => {
    const current = get().battleStats
    set({ battleStats: { ...current, ...stats } })
  },

  // Phase 1.6 B — 부적술 액션
  useJeonghwa: () => {
    const newState = activateJeonghwa(get())
    set({ ...newState, selectedCards: [] })
  },
  useHwanpae: () => {
    const newState = activateHwanpae(get())
    set({ ...newState, previewResult: null, selectedCards: [] })
  },
  useJeungpok: () => {
    const newState = activateJeungpok(get())
    set({ ...newState, selectedCards: [] })
  },
  gainTalisman: (talismanId: string) => {
    const newState = acquireTalisman(get(), talismanId)
    set({ ...newState, selectedCards: [] })
  },
  // Phase 1.9.5: 응축 확정판 — 선택된 카드 장수 기반 % 배율 자동 계산
  // R5 (balance-v3 §3): 응축 실효 배율에 용신 시너지 반영
  applyCondenseAction: (cardIds: string[]) => {
    const state = get()
    // [2026-07-18 이든 확정] 용신 상시 보너스 폐지 — 응축에도 상시 시너지 제거.
    // 정본 B-3: 용신 = 강림 슬롯 도래 시에만 사건.
    const synergyMultiplier = 1.0
    const newState = applyCondense(state, cardIds, synergyMultiplier)
    set({ ...newState, previewResult: null, selectedCards: [] })
  },
  // T17: 가호(십성) 장착 — BattleScreen 진입 시 PassiveDraft 선택 결과 반영
  setActivePassiveIds: (ids: string[]) => {
    set({ activePassiveIds: ids })
  },
  // T8: 유물 획득 — 중복 차단, 런 종료 시 소멸(resetGame에서 초기화됨)
  acquireRelic: (relicId: string) => {
    const state = get()
    const alreadyHas = state.relics.some(r => r.id === relicId)
    if (alreadyHas) return
    const relicDef = RELIC_DEFS[relicId as RelicId]
    if (!relicDef) return
    const newRelic: Relic = { id: relicDef.id, name: relicDef.name, description: relicDef.description }
    set({ relics: [...state.relics, newRelic] })
  },
}))
