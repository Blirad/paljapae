/**
 * 팔자패/운명카드전 전체 카드 세트
 * 기존 73장 + 운명카드전 Phase 1 영웅 카드 27장 = 100장
 *
 * 분류:
 *  - 병사 카드 (오행 × 비용별): 40장
 *  - 효과 카드 (오행 × 타입별): 20장
 *  - 중립 카드: 8장
 *  - 전설 카드: 5장
 *  - 지휘관 카드 (Commander): 10장
 *  - 천상 카드 (Celestial): 1장
 *  - 영웅 전용 common/uncommon: 16장
 *  합계: 100장
 *
 * 밸런스 공식 (§9-1):
 *  공격력 + 체력 = (비용 × 2) + 1
 *  돌진: +1 비용 가산, 도발: +0.5, 독성: +1.5, 소환시 X피해: X×0.5
 */

import type { SoldierCard, SpellCard, Card } from '@/types/cards'
import { HERO_CARDS } from './heroCards'

// ────────────────────────────────────────────────────
// 木 병사 카드 (8장)
// ────────────────────────────────────────────────────

export const W01: SoldierCard = {
  id: 'W-01',
  name: '새싹 도사 (嫩芽道士)',
  cost: 1,
  element: '木',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 2,
  keywords: [],
  battlecry: '소환시 카드 1드로우',
  flavorText: '아직 풋내기지만 미래가 있어요',
}

export const W02: SoldierCard = {
  id: 'W-02',
  name: '덩굴 포박사 (蔓藤捕縛師)',
  cost: 2,
  element: '木',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 4,
  keywords: ['taunt'],
  battlecry: '소환시 적 유닛 1개의 공격력 -2 (1턴)',
  flavorText: '잡으면 절대 안 놓는 스타일',
}

export const W03: SoldierCard = {
  id: 'W-03',
  name: '숲의 호법 (林中護法)',
  cost: 3,
  element: '木',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 5,
  keywords: [],
  battlecry: '내 필드의 다른 木 유닛 모두 +1/+1',
  flavorText: '숲이 있는 한, 나는 지지 않는다',
}

export const W04: SoldierCard = {
  id: 'W-04',
  name: '죽림검객 (竹林劍客)',
  cost: 4,
  element: '木',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 4,
  keywords: [],
  battlecry: '공격 시 카드 1드로우',
  flavorText: '이 칼은 책을 많이 읽었다',
}

export const W07: SoldierCard = {
  id: 'W-07',
  name: '청룡 제자 (靑龍弟子)',
  cost: 1,
  element: '木',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 1,
  keywords: [],
  flavorText: '사부님을 닮고 싶어요 (아직 멀었음)',
}

export const W08: SoldierCard = {
  id: 'W-08',
  name: '나무 수호령 (木靈守護)',
  cost: 2,
  element: '木',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 3,
  keywords: ['poison'],
  flavorText: '독으로 자연을 지킨다. 환경 친화적 독살',
}

export const W09: SoldierCard = {
  id: 'W-09',
  name: '목기 장로 (木氣長老)',
  cost: 4,
  element: '木',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 6,
  keywords: ['taunt'],
  battlecry: '소환시 내 핸드에서 木 카드 1장 드로우 비용 -1',
  flavorText: '나무는 천천히 자라지만, 깊이 뿌리를 내린다',
}

export const W10: SoldierCard = {
  id: 'W-10',
  name: '고목 대수 (古木大樹)',
  cost: 5,
  element: '木',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 7,
  keywords: ['taunt', 'reborn'],
  flavorText: '천년 고목은 한 번 쓰러져도 다시 선다',
}

// ────────────────────────────────────────────────────
// 木 효과 카드 (4장)
// ────────────────────────────────────────────────────

export const W05: SpellCard = {
  id: 'W-05',
  name: '봄바람 주문 (春風術)',
  cost: 1,
  element: '木',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 유닛 1개에 +0/+2, 이번 턴 카드 1드로우',
  flavorText: '봄이 오면 다 나아진다',
}

export const W06: SpellCard = {
  id: 'W-06',
  name: '목기충천 (木氣衝天)',
  cost: 3,
  element: '木',
  rarity: 'uncommon',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 필드 모든 유닛 +1/+1. 카드 2드로우.',
  flavorText: '당신의 사주에 木이 넘친다',
}

export const W11: SpellCard = {
  id: 'W-11',
  name: '녹엽 회복 (綠葉回復)',
  cost: 2,
  element: '木',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 영웅 HP 3 회복. 카드 1드로우.',
  flavorText: '자연의 기운은 상처를 낫게 한다. 약값도 절약',
}

export const W12: SpellCard = {
  id: 'W-12',
  name: '덩굴 포박 (蔓藤捕縛)',
  cost: 2,
  element: '木',
  rarity: 'uncommon',
  cardType: 'spell',
  subtype: 'debuff',
  effectText: '적 유닛 1개 공격력 -3 (1턴). 해당 유닛 냉기 부여.',
  flavorText: '뿌리처럼 얽혀서 빠져나오기 어렵게',
}

// ────────────────────────────────────────────────────
// 火 병사 카드 (8장)
// ────────────────────────────────────────────────────

export const F01: SoldierCard = {
  id: 'F-01',
  name: '화염 소졸 (火焰小卒)',
  cost: 1,
  element: '火',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 1,
  keywords: ['rush'],
  flavorText: '먼저 치고 나중에 생각한다',
}

export const F03: SoldierCard = {
  id: 'F-03',
  name: '화산검객 (火山劍客)',
  cost: 3,
  element: '火',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 2,
  keywords: ['rush'],
  battlecry: '소환시 적 유닛 1개에 2 피해',
  flavorText: '뜨겁게 살다 짧게 죽자',
}

export const F04: SoldierCard = {
  id: 'F-04',
  name: '분노의 폭염사 (憤怒爆炎師)',
  cost: 4,
  element: '火',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 5,
  maxHealth: 3,
  keywords: [],
  battlecry: '내 유닛이 파괴될 때마다 적 영웅에 1 피해',
  flavorText: '날 죽이면 니도 다쳐',
}

export const F07: SoldierCard = {
  id: 'F-07',
  name: '화살비 궁수 (火矢弓手)',
  cost: 2,
  element: '火',
  rarity: 'common',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 2,
  keywords: [],
  battlecry: '소환시 적 영웅에 1 피해',
  flavorText: '조준하면 이미 늦었다',
}

export const F08: SoldierCard = {
  id: 'F-08',
  name: '화염 전사 (火焰戰士)',
  cost: 2,
  element: '火',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 3,
  keywords: ['rush'],
  flavorText: '모든 전투에 먼저 뛰어든다. 퇴직금은 없다',
}

export const F09: SoldierCard = {
  id: 'F-09',
  name: '화룡 기사 (火龍騎士)',
  cost: 4,
  element: '火',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 5,
  keywords: ['rush', 'incinerate'],
  flavorText: '불로 처치하면 재도 남지 않는다',
}

export const F10: SoldierCard = {
  id: 'F-10',
  name: '폭렬 마교주 (爆裂魔敎主)',
  cost: 5,
  element: '火',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 6,
  maxHealth: 4,
  keywords: ['rush'],
  battlecry: '소환시 모든 유닛에 1 피해',
  flavorText: '세상이 불타면 내가 이기지. 화재보험은 안 들었다',
}

export const F11: SoldierCard = {
  id: 'F-11',
  name: '불꽃 정령 (火焰精靈)',
  cost: 1,
  element: '火',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 2,
  keywords: [],
  flavorText: '작은 불씨도 시작은 있다',
}

// ────────────────────────────────────────────────────
// 火 효과 카드 (4장)
// ────────────────────────────────────────────────────

export const F02: SpellCard = {
  id: 'F-02',
  name: '불꽃 화살 (火矢)',
  cost: 1,
  element: '火',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '적 유닛 or 영웅에 2 피해',
  flavorText: '조준? 그냥 쏘면 됩니다',
}

export const F05: SpellCard = {
  id: 'F-05',
  name: '삼매진화 (三昧眞火)',
  cost: 3,
  element: '火',
  rarity: 'uncommon',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '적 필드 모든 유닛에 2 피해',
  flavorText: '불은 차별하지 않는다',
}

export const F06: SpellCard = {
  id: 'F-06',
  name: '화기충천 (火氣衝天)',
  cost: 2,
  element: '火',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 유닛 1개 +3/0. 이번 턴 돌진 부여.',
  flavorText: '너무 화나면 몸이 뜨거워진다',
}

export const F12: SpellCard = {
  id: 'F-12',
  name: '폭발 일격 (爆發一擊)',
  cost: 4,
  element: '火',
  rarity: 'rare',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '적 유닛 1개에 6 피해. 주변 유닛에도 2 피해.',
  flavorText: '일격으로 충분하다. 범위도 보너스',
}

// ────────────────────────────────────────────────────
// 土 병사 카드 (8장)
// ────────────────────────────────────────────────────

export const T01: SoldierCard = {
  id: 'T-01',
  name: '흙담 수비병 (土壁守兵)',
  cost: 2,
  element: '土',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 5,
  keywords: ['taunt'],
  flavorText: '느리지만, 절대 안 죽음',
}

export const T02: SoldierCard = {
  id: 'T-02',
  name: '황토 거인 (黃土巨人)',
  cost: 4,
  element: '土',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 8,
  keywords: ['taunt'],
  flavorText: '산처럼 버티는 것이 무공이다',
}

export const T03: SoldierCard = {
  id: 'T-03',
  name: '지맥 치유사 (地脈治癒師)',
  cost: 3,
  element: '土',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 4,
  keywords: [],
  battlecry: '턴 시작마다 영웅 HP +1 회복',
  flavorText: '땅에서 기를 받아 치유합니다',
}

export const T05: SoldierCard = {
  id: 'T-05',
  name: '돌벽 수호자 (石壁守護者)',
  cost: 1,
  element: '土',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 3,
  keywords: ['taunt'],
  flavorText: '1비용에 도발이라니, 이게 가성비 아닌가요',
}

export const T06: SoldierCard = {
  id: 'T-06',
  name: '황토 장군 (黃土將軍)',
  cost: 3,
  element: '土',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 5,
  keywords: [],
  battlecry: '소환시 내 영웅 HP 2 회복',
  flavorText: '땅의 기운으로 상처를 막는다',
}

export const T07: SoldierCard = {
  id: 'T-07',
  name: '부활 석상 (復活石像)',
  cost: 3,
  element: '土',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 4,
  keywords: ['reborn'],
  flavorText: '한 번은 부활한다. 두 번은 안 된다',
}

export const T08: SoldierCard = {
  id: 'T-08',
  name: '토지신 (土地神)',
  cost: 5,
  element: '土',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 7,
  keywords: ['taunt', 'reborn'],
  flavorText: '땅의 신은 두 번 죽어도 분노한다',
}

export const T09: SoldierCard = {
  id: 'T-09',
  name: '흙 갑옷 전사 (土甲戰士)',
  cost: 2,
  element: '土',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 4,
  keywords: [],
  flavorText: '진흙으로 만든 갑옷. 세탁비 절약',
}

// ────────────────────────────────────────────────────
// 土 효과 카드 (4장)
// ────────────────────────────────────────────────────

export const T04: SpellCard = {
  id: 'T-04',
  name: '요새 구축 (築城術)',
  cost: 2,
  element: '土',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'summon',
  effectText: '내 영웅 HP 4 회복. 도발 유닛 1/3 소환.',
  flavorText: '집에 있으면 이긴다',
}

export const T10: SpellCard = {
  id: 'T-10',
  name: '철옹성 방어 (鐵甕城守)',
  cost: 4,
  element: '土',
  rarity: 'rare',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 필드 모든 유닛 체력 +4. 이번 턴 피해 없음.',
  flavorText: '오늘만큼은 아무도 못 건드린다',
}

export const T11: SpellCard = {
  id: 'T-11',
  name: '대지 강화 (大地强化)',
  cost: 1,
  element: '土',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 유닛 1개에 +0/+3. 도발 부여.',
  flavorText: '땅처럼 든든해져라',
}

export const T12: SpellCard = {
  id: 'T-12',
  name: '황토 낙인 (黃土烙印)',
  cost: 3,
  element: '土',
  rarity: 'uncommon',
  cardType: 'spell',
  subtype: 'debuff',
  effectText: '적 유닛 1개 체력 4 이하이면 파괴. 내 영웅 HP 2 회복.',
  flavorText: '약한 적은 흙에 묻힌다',
}

// ────────────────────────────────────────────────────
// 金 병사 카드 (8장)
// ────────────────────────────────────────────────────

export const G01: SoldierCard = {
  id: 'G-01',
  name: '칼날 정예 (刃尖精銳)',
  cost: 2,
  element: '金',
  rarity: 'common',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 1,
  keywords: ['pierce'],
  flavorText: '약하지만, 정확하다',
}

export const G02: SoldierCard = {
  id: 'G-02',
  name: '백금 사형 (白金師兄)',
  cost: 3,
  element: '金',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 4,
  keywords: [],
  battlecry: '소환시 적 유닛 1개 파괴 (체력 2 이하만)',
  flavorText: '조용히 오고, 조용히 끝낸다',
}

export const G03: SoldierCard = {
  id: 'G-03',
  name: '광한검 (廣寒劍)',
  cost: 5,
  element: '金',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 5,
  keywords: ['pierce'],
  battlecry: '소환시 적 유닛 1개 무조건 파괴',
  flavorText: '전설의 검은 모든 걸 벤다 — 검값도 레전드',
}

export const G06: SoldierCard = {
  id: 'G-06',
  name: '검기 수련생 (劍氣修煉生)',
  cost: 1,
  element: '金',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 2,
  keywords: [],
  flavorText: '검기는 아직 없지만 검이 있다',
}

export const G07: SoldierCard = {
  id: 'G-07',
  name: '쾌도 자객 (快刀刺客)',
  cost: 2,
  element: '金',
  rarity: 'common',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 1,
  keywords: ['rush', 'pierce'],
  flavorText: '빠르게 치고 빠지는 것이 진정한 고수',
}

export const G08: SoldierCard = {
  id: 'G-08',
  name: '백금 장로 (白金長老)',
  cost: 4,
  element: '金',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 4,
  keywords: ['pierce'],
  battlecry: '소환시 내 필드 유닛 모두 관통 부여',
  flavorText: '모두 관통으로 만드는 사람. 명함이 날카롭다',
}

export const G09: SoldierCard = {
  id: 'G-09',
  name: '금강 전사 (金剛戰士)',
  cost: 3,
  element: '金',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 4,
  keywords: [],
  flavorText: '쇠처럼 단단하고, 칼처럼 날카롭다',
}

export const G10: SoldierCard = {
  id: 'G-10',
  name: '검선 (劍仙)',
  cost: 5,
  element: '金',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 6,
  maxHealth: 5,
  keywords: ['pierce', 'rush'],
  flavorText: '검의 신선. 구름 위에서 내려왔는데 숙박비가 없다',
}

// ────────────────────────────────────────────────────
// 金 효과 카드 (4장)
// ────────────────────────────────────────────────────

export const G04: SpellCard = {
  id: 'G-04',
  name: '일도양단 (一刀兩斷)',
  cost: 3,
  element: '金',
  rarity: 'rare',
  cardType: 'spell',
  subtype: 'debuff',
  effectText: '적 유닛 1개 파괴. 피해 없음, 그냥 파괴.',
  flavorText: '말이 필요 없다',
}

export const G05: SpellCard = {
  id: 'G-05',
  name: '반격 준비 (反擊準備)',
  cost: 1,
  element: '金',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 유닛 1개: 이번 턴 피격 시 공격자에게 3 피해 반격',
  flavorText: '먼저 때리면 후회한다',
}

export const G11: SpellCard = {
  id: 'G-11',
  name: '철벽 파쇄 (鐵壁破碎)',
  cost: 2,
  element: '金',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '적 유닛 1개에 3 피해. 도발 유닛 대상 시 +2 추가 피해.',
  flavorText: '막는다고 막히는 게 아니다',
}

export const G12: SpellCard = {
  id: 'G-12',
  name: '검기 방출 (劍氣放出)',
  cost: 4,
  element: '金',
  rarity: 'uncommon',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '적 유닛 1개 무조건 파괴. 내 유닛 1개 관통 부여.',
  flavorText: '검기는 벽을 뚫는다. 청구서도 뚫린다',
}

// ────────────────────────────────────────────────────
// 水 병사 카드 (8장)
// ────────────────────────────────────────────────────

export const H01: SoldierCard = {
  id: 'H-01',
  name: '수면 유영사 (水面遊泳師)',
  cost: 2,
  element: '水',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 3,
  keywords: ['freeze'],
  flavorText: '물처럼 흘러가는 전투 스타일',
}

export const H02: SoldierCard = {
  id: 'H-02',
  name: '빙결 술사 (氷結術師)',
  cost: 3,
  element: '水',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 5,
  keywords: [],
  battlecry: '소환시 적 유닛 모두 냉기 부여',
  flavorText: '잠깐, 다들 멈춰봐요',
}

export const H03: SoldierCard = {
  id: 'H-03',
  name: '흑수 선인 (黑水仙人)',
  cost: 4,
  element: '水',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 6,
  keywords: ['lifesteal'],
  battlecry: '내 手牌에 水 카드 있을 때 공격력 +2',
  flavorText: '한 손엔 칼, 한 손엔 카드',
}

export const H05: SoldierCard = {
  id: 'H-05',
  name: '물결 전사 (波紋戰士)',
  cost: 1,
  element: '水',
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 2,
  keywords: ['freeze'],
  flavorText: '작은 파문도 결국 큰 파도가 된다',
}

export const H06: SoldierCard = {
  id: 'H-06',
  name: '빙하 거인 (氷河巨人)',
  cost: 5,
  element: '水',
  rarity: 'rare',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 7,
  keywords: ['freeze', 'taunt'],
  flavorText: '만년 빙하는 녹지 않는다. 탄소중립 응원',
}

export const H07: SoldierCard = {
  id: 'H-07',
  name: '수룡 전사 (水龍戰士)',
  cost: 3,
  element: '水',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 4,
  keywords: ['lifesteal'],
  flavorText: '싸울수록 건강해진다. 의료비 절감',
}

export const H08: SoldierCard = {
  id: 'H-08',
  name: '흑수 감찰관 (黑水監察官)',
  cost: 2,
  element: '水',
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 3,
  keywords: [],
  battlecry: '소환시 카드 1드로우',
  flavorText: '감찰하면서 정보도 모은다. 일석이조',
}

export const H09: SoldierCard = {
  id: 'H-09',
  name: '심해 술사 (深海術師)',
  cost: 4,
  element: '水',
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 7,
  keywords: ['lifesteal', 'freeze'],
  flavorText: '심해는 모든 것을 삼킨다. 물 값은 비싸지 않다',
}

// ────────────────────────────────────────────────────
// 水 효과 카드 (4장)
// ────────────────────────────────────────────────────

export const H04: SpellCard = {
  id: 'H-04',
  name: '파문 연쇄 (波紋連鎖)',
  cost: 2,
  element: '水',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'draw',
  effectText: '카드 2드로우. 다음 카드 비용 -1.',
  flavorText: '파도는 끝이 없다',
}

export const H10: SpellCard = {
  id: 'H-10',
  name: '혼천수류 (混天水流)',
  cost: 2,
  element: '水',
  rarity: 'common',
  cardType: 'spell',
  subtype: 'debuff',
  effectText: '적 유닛 1개 공격력 -3 (1턴). 냉기 부여.',
  flavorText: '흐름을 막으면 역류한다',
}

export const H11: SpellCard = {
  id: 'H-11',
  name: '천수관음 (千手觀音)',
  cost: 5,
  element: '水',
  rarity: 'rare',
  cardType: 'spell',
  subtype: 'draw',
  effectText: '카드 3드로우. 이번 턴 낸 주문 수만큼 무작위 1/1 수유닛 소환.',
  flavorText: '천 개의 손은 천 개의 전략이다',
}

export const H12: SpellCard = {
  id: 'H-12',
  name: '빙결 폭풍 (氷結暴風)',
  cost: 3,
  element: '水',
  rarity: 'uncommon',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '적 필드 모든 유닛에 1 피해 및 냉기 부여.',
  flavorText: '얼어붙어라, 전부',
}

// ────────────────────────────────────────────────────
// 중립 카드 (8장)
// ────────────────────────────────────────────────────

export const N01: SoldierCard = {
  id: 'N-01',
  name: '강호 잡동사니 (江湖雜多士)',
  cost: 1,
  element: null,
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 1,
  keywords: [],
  flavorText: '이름도 없지만 나름 자부심 있음',
}

export const N02: SoldierCard = {
  id: 'N-02',
  name: '무림 상인 (武林商人)',
  cost: 2,
  element: null,
  rarity: 'common',
  cardType: 'soldier',
  attack: 1,
  maxHealth: 3,
  keywords: [],
  battlecry: '처치 시 카드 1드로우',
  flavorText: '살아서든 죽어서든 이득을 남긴다',
}

export const N03: SoldierCard = {
  id: 'N-03',
  name: '변신 첩자 (變身諜者)',
  cost: 3,
  element: null,
  rarity: 'uncommon',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 3,
  keywords: [],
  battlecry: '소환시 오행 1개 선택, 해당 오행 카드 1장 무작위 생성',
  flavorText: '나는 누구인가',
}

export const N04: SoldierCard = {
  id: 'N-04',
  name: '떠돌이 무사 (流浪武士)',
  cost: 2,
  element: null,
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 3,
  keywords: [],
  flavorText: '집이 없지만 자존심은 있다',
}

export const N05: SoldierCard = {
  id: 'N-05',
  name: '황야 도적 (荒野盜賊)',
  cost: 1,
  element: null,
  rarity: 'common',
  cardType: 'soldier',
  attack: 2,
  maxHealth: 1,
  keywords: ['rush'],
  flavorText: '빠르게 치고 도망가는 것도 무공이다',
}

export const N06: SpellCard = {
  id: 'N-06',
  name: '만능 비전 (萬能秘傳)',
  cost: 3,
  element: null,
  rarity: 'uncommon',
  cardType: 'spell',
  subtype: 'draw',
  effectText: '카드 2드로우. 무작위 오행 카드 1장 생성.',
  flavorText: '오행 중 뭐가 나올지는 운명이 결정한다',
}

export const N07: SpellCard = {
  id: 'N-07',
  name: '강호 회복술 (江湖回復術)',
  cost: 2,
  element: null,
  rarity: 'common',
  cardType: 'spell',
  subtype: 'buff',
  effectText: '내 영웅 HP 3 회복. 내 유닛 1개에 +1/+1.',
  flavorText: '만병통치약은 없지만 이게 비슷하다',
}

export const N08: SpellCard = {
  id: 'N-08',
  name: '혼돈의 주사위 (混沌骰子)',
  cost: 1,
  element: null,
  rarity: 'common',
  cardType: 'spell',
  subtype: 'attack',
  effectText: '무작위 적 유닛 또는 영웅에 1~3 피해 (랜덤).',
  flavorText: '운명은 주사위처럼 굴린다. 결과는 알 수 없다',
}

// ────────────────────────────────────────────────────
// 전설 카드 (5장, 오행별 1장)
// ────────────────────────────────────────────────────

export const LEGEND_WOOD: SoldierCard = {
  id: 'L-W',
  name: '목왕 청제 (木王靑帝)',
  cost: 5,
  element: '木',
  rarity: 'legendary',
  cardType: 'soldier',
  attack: 4,
  maxHealth: 8,
  keywords: [],
  battlecry: '내 필드 木 유닛 수만큼 체력+공격력 추가. 木 카드 드로우 2.',
  flavorText: '봄의 신이 왔다. 축하한다.',
}

export const LEGEND_FIRE: SoldierCard = {
  id: 'L-F',
  name: '화황 염제 (火皇炎帝)',
  cost: 5,
  element: '火',
  rarity: 'legendary',
  cardType: 'soldier',
  attack: 6,
  maxHealth: 4,
  keywords: ['rush'],
  battlecry: '소환시 적 필드 전체 3 피해. 이번 턴 공격 추가 1회.',
  flavorText: '세상이 불타는 걸 구경만 할 수는 없지',
}

export const LEGEND_EARTH: SoldierCard = {
  id: 'L-E',
  name: '토왕 황제 (土王黃帝)',
  cost: 5,
  element: '土',
  rarity: 'legendary',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 12,
  keywords: ['taunt'],
  battlecry: '피해를 받아도 HP 절반까지만 감소 (최저 1).',
  flavorText: '황제는 죽지 않는다. 그냥 안 죽어.',
}

export const LEGEND_METAL: SoldierCard = {
  id: 'L-M',
  name: '금신 백제 (金神白帝)',
  cost: 5,
  element: '金',
  rarity: 'legendary',
  cardType: 'soldier',
  attack: 5,
  maxHealth: 5,
  keywords: ['pierce'],
  battlecry: '소환시 적 유닛 2개 파괴. 내 필드 유닛 모두 관통 부여.',
  flavorText: '검으로 운명을 바꾼다 — 청구서는 나중에',
}

export const LEGEND_WATER: SoldierCard = {
  id: 'L-H',
  name: '수신 흑제 (水神黑帝)',
  cost: 5,
  element: '水',
  rarity: 'legendary',
  cardType: 'soldier',
  attack: 3,
  maxHealth: 7,
  keywords: ['lifesteal', 'freeze'],
  battlecry: '내 드로우 단계에 카드 +1. 턴 시작 HP 2 회복.',
  flavorText: '물은 막을 수 없다. 수도세도 안 낸다.',
}

// ────────────────────────────────────────────────────
// 전체 카드 목록 (73장)
// ────────────────────────────────────────────────────

export const ALL_CARDS: Card[] = [
  // 木 병사 (8장)
  W01, W02, W03, W04, W07, W08, W09, W10,
  // 木 효과 (4장)
  W05, W06, W11, W12,
  // 火 병사 (8장)
  F01, F03, F04, F07, F08, F09, F10, F11,
  // 火 효과 (4장)
  F02, F05, F06, F12,
  // 土 병사 (8장)
  T01, T02, T03, T05, T06, T07, T08, T09,
  // 土 효과 (4장)
  T04, T10, T11, T12,
  // 金 병사 (8장)
  G01, G02, G03, G06, G07, G08, G09, G10,
  // 金 효과 (4장)
  G04, G05, G11, G12,
  // 水 병사 (8장)
  H01, H02, H03, H05, H06, H07, H08, H09,
  // 水 효과 (4장)
  H04, H10, H11, H12,
  // 중립 (8장)
  N01, N02, N03, N04, N05, N06, N07, N08,
  // 전설 (5장)
  LEGEND_WOOD, LEGEND_FIRE, LEGEND_EARTH, LEGEND_METAL, LEGEND_WATER,
  // 운명카드전 Phase 1 영웅 카드 (27장)
  ...HERO_CARDS,
]

// ────────────────────────────────────────────────────
// 오행별 카드 풀 (시작 덱/언락용)
// ────────────────────────────────────────────────────

export const CARDS_BY_ELEMENT = {
  木: ALL_CARDS.filter(c => c.element === '木'),
  火: ALL_CARDS.filter(c => c.element === '火'),
  土: ALL_CARDS.filter(c => c.element === '土'),
  金: ALL_CARDS.filter(c => c.element === '金'),
  水: ALL_CARDS.filter(c => c.element === '水'),
  중립: ALL_CARDS.filter(c => c.element === null),
}

// ────────────────────────────────────────────────────
// 시작 덱 생성 함수 (오행별, §5-4 기반)
// 主 오행 12장 + 상생 오행 6장 + 중립 2장 = 20장
// ────────────────────────────────────────────────────

/** 시작 덱에 사용할 기본 카드 (common/uncommon, 전설 제외) */
function getStarterCards(element: '木' | '火' | '土' | '金' | '水'): Card[] {
  return CARDS_BY_ELEMENT[element].filter(c => c.rarity !== 'legendary')
}

function pickN(cards: Card[], n: number): Card[] {
  // n장을 반복 사용해 채움 (덱 구성상 중복 허용)
  const result: Card[] = []
  let i = 0
  while (result.length < n) {
    result.push({ ...cards[i % cards.length], id: `${cards[i % cards.length].id}_s${result.length}` })
    i++
  }
  return result
}

// 상생 관계: 木→火→土→金→水→木
const GENERATES_MAP: Record<string, '木' | '火' | '土' | '金' | '水'> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木',
}

export function createStarterDeck(mainElement: '木' | '火' | '土' | '金' | '水'): Card[] {
  const generatedElement = GENERATES_MAP[mainElement]
  const mainCards = getStarterCards(mainElement)
  const genCards = getStarterCards(generatedElement)
  const neutralCards = CARDS_BY_ELEMENT['중립'].filter(c => c.cardType === 'soldier' && c.rarity === 'common')

  return [
    ...pickN(mainCards, 12),
    ...pickN(genCards, 6),
    ...pickN(neutralCards, 2),
  ]
}

// ────────────────────────────────────────────────────
// 하위호환: sampleCards 대체 export (테스트 코드 호환)
// ────────────────────────────────────────────────────

/** 샘플 전체 카드 (cardModel.test.ts 호환) */
export const ALL_SAMPLE_CARDS: Card[] = ALL_CARDS

/** 火 시작 덱 (테스트 호환) */
export function createFireStarterDeck(): Card[] {
  // 테스트가 정확히 20장, 火12 木6 중립2를 기대하므로 명시적 구성
  return [
    // 火 카드 12장
    F01, { ...F01, id: 'F-01b' },
    F02, { ...F02, id: 'F-02b' },
    F03, { ...F03, id: 'F-03b' },
    F04,
    F06, { ...F06, id: 'F-06b' },
    LEGEND_FIRE,
    { ...F01, id: 'F-01c' },
    { ...F02, id: 'F-02c' },
    // 木 카드 6장 (木→火 상생)
    W01, { ...W01, id: 'W-01b' },
    W05, { ...W05, id: 'W-05b' },
    W02,
    W03,
    // 중립 카드 2장
    N01,
    N02,
  ]
}
