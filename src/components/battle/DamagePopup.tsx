/**
 * DamagePopup — 데미지/힐/소진 팝업 컴포넌트
 * 리라 스펙 §5-4 + GSAP 애니메이션 (작업 3-3)
 * M8 P0: 상극 연출 강화, 레이아웃 수평 변경
 */

import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import gsap from 'gsap'
import type { DamagePopupData } from '@/game/store/battleStore'

interface DamagePopupProps {
  popup: DamagePopupData
}

function getFontSize(value: number, isCrit: boolean): number {
  if (isCrit) return Math.min(56, 40 + value * 2)
  if (value >= 7) return 48
  if (value >= 4) return 40
  return 32
}

function getColor(type: DamagePopupData['type'], value: number, isCrit: boolean): string {
  if (type === 'heal')    return '#4ADE80'
  if (type === 'fatigue') return '#F59E0B'
  if (isCrit)             return '#FF1A1A'  // 상극: 더 진한 빨강
  if (value >= 7)         return '#EF4444'
  if (value >= 4)         return '#FCA5A5'
  return '#FFB3B3'
}

export default function DamagePopup({ popup }: DamagePopupProps): React.ReactElement {
  const elRef = useRef<HTMLDivElement>(null)
  const xOffset = useRef((Math.random() - 0.5) * 40)

  const isCrit = popup.modifier === 'dominate'

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    if (isCrit) {
      // 상극 — 크게 펀치인 후 위로 사라짐
      gsap.timeline()
        .fromTo(el,
          { scale: 0.5, opacity: 0 },
          { scale: 2.6, opacity: 1, duration: 0.12, ease: 'power3.out' }
        )
        .to(el, { scale: 2.2, duration: 0.08 })
        .to(el,
          { y: -120, x: xOffset.current + (Math.random() - 0.5) * 20,
            scale: 0.9, opacity: 0, duration: 0.75, ease: 'power1.in' },
          '+=0.1'
        )
    } else {
      // 일반 피해 — 위로 float
      gsap.fromTo(
        el,
        { y: 0, x: xOffset.current, scale: 1.8, opacity: 1 },
        { y: -110, x: xOffset.current + (Math.random() - 0.5) * 24,
          scale: 0.8, opacity: 0, duration: 0.85, ease: 'power2.out' },
      )
    }
  }, [isCrit])

  const color = getColor(popup.type, popup.value, isCrit)
  const fontSize = getFontSize(popup.value, isCrit)

  const shadowColor = isCrit ? '#FF0000' : color
  const textShadow = isCrit
    ? `0 2px 12px rgba(0,0,0,0.9), 0 0 20px ${shadowColor}CC, 0 0 40px ${shadowColor}66`
    : `0 2px 8px rgba(0,0,0,0.8), 0 0 12px ${shadowColor}80`

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
        textShadow,
      }}
    >
      {/* 숫자 + 배율 + 상극/상생 레이블 수평 배치 (모바일 공간 절약) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span>{popup.type === 'damage' ? '-' : '+'}{popup.value}</span>
        {popup.modifier === 'dominate' && (
          <>
            <span style={{
              fontSize: Math.round(fontSize * 0.5),
              color: '#FF3333',
              fontWeight: 700,
              transform: 'scale(1.2)',
              display: 'inline-block',
            }}>×1.5</span>
            <span style={{ fontSize: 12, color: '#FF3333', fontWeight: 700 }}>상극!</span>
          </>
        )}
        {popup.modifier === 'generate_defense' && (
          <>
            <span style={{
              fontSize: Math.round(fontSize * 0.5),
              color: '#4488FF',
              fontWeight: 700,
            }}>×0.75</span>
            <span style={{ fontSize: 12, color: '#44CC66' }}>상생</span>
          </>
        )}
      </div>
      {popup.type === 'fatigue' && (
        <div style={{ fontSize: 11, color: '#FF8800', textAlign: 'center' }}>소진</div>
      )}
    </div>,
    document.body,
  )
}
