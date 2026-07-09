/**
 * STSHandCard — STS 스타일 핸드 카드 컴포넌트
 * Phase 4 신규 파일 — 리라 스펙 §STSHandCard
 *
 * CardArtSVG cardType: 옵션 B — 'attack' → 'soldier', 'skill'|'power' → 'spell' 임시 매핑
 */

import React, { useRef } from 'react'
import type { CardDef } from '@/types/stsTypes'
import { ELEMENT_DISPLAY } from '@/types/elements'
import CardArtSVG from './CardArtSVG'

// ─── 오행 카드 테두리 색상 ────────────────────────────

function getElementBorderColor(element: CardDef['element']): string {
  if (element === 'neutral') return 'rgba(212,175,90,0.4)'
  return ELEMENT_DISPLAY[element].color
}

// ─── 오행 비용 구슬 그라디언트 ───────────────────────

const ORB_GRADIENT: Record<string, string> = {
  '木': 'radial-gradient(circle at 35% 35%, #7EC87A, #2E6B2A)',
  '火': 'radial-gradient(circle at 35% 35%, #FF8C5A, #C4400A)',
  '土': 'radial-gradient(circle at 35% 35%, #F0C84A, #A07820)',
  '金': 'radial-gradient(circle at 35% 35%, #C8E4F8, #5A8AB8)',
  '水': 'radial-gradient(circle at 35% 35%, #64C8F8, #1A5A9A)',
  neutral: 'radial-gradient(circle at 35% 35%, #D4AF5A, #8B7536)',
}

// ─── 타입 배지 색상 ──────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; label: string }> = {
  attack: { bg: 'rgba(192,57,43,0.8)',  label: '공격' },
  skill:  { bg: 'rgba(37,99,168,0.8)',  label: '기술' },
  power:  { bg: 'rgba(90,37,168,0.8)',  label: '파워' },
}

// ─── 키워드 하이라이트 ───────────────────────────────

const KEYWORDS = ['취약', '약화', '허약', '독', '힘', '민첩', '소진', '바리케이드', '재생', '금속화', '의식', '가시', '오행공명', '불사조']

function highlightKeywords(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let idx = 0

  while (remaining.length > 0) {
    let found = false
    for (const kw of KEYWORDS) {
      const kwIdx = remaining.indexOf(kw)
      if (kwIdx === 0) {
        parts.push(
          <span key={`kw_${idx++}`} style={{ color: '#D4AF5A', fontWeight: 700 }}>
            {kw}
          </span>,
        )
        remaining = remaining.slice(kw.length)
        found = true
        break
      }
    }
    if (!found) {
      // 다음 키워드까지 일반 텍스트
      let nextKwIdx = remaining.length
      for (const kw of KEYWORDS) {
        const ki = remaining.indexOf(kw)
        if (ki > 0 && ki < nextKwIdx) nextKwIdx = ki
      }
      parts.push(<span key={`txt_${idx++}`}>{remaining.slice(0, nextKwIdx)}</span>)
      remaining = remaining.slice(nextKwIdx)
    }
  }

  return parts
}

// ─── Props ───────────────────────────────────────────

interface STSHandCardProps {
  cardDef: CardDef
  instanceId: string
  isPlayable: boolean
  isSelected: boolean
  onPlay: (instanceId: string) => void
}

// ─── STSHandCard ─────────────────────────────────────

export default function STSHandCard({
  cardDef,
  instanceId,
  isPlayable,
  isSelected,
  onPlay,
}: STSHandCardProps): React.ReactElement {
  const hoverRef = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const borderColor = isSelected
    ? 'rgba(255,215,0,0.8)'
    : getElementBorderColor(cardDef.element)

  const orbGradient = ORB_GRADIENT[cardDef.element] ?? ORB_GRADIENT['neutral']
  const badge = TYPE_BADGE[cardDef.type]

  // 클릭 처리
  const handleClick = () => {
    if (cardDef.unplayable) return
    if (!isPlayable) return
    onPlay(instanceId)
  }

  // 저주 카드: 클릭 불가, 점선 테두리
  const isUnplayable = cardDef.unplayable === true

  // CardArtSVG 타입 매핑 (옵션 B)
  const artCardType: 'soldier' | 'spell' = cardDef.type === 'attack' ? 'soldier' : 'spell'

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={() => { hoverRef.current = true }}
      onMouseLeave={() => { hoverRef.current = false }}
      style={{
        width: 80,
        height: 124,
        borderRadius: 6,
        background: 'var(--surface, #16130F)',
        border: isUnplayable
          ? '1px dashed rgba(128,0,128,0.6)'
          : `1.5px solid ${borderColor}`,
        boxShadow: isSelected
          ? '0 0 12px rgba(255,215,0,0.4), 0 2px 8px rgba(0,0,0,0.6)'
          : '0 2px 8px rgba(0,0,0,0.6)',
        opacity: isUnplayable ? 0.5 : isPlayable ? 1 : 0.45,
        cursor: isUnplayable ? 'default' : isPlayable ? 'pointer' : 'not-allowed',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'transform 0.15s ease-out, box-shadow 0.15s, opacity 0.15s',
        flexShrink: 0,
        userSelect: 'none',
        position: 'relative',
      }}
      onMouseOver={e => {
        if (!isUnplayable && isPlayable) {
          const el = e.currentTarget
          el.style.transform = 'translateY(-20px) scale(1.08)'
          el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)'
          el.style.zIndex = '10'
        }
      }}
      onMouseOut={e => {
        const el = e.currentTarget
        el.style.transform = ''
        el.style.boxShadow = isSelected
          ? '0 0 12px rgba(255,215,0,0.4), 0 2px 8px rgba(0,0,0,0.6)'
          : '0 2px 8px rgba(0,0,0,0.6)'
        el.style.zIndex = ''
      }}
    >
      {/* 헤더: 비용 구슬 + 카드명 */}
      <div
        style={{
          height: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 4px',
          flexShrink: 0,
        }}
      >
        {/* 비용 구슬 */}
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: orbGradient,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: !isPlayable ? '2px solid rgba(239,68,68,0.7)' : 'none',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono, "DM Mono", monospace)',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1,
            }}
          >
            {cardDef.cost}
          </span>
        </div>

        {/* 카드명 */}
        <span
          style={{
            fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
            fontStyle: 'italic',
            fontSize: 10,
            color: 'var(--text-headline, #E8E0D0)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {cardDef.name}
        </span>
      </div>

      {/* 아트 영역 */}
      <div
        style={{
          height: 56,
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CardArtSVG
          element={cardDef.element === 'neutral' ? '金' : cardDef.element}
          rarity="common"
          size="mini"
          cardType={artCardType}
        />
      </div>

      {/* 타입 배지 */}
      {badge && (
        <div
          style={{
            height: 14,
            background: badge.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono, "DM Mono", monospace)',
              fontSize: 9,
              color: '#fff',
              lineHeight: 1,
            }}
          >
            {badge.label}
          </span>
        </div>
      )}

      {/* 효과 텍스트 영역 */}
      <div
        style={{
          flex: 1,
          padding: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            fontSize: 10,
            color: 'var(--text-primary, #E8E0D0)',
            lineHeight: 1.3,
          }}
        >
          {highlightKeywords(cardDef.description)}
        </div>

        {/* 소진 레이블 */}
        {cardDef.exhaustOnUse && (
          <div
            style={{
              position: 'absolute',
              bottom: 2,
              right: 3,
              fontSize: 8,
              color: 'rgba(255,140,0,0.8)',
              fontFamily: 'var(--font-mono, "DM Mono", monospace)',
              lineHeight: 1,
            }}
          >
            소진
          </div>
        )}
      </div>
    </div>
  )
}
