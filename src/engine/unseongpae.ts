/**
 * 팔자전 [2단계] — 운성패(運星牌) 4종 엔진 (2026-07-22 제라)
 *
 * 지시: ZERA_PALJAJEON_UNSEONGPAE_ENGINE_DISPATCH_20260722.md (6장 규격)
 * 상위 정본: PALJAJEON_UNIFIED_SLOTS_UNSEONGPAE_DISPATCH_20260722.md 2-B
 *
 * 전설층(legendary) 성장형 패시브 — 생왕묘절(生旺墓絶) 4종 × 왕상휴수(旺相休囚) 4격.
 *  - 격 체계: 수(囚) → 휴(休) → 상(相) → 왕(旺). 획득 시 수격.
 *  - 격 상승(먹이) = "이미 하는 행동의 누적" (노가다 금지).
 *  - 격이 오를수록 효과가 굵어지되, 왕격 값은 골자를 상한으로 함.
 *
 * 순수 함수 모듈 — UI/엔진 상성 배율/십성 가호 수치에 무관.
 * 명명 정본(2-C): 4종 = 생지·왕지·묘지·절지 / 격 = 수·휴·상·왕. 임의 변경 금지.
 */

import type { Card } from '../types/game'

// ─────────────────────────────────────────────────────────────────────────────
// 데이터 모델 — 운성패 ID / 격 / 런타임 상태
// ─────────────────────────────────────────────────────────────────────────────

/** 운성패 4종 ID (생왕묘절). 통합 슬롯 legendary tier cardId로 사용. */
export type UnseongpaeId = 'saengji' | 'wangji' | 'myoji' | 'jeolji'

/** 왕상휴수 4격 — 수(囚)→휴(休)→상(相)→왕(旺). 획득 시 수격. */
export type Gyeok = 'su' | 'hyu' | 'sang' | 'wang'

/** 격 순서 (승격 방향). su=0 ... wang=3 */
export const GYEOK_ORDER: readonly Gyeok[] = ['su', 'hyu', 'sang', 'wang'] as const

/** 격 한글 명칭 (UI 표기용, 명리 정본) */
export const GYEOK_LABEL: Record<Gyeok, string> = {
  su: '수(囚)',
  hyu: '휴(休)',
  sang: '상(相)',
  wang: '왕(旺)',
}

/** 운성패 한글 명칭 (UI 표기용, 명리 정본) */
export const UNSEONGPAE_LABEL: Record<UnseongpaeId, string> = {
  saengji: '생지(生地)',
  wangji: '왕지(旺地)',
  myoji: '묘지(墓地)',
  jeolji: '절지(絶地)',
}

/** 4종 전체 목록 */
export const ALL_UNSEONGPAE: readonly UnseongpaeId[] = ['saengji', 'wangji', 'myoji', 'jeolji'] as const

/**
 * 운성패 런타임 상태 (GameState.unseongpaeStates에 종별로 보관).
 *  - gyeok     : 현재 격
 *  - feed      : 먹이 게이지 누적 (해당 격→다음 격 필요치 대비)
 *  - myogo     : 묘지 전용 — 묘고(墓庫) 적재 카드 (버린 카드 보관, 발동 시 방출)
 *  - myogoUsedThisFloor : 묘지 전용 — 이번 전투 묘고 방출 사용 여부 (전투당 1회)
 *  - jeoljiUsed : 절지 전용 — 런당 1회 부활 소진 여부
 *  - jeoljiAwakenBattle : 절지 전용 — 부활 각성(전 융합 ×1.5) 잔여 전투 (부활 전투 동안)
 */
export interface UnseongpaeState {
  id: UnseongpaeId
  gyeok: Gyeok
  feed: number
  myogo?: Card[]
  myogoUsedThisFloor?: boolean
  jeoljiUsed?: boolean
  jeoljiAwakenBattle?: boolean
}

/** 신규 획득 시 초기 상태 팩토리 — 수격(囚), 먹이 0에서 시작 */
export function createUnseongpaeState(id: UnseongpaeId): UnseongpaeState {
  const base: UnseongpaeState = { id, gyeok: 'su', feed: 0 }
  if (id === 'myoji') {
    base.myogo = []
    base.myogoUsedThisFloor = false
  }
  if (id === 'jeolji') {
    base.jeoljiUsed = false
    base.jeoljiAwakenBattle = false
  }
  return base
}

// ─────────────────────────────────────────────────────────────────────────────
// 먹이(feed) — 격 상승 필요치 (골자 준수: 각 종 골자의 "먹이 누적" 값이 수→왕 총량)
//   4단(수/휴/상/왕) 곡선이므로 격 상승은 총 3회. 골자 총량을 3구간으로 분배.
//   생지 융합30 / 왕지 반복15 / 묘지 버리기20 / 절지 승리10.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 각 종별 격 상승 임계치 [su→hyu, hyu→sang, sang→wang].
 * 총합 = 골자 먹이량. 초반을 얕게, 왕격 문턱을 굵게 (성장 체감 곡선).
 */
//   게이트 튜닝(2026-07-22): 4층 런 내 도달성 확보 — 왕지/묘지/절지는 먹이원이
//   희소하여 초기 곡선 하향. 절지는 층 승리(런당 ~3회)만으로 상격 도달 가능하도록.
export const FEED_THRESHOLDS: Record<UnseongpaeId, readonly [number, number, number]> = {
  saengji: [6, 12, 18], // 융합 누적 36회 (6+12+18) — 융합 잦음, 왕격 문턱 유지
  wangji: [2, 4, 6], //    융합 누적 12회 (2+4+6) — 먹이원 희소 보정
  myoji: [3, 5, 7], //     버리기 누적 15장 (3+5+7)
  jeolji: [1, 2, 3], //    전투 승리 6회 (1+2+3) — 4층 런 내 상격 도달 가능
}

/** 현재 격에서 다음 격으로 가기 위한 먹이 필요치. 왕격이면 null(만렙). */
export function feedNeededForNext(state: UnseongpaeState): number | null {
  const idx = GYEOK_ORDER.indexOf(state.gyeok)
  if (idx >= GYEOK_ORDER.length - 1) return null // 왕격 = 만렙
  return FEED_THRESHOLDS[state.id][idx]
}

/**
 * 먹이 누적 → 격 상승 판정 (순수). 임계치 도달 시 격 +1, 초과분 이월.
 * @param state 대상 운성패 상태
 * @param amount 이번에 적립할 먹이량 (예: 융합 1회=1, 버린 카드 3장=3)
 * @returns 갱신된 상태 + 이번에 격이 올랐는지 여부
 */
export function accrueFeed(state: UnseongpaeState, amount: number): { state: UnseongpaeState; leveledUp: boolean } {
  if (amount <= 0) return { state, leveledUp: false }
  let gyeok = state.gyeok
  let feed = state.feed + amount
  let leveledUp = false
  // 한 번의 적립으로 여러 격이 오를 수 있음(초반 임계 얕음) — while로 이월 처리
  for (;;) {
    const idx = GYEOK_ORDER.indexOf(gyeok)
    if (idx >= GYEOK_ORDER.length - 1) break // 왕격 도달
    const need = FEED_THRESHOLDS[state.id][idx]
    if (feed < need) break
    feed -= need
    gyeok = GYEOK_ORDER[idx + 1]
    leveledUp = true
  }
  return { state: { ...state, gyeok, feed }, leveledUp }
}

// ─────────────────────────────────────────────────────────────────────────────
// 격별 4단 효과 곡선 (초안 — 게이트로 다듬음. 왕격 = 골자 상한)
// ─────────────────────────────────────────────────────────────────────────────

// ── 생지(生地) 속도: 융합 소모 카드 수만큼 즉시 드로우 (매 공격) ──
//   왕격: 드로우 15% 신규 카드 잉태.
/** 생지 — 융합 소모 카드 수 대비 드로우 배수. 최소 1장.
 *  게이트 튜닝(2026-07-22): Δ=15.3(>15) 초과 → 골자 상한 유지하되 하위격 배수 하향
 *  (수 0.5→0.34, 휴 0.75→0.5) + 왕격 잉태 15%→12% 1회 수치 하향(Ch.4 허용). 구조 불변. */
export const SAENGJI_DRAW_RATIO: Record<Gyeok, number> = { su: 0.34, hyu: 0.5, sang: 0.75, wang: 1.0 }
/** 생지 왕격 — 드로우 중 신규 카드 잉태 확률 (골자 상한 15% → 12% 하향 조정) */
export const SAENGJI_WANG_BIRTH_PCT = 0.12

/** 생지 드로우 장수 계산 — 융합 소모 카드 수(consumed) × 격 배수, 최소 1(융합 성립 시). */
export function saengjiDrawCount(gyeok: Gyeok, consumed: number): number {
  if (consumed <= 0) return 0
  const raw = Math.floor(consumed * SAENGJI_DRAW_RATIO[gyeok])
  return Math.max(1, raw)
}

// ── 왕지(旺地) 반복: 수확 체감 면제 (반복 배율 불감) ──
//   왕격: 반복 2회째마다 ×1.1 누적.
/** 왕지 — 수확체감(gather) 카운터에서 면제할 단계 수 (수=2/휴=3/상=∞/왕=∞).
 *  게이트 튜닝(2026-07-22): 하위격 체감 면제 단계 상향(수 1→2, 휴 2→3)으로 조기 효과 부여. */
export const WANGJI_DIMINISH_EXEMPT: Record<Gyeok, number> = {
  su: 2,
  hyu: 3,
  sang: Number.POSITIVE_INFINITY,
  wang: Number.POSITIVE_INFINITY,
}
/** 왕지 왕격 — 반복 2회째마다 ×1.1 누적 (골자 상한) */
export const WANGJI_WANG_REPEAT_STEP = 0.1

/**
 * 왕지 — 수확체감 유효 카운터 계산.
 * 실제 gather 사용 횟수(actualGatherCount)에서 면제 단계를 차감 → 체감이 늦게 붙음.
 * 상/왕격은 완전 면제(항상 0 반환) → 체감 카운터 무증가.
 */
export function wangjiEffectiveGatherCount(gyeok: Gyeok, actualGatherCount: number): number {
  const exempt = WANGJI_DIMINISH_EXEMPT[gyeok]
  if (!isFinite(exempt)) return 0 // 상/왕 = 완전 면제
  return Math.max(0, actualGatherCount - exempt)
}

/**
 * 왕지 왕격 — 동일 융합 반복 누적 배율. repeatCount=이번 융합이 동일 조합 몇 회째인지(0-based).
 * 2회째(repeatCount>=1)부터 매 회 ×1.1 누적. 왕격이 아니면 1.0.
 */
export function wangjiRepeatMultiplier(gyeok: Gyeok, repeatCount: number): number {
  if (gyeok !== 'wang' || repeatCount < 1) return 1.0
  return Math.pow(1 + WANGJI_WANG_REPEAT_STEP, repeatCount)
}

// ── 묘지(墓地) 버리기: 버린 카드 묘고 적재, 발동 시 전체 손패로 (전투당 1회) ──
//   왕격: 묘고 카드 값 +1 숙성.
/** 묘지 — 묘고 적재 상한 (수=4/휴=8/상=∞/왕=∞).
 *  게이트 튜닝(2026-07-22): 하위격 적재 상한 상향(수 3→4, 휴 6→8)으로 방출 융합 연료 확대. */
export const MYOJI_MYOGO_CAP: Record<Gyeok, number> = {
  su: 4,
  hyu: 8,
  sang: Number.POSITIVE_INFINITY,
  wang: Number.POSITIVE_INFINITY,
}
/** 묘지 왕격 — 방출 시 묘고 카드 값 숙성 (+1) */
export const MYOJI_WANG_AGING = 1

/** 묘지 — 버린 카드를 묘고에 적재 (격별 상한 준수). 순수. */
export function myojiStoreDiscarded(state: UnseongpaeState, discarded: Card[]): UnseongpaeState {
  if (state.id !== 'myoji') return state
  const cap = MYOJI_MYOGO_CAP[state.gyeok]
  const current = state.myogo ?? []
  const room = isFinite(cap) ? Math.max(0, cap - current.length) : discarded.length
  const added = discarded.slice(0, room)
  return { ...state, myogo: [...current, ...added] }
}

/**
 * 묘지 — 묘고 방출 (발동): 묘고 전체를 손패 복귀용으로 반환하고 묘고 비움 (전투당 1회).
 * 왕격이면 방출 카드 값 +1 숙성. 이미 이번 전투 사용했거나 묘고 비었으면 null.
 * @returns { state, released } 또는 { state, released: null }
 */
export function myojiRelease(state: UnseongpaeState): { state: UnseongpaeState; released: Card[] | null } {
  if (state.id !== 'myoji') return { state, released: null }
  if (state.myogoUsedThisFloor) return { state, released: null }
  const myogo = state.myogo ?? []
  if (myogo.length === 0) return { state, released: null }
  const aged = state.gyeok === 'wang' ? myogo.map(c => ({ ...c, value: c.value + MYOJI_WANG_AGING })) : myogo
  return {
    state: { ...state, myogo: [], myogoUsedThisFloor: true },
    released: aged,
  }
}

/** 묘지 — 전투 시작 시 리셋 (전투당 1회 발동 플래그 해제). 묘고 자체는 런 유지. */
export function myojiResetPerFloor(state: UnseongpaeState): UnseongpaeState {
  if (state.id !== 'myoji') return state
  return { ...state, myogoUsedThisFloor: false }
}

// ── 절지(絶地) 죽음: 사망 시 부활 HP 30% (런당 1회) + 부활 전투 동안 전 융합 ×1.5 ──
//   부활 사용 시 1격 꺾임.
/** 절지 — 부활 HP 비율 (수=0.20/휴=0.25/상=0.30/왕=0.30). 골자 상한 30%.
 *  게이트 튜닝(2026-07-22): 4층 런 내 대부분 하위격 → 하위격 부활 HP 상향(수 15→20, 휴 20→25). */
export const JEOLJI_REVIVE_PCT: Record<Gyeok, number> = { su: 0.2, hyu: 0.25, sang: 0.3, wang: 0.3 }
/** 절지 왕격 — 부활 전투 동안 전 융합 배율 (골자 상한 ×1.5) */
export const JEOLJI_WANG_AWAKEN_MULT = 1.5

/**
 * 절지 — 부활 발동. 사망 시 1회(런당) 호출. 부활 HP 반환 + 1격 꺾임 + 부활 소진.
 * 왕격이면 부활 전투 동안 각성(전 융합 ×1.5) 플래그 세팅.
 * @returns { state, reviveHp } reviveHp>0 이면 부활 성공. 이미 소진/불가 시 reviveHp=0.
 */
export function jeoljiRevive(state: UnseongpaeState, playerMaxHp: number): { state: UnseongpaeState; reviveHp: number } {
  if (state.id !== 'jeolji') return { state, reviveHp: 0 }
  if (state.jeoljiUsed) return { state, reviveHp: 0 }
  const wasWang = state.gyeok === 'wang'
  const reviveHp = Math.max(1, Math.round(playerMaxHp * JEOLJI_REVIVE_PCT[state.gyeok]))
  // 1격 꺾임 (수격이면 유지 — 더 내려갈 곳 없음)
  const idx = GYEOK_ORDER.indexOf(state.gyeok)
  const brokenGyeok = idx > 0 ? GYEOK_ORDER[idx - 1] : state.gyeok
  return {
    state: {
      ...state,
      gyeok: brokenGyeok,
      feed: 0, // 격 꺾이며 먹이 리셋
      jeoljiUsed: true,
      jeoljiAwakenBattle: wasWang, // 왕격 발동 시에만 각성
    },
    reviveHp,
  }
}

/** 절지 왕격 각성 배율 — 부활 전투 동안 전 융합 ×1.5 (각성 중 아니면 1.0). */
export function jeoljiAwakenMultiplier(state: UnseongpaeState): number {
  return state.id === 'jeolji' && state.jeoljiAwakenBattle ? JEOLJI_WANG_AWAKEN_MULT : 1.0
}

/** 절지 — 전투 종료(다음 층 진입) 시 각성 해제 (부활 전투만 지속). */
export function jeoljiClearAwaken(state: UnseongpaeState): UnseongpaeState {
  if (state.id !== 'jeolji') return state
  return { ...state, jeoljiAwakenBattle: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI 노출 계약 — 케일용 격/먹이 게이지 파생 (읽기 전용)
// ─────────────────────────────────────────────────────────────────────────────

/** UI 표기용 격/먹이 게이지 스냅샷 (케일 UI 소비) */
export interface UnseongpaeGaugeView {
  id: UnseongpaeId
  label: string //   '생지(生地)'
  gyeok: Gyeok
  gyeokLabel: string // '왕(旺)'
  feed: number //     현재 격 먹이 누적
  feedNeeded: number | null // 다음 격 필요치. null = 왕격(만렙)
  feedPct: number //  0~1 게이지 비율 (왕격이면 1)
  isMaxGyeok: boolean
}

/** 격/먹이 게이지 뷰 파생 (순수, UI 렌더용) */
export function toGaugeView(state: UnseongpaeState): UnseongpaeGaugeView {
  const need = feedNeededForNext(state)
  const isMax = need === null
  return {
    id: state.id,
    label: UNSEONGPAE_LABEL[state.id],
    gyeok: state.gyeok,
    gyeokLabel: GYEOK_LABEL[state.gyeok],
    feed: state.feed,
    feedNeeded: need,
    feedPct: isMax ? 1 : Math.min(1, state.feed / (need || 1)),
    isMaxGyeok: isMax,
  }
}
