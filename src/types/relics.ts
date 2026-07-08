/**
 * 유물(Relic) 타입 정의 — M8 P0-1
 * 리라 M7 P3 스펙 §6-1 + 리라 M8 스펙 P0-1 기반
 * 5종 → 20종 확장
 */

export type RelicId =
  // 기존 5종 (M7)
  | 'RELIC_HERB_POUCH'
  | 'RELIC_DUEL_CREST'
  | 'RELIC_JADE_BEAD'
  | 'RELIC_ELEMENT_SEAL'
  | 'RELIC_HELL_TALISMAN'
  // 신규 木 계열
  | 'RELIC_WOOD_SPROUT'
  | 'RELIC_WOOD_DECAY'
  // 신규 火 계열
  | 'RELIC_FIRE_BEACON'
  | 'RELIC_FIRE_BACKFIRE'
  // 신규 土 계열
  | 'RELIC_EARTH_FORTRESS'
  | 'RELIC_EARTH_QUICKSAND'
  // 신규 金 계열
  | 'RELIC_METAL_EDGE'
  | 'RELIC_METAL_RUST'
  // 신규 水 계열
  | 'RELIC_WATER_SPRING'
  | 'RELIC_WATER_ABYSS'
  // 신규 복합 5종
  | 'RELIC_GENERATE_CYCLE'
  | 'RELIC_DOMINATE_SEAL'
  | 'RELIC_TWIN_ELEMENT'
  | 'RELIC_CHAOS_PENTA'
  | 'RELIC_FATE_REVERSE'
  // Phase 1-C: 오행 보완 유물 3종
  | 'RELIC_WEAK_ELEMENT_SEAL'
  | 'RELIC_DOMINATE_NEUTRALIZE'
  | 'RELIC_FIVE_ELEMENT_SPIRIT_WEAPON'

export type RelicHookPoint =
  | 'battle_start'   // 전투 시작
  | 'draw_phase'     // 드로우 페이즈
  | 'play_card'      // 카드 플레이
  | 'combat_attack'  // 전투 공격
  | 'spell_damage'   // 주문 피해

/** 유물 길흉 분류 */
export type RelicAlignment = '吉' | '凶' | '複'

export interface Relic {
  id: RelicId
  name: string
  nameKey: string
  icon: string
  description: string
  flavorText: string
  hookPoints: RelicHookPoint[]
  alignment: RelicAlignment
  /** 오행 계열 (복합은 null) */
  element?: '木' | '火' | '土' | '金' | '水'
}

export const ALL_RELICS: Record<RelicId, Relic> = {
  // ── 기존 5종 ──────────────────────────────────────
  RELIC_HERB_POUCH: {
    id: 'RELIC_HERB_POUCH',
    name: '약초 주머니 (藥草囊)',
    nameKey: 'RELIC_HERB_POUCH_NAME',
    icon: '◆',
    description: '매 전투 시작 시 HP +3 회복',
    flavorText: '약초 행상인에게서 받은 약초 주머니',
    hookPoints: ['battle_start'],
    alignment: '吉',
  },
  RELIC_DUEL_CREST: {
    id: 'RELIC_DUEL_CREST',
    name: '결투 문장 (決鬪紋章)',
    nameKey: 'RELIC_DUEL_CREST_NAME',
    icon: '◈',
    description: '오행 피해 +2 (주문 카드에만 적용)',
    flavorText: '무림 도전에서 얻은 승리의 증표',
    hookPoints: ['spell_damage'],
    alignment: '吉',
  },
  RELIC_JADE_BEAD: {
    id: 'RELIC_JADE_BEAD',
    name: '흑요석 부패주 (黑曜石腐牌珠)',
    nameKey: 'RELIC_JADE_BEAD_NAME',
    icon: '⬟',
    description: '매 턴 시작 시 드로우 +1 (핸드 6장 초과 시 미적용)',
    flavorText: '마교 본산 보스에게서 빼앗은 보주',
    hookPoints: ['draw_phase'],
    alignment: '吉',
  },
  RELIC_ELEMENT_SEAL: {
    id: 'RELIC_ELEMENT_SEAL',
    name: '오행 인장 (五行印章)',
    nameKey: 'RELIC_ELEMENT_SEAL_NAME',
    icon: '★',
    description: '내 오행 카드 비용 -1 (최소 0)',
    flavorText: '강호의 정기가 깃든 인장',
    hookPoints: ['play_card'],
    alignment: '吉',
  },
  RELIC_HELL_TALISMAN: {
    id: 'RELIC_HELL_TALISMAN',
    name: '황천 부적 (黃泉符籍)',
    nameKey: 'RELIC_HELL_TALISMAN_NAME',
    icon: '▲',
    description: 'HP 5 이하일 때 공격력 +3',
    flavorText: '생사의 경계에서 얻는 힘',
    hookPoints: ['combat_attack'],
    alignment: '凶',
  },

  // ── 신규 木 계열 ─────────────────────────────────
  RELIC_WOOD_SPROUT: {
    id: 'RELIC_WOOD_SPROUT',
    name: '청목 새싹 (靑木芽)',
    nameKey: 'RELIC_WOOD_SPROUT_NAME',
    icon: '⟁',
    description: '木 카드 플레이 시 HP +1 회복 (턴당 최대 +3)',
    flavorText: '생명이 깃든 어린 싹. 木의 기운이 상처를 아문다',
    hookPoints: ['play_card'],
    alignment: '吉',
    element: '木',
  },
  RELIC_WOOD_DECAY: {
    id: 'RELIC_WOOD_DECAY',
    name: '고목 썩은 가지 (枯木爛枝)',
    nameKey: 'RELIC_WOOD_DECAY_NAME',
    icon: '✦',
    description: '木 카드 비용 +1, 木 카드 피해 +4',
    flavorText: '썩어가는 나무도 마지막 힘을 다해 상대를 찌른다',
    hookPoints: ['play_card'],
    alignment: '凶',
    element: '木',
  },

  // ── 신규 火 계열 ─────────────────────────────────
  RELIC_FIRE_BEACON: {
    id: 'RELIC_FIRE_BEACON',
    name: '봉화 (烽火)',
    nameKey: 'RELIC_FIRE_BEACON_NAME',
    icon: '◉',
    description: '첫 번째 공격 시 피해 +5 (전투당 1회)',
    flavorText: '하늘을 물들이는 첫 불꽃. 선제는 승리의 절반이다',
    hookPoints: ['combat_attack'],
    alignment: '吉',
    element: '火',
  },
  RELIC_FIRE_BACKFIRE: {
    id: 'RELIC_FIRE_BACKFIRE',
    name: '역화 부적 (逆火符)',
    nameKey: 'RELIC_FIRE_BACKFIRE_NAME',
    icon: '◎',
    description: '火 카드 사용 시 자신도 1 피해, 火 카드 피해 +6',
    flavorText: '불을 제어하지 못한 자는 불에 타고 만다',
    hookPoints: ['play_card'],
    alignment: '凶',
    element: '火',
  },

  // ── 신규 土 계열 ─────────────────────────────────
  RELIC_EARTH_FORTRESS: {
    id: 'RELIC_EARTH_FORTRESS',
    name: '황토 보루 (黃土堡)',
    nameKey: 'RELIC_EARTH_FORTRESS_NAME',
    icon: '▣',
    description: '전투 시작 방어도 +4',
    flavorText: '황토 성벽은 무너지지 않는다. 土의 기운이 몸을 감싼다',
    hookPoints: ['battle_start'],
    alignment: '吉',
    element: '土',
  },
  RELIC_EARTH_QUICKSAND: {
    id: 'RELIC_EARTH_QUICKSAND',
    name: '유사 함정 (流沙陷穽)',
    nameKey: 'RELIC_EARTH_QUICKSAND_NAME',
    icon: '▤',
    description: '敵 매 턴 에너지 -1 (최소 1), 내 드로우 -1',
    flavorText: '모래가 모든 것을 삼킨다. 적도, 그리고 나도',
    hookPoints: ['draw_phase'],
    alignment: '凶',
    element: '土',
  },

  // ── 신규 金 계열 ─────────────────────────────────
  RELIC_METAL_EDGE: {
    id: 'RELIC_METAL_EDGE',
    name: '백금 예봉 (白金銳鋒)',
    nameKey: 'RELIC_METAL_EDGE_NAME',
    icon: '⟐',
    description: '金 카드 피해 +3, 핸드 1장 추가 드로우',
    flavorText: '잘 벼린 검은 쓸 때마다 더욱 예리해진다',
    hookPoints: ['draw_phase'],
    alignment: '吉',
    element: '金',
  },
  RELIC_METAL_RUST: {
    id: 'RELIC_METAL_RUST',
    name: '녹슨 쇠사슬 (鏽鐵鎖)',
    nameKey: 'RELIC_METAL_RUST_NAME',
    icon: '◇',
    description: '핸드 최대 -1 (5장), 金 카드 비용 -2',
    flavorText: '낡은 사슬이 움직임을 제한하지만 그 무게가 힘이 된다',
    hookPoints: ['play_card'],
    alignment: '凶',
    element: '金',
  },

  // ── 신규 水 계열 ─────────────────────────────────
  RELIC_WATER_SPRING: {
    id: 'RELIC_WATER_SPRING',
    name: '옥천수 (玉泉水)',
    nameKey: 'RELIC_WATER_SPRING_NAME',
    icon: '⌘',
    description: '덱 소진 후 Fatigue 피해 -1 (최소 1)',
    flavorText: '옥빛 샘물은 소진된 자에게 마지막 힘을 준다',
    hookPoints: ['draw_phase'],
    alignment: '吉',
    element: '水',
  },
  RELIC_WATER_ABYSS: {
    id: 'RELIC_WATER_ABYSS',
    name: '흑연 심연 (黑淵深海)',
    nameKey: 'RELIC_WATER_ABYSS_NAME',
    icon: '⬤',
    description: '묘지 카드 5장마다 공격력 +2 누적',
    flavorText: '심연은 모든 것을 빨아들이고 더 강한 힘으로 되돌려 준다',
    hookPoints: ['combat_attack'],
    alignment: '凶',
    element: '水',
  },

  // ── 신규 복합 5종 ─────────────────────────────────
  RELIC_GENERATE_CYCLE: {
    id: 'RELIC_GENERATE_CYCLE',
    name: '상생 순환 (相生循環)',
    nameKey: 'RELIC_GENERATE_CYCLE_NAME',
    icon: '⊕',
    description: '상생 관계 카드 연속 2장 플레이 시 다음 카드 비용 -2',
    flavorText: '木生火, 火生土, 土生金, 金生水, 水生木. 순환은 멈추지 않는다',
    hookPoints: ['play_card'],
    alignment: '複',
  },
  RELIC_DOMINATE_SEAL: {
    id: 'RELIC_DOMINATE_SEAL',
    name: '상극 인장 (相剋印)',
    nameKey: 'RELIC_DOMINATE_SEAL_NAME',
    icon: '⊗',
    description: '상극 원소 적 공격 시 피해 ×1.75 (기존 ×1.5 상향)',
    flavorText: '克의 인장이 새겨진 자는 천적 앞에서 더욱 강해진다',
    hookPoints: ['combat_attack'],
    alignment: '複',
  },
  RELIC_TWIN_ELEMENT: {
    id: 'RELIC_TWIN_ELEMENT',
    name: '이원 조화 (二元調和)',
    nameKey: 'RELIC_TWIN_ELEMENT_NAME',
    icon: '⋈',
    description: '같은 오행 카드 2장 연속 플레이 시 에너지 +1 환급',
    flavorText: '같은 기운끼리 공명하면 에너지가 절약된다',
    hookPoints: ['play_card'],
    alignment: '複',
  },
  RELIC_CHAOS_PENTA: {
    id: 'RELIC_CHAOS_PENTA',
    name: '오행 혼돈 (五行混沌)',
    nameKey: 'RELIC_CHAOS_PENTA_NAME',
    icon: '✸',
    description: '한 턴에 3종 이상 오행 사용 시 피해 +3, HP -2',
    flavorText: '모든 오행을 한꺼번에 다루는 자는 하늘의 혼돈을 부른다',
    hookPoints: ['play_card'],
    alignment: '複',
  },
  RELIC_FATE_REVERSE: {
    id: 'RELIC_FATE_REVERSE',
    name: '역운 부적 (逆運符)',
    nameKey: 'RELIC_FATE_REVERSE_NAME',
    icon: '⟳',
    description: '패배 직전 1회 HP 1 유지, 이후 공격력 +5 (런당 1회)',
    flavorText: '운명이 뒤집히는 순간, 강호에 전설이 탄생한다',
    hookPoints: ['battle_start', 'combat_attack'],
    alignment: '複',
  },

  // ── Phase 1-C: 오행 보완 유물 ────────────────────────
  RELIC_WEAK_ELEMENT_SEAL: {
    id: 'RELIC_WEAK_ELEMENT_SEAL',
    name: '약한 오행 인장 (弱行印)',
    nameKey: 'RELIC_WEAK_ELEMENT_SEAL_NAME',
    icon: '◑',
    description: '약한 오행(점수 0) 카드 비용 -1, 드로우 시 우선권 +1',
    flavorText: '약한 기운도 올바르게 이끌면 강해진다',
    hookPoints: ['draw_phase', 'play_card'],
    alignment: '吉',
  },
  RELIC_DOMINATE_NEUTRALIZE: {
    id: 'RELIC_DOMINATE_NEUTRALIZE',
    name: '상극 중화 부적 (相剋中和符)',
    nameKey: 'RELIC_DOMINATE_NEUTRALIZE_NAME',
    icon: '◒',
    description: '상성 불리 시 피해 페널티 0.75 → 0.9로 완화 (20% 상향)',
    flavorText: '역극의 기운을 가라앉혀 피해를 줄인다',
    hookPoints: ['combat_attack'],
    alignment: '吉',
  },
  RELIC_FIVE_ELEMENT_SPIRIT_WEAPON: {
    id: 'RELIC_FIVE_ELEMENT_SPIRIT_WEAPON',
    name: '신살 무기 (五行神殺)',
    nameKey: 'RELIC_FIVE_ELEMENT_SPIRIT_WEAPON_NAME',
    icon: '◓',
    description: '약한 오행 공격 시 상성 페널티 무시 (0.75 → 1.0)',
    flavorText: '신통이 깃든 무기는 모든 상극을 뚫는다',
    hookPoints: ['combat_attack'],
    alignment: '複',
  },
}
