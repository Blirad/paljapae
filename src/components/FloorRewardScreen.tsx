/**
 * 팔자전 — (7) 층간보상 화면
 * 카드 선택 보상 / 유물 획득 / 다음 층 안내
 * T8: 유물 4종 풀 중 3개 노출 복원
 */

import { useState, useMemo } from 'react'
import { FLOOR_CONFIGS, RELIC_DEFS, ALL_RELIC_IDS } from '../engine/balance'
import type { RelicId } from '../engine/balance'

interface FloorRewardScreenProps {
  currentFloor: number
  currentRelicIds: string[]  // 이미 보유 중인 유물 ID 목록 (중복 차단용)
  onProceed: (rewardIndex: number, selectedRelicId?: string) => void
}

// T8: 카드 보상 3종 + 유물 1종 = 총 4종 풀 (유물은 별도 선택)
const CARD_REWARD_TYPES = [
  { type: 'add-card', label: '카드 획득', desc: '덱에 새 카드 추가', icon: '🃏' },
  { type: 'upgrade-card', label: '카드 강화', desc: '카드 값 ×1.5', icon: '⬆' },
  { type: 'remove-card', label: '카드 제거', desc: '약한 카드 제거', icon: '✂' },
]

const ELEMENT_LABELS: Record<string, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}

const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}

export default function FloorRewardScreen({ currentFloor, currentRelicIds, onProceed }: FloorRewardScreenProps) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [chosenRelicId, setChosenRelicId] = useState<string | null>(null)
  const nextFloor = currentFloor + 1
  const isLastFloor = currentFloor >= 4
  const nextConfig = !isLastFloor ? FLOOR_CONFIGS[nextFloor - 1] : null

  // T8: 유물 보상 — 미보유 유물 중 층별 결정론적 셔플로 3개 선택
  const availableRelics = useMemo(() => {
    const unowned = ALL_RELIC_IDS.filter(id => !currentRelicIds.includes(id))
    if (unowned.length === 0) return []

    // 층별 결정론적 LCG 난수
    let rng = currentFloor * 54321 + 9999
    const nextRandom = () => {
      rng = (rng * 1664525 + 1013904223) & 0xffffffff
      return (rng >>> 0) / 0xffffffff
    }
    const shuffled = [...unowned]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, 3).map(id => RELIC_DEFS[id as RelicId])
  }, [currentFloor, currentRelicIds])

  // 카드 보상 3개 (유물 없으면 3개 모두 카드, 유물 있으면 2카드+1유물 or 표시)
  // T8 스펙: 4종 풀 중 3개 선택 → 항상 4종(카드3+유물1풀) 중 3개 추출
  const rewardOptions = useMemo(() => {
    let rng = currentFloor * 12345 + 6789
    const nextRandom = () => {
      rng = (rng * 1664525 + 1013904223) & 0xffffffff
      return (rng >>> 0) / 0xffffffff
    }

    // 풀: 카드 보상 3종 + 유물(미보유 있는 경우)
    const pool: Array<{ type: string; label: string; desc: string; icon: string; relicId?: string }> = [
      ...CARD_REWARD_TYPES,
    ]
    if (availableRelics.length > 0) {
      // 유물 보상 옵션 1개 (availableRelics 중 첫 번째)
      const relic = availableRelics[0]
      pool.push({
        type: 'add-relic',
        label: `유물: ${relic.name}`,
        desc: relic.description,
        icon: relic.icon,
        relicId: relic.id,
      })
    }

    // Fisher-Yates 셔플 후 3개 선택
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, 3)
  }, [currentFloor, availableRelics])

  const handleChoose = (i: number) => {
    setChosen(i)
    const opt = rewardOptions[i]
    if (opt.type === 'add-relic' && opt.relicId) {
      setChosenRelicId(opt.relicId)
    } else {
      setChosenRelicId(null)
    }
  }

  const handleProceed = () => {
    if (chosen === null) return
    const opt = rewardOptions[chosen]
    const rewardTypeIndex = ['add-card', 'upgrade-card', 'remove-card', 'add-relic'].indexOf(opt.type)
    onProceed(rewardTypeIndex, chosenRelicId ?? undefined)
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
        {rewardOptions.map((opt, i) => {
          const isRelic = opt.type === 'add-relic'
          return (
            <button
              key={i}
              onClick={() => handleChoose(i)}
              style={{
                backgroundColor: chosen === i ? '#241F18' : 'transparent',
                border: `1px solid ${chosen === i ? (isRelic ? '#D9A441' : '#B33A2B') : '#2A2620'}`,
                color: '#E8DCC4',
                padding: '20px 24px',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                transition: 'all 0.15s',
                borderRadius: '2px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '18px' }}>{opt.icon}</span>
                <span style={{
                  fontSize: '15px',
                  letterSpacing: '0.1em',
                  color: isRelic ? '#D9A441' : '#E8DCC4',
                  fontWeight: isRelic ? 600 : 400,
                }}>
                  {opt.label}
                </span>
                {isRelic && (
                  <span style={{
                    fontSize: '10px',
                    color: '#B33A2B',
                    border: '1px solid #4A2020',
                    padding: '1px 5px',
                    letterSpacing: '0.1em',
                  }}>
                    유물
                  </span>
                )}
              </div>
              <div style={{ color: '#6A6560', fontSize: '12px', paddingLeft: '28px' }}>
                {opt.desc}
              </div>
            </button>
          )
        })}
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
        onClick={handleProceed}
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
