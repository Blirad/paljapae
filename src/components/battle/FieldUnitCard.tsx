/**
 * FieldUnitCard — 필드 위 유닛 카드 컴포넌트
 * 리라 스펙 §3-1
 */

import React from 'react'
import type { FieldUnit } from '@/types/cards'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY } from '@/types/elements'
import KeywordBadge from './KeywordBadge'

// ────────────────────────────────────────────────────
// 오행 × 카드타입 아이콘 (스펙 §3-4)
// ────────────────────────────────────────────────────

const UNIT_ICON: Record<FiveElement, string> = {
  '木': '🌲',
  '火': '🗡',
  '土': '🏯',
  '金': '⚔',
  '水': '🐉',
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface FieldUnitCardProps {
  unit: FieldUnit
  slotIdx: number
  side: 'player' | 'ai'
  isSelected?: boolean
  isValidAttackTarget?: boolean
  isDimmed?: boolean       // 도발 규칙으로 dim
  onClick?: () => void
}

export default function FieldUnitCard({
  unit,
  slotIdx: _slotIdx,
  side,
  isSelected = false,
  isValidAttackTarget = false,
  isDimmed = false,
  onClick,
}: FieldUnitCardProps): React.ReactElement {
  const element = unit.card.element ?? '火'
  const display = ELEMENT_DISPLAY[element]
  const allKeywords = [...unit.card.keywords, ...unit.temporaryKeywords]

  // 도발 유닛 테두리
  const hasTaunt = allKeywords.includes('taunt')
  const hasPoison = allKeywords.includes('poison')
  const hasPierce = allKeywords.includes('pierce')
  const hasIncinerate = allKeywords.includes('incinerate')

  const borderColor = hasTaunt
    ? 'rgba(192,122,26,0.6)'
    : `${display.color}66`

  const borderStyle = hasPoison ? 'dashed' : 'solid'

  const boxShadow = hasTaunt
    ? '0 0 6px rgba(192,122,26,0.4)'
    : isSelected
    ? '0 0 8px rgba(232,200,74,0.6)'
    : isValidAttackTarget
    ? '0 0 8px rgba(255,68,68,0.5)'
    : 'none'

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        flex: 1,
        maxWidth: 84,
        height: 112,
        background: hasIncinerate
          ? 'radial-gradient(ellipse at center, rgba(192,57,43,0.1) 0%, #141210 100%)'
          : '#141210',
        border: `1px ${borderStyle} ${borderColor}`,
        borderRadius: 6,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        opacity: isDimmed ? 0.3 : unit.canAttack || side === 'ai' ? 1 : 0.6,
        display: 'flex',
        flexDirection: 'column',
        boxShadow,
        transition: 'box-shadow 0.2s, opacity 0.2s',
        userSelect: 'none',
      }}
      aria-label={`${unit.card.name} 공격력:${unit.currentAttack} 체력:${unit.currentHealth}`}
    >
      {/* 헤더 */}
      <div style={{
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
        flexShrink: 0,
      }}>
        <div style={{
          width: 20,
          height: 20,
          background: '#E8C84A',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'DM Mono, monospace',
          fontWeight: 700,
          fontSize: 12,
          color: '#0D0B08',
          flexShrink: 0,
        }}>
          {unit.card.cost}
        </div>
        <div style={{ fontSize: 14, color: display.color }}>
          {display.icon}
        </div>
      </div>

      {/* 아트 영역 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: display.gradient,
        position: 'relative',
      }}>
        <span style={{ fontSize: 28 }} aria-hidden="true">
          {UNIT_ICON[element]}
        </span>

        {/* 관통 삼각형 뱃지 */}
        {hasPierce && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderTop: '12px solid rgba(139,117,54,0.8)',
            borderLeft: '12px solid transparent',
          }} />
        )}
      </div>

      {/* 키워드 배지 행 */}
      {allKeywords.length > 0 && (
        <div style={{
          height: 18,
          padding: '0 2px',
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {allKeywords.map((kw, i) => (
            <KeywordBadge
              key={i}
              keyword={kw}
              used={kw === 'reborn' && unit.rebornUsed}
            />
          ))}
        </div>
      )}

      {/* 풋터 */}
      <div style={{
        height: 22,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 4px',
        background: 'rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontWeight: 700,
          fontSize: 13,
          color: '#FF8844',
        }}>
          {unit.currentAttack}
        </span>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontWeight: 700,
          fontSize: 13,
          color: unit.currentHealth < 3 ? '#FF4444' : '#44CC66',
        }}>
          {unit.currentHealth}
        </span>
      </div>

      {/* 선택 링 */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid #E8C84A',
          borderRadius: 6,
          pointerEvents: 'none',
        }} />
      )}

      {/* 타겟 링 */}
      {isValidAttackTarget && !isSelected && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid #FF4444',
          borderRadius: 6,
          pointerEvents: 'none',
          animation: 'pulseRed 0.8s ease-in-out infinite',
        }} />
      )}

      {/* 동결 오버레이 */}
      {unit.frozen && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(37,99,168,0.35)',
          border: '2px solid #2563A8',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          fontSize: 24,
          opacity: 0.8,
        }}>
          ❄
        </div>
      )}

      {/* 공격 불가 빗금 오버레이 (플레이어 유닛이 이번 턴 공격 완료) */}
      {side === 'player' && !unit.canAttack && !unit.frozen && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.3) 4px, rgba(0,0,0,0.3) 6px)',
          pointerEvents: 'none',
          borderRadius: 6,
        }} />
      )}
    </div>
  )
}
