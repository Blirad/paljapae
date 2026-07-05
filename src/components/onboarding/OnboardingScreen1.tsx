/**
 * 화면 1 — 생년월일 입력
 * 리라 스펙 §2
 */
import React, { useCallback, useRef, useState, useEffect } from 'react'
import PrimaryButton from '@/components/ui/PrimaryButton'
import Divider from '@/components/ui/Divider'
import GanzhiAnimation from './GanzhiAnimation'
import { calculateSaju } from '@/game/saju/manseryeok'
import type { ThreePillars } from '@/game/saju/manseryeok'
import type { SajuResult } from '@/game/saju/manseryeok'

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1930

function getDaysInMonth(year: number, month: number): number {
  if (month === 0) return 0
  // 윤년 판별
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month]
}

interface OnboardingScreen1Props {
  initialYear: number
  onComplete: (result: SajuResult, pillars: ThreePillars) => void
}

type ScreenState = 'idle' | 'calculating' | 'animating'

export default function OnboardingScreen1({ initialYear, onComplete }: OnboardingScreen1Props): React.ReactElement {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState<number>(0)
  const [day, setDay] = useState<number>(0)
  const [error, setError] = useState<string>('')
  const [shake, setShake] = useState(false)
  const [screenState, setScreenState] = useState<ScreenState>('idle')
  const [computedPillars, setComputedPillars] = useState<ThreePillars | null>(null)
  const [computedResult, setComputedResult] = useState<SajuResult | null>(null)

  // YearSpinner 롱프레스
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const daysInMonth = getDaysInMonth(year, month)

  // 월 변경 시 일 초기화
  useEffect(() => {
    if (day > daysInMonth) setDay(0)
  }, [month, year, day, daysInMonth])

  const startDecrease = useCallback(() => {
    setYear(y => Math.max(MIN_YEAR, y - 1))
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setYear(y => Math.max(MIN_YEAR, y - 1))
      }, 100)
    }, 300)
  }, [])

  const startIncrease = useCallback(() => {
    setYear(y => Math.min(CURRENT_YEAR, y + 1))
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setYear(y => Math.min(CURRENT_YEAR, y + 1))
      }, 100)
    }, 300)
  }, [])

  const stopRepeat = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const handleYearKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setYear(y => Math.max(MIN_YEAR, y - 1))
    if (e.key === 'ArrowRight') setYear(y => Math.min(CURRENT_YEAR, y + 1))
  }, [])

  const validate = useCallback((): string | null => {
    if (year < MIN_YEAR) return '1930년 이후 생년월일만 지원됩니다'
    if (month === 0) return '태어난 월을 선택해주세요'
    if (day === 0) return '태어난 일을 선택해주세요'
    return null
  }, [year, month, day])

  const handleSubmit = useCallback(() => {
    const err = validate()
    if (err) {
      setError(err)
      setShake(true)
      setTimeout(() => setShake(false), 300)
      return
    }
    setError('')
    setScreenState('calculating')

    // 만세력 계산 (setTimeout으로 UI 업데이트 보장)
    setTimeout(() => {
      try {
        const result = calculateSaju(year, month, day)
        setComputedResult(result)
        setComputedPillars(result.pillars)
        setScreenState('animating')
      } catch (_e) {
        setScreenState('idle')
        setError('계산 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    }, 16)
  }, [validate, year, month, day])

  const handleAnimationComplete = useCallback(() => {
    if (computedResult && computedPillars) {
      onComplete(computedResult, computedPillars)
    }
  }, [computedResult, computedPillars, onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* TopBar */}
      <div
        style={{
          height: '56px',
          borderBottom: '1px solid rgba(232,200,74,0.12)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            letterSpacing: '0.3em',
            color: 'var(--gold)',
          }}
        >
          팔자패
        </span>
      </div>

      {/* ScrollContainer */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 24px',
          paddingBottom: 'calc(32px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {/* HeroSection */}
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '24px',
              color: 'var(--text-headline)',
              margin: 0,
            }}
          >
            팔자패
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: '16px',
              color: 'var(--text-muted)',
              margin: '6px 0 0',
            }}
          >
            八字牌
          </p>
        </div>

        {/* HeadlineCopy */}
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: 1.4,
            color: 'var(--text-headline)',
            margin: '24px 0 0',
          }}
        >
          당신의 팔자를<br />뽑아드립니다
        </h2>

        {/* SubCopy */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            margin: '12px 0 0',
          }}
        >
          생년월일을 입력하면 사주팔자를 계산해<br />당신의 운명 덱을 만들어드립니다
        </p>

        <Divider className="mt-6" />

        {/* 연도 필드 */}
        <div style={{ marginTop: '20px' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.15em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            YEAR OF BIRTH
          </label>
          <div
            role="group"
            aria-label="태어난 해 선택"
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '52px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            <button
              aria-label="이전 해"
              onMouseDown={startDecrease}
              onMouseUp={stopRepeat}
              onMouseLeave={stopRepeat}
              onTouchStart={startDecrease}
              onTouchEnd={stopRepeat}
              style={{
                width: '44px',
                height: '44px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ◄
            </button>
            <div
              aria-live="polite"
              aria-atomic="true"
              tabIndex={0}
              onKeyDown={handleYearKeyDown}
              style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '20px',
                color: 'var(--gold)',
                outline: 'none',
                userSelect: 'none',
              }}
            >
              {year}년
            </div>
            <button
              aria-label="다음 해"
              onMouseDown={startIncrease}
              onMouseUp={stopRepeat}
              onMouseLeave={stopRepeat}
              onTouchStart={startIncrease}
              onTouchEnd={stopRepeat}
              style={{
                width: '44px',
                height: '44px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ►
            </button>
          </div>
        </div>

        {/* 월/일 필드 */}
        <div style={{ marginTop: '16px' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.15em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            MONTH / DAY
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* MonthSelect */}
            <div style={{ flex: 1, position: 'relative' }}>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                aria-label="태어난 월"
                style={{
                  width: '100%',
                  height: '52px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  color: month === 0 ? 'var(--text-muted)' : 'var(--text-headline)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  padding: '0 36px 0 12px',
                  appearance: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value={0} disabled>월 선택</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  fontSize: '12px',
                }}
              >
                ▼
              </span>
            </div>

            {/* DaySelect */}
            <div style={{ flex: 1, position: 'relative' }}>
              <select
                value={day}
                onChange={e => setDay(Number(e.target.value))}
                disabled={month === 0}
                aria-label="태어난 일"
                style={{
                  width: '100%',
                  height: '52px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  color: day === 0 ? 'var(--text-muted)' : 'var(--text-headline)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  padding: '0 36px 0 12px',
                  appearance: 'none',
                  cursor: month === 0 ? 'not-allowed' : 'pointer',
                  opacity: month === 0 ? 0.4 : 1,
                  pointerEvents: month === 0 ? 'none' : 'auto',
                  outline: 'none',
                }}
              >
                <option value={0} disabled>일 선택</option>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  fontSize: '12px',
                }}
              >
                ▼
              </span>
            </div>
          </div>
        </div>

        {/* 에러 영역 */}
        <div
          role="alert"
          style={{
            marginTop: '8px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {error && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--accent-red)',
              }}
            >
              ⚠ {error}
            </span>
          )}
        </div>

        {/* CTA */}
        <div
          style={{ marginTop: '28px' }}
          className={shake ? 'animate-[shake_0.3s_ease-in-out]' : ''}
        >
          <PrimaryButton
            onClick={handleSubmit}
            isLoading={screenState === 'calculating'}
            loadingText="팔자 계산 중..."
          >
            팔자 계산 시작하기
          </PrimaryButton>
        </div>
      </div>

      {/* GanzhiAnimation 오버레이 */}
      {screenState === 'animating' && (
        <GanzhiAnimation
          pillars={computedPillars}
          onComplete={handleAnimationComplete}
        />
      )}

      {/* shake 키프레임 CSS */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
