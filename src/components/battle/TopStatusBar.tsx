/**
 * TopStatusBar — AI 영웅 상태 바 + 에너지 바 + 챌린지 배지 (M8 P0-2)
 * 리라 스펙 §2-2 [A] [B] + 리라 M8 스펙 P0-2 챌린지 배지
 * Momentor 디자인 시스템 적용 (2026-07-05)
 */

import React from 'react'
import type { PlayerState } from '@/types/game'
import { ENERGY_CAP } from '@/types/game'
import { ELEMENT_DISPLAY } from '@/types/elements'
import { useChallengeStore } from '@/stores/challengeStore'
import { CHALLENGE_BADGE_TEXT, isMaxChallenge } from '@/types/challengeMode'

interface TopStatusBarProps {
  ai: PlayerState
}

// ────────────────────────────────────────────────────
// ChallengeBadge — 챌린지 배지 컴포넌트
// ────────────────────────────────────────────────────

function ChallengeBadge(): React.ReactElement | null {
  const mode = useChallengeStore(s => s.mode)
  if (mode === 'normal') return null

  const badgeText = CHALLENGE_BADGE_TEXT[mode]
  const isMax = isMaxChallenge(mode)

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 7px',
      background: isMax
        ? 'rgba(201,168,76,0.15)'
        : 'rgba(139,0,0,0.15)',
      border: isMax
        ? '1px solid var(--gold)'
        : '1px solid var(--accent-red)',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: isMax ? 'var(--gold)' : 'var(--accent-red)',
        letterSpacing: '0.02em',
      }}>
        [{badgeText}]
      </span>
    </div>
  )
}

function HpBar({ current, max }: { current: number; max: number }): React.ReactElement {
  const pct = current / max
  const barColor = pct > 0.3 ? 'var(--el-fire)' : '#8B1A1A'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {current}/{max}
      </span>
      <div style={{
        height: 6,
        flex: 1,
        background: 'var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: 6,
          width: `${pct * 100}%`,
          background: barColor,
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
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
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
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--text-headline)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}>
            {ai.hero.nickname}
          </span>
          <HpBar current={ai.currentHp} max={ai.hero.maxHp} />
        </div>

        {/* 챌린지 배지 (M8 P0-2) */}
        <ChallengeBadge />

        {/* AI 핸드 카드 수 (뒷면) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: -4 }}>
          {Array(Math.min(ai.hand.length, 5)).fill(null).map((_, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 22,
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                marginLeft: i > 0 ? -6 : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                color: 'var(--text-muted)',
              }}
            >
              ?
            </div>
          ))}
          {ai.hand.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>
              {ai.hand.length}장
            </span>
          )}
        </div>

        {/* 덱/묘지 카운터 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: deckExhausted ? 'var(--el-fire)' : 'var(--text-muted)',
          flexShrink: 0,
        }}>
          <span style={{
            animation: deckExhausted ? 'pulse 1s ease-in-out infinite' : 'none',
          }}>
            덱 {ai.deck.length}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>묘지 {ai.graveyard.length}</span>
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>에너지</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array(ENERGY_CAP).fill(null).map((_, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                background: i < ai.currentEnergy ? 'var(--gold)' : 'var(--border)',
                border: i < ai.currentEnergy ? 'none' : '1px solid var(--border-subtle)',
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
          {ai.currentEnergy}/{ENERGY_CAP}
        </span>
      </div>
    </>
  )
}
