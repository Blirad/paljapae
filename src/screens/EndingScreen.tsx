/**
 * EndingScreen — 보스 클리어 엔딩 화면 (M5)
 * 리라 M5 스펙 §4-3
 * Momentor 디자인 시스템 적용 (2026-07-05)
 */

import React, { useState, useEffect } from 'react'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY } from '@/types/elements'
import SecondaryButton from '@/components/ui/SecondaryButton'

interface EndingScreenProps {
  playerElement: FiveElement
  heroName: string
  totalAttempts: number
  unlockedCount: number
  onRestart: () => void
}

export default function EndingScreen({
  playerElement,
  heroName,
  totalAttempts,
  unlockedCount,
  onRestart,
}: EndingScreenProps): React.ReactElement {
  const [trophyVisible, setTrophyVisible] = useState(false)
  const [textVisible, setTextVisible] = useState(false)

  const elementInfo = ELEMENT_DISPLAY[playerElement]

  useEffect(() => {
    const t1 = setTimeout(() => setTrophyVisible(true), 100)
    const t2 = setTimeout(() => setTextVisible(true), 400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function handleRestart(): void {
    // ★ clearAllProgress는 App.tsx RunSummary에서 처리
    onRestart()
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      maxWidth: 480,
      margin: '0 auto',
      padding: '0 24px',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
    }}>
      {/* 대형 한자 트로피 */}
      <div style={{
        marginTop: 80,
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 80,
        color: 'var(--gold)',
        textAlign: 'center',
        transform: trophyVisible ? 'scale(1)' : 'scale(0)',
        transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        filter: 'drop-shadow(0 0 20px rgba(212,175,90,0.5))',
        lineHeight: 1,
      }}>
        覇
      </div>

      {/* 엔딩 텍스트 */}
      <div style={{
        textAlign: 'center',
        opacity: textVisible ? 1 : 0,
        transform: textVisible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
        width: '100%',
      }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 28,
          color: 'var(--gold)',
          marginTop: 16,
          letterSpacing: '0.05em',
        }}>
          팔황제를 쓰러뜨렸습니다
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}>
          당신의 팔자: {elementInfo.icon} {playerElement} — {heroName}
        </div>

        {/* 구분선 */}
        <div style={{
          width: '80%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--border-subtle), transparent)',
          margin: '24px auto',
        }} />

        {/* 통계 수치 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'center',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 28,
              color: 'var(--text-headline)',
            }}>
              {totalAttempts}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              회 도전
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 28,
              color: 'var(--text-headline)',
            }}>
              {unlockedCount}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              장 언락
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div style={{
          width: '80%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--border-subtle), transparent)',
          margin: '24px auto',
        }} />

        {/* 다시 시작 버튼 */}
        <div style={{ marginTop: 8, width: '100%' }}>
          <SecondaryButton
            onClick={handleRestart}
            className="w-full"
            style={{ width: '100%' } as React.CSSProperties}
          >
            처음부터 다시 해보기
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
