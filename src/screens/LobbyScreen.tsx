/**
 * LobbyScreen — PvP 로비 화면
 * 리라 스펙 §신규 화면 1 — LobbyScreen
 * AppScene: 'pvpLobby'
 */

import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { usePvPStore } from '@/stores/pvpStore'
import { pvpClient } from '@/services/pvpClient'
import { useOnboardingStore } from '@/game/store/onboardingStore'
import { useUnlockStore } from '@/stores/unlockStore'

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface LobbyScreenProps {
  onBack: () => void
  onStartMatching: () => void
  onDeckBuild: () => void
}

// ────────────────────────────────────────────────────
// 오행별 랭크 컬러
// ────────────────────────────────────────────────────

const RANK_COLOR: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#FFD700',
  Platinum: '#00CFCF',
  Diamond: '#9B59B6',
  Master: '#E8C84A',
}

function getRankColor(rank: string): string {
  const tier = rank.split(' ')[0]
  return RANK_COLOR[tier] ?? '#C9A84C'
}

// ────────────────────────────────────────────────────
// LobbyScreen
// ────────────────────────────────────────────────────

export default function LobbyScreen({
  onBack,
  onStartMatching,
  onDeckBuild,
}: LobbyScreenProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const { myRank, myElo, myWins, myLosses, waitingCount } = usePvPStore()
  const [matchBtnScale, setMatchBtnScale] = useState(1)
  const [isConnecting, setIsConnecting] = useState(false)

  const onboardingResult = useOnboardingStore(s => s.onboardingResult)

  const winRate = myWins + myLosses > 0
    ? Math.round((myWins / (myWins + myLosses)) * 100)
    : 0

  // 진입 애니메이션 (리라 스펙: fade-in 0.3s, 프로필 translateY 0.25s delay 0.1s)
  useEffect(() => {
    const container = containerRef.current
    const profile = profileRef.current
    if (!container || !profile) return

    gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
    gsap.fromTo(profile,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', delay: 0.1 },
    )
  }, [])

  // 목 대기자 수 폴링 (30초 간격)
  useEffect(() => {
    const poll = setInterval(() => {
      // Phase 4 MVP: Math.random() 기반 모의값
      usePvPStore.getState().setMatchStatus('idle')
    }, 30000)
    return () => clearInterval(poll)
  }, [])

  async function handleMatchClick(): Promise<void> {
    setMatchBtnScale(0.97)
    setTimeout(() => setMatchBtnScale(1), 50)

    setIsConnecting(true)

    // userId: onboarding 결과에서 가져오거나 임시 UUID 생성
    // OnboardingResult에는 name 필드 없음 — birthYear/primaryElement 조합으로 식별
    const userId = onboardingResult
      ? `user_${onboardingResult.primaryElement}_${onboardingResult.birthYear}_${Date.now()}`
      : `guest_${Date.now()}`

    // heroId: 플레이어 오행 기반
    const elementToHeroId: Record<string, string> = {
      '木': 'wood_hero',
      '火': 'fire_hero',
      '土': 'earth_hero',
      '金': 'metal_hero',
      '水': 'water_hero',
    }
    const playerElement = onboardingResult?.primaryElement ?? '火'
    const heroId = elementToHeroId[playerElement] ?? 'fire_hero'

    // 덱 카드 ID 목록
    const currentDeck = useUnlockStore.getState().getCurrentDeck()
    const deckIds = currentDeck.length > 0
      ? currentDeck.map(c => c.id)
      : []

    try {
      // 서버 연결 시도
      await pvpClient.connect(userId)
      usePvPStore.getState().setIsServerConnected(true)
      usePvPStore.getState().addPvPLog('[서버] WebSocket 연결 완료')
    } catch {
      // 서버 미연결: 목 모드로 fallback
      console.warn('[LobbyScreen] 서버 연결 실패. 목 모드로 진행합니다.')
      usePvPStore.getState().setIsServerConnected(false)
      usePvPStore.getState().addPvPLog('[목 모드] 서버 미연결. 로컬 목 데이터로 진행합니다.')
    }

    if (usePvPStore.getState().isServerConnected) {
      // 서버 연결 성공: 매칭 등록
      await pvpClient.joinMatchmaking(heroId, deckIds).catch(err => {
        console.error('[LobbyScreen] joinMatchmaking 실패:', err)
      })
    }

    setIsConnecting(false)
    onStartMatching()
  }

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
        opacity: 0,
      }}
    >
      {/* 헤더 48px */}
      <header style={{
        height: 48,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          aria-label="뒤로 가기"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            padding: '4px 8px',
            letterSpacing: '0.05em',
          }}
        >
          뒤로
        </button>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 18,
          color: 'var(--gold)',
          flex: 1,
          textAlign: 'center',
          letterSpacing: '0.05em',
        }}>
          운명카드전
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          letterSpacing: '0.03em',
        }}>
          PvP 대전
        </span>
      </header>

      {/* 컨텐츠 스크롤 영역 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}>

        {/* 내 프로필 카드 120px */}
        <div
          ref={profileRef}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-gold)',
            padding: 16,
            opacity: 0,
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 10,
          }}>
            {/* 영웅 아이콘 영역 */}
            <div style={{
              width: 48,
              height: 48,
              background: 'rgba(201,168,76,0.1)',
              border: '1px solid var(--border-gold)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 22,
            }}>
              ⚔
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 16,
                color: 'var(--text-headline)',
                marginBottom: 4,
              }}>
                청룡
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: getRankColor(myRank),
                letterSpacing: '0.03em',
              }}>
                Rank: {myRank}
              </div>
            </div>
          </div>

          {/* 전적 */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            letterSpacing: '0.03em',
          }}>
            승률: {winRate}% ({myWins}승 {myLosses}패)
            <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: 11 }}>
              ELO {myElo}
            </span>
          </div>
        </div>

        {/* 대기 현황 divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-gold)', opacity: 0.4 }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}>
            대기 현황
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-gold)', opacity: 0.4 }} />
        </div>

        {/* 현재 대기자 수 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          letterSpacing: '0.03em',
        }}>
          현재 대기 중: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{waitingCount}명</span>
        </div>

        {/* PvP 매칭 찾기 CTA 버튼 56px */}
        <button
          onClick={() => { void handleMatchClick() }}
          disabled={isConnecting}
          style={{
            width: '100%',
            height: 56,
            background: isConnecting
              ? 'linear-gradient(135deg, #8a7030, #605020)'
              : 'linear-gradient(135deg, #C9A84C, #A0822C)',
            border: '1px solid rgba(201,168,76,0.8)',
            color: '#1A1410',
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            transition: 'filter 0.15s',
            transform: `scale(${matchBtnScale})`,
            boxShadow: '0 2px 8px rgba(201,168,76,0.3)',
            opacity: isConnecting ? 0.75 : 1,
          }}
          onMouseEnter={e => { if (!isConnecting) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none' }}
        >
          {isConnecting ? '연결 중...' : 'PvP 매칭 찾기'}
        </button>

        {/* 덱 편집 secondary 버튼 44px */}
        <button
          onClick={onDeckBuild}
          style={{
            width: '100%',
            height: 44,
            background: 'transparent',
            border: '1px solid var(--border-gold)',
            color: 'var(--gold)',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.08)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          덱 편집
        </button>

        {/* 비활성 링크 (Phase 4 MVP 외) */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          marginTop: 4,
        }}>
          {['랭킹 보기', '시즌 안내'].map(label => (
            <span
              key={label}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-muted)',
                letterSpacing: '0.03em',
                pointerEvents: 'none',
                opacity: 0.5,
              }}
            >
              {label}
            </span>
          ))}
        </div>

      </div>
    </div>
  )
}
