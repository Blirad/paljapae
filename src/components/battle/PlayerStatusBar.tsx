/**
 * PlayerStatusBar — 플레이어 영웅 상태 바
 * 리라 스펙 §2-2 [E]
 * Momentor 디자인 시스템 적용 (2026-07-05)
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
  const barColor = hpPct > 0.6 ? 'var(--gold)' : hpPct > 0.3 ? 'var(--el-earth)' : 'var(--el-fire)'
  const deckExhausted = player.deck.length === 0

  return (
    <div style={{
      height: 52,
      background: 'var(--bg2)',
      borderTop: '1px solid var(--border)',
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
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--text-headline)',
        }}>
          {player.hero.nickname}
        </span>
        {/* HP 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {player.currentHp}/{player.hero.maxHp}
          </span>
          <div style={{
            height: 8,
            flex: 1,
            background: 'var(--border)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 8,
              width: `${hpPct * 100}%`,
              background: barColor,
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
                background: i < player.currentEnergy ? 'var(--gold)' : 'var(--border)',
                border: i < player.currentEnergy ? 'none' : '1px solid var(--border-subtle)',
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          {player.currentEnergy}/{ENERGY_CAP}
        </span>
      </div>

      {/* 덱/묘지 카운터 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        flexShrink: 0,
      }}>
        <span style={{
          color: deckExhausted ? 'var(--el-fire)' : 'var(--text-muted)',
          animation: deckExhausted ? 'blink 1s step-start infinite' : 'none',
        }}>
          덱 {player.deck.length}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>묘지 {player.graveyard.length}</span>
      </div>
    </div>
  )
}
