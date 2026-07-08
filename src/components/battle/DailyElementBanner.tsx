/**
 * DailyElementBanner — 일진 오행 배너
 * 리라 스펙 §UI-1 Phase 2-A
 *
 * 전투 화면 TopStatusBar 아래, ElementMatchup 위에 표시.
 * 32px 고정 높이. 오늘 일진 천간+오행 및 전투 효과를 안내.
 */

import React, { useMemo } from 'react'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY, GENERATES, DOMINATES } from '@/types/elements'

// ────────────────────────────────────────────────────
// 오행별 배너 카피
// ────────────────────────────────────────────────────

const DAILY_EFFECT_TEXT: Record<FiveElement, string> = {
  '木': '木 오행 공격력 +20%',
  '火': '火 오행 공격력 +20%',
  '土': '土 오행 공격력 +20%',
  '金': '金 오행 공격력 +20%',
  '水': '水 오행 공격력 +20%',
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface DailyElementBannerProps {
  /** 오늘 일진 천간 한자 (예: '甲', '乙') */
  stem: string
  /** 오늘 일진 오행 */
  stemElement: FiveElement
  /** 플레이어 영웅 오행 (상생/상극 힌트 계산용) */
  heroElement: FiveElement
}

// ────────────────────────────────────────────────────
// 상생/상극 힌트 계산
// ────────────────────────────────────────────────────

function getAffinityHint(
  stemElement: FiveElement,
  heroElement: FiveElement,
): { text: string; color: string } | null {
  // 상생: 영웅 오행이 일진을 생함, 또는 일진이 영웅을 생함
  if (GENERATES[stemElement] === heroElement || GENERATES[heroElement] === stemElement) {
    return {
      text: `↑ ${heroElement} 영웅 유리`,
      color: '#4db84d',
    }
  }
  // 상극: 일진이 영웅을 극함, 또는 영웅이 일진을 극함
  if (DOMINATES[stemElement] === heroElement || DOMINATES[heroElement] === stemElement) {
    return {
      text: `↓ ${heroElement} 영웅 불리`,
      color: '#cc0000',
    }
  }
  return null
}

// ────────────────────────────────────────────────────
// DailyElementBanner
// ────────────────────────────────────────────────────

export default function DailyElementBanner({
  stem,
  stemElement,
  heroElement,
}: DailyElementBannerProps): React.ReactElement {
  const elementColor = ELEMENT_DISPLAY[stemElement].color
  const effectText = DAILY_EFFECT_TEXT[stemElement]

  const hint = useMemo(
    () => getAffinityHint(stemElement, heroElement),
    [stemElement, heroElement],
  )

  return (
    <div
      role="status"
      aria-label={`오늘 일진: ${stem}${stemElement}일. ${effectText}`}
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        background: 'var(--bg2, #1A1714)',
        borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))',
        flexShrink: 0,
        cursor: 'default',
        animation: 'dailyBannerIn 0.3s ease-out forwards',
        overflow: 'hidden',
      }}
    >
      {/* 왼쪽 색상 바 */}
      <div
        style={{
          width: 3,
          height: 18,
          borderRadius: 2,
          background: elementColor,
          flexShrink: 0,
        }}
      />

      {/* 천간 한자 */}
      <span
        style={{
          fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
          fontStyle: 'italic',
          fontSize: 13,
          color: elementColor,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {stem}{stemElement}일
      </span>

      {/* 구분점 */}
      <span
        style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 11,
          color: 'var(--text-muted, #6B5F52)',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ·
      </span>

      {/* 효과 텍스트 */}
      <span
        style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 11,
          color: 'var(--text-secondary, #8A7D6E)',
          flex: 1,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {effectText}
      </span>

      {/* 상생/상극 힌트 */}
      {hint && (
        <span
          style={{
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            fontSize: 10,
            color: hint.color,
            flexShrink: 0,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {hint.text}
        </span>
      )}
    </div>
  )
}
