/**
 * KeywordBadge — 키워드 8종 배지 컴포넌트
 * 리라 스펙 §7-1
 */

import React, { useState } from 'react'
import type { Keyword } from '@/types/cards'
import { KEYWORD_LABEL } from '@/types/cards'

// ────────────────────────────────────────────────────
// 키워드 메타데이터
// ────────────────────────────────────────────────────

const KEYWORD_META: Record<Keyword, { icon: string; bg: string; desc: string }> = {
  rush:       { icon: '⚡', bg: 'rgba(192,57,43,0.7)',   desc: '소환 당턴 즉시 공격 가능' },
  taunt:      { icon: '🛡', bg: 'rgba(192,122,26,0.7)', desc: '적이 이 유닛부터 공격해야 함' },
  poison:     { icon: '☠', bg: 'rgba(61,122,58,0.7)',   desc: '공격 시 대상 무조건 파괴' },
  lifesteal:  { icon: '❤', bg: 'rgba(37,99,168,0.7)',   desc: '가한 피해만큼 영웅 HP 회복' },
  freeze:     { icon: '❄', bg: 'rgba(37,99,168,0.9)',   desc: '피격 대상 다음 턴 공격 불가' },
  pierce:     { icon: '🗡', bg: 'rgba(139,117,54,0.7)',  desc: '적 유닛 무시 영웅 직접 공격 가능' },
  reborn:     { icon: '✦', bg: 'rgba(232,200,74,0.6)',  desc: '처음 파괴 시 HP 1로 부활' },
  incinerate: { icon: '🔥', bg: 'rgba(192,57,43,0.9)',  desc: '처치된 적 제거 (부활 방지)' },
}

interface KeywordBadgeProps {
  keyword: Keyword
  used?: boolean   // reborn 사용 후 dim
}

export default function KeywordBadge({ keyword, used = false }: KeywordBadgeProps): React.ReactElement {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const meta = KEYWORD_META[keyword]

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      title={KEYWORD_LABEL[keyword]}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: meta.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          opacity: used ? 0.3 : 1,
          cursor: 'default',
          flexShrink: 0,
        }}
        aria-label={KEYWORD_LABEL[keyword]}
      >
        {meta.icon}
      </div>
      {tooltipVisible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 4,
            width: 140,
            background: 'var(--surface)',
            border: '1px solid rgba(232,200,74,0.45)',
            borderRadius: 6,
            padding: '6px 10px',
            zIndex: 60,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 2 }}>
            {KEYWORD_LABEL[keyword]}
          </div>
          <div style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>
            {meta.desc}
          </div>
        </div>
      )}
    </div>
  )
}

export { KEYWORD_META }
