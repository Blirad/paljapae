/**
 * EmptySlot — 빈 필드 슬롯 컴포넌트 (M6 GSAP hover)
 * 리라 스펙 §2-2 [C/D] FieldArea
 */

import React, { useRef } from 'react'
import gsap from 'gsap'

interface EmptySlotProps {
  slotIdx: number
  side: 'player' | 'ai'
  isDropTarget?: boolean
  isSelectable?: boolean
  onClick?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragLeave?: () => void
}

export default function EmptySlot({
  slotIdx: _slotIdx,
  side: _side,
  isDropTarget = false,
  isSelectable = false,
  onClick,
  onDragOver,
  onDrop,
  onDragLeave,
}: EmptySlotProps): React.ReactElement {
  const slotRef = useRef<HTMLDivElement>(null)

  const borderColor = isDropTarget || isSelectable
    ? 'var(--gold)'
    : 'var(--border)'

  const bg = isDropTarget || isSelectable
    ? 'rgba(212,175,90,0.05)'
    : 'rgba(255,255,255,0.02)'

  function handleMouseEnter() {
    if (!isSelectable || !slotRef.current) return
    gsap.to(slotRef.current, {
      scale: 1.05,
      boxShadow: '0 0 12px rgba(212,175,90,0.35)',
      duration: 0.15,
      ease: 'power1.out',
    })
  }

  function handleMouseLeave() {
    if (!slotRef.current) return
    gsap.to(slotRef.current, {
      scale: 1,
      boxShadow: 'none',
      duration: 0.15,
      ease: 'power1.out',
    })
  }

  return (
    <div
      ref={slotRef}
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        flex: 1,
        maxWidth: 84,
        height: 112,
        border: `1px dashed ${borderColor}`,
        background: bg,
        cursor: (isSelectable || isDropTarget) ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label="빈 슬롯"
    >
      {isSelectable && (
        <div style={{
          width: 28,
          height: 28,
          border: '1px solid var(--border-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--gold)',
          fontSize: 18,
          fontFamily: 'var(--font-mono)',
        }}>
          +
        </div>
      )}
    </div>
  )
}
