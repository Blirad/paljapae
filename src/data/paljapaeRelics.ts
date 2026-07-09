import type { RelicId } from '@/types/paljapaeTypes'

export interface RelicDef {
  id: RelicId
  name: string
  description: string
}

// 유물 4종 (바이블 3-5 기준)
export const RELIC_DEFS: Record<RelicId, RelicDef> = {
  pacheol: {
    id: 'pacheol',
    name: '패철(佩鐵)',
    description: '첫 출수 극 보너스 자동 적용',
  },
  ochsaek: {
    id: 'ochsaek',
    name: '오색실(五色絲)',
    description: '체인 족보 기본치 +15',
  },
  haetae: {
    id: 'haetae',
    name: '해태상(獬豸像)',
    description: '반격 피해 -3',
  },
  holibyeong: {
    id: 'holibyeong',
    name: '호리병(葫蘆甁)',
    description: '체력 30 이하일 때 모든 배율 +1',
  },
}

export const ALL_RELIC_IDS = Object.keys(RELIC_DEFS) as RelicId[]
