/**
 * 팔자전 — (3) 홈 화면 (점집 책상) Phase 2 리뉴얼
 * - 내 영웅 카드 (일간 원형 + 일지 영물 + 오행 분포 미니 바)
 * - 오늘의 운세 요약 (등급 + 풀이 1문장)
 * - [오늘의 출정] 버튼
 * - 하단 "사주 재입력" 텍스트 버튼
 */

import { useMemo } from 'react'
import type { SavedHeroProfile } from '../types/game'
import { getArchetypeByChar, getSpiritByChar } from '../engine/heroes'
import { getTodayFortune, getTodayDayElement, getFavorableElement } from '../engine/manseryeok'
import { getFortuneText, getDailyVariant } from '../data/fortuneTexts'

interface HomeScreenProps {
  onNewRun: () => void
  wins: number
  losses: number
  heroProfile: SavedHeroProfile | null
  onResetSaju: () => void
}

const ELEMENT_KO: Record<string, string> = {
  mok: '목(木)', hwa: '화(火)', to: '토(土)', geum: '금(金)', su: '수(水)',
}
const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}
const FORTUNE_LEVEL_KO: Record<string, string> = {
  daegil: '대길(大吉)', gil: '길(吉)', pyeong: '평(平)', hyung: '흉(凶)', daehyung: '대흉(大凶)',
}
const FORTUNE_LEVEL_COLORS: Record<string, string> = {
  daegil: '#D9A441', gil: '#4A9B6E', pyeong: '#D8CCB4', hyung: '#C63D2F', daehyung: '#8B1A1A',
}

export default function HomeScreen({ onNewRun, wins, losses, heroProfile, onResetSaju }: HomeScreenProps) {
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  const archetype = useMemo(() => {
    if (!heroProfile) return null
    return getArchetypeByChar(heroProfile.ilganChar)
  }, [heroProfile])

  const spirit = useMemo(() => {
    if (!heroProfile) return null
    return getSpiritByChar(heroProfile.iljiChar)
  }, [heroProfile])

  const fortune = useMemo(() => {
    if (!heroProfile) return null
    const level = getTodayFortune(heroProfile.ilganElement)
    const todayEl = getTodayDayElement()
    const now = new Date()
    const variant = getDailyVariant(now.getFullYear(), now.getMonth() + 1, now.getDate())
    const text = getFortuneText(level, heroProfile.ilganElement, variant)
    return { level, text, todayElement: todayEl }
  }, [heroProfile])

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '32px 20px' }}
    >
      {/* 상단 — 내 영웅 카드 */}
      {heroProfile && archetype && spirit ? (
        <div
          style={{
            border: '1px solid #2A2620',
            backgroundColor: '#1C1710',
            padding: '20px',
            marginBottom: '20px',
            position: 'relative',
          }}
        >
          {/* 영웅 헤더 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
            {/* 일주 한자 */}
            <div
              style={{
                width: '64px',
                height: '64px',
                border: `2px solid ${ELEMENT_COLORS[archetype.element]}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: '28px',
                  color: ELEMENT_COLORS[archetype.element],
                  fontWeight: 'bold',
                }}
              >
                {heroProfile.dayPillarChar}
              </span>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: '#6A6560', fontSize: '10px', letterSpacing: '0.2em', marginBottom: '4px' }}>
                내 영웅
              </div>
              <div style={{ color: '#E8DCC4', fontSize: '17px', letterSpacing: '0.1em', marginBottom: '2px' }}>
                {archetype.title}({heroProfile.dayPillarChar}) · 수호 영물: {spirit.animal}
              </div>
              <div style={{ color: '#8A8580', fontSize: '12px', letterSpacing: '0.06em' }}>
                {ELEMENT_KO[heroProfile.ilganElement]} 기운 · 일주 {heroProfile.dayPillarChar}
              </div>
            </div>
          </div>

          {/* 오행 분포 미니 바 */}
          <div>
            <div style={{ color: '#4A4540', fontSize: '10px', letterSpacing: '0.1em', marginBottom: '8px' }}>
              오행 분포
            </div>
            {(['mok', 'hwa', 'to', 'geum', 'su'] as const).map(el => {
              const count = heroProfile.elementDist[el] ?? 0
              const total = Object.values(heroProfile.elementDist).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? (count / total) * 100 : 20
              return (
                <div key={el} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <div style={{ width: '36px', textAlign: 'right', fontSize: '10px', color: ELEMENT_COLORS[el] }}>
                    {ELEMENT_KO[el]}
                  </div>
                  <div style={{ flex: 1, backgroundColor: '#2A2620', height: '5px', borderRadius: '2px' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: ELEMENT_COLORS[el],
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                  <div style={{ width: '16px', fontSize: '10px', color: '#4A4540' }}>{count}</div>
                </div>
              )
            })}
          </div>

          {/* 용신 안내 */}
          {(() => {
            const yongsin = getFavorableElement(heroProfile.ilganElement as any)
            const yongsinKo = ELEMENT_KO[yongsin] ?? yongsin
            return (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                borderTop: '1px solid #2A2620',
                color: '#8A8580',
                fontSize: '12px',
                lineHeight: '1.6',
                letterSpacing: '0.04em',
              }}>
                당신의 용신은 <span style={{ color: ELEMENT_COLORS[yongsin], fontWeight: 600 }}>{yongsinKo}</span> — 콤보에 섞으면 피해가 커집니다
              </div>
            )
          })()}
        </div>
      ) : (
        /* 영웅 없음 — 안내 */
        <div
          style={{
            border: '1px dashed #2A2620',
            backgroundColor: '#1A1710',
            padding: '24px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#4A4540', fontSize: '13px', letterSpacing: '0.1em' }}>
            사주를 입력하면 그대의 영웅이 깨어납니다
          </div>
        </div>
      )}

      {/* 오늘의 운세 */}
      {fortune && (
        <div
          style={{
            border: `1px solid ${FORTUNE_LEVEL_COLORS[fortune.level]}30`,
            backgroundColor: '#1C1710',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ color: '#6A6560', fontSize: '10px', letterSpacing: '0.2em' }}>
              오늘의 운세
            </div>
            <div
              style={{
                color: FORTUNE_LEVEL_COLORS[fortune.level],
                fontSize: '13px',
                fontWeight: 'bold',
                letterSpacing: '0.1em',
              }}
            >
              {FORTUNE_LEVEL_KO[fortune.level]}
            </div>
          </div>
          {/* 풀이 텍스트 — 첫 문장만 표시 */}
          <div
            style={{
              color: '#D8CCB4',
              fontSize: '12px',
              lineHeight: '1.7',
              letterSpacing: '0.04em',
            }}
          >
            {fortune.text.split('. ')[0] + '.'}
          </div>
        </div>
      )}

      {/* 전적 */}
      <div
        style={{
          border: '1px solid #2A2620',
          backgroundColor: '#1C1710',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-around',
        }}
      >
        {[
          { label: '승', value: wins, color: '#4A9B6E' },
          { label: '패', value: losses, color: '#C63D2F' },
          { label: '승률', value: `${winRate}%`, color: '#D8CCB4' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ color, fontSize: '22px', fontWeight: 'bold' }}>{value}</span>
            <span style={{ color: '#6A6560', fontSize: '11px' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* 출정 버튼 */}
      <button
        onClick={onNewRun}
        className="transition-all duration-150 active:scale-95"
        style={{
          backgroundColor: 'transparent',
          border: '1px solid #B33A2B',
          color: '#E8DCC4',
          padding: '20px',
          fontSize: '16px',
          letterSpacing: '0.2em',
          cursor: 'pointer',
          width: '100%',
          minHeight: '64px',
          marginBottom: '12px',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#B33A2B'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
        }}
      >
        오늘의 출정
      </button>

      {/* 하단 */}
      <div className="mt-auto text-center pb-4">
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '4px' }}>
          <button
            onClick={() => {
              try {
                localStorage.removeItem('paljajeon_tutorial_done_v1')
                localStorage.removeItem('paljajeon_games_played')
              } catch { /* noop */ }
            }}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#4A4540',
              fontSize: '11px',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '8px',
            }}
          >
            처음 가이드 다시 보기
          </button>
          <button
            onClick={onResetSaju}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#4A4540',
              fontSize: '11px',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '8px',
            }}
          >
            사주 재입력
          </button>
        </div>
        <div style={{ color: '#2A2620', fontSize: '10px', letterSpacing: '0.1em', marginTop: '8px' }}>
          팔자전 八字戰 · Phase 2
        </div>
      </div>
    </div>
  )
}
