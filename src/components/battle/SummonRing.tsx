/**
 * SummonRing — 소환진 링 이펙트 (DOM 직접 생성 방식)
 * 리라 스펙 §1-A: 슬롯 착지 시 원형 링이 확산되며 사라지는 1회성 연출
 */

import gsap from 'gsap'

/**
 * 슬롯 착지 시 소환진 링을 emit한다.
 * @param slotEl - 슬롯 HTMLElement (getBoundingClientRect 기준)
 * @param color  - 오행 컬러
 */
export function emitSummonRing(slotEl: HTMLElement, color: string): void {
  const rect = slotEl.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // 메인 링
  const ring = document.createElement('div')
  ring.style.cssText = `
    position: fixed;
    left: ${cx}px;
    top: ${cy}px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px solid ${color};
    transform: translate(-50%, -50%) scale(0);
    pointer-events: none;
    z-index: 52;
    box-shadow: 0 0 8px ${color}80;
  `
  document.body.appendChild(ring)

  // 보조 링 (약간 지연)
  const ring2 = document.createElement('div')
  ring2.style.cssText = `
    position: fixed;
    left: ${cx}px;
    top: ${cy}px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid ${color}AA;
    transform: translate(-50%, -50%) scale(0);
    pointer-events: none;
    z-index: 52;
  `
  document.body.appendChild(ring2)

  gsap.to(ring, {
    scale: 2.5,
    opacity: 0,
    duration: 0.4,
    ease: 'power2.out',
    onComplete: () => {
      if (document.body.contains(ring)) document.body.removeChild(ring)
    },
  })

  gsap.to(ring2, {
    scale: 3.0,
    opacity: 0,
    duration: 0.5,
    delay: 0.05,
    ease: 'power2.out',
    onComplete: () => {
      if (document.body.contains(ring2)) document.body.removeChild(ring2)
    },
  })
}
