/**
 * EnergyOrbs — 오행별 에너지 구슬 컴포넌트
 * 리라 스펙 §인터랙션명세 §2
 * 20px 원형 radial-gradient 구슬, GSAP stagger bounce
 */

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { FiveElement } from '@/types/elements'
import { ENERGY_CAP } from '@/types/game'

// ────────────────────────────────────────────────────
// 오행별 구슬 그라디언트
// ────────────────────────────────────────────────────

const ORB_GRADIENT: Record<FiveElement, string> = {
  '木': 'radial-gradient(circle at 35% 35%, #7EC87A, #2E6B2A)',
  '火': 'radial-gradient(circle at 35% 35%, #FF8C5A, #C4400A)',
  '土': 'radial-gradient(circle at 35% 35%, #F0C84A, #A07820)',
  '金': 'radial-gradient(circle at 35% 35%, #C8E4F8, #5A8AB8)',
  '水': 'radial-gradient(circle at 35% 35%, #64C8F8, #1A5A9A)',
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface EnergyOrbsProps {
  element: FiveElement
  currentEnergy: number
  maxEnergy?: number
  showLabel?: boolean
}

export default function EnergyOrbs({
  element,
  currentEnergy,
  maxEnergy = ENERGY_CAP,
  showLabel = true,
}: EnergyOrbsProps): React.ReactElement {
  const orbRefs = useRef<(HTMLDivElement | null)[]>([])
  const prevEnergyRef = useRef(currentEnergy)
  const gradient = ORB_GRADIENT[element]

  // 에너지 충전 시 (에너지 증가했을 때) GSAP stagger bounce
  useEffect(() => {
    if (currentEnergy > prevEnergyRef.current) {
      // 활성 구슬들에 bounce 애니메이션
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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}>
      {showLabel && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          letterSpacing: '0.05em',
          flexShrink: 0,
        }}>
          기운
        </span>
      )}
      <div style={{ display: 'flex', gap: 3 }}>
        {Array(maxEnergy).fill(null).map((_, i) => {
          const isActive = i < currentEnergy
          return (
            <div
              key={i}
              ref={el => { orbRefs.current[i] = el }}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: isActive
                  ? gradient
                  : 'rgba(255,255,255,0.08)',
                border: isActive
                  ? 'none'
                  : '1px solid rgba(255,255,255,0.12)',
                flexShrink: 0,
                position: 'relative',
                boxShadow: isActive
                  ? `0 2px 6px rgba(0,0,0,0.4)`
                  : 'none',
              }}
            >
              {/* 하이라이트 흰 점 */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'white',
                  opacity: 0.5,
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          )
        })}
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}>
        {currentEnergy}/{maxEnergy}
      </span>
    </div>
  )
}
