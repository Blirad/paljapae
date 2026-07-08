/**
 * 운명카드전 20영웅 데이터
 * Phase 1 — 10천간(天干) × 2성별
 *
 * 이미지:
 *  - jiamuk_male  → unmyeong_phase1_images/unmyeong_hero_jiamuk_male_card.png
 *  - yimuk_female → unmyeong_phase1_images/unmyeong_hero_yimuk_female_card.png
 *  - bingfire_male → unmyeong_phase1_images/unmyeong_hero_bingfire_male_card.png
 *  - genggold_male → unmyeong_phase1_images/unmyeong_hero_genggold_male_card.png
 *  - guishui_male  → unmyeong_phase1_images/unmyeong_hero_guishui_male_card.png
 *  나머지는 color 기반 placeholder (imagePath: undefined)
 */

import type { HeroData } from '@/types/hero'

// ────────────────────────────────────────────────────
// 木 영웅 (4명)
// ────────────────────────────────────────────────────

export const HERO_JIAMUK_MALE: HeroData = {
  id: 'jiamuk_male',
  stem: 'jiamuk',
  gender: 'male',
  name: '갑목 장군',
  wuxing: '木',
  color: '#1a5c3a',
  baseHP: 30,
  baseEnergy: 3,
  imagePath: '/unmyeong_phase1_images/unmyeong_hero_jiamuk_male_card.png',
  description: '우람한 고목처럼 굳센 대장군. 전선을 압도하는 강인한 힘을 지닌다.',
}

export const HERO_JIAMUK_FEMALE: HeroData = {
  id: 'jiamuk_female',
  stem: 'jiamuk',
  gender: 'female',
  name: '갑목 여협',
  wuxing: '木',
  color: '#1a5c3a',
  baseHP: 28,
  baseEnergy: 3,
  imagePath: undefined,
  description: '숲속 깊이 수련한 여협사. 자연의 생명력을 무기로 삼는다.',
}

export const HERO_YIMUK_MALE: HeroData = {
  id: 'yimuk_male',
  stem: 'yimuk',
  gender: 'male',
  name: '을목 도사',
  wuxing: '木',
  color: '#4db84d',
  baseHP: 26,
  baseEnergy: 4,
  imagePath: undefined,
  description: '유연한 덩굴처럼 적의 허를 찌르는 기교파 도사.',
}

export const HERO_YIMUK_FEMALE: HeroData = {
  id: 'yimuk_female',
  stem: 'yimuk',
  gender: 'female',
  name: '을목 선녀',
  wuxing: '木',
  color: '#4db84d',
  baseHP: 25,
  baseEnergy: 4,
  imagePath: '/unmyeong_phase1_images/unmyeong_hero_yimuk_female_card.png',
  description: '봄바람을 타고 날아드는 선녀. 치유와 성장의 마법을 구사한다.',
}

// ────────────────────────────────────────────────────
// 火 영웅 (4명)
// ────────────────────────────────────────────────────

export const HERO_BINGFIRE_MALE: HeroData = {
  id: 'bingfire_male',
  stem: 'bingfire',
  gender: 'male',
  name: '병화 화신',
  wuxing: '火',
  color: '#cc0000',
  baseHP: 28,
  baseEnergy: 3,
  imagePath: '/unmyeong_phase1_images/unmyeong_hero_bingfire_male_card.png',
  description: '태양의 정기를 받은 화신. 광명과 화염으로 적진을 불태운다.',
}

export const HERO_BINGFIRE_FEMALE: HeroData = {
  id: 'bingfire_female',
  stem: 'bingfire',
  gender: 'female',
  name: '병화 무녀',
  wuxing: '火',
  color: '#cc0000',
  baseHP: 26,
  baseEnergy: 4,
  imagePath: undefined,
  description: '화염 의식을 집전하는 무녀. 불의 예언으로 전장을 지배한다.',
}

export const HERO_JUNGFIRE_MALE: HeroData = {
  id: 'jungfire_male',
  stem: 'jungfire',
  gender: 'male',
  name: '정화 검사',
  wuxing: '火',
  color: '#ff6600',
  baseHP: 25,
  baseEnergy: 4,
  imagePath: undefined,
  description: '촛불처럼 작지만 정교한 불꽃 검사. 정밀한 화염 공격이 특기.',
}

export const HERO_JUNGFIRE_FEMALE: HeroData = {
  id: 'jungfire_female',
  stem: 'jungfire',
  gender: 'female',
  name: '정화 술사',
  wuxing: '火',
  color: '#ff6600',
  baseHP: 24,
  baseEnergy: 5,
  imagePath: undefined,
  description: '작은 화염을 자유자재로 다루는 정화 술사. 속도와 연타가 강점.',
}

// ────────────────────────────────────────────────────
// 土 영웅 (4명)
// ────────────────────────────────────────────────────

export const HERO_MOOTU_MALE: HeroData = {
  id: 'mootu_male',
  stem: 'mootu',
  gender: 'male',
  name: '무토 장벽사',
  wuxing: '土',
  color: '#8b6914',
  baseHP: 35,
  baseEnergy: 3,
  imagePath: undefined,
  description: '산악처럼 웅장한 대지의 수호자. 철벽 방어로 팀을 지킨다.',
}

export const HERO_MOOTU_FEMALE: HeroData = {
  id: 'mootu_female',
  stem: 'mootu',
  gender: 'female',
  name: '무토 대지신녀',
  wuxing: '土',
  color: '#8b6914',
  baseHP: 33,
  baseEnergy: 3,
  imagePath: undefined,
  description: '대지의 힘을 빌려 싸우는 신녀. 땅의 기운으로 아군을 강화한다.',
}

export const HERO_GITU_MALE: HeroData = {
  id: 'gitu_male',
  stem: 'gitu',
  gender: 'male',
  name: '기토 농장주',
  wuxing: '土',
  color: '#c8a96e',
  baseHP: 30,
  baseEnergy: 3,
  imagePath: undefined,
  description: '비옥한 대지를 다스리는 농장주. 자원을 쌓고 후반을 지배한다.',
}

export const HERO_GITU_FEMALE: HeroData = {
  id: 'gitu_female',
  stem: 'gitu',
  gender: 'female',
  name: '기토 약초사',
  wuxing: '土',
  color: '#c8a96e',
  baseHP: 28,
  baseEnergy: 4,
  imagePath: undefined,
  description: '대지의 약초로 치유하는 약초사. 전투 중 꾸준한 회복이 특기.',
}

// ────────────────────────────────────────────────────
// 金 영웅 (4명)
// ────────────────────────────────────────────────────

export const HERO_GENGGOLD_MALE: HeroData = {
  id: 'genggold_male',
  stem: 'genggold',
  gender: 'male',
  name: '경금 철기장수',
  wuxing: '金',
  color: '#c0c0c0',
  baseHP: 30,
  baseEnergy: 3,
  imagePath: '/unmyeong_phase1_images/unmyeong_hero_genggold_male_card.png',
  description: '단단한 쇠처럼 강철 의지의 철기장수. 강력한 관통 공격을 구사한다.',
}

export const HERO_GENGGOLD_FEMALE: HeroData = {
  id: 'genggold_female',
  stem: 'genggold',
  gender: 'female',
  name: '경금 검녀',
  wuxing: '金',
  color: '#c0c0c0',
  baseHP: 27,
  baseEnergy: 4,
  imagePath: undefined,
  description: '날카로운 금속 정기로 단련된 검녀. 냉철한 판단과 빠른 베기.',
}

export const HERO_SINGOLD_MALE: HeroData = {
  id: 'singold_male',
  stem: 'singold',
  gender: 'male',
  name: '신금 보석사',
  wuxing: '金',
  color: '#ffd700',
  baseHP: 26,
  baseEnergy: 4,
  imagePath: undefined,
  description: '정제된 황금 기운의 보석사. 빛나는 기운으로 적을 눈멀게 한다.',
}

export const HERO_SINGOLD_FEMALE: HeroData = {
  id: 'singold_female',
  stem: 'singold',
  gender: 'female',
  name: '신금 황금선녀',
  wuxing: '金',
  color: '#ffd700',
  baseHP: 25,
  baseEnergy: 5,
  imagePath: undefined,
  description: '황금빛을 휘두르는 선녀. 금속의 예리함과 화려함을 겸비한다.',
}

// ────────────────────────────────────────────────────
// 水 영웅 (4명)
// ────────────────────────────────────────────────────

export const HERO_IMSUIL_MALE: HeroData = {
  id: 'imsuil_male',
  stem: 'imsuil',
  gender: 'male',
  name: '임수 현사',
  wuxing: '水',
  color: '#1a3a5c',
  baseHP: 28,
  baseEnergy: 3,
  imagePath: undefined,
  description: '깊은 바다의 기운을 다루는 현사. 냉기와 얼음으로 전장을 제어한다.',
}

export const HERO_IMSUIL_FEMALE: HeroData = {
  id: 'imsuil_female',
  stem: 'imsuil',
  gender: 'female',
  name: '임수 빙령',
  wuxing: '水',
  color: '#1a3a5c',
  baseHP: 26,
  baseEnergy: 4,
  imagePath: undefined,
  description: '겨울 강물처럼 냉혹한 빙령. 얼음 주문으로 적 전선을 통제한다.',
}

export const HERO_GUISHUI_MALE: HeroData = {
  id: 'guishui_male',
  stem: 'guishui',
  gender: 'male',
  name: '계수 음양사',
  wuxing: '水',
  color: '#4169e1',
  baseHP: 25,
  baseEnergy: 4,
  imagePath: '/unmyeong_phase1_images/unmyeong_hero_guishui_male_card.png',
  description: '별빛 같은 수기를 다루는 음양사. 생명력 흡수와 카드 드로우가 특기.',
}

export const HERO_GUISHUI_FEMALE: HeroData = {
  id: 'guishui_female',
  stem: 'guishui',
  gender: 'female',
  name: '계수 천기녀',
  wuxing: '水',
  color: '#4169e1',
  baseHP: 24,
  baseEnergy: 5,
  imagePath: undefined,
  description: '하늘의 수기를 읽는 천기녀. 미래를 내다보며 카드를 지배한다.',
}

// ────────────────────────────────────────────────────
// 전체 영웅 배열
// ────────────────────────────────────────────────────

export const ALL_HEROES: HeroData[] = [
  // 木
  HERO_JIAMUK_MALE,
  HERO_JIAMUK_FEMALE,
  HERO_YIMUK_MALE,
  HERO_YIMUK_FEMALE,
  // 火
  HERO_BINGFIRE_MALE,
  HERO_BINGFIRE_FEMALE,
  HERO_JUNGFIRE_MALE,
  HERO_JUNGFIRE_FEMALE,
  // 土
  HERO_MOOTU_MALE,
  HERO_MOOTU_FEMALE,
  HERO_GITU_MALE,
  HERO_GITU_FEMALE,
  // 金
  HERO_GENGGOLD_MALE,
  HERO_GENGGOLD_FEMALE,
  HERO_SINGOLD_MALE,
  HERO_SINGOLD_FEMALE,
  // 水
  HERO_IMSUIL_MALE,
  HERO_IMSUIL_FEMALE,
  HERO_GUISHUI_MALE,
  HERO_GUISHUI_FEMALE,
]

/** 오행별 영웅 풀 */
export const HEROES_BY_WUXING: Record<string, HeroData[]> = {
  木: ALL_HEROES.filter(h => h.wuxing === '木'),
  火: ALL_HEROES.filter(h => h.wuxing === '火'),
  土: ALL_HEROES.filter(h => h.wuxing === '土'),
  金: ALL_HEROES.filter(h => h.wuxing === '金'),
  水: ALL_HEROES.filter(h => h.wuxing === '水'),
}

/** ID로 영웅 조회 */
export function getHeroById(id: string): HeroData | undefined {
  return ALL_HEROES.find(h => h.id === id)
}
