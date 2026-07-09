import type { PassiveId } from '@/types/paljapaeTypes'

export interface PassiveDef {
  id: PassiveId
  name: string
  description: string
  grade: 'normal'
}

// 일반 등급 7종 (바이블 3-4 기준)
export const PASSIVE_DEFS: Record<PassiveId, PassiveDef> = {
  sikshin: {
    id: 'sikshin',
    name: '식신(食神)',
    description: '결집 족보 배율 +1',
    grade: 'normal',
  },
  bigyeon: {
    id: 'bigyeon',
    name: '비견(比肩)',
    description: '결집 족보 기본치 +20',
    grade: 'normal',
  },
  geobje: {
    id: 'geobje',
    name: '겁재(劫財)',
    description: '버린 카드 1장당 다음 출수 기본치 +2',
    grade: 'normal',
  },
  sangkwan: {
    id: 'sangkwan',
    name: '상관(傷官)',
    description: '버리기 +1회, 최대 체력 -10',
    grade: 'normal',
  },
  pyeonjae: {
    id: 'pyeonjae',
    name: '편재(偏財)',
    description: '보상에 유물 등장 확률 2배',
    grade: 'normal',
  },
  jeongjae: {
    id: 'jeongjae',
    name: '정재(正財)',
    description: '층 보상 선택지 2개 → 3개',
    grade: 'normal',
  },
  pyeonin: {
    id: 'pyeonin',
    name: '편인(偏印)',
    description: '핸드 크기 8 → 9',
    grade: 'normal',
  },
}

export const ALL_PASSIVE_IDS = Object.keys(PASSIVE_DEFS) as PassiveId[]
