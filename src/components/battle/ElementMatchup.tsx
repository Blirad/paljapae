/**
 * ElementMatchup — 전투 중 오행 상성 실시간 표시
 * 리라 스펙 Phase 1-B
 *
 * 플레이어 오행 vs 적 오행의 상성 관계를 TopStatusBar 바로 아래에 표시.
 * elementalCombat.ts의 getCombatModifier를 직접 활용.
 */

import React from 'react'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY } from '@/types/elements'
import { getCombatModifier } from '@/game/engine/elementalCombat'

export interface ElementMatchupProps {
  playerElement: FiveElement
  enemyElement: FiveElement | 'neutral'
}

interface MatchupInfo {
  label: string
  multiplier: string
  color: string
  glowColor: string | null
}

function getMatchupInfo(
  playerElement: FiveElement,
  enemyElement: FiveElement | 'neutral',
): MatchupInfo {
  if (enemyElement === 'neutral') {
    return {
      label: '중립',
      multiplier: '×1.0',
      color: 'rgba(180,180,180,0.7)',
      glowColor: null,
    }
  }

  const modifier = getCombatModifier(playerElement, enemyElement)

  switch (modifier) {
    case 'dominate':
      return {
        label: '상극 유리',
        multiplier: '×1.5',
        color: '#FF4444',
        glowColor: ELEMENT_DISPLAY[playerElement].color,
      }
    case 'generate_defense':
      return {
        label: '상생 불리',
        multiplier: '×0.75',
        color: '#4488FF',
        glowColor: '#2255AA',
      }
    case 'neutral':
    default:
      return {
        label: '중립',
        multiplier: '×1.0',
        color: 'rgba(180,180,180,0.7)',
        glowColor: null,
      }
  }
}

function getMatchupIcon(label: string): string {
  if (label === '상극 유리') return '⚔'
  if (label === '상생 불리') return '🛡'
  return '⚖'
}

export default function ElementMatchup({
  playerElement,
  enemyElement,
}: ElementMatchupProps): React.ReactElement {
  const playerDisplay = ELEMENT_DISPLAY[playerElement]
  const enemyDisplay = enemyElement !== 'neutral' ? ELEMENT_DISPLAY[enemyElement] : null
  const matchup = getMatchupInfo(playerElement, enemyElement)

  const glowStyle = matchup.glowColor
    ? { boxShadow: `inset 0 0 20px ${matchup.glowColor}1A` }
    : {}

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        padding: '8px 12px',
        margin: '0 16px 8px',
        borderRadius: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        ...glowStyle,
      }}
    >
      {/* 내 오행 vs 적 오행 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: playerDisplay.color }}>
          {playerDisplay.icon}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {playerElement}
        </span>
        <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>vs</span>
        {enemyDisplay ? (
          <>
            <span style={{ color: enemyDisplay.color }}>
              {enemyDisplay.icon}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {enemyElement}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>중립</span>
        )}
      </div>

      {/* 상성 결과 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: matchup.color }}>
          {getMatchupIcon(matchup.label)} {matchup.label}
        </span>
        <span style={{
          color: matchup.color,
          fontWeight: 700,
          marginLeft: 4,
        }}>
          {matchup.multiplier}
        </span>
      </div>
    </div>
  )
}
