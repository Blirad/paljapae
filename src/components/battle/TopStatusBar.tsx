/**
 * TopStatusBar — AI 영웅 상태 바 + 에너지 바 + 챌린지 배지 (M8 P0-2)
 * 리라 스펙 §2-2 [A] [B] + 비주얼 오버홀 2026-07-06
 * 72px + 36px 통합, HeroPortraitSVG, EnergyOrbs
 */

import React from 'react'
import type { PlayerState } from '@/types/game'
import { ELEMENT_DISPLAY } from '@/types/elements'
import { useChallengeStore } from '@/stores/challengeStore'
import { CHALLENGE_BADGE_TEXT, isMaxChallenge } from '@/types/challengeMode'
import HeroPortraitSVG from './HeroPortraitSVG'
import EnergyOrbs from './EnergyOrbs'

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

export default function TopStatusBar({ ai }: TopStatusBarProps): React.ReactElement {
  const display = ELEMENT_DISPLAY[ai.hero.element]
  const deckExhausted = ai.deck.length === 0
  const hpPct = ai.currentHp / ai.hero.maxHp

  return (
    <>
      {/* [A] AI 영웅 상태 바 — 72px */}
      <div style={{
        height: 72,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        flexShrink: 0,
      }}>
        {/* 영웅 초상화 SVG 72×72 (+ 4px HP바) — FAIL3 수정: 존재감 확보 */}
        <HeroPortraitSVG
          element={ai.hero.element}
          currentHp={ai.currentHp}
          maxHp={ai.hero.maxHp}
          size={72}
        />

        {/* 영웅 정보 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
            <ChallengeBadge />
          </div>

          {/* HP 바 10px */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}>
              {ai.currentHp}/{ai.hero.maxHp}
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
                width: `${hpPct * 100}%`,
                background: hpPct > 0.5
                  ? display.color
                  : hpPct > 0.3
                  ? '#F59E0B'
                  : '#EF4444',
                transition: 'width 0.4s ease-out, background-color 0.4s',
                borderRadius: 5,
                animation: hpPct <= 0.3 ? 'pulseRed 0.8s ease-in-out infinite' : 'none',
              }} />
            </div>
          </div>

          {/* 에너지 구슬 (AI) */}
          <EnergyOrbs
            element={ai.hero.element}
            currentEnergy={ai.currentEnergy}
            showLabel={true}
          />
        </div>

        {/* AI 핸드 카드 수 (뒷면) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
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
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: deckExhausted ? 'var(--el-fire)' : 'var(--text-muted)',
            textAlign: 'right',
            lineHeight: 1.4,
          }}>
            <div style={{ animation: deckExhausted ? 'pulse 1s ease-in-out infinite' : 'none' }}>
              덱 {ai.deck.length}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>묘지 {ai.graveyard.length}</div>
          </div>
        </div>
      </div>
    </>
  )
}
