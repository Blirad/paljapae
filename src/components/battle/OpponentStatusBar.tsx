/**
 * OpponentStatusBar — PvP 상대 플레이어 상태 바 72px
 * 리라 스펙 §신규 컴포넌트: OpponentStatusBar
 * TopStatusBar 패턴 참조 + PvP 전용 정보 표시
 */

import React from 'react'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY } from '@/types/elements'
import HeroPortraitSVG from './HeroPortraitSVG'

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface OpponentStatusBarProps {
  nickname: string         // [SERVER] 상대 닉네임
  heroElement: FiveElement // [SERVER] 상대 영웅 오행
  currentHp: number        // [SERVER] 상대 현재 HP
  maxHp: number            // 30 (고정)
  handCount: number        // [SERVER] 상대 손패 수 (내용 비공개)
  deckCount: number        // [SERVER] 상대 덱 수
  rank: string             // [SERVER] 상대 랭크 e.g. "Gold III"
}

// ────────────────────────────────────────────────────
// OpponentStatusBar
// ────────────────────────────────────────────────────

export default function OpponentStatusBar({
  nickname,
  heroElement,
  currentHp,
  maxHp,
  handCount,
  deckCount,
  rank,
}: OpponentStatusBarProps): React.ReactElement {
  const display = ELEMENT_DISPLAY[heroElement]
  const hpPct = Math.max(0, currentHp / maxHp)
  const displayHandCount = Math.min(handCount, 6)
  const extraHand = handCount > 6 ? handCount - 6 : 0

  return (
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
      {/* 영웅 초상화 48x48 */}
      <HeroPortraitSVG
        element={heroElement}
        currentHp={currentHp}
        maxHp={maxHp}
        size={48}
      />

      {/* 영웅 정보 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
        {/* 닉네임 + 랭크 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-headline)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            maxWidth: 100,
          }}>
            {nickname}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: display.color,
            letterSpacing: '0.03em',
            flexShrink: 0,
          }}>
            {rank}
          </span>
        </div>

        {/* HP 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {currentHp}/{maxHp}
          </span>
          <div style={{
            height: 8,
            flex: 1,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
            borderRadius: 4,
          }}>
            <div style={{
              height: 8,
              width: `${hpPct * 100}%`,
              background: hpPct > 0.5
                ? display.color
                : hpPct > 0.3
                ? '#F59E0B'
                : '#EF4444',
              transition: 'width 0.4s ease-out, background-color 0.4s',
              borderRadius: 4,
              animation: hpPct <= 0.3 ? 'pulseRed 0.8s ease-in-out infinite' : 'none',
            }} />
          </div>
        </div>

        {/* 오행 표시 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: display.color,
          letterSpacing: '0.05em',
        }}>
          {heroElement} {display.icon}
        </div>
      </div>

      {/* 상대 손패 + 덱 수 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {/* 뒷면 카드 아이콘 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {Array(displayHandCount).fill(null).map((_, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 20,
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                marginLeft: i > 0 ? -5 : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                color: 'var(--text-muted)',
              }}
            >
              ?
            </div>
          ))}
          {extraHand > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              color: 'var(--text-muted)',
              marginLeft: 3,
            }}>
              +{extraHand}
            </span>
          )}
          {handCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              color: 'var(--text-muted)',
              marginLeft: 4,
            }}>
              {handCount}장
            </span>
          )}
        </div>

        {/* 덱 수 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          textAlign: 'right',
        }}>
          덱 {deckCount}
        </div>
      </div>
    </div>
  )
}
