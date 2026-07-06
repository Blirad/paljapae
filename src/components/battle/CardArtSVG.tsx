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
    case 'legendary':
      return {
        border: '2px solid #C9A84C',
        boxShadow: '0 0 20px rgba(201,168,76,0.6), 0 0 40px rgba(201,168,76,0.2), inset 0 0 12px rgba(201,168,76,0.15)',
        animation: 'legendaryPulse 2s ease-in-out infinite',
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

type SilhouetteVariant = 'shield' | 'spear' | 'poison' | 'rush' | 'taoist' | 'iceblade' | 'swordsman'

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
  return (
    <g opacity="0.75">
      {/* 머리 + 투구 */}
      <circle cx="32" cy="11" r="5" fill={accent} fillOpacity="0.55" stroke={accent} strokeWidth="0.8" strokeOpacity="0.7"/>
      <path d="M27 11 Q27 5 32 4 Q37 5 37 11" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.7"/>
      <path d="M30 4 Q32 1 34 4" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.8"/>
      {/* 어깨 갑옷 */}
      <rect x="18" y="16" width="9" height="6" rx="2" fill={accent} fillOpacity="0.5" stroke={accent} strokeWidth="0.8" strokeOpacity="0.6"/>
      <rect x="37" y="16" width="9" height="6" rx="2" fill={accent} fillOpacity="0.5" stroke={accent} strokeWidth="0.8" strokeOpacity="0.6"/>
      {/* 흉갑 */}
      <polygon points="22,22 42,22 40,40 24,40" fill={accent} fillOpacity="0.4" stroke={accent} strokeWidth="1" strokeOpacity="0.6"/>
      <line x1="32" y1="22" x2="32" y2="40" stroke={accent} strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="23" y1="30" x2="41" y2="30" stroke={accent} strokeWidth="1" strokeOpacity="0.4"/>
      {/* 방패 — 왼쪽 */}
      <polygon points="10,18 18,14 18,42 10,46 6,32" fill={accent} fillOpacity="0.6"/>
      <polygon points="10,18 18,14 18,42 10,46 6,32" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.8"/>
      <line x1="7" y1="30" x2="17" y2="30" stroke={accent} strokeWidth="1" strokeOpacity="0.5"/>
      <line x1="12" y1="18" x2="12" y2="44" stroke={accent} strokeWidth="1" strokeOpacity="0.5"/>
      {/* 오른손 검 */}
      <polygon points="46,16 48,16 49,38 45,38" fill={accent} fillOpacity="0.7"/>
      <line x1="46.5" y1="17" x2="47" y2="35" stroke="white" strokeWidth="0.8" strokeOpacity="0.4"/>
      <rect x="43" y="36" width="10" height="3" rx="1.5" fill={accent} fillOpacity="0.65"/>
      {/* 하체 */}
      <rect x="23" y="40" width="7" height="14" rx="2" fill={accent} fillOpacity="0.45"/>
      <rect x="34" y="40" width="7" height="14" rx="2" fill={accent} fillOpacity="0.45"/>
      <polygon points="22,40 42,40 44,52 20,52" fill={accent} fillOpacity="0.3"/>
    </g>
  )
}

function SpearSilhouette({ accent }: { accent: string }): React.ReactElement {
  return (
    <g opacity="0.75">
      {/* 창 — 대각선으로 캔버스 전체 */}
      <line x1="54" y1="52" x2="14" y2="12" stroke={accent} strokeWidth="2.5" strokeOpacity="0.8"/>
      <polygon points="14,12 10,20 18,18" fill={accent} fillOpacity="0.9"/>
      <line x1="14" y1="12" x2="11" y2="18" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
      <rect x="48" y="46" width="3" height="8" rx="1" fill={accent} fillOpacity="0.4" transform="rotate(-45,49.5,50)"/>
      {/* 머리 + 몸 */}
      <circle cx="50" cy="13" r="5" fill={accent} fillOpacity="0.6"/>
      <path d="M44 18 Q50 16 56 18 L58 36 L42 36 Z" fill={accent} fillOpacity="0.45"/>
      <rect x="46" y="17" width="8" height="4" rx="1" fill={accent} fillOpacity="0.5"/>
      {/* 창 쥔 팔 */}
      <line x1="46" y1="22" x2="28" y2="28" stroke={accent} strokeWidth="3" strokeOpacity="0.8"/>
      <line x1="52" y1="22" x2="56" y2="30" stroke={accent} strokeWidth="2" strokeOpacity="0.4"/>
      {/* 망토 — 뒤로 펄럭임 */}
      <path d="M44 18 Q36 20 30 30 Q26 38 30 46 L42 36 Z" fill={accent} fillOpacity="0.35"/>
      <path d="M30 46 Q26 50 28 54" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5"/>
      <path d="M34 44 Q32 50 34 54" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.4"/>
      {/* 하체 */}
      <path d="M46 36 L44 52 L50 52 L52 36" fill={accent} fillOpacity="0.5"/>
      <path d="M54 36 L54 50 L58 50 L58 36" fill={accent} fillOpacity="0.3"/>
      <ellipse cx="47" cy="53" rx="5" ry="2.5" fill={accent} fillOpacity="0.4"/>
    </g>
  )
}

function PoisonSilhouette({ accent }: { accent: string }): React.ReactElement {
  return (
    <g opacity="0.75">
      {/* 머리 — 낮은 위치, 복면 착용 */}
      <circle cx="32" cy="14" r="4.5" fill={accent} fillOpacity="0.55"/>
      <line x1="28" y1="14" x2="36" y2="14" stroke="white" strokeWidth="1.2" strokeOpacity="0.3"/>
      <circle cx="29.5" cy="13" r="1" fill="white" fillOpacity="0.5"/>
      <circle cx="34.5" cy="13" r="1" fill="white" fillOpacity="0.5"/>
      {/* 몸통 — 웅크린 자세 */}
      <path d="M26 18 Q32 16 38 18 L40 30 L24 30 Z" fill={accent} fillOpacity="0.45"/>
      <rect x="24" y="28" width="16" height="3" rx="1" fill={accent} fillOpacity="0.6"/>
      {/* 독병 쥔 왼팔 */}
      <line x1="26" y1="22" x2="16" y2="28" stroke={accent} strokeWidth="2.5" strokeOpacity="0.8"/>
      <rect x="12" y="26" width="4" height="3" rx="1" fill={accent} fillOpacity="0.7"/>
      <ellipse cx="14" cy="32" rx="4" ry="5" fill={accent} fillOpacity="0.6"/>
      <rect x="13" y="24" width="2" height="3" rx="0.5" fill="white" fillOpacity="0.4"/>
      {/* 단검 쥔 오른팔 */}
      <line x1="38" y1="22" x2="46" y2="18" stroke={accent} strokeWidth="2.5" strokeOpacity="0.8"/>
      <polygon points="46,18 44,12 48,12" fill={accent} fillOpacity="0.85"/>
      <line x1="46" y1="18" x2="46" y2="13" stroke="white" strokeWidth="0.8" strokeOpacity="0.5"/>
      <rect x="43" y="18" width="6" height="2" rx="1" fill={accent} fillOpacity="0.6"/>
      {/* 하체 — 낮은 자세 */}
      <path d="M26 30 L20 40 L16 50 L22 52 L26 44 L28 30" fill={accent} fillOpacity="0.4"/>
      <path d="M38 30 L44 38 L46 50 L40 52 L38 42 L36 30" fill={accent} fillOpacity="0.4"/>
      {/* 독기 이펙트 */}
      <path d="M8 44 Q16 40 24 44 Q32 48 38 44" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray="3 2"/>
      <path d="M10 50 Q18 46 26 50 Q34 54 42 50" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.4" strokeDasharray="2 2"/>
      <circle cx="18" cy="42" r="1.5" fill={accent} fillOpacity="0.5"/>
      <circle cx="34" cy="46" r="1.2" fill={accent} fillOpacity="0.4"/>
      <circle cx="10" cy="48" r="1" fill={accent} fillOpacity="0.35"/>
    </g>
  )
}

function RushSilhouette({ accent }: { accent: string }): React.ReactElement {
  return (
    <g opacity="0.75">
      {/* 머리 — 앞으로 기운 자세 */}
      <circle cx="46" cy="12" r="5" fill={accent} fillOpacity="0.6"/>
      <path d="M46 7 Q50 6 52 9" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5"/>
      {/* 몸통 — 앞으로 숙임 */}
      <path d="M38 14 L54 18 L52 30 L36 26 Z" fill={accent} fillOpacity="0.5"/>
      <line x1="40" y1="18" x2="52" y2="21" stroke={accent} strokeWidth="1" strokeOpacity="0.4"/>
      {/* 무기 쥔 앞팔 */}
      <line x1="40" y1="18" x2="22" y2="14" stroke={accent} strokeWidth="3.5" strokeOpacity="0.8"/>
      <polygon points="22,14 14,10 14,18 20,16" fill={accent} fillOpacity="0.9"/>
      <line x1="20" y1="13" x2="15" y2="12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
      {/* 뒷팔 */}
      <line x1="50" y1="20" x2="58" y2="28" stroke={accent} strokeWidth="2.5" strokeOpacity="0.45"/>
      <circle cx="58" cy="29" r="3" fill={accent} fillOpacity="0.4"/>
      {/* 하체 — 달리는 자세 */}
      <path d="M38 28 L32 40 L36 42 L44 30" fill={accent} fillOpacity="0.55"/>
      <path d="M48 28 L52 38 L58 36 L54 26" fill={accent} fillOpacity="0.5"/>
      <ellipse cx="34" cy="43" rx="6" ry="2.5" fill={accent} fillOpacity="0.5"/>
      <ellipse cx="55" cy="37" rx="5" ry="2.5" fill={accent} fillOpacity="0.4"/>
      {/* 속도선 + 먼지 이펙트 */}
      <line x1="6" y1="30" x2="26" y2="28" stroke={accent} strokeWidth="2" strokeOpacity="0.45"/>
      <line x1="4" y1="36" x2="24" y2="34" stroke={accent} strokeWidth="1.8" strokeOpacity="0.35"/>
      <line x1="8" y1="42" x2="22" y2="40" stroke={accent} strokeWidth="1.5" strokeOpacity="0.25"/>
      <ellipse cx="12" cy="46" rx="6" ry="2" fill={accent} fillOpacity="0.2"/>
      <ellipse cx="6" cy="50" rx="4" ry="1.5" fill={accent} fillOpacity="0.15"/>
    </g>
  )
}

function TaoistSilhouette({ accent }: { accent: string }): React.ReactElement {
  return (
    <g opacity="0.75">
      {/* 머리 + 도관 */}
      <circle cx="32" cy="11" r="5" fill={accent} fillOpacity="0.55"/>
      <path d="M28 14 Q27 18 28 21" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.5"/>
      <path d="M34 15 Q35 19 34 22" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.5"/>
      <path d="M32 15 Q32 19 32 22" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.4"/>
      <path d="M27 9 Q32 4 37 9" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6"/>
      {/* 도포 몸통 */}
      <path d="M20 18 Q32 14 44 18 L46 40 L18 40 Z" fill={accent} fillOpacity="0.35"/>
      <line x1="32" y1="18" x2="32" y2="40" stroke={accent} strokeWidth="1" strokeOpacity="0.5"/>
      <path d="M20 28 Q32 26 44 28" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.4"/>
      <path d="M28 18 Q30 22 32 24" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.45"/>
      <path d="M36 18 Q34 22 32 24" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.45"/>
      {/* 넓은 소매 */}
      <path d="M20 18 L4 26 L8 34 L22 28" fill={accent} fillOpacity="0.3"/>
      <path d="M6 28 Q10 26 16 28" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.3"/>
      <path d="M44 18 L60 26 L56 34 L42 28" fill={accent} fillOpacity="0.3"/>
      <path d="M58 28 Q54 26 48 28" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.3"/>
      {/* 기공 구슬 */}
      <circle cx="32" cy="32" r="8" fill={accent} fillOpacity="0.15"/>
      <circle cx="32" cy="32" r="5" fill={accent} fillOpacity="0.4" stroke={accent} strokeWidth="1" strokeOpacity="0.7"/>
      <circle cx="32" cy="32" r="2.5" fill="white" fillOpacity="0.3"/>
      <path d="M26 32 Q29 28 32 32 Q35 36 38 32" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.5"/>
      {/* 하체 */}
      <path d="M18 40 Q32 44 46 40 L44 54 L20 54 Z" fill={accent} fillOpacity="0.25"/>
      <ellipse cx="25" cy="54" rx="5" ry="2" fill={accent} fillOpacity="0.35"/>
      <ellipse cx="39" cy="54" rx="5" ry="2" fill={accent} fillOpacity="0.35"/>
      {/* 부적 이펙트 */}
      <rect x="12" y="10" width="6" height="8" rx="1" fill={accent} fillOpacity="0.3" stroke={accent} strokeWidth="0.8" strokeOpacity="0.6"/>
      <line x1="13" y1="13" x2="17" y2="13" stroke={accent} strokeWidth="0.8" strokeOpacity="0.5"/>
      <line x1="14" y1="15" x2="17" y2="15" stroke={accent} strokeWidth="0.8" strokeOpacity="0.4"/>
    </g>
  )
}

function IcebladeSilhouette({ accent }: { accent: string }): React.ReactElement {
  return (
    <g opacity="0.75">
      {/* 머리 */}
      <circle cx="32" cy="12" r="5" fill={accent} fillOpacity="0.55"/>
      <path d="M27 10 Q32 6 37 10" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5"/>
      {/* 몸통 */}
      <path d="M24 18 Q32 15 40 18 L38 38 L26 38 Z" fill={accent} fillOpacity="0.4"/>
      <line x1="32" y1="18" x2="32" y2="38" stroke={accent} strokeWidth="1" strokeOpacity="0.35"/>
      {/* 양팔 — 검을 머리 위로 */}
      <line x1="26" y1="20" x2="20" y2="10" stroke={accent} strokeWidth="2.5" strokeOpacity="0.8"/>
      <line x1="38" y1="20" x2="44" y2="10" stroke={accent} strokeWidth="2.5" strokeOpacity="0.8"/>
      <circle cx="20" cy="9" r="2.5" fill={accent} fillOpacity="0.5"/>
      <circle cx="44" cy="9" r="2.5" fill={accent} fillOpacity="0.5"/>
      {/* 빙검 — 세로 중앙 */}
      <polygon points="32,4 35,8 35,36 29,36 29,8" fill={accent} fillOpacity="0.55"/>
      <polygon points="29,8 31,6 31,30 29,28" fill="white" fillOpacity="0.2"/>
      <polygon points="35,8 33,6 33,30 35,28" fill="white" fillOpacity="0.15"/>
      <rect x="24" y="34" width="16" height="4" rx="2" fill={accent} fillOpacity="0.7"/>
      <rect x="30" y="38" width="4" height="8" rx="1.5" fill={accent} fillOpacity="0.55"/>
      <polygon points="32,2 30,6 34,6" fill="white" fillOpacity="0.6"/>
      {/* 눈꽃 결정 이펙트 */}
      <circle cx="14" cy="16" r="2" fill={accent} fillOpacity="0.6"/>
      <line x1="10" y1="16" x2="18" y2="16" stroke={accent} strokeWidth="1.2" strokeOpacity="0.55"/>
      <line x1="11" y1="13" x2="17" y2="19" stroke={accent} strokeWidth="1.2" strokeOpacity="0.55"/>
      <circle cx="50" cy="20" r="1.5" fill={accent} fillOpacity="0.5"/>
      <line x1="46" y1="20" x2="54" y2="20" stroke={accent} strokeWidth="1" strokeOpacity="0.45"/>
      <circle cx="20" cy="44" r="1.2" fill={accent} fillOpacity="0.4"/>
      {/* 얼음기운 흘러내림 */}
      <path d="M28 38 Q26 44 24 50" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 2"/>
      <path d="M36 38 Q38 44 40 50" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.35" strokeDasharray="2 2"/>
      {/* 하체 */}
      <rect x="24" y="38" width="7" height="16" rx="2" fill={accent} fillOpacity="0.4"/>
      <rect x="33" y="38" width="7" height="16" rx="2" fill={accent} fillOpacity="0.4"/>
    </g>
  )
}

function SwordsmanSilhouette({ accent, cost }: { accent: string; cost: number }): React.ReactElement {
  const costScale = cost <= 2 ? 0.82 : cost >= 4 ? 1.1 : 1.0
  const translateOffset = cost <= 2 ? '8 5' : cost >= 4 ? '-3 -4' : '0 0'
  return (
    <g opacity="0.75" transform={`scale(${costScale}) translate(${translateOffset})`}>
      {/* 머리 */}
      <circle cx="32" cy="11" r="5" fill={accent} fillOpacity="0.55"/>
      <path d="M27 9 Q32 5 38 9" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.45"/>
      <circle cx="34" cy="11" r="1.2" fill="white" fillOpacity="0.4"/>
      {/* 몸통 */}
      <path d="M24 16 Q32 13 40 16 L38 38 L26 38 Z" fill={accent} fillOpacity="0.45"/>
      <line x1="32" y1="16" x2="32" y2="38" stroke={accent} strokeWidth="1" strokeOpacity="0.35"/>
      <path d="M26 28 Q32 26 38 28" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.45"/>
      <ellipse cx="23" cy="17" rx="4" ry="3" fill={accent} fillOpacity="0.4"/>
      <ellipse cx="41" cy="17" rx="4" ry="3" fill={accent} fillOpacity="0.4"/>
      {/* 검 쥔 오른팔 */}
      <line x1="40" y1="18" x2="52" y2="8" stroke={accent} strokeWidth="3" strokeOpacity="0.8"/>
      <polygon points="52,8 55,4 57,8 48,36 44,36" fill={accent} fillOpacity="0.75"/>
      <polygon points="53,6 54,4 55,6 50,30 49,30" fill="white" fillOpacity="0.25"/>
      <rect x="44" y="34" width="8" height="3" rx="1.5" fill={accent} fillOpacity="0.65"/>
      <line x1="48" y1="37" x2="42" y2="44" stroke={accent} strokeWidth="3" strokeOpacity="0.6"/>
      <circle cx="55" cy="5" r="2" fill="white" fillOpacity="0.5"/>
      <line x1="55" y1="2" x2="55" y2="8" stroke="white" strokeWidth="0.8" strokeOpacity="0.4"/>
      <line x1="52" y1="5" x2="58" y2="5" stroke="white" strokeWidth="0.8" strokeOpacity="0.4"/>
      {/* 왼팔 — 옆구리 준비 자세 */}
      <line x1="26" y1="18" x2="16" y2="26" stroke={accent} strokeWidth="2.5" strokeOpacity="0.5"/>
      <circle cx="15" cy="27" r="3" fill={accent} fillOpacity="0.45"/>
      {/* 하체 */}
      <path d="M26 38 L22 52 L28 54 L30 38" fill={accent} fillOpacity="0.5"/>
      <path d="M38 38 L42 50 L36 52 L34 38" fill={accent} fillOpacity="0.5"/>
      <ellipse cx="24" cy="54" rx="6" ry="2.5" fill={accent} fillOpacity="0.4"/>
    </g>
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
  size?: 'mini' | 'field'  // mini=손패, field=필드
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
