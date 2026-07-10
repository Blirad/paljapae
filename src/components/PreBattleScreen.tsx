/**
 * 팔자전 — 출전준비 화면 (PreBattleScreen) Phase 1.7
 *
 * Phase 1.7 변경:
 *  - 1-A: Step 1에서 버리기/공격 카운터 제거 (카드 확인만)
 *  - 1-B: 오행 분포 오각형 차트 + 주력 전략 1줄 텍스트 추가
 *  - 2-A: 사주 기반 가호 필터링 (유저 사주에 실제 존재하는 십성만)
 *  - 2-B: 가호 선택 화면 상단 "내 사주의 가호: ○○, ○○" 표시
 *  - 3-B: 조합 도감 버튼 (ComboGuide 오버레이)
 */

import { useState, useMemo } from 'react'
import type { Card, Element } from '../types/game'
import type { SavedHeroProfile } from '../types/game'
import type { Passive } from '../types/passive'
import { PASSIVE_POOL, PASSIVE_RARITY_COLORS, PASSIVE_RARITY_BORDER, PASSIVE_RARITY_LABEL } from '../types/passive'
import ComboGuide from './ComboGuide'

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

// ---- Phase 1.7: 2-A 사주 기반 십성 계산 ----

/**
 * 천간 → 오행 배속표
 * 甲乙=목, 丙丁=화, 戊己=토, 庚辛=금, 壬癸=수
 */
const HEAVENLY_STEM_ELEMENT: Record<string, Element> = {
  '甲': 'mok', '乙': 'mok',
  '丙': 'hwa', '丁': 'hwa',
  '戊': 'to',  '己': 'to',
  '庚': 'geum', '辛': 'geum',
  '壬': 'su',  '癸': 'su',
}

/**
 * 천간 양/음 극성 (양=짝수 인덱스: 甲丙戊庚壬)
 */
const HEAVENLY_STEM_POLARITY: Record<string, 'yang' | 'yin'> = {
  '甲': 'yang', '乙': 'yin',
  '丙': 'yang', '丁': 'yin',
  '戊': 'yang', '己': 'yin',
  '庚': 'yang', '辛': 'yin',
  '壬': 'yang', '癸': 'yin',
}

/**
 * 오행 상생: A가 B를 생(生)한다
 */
const SAENGCHAE_MAP: Record<Element, Element> = {
  mok: 'hwa', hwa: 'to', to: 'geum', geum: 'su', su: 'mok',
}

/**
 * 오행 상극: A가 B를 극(克)한다
 */
const GEUK_MAP: Record<Element, Element> = {
  mok: 'to', hwa: 'geum', to: 'su', geum: 'mok', su: 'hwa',
}

/**
 * 일간 기준 타 천간의 십성 계산
 * 반환: 십성 코드 ('sikshin' | 'bigyeon' | 'geoptae' | 'sanggwan' | 'pyeonjae' | 'jeongjae' | 'pyeonin')
 *       미해당(정관·편관·정인)은 null
 */
function calcSipsong(
  ilganChar: string,
  targetChar: string,
): string | null {
  if (!ilganChar || !targetChar || ilganChar === targetChar) return null
  const ilEl = HEAVENLY_STEM_ELEMENT[ilganChar]
  const targetEl = HEAVENLY_STEM_ELEMENT[targetChar]
  if (!ilEl || !targetEl) return null

  const ilPol = HEAVENLY_STEM_POLARITY[ilganChar]
  const targetPol = HEAVENLY_STEM_POLARITY[targetChar]
  if (!ilPol || !targetPol) return null

  const samePolarity = ilPol === targetPol

  // 같은 오행
  if (ilEl === targetEl) {
    return samePolarity ? 'bigyeon' : 'geoptae'
  }

  // 일간이 생(生)하는 오행
  if (SAENGCHAE_MAP[ilEl] === targetEl) {
    return samePolarity ? 'sikshin' : 'sanggwan'
  }

  // 일간이 극(克)하는 오행
  if (GEUK_MAP[ilEl] === targetEl) {
    return samePolarity ? 'pyeonjae' : 'jeongjae'
  }

  // 일간을 생(生)하는 오행 (편인만 — 양간이면 편인)
  // 임의 결정 로그: 정인(음간이 일간을 생)은 Phase 1.7 미구현. 편인(양간)만 반환.
  const whatGeneratesIl = (Object.entries(SAENGCHAE_MAP) as [Element, Element][])
    .find(([_, target]) => target === ilEl)?.[0]
  if (whatGeneratesIl && targetEl === whatGeneratesIl) {
    return samePolarity ? 'pyeonin' : null  // 정인은 null (미구현)
  }

  return null
}

/**
 * heroProfile의 연/월/일 천간으로부터 유저 보유 십성 목록 계산
 * 임의 결정: dayPillarChar 첫 글자만 일간 천간으로 사용
 */
function getUserSipsongs(heroProfile: SavedHeroProfile): string[] {
  const ilganChar = heroProfile.ilganChar
  if (!ilganChar) return []

  // dayPillarChar = "壬寅" 형태 — 첫 글자가 일간 천간
  // 연월일 천간 목록 추출 (저장된 구조에 따라)
  // Phase 1.7 임의 결정: heroProfile에 연/월 천간이 없으므로,
  // 일간 오행으로부터 이론상 출현 가능한 십성 집합을 계산한다.
  // 구체적으로: 일간 기준 7종 십성 모두 허용하되, 관련 오행 카드와 연결.
  // 단, 실제 만세역 연산 없이 오행 분포(elementDist)로 근사:
  //   elementDist에 존재하는 오행과 일간의 관계로 보유 십성 결정.
  const ilEl = HEAVENLY_STEM_ELEMENT[ilganChar]
  if (!ilEl) return []

  const dist = heroProfile.elementDist  // Record<Element, number>
  const sipsongs = new Set<string>()

  // 각 천간에 대해 십성 계산 (대표 양간/음간 사용)
  const HEAVENLY_STEMS: string[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
  for (const stem of HEAVENLY_STEMS) {
    if (stem === ilganChar) continue
    const stemEl = HEAVENLY_STEM_ELEMENT[stem]
    if (!stemEl) continue
    // elementDist에 해당 오행이 있으면 그 십성을 보유한 것으로 간주
    if (dist[stemEl] > 0) {
      const ss = calcSipsong(ilganChar, stem)
      if (ss) sipsongs.add(ss)
    }
  }

  // 일간 자신의 오행도 비견/겁재 후보 (항상 보유)
  sipsongs.add('bigyeon')

  return Array.from(sipsongs)
}

/**
 * 사주 기반 가호 필터링 + 풀 4개 추출
 * 2-A: heroProfile 있으면 → 유저 사주 십성 가호만 후보
 *      없으면 → 전체 풀
 */
function pickPassives(
  seed: number,
  heroProfile?: SavedHeroProfile | null,
): { passive: Passive; isSajuPriority: boolean }[] {
  const rng = makeLCG(seed)

  let candidatePool: Passive[]
  let isSajuFiltered = false

  if (heroProfile) {
    const userSipsongs = getUserSipsongs(heroProfile)
    if (userSipsongs.length >= 2) {
      // 사주에 존재하는 십성 가호만
      candidatePool = PASSIVE_POOL.filter(p => userSipsongs.includes(p.sipsong))
      isSajuFiltered = true
    } else {
      // 보유 십성이 너무 적으면 전 풀 사용 (임의 결정)
      candidatePool = [...PASSIVE_POOL]
    }
  } else {
    candidatePool = [...PASSIVE_POOL]
  }

  // candidatePool에서 4개 추출 (부족 시 전 풀로 보완)
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

  let picked = pickFrom(candidatePool, 4)

  // 4개 미만이면 전 풀에서 보완
  if (picked.length < 4) {
    const extra = pickFrom(
      PASSIVE_POOL.filter(p => !picked.find(r => r.id === p.id)),
      4 - picked.length,
    )
    picked = [...picked, ...extra]
  }

  return picked.slice(0, 4).map(p => ({
    passive: p,
    isSajuPriority: isSajuFiltered,
  }))
}

// ---- 오각형 차트 ----

const ELEMENT_KO: Record<string, string> = {
  mok: '나무', hwa: '불', to: '흙', geum: '쇠', su: '물',
}
const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}

const PENTAGON_ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

/**
 * 오각형 차트 SVG (무라이브러리)
 * elementDist: {mok, hwa, to, geum, su} → 각 꼭짓점 비율
 */
function PentagonChart({ dist }: { dist: Record<string, number> }) {
  const cx = 80, cy = 80, r = 60

  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1
  // 꼭짓점 좌표 계산 (12시 방향부터 시계방향)
  const points = PENTAGON_ELEMENTS.map((el, i) => {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const ratio = (dist[el] ?? 0) / total
    const rv = r * 0.2 + r * 0.8 * ratio  // 최소 20%, 최대 100%
    return {
      x: cx + rv * Math.cos(angle),
      y: cy + rv * Math.sin(angle),
      outerX: cx + r * Math.cos(angle),
      outerY: cy + r * Math.sin(angle),
      labelX: cx + (r + 16) * Math.cos(angle),
      labelY: cy + (r + 16) * Math.sin(angle),
      el,
      ratio,
    }
  })

  const polygonPoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const outerPoints = points.map(p => `${p.outerX.toFixed(1)},${p.outerY.toFixed(1)}`).join(' ')

  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ display: 'block', margin: '0 auto' }}>
      {/* 배경 오각형 (외곽선) */}
      <polygon
        points={outerPoints}
        fill="none"
        stroke="#2A2620"
        strokeWidth="1"
      />
      {/* 내부 격자선 */}
      {[0.25, 0.5, 0.75].map(ratio => {
        const gridPoints = PENTAGON_ELEMENTS.map((_, i) => {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
          return `${(cx + r * ratio * Math.cos(angle)).toFixed(1)},${(cy + r * ratio * Math.sin(angle)).toFixed(1)}`
        }).join(' ')
        return (
          <polygon key={ratio} points={gridPoints} fill="none" stroke="#2A2620" strokeWidth="0.5" />
        )
      })}
      {/* 중심선 */}
      {points.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.outerX.toFixed(1)} y2={p.outerY.toFixed(1)} stroke="#2A2620" strokeWidth="0.5" />
      ))}
      {/* 데이터 오각형 */}
      <polygon
        points={polygonPoints}
        fill="rgba(217,164,65,0.2)"
        stroke="#D9A441"
        strokeWidth="1.5"
      />
      {/* 꼭짓점 점 */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x.toFixed(1)}
          cy={p.y.toFixed(1)}
          r="3"
          fill={ELEMENT_COLORS[p.el]}
        />
      ))}
      {/* 라벨 */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.labelX.toFixed(1)}
          y={p.labelY.toFixed(1)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={ELEMENT_COLORS[p.el]}
          fontSize="9"
          fontWeight="bold"
        >
          {ELEMENT_KO[p.el]}
        </text>
      ))}
    </svg>
  )
}

/**
 * 주력 전략 텍스트 (최다 오행 기준)
 */
function getStrategyText(dist: Record<string, number>): string {
  let maxEl: string = 'mok'
  let maxVal = -1
  let isDraw = false

  for (const el of PENTAGON_ELEMENTS) {
    const v = dist[el] ?? 0
    if (v > maxVal) {
      maxVal = v
      maxEl = el
      isDraw = false
    } else if (v === maxVal) {
      isDraw = true
    }
  }

  if (isDraw) return '오행이 고른 덱 — 상황에 따라 다양한 조합을 시도하라'

  const MAP: Record<string, string> = {
    su:   '물이 많은 덱 — 같은 기운 모으기가 유리하다',
    hwa:  '불이 많은 덱 — 기운 이어가기로 폭발적 피해를 노려라',
    mok:  '나무가 많은 덱 — 생기(生氣)의 흐름으로 적을 압도하라',
    to:   '흙이 많은 덱 — 방어와 결집으로 중심을 잡아라',
    geum: '쇠가 많은 덱 — 날카로운 연속 공격으로 밀어붙여라',
  }

  return MAP[maxEl] ?? '오행이 고른 덱 — 상황에 따라 다양한 조합을 시도하라'
}

// ---- 메인 컴포넌트 ----

export default function PreBattleScreen({ hand, onComplete, seed, heroProfile }: PreBattleScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedPassives, setSelectedPassives] = useState<string[]>([])
  const [showComboGuide, setShowComboGuide] = useState(false)

  const passiveOptions = useMemo(
    () => pickPassives(seed ?? Date.now(), heroProfile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, heroProfile?.ilganChar],
  )

  // 2-B: 사주 기반 가호 이름 목록 (상단 표시용)
  const sajuPassiveNames = useMemo(() => {
    if (!heroProfile) return []
    return passiveOptions.filter(p => p.isSajuPriority).map(p => p.passive.name)
  }, [passiveOptions, heroProfile])

  // 오행 분포 (heroProfile 있으면 사용, 없으면 핸드 기반)
  const elementDist = useMemo<Record<string, number>>(() => {
    if (heroProfile?.elementDist) return heroProfile.elementDist
    // 핸드 기반 분포 fallback
    const d: Record<string, number> = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 }
    for (const card of hand) d[card.element] = (d[card.element] ?? 0) + 1
    return d
  }, [heroProfile, hand])

  const strategyText = useMemo(() => getStrategyText(elementDist), [elementDist])

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
    <>
      {/* 조합 도감 오버레이 */}
      {showComboGuide && <ComboGuide onClose={() => setShowComboGuide(false)} />}

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
        {/* 진행도 + 도감 버튼 */}
        <div
          style={{
            backgroundColor: '#1C1710',
            borderBottom: '1px solid #2A2620',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            position: 'relative',
          }}
        >
          {/* 3-B: 조합 도감 버튼 */}
          <button
            onClick={() => setShowComboGuide(true)}
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'transparent',
              border: '1px solid #4A4540',
              color: '#6A6560',
              width: '32px',
              height: '32px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="조합 도감"
          >
            册
          </button>

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
                출정 전 손에 쥔 패를 확인하라
              </div>

              {/* 카드 표시 (버리기/공격 카운터 제거) */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
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

              {/* 1-B: 오각형 차트 + 주력 전략 */}
              <div style={{ backgroundColor: '#1C1710', border: '1px solid #2A2620', borderRadius: '4px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ color: '#6A6560', fontSize: '10px', textAlign: 'center', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  오행 분포
                </div>
                <PentagonChart dist={elementDist} />
                <div
                  style={{
                    marginTop: '12px',
                    color: '#D9A441',
                    fontSize: '11px',
                    textAlign: 'center',
                    letterSpacing: '0.04em',
                    lineHeight: '1.6',
                  }}
                >
                  {strategyText}
                </div>
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
              <div style={{ color: '#6A6560', fontSize: '12px', marginBottom: '12px', textAlign: 'center', letterSpacing: '0.06em', lineHeight: '1.7' }}>
                출정 전, 그대를 지킬 두 가호를 고르십시오.<br/>
                <span style={{ color: '#4A4540' }}>{selectedPassives.length}/2 선택됨</span>
              </div>

              {/* 2-B: 사주 기반 가호 요약 */}
              {heroProfile && sajuPassiveNames.length > 0 && (
                <div style={{
                  backgroundColor: 'rgba(179,58,43,0.08)',
                  border: '1px solid rgba(179,58,43,0.3)',
                  borderRadius: '2px',
                  padding: '6px 12px',
                  marginBottom: '12px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#B33A2B',
                  letterSpacing: '0.06em',
                }}>
                  내 사주의 가호: {sajuPassiveNames.join(', ')}
                </div>
              )}

              {/* 사주 기반 안내 */}
              {heroProfile && (
                <div style={{ color: '#6A6560', fontSize: '10px', textAlign: 'center', marginBottom: '12px', letterSpacing: '0.06em' }}>
                  그대의 일간 {heroProfile.ilganElement && ELEMENT_KO[heroProfile.ilganElement]} 기운이 가호에 깃들었습니다
                </div>
              )}

              {/* 4개 가호 카드 */}
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
                선택한 가호를 품고 출정하라
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
    </>
  )
}
