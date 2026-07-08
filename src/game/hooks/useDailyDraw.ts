/**
 * useDailyDraw — 일일 카드 뽑기 커스텀 훅 (M8 P1)
 *
 * 규칙:
 *  - 하루 1회, 3장 무료 뽑기
 *  - localStorage 'paljapae_last_draw_date' (YYYY-MM-DD) 기반 일일 초기화
 *  - 등급별 확률: common=40%, uncommon=30%, rare=15%, epic=10%, legendary=4%, celestial=1%
 *  - 덱에 추가 또는 넘기기 선택
 */

import { useState, useCallback } from 'react'
import type { Card, Rarity } from '@/types/cards'
import { ALL_CARDS } from '@/data/cards'

// ─────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────

const STORAGE_KEY = 'paljapae_last_draw_date'
const DRAW_COUNT = 3

/** 등급별 뽑기 가중치 (합계: 100) */
const RARITY_WEIGHTS: Record<Rarity, number> = {
  common:    40,
  uncommon:  30,
  rare:      15,
  epic:      10,
  legendary:  4,
  celestial:  1,
}

// ─────────────────────────────────────────────────────
// 날짜 유틸
// ─────────────────────────────────────────────────────

function getTodayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getLastDrawDate(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setLastDrawDate(dateStr: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, dateStr)
  } catch {
    // localStorage 접근 불가 무시
  }
}

export function hasDrawnToday(): boolean {
  const last = getLastDrawDate()
  if (!last) return false
  return last === getTodayString()
}

// ─────────────────────────────────────────────────────
// 가중치 기반 등급 선택
// ─────────────────────────────────────────────────────

function pickRarity(): Rarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [Rarity, number][]) {
    rand -= weight
    if (rand <= 0) return rarity
  }
  return 'common'
}

// ─────────────────────────────────────────────────────
// 뽑기 로직
// ─────────────────────────────────────────────────────

export function drawCards(count: number = DRAW_COUNT): Card[] {
  const result: Card[] = []
  const usedIds = new Set<string>()

  for (let i = 0; i < count; i++) {
    const rarity = pickRarity()
    const pool = ALL_CARDS.filter(c => c.rarity === rarity && !usedIds.has(c.id))
    if (pool.length === 0) {
      // 해당 등급 풀 소진 시 common으로 폴백
      const fallback = ALL_CARDS.filter(c => c.rarity === 'common' && !usedIds.has(c.id))
      if (fallback.length === 0) continue
      const pick = fallback[Math.floor(Math.random() * fallback.length)]
      usedIds.add(pick.id)
      result.push(pick)
    } else {
      const pick = pool[Math.floor(Math.random() * pool.length)]
      usedIds.add(pick.id)
      result.push(pick)
    }
  }

  return result
}

// ─────────────────────────────────────────────────────
// 훅 반환 타입
// ─────────────────────────────────────────────────────

export interface DrawnCardState {
  card: Card
  revealed: boolean
  kept: boolean | null  // null=미결정, true=덱에 추가, false=넘기기
}

export interface UseDailyDrawReturn {
  canDraw: boolean
  drawnCards: DrawnCardState[]
  currentRevealIdx: number
  isComplete: boolean
  draw: () => void
  revealCard: (idx: number) => void
  keepCard: (idx: number) => void
  skipCard: (idx: number) => void
  reset: () => void
}

// ─────────────────────────────────────────────────────
// useDailyDraw 훅
// ─────────────────────────────────────────────────────

export function useDailyDraw(): UseDailyDrawReturn {
  const [canDraw, setCanDraw] = useState<boolean>(() => !hasDrawnToday())
  const [drawnCards, setDrawnCards] = useState<DrawnCardState[]>([])
  const [currentRevealIdx, setCurrentRevealIdx] = useState<number>(0)
  const [isComplete, setIsComplete] = useState<boolean>(false)

  const draw = useCallback(() => {
    if (!canDraw) return
    const cards = drawCards(DRAW_COUNT)
    setDrawnCards(cards.map(card => ({ card, revealed: false, kept: null })))
    setCurrentRevealIdx(0)
    setIsComplete(false)
    setLastDrawDate(getTodayString())
    setCanDraw(false)
  }, [canDraw])

  const revealCard = useCallback((idx: number) => {
    setDrawnCards(prev => prev.map((dc, i) =>
      i === idx ? { ...dc, revealed: true } : dc,
    ))
  }, [])

  const keepCard = useCallback((idx: number) => {
    setDrawnCards(prev => {
      const next = prev.map((dc, i) =>
        i === idx ? { ...dc, kept: true } : dc,
      )
      // 모든 카드 결정 완료 여부 확인
      const allDecided = next.every(dc => dc.revealed && dc.kept !== null)
      if (allDecided) setIsComplete(true)
      else setCurrentRevealIdx(Math.min(idx + 1, DRAW_COUNT - 1))
      return next
    })
  }, [])

  const skipCard = useCallback((idx: number) => {
    setDrawnCards(prev => {
      const next = prev.map((dc, i) =>
        i === idx ? { ...dc, kept: false } : dc,
      )
      const allDecided = next.every(dc => dc.revealed && dc.kept !== null)
      if (allDecided) setIsComplete(true)
      else setCurrentRevealIdx(Math.min(idx + 1, DRAW_COUNT - 1))
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setDrawnCards([])
    setCurrentRevealIdx(0)
    setIsComplete(false)
    setCanDraw(!hasDrawnToday())
  }, [])

  return {
    canDraw,
    drawnCards,
    currentRevealIdx,
    isComplete,
    draw,
    revealCard,
    keepCard,
    skipCard,
    reset,
  }
}
