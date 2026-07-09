/**
 * 팔자전 — 영웅 시스템 (Phase 2)
 * 60일주 = 일간 10종 × 일지 12종
 * 바이블 §2-4, 지시서 P2-2
 */

import type { Element } from '../types/game'

/** 일간 원형 10종 */
export interface DaystemsArchetype {
  char: string         // 甲 乙 丙 ...
  name: string         // 갑목 대장군
  element: Element
  polarity: 'yang' | 'yin'
  title: string        // 무협풍 칭호
  description: string  // 2~3줄 설명
}

export const DAYSTEM_ARCHETYPES: DaystemsArchetype[] = [
  {
    char: '甲',
    name: '갑목(甲木)',
    element: 'mok',
    polarity: 'yang',
    title: '대장군',
    description: '하늘을 향해 곧게 솟은 나무. 굴하지 않는 의지로 어둠을 가르며 길을 연다. 그 뜻이 굳으면 산도 비켜선다.',
  },
  {
    char: '乙',
    name: '을목(乙木)',
    element: 'mok',
    polarity: 'yin',
    title: '약사',
    description: '바람에 흔들려도 꺾이지 않는 풀. 부드러움으로 강함을 이기며, 상처 입은 자를 고치는 손길을 가졌다.',
  },
  {
    char: '丙',
    name: '병화(丙火)',
    element: 'hwa',
    polarity: 'yang',
    title: '화공',
    description: '태양의 기운을 품은 불길. 모든 것을 태우는 열기 속에서도 따스함을 잃지 않는 전사.',
  },
  {
    char: '丁',
    name: '정화(丁火)',
    element: 'hwa',
    polarity: 'yin',
    title: '등불',
    description: '밤을 밝히는 작은 불꽃. 폭풍 속에서도 꺼지지 않으며, 그 빛으로 헤매는 자에게 길을 보인다.',
  },
  {
    char: '戊',
    name: '무토(戊土)',
    element: 'to',
    polarity: 'yang',
    title: '성벽',
    description: '산처럼 묵직하고 땅처럼 너른 방패. 모든 공격을 받아내며 뒤에 있는 자를 지켜내는 철벽.',
  },
  {
    char: '己',
    name: '기토(己土)',
    element: 'to',
    polarity: 'yin',
    title: '농부',
    description: '만물을 품어 길러내는 대지. 씨앗에서 열매까지, 묵묵히 기르고 쌓아가는 인내의 힘.',
  },
  {
    char: '庚',
    name: '경금(庚金)',
    element: 'geum',
    polarity: 'yang',
    title: '장검',
    description: '벼려진 쇳덩이가 된 검. 냉혹하고 날카로운 판단으로 불필요한 것을 잘라낸다.',
  },
  {
    char: '辛',
    name: '신금(辛金)',
    element: 'geum',
    polarity: 'yin',
    title: '보검',
    description: '정교하게 다듬어진 보석과 칼. 아름다움과 예리함을 동시에 품고, 진실을 꿰뚫는 눈을 가졌다.',
  },
  {
    char: '壬',
    name: '임수(壬水)',
    element: 'su',
    polarity: 'yang',
    title: '대해',
    description: '모든 것을 받아들이는 큰 바다. 깊이를 알 수 없는 지혜와 담대함으로 어떤 역경도 품어낸다.',
  },
  {
    char: '癸',
    name: '계수(癸水)',
    element: 'su',
    polarity: 'yin',
    title: '이슬',
    description: '새벽의 이슬처럼 섬세하고 순수한 직관. 보이지 않는 곳에서 만물을 적시며, 느리지만 반드시 흐른다.',
  },
]

/** 일지 영물 12종 */
export interface EarthlyBranchSpirit {
  char: string   // 子 丑 寅 ...
  animal: string // 쥐, 소, 호랑이 ...
  element: Element
  description: string
}

export const EARTHLY_BRANCH_SPIRITS: EarthlyBranchSpirit[] = [
  { char: '子', animal: '쥐',     element: 'su',   description: '어둠 속을 꿰뚫는 날카로운 감각. 그 민첩함은 적의 허점을 먼저 찾아낸다.' },
  { char: '丑', animal: '소',     element: 'to',   description: '느리지만 거스를 수 없는 힘. 한번 걷기 시작한 방향은 바꾸지 않는다.' },
  { char: '寅', animal: '호랑이', element: 'mok',  description: '산을 누비는 맹호. 그 포효 하나에 백 가지 두려움이 사라진다.' },
  { char: '卯', animal: '토끼',   element: 'mok',  description: '달빛 아래 춤추는 영혼. 재빠른 발걸음으로 어떤 함정도 벗어난다.' },
  { char: '辰', animal: '용',     element: 'to',   description: '구름 사이를 오르는 진룡. 변화무쌍하며 때를 기다릴 줄 안다.' },
  { char: '巳', animal: '뱀',     element: 'hwa',  description: '조용히 웅크린 지혜의 화신. 말없이 지켜보다 결정적인 순간에 움직인다.' },
  { char: '午', animal: '말',     element: 'hwa',  description: '거침없이 달려나가는 불길. 멈추지 않는 속도가 곧 무기다.' },
  { char: '未', animal: '양',     element: 'to',   description: '무리를 이끄는 온화한 힘. 부드러움으로 거칠어진 땅을 달랜다.' },
  { char: '申', animal: '원숭이', element: 'geum', description: '번뜩이는 재치와 기발한 꾀. 상대가 예측하지 못한 곳에서 나타난다.' },
  { char: '酉', animal: '닭',     element: 'geum', description: '새벽을 깨우는 예리한 울음. 거짓과 진실을 한눈에 가른다.' },
  { char: '戌', animal: '개',     element: 'to',   description: '주인을 위해 밤을 지키는 충성. 어떤 어둠도 그 경계 앞에서는 물러선다.' },
  { char: '亥', animal: '돼지',   element: 'su',   description: '대지에 풍요를 부르는 복의 수호자. 넉넉한 기운으로 주변을 살찌운다.' },
]

/** 영웅 프로필 (일간 원형 + 일지 영물 조합) */
export interface HeroProfile {
  /** 일주 한자 2글자 (예: 壬寅) */
  dayPillarChar: string
  /** 일간 원형 */
  archetype: DaystemsArchetype
  /** 일지 영물 */
  spirit: EarthlyBranchSpirit
  /** 오행 분포 */
  elementDist: Record<string, number>
  /** 유저 사주 */
  sajuYear: number
  sajuMonth: number
  sajuDay: number
  sajuHour?: number
  isLunar: boolean
  gender?: 'male' | 'female'
  /** 덱 시드 (생년월일 해시) */
  deckSeed: number
}

/** 천간 한자 → 아키타입 */
export function getArchetypeByChar(char: string): DaystemsArchetype | undefined {
  return DAYSTEM_ARCHETYPES.find(a => a.char === char)
}

/** 지지 한자 → 영물 */
export function getSpiritByChar(char: string): EarthlyBranchSpirit | undefined {
  return EARTHLY_BRANCH_SPIRITS.find(s => s.char === char)
}

/** 생년월일 해시 → 덱 시드 */
export function calcDeckSeed(year: number, month: number, day: number): number {
  // FNV-1a 간이 해시
  let hash = 2166136261
  for (const n of [year, month, day]) {
    hash ^= n
    hash = (hash * 16777619) >>> 0
  }
  return hash
}
