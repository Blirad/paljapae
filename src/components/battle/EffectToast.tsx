/**
 * EffectToast — 카드 효과 알림 토스트 (리라 스펙 §4-4)
 * BattleScreen 수직 중앙에 position absolute 렌더링
 * effectType별 배경색 + 아이콘 구분
 */

import React from 'react'
import type { CardEffect } from '@/game/engine/effectEngine'

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface EffectToastProps {
  effectType: CardEffect['type']
  text: string
  cardName?: string
}

// ────────────────────────────────────────────────────
// 효과 타입별 시각 요소 (리라 스펙 §4-1)
// ────────────────────────────────────────────────────

interface EffectVisual {
  icon: string
  bg: string
}

const EFFECT_VISUAL: Partial<Record<string, EffectVisual>> = {
  damage:        { icon: '⚔', bg: 'rgba(180,40,40,0.85)' },
  heal:          { icon: '♥', bg: 'rgba(40,140,60,0.85)' },
  buff_atk:      { icon: '↑', bg: 'rgba(40,80,180,0.85)' },
  buff_hp:       { icon: '◎', bg: 'rgba(80,160,80,0.85)' },
  draw:          { icon: '✦', bg: 'rgba(100,80,160,0.85)' },
  add_keyword:   { icon: '★', bg: 'rgba(160,120,20,0.85)' },
  summon:        { icon: '+', bg: 'rgba(60,100,60,0.85)' },
  energy_refund: { icon: '⚡', bg: 'rgba(160,130,20,0.85)' },
}

const DEFAULT_VISUAL: EffectVisual = { icon: '◆', bg: 'rgba(80,70,60,0.85)' }

// ────────────────────────────────────────────────────
// EffectToast
// ────────────────────────────────────────────────────

export default function EffectToast({ effectType, text, cardName }: EffectToastProps): React.ReactElement {
  const visual = EFFECT_VISUAL[effectType] ?? DEFAULT_VISUAL

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`카드 효과: ${text}`}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 50,
        width: 220,
        background: visual.bg,
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.15)',
        animation: 'effectToastIn 0.2s ease-out forwards',
        pointerEvents: 'none',
      }}
    >
      {/* 카드명 */}
      {cardName && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--gold)',
          marginBottom: 3,
          lineHeight: 1,
        }}>
          {cardName}
        </div>
      )}

      {/* 아이콘 + 효과 텍스트 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
        }} aria-hidden="true">
          {visual.icon}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: '#FFFFFF',
          lineHeight: 1.4,
        }}>
          {text}
        </span>
      </div>
    </div>
  )
}
