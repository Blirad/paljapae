/**
 * LogPanel — 전투 로그 바텀 시트
 * 리라 스펙 §4-6
 */

import React, { useEffect, useRef } from 'react'

interface LogPanelProps {
  isOpen: boolean
  log: string[]
  onClose: () => void
}

export default function LogPanel({ isOpen, log, onClose }: LogPanelProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 새 로그 진입 시 자동 스크롤
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [log, isOpen])

  // 최근 50줄만 유지
  const recentLog = log.slice(-50)

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50dvh',
      background: '#1A1714',
      borderTop: '1px solid rgba(232,200,74,0.45)',
      borderRadius: '16px 16px 0 0',
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
        borderBottom: '1px solid rgba(232,200,74,0.12)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'Noto Serif KR, serif', fontWeight: 700, fontSize: 15, color: '#E8E0D0' }}>
          전투 로그
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#A89880',
            fontSize: 20,
            cursor: 'pointer',
            lineHeight: 1,
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
                fontFamily: 'Noto Sans KR, sans-serif',
                fontSize: 12,
                color: isDivider ? '#E8C84A' : isAI ? '#2563A8' : isFatigue ? '#FF8800' : '#E8E0D0',
                borderBottom: isDivider ? '1px solid rgba(232,200,74,0.08)' : 'none',
                fontWeight: isDivider ? 700 : 400,
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
