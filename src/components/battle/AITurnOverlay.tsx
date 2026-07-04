/**
 * AITurnOverlay — AI 턴 시각화 오버레이
 * 리라 스펙 §6-1
 */

import React, { useEffect, useState } from 'react'
import type { PlayerState } from '@/types/game'
import { ELEMENT_DISPLAY } from '@/types/elements'

interface AITurnOverlayProps {
  visible: boolean
  ai: PlayerState
}

export default function AITurnOverlay({ visible, ai }: AITurnOverlayProps): React.ReactElement | null {
  const [dotPhase, setDotPhase] = useState(0)

  useEffect(() => {
    if (!visible) return
    const t = setInterval(() => setDotPhase(p => (p + 1) % 3), 500)
    return () => clearInterval(t)
  }, [visible])

  if (!visible) return null

  const display = ELEMENT_DISPLAY[ai.hero.element]

  const dots = ['● ○ ○', '○ ● ○', '○ ○ ●'][dotPhase]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(13,11,8,0.65)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: '#1A1714',
        border: '1px solid rgba(232,200,74,0.45)',
        borderRadius: 12,
        padding: '16px 24px',
        textAlign: 'center',
        animation: 'scaleIn 0.3s ease-out',
        minWidth: 220,
      }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>{display.icon}</div>
        <div style={{
          fontFamily: 'Noto Serif KR, serif',
          fontWeight: 700,
          fontSize: 18,
          color: '#E8E0D0',
          marginBottom: 6,
        }}>
          {ai.hero.nickname}의 차례
        </div>
        <div style={{
          fontFamily: 'Noto Sans KR, sans-serif',
          fontSize: 14,
          color: '#6B5F52',
          marginBottom: 8,
        }}>
          AI 턴 진행 중...
        </div>
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 12,
          color: '#A89880',
        }}>
          {dots}
        </div>
      </div>
    </div>
  )
}
