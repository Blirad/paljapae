/**
 * HeroCharacter — 전투 필드 영웅 캐릭터 표시 (Phase 2-A)
 * 리라 스펙 §1 (HeroCharacter.tsx 신규)
 * 96×88px SVG + GSAP 공격/피격 애니메이션
 */

import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import type { FiveElement } from '@/types/elements'
import type { SilhouetteVariant } from './CardArtSVG'

// ────────────────────────────────────────────────────
// 오행별 글로우 컬러
// ────────────────────────────────────────────────────

const ELEMENT_GLOW: Record<FiveElement, string> = {
  '木': 'rgba(76,175,80,0.55)',
  '火': 'rgba(255,107,53,0.55)',
  '土': 'rgba(212,160,23,0.55)',
  '金': 'rgba(135,206,235,0.55)',
  '水': 'rgba(79,195,247,0.55)',
}

const ELEMENT_COLOR: Record<FiveElement, string> = {
  '木': '#4CAF50',
  '火': '#FF6B35',
  '土': '#D4A017',
  '金': '#87CEEB',
  '水': '#4FC3F7',
}

const ELEMENT_HP_COLOR: Record<FiveElement, string> = {
  '木': '#7EC87A',
  '火': '#FF8C5A',
  '土': '#F0C84A',
  '金': '#C8E4F8',
  '水': '#64C8F8',
}

// ────────────────────────────────────────────────────
// 실루엣 PNG 이미지 렌더링 (CardArtSVG에서 분리)
// ────────────────────────────────────────────────────

const SILHOUETTE_SRC: Record<SilhouetteVariant, string> = {
  shield: '/card-art/shield.png',
  spear: '/card-art/spear.png',
  poison: '/card-art/poison.png',
  rush: '/card-art/rush.png',
  taoist: '/card-art/taoist.png',
  iceblade: '/card-art/iceblade.png',
  swordsman: '/card-art/swordsman.png',
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface HeroCharacterProps {
  heroType: SilhouetteVariant
  side: 'player' | 'ai'
  hp: number
  maxHp: number
  isAttacking: boolean
  isHit: boolean
  element: FiveElement
}

// ────────────────────────────────────────────────────
// HeroCharacter 컴포넌트
// ────────────────────────────────────────────────────

export default function HeroCharacter({
  heroType,
  side,
  hp,
  maxHp,
  isAttacking,
  isHit,
  element,
}: HeroCharacterProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const glowColor = ELEMENT_GLOW[element]
  const hpColor = ELEMENT_HP_COLOR[element]
  const accentColor = ELEMENT_COLOR[element]
  const hpPct = Math.max(0, Math.min(1, hp / maxHp))
  const isLowHp = hpPct <= 0.3

  // 공격 방향: player는 오른쪽(+60), ai는 왼쪽(-60)
  const attackDir = side === 'player' ? 60 : -60

  // ────────────────────────────────────────────────────
  // 공격 애니메이션 (isAttacking=true 감지)
  // ────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el || !isAttacking) return

    gsap.timeline()
      .to(el, { x: attackDir, duration: 0.15, ease: 'power3.out' })
      .to(el, { x: attackDir, duration: 0.05 })      // 히트스탑
      .to(el, { x: 0, duration: 0.2, ease: 'power2.out' })
  }, [isAttacking, attackDir])

  // ────────────────────────────────────────────────────
  // 피격 애니메이션 (isHit=true 감지)
  // ────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    const overlay = overlayRef.current
    if (!isHit) return

    // 빨간 flash overlay
    if (overlay) {
      gsap.timeline()
        .to(overlay, { opacity: 0.5, duration: 0.05 })
        .to(overlay, { opacity: 0, duration: 0.1 })
    }

    // shake ±8px
    if (el) {
      gsap.timeline()
        .to(el, { x: -8, duration: 0.06, ease: 'none' })
        .to(el, { x: 8, duration: 0.06 })
        .to(el, { x: -6, duration: 0.06 })
        .to(el, { x: 6, duration: 0.06 })
        .to(el, { x: 0, duration: 0.06 })
    }
  }, [isHit])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        width: 96,
      }}
    >
      {/* 영웅 SVG 래퍼 — 글로우 + 반전 */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: 96,
          height: 88,
          transform: side === 'ai' ? 'scaleX(-1)' : 'scaleX(1)',
          borderRadius: 8,
          boxShadow: `0 0 18px ${glowColor}, 0 0 36px ${glowColor.replace('0.55', '0.25')}`,
          animation: 'heroGlowPulse 2.4s ease-in-out infinite',
          willChange: 'transform',
        }}
      >
        {/* 오행 패턴 배경 */}
        <svg
          width={96}
          height={88}
          viewBox="0 0 64 58"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            display: 'block',
            width: 96,
            height: 88,
            borderRadius: 8,
          }}
        >
          <defs>
            <radialGradient id={`hero-glow-${element}-${side}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 어두운 배경 */}
          <rect width="64" height="58" fill="#0a0a0a" rx="4" />

          {/* 오행 글로우 오버레이 */}
          <ellipse cx="32" cy="32" rx="28" ry="24" fill={`url(#hero-glow-${element}-${side})`} />

          {/* 실루엣 이미지 */}
          <image
            href={SILHOUETTE_SRC[heroType]}
            x="0"
            y="0"
            width="64"
            height="58"
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>

        {/* 피격 빨간 오버레이 */}
        <div
          ref={overlayRef}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            background: 'rgba(220,38,38,1)',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      </div>

      {/* HP 바 */}
      <div
        style={{
          width: 96,
          height: 4,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: 4,
            width: `${hpPct * 100}%`,
            background: hpColor,
            transition: 'width 0.4s ease-out',
            animation: isLowHp ? 'pulseRed 0.8s ease-in-out infinite' : 'none',
          }}
        />
      </div>

      {/* HP 숫자 */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: isLowHp ? '#EF4444' : hpColor,
          letterSpacing: '0.05em',
          fontWeight: 700,
          animation: isLowHp ? 'pulseRed 0.8s ease-in-out infinite' : 'none',
        }}
      >
        {hp}/{maxHp}
      </div>
    </div>
  )
}
