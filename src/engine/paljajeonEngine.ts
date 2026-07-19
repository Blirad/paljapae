/**
 * 팔자전 — 턴 시뮬레이션 엔진
 * 순수 함수 모듈 — UI 의존 없음
 */

import type { Card, GameState, Element, SavedHeroProfile } from '../types/game'
import {
  judgeHand,
  GEUK_MAP,
  detectElementClash,
} from './pokerHandJudge'
import { FLOOR_CONFIGS, PLAYER_BASE_HP, HAND_SIZE, BASE_DISCARDS, MAX_DISCARD_PER_USE, SUB_GEUK_BONUS, ANTI_GEUK_PENALTY, getCondenseBonus, FUSION_TRAIT_MAP, TRAIT_CONFIGS, SANG_MAP, GEUK_BONUS_MULTIPLIER, SANG_PENALTY_MULTIPLIER, NOURISH_HEAL_PCT, HAETAE_COUNTER_REDUCTION, OSAKSHIL_YEONHWAN_BONUS, HORYBYEONG_HP_THRESHOLD, HORYBYEONG_MULTIPLIER_BONUS, MOKTAG_DISCARD_HEAL, SANGGWAN_MAX_PER_RUN, PURIFICATION_THRESHOLD, MINING_DRAW_DIVISOR, MINING_MAX_DRAW, EMBER_DURATION, EMBER_MULTIPLIER, BASE_PURIFICATION_DAMAGE, ENABLE_YONGSIN_DESCENT, DESCENT_VARIANT, DESCENT_GLOW_FULL_MULT, DESCENT_GLOW_AFTERGLOW_MULT, COMBO_RULESET_VERSION, YIKSEANG_MAP, YIKSEANG_MULT, DONGGI_MULTIPLIER, getFloorHp, ROYAL_CARDS, createRoyalCard } from './balance'
// 폐기된 dual/wait3 변형 상수 — balance.ts에서 삭제됨. 코드 경로 유지용 하드코딩.
const DESCENT_DUAL_SLOT_MULT = 2.0    // B-2 dual: 슬롯 적중 배율 (폐기)
const DESCENT_DUAL_NONSLOT_MULT = 1.3 // B-2 dual: 비슬롯 배율 (폐기)
const DESCENT_WAIT_WINDOW = 3          // B-1 wait3: 대기창 크기 (폐기)
import { generateSajuDeck } from './deckGenerator'
import { getFavorableElement } from './manseryeok'
// T17: 가호(십성) 효과 반영
import { PASSIVE_POOL } from '../types/passive'

// --------------- 배치 2 §1: 결정론 RNG 헬퍼 (LCG) ---------------
/**
 * LCG 순수 함수 — 확률 효과 재현성 보장
 * next = (s * 1103515245 + 12345) >>> 0
 * value = next / 0x100000000  (0 이상 1 미만)
 */
export function nextRng(s: number): { value: number; next: number } {
  const next = ((s * 1103515245 + 12345) >>> 0) >>> 0
  return { value: next / 0x100000000, next }
}

/**
 * C10(d): 오행 속성별 기믹 정의 (balance.ts 수치 변경 없이 새로운 로직 추가)
 * 부록 2-1. 변질 오행 5종 기믹 — 이든 지시 수치 그대로 적용
 * - 고목령(木): 매 턴 자신 체력 15 회복
 * - 잔화령(火): 반격 피해 +50% (×1.5배)
 * - 붕토령(土): 받는 피해 -20%
 * - 녹철령(金): 매 턴 무작위 핸드 카드 1장 값 -1 (녹)
 * - 탁수령(水): 플레이어 버리기 1회당 피해 3
 */
export type FloorGimmick =
  | { type: 'heal'; amount: number }           // 매 턴 체력 회복
  | { type: 'damage-reduction'; pct: number }  // 받는 피해 감소 (0~1)
  | { type: 'counter-boost'; pct: number }     // 반격 피해 증가 (배율, ×N배)
  | { type: 'card-rust'; amount: number }      // 매 턴 핸드 카드 값 감소 (녹)
  | { type: 'discard-punish'; damage: number } // 버리기 시 피해

/** 오행 속성별 기믹 맵 (1~2층 잡몹용) */
export const ELEMENT_GIMMICKS: Record<string, FloorGimmick[]> = {
  mok: [{ type: 'heal', amount: 15 }],                // 고목령 — 매 턴 15 회복 (이든 지시 수치)
  hwa: [{ type: 'counter-boost', pct: 1.5 }],         // 잔화령 — 반격 +50%
  to:  [{ type: 'damage-reduction', pct: 0.2 }],      // 붕토령 — 받는 피해 -20%
  geum: [{ type: 'card-rust', amount: 1 }],            // 녹철령 — 매 턴 핸드 카드 1장 값 -1
  su:  [{ type: 'discard-punish', damage: 3 }],        // 탁수령 — 버리기 1회당 피해 3
}

/** 층별 적 속성 (1~2층: 잡몹, 3~4층: 정예/보스) */
export const FLOOR_ENEMY_ELEMENTS: Record<number, string> = {
  1: 'mok',   // 고목령(木)
  2: 'hwa',   // 잔화령(火)
  3: 'to',    // 정예: 고신(土) — 기믹은 패시브 봉인 (엔진 별도 처리)
  4: 'geum',  // 보스: 명외자 대장(金) — 기믹은 3번째 출수 배율 고정 (엔진 별도 처리)
}

/** 현재 층의 기믹 목록 반환 (1~2층 잡몹만 ELEMENT_GIMMICKS 적용) */
function getFloorGimmicks(floor: number): FloorGimmick[] {
  const element = FLOOR_ENEMY_ELEMENTS[floor]
  // 1~2층만 잡몹 기믹 적용 (3~4층 정예/보스는 별도 로직)
  if (floor <= 2 && element) {
    return ELEMENT_GIMMICKS[element] ?? []
  }
  return []
}

/** 고정 임시 덱 생성 (Phase 1 — 사주 계산 없이 균형 덱) */
export function createFixedDeck(): Card[] {
  const elements: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
  const cards: Card[] = []
  let id = 0
  // 각 오행 × 값 2~10 × 1장씩 = 45장 풀에서 20장 샘플 (배치 2 §1: 값1 삭제, 음양 삭제)
  for (let e = 0; e < elements.length; e++) {
    for (let v = 1; v <= 4; v++) {
      cards.push({
        id: `card-${id++}`,
        element: elements[e],
        polarity: 'yang',
        value: v * 2 + (v > 2 ? 0 : 0),  // 2, 4, 6, 8
        type: 'soldier',
        rarity: 'common',
      })
    }
  }
  return cards  // 20장
}

/** 덱 셔플 (Fisher-Yates) */
export function shuffleDeck(deck: Card[], seed?: number): Card[] {
  const arr = [...deck]
  // 시드 기반 단순 LCG 난수 (재현 가능)
  let rng = seed ?? Date.now()
  const nextRandom = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff
    return (rng >>> 0) / 0xffffffff
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 초기 게임 상태 생성 */
export function createInitialGameState(floorIndex = 0, heroProfile?: SavedHeroProfile | null): GameState {
  const floorConfig = FLOOR_CONFIGS[floorIndex]
  let deck: Card[]

  // 진단: 사주 비례 덱 경로 추적
  console.log('[GameInit] heroProfile:', {
    exists: !!heroProfile,
    hasDist: !!heroProfile?.elementDist,
    hasSeed: !!heroProfile?.deckSeed,
    elementDist: heroProfile?.elementDist,
    deckSeed: heroProfile?.deckSeed,
    ilganElement: heroProfile?.ilganElement,
  })

  if (heroProfile?.elementDist && heroProfile?.deckSeed) {
    console.log('[GameInit] 🎯 사주 비례 덱 생성 시작')
    deck = shuffleDeck(generateSajuDeck(heroProfile.elementDist, heroProfile.deckSeed))
    console.log('[GameInit] 덱 생성 완료:', deck.map(c => c.element).reduce((acc, el) => { acc[el] = (acc[el] ?? 0) + 1; return acc }, {} as Record<string, number>))
  } else {
    console.log('[GameInit] ⚠️ 폴백: 균등 덱 생성 (elementDist 또는 deckSeed 부재)')
    deck = shuffleDeck(createFixedDeck())
  }
  const hand = deck.slice(0, HAND_SIZE)
  const remainDeck = deck.slice(HAND_SIZE)

  // 스펙 v2: 용신 원소 계산 (영웅 프로필의 일간 기준)
  const favorableElement = heroProfile?.ilganElement
    ? getFavorableElement(heroProfile.ilganElement)
    : undefined

  // balance.ts 수치 그대로 사용 (기믹은 전투 중 별도 로직으로 적용)
  // v4 모드 시 getFloorHp(floorIndex)로 V4_FLOOR_HP_TABLE 값 주입, 그 외 floorConfig.enemyHp 유지
  const initEnemyHp = getFloorHp(floorIndex)

  // 배치 2 §1: 결정론 RNG 초기값 (deckSeed 파생, 없으면 고정 상수)
  const initRngState = heroProfile?.deckSeed ? (heroProfile.deckSeed ^ 0x9E3779B9) >>> 0 : 0x9E3779B9

  // 배치 2 §1: 겁재(劫財) 전투 시작 훅 — activePassiveIds 없으므로 초기 런에서는 미발동
  // (activePassiveIds는 런 시작 후 별도 선택 UI에서 채워지므로 여기서는 빈 배열 기준)
  const initGeoptaeStealDamage = 0

  return {
    currentFloor: floorConfig.floor,
    playerHp: PLAYER_BASE_HP,
    playerMaxHp: PLAYER_BASE_HP,
    enemyHp: initEnemyHp,
    enemyMaxHp: initEnemyHp,
    hand,
    deck: remainDeck,
    discardPile: [],
    selectedCards: [],
    discardsLeft: BASE_DISCARDS,
    playsLeft: floorConfig.maxPlays,
    phase: 'select',
    isVictory: false,
    floorsCleared: 0,
    talismans: [],
    amplifyActive: false,
    attackCount: 0,
    enemyPhaseSwitch: false,
    condenseActive: false,         // 하위 호환 (deprecated)
    // Phase 1.9.2 신규 필드 초기화
    yeonhwanUsed: false,
    // R4: 상관 출정당 발동 횟수 초기화 (미사용 유지 — 캡 로직 폐기)
    sanggwanUsed: 0,
    // Phase 1.9.5: 응축 확정판 (% 방식)
    condensedMultiplier: 0,
    isLastAttack: floorConfig.maxPlays === 1,
    // Phase 1.9.5: 10종 융합 특성
    lastTraitTriggered: undefined,
    carryoverBurn: 0,
    // B1-1: 잔불 지속 피해 — 런 시작 시 초기화
    emberDamagePerTurn: 0,
    emberTurnsLeft: 0,
    // R10: 미구현 3종 융합 특성
    purifiedElements: [],
    keenActive: false,
    mirrorShieldActive: false,
    reshuffled: false,
    // 스펙 v2: 용신 원소
    favorableElement,
    // Phase 1.9.6: 유물 시스템
    relics: [],
    // T17: 가호(십성) 시스템
    activePassiveIds: [],
    // sikshin D안: 삭제 (v2에서 sikshinRicegrains로 교체) — 하위 호환 false 유지
    sikshinDiscardBonus: false,
    // 겁재: 층마다 리셋
    geoptaeUsed: false,
    // 배치 1.5: 강림제 초기화
    yongsinDescent: initYongsinDescent(heroProfile, floorIndex),
    // α 수확 체감: 전투별 gather5 활성화 횟수 추적 (동일 전투 내만 유지, 전투 종료 시 리셋)
    gatherUsedInBattle: 0,
    // 배치 2 §1: 가호 v2 신규 필드
    rngState: initRngState,
    geoptaeStealDamage: initGeoptaeStealDamage,
    sikshinRicegrains: 0,
    bigyeonCopyUsed: false,
    jeonginUsed: false,
    jeonginBuff: false,
  }
}

/** 역극 여부 판단: 플레이어 카드들이 적 오행에 의해 극 당하면 역극 */
export function isYeokgeuk(card: Card, enemyElement: Element): boolean {
  return GEUK_MAP[enemyElement] === card.element
}

/**
 * 출수 실행 → 새로운 GameState 반환
 *
 * @param state       현재 게임 상태
 * @param cardIds     출수할 카드 ID 목록
 * @param effectMode  true이면 fusion-birth 조합에서 공격 데미지 = 0, 효과만 발동 (B1-1 양자택일)
 */
export function playCards(state: GameState, cardIds: string[], effectMode?: boolean): GameState {
  // T22 진단 로그 — 덱 축소 원인 추적 (수정 금지, 진단 전용)
  if (typeof window !== 'undefined') {
    const turn = (state.playsLeft !== undefined) ? state.playsLeft : '?'
    console.log(
      `[T22-DIAG] 턴 ${turn} 출수 전` +
      ` | 덱: ${state.deck.length}장` +
      ` | 버린패: ${state.discardPile.length}장` +
      ` | 소진더미: 0장` +
      ` | 손패: ${state.hand.length}장` +
      ` | selectedIds: ${cardIds.length}장`
    )
  }

  const floorConfig = FLOOR_CONFIGS[state.currentFloor - 1]
  const gimmicks = getFloorGimmicks(state.currentFloor)
  const playedCards = state.hand.filter(c => cardIds.includes(c.id))
  const remainHand = state.hand.filter(c => !cardIds.includes(c.id))

  // α 수확 체감: 동일 전투 내 gather5 활성화 횟수 추적
  const currentGatherCount = state.gatherUsedInBattle ?? 0
  const result = judgeHand(playedCards, state.recipeMultipliers, currentGatherCount)

  // T8 수정: 오색실 — 배율 전 baseScore에 +15 가산 (15×N 증폭 목적)
  // 연환 발동 + 오색실 보유 시, totalScore를 (baseScore + 15) × 배율로 재계산
  // §4: result.multiplier 사용 (어환 ×12 / 연환 ×8 모두 대응)
  const hasOsakshilEarly = (state.relics ?? []).some(r => r.id === 'osakshil')
  const isYeonhwanCombo = result.rank === 'ohang-yeonhwan'
  let damage = (hasOsakshilEarly && isYeonhwanCombo)
    ? Math.round((result.baseScore + OSAKSHIL_YEONHWAN_BONUS) * result.multiplier)
    : result.totalScore

  // R10: 3종 융합 특성 상태 (상성 계산·강공 계산보다 먼저 선언)
  let newPurifiedElements = state.purifiedElements ?? []
  let newPurificationImmune = state.purificationImmune ?? false
  let newKeenActive = state.keenActive ?? false
  let newMirrorShieldActive = state.mirrorShieldActive ?? false

  // Phase 1.7 — 기운 전환 반영: 전환 시 주/부 기운 교대
  const primaryEl = (!state.enemyPhaseSwitch)
    ? floorConfig.enemyPrimaryElement
    : floorConfig.enemySubElement

  // Phase 1.6 A — 전투 규칙 3종 (floorEnemyEl = 현재 주 기운)
  const floorEnemyEl = primaryEl as Element | undefined

  // A-1: [기운 충돌] 조합 내 서로 극하는 기운 공존 시 -30%
  const clashes = detectElementClash(playedCards)
  if (clashes.length > 0) {
    damage = Math.round(damage * 0.7)
  }

  // T14: 상성 판정 대표 원소 — 타격 속성(finishingElement) 기준
  // 융합 조합(fusion-birth/fusion-hone): finishingElement = fusion.result (결과 기운)
  // 기운 모으기: finishingElement = 모으는 기운 (단일 원소)
  // 오행연환: finishingElement = 'mok' (임시 — 모든 기운이 관여, 상성 중립 처리)
  // 다수결 로직 완전 제거
  const repEl: Element = result.finishingElement

  // 상생상극 매트릭스 적용 (스펙 v2 — 유일한 원소 상성 배율)
  if (floorEnemyEl) {
    const iGeukEnemy   = GEUK_MAP[repEl] === floorEnemyEl    // 내가 적을 극 → ×1.7 (R8 복원)
    const iSaengEnemy  = SANG_MAP[repEl] === floorEnemyEl    // 내가 적을 생 → ×0.5
    const enemyGeukMe  = GEUK_MAP[floorEnemyEl] === repEl    // 적이 나를 극 → ×0.75

    if (iGeukEnemy) {
      damage = Math.round(damage * GEUK_BONUS_MULTIPLIER)    // ×1.7 (R8)
      // R10: 예리(벼린 검) — 극 보너스 추가 ×1.5 (1회 소모)
      if (state.keenActive) {
        damage = Math.round(damage * 1.5)
        newKeenActive = false
      }
    } else if (iSaengEnemy) {
      damage = Math.round(damage * SANG_PENALTY_MULTIPLIER)  // ×0.5
    } else if (enemyGeukMe) {
      // R10: 정화(샘) — 해제된 원소는 역극 면역
      const isPurified = (state.purifiedElements ?? []).includes(repEl)
      if (!isPurified) {
        damage = Math.round(damage * ANTI_GEUK_PENALTY)      // ×0.75
      }
    } else if (YIKSEANG_MAP[repEl] === floorEnemyEl) {
      // 역생: 적이 나를 생 → ×1.2 (배치 1.5-A-2, 이든 기정 승인 2026-07-16)
      damage = Math.round(damage * YIKSEANG_MULT)
    } else if (repEl === floorEnemyEl) {
      // 동기(同氣): 같은 기운은 스며든다 → ×0.85 (이든 G9 승인 2026-07-19)
      damage = Math.round(damage * DONGGI_MULTIPLIER)
    }
  }

  // R8 복원: 부 기운 극 보너스 ×1.25 (주 기운 극 미적용 시, 카드가 부 기운을 극하면 적용)
  const subEl = (!state.enemyPhaseSwitch)
    ? floorConfig.enemySubElement
    : floorConfig.enemyPrimaryElement
  const mainGeukApplied = floorEnemyEl ? GEUK_MAP[repEl] === floorEnemyEl : false
  if (!mainGeukApplied && subEl) {
    const hasSubGeuk = playedCards.some(c => GEUK_MAP[c.element] === subEl)
    if (hasSubGeuk) {
      damage = Math.round(damage * SUB_GEUK_BONUS)
    }
  }

  // T2 롤백: 연환 "출정당 1회" 제한 제거 (E-1 폐지)
  // 근거: T21 잭팟화(희귀화) 확보로 제한 없이도 밸런스 성립
  // T21-b와 동일 커밋
  const newYeonhwanUsed = state.yeonhwanUsed  // 추적 유지 (stats용), 차단 로직 제거
  const isBlocked = false  // 연환 차단 없음 — 횟수 제한 폐지

  // Phase 1.6 B — 증폭부: 다음 공격 ×2
  if (state.amplifyActive && !isBlocked) {
    damage = damage * 2
  }

  // 스펙 v2 — 용신 보너스
  // 콤보에 플레이어 용신 원소 카드가 포함되어 있으면 ×1.3
  // 연환 3장 이상이고 마지막 카드가 용신 원소이면 ×1.5 (×1.3 대체)
  //
  // v3.1 §3 개정 (R5): 효과 = rawBase가 아니라 용신·가호 시너지를 받는 값.
  // 공격과의 차이는 상성 축뿐.
  //
  // R5 (balance-v3 §3): 용신·가호 시너지 배율을 효과에도 동일하게 적용한다.
  // 공격과의 차이는 상성 축뿐 — 효과는 상성 배율을 받지 않는다.
  // synergyMultiplier = 용신 배율 × 가호 배율 (시너지 합산)
  let synergyMultiplier = 1.0  // 공격·효과 공통 시너지 배율

  // [2026-07-18 이든 확정] 용신 상시 ×1.3/×1.5 폐지 — 정본 = 강림제 B-3: 슬롯 도래 시에만 사건.
  // 구세계 상시 보너스 분기 완전 제거. 강림 시스템 활성화 시 하단 descent 블록에서 처리.

  // 배치 1.5: 강림제 — 강림 슬롯에서만 ×2.0 (상시 ×1.3 폐지 대체)
  // ENABLE_YONGSIN_DESCENT=true 시: 슬롯 적중+용신 포함 → ×2.0
  // ENABLE_YONGSIN_DESCENT=false 시: 이 블록 전체 건너뜀 (프로덕션 불변)
  let newYongsinDescent = state.yongsinDescent
  if (ENABLE_YONGSIN_DESCENT && state.yongsinDescent && state.favorableElement && !isBlocked) {
    const hasYongsin = playedCards.some(c => c.element === state.favorableElement)
    const descentResult = applyYongsinDescent(damage, hasYongsin, state.attackCount, state.yongsinDescent)
    damage = descentResult.damage
    newYongsinDescent = descentResult.updatedState
  }

  // Phase 1.9.5: 응축 % 방식 소모 — condensedMultiplier > 0이면 damage × (1 + multiplier) 적용
  let newCondensedMultiplier = state.condensedMultiplier ?? 0
  if (newCondensedMultiplier > 0 && !isBlocked) {
    damage = Math.round(damage * (1 + newCondensedMultiplier))
    newCondensedMultiplier = 0
  }

  // Phase 1.9.2 E-2: 자동 응축 폐지 — 구형 자동 응축 로직 제거
  const newCondenseActive = false  // deprecated 필드, 항상 false 유지

  // 배치 2 §1: 가호(십성) 10종 효과 반영
  // activePassiveIds 기반 패시브 적용 — 모든 패시브는 isBlocked가 아닐 때만 발동
  let passiveHealBonus = 0  // (미사용 — 편재는 턴 종료 훅으로 이동)
  let passiveCounterReduction = 0  // 비견: 반격 피해 감소 (기존 로직은 폐기, 비견은 복제로 대체)
  // 하위 호환 상관/겁재 추적 변수
  let newSanggwanUsed = state.sanggwanUsed ?? 0
  let newGeoptaeUsed = state.geoptaeUsed ?? false
  let newRngState = state.rngState ?? 0x9E3779B9
  // 비견 복제: 이번 playCards에서 복제 타격을 가할지
  let bigyeonCopyDamage = 0
  // 편관: 이번 공격이 추가 출수권 부여하는지
  let pyeongwanExtraPlay = false
  // 배치 2 §1: 편관(偏官) v2 턴당 1회 발동 제한
  let newPyeongwanActivationsThisTurn = state.pyeongwanActivationsThisTurn ?? 0
  // 식신 밥알
  let newSikshinRicegrains = state.sikshinRicegrains ?? 0
  // 정인 버프 소비
  let newJeonginBuff = state.jeonginBuff ?? false
  // 비견 복제 사용 여부
  let newBigyeonCopyUsed = state.bigyeonCopyUsed ?? false

  // isFusion 선행 선언 (패시브 루프에서 사용)
  const isFusionEarly = result.rank === 'fusion-birth' || result.rank === 'fusion-hone'
  const isSmallFusion = isFusionEarly && playedCards.length === 2

  if (!isBlocked) {
    const activeIds = state.activePassiveIds ?? []
    const activePassives = PASSIVE_POOL.filter(p => activeIds.includes(p.id))

    for (const passive of activePassives) {
      switch (passive.id) {
        case 'sikshin': {
          // 식신(食神) v2: 융합 시 밥알 소비 — charges=floor(ricegrains/5), 1충전 시 ×1.3
          if (isFusionEarly) {
            const charges = Math.floor(newSikshinRicegrains / 5)
            if (charges > 0) {
              damage = Math.round(damage * 1.3)
              newSikshinRicegrains -= 5
            }
          }
          break
        }
        case 'bigyeon': {
          // 비견(比肩) v2: 이번 전투 첫 융합 시 같은 공격 2연타 (복제타 = 최종 damage의 50%)
          // 복제타 계산은 루프 밖(최종 damage 확정 후) — 여기서는 플래그만 세팅
          if (isFusionEarly && !newBigyeonCopyUsed) {
            newBigyeonCopyUsed = true
          }
          break
        }
        case 'geoptae': {
          // 겁재(劫財) v2: 전투 시작 시 계산된 stealDamage를 첫 공격에 가산 후 소비
          if (!newGeoptaeUsed && (state.geoptaeStealDamage ?? 0) > 0) {
            damage = damage + (state.geoptaeStealDamage ?? 0)
            newGeoptaeUsed = true
          }
          break
        }
        case 'sanggwan': {
          // 상관(傷官) v2: 황금비 정점(isRatioPeak) 시 50% 확률로 ×2.0, 아니면 ×1.2
          // 기존 SANGGWAN_MAX_PER_RUN 캡 로직 폐기
          if ((result as { isRatioPeak?: boolean }).isRatioPeak === true) {
            const rngRoll = nextRng(newRngState)
            newRngState = rngRoll.next
            if (rngRoll.value < 0.5) {
              damage = Math.round(damage * 2.0)
            } else {
              damage = Math.round(damage * 1.2)
            }
            newSanggwanUsed = newSanggwanUsed + 1  // 추적 유지 (통계용)
          }
          break
        }
        case 'pyeonjae': {
          // 편재(偏財) v2: 턴 종료 훅으로 이동 — playCards 내에서는 무동작
          break
        }
        case 'jeongjae': {
          // 정재(正財) v2: 오행연환 발동 시 카드 2장 드로우 (이후 손패리필 섹션에서 처리)
          // 여기서는 플래그만 설정 — newHand 아직 미생성
          break
        }
        case 'pyeonin': {
          // 편인(偏印) v2: 소융합(2장) 시 피해 ×1.6
          if (isSmallFusion) {
            damage = Math.round(damage * 1.6)
          }
          break
        }
        case 'pyeongwan': {
          // 편관(偏官) v2: 이번 공격 damage >= enemyMaxHp*0.15 시 추가 출수권 +1 (턴당 1회)
          // damage 계산 완료 후 판정 필요 — 여기서는 조건 예비 플래그
          // (damage가 이 시점에 계산 완료되므로 즉시 판정 가능)
          // 배치 2 §1: 턴당 1회 발동 제한 추가 (newPyeongwanActivationsThisTurn < 1)
          if (damage >= state.enemyMaxHp * 0.15 && newPyeongwanActivationsThisTurn < 1) {
            pyeongwanExtraPlay = true
            newPyeongwanActivationsThisTurn++
          }
          break
        }
        case 'jeonggwan': {
          // 정관(正官) v2: effectMode 선택 시 효과량 ×1.5 — synergyMultiplier에 반영
          // fusion-birth + fusion-hone 양쪽 모두 effectMode 가능 (양자택일 = 공격 vs 효과)
          if (effectMode && isFusionEarly) {
            synergyMultiplier = synergyMultiplier * 1.5
          }
          break
        }
        case 'jeongin': {
          // 정인(正印) v2: 다음 융합 1회 ×1.5 버프 소비
          if (isFusionEarly && newJeonginBuff) {
            damage = Math.round(damage * 1.5)
            newJeonginBuff = false
          }
          break
        }
      }
    }
  }

  // 배치 2 §1: 비견 복제타 — 루프 후 최종 damage 기준 계산 (mid-loop 계산 시 후속 패시브 미반영 방지)
  // state.bigyeonCopyUsed가 false → newBigyeonCopyUsed가 true = 이번 턴에 복제 플래그 세팅됨 (첫 융합)
  const bigyeonJustTriggered = newBigyeonCopyUsed && !(state.bigyeonCopyUsed ?? false)
  if (bigyeonJustTriggered && isFusionEarly && !isBlocked) {
    bigyeonCopyDamage = Math.round(damage * 0.5)
  }

  // Phase 1.9.5: 10종 융합 특성 발동 판정
  // 융합 조합인 경우만 특성 발동 (rank: fusion-birth or fusion-hone)
  const isFusion = isFusionEarly  // 패시브 루프 상단에서 선언된 isFusionEarly와 동일
  const comboName = result.name
  // α 수확 체감: gather5(5장 모으기) 활성화 판정
  const isGather5 = result.rank === 'gather' && playedCards.length === 5
  let newGatherUsedInBattle = currentGatherCount
  if (isGather5) {
    newGatherUsedInBattle = currentGatherCount + 1
  }
  let newLastTraitTriggered: string | undefined = undefined
  let newCarryoverBurn = state.carryoverBurn ?? 0

  // B1-1: 잔불 지속 피해 적용 (emberDamagePerTurn × 남은 턴)
  // 매 playCards 호출 시 잔불 1틱 적용 후 emberTurnsLeft 감소
  let newEmberDamagePerTurn = state.emberDamagePerTurn ?? 0
  let newEmberTurnsLeft = state.emberTurnsLeft ?? 0
  if (newEmberDamagePerTurn > 0 && newEmberTurnsLeft > 0 && !isBlocked) {
    damage = damage + newEmberDamagePerTurn
    newEmberTurnsLeft = newEmberTurnsLeft - 1
    if (newEmberTurnsLeft <= 0) {
      newEmberDamagePerTurn = 0
    }
  }

  // 번짐 이월 피해 가산 (이전 공격에서 저장된 잔불)
  if (newCarryoverBurn > 0 && !isBlocked) {
    damage = damage + newCarryoverBurn
    newCarryoverBurn = 0
  }

  // 저격(snipe): 금 관통 — 피해감소 무시
  let snipeActive = false
  if (isFusion && comboName && FUSION_TRAIT_MAP[comboName] === 'snipe' && !isBlocked) {
    snipeActive = true
    newLastTraitTriggered = 'snipe'
  }

  // Phase 1.7: 4층 보스 금강불괴 — 받는 피해 -30% (저격 시 건너뜀)
  if (!snipeActive && floorConfig.eliteGimmickEffect?.type === 'damage-reduction' && state.currentFloor >= 3) {
    const pct = floorConfig.eliteGimmickEffect.pct
    damage = Math.round(damage * (1 - pct))
  }

  // C10(d): 붕토령 — 받는 피해 -20% (저격 시 건너뜀)
  const reductionGimmick = gimmicks.find(g => g.type === 'damage-reduction')
  if (!snipeActive && reductionGimmick && reductionGimmick.type === 'damage-reduction') {
    const pct = reductionGimmick.pct
    damage = Math.round(damage * (1 - pct))
  }

  // T8: 유물 — 오색실: 배율 전 baseScore 가산 처리는 상단(damage 초기화 시점)에서 완료됨

  // T8: 유물 — 호리병: 내 HP 30 이하 시 콤보 배율 +1 (afterDamageHp 계산 전)
  // 배율 +1 = baseScore × 1 추가 (단일 배율 단위)
  const hasHorybyeong = (state.relics ?? []).some(r => r.id === 'horybyeong')
  if (hasHorybyeong && state.playerHp <= HORYBYEONG_HP_THRESHOLD) {
    const extraDamage = Math.round(result.baseScore * HORYBYEONG_MULTIPLIER_BONUS)
    damage = damage + extraDamage
  }

  // B1-1: effectMode — fusion-birth 조합에서 양자택일(효과만, 공격 데미지 = 0)
  // effectMode=true이면 공격 데미지를 0으로 설정하고 효과만 발동
  // 융합(fusion-birth)이 아닌 경우 effectMode는 무시
  if (effectMode && isFusion && result.rank === 'fusion-birth') {
    damage = 0
  }

  // C10(d): 고목령 — 매 턴 체력 15 회복 (피해 적용 후, 생존 시에만)
  const healGimmick = gimmicks.find(g => g.type === 'heal')
  const afterDamageHp = Math.max(0, state.enemyHp - damage)
  const enemyHealAmount = (healGimmick && healGimmick.type === 'heal' && afterDamageHp > 0)
    ? healGimmick.amount : 0

  let newEnemyHp = Math.min(state.enemyMaxHp, afterDamageHp + enemyHealAmount)
  let counterDamage = floorConfig.counterDamage

  // T17: 비견(比肩) — 같은 기운 모으기 3 이상 시 반격 -1
  if (passiveCounterReduction > 0) {
    counterDamage = Math.max(0, counterDamage - passiveCounterReduction)
  }

  // C10(d): 잔화령 — 반격 +50%
  const counterBoostGimmick = gimmicks.find(g => g.type === 'counter-boost')
  if (counterBoostGimmick && counterBoostGimmick.type === 'counter-boost') {
    counterDamage = Math.round(counterDamage * counterBoostGimmick.pct)
  }

  // Phase 1.7: 강공(heavyAttack) 시스템 — 3~4층
  const newAttackCount = state.attackCount + 1
  const heavyAttackConf = floorConfig.heavyAttack
  let heavyAttackDamage = 0
  if (heavyAttackConf && newAttackCount % heavyAttackConf.everyN === 0) {
    heavyAttackDamage = heavyAttackConf.damage
    // R10: 비침(맑은 못) — 강공 피해 50% 감소 (1회 소모)
    if (state.mirrorShieldActive) {
      heavyAttackDamage = Math.round(heavyAttackDamage * 0.5)
      newMirrorShieldActive = false
    }
  }

  // Phase 1.7: 격노(rage) 보스 효과 — 반격 배율 강화 (체력 전환 후)
  const rageEffect = floorConfig.bossExtraGimmick?.type === 'rage'
    ? floorConfig.bossExtraGimmick
    : null
  if (rageEffect && state.enemyPhaseSwitch) {
    counterDamage = Math.round(counterDamage * rageEffect.counterMult)
  }

  // T8: 유물 — 해태상: 반격 피해 -3 (하한 0)
  const hasHaetae = (state.relics ?? []).some(r => r.id === 'haetae')
  if (hasHaetae) {
    counterDamage = Math.max(0, counterDamage - HAETAE_COUNTER_REDUCTION)
  }

  // lifesteal: 출수한 카드 중 lifesteal 카드가 있으면 데미지의 30%를 HP 회복
  const hasLifesteal = playedCards.some(c => c.lifesteal === true)
  const lifestealHeal = hasLifesteal ? Math.floor(damage * 0.3) : 0
  const newPlayerHp = Math.min(
    state.playerMaxHp,
    Math.max(0, state.playerHp - counterDamage - heavyAttackDamage + lifestealHeal)
  )
  const newPlaysLeft = state.playsLeft - 1

  // Phase 1.9.4 수정 1: 덱 부족 시 버림+사용 카드 섞어 재순환 (소프트락 방지)
  // 불변 조건: "공격 기회가 남아 있는 한, 핸드는 항상 리필된다" — 진행 불능 상태 금지
  let newDeck = [...state.deck]
  // 플레이한 카드는 버림더미로 이동 (리필 전 먼저 계산)
  let newDiscardPile = [...state.discardPile, ...playedCards]
  let reshuffled = false
  // 보충식(수렴 불변): 공격 후 핸드를 항상 HAND_SIZE로 리필 = max(0, 8−잔여)
  // (1:1 드로우 회귀 복원 — 진행 불능 방지 + 채굴 스택의 8장 기준선 확보)
  const refillCount = Math.max(0, HAND_SIZE - remainHand.length)
  if (newDeck.length < refillCount) {
    // 덱 부족: 버림더미(방금 사용한 카드 포함)를 섞어 덱 재구성 (카드 상태 유지)
    const allCards = [...newDeck, ...newDiscardPile]
    newDeck = shuffleDeck(allCards)
    reshuffled = true
  }
  const drawnCards: Card[] = []
  for (let i = 0; i < refillCount && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }
  let newHand = [...remainHand, ...drawnCards]

  // 배치 2 §1: 정재(正財) v2 — 오행연환 발동 시 카드 2장 드로우 (손패리필 직후)
  // 정재(正財): result.rank==='ohang-yeonhwan' 성립 시 카드 2장 드로우
  const activeIdsJeongjae = state.activePassiveIds ?? []
  if (!isBlocked && result.rank === 'ohang-yeonhwan' && activeIdsJeongjae.includes('jeongjae')) {
    // 2장 드로우 — 덱 부족 시 discardPile 재순환
    for (let i = 0; i < 2; i++) {
      if (newDeck.length === 0 && newDiscardPile.length > 0) {
        const recycled = shuffleDeck([...newDiscardPile])
        newDeck = recycled
        newDiscardPile = []
      }
      if (newDeck.length > 0) {
        newHand = [...newHand, newDeck.shift()!]
      }
    }
  }

  // C10(d): 녹철령(金) — 매 턴 무작위 핸드 카드 1장 값 -1 (적 생존 시만 발동)
  const rustGimmick = gimmicks.find(g => g.type === 'card-rust')
  if (rustGimmick && rustGimmick.type === 'card-rust' && newHand.length > 0 && afterDamageHp > 0) {
    const rustIdx = Math.floor(Math.random() * newHand.length)
    newHand = newHand.map((c, i) =>
      i === rustIdx ? { ...c, value: Math.max(2, c.value - rustGimmick.amount) } : c
    )
  }

  // R5: 정화 추가 데미지 (purification case에서 설정, switch 블록 이후 newEnemyHp에 반영)
  let purificationBonusDamage = 0

  // Phase 1.9.5: 10종 융합 특성 발동 (피해 적용 후 효과)
  // 배치 2 §2: 여왕 효과 — 포함된 융합의 효과량 ×1.25
  // (게이트 ③ FAIL 처방, 이든 판정 2026-07-18: ×1.5 → ×1.25. 1.25 하한 — 아래는 존재감 소멸)
  const hasQueen = playedCards.some(c => c.royalType === 'queen')
  const queenAmplify = hasQueen ? 1.25 : 1.0
  if (isFusion && comboName && !isBlocked) {
    const traitId = FUSION_TRAIT_MAP[comboName]
    if (traitId && traitId !== 'snipe') {  // snipe은 위에서 처리
      const isDisabled = (state.disabledTraits ?? []).includes(traitId)
      newLastTraitTriggered = traitId
      const config = TRAIT_CONFIGS[traitId]
      if (config && !isDisabled) {
        switch (traitId) {
          case 'wildfire': {
            // R6 (balance-v3 §6): 번짐 — effectMode 분기
            // effectMode=true (효과 모드): rawBase × EMBER_MULTIPLIER 턴당 고정 피해, EMBER_DURATION턴 지속
            //   → damage=0이어서 damage 경유 불가. rawBase 직접 계산.
            // effectMode=false (공격 모드): damage × 0.3 × synergyMultiplier 다음 공격 이월 (기존 방식 유지)
            if (effectMode && isFusion && result.rank === 'fusion-birth') {
              const rawBase = playedCards.reduce((sum, c) => sum + c.value, 0)
              newEmberDamagePerTurn = Math.round(rawBase * EMBER_MULTIPLIER * synergyMultiplier * queenAmplify)
              newEmberTurnsLeft = EMBER_DURATION
              newCarryoverBurn = 0
            } else {
              newCarryoverBurn = Math.round(damage * 0.3 * synergyMultiplier * queenAmplify)
            }
            break
          }
          case 'mining': {
            // R5 (balance-v3 §3): 채굴 — 투입값 × synergyMultiplier 기반 드로우
            // floor(투입값 × synergyMultiplier / MINING_DRAW_DIVISOR)장, 최대 MINING_MAX_DRAW
            // 리필된 8장 위에 추가 스택 (핸드 상한 미적용) → 최대 HAND_SIZE+MINING_MAX_DRAW(=11)장
            const baseValueMining = playedCards.reduce((sum, c) => sum + c.value, 0)
            const drawCount = Math.min(
              Math.floor(baseValueMining * synergyMultiplier * queenAmplify / MINING_DRAW_DIVISOR),
              MINING_MAX_DRAW,
              newDeck.length,
            )
            const drawnInMining: Card[] = []
            for (let i = 0; i < drawCount; i++) {
              if (newDeck.length > 0) drawnInMining.push(newDeck.shift()!)
            }
            newHand = [...newHand, ...drawnInMining]
            break
          }
          case 'nourish': {
            // R5 (balance-v3 §3): 자양 — 투입값 × NOURISH_EFFECT_COEFF × synergyMultiplier 회복
            // 후처리 블록에서 synergyMultiplier 반영하여 finalPlayerHp 계산
            break
          }
          case 'harvest': {
            // 수확: 손의 목·토 카드 값 +N (여왕 ×1.5 시 +1→+2)
            const harvestBoost = Math.round(1 * queenAmplify)
            newHand = newHand.map(c =>
              (c.element === 'mok' || c.element === 'to')
                ? { ...c, value: c.value + harvestBoost }
                : c
            )
            break
          }
          case 'quench': {
            // 담금질: 이번 공격에 쓴 카드 값 +N 영구 (여왕 ×1.5 시 +1→+2)
            const quenchBoost = Math.round(1 * queenAmplify)
            const quenchIds = new Set(cardIds)
            const quenchUp = (c: Card) => quenchIds.has(c.id) ? { ...c, value: c.value + quenchBoost } : c
            newHand = newHand.map(quenchUp)
            newDeck = newDeck.map(quenchUp)
            newDiscardPile = newDiscardPile.map(quenchUp)
            break
          }
          case 'purification': {
            // R5 정화 구현: R3 감사(2026-07-14) 시 purification case 미검증 — 부실 기록 인정
            // R5 (balance-v3 §3): 정화(샘) — 투입값 기반 분기 + 시너지 적용
            // 적 상태이상(기세 죽음) 해제 시마다 데미지: BASE_PURIFICATION_DAMAGE × synergyMultiplier
            const baseValuePurify = playedCards.reduce((sum, c) => sum + c.value, 0)
            // 임계값 시너지 스케일: synergyMultiplier가 클수록 더 적은 투입값으로 전해제 달성
            const effectiveThreshold = PURIFICATION_THRESHOLD / synergyMultiplier
            if (baseValuePurify >= effectiveThreshold) {
              // 전 원소 기세 죽음 해제 (투입값 충분 시)
              const allElements: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
              const newlyPurified = allElements.filter(el => !(state.purifiedElements ?? []).includes(el))
              newPurifiedElements = [...allElements]
              // 투입값 충분(≥임계) → 출정 내 기세 죽음 재발 면역 부여
              newPurificationImmune = true
              // 해제된 원소 수 × 기본 데미지 × synergyMultiplier
              purificationBonusDamage = Math.round(newlyPurified.length * BASE_PURIFICATION_DAMAGE * synergyMultiplier * queenAmplify)
            } else if (floorEnemyEl) {
              // 1종만 해제 (R10 기존 로직 유지)
              const deadEl = GEUK_MAP[floorEnemyEl] as Element | undefined
              if (deadEl && !(state.purifiedElements ?? []).includes(deadEl)) {
                newPurifiedElements = [...(state.purifiedElements ?? []), deadEl]
                // 해제 1종 데미지 (상성 무시)
                purificationBonusDamage = Math.round(BASE_PURIFICATION_DAMAGE * synergyMultiplier * queenAmplify)
              }
            }
            break
          }
          case 'keen': {
            // R10: 예리(벼린 검) — 다음 극 보너스 ×1.5
            newKeenActive = true
            break
          }
          case 'mirror': {
            // R10: 비침(맑은 못) — 다음 강공 피해 50% 감소
            newMirrorShieldActive = true
            break
          }
          // yonggigama(응축)는 applyCondense에서 별도 처리
          default:
            break
        }
      }
    }
  }

  // R5: 정화 추가 데미지 — switch 블록 이후 newEnemyHp에 반영 (상성 무시)
  if (purificationBonusDamage > 0) {
    newEnemyHp = Math.max(0, newEnemyHp - purificationBonusDamage)
  }

  const floorCleared = newEnemyHp <= 0
  let playerDead = newPlayerHp <= 0
  const outOfPlays = newPlaysLeft <= 0 && newEnemyHp > 0

  // 배치 2 §1: 정인(正印) 사망 가로채기 훅 — playerDead 판정 직후, phase 분기 전
  // activePassiveIds에 jeongin 있고, jeonginUsed==false이고, playerDead이면:
  //   newPlayerHp=1, jeonginUsed=true, playerDead=false (생존), jeonginBuff=true
  const newJeonginUsed_pre = state.jeonginUsed ?? false
  if (playerDead && !newJeonginUsed_pre && (state.activePassiveIds ?? []).includes('jeongin') && !floorCleared) {
    // 가로채기 성공
    // finalPlayerHp는 이후에 설정되므로 newPlayerHp를 직접 조작할 수 없음
    // → 플래그를 통해 이후 finalPlayerHp 계산 시 반영
    playerDead = false
    newJeonginBuff = true  // 다음 융합 ×1.5 버프 활성
  }
  // jeonginUsed: 가로채기 발동 시 true (런 내내 유지)
  const newJeonginUsed = (!newJeonginUsed_pre && !playerDead && (state.activePassiveIds ?? []).includes('jeongin') && newPlayerHp <= 0)
    ? true
    : newJeonginUsed_pre

  // Phase 1.7: 기운 전환 판정 (3~4층, 1회만)
  const phaseSwitchThreshold = floorConfig.forcePhaseSwitch?.hpPct ?? null
  const newEnemyPhaseSwitch =
    state.enemyPhaseSwitch ||
    (phaseSwitchThreshold !== null && !floorCleared && newEnemyHp <= state.enemyMaxHp * phaseSwitchThreshold)

  let phase = state.phase
  let isVictory = state.isVictory
  let floorsCleared = state.floorsCleared

  if (floorCleared) {
    floorsCleared = state.floorsCleared + 1
    if (state.currentFloor >= 4) {
      phase = 'result'
      isVictory = true
    } else {
      phase = 'floor-reward'
    }
  } else if (playerDead || outOfPlays) {
    phase = 'result'
    isVictory = false
  }

  // Phase 1.9.2: 마지막 공격 기회 판별 (다음 턴 기준)
  const nextPlaysLeft = newPlaysLeft
  const newIsLastAttack = nextPlaysLeft === 1

  // R5 (balance-v3 §3): 자양(nourish) 체력 회복 — heal value × synergyMultiplier
  // heal value = playerMaxHp × NOURISH_HEAL_PCT (T19 기준 유지)
  // 시너지 적용: 기존 회복량 × synergyMultiplier
  let finalPlayerHp = newPlayerHp
  if (isFusion && comboName && FUSION_TRAIT_MAP[comboName] === 'nourish' && !isBlocked) {
    const baseHeal = Math.round(state.playerMaxHp * NOURISH_HEAL_PCT)
    const healAmount = Math.round(baseHeal * synergyMultiplier * queenAmplify)
    finalPlayerHp = Math.min(state.playerMaxHp, finalPlayerHp + healAmount)
  }

  // 배치 2 §1: 정인(正印) 사망 가로채기 — finalPlayerHp를 1로 강제
  // playerDead가 false(가로채기 발동)이고 newPlayerHp<=0인 경우에 적용
  if (!playerDead && newPlayerHp <= 0 && newJeonginUsed) {
    finalPlayerHp = 1
  }

  // 배치 2 §1: 편재(偏財) 턴 종료 훅 — 손패리필(L600) 직후, floorCleared/playerDead 아닌 경우에만
  // 20% 확률로 고값(8~10) 카드 1장을 newHand에 추가
  if (!isBlocked && !floorCleared && !playerDead) {
    const activeIdsForPyeonjae = state.activePassiveIds ?? []
    if (activeIdsForPyeonjae.includes('pyeonjae')) {
      const rngRollPyeonjae = nextRng(newRngState)
      newRngState = rngRollPyeonjae.next
      if (rngRollPyeonjae.value < 0.20) {
        // 스펙: "왕족 또는 고값(8~10) 카드 1장" — 2번째 RNG roll로 결정
        const rngRoll2 = nextRng(newRngState)
        newRngState = rngRoll2.next
        const elements: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
        let bonusCard: Card
        if (rngRoll2.value < 0.5 && ROYAL_CARDS.length > 0) {
          // 왕족 카드 생성 (50%)
          const rIdx = Math.floor(rngRoll2.value / 0.5 * ROYAL_CARDS.length) % ROYAL_CARDS.length
          bonusCard = createRoyalCard(ROYAL_CARDS[rIdx], 10, `pyeonjae-${state.attackCount}`)
        } else {
          // 고값(8~10) 카드 생성 (50%)
          const elemIdx = Math.floor(rngRoll2.value * elements.length) % elements.length
          const highVal = 8 + Math.floor((rngRoll2.value * 10) % 3)  // 8, 9, 또는 10
          bonusCard = {
            id: `pyeonjae-bonus-${state.attackCount}`,
            element: elements[elemIdx],
            polarity: 'yang',
            value: highVal,
            type: 'soldier',
            rarity: 'rare',
          }
        }
        newHand = [...newHand, bonusCard]
      }
    }
  }

  // T17: passiveHealBonus (편재 구버전 — v2에서는 0이므로 무해)
  if (passiveHealBonus > 0) {
    finalPlayerHp = Math.min(state.playerMaxHp, finalPlayerHp + passiveHealBonus)
  }

  // T22 진단 로그 — 출수 후 상태 (카드 총합 검증용)
  if (typeof window !== 'undefined') {
    const afterDeck = newDeck.length
    const afterDiscard = reshuffled ? 0 : newDiscardPile.length
    const afterHand = newHand.length
    const total = afterDeck + afterDiscard + afterHand
    console.log(
      `[T22-DIAG] 출수 후` +
      ` | 덱: ${afterDeck}장` +
      ` | 버린패: ${afterDiscard}장` +
      ` | 손패: ${afterHand}장` +
      ` | 합계: ${total}장` +
      (reshuffled ? ' [재순환 발동]' : '')
    )
  }

  // 배치 2 §1: 비견(比肩) v2 복제타 — 적 HP에 추가 적용 (반격 없음)
  // bigyeonCopyDamage: 패시브 루프에서 계산됨 (첫 융합 시 공격damage의 50%)
  if (bigyeonCopyDamage > 0 && !floorCleared) {
    newEnemyHp = Math.max(0, newEnemyHp - bigyeonCopyDamage)
    // 복제타로 클리어된 경우에도 floorCleared 갱신
  }
  const floorClearedFinal = newEnemyHp <= 0
  // 복제타로 인한 phase 재계산
  let finalPhase = phase
  let finalIsVictory = isVictory
  let finalFloorsCleared = floorsCleared
  if (!floorCleared && floorClearedFinal && bigyeonCopyDamage > 0) {
    finalFloorsCleared = state.floorsCleared + 1
    if (state.currentFloor >= 4) {
      finalPhase = 'result'
      finalIsVictory = true
    } else {
      finalPhase = 'floor-reward'
    }
  }

  // 배치 2 §1: 편관(偏官) v2 — 추가 출수권: newPlaysLeft +1 (이번 공격 차감 상쇄)
  const finalPlaysLeft = pyeongwanExtraPlay ? newPlaysLeft + 1 : newPlaysLeft
  // isLastAttack 재계산
  const finalIsLastAttack = finalPlaysLeft === 1

  return {
    ...state,
    enemyHp: newEnemyHp,
    playerHp: finalPlayerHp,
    hand: newHand,
    deck: newDeck,
    discardPile: reshuffled ? [] : newDiscardPile,
    selectedCards: [],
    playsLeft: finalPlaysLeft,
    phase: finalPhase,
    isVictory: finalIsVictory,
    floorsCleared: finalFloorsCleared,
    amplifyActive: false,  // 증폭부 1회 소모
    attackCount: newAttackCount,
    enemyPhaseSwitch: newEnemyPhaseSwitch,
    condenseActive: newCondenseActive,         // deprecated, 항상 false
    // Phase 1.9.5: 신규 필드
    yeonhwanUsed: newYeonhwanUsed,
    condensedMultiplier: newCondensedMultiplier,
    isLastAttack: finalIsLastAttack,
    lastTraitTriggered: newLastTraitTriggered,
    carryoverBurn: newCarryoverBurn,
    // B1-1: 잔불 지속 피해 상태
    emberDamagePerTurn: newEmberDamagePerTurn,
    emberTurnsLeft: newEmberTurnsLeft,
    // R10: 3종 융합 특성 상태
    purifiedElements: newPurifiedElements,
    purificationImmune: newPurificationImmune,
    keenActive: newKeenActive,
    mirrorShieldActive: newMirrorShieldActive,
    // 배치 2 §1: 편관(偏官) v2 턴당 1회 발동 제한
    pyeongwanActivationsThisTurn: newPyeongwanActivationsThisTurn,
    // Phase 1.9.4: 덱 재순환 배너용 플래그
    reshuffled,
    // 상관 발동 횟수 업데이트 (통계용)
    sanggwanUsed: newSanggwanUsed,
    // sikshin D안: 하위 호환 false
    sikshinDiscardBonus: false,
    // 겁재 첫 공격 소비 여부
    geoptaeUsed: newGeoptaeUsed,
    // 배치 1.5: 강림제 상태 전달
    yongsinDescent: newYongsinDescent,
    // α 수확 체감: gather5 활성화 횟수 업데이트
    gatherUsedInBattle: newGatherUsedInBattle,
    // 배치 2 §1: 가호 v2 신규 필드
    rngState: newRngState,
    geoptaeStealDamage: newGeoptaeUsed ? 0 : (state.geoptaeStealDamage ?? 0),  // 소비 후 0
    sikshinRicegrains: newSikshinRicegrains,
    bigyeonCopyUsed: newBigyeonCopyUsed,
    jeonginUsed: newJeonginUsed,
    jeonginBuff: newJeonginBuff,
  }
}

/** 버리기 실행 */
export function discardCards(state: GameState, cardIds: string[]): GameState {
  if (state.discardsLeft <= 0) return state

  // B1-4: 1회 버리기당 최대 3장 초과 시 throw (명시적 거부)
  // UI는 4장 선택 자체를 사전 차단(BattleScreen L2053)하므로 유저가 이 경로에 도달할 일은 없다.
  // 봇은 이 throw를 상위에서 catch. 조용한 return state 금지 (8e444af clamp 회귀 근절).
  if (cardIds.length > MAX_DISCARD_PER_USE) {
    throw new Error(`discardCards 거부: ${cardIds.length}장 > MAX_DISCARD_PER_USE(${MAX_DISCARD_PER_USE})`)
  }
  const discarded = state.hand.filter(c => cardIds.includes(c.id))
  const remainHand = state.hand.filter(c => !cardIds.includes(c.id))

  // Phase 1.9.4: 덱 부족 시 재순환 (버리기도 동일 불변 조건 적용)
  const newDiscardPile = [...state.discardPile, ...discarded]
  let newDeck = [...state.deck]
  let reshuffled = false
  if (newDeck.length < discarded.length) {
    const allCards = [...newDeck, ...newDiscardPile]
    newDeck = shuffleDeck(allCards)
    reshuffled = true
  }
  const drawnCards: Card[] = []
  for (let i = 0; i < discarded.length && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }

  // C10(d): 탁수령(水) — 버리기 1회당 플레이어 피해 3
  const gimmicks = getFloorGimmicks(state.currentFloor)
  const punishGimmick = gimmicks.find(g => g.type === 'discard-punish')
  const punishDamage = (punishGimmick && punishGimmick.type === 'discard-punish')
    ? punishGimmick.damage
    : 0

  // T8: 유물 — 목탁: 버리기 사용 시 HP 2 회복
  const hasMoktag = (state.relics ?? []).some(r => r.id === 'moktag')
  const moktangHeal = hasMoktag ? MOKTAG_DISCARD_HEAL : 0

  const newPlayerHp = Math.min(
    state.playerMaxHp,
    Math.max(0, state.playerHp - punishDamage + moktangHeal)
  )

  // 배치 2 §1 식신(食神) v2: 버린 카드 수만큼 sikshinRicegrains 증가
  const activeIds = state.activePassiveIds ?? []
  const newSikshinRicegrains = activeIds.includes('sikshin')
    ? (state.sikshinRicegrains ?? 0) + discarded.length
    : (state.sikshinRicegrains ?? 0)

  // sikshin D안 하위 호환 (v2에서는 사용 안 함, false 유지)
  const newSikshinDiscardBonus = false

  return {
    ...state,
    hand: [...remainHand, ...drawnCards],
    deck: newDeck,
    discardPile: reshuffled ? [] : newDiscardPile,
    selectedCards: [],
    discardsLeft: state.discardsLeft - 1,
    playerHp: newPlayerHp,
    reshuffled,
    sikshinDiscardBonus: newSikshinDiscardBonus,
    sikshinRicegrains: newSikshinRicegrains,
  }
}

// --------------- Phase 1.6 B — 부적술 발동 함수 ---------------

/**
 * 정화부(淨化符) 발동: 무덤 맨 위 카드 최대 3장을 손으로 복구
 */
export function activateJeonghwa(state: GameState): GameState {
  if (!state.talismans.includes('jeonghwa')) return state
  if (state.discardPile.length === 0) return state

  const recoverCount = Math.min(3, state.discardPile.length)
  const recovered = state.discardPile.slice(-recoverCount)
  const newDiscard = state.discardPile.slice(0, state.discardPile.length - recoverCount)
  const newHand = [...state.hand, ...recovered]
  const newTalismans = state.talismans.filter(id => id !== 'jeonghwa')

  return {
    ...state,
    hand: newHand,
    discardPile: newDiscard,
    talismans: newTalismans,
  }
}

/**
 * 환패부(換牌符) 발동: 핸드 전체를 버리고 덱에서 같은 수만큼 다시 뽑음
 */
export function activateHwanpae(state: GameState): GameState {
  if (!state.talismans.includes('hwanpae')) return state

  const handSize = state.hand.length
  const newDiscard = [...state.discardPile, ...state.hand]
  const newDeck = [...state.deck]
  const drawnCards: Card[] = []
  for (let i = 0; i < handSize && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }
  const newTalismans = state.talismans.filter(id => id !== 'hwanpae')

  return {
    ...state,
    hand: drawnCards,
    deck: newDeck,
    discardPile: newDiscard,
    talismans: newTalismans,
  }
}

/**
 * 증폭부(增幅符) 발동: 다음 공격 데미지 ×2 버프 활성화
 */
export function activateJeungpok(state: GameState): GameState {
  if (!state.talismans.includes('jeungpok')) return state
  const newTalismans = state.talismans.filter(id => id !== 'jeungpok')
  return {
    ...state,
    talismans: newTalismans,
    amplifyActive: true,
  }
}

/**
 * 부적 획득: 부적 id를 talismans 목록에 추가
 */
export function acquireTalisman(state: GameState, talismanId: string): GameState {
  if (state.talismans.includes(talismanId)) return state  // 중복 불가
  return {
    ...state,
    talismans: [...state.talismans, talismanId],
  }
}

// --------------- 다음 층으로 전환 ---------------

/** 다음 층으로 전환 */
export function advanceToNextFloor(state: GameState): GameState {
  const nextFloor = state.currentFloor + 1
  if (nextFloor > 4) {
    return { ...state, phase: 'result', isVictory: true }
  }
  const floorConfig = FLOOR_CONFIGS[nextFloor - 1]
  // 영속 덱 유지: 기존 hand + deck + discardPile 전체를 셔플해 재배분
  const allCards = [...state.hand, ...state.deck, ...state.discardPile]
  const deck = shuffleDeck(allCards.length > 0 ? allCards : createFixedDeck())
  const hand = deck.slice(0, HAND_SIZE)
  const remainDeck = deck.slice(HAND_SIZE)
  // v4 모드 시 V4_FLOOR_HP_TABLE 주입, 그 외 floorConfig.enemyHp 유지
  const nextEnemyHp = getFloorHp(nextFloor - 1)

  // 배치 2 §1: 겁재(劫財) 전투 시작 훅 — 층 전환 시 새 전투 시작
  // activePassiveIds 기준으로 겁재 보유 여부 확인 후 RNG 굴림
  let nextRngState = state.rngState ?? 0x9E3779B9
  let nextGeoptaeStealDamage = 0
  let nextGeoptaeUsed = false
  let nextPlayerHp = state.playerHp
  const activeIdsForFloor = state.activePassiveIds ?? []
  if (activeIdsForFloor.includes('geoptae')) {
    const rngRoll = nextRng(nextRngState)
    nextRngState = rngRoll.next
    if (rngRoll.value >= 0.25) {
      // 성공: 첫 공격 가산 = round(enemyMaxHp * 0.08)
      nextGeoptaeStealDamage = Math.round(nextEnemyHp * 0.08)
    } else {
      // 실패: playerHp -= 5 (0 하한)
      nextPlayerHp = Math.max(0, nextPlayerHp - 5)
    }
  }

  return {
    ...state,
    currentFloor: nextFloor,
    playerHp: nextPlayerHp,
    enemyHp: nextEnemyHp,
    enemyMaxHp: nextEnemyHp,
    hand,
    deck: remainDeck,
    discardPile: [],
    selectedCards: [],
    discardsLeft: BASE_DISCARDS,
    playsLeft: floorConfig.maxPlays,
    phase: 'select',
    attackCount: 0,
    enemyPhaseSwitch: false,
    condenseActive: false,
    // Phase 1.9.5: 층 전환 시 리셋
    yeonhwanUsed: false,
    // 상관 발동 횟수 — 하위 호환 유지
    sanggwanUsed: state.sanggwanUsed ?? 0,
    // 겁재: 층마다 리셋 (새 전투 시 재발동)
    geoptaeUsed: nextGeoptaeUsed,
    condensedMultiplier: 0,
    isLastAttack: floorConfig.maxPlays === 1,
    lastTraitTriggered: undefined,
    carryoverBurn: 0,
    // B1-1: 잔불 지속 피해 — 층 전환 시 리셋
    emberDamagePerTurn: 0,
    emberTurnsLeft: 0,
    // R10: 층 전환 시 리셋
    purifiedElements: [],
    keenActive: false,
    mirrorShieldActive: false,
    reshuffled: false,
    // 스펙 v2: 용신 원소 유지 (층 전환해도 동일 플레이어)
    favorableElement: state.favorableElement,
    // Phase 1.9.6: 유물 유지 (런 동안 누적)
    relics: state.relics,
    // T17: 가호 유지 (런 동안 유지)
    activePassiveIds: state.activePassiveIds ?? [],
    // sikshin D안: 층 전환 시 리셋
    sikshinDiscardBonus: false,
    // α 수확 체감: 층 전환 시 리셋 (새 전투 시작)
    gatherUsedInBattle: 0,
    // 배치 2 §1: 가호 v2 신규 필드
    rngState: nextRngState,
    geoptaeStealDamage: nextGeoptaeStealDamage,
    sikshinRicegrains: 0,         // 층마다 리셋
    bigyeonCopyUsed: false,       // 층마다 리셋
    jeonginUsed: state.jeonginUsed ?? false,  // 런 유지
    jeonginBuff: state.jeonginBuff ?? false,  // 이월 (미소비 시 유지)
  }
}

// --------------- Phase 1.9.2 신규 함수 ---------------

/**
 * 응축 발동 가능 여부 판별 (Phase 1.9.5 확정판 — 옹기가마 전용)
 * 반환: 'great' = 응축 가능(옹기가마), null = 응축 불가
 */
export function getCondenseAvailability(
  comboName: string | undefined,
  finishingElement: string,
): 'great' | null {
  // A-1 (2026-07-16): recipe 모드에서는 v3 응축(옹기가마 효과) 경로 봉쇄.
  // recipe 모드의 옹기가마는 fusion_kiln 레시피로 판정되므로 v3 응축 판정 참조 제거.
  if (COMBO_RULESET_VERSION === 'recipe') return null
  if (finishingElement !== 'to') return null
  if (!comboName) return null
  // v4 prefix('소', '대') 제거 후 조합명 비교 (v4 2/5장은 prefix 붙음)
  const baseComboName = (comboName.startsWith('소') || comboName.startsWith('대'))
    ? comboName.slice(1)
    : comboName
  if (baseComboName === '옹기가마') return 'great'
  return null
}

/**
 * 응축 확정판 적용 함수 (T1 — 옹기가마 전용, 화/토 매트릭스)
 * - 공격 횟수 1회 소모 (playsLeft -1)
 * - 실제 피해 0, condensedMultiplier = 화/토 조합 비례 배율 설정
 * - 중첩 불가 (이미 응축 활성 시 무시)
 * - 마지막 공격 기회(isLastAttack)에는 적용 불가
 *
 * R5 (balance-v3 §3): synergyMultiplier 파라미터 추가.
 * 응축 실효 배율 = (bonusPercent / 100) × synergyMultiplier
 * 호출부에서 용신·가호 시너지 배율을 전달; 기본값 1.0 (시너지 없음)
 */
export function applyCondense(state: GameState, cardIds: string[], synergyMultiplier = 1.0): GameState {
  // 마지막 공격 기회에는 응축 불가
  if (state.isLastAttack) return state
  // 중첩 불가
  if ((state.condensedMultiplier ?? 0) > 0) return state
  // 공격 횟수 없으면 불가
  if (state.playsLeft <= 0) return state

  // T22 진단 로그 — 응축 사용 시 카드 행방 추적
  if (typeof window !== 'undefined') {
    console.log(
      `[T22-DIAG][응축] 사용 전` +
      ` | 덱: ${state.deck.length}장` +
      ` | 버린패: ${state.discardPile.length}장` +
      ` | 손패: ${state.hand.length}장` +
      ` | 응축대상: ${cardIds.length}장` +
      ` → 향후전투 복귀(discardPile 경유 재순환)`
    )
  }

  // 카드 소진 + 리필 (공격과 동일)
  const condensedCards = state.hand.filter(c => cardIds.includes(c.id))
  const remainHand = state.hand.filter(c => !cardIds.includes(c.id))

  // T1: 화/토 개수 계산
  const hwaCount = condensedCards.filter(c => c.element === 'hwa').length
  const toCount = condensedCards.filter(c => c.element === 'to').length
  const bonusPercent = getCondenseBonus(hwaCount, toCount)
  if (bonusPercent === 0) return state  // 유효한 조합 아님

  // R5 (balance-v3 §3): 응축 실효 배율 = 화/토 매트릭스 % × synergyMultiplier
  // synergyMultiplier = 1.0이면 기존 동작과 동일
  const multiplier = (bonusPercent / 100) * synergyMultiplier

  const newPlaysLeft = state.playsLeft - 1

  // 덱 부족 시 재순환
  const newDiscardPile = [...state.discardPile, ...condensedCards]
  let newDeck = [...state.deck]
  if (newDeck.length < condensedCards.length) {
    const allCards = [...newDeck, ...newDiscardPile]
    newDeck = shuffleDeck(allCards)
  }
  const drawnCards: Card[] = []
  for (let i = 0; i < condensedCards.length && newDeck.length > 0; i++) {
    drawnCards.push(newDeck.shift()!)
  }
  const newHand = [...remainHand, ...drawnCards]

  return {
    ...state,
    hand: newHand,
    deck: newDeck,
    discardPile: newDiscardPile,
    playsLeft: newPlaysLeft,
    selectedCards: [],
    condensedMultiplier: multiplier,
    isLastAttack: newPlaysLeft === 1,
    lastTraitTriggered: 'yonggigama',
    reshuffled: false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 층 보상 (3택) — 영속 덱 적용
// ─────────────────────────────────────────────────────────────────────────────

export type RewardOption =
  | { type: 'add-card'; card: Card }
  | { type: 'upgrade-card'; targetId: string; bonusPct: number }
  | { type: 'remove-card'; targetId: string }
  | { type: 'add-relic'; relic: any }

export function applyRewardOption(deck: Card[], option: RewardOption): Card[] {
  switch (option.type) {
    case 'add-card':
      return [...deck, option.card]
    case 'upgrade-card':
      return deck.map(c =>
        c.id === option.targetId
          ? { ...c, value: Math.round(c.value * (1 + option.bonusPct / 100)) }
          : c
      )
    case 'remove-card':
      return deck.filter(c => c.id !== option.targetId)
    case 'add-relic':
      return deck  // relics are handled separately in GameState
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 배치 1.5: 용신 강림제 (yongsinDescent)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 강림제 상태 초기화
 * 출정 시작 시 강림 슬롯을 사전 결정 (비공개)
 */
export function initYongsinDescent(
  heroProfile: SavedHeroProfile | null | undefined,
  floorIndex: number,
): {
  descentCount: number
  slots: number[]
  usedCount: number
  pendingDescent: boolean
  yongsinAttackCount?: number
} {
  if (!ENABLE_YONGSIN_DESCENT) {
    return { descentCount: 0, slots: [], usedCount: 0, pendingDescent: false }
  }

  const seed = heroProfile?.deckSeed || 12345
  const hash = simpleHash(JSON.stringify(heroProfile) + seed + floorIndex)

  // 2~3회 강림
  const descentCount = 2 + (hash % 2)
  // 18턴 중 슬롯 위치 결정
  const slots = generateDescentSlots(hash, descentCount, 18)

  return {
    descentCount,
    slots,
    usedCount: 0,
    pendingDescent: false,
    yongsinAttackCount: 0,  // B-1: 용신 공격 카운터 초기화
  }
}

/**
 * 간단한 해시 함수 (SHA256 대체)
 * 일진 + 시드 + 층수 기반 난수 생성
 */
function simpleHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash  // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * 강림 슬롯 생성 함수
 * 해시값으로부터 2~3개의 슬롯 위치 결정
 */
function generateDescentSlots(hash: number, count: number, maxTurns: number): number[] {
  const slots: number[] = []
  let seed = hash

  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const slotIndex = seed % maxTurns
    slots.push(slotIndex)
  }

  return slots.sort((a, b) => a - b)
}

/**
 * 강림 발동 함수 — 3가지 변형 지원 (§4-b 정의 정본, 2026-07-15)
 * 'slot' (0단계): 2~3 슬롯 × ×2.0, 1턴 이월/소멸
 * 'wait3' (B-1 대기창): 슬롯 도래 → 3공격 대기, 창 내 용신 → ×2.0. 슬롯 귀속, 카운터제 아님.
 * 'dual' (B-2 이원): 슬롯 도래 즉시 발동, 용신 ×2.5 / 미포함 ×1.5. 슬롯 소비형, 비슬롯 보너스 없음.
 *
 * E2E 지문: 모든 변형은 descentState.slots.includes(currentTurn)으로 슬롯 참조 (§4 불변)
 */
export function applyYongsinDescent(
  damage: number,
  hasYongsin: boolean,
  currentTurn: number,
  descentState: GameState['yongsinDescent'],
): { damage: number; descended: boolean; updatedState: GameState['yongsinDescent'] } {
  if (!ENABLE_YONGSIN_DESCENT || !descentState) {
    return { damage, descended: false, updatedState: descentState }
  }

  let newState = { ...descentState }
  const variant = DESCENT_VARIANT

  // ─── 변형 1: slot (0단계 기본) ─────────────────────────────────────
  if (variant === 'slot') {
    const isDescentSlot = descentState.slots.includes(currentTurn)
    if (!isDescentSlot) {
      // 이월 상태에서 비슬롯 턴: 1회 이월 소비
      if (newState.pendingDescent) {
        if (hasYongsin) {
          // 이월 턴에서 용신 → 발동
          newState.pendingDescent = false
          newState.usedCount++
          damage = Math.round(damage * 2.0)
          return { damage, descended: true, updatedState: newState }
        } else {
          // 이월 턴에서 미포함 → 소멸
          newState.pendingDescent = false
          return { damage, descended: false, updatedState: newState }
        }
      }
      return { damage, descended: false, updatedState: newState }
    }

    if (!hasYongsin) {
      // 슬롯 도래 + 미포함 → 1턴 이월 개시
      newState.pendingDescent = true
      return { damage, descended: false, updatedState: newState }
    }

    // 슬롯 도래 + 용신 → 즉시 발동
    newState.pendingDescent = false
    newState.usedCount++
    damage = Math.round(damage * 2.0)
    return { damage, descended: true, updatedState: newState }
  }

  // ─── 변형 2: wait3 (B-1 대기창) ────────────────────────────────────
  // §4-b: 슬롯 도래 → 최대 3공격 대기. 창 내 용신 → ×2.0. 3공격 경과 → 소멸.
  // 카운터제 아님 — 슬롯당 1회, 대기는 슬롯에 귀속.
  if (variant === 'wait3') {
    const isDescentSlot = descentState.slots.includes(currentTurn)  // E2E 지문: 슬롯 참조

    // 1) 슬롯 도래: 대기창 개시
    if (isDescentSlot && !newState.pendingDescent) {
      newState.pendingDescent = true
      newState.waitWindowRemaining = DESCENT_WAIT_WINDOW  // 3

      if (hasYongsin) {
        // 슬롯 턴 자체에서 용신 → 즉시 발동, 창 닫힘
        newState.pendingDescent = false
        newState.waitWindowRemaining = 0
        newState.usedCount++
        damage = Math.round(damage * 2.0)
        return { damage, descended: true, updatedState: newState }
      }

      // 슬롯 턴 용신 없음 → 대기창 개시, 남은 2공격
      newState.waitWindowRemaining = (newState.waitWindowRemaining ?? DESCENT_WAIT_WINDOW) - 1
      return { damage, descended: false, updatedState: newState }
    }

    // 2) 대기창 활성 중 (비슬롯 턴)
    if (newState.pendingDescent && (newState.waitWindowRemaining ?? 0) > 0) {
      if (hasYongsin) {
        // 대기 중 용신 → 발동, 창 닫힘
        newState.pendingDescent = false
        newState.waitWindowRemaining = 0
        newState.usedCount++
        damage = Math.round(damage * 2.0)
        return { damage, descended: true, updatedState: newState }
      }

      // 용신 없음 → 잔여 감소
      newState.waitWindowRemaining = (newState.waitWindowRemaining ?? 0) - 1
      if (newState.waitWindowRemaining <= 0) {
        // 3공격 경과 → 소멸 ("기운이 스쳐 지나갔다")
        newState.pendingDescent = false
        newState.waitWindowRemaining = 0
      }
      return { damage, descended: false, updatedState: newState }
    }

    return { damage, descended: false, updatedState: newState }
  }

  // ─── 변형 3: dual (B-2 이원) ──────────────────────────────────────
  // §4-b: 슬롯 도래 즉시 발동 — 용신 ×2.5 / 미포함 ×1.5. 슬롯 소비형.
  // 비슬롯 턴 보너스 일절 없음.
  if (variant === 'dual') {
    const isDescentSlot = descentState.slots.includes(currentTurn)  // E2E 지문: 슬롯 참조

    if (!isDescentSlot) {
      // 비슬롯 턴: 일절 보너스 없음 (§4-b 확정)
      return { damage, descended: false, updatedState: newState }
    }

    // 슬롯 도래: 즉시 소비
    newState.usedCount++
    if (hasYongsin) {
      // 용신 포함: ×2.5
      damage = Math.round(damage * DESCENT_DUAL_SLOT_MULT)
      return { damage, descended: true, updatedState: newState }
    } else {
      // 미포함: ×1.5 약강림 (슬롯 소비됨)
      damage = Math.round(damage * DESCENT_DUAL_NONSLOT_MULT)
      return { damage, descended: true, updatedState: newState }
    }
  }

  // ─── 변형 4: glow (B-3 잔광, 2026-07-16) ─────────────────────────────
  // §4-b 개정: 슬롯 도래 3공격 대기, 용신 ×1.8 풀강림 / 만료 시 ×1.25 잔광.
  // 슬롯당 정확히 1결과 (풀강림 또는 잔광), 소멸 개념 제거.
  if (variant === 'glow') {
    const isDescentSlot = descentState.slots.includes(currentTurn)  // E2E 지문: 슬롯 참조

    // 1) 슬롯 도래: 대기창 개시
    if (isDescentSlot && !newState.pendingDescent) {
      newState.pendingDescent = true
      newState.waitWindowRemaining = DESCENT_WAIT_WINDOW  // 3

      if (hasYongsin) {
        // 슬롯 턴 자체에서 용신 → 풀강림 ×1.8 발동, 창 닫힘
        newState.pendingDescent = false
        newState.waitWindowRemaining = 0
        newState.usedCount++
        damage = Math.round(damage * DESCENT_GLOW_FULL_MULT)
        return { damage, descended: true, updatedState: newState }
      }

      // 슬롯 턴 용신 없음 → 대기창 개시, 남은 2공격
      newState.waitWindowRemaining = (newState.waitWindowRemaining ?? DESCENT_WAIT_WINDOW) - 1
      return { damage, descended: false, updatedState: newState }
    }

    // 2) 대기창 활성 중 (비슬롯 턴)
    if (newState.pendingDescent && (newState.waitWindowRemaining ?? 0) > 0) {
      if (hasYongsin) {
        // 대기 중 용신 → 풀강림 ×1.8 발동, 창 닫힘
        newState.pendingDescent = false
        newState.waitWindowRemaining = 0
        newState.usedCount++
        damage = Math.round(damage * DESCENT_GLOW_FULL_MULT)
        return { damage, descended: true, updatedState: newState }
      }

      // 용신 없음 → 잔여 감소
      newState.waitWindowRemaining = (newState.waitWindowRemaining ?? 0) - 1
      if (newState.waitWindowRemaining <= 0) {
        // 3공격 경과 → 잔광 ×1.25 부여 (대신 소멸 제거, E2E 지문)
        newState.pendingDescent = false
        newState.waitWindowRemaining = 0
        damage = Math.round(damage * DESCENT_GLOW_AFTERGLOW_MULT)
        newState.usedCount++
        return { damage, descended: false, updatedState: newState }
      }
      return { damage, descended: false, updatedState: newState }
    }

    return { damage, descended: false, updatedState: newState }
  }

  return { damage, descended: false, updatedState: newState }
}
