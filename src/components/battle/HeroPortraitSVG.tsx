/**
 * HeroPortraitSVG — 5종 영웅 SVG 초상화
 * 리라 스펙 §인터랙션명세 §3
 * 64×64px, 외부 이미지 없음
 */

import React from 'react'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// 오행별 팔레트
// ────────────────────────────────────────────────────

const PORTRAIT_CONFIG: Record<FiveElement, {
  bg: string
  color: string
  highlight: string
  borderColor: string
}> = {
  '木': {
    bg: '#1A2E1A',
    color: '#7EC87A',
    highlight: 'rgba(126,200,122,0.18)',
    borderColor: '#4CAF50',
  },
  '火': {
    bg: '#2E1A0A',
    color: '#FF8C5A',
    highlight: 'rgba(255,140,90,0.18)',
    borderColor: '#C4604A',
  },
  '土': {
    bg: '#2A1E08',
    color: '#F0C84A',
    highlight: 'rgba(240,200,74,0.18)',
    borderColor: '#B89A5E',
  },
  '金': {
    bg: '#0A1020',
    color: '#C8E4F8',
    highlight: 'rgba(200,228,248,0.18)',
    borderColor: '#9AAAB8',
  },
  '水': {
    bg: '#061018',
    color: '#64C8F8',
    highlight: 'rgba(100,200,248,0.18)',
    borderColor: '#5E8FB8',
  },
}

// ────────────────────────────────────────────────────
// 오행별 모티프 패턴
// ────────────────────────────────────────────────────

function WoodMotif({ color }: { color: string }): React.ReactElement {
  return (
    <g>
      {/* 나뭇가지 */}
      <line x1="32" y1="52" x2="32" y2="22" stroke={color} strokeWidth="2.5" strokeOpacity="0.8" />
      <line x1="32" y1="38" x2="16" y2="26" stroke={color} strokeWidth="2" strokeOpacity="0.7" />
      <line x1="32" y1="32" x2="48" y2="20" stroke={color} strokeWidth="2" strokeOpacity="0.7" />
      <line x1="32" y1="44" x2="46" y2="34" stroke={color} strokeWidth="1.5" strokeOpacity="0.55" />
      {/* 새싹 잎 */}
      <ellipse cx="14" cy="24" rx="6" ry="3.5" fill={color} fillOpacity="0.55" transform="rotate(-25, 14, 24)" />
      <ellipse cx="50" cy="18" rx="6" ry="3.5" fill={color} fillOpacity="0.55" transform="rotate(25, 50, 18)" />
      <ellipse cx="47" cy="32" rx="5" ry="3" fill={color} fillOpacity="0.45" transform="rotate(15, 47, 32)" />
      {/* 바닥 뿌리 */}
      <circle cx="32" cy="52" r="5" fill={color} fillOpacity="0.12" />
    </g>
  )
}

function FireMotif({ color }: { color: string }): React.ReactElement {
  return (
    <g>
      {/* 봉황 날개 — 양쪽 곡선 */}
      <path
        d="M32 44 C20 36 12 24 20 14 C22 10 26 12 24 18 C28 10 36 10 33 18 C38 10 46 14 42 22 C50 18 50 30 42 34 C46 40 44 48 32 48Z"
        fill={color}
        fillOpacity="0.4"
      />
      <path
        d="M32 44 C24 38 22 30 26 22 C28 18 30 20 29 24 C32 18 36 16 35 22 C39 18 40 26 37 30 C40 34 38 42 32 44Z"
        fill={color}
        fillOpacity="0.65"
      />
      {/* 봉황 머리 */}
      <circle cx="32" cy="14" r="4.5" fill={color} fillOpacity="0.5" />
      <circle cx="32" cy="14" r="2.5" fill="white" fillOpacity="0.2" />
    </g>
  )
}

function EarthMotif({ color }: { color: string }): React.ReactElement {
  return (
    <g>
      {/* 3겹 산 레이어 */}
      <polygon points="32,14 54,52 10,52" fill={color} fillOpacity="0.18" />
      <polygon points="24,26 48,52 0,52" fill={color} fillOpacity="0.14" />
      <polygon points="40,22 64,52 16,52" fill={color} fillOpacity="0.12" />
      {/* 눈 덮인 봉우리 */}
      <polygon points="32,14 42,32 22,32" fill="white" fillOpacity="0.12" />
      {/* 층 경계선 */}
      <line x1="12" y1="44" x2="52" y2="44" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <line x1="16" y1="36" x2="48" y2="36" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
      <line x1="8" y1="52" x2="56" y2="52" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
    </g>
  )
}

function MetalMotif({ color }: { color: string }): React.ReactElement {
  return (
    <g>
      {/* 검 날 */}
      <polygon points="32,12 34.5,42 32,46 29.5,42" fill={color} fillOpacity="0.65" />
      {/* 방패 */}
      <path d="M18 28 L18 42 Q18 48 24 50 Q32 54 32 54 Q32 54 40 50 Q46 48 46 42 L46 28 Z"
        fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.45" />
      {/* 검 가드 */}
      <rect x="22" y="40" width="20" height="4" rx="2" fill={color} fillOpacity="0.55" />
      {/* 손잡이 */}
      <rect x="30" y="44" width="4" height="10" rx="2" fill={color} fillOpacity="0.45" />
      {/* 별빛 */}
      <circle cx="32" cy="18" r="2.5" fill="white" fillOpacity="0.45" />
      <line x1="32" y1="13" x2="32" y2="10" stroke="white" strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1="27" y1="18" x2="24" y2="18" stroke="white" strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1="37" y1="18" x2="40" y2="18" stroke="white" strokeWidth="1.2" strokeOpacity="0.35" />
    </g>
  )
}

function WaterMotif({ color }: { color: string }): React.ReactElement {
  return (
    <g>
      {/* 달 */}
      <circle cx="40" cy="18" r="10" fill={color} fillOpacity="0.25" />
      <circle cx="43" cy="16" r="8" fill="#061018" fillOpacity="0.85" />
      {/* 물결 3겹 */}
      <path d="M8 34 Q18 26 28 34 Q38 42 48 34 Q54 30 58 34" fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.65" />
      <path d="M8 40 Q18 32 28 40 Q38 48 48 40 Q54 36 58 40" fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.5" />
      <path d="M8 46 Q18 38 28 46 Q38 54 48 46 Q54 42 58 46" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.35" />
      {/* 달 물 반영 */}
      <ellipse cx="22" cy="42" rx="5" ry="2.5" fill={color} fillOpacity="0.2" transform="rotate(-5, 22, 42)" />
    </g>
  )
}

// ────────────────────────────────────────────────────
// 팔각형 테두리 polygon 좌표
// ────────────────────────────────────────────────────

const OCTAGON = "12,2 52,2 62,12 62,52 52,62 12,62 2,52 2,12"

// ────────────────────────────────────────────────────
// HeroPortraitSVG 메인
// ────────────────────────────────────────────────────

interface HeroPortraitSVGProps {
  element: FiveElement
  currentHp: number
  maxHp: number
  size?: number
}

export default function HeroPortraitSVG({
  element,
  currentHp,
  maxHp,
  size = 64,
}: HeroPortraitSVGProps): React.ReactElement {
  const cfg = PORTRAIT_CONFIG[element]
  const hpPct = Math.max(0, Math.min(1, currentHp / maxHp))
  const hpColor = hpPct > 0.5 ? cfg.color : hpPct > 0.3 ? '#F59E0B' : '#EF4444'
  const isLowHp = hpPct <= 0.3

  const MotifComponent = {
    '木': WoodMotif,
    '火': FireMotif,
    '土': EarthMotif,
    '金': MetalMotif,
    '水': WaterMotif,
  }[element]

  return (
    <div style={{
      width: size,
      height: size + 6,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      {/* SVG 초상화 */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          <radialGradient id={`portrait-bg-${element}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={cfg.highlight.replace('0.18', '1')} stopOpacity="0.25" />
            <stop offset="100%" stopColor={cfg.bg} stopOpacity="1" />
          </radialGradient>
          <clipPath id={`octagon-clip-${element}`}>
            <polygon points={OCTAGON} />
          </clipPath>
        </defs>

        {/* 배경 */}
        <polygon
          points={OCTAGON}
          fill={`url(#portrait-bg-${element})`}
        />

        {/* 하이라이트 마스크 — 우상단 흰색 삼각형 */}
        <polygon
          points="38,2 62,2 62,28"
          fill="white"
          fillOpacity="0.06"
        />

        {/* 오행 모티프 */}
        <g clipPath={`url(#octagon-clip-${element})`}>
          <MotifComponent color={cfg.color} />
        </g>

        {/* 팔각형 테두리 */}
        <polygon
          points={OCTAGON}
          fill="none"
          stroke={cfg.borderColor}
          strokeWidth="2"
          strokeOpacity="0.8"
        />
      </svg>

      {/* HP 게이지 바 — 16px 높이 */}
      <div style={{
        width: size,
        height: 4,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          height: 4,
          width: `${hpPct * 100}%`,
          background: hpColor,
          transition: 'width 0.4s ease-out, background-color 0.4s',
          animation: isLowHp ? 'pulseRed 0.8s ease-in-out infinite' : 'none',
        }} />
      </div>
    </div>
  )
}
