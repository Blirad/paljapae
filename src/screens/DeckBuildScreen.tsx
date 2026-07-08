/**
 * DeckBuildScreen — 덱 편집 화면 (M8 DeckBuild)
 * 리라 DeckBuild UX 스펙 §1~9 기반
 *
 * 진입: StartScreen → "덱 편집" 버튼
 * 진출: 저장 완료 → onComplete() | 취소 → onCancel()
 *
 * 구현 항목:
 *  - 보유 카드 탭 / 현재 덱 탭 전환
 *  - 오행 필터 + 정렬
 *  - 카드 슬롯 (+ 추가 / - 제거 / 스타터 보호 / 20장 캡)
 *  - 카드 상세 패널 (하단 고정)
 *  - 오행 밸런스 바 (DeckStatus 영역)
 *  - 덱 탭 오행 밸런스 상세 바
 *  - 저장 토스트 + 취소 확인 바텀 시트
 *  - GSAP 애니메이션 (카드 선택/추가/제거/진입)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import gsap from 'gsap'
import { useUnlockStore } from '@/stores/unlockStore'
import CardArtSVG, { getRarityBorderStyle } from '@/components/battle/CardArtSVG'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'
import type { Card, Rarity } from '@/types/cards'
import { isSoldierCard, isSpellCard } from '@/types/cards'
import { ALL_CARDS } from '@/data/cards'
import { saveCurrentDeckIds } from '@/utils/persistence'

// ────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────

const ALL_CARDS_MAP: Map<string, Card> = new Map(ALL_CARDS.map(c => [c.id, c]))

function lookupCard(id: string): Card | undefined {
  if (ALL_CARDS_MAP.has(id)) return ALL_CARDS_MAP.get(id)
  const baseId = id.replace(/_(?:s\d+|ai\d+|[a-z])$/, '')
  return ALL_CARDS_MAP.get(baseId)
}

// ────────────────────────────────────────────────────
// 스타일 주입
// ────────────────────────────────────────────────────

const STYLE_ID = 'deck-build-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes deckBuildFadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes deckBuildToastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes deckBuildSheetIn {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
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
  `
  document.head.appendChild(style)
}

// ────────────────────────────────────────────────────
// 등급 레이블 / 색상
// ────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────
// 오행 필터 타입
// ────────────────────────────────────────────────────

type ElementFilter = FiveElement | 'neutral' | 'all'
type SortOrder = 'cost-asc' | 'cost-desc' | 'name' | 'rarity-desc'

const FILTER_OPTIONS: Array<{ key: ElementFilter; label: string }> = [
  { key: 'all',     label: '전체' },
  { key: '木',      label: '🌿 木' },
  { key: '火',      label: '🔥 火' },
  { key: '土',      label: '🏔 土' },
  { key: '金',      label: '⚔ 金' },
  { key: '水',      label: '💧 水' },
  { key: 'neutral', label: '◈ 중립' },
]

const SORT_OPTIONS: Array<{ key: SortOrder; label: string }> = [
  { key: 'cost-asc',    label: '비용 낮은순' },
  { key: 'cost-desc',   label: '비용 높은순' },
  { key: 'name',        label: '이름순' },
  { key: 'rarity-desc', label: '등급 높은순' },
]

const RARITY_ORDER: Record<Rarity, number> = {
  celestial: 0,
  legendary: 1,
  epic: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
}

function sortCards(cards: Card[], order: SortOrder): Card[] {
  const arr = [...cards]
  switch (order) {
    case 'cost-asc':    return arr.sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
    case 'cost-desc':   return arr.sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
    case 'name':        return arr.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    case 'rarity-desc': return arr.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity])
  }
}

function filterCards(cards: Card[], filter: ElementFilter): Card[] {
  if (filter === 'all') return cards
  if (filter === 'neutral') return cards.filter(c => !c.element || c.element === null)
  return cards.filter(c => c.element === filter)
}

// ────────────────────────────────────────────────────
// 오행 밸런스 계산
// ────────────────────────────────────────────────────

interface ElementCounts {
  木: number
  火: number
  土: number
  金: number
  水: number
  neutral: number
}

function calcElementCounts(deckIds: string[]): ElementCounts {
  const counts: ElementCounts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0, neutral: 0 }
  deckIds.forEach(id => {
    const card = lookupCard(id)
    if (!card) return
    const el = card.element as FiveElement | null | undefined
    if (el && el in counts) {
      counts[el as FiveElement]++
    } else {
      counts.neutral++
    }
  })
  return counts
}

// ────────────────────────────────────────────────────
// DeckStatusBar
// ────────────────────────────────────────────────────

interface DeckStatusBarProps {
  deckCount: number
  elementCounts: ElementCounts
}

function DeckStatusBar({ deckCount, elementCounts }: DeckStatusBarProps): React.ReactElement {
  const total = deckCount || 1

  let deckLabel = `덱: ${deckCount} / 20`
  if (deckCount <= 8)  deckLabel = `덱: ${deckCount} / 20 — 최소 8장`
  if (deckCount >= 20) deckLabel = `덱: 20 / 20 — 가득 참`

  const ELEMENTS: FiveElement[] = ['木', '火', '土', '金', '水']

  return (
    <div style={{
      padding: '8px 16px',
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* 덱 카운터 */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: deckCount >= 20 ? 'var(--gold)' : deckCount <= 8 ? 'var(--el-fire)' : 'var(--text-secondary)',
        marginBottom: 6,
      }}>
        {deckLabel}
      </div>
      {/* 오행 밸런스 바 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        {ELEMENTS.map(el => {
          const count = elementCounts[el]
          const pct = (count / total) * 100
          const info = ELEMENT_DISPLAY[el]
          return (
            <div key={el} style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginBottom: 2,
              }}>
                {info.icon} {count}
              </div>
              <div style={{
                height: 3,
                background: 'var(--border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: info.color,
                  transition: 'width 0.3s ease-out',
                  minWidth: count > 0 ? 2 : 0,
                }} />
              </div>
            </div>
          )
        })}
        {/* 중립 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginBottom: 2,
          }}>
            ◈ {elementCounts.neutral}
          </div>
          <div style={{
            height: 3,
            background: 'var(--border)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(elementCounts.neutral / total) * 100}%`,
              height: '100%',
              background: 'var(--text-muted)',
              transition: 'width 0.3s ease-out',
              minWidth: elementCounts.neutral > 0 ? 2 : 0,
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// ElementBalanceDetail (덱 탭 하단)
// ────────────────────────────────────────────────────

interface ElementBalanceDetailProps {
  elementCounts: ElementCounts
  total: number
}

function ElementBalanceDetail({ elementCounts, total }: ElementBalanceDetailProps): React.ReactElement {
  const ELEMENTS: FiveElement[] = ['木', '火', '土', '金', '水']
  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      marginTop: 8,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-muted)',
        marginBottom: 8,
        letterSpacing: '0.1em',
      }}>
        오행 밸런스
      </div>
      {[...ELEMENTS.map(el => ({
        key: el as string,
        label: el,
        icon: ELEMENT_DISPLAY[el].icon,
        color: ELEMENT_DISPLAY[el].color,
        count: elementCounts[el],
      })), {
        key: 'neutral',
        label: '중립',
        icon: '◈',
        color: 'rgba(160,152,128,0.6)',
        count: elementCounts.neutral,
      }].map(({ key, label, icon, color, count }) => (
        <div key={key} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            width: 32,
            flexShrink: 0,
          }}>
            {icon} {label}
          </div>
          <div style={{
            flex: 1,
            height: 8,
            background: 'var(--border)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(count / (total || 1)) * 100}%`,
              height: '100%',
              background: color,
              opacity: 0.5,
              transition: 'width 0.3s ease-out',
              minWidth: count > 0 ? 4 : 0,
            }} />
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            width: 28,
            textAlign: 'right',
            flexShrink: 0,
          }}>
            {count}장
          </div>
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────
// DeckBuildCardSlot
// ────────────────────────────────────────────────────

interface DeckBuildCardSlotProps {
  card: Card
  deckId: string
  isInDeck: boolean
  isStarter: boolean
  isDeckFull: boolean
  isDeckMin: boolean
  isSelected: boolean
  tab: 'owned' | 'deck'
  index: number
  onSelect: () => void
  onAdd: () => void
  onRemove: () => void
}

function DeckBuildCardSlot({
  card,
  deckId: _deckId,
  isInDeck,
  isStarter,
  isDeckFull,
  isDeckMin,
  isSelected,
  tab,
  index,
  onSelect,
  onAdd,
  onRemove,
}: DeckBuildCardSlotProps): React.ReactElement {
  const slotRef = useRef<HTMLDivElement>(null)

  // 진입 스태거 애니메이션
  useEffect(() => {
    const el = slotRef.current
    if (!el) return
    const delay = Math.min(index, 8) * 0.04
    gsap.fromTo(el,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', delay }
    )
  }, [index])

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation()
    if (isDeckFull || isInDeck) return
    const el = slotRef.current
    if (el) {
      gsap.fromTo(el,
        { scale: 1 },
        { scale: 1.08, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 }
      )
    }
    onAdd()
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    if (isStarter || isDeckMin) return
    const el = slotRef.current
    if (el) {
      gsap.to(el, {
        opacity: 0,
        y: -8,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          onRemove()
          if (el) {
            gsap.set(el, { opacity: 1, y: 0 })
          }
        },
      })
    } else {
      onRemove()
    }
  }

  const rarityBorderStyle = getRarityBorderStyle(card.rarity)
  const elInfo = card.element ? ELEMENT_DISPLAY[card.element as FiveElement] : null
  const bgTint = elInfo
    ? `${elInfo.color}18`
    : 'transparent'

  const selectedStyle: React.CSSProperties = isSelected ? {
    transform: 'scale(1.04)',
    boxShadow: '0 0 12px rgba(201,168,76,0.4)',
    borderColor: 'var(--gold)',
    outline: '1px solid var(--gold)',
  } : {}

  // 보유 탭 배지 결정
  let badge: React.ReactNode = null
  if (tab === 'owned') {
    if (isInDeck) {
      badge = (
        <div style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#3A7A3A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: '#E8DCC4',
          fontFamily: 'var(--font-mono)',
          zIndex: 2,
        }}>✓</div>
      )
    } else {
      badge = (
        <button
          type="button"
          aria-label={`${card.name} 덱에 추가`}
          aria-disabled={isDeckFull ? 'true' : 'false'}
          onClick={handleAdd}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: isDeckFull ? 'var(--border)' : 'var(--gold)',
            border: 'none',
            cursor: isDeckFull ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: isDeckFull ? 'var(--text-muted)' : '#1A1410',
            opacity: isDeckFull ? 0.4 : 1,
            zIndex: 2,
            padding: 0,
          }}
        >+</button>
      )
    }
  } else {
    // 덱 탭 — 스타터 보호 또는 제거 버튼
    if (isStarter) {
      badge = (
        <div style={{
          position: 'absolute',
          top: 4,
          right: 4,
          fontSize: 12,
          opacity: 0.6,
          zIndex: 2,
        }}>🔒</div>
      )
    } else {
      badge = (
        <button
          type="button"
          aria-label={`${card.name} 덱에서 제거`}
          aria-disabled={isDeckMin ? 'true' : 'false'}
          onClick={handleRemove}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: isDeckMin ? 'var(--border)' : 'var(--accent-red)',
            border: 'none',
            cursor: isDeckMin ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: isDeckMin ? 'var(--text-muted)' : '#F2EAD8',
            opacity: isDeckMin ? 0.4 : 1,
            zIndex: 2,
            padding: 0,
            lineHeight: 1,
          }}
        >−</button>
      )
    }
  }

  const cardTypeLabel = card.cardType === 'soldier' ? '병사' : '주문'

  return (
    <div
      ref={slotRef}
      onClick={onSelect}
      style={{
        position: 'relative',
        width: '100%',
        cursor: 'pointer',
        background: 'var(--surface)',
        border: `1px solid var(--border-subtle)`,
        overflow: 'hidden',
        opacity: tab === 'deck' && isStarter ? 0.65 : 1,
        transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
        ...(!isSelected ? { ...rarityBorderStyle } : {}),
        ...selectedStyle,
      }}
    >
      {/* 헤더: 비용 + 오행 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 6px',
        background: bgTint,
        height: 24,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--gold)',
        }}>
          {card.cost ?? 0}
        </span>
        {elInfo && (
          <span style={{ fontSize: 12 }}>{elInfo.icon}</span>
        )}
      </div>

      {/* 카드 아트 */}
      <div style={{ height: 72, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CardArtSVG
          element={card.element ?? '木'}
          rarity={card.rarity}
          size="mini"
          cardType={card.cardType === 'soldier' ? 'soldier' : 'spell'}
        />
      </div>

      {/* 카드명 */}
      <div style={{
        padding: '3px 6px 1px',
        fontFamily: 'var(--font-serif)',
        fontSize: 11,
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {card.name}
      </div>

      {/* 카드 타입 */}
      <div style={{
        padding: '0 6px 3px',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text-muted)',
      }}>
        {cardTypeLabel}
      </div>

      {/* 하단 배지 (공격/체력 or 효과명) */}
      <div style={{
        padding: '3px 6px',
        borderTop: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text-secondary)',
        minHeight: 20,
      }}>
        {isSoldierCard(card)
          ? `⚔${card.attack} ♥${card.maxHealth}`
          : isSpellCard(card)
            ? card.effectText.slice(0, 16)
            : ''}
      </div>

      {/* 등급 표시 (우하단) */}
      <div style={{
        position: 'absolute',
        bottom: 22,
        left: 4,
        fontSize: 8,
        fontFamily: 'var(--font-mono)',
        color: getRarityColor(card.rarity),
        opacity: 0.85,
      }}>
        {getRarityLabel(card.rarity)}
      </div>

      {/* 배지 */}
      {badge}
    </div>
  )
}

// ────────────────────────────────────────────────────
// CardDetailPanel
// ────────────────────────────────────────────────────

interface CardDetailPanelProps {
  card: Card | null
  isInDeck: boolean
  isStarter: boolean
  isDeckFull: boolean
  isDeckMin: boolean
  onAdd: () => void
  onRemove: () => void
}

function CardDetailPanel({
  card,
  isInDeck,
  isStarter,
  isDeckFull,
  isDeckMin,
  onAdd,
  onRemove,
}: CardDetailPanelProps): React.ReactElement {
  if (!card) {
    return (
      <div
        role="region"
        aria-label="선택한 카드 정보"
        style={{
          padding: 16,
          border: '1px dashed var(--border)',
          margin: '0 16px 16px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        카드를 탭하여 상세 정보를 확인하세요
      </div>
    )
  }

  const elInfo = card.element ? ELEMENT_DISPLAY[card.element as FiveElement] : null

  // CTA 버튼 결정
  let ctaLabel = ''
  let ctaStyle: React.CSSProperties = {}
  let ctaDisabled = false

  if (isInDeck) {
    if (isStarter) {
      ctaLabel = '스타터 카드 — 제거 불가'
      ctaStyle = { background: 'var(--border)', color: 'var(--text-muted)', cursor: 'not-allowed' }
      ctaDisabled = true
    } else if (isDeckMin) {
      ctaLabel = '덱 최소 장수 도달 (8장)'
      ctaStyle = { background: 'var(--border)', color: 'var(--text-muted)', cursor: 'not-allowed' }
      ctaDisabled = true
    } else {
      ctaLabel = '덱에서 제거'
      ctaStyle = { background: 'var(--accent-red)', color: '#F2EAD8', cursor: 'pointer' }
    }
  } else {
    if (isDeckFull) {
      ctaLabel = '덱이 가득 찼습니다 (20장)'
      ctaStyle = { background: 'var(--border)', color: 'var(--text-muted)', cursor: 'not-allowed' }
      ctaDisabled = true
    } else {
      ctaLabel = '덱에 추가'
      ctaStyle = {
        background: 'linear-gradient(135deg, var(--gold), #A0822C)',
        color: '#1A1410',
        cursor: 'pointer',
      }
    }
  }

  return (
    <div
      role="region"
      aria-label="선택한 카드 정보"
      style={{
        padding: '12px 16px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* 태그 배지 행 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {elInfo && (
          <span style={{
            padding: '1px 6px',
            background: `${elInfo.color}28`,
            border: `1px solid ${elInfo.color}50`,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: elInfo.color,
          }}>
            {elInfo.icon} {card.element}
          </span>
        )}
        <span style={{
          padding: '1px 6px',
          background: 'var(--border)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
        }}>
          비용 {card.cost ?? 0}
        </span>
        <span style={{
          padding: '1px 6px',
          background: 'var(--border)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
        }}>
          {card.cardType === 'soldier' ? '병사' : '주문'}
        </span>
        <span style={{
          padding: '1px 6px',
          border: `1px solid ${getRarityColor(card.rarity)}50`,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: getRarityColor(card.rarity),
        }}>
          {getRarityLabel(card.rarity)}
        </span>
      </div>

      {/* 카드명 */}
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'normal',
        fontWeight: 700,
        fontSize: 15,
        color: 'var(--text-headline)',
        marginBottom: 4,
      }}>
        {card.name}
      </div>

      {/* 효과 텍스트 */}
      {isSpellCard(card) && card.effectText && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: 4,
        }}>
          {card.effectText}
        </div>
      )}
      {isSoldierCard(card) && card.battlecry && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: 4,
        }}>
          소환: {card.battlecry}
        </div>
      )}

      {/* 플레이버 텍스트 */}
      {card.flavorText && (
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}>
          "{card.flavorText}"
        </div>
      )}

      {/* CTA 버튼 */}
      <button
        type="button"
        aria-label={ctaLabel}
        aria-disabled={ctaDisabled ? 'true' : 'false'}
        onClick={ctaDisabled ? undefined : (isInDeck ? onRemove : onAdd)}
        style={{
          width: '100%',
          padding: '10px 0',
          border: 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.05em',
          ...ctaStyle,
        }}
      >
        {ctaLabel}
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────
// SaveToast
// ────────────────────────────────────────────────────

interface SaveToastProps {
  visible: boolean
}

function SaveToast({ visible }: SaveToastProps): React.ReactElement | null {
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--surface)',
      border: '1px solid var(--gold)',
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      color: 'var(--gold)',
      padding: '12px 24px',
      zIndex: 200,
      animation: 'deckBuildToastIn 0.25s ease-out',
      whiteSpace: 'nowrap',
    }}>
      덱이 저장되었습니다
    </div>
  )
}

// ────────────────────────────────────────────────────
// CancelConfirmSheet
// ────────────────────────────────────────────────────

interface CancelConfirmSheetProps {
  onLeave: () => void
  onStay: () => void
}

function CancelConfirmSheet({ onLeave, onStay }: CancelConfirmSheetProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onStay}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-sheet-title"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)',
          animation: 'deckBuildSheetIn 0.3s ease-out',
        }}
      >
        <div
          id="cancel-sheet-title"
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 16,
            color: 'var(--text-headline)',
            marginBottom: 8,
          }}
        >
          변경 사항을 저장하지 않고 나가시겠습니까?
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: 20,
        }}>
          편집한 덱 구성이 사라집니다.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onStay}
            style={{
              flex: 1,
              height: 44,
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            계속 편집
          </button>
          <button
            type="button"
            onClick={onLeave}
            style={{
              flex: 1,
              height: 44,
              background: 'var(--accent-red)',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: '#F2EAD8',
              cursor: 'pointer',
            }}
          >
            나가기
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// DeckBuildScreen 메인
// ────────────────────────────────────────────────────

interface DeckBuildScreenProps {
  onComplete: () => void
  onCancel: () => void
}

export default function DeckBuildScreen({ onComplete, onCancel }: DeckBuildScreenProps): React.ReactElement {
  injectStyles()

  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'owned' | 'deck'>('owned')
  const [filter, setFilter] = useState<ElementFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('cost-asc')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [showCancelSheet, setShowCancelSheet] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 스토어 구독
  const ownedCardIds = useUnlockStore(s => s.ownedCardIds)
  const currentDeckIds = useUnlockStore(s => s.currentDeckIds)
  const starterDeckIds = useUnlockStore(s => s.starterDeckIds)
  const addCardToDeck = useUnlockStore(s => s.addCardToDeck)
  const removeCardFromDeck = useUnlockStore(s => s.removeCardFromDeck)
  const saveDeck = useUnlockStore(s => s.saveDeck)

  // 초기 덱 상태 (변경 감지용)
  const initialDeckIdsRef = useRef<string[]>([...currentDeckIds])

  const isDirty = useMemo(() => {
    if (currentDeckIds.length !== initialDeckIdsRef.current.length) return true
    return currentDeckIds.some((id, i) => id !== initialDeckIdsRef.current[i])
  }, [currentDeckIds])

  // 진입 애니메이션
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  // 오행 카운트
  const elementCounts = useMemo(() => calcElementCounts(currentDeckIds), [currentDeckIds])

  // 보유 카드 목록 (중복 없이)
  const ownedCards = useMemo((): Card[] => {
    const seen = new Set<string>()
    const result: Card[] = []
    ownedCardIds.forEach(id => {
      const card = lookupCard(id)
      if (card && !seen.has(card.id)) {
        seen.add(card.id)
        result.push(card)
      }
    })
    return result
  }, [ownedCardIds])

  // 덱 카드 목록 (중복 허용)
  const deckCards = useMemo((): Array<{ card: Card; deckId: string }> => {
    return currentDeckIds
      .map(id => {
        const card = lookupCard(id)
        if (!card) return null
        return { card, deckId: id }
      })
      .filter((x): x is { card: Card; deckId: string } => x !== null)
  }, [currentDeckIds])

  // 필터 + 정렬 적용
  const displayedOwnedCards = useMemo(() => {
    return sortCards(filterCards(ownedCards, filter), sortOrder)
  }, [ownedCards, filter, sortOrder])

  const displayedDeckCards = useMemo(() => {
    const filtered = filterCards(deckCards.map(d => d.card), filter)
    const sorted = sortCards(filtered, sortOrder)
    return sorted.map(card => {
      const found = deckCards.find(d => d.card.id === card.id)
      return found ?? { card, deckId: card.id }
    })
  }, [deckCards, filter, sortOrder])

  // 선택된 카드 정보
  const selectedCard = useMemo((): Card | null => {
    if (!selectedCardId) return null
    return lookupCard(selectedCardId) ?? null
  }, [selectedCardId])

  const isSelectedInDeck = useMemo(() => {
    if (!selectedCardId) return false
    return currentDeckIds.includes(selectedCardId)
  }, [selectedCardId, currentDeckIds])

  const isSelectedStarter = useMemo(() => {
    if (!selectedCardId) return false
    return starterDeckIds.includes(selectedDeckId ?? selectedCardId)
  }, [selectedCardId, selectedDeckId, starterDeckIds])

  const isDeckFull = currentDeckIds.length >= 20
  const isDeckMin = currentDeckIds.length <= 8

  // 카드 선택 / 해제
  function handleSelectCard(cardId: string, deckId?: string) {
    if (selectedCardId === cardId) {
      setSelectedCardId(null)
      setSelectedDeckId(null)
    } else {
      setSelectedCardId(cardId)
      setSelectedDeckId(deckId ?? null)
    }
  }

  // 덱에 추가
  const handleAdd = useCallback((cardId: string) => {
    addCardToDeck(cardId)
    setSelectedCardId(cardId)
  }, [addCardToDeck])

  // 덱에서 제거
  const handleRemove = useCallback((deckId: string) => {
    removeCardFromDeck(deckId)
    setSelectedCardId(null)
    setSelectedDeckId(null)
  }, [removeCardFromDeck])

  // 저장
  function handleSave() {
    if (!isDirty) return
    saveDeck(currentDeckIds)
    saveCurrentDeckIds(currentDeckIds)
    initialDeckIdsRef.current = [...currentDeckIds]
    setShowToast(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false)
      onComplete()
    }, 1500)
  }

  // 취소
  function handleCancel() {
    if (isDirty) {
      setShowCancelSheet(true)
    } else {
      onCancel()
    }
  }

  // 탭 전환 시 선택 해제
  function handleTabChange(newTab: 'owned' | 'deck') {
    setTab(newTab)
    setSelectedCardId(null)
    setSelectedDeckId(null)
  }

  // 필터 변경 시 선택 해제
  function handleFilterChange(newFilter: ElementFilter) {
    setFilter(newFilter)
    setSelectedCardId(null)
    setSelectedDeckId(null)
  }

  const deckCount = currentDeckIds.length

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
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
        overflow: 'hidden',
      }}
    >
      {/* HEADER */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <button
          type="button"
          aria-label="취소"
          onClick={handleCancel}
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          ← 취소
        </button>

        <span style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 18,
          color: 'var(--gold)',
          letterSpacing: '0.04em',
        }}>
          덱 편집 (牌)
        </span>

        <button
          type="button"
          aria-label="저장"
          aria-disabled={!isDirty ? 'true' : 'false'}
          onClick={handleSave}
          style={{
            background: 'transparent',
            border: isDirty ? '1px solid var(--gold)' : 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: isDirty ? 'var(--gold)' : 'var(--text-muted)',
            cursor: isDirty ? 'pointer' : 'default',
            opacity: isDirty ? 1 : 0.5,
            padding: '4px 8px',
          }}
        >
          저장
        </button>
      </header>

      {/* DECK STATUS BAR */}
      <DeckStatusBar deckCount={deckCount} elementCounts={elementCounts} />

      {/* TAB BAR */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg2)',
        zIndex: 9,
      }}>
        {([
          { key: 'owned', label: `보유 (${ownedCards.length}장)` },
          { key: 'deck',  label: `현재 덱 (${deckCount}장)` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleTabChange(key)}
            style={{
              flex: 1,
              height: 40,
              background: 'transparent',
              border: 'none',
              borderBottom: tab === key ? '2px solid var(--gold)' : '2px solid transparent',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: tab === key ? 'var(--gold)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SCROLL AREA */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* FILTER ROW */}
        <div style={{
          padding: '8px 12px',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          flexShrink: 0,
          scrollbarWidth: 'none',
        }}>
          {FILTER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleFilterChange(key)}
              style={{
                flexShrink: 0,
                padding: '4px 10px',
                height: 28,
                border: filter === key ? 'none' : '1px solid var(--border-subtle)',
                background: filter === key ? 'var(--gold)' : 'transparent',
                color: filter === key ? '#1A1410' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* SORT ROW */}
        <div style={{
          padding: '2px 12px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            정렬:
          </span>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as SortOrder)}
            aria-label="카드 정렬 기준"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              padding: '2px 6px',
              cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* CARD GRID */}
        <div style={{
          padding: '0 12px',
          flex: 1,
        }}>
          {tab === 'owned' && (
            <>
              {displayedOwnedCards.length === 0 ? (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}>
                  {filter === 'all'
                    ? '보유한 카드가 없습니다. 뽑기를 통해 카드를 획득하세요.'
                    : '해당 오행의 보유 카드가 없습니다.'}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  paddingBottom: 8,
                }}>
                  {displayedOwnedCards.map((card, idx) => (
                    <DeckBuildCardSlot
                      key={card.id}
                      card={card}
                      deckId={card.id}
                      isInDeck={currentDeckIds.includes(card.id)}
                      isStarter={starterDeckIds.includes(card.id)}
                      isDeckFull={isDeckFull}
                      isDeckMin={isDeckMin}
                      isSelected={selectedCardId === card.id}
                      tab="owned"
                      index={idx}
                      onSelect={() => handleSelectCard(card.id)}
                      onAdd={() => handleAdd(card.id)}
                      onRemove={() => handleRemove(card.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'deck' && (
            <>
              {/* 덱 섹션 레이블 */}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-muted)',
                padding: '4px 0 8px',
              }}>
                현재 덱 ({deckCount}장)
              </div>

              {displayedDeckCards.length === 0 ? (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                }}>
                  {filter !== 'all' ? '해당 오행의 보유 카드가 없습니다.' : '덱에 카드가 없습니다.'}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  paddingBottom: 8,
                }}>
                  {displayedDeckCards.map(({ card, deckId }, idx) => (
                    <DeckBuildCardSlot
                      key={`${deckId}-${idx}`}
                      card={card}
                      deckId={deckId}
                      isInDeck={true}
                      isStarter={starterDeckIds.includes(deckId)}
                      isDeckFull={isDeckFull}
                      isDeckMin={isDeckMin}
                      isSelected={selectedCardId === card.id}
                      tab="deck"
                      index={idx}
                      onSelect={() => handleSelectCard(card.id, deckId)}
                      onAdd={() => handleAdd(card.id)}
                      onRemove={() => handleRemove(deckId)}
                    />
                  ))}
                </div>
              )}

              {/* 오행 밸런스 상세 */}
              <ElementBalanceDetail elementCounts={elementCounts} total={deckCount} />
            </>
          )}
        </div>
      </div>

      {/* CARD DETAIL PANEL (하단 고정) */}
      <CardDetailPanel
        card={selectedCard}
        isInDeck={isSelectedInDeck}
        isStarter={isSelectedStarter}
        isDeckFull={isDeckFull}
        isDeckMin={isDeckMin}
        onAdd={() => selectedCardId && handleAdd(selectedCardId)}
        onRemove={() => { const target = selectedDeckId ?? selectedCardId; if (target) handleRemove(target) }}
      />

      {/* 저장 토스트 */}
      <SaveToast visible={showToast} />

      {/* 취소 확인 바텀 시트 */}
      {showCancelSheet && (
        <CancelConfirmSheet
          onLeave={onCancel}
          onStay={() => setShowCancelSheet(false)}
        />
      )}
    </div>
  )
}
