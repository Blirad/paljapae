/**
 * PlayerStatusBar — 플레이어 영웅 상태 바
 * 리라 스펙 §2-2 [E]
 */

import React from 'react'
import type { PlayerState } from '@/types/game'
import { ENERGY_CAP } from '@/types/game'
import { ELEMENT_DISPLAY } from '@/types/elements'

interface PlayerStatusBarProps {
  player: PlayerState
}

export default function PlayerStatusBar({ player }: PlayerStatusBarProps): React.ReactElement {
  const display = ELEMENT_DISPLAY[player.hero.element]
  const hpPct = player.currentHp / player.hero.maxHp
  const barColor = hpPct > 0.7 ? '#44FF88' : hpPct > 0.3 ? '#FFAA00' : '#FF4444'
  const deckExhausted = player.deck.length === 0

  return (
    <div style={{
      height: 52,
      background: '#1A1714',
      borderTop: '1px solid rgba(232,200,74,0.45)',
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
        border: `2px solid ${display.color}`,
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
        }}>
          {player.hero.nickname}
        </span>
        {/* HP 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#A89880', whiteSpace: 'nowrap' }}>
            {player.currentHp}/{player.hero.maxHp}
          </span>
          <div style={{
            height: 8,
            flex: 1,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 8,
              width: `${hpPct * 100}%`,
              background: barColor,
              borderRadius: 4,
              transition: 'width 0.4s ease-out, background-color 0.4s',
            }} />
          </div>
        </div>
      </div>

      {/* 에너지 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {Array(ENERGY_CAP).fill(null).map((_, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: i < player.currentEnergy ? '#E8C84A' : 'rgba(232,200,74,0.15)',
                border: i < player.currentEnergy ? 'none' : '1px solid rgba(232,200,74,0.3)',
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#A89880' }}>
          {player.currentEnergy}/{ENERGY_CAP}
        </span>
      </div>

      {/* 덱/묘지 카운터 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        fontFamily: 'DM Mono, monospace',
        fontSize: 10,
        flexShrink: 0,
      }}>
        <span style={{
          color: deckExhausted ? '#FF4444' : '#6B5F52',
          animation: deckExhausted ? 'blink 1s step-start infinite' : 'none',
        }}>
          덱 {player.deck.length}
        </span>
        <span style={{ color: '#6B5F52' }}>묘지 {player.graveyard.length}</span>
      </div>
    </div>
  )
}
