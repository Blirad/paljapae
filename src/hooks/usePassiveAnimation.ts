/**
 * 팔자전 — 패시브 발동 애니메이션 훅
 *
 * 패시브 발동 순간:
 *  - 해당 카드 플래시 (흰 빛)
 *  - 중앙 띠: "식신 발동!" 배너 (1초간)
 *  - 숫자 상향 애니메이션 (족보 배율 상향 시)
 *
 * 사운드: audioManager.affinityBonusGong() 활용 (신비로운 종소리 대체)
 */

import { useState, useCallback, useRef } from 'react'
import { audioManager } from '../services/audioManager'

export interface PassiveActivationState {
  isActive: boolean
  passiveId: string | null
  passiveName: string | null
  bannerVisible: boolean
  flashCardId: string | null
}

export interface UsePassiveAnimationReturn {
  activationState: PassiveActivationState
  triggerPassiveActivation: (passiveId: string, passiveName: string, cardId: string) => void
  clearActivation: () => void
}

export function usePassiveAnimation(): UsePassiveAnimationReturn {
  const [activationState, setActivationState] = useState<PassiveActivationState>({
    isActive: false,
    passiveId: null,
    passiveName: null,
    bannerVisible: false,
    flashCardId: null,
  })

  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerPassiveActivation = useCallback((
    passiveId: string,
    passiveName: string,
    cardId: string
  ) => {
    // 기존 타이머 정리
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)

    // 신비로운 종소리 (affinityBonusGong 재활용)
    audioManager.affinityBonusGong()

    setActivationState({
      isActive: true,
      passiveId,
      passiveName,
      bannerVisible: true,
      flashCardId: cardId,
    })

    // 플래시 효과 200ms 후 종료
    flashTimerRef.current = setTimeout(() => {
      setActivationState(prev => ({ ...prev, flashCardId: null }))
    }, 200)

    // 배너 1000ms 후 숨기기
    bannerTimerRef.current = setTimeout(() => {
      setActivationState(prev => ({
        ...prev,
        bannerVisible: false,
        isActive: false,
        passiveId: null,
        passiveName: null,
      }))
    }, 1000)
  }, [])

  const clearActivation = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setActivationState({
      isActive: false,
      passiveId: null,
      passiveName: null,
      bannerVisible: false,
      flashCardId: null,
    })
  }, [])

  return { activationState, triggerPassiveActivation, clearActivation }
}
