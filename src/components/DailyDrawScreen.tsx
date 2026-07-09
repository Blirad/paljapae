/**
 * 팔자전 — (4) 일일뽑기 화면
 * 고정 임시 덱만. 영웅 선택 화면 금지.
 * 카드 8장 노출
 */

import { useState } from 'react'
import type { Card } from '../types/game'
import { createFixedDeck, shuffleDeck } from '../engine/paljajeonEngine'
import { audioManager } from '../services/audioManager'

interface DailyDrawScreenProps {
  onProceed: (cards: Card[]) => void
}

const ELEMENT_LABELS: Record<string, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}

const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#7A756A', su: '#3D5A80',
}

function CardVisual({ card, size = 'md' }: { card: Card; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 52 : 74
  const h = Math.round(w * 7 / 5)
  const elColor = ELEMENT_COLORS[card.element]

  return (
    <div
      style={{
        width: w,
        height: h,
        backgroundColor: '#E8DCC4',
        border: `2px solid #2A2620`,
        borderRadius: '2px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {/* 주사 테두리 */}
      <div style={{
        position: 'absolute', inset: '3px',
        border: `1px solid ${elColor}`,
        borderRadius: '1px',
        opacity: 0.4,
      }} />
      {/* 값 */}
      <span style={{ color: '#2A2620', fontSize: size === 'sm' ? '14px' : '18px', fontWeight: 'bold' }}>
        {card.value}
      </span>
      {/* 오행 한자 */}
      <span style={{ color: elColor, fontSize: size === 'sm' ? '11px' : '14px', position: 'absolute', bottom: '4px' }}>
        {ELEMENT_LABELS[card.element]}
      </span>
      {/* 음양 */}
      <span style={{ color: '#6A6560', fontSize: '10px', position: 'absolute', top: '4px', right: '4px' }}>
        {card.polarity === 'yang' ? '●' : '○'}
      </span>
    </div>
  )
}

export default function DailyDrawScreen({ onProceed }: DailyDrawScreenProps) {
  const [drawn, setDrawn] = useState<Card[]>([])
  const [shaking, setShaking] = useState(false)

  const handleShake = () => {
    if (shaking) return
    setShaking(true)
    // 산가지통 흔들기 사운드 (Sound #12 — 최우선 품질)
    audioManager.diviningRodShake()
    setTimeout(() => {
      const deck = shuffleDeck(createFixedDeck(), Date.now())
      setDrawn(deck.slice(0, 8))
      setShaking(false)
    }, 600)
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '40px 24px' }}
    >
      <h2
        className="text-center"
        style={{ color: '#E8DCC4', fontSize: '20px', letterSpacing: '0.15em', marginTop: '24px' }}
      >
        일일 뽑기
      </h2>

      {/* 산가지통 */}
      <div className="flex justify-center mt-12">
        <button
          onClick={handleShake}
          disabled={drawn.length > 0}
          className="flex flex-col items-center gap-3"
          style={{
            background: 'none',
            border: 'none',
            cursor: drawn.length > 0 ? 'default' : 'pointer',
            opacity: drawn.length > 0 ? 0.4 : 1,
          }}
        >
          {/* 통 */}
          <div
            style={{
              width: '80px', height: '120px',
              border: '2px solid #B33A2B',
              backgroundColor: '#241F18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: shaking ? 'rotate(5deg)' : 'none',
              transition: 'transform 0.1s',
            }}
          >
            <span style={{ color: '#B33A2B', fontSize: '28px' }}>筮</span>
          </div>
          <span style={{ color: '#D8CCB4', fontSize: '13px', letterSpacing: '0.1em' }}>
            {drawn.length > 0 ? '뽑기 완료' : '흔들기'}
          </span>
        </button>
      </div>

      {/* 뽑힌 카드 8장 */}
      {drawn.length > 0 && (
        <>
          <div className="flex flex-wrap justify-center gap-2 mt-10">
            {drawn.map(card => (
              <CardVisual key={card.id} card={card} />
            ))}
          </div>

          <button
            onClick={() => onProceed(drawn)}
            className="mt-8 transition-all duration-150 active:scale-95"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #B33A2B',
              color: '#E8DCC4',
              padding: '18px',
              fontSize: '15px',
              letterSpacing: '0.2em',
              cursor: 'pointer',
              width: '100%',
              minHeight: '56px',
            }}
          >
            출전준비
          </button>
        </>
      )}
    </div>
  )
}
