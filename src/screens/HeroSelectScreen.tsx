/**
 * HeroSelectScreen — 영웅 선택 화면
 * 운명카드전 Phase 1
 *
 * 기능:
 *  - 20명 영웅 그리드 표시 (4열)
 *  - 남/여 필터 탭
 *  - 오행 필터 (木火土金水 + 전체)
 *  - 영웅 선택 → heroStore 저장 → onSelect() 콜백
 *  - 영웅 상세 패널 (하단 고정)
 */

import React, { useState, useMemo } from 'react'
import { ALL_HEROES } from '@/data/heroes'
import { useHeroStore } from '@/stores/heroStore'
import HeroCard from '@/components/HeroCard'
import type { HeroData, Gender } from '@/types/hero'
import type { WuXing } from '@/types/hero'

// ────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────

const WUXING_LIST: WuXing[] = ['木', '火', '土', '金', '水']

const WUXING_COLOR: Record<WuXing, string> = {
  '木': '#4db84d',
  '火': '#cc0000',
  '土': '#c8a96e',
  '金': '#ffd700',
  '水': '#4169e1',
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface HeroSelectScreenProps {
  /** 영웅 선택 완료 콜백 */
  onSelect: (hero: HeroData) => void
  /** 취소/뒤로 가기 */
  onCancel: () => void
}

// ────────────────────────────────────────────────────
// HeroDetailPanel — 선택된 영웅 상세 (하단 패널)
// ────────────────────────────────────────────────────

interface HeroDetailPanelProps {
  hero: HeroData
  onConfirm: () => void
}

function HeroDetailPanel({ hero, onConfirm }: HeroDetailPanelProps): React.ReactElement {
  const wuxingColor = WUXING_COLOR[hero.wuxing] ?? hero.color

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: 'var(--bg2, #1A1714)',
      borderTop: `2px solid ${wuxingColor}`,
      padding: '14px 20px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      zIndex: 50,
      boxShadow: `0 -8px 24px rgba(0,0,0,0.4)`,
      animation: 'slideUp 0.2s ease-out',
    }}>
      {/* 영웅 색상 바 */}
      <div style={{
        width: 4,
        alignSelf: 'stretch',
        background: wuxingColor,
        borderRadius: 2,
        flexShrink: 0,
      }} />

      {/* 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
          fontStyle: 'italic',
          fontSize: 17,
          color: 'var(--text-headline, #E8E0D0)',
          marginBottom: 4,
        }}>
          {hero.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 11,
          color: wuxingColor,
          marginBottom: 6,
          letterSpacing: '0.03em',
        }}>
          {hero.wuxing}행 · HP {hero.baseHP} · 에너지 {hero.baseEnergy}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 12,
          color: 'var(--text-secondary, #8A7D6E)',
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {hero.description}
        </div>
      </div>

      {/* 선택 버튼 */}
      <button
        onClick={onConfirm}
        style={{
          padding: '10px 18px',
          background: wuxingColor,
          border: 'none',
          color: '#0D0B08',
          fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
      >
        선택
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────
// HeroSelectScreen 메인
// ────────────────────────────────────────────────────

export default function HeroSelectScreen({ onSelect, onCancel }: HeroSelectScreenProps): React.ReactElement {
  const { selectedHero, selectHero } = useHeroStore()
  const [genderFilter, setGenderFilter] = useState<Gender | 'all'>('all')
  const [wuxingFilter, setWuxingFilter] = useState<WuXing | 'all'>('all')

  // 필터 적용
  const filteredHeroes = useMemo(() => {
    return ALL_HEROES.filter(h => {
      if (genderFilter !== 'all' && h.gender !== genderFilter) return false
      if (wuxingFilter !== 'all' && h.wuxing !== wuxingFilter) return false
      return true
    })
  }, [genderFilter, wuxingFilter])

  function handleHeroClick(hero: HeroData): void {
    selectHero(hero)
  }

  function handleConfirm(): void {
    if (selectedHero) {
      onSelect(selectedHero)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg, #0D0B08)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
    }}>

      {/* ── TopBar ── */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 16,
        paddingRight: 20,
        background: 'var(--bg2, #1A1714)',
        borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
        flexShrink: 0,
      }}>
        <button
          onClick={onCancel}
          aria-label="뒤로 가기"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: 'var(--text-muted, #6B5F52)',
            padding: '4px 8px',
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <span style={{
          fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
          fontStyle: 'italic',
          fontSize: 18,
          color: 'var(--text-headline, #E8E0D0)',
          flex: 1,
        }}>
          영웅 선택
        </span>
        <span style={{
          fontFamily: 'var(--font-mono, "DM Mono", monospace)',
          fontSize: 12,
          color: 'var(--text-muted, #6B5F52)',
        }}>
          {filteredHeroes.length}명
        </span>
      </header>

      {/* ── 필터 바 ── */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--bg2, #1A1714)',
        borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}>
        {/* 성별 필터 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'male', 'female'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              style={{
                padding: '4px 12px',
                background: genderFilter === g ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: `1px solid ${genderFilter === g ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: genderFilter === g ? 'var(--text-headline, #E8E0D0)' : 'var(--text-muted, #6B5F52)',
                fontFamily: 'var(--font-mono, "DM Mono", monospace)',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {g === 'all' ? '전체' : g === 'male' ? '남' : '여'}
            </button>
          ))}
        </div>

        {/* 오행 필터 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setWuxingFilter('all')}
            style={{
              padding: '4px 10px',
              background: wuxingFilter === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: `1px solid ${wuxingFilter === 'all' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: wuxingFilter === 'all' ? 'var(--text-headline, #E8E0D0)' : 'var(--text-muted, #6B5F52)',
              fontFamily: 'var(--font-mono, "DM Mono", monospace)',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            전체
          </button>
          {WUXING_LIST.map(w => {
            const active = wuxingFilter === w
            const color = WUXING_COLOR[w]
            return (
              <button
                key={w}
                onClick={() => setWuxingFilter(w)}
                style={{
                  padding: '4px 10px',
                  background: active ? `${color}22` : 'transparent',
                  border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                  color: active ? color : 'var(--text-muted, #6B5F52)',
                  fontFamily: 'var(--font-mono, "DM Mono", monospace)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {w}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 영웅 그리드 ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 12px',
        paddingBottom: selectedHero ? 120 : 24,
      }}>
        {filteredHeroes.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            fontSize: 13,
            color: 'var(--text-muted, #6B5F52)',
          }}>
            해당 조건의 영웅이 없습니다
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}>
            {filteredHeroes.map(hero => (
              <HeroCard
                key={hero.id}
                hero={hero}
                selected={selectedHero?.id === hero.id}
                onClick={() => handleHeroClick(hero)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 영웅 상세 패널 (선택 시) ── */}
      {selectedHero && (
        <HeroDetailPanel
          hero={selectedHero}
          onConfirm={handleConfirm}
        />
      )}

    </div>
  )
}
