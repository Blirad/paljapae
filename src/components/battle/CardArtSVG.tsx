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
        border: '1px solid rgba(80,80,80,0.4)',
        boxShadow: 'none',
      }
    case 'uncommon':
      return {
        border: '1.5px solid rgba(120,160,200,0.6)',
        boxShadow: '0 0 8px rgba(120,160,200,0.25)',
      }
    case 'rare':
      return {
        border: '2px solid rgba(201,168,76,0.8)',
        boxShadow: '0 0 14px rgba(201,168,76,0.4), inset 0 0 8px rgba(201,168,76,0.1)',
      }
    case 'epic':
      return {
        border: '2px solid rgba(100,150,255,0.8)',
        boxShadow: '0 0 16px rgba(100,150,255,0.5), inset 0 0 10px rgba(100,150,255,0.15)',
        animation: 'epicPulse 1.5s ease-in-out infinite',
      }
    case 'legendary':
      return {
        border: '2px solid #C9A84C',
        boxShadow: '0 0 20px rgba(201,168,76,0.6), 0 0 40px rgba(201,168,76,0.2), inset 0 0 12px rgba(201,168,76,0.15)',
        animation: 'legendaryPulse 2s ease-in-out infinite',
      }
    case 'celestial':
      return {
        border: '2.5px solid #FFD700',
        boxShadow: '0 0 24px rgba(255,215,0,0.7), 0 0 48px rgba(255,215,0,0.3), inset 0 0 14px rgba(255,215,0,0.2)',
        animation: 'celestialPulse 1.2s ease-in-out infinite',
      }
    default:
      return {
        border: '1px solid rgba(80,80,80,0.4)',
      }
  }
}

/**
 * LegendaryCorners — legendary 카드 코너 장식 (JSX div 4개)
 * 리라 스펙 §인터랙션명세 §10
 */
export function LegendaryCorners({ element }: { element?: FiveElement }): React.ReactElement {
  const cornerColor = element ? ({
    '木': '#4CAF50',
    '火': '#C4604A',
    '土': '#C9A84C',
    '金': '#9AAAB8',
    '水': '#5E8FB8',
  } as Record<FiveElement, string>)[element] : '#C9A84C'

  const cornerStyle: React.CSSProperties = {
    position: 'absolute',
    width: 8,
    height: 8,
    pointerEvents: 'none',
    zIndex: 2,
  }

  return (
    <>
      {/* 좌상단 */}
      <div style={{
        ...cornerStyle,
        top: 1,
        left: 1,
        borderTop: `2px solid ${cornerColor}`,
        borderLeft: `2px solid ${cornerColor}`,
      }} />
      {/* 우상단 */}
      <div style={{
        ...cornerStyle,
        top: 1,
        right: 1,
        borderTop: `2px solid ${cornerColor}`,
        borderRight: `2px solid ${cornerColor}`,
      }} />
      {/* 좌하단 */}
      <div style={{
        ...cornerStyle,
        bottom: 1,
        left: 1,
        borderBottom: `2px solid ${cornerColor}`,
        borderLeft: `2px solid ${cornerColor}`,
      }} />
      {/* 우하단 */}
      <div style={{
        ...cornerStyle,
        bottom: 1,
        right: 1,
        borderBottom: `2px solid ${cornerColor}`,
        borderRight: `2px solid ${cornerColor}`,
      }} />
    </>
  )
}

// ────────────────────────────────────────────────────
// 오행별 SVG 패턴 (wood, fire, earth, metal, water)
// ────────────────────────────────────────────────────

// ────────────────────────────────────────────────────
// FAIL2 수정: 오행별 SVG 패턴 — 배경 색 블록 + 굵은 아이콘으로 mini 크기에서도 명확히 구분
// ────────────────────────────────────────────────────

function WoodPattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 초록 배경 블록 — 木 식별용 */}
      <rect width="64" height="58" fill="#1A3A1A" fillOpacity="0.5" />
      {/* 굵은 줄기 */}
      <line x1="32" y1="56" x2="32" y2="16" stroke={accent} strokeWidth="3.5" strokeOpacity="0.9" />
      {/* 굵은 가지 */}
      <line x1="32" y1="36" x2="14" y2="24" stroke={accent} strokeWidth="2.5" strokeOpacity="0.8" />
      <line x1="32" y1="28" x2="50" y2="18" stroke={accent} strokeWidth="2.5" strokeOpacity="0.8" />
      <line x1="32" y1="44" x2="48" y2="34" stroke={accent} strokeWidth="2" strokeOpacity="0.7" />
      {/* 큰 잎 */}
      <ellipse cx="12" cy="22" rx="8" ry="4.5" fill={accent} fillOpacity="0.75" transform="rotate(-25, 12, 22)" />
      <ellipse cx="52" cy="16" rx="8" ry="4.5" fill={accent} fillOpacity="0.75" transform="rotate(25, 52, 16)" />
      <ellipse cx="49" cy="32" rx="6" ry="3.5" fill={accent} fillOpacity="0.6" transform="rotate(12, 49, 32)" />
      {/* 바닥 뿌리 */}
      <circle cx="32" cy="56" r="7" fill={accent} fillOpacity="0.25" />
    </g>
  )
}

function FirePattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 붉은 배경 블록 — 火 식별용 */}
      <rect width="64" height="58" fill="#3A1000" fillOpacity="0.55" />
      {/* 큰 화염 외형 */}
      <path
        d="M32 54 C16 44 10 30 18 16 C20 10 26 14 23 20 C28 10 37 8 34 18 C42 8 50 14 44 24 C52 18 52 34 44 40 C50 46 46 54 32 54Z"
        fill={accent}
        fillOpacity="0.55"
      />
      {/* 밝은 내부 불꽃 */}
      <path
        d="M32 50 C22 42 20 34 25 24 C27 20 30 22 28 28 C32 20 36 18 35 26 C40 20 42 30 39 36 C43 40 40 48 32 50Z"
        fill={accent}
        fillOpacity="0.8"
      />
      {/* 핵심 백열 */}
      <ellipse cx="32" cy="36" rx="6" ry="8" fill="white" fillOpacity="0.3" />
      <circle cx="32" cy="38" r="3" fill="white" fillOpacity="0.5" />
    </g>
  )
}

function EarthPattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 황토 배경 블록 — 土 식별용 */}
      <rect width="64" height="58" fill="#2A1E00" fillOpacity="0.5" />
      {/* 큰 산 외형 */}
      <polygon points="32,10 56,52 8,52" fill={accent} fillOpacity="0.4" />
      {/* 뒤 산 */}
      <polygon points="18,22 44,52 -8,52" fill={accent} fillOpacity="0.2" />
      {/* 눈 덮인 봉우리 */}
      <polygon points="32,10 43,30 21,30" fill="white" fillOpacity="0.25" />
      {/* 레이어 층선 */}
      <line x1="12" y1="42" x2="52" y2="42" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" />
      <line x1="18" y1="34" x2="46" y2="34" stroke={accent} strokeWidth="1.5" strokeOpacity="0.4" />
      {/* 지평선 */}
      <line x1="4" y1="52" x2="60" y2="52" stroke={accent} strokeWidth="2" strokeOpacity="0.65" />
    </g>
  )
}

function MetalPattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 청금 배경 블록 — 金 식별용 */}
      <rect width="64" height="58" fill="#061228" fillOpacity="0.5" />
      {/* 검 날 — 더 넓고 밝게 */}
      <polygon points="32,10 36,42 32,48 28,42" fill={accent} fillOpacity="0.8" />
      {/* 검 날 광택 */}
      <polygon points="32,10 34,28 32,32 31,28" fill="white" fillOpacity="0.3" />
      {/* 검 가드 */}
      <rect x="18" y="40" width="28" height="5" rx="2.5" fill={accent} fillOpacity="0.7" />
      {/* 손잡이 */}
      <rect x="30" y="45" width="4" height="10" rx="2" fill={accent} fillOpacity="0.55" />
      {/* 별빛 십자 반짝임 */}
      <circle cx="32" cy="20" r="3" fill="white" fillOpacity="0.55" />
      <line x1="32" y1="14" x2="32" y2="10" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <line x1="26" y1="20" x2="22" y2="20" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <line x1="38" y1="20" x2="42" y2="20" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
    </g>
  )
}

function WaterPattern({ accent }: { accent: string }): React.ReactElement {
  return (
    <g>
      {/* 파랑 배경 블록 — 水 식별용 */}
      <rect width="64" height="58" fill="#020C24" fillOpacity="0.55" />
      {/* 굵은 물결 3겹 */}
      <path d="M6 28 Q18 20 30 28 Q42 36 54 28" fill="none" stroke={accent} strokeWidth="3" strokeOpacity="0.75" />
      <path d="M6 36 Q18 28 30 36 Q42 44 54 36" fill="none" stroke={accent} strokeWidth="3" strokeOpacity="0.6" />
      <path d="M6 44 Q18 36 30 44 Q42 52 54 44" fill="none" stroke={accent} strokeWidth="2.5" strokeOpacity="0.45" />
      {/* 큰 물방울 */}
      <path d="M32 10 C32 10 22 24 22 30 C22 36.6 26.5 42 32 42 C37.5 42 42 36.6 42 30 C42 24 32 10 32 10Z"
        fill={accent} fillOpacity="0.5" />
      {/* 광택 */}
      <ellipse cx="28" cy="24" rx="3" ry="4.5" fill="white" fillOpacity="0.3" transform="rotate(-10, 28, 24)" />
      <circle cx="32" cy="30" r="2" fill="white" fillOpacity="0.2" />
    </g>
  )
}

// ────────────────────────────────────────────────────
// 실루엣 SVG (7종) — M8 P0 키워드 기반 캐릭터 실루엣
// ────────────────────────────────────────────────────

export type SilhouetteVariant = 'shield' | 'spear' | 'poison' | 'rush' | 'taoist' | 'iceblade' | 'swordsman'

function selectSilhouetteVariant(keywords: string[], _cost: number): SilhouetteVariant {
  if (keywords.includes('taunt'))     return 'shield'
  if (keywords.includes('pierce'))    return 'spear'
  if (keywords.includes('poison'))    return 'poison'
  if (keywords.includes('rush'))      return 'rush'
  if (keywords.includes('lifesteal')) return 'taoist'
  if (keywords.includes('freeze'))    return 'iceblade'
  return 'swordsman'
}

function ShieldSilhouette({ accent }: { accent: string }): React.ReactElement {
  void accent
  return (
    <image href="/card-art/shield.png" x="0" y="0" width="64" height="58" preserveAspectRatio="xMidYMid meet" />
  )
}

function SpearSilhouette({ accent }: { accent: string }): React.ReactElement {
  void accent
  return (
    <image href="/card-art/spear.png" x="0" y="0" width="64" height="58" preserveAspectRatio="xMidYMid meet" />
  )
}

function PoisonSilhouette({ accent }: { accent: string }): React.ReactElement {
  void accent
  return (
    <image href="/card-art/poison.png" x="0" y="0" width="64" height="58" preserveAspectRatio="xMidYMid meet" />
  )
}

function RushSilhouette({ accent }: { accent: string }): React.ReactElement {
  void accent
  return (
    <image href="/card-art/rush.png" x="0" y="0" width="64" height="58" preserveAspectRatio="xMidYMid meet" />
  )
}

function TaoistSilhouette({ accent }: { accent: string }): React.ReactElement {
  void accent
  return (
    <image href="/card-art/taoist.png" x="0" y="0" width="64" height="58" preserveAspectRatio="xMidYMid meet" />
  )
}

function IcebladeSilhouette({ accent }: { accent: string }): React.ReactElement {
  void accent
  return (
    <image href="/card-art/iceblade.png" x="0" y="0" width="64" height="58" preserveAspectRatio="xMidYMid meet" />
  )
}

function SwordsmanSilhouette({ accent, cost }: { accent: string; cost: number }): React.ReactElement {
  void accent
  void cost
  return (
    <image href="/card-art/swordsman.png" x="0" y="0" width="64" height="58" preserveAspectRatio="xMidYMid meet" />
  )
}

function SilhouetteLayer({
  variant,
  accent,
  cost,
}: {
  variant: SilhouetteVariant
  accent: string
  cost: number
}): React.ReactElement {
  switch (variant) {
    case 'shield':    return <ShieldSilhouette accent={accent} />
    case 'spear':     return <SpearSilhouette accent={accent} />
    case 'poison':    return <PoisonSilhouette accent={accent} />
    case 'rush':      return <RushSilhouette accent={accent} />
    case 'taoist':    return <TaoistSilhouette accent={accent} />
    case 'iceblade':  return <IcebladeSilhouette accent={accent} />
    case 'swordsman': return <SwordsmanSilhouette accent={accent} cost={cost} />
  }
}

// ────────────────────────────────────────────────────
// 카드 아트 메인 컴포넌트
// ────────────────────────────────────────────────────

interface CardArtSVGProps {
  element: FiveElement
  rarity?: Rarity
  size?: 'mini' | 'field' | 'hero'  // mini=손패, field=필드, hero=필드 유닛 미니 SVG (32×28px)
  cardType?: 'soldier' | 'spell'
  keywords?: string[]  // M8 P0: 실루엣 선택에 사용 (cards.ts 변경 없음)
  cost?: number        // M8 P0: 검사 실루엣 크기 조정에 사용
}

export default function CardArtSVG({
  element,
  rarity = 'common',
  size = 'mini',
  cardType = 'soldier',
  keywords = [],
  cost = 3,
}: CardArtSVGProps): React.ReactElement {
  const art = ELEMENT_ART[element]
  const width = size === 'mini' ? 60 : size === 'hero' ? 32 : 76
  const height = size === 'mini' ? 40 : size === 'hero' ? 28 : 50

  const PatternComponent = {
    '木': WoodPattern,
    '火': FirePattern,
    '土': EarthPattern,
    '金': MetalPattern,
    '水': WaterPattern,
  }[element]

  // 주문 카드는 육각형 배경 + 빛 효과
  const isSpell = cardType === 'spell'

  // M8 P0: soldier 카드 실루엣 선택
  const silhouetteVariant = !isSpell ? selectSilhouetteVariant(keywords, cost) : null

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

      {/* 패턴 (채도 약간 낮춤 — 실루엣 레이어와의 가독성 확보) */}
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
        // soldier 카드: 오행 패턴(채도 낮춤) + 실루엣 레이어
        <>
          <g opacity="0.7">
            <PatternComponent accent={art.accent} />
          </g>
          <SilhouetteLayer
            variant={silhouetteVariant!}
            accent={art.accent}
            cost={cost}
          />
        </>
      )}

      {/* 희귀도별 상단 그라디언트 바 (hero 사이즈에서는 생략) */}
      {rarity !== 'common' && size !== 'hero' && (
        <rect
          width="64"
          height="2"
          fill={rarity === 'uncommon' ? '#C0C0C0' : rarity === 'rare' ? '#FFD700' : '#FF6B35'}
          fillOpacity={rarity === 'legendary' ? 0.8 : 0.5}
        />
      )}

      {/* legendary: 무지개 상단 바 (hero 사이즈에서는 생략) */}
      {rarity === 'legendary' && size !== 'hero' && (
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
      {rarity === 'legendary' && size !== 'hero' && (
        <rect width="64" height="2" fill="url(#rainbow)" fillOpacity="0.9" />
      )}
    </svg>
  )
}
