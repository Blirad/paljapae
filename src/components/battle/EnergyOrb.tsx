/**
 * EnergyOrb — STS 전투용 에너지 오브 컴포넌트
 * Phase 4 신규 파일 — 리라 스펙 §EnergyOrb
 *
 * 기존 EnergyOrbs.tsx를 STS 고정 3에너지 시스템에 맞게 재작성.
 * GSAP stagger bounce 로직 동일 이식.
 */

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { FiveElement } from '@/types/elements'

// ─── 오행별 구슬 그라디언트 (기존 EnergyOrbs.tsx 동일) ─

const ORB_GRADIENT: Record<FiveElement, string> = {
  '木': 'radial-gradient(circle at 35% 35%, #7EC87A, #2E6B2A)',
  '火': 'radial-gradient(circle at 35% 35%, #FF8C5A, #C4400A)',
  '土': 'radial-gradient(circle at 35% 35%, #F0C84A, #A07820)',
  '金': 'radial-gradient(circle at 35% 35%, #C8E4F8, #5A8AB8)',
  '水': 'radial-gradient(circle at 35% 35%, #64C8F8, #1A5A9A)',
}

// ─── Props ───────────────────────────────────────────

interface EnergyOrbProps {
  currentEnergy: number
  maxEnergy: number
  heroElement: FiveElement
}

// ─── EnergyOrb ───────────────────────────────────────

export default function EnergyOrb({
  currentEnergy,
  maxEnergy,
  heroElement,
}: EnergyOrbProps): React.ReactElement {
  const orbRefs = useRef<(HTMLDivElement | null)[]>([])
  const prevEnergyRef = useRef(currentEnergy)
  const gradient = ORB_GRADIENT[heroElement]

  // 에너지 충전 시 GSAP stagger bounce (기존 EnergyOrbs.tsx 로직 이식)
  useEffect(() => {
    if (currentEnergy > prevEnergyRef.current) {
      const activeOrbs = orbRefs.current.slice(0, currentEnergy).filter(Boolean)
      gsap.from(activeOrbs, {
        scale: 0,
        duration: 0.4,
        ease: 'back.out(1.7)',
        stagger: 0.08,
        overwrite: 'auto',
      })
    }
    prevEnergyRef.current = currentEnergy
  }, [currentEnergy])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* 레이블 */}
      <span
        style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 10,
          color: 'var(--text-muted, #6B5F52)',
          flexShrink: 0,
          letterSpacing: '0.05em',
        }}
      >
        기운
      </span>

      {/* 오브 3개 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array(maxEnergy).fill(null).map((_, i) => {
          const isActive = i < currentEnergy
          return (
            <div
              key={i}
              ref={el => { orbRefs.current[i] = el }}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: isActive ? gradient : 'rgba(255,255,255,0.08)',
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.12)',
                flexShrink: 0,
                position: 'relative',
                boxShadow: isActive
                  ? `0 2px 8px ${ELEMENT_ORB_SHADOW[heroElement]}`
                  : 'none',
              }}
            >
              {/* 하이라이트 흰 점 (기존 패턴 유지) */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'white',
                    opacity: 0.5,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* 숫자 표시 */}
      <span
        style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 12,
          color: 'var(--text-secondary, #8A7D6E)',
          flexShrink: 0,
        }}
      >
        {currentEnergy}/{maxEnergy}
      </span>
    </div>
  )
}

// ─── 오행별 그림자 색상 ──────────────────────────────

const ELEMENT_ORB_SHADOW: Record<FiveElement, string> = {
  '木': 'rgba(61,122,58,0.6)',
  '火': 'rgba(192,57,43,0.6)',
  '土': 'rgba(192,122,26,0.6)',
  '金': 'rgba(139,117,54,0.6)',
  '水': 'rgba(37,99,168,0.6)',
}
