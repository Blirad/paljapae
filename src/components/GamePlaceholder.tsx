/**
 * GamePlaceholder — M3 구현 전 게임 씬 플레이스홀더
 * 온보딩 완료 후 진입하는 화면
 */
import React from 'react'
import { useOnboardingStore } from '@/game/store/onboardingStore'
import { ELEMENT_DISPLAY } from '@/types/elements'

interface GamePlaceholderProps {
  onRestart: () => void
}

export default function GamePlaceholder({ onRestart }: GamePlaceholderProps): React.ReactElement {
  const result = useOnboardingStore(s => s.onboardingResult)

  const element = result?.primaryElement ?? '火'
  const hero = result?.hero
  const display = ELEMENT_DISPLAY[element]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0D0B08',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '64px', marginBottom: '16px' }} aria-hidden="true">
        {display.icon}
      </div>
      <h1
        style={{
          fontFamily: 'Noto Serif KR, serif',
          fontWeight: 700,
          fontSize: '24px',
          color: '#E8E0D0',
          margin: '0 0 8px',
        }}
      >
        {hero?.name ?? '영웅'}
      </h1>
      <p
        style={{
          fontFamily: 'Noto Serif KR, serif',
          fontStyle: 'italic',
          fontSize: '14px',
          color: display.color,
          margin: '0 0 32px',
        }}
      >
        "{hero?.nickname ?? ''}"
      </p>

      <div
        style={{
          background: '#1A1714',
          border: '1px solid rgba(232,200,74,0.12)',
          borderRadius: '12px',
          padding: '20px 24px',
          maxWidth: '300px',
          marginBottom: '32px',
        }}
      >
        <p
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.1em',
            color: '#6B5F52',
            margin: '0 0 8px',
          }}
        >
          BATTLE ENGINE
        </p>
        <p
          style={{
            fontFamily: 'Noto Serif KR, serif',
            fontSize: '16px',
            color: '#A89880',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          전투 엔진 준비 중
        </p>
        <p
          style={{
            fontFamily: 'Noto Sans KR, sans-serif',
            fontSize: '12px',
            color: '#6B5F52',
            margin: '8px 0 0',
          }}
        >
          M3 스프린트에서 구현됩니다
        </p>
      </div>

      <button
        onClick={onRestart}
        style={{
          background: 'transparent',
          border: '1px solid rgba(232,200,74,0.45)',
          borderRadius: '8px',
          padding: '12px 24px',
          color: '#E8E0D0',
          fontFamily: 'Noto Sans KR, sans-serif',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        처음부터 다시 시작
      </button>
    </div>
  )
}
