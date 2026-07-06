/**
 * AITurnOverlay — AI 턴 시각화 오버레이
 * 리라 스펙 §5: 사선 배너 슬라이드인 + glow pulse + 퇴장 애니메이션
 */

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { PlayerState } from '@/types/game'
import { ELEMENT_DISPLAY } from '@/types/elements'

interface AITurnOverlayProps {
  visible: boolean
  ai: PlayerState
}

export default function AITurnOverlay({ visible, ai }: AITurnOverlayProps): React.ReactElement | null {
  const overlayRef = useRef<HTMLDivElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const glowTweenRef = useRef<gsap.core.Tween | null>(null)

  const display = ELEMENT_DISPLAY[ai.hero.element]

  // 진입 애니메이션 (리라 스펙 §5-A)
  useEffect(() => {
    if (visible) {
      // 오버레이 등장
      if (overlayRef.current) {
        gsap.fromTo(overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.15, ease: 'none' },
        )
      }
      // 배너 슬라이드인: x -120% → 0
      if (bannerRef.current) {
        gsap.fromTo(bannerRef.current,
          { x: '-120%' },
          { x: '0%', duration: 0.28, ease: 'power3.out' },
        )
      }
      // 텍스트 scale up (배너 진입 완료 직후)
      if (textRef.current) {
        gsap.fromTo(textRef.current,
          { scale: 0.7, opacity: 0 },
          { scale: 1.0, opacity: 1, duration: 0.2, ease: 'back.out(1.5)', delay: 0.2 },
        )
      }
      // 오행 아이콘 glow pulse (spin 대신, 리라 스펙 §5-A)
      if (iconRef.current) {
        glowTweenRef.current = gsap.to(iconRef.current, {
          filter: `drop-shadow(0 0 16px ${display.color})`,
          duration: 0.4,
          repeat: 2,
          yoyo: true,
          ease: 'power1.inOut',
        })
      }
    }
  }, [visible, display.color])

  // 퇴장 애니메이션 (리라 스펙 §5-A visible=false 시)
  useEffect(() => {
    if (!visible && bannerRef.current) {
      gsap.to(bannerRef.current, {
        x: '120%',
        duration: 0.2,
        ease: 'power2.in',
      })
      if (overlayRef.current) {
        gsap.to(overlayRef.current, {
          opacity: 0,
          duration: 0.2,
          delay: 0.1,
        })
      }
    }
  }, [visible])

  // cleanup
  useEffect(() => {
    return () => {
      glowTweenRef.current?.kill()
    }
  }, [])

  // visible=false여도 퇴장 애니메이션을 위해 DOM 유지 (opacity로 숨김)
  // 초기 마운트 시 overlayRef가 없으므로 null 반환으로 최적화하되
  // 한 번이라도 표시된 후에는 숨김 처리만 함
  const [everVisible, setEverVisible] = React.useState(false)
  useEffect(() => {
    if (visible) setEverVisible(true)
  }, [visible])

  if (!everVisible && !visible) return null

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 50,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* 사선 배너 */}
      <div
        ref={bannerRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '-10%',
          width: '120%',
          height: 80,
          transform: 'translateY(-50%) rotate(-3deg)',
          background: `linear-gradient(90deg, ${display.color}33 0%, rgba(10,8,6,0.95) 30%, rgba(10,8,6,0.95) 70%, ${display.color}33 100%)`,
          borderTop: `1px solid ${display.color}44`,
          borderBottom: `1px solid ${display.color}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          boxShadow: `0 0 32px rgba(0,0,0,0.6)`,
          willChange: 'transform',
        }}
      >
        {/* 오행 아이콘 */}
        <div
          ref={iconRef}
          style={{
            fontSize: 28,
            display: 'inline-block',
            filter: `drop-shadow(0 0 6px ${display.color}80)`,
          }}
        >
          {display.icon}
        </div>

        {/* 텍스트 */}
        <div ref={textRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 22,
            color: display.color,
            letterSpacing: '0.05em',
            lineHeight: 1.2,
          }}>
            적의 차례
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            {ai.hero.nickname}
          </div>
        </div>
      </div>
    </div>
  )
}
