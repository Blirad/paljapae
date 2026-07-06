/**
 * HandCardMini — 손패 카드 최소형 컴포넌트
 * 리라 스펙 §3-2
 */

import React, { useRef, useState } from 'react'
import CardArtSVG, { getRarityBorderStyle } from './CardArtSVG'
import type { Card } from '@/types/cards'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// 오행 아트 데이터 (스펙 §작업2)
// ────────────────────────────────────────────────────

interface ElementArt {
  bg: string
  emoji: string
  accent: string
}

const ELEMENT_ART: Record<FiveElement, ElementArt> = {
  '木': { bg: 'linear-gradient(135deg, rgba(111,168,106,0.15), rgba(0,0,0,0))', emoji: '🌿', accent: 'var(--el-wood)' },
  '火': { bg: 'linear-gradient(135deg, rgba(196,96,74,0.15), rgba(0,0,0,0))', emoji: '🔥', accent: 'var(--el-fire)' },
  '土': { bg: 'linear-gradient(135deg, rgba(184,154,94,0.15), rgba(0,0,0,0))', emoji: '⛰️', accent: 'var(--el-earth)' },
  '金': { bg: 'linear-gradient(135deg, rgba(154,170,184,0.15), rgba(0,0,0,0))', emoji: '⚔️', accent: 'var(--el-metal)' },
  '水': { bg: 'linear-gradient(135deg, rgba(94,143,184,0.15), rgba(0,0,0,0))', emoji: '💧', accent: 'var(--el-water)' },
}

const NEUTRAL_ART: ElementArt = {
  bg: 'linear-gradient(135deg, rgba(212,175,90,0.08), rgba(0,0,0,0))',
  emoji: '✨',
  accent: 'var(--gold)',
}

// getRarityBorderStyle은 CardArtSVG에서 import하여 사용

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface HandCardMiniProps {
  card: Card
  index: number
  isPlayable: boolean
  isSelected: boolean
  /** M8 P0-2: Challenge 1 봉인 상태 */
  isSealed?: boolean
  onSelect: (index: number) => void
  onDragStart?: (e: React.DragEvent, index: number) => void
  onDragEnd?: () => void
}

export default function HandCardMini({
  card,
  index,
  isPlayable,
  isSelected,
  isSealed = false,
  onSelect,
  onDragStart,
  onDragEnd,
}: HandCardMiniProps): React.ReactElement {
  const element = card.element
  const display = element ? ELEMENT_DISPLAY[element] : null
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const elementColor = display?.color ?? '#A89880'
  const art = element ? ELEMENT_ART[element] : NEUTRAL_ART
  const rarityStyle = getRarityBorderStyle(card.rarity)

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
        background: 'var(--surface)',
        border: isSelected
          ? '1px solid var(--gold)'
          : card.cardType === 'spell'
          ? `1px dashed ${elementColor}${Math.round((isPlayable ? 0.7 : 0.3) * 255).toString(16).padStart(2, '0')}`
          : rarityStyle.border,
        cursor: isPlayable ? (isSelected ? 'default' : 'grab') : 'not-allowed',
        opacity: isSealed ? 0.4 : isPlayable ? 1 : 0.45,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: isSelected ? 'translateY(-12px)' : 'translateY(0)',
        boxShadow: isSelected
          ? `0 0 12px rgba(212,175,90,0.4)`
          : isPlayable
          ? rarityStyle.boxShadow || `0 2px 8px ${elementColor}40`
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
          background: 'transparent',
          border: '1px solid var(--gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontWeight: 400,
          fontSize: 11,
          color: 'var(--gold)',
        }}>
          {card.cost}
        </div>
        {display && (
          <span style={{ fontSize: 12, color: display.color }}>
            {display.icon}
          </span>
        )}
      </div>

      {/* 오행 SVG 아트 영역 (M6) */}
      <div style={{
        height: 80,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {element ? (
          <CardArtSVG
            element={element}
            rarity={card.rarity}
            size="mini"
            cardType={card.cardType}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: art.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 28 }} aria-hidden="true">{art.emoji}</span>
          </div>
        )}
        {/* 주문 카드 표시 */}
        {card.cardType === 'spell' && (
          <div style={{
            position: 'absolute',
            bottom: 2,
            right: 3,
            fontSize: 9,
            color: '#87CEEB',
            fontFamily: 'DM Mono, monospace',
            opacity: 0.8,
          }}>
            주문
          </div>
        )}
      </div>

      {/* 카드명 */}
      <div style={{
        height: 24,
        padding: '0 3px',
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 10,
        color: 'var(--text-headline)',
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
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          background: 'transparent',
          color: 'var(--text-muted)',
          padding: '0 2px',
        }}>
          {card.cardType === 'soldier' ? '병사' : '주문'}
        </span>
        {card.cardType === 'soldier' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gold)' }}>
            {card.attack}/{card.maxHealth}
          </span>
        )}
      </div>

      {/* 선택 테두리 */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '1px solid var(--gold)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Challenge 1 봉인 오버레이 */}
      {isSealed && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          background: 'rgba(26,20,16,0.35)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            letterSpacing: '0.05em',
          }}>
            봉인됨
          </span>
        </div>
      )}

      {/* 툴팁 */}
      {showTooltip && (
        <div style={{
          position: 'fixed',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 180,
          background: 'var(--surface)',
          border: '1px solid var(--border-gold)',
          padding: '12px',
          zIndex: 60,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <div style={{
              width: 20, height: 20,
              border: '1px solid var(--gold)',
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)',
            }}>
              {card.cost}
            </div>
            {display && <span style={{ fontSize: 14, color: display.color }}>{display.label}</span>}
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--text-headline)', marginBottom: 4 }}>
            {card.name}
          </div>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 6 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {card.cardType === 'soldier' ? '병사' : `주문 | ${card.subtype}`}
          </div>
          {card.cardType === 'soldier' && card.battlecry && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>
              {card.battlecry}
            </div>
          )}
          {card.cardType === 'spell' && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>
              {card.effectText}
            </div>
          )}
          {card.cardType === 'soldier' && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold)', marginBottom: 4 }}>
              공격력 {card.attack} / 체력 {card.maxHealth}
            </div>
          )}
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 4 }} />
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>
            "{card.flavorText}"
          </div>
        </div>
      )}
    </div>
  )
}
