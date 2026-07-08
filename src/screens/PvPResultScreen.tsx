/**
 * PvPResultScreen — PvP 결과 화면
 * 리라 스펙 §신규 화면 5 — PvPResultScreen
 * AppScene: 'pvpResult'
 * ELO 카운트업 + 보상 (기존 ResultScreen GSAP 패턴 재사용)
 */

import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { usePvPStore, mockGenerateResult } from '@/stores/pvpStore'

// ────────────────────────────────────────────────────
// GoldParticles (ResultScreen에서 이식)
// ────────────────────────────────────────────────────

function GoldParticles(): React.ReactElement {
  const particleRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    particleRefs.current.forEach((el, i) => {
      if (!el) return
      gsap.fromTo(el,
        { y: 0, opacity: 1, scale: 1 },
        {
          y: -(60 + Math.random() * 80),
          x: (Math.random() - 0.5) * 40,
          opacity: 0,
          scale: 0.5,
          duration: 0.8 + i * 0.15,
          ease: 'power1.out',
          delay: i * 0.1,
          repeat: -1,
          repeatDelay: 0.3 + Math.random() * 0.4,
        },
      )
    })
  }, [])

  return (
    <>
      {Array(8).fill(null).map((_, i) => (
        <div
          key={i}
          ref={el => { particleRefs.current[i] = el }}
          style={{
            position: 'absolute',
            width: i % 3 === 0 ? 8 : 5,
            height: i % 3 === 0 ? 8 : 5,
            borderRadius: '50%',
            background: i % 2 === 0 ? '#C9A84C' : '#E8C547',
            left: `${10 + i * 11}%`,
            bottom: '15%',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  )
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface PvPResultScreenProps {
  isWin: boolean
  onRematch: () => void
  onLobby: () => void
}

// ────────────────────────────────────────────────────
// PvPResultScreen
// ────────────────────────────────────────────────────

export default function PvPResultScreen({ isWin, onRematch, onLobby }: PvPResultScreenProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const eloCardRef = useRef<HTMLDivElement>(null)
  const rewardItemRefs = useRef<(HTMLDivElement | null)[]>([])

  const pvpStore = usePvPStore()

  // 결과 데이터 (pvpStore에서 또는 목 생성)
  const result = pvpStore.result ?? mockGenerateResult(isWin)

  // ELO 카운트업 애니메이션 상태
  const [displayedEloChange, setDisplayedEloChange] = useState(0)
  const [displayedOldElo] = useState(pvpStore.myElo)
  const [displayedNewElo, setDisplayedNewElo] = useState(pvpStore.myElo)

  useEffect(() => {
    const container = containerRef.current
    const title = titleRef.current
    const eloCard = eloCardRef.current
    if (!container || !title) return

    // 공통: 화면 fade-in
    gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' })

    if (isWin) {
      // 승리 애니메이션
      gsap.fromTo(title,
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.5)', delay: 0.1 },
      )
      if (eloCard) {
        gsap.fromTo(eloCard,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out', delay: 0.3 },
        )
      }
      // 보상 항목 stagger
      rewardItemRefs.current.forEach((el, i) => {
        if (!el) return
        gsap.fromTo(el,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', delay: 0.5 + i * 0.15 },
        )
      })
    } else {
      // 패배: shake + vignette
      gsap.fromTo(container,
        { x: -8 },
        { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' },
      )
      gsap.fromTo(title,
        { opacity: 0 },
        { opacity: 1, duration: 0.4 },
      )
    }

    // ELO 카운트업 (GSAP + onUpdate)
    const targetChange = result.eloChange
    const targetNew = displayedOldElo + targetChange
    const countObj = { val: 0 }
    gsap.to(countObj, {
      val: Math.abs(targetChange),
      duration: 1,
      delay: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        setDisplayedEloChange(Math.round(countObj.val) * (targetChange < 0 ? -1 : 1))
      },
    })
    const newObj = { val: displayedOldElo }
    gsap.to(newObj, {
      val: targetNew,
      duration: 1,
      delay: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        setDisplayedNewElo(Math.round(newObj.val))
      },
    })
  }, [isWin, result.eloChange, displayedOldElo])

  const rankChanged = result.oldRank !== result.newRank
  const eloChangePositive = result.eloChange >= 0

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
        padding: '40px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        overflowY: 'auto',
        opacity: 0,
        position: 'relative',
      }}
    >
      {/* 승리 파티클 */}
      {isWin && <GoldParticles />}

      {/* 패배 vignette 오버레이 */}
      {!isWin && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(139,0,0,0.4) 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
      )}

      {/* 타이틀 */}
      <div
        ref={titleRef}
        style={{
          textAlign: 'center',
          marginBottom: 8,
          opacity: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 32,
          color: isWin ? 'var(--gold)' : '#EF4444',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          {isWin ? '승리 (勝利)' : '패배 (敗北)'}
        </div>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--text-secondary)',
          letterSpacing: '0.03em',
        }}>
          {isWin
            ? '운명이 그대 편이었습니다.'
            : '운명이 아직 그대를 시험합니다.'}
        </div>
      </div>

      {/* 전적 변화 섹션 */}
      <SectionDivider label="전적 변화" />

      {/* ELO 카드 */}
      <div
        ref={eloCardRef}
        style={{
          background: 'var(--surface)',
          border: `1px solid ${eloChangePositive ? 'rgba(201,168,76,0.4)' : 'rgba(239,68,68,0.4)'}`,
          padding: 16,
          textAlign: 'center',
          marginBottom: 16,
          opacity: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--text-secondary)',
          marginBottom: 6,
        }}>
          <span style={{ color: 'var(--text-muted)' }}>{displayedOldElo}</span>
          {' → '}
          <span style={{ color: eloChangePositive ? 'var(--gold)' : '#EF4444', fontWeight: 700 }}>
            {displayedNewElo}
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 20,
          fontWeight: 700,
          color: eloChangePositive ? 'var(--gold)' : '#EF4444',
        }}>
          {eloChangePositive ? '+' : ''}{displayedEloChange}
        </div>

        {/* 랭크 변화 (변경된 경우만) */}
        {rankChanged && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: eloChangePositive ? 'var(--gold)' : '#EF4444',
            marginTop: 6,
          }}>
            {eloChangePositive ? `↑ ${result.newRank} 승격!` : `↓ ${result.newRank} 강등.`}
          </div>
        )}
      </div>

      {/* 보상 섹션 */}
      <SectionDivider label="보상" />

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: 12,
        marginBottom: 16,
        position: 'relative',
        zIndex: 1,
      }}>
        {[
          { icon: '✦', label: `+${result.expGained} EXP` },
          { icon: '◈', label: `+${result.goldGained} 골드` },
          { icon: '⊞', label: '추가 카드 없음' },
        ].map((item, i) => (
          <div
            key={item.label}
            ref={el => { rewardItemRefs.current[i] = el }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 0',
              borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
              opacity: 0,
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--gold)',
              flexShrink: 0,
            }}>
              {item.icon}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text-secondary)',
              letterSpacing: '0.03em',
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* 전투 요약 섹션 */}
      <SectionDivider label="전투 요약" />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 24,
        position: 'relative',
        zIndex: 1,
      }}>
        {[
          { label: '총 턴:', value: `${result.totalTurns}턴` },
          { label: '처치:', value: `${result.killCount}` },
          { label: '최대 콤보:', value: `${result.maxCombo} 3연속` },
        ].map(item => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* CTA 버튼들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1 }}>
        {/* 다시 대전 / 다시 도전 (primary 56px) */}
        <button
          onClick={onRematch}
          style={{
            width: '100%',
            height: 56,
            background: 'linear-gradient(135deg, #C9A84C, #A0822C)',
            border: '1px solid rgba(201,168,76,0.8)',
            color: '#1A1410',
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(201,168,76,0.3)',
          }}
        >
          {isWin ? '다시 대전' : '다시 도전'}
        </button>

        {/* 로비로 돌아가기 (secondary 44px) */}
        <button
          onClick={onLobby}
          style={{
            width: '100%',
            height: 44,
            background: 'transparent',
            border: '1px solid var(--border-gold)',
            color: 'var(--gold)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          로비로 돌아가기
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// SectionDivider 헬퍼
// ────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }): React.ReactElement {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      position: 'relative',
      zIndex: 1,
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.5 }} />
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-muted)',
        letterSpacing: '0.1em',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.5 }} />
    </div>
  )
}
