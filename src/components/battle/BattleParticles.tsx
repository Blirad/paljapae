/**
 * BattleParticles — 카드 사용/승리/충격파 파티클 시스템
 * 리라 스펙 §인터랙션명세 §7
 * STS 강화: emitShockwave 추가 (리라 스펙 §2-C)
 * position:fixed 레이어, 동적 DOM 생성 + GSAP + onComplete 제거
 */

import { useImperativeHandle, forwardRef, useRef } from 'react'
import gsap from 'gsap'
import type { FiveElement } from '@/types/elements'
import { PARTICLE_COLORS } from '@/utils/battleColors'

const GOLD_COLORS = ['#C9A84C', '#E8C547', '#FFD700', '#F0C04A']

// ────────────────────────────────────────────────────
// 공개 API (ref 통해 호출)
// ────────────────────────────────────────────────────

export interface BattleParticlesRef {
  emit: (x: number, y: number, element: FiveElement, count?: number) => void
  emitVictory: () => void
  emitShockwave: (targetEl: HTMLElement, color: string) => void
}

const BattleParticles = forwardRef<BattleParticlesRef>(function BattleParticles(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    emit(x: number, y: number, element: FiveElement, count = 8) {
      const container = containerRef.current
      if (!container) return
      const colors = PARTICLE_COLORS[element]

      for (let i = 0; i < count; i++) {
        const span = document.createElement('div')
        const color = colors[i % colors.length]
        span.style.cssText = `
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: ${color};
          left: ${x}px;
          top: ${y}px;
          pointer-events: none;
        `
        container.appendChild(span)

        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
        const distance = 40 + Math.random() * 40
        gsap.to(span, {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 20,
          opacity: 0,
          duration: 0.4 + Math.random() * 0.2,
          ease: 'power2.out',
          onComplete: () => {
            if (container.contains(span)) container.removeChild(span)
          },
        })
      }
    },

    emitVictory() {
      const container = containerRef.current
      if (!container) return
      const count = 20

      for (let i = 0; i < count; i++) {
        const span = document.createElement('div')
        const color = GOLD_COLORS[i % GOLD_COLORS.length]
        const size = i % 3 === 0 ? 8 : 5
        const startX = (window.innerWidth * (10 + i * 4)) / 100
        const startY = window.innerHeight * 0.75

        span.style.cssText = `
          position: fixed;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          left: ${startX}px;
          top: ${startY}px;
          pointer-events: none;
          opacity: 0;
          z-index: 70;
        `
        container.appendChild(span)

        gsap.fromTo(span,
          { y: 0, opacity: 1, scale: 1 },
          {
            y: -(80 + Math.random() * 100),
            x: (Math.random() - 0.5) * 60,
            opacity: 0,
            scale: 0.5,
            duration: 0.9 + i * 0.12,
            ease: 'power1.out',
            delay: i * 0.08,
            repeat: -1,
            repeatDelay: 0.2 + Math.random() * 0.3,
          },
        )
      }
    },

    // 충격파 원 emit (리라 스펙 §2-C)
    emitShockwave(targetEl: HTMLElement, color: string) {
      const rect = targetEl.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      const ring = document.createElement('div')
      ring.style.cssText = `
        position: fixed;
        left: ${cx}px;
        top: ${cy}px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid ${color};
        transform: translate(-50%, -50%) scale(0);
        pointer-events: none;
        z-index: 52;
        opacity: 0.9;
      `
      document.body.appendChild(ring)
      gsap.to(ring, {
        scale: 4,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.out',
        onComplete: () => {
          if (document.body.contains(ring)) document.body.removeChild(ring)
        },
      })
    },
  }))

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
      }}
    />
  )
})

export default BattleParticles
