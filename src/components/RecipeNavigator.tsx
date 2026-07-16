/**
 * 팔자전 — 레시피 내비게이터 간이판 (RecipeNavigator.tsx)
 * 발주서 작업 2-b: 성립 레시피 + "1장 차이" 1건 표시
 *
 * 표시 조건: recipe 모드 한정 (COMBO_RULESET_VERSION==='recipe')
 * 미니멀 — 살갗/본격 비주얼은 배치 3, 지금은 최소 기능.
 *
 * 동작:
 *   - 현재 핸드(hand)를 분석하여 성립 레시피 목록을 표시
 *   - "1장 차이" 레시피: 현재 핸드에서 1장 부족한 레시피 1건 (가장 가까운 것)
 *   - recipe 모드가 아니면 null 반환 (렌더링 없음)
 *
 * 한글명 (발주서 2-c 정본 명명):
 *   낳는(연료): 숲 / 샘 / 광맥 / 옹기가마 / 들불
 *   벼리는(촉매): 벼림 / 개간 / 제방 / 담금질 / 주물
 */

import type { Card, Element } from '../types/game'
import { RECIPE_MAP } from '../engine/balance'

// 레시피 ID → 한글명 (발주서 2-c 정본 명명)
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
  size: 'small' | 'large'
  elem1: Element
  elem2: Element
  catalystCount: number   // 현재 핸드의 촉매(elem1) 수
  fuelCount: number       // 현재 핸드의 연료(elem2) 수
  needCatalyst: number    // 추가 필요 촉매 수
  needFuel: number        // 추가 필요 연료 수
  ready: boolean          // 즉시 성립 가능
  oneAway: boolean        // 1장 차이
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
    const { elem1, elem2 } = spec.small

    const catalystCount = counts[elem1] ?? 0
    const fuelCount = counts[elem2] ?? 0

    // 소형 성립 조건: elem1 >= 1, elem2 >= 2
    const smallReadyCatalyst = Math.max(0, 1 - catalystCount)
    const smallReadyFuel = Math.max(0, 2 - fuelCount)
    const smallReady = smallReadyCatalyst === 0 && smallReadyFuel === 0
    const smallOneAway = !smallReady && (smallReadyCatalyst + smallReadyFuel) === 1

    // 대형 성립 조건: elem1 >= 2, elem2 >= 3
    const largeReadyCatalyst = Math.max(0, 2 - catalystCount)
    const largeReadyFuel = Math.max(0, 3 - fuelCount)
    const largeReady = largeReadyCatalyst === 0 && largeReadyFuel === 0
    const largeOneAway = !largeReady && (largeReadyCatalyst + largeReadyFuel) === 1

    if (smallReady) {
      statuses.push({
        recipeId, koName,
        size: 'small',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: 0, needFuel: 0,
        ready: true, oneAway: false,
      })
    }
    if (largeReady) {
      statuses.push({
        recipeId, koName,
        size: 'large',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: 0, needFuel: 0,
        ready: true, oneAway: false,
      })
    }
    if (!smallReady && smallOneAway) {
      statuses.push({
        recipeId, koName,
        size: 'small',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: smallReadyCatalyst,
        needFuel: smallReadyFuel,
        ready: false, oneAway: true,
      })
    } else if (!largeReady && largeOneAway) {
      statuses.push({
        recipeId, koName,
        size: 'large',
        elem1: elem1 as Element,
        elem2: elem2 as Element,
        catalystCount, fuelCount,
        needCatalyst: largeReadyCatalyst,
        needFuel: largeReadyFuel,
        ready: false, oneAway: true,
      })
    }
  }

  return statuses
}

interface RecipeNavigatorProps {
  hand: Card[]
}

/**
 * 레시피 내비게이터 간이판
 * recipe 모드 한정 표시. 성립 레시피 + "1장 차이" 최대 1건.
 */
export default function RecipeNavigator({ hand }: RecipeNavigatorProps) {
  const statuses = analyzeRecipes(hand)
  const readyList = statuses.filter(s => s.ready)
  // "1장 차이": 성립 중이 아닌 것 중 oneAway인 것 1건만 (소형 우선)
  const oneAwayList = statuses.filter(s => s.oneAway && !s.ready)
  const oneAwaySorted = [...oneAwayList].sort((a, b) => {
    if (a.size === 'small' && b.size !== 'small') return -1
    if (a.size !== 'small' && b.size === 'small') return 1
    return 0
  })
  const oneAwayOne = oneAwaySorted[0]

  if (readyList.length === 0 && !oneAwayOne) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: '6px',
        padding: '6px 10px',
        backgroundColor: 'rgba(22,19,15,0.92)',
        border: '1px solid rgba(217,164,65,0.35)',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      {/* 성립 레시피 */}
      {readyList.map((s, idx) => (
        <div
          key={`ready-${s.recipeId}-${s.size}-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: '#4A9B6E',
              letterSpacing: '0.05em',
              minWidth: '28px',
            }}
          >
            {s.size === 'large' ? '대형' : '소형'}
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#FFD98A',
              minWidth: '36px',
            }}
          >
            {s.koName}
          </span>
          <span
            style={{ fontSize: '10px', color: ELEMENT_COLOR[s.elem1] }}
          >
            {ELEMENT_HANJA[s.elem1]}
          </span>
          <span style={{ fontSize: '10px', color: '#6A6560' }}>+</span>
          <span
            style={{ fontSize: '10px', color: ELEMENT_COLOR[s.elem2] }}
          >
            {ELEMENT_HANJA[s.elem2]}
          </span>
          <span
            style={{
              fontSize: '9px',
              color: '#4A9B6E',
              marginLeft: 'auto',
              fontWeight: 600,
            }}
          >
            성립
          </span>
        </div>
      ))}

      {/* 1장 차이 레시피 (최대 1건) */}
      {oneAwayOne && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: 0.7,
          }}
        >
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: '#6A6560',
              minWidth: '28px',
            }}
          >
            {oneAwayOne.size === 'large' ? '대형' : '소형'}
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#D8CCB4',
              minWidth: '36px',
            }}
          >
            {oneAwayOne.koName}
          </span>
          <span
            style={{ fontSize: '10px', color: ELEMENT_COLOR[oneAwayOne.elem1] }}
          >
            {ELEMENT_HANJA[oneAwayOne.elem1]}
          </span>
          <span style={{ fontSize: '10px', color: '#6A6560' }}>+</span>
          <span
            style={{ fontSize: '10px', color: ELEMENT_COLOR[oneAwayOne.elem2] }}
          >
            {ELEMENT_HANJA[oneAwayOne.elem2]}
          </span>
          <span
            style={{
              fontSize: '9px',
              color: '#6A6560',
              marginLeft: 'auto',
            }}
          >
            {oneAwayOne.needCatalyst > 0
              ? `${ELEMENT_HANJA[oneAwayOne.elem1]} 1장 부족`
              : `${ELEMENT_HANJA[oneAwayOne.elem2]} 1장 부족`}
          </span>
        </div>
      )}
    </div>
  )
}
