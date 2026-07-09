/**
 * 팔자전 八字戰 — App 진입점
 * 8개 화면만. 라우팅 clean.
 * 영웅 선택 화면 없음. 에너지 없음.
 */

import { useState, useCallback } from 'react'
import './index.css'

import { GameContextProvider } from './context/GameContext'
import TitleScreen from './components/TitleScreen'
import SajuInputScreen from './components/SajuInputScreen'
import HomeScreen from './components/HomeScreen'
import DailyDrawScreen from './components/DailyDrawScreen'
import DeckPrepScreen from './components/DeckPrepScreen'
import BattleScreen from './components/BattleScreen'
import FloorRewardScreen from './components/FloorRewardScreen'
import ResultScreen from './components/ResultScreen'
import PassiveDraftScreen from './components/PassiveDraftScreen'

import type { SajuInfo, Card } from './types/game'
import type { Passive } from './types/passive'
import { useGameStore } from './stores/gameStore'

type Screen =
  | 'title'
  | 'sajuInput'
  | 'home'
  | 'dailyDraw'      // 오늘의 패
  | 'passiveDraft'   // 패시브 드래프트
  | 'deckPrep'
  | 'battle'
  | 'floorReward'
  | 'result'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [sajuInfo, setSajuInfo] = useState<SajuInfo | null>(null)
  const [drawnCards, setDrawnCards] = useState<Card[]>([])
  const [selectedPassives, setSelectedPassives] = useState<Passive[]>([])
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)

  const {
    currentFloor,
    isVictory,
    floorsCleared,
    startGame,
    proceedToNextFloor,
  } = useGameStore()

  const handleTitleStart = useCallback(() => {
    // 기존 사주 있으면 홈으로, 없으면 사주입력으로
    if (sajuInfo) {
      setScreen('home')
    } else {
      setScreen('sajuInput')
    }
  }, [sajuInfo])

  const handleSajuComplete = useCallback((saju: SajuInfo) => {
    setSajuInfo(saju)
    setScreen('home')
  }, [])

  const handleNewRun = useCallback(() => {
    setScreen('dailyDraw')
  }, [])

  const handleDailyDrawProceed = useCallback((cards: Card[]) => {
    setDrawnCards(cards)
    setScreen('passiveDraft')
  }, [])

  const handlePassiveDraftComplete = useCallback((passives: Passive[]) => {
    setSelectedPassives(passives)
    setScreen('deckPrep')
  }, [])

  const handleDeckPrepStart = useCallback((_cards: Card[]) => {
    startGame()
    setScreen('battle')
  }, [startGame])

  const handleFloorClear = useCallback(() => {
    setScreen('floorReward')
  }, [])

  const handleResult = useCallback((victory: boolean) => {
    if (victory) {
      setWins(w => w + 1)
    } else {
      setLosses(l => l + 1)
    }
    setScreen('result')
  }, [])

  const handleFloorRewardProceed = useCallback(() => {
    proceedToNextFloor()
    setScreen('battle')
  }, [proceedToNextFloor])

  const handleRetry = useCallback(() => {
    setScreen('dailyDraw')
  }, [])

  const handleHome = useCallback(() => {
    setScreen('home')
  }, [])

  return (
    <GameContextProvider>
    <div style={{ backgroundColor: '#16130F', minHeight: '100vh' }}>
      {screen === 'title' && (
        <TitleScreen onStart={handleTitleStart} />
      )}
      {screen === 'sajuInput' && (
        <SajuInputScreen onComplete={handleSajuComplete} />
      )}
      {screen === 'home' && (
        <HomeScreen onNewRun={handleNewRun} wins={wins} losses={losses} />
      )}
      {screen === 'dailyDraw' && (
        <DailyDrawScreen onProceed={handleDailyDrawProceed} />
      )}
      {screen === 'passiveDraft' && (
        <PassiveDraftScreen onComplete={handlePassiveDraftComplete} />
      )}
      {screen === 'deckPrep' && (
        <DeckPrepScreen hand={drawnCards} onStartBattle={handleDeckPrepStart} />
      )}
      {screen === 'battle' && (
        <BattleScreen
          onFloorClear={handleFloorClear}
          onResult={handleResult}
          passives={selectedPassives}
        />
      )}
      {screen === 'floorReward' && (
        <FloorRewardScreen currentFloor={currentFloor} onProceed={handleFloorRewardProceed} />
      )}
      {screen === 'result' && (
        <ResultScreen
          isVictory={isVictory}
          floorsCleared={floorsCleared}
          onRetry={handleRetry}
          onHome={handleHome}
        />
      )}
    </div>
    </GameContextProvider>
  )
}
