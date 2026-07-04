/**
 * EmptySlot — 빈 필드 슬롯 컴포넌트
 * 리라 스펙 §2-2 [C/D] FieldArea
 */

import React from 'react'

interface EmptySlotProps {
  slotIdx: number
  side: 'player' | 'ai'
  isDropTarget?: boolean   // 드래그 오버 시 강조
  isSelectable?: boolean   // 카드 선택 후 소환 가능한 슬롯
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
  const borderColor = isDropTarget || isSelectable
    ? 'rgba(232,200,74,0.5)'
    : 'rgba(232,200,74,0.1)'

  const bg = isDropTarget || isSelectable
    ? 'rgba(232,200,74,0.05)'
    : 'transparent'

  return (
    <div
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      style={{
        flex: 1,
        maxWidth: 84,
        height: 112,
        border: `1px dashed ${borderColor}`,
        borderRadius: 6,
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
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '1px solid rgba(232,200,74,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(232,200,74,0.5)',
          fontSize: 16,
        }}>
          +
        </div>
      )}
    </div>
  )
}
