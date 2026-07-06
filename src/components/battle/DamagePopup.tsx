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
  if (value >= 7) return 48
  if (value >= 4) return 40
  return 32
}

function getColor(type: DamagePopupData['type'], value: number): string {
  if (type === 'heal') return '#4ADE80'
  if (type === 'fatigue') return '#F59E0B'
  // damage: 크기별 색상
  if (value >= 7) return '#EF4444'
  if (value >= 4) return '#FCA5A5'
  return '#FFB3B3'
}

export default function DamagePopup({ popup }: DamagePopupProps): React.ReactElement {
  const elRef = useRef<HTMLDivElement>(null)
  // 수평 랜덤 오프셋 -20 ~ +20px (컴포넌트 마운트 시 1회 결정)
  const xOffset = useRef((Math.random() - 0.5) * 40)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    gsap.fromTo(
      el,
      { y: 0, x: xOffset.current, scale: 1.6, opacity: 1 },
      { y: -100, x: xOffset.current + (Math.random() - 0.5) * 20, scale: 0.7, opacity: 0, duration: 0.9, ease: 'power2.out' },
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
        textShadow: `0 2px 8px rgba(0,0,0,0.8), 0 0 12px ${color}80`,
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
