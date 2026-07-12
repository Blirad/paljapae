/**
 * 팔자전 — (7) 층간보상 화면
 * 카드 선택 보상 / 다음 층 안내
 */

import { useState, useMemo } from 'react'
import { FLOOR_CONFIGS } from '../engine/balance'

interface FloorRewardScreenProps {
  currentFloor: number
  onProceed: (rewardIndex: number) => void
}

// T8: 유물 획득(add-relic)은 미구현 상태 — 헛클릭 방지를 위해 목록에서 제거
// 재구현 완료 후(applyRewardOption relic 로직 + 전투 아이콘 표시) 복원할 것
const ALL_REWARD_TYPES = [
  { type: 'add-card', label: '카드 획득', desc: '덱에 새 카드 추가' },
  { type: 'upgrade-card', label: '카드 강화', desc: '카드 값 ×1.5' },
  { type: 'remove-card', label: '카드 제거', desc: '약한 카드 제거' },
]

const ELEMENT_LABELS: Record<string, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}

const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}

export default function FloorRewardScreen({ currentFloor, onProceed }: FloorRewardScreenProps) {
  const [chosen, setChosen] = useState<number | null>(null)
  const nextFloor = currentFloor + 1
  const isLastFloor = currentFloor >= 4
  const nextConfig = !isLastFloor ? FLOOR_CONFIGS[nextFloor - 1] : null

  // 균등 확률로 4개 중 3개 선택 (randomize per floor, seed-based for reproducibility)
  const REWARD_OPTIONS = useMemo(() => {
    const seed = currentFloor * 12345  // 층별 고정 시드
    const shuffled = [...ALL_REWARD_TYPES]
      .sort((a, b) => {
        const aHash = a.type.charCodeAt(0) + seed
        const bHash = b.type.charCodeAt(0) + seed
        return aHash - bHash
      })
      .slice(0, 3)
    return shuffled
  }, [currentFloor])

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
          <div style={{ color: '#6A6560', fontSize: '12px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
            <div>체력 {nextConfig.enemyHp} · 반격 {nextConfig.counterDamage} · 공격 {nextConfig.maxPlays}회</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#4A4540' }}>적:</span>
              <span style={{ fontSize: '14px', color: ELEMENT_COLORS[nextConfig.enemyPrimaryElement], fontWeight: 'bold' }}>
                {ELEMENT_LABELS[nextConfig.enemyPrimaryElement]}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 진행 버튼 */}
      <button
        onClick={() => chosen !== null && onProceed(chosen)}
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
