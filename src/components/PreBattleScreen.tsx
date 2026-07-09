/**
 * 팔자전 — 출전준비 화면 (PreBattleScreen) Phase 2
 * Phase 1.6 C항목 + Phase 2 가호 우선 패시브 추가
 *
 * Phase 2 변경:
 *  - heroProfile 수신 → 일간 오행 기준 우선 패시브 풀 2개 + 일반 풀 2개 = 4개
 *  - 우선 등장 패시브에 "나의 사주" 뱃지 표시
 */

import { useState, useMemo } from 'react'
import type { Card } from '../types/game'
import type { SavedHeroProfile } from '../types/game'
import type { Passive } from '../types/passive'
import { PASSIVE_POOL, PASSIVE_RARITY_COLORS, PASSIVE_RARITY_BORDER, PASSIVE_RARITY_LABEL } from '../types/passive'

interface PreBattleScreenProps {
  hand: Card[]
  onComplete: (selectedPassives: Passive[]) => void
  seed?: number
  heroProfile?: SavedHeroProfile | null
}

// LCG
function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/**
 * 우선 풀 2개 + 일반 풀 2개 = 4개 추출
 * 우선 풀: 유저 일간 오행 관련 패시브 (element 필드 매칭)
 *          + element 없는 패시브(비견, 식신 — 범용)
 */
function pickPassives(
  seed: number,
  ilganElement?: string,
): { passive: Passive; isSajuPriority: boolean }[] {
  const rng = makeLCG(seed)

  const priorityPool: Passive[] = []
  const normalPool: Passive[] = []

  PASSIVE_POOL.forEach(p => {
    if (ilganElement && (p.element === ilganElement || !p.element)) {
      priorityPool.push(p)
    } else {
      normalPool.push(p)
    }
  })

  const pickFrom = (pool: Passive[], n: number): Passive[] => {
    const arr = [...pool]
    const picked: Passive[] = []
    for (let i = 0; i < n && arr.length > 0; i++) {
      const idx = Math.floor(rng() * arr.length)
      picked.push(arr[idx])
      arr.splice(idx, 1)
    }
    return picked
  }

  // 우선 풀에서 최대 2개
  const fromPriority = pickFrom(priorityPool, 2)
  // 일반 풀에서 나머지 (4 - fromPriority.length)
  const remaining = 4 - fromPriority.length
  const fromNormal = pickFrom(normalPool, remaining)

  const result = [
    ...fromPriority.map(p => ({ passive: p, isSajuPriority: true })),
    ...fromNormal.map(p => ({ passive: p, isSajuPriority: false })),
  ]

  // 4개 미만이면 일반 풀에서 추가
  if (result.length < 4) {
    const extra = pickFrom(
      PASSIVE_POOL.filter(p => !result.find(r => r.passive.id === p.id)),
      4 - result.length,
    )
    result.push(...extra.map(p => ({ passive: p, isSajuPriority: false })))
  }

  return result.slice(0, 4)
}

const ELEMENT_KO: Record<string, string> = {
  mok: '나무', hwa: '불', to: '흙', geum: '쇠', su: '물',
}
const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}

export default function PreBattleScreen({ hand, onComplete, seed, heroProfile }: PreBattleScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedPassives, setSelectedPassives] = useState<string[]>([])

  const passiveOptions = useMemo(
    () => pickPassives(seed ?? Date.now(), heroProfile?.ilganElement),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, heroProfile?.ilganElement],
  )

  const togglePassive = (id: string) => {
    setSelectedPassives(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  const handleSkipStep1 = () => setStep(2)

  const handleConfirmPassives = () => {
    if (selectedPassives.length < 2) {
      const auto = passiveOptions.slice(0, 2).map(p => p.passive.id)
      setSelectedPassives(auto)
    }
    setStep(3)
  }

  const handleSkipPassives = () => {
    const auto = passiveOptions.slice(0, 2).map(p => p.passive)
    onComplete(auto)
  }

  const handleStart = () => {
    const chosen = passiveOptions.filter(p => selectedPassives.includes(p.passive.id)).map(p => p.passive)
    const result =
      chosen.length >= 2
        ? chosen.slice(0, 2)
        : [
            ...chosen,
            ...passiveOptions
              .filter(p => !selectedPassives.includes(p.passive.id))
              .map(p => p.passive),
          ].slice(0, 2)
    onComplete(result)
  }

  const displayHand = hand.slice(0, 3)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#16130F',
        color: '#D8CCB4',
        fontFamily: 'sans-serif',
      }}
    >
      {/* 진행도 표시 */}
      <div
        style={{
          backgroundColor: '#1C1710',
          borderBottom: '1px solid #2A2620',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        {([1, 2, 3] as const).map(s => (
          <div
            key={s}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: step === s ? 1 : 0.4 }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: `2px solid ${step === s ? '#D9A441' : '#4A4540'}`,
                backgroundColor: step > s ? '#D9A441' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: step > s ? '#16130F' : step === s ? '#D9A441' : '#4A4540',
                fontWeight: 'bold',
              }}
            >
              {step > s ? '✓' : s}
            </div>
            <span style={{ fontSize: '11px', color: step === s ? '#D9A441' : '#4A4540', letterSpacing: '0.05em' }}>
              {s === 1 ? '패 확인' : s === 2 ? '가호 선택' : '출전'}
            </span>
            {s < 3 && <span style={{ color: '#2A2620', fontSize: '12px' }}>→</span>}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>

        {/* 1단계: 오늘의 패 확인 */}
        {step === 1 && (
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <div style={{ color: '#D9A441', fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.12em', marginBottom: '6px', textAlign: 'center' }}>
              오늘의 패 확인
            </div>
            <div style={{ color: '#6A6560', fontSize: '12px', marginBottom: '20px', textAlign: 'center', letterSpacing: '0.06em' }}>
              던전에 들기 전 손에 쥔 패를 확인하라
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
              {displayHand.length === 0 ? (
                <div style={{ color: '#4A4540', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                  (패가 없음)
                </div>
              ) : displayHand.map(card => (
                <div
                  key={card.id}
                  style={{
                    width: '88px',
                    minHeight: '120px',
                    border: `2px solid ${ELEMENT_COLORS[card.element] ?? '#4A4540'}`,
                    backgroundColor: '#1C1710',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 6px',
                  }}
                >
                  <div style={{ fontSize: '22px', color: ELEMENT_COLORS[card.element] ?? '#D8CCB4', fontWeight: 'bold' }}>
                    {ELEMENT_KO[card.element] ?? card.element}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6A6560' }}>
                    {card.polarity === 'yang' ? '양(陽)' : '음(陰)'}
                  </div>
                  <div style={{ fontSize: '18px', color: '#D9A441', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleSkipStep1}
                style={{ backgroundColor: 'transparent', border: '1px solid #4A4540', color: '#6A6560', padding: '12px 24px', fontSize: '13px', cursor: 'pointer', letterSpacing: '0.08em' }}
              >
                건너뛰기
              </button>
              <button
                onClick={() => setStep(2)}
                style={{ backgroundColor: '#B33A2B', border: 'none', color: '#E8DCC4', padding: '12px 28px', fontSize: '13px', cursor: 'pointer', letterSpacing: '0.08em', fontWeight: 'bold' }}
              >
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* 2단계: 가호 선택 */}
        {step === 2 && (
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <div style={{ color: '#D9A441', fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.12em', marginBottom: '6px', textAlign: 'center' }}>
              가호 선택
            </div>
            <div style={{ color: '#6A6560', fontSize: '12px', marginBottom: '20px', textAlign: 'center', letterSpacing: '0.06em', lineHeight: '1.7' }}>
              던전에 들기 전, 그대를 지킬 두 가호를 고르십시오.<br/>
              <span style={{ color: '#4A4540' }}>{selectedPassives.length}/2 선택됨</span>
            </div>

            {/* 사주 기반 안내 */}
            {heroProfile && (
              <div style={{ color: '#6A6560', fontSize: '10px', textAlign: 'center', marginBottom: '12px', letterSpacing: '0.06em' }}>
                그대의 일간 {heroProfile.ilganElement && ELEMENT_KO[heroProfile.ilganElement]} 기운이 가호에 깃들었습니다
              </div>
            )}

            {/* 4개 패시브 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {passiveOptions.map(({ passive, isSajuPriority }) => {
                const isSelected = selectedPassives.includes(passive.id)
                const isDisabled = selectedPassives.length >= 2 && !isSelected
                return (
                  <button
                    key={passive.id}
                    onClick={() => togglePassive(passive.id)}
                    disabled={isDisabled}
                    style={{
                      backgroundColor: isSelected ? 'rgba(217,164,65,0.12)' : '#1C1710',
                      border: `2px solid ${isSelected ? '#D9A441' : PASSIVE_RARITY_BORDER[passive.rarity]}`,
                      borderRadius: '2px',
                      padding: '14px 12px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      opacity: isDisabled ? 0.4 : 1,
                      minHeight: '90px',
                      position: 'relative',
                    }}
                  >
                    {/* 나의 사주 뱃지 */}
                    {isSajuPriority && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          backgroundColor: 'rgba(179,58,43,0.2)',
                          border: '1px solid #B33A2B',
                          color: '#B33A2B',
                          fontSize: '8px',
                          padding: '1px 5px',
                          letterSpacing: '0.05em',
                        }}
                      >
                        나의 사주
                      </div>
                    )}
                    <div style={{ fontSize: '9px', color: PASSIVE_RARITY_COLORS[passive.rarity], letterSpacing: '0.1em', marginBottom: '5px' }}>
                      {PASSIVE_RARITY_LABEL[passive.rarity]}
                    </div>
                    <div style={{ fontSize: '13px', color: '#D8CCB4', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      {passive.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8A8580', lineHeight: '1.4' }}>
                      {passive.effect}
                    </div>
                    {isSelected && (
                      <div style={{ marginTop: '6px', fontSize: '10px', color: '#D9A441', letterSpacing: '0.1em' }}>
                        선택됨 ✓
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleSkipPassives}
                style={{ backgroundColor: 'transparent', border: '1px solid #4A4540', color: '#6A6560', padding: '12px 20px', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.08em' }}
              >
                건너뛰기
              </button>
              <button
                onClick={handleConfirmPassives}
                disabled={selectedPassives.length < 2}
                style={{
                  backgroundColor: selectedPassives.length >= 2 ? '#B33A2B' : '#2A2620',
                  border: 'none',
                  color: selectedPassives.length >= 2 ? '#E8DCC4' : '#4A4540',
                  padding: '12px 28px',
                  fontSize: '13px',
                  cursor: selectedPassives.length >= 2 ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.08em',
                  fontWeight: 'bold',
                }}
              >
                선택 완료
              </button>
            </div>
          </div>
        )}

        {/* 3단계: 전투 시작 */}
        {step === 3 && (
          <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ color: '#D9A441', fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.12em', marginBottom: '6px' }}>
              출전 준비 완료
            </div>
            <div style={{ color: '#6A6560', fontSize: '12px', marginBottom: '24px', letterSpacing: '0.06em' }}>
              선택한 가호를 품고 던전에 들어라
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
              {passiveOptions
                .filter(p => selectedPassives.includes(p.passive.id))
                .map(({ passive, isSajuPriority }) => (
                  <div
                    key={passive.id}
                    style={{
                      backgroundColor: '#1C1710',
                      border: `2px solid ${PASSIVE_RARITY_BORDER[passive.rarity]}`,
                      borderRadius: '2px',
                      padding: '12px 14px',
                      textAlign: 'left',
                      minWidth: '120px',
                      position: 'relative',
                    }}
                  >
                    {isSajuPriority && (
                      <div style={{ fontSize: '8px', color: '#B33A2B', marginBottom: '3px', letterSpacing: '0.05em' }}>
                        나의 사주
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: PASSIVE_RARITY_COLORS[passive.rarity], marginBottom: '4px' }}>
                      {PASSIVE_RARITY_LABEL[passive.rarity]}
                    </div>
                    <div style={{ fontSize: '13px', color: '#D8CCB4', fontWeight: 'bold', marginBottom: '4px' }}>
                      {passive.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6A6560', lineHeight: '1.4' }}>
                      {passive.effect}
                    </div>
                  </div>
                ))}
            </div>

            <button
              onClick={handleStart}
              style={{
                backgroundColor: '#B33A2B',
                border: 'none',
                color: '#E8DCC4',
                padding: '16px 48px',
                fontSize: '15px',
                cursor: 'pointer',
                letterSpacing: '0.12em',
                fontWeight: 'bold',
              }}
            >
              전투 시작
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
