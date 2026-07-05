/**
 * LogPanel — 전투 로그 바텀 시트
 * 리라 스펙 §4-6
 * Momentor 디자인 시스템 적용 (2026-07-05)
 */

import React, { useEffect, useRef } from 'react'

interface LogPanelProps {
  isOpen: boolean
  log: string[]
  onClose: () => void
}

export default function LogPanel({ isOpen, log, onClose }: LogPanelProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [log, isOpen])

  const recentLog = log.slice(-50)

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50dvh',
      background: 'var(--bg2)',
      borderTop: '1px solid var(--border)',
      zIndex: 50,
      transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.3s ease-out',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <div style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--text-headline)' }}>
          전투 로그
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 20,
            cursor: 'pointer',
            lineHeight: 1,
            fontFamily: 'var(--font-mono)',
          }}
          aria-label="로그 닫기"
        >
          ×
        </button>
      </div>

      {/* 스크롤 영역 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {recentLog.map((entry, i) => {
          const isAI = entry.startsWith('[AI')
          const isDivider = entry.startsWith('---')
          const isFatigue = entry.includes('소진') || entry.includes('Fatigue')

          return (
            <div
              key={i}
              style={{
                minHeight: 36,
                padding: '6px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: isDivider ? 'var(--gold)' : isAI ? 'var(--el-water)' : isFatigue ? 'var(--el-earth)' : 'var(--text-secondary)',
                borderBottom: isDivider ? '1px solid var(--border)' : 'none',
                letterSpacing: isDivider ? '0.05em' : 'normal',
              }}
            >
              {entry}
            </div>
          )
        })}
      </div>
    </div>
  )
}
