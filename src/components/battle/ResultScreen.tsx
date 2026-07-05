/**
 * ResultScreen — 승패 화면 오버레이 (M6 GSAP 개선)
 * 리라 스펙 §8
 * 승리: 금빛 파티클 + 텍스트 scale up
 * 패배: 화면 shake + vignette
 */

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { GameResult } from '@/types/game'
import type { PlayerState } from '@/types/game'
import { DOMINATES } from '@/types/elements'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// 카피 (스펙 §8-2, §8-3)
// ────────────────────────────────────────────────────

const WIN_COPY: Record<FiveElement, string> = {
  '木': '청룡이 강호를 평정했습니다. (사실 책이 많아서)',
  '火': '불검의 화염이 적을 불태웠습니다. 피해도 좀 있지만...',
  '土': '황장군은 오늘도 지지 않았습니다. 이겼습니다.',
  '金': '백사형이 조용히 처리했습니다. 말 없이.',
  '水': '흑선인의 콤보가 완성됐습니다. 본인도 놀랐을 겁니다.',
}

const LOSE_COPY: Record<FiveElement, string> = {
  '木': '청룡이... 꺾였습니다. 책이 더 필요한 것 같습니다.',
  '火': '불검이 먼저 꺼졌습니다. 너무 뜨거웠나요.',
  '土': '황장군도 결국 무너졌습니다. 산도 흔들릴 때가 있습니다.',
  '金': '백사형도 이번엔 패했습니다. 무기값 청구서는 어디에...',
  '水': '흑선인의 콤보가... 터지지 않았습니다. 물이 막혔나요.',
}

// ────────────────────────────────────────────────────
// GSAP 금빛 파티클 (승리)
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
          }}
        />
      ))}
    </>
  )
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface ResultScreenProps {
  result: Exclude<GameResult, null>
  player: PlayerState
  ai: PlayerState
  turn: number
  playerKillCount: number
  onRetry: () => void
  onHome: () => void
}

export default function ResultScreen({
  result,
  player,
  ai,
  turn,
  playerKillCount,
  onRetry,
  onHome,
}: ResultScreenProps): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const isWin = result === 'player_win'
  const isDraw = result === 'draw'
  const playerElement = player.hero.element

  const dominatedBy = Object.entries(DOMINATES).find(
    ([, target]) => target === playerElement,
  )?.[0] as FiveElement | undefined

  useEffect(() => {
    const card = cardRef.current
    const overlay = overlayRef.current
    if (!card || !overlay) return

    if (isWin) {
      // 승리: 배경 페이드인 + 카드 scale up
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.4 })
      gsap.fromTo(card,
        { scale: 0.75, opacity: 0, rotate: -3 },
        { scale: 1, opacity: 1, rotate: 0, duration: 0.55, ease: 'back.out(1.5)', delay: 0.15 },
      )
    } else if (!isDraw) {
      // 패배: 배경 페이드인 + 화면 shake
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3 })
      const tl = gsap.timeline({ delay: 0.15 })
      tl.fromTo(card, { scale: 1.05, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' })
        .to(card, { x: -8, duration: 0.06, ease: 'none' })
        .to(card, { x: 8, duration: 0.06, repeat: 3, yoyo: true, ease: 'none' })
        .to(card, { x: 0, duration: 0.06 })
    } else {
      // 무승부
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.4 })
      gsap.fromTo(card,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out', delay: 0.2 },
      )
    }
  }, [isWin, isDraw])

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        backdropFilter: 'blur(4px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
      }}
    >
      {isWin && <GoldParticles />}

      {/* 패배 vignette */}
      {!isWin && !isDraw && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(139,0,0,0.15) 100%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* 결과 카드 */}
      <div
        ref={cardRef}
        className="pj-certificate-frame"
        style={{
          background: 'var(--surface)',
          border: isWin ? '1px solid var(--border-gold)' : '1px solid var(--border)',
          width: 'min(320px, 90vw)',
          padding: '32px 24px',
          boxShadow: isWin
            ? '0 16px 48px rgba(201,168,76,0.20)'
            : '0 16px 48px rgba(44,44,44,0.25)',
          textAlign: 'center',
          opacity: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* 승패 한자 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 72,
          marginBottom: 8,
          color: isWin ? 'var(--gold)' : isDraw ? 'var(--text-secondary)' : 'var(--accent-red)',
          filter: isWin
            ? 'drop-shadow(0 0 16px rgba(201,168,76,0.6))'
            : !isDraw ? 'drop-shadow(0 0 10px rgba(139,0,0,0.5))' : 'none',
          lineHeight: 1,
        }}>
          {isWin ? '勝' : isDraw ? '和' : '敗'}
        </div>

        {/* 제목 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 20,
          color: isWin ? 'var(--gold)' : isDraw ? 'var(--text-secondary)' : 'var(--text-headline)',
          marginBottom: 6,
        }}>
          {isWin ? '역시 팔자가 좋았군요' : isDraw ? '팽팽했습니다!' : '팔자가 사나우셨네요'}
        </div>

        {/* 부제 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 8,
          letterSpacing: '0.05em',
        }}>
          {isWin
            ? '운명이 당신의 편이었습니다'
            : isDraw
            ? '둘 다 쓰러졌네요.'
            : '오늘은 운이 없었을 뿐...'}
        </div>

        {/* 유머 카피 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 16,
          lineHeight: 1.6,
        }}>
          {isWin ? WIN_COPY[playerElement] : isDraw ? '' : LOSE_COPY[playerElement]}
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 12 }} />

        {/* 전투 요약 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginBottom: 16,
          textAlign: 'left',
        }}>
          <div>턴: <span style={{ color: 'var(--gold)' }}>{turn}</span></div>
          <div>처치한 적 유닛: <span style={{ color: 'var(--gold)' }}>{playerKillCount}</span></div>
          {isWin && (
            <>
              <div>받은 피해: <span style={{ color: 'var(--el-fire)' }}>{30 - player.currentHp}</span></div>
              <div>남은 HP: <span style={{ color: 'var(--el-wood)' }}>{player.currentHp}</span></div>
            </>
          )}
          {!isWin && !isDraw && (
            <div>적 영웅 남은 HP: <span style={{ color: 'var(--el-earth)' }}>{ai.currentHp}</span></div>
          )}
        </div>

        {/* 패배 시 힌트 */}
        {!isWin && !isDraw && dominatedBy && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 16,
            padding: '8px',
            background: 'rgba(44,44,44,0.06)',
            border: '1px solid var(--border)',
          }}>
            상극을 노려보세요: {playerElement}은(는) {DOMINATES[playerElement]}에 강합니다
          </div>
        )}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              height: 44,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            다시 도전
          </button>
          <button
            onClick={onHome}
            style={{
              flex: 1,
              height: 44,
              border: '1px solid var(--gold-primary)',
              background: 'transparent',
              color: 'var(--gold)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            {isWin ? '카드 선택하기' : '홈으로'}
          </button>
        </div>
      </div>
    </div>
  )
}
