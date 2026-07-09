/**
 * stsBattleStore — STS 전투 상태 관리 (Zustand)
 * Phase 4 신규 파일 — stsTypes.ts 기반
 *
 * 의존성:
 *   - stsEngine.ts : playCard, endPlayerTurn, startEnemyTurn, endEnemyTurn, startPlayerTurn
 *   - stsTypes.ts  : BattleState, EnemyDef, CardInstance, CardDef, DamagePopup
 */

import { create } from 'zustand'
import type { BattleState, EnemyDef, CardInstance, CardDef, DamagePopup } from '@/types/stsTypes'
import type { FiveElement } from '@/types/elements'
import { shuffleDeck } from '@/game/engine/deckCycle'
import {
  playCard as enginePlayCard,
  endPlayerTurn,
  startEnemyTurn,
  endEnemyTurn,
  startPlayerTurn,
  registerCardDefs,
} from '@/game/engine/stsEngine'
import { executeEnemyTurn } from '@/game/engine/enemyEngine'

// ─── 팝업 카운터 ─────────────────────────────────────

let _popupId = 0
function makePopupId(): string {
  return `popup_${Date.now()}_${_popupId++}`
}

// ─── Store 인터페이스 ─────────────────────────────────

export interface STSBattleStore {
  state: BattleState | null
  /** 데미지 팝업 (GSAP VFX용) */
  damagePopups: DamagePopup[]
  /** 타겟 선택 모드 — 타겟 필요 카드 선택 중인 instanceId */
  targetingCardId: string | null

  /** 전투 초기화 */
  initBattle(
    heroElement: FiveElement,
    enemy: EnemyDef,
    deck: CardInstance[],
    cardDefs: CardDef[],
    heroHp?: number,
    heroMaxHp?: number,
  ): void

  /** 카드 사용 (즉시 — 타겟 불필요 카드) */
  playCard(instanceId: string): void

  /** 타겟 선택 모드 진입 */
  enterTargeting(instanceId: string): void

  /** 타겟 선택 모드 취소 */
  cancelTargeting(): void

  /** 타겟 선택 완료 → 카드 사용 */
  selectTarget(target: 'enemy'): void

  /** 턴 종료 */
  endTurn(): void

  /** 팝업 제거 */
  removePopup(id: string): void

  /** 스토어 초기화 */
  reset(): void
}

// ─── 팝업 생성 헬퍼 ──────────────────────────────────

function makePopup(
  amount: number,
  type: DamagePopup['type'],
  target: DamagePopup['target'],
): DamagePopup {
  const x = target === 'enemy' ? 50 + (Math.random() - 0.5) * 20 : 30 + (Math.random() - 0.5) * 10
  const y = target === 'enemy' ? 30 : 65
  return {
    id: makePopupId(),
    amount,
    type,
    target,
    x,
    y,
  }
}

// ─── 액션 로그 → 팝업 변환 ────────────────────────────

function extractPopups(prevState: BattleState, nextState: BattleState): DamagePopup[] {
  const popups: DamagePopup[] = []
  const prevLogLen = prevState.actionLog.length
  const newEntries = nextState.actionLog.slice(prevLogLen)

  for (const entry of newEntries) {
    if (entry.type === 'damage') {
      // "적에게 N 데미지" 또는 "플레이어에게 N 데미지"
      const enemyMatch = entry.message.match(/^적에게 (\d+) 데미지/)
      const playerMatch = entry.message.match(/^플레이어에게 (\d+) 데미지/)
      if (enemyMatch) {
        popups.push(makePopup(parseInt(enemyMatch[1], 10), 'damage', 'enemy'))
      } else if (playerMatch) {
        popups.push(makePopup(parseInt(playerMatch[1], 10), 'damage', 'player'))
      }
    } else if (entry.type === 'heal') {
      const healMatch = entry.message.match(/HP \+(\d+)/)
      if (healMatch) {
        popups.push(makePopup(parseInt(healMatch[1], 10), 'heal', 'player'))
      }
    } else if (entry.type === 'block') {
      const blockMatch = entry.message.match(/블록 \+(\d+)/)
      if (blockMatch) {
        const target: DamagePopup['target'] = entry.message.startsWith('플레이어') ? 'player' : 'enemy'
        popups.push(makePopup(parseInt(blockMatch[1], 10), 'block', target))
      }
    }
  }

  return popups
}

// ─── Zustand Store ───────────────────────────────────

export const useSTSBattleStore = create<STSBattleStore>((set, get) => ({
  state: null,
  damagePopups: [],
  targetingCardId: null,

  initBattle(heroElement, enemy, deck, cardDefs, heroHp = 80, heroMaxHp = 80) {
    // 카드 def 레지스트리 등록
    registerCardDefs(cardDefs)

    // 덱 셔플
    const shuffled = shuffleDeck(deck)

    // 초기 BattleState 구성
    const initialState: BattleState = {
      phase: 'init',
      turn: 0,
      player: {
        hp: heroHp,
        maxHp: heroMaxHp,
        block: 0,
        energy: 3,
        maxEnergy: 3,
        buffs: [],
        drawPile: shuffled,
        hand: [],
        discardPile: [],
        exhaustPile: [],
        relics: [],
        potions: [null, null, null],
        element: heroElement,
        gold: 0,
      },
      enemy: {
        def: enemy,
        hp: enemy.maxHp,
        maxHp: enemy.maxHp,
        block: 0,
        buffs: [],
        moveIndex: 0,
        currentIntent: enemy.moves[0]?.intent ?? { type: 'unknown' },
      },
      actionLog: [],
      lastPlayedElement: null,
      sameElementCount: 0,
    }

    // 플레이어 턴 시작 (5장 드로우 + 에너지 충전)
    const startedState = startPlayerTurn(initialState)
    set({ state: startedState, damagePopups: [], targetingCardId: null })
  },

  playCard(instanceId) {
    const { state, damagePopups } = get()
    if (!state || state.phase !== 'playerTurn') return

    const prevState = state
    const nextState = enginePlayCard(state, instanceId)

    // 팝업 생성
    const newPopups = extractPopups(prevState, nextState)

    set({
      state: nextState,
      damagePopups: [...damagePopups, ...newPopups],
      targetingCardId: null,
    })
  },

  enterTargeting(instanceId) {
    set({ targetingCardId: instanceId })
  },

  cancelTargeting() {
    set({ targetingCardId: null })
  },

  selectTarget(_target) {
    const { targetingCardId } = get()
    if (!targetingCardId) return
    get().playCard(targetingCardId)
  },

  endTurn() {
    const { state, damagePopups } = get()
    if (!state || state.phase !== 'playerTurn') return

    // 1. 플레이어 턴 종료
    let s = endPlayerTurn(state)

    // 2. 적 턴 시작
    s = startEnemyTurn(s)

    // 3. 적 Intent 실행 — enemyEngine.executeEnemyTurn 호출
    //    오행 상성(calculateDamage), strength/weak 버프, 디버프(독/취약) 모두 내부 처리
    const prevForPopup = s

    if (s.phase === 'enemyTurn') {
      s = executeEnemyTurn(s, [s.enemy.def])
    }

    const newPopups = extractPopups(prevForPopup, s)

    // 4. 적 턴 종료 (패배/승리가 아닌 경우)
    if (s.phase === 'enemyTurn') {
      s = endEnemyTurn(s)
      // 5. 다음 플레이어 턴 시작
      s = startPlayerTurn(s)
    }

    set({
      state: s,
      damagePopups: [...damagePopups, ...newPopups],
      targetingCardId: null,
    })
  },

  removePopup(id) {
    set(prev => ({
      damagePopups: prev.damagePopups.filter(p => p.id !== id),
    }))
  },

  reset() {
    set({ state: null, damagePopups: [], targetingCardId: null })
  },
}))
