/**
 * 배틀 전용 Zustand 스토어 — M3
 * 인터랙션 상태 머신, 애니메이션 큐, AI 행동 큐 관리
 */

import { create } from 'zustand'
import type { GameState, PlayerState, HeroId } from '@/types/game'
import {
  HEROES,
  HERO_MAX_HP,
  ENERGY_CAP,
} from '@/types/game'
import { getDailyElement } from '@/game/saju/manseryeok'
import type { FiveElement } from '@/types/elements'
import type { Card, FieldUnit } from '@/types/cards'
import { createInitialFatigue } from '@/game/engine/fatigue'
import {
  executeDraw,
  executeEnergyCharge,
  executeCombatPhase,
  resetFieldForNewTurn,
  playCard as enginePlayCard,
  checkGameResult,
  createEmptyField,
  resolveManualAttackHero,
  resolveManualAttackUnit,
} from '@/game/engine/turnEngine'
import { decideAITurn } from '@/game/ai/aiPlayer'
import type { AIAction } from '@/types/game'
import { getCombatModifier } from '@/game/engine/elementalCombat'
import { useRelicStore } from '@/stores/relicStore'

// getCombatModifier를 직접 참조 (dynamic import 불필요)
const _gcm = getCombatModifier

// ────────────────────────────────────────────────────
// 인터랙션 상태 머신
// ────────────────────────────────────────────────────

export type InteractionState =
  | 'idle'
  | 'card_selected'      // 핸드 카드 선택됨
  | 'spell_targeting'    // 주문 타겟 지정 중
  | 'unit_selected'      // 내 필드 유닛 선택됨
  | 'summoning'          // 소환 중 (애니메이션)
  | 'attacking'          // 공격 중 (애니메이션)
  | 'ai_turn'            // AI 턴 진행 중

// ────────────────────────────────────────────────────
// 데미지 팝업
// ────────────────────────────────────────────────────

export interface DamagePopupData {
  id: string
  value: number
  /** Phase 2-D: 'affinity_bonus' — 사주 친화도 보너스 팝업 */
  type: 'damage' | 'heal' | 'fatigue' | 'affinity_bonus'
  x: number
  y: number
  modifier?: 'dominate' | 'generate_defense' | 'neutral'
}

// ────────────────────────────────────────────────────
// 토스트 메시지
// ────────────────────────────────────────────────────

export interface ToastData {
  id: string
  message: string
  duration?: number
}

// ────────────────────────────────────────────────────
// AI 행동 큐 아이템 (연출용)
// ────────────────────────────────────────────────────

export interface AIActionQueueItem {
  action: AIAction
  delay: number
}

// ────────────────────────────────────────────────────
// 킬 카운트 (승패 화면용)
// ────────────────────────────────────────────────────

// ────────────────────────────────────────────────────
// 스토어 타입
// ────────────────────────────────────────────────────

interface BattleStore {
  // 게임 상태
  gameState: GameState | null

  // 인터랙션 상태
  interaction: InteractionState
  selectedCardIndex: number | null      // 핸드에서 선택된 카드 인덱스
  selectedUnitSlot: number | null       // 내 필드에서 선택된 유닛 슬롯

  // 애니메이션 상태
  attackingSlot: number | null          // 공격 중인 슬롯 (flash 효과)
  hitSlot: { side: 'player' | 'ai'; slot: number | 'hero' } | null

  // 팝업
  damagePopups: DamagePopupData[]

  // 토스트
  toasts: ToastData[]

  // UI 상태
  logOpen: boolean
  isProcessing: boolean                 // 전투 페이즈/AI 턴 중 입력 차단

  // AI 행동 큐 (연출용)
  aiActionQueue: AIAction[]

  // 킬 카운트 (플레이어가 처치한 AI 유닛 수)
  playerKillCount: number

  // Phase 2-4: 오행 콤보 UI 상태 (battleStore 레벨 — GameState와 별도로 UI 전용)
  comboElement: FiveElement | null
  comboCount: number

  // 액션
  // Phase 2-4: 콤보 업데이트 (카드 플레이 시 호출)
  updateCombo: (playedElement: FiveElement | null) => void
  resetCombo: () => void
  initBattle: (
    playerHeroId: HeroId,
    playerDeck: Card[],
    aiHeroId: HeroId,
    aiDeck: Card[],
  ) => void

  selectCard: (cardIndex: number) => void
  deselectCard: () => void
  selectUnit: (slotIdx: number) => void
  deselectUnit: () => void

  summonCard: (slotIdx: number) => string | null
  attackTarget: (targetSlot: number | 'hero') => Promise<void>
  endPlayerTurn: () => Promise<void>

  addDamagePopup: (popup: Omit<DamagePopupData, 'id'>) => void
  removeDamagePopup: (id: string) => void

  addToast: (message: string, duration?: number) => void
  removeToast: (id: string) => void

  setLogOpen: (open: boolean) => void
  resetBattle: () => void
  // P3: 전투 시작 유물 효과 적용 (RELIC_HERB_POUCH)
  applyHerbPouch: () => void
}

// ────────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────────

function createPlayerState(heroId: HeroId, deck: Card[]): PlayerState {
  return {
    hero: HEROES[heroId],
    currentHp: HERO_MAX_HP,
    deck: [...deck],
    hand: [],
    graveyard: [],
    field: createEmptyField() as (FieldUnit | null)[],
    currentEnergy: 0,
    fatigue: createInitialFatigue(),
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ────────────────────────────────────────────────────
// 스토어 구현
// ────────────────────────────────────────────────────

export const useBattleStore = create<BattleStore>((set, get) => ({
  gameState: null,
  interaction: 'idle',
  selectedCardIndex: null,
  selectedUnitSlot: null,
  attackingSlot: null,
  hitSlot: null,
  damagePopups: [],
  toasts: [],
  logOpen: false,
  isProcessing: false,
  aiActionQueue: [],
  playerKillCount: 0,
  comboElement: null,
  comboCount: 0,

  initBattle: (playerHeroId, playerDeck, aiHeroId, aiDeck) => {
    try {
      const player = createPlayerState(playerHeroId, playerDeck)
      const ai = createPlayerState(aiHeroId, aiDeck)

      // 초기 드로우 + 에너지
      const drawResult = executeDraw(player, 1)
      const playerWithHand = executeEnergyCharge(drawResult.player, 1)

      const aiDrawResult = executeDraw(ai, 1)
      const aiWithHand = executeEnergyCharge(aiDrawResult.player, 1)

      // Phase 2-1: 일진 오행 계산
      let dailyElement: FiveElement | undefined
      try {
        dailyElement = getDailyElement(new Date())
      } catch (e) {
        console.error('[battleStore] 일진 계산 오류:', e)
        dailyElement = undefined
      }

      const initialState: GameState = {
        turn: 1,
        phase: 'main',
        player: playerWithHand,
        ai: aiWithHand,
        result: null,
        log: ['게임 시작!', `카드 ${drawResult.drawnCount}장 드로우`],
        dailyElement,
        currentCombo: { element: null, count: 0 },
      }

      set({
        gameState: initialState,
        interaction: 'idle',
        selectedCardIndex: null,
        selectedUnitSlot: null,
        damagePopups: [],
        toasts: [],
        logOpen: false,
        isProcessing: false,
        aiActionQueue: [],
        playerKillCount: 0,
        comboElement: null,
        comboCount: 0,
      })
    } catch (err) {
      console.error('[battleStore] initBattle 오류:', err)
      throw err
    }
  },

  selectCard: (cardIndex) => {
    const { gameState, interaction, selectedCardIndex } = get()
    if (!gameState) return
    if (gameState.phase !== 'main') return
    if (interaction === 'ai_turn' || get().isProcessing) return

    if (selectedCardIndex === cardIndex) {
      set({ interaction: 'idle', selectedCardIndex: null })
      return
    }

    const card = gameState.player.hand[cardIndex]
    if (!card) return

    if (card.cost > gameState.player.currentEnergy) {
      get().addToast(`에너지가 부족합니다 (필요: ${card.cost}, 현재: ${gameState.player.currentEnergy})`)
      return
    }

    if (card.cardType === 'spell') {
      const needsTarget = ['attack', 'buff', 'debuff'].includes(card.subtype)
      set({
        interaction: needsTarget ? 'spell_targeting' : 'card_selected',
        selectedCardIndex: cardIndex,
        selectedUnitSlot: null,
      })
    } else {
      set({
        interaction: 'card_selected',
        selectedCardIndex: cardIndex,
        selectedUnitSlot: null,
      })
    }
  },

  deselectCard: () => {
    set({ interaction: 'idle', selectedCardIndex: null })
  },

  selectUnit: (slotIdx) => {
    const { gameState, interaction, selectedUnitSlot } = get()
    if (!gameState) return
    if (gameState.phase !== 'main') return
    if (interaction === 'ai_turn' || get().isProcessing) return

    if (selectedUnitSlot === slotIdx) {
      set({ interaction: 'idle', selectedUnitSlot: null })
      return
    }

    const unit = gameState.player.field[slotIdx]
    if (!unit) return

    if (!unit.canAttack) {
      get().addToast('이미 공격했습니다')
      return
    }
    if (unit.frozen) {
      get().addToast('동결 상태: 이번 턴 공격 불가')
      return
    }

    set({
      interaction: 'unit_selected',
      selectedUnitSlot: slotIdx,
      selectedCardIndex: null,
    })
  },

  deselectUnit: () => {
    set({ interaction: 'idle', selectedUnitSlot: null })
  },

  summonCard: (slotIdx) => {
    const { gameState, selectedCardIndex } = get()
    if (!gameState) return '게임 상태 없음'
    if (selectedCardIndex === null) return '카드 선택 안 됨'

    const card = gameState.player.hand[selectedCardIndex]
    if (!card) return '유효하지 않은 카드'
    if (card.cardType !== 'soldier') return '병사 카드만 소환 가능'

    const slot = gameState.player.field[slotIdx]
    if (slot !== null) return '슬롯이 이미 점유됨'

    const result = enginePlayCard(gameState.player, selectedCardIndex, slotIdx)
    if (!result.success) return result.reason

    // Phase 2-4: 콤보 업데이트
    const cardElement = card.element ?? null
    get().updateCombo(cardElement)

    // Phase 2-4: 콤보 3회 달성 시 해당 오행 카드 비용 -1 적용은 turnEngine에서 처리
    // currentCombo는 GameState에도 반영
    const { comboElement, comboCount } = get()
    const updatedCombo = {
      element: comboElement,
      count: comboCount,
    }

    const newState: GameState = {
      ...gameState,
      player: result.player,
      log: [...gameState.log, `[소환] ${card.name} → 슬롯 ${slotIdx}`],
      currentCombo: updatedCombo,
    }
    const finalResult = checkGameResult(newState)

    set({
      gameState: { ...newState, result: finalResult },
      interaction: 'idle',
      selectedCardIndex: null,
    })

    return null
  },

  attackTarget: async (targetSlot) => {
    const { gameState, selectedUnitSlot } = get()
    if (!gameState) return
    if (selectedUnitSlot === null) return

    const attackerUnit = gameState.player.field[selectedUnitSlot]
    if (!attackerUnit) return

    set({ isProcessing: true, interaction: 'attacking', attackingSlot: selectedUnitSlot })

    await sleep(150)

    let newGameState: typeof gameState

    if (targetSlot === 'hero') {
      // 영웅 직접 공격 — turnEngine으로 위임
      const result = resolveManualAttackHero(gameState, selectedUnitSlot)
      newGameState = result.newGameState

      // 데미지 팝업
      if (attackerUnit.card.keywords.includes('lifesteal') || attackerUnit.temporaryKeywords.includes('lifesteal')) {
        get().addDamagePopup({ value: result.damage, type: 'heal', x: 50, y: 60 })
      }
      get().addDamagePopup({ value: result.damage, type: 'damage', x: 50, y: 20, modifier: result.modifier })
    } else {
      // 유닛 대 유닛 전투 — turnEngine으로 위임
      if (!gameState.ai.field[targetSlot]) {
        set({ isProcessing: false, interaction: 'idle', selectedUnitSlot: null, attackingSlot: null })
        return
      }

      const result = resolveManualAttackUnit(gameState, selectedUnitSlot, targetSlot)
      if (!result) {
        set({ isProcessing: false, interaction: 'idle', selectedUnitSlot: null, attackingSlot: null })
        return
      }

      newGameState = result.newGameState

      // 데미지 팝업
      get().addDamagePopup({ value: result.damage, type: 'damage', x: 50, y: 25, modifier: result.modifier })
      if (result.counterDamage > 0) {
        get().addDamagePopup({ value: result.counterDamage, type: 'damage', x: 50, y: 75, modifier: result.counterModifier })
      }
      if (attackerUnit.card.keywords.includes('lifesteal') || attackerUnit.temporaryKeywords.includes('lifesteal')) {
        get().addDamagePopup({ value: result.damage, type: 'heal', x: 50, y: 65 })
      }

      // 킬 카운트 업데이트
      if (result.killIncrement > 0) {
        set({ playerKillCount: get().playerKillCount + result.killIncrement })
      }
    }

    await sleep(150)

    const finalResult = checkGameResult(newGameState)
    set({
      gameState: { ...newGameState, result: finalResult },
      isProcessing: false,
      interaction: 'idle',
      selectedUnitSlot: null,
      attackingSlot: null,
      hitSlot: null,
    })
  },

  endPlayerTurn: async () => {
    const { gameState } = get()
    if (!gameState) return
    if (gameState.phase !== 'main') return

    // Phase 2-4: 턴 종료 시 콤보 리셋
    get().resetCombo()

    set({ isProcessing: true, interaction: 'idle', selectedCardIndex: null, selectedUnitSlot: null })

    // 전투 페이즈: 플레이어 유닛 자동 공격
    // MOD-2: 스펙 §4-5 — canAttack=true 유닛 수 × 400ms 딜레이 후 결과 반영
    const combatReadyCount = gameState.player.field.filter(u => u !== null && u.canAttack && !u.frozen).length
    if (combatReadyCount > 0) {
      await sleep(combatReadyCount * 400)
    }
    const relicsForCombat = useRelicStore.getState().ownedRelics
    let combatState = executeCombatPhase(gameState, true, relicsForCombat)
    let combatResult = checkGameResult(combatState)

    if (combatResult) {
      set({
        gameState: { ...combatState, result: combatResult, phase: 'end' },
        isProcessing: false,
      })
      return
    }

    // 턴 종료 + AI 턴 전환
    const newTurn = gameState.turn + 1
    const playerForNextTurn = resetFieldForNewTurn(combatState.player, gameState.turn)

    const stateBeforeAI: GameState = {
      ...combatState,
      player: playerForNextTurn,
      turn: newTurn,
      phase: 'ai_turn',
      log: [...combatState.log, `--- 턴 ${newTurn} 시작 ---`, '[AI 턴] 시작'],
    }

    set({
      gameState: stateBeforeAI,
      interaction: 'ai_turn',
      isProcessing: true,
    })

    await sleep(800) // AI 턴 오버레이 표시

    // AI 드로우 + 에너지 충전
    const aiDrawResult = executeDraw(stateBeforeAI.ai, newTurn)
    const aiWithEnergy = executeEnergyCharge(aiDrawResult.player, newTurn)

    // AI Fatigue 처리 로그
    const aiLog: string[] = []
    if (aiDrawResult.fatigueDamage > 0) {
      aiLog.push(`[AI 소진] ${aiDrawResult.fatigueDamage} 피해`)
    }

    let aiState = {
      ...stateBeforeAI,
      ai: aiWithEnergy,
      log: [...stateBeforeAI.log, ...aiLog],
    }

    // CRIT-2: AI 드로우/Fatigue 직후 사망 여부 즉시 판정
    const postDrawResult = checkGameResult(aiState)
    if (postDrawResult) {
      set({
        gameState: { ...aiState, result: postDrawResult, phase: 'end' },
        isProcessing: false,
        interaction: 'idle',
        aiActionQueue: [],
      })
      return
    }

    // AI 행동 결정
    const aiActions = decideAITurn(aiState)
    set({ aiActionQueue: aiActions })

    // AI 행동 순차 실행
    for (const action of aiActions) {
      await sleep(600)

      if (action.type === 'play_card') {
        const card = aiState.ai.hand[action.cardIndex!]
        if (!card) continue

        const result = enginePlayCard(aiState.ai, action.cardIndex!, action.targetIndex)
        if (result.success) {
          aiState = {
            ...aiState,
            ai: result.player,
            log: [...aiState.log, `[AI 소환] ${card.name}`],
          }
          set({ gameState: aiState })
        }
      } else if (action.type === 'attack') {
        const attackerIdx = action.cardIndex!
        const attacker = aiState.ai.field[attackerIdx]
        if (!attacker || !attacker.canAttack || attacker.frozen) continue

        const targetIdx = action.targetIndex

        if (targetIdx === -1) {
          // 영웅 공격
          const gcm = _gcm
          const mod = gcm(attacker.card.element, aiState.player.hero.element)
          let dmg = attacker.currentAttack
          if (mod === 'dominate') dmg = Math.round(dmg * 1.5)
          if (mod === 'generate_defense') dmg = Math.round(dmg * 0.75)

          const newPlayerHp = Math.max(0, aiState.player.currentHp - dmg)

          get().addDamagePopup({ value: dmg, type: 'damage', x: 50, y: 75, modifier: mod })

          const newAiField = [...aiState.ai.field]
          newAiField[attackerIdx] = { ...attacker, canAttack: false }

          aiState = {
            ...aiState,
            ai: { ...aiState.ai, field: newAiField },
            player: { ...aiState.player, currentHp: newPlayerHp },
            log: [...aiState.log, `[AI 공격] ${attacker.card.name} → 영웅 (${dmg} 피해)`],
          }
          set({ gameState: aiState })
        } else if (targetIdx !== undefined && targetIdx >= 0) {
          const target = aiState.player.field[targetIdx]
          if (!target) continue

          const gcm = _gcm
          const mod = gcm(attacker.card.element, target.card.element)
          let dmg = attacker.currentAttack
          if (mod === 'dominate') dmg = Math.round(dmg * 1.5)
          if (mod === 'generate_defense') dmg = Math.round(dmg * 0.75)

          const hasPoison = attacker.card.keywords.includes('poison')
            || attacker.temporaryKeywords.includes('poison')
          if (hasPoison) dmg = Math.max(dmg, target.currentHealth)

          const counterMod = gcm(target.card.element, attacker.card.element)
          let counterDmg = target.currentAttack
          if (counterMod === 'dominate') counterDmg = Math.round(counterDmg * 1.5)
          if (counterMod === 'generate_defense') counterDmg = Math.round(counterDmg * 0.75)

          get().addDamagePopup({ value: dmg, type: 'damage', x: 50, y: 65, modifier: mod })

          // 타겟 피해 처리
          let updatedTarget: FieldUnit | null = { ...target, currentHealth: target.currentHealth - dmg }
          // CRIT-3: temporaryKeywords 포함 (플레이어측 attackTarget:417~419와 대칭)
          const hasIncin = attacker.card.keywords.includes('incinerate')
            || attacker.temporaryKeywords.includes('incinerate')
          let newPlayerGraveyard = [...aiState.player.graveyard]
          if (updatedTarget.currentHealth <= 0) {
            if (hasIncin) {
              updatedTarget = null
            } else if (
              (target.card.keywords.includes('reborn') || target.temporaryKeywords.includes('reborn'))
              && !target.rebornUsed
            ) {
              updatedTarget = { ...updatedTarget!, currentHealth: 1, rebornUsed: true }
            } else {
              newPlayerGraveyard = [...newPlayerGraveyard, target.card]
              updatedTarget = null
            }
          }

          // 공격자 역공 피해
          let updatedAttacker: FieldUnit | null = { ...attacker, currentHealth: attacker.currentHealth - counterDmg, canAttack: false }
          let newAiGraveyard = [...aiState.ai.graveyard]
          if (updatedAttacker.currentHealth <= 0) {
            if (
              (attacker.card.keywords.includes('reborn') || attacker.temporaryKeywords.includes('reborn'))
              && !attacker.rebornUsed
            ) {
              updatedAttacker = { ...updatedAttacker, currentHealth: 1, rebornUsed: true }
            } else {
              newAiGraveyard = [...newAiGraveyard, attacker.card]
              updatedAttacker = null
            }
          }

          const newPlayerField = [...aiState.player.field]
          newPlayerField[targetIdx] = updatedTarget

          const newAiField = [...aiState.ai.field]
          newAiField[attackerIdx] = updatedAttacker

          aiState = {
            ...aiState,
            player: { ...aiState.player, field: newPlayerField, graveyard: newPlayerGraveyard },
            ai: { ...aiState.ai, field: newAiField, graveyard: newAiGraveyard },
            log: [...aiState.log, `[AI 공격] ${attacker.card.name} → ${target.card.name} (${dmg} 피해)`],
          }
          set({ gameState: aiState })
        }
      }

      // 중간 승패 체크
      const midResult = checkGameResult(aiState)
      if (midResult) {
        set({
          gameState: { ...aiState, result: midResult, phase: 'end' },
          isProcessing: false,
          interaction: 'idle',
          aiActionQueue: [],
        })
        return
      }
    }

    await sleep(500) // AI 턴 종료 딜레이

    // AI 필드 리셋 + 내 드로우 페이즈
    const aiResetField = resetFieldForNewTurn(aiState.ai, newTurn)
    const relicsForDraw = useRelicStore.getState().ownedRelics
    const myDrawResult = executeDraw(
      {
        ...aiState.player,
      },
      newTurn,
      relicsForDraw,
    )
    const myWithEnergy = executeEnergyCharge(myDrawResult.player, newTurn)

    const myLog: string[] = [`카드 ${myDrawResult.drawnCount}장 드로우`]
    if (myDrawResult.burnedCount > 0) myLog.push(`${myDrawResult.burnedCount}장 버남`)
    if (myDrawResult.fatigueDamage > 0) {
      myLog.push(`소진 ${myDrawResult.fatigueDamage} 피해!`)
      get().addDamagePopup({ value: myDrawResult.fatigueDamage, type: 'fatigue', x: 50, y: 60 })
      // MOD-1: 팝업이 렌더링된 후 승패 판정되도록 딜레이
      await sleep(900)
    }

    const newStateAfterAI: GameState = {
      ...aiState,
      player: myWithEnergy,
      ai: aiResetField,
      phase: 'main',
      log: [...aiState.log, '[AI 턴] 종료', ...myLog],
    }

    const finalResult = checkGameResult(newStateAfterAI)

    set({
      gameState: { ...newStateAfterAI, result: finalResult },
      isProcessing: false,
      interaction: 'idle',
      aiActionQueue: [],
    })
  },

  addDamagePopup: (popup) => {
    const id = uid()
    set(s => ({ damagePopups: [...s.damagePopups, { ...popup, id }] }))
    setTimeout(() => {
      set(s => ({ damagePopups: s.damagePopups.filter(p => p.id !== id) }))
    }, 800)
  },

  removeDamagePopup: (id) => {
    set(s => ({ damagePopups: s.damagePopups.filter(p => p.id !== id) }))
  },

  addToast: (message, duration = 2000) => {
    const id = uid()
    set(s => ({ toasts: [...s.toasts, { id, message, duration }] }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, duration)
  },

  removeToast: (id) => {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
  },

  setLogOpen: (open) => set({ logOpen: open }),

  // Phase 2-4: 오행 콤보 업데이트
  updateCombo: (playedElement) => {
    const { comboElement, comboCount } = get()
    if (!playedElement) {
      // 무속성 카드 — 콤보 리셋
      set({ comboElement: null, comboCount: 0 })
      return
    }
    if (comboElement === playedElement) {
      // 같은 오행 연속 — count 증가
      set({ comboCount: comboCount + 1 })
    } else {
      // 다른 오행 — 콤보 리셋 후 새 콤보 시작
      set({ comboElement: playedElement, comboCount: 1 })
    }
  },

  resetCombo: () => {
    set({ comboElement: null, comboCount: 0 })
  },

  resetBattle: () => {
    set({
      gameState: null,
      interaction: 'idle',
      selectedCardIndex: null,
      selectedUnitSlot: null,
      attackingSlot: null,
      hitSlot: null,
      damagePopups: [],
      toasts: [],
      logOpen: false,
      isProcessing: false,
      aiActionQueue: [],
      playerKillCount: 0,
      comboElement: null,
      comboCount: 0,
    })
  },

  // P3: 전투 시작 — RELIC_HERB_POUCH HP +3
  applyHerbPouch: () => {
    const { gameState } = get()
    if (!gameState) return
    const maxHp = gameState.player.hero.maxHp
    const newHp = Math.min(maxHp, gameState.player.currentHp + 3)
    set({
      gameState: {
        ...gameState,
        player: {
          ...gameState.player,
          currentHp: newHp,
        },
      },
    })
  },
}))

// ────────────────────────────────────────────────────
// 셀렉터
// ────────────────────────────────────────────────────

export const selectGameState = (s: BattleStore) => s.gameState
export const selectInteraction = (s: BattleStore) => s.interaction
export const selectIsProcessing = (s: BattleStore) => s.isProcessing
export const selectPlayerKillCount = (s: BattleStore) => s.playerKillCount

export { ENERGY_CAP }
