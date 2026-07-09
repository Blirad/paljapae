/**
 * IntentIcon — 적 Intent 아이콘 컴포넌트
 * Phase 4 신규 파일 — 리라 스펙 §IntentIcon
 */

import React from 'react'
import type { Intent } from '@/types/stsTypes'
import { INTENT_ICONS } from '@/types/stsTypes'

interface IntentIconProps {
  intent: Intent
}

const INTENT_COLOR: Record<string, string> = {
  attack:       '#EF4444',
  defend:       '#60A5FA',
  buff:         '#4ADE80',
  debuff:       '#C084FC',
  attackDebuff: '#FB923C',
  attackBuff:   '#F472B6',
  unknown:      'var(--text-muted, #6B5F52)',
}

export default function IntentIcon({ intent }: IntentIconProps): React.ReactElement {
  const icon = INTENT_ICONS[intent.type]
  const color = INTENT_COLOR[intent.type] ?? 'var(--text-muted, #6B5F52)'

  // 수치 텍스트 구성
  let valueText: string | null = null
  if (intent.type === 'attack' || intent.type === 'attackDebuff' || intent.type === 'attackBuff') {
    if (intent.damage != null) {
      const hits = intent.hits ?? 1
      valueText = hits >= 2 ? `${intent.damage}×${hits}` : `${intent.damage}`
    }
  } else if (intent.type === 'defend' && intent.block != null) {
    valueText = `${intent.block}`
  }

  const isHeavy = intent.isHeavy === true && (intent.type === 'attack' || intent.type === 'attackDebuff' || intent.type === 'attackBuff')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        width: 60,
        height: 44,
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 6,
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      {valueText && (
        <span
          style={{
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            fontSize: 12,
            fontWeight: 700,
            color,
            lineHeight: 1,
            textShadow: isHeavy ? '0 0 8px rgba(239,68,68,0.6)' : 'none',
          }}
        >
          {valueText}
        </span>
      )}
    </div>
  )
}
