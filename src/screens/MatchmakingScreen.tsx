/**
 * MatchmakingScreen — PvP 매칭 대기 화면
 * 리라 스펙 §신규 화면 2 — MatchmakingScreen
 * AppScene: 'pvpMatchmaking'
 * 오행 링 GSAP 애니메이션 포함
 */

import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { usePvPStore, mockStartMatching } from '@/stores/pvpStore'

// ────────────────────────────────────────────────────
// PvPMatchRing 컴포넌트 (오행 링 SVG 애니메이션)
// ────────────────────────────────────────────────────

const FIVE_ELEMENT_ICONS = ['木', '火', '土', '金', '水']
const FIVE_ELEMENT_COLORS = ['#7EC87A', '#FF8C5A', '#F0C84A', '#C8E4F8', '#64C8F8']

interface PvPMatchRingProps {
  playerElementIndex?: number // 0-4, glow 처리할 오행 인덱스
  stopped?: boolean
}

function PvPMatchRing({ playerElementIndex = 0, stopped = false }: PvPMatchRingProps): React.ReactElement {
  const outerRingRef = useRef<SVGCircleElement>(null)
  const ringGroupRef = useRef<SVGGElement>(null)
  const animRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    if (!ringGroupRef.current) return

    if (stopped) {
      animRef.current?.kill()
      return
    }

    // 외부 링 회전 (리라 스펙: 3s repeat -1 linear)
    animRef.current = gsap.to(ringGroupRef.current, {
      rotation: 360,
      transformOrigin: '40px 40px',
      duration: 3,
      repeat: -1,
      ease: 'none',
    })

    return () => {
      animRef.current?.kill()
    }
  }, [stopped])

  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="오행 매칭 링"
    >
      {/* 배경 링 */}
      <circle cx="40" cy="40" r="34" stroke="rgba(201,168,76,0.15)" strokeWidth="2" />

      {/* 회전하는 그룹 */}
      <g ref={ringGroupRef}>
        {/* 오행 아이콘 5개, 링 위 균등 배치 */}
        {FIVE_ELEMENT_ICONS.map((icon, i) => {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
          const r = 28
          const x = 40 + Math.cos(angle) * r
          const y = 40 + Math.sin(angle) * r
          const isActive = i === playerElementIndex
          const color = FIVE_ELEMENT_COLORS[i]

          return (
            <g key={icon}>
              {/* glow 원 (활성 오행) */}
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  fill={`${color}33`}
                  style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                />
              )}
              {/* 아이콘 배경 */}
              <circle
                cx={x}
                cy={y}
                r={8}
                fill="var(--surface)"
                stroke={color}
                strokeWidth={isActive ? 1.5 : 0.8}
                opacity={isActive ? 1 : 0.6}
              />
              {/* 아이콘 텍스트 */}
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize={9}
                fill={color}
                opacity={isActive ? 1 : 0.7}
                fontFamily="var(--font-serif)"
              >
                {icon}
              </text>
            </g>
          )
        })}

        {/* 외부 링 장식 */}
        <circle
          ref={outerRingRef}
          cx="40"
          cy="40"
          r="34"
          stroke="rgba(201,168,76,0.4)"
          strokeWidth="1"
          strokeDasharray="4 8"
        />
      </g>

      {/* 중앙 */}
      <circle cx="40" cy="40" r="12" fill="var(--bg2)" stroke="rgba(201,168,76,0.3)" strokeWidth="1" />
      <text x="40" y="44" textAnchor="middle" fontSize={11} fill="var(--gold)" fontFamily="var(--font-serif)">
        運
      </text>
    </svg>
  )
}

// ────────────────────────────────────────────────────
// LoadingDots 컴포넌트
// ────────────────────────────────────────────────────

function LoadingDots(): React.ReactElement {
  const dot1Ref = useRef<HTMLDivElement>(null)
  const dot2Ref = useRef<HTMLDivElement>(null)
  const dot3Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refs = [dot1Ref.current, dot2Ref.current, dot3Ref.current]
    refs.forEach((el, i) => {
      if (!el) return
      gsap.fromTo(
        el,
        { opacity: 0.2 },
        {
          opacity: 1,
          duration: 0.4,
          yoyo: true,
          repeat: -1,
          delay: i * 0.4,
          ease: 'power1.inOut',
        },
      )
    })
  }, [])

  const dotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--gold)',
    opacity: 0.2,
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
      <div ref={dot1Ref} style={dotStyle} />
      <div ref={dot2Ref} style={dotStyle} />
      <div ref={dot3Ref} style={dotStyle} />
    </div>
  )
}

// ────────────────────────────────────────────────────
// MatchmakingScreen
// ────────────────────────────────────────────────────

interface MatchmakingScreenProps {
  onCancel: () => void
  onMatchFound: () => void
}

export default function MatchmakingScreen({ onCancel, onMatchFound }: MatchmakingScreenProps): React.ReactElement {
  const matchStatus = usePvPStore(s => s.matchStatus)
  const containerRef = useRef<HTMLDivElement>(null)
  const successTextRef = useRef<HTMLDivElement>(null)

  const [elapsedSec, setElapsedSec] = useState(0)
  const [matchFoundDisplayed, setMatchFoundDisplayed] = useState(false)
  const [ringStopped, setRingStopped] = useState(false)

  const mainMessage = matchFoundDisplayed
    ? '상대를 찾았습니다!'
    : elapsedSec >= 60
    ? '운명을 찾는 중... (대기 중)'
    : '운명을 찾는 중...'

  // 경과 시간 카운터
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 목 매칭 시작
  const cancelMockRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    const cancel = mockStartMatching()
    cancelMockRef.current = cancel
    return cancel
  }, [])

  // 매칭 성공 감지
  useEffect(() => {
    if (matchStatus === 'found' && !matchFoundDisplayed) {
      setRingStopped(true)
      setMatchFoundDisplayed(true)

      // scale-in 애니메이션
      if (successTextRef.current) {
        gsap.fromTo(
          successTextRef.current,
          { scale: 0.8, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.5)' },
        )
      }

      // 1초 후 pvpBattle 전환
      setTimeout(() => {
        onMatchFound()
      }, 1000)
    }
  }, [matchStatus, matchFoundDisplayed, onMatchFound])

  function handleCancel(): void {
    cancelMockRef.current?.()
    usePvPStore.getState().setMatchStatus('idle')
    onCancel()
  }

  const waitSec = Math.max(0, elapsedSec)

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 480,
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* 취소 X 버튼 (우상단 48x48) */}
      <button
        onClick={handleCancel}
        aria-label="매칭 취소"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 48,
          height: 48,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {/* 중앙 컨텐츠 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '0 20px',
        width: '100%',
      }}>
        {/* 메인 메시지 */}
        <div
          ref={matchFoundDisplayed ? successTextRef : undefined}
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 18,
            color: matchFoundDisplayed ? 'var(--gold)' : 'var(--text-headline)',
            textAlign: 'center',
            letterSpacing: '0.03em',
          }}
        >
          {mainMessage}
        </div>

        {/* 오행 링 GSAP 애니메이션 */}
        <PvPMatchRing playerElementIndex={0} stopped={ringStopped} />

        {/* 로딩 점 (매칭 성공 전만 표시) */}
        {!matchFoundDisplayed && <LoadingDots />}

        {/* 예상 대기 시간 */}
        {!matchFoundDisplayed && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-secondary)',
            letterSpacing: '0.03em',
            textAlign: 'center',
          }}>
            {waitSec > 0
              ? `대기 시간: ${waitSec}초 경과`
              : '예상 대기 시간: 확인 중'}
          </div>
        )}
      </div>

      {/* 하단 구분선 + 취소 버튼 */}
      <div style={{
        width: '100%',
        padding: '0 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        flexShrink: 0,
      }}>
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
        <button
          onClick={handleCancel}
          disabled={matchFoundDisplayed}
          style={{
            width: '100%',
            height: 44,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: matchFoundDisplayed ? 'var(--text-muted)' : 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            letterSpacing: '0.05em',
            cursor: matchFoundDisplayed ? 'not-allowed' : 'pointer',
            opacity: matchFoundDisplayed ? 0.5 : 1,
          }}
        >
          매칭 취소
        </button>
      </div>
    </div>
  )
}
