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
  currentSinsalInventory?: string[]  // 이미 소지 중인 신살 ID 목록 (상한 체크용)
  runSeed?: number  // 감사1(2026-07-22): 런별 시드(rngState) — 매 런 다른 보상 조합 보장
  onProceed: (rewardIndex: number, selectedRelicId?: string, selectedSinsalId?: string) => void
}

/**
 * 감사1 (2026-07-22): 층 보상 추첨 시드 fair-mix.
 * 기존 `currentFloor * 12345 + 6789`는 currentFloor(1~4)에만 의존 → 시드 4종 고정 →
 * add-sinsal이 4개 시드 모두에서 탈락해 실게임 등장률 0% 고착 (SINSAL_REWARD_DRAWRATE 진단).
 *
 * 정본: runSeed(런 rngState) ^ (floor * 2654435761) + rewardIndex * 1103515245 로 혼합.
 * → 매 런 다른 결과, 층별 다른 결과, 보상 인덱스별 다른 결과 보장.
 * 32비트 부호 없는 정수로 정규화하여 LCG 초기 상태로 사용.
 */
export function mixRewardSeed(runSeed: number, floor: number, rewardIndex: number): number {
  const mixed = ((runSeed ^ Math.imul(floor, 2654435761)) + Math.imul(rewardIndex, 1103515245)) | 0
  return mixed >>> 0
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

export default function FloorRewardScreen({ currentFloor, currentRelicIds, currentSinsalInventory, runSeed = 0, onProceed }: FloorRewardScreenProps) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [chosenRelicId, setChosenRelicId] = useState<string | null>(null)
  const [chosenSinsalId, setChosenSinsalId] = useState<string | null>(null)
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

  // 카드 보상 3개 (유물 없으면 3개 모두 카드, 유물/신살 있으면 경쟁)
  // §3 신살: 화개 보상이 가중치 15%로 풀에 추가 (소지 상한 3 미만 시)
  const rewardOptions = useMemo(() => {
    // 감사1: 런별 시드 fair-mix (rewardIndex=0 기준 — 층 보상 1회 추첨)
    let rng = mixRewardSeed(runSeed, currentFloor, 0)
    const nextRandom = () => {
      rng = (rng * 1664525 + 1013904223) & 0xffffffff
      return (rng >>> 0) / 0xffffffff
    }

    // 풀: 카드 보상 3종 + 유물(미보유 있는 경우) + 신살(소지 상한 미만 시)
    const pool: Array<{ type: string; label: string; desc: string; icon: string; relicId?: string; sinsalId?: string; weight: number }> = [
      ...CARD_REWARD_TYPES.map(r => ({ ...r, weight: 1.0 })),
    ]
    if (availableRelics.length > 0) {
      const relic = availableRelics[0]
      pool.push({
        type: 'add-relic',
        label: `유물: ${relic.name}`,
        desc: relic.description,
        icon: relic.icon,
        relicId: relic.id,
        weight: 1.0,
      })
    }
    // §3 신살 화개 — 소지 상한(3) 미만이고 미소지 시 풀에 추가 (가중치 0.15)
    const sinsalCount = (currentSinsalInventory ?? []).length
    const alreadyHasHwagae = (currentSinsalInventory ?? []).includes('hwagae')
    if (sinsalCount < 3 && !alreadyHasHwagae) {
      pool.push({
        type: 'add-sinsal',
        label: '신살: 화개(華蓋)',
        desc: '지정한 카드의 힘을 영구히 +3 깊어지게 한다',
        icon: '華',
        sinsalId: 'hwagae',
        weight: 0.15,
      })
    }

    // 가중치 기반 셔플 후 3개 선택
    // 방법: 가중치를 반영한 슬롯 생성 후 Fisher-Yates
    const weightedPool: typeof pool = []
    for (const item of pool) {
      // weight=1.0 → 10슬롯, weight=0.15 → 1.5≈2슬롯 (반올림)
      // 균등 금지: 신살은 카드/유물보다 낮은 빈도로 등장
      const slots = Math.max(1, Math.round(item.weight * 10))
      for (let s = 0; s < slots; s++) {
        weightedPool.push(item)
      }
    }

    const shuffled = [...weightedPool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // 중복 제거 후 3개 선택 (type 기준 첫 등장만)
    const seen = new Set<string>()
    const result: typeof pool = []
    for (const item of shuffled) {
      const key = item.sinsalId ? `sinsal-${item.sinsalId}` : item.relicId ? `relic-${item.relicId}` : item.type
      if (!seen.has(key)) {
        seen.add(key)
        result.push(item)
      }
      if (result.length >= 3) break
    }
    return result
  }, [currentFloor, availableRelics, currentSinsalInventory, runSeed])

  const handleChoose = (i: number) => {
    setChosen(i)
    const opt = rewardOptions[i]
    if (opt.type === 'add-relic' && opt.relicId) {
      setChosenRelicId(opt.relicId)
      setChosenSinsalId(null)
    } else if (opt.type === 'add-sinsal' && opt.sinsalId) {
      setChosenSinsalId(opt.sinsalId)
      setChosenRelicId(null)
    } else {
      setChosenRelicId(null)
      setChosenSinsalId(null)
    }
  }

  const handleProceed = () => {
    if (chosen === null) return
    const opt = rewardOptions[chosen]
    const rewardTypeIndex = ['add-card', 'upgrade-card', 'remove-card', 'add-relic', 'add-sinsal'].indexOf(opt.type)
    onProceed(rewardTypeIndex, chosenRelicId ?? undefined, chosenSinsalId ?? undefined)
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
          const isSinsal = opt.type === 'add-sinsal'
          return (
            <button
              key={i}
              onClick={() => handleChoose(i)}
              style={{
                backgroundColor: chosen === i ? '#241F18' : 'transparent',
                border: `1px solid ${chosen === i ? (isRelic ? '#D9A441' : isSinsal ? '#D9A441' : '#B33A2B') : '#2A2620'}`,
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
                  color: isRelic ? '#D9A441' : isSinsal ? '#D9A441' : '#E8DCC4',
                  fontWeight: (isRelic || isSinsal) ? 600 : 400,
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
                {isSinsal && (
                  <span style={{
                    fontSize: '10px',
                    color: '#D9A441',
                    border: '1px solid #4A3010',
                    backgroundColor: 'rgba(42,38,32,0.85)',
                    padding: '1px 5px',
                    letterSpacing: '0.1em',
                  }}>
                    신살
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
