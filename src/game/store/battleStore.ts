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
} from '@/game/engine/turnEngine'
import { decideAITurn } from '@/game/ai/aiPlayer'
import type { AIAction } from '@/types/game'
import { getCombatModifier } from '@/game/engine/elementalCombat'

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
  type: 'damage' | 'heal' | 'fatigue'
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

  // 액션
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

  initBattle: (playerHeroId, playerDeck, aiHeroId, aiDeck) => {
    const player = createPlayerState(playerHeroId, playerDeck)
    const ai = createPlayerState(aiHeroId, aiDeck)

    // 초기 드로우 + 에너지
    const drawResult = executeDraw(player, 1)
    const playerWithHand = executeEnergyCharge(drawResult.player, 1)

    const aiDrawResult = executeDraw(ai, 1)
    const aiWithHand = executeEnergyCharge(aiDrawResult.player, 1)

    const initialState: GameState = {
      turn: 1,
      phase: 'main',
      player: playerWithHand,
      ai: aiWithHand,
      result: null,
      log: ['게임 시작!', `카드 ${drawResult.drawnCount}장 드로우`],
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
    })
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

    const newState: GameState = {
      ...gameState,
      player: result.player,
      log: [...gameState.log, `[소환] ${card.name} → 슬롯 ${slotIdx}`],
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

    // 단일 유닛 전투 처리
    let newGameState = { ...gameState }
    const player = { ...gameState.player }
    const ai = { ...gameState.ai }

    const { getCombatModifier: _unused, ..._ } = { getCombatModifier, ...{} }
    void _unused, _

    if (targetSlot === 'hero') {
      // 영웅 직접 공격
      const modifier = getCombatModifier(attackerUnit.card.element, ai.hero.element)
      let dmg = attackerUnit.currentAttack
      if (modifier === 'dominate') dmg = Math.round(dmg * 1.5)
      if (modifier === 'generate_defense') dmg = Math.round(dmg * 0.75)

      const newAiHp = Math.max(0, ai.currentHp - dmg)

      // 생명흡수
      let newPlayerHp = player.currentHp
      const hasLifesteal = attackerUnit.card.keywords.includes('lifesteal')
        || attackerUnit.temporaryKeywords.includes('lifesteal')
      if (hasLifesteal) {
        newPlayerHp = Math.min(HERO_MAX_HP, newPlayerHp + dmg)
        get().addDamagePopup({ value: dmg, type: 'heal', x: 50, y: 60 })
      }

      get().addDamagePopup({ value: dmg, type: 'damage', x: 50, y: 20, modifier })

      // 공격한 유닛 canAttack = false
      const newPlayerField = [...player.field]
      newPlayerField[selectedUnitSlot] = { ...attackerUnit, canAttack: false }

      newGameState = {
        ...gameState,
        player: { ...player, field: newPlayerField, currentHp: newPlayerHp },
        ai: { ...ai, currentHp: newAiHp },
        log: [
          ...gameState.log,
          `[공격] ${attackerUnit.card.name} → AI 영웅 (${dmg} 피해${modifier === 'dominate' ? ', 상극!' : modifier === 'generate_defense' ? ', 상생' : ''})`,
        ],
      }
    } else {
      // 유닛 대 유닛 전투
      const targetUnit = ai.field[targetSlot]
      if (!targetUnit) {
        set({ isProcessing: false, interaction: 'idle', selectedUnitSlot: null, attackingSlot: null })
        return
      }

      const attackModifier = getCombatModifier(attackerUnit.card.element, targetUnit.card.element)
      let dmg = attackerUnit.currentAttack
      if (attackModifier === 'dominate') dmg = Math.round(dmg * 1.5)
      if (attackModifier === 'generate_defense') dmg = Math.round(dmg * 0.75)

      // 독성: 무조건 파괴
      const hasPoison = attackerUnit.card.keywords.includes('poison')
        || attackerUnit.temporaryKeywords.includes('poison')
      if (hasPoison) dmg = Math.max(dmg, targetUnit.currentHealth)

      // 역공 계산
      const counterModifier = getCombatModifier(targetUnit.card.element, attackerUnit.card.element)
      let counterDmg = targetUnit.currentAttack
      if (counterModifier === 'dominate') counterDmg = Math.round(counterDmg * 1.5)
      if (counterModifier === 'generate_defense') counterDmg = Math.round(counterDmg * 0.75)

      get().addDamagePopup({ value: dmg, type: 'damage', x: 50, y: 25, modifier: attackModifier })
      if (counterDmg > 0) {
        get().addDamagePopup({ value: counterDmg, type: 'damage', x: 50, y: 75, modifier: counterModifier })
      }

      // 생명흡수
      let newPlayerHp = player.currentHp
      const hasLifesteal = attackerUnit.card.keywords.includes('lifesteal')
        || attackerUnit.temporaryKeywords.includes('lifesteal')
      if (hasLifesteal) {
        newPlayerHp = Math.min(HERO_MAX_HP, newPlayerHp + dmg)
        get().addDamagePopup({ value: dmg, type: 'heal', x: 50, y: 65 })
      }

      // 냉기
      const hasFreeze = attackerUnit.card.keywords.includes('freeze')
        || attackerUnit.temporaryKeywords.includes('freeze')

      // 소각
      const hasIncinerate = attackerUnit.card.keywords.includes('incinerate')
        || attackerUnit.temporaryKeywords.includes('incinerate')

      // 피해 적용
      let updatedTarget: FieldUnit | null = {
        ...targetUnit,
        currentHealth: targetUnit.currentHealth - dmg,
        frozen: hasFreeze ? true : targetUnit.frozen,
      }

      let updatedAttacker: FieldUnit | null = {
        ...attackerUnit,
        currentHealth: attackerUnit.currentHealth - counterDmg,
        canAttack: false,
      }

      // 사망 처리 — 타겟
      let killCount = get().playerKillCount
      if (updatedTarget.currentHealth <= 0) {
        if (hasIncinerate) {
          // 소각: 묘지 미추가, 부활 방지
          updatedTarget = null
          killCount++
        } else if (
          (targetUnit.card.keywords.includes('reborn') || targetUnit.temporaryKeywords.includes('reborn'))
          && !targetUnit.rebornUsed
        ) {
          updatedTarget = { ...updatedTarget!, currentHealth: 1, rebornUsed: true }
        } else {
          killCount++
          ai.graveyard.push(targetUnit.card)
          updatedTarget = null
        }
      }

      // 사망 처리 — 공격자
      let newAiGraveyard = [...ai.graveyard]
      if (updatedTarget === null && !hasIncinerate) {
        // 이미 위에서 push했으니 여기서는 안 함
      }

      // 공격자 사망
      let updatedAttackerFinal: FieldUnit | null = updatedAttacker
      if (updatedAttacker.currentHealth <= 0) {
        const atkTargetHasIncinerate = targetUnit.card.keywords.includes('incinerate')
          || targetUnit.temporaryKeywords.includes('incinerate')
        if (!atkTargetHasIncinerate) {
          if (
            (attackerUnit.card.keywords.includes('reborn') || attackerUnit.temporaryKeywords.includes('reborn'))
            && !attackerUnit.rebornUsed
          ) {
            updatedAttackerFinal = { ...updatedAttacker, currentHealth: 1, rebornUsed: true }
          } else {
            player.graveyard.push(attackerUnit.card)
            updatedAttackerFinal = null
          }
        } else {
          updatedAttackerFinal = null
        }
      }

      const newPlayerField = [...player.field]
      newPlayerField[selectedUnitSlot] = updatedAttackerFinal

      const newAiField = [...ai.field]
      newAiField[targetSlot] = updatedTarget

      newAiGraveyard = [...ai.graveyard]

      const logEntry = `[공격] ${attackerUnit.card.name} → ${targetUnit.card.name} (${dmg} 피해${attackModifier === 'dominate' ? ', 상극!' : attackModifier === 'generate_defense' ? ', 상생' : ''})`

      newGameState = {
        ...gameState,
        player: {
          ...player,
          field: newPlayerField,
          graveyard: [...player.graveyard],
          currentHp: newPlayerHp,
        },
        ai: {
          ...ai,
          field: newAiField,
          graveyard: newAiGraveyard,
        },
        log: [...gameState.log, logEntry],
      }

      set({ playerKillCount: killCount })
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

    set({ isProcessing: true, interaction: 'idle', selectedCardIndex: null, selectedUnitSlot: null })

    // 전투 페이즈: 플레이어 유닛 자동 공격
    // MOD-2: 스펙 §4-5 — canAttack=true 유닛 수 × 400ms 딜레이 후 결과 반영
    const combatReadyCount = gameState.player.field.filter(u => u !== null && u.canAttack && !u.frozen).length
    if (combatReadyCount > 0) {
      await sleep(combatReadyCount * 400)
    }
    let combatState = executeCombatPhase(gameState, true)
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
    const myDrawResult = executeDraw(
      {
        ...aiState.player,
      },
      newTurn,
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
