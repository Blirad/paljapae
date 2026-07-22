/**
 * 팔자전 — (7) 층간보상 화면
 * 카드 선택 보상 / 유물 획득 / 다음 층 안내
 * T8: 유물 4종 풀 중 3개 노출 복원
 * 통합 슬롯 1단계: 신살 보상 은테 스타일 + 슬롯 full 교체 모달 추가
 */

import { useState, useMemo } from 'react'
import { FLOOR_CONFIGS, RELIC_DEFS, ALL_RELIC_IDS } from '../engine/balance'
import type { RelicId } from '../engine/balance'
import type { UnifiedSlot } from '../types/game'
import { MAX_SLOTS } from '../engine/paljajeonEngine'
import PassiveSlot from './PassiveSlot'

interface FloorRewardScreenProps {
  currentFloor: number
  currentRelicIds: string[]  // 이미 보유 중인 유물 ID 목록 (중복 차단용)
  /** 통합 슬롯 개편 1단계: unifiedSlots 정본으로 상한 체크 */
  currentUnifiedSlots?: UnifiedSlot[]
  /** 레거시 호환: sinsalInventory (currentUnifiedSlots 없을 때 fallback) */
  currentSinsalInventory?: string[]
  runSeed?: number  // 감사1(2026-07-22): 런별 시드(rngState) — 매 런 다른 보상 조합 보장
  onProceed: (rewardIndex: number, selectedRelicId?: string, selectedSinsalId?: string, replaceSlotIndex?: number) => void
  /** 통합 슬롯 해제(소멸) — 전투 밖(floor-reward)에서 롱프레스/우클릭 시 */
  onUnequipSlot?: (index: number) => void
}

/**
 * 감사1 (2026-07-22): 층 보상 추첨 시드 fair-mix.
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

// ─── 신살 이름 조회 (보상 라벨용) ───────────────────────────────────────────
const SINSAL_LABELS: Record<string, string> = {
  hwagae: '신살: 화개(華蓋)',
}

// ─── 슬롯 full 교체 모달 ────────────────────────────────────────────────────

interface SlotReplaceModalProps {
  currentSlots: UnifiedSlot[]
  selectedSlotIndex: number | null
  onSelectSlot: (index: number) => void
  onConfirm: () => void
  onCancel: () => void
}

function getSlotDisplayName(slot: UnifiedSlot): string {
  // 간단한 이름 조회
  const NAMES: Record<string, string> = {
    hwagae: '화개(華蓋)',
    sikshin: '식신(食神)', bigyeon: '비견(比肩)', geoptae: '겁재(劫財)',
    sanggwan: '상관(傷官)', pyeonjae: '편재(偏財)', jeongjae: '정재(正財)',
    pyeonin: '편인(偏印)', pyeongwan: '편관(偏官)', jeonggwan: '정관(正官)',
    jeongin: '정인(正印)',
  }
  return NAMES[slot.cardId] ?? slot.cardId
}

function getSlotTierBorder(slot: UnifiedSlot): string {
  if (slot.tier === 'rare') return '2px solid #A8B4C0'
  if (slot.tier === 'legendary') return '2px solid #C9A227'
  return '1px solid #4A4540'
}

function getSlotTierColor(slot: UnifiedSlot): string {
  if (slot.tier === 'rare') return '#A8B4C0'
  if (slot.tier === 'legendary') return '#C9A227'
  return '#D8CCB4'
}

function SlotReplaceModal({ currentSlots, selectedSlotIndex, onSelectSlot, onConfirm, onCancel }: SlotReplaceModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(22,19,15,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1A1712',
          border: '1px solid #4A4540',
          padding: '20px',
          borderRadius: '2px',
          maxWidth: '340px',
          width: '92%',
        }}
      >
        <div style={{ color: '#E8DCC4', fontSize: '14px', letterSpacing: '0.1em', marginBottom: '8px' }}>
          슬롯이 가득 찼습니다.
        </div>
        <div style={{ color: '#D8CCB4', fontSize: '12px', marginBottom: '4px' }}>
          비울 칸을 선택하세요.
        </div>
        <div style={{ color: '#B33A2B', fontSize: '11px', marginBottom: '16px' }}>
          선택한 카드는 소멸합니다. 되돌릴 수 없습니다.
        </div>

        {/* 현재 슬롯 목록 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
          {currentSlots.map((slot, i) => (
            <div
              key={i}
              onClick={() => onSelectSlot(i)}
              style={{
                width: '56px',
                height: '72px',
                backgroundColor: '#1C1710',
                border: selectedSlotIndex === i ? '2px solid #B33A2B' : getSlotTierBorder(slot),
                borderRadius: '2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 3px',
                gap: '2px',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'border-color 0.1s',
                boxShadow: selectedSlotIndex === i ? '0 0 8px 2px rgba(179,58,43,0.4)' : 'none',
              }}
            >
              <div style={{ fontSize: '7px', color: getSlotTierColor(slot), opacity: 0.8, letterSpacing: '0.05em' }}>
                {slot.tier === 'common' ? '일반' : slot.tier === 'rare' ? '희귀' : '전설'}
              </div>
              <div style={{ fontSize: '8px', color: getSlotTierColor(slot), fontWeight: 'bold', textAlign: 'center', lineHeight: '1.2', wordBreak: 'keep-all' }}>
                {getSlotDisplayName(slot)}
              </div>
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid #2A2620',
              color: '#6A6560',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              letterSpacing: '0.05em',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={selectedSlotIndex === null}
            style={{
              background: '#B33A2B',
              border: 'none',
              color: '#E8DCC4',
              padding: '8px 16px',
              cursor: selectedSlotIndex !== null ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              letterSpacing: '0.05em',
              opacity: selectedSlotIndex !== null ? 1 : 0.4,
            }}
          >
            선택 완료
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function FloorRewardScreen({
  currentFloor,
  currentRelicIds,
  currentUnifiedSlots,
  currentSinsalInventory,
  runSeed = 0,
  onProceed,
  onUnequipSlot,
}: FloorRewardScreenProps) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [chosenRelicId, setChosenRelicId] = useState<string | null>(null)
  const [chosenSinsalId, setChosenSinsalId] = useState<string | null>(null)

  // 슬롯 full 교체 모달 상태
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const [replaceSlotIndex, setReplaceSlotIndex] = useState<number | null>(null)

  const nextFloor = currentFloor + 1
  const isLastFloor = currentFloor >= 4
  const nextConfig = !isLastFloor ? FLOOR_CONFIGS[nextFloor - 1] : null

  // 통합 슬롯 정본 (없으면 레거시 fallback)
  const _unifiedSlots = currentUnifiedSlots ?? []
  const slotCount = _unifiedSlots.length

  // T8: 유물 보상 — 미보유 유물 중 층별 결정론적 셔플로 3개 선택
  const availableRelics = useMemo(() => {
    const unowned = ALL_RELIC_IDS.filter(id => !currentRelicIds.includes(id))
    if (unowned.length === 0) return []

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

  // 신살 등장 가능 여부: 통합 슬롯 < MAX_SLOTS이고 hwagae 미소지
  const rewardOptions = useMemo(() => {
    let rng = mixRewardSeed(runSeed, currentFloor, 0)
    const nextRandom = () => {
      rng = (rng * 1664525 + 1013904223) & 0xffffffff
      return (rng >>> 0) / 0xffffffff
    }

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

    // 신살 화개 — 통합 슬롯 기준 미소지 시 풀에 추가 (레거시 fallback 병행)
    const alreadyHasHwagae = _unifiedSlots.some(s => s.tier === 'rare' && s.cardId === 'hwagae')
      || (currentSinsalInventory ?? []).includes('hwagae')
    // 슬롯 여유 있거나 full이어도 보상 등장 허용 (full이면 선택 시 교체 모달)
    if (!alreadyHasHwagae) {
      pool.push({
        type: 'add-sinsal',
        label: SINSAL_LABELS.hwagae,
        desc: '지정한 카드의 힘을 영구히 +3 깊어지게 한다',
        icon: '華',
        sinsalId: 'hwagae',
        weight: 0.15,
      })
    }

    const weightedPool: typeof pool = []
    for (const item of pool) {
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
  }, [currentFloor, availableRelics, currentSinsalInventory, _unifiedSlots, runSeed])

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

    // 신살 선택 + 슬롯 full → 교체 모달 표시
    if (opt.type === 'add-sinsal' && slotCount >= MAX_SLOTS) {
      setShowReplaceModal(true)
      setReplaceSlotIndex(null)
      return
    }

    onProceed(rewardTypeIndex, chosenRelicId ?? undefined, chosenSinsalId ?? undefined)
  }

  const handleReplaceConfirm = () => {
    if (replaceSlotIndex === null || chosen === null) return
    const opt = rewardOptions[chosen]
    const rewardTypeIndex = ['add-card', 'upgrade-card', 'remove-card', 'add-relic', 'add-sinsal'].indexOf(opt.type)
    setShowReplaceModal(false)
    onProceed(rewardTypeIndex, chosenRelicId ?? undefined, chosenSinsalId ?? undefined, replaceSlotIndex)
  }

  const handleReplaceCancel = () => {
    setShowReplaceModal(false)
    setReplaceSlotIndex(null)
  }

  return (
    <>
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
            const isChosen = chosen === i

            // tier별 border 색상
            let borderColor = '#2A2620'
            if (isChosen) {
              if (isSinsal) borderColor = '#A8B4C0'
              else if (isRelic) borderColor = '#D9A441'
              else borderColor = '#B33A2B'
            } else {
              if (isSinsal) borderColor = '#4A5560'
              else if (isRelic) borderColor = '#2A2620'
              else borderColor = '#2A2620'
            }

            const borderWidth = (isChosen && isSinsal) ? '2px' : '1px'
            const boxShadow = (isChosen && isSinsal)
              ? '0 0 10px 2px rgba(168,180,192,0.3)'
              : 'none'

            return (
              <button
                key={i}
                onClick={() => handleChoose(i)}
                style={{
                  backgroundColor: isChosen ? '#241F18' : 'transparent',
                  border: `${borderWidth} solid ${borderColor}`,
                  boxShadow,
                  color: '#E8DCC4',
                  padding: '20px 24px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.15s',
                  borderRadius: '2px',
                  borderLeft: isSinsal ? `4px solid ${isChosen ? '#A8B4C0' : '#4A5560'}` : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>{opt.icon}</span>
                  <span style={{
                    fontSize: '15px',
                    letterSpacing: '0.1em',
                    color: isSinsal ? '#A8B4C0' : isRelic ? '#D9A441' : '#E8DCC4',
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
                      color: '#A8B4C0',
                      border: '1px solid #4A5560',
                      backgroundColor: 'rgba(42,50,60,0.85)',
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

        {/* 통합 슬롯 현황 (전투 밖 — 롱프레스/우클릭으로 해제=소멸) */}
        <div style={{ marginTop: '20px' }}>
          <div
            style={{
              color: '#4A4540',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textAlign: 'center',
              marginBottom: '4px',
            }}
          >
            보유 슬롯 · 길게 눌러 해제(소멸)
          </div>
          <PassiveSlot
            unifiedSlots={_unifiedSlots}
            isEquipPhase={true}
            isInBattle={false}
            onUnequipSlot={onUnequipSlot}
          />
        </div>
      </div>

      {/* 슬롯 full 교체 모달 */}
      {showReplaceModal && (
        <SlotReplaceModal
          currentSlots={_unifiedSlots}
          selectedSlotIndex={replaceSlotIndex}
          onSelectSlot={setReplaceSlotIndex}
          onConfirm={handleReplaceConfirm}
          onCancel={handleReplaceCancel}
        />
      )}
    </>
  )
}
