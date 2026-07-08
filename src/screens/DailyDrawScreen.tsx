/**
 * DailyDrawScreen — 일일 카드 뽑기 화면 (M8 P1)
 * 리라 M8 P1 지시 스펙 §1 기반
 *
 * - 뽑기 연출: 카드 3장 뒤집기 → 탭하면 앞면 공개
 * - 등급별 이펙트: common=없음, rare=파란빛, epic=보라빛, legendary=금빛폭발
 * - 매일 3장 무료 (localStorage lastDrawDate 기반)
 * - 뽑은 카드: 덱에 추가 vs 넘기기 선택
 * - GSAP 뒤집기 애니메이션
 */

import React, { useEffect, useRef, useCallback, useState } from 'react'
import { useDailyDraw } from '@/game/hooks/useDailyDraw'
import type { DrawnCardState } from '@/game/hooks/useDailyDraw'
import type { Card, Rarity } from '@/types/cards'
import { useUnlockStore } from '@/stores/unlockStore'
import CardArtSVG, { getRarityBorderStyle, LegendaryCorners } from '@/components/battle/CardArtSVG'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'
import gsap from 'gsap'

// ─────────────────────────────────────────────────────
// 스타일 주입
// ─────────────────────────────────────────────────────

const STYLE_ID = 'daily-draw-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes dailyDrawFadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes rareGlow {
      0%, 100% { box-shadow: 0 0 10px rgba(100,180,255,0.5), 0 0 20px rgba(100,180,255,0.25); }
      50%       { box-shadow: 0 0 18px rgba(100,180,255,0.8), 0 0 36px rgba(100,180,255,0.4); }
    }
    @keyframes legendaryBurst {
      0%   { box-shadow: 0 0 20px rgba(201,168,76,0.6), 0 0 40px rgba(201,168,76,0.3); }
      50%  { box-shadow: 0 0 40px rgba(201,168,76,0.9), 0 0 80px rgba(201,168,76,0.5); }
      100% { box-shadow: 0 0 20px rgba(201,168,76,0.6), 0 0 40px rgba(201,168,76,0.3); }
    }
    @keyframes cardFlipBack {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
    @keyframes cardFlipFront {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    .card-flip-wrapper {
      perspective: 600px;
    }
    @keyframes particleBurst {
      0%   { transform: translate(0,0) scale(1); opacity: 1; }
      100% { opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────
// 등급별 이펙트 스타일
// ─────────────────────────────────────────────────────

function getRarityGlowStyle(rarity: Rarity): React.CSSProperties {
  switch (rarity) {
    case 'uncommon':
      return {
        animation: 'rareGlow 2s ease-in-out infinite',
        boxShadow: '0 0 10px rgba(100,180,255,0.5), 0 0 20px rgba(100,180,255,0.25)',
      }
    case 'rare':
      return {
        animation: 'rareGlow 1.5s ease-in-out infinite',
        boxShadow: '0 0 14px rgba(100,130,255,0.7), 0 0 28px rgba(100,130,255,0.35)',
      }
    case 'legendary':
      return {
        animation: 'legendaryBurst 1.2s ease-in-out infinite',
        boxShadow: '0 0 20px rgba(201,168,76,0.6), 0 0 40px rgba(201,168,76,0.3)',
      }
    default:
      return {}
  }
}

function getRarityLabel(rarity: Rarity): string {
  switch (rarity) {
    case 'common':    return '평범'
    case 'uncommon':  return '별호'
    case 'rare':      return '고수'
    case 'epic':      return '영웅'
    case 'legendary': return '전설'
    case 'celestial': return '천상'
  }
}

function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'common':    return 'rgba(160,152,128,0.9)'
    case 'uncommon':  return 'rgba(120,160,220,0.9)'
    case 'rare':      return 'rgba(120,130,255,0.95)'
    case 'epic':      return 'rgba(100,150,255,0.95)'
    case 'legendary': return '#E8C547'
    case 'celestial': return '#FFD700'
  }
}

// ─────────────────────────────────────────────────────
// 파티클 연출 (legendary 전용)
// ─────────────────────────────────────────────────────

function emitLegendaryParticles(containerEl: HTMLElement) {
  const rect = containerEl.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  for (let i = 0; i < 12; i++) {
    const el = document.createElement('div')
    el.style.cssText = `
      position:fixed;
      width:5px;height:5px;
      border-radius:50%;
      background:#E8C547;
      pointer-events:none;
      left:${cx}px;top:${cy}px;
      z-index:300;
    `
    document.body.appendChild(el)

    const angle = (i / 12) * Math.PI * 2
    const dist = 60 + Math.random() * 60
    gsap.to(el, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      opacity: 0,
      duration: 0.6 + Math.random() * 0.4,
      ease: 'power2.out',
      onComplete: () => el.remove(),
    })
  }
}

// ─────────────────────────────────────────────────────
// 카드 뒷면 컴포넌트
// ─────────────────────────────────────────────────────

function CardBack(): React.ReactElement {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1a1410, #2a2018)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid rgba(201,168,76,0.3)',
    }}>
      {/* 팔자패 문양 */}
      <svg width="64" height="80" viewBox="0 0 64 80">
        <defs>
          <linearGradient id="back-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(201,168,76,0.5)" />
            <stop offset="100%" stopColor="rgba(201,168,76,0.1)" />
          </linearGradient>
        </defs>
        {/* 팔괘 원형 */}
        <circle cx="32" cy="40" r="24" fill="none" stroke="url(#back-grad)" strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="32" cy="40" r="16" fill="none" stroke="url(#back-grad)" strokeWidth="1" strokeOpacity="0.4" />
        {/* 음양 분리선 */}
        <path d="M32 16 A16 16 0 0 1 32 56 A8 8 0 0 0 32 40 A8 8 0 0 1 32 24 A16 16 0 0 1 32 56" fill="rgba(201,168,76,0.08)" />
        {/* 팔 */}
        {[0,1,2,3,4,5,6,7].map(i => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2
          const x1 = 32 + Math.cos(a) * 26
          const y1 = 40 + Math.sin(a) * 26
          const x2 = 32 + Math.cos(a) * 30
          const y2 = 40 + Math.sin(a) * 30
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(201,168,76,0.4)" strokeWidth="1.5" />
        })}
        {/* 중앙 한자 牌 */}
        <text x="32" y="45" textAnchor="middle" fill="rgba(201,168,76,0.5)" fontSize="14" fontFamily="serif">牌</text>
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 개별 뽑기 카드 컴포넌트
// ─────────────────────────────────────────────────────

interface DrawCardItemProps {
  dc: DrawnCardState
  idx: number
  isCurrent: boolean
  onReveal: (idx: number) => void
  onKeep: (idx: number) => void
  onSkip: (idx: number) => void
  containerRef: React.RefObject<HTMLDivElement>
}

function DrawCardItem({
  dc,
  idx,
  isCurrent,
  onReveal,
  onKeep,
  onSkip,
  containerRef,
}: DrawCardItemProps): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  const card = dc.card
  const element = card.element as FiveElement | null
  const display = element ? ELEMENT_DISPLAY[element] : null
  const rarityStyle = getRarityBorderStyle(card.rarity)

  // COST_ORB_GRADIENT 인라인 정의
  const COST_ORB_GRADIENT: Record<FiveElement, string> = {
    '木': 'radial-gradient(circle at 35% 35%, #7EC87A, #2E6B2A)',
    '火': 'radial-gradient(circle at 35% 35%, #FF8C5A, #C4400A)',
    '土': 'radial-gradient(circle at 35% 35%, #F0C84A, #A07820)',
    '金': 'radial-gradient(circle at 35% 35%, #C8E4F8, #5A8AB8)',
    '水': 'radial-gradient(circle at 35% 35%, #64C8F8, #1A5A9A)',
  }

  const handleReveal = useCallback(() => {
    if (dc.revealed || !isCurrent) return
    if (!backRef.current || !frontRef.current) {
      onReveal(idx)
      return
    }

    // GSAP 카드 뒤집기 — 뒷면 scaleX 1→0, 앞면 scaleX 0→1
    const tl = gsap.timeline()
    tl.to(backRef.current, {
      scaleX: 0,
      duration: 0.2,
      ease: 'power1.in',
    })
    tl.call(() => { onReveal(idx) })
    tl.from(frontRef.current, {
      scaleX: 0,
      duration: 0.2,
      ease: 'power1.out',
    })

    // legendary 파티클
    if (card.rarity === 'legendary' && containerRef.current) {
      tl.call(() => {
        if (cardRef.current) emitLegendaryParticles(cardRef.current)
      }, [], '+=0.1')
    }
  }, [dc.revealed, isCurrent, idx, card.rarity, onReveal, containerRef])

  return (
    <div
      ref={cardRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        opacity: !dc.revealed && !isCurrent ? 0.5 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      {/* 카드 본체 */}
      <div
        className="card-flip-wrapper"
        style={{
          width: 110,
          height: 160,
          cursor: !dc.revealed && isCurrent ? 'pointer' : 'default',
          position: 'relative',
        }}
        onClick={handleReveal}
        aria-label={dc.revealed ? card.name : '카드 탭하여 공개'}
      >
        {/* 뒷면 */}
        <div
          ref={backRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: dc.revealed ? 'none' : 'block',
            transformOrigin: 'center',
          }}
        >
          <CardBack />
        </div>

        {/* 앞면 */}
        <div
          ref={frontRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: dc.revealed ? 'flex' : 'none',
            flexDirection: 'column',
            background: 'var(--surface)',
            overflow: 'hidden',
            transformOrigin: 'center',
            ...rarityStyle,
            ...(dc.revealed ? getRarityGlowStyle(card.rarity) : {}),
          }}
        >
          {/* 헤더 */}
          <div style={{
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 6px',
            flexShrink: 0,
          }}>
            <div style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: element ? COST_ORB_GRADIENT[element] : 'radial-gradient(circle at 35% 35%, #C9A84C, #7A5A20)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 12,
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              flexShrink: 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              position: 'relative',
            }}>
              {card.cost}
              <div style={{
                position: 'absolute', top: 3, left: 3,
                width: 5, height: 5,
                borderRadius: '50%',
                background: 'white', opacity: 0.45,
                pointerEvents: 'none',
              }} />
            </div>
            {display && (
              <span style={{ fontSize: 14, color: display.color }}>
                {display.icon}
              </span>
            )}
          </div>

          {/* 아트 영역 */}
          <div style={{ height: 80, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
            {element ? (
              <CardArtSVG element={element} rarity={card.rarity} size="mini" cardType={card.cardType as 'soldier' | 'spell'} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(212,175,90,0.08), rgba(0,0,0,0))',
              }}>
                <span style={{ fontSize: 32 }}>✨</span>
              </div>
            )}
          </div>

          {/* 카드명 */}
          <div style={{
            padding: '4px 6px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 11,
            color: 'var(--text-headline)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.15)',
          }}>
            {card.name.split(' ')[0]}
          </div>

          {/* 등급 배지 */}
          <div style={{
            padding: '2px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.25)',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: getRarityColor(card.rarity),
              fontWeight: card.rarity === 'legendary' ? 700 : 400,
            }}>
              {getRarityLabel(card.rarity)}
            </span>
            {(card.cardType === 'soldier' || card.cardType === 'commander') && 'attack' in card && (
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #FF6B6B, #8B1A1A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'white',
                }}>
                  {card.attack}
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #64D8A0, #1A6B3A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'white',
                }}>
                  {card.maxHealth}
                </div>
              </div>
            )}
          </div>

          {/* Legendary 코너 장식 */}
          {card.rarity === 'legendary' && element && (
            <LegendaryCorners element={element} />
          )}
        </div>

        {/* 미공개 힌트 */}
        {!dc.revealed && isCurrent && (
          <div style={{
            position: 'absolute',
            bottom: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--gold)',
            whiteSpace: 'nowrap',
            animation: 'dailyDrawFadeIn 0.5s ease-out',
          }}>
            탭하여 공개
          </div>
        )}
      </div>

      {/* 선택 버튼 — 카드 공개 후 표시 */}
      {dc.revealed && dc.kept === null && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 28,
          animation: 'dailyDrawFadeIn 0.3s ease-out',
        }}>
          <button
            onClick={() => onKeep(idx)}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, var(--gold), #A0822C)',
              color: '#1A1410',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            덱에 추가
          </button>
          <button
            onClick={() => onSkip(idx)}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            넘기기
          </button>
        </div>
      )}

      {/* 결정 결과 표시 */}
      {dc.revealed && dc.kept !== null && (
        <div style={{
          marginTop: 28,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: dc.kept ? 'var(--gold)' : 'var(--text-muted)',
          animation: 'dailyDrawFadeIn 0.3s ease-out',
        }}>
          {dc.kept ? '덱에 추가됨' : '넘김'}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// DailyDrawScreen 메인
// ─────────────────────────────────────────────────────

interface DailyDrawScreenProps {
  onComplete: (keptCards: Card[]) => void
  onSkip: () => void
}

export default function DailyDrawScreen({
  onComplete,
  onSkip,
}: DailyDrawScreenProps): React.ReactElement {
  const {
    canDraw,
    drawnCards,
    currentRevealIdx,
    isComplete,
    draw,
    revealCard,
    keepCard,
    skipCard,
  } = useDailyDraw()

  const addOwnedCards = useUnlockStore(s => s.addOwnedCards)
  const containerRef = useRef<HTMLDivElement>(null!)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    injectStyles()
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  // 완료 처리 — 보관 결정된 카드 덱에 반영
  useEffect(() => {
    if (!isComplete) return
    const keptCards = drawnCards
      .filter(dc => dc.kept === true)
      .map(dc => dc.card)

    if (keptCards.length > 0) {
      try {
        addOwnedCards(keptCards.map(c => c.id))
      } catch {
        // unlockStore 오류 무시
      }
    }
  }, [isComplete, drawnCards, addOwnedCards])

  const handleFinalComplete = () => {
    const keptCards = drawnCards.filter(dc => dc.kept === true).map(dc => dc.card)
    onComplete(keptCards)
  }

  // 헤더 영역
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
      opacity: mounted ? 1 : 0,
      transition: 'opacity 0.25s ease-out',
    }}>
      {/* 헤더 */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 16,
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg2)',
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 18,
          color: 'var(--gold)',
          letterSpacing: '0.05em',
        }}>
          일일 뽑기
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          {dateStr}
        </span>
      </header>

      {/* 메인 영역 */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 24px',
          overflowY: 'auto',
        }}
      >
        {/* 뽑기 전 상태 */}
        {drawnCards.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            animation: 'dailyDrawFadeIn 0.4s ease-out',
          }}>
            {/* 오행 장식 원 */}
            <div style={{
              width: 120,
              height: 120,
              border: '2px solid var(--border-gold)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                width: 90,
                height: 90,
                border: '1px solid rgba(201,168,76,0.3)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 36,
                  color: 'var(--gold)',
                  opacity: 0.8,
                }}>
                  牌
                </span>
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 20,
                color: 'var(--text-headline)',
              }}>
                {canDraw ? '오늘의 패 (牌)' : '오늘의 뽑기를 완료했습니다'}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}>
                {canDraw
                  ? '매일 3장의 카드를 무료로 뽑을 수 있습니다.\n원하는 카드를 덱에 추가하세요.'
                  : '내일 다시 3장의 카드를 뽑을 수 있습니다.'
                }
              </div>
            </div>

            {canDraw && (
              <button
                onClick={draw}
                style={{
                  width: 200,
                  height: 52,
                  background: 'linear-gradient(135deg, var(--gold), #A0822C)',
                  color: '#1A1410',
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 16,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  boxShadow: '0 4px 16px rgba(201,168,76,0.3)',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(201,168,76,0.45)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(201,168,76,0.3)'
                }}
              >
                뽑기 시작
              </button>
            )}

            <button
              onClick={onSkip}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                border: 'none',
                cursor: 'pointer',
                padding: '8px 16px',
              }}
            >
              건너뛰기
            </button>
          </div>
        )}

        {/* 뽑기 진행 중 */}
        {drawnCards.length > 0 && !isComplete && (
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 32,
          }}>
            {/* 진행 상황 */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}>
              {drawnCards.filter(dc => dc.kept !== null).length} / {drawnCards.length} 결정
            </div>

            {/* 카드 3장 가로 배치 */}
            <div style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}>
              {drawnCards.map((dc, idx) => (
                <DrawCardItem
                  key={idx}
                  dc={dc}
                  idx={idx}
                  isCurrent={idx === currentRevealIdx && !dc.revealed}
                  onReveal={revealCard}
                  onKeep={keepCard}
                  onSkip={skipCard}
                  containerRef={containerRef}
                />
              ))}
            </div>
          </div>
        )}

        {/* 뽑기 완료 */}
        {isComplete && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            animation: 'dailyDrawFadeIn 0.4s ease-out',
          }}>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 22,
              color: 'var(--gold)',
            }}>
              뽑기 완료!
            </div>

            {/* 요약 */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-gold)',
              padding: '16px 24px',
              width: '100%',
              maxWidth: 320,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 12,
              }}>
                결과 요약
              </div>
              {drawnCards.map((dc, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: 36,
                  borderBottom: idx < drawnCards.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}>
                    {dc.card.name.split(' ')[0]}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: dc.kept ? 'var(--gold)' : 'var(--text-muted)',
                  }}>
                    {dc.kept ? '덱 추가' : '넘김'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleFinalComplete}
              style={{
                width: 200,
                height: 48,
                background: 'linear-gradient(135deg, var(--gold), #A0822C)',
                color: '#1A1410',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 15,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.03em',
              }}
            >
              월드맵으로
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
