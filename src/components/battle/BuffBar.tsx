/**
 * BuffBar — 버프/디버프 아이콘 바 컴포넌트
 * Phase 4 신규 파일 — 리라 스펙 §BuffBar
 */

import React, { useState } from 'react'
import type { Buff } from '@/types/stsTypes'
import { BUFF_INFO } from '@/types/stsTypes'

// ─── 특수 색상 오버라이드 ─────────────────────────────

const BUFF_BG_OVERRIDE: Partial<Record<string, string>> = {
  strength:    'rgba(40,100,40,0.8)',
  dexterity:   'rgba(30,80,60,0.8)',
  regen:       'rgba(20,90,50,0.8)',
  metallicize: 'rgba(60,70,90,0.8)',
  vulnerable:  'rgba(120,20,20,0.8)',
  weak:        'rgba(80,40,20,0.8)',
  frail:       'rgba(60,40,20,0.8)',
  poison:      'rgba(50,20,80,0.8)',
}

// ─── Props ───────────────────────────────────────────

interface BuffBarProps {
  buffs: Buff[]
  size?: 'sm' | 'md'
}

// ─── BuffIcon 단위 컴포넌트 ──────────────────────────

interface BuffIconProps {
  buff: Buff
  size: 'sm' | 'md'
}

function BuffIcon({ buff, size }: BuffIconProps): React.ReactElement {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const info = BUFF_INFO[buff.id]
  if (!info) return <></>

  const dim = size === 'sm' ? 16 : 20
  const iconSize = size === 'sm' ? 9 : 11

  const bgDefault = info.isBuff ? 'rgba(30,80,30,0.7)' : 'rgba(80,20,20,0.7)'
  const bg = BUFF_BG_OVERRIDE[buff.id] ?? bgDefault

  const description = info.description.replace(/\{N\}/g, String(buff.amount))

  const handleMouseEnter = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY })
    setShowTooltip(true)
  }

  const handleMouseLeave = () => setShowTooltip(false)

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          width: dim,
          height: dim,
          background: bg,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: iconSize, lineHeight: 1 }}>{info.icon}</span>
        {buff.amount > 1 && (
          <span
            style={{
              position: 'absolute',
              bottom: 0,
              right: 1,
              fontSize: 9,
              color: 'white',
              fontFamily: 'var(--font-mono, "DM Mono", monospace)',
              fontWeight: 700,
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            {buff.amount}
          </span>
        )}
      </div>

      {/* 툴팁 */}
      {showTooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 8,
            top: tooltipPos.y - 48,
            background: 'var(--surface, #16130F)',
            border: '1px solid var(--border-gold, rgba(212,175,90,0.4))',
            padding: '6px 8px',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--text-primary, #E8E0D0)',
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            zIndex: 50,
            pointerEvents: 'none',
            maxWidth: 180,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{info.name}</div>
          <div style={{ color: 'var(--text-secondary, #8A7D6E)' }}>{description}</div>
          {buff.duration != null && (
            <div style={{ color: 'var(--text-muted, #6B5F52)', marginTop: 2 }}>
              남은 턴: {buff.duration}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ─── BuffBar 메인 컴포넌트 ───────────────────────────

export default function BuffBar({ buffs, size = 'sm' }: BuffBarProps): React.ReactElement {
  if (buffs.length === 0) return <></>

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        alignItems: 'center',
      }}
    >
      {buffs.map(buff => (
        <BuffIcon key={buff.id} buff={buff} size={size} />
      ))}
    </div>
  )
}
