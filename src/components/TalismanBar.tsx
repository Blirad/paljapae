/**
 * 팔자전 — 부적 슬롯 바 (TalismanBar)
 * Phase 1.6 B: 화면 우측 부적 슬롯 표시 + 발동 버튼
 */

import type { TalismanId } from '../engine/talismans'
import { TALISMAN_DATA } from '../engine/talismans'

interface TalismanBarProps {
  talismans: string[]      // 보유 부적 id 목록
  amplifyActive: boolean   // 증폭부 발동 중 여부
  onUse: (id: TalismanId) => void
}

export default function TalismanBar({ talismans, amplifyActive, onUse }: TalismanBarProps) {
  if (talismans.length === 0 && !amplifyActive) return null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '6px 8px',
        backgroundColor: '#1A1510',
        borderLeft: '1px solid #2A2620',
        minWidth: '52px',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: '8px',
          color: '#4A4540',
          letterSpacing: '0.1em',
          writingMode: 'vertical-rl',
          marginBottom: '4px',
        }}
      >
        부적
      </div>

      {/* 증폭부 활성 표시 */}
      {amplifyActive && (
        <div
          title="증폭부 발동 중 — 다음 공격 ×2"
          style={{
            width: '40px',
            height: '48px',
            border: '2px solid #C63D2F',
            borderRadius: '3px',
            backgroundColor: 'rgba(198,61,47,0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            boxShadow: '0 0 8px rgba(198,61,47,0.4)',
            animation: 'talismanPulse 1s ease-in-out infinite',
          }}
        >
          <div style={{ fontSize: '14px', lineHeight: 1 }}>×</div>
          <div style={{ fontSize: '11px', color: '#C63D2F', fontWeight: 'bold', lineHeight: 1 }}>2</div>
        </div>
      )}

      {/* 보유 부적 슬롯 */}
      {talismans.map(id => {
        const data = TALISMAN_DATA[id as TalismanId]
        if (!data) return null
        return (
          <button
            key={id}
            onClick={() => onUse(id as TalismanId)}
            title={`${data.name}(${data.hanja}) — ${data.effect}`}
            style={{
              width: '40px',
              height: '48px',
              border: `2px solid ${data.color}`,
              borderRadius: '3px',
              backgroundColor: 'rgba(28,23,16,0.9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <div
              style={{
                fontSize: '9px',
                color: data.color,
                fontWeight: 'bold',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              {data.hanja.split('').map((ch, i) => (
                <span key={i} style={{ display: 'block' }}>{ch}</span>
              ))}
            </div>
          </button>
        )
      })}

      {/* 빈 슬롯 (최대 3개까지) */}
      {Array.from({ length: Math.max(0, 3 - talismans.length - (amplifyActive ? 0 : 0)) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          style={{
            width: '40px',
            height: '48px',
            border: '1px dashed #2A2620',
            borderRadius: '3px',
            backgroundColor: 'transparent',
            opacity: 0.3,
          }}
        />
      ))}
    </div>
  )
}
