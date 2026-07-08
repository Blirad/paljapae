/**
 * OnboardingStep0 — 인트로 시네마틱
 * Phase B 스펙 §B-1
 * 오행 5개 순차 등장 (GSAP) + CTA 버튼
 */
import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'

const ELEMENT_ORDER: FiveElement[] = ['木', '火', '土', '金', '水']

interface OnboardingStep0Props {
  onNext: () => void
}

export default function OnboardingStep0({ onNext }: OnboardingStep0Props) {
  const [showButton, setShowButton] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const elementsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    // 오행 5개 아이콘 순차 등장
    ELEMENT_ORDER.forEach((_, i) => {
      const el = elementsRef.current[i]
      if (el) {
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0.5 },
          { opacity: 1, scale: 1, duration: 0.4, delay: 0.5 + i * 0.3, ease: 'back.out(1.7)' }
        )
      }
    })
    // 전부 등장 후 1초 대기 → 버튼 표시 (~3.5초)
    const timer = setTimeout(() => setShowButton(true), 500 + 5 * 300 + 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      {/* 상단 텍스트 */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 18,
          color: 'var(--text-headline)',
          textAlign: 'center',
          lineHeight: 1.6,
          padding: '0 32px',
        }}
      >
        천지의 기운이<br />당신의 탄생 순간을 기억한다
      </div>

      {/* 오행 5개 아이콘 */}
      <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
        {ELEMENT_ORDER.map((el, i) => (
          <div
            key={el}
            ref={r => { elementsRef.current[i] = r }}
            style={{ opacity: 0, textAlign: 'center' }}
          >
            <div style={{ fontSize: 40 }}>{ELEMENT_DISPLAY[el].icon}</div>
            <div
              style={{
                fontSize: 12,
                color: ELEMENT_DISPLAY[el].color,
                fontFamily: 'var(--font-mono)',
                marginTop: 4,
              }}
            >
              {el}
            </div>
          </div>
        ))}
      </div>

      {/* CTA 버튼 */}
      {showButton && (
        <button
          onClick={onNext}
          style={{
            marginTop: 32,
            padding: '14px 32px',
            background: 'var(--gold)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 16,
            color: '#1A1714',
            opacity: 0,
            animation: 'fadeIn 0.4s ease-out forwards',
          }}
        >
          당신의 운명을 확인하시겠습니까?
        </button>
      )}
    </div>
  )
}
