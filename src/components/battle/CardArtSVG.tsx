/**
 * CardArtSVG — 오행별 테마 SVG 일러스트레이션 (M6)
 * 외부 이미지 없이 SVG + CSS로 카드 아트 구현
 */

import React from 'react'
import type { FiveElement } from '@/types/elements'
import type { Rarity } from '@/types/cards'

// ────────────────────────────────────────────────────
// 오행별 아트 팔레트
// ────────────────────────────────────────────────────

const ELEMENT_ART: Record<FiveElement, {
  bg: string
  accent: string
  gradientFrom: string
  gradientTo: string
  icon: string
  accentGlow: string
}> = {
  '木': {
    bg: '#1A2E1A',
    accent: '#4CAF50',
    gradientFrom: '#1A2E1A',
    gradientTo: '#0D1A0D',
    icon: '🌿',
    accentGlow: 'rgba(76,175,80,0.5)',
  },
  '火': {
    bg: '#2E1A0D',
    accent: '#FF6B35',
    gradientFrom: '#2E1A0D',
    gradientTo: '#1A0D06',
    icon: '🔥',
    accentGlow: 'rgba(255,107,53,0.5)',
  },
  '土': {
    bg: '#2A2010',
    accent: '#D4A017',
    gradientFrom: '#2A2010',
    gradientTo: '#1A1408',
    icon: '⚡',
    accentGlow: 'rgba(212,160,23,0.5)',
  },
  '金': {
    bg: '#1A1E2E',
    accent: '#87CEEB',
    gradientFrom: '#1A1E2E',
    gradientTo: '#0D1020',
    icon: '⚔️',
    accentGlow: 'rgba(135,206,235,0.5)',
  },
  '水': {
    bg: '#0D1A2E',
    accent: '#4FC3F7',
    gradientFrom: '#0D1A2E',
    gradientTo: '#061020',
    icon: '💧',
    accentGlow: 'rgba(79,195,247,0.5)',
  },
}

// ────────────────────────────────────────────────────
// 희귀도별 테두리/글로우 스타일
// ────────────────────────────────────────────────────

export function getRarityBorderStyle(rarity: Rarity): React.CSSProperties {
  switch (rarity) {
    case 'common':
      return {
        border: '1px solid rgba(44,44,44,0.25)',
        boxShadow: 'none',
      }
    case 'uncommon':
      return {
        border: '1px solid rgba(201,168,76,0.4)',
        boxShadow: 'none',
      }
    case 'rare':
      return {
        border: '1px solid rgba(201,168,76,0.7)',
        boxShadow: '0 0 12px rgba(201,168,76,0.4)',
      }
    case 'legendary':
      return {
        border: '1px solid #C9A84C',
        boxShadow: '0 0 20px rgba(201,168,76,0.6), 0 0 40px rgba(201,168,76,0.2)',
      }
    default:
      return {
        border: '1px solid rgba(44,44,44,0.25)',
      }
  }
}

// ────────────────────────────────────────────────────
// 오행별 SVG 패턴 (wood, fire, earth, metal, water)
// ────────────────────────────────────────────────────

function WoodPattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 줄기 */}
      <line x1="32" y1="56" x2="32" y2="20" stroke={accent} strokeWidth="2" strokeOpacity="0.7" />
      {/* 가지들 */}
      <line x1="32" y1="38" x2="18" y2="28" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="32" y1="32" x2="46" y2="22" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="32" y1="44" x2="44" y2="36" stroke={accent} strokeWidth="1.2" strokeOpacity="0.5" />
      {/* 잎 */}
      <ellipse cx="16" cy="26" rx="5" ry="3" fill={accent} fillOpacity="0.5" transform="rotate(-20, 16, 26)" />
      <ellipse cx="47" cy="20" rx="5" ry="3" fill={accent} fillOpacity="0.5" transform="rotate(20, 47, 20)" />
      <ellipse cx="45" cy="34" rx="4" ry="2.5" fill={accent} fillOpacity="0.4" transform="rotate(10, 45, 34)" />
      {/* 바닥 원 */}
      <circle cx="32" cy="56" r="6" fill={accent} fillOpacity="0.15" />
    </g>
  )
}

function FirePattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 화염 외형 */}
      <path
        d="M32 52 C20 44 16 34 22 24 C24 20 28 22 26 26 C30 18 36 16 34 22 C40 14 46 18 42 26 C48 22 48 32 42 36 C46 42 44 52 32 52Z"
        fill={accent}
        fillOpacity="0.4"
      />
      {/* 내부 불꽃 */}
      <path
        d="M32 48 C24 42 22 36 26 28 C28 24 30 26 29 30 C32 24 35 22 34 28 C38 22 40 28 37 32 C40 36 38 44 32 48Z"
        fill={accent}
        fillOpacity="0.6"
      />
      {/* 중심 */}
      <circle cx="32" cy="38" r="4" fill="white" fillOpacity="0.2" />
    </g>
  )
}

function EarthPattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 산 외형 */}
      <polygon points="32,16 52,52 12,52" fill={accent} fillOpacity="0.25" />
      {/* 눈 덮인 봉우리 */}
      <polygon points="32,16 40,32 24,32" fill="white" fillOpacity="0.15" />
      {/* 레이어 선들 */}
      <line x1="16" y1="44" x2="48" y2="44" stroke={accent} strokeWidth="1" strokeOpacity="0.4" />
      <line x1="20" y1="36" x2="44" y2="36" stroke={accent} strokeWidth="1" strokeOpacity="0.3" />
      {/* 수평선 빛 */}
      <line x1="8" y1="52" x2="56" y2="52" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" />
    </g>
  )
}

function MetalPattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 검 날 */}
      <polygon points="32,14 34,40 32,44 30,40" fill={accent} fillOpacity="0.6" />
      {/* 검 가드 */}
      <rect x="22" y="38" width="20" height="4" rx="2" fill={accent} fillOpacity="0.5" />
      {/* 손잡이 */}
      <rect x="30" y="42" width="4" height="12" rx="2" fill={accent} fillOpacity="0.4" />
      {/* 별빛 반짝임 */}
      <circle cx="32" cy="22" r="2" fill="white" fillOpacity="0.4" />
      <line x1="32" y1="18" x2="32" y2="14" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="28" y1="22" x2="24" y2="22" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="36" y1="22" x2="40" y2="22" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
    </g>
  )
}

function WaterPattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 물결 레이어들 */}
      <path d="M10 30 Q20 24 30 30 Q40 36 50 30" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.6" />
      <path d="M10 36 Q20 30 30 36 Q40 42 50 36" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.5" />
      <path d="M10 42 Q20 36 30 42 Q40 48 50 42" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.4" />
      {/* 물방울 */}
      <path d="M32 16 C32 16 24 26 24 30 C24 34.4 27.6 38 32 38 C36.4 38 40 34.4 40 30 C40 26 32 16 32 16Z"
        fill={accent} fillOpacity="0.35" />
      {/* 내부 광택 */}
      <ellipse cx="29" cy="26" rx="2" ry="3" fill="white" fillOpacity="0.2" transform="rotate(-10, 29, 26)" />
    </g>
  )
}

// ────────────────────────────────────────────────────
// 카드 아트 메인 컴포넌트
// ────────────────────────────────────────────────────

interface CardArtSVGProps {
  element: FiveElement
  rarity?: Rarity
  size?: 'mini' | 'field'  // mini=손패, field=필드
  cardType?: 'soldier' | 'spell'
}

export default function CardArtSVG({
  element,
  rarity = 'common',
  size = 'mini',
  cardType = 'soldier',
}: CardArtSVGProps): React.ReactElement {
  const art = ELEMENT_ART[element]
  const width = size === 'mini' ? 60 : 76
  const height = size === 'mini' ? 40 : 50

  const PatternComponent = {
    '木': WoodPattern,
    '火': FirePattern,
    '土': EarthPattern,
    '金': MetalPattern,
    '水': WaterPattern,
  }[element]

  // 주문 카드는 육각형 배경 + 빛 효과
  const isSpell = cardType === 'spell'

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 58"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id={`grad-${element}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={art.gradientFrom} />
          <stop offset="100%" stopColor={art.gradientTo} />
        </linearGradient>
        <radialGradient id={`glow-${element}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={art.accent} stopOpacity="0.15" />
          <stop offset="100%" stopColor={art.accent} stopOpacity="0" />
        </radialGradient>
        {rarity === 'legendary' && (
          <radialGradient id="legendary-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      {/* 배경 */}
      <rect width="64" height="58" fill={`url(#grad-${element})`} />

      {/* 글로우 오버레이 */}
      <ellipse cx="32" cy="32" rx="28" ry="24" fill={`url(#glow-${element})`} />

      {/* legendary 글로우 */}
      {rarity === 'legendary' && (
        <ellipse cx="32" cy="32" rx="28" ry="24" fill="url(#legendary-glow)" />
      )}

      {/* 패턴 */}
      {isSpell ? (
        // 주문 카드: 육각형 + 마법진
        <g>
          <polygon
            points="32,10 48,20 48,40 32,50 16,40 16,20"
            fill="none"
            stroke={art.accent}
            strokeWidth="1"
            strokeOpacity="0.4"
          />
          <polygon
            points="32,18 42,24 42,36 32,42 22,36 22,24"
            fill={art.accent}
            fillOpacity="0.08"
            stroke={art.accent}
            strokeWidth="0.8"
            strokeOpacity="0.3"
          />
          <circle cx="32" cy="30" r="6" fill={art.accent} fillOpacity="0.2" />
          <circle cx="32" cy="30" r="3" fill={art.accent} fillOpacity="0.4" />
        </g>
      ) : (
        <PatternComponent accent={art.accent} />
      )}

      {/* 희귀도별 상단 그라디언트 바 */}
      {rarity !== 'common' && (
        <rect
          width="64"
          height="2"
          fill={rarity === 'uncommon' ? '#C0C0C0' : rarity === 'rare' ? '#FFD700' : '#FF6B35'}
          fillOpacity={rarity === 'legendary' ? 0.8 : 0.5}
        />
      )}

      {/* legendary: 무지개 상단 바 */}
      {rarity === 'legendary' && (
        <defs>
          <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="25%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#44FF88" />
            <stop offset="75%" stopColor="#4FC3F7" />
            <stop offset="100%" stopColor="#FF6B35" />
          </linearGradient>
        </defs>
      )}
      {rarity === 'legendary' && (
        <rect width="64" height="2" fill="url(#rainbow)" fillOpacity="0.9" />
      )}
    </svg>
  )
}
