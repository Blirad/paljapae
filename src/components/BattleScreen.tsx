/**
 * 팔자전 — (6) 전투 화면
 * 4층 던전, 1층 turn-based
 * 핸드 8장 중 1~5장 출수
 */


import { useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'
import { FLOOR_CONFIGS } from '../engine/balance'

const ELEMENT_LABELS: Record<string, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}

const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#7A756A', su: '#3D5A80',
}

interface BattleScreenProps {
  onFloorClear: () => void
  onResult: (victory: boolean) => void
}

export default function BattleScreen({ onFloorClear, onResult }: BattleScreenProps) {
  const {
    currentFloor,
    playerHp,
    playerMaxHp,
    enemyHp,
    enemyMaxHp,
    hand,
    selectedCards,
    previewResult,
    discardsLeft,
    playsLeft,
    phase,
    isVictory,
    toggleCardSelect,
    playSelectedCards,
    discardSelectedCards,
  } = useGameStore()

  const floorConfig = FLOOR_CONFIGS[currentFloor - 1]

  // Phase 전환 처리
  useEffect(() => {
    if (phase === 'floor-reward') {
      onFloorClear()
    } else if (phase === 'result') {
      onResult(isVictory)
    }
  }, [phase, isVictory, onFloorClear, onResult])

  const enemyHpPercent = Math.max(0, (enemyHp / enemyMaxHp) * 100)
  const playerHpPercent = Math.max(0, (playerHp / playerMaxHp) * 100)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#16130F',
        overflow: 'hidden',
      }}
    >
      {/* 상단바: 층수·일진속성·체력 (6%) */}
      <div
        style={{
          backgroundColor: '#241F18',
          padding: '10px 16px',
          borderBottom: '1px solid #2A2620',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '6vh',
          minHeight: '48px',
        }}
      >
        <span style={{ color: '#B33A2B', fontSize: '13px', letterSpacing: '0.1em' }}>
          {currentFloor}층
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '80px', height: '6px',
              backgroundColor: '#2A2620', borderRadius: '3px', overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${playerHpPercent}%`, height: '100%',
                backgroundColor: '#4A9B6E',
                transition: 'width 0.3s',
              }}
            />
          </div>
          <span style={{ color: '#D8CCB4', fontSize: '12px' }}>{playerHp}/{playerMaxHp}</span>
        </div>
      </div>

      {/* 적 영역 (24%) */}
      <div
        style={{
          height: '24vh',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <div style={{ color: '#D8CCB4', fontSize: '15px', letterSpacing: '0.1em' }}>
          {floorConfig.enemyName}
        </div>
        <div style={{ width: '100%', maxWidth: '240px' }}>
          <div
            style={{
              width: '100%', height: '8px',
              backgroundColor: '#2A2620', borderRadius: '4px', overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${enemyHpPercent}%`, height: '100%',
                backgroundColor: '#C63D2F',
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div style={{ color: '#6A6560', fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
            {enemyHp} / {enemyMaxHp}
          </div>
        </div>
        {/* 반격 예고 */}
        <div style={{ color: '#4A4540', fontSize: '11px' }}>
          반격: {floorConfig.counterDamage} 피해
        </div>
      </div>

      {/* 족보 미리보기 (10%) */}
      <div
        style={{
          height: '10vh',
          minHeight: '56px',
          backgroundColor: previewResult ? '#241F18' : 'transparent',
          borderTop: '1px solid #2A2620',
          borderBottom: '1px solid #2A2620',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.15s',
        }}
      >
        {previewResult ? (
          <>
            <span style={{ color: '#D9A441', fontSize: '14px', fontWeight: 'bold' }}>
              {previewResult.description}
            </span>
            <span style={{ color: '#D8CCB4', fontSize: '13px' }}>
              {previewResult.baseScore} × {previewResult.multiplier} ={' '}
              <strong style={{ color: '#4A9B6E', fontSize: '16px' }}>{previewResult.totalScore}</strong>
            </span>
          </>
        ) : (
          <span style={{ color: '#4A4540', fontSize: '12px' }}>
            카드 선택 시 족보 표시
          </span>
        )}
      </div>

      {/* 핸드 부채꼴 (36%) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 8px 0 8px',
          overflowX: 'auto',
          gap: '4px',
        }}
      >
        {hand.map((card, idx) => {
          const isSelected = selectedCards.includes(card.id)
          const elColor = ELEMENT_COLORS[card.element]
          const totalCards = hand.length
          const midpoint = (totalCards - 1) / 2
          const angle = (idx - midpoint) * 5
          const w = 62
          const h = Math.round(w * 7 / 5)

          return (
            <button
              key={card.id}
              onClick={() => toggleCardSelect(card.id)}
              style={{
                width: w,
                height: h,
                backgroundColor: '#E8DCC4',
                border: `2px solid ${isSelected ? elColor : '#2A2620'}`,
                borderRadius: '2px',
                position: 'relative',
                cursor: 'pointer',
                transform: `rotate(${angle}deg) translateY(${isSelected ? -14 : 0}px)`,
                transition: 'transform 120ms ease-out, border-color 120ms ease-out',
                boxShadow: isSelected ? `0 0 6px ${elColor}` : 'none',
                flexShrink: 0,
                padding: 0,
              }}
            >
              <div style={{
                position: 'absolute', inset: '2px',
                border: `1px solid ${isSelected ? elColor : '#B33A2B'}`,
                opacity: isSelected ? 0.9 : 0.3,
                borderRadius: '1px',
              }} />
              <span style={{
                color: '#2A2620', fontSize: '17px', fontWeight: 'bold',
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
              }}>
                {card.value}
              </span>
              <span style={{
                color: elColor, fontSize: '11px',
                position: 'absolute', bottom: '4px', left: '50%',
                transform: 'translateX(-50%)',
              }}>
                {ELEMENT_LABELS[card.element]}
              </span>
              <span style={{
                color: '#6A6560', fontSize: '9px',
                position: 'absolute', top: '3px', right: '4px',
              }}>
                {card.polarity === 'yang' ? '●' : '○'}
              </span>
            </button>
          )
        })}
      </div>

      {/* 버리기·출수 버튼 (12%) */}
      <div
        style={{
          height: '12vh',
          minHeight: '64px',
          display: 'flex',
          gap: '8px',
          padding: '8px 16px',
          alignItems: 'center',
        }}
      >
        <button
          onClick={discardSelectedCards}
          disabled={selectedCards.length === 0 || discardsLeft <= 0}
          style={{
            flex: 1,
            height: '48px',
            backgroundColor: 'transparent',
            border: '1px solid #4A4540',
            color: discardsLeft <= 0 ? '#4A4540' : '#D8CCB4',
            fontSize: '14px',
            cursor: selectedCards.length === 0 || discardsLeft <= 0 ? 'not-allowed' : 'pointer',
            opacity: discardsLeft <= 0 ? 0.4 : 1,
            letterSpacing: '0.1em',
          }}
        >
          버리기 {discardsLeft}/3
        </button>
        <button
          onClick={playSelectedCards}
          disabled={selectedCards.length === 0 || playsLeft <= 0}
          style={{
            flex: 1,
            height: '48px',
            backgroundColor: selectedCards.length > 0 && playsLeft > 0 ? '#B33A2B' : '#2A2620',
            border: 'none',
            color: '#E8DCC4',
            fontSize: '14px',
            cursor: selectedCards.length === 0 || playsLeft <= 0 ? 'not-allowed' : 'pointer',
            opacity: playsLeft <= 0 ? 0.4 : 1,
            letterSpacing: '0.1em',
            transition: 'background-color 0.15s',
          }}
        >
          출수 {playsLeft}/{floorConfig.maxPlays}
        </button>
      </div>

      {/* 패시브 슬롯 (12%) */}
      <div
        style={{
          height: '12vh',
          minHeight: '56px',
          backgroundColor: '#1A1712',
          borderTop: '1px solid #2A2620',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '0 16px',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: '44px',
              height: '44px',
              border: '1px solid #2A2620',
              backgroundColor: '#241F18',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#2A2620', fontSize: '10px' }}>패</span>
          </div>
        ))}
      </div>
    </div>
  )
}
