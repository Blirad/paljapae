/**
 * YourTurnWaitScreen — 상대 턴 대기 화면
 * 리라 스펙 §신규 화면 4 — YourTurnWaitScreen
 * AppScene: 'pvpWaiting'
 * 상대 진행 로그 + 경량 UI
 */

import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { usePvPStore } from '@/stores/pvpStore'
import HeroPortraitSVG from '@/components/battle/HeroPortraitSVG'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// LoadingDots
// ────────────────────────────────────────────────────

function LoadingDots(): React.ReactElement {
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]

  useEffect(() => {
    refs.forEach((ref, i) => {
      if (!ref.current) return
      gsap.fromTo(ref.current,
        { opacity: 0.2 },
        {
          opacity: 1,
          duration: 0.4,
          yoyo: true,
          repeat: -1,
          delay: i * 0.4,
          ease: 'power1.inOut',
        },
      )
    })
  }, [])

  const dotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--text-muted)',
    opacity: 0.2,
  }

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center' }}>
      <div ref={refs[0]} style={dotStyle} />
      <div ref={refs[1]} style={dotStyle} />
      <div ref={refs[2]} style={dotStyle} />
    </div>
  )
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface YourTurnWaitScreenProps {
  onMyTurnStart: () => void  // 내 턴으로 전환 시 → pvpBattle
}

// ────────────────────────────────────────────────────
// YourTurnWaitScreen
// ────────────────────────────────────────────────────

export default function YourTurnWaitScreen({ onMyTurnStart }: YourTurnWaitScreenProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const portraitRef = useRef<HTMLDivElement>(null)
  const myTurnMsgRef = useRef<HTMLDivElement>(null)

  const pvpStore = usePvPStore()
  const opponent = pvpStore.opponent

  // 상대 턴 타이머 (로컬 카운트다운)
  const [opponentTimer, setOpponentTimer] = useState(60)
  const [myTurnDisplayed, setMyTurnDisplayed] = useState(false)

  // 로그 최대 5줄
  const recentLogs = pvpStore.pvpLog
    .filter(l => l.startsWith('[상대]'))
    .slice(0, 5)

  // 진입 애니메이션
  useEffect(() => {
    const container = containerRef.current
    const portrait = portraitRef.current
    if (!container || !portrait) return

    gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
    gsap.fromTo(portrait,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', delay: 0.1 },
    )
  }, [])

  // 상대 턴 카운트다운
  useEffect(() => {
    const timer = setInterval(() => {
      setOpponentTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // pvpStore isMyTurn 감시 → 내 턴 전환
  useEffect(() => {
    if (pvpStore.isMyTurn && !myTurnDisplayed) {
      setMyTurnDisplayed(true)

      // 내 차례입니다! 애니메이션
      if (myTurnMsgRef.current) {
        gsap.fromTo(myTurnMsgRef.current,
          { scale: 0.9, opacity: 0 },
          {
            scale: 1.05,
            opacity: 1,
            duration: 0.2,
            ease: 'back.out(1.5)',
            onComplete: () => {
              gsap.to(myTurnMsgRef.current, {
                scale: 1,
                duration: 0.1,
              })
            },
          },
        )
      }

      // 1초 후 pvpBattle로 복귀
      setTimeout(() => {
        onMyTurnStart()
      }, 1000)
    }
  }, [pvpStore.isMyTurn, myTurnDisplayed, onMyTurnStart])

  const timerColor = opponentTimer <= 10 ? '#EF4444' : 'var(--text-secondary)'
  const heroElement: FiveElement = opponent?.heroElement ?? '火'

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 480,
        margin: '0 auto',
        padding: '40px 20px 20px',
        opacity: 0,
      }}
    >
      {/* 내 차례 전환 메시지 (오버레이) */}
      {myTurnDisplayed && (
        <div
          ref={myTurnMsgRef}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            opacity: 0,
          }}
        >
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 28,
            color: 'var(--gold)',
            letterSpacing: '0.05em',
          }}>
            내 차례입니다!
          </div>
        </div>
      )}

      {/* 메인 타이틀 */}
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 20,
        color: 'var(--text-headline)',
        marginBottom: 24,
        letterSpacing: '0.05em',
      }}>
        상대방 차례
      </div>

      {/* 상대 영웅 초상화 + 정보 */}
      <div
        ref={portraitRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          marginBottom: 28,
          opacity: 0,
        }}
      >
        <HeroPortraitSVG
          element={heroElement}
          currentHp={opponent?.currentHp ?? 30}
          maxHp={30}
          size={80}
        />
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          letterSpacing: '0.03em',
        }}>
          {opponent?.nickname ?? '대전 상대'} / {opponent?.rank ?? 'Unranked'}
        </div>
      </div>

      {/* 진행 로그 섹션 */}
      <div style={{
        width: '100%',
        marginBottom: 20,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.5 }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
          }}>
            진행 로그
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.5 }} />
        </div>

        {/* 로그 목록 (최대 5줄) */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '10px 12px',
          minHeight: 80,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}>
          {recentLogs.length === 0 ? (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
              animation: 'blink 1.5s ease-in-out infinite',
            }}>
              (상대 행동 대기 중)
            </span>
          ) : (
            recentLogs.map((log, i) => (
              <div
                key={i}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.02em',
                  animation: i === 0 ? 'fadeIn 0.2s ease-out' : 'none',
                }}
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 상대 플레이 중 표시 */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-muted)',
        marginBottom: 12,
        textAlign: 'center',
      }}>
        상대가 카드를 선택 중입니다...
      </div>

      {/* 로딩 점 */}
      <div style={{ marginBottom: 16 }}>
        <LoadingDots />
      </div>

      {/* 상대 턴 타이머 */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: timerColor,
        marginBottom: 28,
        letterSpacing: '0.03em',
        transition: 'color 0.3s',
      }}>
        상대 턴 남은 시간: <strong>{opponentTimer}초</strong>
      </div>

      {/* 구분선 */}
      <div style={{ width: '100%', height: 1, background: 'var(--border)', marginBottom: 16 }} />

      {/* 대기 버튼 (클릭 불가) */}
      <button
        disabled
        style={{
          width: '100%',
          height: 44,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.03em',
          cursor: 'not-allowed',
          marginBottom: 16,
        }}
      >
        내 차례 기다리는 중...
      </button>

      {/* 백그라운드 알림 링크 (Phase 4 MVP: 비활성) */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)',
        letterSpacing: '0.03em',
        pointerEvents: 'none',
        opacity: 0.4,
      }}>
        내 차례에 알림 받기 (선택)
      </span>
    </div>
  )
}
