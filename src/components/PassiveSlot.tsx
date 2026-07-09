/**
 * 팔자전 — 패시브 슬롯 컴포넌트
 *
 * 3-A: 하단 슬롯 5칸에 장착된 패시브를 실제 카드로 표시
 *  - 각 카드: 이름 + 효과 1줄 + 등급별 색상
 *  - 빈 슬롯: "+추가" 안내
 *  - 발동 순간: 플래시 애니메이션 (flashCardId 매칭 시)
 */

import type { Passive } from '../types/passive'
import { PASSIVE_RARITY_COLORS, PASSIVE_RARITY_BORDER, PASSIVE_RARITY_LABEL } from '../types/passive'

interface PassiveSlotProps {
  passives: (Passive | null)[]     // 최대 5개 (null = 빈 슬롯)
  flashCardId?: string | null      // 발동 중인 패시브 id
  maxSlots?: number
}

/** 패시브 카드 단일 렌더링 */
function PassiveCard({
  passive,
  isFlashing,
}: {
  passive: Passive
  isFlashing: boolean
}) {
  const rarityColor = PASSIVE_RARITY_COLORS[passive.rarity]
  const borderColor = PASSIVE_RARITY_BORDER[passive.rarity]

  return (
    <div
      style={{
        width: '56px',
        height: '72px',
        backgroundColor: isFlashing ? 'rgba(255,255,255,0.9)' : '#1C1710',
        border: `1px solid ${isFlashing ? '#FFFFFF' : borderColor}`,
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 3px',
        gap: '2px',
        position: 'relative',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        boxShadow: isFlashing ? '0 0 12px 4px rgba(255,255,255,0.7)' : 'none',
        cursor: 'default',
        flexShrink: 0,
      }}
    >
      {/* 등급 표시 (좌상단) */}
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
        {PASSIVE_RARITY_LABEL[passive.rarity]}
      </div>

      {/* 패시브 이름 */}
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

      {/* 효과 1줄 */}
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
}

/** 빈 슬롯 */
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

/** 패시브 발동 배너 (중앙 띠) */
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

export default function PassiveSlot({ passives, flashCardId, maxSlots = 5 }: PassiveSlotProps) {
  // 슬롯을 maxSlots까지 null로 채우기
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
      {slots.map((passive, i) =>
        passive ? (
          <PassiveCard
            key={passive.id}
            passive={passive}
            isFlashing={flashCardId === passive.id}
          />
        ) : (
          <EmptySlot key={`empty-${i}`} />
        )
      )}
    </div>
  )
}
