/**
 * ActionBar — 하단 액션 바
 * 리라 스펙 §2-2 [G]
 * Momentor 디자인 시스템 적용 (2026-07-05)
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
  if (isAiTurn) buttonText = '상대방 차례'
  else if (isProcessing) buttonText = '처리 중...'

  return (
    <div style={{
      height: 56,
      background: 'var(--bg2)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 8,
      flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {/* 턴 표시 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.1em' }}>턴</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--gold)', lineHeight: 1 }}>
          {turn}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1 }}>
          /{MAX_TURNS}
        </span>
      </div>

      {/* 턴 종료 버튼 */}
      <button
        disabled={!canEndTurn}
        onClick={onEndTurn}
        style={{
          flex: 1,
          height: 44,
          maxWidth: 200,
          border: canEndTurn ? '1px solid rgba(201,168,76,0.8)' : '1px solid var(--border)',
          background: canEndTurn
            ? 'linear-gradient(135deg, #C9A84C, #A0822C)'
            : 'rgba(255,255,255,0.05)',
          color: canEndTurn ? '#1A1410' : 'rgba(232,220,196,0.3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
          fontWeight: canEndTurn ? 700 : 400,
          letterSpacing: '0.05em',
          cursor: canEndTurn ? 'pointer' : 'not-allowed',
          transition: 'background 0.25s, opacity 0.25s, color 0.25s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: canEndTurn ? '0 2px 8px rgba(201,168,76,0.3)' : 'none',
        }}
        aria-label={buttonText}
      >
        {(isProcessing || isAiTurn) && (
          <span style={{
            width: 12,
            height: 12,
            border: '2px solid var(--text-muted)',
            borderTopColor: 'var(--gold)',
            borderRadius: '50%',
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
          border: `1px solid ${logOpen ? 'var(--border-gold)' : 'var(--border)'}`,
          background: 'transparent',
          color: logOpen ? 'var(--gold)' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.05em',
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
