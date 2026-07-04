/**
 * EndingScreen — 보스 클리어 엔딩 화면 (M5)
 * 리라 M5 스펙 §4-3
 */

import React, { useState, useEffect } from 'react'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY } from '@/types/elements'
import { clearAllProgress } from '@/utils/persistence'
import SecondaryButton from '@/components/ui/SecondaryButton'

interface EndingScreenProps {
  playerElement: FiveElement
  heroName: string
  totalAttempts: number   // 도전 횟수 = 클리어 스테이지 수
  unlockedCount: number   // 언락 카드 수
  onRestart: () => void   // → OnboardingFlow
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
    clearAllProgress()
    onRestart()
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0D0B08',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      maxWidth: 480,
      margin: '0 auto',
      padding: '0 24px',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
    }}>
      {/* 트로피 */}
      <div style={{
        marginTop: 80,
        fontSize: 64,
        textAlign: 'center',
        transform: trophyVisible ? 'scale(1)' : 'scale(0)',
        transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}>
        🏆
      </div>

      {/* 엔딩 텍스트 */}
      <div style={{
        textAlign: 'center',
        opacity: textVisible ? 1 : 0,
        transform: textVisible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
      }}>
        <div style={{
          fontFamily: 'Noto Serif KR, serif',
          fontWeight: 700,
          fontSize: 22,
          color: '#E8C84A',
          marginTop: 16,
        }}>
          팔황제를 쓰러뜨렸습니다
        </div>

        <div style={{
          fontFamily: 'Noto Sans KR, sans-serif',
          fontSize: 14,
          color: '#A89880',
          marginTop: 8,
        }}>
          당신의 팔자: {elementInfo.icon} {playerElement} — {heroName}
        </div>

        {/* 구분선 */}
        <div style={{
          width: '80%',
          height: 1,
          background: 'rgba(232,200,74,0.12)',
          margin: '24px auto',
        }} />

        {/* 통계 */}
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 11,
          color: '#6B5F52',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'center',
        }}>
          <div>사용 스테이지: {totalAttempts}회 도전</div>
          <div>언락 카드: {unlockedCount}장 획득</div>
        </div>

        {/* 다시 시작 버튼 */}
        <div style={{ marginTop: 32, width: '100%' }}>
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
