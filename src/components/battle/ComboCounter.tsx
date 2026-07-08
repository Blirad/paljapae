/**
 * ComboCounter — 오행 콤보 카운터
 * 리라 스펙 §UI-3 Phase 2-C
 *
 * FieldSeparator 위에 absolute 오버레이. 콤보 2 이상일 때만 렌더.
 * 콤보 3 이상: 골드 테두리 + 골드 텍스트
 */

import React from 'react'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY } from '@/types/elements'

// ────────────────────────────────────────────────────
// 느낌표 생성 (콤보 수 - 2, 최대 3개)
// ────────────────────────────────────────────────────

function getExclamation(count: number): string {
  const marks = Math.min(count - 2, 3)
  return marks > 0 ? '!'.repeat(marks) : ''
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface ComboCounterProps {
  element: FiveElement
  count: number
}

// ────────────────────────────────────────────────────
// ComboCounter
// ────────────────────────────────────────────────────

export default function ComboCounter({ element, count }: ComboCounterProps): React.ReactElement | null {
  // 콤보 2 미만 비표시
  if (count < 2) return null

  const isGold = count >= 3
  const elementColor = ELEMENT_DISPLAY[element].color
  const borderColor = isGold ? '#FFD700' : 'rgba(255,255,255,0.2)'
  const numberColor = isGold ? '#FFD700' : 'var(--text-headline, #E8E0D0)'
  const exclamation = getExclamation(count)

  return (
    <div
      role="status"
      aria-label={`${element} 오행 ${count}연속 콤보`}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 14px',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        border: `1px solid ${borderColor}`,
        animation: 'scaleIn 0.18s ease-out',
        pointerEvents: 'none',
      }}
    >
      {/* 오행 문자 */}
      <span
        style={{
          fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
          fontStyle: 'italic',
          fontSize: 16,
          color: elementColor,
          lineHeight: 1,
        }}
      >
        {element}
      </span>

      {/* 콤보 수 */}
      <span
        style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontWeight: 700,
          fontSize: 18,
          color: numberColor,
          lineHeight: 1,
          animation: 'comboCountUp 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        ×{count}
      </span>

      {/* 콤보 레이블 */}
      <span
        style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 11,
          color: 'var(--text-secondary, #8A7D6E)',
          lineHeight: 1,
        }}
      >
        콤보{exclamation}
      </span>
    </div>
  )
}
