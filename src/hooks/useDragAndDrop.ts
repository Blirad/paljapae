/**
 * 팔자전 — 드래그 앤 드롭 훅
 * 카드 겹치기로 합성 소환 인터랙션
 *
 * 규칙:
 *  - 드래그 중인 카드를 다른 카드에 겹치면 상생 확인 후 융합 연출
 *  - 같은 기운끼리 겹치면 "결집 정령" 생성
 *  - 불가능한 조합은 튕겨내기 + 안내 메시지
 *  - 엔진 불변: pokerHandJudge.ts, paljajeonEngine.ts 변경 없음
 *
 * 이 훅은 UI 표현 레이어만 담당.
 * 실제 카드 출수는 기존 toggleCardSelect → playSelectedCards 플로우 사용.
 */

import { useState, useCallback, useRef } from 'react'
import type { Card } from '../types/game'

export type FusionResult = {
  type: 'saengchae'  | 'jipgyeol' | 'reject'
  cards: Card[]
  label: string       // "나무+불의 정령" 등
  message?: string    // reject 시 안내 메시지
}

// 오행 상생 순서: 목→화→토→금→수→목
const SAENGCHAE_MAP: Record<string, string> = {
  mok: 'hwa',
  hwa: 'to',
  to: 'geum',
  geum: 'su',
  su: 'mok',
}

// 오행 한글 이름
const ELEMENT_KO: Record<string, string> = {
  mok: '나무', hwa: '불', to: '흙', geum: '쇠', su: '물',
}

// 상극 관계 (융합 불가)
const GEUK_MAP: Record<string, string> = {
  mok: 'to',
  hwa: 'geum',
  to: 'su',
  geum: 'mok',
  su: 'hwa',
}

/** 두 오행이 상생 관계인지 확인 (A→B 또는 B→A) */
function isSaengchae(a: string, b: string): boolean {
  return SAENGCHAE_MAP[a] === b || SAENGCHAE_MAP[b] === a
}

/** 상생 체인 순서로 카드 정렬 */
function sortBySaengchae(cards: Card[]): Card[] {
  if (cards.length <= 1) return cards
  const sorted: Card[] = [cards[0]]
  const remaining = [...cards.slice(1)]

  while (remaining.length > 0) {
    const last = sorted[sorted.length - 1]
    const nextIdx = remaining.findIndex(
      c => SAENGCHAE_MAP[last.element] === c.element
    )
    if (nextIdx === -1) {
      // 상생 순서가 없으면 그냥 추가
      sorted.push(...remaining)
      break
    }
    sorted.push(remaining[nextIdx])
    remaining.splice(nextIdx, 1)
  }
  return sorted
}

/** 융합 레이블 생성 */
function buildFusionLabel(cards: Card[], fusionType: 'saengchae' | 'jipgyeol'): string {
  if (fusionType === 'jipgyeol') {
    const el = cards[0].element
    return `결집 정령 (${ELEMENT_KO[el]}×${cards.length})`
  }
  const sorted = sortBySaengchae(cards)
  const names = sorted.map(c => ELEMENT_KO[c.element]).join('+')
  return `${names}의 정령`
}

/** 카드 목록의 합성 가능 여부 판단 */
export function checkFusionCompatibility(cards: Card[]): FusionResult {
  if (cards.length < 2) {
    return { type: 'reject', cards, label: '', message: '카드를 2장 이상 겹치세요' }
  }

  const elements = cards.map(c => c.element)
  const uniqueElements = new Set(elements)

  // 같은 기운끼리 → 결집 정령
  if (uniqueElements.size === 1) {
    const label = buildFusionLabel(cards, 'jipgyeol')
    return { type: 'jipgyeol', cards, label }
  }

  // 상생 체인 확인: 모든 인접 쌍이 상생 관계여야 함
  const sorted = sortBySaengchae(cards)
  let allSaengchae = true
  for (let i = 0; i < sorted.length - 1; i++) {
    if (!isSaengchae(sorted[i].element, sorted[i + 1].element)) {
      allSaengchae = false
      break
    }
  }

  if (allSaengchae) {
    const label = buildFusionLabel(cards, 'saengchae')
    return { type: 'saengchae', cards: sorted, label }
  }

  // 상극 관계 포함 → 불가
  const hasGeuk = elements.some((el, i) =>
    elements.some((el2, j) => i !== j && GEUK_MAP[el] === el2)
  )

  const message = hasGeuk
    ? '서로 이기는 기운은 융합할 수 없습니다'
    : '순환하지 않는 기운은 융합할 수 없습니다'

  return { type: 'reject', cards, label: '', message }
}

// 드래그 상태 타입
export interface DragState {
  isDragging: boolean
  draggingCardId: string | null
  overCardId: string | null
  fusionPreview: FusionResult | null
}

export interface UseDragAndDropReturn {
  dragState: DragState
  handleDragStart: (cardId: string) => void
  handleDragOver: (cardId: string, allCards: Card[]) => void
  handleDragEnd: (onFusion: (cards: Card[]) => void, allCards: Card[]) => void
  handleDragCancel: () => void
  rejectAnimCardId: string | null  // 튕겨내기 애니메이션 대상
}

export function useDragAndDrop(): UseDragAndDropReturn {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggingCardId: null,
    overCardId: null,
    fusionPreview: null,
  })
  const [rejectAnimCardId, setRejectAnimCardId] = useState<string | null>(null)
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDragStart = useCallback((cardId: string) => {
    setDragState({
      isDragging: true,
      draggingCardId: cardId,
      overCardId: null,
      fusionPreview: null,
    })
  }, [])

  const handleDragOver = useCallback((cardId: string, allCards: Card[]) => {
    setDragState(prev => {
      if (!prev.draggingCardId || cardId === prev.draggingCardId) return prev

      // 두 카드로 융합 미리보기
      const draggedCard = allCards.find(c => c.id === prev.draggingCardId)
      const overCard = allCards.find(c => c.id === cardId)
      if (!draggedCard || !overCard) return prev

      const fusionPreview = checkFusionCompatibility([draggedCard, overCard])
      return { ...prev, overCardId: cardId, fusionPreview }
    })
  }, [])

  const handleDragEnd = useCallback((
    onFusion: (cards: Card[]) => void,
    allCards: Card[]
  ) => {
    setDragState(prev => {
      if (!prev.draggingCardId || !prev.overCardId) {
        return { isDragging: false, draggingCardId: null, overCardId: null, fusionPreview: null }
      }

      const draggedCard = allCards.find(c => c.id === prev.draggingCardId)
      const overCard = allCards.find(c => c.id === prev.overCardId)

      if (!draggedCard || !overCard) {
        return { isDragging: false, draggingCardId: null, overCardId: null, fusionPreview: null }
      }

      const result = checkFusionCompatibility([draggedCard, overCard])

      if (result.type === 'reject') {
        // 튕겨내기 애니메이션
        const rejectId = prev.draggingCardId
        if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current)
        setRejectAnimCardId(rejectId)
        rejectTimerRef.current = setTimeout(() => setRejectAnimCardId(null), 500)
      } else {
        // 융합 성공 → 두 카드 선택 상태로 전달
        onFusion(result.cards)
      }

      return { isDragging: false, draggingCardId: null, overCardId: null, fusionPreview: null }
    })
  }, [])

  const handleDragCancel = useCallback(() => {
    setDragState({ isDragging: false, draggingCardId: null, overCardId: null, fusionPreview: null })
  }, [])

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    rejectAnimCardId,
  }
}
