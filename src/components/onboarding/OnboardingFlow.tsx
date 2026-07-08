/**
 * OnboardingFlow — 온보딩 4화면 흐름 관리
 * 리라 스펙 §6 화면 간 전환 명세
 * 온보딩 완료 시 Zustand onboardingStore + gameStore에 결과 저장
 */
import React, { useState, useCallback } from 'react'
import OnboardingStep0 from './OnboardingStep0'
import OnboardingScreen1 from './OnboardingScreen1'
import OnboardingScreen2 from './OnboardingScreen2'
import OnboardingScreen3 from './OnboardingScreen3'
import OnboardingScreen4 from './OnboardingScreen4'
import type { SajuResult, ThreePillars } from '@/game/saju/manseryeok'
import { useOnboardingStore, HERO_DATA, createStartingDeck } from '@/game/store/onboardingStore'

interface OnboardingFlowProps {
  onGameStart: () => void
}

type Step = 0 | 1 | 2 | 3 | 4

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_YEAR = CURRENT_YEAR - 25

export default function OnboardingFlow({ onGameStart }: OnboardingFlowProps): React.ReactElement {
  const [step, setStep] = useState<Step>(0)
  const [sajuResult, setSajuResult] = useState<SajuResult | null>(null)
  const [_pillars, setPillars] = useState<ThreePillars | null>(null)
  const setOnboardingResult = useOnboardingStore(s => s.setOnboardingResult)

  const handleScreen1Complete = useCallback((result: SajuResult, pillars: ThreePillars) => {
    setSajuResult(result)
    setPillars(pillars)
    setStep(2)
  }, [])

  const handleScreen2Next = useCallback(() => setStep(3), [])
  const handleScreen2Back = useCallback(() => setStep(1), [])

  const handleScreen3Next = useCallback(() => setStep(4), [])
  const handleScreen3Back = useCallback(() => setStep(2), [])

  const handleScreen4Back = useCallback(() => setStep(3), [])

  const handleStart = useCallback(() => {
    if (!sajuResult) return

    const { primaryElement } = sajuResult
    const hero = HERO_DATA[primaryElement]
    const deck = createStartingDeck(primaryElement)

    setOnboardingResult({
      birthYear: 0,
      birthMonth: 0,
      birthDay: 0,
      primaryElement,
      hero,
      startingDeck: deck,
    })

    onGameStart()
  }, [sajuResult, setOnboardingResult, onGameStart])

  if (step === 0) {
    return <OnboardingStep0 onNext={() => setStep(1)} />
  }

  if (step === 1) {
    return (
      <OnboardingScreen1
        initialYear={DEFAULT_YEAR}
        onComplete={handleScreen1Complete}
      />
    )
  }

  if (step === 2 && sajuResult) {
    return (
      <OnboardingScreen2
        sajuResult={sajuResult}
        onNext={handleScreen2Next}
        onBack={handleScreen2Back}
      />
    )
  }

  if (step === 3 && sajuResult) {
    return (
      <OnboardingScreen3
        primaryElement={sajuResult.primaryElement}
        onNext={handleScreen3Next}
        onBack={handleScreen3Back}
      />
    )
  }

  if (step === 4 && sajuResult) {
    const deck = createStartingDeck(sajuResult.primaryElement)
    return (
      <OnboardingScreen4
        primaryElement={sajuResult.primaryElement}
        deck={deck}
        onStart={handleStart}
        onBack={handleScreen4Back}
      />
    )
  }

  // Fallback (shouldn't reach)
  return (
    <OnboardingScreen1
      initialYear={DEFAULT_YEAR}
      onComplete={handleScreen1Complete}
    />
  )
}
