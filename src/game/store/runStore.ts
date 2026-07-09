/**
 * runStore — STS 런 전체 상태 관리 (Zustand)
 * Phase 4 신규 파일
 *
 * 런 시작 ~ 종료까지의 영속적 런 데이터:
 *   - 영웅 정보 (heroId, heroElement, HP)
 *   - 현재 덱 (CardInstance 목록)
 *   - 유물, 골드, 층수
 */

import { create } from 'zustand'
import type { CardInstance, CardDef } from '@/types/stsTypes'
import type { FiveElement } from '@/types/elements'

// ─── Store 인터페이스 ─────────────────────────────────

export interface RunStore {
  heroId: string | null
  heroElement: FiveElement | null
  deck: CardInstance[]
  relics: string[]
  gold: number
  hp: number
  maxHp: number
  floor: number

  /** 런 시작 */
  startRun(heroId: string, startingDeck: CardInstance[], element: FiveElement, hp?: number, maxHp?: number): void

  /** 카드 추가 (보상, 구매 등) */
  addCard(cardDef: CardDef): void

  /** 카드 제거 (카드 제거 서비스) */
  removeCard(instanceId: string): void

  /** 골드 획득 */
  gainGold(amount: number): void

  /** 골드 소비 */
  spendGold(amount: number): void

  /** HP 변경 (전투 결과 반영) */
  setHp(hp: number): void

  /** 층수 증가 */
  nextFloor(): void

  /** 유물 추가 */
  addRelic(relicId: string): void

  /** 런 초기화 */
  resetRun(): void
}

// ─── UUID 헬퍼 (crypto.randomUUID fallback) ──────────

function generateInstanceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `card_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// ─── Zustand Store ───────────────────────────────────

export const useRunStore = create<RunStore>((set, get) => ({
  heroId: null,
  heroElement: null,
  deck: [],
  relics: [],
  gold: 0,
  hp: 80,
  maxHp: 80,
  floor: 0,

  startRun(heroId, startingDeck, element, hp = 80, maxHp = 80) {
    set({
      heroId,
      heroElement: element,
      deck: startingDeck,
      relics: [],
      gold: 0,
      hp,
      maxHp,
      floor: 1,
    })
  },

  addCard(cardDef) {
    const newInstance: CardInstance = {
      instanceId: generateInstanceId(),
      defId: cardDef.id,
      upgraded: false,
    }
    set(prev => ({ deck: [...prev.deck, newInstance] }))
  },

  removeCard(instanceId) {
    set(prev => ({
      deck: prev.deck.filter(c => c.instanceId !== instanceId),
    }))
  },

  gainGold(amount) {
    set(prev => ({ gold: prev.gold + amount }))
  },

  spendGold(amount) {
    set(prev => ({ gold: Math.max(0, prev.gold - amount) }))
  },

  setHp(hp) {
    const { maxHp } = get()
    set({ hp: Math.max(0, Math.min(maxHp, hp)) })
  },

  nextFloor() {
    set(prev => ({ floor: prev.floor + 1 }))
  },

  addRelic(relicId) {
    set(prev => ({
      relics: prev.relics.includes(relicId) ? prev.relics : [...prev.relics, relicId],
    }))
  },

  resetRun() {
    set({
      heroId: null,
      heroElement: null,
      deck: [],
      relics: [],
      gold: 0,
      hp: 80,
      maxHp: 80,
      floor: 0,
    })
  },
}))
