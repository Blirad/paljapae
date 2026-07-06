/**
 * PlayerStatusBar — 플레이어 영웅 상태 바
 * 리라 스펙 §2-2 [E] + 비주얼 오버홀 2026-07-06
 * 72px 높이, HeroPortraitSVG 64×64, EnergyOrbs
 */

import React from 'react'
import type { PlayerState } from '@/types/game'
import { ELEMENT_DISPLAY } from '@/types/elements'
import HeroPortraitSVG from './HeroPortraitSVG'
import EnergyOrbs from './EnergyOrbs'

interface PlayerStatusBarProps {
  player: PlayerState
}

export default function PlayerStatusBar({ player }: PlayerStatusBarProps): React.ReactElement {
  const display = ELEMENT_DISPLAY[player.hero.element]
  const deckExhausted = player.deck.length === 0

  return (
    <div style={{
      height: 72,
      background: 'var(--bg2)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 10px',
      flexShrink: 0,
    }}>
      {/* 영웅 초상화 SVG 64×64 */}
      <HeroPortraitSVG
        element={player.hero.element}
        currentHp={player.currentHp}
        maxHp={player.hero.maxHp}
        size={56}
      />

      {/* 영웅 정보 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--text-headline)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}>
          {player.hero.nickname}
        </span>

        {/* HP 바 16px */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}>
            {player.currentHp}/{player.hero.maxHp}
          </span>
          <div style={{
            height: 10,
            flex: 1,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
            borderRadius: 5,
          }}>
            <div style={{
              height: 10,
              width: `${(player.currentHp / player.hero.maxHp) * 100}%`,
              background: player.currentHp / player.hero.maxHp > 0.5
                ? display.color
                : player.currentHp / player.hero.maxHp > 0.3
                ? '#F59E0B'
                : '#EF4444',
              transition: 'width 0.4s ease-out, background-color 0.4s',
              borderRadius: 5,
              animation: player.currentHp / player.hero.maxHp <= 0.3
                ? 'pulseRed 0.8s ease-in-out infinite'
                : 'none',
            }} />
          </div>
        </div>

        {/* 에너지 구슬 */}
        <EnergyOrbs
          element={player.hero.element}
          currentEnergy={player.currentEnergy}
          showLabel={true}
        />
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
