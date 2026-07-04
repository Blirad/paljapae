/**
 * HandCardMini — 손패 카드 최소형 컴포넌트
 * 리라 스펙 §3-2
 */

import React, { useRef, useState } from 'react'
import type { Card } from '@/types/cards'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// 오행 × 카드타입 아이콘
// ────────────────────────────────────────────────────

function getCardIcon(element: FiveElement | null, cardType: 'soldier' | 'spell'): string {
  if (element === null) return cardType === 'soldier' ? '🗡' : '✨'
  const soldierIcons: Record<FiveElement, string> = { '木': '🌲', '火': '🗡', '土': '🏯', '金': '⚔', '水': '🐉' }
  const spellIcons: Record<FiveElement, string> = { '木': '🍃', '火': '🔥', '土': '🌋', '金': '✨', '水': '🌊' }
  return cardType === 'soldier' ? soldierIcons[element] : spellIcons[element]
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface HandCardMiniProps {
  card: Card
  index: number
  isPlayable: boolean
  isSelected: boolean
  onSelect: (index: number) => void
  onDragStart?: (e: React.DragEvent, index: number) => void
  onDragEnd?: () => void
}

export default function HandCardMini({
  card,
  index,
  isPlayable,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
}: HandCardMiniProps): React.ReactElement {
  const element = card.element
  const display = element ? ELEMENT_DISPLAY[element] : null
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const elementColor = display?.color ?? '#A89880'
  const elementBorderOpacity = isPlayable ? 0.7 : 0.3
  const borderColor = `${elementColor}${Math.round(elementBorderOpacity * 255).toString(16).padStart(2, '0')}`

  function handleTouchStart() {
    longPressTimer.current = setTimeout(() => setShowTooltip(true), 500)
  }
  function handleTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    setShowTooltip(false)
  }

  return (
    <div
      draggable={isPlayable && card.cardType === 'soldier'}
      onDragStart={e => onDragStart?.(e, index)}
      onDragEnd={onDragEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
        if (!isPlayable) return
        onSelect(index)
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        width: 60,
        height: 96,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        background: '#141210',
        borderRadius: 8,
        border: `1px ${card.cardType === 'spell' ? 'dashed' : 'solid'} ${borderColor}`,
        cursor: isPlayable ? (isSelected ? 'default' : 'grab') : 'not-allowed',
        opacity: isPlayable ? 1 : 0.45,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: isSelected ? 'translateY(-12px)' : 'translateY(0)',
        boxShadow: isSelected
          ? `0 -4px 12px rgba(232,200,74,0.4)`
          : isPlayable
          ? `0 2px 8px ${elementColor}40`
          : 'none',
        transition: 'transform 0.15s ease-out, box-shadow 0.15s',
        userSelect: 'none',
        position: 'relative',
      }}
      aria-label={`${card.name} 비용:${card.cost}`}
    >
      {/* 헤더 */}
      <div style={{
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 3px',
        flexShrink: 0,
      }}>
        <div style={{
          width: 18,
          height: 18,
          background: '#E8C84A',
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'DM Mono, monospace',
          fontWeight: 700,
          fontSize: 11,
          color: '#0D0B08',
        }}>
          {card.cost}
        </div>
        {display && (
          <span style={{ fontSize: 12, color: display.color }}>
            {display.icon}
          </span>
        )}
      </div>

      {/* 아트 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: display?.gradient ?? 'transparent',
      }}>
        <span style={{ fontSize: 24 }} aria-hidden="true">
          {getCardIcon(element, card.cardType)}
        </span>
      </div>

      {/* 카드명 */}
      <div style={{
        height: 24,
        padding: '0 3px',
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'Noto Serif KR, serif',
        fontWeight: 700,
        fontSize: 10,
        color: '#E8E0D0',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        flexShrink: 0,
      }}>
        {card.name.split(' ')[0]}
      </div>

      {/* 타입 태그 */}
      <div style={{
        height: 16,
        padding: '0 3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 9,
          background: card.cardType === 'soldier' ? 'rgba(61,122,58,0.2)' : 'rgba(37,99,168,0.2)',
          color: card.cardType === 'soldier' ? '#3D7A3A' : '#2563A8',
          borderRadius: 2,
          padding: '0 2px',
        }}>
          {card.cardType === 'soldier' ? '병사' : '주문'}
        </span>
        {card.cardType === 'soldier' && (
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#6B5F52' }}>
            {card.attack}/{card.maxHealth}
          </span>
        )}
      </div>

      {/* 선택 테두리 */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '1px solid #E8C84A',
          borderRadius: 8,
          pointerEvents: 'none',
        }} />
      )}

      {/* 툴팁 */}
      {showTooltip && (
        <div style={{
          position: 'fixed',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 180,
          background: '#1A1714',
          border: '1px solid rgba(232,200,74,0.45)',
          borderRadius: 10,
          padding: '12px',
          zIndex: 60,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <div style={{
              width: 20, height: 20, background: '#E8C84A', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 12, color: '#0D0B08',
            }}>
              {card.cost}
            </div>
            {display && <span style={{ fontSize: 14, color: display.color }}>{display.label}</span>}
          </div>
          <div style={{ fontFamily: 'Noto Serif KR, serif', fontWeight: 700, fontSize: 14, color: '#E8E0D0', marginBottom: 4 }}>
            {card.name}
          </div>
          <div style={{ height: 1, background: 'rgba(232,200,74,0.12)', marginBottom: 6 }} />
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#A89880', marginBottom: 4 }}>
            {card.cardType === 'soldier' ? '병사' : `주문 | ${card.subtype}`}
          </div>
          {card.cardType === 'soldier' && card.battlecry && (
            <div style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: 12, color: '#E8E0D0', marginBottom: 4 }}>
              {card.battlecry}
            </div>
          )}
          {card.cardType === 'spell' && (
            <div style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: 12, color: '#E8E0D0', marginBottom: 4 }}>
              {card.effectText}
            </div>
          )}
          {card.cardType === 'soldier' && (
            <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 14, color: '#A89880', marginBottom: 4 }}>
              공격력 {card.attack} / 체력 {card.maxHealth}
            </div>
          )}
          <div style={{ height: 1, background: 'rgba(232,200,74,0.12)', marginBottom: 4 }} />
          <div style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: 11, fontStyle: 'italic', color: '#6B5F52' }}>
            "{card.flavorText}"
          </div>
        </div>
      )}
    </div>
  )
}
