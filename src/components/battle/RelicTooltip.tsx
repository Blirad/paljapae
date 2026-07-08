/**
 * RelicTooltip — 유물 상세 툴팁 (리라 스펙 §3-4)
 * Portal 렌더링으로 z-index 문제 회피
 * 아이콘 탭 → anchorRect 기준 위쪽 우선, 뷰포트 초과 시 아래쪽 전환
 */

import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import type { Relic, RelicHookPoint, RelicAlignment } from '@/types/relics'

// ────────────────────────────────────────────────────
// hookPoint 한글명 매핑 (리라 스펙 §3-2)
// ────────────────────────────────────────────────────

const HOOK_POINT_KO: Record<RelicHookPoint, string> = {
  battle_start: '전투 시작',
  draw_phase: '드로우 페이즈',
  play_card: '카드 플레이',
  combat_attack: '전투 공격',
  spell_damage: '주문 피해',
}

// ────────────────────────────────────────────────────
// 길흉별 border 색상 (리라 스펙 §3-2)
// ────────────────────────────────────────────────────

const ALIGNMENT_BORDER: Record<RelicAlignment, string> = {
  '吉': 'rgba(100,200,100,0.4)',
  '凶': 'rgba(200,60,60,0.4)',
  '複': 'rgba(180,140,255,0.4)',
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface RelicTooltipProps {
  relic: Relic
  anchorRect: DOMRect
  onClose: () => void
}

// ────────────────────────────────────────────────────
// RelicTooltip
// ────────────────────────────────────────────────────

export default function RelicTooltip({ relic, anchorRect, onClose }: RelicTooltipProps): React.ReactElement | null {
  const tooltipRef = useRef<HTMLDivElement>(null)

  // 3초 자동 닫힘 타이머
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  // 외부 탭 시 닫힘
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (tooltipRef.current && !tooltipRef.current.contains(target)) {
        onClose()
      }
    }
    // 다음 틱에 바인딩 (클릭 이벤트 버블링 방지)
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('touchstart', handleOutsideClick)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [onClose])

  // 위치 계산: 아이콘 위쪽 우선, 뷰포트 초과 시 아래쪽
  const tooltipWidth = Math.min(240, window.innerWidth - 24)
  const tooltipHeight = 120 // 대략
  const above = anchorRect.top - tooltipHeight - 8
  const below = anchorRect.bottom + 8

  const top = above >= 0 ? above : below
  const left = Math.max(
    12,
    Math.min(anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 12),
  )

  const borderColor = ALIGNMENT_BORDER[relic.alignment] ?? 'rgba(201,168,76,0.4)'

  const content = (
    <div
      ref={tooltipRef}
      role="tooltip"
      aria-label={`${relic.name} 상세 정보`}
      style={{
        position: 'fixed',
        top,
        left,
        width: tooltipWidth,
        background: 'rgba(18,15,12,0.97)',
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: '10px 12px',
        zIndex: 200,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        animation: 'scaleIn 0.15s ease-out',
        pointerEvents: 'auto',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* 헤더: 아이콘 + 이름 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 16 }}>{relic.icon}</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--gold)',
          lineHeight: 1.3,
        }}>
          {relic.name}
        </span>
      </div>

      {/* 효과 설명 */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-base, #E8DCC4)',
        lineHeight: 1.5,
        marginBottom: 4,
      }}>
        {relic.description}
      </div>

      {/* 플레이버 텍스트 */}
      {relic.flavorText && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          lineHeight: 1.4,
          marginBottom: 4,
        }}>
          "{relic.flavorText}"
        </div>
      )}

      {/* 발동 시점 */}
      {relic.hookPoints.length > 0 && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 4,
        }}>
          발동: {relic.hookPoints.map(hp => HOOK_POINT_KO[hp] ?? hp).join(', ')}
        </div>
      )}
    </div>
  )

  return ReactDOM.createPortal(content, document.body)
}
