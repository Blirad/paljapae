/**
 * RelicDetailModal — 전체 유물 목록 모달 (M8 P0-1)
 * 리라 M8 스펙 P0-1 RelicDetailModal 명세 기반
 */

import React, { useEffect, useCallback } from 'react'
import type { Relic } from '@/types/relics'
import { useRelicStore } from '@/stores/relicStore'
import { ALL_RELICS } from '@/types/relics'

// ────────────────────────────────────────────────────
// 스타일 주입
// ────────────────────────────────────────────────────

const STYLE_ID = 'relic-detail-modal-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes relicModalFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes relicModalSlideUp {
      from { transform: translateY(16px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
  `
  document.head.appendChild(style)
}

// ────────────────────────────────────────────────────
// RelicDetailRow — 개별 유물 행
// ────────────────────────────────────────────────────

function RelicDetailRow({ relic, owned }: { relic: Relic; owned: boolean }): React.ReactElement {
  const alignColor = relic.alignment === '吉'
    ? 'var(--gold)'
    : relic.alignment === '凶'
    ? 'var(--accent-red)'
    : 'var(--text-primary)'

  const elementColor = relic.element ? (() => {
    switch (relic.element) {
      case '木': return 'var(--el-wood)'
      case '火': return 'var(--el-fire)'
      case '土': return 'var(--el-earth)'
      case '金': return 'var(--el-metal)'
      case '水': return 'var(--el-water)'
    }
  })() : 'var(--text-muted)'

  return (
    <div style={{
      minHeight: 64,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      borderBottom: '1px solid var(--border)',
      opacity: owned ? 1 : 0.4,
    }}>
      {/* 아이콘 */}
      <div style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
        color: alignColor,
      }}>
        {relic.icon}
      </div>

      {/* 내용 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* 유물명 */}
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-headline)',
          }}>
            {relic.name}
          </span>

          {/* 길흉 배지 */}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: alignColor,
            border: `1px solid ${alignColor}`,
            padding: '0 4px',
            flexShrink: 0,
          }}>
            [{relic.alignment}]
          </span>

          {/* 오행 배지 */}
          {relic.element && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: elementColor,
              border: `1px solid ${elementColor}`,
              padding: '0 4px',
              flexShrink: 0,
            }}>
              {relic.element}
            </span>
          )}
        </div>

        {/* 효과 설명 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 4,
          lineHeight: 1.4,
        }}>
          {relic.description}
        </div>

        {/* 미보유 표시 */}
        {!owned && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 2,
          }}>
            미보유
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// Props + RelicDetailModal 메인
// ────────────────────────────────────────────────────

interface RelicDetailModalProps {
  onClose: () => void
}

export default function RelicDetailModal({ onClose }: RelicDetailModalProps): React.ReactElement {
  const ownedRelics = useRelicStore(s => s.ownedRelics)
  const ownedIds = new Set(ownedRelics.map(r => r.id))

  useEffect(() => {
    injectStyles()
  }, [])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // ESC 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  const allRelicList = Object.values(ALL_RELICS)
  const ownedCount = ownedRelics.length
  const totalCount = allRelicList.length

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'relicModalFadeIn 0.2s ease-out',
        padding: '24px 16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="내 유물 목록"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '85vh',
          background: 'var(--bg)',
          border: '1px solid var(--border-gold)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'relicModalSlideUp 0.25s ease-out',
        }}
      >
        {/* 헤더 */}
        <div style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 16,
            color: 'var(--text-headline)',
          }}>
            내 유물 목록
          </span>
          <button
            onClick={handleClose}
            aria-label="닫기"
            style={{
              width: 28,
              height: 28,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            X
          </button>
        </div>

        {/* 보유 수 */}
        <div style={{
          padding: '8px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          보유: {ownedCount} / {totalCount}종
        </div>

        {/* 목록 스크롤 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '60vh',
        }}>
          {allRelicList.map(relic => (
            <RelicDetailRow
              key={relic.id}
              relic={relic}
              owned={ownedIds.has(relic.id)}
            />
          ))}
        </div>

        {/* 닫기 버튼 */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={handleClose}
            style={{
              width: '100%',
              height: 44,
              border: '1px solid var(--border-gold)',
              background: 'transparent',
              color: 'var(--text-headline)',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
