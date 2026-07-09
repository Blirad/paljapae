/**
 * 팔자전 — (5) 출전준비 화면
 * 족보 미리보기 실시간 표시
 * "버리기 0/3, 출수 0/4" 표기 필수
 */

import { useState } from 'react'
import type { Card } from '../types/game'
import { judgeHand } from '../engine/pokerHandJudge'
import { BASE_DISCARDS } from '../engine/balance'

interface DeckPrepScreenProps {
  hand: Card[]
  onStartBattle: (selectedCards: Card[]) => void
}

const ELEMENT_LABELS: Record<string, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}

const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#7A756A', su: '#3D5A80',
}

export default function DeckPrepScreen({ hand, onStartBattle }: DeckPrepScreenProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [discardCount, setDiscardCount] = useState(0)
  const [currentHand, setCurrentHand] = useState<Card[]>(hand)

  const maxDiscards = BASE_DISCARDS
  const maxPlays = 4

  const toggleCard = (cardId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId)
      }
      if (prev.length >= 5) return prev  // 최대 5장
      return [...prev, cardId]
    })
  }

  const handleDiscard = () => {
    if (selectedIds.length === 0 || discardCount >= maxDiscards) return
    setCurrentHand(prev => prev.filter(c => !selectedIds.includes(c.id)))
    setDiscardCount(prev => prev + 1)
    setSelectedIds([])
  }

  const selectedCards = currentHand.filter(c => selectedIds.includes(c.id))
  const preview = selectedCards.length > 0 ? judgeHand(selectedCards) : null

  const handleStartBattle = () => {
    onStartBattle(currentHand)
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '0 0 24px 0' }}
    >
      {/* 상단바 */}
      <div
        style={{
          backgroundColor: '#241F18',
          padding: '16px 24px',
          borderBottom: '1px solid #2A2620',
        }}
      >
        <h2 style={{ color: '#E8DCC4', fontSize: '18px', letterSpacing: '0.15em', margin: 0 }}>
          출전 준비
        </h2>

        {/* 버리기/출수 카운터 — 필수 표기 */}
        <div className="flex gap-6 mt-2">
          <span style={{ color: '#D8CCB4', fontSize: '14px' }}>
            버리기 {discardCount}/{maxDiscards}
          </span>
          <span style={{ color: '#D8CCB4', fontSize: '14px' }}>
            출수 0/{maxPlays}
          </span>
        </div>
      </div>

      {/* 족보 미리보기 — 실시간 */}
      <div
        style={{
          minHeight: '48px',
          padding: '10px 24px',
          backgroundColor: preview ? '#241F18' : 'transparent',
          borderBottom: '1px solid #2A2620',
          transition: 'background-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {preview ? (
          <>
            <span style={{ color: '#D9A441', fontSize: '15px', fontWeight: 'bold' }}>
              {preview.description}
            </span>
            <span style={{ color: '#D8CCB4', fontSize: '14px' }}>
              {preview.baseScore} × {preview.multiplier} = <strong style={{ color: '#4A9B6E' }}>{preview.totalScore}</strong>
            </span>
          </>
        ) : (
          <span style={{ color: '#4A4540', fontSize: '13px' }}>카드를 선택하면 족보가 표시됩니다</span>
        )}
      </div>

      {/* 핸드 카드 */}
      <div
        className="flex flex-wrap justify-center gap-3 px-4 py-6"
        style={{ flex: 1 }}
      >
        {currentHand.map(card => {
          const isSelected = selectedIds.includes(card.id)
          const elColor = ELEMENT_COLORS[card.element]
          const w = 74
          const h = Math.round(w * 7 / 5)

          return (
            <button
              key={card.id}
              onClick={() => toggleCard(card.id)}
              style={{
                width: w,
                height: h,
                backgroundColor: '#E8DCC4',
                border: `2px solid ${isSelected ? elColor : '#2A2620'}`,
                borderRadius: '2px',
                position: 'relative',
                cursor: 'pointer',
                transform: isSelected ? 'translateY(-12px)' : 'none',
                transition: 'transform 120ms ease-out, border-color 120ms ease-out',
                boxShadow: isSelected ? `0 0 8px ${elColor}` : 'none',
                padding: 0,
              }}
            >
              {/* 주사 프레임 */}
              <div style={{
                position: 'absolute', inset: '3px',
                border: `1px solid ${isSelected ? elColor : '#B33A2B'}`,
                borderRadius: '1px',
                opacity: isSelected ? 0.8 : 0.3,
              }} />
              {/* 값 */}
              <span style={{
                color: '#2A2620', fontSize: '20px', fontWeight: 'bold',
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
              }}>
                {card.value}
              </span>
              {/* 오행 */}
              <span style={{
                color: elColor, fontSize: '13px',
                position: 'absolute', bottom: '5px', left: '50%',
                transform: 'translateX(-50%)',
              }}>
                {ELEMENT_LABELS[card.element]}
              </span>
              {/* 음양 */}
              <span style={{
                color: '#6A6560', fontSize: '10px',
                position: 'absolute', top: '4px', right: '5px',
              }}>
                {card.polarity === 'yang' ? '●' : '○'}
              </span>
            </button>
          )
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="flex flex-col gap-3 px-6">
        <button
          onClick={handleDiscard}
          disabled={selectedIds.length === 0 || discardCount >= maxDiscards}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #4A4540',
            color: discardCount >= maxDiscards ? '#4A4540' : '#D8CCB4',
            padding: '14px',
            fontSize: '14px',
            letterSpacing: '0.1em',
            cursor: selectedIds.length === 0 || discardCount >= maxDiscards ? 'not-allowed' : 'pointer',
            width: '100%',
            minHeight: '48px',
            opacity: discardCount >= maxDiscards ? 0.4 : 1,
          }}
        >
          버리기 ({discardCount}/{maxDiscards})
        </button>

        <button
          onClick={handleStartBattle}
          className="transition-all duration-150 active:scale-95"
          style={{
            backgroundColor: '#B33A2B',
            border: 'none',
            color: '#E8DCC4',
            padding: '18px',
            fontSize: '16px',
            letterSpacing: '0.2em',
            cursor: 'pointer',
            width: '100%',
            minHeight: '56px',
          }}
        >
          전투 시작
        </button>
      </div>
    </div>
  )
}
