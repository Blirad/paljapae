/**
 * TitleScreen — 팔자패 타이틀 화면 (Phase A 신규)
 * 리라 스펙 LYRA_GAMEFLOW_PHASE_A_20260708.md §A-1
 *
 * 앱 최초 진입 시 표시. 기존 유저/신규 유저 분기.
 * - 오행 만다라 GSAP 애니메이션
 * - hasSaveData() 기준 onExistingUser / onNewUser 분기
 */
import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { hasSaveData } from '@/utils/persistence'

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface TitleScreenProps {
  onExistingUser: () => void  // hasSaveData() true → StartScreen
  onNewUser: () => void       // hasSaveData() false → Onboarding
}

// ────────────────────────────────────────────────────
// 오행 만다라 데이터
// 중심 (100, 100) 기준 반지름 80px, 정오각형 꼭짓점 배치
// ────────────────────────────────────────────────────

const OHAENG_MANDALA = [
  { el: '木', color: '#4a7c59', cx: 100, cy: 20 },
  { el: '火', color: '#c0392b', cx: 176, cy: 75 },
  { el: '土', color: '#c8922a', cx: 147, cy: 170 },
  { el: '金', color: '#b8860b', cx: 53, cy: 170 },
  { el: '水', color: '#1a5276', cx: 24, cy: 75 },
] as const

// ────────────────────────────────────────────────────
// TitleScreen
// ────────────────────────────────────────────────────

export default function TitleScreen({ onExistingUser, onNewUser }: TitleScreenProps): React.ReactElement {
  const mandalaRef = useRef<SVGSVGElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const subtitleRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. 만다라 전체 무한 회전 (20초/회전, ease: none)
      gsap.to(mandalaRef.current, {
        rotation: 360,
        duration: 20,
        ease: 'none',
        repeat: -1,
        transformOrigin: '50% 50%',
      })

      // 2. 오행 글로우 순환 타임라인 (木→火→土→金→水→木)
      const glowTl = gsap.timeline({ repeat: -1 })
      OHAENG_MANDALA.forEach((_, i) => {
        const circleId = `#mandala-glow-${i}`
        glowTl
          .to(circleId, { opacity: 0.9, duration: 0.4, ease: 'power1.in' }, i * 2)
          .to(circleId, { opacity: 0.25, duration: 1.6, ease: 'power1.out' }, i * 2 + 0.4)
      })

      // 3. 로고 등장 (마운트 후 0.2초 딜레이)
      gsap.fromTo(
        logoRef.current,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'power2.out', delay: 0.2 }
      )

      // 4. 부제 등장 (0.8초 딜레이)
      gsap.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out', delay: 0.8 }
      )

      // 5. CTA 등장 (1.2초 딜레이)
      gsap.fromTo(
        ctaRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power1.out', delay: 1.2 }
      )
    }, containerRef)

    return () => ctx.revert()
  }, [])

  // ────────────────────────────────────────────────────
  // 탭 핸들러
  // ────────────────────────────────────────────────────

  function handleTap(): void {
    // 만다라 fade out → 화면 전체 fade out → scene 전환
    gsap.to(mandalaRef.current, { opacity: 0, duration: 0.3 })
    gsap.to(containerRef.current, {
      opacity: 0,
      duration: 0.25,
      delay: 0.1,
      onComplete: () => {
        try {
          if (hasSaveData()) {
            onExistingUser()
          } else {
            onNewUser()
          }
        } catch {
          // localStorage 접근 불가 시 신규 유저로 처리
          onNewUser()
        }
      },
    })
  }

  // ────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      onClick={handleTap}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1a1714',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* ── 만다라 배경 레이어 (z: 0) ── */}
      <svg
        ref={mandalaRef}
        width="320"
        height="320"
        viewBox="0 0 200 200"
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <defs>
          {OHAENG_MANDALA.map((o, i) => (
            <radialGradient key={i} id={`mandala-grad-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={o.color} stopOpacity="1" />
              <stop offset="100%" stopColor={o.color} stopOpacity="0" />
            </radialGradient>
          ))}
          <filter id="mandala-blur">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* 오행 글로우 원 */}
        {OHAENG_MANDALA.map((o, i) => (
          <circle
            key={i}
            id={`mandala-glow-${i}`}
            cx={o.cx}
            cy={o.cy}
            r="36"
            fill={`url(#mandala-grad-${i})`}
            filter="url(#mandala-blur)"
            opacity="0.25"
          />
        ))}

        {/* 중심 장식 원 */}
        <circle
          cx="100"
          cy="100"
          r="12"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="0.8"
          opacity="0.4"
        />
        <circle
          cx="100"
          cy="100"
          r="4"
          fill="#D4AF37"
          opacity="0.3"
        />
      </svg>

      {/* ── 콘텐츠 레이어 (z: 1) ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        {/* 로고 */}
        <div ref={logoRef} id="title-logo" style={{ opacity: 0 }}>
          <div style={{
            fontFamily: 'Noto Serif KR, serif',
            fontSize: 18,
            fontWeight: 400,
            color: '#D4AF37',
            letterSpacing: '0.3em',
            marginBottom: 4,
          }}>
            팔자패
          </div>
          <div style={{
            fontFamily: 'Noto Serif KR, serif',
            fontSize: 48,
            fontWeight: 700,
            color: '#D4AF37',
            letterSpacing: '0.1em',
            lineHeight: 1,
            textShadow: '0 0 24px rgba(212,175,55,0.5), 0 0 48px rgba(212,175,55,0.2)',
          }}>
            八字牌
          </div>
        </div>

        {/* 구분선 */}
        <div style={{
          width: 120,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
          margin: '20px auto',
          opacity: 0.5,
        }} />

        {/* 부제 */}
        <div
          ref={subtitleRef}
          id="title-subtitle"
          style={{
            fontFamily: 'Noto Serif KR, serif',
            fontStyle: 'italic',
            fontSize: 14,
            color: '#9B8E80',
            letterSpacing: '0.2em',
            opacity: 0,
          }}
        >
          내 운명의 패를 열어라
        </div>

        {/* CTA */}
        <div
          ref={ctaRef}
          style={{
            marginTop: 56,
            fontFamily: 'DM Mono, monospace',
            fontSize: 13,
            color: '#C4A84A',
            letterSpacing: '0.25em',
            opacity: 0,
            animation: 'titleBlink 1.4s ease-in-out infinite',
            animationDelay: '1.2s',
          }}
        >
          탭하여 시작
        </div>
      </div>

      {/* ── 버전 표기 (z: 1, 우하단) ── */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 1,
        fontFamily: 'DM Mono, monospace',
        fontSize: 11,
        color: '#4A3E32',
        letterSpacing: '0.1em',
      }}>
        v0.8.0
      </div>

      {/* CTA blink keyframes 인라인 주입 */}
      <style>{`
        @keyframes titleBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.15; }
        }
      `}</style>
    </div>
  )
}
