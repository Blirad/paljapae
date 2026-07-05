/**
 * DamagePopup — 데미지/힐/소진 팝업 컴포넌트
 * 리라 스펙 §5-4 + GSAP 애니메이션 (작업 3-3)
 */

import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import gsap from 'gsap'
import type { DamagePopupData } from '@/game/store/battleStore'

interface DamagePopupProps {
  popup: DamagePopupData
}

function getFontSize(value: number): number {
  if (value >= 7) return 28
  if (value >= 4) return 22
  return 18
}

function getColor(type: DamagePopupData['type'], value: number): string {
  if (type === 'heal') return 'var(--el-wood)'
  if (type === 'fatigue') return 'var(--el-earth)'
  // damage: 크기별 색상 (Momentor 기준)
  if (value >= 7) return 'var(--el-fire)'
  if (value >= 4) return 'var(--gold-accent)'
  return 'var(--text-primary)'
}

export default function DamagePopup({ popup }: DamagePopupProps): React.ReactElement {
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    gsap.fromTo(
      el,
      { y: 0, scale: 1.5, opacity: 1 },
      { y: -80, scale: 0.8, opacity: 0, duration: 0.8, ease: 'power2.out' },
    )
  }, [])

  const color = getColor(popup.type, popup.value)
  const fontSize = getFontSize(popup.value)

  return ReactDOM.createPortal(
    <div
      ref={elRef}
      style={{
        position: 'fixed',
        left: `${popup.x}%`,
        top: `${popup.y}%`,
        transform: 'translateX(-50%)',
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
