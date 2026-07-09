/**
 * 팔자전 — (2) 사주입력 화면 (Phase 2)
 * - 양/음력 토글 (기존 유지)
 * - 12시진 드롭다운 (숫자 입력 → 드롭다운)
 * - 성별 선택 추가 (영웅 음양 표기용)
 * - 영웅 공개 연출 추가 (P2-2)
 */

import { useState, useEffect } from 'react'
import type { SajuInfo } from '../types/game'
import { getSajuFromSolar, getSajuFromLunar, getSajuElementDistribution } from '../engine/manseryeok'
import { getArchetypeByChar, getSpiritByChar } from '../engine/heroes'

interface SajuInputScreenProps {
  onComplete: (saju: SajuInfo) => void
}

/** 12시진 (시간 → 시진 이름 + 대표 시각) */
const SHICHEN = [
  { value: 23, label: '자시(子時) — 23:00~01:00', hour: 23 },
  { value: 1,  label: '축시(丑時) — 01:00~03:00', hour: 1  },
  { value: 3,  label: '인시(寅時) — 03:00~05:00', hour: 3  },
  { value: 5,  label: '묘시(卯時) — 05:00~07:00', hour: 5  },
  { value: 7,  label: '진시(辰時) — 07:00~09:00', hour: 7  },
  { value: 9,  label: '사시(巳時) — 09:00~11:00', hour: 9  },
  { value: 11, label: '오시(午時) — 11:00~13:00', hour: 11 },
  { value: 13, label: '미시(未時) — 13:00~15:00', hour: 13 },
  { value: 15, label: '신시(申時) — 15:00~17:00', hour: 15 },
  { value: 17, label: '유시(酉時) — 17:00~19:00', hour: 17 },
  { value: 19, label: '술시(戌時) — 19:00~21:00', hour: 19 },
  { value: 21, label: '해시(亥時) — 21:00~23:00', hour: 21 },
]

const ELEMENT_KO: Record<string, string> = {
  mok: '목(木)', hwa: '화(火)', to: '토(土)', geum: '금(金)', su: '수(水)',
}
const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}

/** 영웅 공개 연출 단계 */
type RevealStep = 'none' | 'awakening' | 'name' | 'elements' | 'done'

export default function SajuInputScreen({ onComplete }: SajuInputScreenProps) {
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [shichenValue, setShichenValue] = useState<string>('')
  const [isLunar, setIsLunar] = useState(false)
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [error, setError] = useState('')

  // 영웅 공개 연출 상태
  const [revealStep, setRevealStep] = useState<RevealStep>('none')
  const [revealedSaju, setRevealedSaju] = useState<SajuInfo | null>(null)
  const [heroData, setHeroData] = useState<{
    dayPillarChar: string
    archetypeTitle: string
    archetypeName: string
    spiritName: string
    elementDist: Record<string, number>
  } | null>(null)

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

    setError('')
    const hour = shichenValue !== '' ? parseInt(shichenValue) : undefined

    const sajuInfo: SajuInfo = {
      birthYear: y,
      birthMonth: m,
      birthDay: d,
      birthHour: hour,
      isLunar,
      gender: gender || undefined,
    }

    // 영웅 정보 미리 계산
    try {
      const sajuResult = isLunar
        ? getSajuFromLunar(y, m, d, false, hour)
        : getSajuFromSolar(y, m, d, hour)

      const archetype = getArchetypeByChar(sajuResult.day.cheonganChar)
      const spirit = getSpiritByChar(sajuResult.day.jijiChar)
      const elementDist = getSajuElementDistribution(y, m, d, hour, isLunar)

      setHeroData({
        dayPillarChar: sajuResult.day.char,
        archetypeTitle: archetype?.title ?? '전사',
        archetypeName: archetype?.name ?? sajuResult.day.cheonganChar,
        spiritName: spirit?.animal ?? sajuResult.day.jijiChar,
        elementDist,
      })
      setRevealedSaju(sajuInfo)
      setRevealStep('awakening')
    } catch {
      // 계산 실패 시 바로 진행
      onComplete(sajuInfo)
    }
  }

  // 단계별 연출 타이머
  useEffect(() => {
    if (revealStep === 'awakening') {
      const t = setTimeout(() => setRevealStep('name'), 1600)
      return () => clearTimeout(t)
    }
    if (revealStep === 'name') {
      const t = setTimeout(() => setRevealStep('elements'), 1800)
      return () => clearTimeout(t)
    }
    if (revealStep === 'elements') {
      const t = setTimeout(() => setRevealStep('done'), 2000)
      return () => clearTimeout(t)
    }
  }, [revealStep])

  const handleRevealComplete = () => {
    if (revealedSaju) onComplete(revealedSaju)
  }

  // 영웅 공개 연출 화면
  if (revealStep !== 'none' && heroData) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: '#16130F',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        {/* 1단계: 깨어납니다 */}
        {(revealStep === 'awakening') && (
          <div style={{ animation: 'fadeIn 0.8s ease-in' }}>
            <div style={{ color: '#6A6560', fontSize: '13px', letterSpacing: '0.3em', marginBottom: '24px' }}>
              팔자(八字)의 봉인이 풀립니다
            </div>
            <div
              style={{
                color: '#D9A441',
                fontSize: '20px',
                letterSpacing: '0.2em',
                lineHeight: 1.8,
              }}
            >
              그대의 영웅이 깨어납니다...
            </div>
          </div>
        )}

        {/* 2단계: 영웅 이름 */}
        {(revealStep === 'name' || revealStep === 'elements' || revealStep === 'done') && (
          <div style={{ animation: 'fadeIn 0.6s ease-in' }}>
            {/* 일주 한자 */}
            <div
              style={{
                fontSize: '72px',
                color: '#D9A441',
                letterSpacing: '0.15em',
                marginBottom: '12px',
                textShadow: '0 0 20px rgba(217,164,65,0.4)',
              }}
            >
              {heroData.dayPillarChar}
            </div>

            {/* 원형 이름 */}
            <div style={{ color: '#E8DCC4', fontSize: '20px', letterSpacing: '0.15em', marginBottom: '4px' }}>
              {heroData.archetypeName}
            </div>
            <div style={{ color: '#B33A2B', fontSize: '14px', letterSpacing: '0.1em', marginBottom: '8px' }}>
              {heroData.archetypeTitle}
            </div>

            {/* 영물 */}
            <div style={{ color: '#8A8580', fontSize: '13px', letterSpacing: '0.08em', marginBottom: '32px' }}>
              수호 영물 — {heroData.spiritName}
            </div>

            {/* 오행 분포 바 (elements 단계부터) */}
            {(revealStep === 'elements' || revealStep === 'done') && (
              <div
                style={{
                  width: '280px',
                  margin: '0 auto 32px',
                  animation: 'fadeIn 0.6s ease-in',
                }}
              >
                <div style={{ color: '#6A6560', fontSize: '11px', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  오행 분포
                </div>
                {(['mok', 'hwa', 'to', 'geum', 'su'] as const).map(el => {
                  const count = heroData.elementDist[el] ?? 0
                  const total = Object.values(heroData.elementDist).reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? (count / total) * 100 : 20
                  return (
                    <div key={el} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ width: '40px', textAlign: 'right', fontSize: '11px', color: ELEMENT_COLORS[el] }}>
                        {ELEMENT_KO[el]}
                      </div>
                      <div style={{ flex: 1, backgroundColor: '#2A2620', height: '8px', borderRadius: '2px' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: ELEMENT_COLORS[el],
                            borderRadius: '2px',
                            transition: 'width 0.8s ease-out',
                          }}
                        />
                      </div>
                      <div style={{ width: '20px', fontSize: '11px', color: '#6A6560' }}>
                        {count}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 완료 버튼 (done 단계) */}
            {revealStep === 'done' && (
              <button
                onClick={handleRevealComplete}
                style={{
                  backgroundColor: '#B33A2B',
                  border: 'none',
                  color: '#E8DCC4',
                  padding: '16px 48px',
                  fontSize: '15px',
                  letterSpacing: '0.2em',
                  cursor: 'pointer',
                  animation: 'fadeIn 0.4s ease-in',
                }}
              >
                전장으로 나아가라
              </button>
            )}
          </div>
        )}

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  // 기본 입력 화면
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
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}

          {/* 시진 드롭다운 (12시진) */}
          <div className="flex flex-col gap-2">
            <label style={{ color: '#D8CCB4', fontSize: '13px', letterSpacing: '0.1em' }}>
              태어난 시 <span style={{ color: '#4A4540' }}>(선택 — 미입력 시 시주 미사용)</span>
            </label>
            <select
              value={shichenValue}
              onChange={e => setShichenValue(e.target.value)}
              style={{
                backgroundColor: '#241F18',
                border: '1px solid #4A4540',
                color: shichenValue !== '' ? '#E8DCC4' : '#6A6560',
                padding: '14px 16px',
                fontSize: '15px',
                outline: 'none',
                width: '100%',
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="">시주 미사용 (모름)</option>
              {SHICHEN.map(s => (
                <option key={s.value} value={s.value.toString()}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* 성별 선택 */}
          <div className="flex flex-col gap-2">
            <label style={{ color: '#D8CCB4', fontSize: '13px', letterSpacing: '0.1em' }}>
              성별 <span style={{ color: '#4A4540' }}>(선택 — 영웅 음양 표기용)</span>
            </label>
            <div className="flex gap-3">
              {[
                { value: '', label: '선택 안 함' },
                { value: 'male', label: '남(男)' },
                { value: 'female', label: '여(女)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setGender(opt.value as 'male' | 'female' | '')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '1px solid',
                    borderColor: gender === opt.value ? '#B33A2B' : '#4A4540',
                    color: gender === opt.value ? '#E8DCC4' : '#6A6560',
                    backgroundColor: 'transparent',
                    fontSize: '13px',
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
