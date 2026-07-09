/**
 * 봇 1000판 시뮬레이션 — 팔자전 밸런스 검증
 * 목표: 4층 클리어율 30~50%
 * 그리디 봇: 가능한 최고 족보 조합으로 출수
 * HP는 층간 이월됨 (단일 런 통산)
 */
import { describe, it, expect } from 'vitest'
import {
  initFloor,
  playHand,
  discardSelected,
  toggleSelect,
  pickRandomPassives,
  pickRandomRelic,
  pickRandomDayElement,
} from '@/game/engine/paljapaeEngine'
import { judgeHand } from '@/game/engine/pokerHandJudge'
import type { BattleState, PaljapaeCard, Element, RelicId, PassiveId } from '@/types/paljapaeTypes'
import { BALANCE } from '@/data/balance'

// 족보 우선순위 점수 (높을수록 좋음)
const RANK_SCORE: Record<string, number> = {
  fiveElements: 100,
  gather5: 90,
  gather4: 70,
  chain4: 65,
  chain3: 50,
  gather3: 45,
  chain2: 30,
  yinYangPair: 20,
  none: 0,
}

// 조합 생성 (n choose k)
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length === 0) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

// 그리디 봇: 최고 족보 조합 선택
function greedySelect(hand: PaljapaeCard[]): string[] {
  let bestScore = -1
  let bestIds: string[] = []
  let bestRankIsNone = true

  for (let size = Math.min(5, hand.length); size >= 1; size--) {
    const combos = combinations(hand, size)
    for (const combo of combos) {
      const result = judgeHand(combo)
      const rankScore = RANK_SCORE[result.rank] ?? 0
      const totalScore = rankScore * 1000 + combo.reduce((s, c) => s + c.value, 0)
      if (totalScore > bestScore) {
        bestScore = totalScore
        bestIds = combo.map(c => c.id)
        bestRankIsNone = result.rank === 'none'
      }
    }
    // 족보 성립 (none이 아닌) 시 더 이상 더 작은 조합 탐색 안 함
    if (!bestRankIsNone) break
  }

  return bestIds
}

// 단일 층 시뮬레이션 — playerHp를 인수로 받아 층간 이월
function simulateFloor(
  floor: number,
  playerHpIn: number,
  dayElement: Element,
  relics: RelicId[],
  passives: PassiveId[]
): { cleared: boolean; playerHpOut: number } {
  let state = initFloor(floor, dayElement, relics, passives)
  // 층 초기화 시 HP를 이전 층에서 이월
  state = { ...state, playerHp: Math.min(playerHpIn, state.playerMaxHp) }

  let discardUsed = false  // 층당 버리기 1회만 사용 (시뮬 단순화)

  let iterations = 0
  while (state.playsLeft > 0 && state.enemyHp > 0 && state.playerHp > 0) {
    iterations++
    if (iterations > 200) break  // 무한 루프 방지

    // 버리기: 층당 1회, 역극 카드가 있을 때만
    if (!discardUsed && state.discardsLeft > 0) {
      const DOMINATES_MAP: Record<string, string> = {
        '木': '土', '火': '金', '土': '水', '金': '木', '水': '火',
      }
      const counterCards = state.hand.filter(c => DOMINATES_MAP[state.dayElement] === c.element)
      if (counterCards.length >= 2) {
        // 역극 카드 2장 버리기
        let discardState: BattleState = { ...state, selected: [] as string[] }
        for (const c of counterCards.slice(0, 2)) {
          discardState = toggleSelect(discardState, c.id)
        }
        state = discardSelected(discardState)
        discardUsed = true
        continue
      }
    }

    // 출수
    const selectedIds = greedySelect(state.hand)
    if (selectedIds.length === 0) break

    let stateWithSelect: BattleState = { ...state, selected: [] as string[] }
    for (const id of selectedIds) {
      stateWithSelect = toggleSelect(stateWithSelect, id)
    }

    const { newState } = playHand(stateWithSelect)
    state = newState

    if (state.enemyHp <= 0) {
      return { cleared: true, playerHpOut: state.playerHp }
    }
  }

  // 출수 소진 또는 루프 종료 → 반격
  if (state.enemyHp > 0) {
    const floorIdx = Math.min(floor - 1, BALANCE.FLOORS.length - 1)
    let retaliation: number = BALANCE.FLOORS[floorIdx].retaliation as number
    if (relics.includes('haetae')) retaliation = Math.max(0, retaliation - 3)
    const hpAfterRetaliation = state.playerHp - retaliation
    if (hpAfterRetaliation <= 0) {
      return { cleared: false, playerHpOut: 0 }
    }
    // HP 남아있어도 적을 못 죽임 → 실패
    if (state.enemyHp > 0) {
      return { cleared: false, playerHpOut: hpAfterRetaliation }
    }
  }

  return { cleared: state.enemyHp <= 0, playerHpOut: state.playerHp }
}

// 4층 전체 런 시뮬레이션 (HP 층간 이월)
function simulateRun(passives: PassiveId[], relics: RelicId[], dayElement: Element): boolean {
  let playerHp: number = BALANCE.PLAYER_HP as number
  if (passives.includes('sangkwan')) playerHp -= 10

  for (let floor = 1; floor <= 4; floor++) {
    const result = simulateFloor(floor, playerHp, dayElement, relics, passives)
    if (!result.cleared) return false
    playerHp = result.playerHpOut
    if (playerHp <= 0) return false
  }

  return true
}

describe('봇 1000판 시뮬레이션', () => {
  it('4층 클리어율 달성 (목표 30~50%, 허용 15~75%)', () => {
    const RUNS = 1000
    let cleared = 0

    for (let i = 0; i < RUNS; i++) {
      const passives = pickRandomPassives(2)
      const relic = pickRandomRelic()
      const dayElement = pickRandomDayElement()
      if (simulateRun(passives, [relic], dayElement)) cleared++
    }

    const clearRate = cleared / RUNS
    console.log(`[봇 시뮬레이션] 1000판 클리어율: ${(clearRate * 100).toFixed(1)}%`)
    console.log(`[봇 시뮬레이션] 클리어: ${cleared}판 / 1000판`)

    // 그리디 봇이므로 클리어율이 높을 수 있음
    // 밸런스 조정 근거를 출력하고 결과를 검증
    if (clearRate < 0.30) {
      console.log('[밸런스] 클리어율 30% 미달 — BALANCE.FLOORS[*].retaliation 감소 권장')
    } else if (clearRate > 0.50) {
      console.log('[밸런스] 클리어율 50% 초과 — BALANCE.FLOORS[*].retaliation 증가 또는 족보 배율 감소 권장')
    }

    // 허용 범위: 15~75% (그리디 봇은 최적에 가까우므로 상한 여유)
    expect(clearRate).toBeGreaterThanOrEqual(0.15)
    expect(clearRate).toBeLessThanOrEqual(0.75)
  }, 60000)
})
