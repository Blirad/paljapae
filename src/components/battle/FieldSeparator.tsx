/**
 * FieldSeparator — 오행 경계선 + 힌트 배너
 * 리라 스펙 §와이어프레임 중앙 Separator (32px)
 */

import React from 'react'
import type { FiveElement } from '@/types/elements'

// 오행 심볼
const ELEMENT_SYMBOL: Record<FiveElement, string> = {
  '木': '木',
  '火': '火',
  '土': '土',
  '金': '金',
  '水': '水',
}

// 오행별 장식선 컬러 (rgba)
const ELEMENT_LINE_COLOR: Record<FiveElement, string> = {
  '木': 'rgba(126,200,122,0.4)',
  '火': 'rgba(255,140,90,0.4)',
  '土': 'rgba(240,200,74,0.4)',
  '金': 'rgba(200,228,248,0.4)',
  '水': 'rgba(100,200,248,0.4)',
}

interface FieldSeparatorProps {
  element: FiveElement
  hintMessage: string | null
}

export default function FieldSeparator({ element, hintMessage }: FieldSeparatorProps): React.ReactElement {
  const lineColor = ELEMENT_LINE_COLOR[element]
  const symbol = ELEMENT_SYMBOL[element]

  return (
    <div style={{
      height: 32,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      flexShrink: 0,
      gap: 2,
    }}>
      {/* 장식 선 */}
      <div style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        height: 1,
        background: `linear-gradient(90deg, transparent, ${lineColor}, transparent)`,
      }} />

      {/* 중앙 심볼 + 힌트 */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--bg)',
        padding: '0 8px',
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 14,
          color: lineColor.replace('0.4', '0.8'),
          lineHeight: 1,
        }}>
          {symbol}
        </span>
        {hintMessage && (
          <span style={{
            fontFamily: 'Noto Sans KR, sans-serif',
            fontSize: 11,
            color: 'var(--gold-accent)',
            letterSpacing: '0.02em',
          }}>
            {hintMessage}
          </span>
        )}
        {!hintMessage && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
          }}>
            전투중
          </span>
        )}
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 14,
          color: lineColor.replace('0.4', '0.8'),
          lineHeight: 1,
        }}>
          {symbol}
        </span>
      </div>
    </div>
  )
}
