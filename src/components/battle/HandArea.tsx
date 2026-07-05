/**
 * HandArea — 손패 영역
 * 리라 스펙 §2-2 [F] + GSAP 드로우 애니메이션 (작업 3-4)
 */

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { Card } from '@/types/cards'
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
}: HandAreaProps): React.ReactElement {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const prevHandLength = useRef(hand.length)

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

  return (
    <div style={{
      height: 112,
      background: 'var(--bg)',
      borderTop: '1px solid rgba(232,200,74,0.12)',
      flexShrink: 0,
      overflow: 'hidden',
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
          {hand.map((card, i) => (
            <div
              key={`${card.id}-${i}`}
              ref={el => { cardRefs.current[i] = el }}
              style={{ flexShrink: 0 }}
            >
              <HandCardMini
                card={card}
                index={i}
                isPlayable={card.cost <= currentEnergy && phase === 'main' && !isProcessing}
                isSelected={selectedCardIndex === i}
                onSelect={onCardSelect}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
