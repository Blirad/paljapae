/**
 * FieldUnitCard — 필드 위 유닛 카드 컴포넌트
 * 리라 스펙 §3-1
 */

import React, { useRef, useCallback } from 'react'
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

  // 공격 클릭 시 애니메이션 (플레이어 유닛이 AI 방향으로 이동)
  const handleClick = useCallback(() => {
    if (!onClick) return
    const el = cardRef.current
    if (el && side === 'player' && isSelected) {
      // 공격 애니메이션: 위로 이동 후 복귀
      gsap.timeline()
        .to(el, { y: -20, duration: 0.15 })
        .to(el, { y: 0, duration: 0.25, ease: 'bounce.out' })
    }
    onClick()
  }, [onClick, side, isSelected])

  // 피격 shake (isValidAttackTarget이 사라질 때 = 공격받은 직후는 감지 어려우므로 HP 감소 감지)
  const prevHpRef = useRef(unit.currentHealth)
  if (prevHpRef.current !== unit.currentHealth && unit.currentHealth < prevHpRef.current) {
    prevHpRef.current = unit.currentHealth
    const el = cardRef.current
    if (el) {
      gsap.timeline()
        .to(el, { x: -6, duration: 0.05 })
        .to(el, { x: 6, duration: 0.05 })
        .to(el, { x: -4, duration: 0.05 })
        .to(el, { x: 0, duration: 0.05 })
    }
  } else {
    prevHpRef.current = unit.currentHealth
  }

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

      {/* 오행 SVG 아트 영역 (M6) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <CardArtSVG
          element={element}
          rarity={unit.card.rarity}
          size="field"
          cardType={unit.card.cardType}
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
