/**
 * 팔자패 App 진입점 — M5
 * AppScene 6개: start | onboarding | worldMap | battle | cardReward | ending
 *
 * 진입 분기 (리라 M5 스펙 §2-1):
 *   localStorage 없음 → 'onboarding'
 *   localStorage 있음 → 'start'
 */
import React, { useState, useCallback } from 'react'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'
import BattleScreen from '@/components/battle/BattleScreen'
import WorldMapScreen from '@/screens/WorldMapScreen'
import StartScreen from '@/screens/StartScreen'
import CardRewardScreen from '@/screens/CardRewardScreen'
import EndingScreen from '@/screens/EndingScreen'
import { useStageStore } from '@/stores/stageStore'
import { useUnlockStore } from '@/stores/unlockStore'
import { useOnboardingStore, HERO_DATA } from '@/game/store/onboardingStore'
import type { FiveElement } from '@/types/elements'
import {
  hasSaveData,
  loadPlayerElement,
  loadHeroState,
  loadClearedStageIds,
  loadOwnedCardIds,
  loadProcessedCombos,
  saveHeroState,
  saveBirthDate,
  clearAllProgress,
} from '@/utils/persistence'

// ────────────────────────────────────────────────────
// Scene 타입
// ────────────────────────────────────────────────────

type AppScene = 'start' | 'onboarding' | 'worldMap' | 'battle' | 'cardReward' | 'ending'

/** 앱 초기 scene 결정 (리라 M5 스펙 §2-1) */
function getInitialScene(): AppScene {
  try {
    if (hasSaveData()) return 'start'
  } catch {
    // localStorage 접근 불가 시 온보딩으로
  }
  return 'onboarding'
}

// ────────────────────────────────────────────────────
// 게임 컨텍스트 (scene 간 공유)
// ────────────────────────────────────────────────────

interface GameContext {
  playerElement: FiveElement
  heroName: string
  heroHp: number
  heroMaxHp: number
  currentStageId: number | null
}

const DEFAULT_CONTEXT: GameContext = {
  playerElement: '火',
  heroName: '화염검객',
  heroHp: 30,
  heroMaxHp: 30,
  currentStageId: null,
}

// ────────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  const [scene, setScene] = useState<AppScene>(getInitialScene)
  const [ctx, setCtx] = useState<GameContext>(DEFAULT_CONTEXT)

  const stageStore = useStageStore()
  const unlockStore = useUnlockStore()
  useOnboardingStore(s => s.onboardingResult)

  // ─── 온보딩 완료 → WorldMap ───────────────────────

  const handleOnboardingComplete = useCallback(() => {
    const result = useOnboardingStore.getState().onboardingResult
    if (!result) return

    const heroData = HERO_DATA[result.primaryElement]

    // unlockStore 초기화
    unlockStore.initUnlocks(result.primaryElement)

    // LocalStorage 저장
    saveHeroState(30, 30, heroData.name)
    saveBirthDate({
      year: result.birthYear,
      month: result.birthMonth,
      day: result.birthDay,
    })

    // stageStore 초기화
    stageStore.resetProgress()

    setCtx({
      playerElement: result.primaryElement,
      heroName: heroData.name,
      heroHp: 30,
      heroMaxHp: 30,
      currentStageId: null,
    })
    setScene('worldMap')
  }, [unlockStore, stageStore])

  // ─── 이어하기 → WorldMap ──────────────────────────

  const handleContinue = useCallback(() => {
    const element = loadPlayerElement()
    const hero = loadHeroState()
    const clearedIds = loadClearedStageIds()
    const ownedIds = loadOwnedCardIds()
    loadProcessedCombos() // 향후 확장용 (현재 stageStore에서 직접 사용)

    if (element && hero) {
      setCtx({
        playerElement: element,
        heroName: hero.name,
        heroHp: hero.hp,
        heroMaxHp: hero.maxHp,
        currentStageId: null,
      })

      // stageStore 복원
      stageStore.loadProgress(clearedIds)

      // unlockStore 복원
      unlockStore.loadUnlocks(ownedIds, ownedIds.slice(0, 20))
    }

    setScene('worldMap')
  }, [stageStore, unlockStore])

  // ─── 새 게임 → Onboarding ─────────────────────────

  const handleNewGame = useCallback(() => {
    clearAllProgress()
    stageStore.resetProgress()
    unlockStore.resetUnlocks()
    setScene('onboarding')
  }, [stageStore, unlockStore])

  // ─── WorldMap → Battle ────────────────────────────

  const handleStartBattle = useCallback((stageId: number) => {
    stageStore.selectStage(stageId)
    setCtx(prev => ({ ...prev, currentStageId: stageId }))
    setScene('battle')
  }, [stageStore])

  // ─── Battle 승리 → CardReward ─────────────────────

  const handleBattleVictory = useCallback(() => {
    const stageId = ctx.currentStageId
    if (stageId === null) return

    // 스테이지 클리어 처리
    stageStore.clearStage(stageId)

    // 언락 보상 제시
    const stage = stageStore.stages.find(s => s.id === stageId)
    if (stage) {
      unlockStore.offerReward(stageId, stage.rewardPool.cards)
      unlockStore.applyStageUnlock(stageId)
      unlockStore.checkComboUnlocks([...stageStore.clearedStageIds, stageId])
    }

    // HP 저장 (배틀 후 잔여 HP — 현재 battleStore에서 직접 읽기 어려우므로 임시 유지)
    saveHeroState(ctx.heroHp, ctx.heroMaxHp, ctx.heroName)

    setScene('cardReward')
  }, [ctx, stageStore, unlockStore])

  // ─── Battle 패배 → WorldMap ───────────────────────

  const handleBattleDefeat = useCallback(() => {
    setScene('worldMap')
  }, [])

  // ─── CardReward 완료 → WorldMap ───────────────────

  const handleCardRewardComplete = useCallback(() => {
    setScene('worldMap')
  }, [])

  // ─── 보스 클리어 → EndingScreen ──────────────────

  const handleBossCleared = useCallback(() => {
    setScene('ending')
  }, [])

  // ─── Ending → Onboarding ──────────────────────────

  const handleRestart = useCallback(() => {
    stageStore.resetProgress()
    unlockStore.resetUnlocks()
    setScene('onboarding')
  }, [stageStore, unlockStore])

  // ────────────────────────────────────────────────────
  // Scene 렌더링
  // ────────────────────────────────────────────────────

  switch (scene) {
    case 'start':
      return (
        <StartScreen
          onContinue={handleContinue}
          onNewGame={handleNewGame}
        />
      )

    case 'onboarding':
      return (
        <OnboardingFlow onGameStart={handleOnboardingComplete} />
      )

    case 'worldMap':
      return (
        <WorldMapScreen
          onStartBattle={handleStartBattle}
          playerElement={ctx.playerElement}
          heroName={ctx.heroName}
          heroHp={ctx.heroHp}
          heroMaxHp={ctx.heroMaxHp}
        />
      )

    case 'battle':
      return (
        <BattleScreen
          onRestart={handleBattleDefeat}
          onVictory={handleBattleVictory}
          stageId={ctx.currentStageId}
        />
      )

    case 'cardReward':
      return (
        <CardRewardScreen
          playerElement={ctx.playerElement}
          stageId={ctx.currentStageId ?? 0}
          onComplete={handleCardRewardComplete}
          onBossCleared={handleBossCleared}
        />
      )

    case 'ending':
      return (
        <EndingScreen
          playerElement={ctx.playerElement}
          heroName={ctx.heroName}
          totalAttempts={stageStore.clearedStageIds.size}
          unlockedCount={unlockStore.ownedCardIds.size}
          onRestart={handleRestart}
        />
      )

    default:
      return <OnboardingFlow onGameStart={handleOnboardingComplete} />
  }
}
