/**
 * 팔자전 — (2) 사주입력 화면
 * 생년월일(+시간 선택) 입력 → 홈으로 이동
 */

import { useState } from 'react'
import type { SajuInfo } from '../types/game'

interface SajuInputScreenProps {
  onComplete: (saju: SajuInfo) => void
}

export default function SajuInputScreen({ onComplete }: SajuInputScreenProps) {
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [hour, setHour] = useState('')
  const [isLunar, setIsLunar] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    const y = parseInt(year)
    const m = parseInt(month)
    const d = parseInt(day)

    if (!y || !m || !d) {
      setError('생년월일을 모두 입력하세요')
      return
    }
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      setError('날짜를 확인하세요')
      return
    }

    onComplete({
      birthYear: y,
      birthMonth: m,
      birthDay: d,
      birthHour: hour ? parseInt(hour) : undefined,
      isLunar,
    })
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '40px 24px' }}
    >
      <div className="flex flex-col gap-8 mt-12">
        {/* 제목 */}
        <div className="text-center">
          <h2
            style={{ color: '#E8DCC4', fontSize: '24px', letterSpacing: '0.15em', margin: 0 }}
          >
            사주 입력
          </h2>
          <div style={{ color: '#B33A2B', fontSize: '11px', marginTop: '8px', opacity: 0.8 }}>
            간편 계산 기준 (자정 00:00 일주 경계)
          </div>
        </div>

        {/* 음력/양력 토글 */}
        <div className="flex gap-4 justify-center">
          {(['양력', '음력'] as const).map((label, i) => (
            <button
              key={label}
              onClick={() => setIsLunar(i === 1)}
              style={{
                padding: '8px 24px',
                border: '1px solid',
                borderColor: isLunar === (i === 1) ? '#B33A2B' : '#4A4540',
                color: isLunar === (i === 1) ? '#E8DCC4' : '#6A6560',
                backgroundColor: 'transparent',
                fontSize: '14px',
                cursor: 'pointer',
                letterSpacing: '0.1em',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 입력 필드 */}
        <div className="flex flex-col gap-4">
          {[
            { label: '태어난 해', placeholder: '예: 1990', value: year, onChange: setYear },
            { label: '태어난 월', placeholder: '예: 3', value: month, onChange: setMonth },
            { label: '태어난 일', placeholder: '예: 15', value: day, onChange: setDay },
          ].map(({ label, placeholder, value, onChange }) => (
            <div key={label} className="flex flex-col gap-2">
              <label style={{ color: '#D8CCB4', fontSize: '13px', letterSpacing: '0.1em' }}>
                {label}
              </label>
              <input
                type="number"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{
                  backgroundColor: '#241F18',
                  border: '1px solid #4A4540',
                  color: '#E8DCC4',
                  padding: '14px 16px',
                  fontSize: '16px',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
          ))}

          {/* 시간 (선택) */}
          <div className="flex flex-col gap-2">
            <label style={{ color: '#D8CCB4', fontSize: '13px', letterSpacing: '0.1em' }}>
              태어난 시 <span style={{ color: '#4A4540' }}>(선택 — 미입력 시 시주 미사용)</span>
            </label>
            <input
              type="number"
              placeholder="예: 14 (오후 2시)"
              value={hour}
              onChange={e => setHour(e.target.value)}
              min="0"
              max="23"
              style={{
                backgroundColor: '#241F18',
                border: '1px solid #4A4540',
                color: '#E8DCC4',
                padding: '14px 16px',
                fontSize: '16px',
                outline: 'none',
                width: '100%',
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: '#C63D2F', fontSize: '13px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* 확인 버튼 */}
        <button
          onClick={handleSubmit}
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
          내 팔자 확인
        </button>
      </div>
    </div>
  )
}
