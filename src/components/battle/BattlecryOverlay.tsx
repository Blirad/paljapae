/**
 * BattlecryOverlay — 소환 시 battlecry 오버레이 (리라 스펙 §4-4)
 * 해당 슬롯 위에 absolute 포지셔닝
 * 1.8s 표시 후 fadeOut 0.3s, onComplete 콜백
 */

import React, { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface BattlecryOverlayProps {
  cardName: string
  battlecryText: string
  slotIndex: number    // 0~3, 위치 계산용 (부모 FieldArea가 absolute로 배치)
  onComplete: () => void
}

// ────────────────────────────────────────────────────
// BattlecryOverlay
// ────────────────────────────────────────────────────

export default function BattlecryOverlay({ cardName, battlecryText, onComplete }: BattlecryOverlayProps): React.ReactElement {
  const [phase, setPhase] = useState<'in' | 'show' | 'out'>('in')

  useEffect(() => {
    // 0.3s 딜레이 후 fadeIn (소환 애니메이션 완료 대기)
    const t1 = setTimeout(() => setPhase('show'), 300)
    // 1.8s 표시 후 fadeOut
    const t2 = setTimeout(() => setPhase('out'), 300 + 1800)
    // fadeOut 0.3s 후 onComplete
    const t3 = setTimeout(onComplete, 300 + 1800 + 300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onComplete])

  const opacity = phase === 'in' ? 0 : phase === 'show' ? 1 : 0

  return (
    <div
      aria-label={`전투함성: ${cardName} — ${battlecryText}`}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        border: '1px solid var(--gold)',
        borderRadius: 6,
        padding: '4px 6px',
        zIndex: 20,
        opacity,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        animation: phase === 'show' ? 'battlecryIn 0.2s ease-out' : undefined,
      }}
    >
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--gold)',
        lineHeight: 1.2,
        textAlign: 'center',
        marginBottom: 2,
      }}>
        {cardName}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text-base, #E8DCC4)',
        lineHeight: 1.3,
        textAlign: 'center',
      }}>
        {battlecryText}
      </div>
    </div>
  )
}
