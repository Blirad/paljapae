/**
 * DaewoonSlot — 대운 카드 4종 슬롯 컴포넌트 (리라 스펙 §1)
 * [E-2] 영역: PlayerStatusBar 아래, HandArea 위
 * 전투당 1회 제한, 사용 완료 시 grayscale + 使用 배너
 */

import React from 'react'
import type { GameState } from '@/types/game'

// ────────────────────────────────────────────────────
// 대운 카드 정의 (리라 스펙 §1 표)
// ────────────────────────────────────────────────────

interface DaewoonCardDef {
  key: keyof NonNullable<GameState['daewoonUsed']>
  name: string        // 한자 표기
  cost: number
  icon: string
  bgColor: string     // 오행 배경 색상
  tooltip: string
}

const DAEWOON_DEFS: DaewoonCardDef[] = [
  {
    key: 'daewoonje',
    name: '大運制',
    cost: 5,
    icon: '↺',
    bgColor: '#4A2080',
    tooltip: '이전 턴 상태로 되돌린다. 전투당 1회',
  },
  {
    key: 'seunJeonhwan',
    name: '歲運轉換',
    cost: 4,
    icon: '⟳',
    bgColor: '#206040',
    tooltip: '이번 턴 일진 오행을 변경. 전투당 1회',
  },
  {
    key: 'wolunGasok',
    name: '月運加速',
    cost: 3,
    icon: '⚡',
    bgColor: '#806020',
    tooltip: '다음 2턴 에너지 +2. 전투당 1회',
  },
  {
    key: 'siunJeongji',
    name: '時運停止',
    cost: 4,
    icon: '⏸',
    bgColor: '#204060',
    tooltip: '적의 다음 턴 스킵. 전투당 1회',
  },
]

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface DaewoonSlotProps {
  daewoonUsed: NonNullable<GameState['daewoonUsed']>
  currentEnergy: number
  phase: GameState['phase']
  isProcessing: boolean
  isAiTurn: boolean
  onUseDaewoon: (key: keyof NonNullable<GameState['daewoonUsed']>) => void
}

// ────────────────────────────────────────────────────
// DaewoonSlot
// ────────────────────────────────────────────────────

export default function DaewoonSlot({
  daewoonUsed,
  currentEnergy,
  phase,
  isProcessing,
  isAiTurn,
  onUseDaewoon,
}: DaewoonSlotProps): React.ReactElement {
  const isGlobalDisabled = isProcessing || isAiTurn || phase !== 'main'

  return (
    <div
      aria-label="대운 카드 슬롯"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(201,168,76,0.15)',
        flexShrink: 0,
        height: 64,
      }}
    >
      {/* 섹션 라벨 */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--gold)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        flexShrink: 0,
        writingMode: 'horizontal-tb',
      }}>
        大運
      </span>

      {/* 카드 버튼 4개 */}
      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
        {DAEWOON_DEFS.map(def => {
          const isUsed = daewoonUsed[def.key]
          const canAfford = currentEnergy >= def.cost
          const isDisabled = isGlobalDisabled || isUsed || !canAfford

          return (
            <button
              key={def.key}
              type="button"
              aria-label={`${def.name} — ${def.tooltip}`}
              title={def.tooltip}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) onUseDaewoon(def.key)
              }}
              style={{
                position: 'relative',
                width: 48,
                height: 52,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                background: isUsed
                  ? 'rgba(40,35,30,0.6)'
                  : 'rgba(30,25,20,0.8)',
                border: `1px solid ${isUsed ? 'rgba(100,90,80,0.3)' : 'rgba(201,168,76,0.3)'}`,
                borderRadius: 6,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: !canAfford && !isUsed ? 0.5 : 1,
                filter: isUsed ? 'grayscale(1) opacity(0.4)' : undefined,
                transition: 'transform 0.1s, border-color 0.15s, background 0.15s',
                flexShrink: 0,
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!isDisabled) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.15)'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)'
                }
              }}
              onMouseLeave={e => {
                if (!isDisabled) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,25,20,0.8)'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,0.3)'
                }
              }}
              onMouseDown={e => {
                if (!isDisabled) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.93)'
                }
              }}
              onMouseUp={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
              }}
            >
              {/* 오행 배경 원 + 아이콘 */}
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: def.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                lineHeight: 1,
                flexShrink: 0,
              }}>
                {def.icon}
              </div>

              {/* 비용 (우상단) */}
              <div style={{
                position: 'absolute',
                top: 2,
                right: 3,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: canAfford && !isUsed ? 'var(--gold)' : 'var(--text-muted)',
                lineHeight: 1,
              }}>
                {def.cost}
              </div>

              {/* 이름 */}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-primary)',
                textAlign: 'center',
                lineHeight: 1.2,
              }}>
                {def.name}
              </div>

              {/* 사용 완료 배너 */}
              {isUsed && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(180,30,30,0.7)',
                  transform: 'rotate(-20deg) scale(1.2)',
                  pointerEvents: 'none',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    letterSpacing: '0.05em',
                  }}>
                    使用
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
