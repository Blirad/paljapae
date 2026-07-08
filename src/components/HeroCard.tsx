/**
 * HeroCard — 영웅 선택 화면의 개별 영웅 카드 컴포넌트
 * 운명카드전 Phase 1
 *
 * Props:
 *  - hero: HeroData
 *  - selected: boolean
 *  - onClick: () => void
 */

import React from 'react'
import type { HeroData } from '@/types/hero'

// ────────────────────────────────────────────────────
// 오행 아이콘 매핑
// ────────────────────────────────────────────────────

const WUXING_ICON: Record<string, string> = {
  '木': '🌿',
  '火': '🔥',
  '土': '🏔',
  '金': '⚔',
  '水': '💧',
}

// ────────────────────────────────────────────────────
// 성별 라벨
// ────────────────────────────────────────────────────

const GENDER_LABEL: Record<string, string> = {
  male: '남',
  female: '여',
}

// ────────────────────────────────────────────────────
// hex → rgba 유틸
// ────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ────────────────────────────────────────────────────
// HeroCard Props
// ────────────────────────────────────────────────────

interface HeroCardProps {
  hero: HeroData
  selected?: boolean
  onClick: () => void
  /** Phase 2-B: 오늘 일진과의 친화도 뱃지 */
  affinity?: 'shengsheng' | 'shengke' | null
}

// ────────────────────────────────────────────────────
// HeroCard
// ────────────────────────────────────────────────────

export default function HeroCard({ hero, selected = false, onClick, affinity }: HeroCardProps): React.ReactElement {
  const [hovered, setHovered] = React.useState(false)

  const borderColor = selected
    ? hero.color
    : hovered
    ? hexToRgba(hero.color, 0.6)
    : 'rgba(255,255,255,0.08)'

  const bgColor = selected
    ? hexToRgba(hero.color, 0.12)
    : hovered
    ? hexToRgba(hero.color, 0.06)
    : 'rgba(255,255,255,0.03)'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={selected}
      aria-label={`${hero.name} 선택`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '12px 8px',
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: selected ? `0 0 12px ${hexToRgba(hero.color, 0.3)}` : 'none',
        outline: 'none',
        width: '100%',
      }}
    >
      {/* 선택 표시 뱃지 */}
      {selected && (
        <div style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: hero.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#fff',
          fontWeight: 700,
        }}>
          ✓
        </div>
      )}

      {/* 영웅 이미지 또는 색상 Placeholder */}
      <div style={{
        width: 64,
        height: 80,
        borderRadius: 4,
        overflow: 'hidden',
        background: hero.imagePath
          ? 'transparent'
          : `linear-gradient(135deg, ${hero.color}66 0%, ${hero.color}22 100%)`,
        border: `1px solid ${hexToRgba(hero.color, 0.4)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {hero.imagePath ? (
          <img
            src={hero.imagePath}
            alt={hero.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              // 이미지 로드 실패 시 오행 아이콘으로 대체
              const target = e.currentTarget as HTMLImageElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                parent.style.background = `linear-gradient(135deg, ${hero.color}66 0%, ${hero.color}22 100%)`
                const icon = document.createElement('span')
                icon.textContent = WUXING_ICON[hero.wuxing] ?? '★'
                icon.style.fontSize = '28px'
                parent.appendChild(icon)
              }
            }}
          />
        ) : (
          <span style={{ fontSize: 28 }}>{WUXING_ICON[hero.wuxing] ?? '★'}</span>
        )}
      </div>

      {/* 영웅 이름 */}
      <div style={{
        fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
        fontStyle: 'italic',
        fontSize: 13,
        color: selected ? hero.color : 'var(--text-headline, #E8E0D0)',
        textAlign: 'center',
        lineHeight: 1.3,
        wordBreak: 'keep-all',
      }}>
        {hero.name}
      </div>

      {/* 오행 + 성별 뱃지 */}
      <div style={{
        display: 'flex',
        gap: 4,
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 10,
          color: hero.color,
          background: hexToRgba(hero.color, 0.1),
          border: `1px solid ${hexToRgba(hero.color, 0.3)}`,
          padding: '1px 5px',
          letterSpacing: '0.04em',
        }}>
          {hero.wuxing}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 10,
          color: 'var(--text-secondary, #8A7D6E)',
        }}>
          {GENDER_LABEL[hero.gender] ?? hero.gender}
        </span>
      </div>

      {/* 기본 스탯 */}
      <div style={{
        fontFamily: 'var(--font-mono, "DM Mono", monospace)',
        fontSize: 10,
        color: 'var(--text-muted, #6B5F52)',
        display: 'flex',
        gap: 6,
      }}>
        <span>HP {hero.baseHP}</span>
        <span>E {hero.baseEnergy}</span>
      </div>

      {/* Phase 2-B: 사주 친화도 뱃지 (리라 스펙 §UI-2) */}
      {affinity === 'shengsheng' && (
        <div
          title="오늘 일진과 상생 관계 — 전투 시 보너스"
          style={{
            position: 'absolute',
            bottom: 6,
            right: 4,
            padding: '2px 5px',
            background: 'rgba(13, 32, 13, 0.9)',
            border: '1px solid #4db84d',
            color: '#4db84d',
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            fontSize: 9,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: 'scaleIn 0.15s ease-out',
            lineHeight: 1.4,
          }}
        >
          今日 相生 ↑
        </div>
      )}
      {affinity === 'shengke' && (
        <div
          title="오늘 일진과 상극 관계 — 전투 시 패널티"
          style={{
            position: 'absolute',
            bottom: 6,
            right: 4,
            padding: '2px 5px',
            background: 'rgba(32, 13, 13, 0.9)',
            border: '1px solid #cc0000',
            color: '#cc0000',
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            fontSize: 9,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: 'scaleIn 0.15s ease-out',
            lineHeight: 1.4,
          }}
        >
          今日 相克 ↓
        </div>
      )}
    </button>
  )
}
