/**
 * DeckPile — 덱/버리기/소진 더미 카드 수 표시 컴포넌트
 * Phase 4 신규 파일 — 리라 스펙 §DeckPile
 */

import React, { useState } from 'react'

// ─── Props ───────────────────────────────────────────

interface DeckPileProps {
  drawCount: number
  discardCount: number
  exhaustCount: number
  onClickDraw?: () => void
  onClickDiscard?: () => void
  onClickExhaust?: () => void
}

// ─── PileItem ─────────────────────────────────────────

interface PileItemProps {
  label: string
  count: number
  color: string
  onClick?: () => void
}

function PileItem({ label, count, color, onClick }: PileItemProps): React.ReactElement {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        cursor: onClick ? 'pointer' : 'default',
        color: hovered && onClick ? 'var(--text-primary, #E8E0D0)' : color,
        transition: 'color 0.15s',
        fontFamily: 'var(--font-mono, "DM Mono", monospace)',
        fontSize: 10,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 12 }}>{count}</span>
      <span style={{ fontWeight: 400, color: hovered && onClick ? 'var(--text-secondary, #8A7D6E)' : color }}>
        {label}
      </span>
    </div>
  )
}

// ─── DeckPile ─────────────────────────────────────────

export default function DeckPile({
  drawCount,
  discardCount,
  exhaustCount,
  onClickDraw,
  onClickDiscard,
  onClickExhaust,
}: DeckPileProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <PileItem
        label="덱"
        count={drawCount}
        color="var(--text-secondary, #8A7D6E)"
        onClick={onClickDraw}
      />
      <PileItem
        label="버리기"
        count={discardCount}
        color="#8B7536"
        onClick={onClickDiscard}
      />
      <PileItem
        label="소진"
        count={exhaustCount}
        color="rgba(255,140,0,0.6)"
        onClick={onClickExhaust}
      />
    </div>
  )
}
