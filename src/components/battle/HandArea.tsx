/**
 * HandArea — 손패 영역
 * 리라 스펙 §2-2 [F] + GSAP 드로우 애니메이션 (작업 3-4)
 * M8 P0-2: Challenge 1 봉인 카드 UI 지원
 */

import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Card } from '@/types/cards'
import type { FiveElement } from '@/types/elements'
import HandCardMini from './HandCardMini'

interface HandAreaProps {
  hand: Card[]
  currentEnergy: number
  selectedCardIndex: number | null
  phase: string
  isProcessing: boolean
  onCardSelect: (index: number) => void
  onDragStart: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  /** M8 P0-2: 봉인된 오행 (null이면 봉인 없음) */
  sealedElement?: FiveElement | null
}

// ────────────────────────────────────────────────────
// SealToast — 봉인 카드 클릭 시 토스트
// ────────────────────────────────────────────────────

function SealToast({ element, onDismiss }: { element: FiveElement; onDismiss: () => void }): React.ReactElement {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div style={{
      position: 'absolute',
      bottom: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(26,20,16,0.92)',
      border: '1px solid var(--accent-red)',
      padding: '6px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--accent-red)',
      whiteSpace: 'nowrap',
      zIndex: 10,
      pointerEvents: 'none',
      animation: 'fadeIn 0.15s ease-out',
    }}>
      {element} 카드는 이 챌린지에서 사용할 수 없습니다
    </div>
  )
}

export default function HandArea({
  hand,
  currentEnergy,
  selectedCardIndex,
  phase,
  isProcessing,
  onCardSelect,
  onDragStart,
  onDragEnd,
  sealedElement,
}: HandAreaProps): React.ReactElement {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const prevHandLength = useRef(hand.length)
  const [showSealToast, setShowSealToast] = useState(false)

  // 새 카드 드로우 시 애니메이션
  useEffect(() => {
    const prevLen = prevHandLength.current
    const curLen = hand.length
    if (curLen > prevLen) {
      // 새로 추가된 카드들에 애니메이션
      for (let i = prevLen; i < curLen; i++) {
        const el = cardRefs.current[i]
        if (el) {
          gsap.from(el, { x: 60, opacity: 0, duration: 0.3, ease: 'power2.out' })
        }
      }
    }
    prevHandLength.current = curLen
  })

  function handleCardSelect(index: number) {
    const card = hand[index]
    // Challenge 1 봉인 카드 클릭 차단
    if (sealedElement && card.element === sealedElement) {
      setShowSealToast(true)
      return
    }
    onCardSelect(index)
  }

  return (
    <div style={{
      height: 112,
      background: 'var(--bg)',
      borderTop: '1px solid rgba(232,200,74,0.12)',
      flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {hand.length === 0 ? (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Noto Serif KR, serif',
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}>
          패가 없습니다. 다음 턴에 드로우합니다.
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '8px',
          overflowX: 'auto',
          height: '100%',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          alignItems: 'flex-end',
        }}>
          {hand.map((card, i) => {
            const isSealed = !!(sealedElement && card.element === sealedElement)
            return (
              <div
                key={`${card.id}-${i}`}
                ref={el => { cardRefs.current[i] = el }}
                style={{ flexShrink: 0 }}
              >
                <HandCardMini
                  card={card}
                  index={i}
                  isPlayable={!isSealed && card.cost <= currentEnergy && phase === 'main' && !isProcessing}
                  isSelected={selectedCardIndex === i}
                  isSealed={isSealed}
                  onSelect={handleCardSelect}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Challenge 1 봉인 토스트 */}
      {showSealToast && sealedElement && (
        <SealToast
          element={sealedElement}
          onDismiss={() => setShowSealToast(false)}
        />
      )}
    </div>
  )
}
