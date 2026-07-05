/**
 * RelicAcquirePopup — P3-A 유물 획득 연출 팝업
 * 리라 M7 P3 스펙 §4-3 기준
 *
 * 연출 시퀀스:
 *   1. 오버레이 opacity 0→0.65, 0.3s ease-out
 *   2. 팝업 컨테이너 scale(0.7→1.08→1.0) + opacity 0→1, 0.4s bouncy
 *   3. 내부 stagger: 아이콘→이름→효과→구분선→플레이버→닫기 안내
 *   4. 탭/클릭으로 닫기: scale 1→0.9 + opacity 1→0, 0.2s
 */

import React, { useState, useEffect, useCallback } from 'react'
import { ALL_RELICS } from '@/types/relics'
import type { RelicId } from '@/types/relics'

// ────────────────────────────────────────────────────
// Keyframe 스타일 주입 (1회)
// ────────────────────────────────────────────────────

const STYLE_ID = 'relic-acquire-popup-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes relicOverlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes relicPopupIn {
      0%   { transform: scale(0.7); opacity: 0; }
      70%  { transform: scale(1.08); opacity: 1; }
      100% { transform: scale(1.0); opacity: 1; }
    }
    @keyframes relicPopupOut {
      from { transform: scale(1.0); opacity: 1; }
      to   { transform: scale(0.9); opacity: 0; }
    }
    @keyframes relicIconIn {
      0%   { transform: scale(0);    opacity: 0; }
      70%  { transform: scale(1.2);  opacity: 1; }
      100% { transform: scale(1.0);  opacity: 1; }
    }
    @keyframes relicItemFadeUp {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes relicDividerIn {
      from { transform: scaleX(0); opacity: 0; }
      to   { transform: scaleX(1); opacity: 1; }
    }
    @keyframes relicIconPulse {
      0%   { box-shadow: 0 0 0px  rgba(201,168,76,0.0); }
      50%  { box-shadow: 0 0 32px rgba(201,168,76,0.45); }
      100% { box-shadow: 0 0 16px rgba(201,168,76,0.2); }
    }
    @keyframes relicBlinkHint {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.3; }
    }
    @keyframes relicOverlayOut {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface RelicAcquirePopupProps {
  relicId: RelicId
  onClose: () => void
}

// ────────────────────────────────────────────────────
// RelicAcquirePopup
// ────────────────────────────────────────────────────

export default function RelicAcquirePopup({
  relicId,
  onClose,
}: RelicAcquirePopupProps): React.ReactElement {
  const [isExiting, setIsExiting] = useState(false)
  const relic = ALL_RELICS[relicId]

  useEffect(() => {
    injectStyles()
  }, [])

  const handleClose = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 220)
  }, [isExiting, onClose])

  // 키보드 Escape 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  if (!relic) return <></>

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`유물 획득: ${relic.name}`}
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 오버레이: 0.65 불투명도
        background: `rgba(26,23,20,${isExiting ? 0 : 0.65})`,
        animation: isExiting
          ? 'relicOverlayOut 0.2s ease-in forwards'
          : 'relicOverlayIn 0.3s ease-out forwards',
        padding: '0 24px',
      }}
    >
      {/* 팝업 컨테이너 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 280,
          background: 'var(--surface)',
          border: '2px solid var(--border-gold)',
          padding: '32px 24px',
          textAlign: 'center',
          animation: isExiting
            ? 'relicPopupOut 0.2s ease-in forwards'
            : 'relicPopupIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
          cursor: 'default',
        }}
      >
        {/* 서브레이블 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--gold)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          marginBottom: 16,
          opacity: 0,
          animation: 'relicItemFadeUp 0.3s ease-out 0.1s forwards',
        }}>
          유물 획득!
        </div>

        {/* 아이콘 */}
        <div
          aria-hidden="true"
          style={{
            fontSize: 64,
            lineHeight: 1,
            marginBottom: 16,
            display: 'inline-block',
            opacity: 0,
            animation: 'relicIconIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) 0.1s forwards',
          }}
        >
          <span style={{
            display: 'inline-block',
            borderRadius: '50%',
            padding: 8,
            animation: 'relicIconPulse 2s ease-in-out 0.6s infinite',
          }}>
            {relic.icon}
          </span>
        </div>

        {/* 유물명 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 18,
          color: 'var(--gold)',
          marginBottom: 8,
          opacity: 0,
          animation: 'relicItemFadeUp 0.3s ease-out 0.3s forwards',
        }}>
          {relic.name}
        </div>

        {/* 효과 설명 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          marginBottom: 12,
          opacity: 0,
          animation: 'relicItemFadeUp 0.3s ease-out 0.45s forwards',
        }}>
          {relic.description}
        </div>

        {/* 구분선 */}
        <div style={{
          height: 1,
          background: 'var(--border-subtle)',
          marginBottom: 12,
          transformOrigin: 'left center',
          opacity: 0,
          animation: 'relicDividerIn 0.25s ease-out 0.55s forwards',
        }} />

        {/* 플레이버 텍스트 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          marginBottom: 20,
          opacity: 0,
          animation: 'relicItemFadeUp 0.3s ease-out 0.65s forwards',
        }}>
          {relic.flavorText}
        </div>

        {/* 닫기 안내 */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleClose}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClose() }}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            marginTop: 4,
            opacity: 0,
            animation: 'relicItemFadeUp 0.3s ease-out 0.8s forwards, relicBlinkHint 1s 0.8s infinite',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          탭하여 계속하기
        </div>
      </div>
    </div>
  )
}
