/**
 * TurnTimerBar — PvP 턴 타이머 바 32px
 * 리라 스펙 §신규 컴포넌트: TurnTimerBar
 * 4단계 상태 기계: FULL(초록) → WARNING(황색) → CRITICAL(빨강) → EXPIRED(비활성)
 * GSAP 색상 트위닝 + shake
 */

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'

// ────────────────────────────────────────────────────
// 타이머 상태
// ────────────────────────────────────────────────────

type TimerState = 'FULL' | 'WARNING' | 'CRITICAL' | 'EXPIRED'

function getTimerState(secondsLeft: number): TimerState {
  if (secondsLeft <= 0) return 'EXPIRED'
  if (secondsLeft <= 10) return 'CRITICAL'
  if (secondsLeft <= 30) return 'WARNING'
  return 'FULL'
}

const TIMER_COLORS: Record<TimerState, string> = {
  FULL: '#4A7A45',
  WARNING: '#F59E0B',
  CRITICAL: '#EF4444',
  EXPIRED: '#1A1410',
}

const TIMER_TEXT_COLORS: Record<TimerState, string> = {
  FULL: 'var(--text-secondary)',
  WARNING: '#1A1410',
  CRITICAL: '#FFFFFF',
  EXPIRED: 'var(--text-muted)',
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface TurnTimerBarProps {
  secondsLeft: number    // 0~60
  isMyTurn: boolean      // 내 턴 여부
  onExpire: () => void   // 0초 도달 콜백
}

// ────────────────────────────────────────────────────
// TurnTimerBar
// ────────────────────────────────────────────────────

export default function TurnTimerBar({
  secondsLeft,
  isMyTurn,
  onExpire,
}: TurnTimerBarProps): React.ReactElement {
  const barRef = useRef<HTMLDivElement>(null)
  const prevStateRef = useRef<TimerState>('FULL')
  const expiredCalledRef = useRef(false)

  const timerState = isMyTurn ? getTimerState(secondsLeft) : 'FULL' // 상대 턴은 회색 고정

  // 상태 전환 처리 (GSAP 색상 트위닝)
  useEffect(() => {
    if (!barRef.current) return

    // 새 턴 시작(secondsLeft가 60으로 복귀) 시 expiredCalledRef 리셋
    if (secondsLeft >= 60) {
      expiredCalledRef.current = false
    }

    const prevState = prevStateRef.current
    const newState = timerState

    // 상대 턴: 회색 고정
    if (!isMyTurn) {
      gsap.to(barRef.current, {
        backgroundColor: 'rgba(255,255,255,0.15)',
        duration: 0.3,
      })
      return
    }

    // 상태 변경 시 색상 트위닝
    if (prevState !== newState) {
      gsap.to(barRef.current, {
        backgroundColor: TIMER_COLORS[newState],
        duration: 0.3,
      })

      // WARNING 진입 시 pulse 1회
      if (newState === 'WARNING') {
        gsap.fromTo(
          barRef.current,
          { scaleX: 1 },
          {
            scaleX: 1.03,
            duration: 0.15,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut',
          },
        )
      }

      // CRITICAL 진입 시 pulseRed 시작
      if (newState === 'CRITICAL') {
        gsap.to(barRef.current, {
          backgroundColor: TIMER_COLORS.CRITICAL,
          duration: 0.3,
        })
      }

      prevStateRef.current = newState
    }

    // CRITICAL: 매 초 shake
    if (newState === 'CRITICAL' && secondsLeft > 0) {
      gsap.to(barRef.current, {
        x: -2,
        duration: 0.05,
        yoyo: true,
        repeat: 3,
        ease: 'power1.inOut',
      })
    }

    // EXPIRED: onExpire 콜백 (1회만)
    if (newState === 'EXPIRED' && !expiredCalledRef.current) {
      expiredCalledRef.current = true
      onExpire()
    }
  }, [secondsLeft, timerState, isMyTurn, onExpire])

  // 바 진행률 (0~1)
  const barPct = isMyTurn ? Math.max(0, Math.min(1, secondsLeft / 60)) : 1

  // 초기 색상 설정
  const initialBg = isMyTurn ? TIMER_COLORS[timerState] : 'rgba(255,255,255,0.15)'
  const textColor = isMyTurn ? TIMER_TEXT_COLORS[timerState] : 'var(--text-muted)'

  const labelText = timerState === 'EXPIRED'
    ? '시간 초과'
    : isMyTurn
    ? `${secondsLeft}초`
    : `${secondsLeft}초 상대 턴`

  return (
    <div
      ref={barRef}
      role="progressbar"
      aria-valuenow={secondsLeft}
      aria-valuemin={0}
      aria-valuemax={60}
      aria-label={isMyTurn ? `내 턴 남은 시간: ${secondsLeft}초` : `상대 턴 남은 시간: ${secondsLeft}초`}
      style={{
        height: 32,
        background: initialBg,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* 진행 바 (fill) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${barPct * 100}%`,
          background: 'rgba(0,0,0,0.15)',
          transition: 'width 0.9s linear',
          pointerEvents: 'none',
        }}
      />

      {/* 레이블 */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: textColor,
        letterSpacing: '0.05em',
        position: 'relative',
        zIndex: 1,
        whiteSpace: 'nowrap',
        marginLeft: 'auto',
      }}>
        {labelText}
      </span>
    </div>
  )
}
