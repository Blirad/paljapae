/**
 * DamagePopup — 데미지/힐/소진 팝업 컴포넌트
 * 리라 스펙 §5-4
 */

import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import type { DamagePopupData } from '@/game/store/battleStore'

interface DamagePopupProps {
  popup: DamagePopupData
}

function getFontSize(value: number): number {
  if (value >= 11) return 28
  if (value >= 6) return 22
  return 18
}

function getColor(type: DamagePopupData['type']): string {
  switch (type) {
    case 'damage': return '#FF4444'
    case 'heal': return '#44FF88'
    case 'fatigue': return '#FF8800'
  }
}

export default function DamagePopup({ popup }: DamagePopupProps): React.ReactElement {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 150)
    const t2 = setTimeout(() => setPhase('exit'), 300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const color = getColor(popup.type)
  const fontSize = getFontSize(popup.value)

  const translateY = phase === 'enter' ? -8 : phase === 'hold' ? -8 : -32
  const opacity = phase === 'exit' ? 0 : phase === 'enter' ? 1 : 1
  const scale = phase === 'enter' ? 1.3 : 1

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        left: `${popup.x}%`,
        top: `${popup.y}%`,
        transform: `translateX(-50%) translateY(${translateY}px) scale(${scale})`,
        opacity,
        transition: phase === 'exit' ? 'opacity 0.4s ease-in, transform 0.4s ease-in' : 'opacity 0.15s ease-out, transform 0.15s ease-out',
        zIndex: 40,
        pointerEvents: 'none',
        fontFamily: 'DM Mono, monospace',
        fontWeight: 700,
        fontSize,
        color,
        textShadow: `0 0 8px ${color}80`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span>{popup.type === 'damage' ? '-' : popup.type === 'heal' ? '+' : '-'}{popup.value}</span>
      {popup.modifier === 'dominate' && (
        <span style={{ fontSize: 11, color: '#FF4444' }}>⚡ 상극!</span>
      )}
      {popup.modifier === 'generate_defense' && (
        <span style={{ fontSize: 11, color: '#44CC66' }}>🛡 상생</span>
      )}
      {popup.type === 'fatigue' && (
        <span style={{ fontSize: 11, color: '#FF8800' }}>소진</span>
      )}
    </div>,
    document.body,
  )
}
