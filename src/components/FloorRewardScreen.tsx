/**
 * 팔자전 — (7) 층간보상 화면
 * 카드 선택 보상 / 다음 층 안내
 */

import { useState } from 'react'
import { FLOOR_CONFIGS } from '../engine/balance'

interface FloorRewardScreenProps {
  currentFloor: number
  onProceed: () => void
}

const REWARD_OPTIONS = [
  { label: '카드 획득', desc: '덱에 새 카드 추가' },
  { label: '카드 강화', desc: '기존 카드 값 +2' },
  { label: '유물 획득', desc: '런 한정 특수 효과' },
]

export default function FloorRewardScreen({ currentFloor, onProceed }: FloorRewardScreenProps) {
  const [chosen, setChosen] = useState<number | null>(null)
  const nextFloor = currentFloor + 1
  const isLastFloor = currentFloor >= 4
  const nextConfig = !isLastFloor ? FLOOR_CONFIGS[nextFloor - 1] : null

  const handleChoose = (i: number) => {
    setChosen(i)
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '40px 24px' }}
    >
      <div className="text-center mt-8">
        <div style={{ color: '#B33A2B', fontSize: '12px', letterSpacing: '0.3em' }}>
          {currentFloor}층 클리어
        </div>
        <h2 style={{ color: '#E8DCC4', fontSize: '22px', letterSpacing: '0.15em', margin: '12px 0 0' }}>
          보상 선택
        </h2>
      </div>

      {/* 보상 선택지 */}
      <div className="flex flex-col gap-4 mt-10">
        {REWARD_OPTIONS.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleChoose(i)}
            style={{
              backgroundColor: chosen === i ? '#241F18' : 'transparent',
              border: `1px solid ${chosen === i ? '#B33A2B' : '#2A2620'}`,
              color: '#E8DCC4',
              padding: '20px 24px',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '15px', letterSpacing: '0.1em', marginBottom: '4px' }}>
              {opt.label}
            </div>
            <div style={{ color: '#6A6560', fontSize: '12px' }}>
              {opt.desc}
            </div>
          </button>
        ))}
      </div>

      {/* 다음 층 안내 */}
      {nextConfig && (
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#1A1712',
            border: '1px solid #2A2620',
          }}
        >
          <div style={{ color: '#4A4540', fontSize: '11px', letterSpacing: '0.2em' }}>
            다음 층
          </div>
          <div style={{ color: '#D8CCB4', fontSize: '14px', marginTop: '4px' }}>
            {nextFloor}층 — {nextConfig.enemyName}
          </div>
          <div style={{ color: '#6A6560', fontSize: '12px', marginTop: '2px' }}>
            체력 {nextConfig.enemyHp} · 반격 {nextConfig.counterDamage} · 공격 {nextConfig.maxPlays}회
          </div>
        </div>
      )}

      {/* 진행 버튼 */}
      <button
        onClick={onProceed}
        disabled={chosen === null}
        className="mt-8 transition-all duration-150 active:scale-95"
        style={{
          backgroundColor: chosen !== null ? '#B33A2B' : '#2A2620',
          border: 'none',
          color: '#E8DCC4',
          padding: '18px',
          fontSize: '15px',
          letterSpacing: '0.2em',
          cursor: chosen === null ? 'not-allowed' : 'pointer',
          width: '100%',
          minHeight: '56px',
          opacity: chosen === null ? 0.5 : 1,
          transition: 'background-color 0.15s',
        }}
      >
        {isLastFloor ? '결과 보기' : `${nextFloor}층으로 진격`}
      </button>
    </div>
  )
}
