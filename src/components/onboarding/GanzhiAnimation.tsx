/**
 * GanzhiAnimation — 천간지지 계산 연출 오버레이
 * 리라 스펙 §2 로딩 상태
 * 80ms 간격으로 천간·지지 문자 교체 → 1.5s 후 실제 값 고정 → 0.4s 후 화면 2 전환
 */
import React, { useEffect, useRef, useState } from 'react'
import type { ThreePillars } from '@/game/saju/manseryeok'

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

interface GanzhiAnimationProps {
  pillars: ThreePillars | null
  onComplete: () => void
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function GanzhiAnimation({ pillars, onComplete }: GanzhiAnimationProps): React.ReactElement {
  const [yearDisplay, setYearDisplay] = useState({ stem: randomFrom(STEMS), branch: randomFrom(BRANCHES) })
  const [monthDisplay, setMonthDisplay] = useState({ stem: randomFrom(STEMS), branch: randomFrom(BRANCHES) })
  const [dayDisplay, setDayDisplay] = useState({ stem: randomFrom(STEMS), branch: randomFrom(BRANCHES) })
  const [fixed, setFixed] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTime = useRef(Date.now())

  useEffect(() => {
    startTime.current = Date.now()

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current

      if (elapsed >= 1500) {
        // 고정 단계: 실제 값 표시
        if (intervalRef.current) clearInterval(intervalRef.current)

        if (pillars) {
          setYearDisplay({ stem: pillars.year.stem, branch: pillars.year.branch })
          setMonthDisplay({ stem: pillars.month.stem, branch: pillars.month.branch })
          setDayDisplay({ stem: pillars.day.stem, branch: pillars.day.branch })
        }
        setFixed(true)

        // 0.4초 고정 후 화면 2 전환
        setTimeout(onComplete, 400)
      } else {
        // 교체 단계
        setYearDisplay({ stem: randomFrom(STEMS), branch: randomFrom(BRANCHES) })
        setMonthDisplay({ stem: randomFrom(STEMS), branch: randomFrom(BRANCHES) })
        setDayDisplay({ stem: randomFrom(STEMS), branch: randomFrom(BRANCHES) })
      }
    }, 80)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [pillars, onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      {/* 천간지지 3쌍 */}
      <div style={{ display: 'flex', gap: '32px', marginBottom: '24px' }}>
        {[yearDisplay, monthDisplay, dayDisplay].map((pair, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              opacity: fixed ? 1 : 0.85,
              transition: fixed ? 'opacity 0.2s' : 'none',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '48px',
                color: 'var(--gold)',
                lineHeight: 1,
                minWidth: '52px',
                textAlign: 'center',
              }}
            >
              {pair.stem}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '48px',
                color: 'var(--gold)',
                lineHeight: 1,
                minWidth: '52px',
                textAlign: 'center',
              }}
            >
              {pair.branch}
            </span>
          </div>
        ))}
      </div>

      {/* 레이블 (년·월·일) */}
      <div style={{ display: 'flex', gap: '32px', marginBottom: '20px' }}>
        {['년주', '월주', '일주'].map((label) => (
          <span
            key={label}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              width: '52px',
              textAlign: 'center',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          color: 'var(--text-muted)',
          margin: 0,
        }}
      >
        팔자를 읽는 중...
      </p>
    </div>
  )
}
