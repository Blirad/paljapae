/**
 * FieldArea — AI/플레이어 필드 영역 (4슬롯)
 * 리라 스펙 §2-2 [C] [D]
 */

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { FieldUnit } from '@/types/cards'
import FieldUnitCard from './FieldUnitCard'
import EmptySlot from './EmptySlot'
import type { InteractionState } from '@/game/store/battleStore'

interface FieldAreaProps {
  field: (FieldUnit | null)[]
  side: 'player' | 'ai'
  interaction: InteractionState
  selectedUnitSlot: number | null
  selectedCardIndex: number | null
  hasTauntInAiField?: boolean        // AI 필드에 도발 있는지 (플레이어 공격 타겟팅용)
  attackerHasPierce?: boolean        // CRIT-4: 공격자 pierce 여부 (부모에서 전달)
  onUnitClick?: (slotIdx: number) => void
  onEmptySlotClick?: (slotIdx: number) => void
  onDragOver?: (e: React.DragEvent, slotIdx: number) => void
  onDrop?: (e: React.DragEvent, slotIdx: number) => void
  onDragLeave?: () => void
  dragOverSlot?: number | null
  isAiHeroTargetable?: boolean
}

export default function FieldArea({
  field,
  side,
  interaction,
  selectedUnitSlot,
  selectedCardIndex,
  hasTauntInAiField = false,
  attackerHasPierce = false,
  onUnitClick,
  onEmptySlotClick,
  onDragOver,
  onDrop,
  onDragLeave,
  dragOverSlot = null,
}: FieldAreaProps): React.ReactElement {
  const isPlayerField = side === 'player'

  // 소환 애니메이션: 슬롯별 ref + 이전 유닛 추적
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const prevFieldRef = useRef<(FieldUnit | null)[]>([])

  useEffect(() => {
    field.forEach((unit, slotIdx) => {
      const wasEmpty = prevFieldRef.current[slotIdx] == null
      const nowHasUnit = unit != null
      if (wasEmpty && nowHasUnit) {
        const el = slotRefs.current[slotIdx]
        if (el) {
          gsap.from(el, { scale: 0.5, opacity: 0, duration: 0.35, ease: 'back.out(1.7)' })
        }
      }
    })
    prevFieldRef.current = [...field]
  })

  return (
    <div style={{
      height: 120,
      display: 'flex',
      gap: 4,
      padding: '4px 8px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 8,
      margin: '0 8px',
      flexShrink: 0,
    }}>
      {field.map((unit, slotIdx) => {
        if (unit) {
          // 타겟 가능 여부 계산
          let isValidTarget = false
          let isDimmed = false

          if (interaction === 'unit_selected' && side === 'ai') {
            // CRIT-4: 부모에서 전달된 attackerHasPierce로 pierce 판별
            if (hasTauntInAiField && !attackerHasPierce) {
              // 도발 유닛만 타겟 가능 (pierce 아닌 경우)
              const hasTaunt = [...unit.card.keywords, ...unit.temporaryKeywords].includes('taunt')
              isValidTarget = hasTaunt
              isDimmed = !hasTaunt
            } else {
              // pierce 공격자이거나 도발 없으면 모두 타겟 가능
              isValidTarget = true
              isDimmed = false
            }
          }

          if (interaction === 'spell_targeting' && side === 'ai') {
            isValidTarget = true
          }
          if (interaction === 'spell_targeting' && side === 'player') {
            isValidTarget = true
          }

          return (
            <div
              key={slotIdx}
              ref={el => { slotRefs.current[slotIdx] = el }}
              style={{ flex: 1, maxWidth: 84, display: 'flex' }}
            >
              <FieldUnitCard
                unit={unit}
                slotIdx={slotIdx}
                side={side}
                isSelected={isPlayerField && selectedUnitSlot === slotIdx}
                isValidAttackTarget={isValidTarget}
                isDimmed={isDimmed}
                onClick={onUnitClick ? () => onUnitClick(slotIdx) : undefined}
              />
            </div>
          )
        } else {
          // 빈 슬롯
          const isDropTarget = dragOverSlot === slotIdx
          const isSelectable = isPlayerField
            && selectedCardIndex !== null
            && interaction === 'card_selected'

          return (
            <EmptySlot
              key={slotIdx}
              slotIdx={slotIdx}
              side={side}
              isDropTarget={isDropTarget}
              isSelectable={isSelectable}
              onClick={isSelectable || isDropTarget ? () => onEmptySlotClick?.(slotIdx) : undefined}
              onDragOver={onDragOver ? (e) => onDragOver(e, slotIdx) : undefined}
              onDrop={onDrop ? (e) => onDrop(e, slotIdx) : undefined}
              onDragLeave={onDragLeave}
            />
          )
        }
      })}
    </div>
  )
}
