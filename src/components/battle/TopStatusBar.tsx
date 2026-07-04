/**
 * TopStatusBar — AI 영웅 상태 바 + 에너지 바
 * 리라 스펙 §2-2 [A] [B]
 */

import React from 'react'
import type { PlayerState } from '@/types/game'
import { ENERGY_CAP } from '@/types/game'
import { ELEMENT_DISPLAY } from '@/types/elements'

interface TopStatusBarProps {
  ai: PlayerState
}

function HpBar({ current, max }: { current: number; max: number }): React.ReactElement {
  const pct = current / max
  const barColor = pct > 0.7 ? '#44FF88' : pct > 0.3 ? '#FFAA00' : '#FF4444'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#A89880', whiteSpace: 'nowrap' }}>
        {current}/{max}
      </span>
      <div style={{
        height: 6,
        flex: 1,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: 6,
          width: `${pct * 100}%`,
          background: barColor,
          borderRadius: 3,
          transition: 'width 0.4s ease-out, background-color 0.4s',
        }} />
      </div>
    </div>
  )
}

export default function TopStatusBar({ ai }: TopStatusBarProps): React.ReactElement {
  const display = ELEMENT_DISPLAY[ai.hero.element]
  const deckExhausted = ai.deck.length === 0

  return (
    <>
      {/* [A] AI 영웅 상태 바 */}
      <div style={{
        height: 52,
        background: '#1A1714',
        borderBottom: '1px solid rgba(232,200,74,0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        flexShrink: 0,
      }}>
        {/* 영웅 아바타 */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: display.gradient,
          border: `1px solid ${display.color}80`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}>
          {display.icon}
        </div>

        {/* 영웅 정보 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: 'Noto Serif KR, serif',
            fontWeight: 700,
            fontSize: 13,
            color: '#E8E0D0',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}>
            {ai.hero.nickname}
          </span>
          <HpBar current={ai.currentHp} max={ai.hero.maxHp} />
        </div>

        {/* AI 핸드 카드 수 (뒷면) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: -4 }}>
          {Array(Math.min(ai.hand.length, 5)).fill(null).map((_, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 22,
                background: '#141210',
                border: '1px solid rgba(232,200,74,0.12)',
                borderRadius: 3,
                marginLeft: i > 0 ? -6 : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'DM Mono, monospace',
                fontSize: 8,
                color: '#6B5F52',
              }}
            >
              ?
            </div>
          ))}
          {ai.hand.length > 0 && (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#6B5F52', marginLeft: 4 }}>
              {ai.hand.length}장
            </span>
          )}
        </div>

        {/* 덱/묘지 카운터 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          color: deckExhausted ? '#FF4444' : '#6B5F52',
          flexShrink: 0,
        }}>
          <span style={{
            animation: deckExhausted ? 'pulse 1s ease-in-out infinite' : 'none',
          }}>
            덱 {ai.deck.length}
          </span>
          <span style={{ color: '#6B5F52' }}>묘지 {ai.graveyard.length}</span>
        </div>
      </div>

      {/* [B] AI 에너지 바 */}
      <div style={{
        height: 28,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B5F52' }}>에너지</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array(ENERGY_CAP).fill(null).map((_, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: i < ai.currentEnergy ? '#E8C84A' : 'rgba(232,200,74,0.15)',
                border: i < ai.currentEnergy ? 'none' : '1px solid rgba(232,200,74,0.3)',
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#A89880' }}>
          {ai.currentEnergy}/{ENERGY_CAP}
        </span>
      </div>
    </>
  )
}
