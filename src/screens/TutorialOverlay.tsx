/**
 * TutorialOverlay — 첫 전투 진입 시 조작 안내 오버레이 (M7 P4-A)
 * 리라 M7 P1P4 스펙 §5 기준
 *
 * - 3단계 순차 안내: 카드 드래그 → 에너지 → 턴 종료
 * - localStorage 완료 상태 저장
 * - 건너뛰기 즉시 처리
 */

import React, { useState, useEffect } from 'react'
import { markTutorialDone } from '@/utils/persistence'

// ────────────────────────────────────────────────────
// 튜토리얼 단계 데이터
// ────────────────────────────────────────────────────

const STEPS = [
  {
    title: '카드를 아래로 드래그하세요',
    desc: '핸드에서 카드를 드래그해 필드에 내려놓으면 병사가 소환됩니다. 에너지가 충분해야 소환 가능합니다.',
    cta: '다음 →',
    spotlightPos: 'bottom' as const, // 핸드 영역
  },
  {
    title: '에너지로 카드를 씁니다',
    desc: '매 턴 에너지가 3개 충전됩니다. 카드마다 비용이 다릅니다. 에너지가 0이 되면 더 이상 카드를 낼 수 없습니다.',
    cta: '다음 →',
    spotlightPos: 'top' as const, // TopStatusBar 에너지 영역
  },
  {
    title: '턴을 종료하면 상대가 움직입니다',
    desc: '원하는 카드를 모두 내고 나서 턴 종료 버튼을 탭하세요. 상대방 AI가 행동합니다.',
    cta: '시작합니다!',
    spotlightPos: 'action' as const, // ActionBar
  },
] as const

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface TutorialOverlayProps {
  onDone: () => void
}

// ────────────────────────────────────────────────────
// TutorialOverlay
// ────────────────────────────────────────────────────

export default function TutorialOverlay({ onDone }: TutorialOverlayProps): React.ReactElement {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [bubbleVisible, setBubbleVisible] = useState(false)
  // MOD-3: 슬라이드 방향 ('in' | 'out')
  const [bubbleSlide, setBubbleSlide] = useState<'in' | 'out'>('in')
  const [isExiting, setIsExiting] = useState(false)

  const current = STEPS[step]

  // 마운트 후 500ms 딜레이로 등장
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 500)
    const t2 = setTimeout(() => setBubbleVisible(true), 700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  function handleNext(): void {
    if (step < STEPS.length - 1) {
      // MOD-3: 현재 말풍선 out (opacity 0 + translateX -20px)
      setBubbleSlide('out')
      setBubbleVisible(false)
      setTimeout(() => {
        setStep(s => s + 1)
        // 새 말풍선 in (translateX 20px→0 + opacity 0→1)
        setBubbleSlide('in')
        setBubbleVisible(true)
      }, 250)
    } else {
      handleFinish()
    }
  }

  function handleFinish(): void {
    setIsExiting(true)
    setTimeout(() => {
      markTutorialDone()
      onDone()
    }, 350)
  }

  function handleSkip(): void {
    handleFinish()
  }

  // Spotlight 스타일 — 단계별 위치
  function getSpotlightStyle(): React.CSSProperties {
    switch (current.spotlightPos) {
      case 'bottom':
        return {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30%',
          zIndex: 101,
          boxShadow: '0 0 0 9999px rgba(26,23,20,0.75)',
          pointerEvents: 'none',
        }
      case 'top':
        return {
          position: 'fixed',
          top: 52,
          left: 16,
          right: 16,
          height: 28,
          zIndex: 101,
          boxShadow: '0 0 0 9999px rgba(26,23,20,0.75)',
          border: '2px solid rgba(201,168,76,0.6)',
          pointerEvents: 'none',
        }
      case 'action':
        return {
          position: 'fixed',
          bottom: 80,
          left: 0,
          right: 0,
          height: 56,
          zIndex: 101,
          boxShadow: '0 0 0 9999px rgba(26,23,20,0.75)',
          border: '2px solid rgba(201,168,76,0.6)',
          pointerEvents: 'none',
        }
    }
  }

  // 말풍선 위치 — 단계별
  function getBubbleStyle(): React.CSSProperties {
    // MOD-3: out 시 -20px, in 대기 시 +20px, in 완료(visible=true) 시 0
    const slideOffset = bubbleVisible
      ? 0
      : bubbleSlide === 'out'
      ? -20
      : 20
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 102,
      background: 'var(--surface)',
      border: '2px solid var(--border-gold)',
      padding: '16px 20px',
      maxWidth: 260,
      left: '50%',
      transform: `translateX(calc(-50% + ${slideOffset}px))`,
      opacity: bubbleVisible ? 1 : 0,
      transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
    }
    switch (current.spotlightPos) {
      case 'bottom':
        return { ...base, top: '20%' }
      case 'top':
        return { ...base, top: 100 }
      case 'action':
        return { ...base, bottom: 160 }
    }
  }

  // 손가락 아이콘 (단계 1에서만)
  const showFinger = step === 0

  return (
    <>
      {/* 오버레이 배경 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(26,23,20,0.75)',
          zIndex: 100,
          opacity: isExiting ? 0 : visible ? 1 : 0,
          transition: 'opacity 0.35s ease-out',
          pointerEvents: 'all',
        }}
      />

      {/* Spotlight 영역 */}
      <div style={getSpotlightStyle()} />

      {/* 말풍선 */}
      <div style={getBubbleStyle()}>
        {/* 단계 표시 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          marginBottom: 8,
          letterSpacing: '0.05em',
        }}>
          {step + 1}/{STEPS.length}
        </div>

        {/* 제목 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--text-headline)',
          marginBottom: 8,
          lineHeight: 1.4,
        }}>
          {current.title}
        </div>

        {/* 구분선 */}
        <div style={{
          height: 1,
          background: 'var(--border-subtle)',
          marginBottom: 8,
        }} />

        {/* 설명 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginBottom: 14,
        }}>
          {current.desc}
        </div>

        {/* 손가락 아이콘 (단계 1) */}
        {showFinger && (
          <div style={{
            textAlign: 'center',
            marginBottom: 10,
            animation: 'tutorialFinger 0.8s ease-in-out infinite alternate',
            fontSize: 20,
          }}>
            ☛
          </div>
        )}

        {/* CTA 버튼 */}
        <button
          type="button"
          onClick={handleNext}
          style={{
            width: '100%',
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--gold)',
            textAlign: 'right',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {current.cta}
        </button>
      </div>

      {/* 건너뛰기 (항상 하단 고정) */}
      <button
        type="button"
        onClick={handleSkip}
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 102,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-muted)',
          textDecoration: 'underline',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        건너뛰기
      </button>

      {/* 손가락 애니메이션 keyframe */}
      <style>{`
        @keyframes tutorialFinger {
          from { transform: translateY(0); }
          to   { transform: translateY(-16px); }
        }
      `}</style>
    </>
  )
}
