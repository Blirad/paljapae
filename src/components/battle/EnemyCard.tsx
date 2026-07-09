/**
 * EnemyCard — 적 HP/블록/Intent/버프 표시 컴포넌트
 * Phase 4 신규 파일 — 리라 스펙 §EnemyCard
 */

import React from 'react'
import type { EnemyState } from '@/types/stsTypes'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY, DOMINATES, GENERATES } from '@/types/elements'
import IntentIcon from './IntentIcon'
import BuffBar from './BuffBar'

// ─── AffinityBadge ───────────────────────────────────

interface AffinityBadgeProps {
  playerElement: FiveElement
  enemyElement: FiveElement | 'neutral'
}

function AffinityBadge({ playerElement, enemyElement }: AffinityBadgeProps): React.ReactElement | null {
  if (enemyElement === 'neutral') return null

  let color = 'var(--text-muted, #6B5F52)'
  let label = '–'

  if (DOMINATES[playerElement] === enemyElement) {
    color = '#4ADE80'
    label = '상극 ▲ +20%'
  } else if (DOMINATES[enemyElement] === playerElement) {
    color = '#EF4444'
    label = '상극 ▼ -20%'
  } else if (GENERATES[playerElement] === enemyElement || GENERATES[enemyElement] === playerElement) {
    color = '#60A5FA'
    label = '상생'
  }

  return (
    <span
      style={{
        fontSize: 9,
        padding: '2px 5px',
        borderRadius: 10,
        background: color.startsWith('#') ? `${color}33` : 'rgba(255,255,255,0.08)',
        color,
        fontFamily: 'var(--font-mono, "DM Mono", monospace)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─── Props ───────────────────────────────────────────

interface EnemyCardProps {
  enemy: EnemyState
  playerElement?: FiveElement
  isTargeted: boolean
  onClick: () => void
}

// ─── EnemyCard ───────────────────────────────────────

export default function EnemyCard({
  enemy,
  playerElement,
  isTargeted,
  onClick,
}: EnemyCardProps): React.ReactElement {
  const { def, hp, maxHp, block, buffs, currentIntent } = enemy
  const isDead = hp <= 0

  const enemyEl = def.element === 'neutral' ? null : def.element as FiveElement
  const elementColor = enemyEl ? ELEMENT_DISPLAY[enemyEl].color : 'rgba(212,175,90,0.4)'
  const elementGradient = enemyEl ? ELEMENT_DISPLAY[enemyEl].gradient : null

  const hpPercent = Math.max(0, (hp / maxHp) * 100)

  return (
    <div
      onClick={onClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '12px 16px',
        gap: 10,
        background: elementGradient
          ? `${elementGradient}`.replace(/linear-gradient/, 'linear-gradient').replace(/0\.[\d]+\)/, '0.06)')
          : 'transparent',
        outline: isTargeted ? '2px solid rgba(255,215,0,0.6)' : 'none',
        boxShadow: isTargeted ? '0 0 16px rgba(255,215,0,0.3)' : 'none',
        cursor: isTargeted ? 'crosshair' : 'default',
        opacity: isDead ? 0.3 : 1,
        transition: 'outline 0.15s, box-shadow 0.15s, opacity 0.3s',
        position: 'relative',
      }}
    >
      {/* 사망 표시 */}
      {isDead && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 12,
            color: '#EF4444',
            fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
            textDecoration: 'line-through',
          }}
        >
          처치됨
        </div>
      )}

      {/* 상단 행: Intent + 이름 + 오행 배지 + 상성 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* IntentIcon */}
        <IntentIcon key={`${currentIntent.type}_${currentIntent.damage}`} intent={currentIntent} />

        {/* 이름 + 배지 영역 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--text-headline, #E8E0D0)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {def.name}
          </span>

          {/* 상성 배지 */}
          {playerElement && (
            <AffinityBadge playerElement={playerElement} enemyElement={def.element} />
          )}

          {/* 오행 배지 */}
          {enemyEl && (
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: elementColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: '#fff',
                fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
                flexShrink: 0,
              }}
            >
              {enemyEl}
            </div>
          )}
        </div>
      </div>

      {/* HP 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            flex: 1,
            height: 8,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${hpPercent}%`,
              background: '#C0392B',
              borderRadius: 4,
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            fontSize: 11,
            color: 'var(--text-secondary, #8A7D6E)',
            flexShrink: 0,
          }}
        >
          {hp}/{maxHp}
        </span>
      </div>

      {/* 블록 + 버프 행 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* 블록 배지 */}
        {block > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              background: '#1A4A7A',
              border: '1px solid rgba(100,180,255,0.4)',
              borderRadius: 12,
              padding: '2px 6px',
              fontSize: 11,
              color: 'var(--text-primary, #E8E0D0)',
              fontFamily: 'var(--font-mono, "DM Mono", monospace)',
              flexShrink: 0,
            }}
          >
            <span>🛡</span>
            <span>{block}</span>
          </div>
        )}

        {/* 버프 아이콘 바 */}
        <BuffBar buffs={buffs} size="sm" />
      </div>
    </div>
  )
}
