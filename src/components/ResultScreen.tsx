/**
 * 팔자전 — (8) 결과 화면
 * 클리어율 % 표시 / "다시 도전" / "홈" 버튼
 *
 * VFX: 배율 곱셈 카운트업 (Section 5, line 89)
 *  - 600ms 기본, 피해 1000 이상 시 900ms, 상한 1200ms
 *  - tabular-nums 적용 (자리 흔들림 방지)
 */

import { useEffect, useState, useRef } from 'react'
import { useGameContext } from '../context/GameContext'
import { audioManager } from '../services/audioManager'
import { useGameStore } from '../stores/gameStore'

interface ResultScreenProps {
  isVictory: boolean
  floorsCleared: number
  onRetry: () => void
  onHome: () => void
  /** 마지막 전투 총 데미지 (배율 카운트업 타이밍 계산용) */
  lastTotalDamage?: number
  /** 마지막 배율 값 (기본 1.0) */
  lastMultiplier?: number
}

/**
 * 배율 카운트업 훅
 * Section 5, line 89: 600ms 기본, 피해 1000 이상 시 900ms, 상한 1200ms
 */
function useMultiplierCountUp(
  targetMultiplier: number,
  totalDamage: number,
  getDuration: (ms: number) => number
): string {
  const [displayValue, setDisplayValue] = useState(1.0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const startValue = 1.0

    // 타이밍 계산 (Section 5, line 89)
    let baseDuration = 600
    if (totalDamage >= 1000) {
      baseDuration = Math.min(900 + ((totalDamage - 1000) / 1000) * 200, 1200)
    }
    const duration = getDuration(baseDuration)
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOut cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (targetMultiplier - startValue) * eased
      setDisplayValue(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    // 사운드: 카운트업 중 틱 (5회 분산)
    const steps = 5
    for (let i = 0; i < steps; i++) {
      setTimeout(() => {
        audioManager.scoreCountTick(i, steps)
      }, (duration / steps) * i)
    }

    return () => cancelAnimationFrame(rafRef.current)
  }, [targetMultiplier, totalDamage, getDuration])

  return displayValue.toFixed(1)
}

export default function ResultScreen({
  isVictory,
  floorsCleared,
  onRetry,
  onHome,
  lastTotalDamage = 0,
  lastMultiplier = 1.0,
}: ResultScreenProps) {
  const clearRate = Math.round((floorsCleared / 4) * 100)
  const { getDuration } = useGameContext()
  const { battleStats } = useGameStore()

  // 배율 카운트업 (Section 5, line 89)
  const multiplierDisplay = useMultiplierCountUp(lastMultiplier, lastTotalDamage, getDuration)

  // 결과 화면 진입 사운드
  useEffect(() => {
    if (isVictory) {
      audioManager.floorClearAscending()
    } else {
      audioManager.defeatDeepTone()
    }
  }, [isVictory])

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '40px 24px' }}
    >
      {/* 결과 헤더 */}
      <div className="text-center">
        <div
          style={{
            fontSize: '48px',
            marginBottom: '8px',
            color: isVictory ? '#4A9B6E' : '#C63D2F',
          }}
        >
          {isVictory ? '승' : '패'}
        </div>
        <h2
          style={{
            color: '#E8DCC4',
            fontSize: '22px',
            letterSpacing: '0.15em',
            margin: 0,
          }}
        >
          {isVictory ? '운명을 꿰뚫었다' : '전장이 무너지다'}
        </h2>
      </div>

      {/* 구분선 */}
      <div style={{ width: '120px', height: '1px', backgroundColor: '#B33A2B', margin: '32px 0' }} />

      {/* B9: 결과 근거 한 줄 */}
      <div style={{
        color: isVictory ? '#4A9B6E' : '#C63D2F',
        fontSize: '14px',
        letterSpacing: '0.05em',
        textAlign: 'center',
        marginBottom: '8px',
        lineHeight: '1.6',
      }}>
        {isVictory
          ? `공격 ${battleStats.totalPlaysUsed}회 만에 격파 · 최대 한 방 ${battleStats.maxSingleDamage}`
          : `적 체력 ${battleStats.remainingEnemyHpAtEnd} 남음 — 아깝다!`
        }
      </div>

      {/* 통계 */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <div style={{ color: '#6A6560', fontSize: '12px', letterSpacing: '0.2em' }}>클리어율</div>
          <div
            style={{
              color: '#D9A441',
              fontSize: '56px',
              fontWeight: 'bold',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              marginTop: '4px',
            }}
          >
            {clearRate}%
          </div>
        </div>

        <div className="text-center">
          <div style={{ color: '#6A6560', fontSize: '12px', letterSpacing: '0.2em' }}>클리어 층수</div>
          <div style={{ color: '#D8CCB4', fontSize: '24px', marginTop: '4px' }}>
            {floorsCleared} / 4
          </div>
        </div>

        {/* 배율 카운트업 (Section 5, line 89) */}
        {lastMultiplier > 1.0 && (
          <div className="text-center">
            <div style={{ color: '#6A6560', fontSize: '12px', letterSpacing: '0.2em' }}>최고 배율</div>
            <div
              style={{
                color: '#FFD98A',
                fontSize: '36px',
                fontWeight: 'bold',
                fontVariantNumeric: 'tabular-nums',  // Section 5 필수 — 자리 흔들림 방지
                lineHeight: 1,
                marginTop: '4px',
                letterSpacing: '0.02em',
              }}
            >
              {multiplierDisplay}x
            </div>
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex flex-col gap-4 w-full mt-12">
        <button
          onClick={onRetry}
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
          다시 도전
        </button>
        <button
          onClick={onHome}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #4A4540',
            color: '#D8CCB4',
            padding: '16px',
            fontSize: '15px',
            letterSpacing: '0.15em',
            cursor: 'pointer',
            width: '100%',
            minHeight: '48px',
          }}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}
