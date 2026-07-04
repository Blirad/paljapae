/**
 * DeckCard — 덱 카드 미리보기
 * 리라 스펙 §5 컴포넌트 분해
 */
import React from 'react'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { Card } from '@/types/cards'

interface DeckCardProps {
  card: Card
  index: number
}

export default function DeckCard({ card, index }: DeckCardProps): React.ReactElement {
  const elDisplay = card.element ? ELEMENT_DISPLAY[card.element] : null
  const elColor = elDisplay?.color ?? '#6B5F52'
  const elGradient = elDisplay
    ? elDisplay.gradient.replace(/0\.\d+\)/g, '0.4)') // 연하게
    : 'linear-gradient(135deg, #1A1714 0%, #141210 100%)'

  const isSoldier = card.cardType === 'soldier'
  const stats = isSoldier ? `${(card as any).attack}/${(card as any).maxHealth}` : null

  const ariaLabel = [
    card.name,
    elDisplay ? `${elDisplay.label}` : '중립',
    card.cardType === 'soldier' ? '병사' : '주문',
    `비용 ${card.cost}`,
    stats ? `공격력 ${(card as any).attack} 체력 ${(card as any).maxHealth}` : '',
  ].filter(Boolean).join(', ')

  return (
    <article
      aria-label={ariaLabel}
      style={{
        background: '#141210',
        border: `1px solid ${elColor}4D`,
        borderRadius: '8px',
        overflow: 'hidden',
        height: '200px',
        display: 'flex',
        flexDirection: 'column',
        opacity: 0,
        transform: 'translateY(10px)',
        animation: `cardIn 0.3s ease-out ${index * 30}ms forwards`,
      }}
    >
      {/* CardHeader */}
      <div
        style={{
          height: '28px',
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: `${elColor}26`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'DM Mono, monospace',
            fontWeight: 700,
            fontSize: '14px',
            color: '#E8C84A',
          }}
        >
          {card.cost}
        </span>
        <span
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            color: elColor,
          }}
        >
          {elDisplay ? `${elDisplay.icon}${card.element}` : '중립'}
        </span>
      </div>

      {/* CardArtArea */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: elGradient,
        }}
      >
        <span
          aria-hidden="true"
          style={{ fontSize: '36px' }}
        >
          {elDisplay?.icon ?? '⬜'}
        </span>
      </div>

      {/* CardBody */}
      <div
        style={{
          height: '64px',
          padding: '6px 8px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '2px',
        }}
      >
        <span
          style={{
            fontFamily: 'Noto Serif KR, serif',
            fontWeight: 700,
            fontSize: '12px',
            color: '#E8E0D0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
          }}
        >
          {card.name}
        </span>
        <span
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            color: '#6B5F52',
          }}
        >
          {card.cardType === 'soldier' ? '병사' : '주문'}
        </span>
        {stats && (
          <span
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              color: '#E8C84A',
              fontWeight: 700,
            }}
          >
            {stats}
          </span>
        )}
      </div>

      <style>{`
        @keyframes cardIn {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </article>
  )
}
