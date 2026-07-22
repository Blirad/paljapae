/**
 * 팔자전 — 통합 슬롯 컴포넌트 (1단계 개편)
 *
 * 통합 슬롯 5칸(MAX_SLOTS) — tier별 테두리로 3층 구분:
 *   common    (가호)    — 1px solid #4A4540 무테
 *   rare      (신살)    — 2px solid #A8B4C0 은테 + 은빛 글로우
 *   legendary (운성패)  — 2px solid #C9A227 금테 + 금빛 글로우 (자리 예약, 2단계 구현)
 *
 * isEquipPhase (floor-reward/result) 에서만 해제 인터랙션 활성.
 * 전투 중 비활성 (cursor: default, 이벤트 무반응).
 *
 * unifiedSlots prop이 있으면 통합 슬롯 정본으로 렌더.
 * 없으면 레거시 passives 배열로 fallback (BattleScreen 마이그레이션 전 호환).
 */

import { useState, useRef, useCallback } from 'react'
import type { UnifiedSlot } from '../types/game'
import type { Passive } from '../types/passive'
import {
  PASSIVE_RARITY_COLORS,
  PASSIVE_RARITY_BORDER,
  PASSIVE_RARITY_BORDER_WIDTH,
  PASSIVE_RARITY_SHADOW,
  PASSIVE_RARITY_LABEL,
} from '../types/passive'
import { PASSIVE_POOL } from '../types/passive'
import { MAX_SLOTS } from '../engine/paljajeonEngine'

// ─── 신살 이름·설명 조회 ────────────────────────────────────────────────────

const SINSAL_META: Record<string, { name: string; effect: string }> = {
  hwagae: {
    name: '화개(華蓋)',
    effect: '지정한 카드의 힘을 영구히 +3 깊어지게 한다',
  },
}

// 운성패 이름 조회 (2단계 구현 전 자리 예약용 텍스트)
const UNSEONGPAE_META: Record<string, { name: string; effect: string }> = {
  // 예시 — 실제 정본은 2단계에서 정의
}

function resolveSlotMeta(slot: UnifiedSlot): { label: string; name: string; effect: string } {
  if (slot.tier === 'common') {
    const p = PASSIVE_POOL.find(p => p.id === slot.cardId)
    return {
      label: PASSIVE_RARITY_LABEL.common,
      name: p?.name ?? slot.cardId,
      effect: p?.effect ?? '',
    }
  }
  if (slot.tier === 'rare') {
    const m = SINSAL_META[slot.cardId]
    return {
      label: PASSIVE_RARITY_LABEL.rare,
      name: m?.name ?? slot.cardId,
      effect: m?.effect ?? '',
    }
  }
  // legendary
  const m = UNSEONGPAE_META[slot.cardId]
  return {
    label: PASSIVE_RARITY_LABEL.legendary,
    name: m?.name ?? slot.cardId,
    effect: m?.effect ?? '[격: 수(囚) — 성장형]',
  }
}

// ─── UnifiedSlotCard ────────────────────────────────────────────────────────

interface UnifiedSlotCardProps {
  slot: UnifiedSlot
  slotIndex: number
  isFlashing: boolean
  isEquipActive: boolean      // 장착/해제 인터랙션 활성 여부 (isEquipPhase)
  isInBattle: boolean         // 전투 중 여부 (신살 발동 버튼 표시용)
  isFadingOut: boolean        // 해제 fade-out 연출 중
  onUnequipRequest: (index: number) => void
  onActivateSinsal?: (cardId: string) => void  // 신살 발동 버튼 클릭
}

function UnifiedSlotCard({
  slot,
  slotIndex,
  isFlashing,
  isEquipActive,
  isInBattle,
  isFadingOut,
  onUnequipRequest,
  onActivateSinsal,
}: UnifiedSlotCardProps) {
  const meta = resolveSlotMeta(slot)
  // SlotTier(common/rare/legendary)는 PassiveRarity의 부분집합이므로 직접 인덱싱
  const tierKey = slot.tier as 'common' | 'rare' | 'legendary'
  const tierColor = PASSIVE_RARITY_COLORS[tierKey] ?? '#D8CCB4'
  const borderColor = PASSIVE_RARITY_BORDER[tierKey] ?? '#4A4540'
  const borderWidth = PASSIVE_RARITY_BORDER_WIDTH[tierKey] ?? '1px'
  const boxShadow = PASSIVE_RARITY_SHADOW[tierKey] ?? 'none'

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseDown = useCallback(() => {
    if (!isEquipActive) return
    longPressTimerRef.current = setTimeout(() => {
      onUnequipRequest(slotIndex)
    }, 500)
  }, [isEquipActive, slotIndex, onUnequipRequest])

  const handleMouseUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isEquipActive) return
    e.preventDefault()
    onUnequipRequest(slotIndex)
  }, [isEquipActive, slotIndex, onUnequipRequest])

  const handleTouchStart = useCallback(() => {
    if (!isEquipActive) return
    longPressTimerRef.current = setTimeout(() => {
      onUnequipRequest(slotIndex)
    }, 500)
  }, [isEquipActive, slotIndex, onUnequipRequest])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // 신살 발동 버튼 — 전투 중 희귀 슬롯에만 표시
  const showActivateBtn = isInBattle && slot.tier === 'rare' && !!onActivateSinsal

  // 플래시 스타일 (신살 발동 플래시)
  const flashStyle: React.CSSProperties = isFlashing
    ? {
        backgroundColor: 'rgba(168,180,192,0.15)',
        border: '2px solid #FFFFFF',
        boxShadow: '0 0 12px 4px rgba(168,180,192,0.7)',
        transition: '0.15s ease',
      }
    : {}

  return (
    <div
      style={{
        width: '56px',
        height: '72px',
        backgroundColor: '#1C1710',
        border: isFlashing ? '2px solid #FFFFFF' : `${borderWidth} solid ${borderColor}`,
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 3px',
        gap: '2px',
        position: 'relative',
        transition: 'background-color 0.15s ease, border-color 0.15s ease, opacity 0.3s linear, transform 0.3s ease-in',
        boxShadow: isFlashing ? '0 0 12px 4px rgba(168,180,192,0.7)' : boxShadow,
        cursor: isEquipActive ? 'pointer' : 'default',
        flexShrink: 0,
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(0.9)' : 'none',
        ...flashStyle,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 등급 표시 (좌상단) */}
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: '3px',
          fontSize: '7px',
          color: tierColor,
          letterSpacing: '0.05em',
          opacity: 0.8,
        }}
      >
        {meta.label}
      </div>

      {/* 전설 격 표기 (우하단, 1단계 자리예약) */}
      {slot.tier === 'legendary' && (
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '3px',
            fontSize: '8px',
            color: '#C9A227',
            opacity: 0.9,
          }}
        >
          수
        </div>
      )}

      {/* 슬롯 이름 */}
      <div
        style={{
          fontSize: '9px',
          color: tierColor,
          fontWeight: 'bold',
          textAlign: 'center',
          letterSpacing: '0.03em',
          lineHeight: '1.2',
          marginTop: '10px',
          wordBreak: 'keep-all',
        }}
      >
        {meta.name}
      </div>

      {/* 효과 1줄 */}
      <div
        style={{
          fontSize: '7px',
          color: '#6A6560',
          textAlign: 'center',
          lineHeight: '1.2',
          wordBreak: 'keep-all',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}
      >
        {meta.effect}
      </div>

      {/* 신살 발동 버튼 (전투 중 희귀 슬롯) */}
      {showActivateBtn && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onActivateSinsal!(slot.cardId)
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(168,180,192,0.18)',
            cursor: 'pointer',
            fontSize: '8px',
            color: '#A8B4C0',
            letterSpacing: '0.1em',
            transition: 'background-color 0.15s ease',
            borderRadius: '0 0 2px 2px',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(168,180,192,0.32)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(168,180,192,0.18)'
          }}
        >
          발동
        </div>
      )}
    </div>
  )
}

// ─── EmptySlot ──────────────────────────────────────────────────────────────

function EmptySlot() {
  return (
    <div
      style={{
        width: '56px',
        height: '72px',
        border: '1px dashed #2A2620',
        borderRadius: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#16130F',
        flexShrink: 0,
      }}
    >
      <span style={{ color: '#2A2620', fontSize: '10px', letterSpacing: '0.05em' }}>+추가</span>
    </div>
  )
}

// ─── 해제 소멸 경고 모달 ────────────────────────────────────────────────────

interface UnequipConfirmModalProps {
  slot: UnifiedSlot
  onConfirm: () => void
  onCancel: () => void
}

function UnequipConfirmModal({ slot, onConfirm, onCancel }: UnequipConfirmModalProps) {
  const meta = resolveSlotMeta(slot)
  const tierColor = PASSIVE_RARITY_COLORS[slot.tier as 'common' | 'rare' | 'legendary'] ?? '#D8CCB4'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(22,19,15,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1A1712',
          border: '1px solid #4A4540',
          padding: '20px',
          borderRadius: '2px',
          maxWidth: '320px',
          width: '90%',
        }}
      >
        <div style={{ color: '#E8DCC4', fontSize: '14px', letterSpacing: '0.1em', marginBottom: '12px' }}>
          <span style={{ color: tierColor, fontWeight: 'bold' }}>{meta.name}</span>
          <span style={{ color: '#E8DCC4' }}>을(를) 해제합니다</span>
        </div>
        <div style={{ color: '#B33A2B', fontSize: '12px', marginBottom: '4px' }}>
          이 카드는 영구히 소멸합니다.
        </div>
        <div style={{ color: '#B33A2B', fontSize: '12px', marginBottom: '20px' }}>
          보관함이 없습니다. 되돌릴 수 없습니다.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid #2A2620',
              color: '#6A6560',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              letterSpacing: '0.05em',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: '#B33A2B',
              border: 'none',
              color: '#E8DCC4',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              letterSpacing: '0.05em',
            }}
          >
            소멸 확인
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 패시브 발동 배너 ───────────────────────────────────────────────────────

export function PassiveActivationBanner({ passiveName, visible }: { passiveName: string | null; visible: boolean }) {
  if (!visible || !passiveName) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(22,19,15,0.92)',
          border: '1px solid #D9A441',
          padding: '10px 28px',
          textAlign: 'center',
          animation: 'passiveBannerIn 0.2s ease-out forwards',
        }}
      >
        <div style={{ color: '#D9A441', fontSize: '13px', letterSpacing: '0.2em', fontWeight: 'bold' }}>
          {passiveName} 발동!
        </div>
      </div>
    </div>
  )
}

// ─── 통합 슬롯 메인 컴포넌트 ────────────────────────────────────────────────

interface PassiveSlotProps {
  /** 레거시: Passive 배열 (unifiedSlots 없을 때 fallback) */
  passives?: (Passive | null)[]
  flashCardId?: string | null
  maxSlots?: number

  /** 통합 슬롯 개편 1단계: unifiedSlots 기반 렌더 (정본) */
  unifiedSlots?: UnifiedSlot[]
  /** 전투 밖(floor-reward/result) 여부 — 장착/해제 인터랙션 활성 */
  isEquipPhase?: boolean
  /** 전투 중 여부 — 신살 발동 버튼 표시 */
  isInBattle?: boolean
  /** 신살 발동 콜백 — 전투 중 희귀 슬롯 발동 버튼 클릭 시 */
  onActivateSinsal?: (sinsalId: string) => void
  /** 슬롯 해제 콜백 — 전투 밖에서 롱프레스/우클릭 시 */
  onUnequipSlot?: (index: number) => void
}

export default function PassiveSlot({
  passives = [],
  flashCardId,
  maxSlots = MAX_SLOTS,
  unifiedSlots,
  isEquipPhase = false,
  isInBattle = false,
  onActivateSinsal,
  onUnequipSlot,
}: PassiveSlotProps) {

  // 해제 소멸 경고 모달 상태
  const [unequipTargetIndex, setUnequipTargetIndex] = useState<number | null>(null)
  // 슬롯 fade-out 연출 상태 (index set)
  const [fadingOutIndices, setFadingOutIndices] = useState<Set<number>>(new Set())

  const handleUnequipRequest = useCallback((index: number) => {
    if (!isEquipPhase) return
    setUnequipTargetIndex(index)
  }, [isEquipPhase])

  const handleUnequipConfirm = useCallback(() => {
    if (unequipTargetIndex === null) return
    const idx = unequipTargetIndex
    setUnequipTargetIndex(null)
    // fade-out 연출 시작
    setFadingOutIndices(prev => new Set(prev).add(idx))
    setTimeout(() => {
      setFadingOutIndices(prev => {
        const next = new Set(prev)
        next.delete(idx)
        return next
      })
      onUnequipSlot?.(idx)
    }, 300)
  }, [unequipTargetIndex, onUnequipSlot])

  const handleUnequipCancel = useCallback(() => {
    setUnequipTargetIndex(null)
  }, [])

  // ── 통합 슬롯 정본 렌더 ──
  if (unifiedSlots !== undefined) {
    const emptyCount = Math.max(0, maxSlots - unifiedSlots.length)

    return (
      <>
        <div
          style={{
            height: '12vh',
            minHeight: '80px',
            backgroundColor: '#181410',
            borderTop: '1px solid #2A2620',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '4px 16px',
          }}
        >
          {unifiedSlots.map((slot, i) => (
            <UnifiedSlotCard
              key={`${slot.tier}-${slot.cardId}-${i}`}
              slot={slot}
              slotIndex={i}
              isFlashing={flashCardId === slot.cardId}
              isEquipActive={isEquipPhase}
              isInBattle={isInBattle}
              isFadingOut={fadingOutIndices.has(i)}
              onUnequipRequest={handleUnequipRequest}
              onActivateSinsal={onActivateSinsal}
            />
          ))}
          {Array(emptyCount).fill(null).map((_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </div>

        {/* 해제 소멸 경고 모달 */}
        {unequipTargetIndex !== null && unifiedSlots[unequipTargetIndex] && (
          <UnequipConfirmModal
            slot={unifiedSlots[unequipTargetIndex]}
            onConfirm={handleUnequipConfirm}
            onCancel={handleUnequipCancel}
          />
        )}
      </>
    )
  }

  // ── 레거시 passives 배열 fallback ──
  const slots: (Passive | null)[] = [
    ...passives.slice(0, maxSlots),
    ...Array(Math.max(0, maxSlots - passives.length)).fill(null),
  ]

  return (
    <div
      style={{
        height: '12vh',
        minHeight: '80px',
        backgroundColor: '#181410',
        borderTop: '1px solid #2A2620',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '4px 16px',
      }}
    >
      {slots.map((passive, i) => {
        if (!passive) return <EmptySlot key={`empty-${i}`} />
        const rarity = passive.rarity
        const borderColor = PASSIVE_RARITY_BORDER[rarity]
        const borderWidth = PASSIVE_RARITY_BORDER_WIDTH[rarity]
        const boxShadow = PASSIVE_RARITY_SHADOW[rarity]
        const rarityColor = PASSIVE_RARITY_COLORS[rarity]
        const isFlashing = flashCardId === passive.id
        return (
          <div
            key={passive.id}
            style={{
              width: '56px',
              height: '72px',
              backgroundColor: isFlashing ? 'rgba(255,255,255,0.9)' : '#1C1710',
              border: `${isFlashing ? '1px' : borderWidth} solid ${isFlashing ? '#FFFFFF' : borderColor}`,
              borderRadius: '2px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 3px',
              gap: '2px',
              position: 'relative',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
              boxShadow: isFlashing ? '0 0 12px 4px rgba(255,255,255,0.7)' : boxShadow,
              cursor: 'default',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '2px',
                left: '3px',
                fontSize: '7px',
                color: rarityColor,
                letterSpacing: '0.05em',
                opacity: 0.8,
              }}
            >
              {PASSIVE_RARITY_LABEL[rarity]}
            </div>
            <div
              style={{
                fontSize: '9px',
                color: isFlashing ? '#16130F' : rarityColor,
                fontWeight: 'bold',
                textAlign: 'center',
                letterSpacing: '0.03em',
                lineHeight: '1.2',
                marginTop: '10px',
                wordBreak: 'keep-all',
              }}
            >
              {passive.name}
            </div>
            <div
              style={{
                fontSize: '7px',
                color: isFlashing ? '#3A3530' : '#6A6560',
                textAlign: 'center',
                lineHeight: '1.2',
                wordBreak: 'keep-all',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}
            >
              {passive.effect}
            </div>
          </div>
        )
      })}
    </div>
  )
}
