/**
 * sinsal_reward_drawrate.test.ts — 감사1 (2026-07-22)
 * add-sinsal(화개) 보상 신 시드 등장률 실측.
 * 제라(Zera) Opus 재실행.
 *
 * 배경: 구 시드 `currentFloor*12345+6789`는 층(1~4)에만 의존 → 시드 4종 고정 →
 *   add-sinsal이 4개 시드 모두에서 셔플 후 4번째 이후로 밀려 실게임 등장률 0% 고착.
 *   (SINSAL_REWARD_DRAWRATE 진단 2026-07-21)
 *
 * 정본 신 시드: mixRewardSeed(runSeed, floor, rewardIndex) = (runSeed ^ imul(floor,2654435761)) + imul(rewardIndex,1103515245)
 *   → 매 런(runSeed) 다른 결과. 가중치 0.15 유지(변경 금지).
 *
 * 본 스위트는 FloorRewardScreen 추첨 로직을 동일 규격으로 재현(mixRewardSeed 실사용)하여
 *   층 1~4 × 250런 = 1000회 보상 3택을 생성하고 add-sinsal 등장률을 산출한다.
 *   기대 ≈ 18% (완전 랜덤 몬테카를로 18.78% 근방).
 *
 * 실행: npx vitest run src/test/sinsal_reward_drawrate.test.ts
 */

import { describe, it, expect } from 'vitest'
import { mixRewardSeed } from '../components/FloorRewardScreen'

// FloorRewardScreen rewardOptions 추첨 로직 재현 (풀 구조·가중치·셔플·중복제거 동일)
// 유물 1종 존재 가정(availableRelics.length>0), 신살 소지 0(상한 미만) 가정 = 실게임 초기 조건.
type PoolItem = { type: string; key: string; weight: number }

function drawRewards(runSeed: number, floor: number): string[] {
  let rng = mixRewardSeed(runSeed, floor, 0)
  const nextRandom = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff
    return (rng >>> 0) / 0xffffffff
  }

  // 풀: 카드 3종(add-card/upgrade-card/remove-card) + 유물 1종 + 신살(0.15)
  const pool: PoolItem[] = [
    { type: 'add-card', key: 'add-card', weight: 1.0 },
    { type: 'upgrade-card', key: 'upgrade-card', weight: 1.0 },
    { type: 'remove-card', key: 'remove-card', weight: 1.0 },
    { type: 'add-relic', key: 'relic-0', weight: 1.0 },
    { type: 'add-sinsal', key: 'sinsal-hwagae', weight: 0.15 },
  ]

  // 가중치 슬롯 생성 (FloorRewardScreen과 동일: Math.max(1, round(weight*10)))
  const weighted: PoolItem[] = []
  for (const item of pool) {
    const slots = Math.max(1, Math.round(item.weight * 10))
    for (let s = 0; s < slots; s++) weighted.push(item)
  }

  // Fisher-Yates 셔플
  const shuffled = [...weighted]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // 중복 제거 후 3개 선택
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of shuffled) {
    if (!seen.has(item.key)) {
      seen.add(item.key)
      result.push(item.type)
    }
    if (result.length >= 3) break
  }
  return result
}

describe('감사1 — add-sinsal 보상 신 시드 등장률', () => {
  it('시드 다양화 확인: 동일 층에서도 런마다 다른 조합 생성', () => {
    // 구 시드는 층만 의존해 250런 전부 동일했다. 신 시드는 런별로 달라져야 한다.
    const combos = new Set<string>()
    for (let run = 0; run < 250; run++) {
      const runSeed = (run * 2246822519 + 3266489917) >>> 0  // 런별 시드 발생
      combos.add(drawRewards(runSeed, 1).join(','))
    }
    expect(combos.size).toBeGreaterThan(1)  // 구 시드였다면 1 (전 런 동일)
  })

  it('층 1~4 × 250런 = 1000회 등장률 ≈ 18% (5%~35% 허용대)', () => {
    const perFloor: Record<number, { total: number; hit: number }> = {
      1: { total: 0, hit: 0 }, 2: { total: 0, hit: 0 },
      3: { total: 0, hit: 0 }, 4: { total: 0, hit: 0 },
    }
    let total = 0
    let hit = 0
    for (let floor = 1; floor <= 4; floor++) {
      for (let run = 0; run < 250; run++) {
        const runSeed = ((run + 1) * 2246822519 + floor * 40503) >>> 0
        const rewards = drawRewards(runSeed, floor)
        const isHit = rewards.includes('add-sinsal')
        perFloor[floor].total++
        total++
        if (isHit) { perFloor[floor].hit++; hit++ }
      }
    }

    const rate = (hit / total) * 100
    // 등장률 표 출력 (산출물 인용용)
    // eslint-disable-next-line no-console
    console.log('\n[add-sinsal 신 시드 등장률 — 층 1~4 × 250런]')
    for (let f = 1; f <= 4; f++) {
      const pf = perFloor[f]
      // eslint-disable-next-line no-console
      console.log(`  층${f}: ${pf.hit}/${pf.total} = ${((pf.hit / pf.total) * 100).toFixed(2)}%`)
    }
    // eslint-disable-next-line no-console
    console.log(`  총계: ${hit}/${total} = ${rate.toFixed(2)}%  (기대 ≈18%)\n`)

    // 구 시드 0% 고착 회귀 봉인 + 가중치 0.15 정상 반영 확인
    expect(hit).toBeGreaterThan(0)
    expect(rate).toBeGreaterThan(5)
    expect(rate).toBeLessThan(35)
  })
})
