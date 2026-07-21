/**
 * 팔자전 八字戰 — App 진입점 (Phase 2)
 * - localStorage 영구 저장 (paljajeon_hero_profile)
 * - 재방문 시 사주 재입력 없이 홈으로 바로 진행
 * - 8개 화면만. 라우팅 clean.
 */

import { useState, useCallback, useEffect } from 'react'
import './index.css'

import { GameContextProvider } from './context/GameContext'
import TitleScreen from './components/TitleScreen'
import SajuInputScreen from './components/SajuInputScreen'
import HomeScreen from './components/HomeScreen'
import BattleScreen from './components/BattleScreen'
import FloorRewardScreen from './components/FloorRewardScreen'
import ResultScreen from './components/ResultScreen'
import PreBattleScreen from './components/PreBattleScreen'
import DeckPrepScreen from './components/DeckPrepScreen'

import type { SajuInfo, SavedHeroProfile, Card } from './types/game'
import { HERO_PROFILE_STORAGE_KEY } from './types/game'
import type { Passive } from './types/passive'
import { useGameStore } from './stores/gameStore'
import { getSajuFromSolar, getSajuFromLunar, getSajuElementDistribution } from './engine/manseryeok'
import { calcDeckSeed } from './engine/heroes'

type Screen =
  | 'title'
  | 'sajuInput'
  | 'home'
  | 'preBattle'
  | 'deckPrep'
  | 'battle'
  | 'floorReward'
  | 'result'

/** localStorage → SavedHeroProfile 로드 */
function loadHeroProfile(): SavedHeroProfile | null {
  try {
    const raw = localStorage.getItem(HERO_PROFILE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SavedHeroProfile
  } catch {
    return null
  }
}

/** SavedHeroProfile → localStorage 저장 */
function saveHeroProfile(profile: SavedHeroProfile): void {
  try {
    localStorage.setItem(HERO_PROFILE_STORAGE_KEY, JSON.stringify(profile))
    console.log('[SajuSave] ✅ 사주 저장 완료:', {
      ilganChar: profile.ilganChar,
      elementDist: profile.elementDist,
      deckSeed: profile.deckSeed,
    })
  } catch (e) {
    // 저장 실패는 조용히 무시 (safari private 모드 등)
    console.error('[SajuSave] ❌ 저장 실패:', e)
  }
}

/** 삭제 */
function clearHeroProfile(): void {
  try {
    localStorage.removeItem(HERO_PROFILE_STORAGE_KEY)
  } catch {
    // noop
  }
}

/** SajuInfo → SavedHeroProfile 생성 */
function buildHeroProfile(saju: SajuInfo): SavedHeroProfile {
  const { birthYear: y, birthMonth: m, birthDay: d, birthHour: h, isLunar } = saju

  const sajuResult = isLunar
    ? getSajuFromLunar(y, m, d, false, h)
    : getSajuFromSolar(y, m, d, h)

  const elementDist = getSajuElementDistribution(y, m, d, h, isLunar)
  const deckSeed = calcDeckSeed(y, m, d)

  console.log('[BuildProfile] 사주 프로필 생성:', {
    ilganChar: sajuResult.day.cheonganChar,
    ilganElement: sajuResult.day.cheonganElement,
    elementDist,
    deckSeed,
  })

  return {
    sajuInfo: saju,
    dayPillarChar: sajuResult.day.char,
    ilganChar: sajuResult.day.cheonganChar,
    ilganElement: sajuResult.day.cheonganElement,
    iljiChar: sajuResult.day.jijiChar,
    elementDist,
    deckSeed,
    savedAt: new Date().toISOString(),
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [sajuInfo, setSajuInfo] = useState<SajuInfo | null>(null)
  const [heroProfile, setHeroProfile] = useState<SavedHeroProfile | null>(null)
  const [drawnCards] = useState<Card[]>([])
  const [selectedPassives, setSelectedPassives] = useState<Passive[]>([])
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)

  const {
    currentFloor,
    isVictory,
    floorsCleared,
    relics,
    sinsalInventory,
    startGame,
    proceedToNextFloor,
  } = useGameStore()

  // 마운트 시 localStorage 체크
  useEffect(() => {
    const saved = loadHeroProfile()
    if (saved) {
      setHeroProfile(saved)
      setSajuInfo(saved.sajuInfo)
    }
  }, [])

  const handleTitleStart = useCallback(() => {
    if (sajuInfo) {
      setScreen('home')
    } else {
      setScreen('sajuInput')
    }
  }, [sajuInfo])

  const handleSajuComplete = useCallback((saju: SajuInfo) => {
    setSajuInfo(saju)
    const profile = buildHeroProfile(saju)
    setHeroProfile(profile)
    saveHeroProfile(profile)
    setScreen('home')
  }, [])

  const handleNewRun = useCallback(() => {
    setScreen('preBattle')
  }, [])

  const handlePreBattleComplete = useCallback((passives: Passive[]) => {
    setSelectedPassives(passives)
    // Phase 1.8: "오늘의 패" 중간 화면 폐기 — PreBattle 완료 후 바로 전투 진입
    startGame()
    setScreen('battle')
  }, [startGame])

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

  const handleFloorRewardProceed = useCallback((rewardIndex: number, selectedRelicId?: string, selectedSinsalId?: string) => {
    proceedToNextFloor(rewardIndex, selectedRelicId, selectedSinsalId)
    setScreen('battle')
  }, [proceedToNextFloor])

  const handleRetry = useCallback(() => {
    setScreen('preBattle')
  }, [])

  const handleHome = useCallback(() => {
    setScreen('home')
  }, [])

  /** 사주 재입력 — localStorage 삭제 후 사주 입력 화면으로 */
  const handleResetSaju = useCallback(() => {
    clearHeroProfile()
    setSajuInfo(null)
    setHeroProfile(null)
    setScreen('sajuInput')
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
        <HomeScreen
          onNewRun={handleNewRun}
          wins={wins}
          losses={losses}
          heroProfile={heroProfile}
          onResetSaju={handleResetSaju}
        />
      )}
      {screen === 'preBattle' && (
        <PreBattleScreen
          hand={drawnCards}
          onComplete={handlePreBattleComplete}
          heroProfile={heroProfile}
        />
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
        <FloorRewardScreen
          currentFloor={currentFloor}
          currentRelicIds={relics.map(r => r.id)}
          currentSinsalInventory={sinsalInventory}
          onProceed={handleFloorRewardProceed}
        />
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
