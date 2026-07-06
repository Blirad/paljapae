/**
 * RelicObtainOverlay — 유물 획득 연출 오버레이 (M8 P0-1)
 * 리라 M8 스펙 P0-1 유물 획득 연출 명세 기반
 *
 * 연출 순서:
 * 1. 화면 중앙 오버레이 등장 (opacity 0→1, 300ms)
 * 2. 아이콘: scale(0.5→1.0), cubic-bezier 탄성
 * 3. 유물명/설명: 아이콘 후 200ms 딜레이 fade-in
 * 4. GSAP 골드 파티클 8개 stagger
 * 5. 확인 버튼: 연출 완료 후 등장
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'
import type { RelicId } from '@/types/relics'
import { ALL_RELICS } from '@/types/relics'

// ────────────────────────────────────────────────────
// 스타일 주입
// ────────────────────────────────────────────────────

const STYLE_ID = 'relic-obtain-overlay-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes relicObtainOverlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes relicObtainIconIn {
      0%   { transform: scale(0.5); opacity: 0; }
      70%  { transform: scale(1.08); opacity: 1; }
      100% { transform: scale(1.0); opacity: 1; }
    }
    @keyframes relicObtainFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes relicObtainBtnIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `
  document.head.appendChild(style)
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface RelicObtainOverlayProps {
  relicId: RelicId
  onConfirm: () => void
}

// ────────────────────────────────────────────────────
// RelicObtainOverlay 메인
// ────────────────────────────────────────────────────

export default function RelicObtainOverlay({
  relicId,
  onConfirm,
}: RelicObtainOverlayProps): React.ReactElement {
  const [showButton, setShowButton] = useState(false)
  const particleContainerRef = useRef<HTMLDivElement | null>(null)
  const relic = ALL_RELICS[relicId]

  useEffect(() => {
    injectStyles()

    // 버튼은 연출(700ms) 완료 후 표시
    const t = setTimeout(() => setShowButton(true), 700)

    // GSAP 파티클 효과 (8개)
    const container = particleContainerRef.current
    if (container) {
      const particles: HTMLDivElement[] = []
      for (let i = 0; i < 8; i++) {
        const p = document.createElement('div')
        p.style.cssText = `
          position: absolute;
          width: 6px;
          height: 6px;
          background: var(--gold);
          border-radius: 50%;
          left: 50%;
          top: 50%;
          opacity: 1;
          pointer-events: none;
        `
        container.appendChild(p)
        particles.push(p)
      }

      // stagger 파티클 애니메이션
      gsap.to(particles, {
        x: () => (Math.random() - 0.5) * 120,
        y: () => -Math.random() * 100 - 20,
        opacity: 0,
        scale: () => Math.random() * 1.5 + 0.5,
        duration: 0.8,
        ease: 'power2.out',
        stagger: 0.05,
        delay: 0.1,
        onComplete: () => {
          particles.forEach(p => p.remove())
        },
      })
    }

    return () => clearTimeout(t)
  }, [])

  const handleConfirm = useCallback(() => {
    onConfirm()
  }, [onConfirm])

  if (!relic) return <></>

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`유물 획득: ${relic.name}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(26,20,16,0.80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'relicObtainOverlayIn 0.3s ease-out',
        padding: '0 24px',
      }}
    >
      {/* 컨텐츠 패널 */}
      <div style={{
        width: '100%',
        maxWidth: 300,
        background: 'var(--surface)',
        border: '2px solid var(--border-gold)',
        padding: '32px 24px 24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 상단 타이틀 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--gold)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          marginBottom: 20,
          animation: 'relicObtainFadeIn 0.3s ease-out 0.1s both',
        }}>
          유물 획득!
        </div>

        {/* 구분선 */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--border-gold), transparent)',
          marginBottom: 20,
        }} />

        {/* 파티클 컨테이너 */}
        <div
          ref={particleContainerRef}
          style={{ position: 'absolute', top: '40%', left: '50%', pointerEvents: 'none' }}
        />

        {/* 아이콘 */}
        <div
          aria-hidden="true"
          style={{
            fontSize: 48,
            marginBottom: 16,
            display: 'inline-block',
            animation: 'relicObtainIconIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
          }}
        >
          {relic.icon}
        </div>

        {/* 유물명 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: 18,
          color: 'var(--gold)',
          marginBottom: 8,
          animation: 'relicObtainFadeIn 0.3s ease-out 0.3s both',
        }}>
          {relic.name}
        </div>

        {/* 효과 설명 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          marginBottom: 16,
          animation: 'relicObtainFadeIn 0.3s ease-out 0.45s both',
        }}>
          {relic.description}
        </div>

        {/* 구분선 */}
        <div style={{
          height: 1,
          background: 'var(--border-subtle)',
          marginBottom: 12,
          animation: 'relicObtainFadeIn 0.25s ease-out 0.55s both',
        }} />

        {/* 플레이버 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          marginBottom: 20,
          animation: 'relicObtainFadeIn 0.3s ease-out 0.65s both',
        }}>
          "{relic.flavorText}"
        </div>

        {/* 확인 버튼 */}
        {showButton && (
          <button
            onClick={handleConfirm}
            style={{
              width: '100%',
              height: 44,
              background: 'var(--gold)',
              border: 'none',
              color: '#1A1714',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              letterSpacing: '0.05em',
              animation: 'relicObtainBtnIn 0.25s ease-out',
            }}
          >
            획득하기
          </button>
        )}

        {/* 툴팁 안내 */}
        <div style={{
          marginTop: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          animation: 'relicObtainFadeIn 0.3s ease-out 0.8s both',
        }}>
          유물은 런 내내 효과를 발휘합니다
        </div>
      </div>
    </div>
  )
}
