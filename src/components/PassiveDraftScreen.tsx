/**
 * 팔자전 — 패시브 드래프트 화면 (런 시작 시)
 *
 * 3-C: 4개 패시브 제시 → 2개 선택 → 5칸 슬롯 배치
 *
 * UI:
 *  [패시브 이름 · 효과]    [패시브 이름 · 효과]
 *  [패시브 이름 · 효과]    [패시브 이름 · 효과]
 *
 *       [2개 선택] 버튼
 *
 * 선택 후 onComplete(selectedPassives) 콜백 호출
 */

import { useState, useMemo } from 'react'
import type { Passive } from '../types/passive'
import { PASSIVE_POOL, PASSIVE_RARITY_COLORS, PASSIVE_RARITY_BORDER, PASSIVE_RARITY_LABEL } from '../types/passive'

interface PassiveDraftScreenProps {
  onComplete: (selected: Passive[]) => void
  seed?: number  // 랜덤 시드 (Date.now() 사용)
}

/** 간단한 LCG 랜덤으로 풀에서 4개 추출 */
function pickRandom4Passives(seed: number): Passive[] {
  let s = seed
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }

  const pool = [...PASSIVE_POOL]
  const picked: Passive[] = []
  for (let i = 0; i < 4 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length)
    picked.push(pool[idx])
    pool.splice(idx, 1)
  }
  return picked
}

/** 패시브 카드 (선택 가능) */
function DraftCard({
  passive,
  isSelected,
  isDisabled,
  onClick,
}: {
  passive: Passive
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
}) {
  const rarityColor = PASSIVE_RARITY_COLORS[passive.rarity]
  const borderColor = isSelected
    ? '#D9A441'
    : isDisabled
    ? '#2A2620'
    : PASSIVE_RARITY_BORDER[passive.rarity]

  return (
    <button
      onClick={onClick}
      disabled={isDisabled && !isSelected}
      style={{
        width: '100%',
        backgroundColor: isSelected ? 'rgba(217,164,65,0.12)' : '#1C1710',
        border: `2px solid ${borderColor}`,
        borderRadius: '2px',
        padding: '16px 14px',
        cursor: isDisabled && !isSelected ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        opacity: isDisabled && !isSelected ? 0.4 : 1,
        position: 'relative',
        minHeight: '96px',
      }}
    >
      {/* 등급 뱃지 */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '10px',
          fontSize: '10px',
          color: rarityColor,
          letterSpacing: '0.05em',
        }}
      >
        {PASSIVE_RARITY_LABEL[passive.rarity]}
      </div>

      {/* 선택 표시 */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '10px',
            fontSize: '10px',
            color: '#D9A441',
            letterSpacing: '0.1em',
          }}
        >
          ✓
        </div>
      )}

      {/* 패시브 이름 */}
      <div
        style={{
          color: isSelected ? '#D9A441' : rarityColor,
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '0.08em',
          marginBottom: '6px',
          marginTop: '4px',
        }}
      >
        {passive.name}
      </div>

      {/* 효과 설명 */}
      <div
        style={{
          color: '#8A8075',
          fontSize: '11px',
          lineHeight: '1.5',
          letterSpacing: '0.04em',
        }}
      >
        {passive.effect}
      </div>
    </button>
  )
}

export default function PassiveDraftScreen({ onComplete, seed }: PassiveDraftScreenProps) {
  const offered = useMemo(
    () => pickRandom4Passives(seed ?? Date.now()),
    [seed]
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const MAX_SELECT = 2

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= MAX_SELECT) return prev
      return [...prev, id]
    })
  }

  const handleConfirm = () => {
    const selected = offered.filter(p => selectedIds.includes(p.id))
    onComplete(selected)
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '40px 24px' }}
    >
      {/* 제목 */}
      <h2
        className="text-center"
        style={{
          color: '#D9A441',
          fontSize: '16px',
          letterSpacing: '0.2em',
          marginTop: '24px',
          marginBottom: '8px',
        }}
      >
        패시브 선택
      </h2>
      <p
        className="text-center"
        style={{
          color: '#6A6560',
          fontSize: '12px',
          letterSpacing: '0.1em',
          marginBottom: '32px',
        }}
      >
        2개를 선택하세요 ({selectedIds.length}/{MAX_SELECT})
      </p>

      {/* 2×2 그리드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          maxWidth: '400px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {offered.map(passive => (
          <DraftCard
            key={passive.id}
            passive={passive}
            isSelected={selectedIds.includes(passive.id)}
            isDisabled={selectedIds.length >= MAX_SELECT && !selectedIds.includes(passive.id)}
            onClick={() => toggleSelect(passive.id)}
          />
        ))}
      </div>

      {/* 확인 버튼 */}
      <div style={{ maxWidth: '400px', width: '100%', margin: '32px auto 0' }}>
        <button
          onClick={handleConfirm}
          disabled={selectedIds.length < MAX_SELECT}
          className="transition-all duration-150 active:scale-95"
          style={{
            backgroundColor: selectedIds.length >= MAX_SELECT ? 'transparent' : '#1C1710',
            border: `1px solid ${selectedIds.length >= MAX_SELECT ? '#B33A2B' : '#2A2620'}`,
            color: selectedIds.length >= MAX_SELECT ? '#E8DCC4' : '#4A4540',
            padding: '18px',
            fontSize: '14px',
            letterSpacing: '0.2em',
            cursor: selectedIds.length >= MAX_SELECT ? 'pointer' : 'not-allowed',
            width: '100%',
            minHeight: '56px',
          }}
          onMouseEnter={e => {
            if (selectedIds.length >= MAX_SELECT) {
              (e.target as HTMLButtonElement).style.backgroundColor = '#B33A2B'
            }
          }}
          onMouseLeave={e => {
            if (selectedIds.length >= MAX_SELECT) {
              (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'
            }
          }}
        >
          {selectedIds.length >= MAX_SELECT ? '출전 준비' : `${MAX_SELECT - selectedIds.length}개 더 선택하세요`}
        </button>
      </div>

      {/* 하단 장식 */}
      <div className="mt-auto text-center pb-8">
        <div style={{ color: '#2A2620', fontSize: '11px', letterSpacing: '0.1em' }}>
          팔자전 八字戰 · Phase 1
        </div>
      </div>
    </div>
  )
}
