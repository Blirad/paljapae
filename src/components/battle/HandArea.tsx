/**
 * HandArea — 손패 영역
 * 리라 스펙 §2-2 [F]
 */

import React from 'react'
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
  return (
    <div style={{
      height: 112,
      background: '#0D0B08',
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
          color: '#6B5F52',
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
            <HandCardMini
              key={`${card.id}-${i}`}
              card={card}
              index={i}
              isPlayable={card.cost <= currentEnergy && phase === 'main' && !isProcessing}
              isSelected={selectedCardIndex === i}
              onSelect={onCardSelect}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}
