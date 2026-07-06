/**
 * battleColors — 전투 오행 파티클 컬러 팔레트
 * FieldArea.tsx + BattleParticles.tsx 공유 사용
 */

import type { FiveElement } from '@/types/elements'

export const PARTICLE_COLORS: Record<FiveElement, string[]> = {
  '木': ['#7EC87A', '#4CAF50', '#2E6B2A'],
  '火': ['#FF8C5A', '#C4604A', '#FF5A2A'],
  '土': ['#F0C84A', '#C9A84C', '#A07820'],
  '金': ['#C8E4F8', '#9AAAB8', '#5A8AB8'],
  '水': ['#64C8F8', '#4FC3F7', '#1A5A9A'],
}
