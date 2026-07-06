/**
 * FieldUnitCard — 필드 위 유닛 카드 컴포넌트
 * 리라 스펙 §3-1
 * STS 강화: 공격 돌진 y -90 + 히트스탑 + shake ±14 + 키워드 VFX + reborn 부활 (리라 스펙 §2, §3, §4-C)
 */

import React, { useRef, useCallback, useEffect } from 'react'
import gsap from 'gsap'
import type { FieldUnit } from '@/types/cards'
import { ELEMENT_DISPLAY } from '@/types/elements'
import KeywordBadge from './KeywordBadge'
import CardArtSVG, { getRarityBorderStyle } from './CardArtSVG'


// 키워드 배지 아이콘
const KEYWORD_ICON: Partial<Record<import('@/types/cards').Keyword, string>> = {
  taunt: '🛡',
  rush: '⚡',
  pierce: '🗡',
  poison: '☠',
  lifesteal: '💚',
}

// ────────────────────────────────────────────────────
// 키워드 VFX 플래시 텍스트 (리라 스펙 §3-A)
// ────────────────────────────────────────────────────

function emitKeywordFlash(
  anchorEl: HTMLElement,
  text: string,
  color: string,
): void {
  const rect = anchorEl.getBoundingClientRect()
  const span = document.createElement('div')
  span.textContent = text
  span.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2}px;
    top: ${rect.top}px;
    transform: translateX(-50%);
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    color: ${color};
    text-shadow: 0 0 8px ${color}80;
    pointer-events: none;
    z-index: 55;
    white-space: nowrap;
  `
  document.body.appendChild(span)
  gsap.timeline()
    .fromTo(span,
      { scale: 0, opacity: 1, y: 0 },
      { scale: 1.4, opacity: 1, y: -4, duration: 0.15, ease: 'back.out(2)' },
    )
    .to(span, { scale: 1.0, duration: 0.08 })
    .to(span, {
      y: -32,
      opacity: 0,
      duration: 0.38,
      ease: 'power2.out',
      onComplete: () => {
        if (document.body.contains(span)) document.body.removeChild(span)
      },
    })
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface FieldUnitCardProps {
  unit: FieldUnit
  slotIdx: number
  side: 'player' | 'ai'
  isSelected?: boolean
  isValidAttackTarget?: boolean
  isDimmed?: boolean       // 도발 규칙으로 dim
  onClick?: () => void
}

export default function FieldUnitCard({
  unit,
  slotIdx: _slotIdx,
  side,
  isSelected = false,
  isValidAttackTarget = false,
  isDimmed = false,
  onClick,
}: FieldUnitCardProps): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null)
  const element = unit.card.element ?? '火'
  const display = ELEMENT_DISPLAY[element]
  const allKeywords = [...unit.card.keywords, ...unit.temporaryKeywords]

  // M8 P0: 카드 소환 등장 애니메이션 (CSS animation — 마운트 시 1회)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    el.style.animation = 'cardAppear 0.22s ease-out forwards'
    const timer = setTimeout(() => {
      if (el) el.style.animation = ''
    }, 300)

    // 소환 시점 키워드 특수 연출 (리라 스펙 §3-C)
    const kwTimer = setTimeout(() => {
      const currentEl = cardRef.current
      if (!currentEl) return

      // rush 소환 시 "돌진!" 플래시
      if (allKeywords.includes('rush')) {
        emitKeywordFlash(currentEl, '돌진!', '#FFD700')
        gsap.timeline()
          .to(currentEl, { boxShadow: '0 0 16px #FFD700', duration: 0.15 })
          .to(currentEl, { boxShadow: 'none', duration: 0.3 })
      }

      // incinerate 소환 시 orange flash
      if (allKeywords.includes('incinerate')) {
        gsap.timeline()
          .to(currentEl, { filter: 'brightness(1.6) sepia(0.4)', duration: 0.1 })
          .to(currentEl, { filter: 'brightness(1) sepia(0)', duration: 0.3 })
      }

      // taunt 소환 시 gold ring pulse
      if (allKeywords.includes('taunt')) {
        gsap.timeline()
          .to(currentEl, { boxShadow: '0 0 20px rgba(184,154,94,0.8)', duration: 0.2 })
          .to(currentEl, { boxShadow: '0 0 6px rgba(184,154,94,0.4)', duration: 0.3 })
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      clearTimeout(kwTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 공격 클릭 시 애니메이션 — y -90 돌진 + 히트스탑 + 복귀 (리라 스펙 §2-A)
  const handleClick = useCallback(() => {
    if (!onClick) return
    const el = cardRef.current
    if (el && side === 'player' && isSelected) {
      gsap.timeline()
        // 1단계: 적 방향 돌진 (y 음수 = 위 방향 = AI 필드 방향)
        .to(el, { y: -90, x: 0, duration: 0.18, ease: 'power3.in' })
        // 히트스탑: 50ms 정지
        .to(el, { duration: 0.05 })
        // 복귀
        .to(el, { y: 0, x: 0, duration: 0.25, ease: 'back.out(1.5)' })
    }
    onClick()
  }, [onClick, side, isSelected])

  // 피격 shake — ±14px 강화 (리라 스펙 §2 / §3-B)
  const prevHpRef = useRef(unit.currentHealth)
  if (prevHpRef.current !== unit.currentHealth && unit.currentHealth < prevHpRef.current) {
    prevHpRef.current = unit.currentHealth
    const el = cardRef.current
    if (el) {
      // shake ±14px 강화 (기존 ±10 → ±14)
      gsap.timeline()
        .to(el, { x: -14, duration: 0.05, ease: 'power2.out' })
        .to(el, { x: 11, duration: 0.06 })
        .to(el, { x: -9, duration: 0.06 })
        .to(el, { x: 6, duration: 0.06 })
        .to(el, { x: -3, duration: 0.06 })
        .to(el, { x: 0, duration: 0.06, ease: 'power2.out' })

      // poison 피격 시 녹색 flash (리라 스펙 §3-B)
      if (allKeywords.includes('poison')) {
        gsap.timeline()
          .to(el, { filter: 'brightness(1.8) hue-rotate(90deg)', duration: 0.08 })
          .to(el, { filter: 'brightness(1) hue-rotate(0deg)', duration: 0.22 })
      }

      // freeze 피격 시 파란 flash (리라 스펙 §3-B)
      if (unit.frozen) {
        gsap.timeline()
          .to(el, { filter: 'brightness(2) saturate(0) sepia(1) hue-rotate(180deg)', duration: 0.08 })
          .to(el, { filter: 'brightness(1) saturate(1) sepia(0) hue-rotate(0deg)', duration: 0.25 })
      }

      // incinerate 피격 시 "소각!" + orange flash (리라 스펙 §3-D)
      if (allKeywords.includes('incinerate')) {
        emitKeywordFlash(el, '소각!', '#FF6B35')
        gsap.timeline()
          .to(el, { background: 'rgba(255,100,50,0.4)', duration: 0.1 })
          .to(el, { background: 'var(--bg2)', duration: 0.3 })
      }
    }
  } else {
    prevHpRef.current = unit.currentHealth
  }

  // HP 증가 감지 → lifesteal "흡혈!" VFX (리라 스펙 §3-C)
  const prevHpIncreaseRef = useRef(unit.currentHealth)
  useEffect(() => {
    if (unit.currentHealth > prevHpIncreaseRef.current) {
      const el = cardRef.current
      if (el && allKeywords.includes('lifesteal')) {
        emitKeywordFlash(el, '흡혈!', '#4ADE80')
      }
    }
    prevHpIncreaseRef.current = unit.currentHealth
  }, [unit.currentHealth]) // eslint-disable-line react-hooks/exhaustive-deps

  // reborn 부활 감지 (리라 스펙 §4-C)
  const prevRebornRef = useRef(unit.rebornUsed)
  useEffect(() => {
    if (prevRebornRef.current === false && unit.rebornUsed === true) {
      const el = cardRef.current
      if (!el) return
      gsap.timeline()
        .fromTo(el,
          { opacity: 0, scale: 0.3, filter: 'brightness(5)' },
          { opacity: 1, scale: 1.2, filter: 'brightness(2)', duration: 0.2, ease: 'power3.out' },
        )
        .to(el, { scale: 1.0, filter: 'brightness(1)', duration: 0.25, ease: 'back.out(1.5)' })
      emitKeywordFlash(el, '부활!', '#C8E4F8')
    }
    prevRebornRef.current = unit.rebornUsed
  }, [unit.rebornUsed])

  // 도발 유닛 테두리
  const hasTaunt = allKeywords.includes('taunt')
  const hasPoison = allKeywords.includes('poison')
  const hasPierce = allKeywords.includes('pierce')
  const hasIncinerate = allKeywords.includes('incinerate')

  const rarityStyle = getRarityBorderStyle(unit.card.rarity)
  const borderColor = hasTaunt
    ? 'rgba(184,154,94,0.6)'
    : `${display.color}66`
  const borderStyle = hasPoison ? 'dashed' : 'solid'
  const rarityBoxShadow = rarityStyle.boxShadow ?? 'none'

  const boxShadow = hasTaunt
    ? `0 0 6px rgba(184,154,94,0.4), ${rarityBoxShadow}`
    : isSelected
    ? '0 0 12px rgba(212,175,90,0.4)'
    : isValidAttackTarget
    ? '0 0 8px rgba(196,96,74,0.5)'
    : rarityBoxShadow

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      style={{
        position: 'relative',
        flex: 1,
        maxWidth: 84,
        height: 112,
        background: hasIncinerate
          ? 'radial-gradient(ellipse at center, rgba(196,96,74,0.1) 0%, var(--bg2) 100%)'
          : 'var(--bg2)',
        border: `1px ${borderStyle} ${borderColor}`,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        opacity: isDimmed ? 0.3 : unit.canAttack || side === 'ai' ? 1 : 0.6,
        display: 'flex',
        flexDirection: 'column',
        boxShadow,
        transition: 'box-shadow 0.2s, opacity 0.2s',
        userSelect: 'none',
      }}
      aria-label={`${unit.card.name} 공격력:${unit.currentAttack} 체력:${unit.currentHealth}`}
    >
      {/* 헤더 */}
      <div style={{
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
        flexShrink: 0,
      }}>
        <div style={{
          width: 20,
          height: 20,
          background: 'transparent',
          border: '1px solid var(--gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--gold)',
          flexShrink: 0,
        }}>
          {unit.card.cost}
        </div>
        <div style={{ fontSize: 14, color: display.color }}>
          {display.icon}
        </div>
      </div>

      {/* 오행 SVG 아트 영역 (M8 P0: keywords 전달) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <CardArtSVG
          element={element}
          rarity={unit.card.rarity}
          size="field"
          cardType={unit.card.cardType}
          keywords={unit.card.cardType === 'soldier' ? unit.card.keywords : []}
          cost={unit.card.cost}
        />
        {/* 관통 삼각형 뱃지 */}
        {hasPierce && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderTop: '12px solid rgba(139,117,54,0.8)',
            borderLeft: '12px solid transparent',
          }} />
        )}
      </div>

      {/* 키워드 배지 행 */}
      {allKeywords.length > 0 && (
        <div style={{
          height: 18,
          padding: '0 2px',
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {allKeywords.map((kw, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {KEYWORD_ICON[kw as import('@/types/cards').Keyword] && (
                <span style={{ fontSize: 9, lineHeight: 1 }}>
                  {KEYWORD_ICON[kw as import('@/types/cards').Keyword]}
                </span>
              )}
              <KeywordBadge
                keyword={kw}
                used={kw === 'reborn' && unit.rebornUsed}
              />
            </div>
          ))}
        </div>
      )}

      {/* 풋터 */}
      <div style={{
        height: 22,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 4px',
        background: 'rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 400,
          fontSize: 13,
          color: 'var(--el-fire)',
        }}>
          {unit.currentAttack}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 400,
          fontSize: 13,
          color: unit.currentHealth < 3 ? 'var(--el-fire)' : 'var(--el-wood)',
        }}>
          {unit.currentHealth}
        </span>
      </div>

      {/* 선택 링 */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid var(--gold)',
          pointerEvents: 'none',
        }} />
      )}

      {/* 타겟 링 */}
      {isValidAttackTarget && !isSelected && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid var(--el-fire)',
          pointerEvents: 'none',
          animation: 'pulseRed 0.8s ease-in-out infinite',
        }} />
      )}

      {/* 동결 오버레이 */}
      {unit.frozen && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(94,143,184,0.35)',
          border: '2px solid var(--el-water)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          fontSize: 24,
          opacity: 0.8,
        }}>
          ❄
        </div>
      )}

      {/* 공격 불가 빗금 오버레이 (플레이어 유닛이 이번 턴 공격 완료) */}
      {side === 'player' && !unit.canAttack && !unit.frozen && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.3) 4px, rgba(0,0,0,0.3) 6px)',
          pointerEvents: 'none',
          borderRadius: 6,
        }} />
      )}
    </div>
  )
}
