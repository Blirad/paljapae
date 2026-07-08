/**
 * RunSummaryScreen — 런 요약 화면
 * Phase B 스펙 §B-4
 * 패배/승리 후 공통 경유 화면. countUp 애니메이션 + 새 런 / 로비 버튼
 */
import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { FiveElement } from '@/types/elements'

interface RunSummaryScreenProps {
  result: 'victory' | 'defeat'
  heroName: string
  playerElement: FiveElement
  stagesCleared: number
  totalTurns: number
  cardsAcquired: number
  onNewRun: () => void
  onLobby: () => void
}

export default function RunSummaryScreen({
  result,
  heroName,
  stagesCleared,
  totalTurns,
  cardsAcquired,
  onNewRun,
  onLobby,
}: RunSummaryScreenProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stats = containerRef.current?.querySelectorAll('.stat-value')
    stats?.forEach((el, i) => {
      const target = parseInt(el.getAttribute('data-value') ?? '0')
      gsap.fromTo(
        el,
        { textContent: '0' },
        {
          textContent: target,
          duration: 0.8,
          delay: 0.3 + i * 0.15,
          snap: { textContent: 1 },
          ease: 'power1.out',
        }
      )
    })
  }, [])

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 480,
        margin: '0 auto',
        padding: '0 24px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      {/* 결과 한자 */}
      <div
        style={{
          marginTop: 56,
          fontSize: 72,
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          color: result === 'victory' ? 'var(--gold)' : 'var(--accent-red)',
          animation: 'scaleIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both',
        }}
      >
        {result === 'victory' ? '勝' : '敗'}
      </div>

      {/* 제목 */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--text-headline)',
          textAlign: 'center',
          marginTop: 16,
        }}
      >
        이번 런의 기록
      </div>

      {/* 통계 패널 */}
      <div
        ref={containerRef}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          padding: 20,
          width: '100%',
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        <StatItem label="도달 스테이지" value={stagesCleared} suffix="/6" />
        <StatItem label="소요 턴" value={totalTurns} suffix="턴" />
        <StatItem label="획득 카드" value={cardsAcquired} suffix="장" />
        <StatItem label="영웅" value={heroName} isText />
      </div>

      {/* 구분선 */}
      <div
        style={{
          width: '80%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--border-subtle), transparent)',
          margin: '24px auto',
        }}
      />

      {/* CTA 버튼 2개 */}
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button
          onClick={onNewRun}
          style={{
            flex: 1,
            padding: '14px 0',
            background: 'var(--gold)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            fontWeight: 700,
            color: '#1A1714',
          }}
        >
          새 런 시작
        </button>
        <button
          onClick={onLobby}
          style={{
            flex: 1,
            padding: '14px 0',
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-headline)',
          }}
        >
          로비로
        </button>
      </div>
    </div>
  )
}

// ── 내부 컴포넌트 ──────────────────────────────────────

interface StatItemProps {
  label: string
  value: number | string
  suffix?: string
  isText?: boolean
}

function StatItem({ label, value, suffix, isText }: StatItemProps) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: isText ? 16 : 24,
          color: 'var(--text-headline)',
          marginTop: 4,
        }}
      >
        {isText ? (
          value
        ) : (
          <>
            <span className="stat-value" data-value={value}>
              0
            </span>
            {suffix && (
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {suffix}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
