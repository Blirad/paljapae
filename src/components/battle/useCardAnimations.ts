/**
 * useCardAnimations — GSAP 기반 카드 애니메이션 훅 (M6)
 * 카드 소환, 공격, 데미지, 드로우, 승패 애니메이션
 */

import { useCallback } from 'react'
import gsap from 'gsap'

// ────────────────────────────────────────────────────
// 카드 소환 애니메이션 (손패 → 필드 슬롯)
// ────────────────────────────────────────────────────

/**
 * summonAnimation — 카드가 손패에서 필드로 날아가는 효과
 * @param fieldSlotEl 소환된 필드 슬롯 DOM 요소
 */
export function useSummonAnimation() {
  return useCallback((fieldSlotEl: HTMLElement | null) => {
    if (!fieldSlotEl) return
    gsap.fromTo(
      fieldSlotEl,
      { scale: 0.5, opacity: 0, y: 40 },
      {
        scale: 1,
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out',
      },
    )
  }, [])
}

// ────────────────────────────────────────────────────
// 공격 애니메이션 (공격 유닛 전진 → 복귀)
// ────────────────────────────────────────────────────

/**
 * attackAnimation — 공격 유닛이 대상 방향으로 전진 후 복귀
 * @param attackerEl 공격 유닛 DOM 요소
 * @param direction 'up'=AI 공격, 'down'=플레이어 공격
 */
export function useAttackAnimation() {
  return useCallback((
    attackerEl: HTMLElement | null,
    direction: 'up' | 'down' = 'up',
  ) => {
    if (!attackerEl) return
    const yOffset = direction === 'up' ? -18 : 18

    return gsap.timeline()
      .to(attackerEl, { y: yOffset, duration: 0.15, ease: 'power2.in' })
      .to(attackerEl, { y: 0, duration: 0.25, ease: 'power2.out' })
  }, [])
}

// ────────────────────────────────────────────────────
// 피격 애니메이션 (shake + flash)
// ────────────────────────────────────────────────────

/**
 * hitAnimation — 피격 유닛 shake + 빨간 flash
 * @param targetEl 피격 대상 DOM 요소
 */
export function useHitAnimation() {
  return useCallback((targetEl: HTMLElement | null) => {
    if (!targetEl) return

    return gsap.timeline()
      .to(targetEl, {
        x: -4,
        duration: 0.06,
        ease: 'none',
      })
      .to(targetEl, {
        x: 4,
        duration: 0.06,
        ease: 'none',
        repeat: 2,
        yoyo: true,
      })
      .to(targetEl, { x: 0, duration: 0.06 })
  }, [])
}

// ────────────────────────────────────────────────────
// 카드 드로우 애니메이션
// ────────────────────────────────────────────────────

/**
 * drawAnimation — 드로우된 카드가 손패에 슬라이드인
 * @param cardEls 드로우된 카드 DOM 요소들
 */
export function useDrawAnimation() {
  return useCallback((cardEls: (HTMLElement | null)[]) => {
    const validEls = cardEls.filter((el): el is HTMLElement => el !== null)
    if (validEls.length === 0) return

    gsap.fromTo(
      validEls,
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
        stagger: 0.1,
      },
    )
  }, [])
}

// ────────────────────────────────────────────────────
// 승패 화면 애니메이션
// ────────────────────────────────────────────────────

/**
 * victoryAnimation — 승리 파티클 + 텍스트 scale up
 * @param containerEl 결과 카드 DOM 요소
 */
export function useResultAnimation() {
  const victoryAnim = useCallback((containerEl: HTMLElement | null) => {
    if (!containerEl) return
    gsap.fromTo(
      containerEl,
      { scale: 0.75, opacity: 0, rotate: -2 },
      {
        scale: 1,
        opacity: 1,
        rotate: 0,
        duration: 0.55,
        ease: 'back.out(1.4)',
        delay: 0.15,
      },
    )
  }, [])

  const defeatAnim = useCallback((containerEl: HTMLElement | null) => {
    if (!containerEl) return
    gsap.timeline()
      .fromTo(
        containerEl,
        { scale: 1.05, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out', delay: 0.15 },
      )
      .to(containerEl, {
        x: -6,
        duration: 0.06,
        repeat: 5,
        yoyo: true,
        ease: 'none',
      })
      .to(containerEl, { x: 0, duration: 0.06 })
  }, [])

  return { victoryAnim, defeatAnim }
}

// ────────────────────────────────────────────────────
// AI 카드 소환 애니메이션 (아래→위 슬라이드인)
// ────────────────────────────────────────────────────

export function useAISummonAnimation() {
  return useCallback((fieldSlotEl: HTMLElement | null) => {
    if (!fieldSlotEl) return
    gsap.fromTo(
      fieldSlotEl,
      { y: 30, opacity: 0, scale: 0.85 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.35,
        ease: 'power2.out',
      },
    )
  }, [])
}

// ────────────────────────────────────────────────────
// 빈 슬롯 hover 효과 (GSAP + CSS 혼합)
// ────────────────────────────────────────────────────

export function animateEmptySlotHover(el: HTMLElement, enter: boolean) {
  gsap.to(el, {
    scale: enter ? 1.05 : 1,
    duration: 0.15,
    ease: 'power1.out',
  })
}
