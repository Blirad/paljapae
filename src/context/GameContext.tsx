/**
 * 팔자전 — GameContext
 * 전역 playbackSpeed 상태 관리 (1x / 2x 배속 토글)
 * Section 5, line 93: 설정에 1x/2x 제공 (모든 duration ÷ 2)
 */

import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

interface GameContextValue {
  playbackSpeed: 1 | 2
  togglePlaybackSpeed: () => void
  /** 기본 duration(ms)을 배속 적용하여 반환 */
  getDuration: (baseDurationMs: number) => number
  /** CSS용: 기본 duration(ms)을 배속 적용하여 '0.Xs' 문자열 반환 */
  getCssDuration: (baseDurationMs: number) => string
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameContextProvider({ children }: { children: ReactNode }) {
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1)

  const togglePlaybackSpeed = useCallback(() => {
    setPlaybackSpeed(prev => (prev === 1 ? 2 : 1))
  }, [])

  const getDuration = useCallback(
    (baseDurationMs: number) => baseDurationMs / playbackSpeed,
    [playbackSpeed]
  )

  const getCssDuration = useCallback(
    (baseDurationMs: number) => `${baseDurationMs / playbackSpeed / 1000}s`,
    [playbackSpeed]
  )

  return (
    <GameContext.Provider
      value={{ playbackSpeed, togglePlaybackSpeed, getDuration, getCssDuration }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) {
    throw new Error('useGameContext must be used within GameContextProvider')
  }
  return ctx
}
