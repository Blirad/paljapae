/**
 * FieldArea — AI/플레이어 필드 영역 (4슬롯)
 * 리라 스펙 §2-2 [C] [D]
 * STS 강화: 소환 3단계 타임라인 + 사망 emitDeathEffect (리라 스펙 §1-B, §4)
 */

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { FieldUnit } from '@/types/cards'
import FieldUnitCard from './FieldUnitCard'
import EmptySlot from './EmptySlot'
import type { InteractionState } from '@/game/store/battleStore'
import type { FiveElement } from '@/types/elements'
import { emitSummonRing } from './SummonRing'
import { PARTICLE_COLORS } from '@/utils/battleColors'

// 오행별 필드 배경 오버레이 컬러 (rgba, opacity 0.06)
const FIELD_BG_OVERLAY: Record<FiveElement, string> = {
  '木': 'rgba(126,200,122,0.06)',
  '火': 'rgba(255,140,90,0.06)',
  '土': 'rgba(240,200,74,0.06)',
  '金': 'rgba(200,228,248,0.06)',
  '水': 'rgba(100,200,248,0.06)',
}

// ────────────────────────────────────────────────────
// 사망 이펙트 함수 (DOM 직접 생성, 리라 스펙 §4-B)
// ────────────────────────────────────────────────────

function emitDeathEffect(slotEl: HTMLElement, element: FiveElement): void {
  const colors = PARTICLE_COLORS[element]
  const rect = slotEl.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // 파티클 16개 방사
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div')
    const color = colors[i % colors.length]
    const size = 2 + Math.random() * 4
    p.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      left: ${cx}px;
      top: ${cy}px;
      pointer-events: none;
      z-index: 53;
    `
    document.body.appendChild(p)
    const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.8
    const dist = 30 + Math.random() * 50
    gsap.to(p, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 20,
      opacity: 0,
      duration: 0.35 + Math.random() * 0.2,
      ease: 'power2.out',
      onComplete: () => {
        if (document.body.contains(p)) document.body.removeChild(p)
      },
    })
  }

  // 흰 flash 원
  const flash = document.createElement('div')
  flash.style.cssText = `
    position: fixed;
    left: ${cx}px;
    top: ${cy}px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: white;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 54;
  `
  document.body.appendChild(flash)
  gsap.to(flash, {
    scale: 5,
    opacity: 0,
    duration: 0.25,
    ease: 'power2.out',
    onComplete: () => {
      if (document.body.contains(flash)) document.body.removeChild(flash)
    },
  })
}

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
  playerElement?: FiveElement
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
  playerElement,
}: FieldAreaProps): React.ReactElement {
  const isPlayerField = side === 'player'

  // 소환/사망 애니메이션: 슬롯별 ref + 이전 유닛 추적
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const prevFieldRef = useRef<(FieldUnit | null)[]>([])

  useEffect(() => {
    field.forEach((unit, slotIdx) => {
      const prevUnit = prevFieldRef.current[slotIdx]
      const wasEmpty = prevUnit == null
      const nowHasUnit = unit != null
      const wasUnit = prevUnit != null
      const nowEmpty = unit == null

      // 소환 감지 → 3단계 타임라인 (리라 스펙 §1-B)
      if (wasEmpty && nowHasUnit) {
        const el = slotRefs.current[slotIdx]
        if (el) {
          // perspective 적용 (rotationX용)
          el.style.perspective = '400px'

          const tl = gsap.timeline()
          // 1단계: 위에서 낙하 + 임팩트
          tl.fromTo(el,
            { scale: 0.7, opacity: 0, y: -60, rotationX: 20 },
            { scale: 1.15, opacity: 1, y: 0, rotationX: 0, duration: 0.22, ease: 'power3.out' },
          )
          // 2단계: 착지 바운스 + 소환진 링 emit
          .to(el, {
            scale: 1.0,
            duration: 0.18,
            ease: 'back.out(2.0)',
            onStart: () => {
              // 소환진 링 폭발
              emitSummonRing(el, playerElement ? getElementColor(playerElement) : '#C9A84C')
              // 파티클 12개 (BattleParticles와 독립적으로 DOM 직접 생성)
              emitSummonParticles(el, playerElement ?? '火')
            },
          })
        }
      }

      // 사망 감지 → emitDeathEffect (리라 스펙 §4-A)
      if (wasUnit && nowEmpty) {
        const el = slotRefs.current[slotIdx]
        if (el) {
          emitDeathEffect(el, prevUnit!.card.element ?? playerElement ?? '火')
        }
      }
    })
    prevFieldRef.current = [...field]
  })

  const overlayBg = playerElement ? FIELD_BG_OVERLAY[playerElement] : 'rgba(255,255,255,0.02)'

  return (
    <div style={{
      height: 150,
      display: 'flex',
      gap: 6,
      padding: '4px 8px',
      background: overlayBg,
      borderRadius: 4,
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
              style={{ flex: 1, maxWidth: 88, display: 'flex' }}
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

// ────────────────────────────────────────────────────
// 내부 헬퍼
// ────────────────────────────────────────────────────

function getElementColor(element: FiveElement): string {
  const colors: Record<FiveElement, string> = {
    '木': '#7EC87A',
    '火': '#FF8C5A',
    '土': '#F0C84A',
    '金': '#C8E4F8',
    '水': '#64C8F8',
  }
  return colors[element]
}

// 소환 파티클 12개 (리라 스펙 §1-B 4단계)
function emitSummonParticles(slotEl: HTMLElement, element: FiveElement): void {
  const colors = PARTICLE_COLORS[element]
  const rect = slotEl.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div')
    const color = colors[i % colors.length]
    const size = 2 + Math.random() * 3
    p.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      left: ${cx}px;
      top: ${cy}px;
      pointer-events: none;
      z-index: 52;
    `
    document.body.appendChild(p)
    const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.6
    const dist = 20 + Math.random() * 35
    gsap.to(p, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 15,
      opacity: 0,
      duration: 0.3 + Math.random() * 0.2,
      ease: 'power2.out',
      onComplete: () => {
        if (document.body.contains(p)) document.body.removeChild(p)
      },
    })
  }
}
