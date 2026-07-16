/**
 * 팔자전 — 레시피 내비게이터 접이식 (RecipeNavigator.tsx)
 * 배치 1.5-C 리팩토링: Balatro 원칙 — 결과는 상시, 목록은 호출
 *
 * 기본 상태 = 1줄 칩: 성립 N건 + 근접 1건
 * 탭 클릭 → 펼침: 전체 10종 레시피 冊
 * 카드 조작(selectedCards 변경) → 자동 접힘
 * 손패 가림 방지: 펼침 상태 max-height 제한 + 위쪽 방향 오버레이
 *
 * 표시 조건: recipe 모드 한정 (호출 측에서 조건부 렌더)
 */

import { useState, useEffect, useRef } from 'react'
import type { Card, Element } from '../types/game'
import { RECIPE_MAP } from '../engine/balance'

// 레시피 ID → 한글명
const RECIPE_KO_NAME: Record<string, string> = {
  fusion_forest:   '숲',
  fusion_spring:   '샘',
  fusion_mine:     '광맥',
  fusion_kiln:     '옹기가마',
  fusion_wildfire: '들불',
  fusion_keen:     '벼림',
  fusion_harvest:  '개간',
  fusion_pierce:   '제방',
  fusion_snipe:    '담금질',
  fusion_temper:   '주물',
}

// 레시피 유형 한글
const RECIPE_TYPE_KO: Record<string, string> = {
  birth: '낳는',
  hone:  '벼리는',
}

// 원소 한자
const ELEMENT_HANJA: Record<Element, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}

// 원소 색상
const ELEMENT_COLOR: Record<Element, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}

interface RecipeStatus {
  recipeId: string
  koName: string
  fusionType: string
  size: 'small' | 'large'
  elem1: Element
  elem2: Element
  catalystCount: number
  fuelCount: number
  needCatalyst: number
  needFuel: number
  ready: boolean
  oneAway: boolean
  /** 총 부족 장수 (0=성립, 1=근접, 2+=미달) */
  totalNeed: number
}

/** 현재 핸드에서 레시피 성립 상태 분석 */
function analyzeRecipes(hand: Card[]): RecipeStatus[] {
  const counts: Record<Element, number> = {
    mok: 0, hwa: 0, to: 0, geum: 0, su: 0,
  }
  for (const card of hand) {
    counts[card.element]++
  }

  const statuses: RecipeStatus[] = []

  for (const [recipeId, spec] of Object.entries(RECIPE_MAP)) {
    const koName = RECIPE_KO_NAME[recipeId] ?? recipeId
    const fusionType = spec.fusionType ?? 'birth'
    const { elem1, elem2 } = spec.small

    const catalystCount = counts[elem1 as Element] ?? 0
    const fuelCount = counts[elem2 as Element] ?? 0

    // 소형: elem1 >= 1, elem2 >= 2
    const smallNeedCatalyst = Math.max(0, 1 - catalystCount)
    const smallNeedFuel = Math.max(0, 2 - fuelCount)
    const smallTotal = smallNeedCatalyst + smallNeedFuel
    const smallReady = smallTotal === 0
    const smallOneAway = !smallReady && smallTotal === 1

    // 대형: elem1 >= 2, elem2 >= 3
    const largeNeedCatalyst = Math.max(0, 2 - catalystCount)
    const largeNeedFuel = Math.max(0, 3 - fuelCount)
    const largeTotal = largeNeedCatalyst + largeNeedFuel
    const largeReady = largeTotal === 0
    const largeOneAway = !largeReady && largeTotal === 1

    if (smallReady) {
      statuses.push({
        recipeId, koName, fusionType,
        size: 'small',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: 0, needFuel: 0,
        ready: true, oneAway: false,
        totalNeed: 0,
      })
    }
    if (largeReady) {
      statuses.push({
        recipeId, koName, fusionType,
        size: 'large',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: 0, needFuel: 0,
        ready: true, oneAway: false,
        totalNeed: 0,
      })
    }
    // 근접: 소형 근접 우선, 대형 근접은 소형 미성립 시만
    if (!smallReady && smallOneAway) {
      statuses.push({
        recipeId, koName, fusionType,
        size: 'small',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: smallNeedCatalyst,
        needFuel: smallNeedFuel,
        ready: false, oneAway: true,
        totalNeed: smallTotal,
      })
    } else if (!largeReady && largeOneAway) {
      statuses.push({
        recipeId, koName, fusionType,
        size: 'large',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: largeNeedCatalyst,
        needFuel: largeNeedFuel,
        ready: false, oneAway: true,
        totalNeed: largeTotal,
      })
    }
    // 미달 항목: 소형 기준으로만 1건 (펼침 冊에 표시용)
    if (!smallReady && !smallOneAway) {
      statuses.push({
        recipeId, koName, fusionType,
        size: 'small',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: smallNeedCatalyst,
        needFuel: smallNeedFuel,
        ready: false, oneAway: false,
        totalNeed: smallTotal,
      })
    }
  }

  return statuses
}

interface RecipeNavigatorProps {
  hand: Card[]
  selectedCards: string[]
}

/**
 * 레시피 내비게이터 접이식
 * 기본: 1줄 칩 / 탭 클릭: 전체 冊 / 카드 조작: 자동 접힘
 */
export default function RecipeNavigator({ hand, selectedCards }: RecipeNavigatorProps) {
  const [expanded, setExpanded] = useState(false)
  const prevSelectedRef = useRef<string>(selectedCards.slice().sort().join(','))

  // 카드 선택 변경 감지 → 자동 접힘
  useEffect(() => {
    const current = selectedCards.slice().sort().join(',')
    if (current !== prevSelectedRef.current) {
      prevSelectedRef.current = current
      if (expanded) {
        setExpanded(false)
      }
    }
  }, [selectedCards, expanded])

  const statuses = analyzeRecipes(hand)

  // 성립 목록
  const readyList = statuses.filter(s => s.ready)
  // 근접 1건 (성립 아닌 것 중 소형 우선)
  const oneAwayList = statuses
    .filter(s => s.oneAway && !s.ready)
    .sort((a, b) => {
      if (a.size === 'small' && b.size !== 'small') return -1
      if (a.size !== 'small' && b.size === 'small') return 1
      return 0
    })
  const topOneAway = oneAwayList[0]

  // 아무것도 없으면 null
  if (readyList.length === 0 && !topOneAway) return null

  // ---- 전체 冊 목록: 레시피ID 기준 대표 항목만 (중복 제거) ----
  // 우선순위: ready(대형) > ready(소형) > oneAway > 미달
  const bookEntries: RecipeStatus[] = []
  const seenIds = new Set<string>()
  // 성립 먼저
  for (const s of statuses.filter(st => st.ready)) {
    if (!seenIds.has(s.recipeId + s.size)) {
      seenIds.add(s.recipeId + s.size)
      bookEntries.push(s)
    }
  }
  // 근접
  for (const s of statuses.filter(st => st.oneAway && !st.ready)) {
    if (!seenIds.has(s.recipeId)) {
      seenIds.add(s.recipeId)
      bookEntries.push(s)
    }
  }
  // 미달 (전체 10종 커버)
  for (const s of statuses.filter(st => !st.ready && !st.oneAway)) {
    if (!seenIds.has(s.recipeId)) {
      seenIds.add(s.recipeId)
      bookEntries.push(s)
    }
  }

  // ---- 칩 텍스트 ----
  const chipText = (() => {
    const readyCount = readyList.length
    const parts: string[] = []
    if (readyCount > 0) parts.push(`성립 ${readyCount}건`)
    if (topOneAway) parts.push(`근접: ${topOneAway.koName}`)
    return parts.join(' · ')
  })()

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: '4px',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        pointerEvents: 'none',
      }}
    >
      {/* 펼침 패널 — max-height 제한으로 손패 가림 방지 */}
      {expanded && (
        <div
          style={{
            backgroundColor: 'rgba(18,15,10,0.97)',
            border: '1px solid rgba(217,164,65,0.4)',
            borderBottom: 'none',
            borderRadius: '6px 6px 0 0',
            padding: '8px 10px',
            maxHeight: '28vh',
            overflowY: 'auto',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {/* 제목 */}
          <div
            style={{
              fontSize: '10px',
              color: '#8A7F6E',
              letterSpacing: '0.12em',
              marginBottom: '4px',
              fontWeight: 600,
            }}
          >
            레시피 冊 (10종)
          </div>

          {/* 전체 목록 */}
          {bookEntries.map((s, idx) => {
            const isReady = s.ready
            const isOneAway = s.oneAway && !s.ready

            return (
              <div
                key={`book-${s.recipeId}-${s.size}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  opacity: isReady ? 1 : isOneAway ? 0.75 : 0.4,
                  borderBottom: '1px solid rgba(100,90,70,0.15)',
                  paddingBottom: '2px',
                }}
              >
                {/* 유형 뱃지 */}
                <span
                  style={{
                    fontSize: '8px',
                    color: '#6A6560',
                    minWidth: '26px',
                  }}
                >
                  {RECIPE_TYPE_KO[s.fusionType] ?? s.fusionType}
                </span>

                {/* 레시피 이름 */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: isReady ? 700 : 500,
                    color: isReady ? '#FFD98A' : isOneAway ? '#D8CCB4' : '#7A7060',
                    minWidth: '44px',
                  }}
                >
                  {s.koName}
                </span>

                {/* 원소 표시 */}
                <span style={{ fontSize: '10px', color: ELEMENT_COLOR[s.elem1] }}>
                  {ELEMENT_HANJA[s.elem1]}
                </span>
                <span style={{ fontSize: '9px', color: '#5A5550' }}>+</span>
                <span style={{ fontSize: '10px', color: ELEMENT_COLOR[s.elem2] }}>
                  {ELEMENT_HANJA[s.elem2]}
                </span>

                {/* 크기 */}
                <span
                  style={{
                    fontSize: '8px',
                    color: isReady ? '#4A9B6E' : '#5A5550',
                    marginLeft: '2px',
                  }}
                >
                  {s.size === 'large' ? '대형' : '소형'}
                </span>

                {/* 상태 표시 */}
                <span
                  style={{
                    fontSize: '9px',
                    color: isReady ? '#4A9B6E' : isOneAway ? '#9A8A60' : '#4A4540',
                    marginLeft: 'auto',
                    fontWeight: isReady ? 700 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isReady
                    ? '성립'
                    : isOneAway
                      ? (s.needCatalyst > 0
                        ? `${ELEMENT_HANJA[s.elem1]} 1장 부족`
                        : `${ELEMENT_HANJA[s.elem2]} 1장 부족`)
                      : `${s.totalNeed}장 부족`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 1줄 칩 (항상 표시, 클릭으로 토글) */}
      <div
        onClick={() => setExpanded(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 10px',
          backgroundColor: expanded
            ? 'rgba(30,25,18,0.98)'
            : 'rgba(22,19,15,0.92)',
          border: `1px solid ${expanded ? 'rgba(217,164,65,0.55)' : 'rgba(217,164,65,0.30)'}`,
          borderRadius: expanded ? '0 0 4px 4px' : '4px',
          cursor: 'pointer',
          pointerEvents: 'auto',
          userSelect: 'none',
          gap: '8px',
          transition: 'background-color 0.15s ease',
        }}
      >
        {/* 상태 요약 텍스트 */}
        <span
          style={{
            fontSize: '11px',
            color: readyList.length > 0 ? '#FFD98A' : '#A89880',
            fontWeight: readyList.length > 0 ? 600 : 400,
            letterSpacing: '0.04em',
            flexGrow: 1,
          }}
        >
          {chipText}
        </span>

        {/* 성립 원소 미니 뱃지 */}
        {readyList.length > 0 && (
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {readyList.slice(0, 3).map((s, idx) => (
              <span
                key={`chip-elem-${s.recipeId}-${s.size}-${idx}`}
                style={{
                  fontSize: '9px',
                  color: ELEMENT_COLOR[s.elem1],
                  fontWeight: 700,
                }}
              >
                {ELEMENT_HANJA[s.elem1]}
              </span>
            ))}
            {readyList.length > 3 && (
              <span style={{ fontSize: '9px', color: '#6A6560' }}>
                +{readyList.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 펼침/접힘 화살표 */}
        <span
          style={{
            fontSize: '9px',
            color: '#6A6560',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            lineHeight: 1,
          }}
        >
          ▲
        </span>
      </div>
    </div>
  )
}
