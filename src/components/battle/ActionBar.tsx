/**
 * ActionBar — 하단 액션 바
 * 리라 스펙 §2-2 [G]
 */

import React from 'react'
import { MAX_TURNS } from '@/types/game'

interface ActionBarProps {
  turn: number
  phase: string
  isProcessing: boolean
  isAiTurn: boolean
  logOpen: boolean
  onEndTurn: () => void
  onToggleLog: () => void
}

export default function ActionBar({
  turn,
  phase,
  isProcessing,
  isAiTurn,
  logOpen,
  onEndTurn,
  onToggleLog,
}: ActionBarProps): React.ReactElement {
  const canEndTurn = phase === 'main' && !isAiTurn && !isProcessing

  let buttonText = '턴 종료'
  if (isAiTurn) buttonText = 'AI 턴 중...'
  else if (isProcessing) buttonText = '전투 중...'

  return (
    <div style={{
      height: 56,
      background: '#1A1714',
      borderTop: '1px solid rgba(232,200,74,0.12)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 8,
      flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {/* 턴 표시 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B5F52', lineHeight: 1 }}>턴</span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 20, color: '#E8C84A', lineHeight: 1 }}>
          {turn}
        </span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B5F52', lineHeight: 1 }}>
          /{MAX_TURNS}
        </span>
      </div>

      {/* 턴 종료 버튼 */}
      <button
        disabled={!canEndTurn}
        onClick={onEndTurn}
        style={{
          flex: 1,
          height: 40,
          borderRadius: 8,
          border: canEndTurn ? 'none' : '1px solid rgba(232,200,74,0.12)',
          background: canEndTurn ? '#E8C84A' : '#1A1714',
          color: canEndTurn ? '#0D0B08' : '#6B5F52',
          fontFamily: 'Noto Sans KR, sans-serif',
          fontWeight: 700,
          fontSize: 14,
          cursor: canEndTurn ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s, color 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
        aria-label={buttonText}
      >
        {(isProcessing || isAiTurn) && (
          <span style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid #6B5F52',
            borderTopColor: '#A89880',
            animation: 'spin 0.8s linear infinite',
            display: 'inline-block',
          }} />
        )}
        {buttonText}
      </button>

      {/* 로그 버튼 */}
      <button
        onClick={onToggleLog}
        style={{
          height: 40,
          width: 48,
          borderRadius: 8,
          border: `1px solid ${logOpen ? 'rgba(232,200,74,0.45)' : 'rgba(232,200,74,0.12)'}`,
          background: 'transparent',
          color: logOpen ? '#E8C84A' : '#A89880',
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          cursor: 'pointer',
          flexShrink: 0,
        }}
        aria-label="전투 로그 보기"
      >
        로그
      </button>
    </div>
  )
}
