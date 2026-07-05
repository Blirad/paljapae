/**
 * DefeatScreen — 전투 패배 화면 (M7 P0-A)
 * 리라 M7 P0 UX 스펙 §P0-A
 *
 * 진입: battle 패배(HP=0) → handleBattleDefeat → clearAllProgress + reset → 'defeat'
 * 진출: "다시 팔자를 뽑아볼까요?" → onStartNewRun() → 'onboarding'
 */

import React, { useState, useEffect } from 'react'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY } from '@/types/elements'

export interface DefeatScreenProps {
  heroName: string
  playerElement: FiveElement
  stagesCleared: number
  onStartNewRun: () => void
}

export default function DefeatScreen({
  heroName,
  playerElement,
  stagesCleared,
  onStartNewRun,
}: DefeatScreenProps): React.ReactElement {
  const [containerVisible, setContainerVisible] = useState(false)
  const [kanjiVisible, setKanjiVisible] = useState(false)
  const [contentVisible, setContentVisible] = useState(false)

  const elementInfo = ELEMENT_DISPLAY[playerElement]

  useEffect(() => {
    // 컨테이너 페이드인 즉시
    const t0 = setTimeout(() => setContainerVisible(true), 0)
    // 100ms 후 '敗' 한자 scaleIn
    const t1 = setTimeout(() => setKanjiVisible(true), 100)
    // 400ms 후 텍스트/기록/버튼 slideUp
    const t2 = setTimeout(() => setContentVisible(true), 400)
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  // 구분선 컴포넌트
  function Divider(): React.ReactElement {
    return (
      <div style={{
        width: '80%',
        height: 1,
        background: 'linear-gradient(90deg, transparent, var(--border-subtle), transparent)',
        margin: '24px auto',
      }} />
    )
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 480,
        margin: '0 auto',
        padding: '0 24px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
        opacity: containerVisible ? 1 : 0,
        transition: 'opacity 0.3s ease-out',
      }}
    >
      {/* 대형 한자 '敗' */}
      <div
        aria-hidden="true"
        style={{
          marginTop: 72,
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 88,
          color: 'var(--accent-red)',
          textAlign: 'center',
          lineHeight: 1,
          animation: kanjiVisible
            ? 'scaleIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both'
            : 'none',
          opacity: kanjiVisible ? 1 : 0,
          transition: kanjiVisible ? 'none' : 'opacity 0s',
        }}
      >
        敗
      </div>

      {/* 텍스트 블록 + 기록 + 버튼 */}
      <div
        style={{
          width: '100%',
          marginTop: 24,
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
        }}
      >
        {/* 주 제목 */}
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 24,
            color: 'var(--text-headline)',
            textAlign: 'center',
          }}
        >
          팔자가 나빴군요.
        </div>

        {/* 부 문구 */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          오늘은 여기까지입니다.
        </div>

        {/* 영웅 정보 */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          {elementInfo.icon} {heroName}
        </div>

        <Divider />

        {/* 이번 런 기록 패널 */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            padding: 16,
            width: '100%',
          }}
        >
          {/* 섹션 레이블 */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: 12,
            }}
          >
            이번 런 기록
          </div>

          {/* 스테이지 클리어 행 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              스테이지 클리어
            </span>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 20,
                color: 'var(--text-headline)',
              }}
            >
              {stagesCleared}
            </span>
          </div>
        </div>

        <Divider />

        {/* CTA 버튼 */}
        <button
          type="button"
          onClick={onStartNewRun}
          style={{
            width: '100%',
            padding: '14px 0',
            background: 'var(--gold)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            fontWeight: 700,
            color: '#1A1714',
            textAlign: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          다시 팔자를 뽑아볼까요?
        </button>
      </div>
    </div>
  )
}
