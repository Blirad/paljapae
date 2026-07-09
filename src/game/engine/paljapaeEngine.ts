import type { PaljapaeCard, BattleState, HandResult, Element, RelicId, PassiveId } from '@/types/paljapaeTypes'
import { BALANCE } from '@/data/balance'
import { judgeHand, calcDamage, getDominateBonus } from '@/game/engine/pokerHandJudge'
import { getEnemyForFloor } from '@/data/paljapaeEnemies'

const ELEMENTS: Element[] = ['木', '火', '土', '金', '水']

// 간단한 seeded 랜덤 (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// 임시 덱 20장 생성 (고정 — 사주 시스템 없음)
// 5속성 × 음양 균형 배분, 값 시드 랜덤
export function createTempDeck(seed?: number): PaljapaeCard[] {
  const rand = mulberry32(seed ?? Date.now())
  const deck: PaljapaeCard[] = []

  // 5속성 × 음양 2 = 10종, 각 2장씩 = 20장
  for (const el of ELEMENTS) {
    for (const yy of ['양', '음'] as const) {
      for (let i = 0; i < 2; i++) {
        const value = Math.floor(rand() * 10) + 1
        deck.push({
          id: `${el}_${yy}_${i}_${Math.floor(rand() * 9999)}`,
          element: el,
          yinYang: yy,
          value,
        })
      }
    }
  }

  // 셔플 (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}

// 덱에서 n장 드로우 (핸드에 추가)
export function drawCards(state: BattleState, n: number): BattleState {
  const handSize = state.passives.includes('pyeonin')
    ? BALANCE.HAND_SIZE + 1
    : BALANCE.HAND_SIZE

  const canDraw = Math.min(n, handSize - state.hand.length)
  if (canDraw <= 0) return state

  let deck = [...state.deck]
  let discarded = [...state.discarded]

  // 덱 소진 시 버린 카드 재셔플
  if (deck.length < canDraw) {
    const combined = [...deck, ...discarded]
    // 간단 셔플
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]]
    }
    deck = combined
    discarded = []
  }

  const drawn = deck.splice(0, canDraw)
  return {
    ...state,
    hand: [...state.hand, ...drawn],
    deck,
    discarded,
  }
}

// 카드 선택/해제 (최대 5장)
export function toggleSelect(state: BattleState, cardId: string): BattleState {
  const isSelected = state.selected.includes(cardId)
  if (isSelected) {
    return { ...state, selected: state.selected.filter(id => id !== cardId) }
  }
  if (state.selected.length >= 5) return state
  return { ...state, selected: [...state.selected, cardId] }
}

// 출수 실행 (족보 판정 → 피해 계산 → 상태 업데이트)
export function playHand(state: BattleState): {
  newState: BattleState
  handResult: HandResult
  damageDealt: number
  dominateApplied: boolean
} {
  if (state.selected.length === 0 || state.playsLeft <= 0) {
    return {
      newState: state,
      handResult: { rank: 'none', baseDamage: 0, multiplier: 1 },
      damageDealt: 0,
      dominateApplied: false,
    }
  }

  const selectedCards = state.hand.filter(c => state.selected.includes(c.id))
  const handResult = judgeHand(selectedCards)

  // 호리병 패시브: 체력 30 이하일 때 배율 +1 적용 위해 relics에 체크
  // calcDamage 내부에서 holibyeong relic을 확인하나,
  // 실제로는 현재 HP가 30 이하일 때만 적용
  const effectiveRelics = [...state.relics]
  const holiIdx = effectiveRelics.indexOf('holibyeong')
  if (holiIdx !== -1 && state.playerHp > 30) {
    // HP가 30 초과이면 호리병 효과 제거
    effectiveRelics.splice(holiIdx, 1)
  }

  const damageDealt = calcDamage(
    selectedCards,
    handResult,
    state.enemyElement,
    state.dayElement,
    effectiveRelics,
    state.passives
  )

  const dominateApplied = getDominateBonus(
    selectedCards.map(c => c.element),
    state.enemyElement
  ) > 0

  // 낸 카드를 핸드에서 제거, 버린 카드로 이동
  const remainingHand = state.hand.filter(c => !state.selected.includes(c.id))
  const newDiscarded = [...state.discarded, ...selectedCards]

  const newEnemyHp = Math.max(0, state.enemyHp - damageDealt)

  let newState: BattleState = {
    ...state,
    hand: remainingHand,
    discarded: newDiscarded,
    selected: [],
    enemyHp: newEnemyHp,
    playsLeft: state.playsLeft - 1,
    score: state.score + damageDealt,
  }

  // 겁재 패시브: 버린 카드 1장당 다음 출수 기본치 +2 → 이 효과는 pokerHandJudge에서 직접 처리 불가
  // 임의 결정: 겁재 효과는 score 보너스로 근사 처리 (다음 출수의 baseDamage 보너스는 store에서 관리)

  // 카드 드로우 (낸 만큼)
  newState = drawCards(newState, selectedCards.length)

  return { newState, handResult, damageDealt, dominateApplied }
}

// 버리기 실행
export function discardSelected(state: BattleState): BattleState {
  // 상관 패시브: 버리기 +1회 → initFloor에서 discardsLeft에 반영
  const maxDiscards = state.passives.includes('sangkwan')
    ? BALANCE.DISCARD_LIMIT + 1
    : BALANCE.DISCARD_LIMIT

  if (state.selected.length === 0 || state.discardsLeft <= 0) return state
  // 한 번에 선택된 카드 전부 버리기 (1회 차감)
  if (state.discardsLeft > maxDiscards) return state

  const discardedCards = state.hand.filter(c => state.selected.includes(c.id))
  const remainingHand = state.hand.filter(c => !state.selected.includes(c.id))

  let newState: BattleState = {
    ...state,
    hand: remainingHand,
    discarded: [...state.discarded, ...discardedCards],
    selected: [],
    discardsLeft: state.discardsLeft - 1,
  }

  // 드로우 (버린 만큼)
  newState = drawCards(newState, discardedCards.length)

  return newState
}

// 층 초기화 (다음 적과 전투 준비)
export function initFloor(
  floor: number,
  dayElement: Element,
  relics: RelicId[],
  passives: PassiveId[]
): BattleState {
  const floorIdx = Math.min(floor - 1, BALANCE.FLOORS.length - 1)
  const floorConfig = BALANCE.FLOORS[floorIdx]
  const enemyDef = getEnemyForFloor(floor)

  const deck = createTempDeck()
  let playerMaxHp = BALANCE.PLAYER_HP

  // 상관 패시브: 최대 체력 -10
  if (passives.includes('sangkwan')) {
    playerMaxHp -= 10
  }

  let discardsLeft = BALANCE.DISCARD_LIMIT
  if (passives.includes('sangkwan')) {
    discardsLeft += 1
  }

  const initialState: BattleState = {
    floor,
    hand: [],
    deck,
    discarded: [],
    selected: [],
    playerHp: playerMaxHp,
    playerMaxHp,
    enemyHp: floorConfig.enemyHp,
    enemyMaxHp: floorConfig.enemyHp,
    enemyName: enemyDef.name,
    enemyElement: enemyDef.element,
    playsLeft: floorConfig.playsAllowed,
    discardsLeft,
    dayElement,
    relics,
    passives,
    score: 0,
  }

  // 초기 핸드 드로우
  const handSize = passives.includes('pyeonin')
    ? BALANCE.HAND_SIZE + 1
    : BALANCE.HAND_SIZE
  return drawCards(initialState, handSize)
}

// 패시브 효과 적용
export function applyPassiveEffects(
  state: BattleState,
  trigger: 'onPlay' | 'onDiscard' | 'onFloorStart'
): BattleState {
  let newState = { ...state }

  if (trigger === 'onFloorStart') {
    // 편인: 핸드 크기 8 → 9 (initFloor에서 이미 처리)
    // 상관: 버리기 +1회 (initFloor에서 이미 처리)
  }

  return newState
}

// 랜덤 패시브 2개 선택
export function pickRandomPassives(count: number = 2): PassiveId[] {
  const all: PassiveId[] = ['sikshin', 'bigyeon', 'geobje', 'sangkwan', 'pyeonjae', 'jeongjae', 'pyeonin']
  const shuffled = [...all].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// 랜덤 유물 1개 선택
export function pickRandomRelic(): RelicId {
  const all: RelicId[] = ['pacheol', 'ochsaek', 'haetae', 'holibyeong']
  return all[Math.floor(Math.random() * all.length)]
}

// 랜덤 일진 속성 선택
export function pickRandomDayElement(): Element {
  return ELEMENTS[Math.floor(Math.random() * 5)]
}

// 보스/적 반격 피해 계산
export function calcRetaliation(floor: number, relics: RelicId[]): number {
  const floorIdx = Math.min(floor - 1, BALANCE.FLOORS.length - 1)
  let dmg: number = BALANCE.FLOORS[floorIdx].retaliation as number
  if (relics.includes('haetae')) dmg = Math.max(0, dmg - 3)
  return dmg
}
