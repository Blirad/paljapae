/**
 * AITurnOverlay — AI 턴 시각화 오버레이 (M6 GSAP 개선)
 * 리라 스펙 §6-1
 * 오행 아이콘 회전 + GSAP 애니메이션
 */

import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { PlayerState } from '@/types/game'
import { ELEMENT_DISPLAY } from '@/types/elements'

interface AITurnOverlayProps {
  visible: boolean
  ai: PlayerState
}

export default function AITurnOverlay({ visible, ai }: AITurnOverlayProps): React.ReactElement | null {
  const [dotPhase, setDotPhase] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const spinTweenRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    if (!visible) return
    const t = setInterval(() => setDotPhase(p => (p + 1) % 3), 500)
    return () => clearInterval(t)
  }, [visible])

  // 오버레이 등장 + 아이콘 회전
  useEffect(() => {
    if (visible && containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { scale: 0.85, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.3)' },
      )
    }
    if (visible && iconRef.current) {
      spinTweenRef.current = gsap.to(iconRef.current, {
        rotation: 360,
        duration: 2,
        repeat: -1,
        ease: 'none',
      })
      gsap.to(iconRef.current, {
        scale: 1.2,
        duration: 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      })
    } else {
      spinTweenRef.current?.kill()
    }
    return () => {
      spinTweenRef.current?.kill()
    }
  }, [visible])

  if (!visible) return null

  const display = ELEMENT_DISPLAY[ai.hero.element]
  const dots = ['● ○ ○', '○ ● ○', '○ ○ ●'][dotPhase]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div
        ref={containerRef}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-gold)',
          padding: '20px 28px',
          textAlign: 'center',
          minWidth: 220,
          boxShadow: `0 0 24px ${display.color}30`,
        }}
      >
        {/* 회전하는 오행 아이콘 */}
        <div
          ref={iconRef}
          style={{
            fontSize: 32,
            marginBottom: 10,
            display: 'inline-block',
            filter: `drop-shadow(0 0 8px ${display.color}80)`,
          }}
        >
          {display.icon}
        </div>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--gold)',
          marginBottom: 6,
        }}>
          {ai.hero.nickname}의 차례
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 10,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          AI 생각중...
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: display.color,
          letterSpacing: 4,
        }}>
          {dots}
        </div>
      </div>
    </div>
  )
}
