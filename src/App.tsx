/**
 * 팔자패 App 진입점 — M5
 * AppScene 6개: start | onboarding | worldMap | battle | cardReward | ending
 *
 * 진입 분기 (리라 M5 스펙 §2-1):
 *   localStorage 없음 → 'onboarding'
 *   localStorage 있음 → 'start'
 */
import React, { useState, useCallback, Component } from 'react'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'
import BattleScreen from '@/components/battle/BattleScreen'
import WorldMapScreen from '@/screens/WorldMapScreen'
import StartScreen from '@/screens/StartScreen'
import CardRewardScreen from '@/screens/CardRewardScreen'
import EndingScreen from '@/screens/EndingScreen'
import DefeatScreen from '@/screens/DefeatScreen'
import RemoveCardScreen from '@/screens/RemoveCardScreen'
import UpgradeCardScreen from '@/screens/UpgradeCardScreen'
import EventScreen from '@/screens/EventScreen'
import ShopScreen from '@/screens/ShopScreen'
import TutorialOverlay from '@/screens/TutorialOverlay'
import RelicAcquirePopup from '@/components/ui/RelicAcquirePopup'
import RunStartScreen from '@/screens/RunStartScreen'
import DailyDrawScreen from '@/screens/DailyDrawScreen'
import { hasDrawnToday } from '@/game/hooks/useDailyDraw'
import { useChallengeStore } from '@/stores/challengeStore'
import { CHALLENGE_RULES } from '@/types/challengeMode'
import { useStageStore } from '@/stores/stageStore'
import { useUnlockStore } from '@/stores/unlockStore'
import { useRelicStore } from '@/stores/relicStore'
import { useOnboardingStore, HERO_DATA } from '@/game/store/onboardingStore'
import type { FiveElement } from '@/types/elements'
import type { EventResult } from '@/data/events'
import type { RelicId } from '@/types/relics'
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
  saveGold,
  loadGold,
  isTutorialDone,
  markTutorialDone,
} from '@/utils/persistence'
// ────────────────────────────────────────────────────
// Error Boundary
// ────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

class GameErrorBoundary extends Component<
  { children: React.ReactNode; onReset: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message ?? '알 수 없는 오류' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[팔자패 ErrorBoundary]', error, info)
  }

  handleReset = () => {
    try {
      clearAllProgress()
    } catch {
      // localStorage 접근 불가 시 무시
    }
    this.setState({ hasError: false, errorMessage: '' })
    this.props.onReset()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#0D0B08',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          fontFamily: 'Noto Serif KR, serif',
          color: '#E8E0D0',
        }}>
          <div style={{ fontSize: 40 }}>⚠</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#FF6B35' }}>
            오류가 발생했습니다
          </div>
          <div style={{
            fontSize: 13,
            color: '#6B5F52',
            fontFamily: 'DM Mono, monospace',
            textAlign: 'center',
            maxWidth: 280,
            wordBreak: 'break-all',
          }}>
            {this.state.errorMessage}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 8,
              padding: '10px 28px',
              background: '#E8C84A',
              color: '#0D0B08',
              border: 'none',
              borderRadius: 8,
              fontFamily: 'Noto Serif KR, serif',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            처음부터 시작
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ────────────────────────────────────────────────────
// Scene 타입
// ────────────────────────────────────────────────────

type AppScene = 'start' | 'onboarding' | 'runStart' | 'dailyDraw' | 'worldMap' | 'battle' | 'cardReward' | 'ending' | 'defeat' | 'removeCard' | 'upgrade' | 'event' | 'shop'

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
  gold?: number
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
  // P0-A: 패배 시 stagesCleared 캡처 (리셋 후 0이 되므로 미리 보존)
  const [defeatStagesCleared, setDefeatStagesCleared] = useState<number>(0)
  // P1-B: 업그레이드 노드 cleared 상태 (런당 1회, localStorage 저장 불필요)
  const [upgradeNodeCleared, setUpgradeNodeCleared] = useState<boolean>(false)
  // P2: 이벤트 노드 cleared 상태 (런당 1회)
  const [eventNodeCleared, setEventNodeCleared] = useState<boolean>(false)
  // P2-B: 상점 노드 cleared 상태 (런당 1회)
  const [shopNodeCleared, setShopNodeCleared] = useState<boolean>(false)
  // P4-A: 튜토리얼 완료 여부
  const [tutorialDone, setTutorialDone] = useState<boolean>(() => isTutorialDone())
  // P3-A: 유물 획득 팝업 (보스 처치 / 이벤트 경로)
  const [relicPopupId, setRelicPopupId] = useState<RelicId | null>(null)
  // P2-B: 마지막 전투 골드 보상 (CardRewardScreen 배너용)
  const [lastGoldEarned, setLastGoldEarned] = useState<number>(0)

  // 액션 함수만 selector로 구독 — 전체 객체 구독 시 매 set()마다 App 리렌더되어 Error #185 발생
  const stageSelectStage = useStageStore(s => s.selectStage)
  const stageResetProgress = useStageStore(s => s.resetProgress)
  const stageClearStage = useStageStore(s => s.clearStage)
  const stageLoadProgress = useStageStore(s => s.loadProgress)
  const stageStages = useStageStore(s => s.stages)
  const stageClearedStageIds = useStageStore(s => s.clearedStageIds)

  const unlockInitUnlocks = useUnlockStore(s => s.initUnlocks)
  const unlockOfferReward = useUnlockStore(s => s.offerReward)
  const unlockApplyStageUnlock = useUnlockStore(s => s.applyStageUnlock)
  const unlockCheckComboUnlocks = useUnlockStore(s => s.checkComboUnlocks)
  const unlockLoadUnlocks = useUnlockStore(s => s.loadUnlocks)
  const unlockResetUnlocks = useUnlockStore(s => s.resetUnlocks)
  const unlockOwnedCardIds = useUnlockStore(s => s.ownedCardIds)

  const relicResetRelics = useRelicStore(s => s.resetRelics)
  const relicAddRelic = useRelicStore(s => s.addRelic)

  const challengeResetChallenge = useChallengeStore(s => s.resetChallenge)

  // ─── 온보딩 완료 → WorldMap ───────────────────────

  const handleOnboardingComplete = useCallback(() => {
    const result = useOnboardingStore.getState().onboardingResult
    if (!result) return

    const heroData = HERO_DATA[result.primaryElement]

    // unlockStore 초기화
    unlockInitUnlocks(result.primaryElement)

    // LocalStorage 저장
    saveHeroState(30, 30, heroData.name)
    saveBirthDate({
      year: result.birthYear,
      month: result.birthMonth,
      day: result.birthDay,
    })

    // stageStore 초기화
    stageResetProgress()

    // 이전 런의 localStorage 금고 값 초기화 (스펙 §3-4 MOD-03)
    saveGold(0)

    setCtx({
      playerElement: result.primaryElement,
      heroName: heroData.name,
      heroHp: 30,
      heroMaxHp: 30,
      currentStageId: null,
      gold: 0,
    })
    // M8: 난이도 선택 화면으로 이동
    setScene('runStart')
  }, [unlockInitUnlocks, stageResetProgress])

  // ─── 이어하기 → WorldMap ──────────────────────────

  const handleContinue = useCallback(() => {
    const element = loadPlayerElement()
    const hero = loadHeroState()
    const clearedIds = loadClearedStageIds()
    const ownedIds = loadOwnedCardIds()
    loadProcessedCombos() // 향후 확장용 (현재 stageStore에서 직접 사용)

    if (element && hero) {
      const savedGold = loadGold()
      setCtx({
        playerElement: element,
        heroName: hero.name,
        heroHp: hero.hp,
        heroMaxHp: hero.maxHp,
        currentStageId: null,
        gold: savedGold,
      })

      // stageStore 복원
      stageLoadProgress(clearedIds)

      // unlockStore 복원
      unlockLoadUnlocks(ownedIds, ownedIds.slice(0, 20))
    }

    // M8: 이어하기도 난이도 선택 화면 경유
    setScene('runStart')
  }, [stageLoadProgress, unlockLoadUnlocks])

  // ─── 새 게임 → Onboarding ─────────────────────────

  const handleNewGame = useCallback(() => {
    clearAllProgress()
    stageResetProgress()
    unlockResetUnlocks()
    relicResetRelics()
    challengeResetChallenge()
    setUpgradeNodeCleared(false)
    setEventNodeCleared(false)
    setShopNodeCleared(false)
    setCtx(prev => ({ ...prev, gold: 0 }))
    setScene('onboarding')
  }, [stageResetProgress, unlockResetUnlocks, relicResetRelics, challengeResetChallenge])

  // ─── WorldMap → Battle ────────────────────────────

  const handleStartBattle = useCallback((stageId: number) => {
    // stageId 유효성 검증 (M6)
    if (typeof stageId !== 'number' || isNaN(stageId) || stageId < 0) {
      console.error('[App] 유효하지 않은 stageId:', stageId)
      return
    }
    stageSelectStage(stageId)
    setCtx(prev => ({ ...prev, currentStageId: stageId }))
    setScene('battle')
  }, [stageSelectStage])

  // ─── Battle 승리 → CardReward (P0-B) ─────────────
  // onVictory: (result: { playerHpRemaining: number }) => void

  const handleBattleVictory = useCallback((result: { playerHpRemaining: number }) => {
    const stageId = ctx.currentStageId
    if (stageId === null) return

    // 스테이지 클리어 처리
    stageClearStage(stageId)

    // 언락 보상 제시
    const stage = stageStages.find(s => s.id === stageId)
    if (stage) {
      unlockOfferReward(stageId, stage.rewardPool.cards)
      unlockApplyStageUnlock(stageId)
      unlockCheckComboUnlocks([...stageClearedStageIds, stageId])
    }

    // HP 반영: battleStore 실측값 사용 (승리 시 >= 1 보장)
    const newHp = Math.max(1, result.playerHpRemaining)
    saveHeroState(newHp, ctx.heroMaxHp, ctx.heroName)

    // 골드 보상 (P2-B): stageId * 5 + 10 + 0~5 랜덤
    const GOLD_REWARD: Record<number, number> = { 1: 15, 2: 20, 3: 25, 4: 30, 5: 35, 6: 50 }
    const baseGold = GOLD_REWARD[stageId] ?? 15
    const bonusGold = Math.floor(Math.random() * 6)
    const earned = baseGold + bonusGold
    const newGold = (ctx.gold ?? 0) + earned
    saveGold(newGold)
    setLastGoldEarned(earned)
    setCtx(prev => ({ ...prev, heroHp: newHp, gold: newGold }))

    // 보스(Stage 6) 처치 시 랜덤 유물 보상 (P3)
    if (stageId === 6) {
      const bossRelic = (Math.random() < 0.5 ? 'RELIC_JADE_BEAD' : 'RELIC_ELEMENT_SEAL') as RelicId
      try {
        relicAddRelic(bossRelic)
        // P3-A: 유물 획득 팝업 표시 (250ms 딜레이)
        setTimeout(() => {
          setRelicPopupId(bossRelic)
        }, 250)
      } catch {
        // relicStore 오류 시 무시
      }
    }

    setScene('cardReward')
  }, [ctx, stageClearStage, stageStages, stageClearedStageIds, unlockOfferReward, unlockApplyStageUnlock, unlockCheckComboUnlocks])

  // ─── Battle 패배 → DefeatScreen (P0-A) ──────────
  // 주의: 리셋 전 stagesCleared를 캡처해야 한다 (리셋 후 0이 됨)

  const handleBattleDefeat = useCallback(() => {
    const capturedStagesCleared = stageClearedStageIds.size
    setDefeatStagesCleared(capturedStagesCleared)
    clearAllProgress()
    stageResetProgress()
    unlockResetUnlocks()
    relicResetRelics()
    challengeResetChallenge()
    setUpgradeNodeCleared(false)
    setEventNodeCleared(false)
    setShopNodeCleared(false)
    setCtx(prev => ({ ...prev, gold: 0 }))
    setScene('defeat')
  }, [stageClearedStageIds, stageResetProgress, unlockResetUnlocks, relicResetRelics, challengeResetChallenge])

  // ─── CardReward 완료 → WorldMap ───────────────────

  const handleCardRewardComplete = useCallback(() => {
    setScene('worldMap')
  }, [])

  // ─── CardReward 스킵 후 카드 제거 → RemoveCardScreen (P1-A) ───

  const handleGoToRemoveCard = useCallback(() => {
    setScene('removeCard')
  }, [])

  // ─── RemoveCardScreen 완료/취소 → WorldMap (P1-A) ──

  const handleRemoveCardComplete = useCallback(() => {
    setScene('worldMap')
  }, [])

  // ─── WorldMap → UpgradeCardScreen (P1-B) ──────────

  const handleGoToUpgrade = useCallback(() => {
    setScene('upgrade')
  }, [])

  // ─── UpgradeCardScreen 완료/취소 → WorldMap (P1-B) ──

  const handleUpgradeComplete = useCallback((upgraded: boolean) => {
    if (upgraded) {
      setUpgradeNodeCleared(true)
    }
    setScene('worldMap')
  }, [])

  // ─── WorldMap → EventScreen (P2) ──────────────────

  const handleGoToEvent = useCallback(() => {
    setScene('event')
  }, [])

  // ─── EventScreen 완료 → WorldMap or RemoveCard (P2) ──

  const handleEventComplete = useCallback((result: EventResult | null) => {
    if (result === null) {
      // 취소 (← 돌아가기) — eventNodeCleared 변경 없음
      setScene('worldMap')
      return
    }

    // HP 반영
    if (result.hpDelta !== 0) {
      setCtx(prev => ({
        ...prev,
        heroHp: Math.max(1, Math.min(prev.heroMaxHp, prev.heroHp + result.hpDelta)),
      }))
    }

    // P3-A: 유물 획득 팝업 (이벤트 경로 — EventScreen에서 addRelic 후 여기서 팝업)
    if (result.relicId) {
      setTimeout(() => {
        setRelicPopupId(result.relicId as RelicId)
      }, 150)
    }

    setEventNodeCleared(true)

    if (result.needRemoveCard) {
      setScene('removeCard')
    } else {
      setScene('worldMap')
    }
  }, [])

  // ─── WorldMap → ShopScreen (P2-B) ────────────────
  const handleGoToShop = useCallback(() => {
    setScene('shop')
  }, [])

  // ─── ShopScreen: 골드 변경 알림 ──────────────────
  const handleShopGoldChange = useCallback((newGold: number) => {
    setCtx(prev => ({ ...prev, gold: newGold }))
  }, [])

  // ─── ShopScreen: HP 회복 알림 ────────────────────
  const handleShopHpRestore = useCallback((delta: number) => {
    setCtx(prev => {
      const newHp = Math.min(prev.heroMaxHp, prev.heroHp + delta)
      saveHeroState(newHp, prev.heroMaxHp, prev.heroName)
      return { ...prev, heroHp: newHp }
    })
  }, [])

  // ─── ShopScreen 완료 → WorldMap (P2-B) ──────────
  const handleShopComplete = useCallback(() => {
    setShopNodeCleared(true)
    setScene('worldMap')
  }, [])

  // ─── ShopScreen → RemoveCard (카드 제거 서비스) ──
  const handleShopRemoveCard = useCallback(() => {
    setShopNodeCleared(true)
    setScene('removeCard')
  }, [])

  // ─── P4-A 튜토리얼 완료 ──────────────────────────
  const handleTutorialDone = useCallback(() => {
    markTutorialDone()
    setTutorialDone(true)
  }, [])

  // ─── EventScreen에서 카드 제거 요청 (P2 이벤트 4) ──

  const handleEventNeedRemoveCard = useCallback(() => {
    setEventNodeCleared(true)
    setScene('removeCard')
  }, [])

  // ─── DefeatScreen → Onboarding (P0-A) ─────────────

  const handleStartNewRun = useCallback(() => {
    setScene('onboarding')
  }, [])

  // ─── 보스 클리어 → EndingScreen ──────────────────

  const handleBossCleared = useCallback(() => {
    setScene('ending')
  }, [])

  // ─── Ending → Onboarding ──────────────────────────

  const handleRestart = useCallback(() => {
    stageResetProgress()
    unlockResetUnlocks()
    relicResetRelics()
    challengeResetChallenge()
    setUpgradeNodeCleared(false)
    setEventNodeCleared(false)
    setShopNodeCleared(false)
    setCtx(prev => ({ ...prev, gold: 0 }))
    setScene('onboarding')
  }, [stageResetProgress, unlockResetUnlocks, relicResetRelics, challengeResetChallenge])

  // ErrorBoundary 리셋: 모든 진행 초기화 후 onboarding으로
  const handleErrorReset = useCallback(() => {
    clearAllProgress()
    stageResetProgress()
    unlockResetUnlocks()
    setScene('onboarding')
  }, [stageResetProgress, unlockResetUnlocks])

  // ────────────────────────────────────────────────────
  // Scene 렌더링
  // ────────────────────────────────────────────────────

  function renderScene(): React.ReactElement {
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

      case 'runStart':
        return (
          <RunStartScreen
            heroName={ctx.heroName}
            heroElement={ctx.playerElement}
            onStart={(mode) => {
              // 챌린지 모드 저장 + 봉인 오행 결정
              useChallengeStore.getState().setMode(mode)
              useChallengeStore.getState().initRun()
              // Challenge HP 반영
              const rules = CHALLENGE_RULES[mode]
              if (rules.playerStartHp !== null) {
                const hp = rules.playerStartHp
                setCtx(prev => ({ ...prev, heroHp: hp, heroMaxHp: hp }))
                saveHeroState(hp, hp, ctx.heroName)
              }
              // M8 P1: 오늘 뽑기 미완료 시 일일 뽑기 화면 경유
              setScene(hasDrawnToday() ? 'worldMap' : 'dailyDraw')
            }}
            onCancel={() => setScene('start')}
          />
        )

      case 'dailyDraw':
        return (
          <DailyDrawScreen
            onComplete={() => setScene('worldMap')}
            onSkip={() => setScene('worldMap')}
          />
        )

      case 'worldMap':
        return (
          <WorldMapScreen
            onStartBattle={handleStartBattle}
            onUpgrade={handleGoToUpgrade}
            upgradeNodeCleared={upgradeNodeCleared}
            playerElement={ctx.playerElement}
            heroName={ctx.heroName}
            heroHp={ctx.heroHp}
            heroMaxHp={ctx.heroMaxHp}
            onEvent={handleGoToEvent}
            eventNodeCleared={eventNodeCleared}
            onShop={handleGoToShop}
            shopNodeCleared={shopNodeCleared}
            gold={ctx.gold ?? 0}
          />
        )

      case 'battle':
        return (
          <>
            <BattleScreen
              onRestart={handleBattleDefeat}
              onVictory={handleBattleVictory}
              stageId={ctx.currentStageId}
            />
            {!tutorialDone && (
              <TutorialOverlay onDone={handleTutorialDone} />
            )}
          </>
        )

      case 'defeat':
        return (
          <DefeatScreen
            heroName={ctx.heroName}
            playerElement={ctx.playerElement}
            stagesCleared={defeatStagesCleared}
            onStartNewRun={handleStartNewRun}
          />
        )

      case 'cardReward':
        return (
          <CardRewardScreen
            playerElement={ctx.playerElement}
            stageId={ctx.currentStageId ?? 0}
            onComplete={handleCardRewardComplete}
            onBossCleared={handleBossCleared}
            onRemoveCard={handleGoToRemoveCard}
            goldEarned={lastGoldEarned}
          />
        )

      case 'removeCard':
        return (
          <RemoveCardScreen
            onComplete={handleRemoveCardComplete}
          />
        )

      case 'upgrade':
        return (
          <UpgradeCardScreen
            onComplete={handleUpgradeComplete}
          />
        )

      case 'event': {
        // MOD-3: 현재 스테이지 보스 오행 조회 (이벤트 5 상성 판정용)
        const currentStage = stageStages.find(s => s.id === ctx.currentStageId)
        const bossEl = currentStage?.element !== 'neutral' ? currentStage?.element : undefined
        return (
          <EventScreen
            playerElement={ctx.playerElement}
            bossElement={bossEl}
            onComplete={handleEventComplete}
            onNeedRemoveCard={handleEventNeedRemoveCard}
          />
        )
      }

      case 'shop':
        return (
          <ShopScreen
            gold={ctx.gold ?? 0}
            heroHp={ctx.heroHp}
            heroMaxHp={ctx.heroMaxHp}
            onGoldChange={handleShopGoldChange}
            onHpRestore={handleShopHpRestore}
            onComplete={handleShopComplete}
            onRemoveCard={handleShopRemoveCard}
          />
        )

      case 'ending':
        return (
          <EndingScreen
            playerElement={ctx.playerElement}
            heroName={ctx.heroName}
            totalAttempts={stageClearedStageIds.size}
            unlockedCount={unlockOwnedCardIds.size}
            onRestart={handleRestart}
          />
        )

      default:
        return <OnboardingFlow onGameStart={handleOnboardingComplete} />
    }
  }

  return (
    <GameErrorBoundary onReset={handleErrorReset}>
      <>
        {renderScene()}
        {/* P3-A: 유물 획득 팝업 (scale bounce 연출) */}
        {relicPopupId && (
          <RelicAcquirePopup
            relicId={relicPopupId}
            onClose={() => setRelicPopupId(null)}
          />
        )}
      </>
    </GameErrorBoundary>
  )
}
