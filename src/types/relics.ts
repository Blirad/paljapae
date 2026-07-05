/**
 * 유물(Relic) 타입 정의 — M7 P3
 * 리라 M7 P3 스펙 §6-1 기반
 */

export type RelicId =
  | 'RELIC_HERB_POUCH'
  | 'RELIC_DUEL_CREST'
  | 'RELIC_JADE_BEAD'
  | 'RELIC_ELEMENT_SEAL'
  | 'RELIC_HELL_TALISMAN'

export type RelicHookPoint =
  | 'battle_start'   // 전투 시작
  | 'draw_phase'     // 드로우 페이즈
  | 'play_card'      // 카드 플레이
  | 'combat_attack'  // 전투 공격
  | 'spell_damage'   // 주문 피해

export interface Relic {
  id: RelicId
  name: string
  icon: string
  description: string
  flavorText: string
  hookPoints: RelicHookPoint[]
}

export const ALL_RELICS: Record<RelicId, Relic> = {
  RELIC_HERB_POUCH: {
    id: 'RELIC_HERB_POUCH',
    name: '약초 주머니 (藥草囊)',
    icon: '◆',
    description: '매 전투 시작 시 HP +3 회복',
    flavorText: '약초 행상인에게서 받은 약초 주머니',
    hookPoints: ['battle_start'],
  },
  RELIC_DUEL_CREST: {
    id: 'RELIC_DUEL_CREST',
    name: '결투 문장 (決鬪紋章)',
    icon: '◈',
    description: '오행 피해 +2 (주문 카드에만 적용)',
    flavorText: '무림 도전에서 얻은 승리의 증표',
    hookPoints: ['spell_damage'],
  },
  RELIC_JADE_BEAD: {
    id: 'RELIC_JADE_BEAD',
    name: '흑요석 부패주 (黑曜石腐牌珠)',
    icon: '⬟',
    description: '매 턴 시작 시 드로우 +1 (핸드 6장 초과 시 미적용)',
    flavorText: '마교 본산 보스에게서 빼앗은 보주',
    hookPoints: ['draw_phase'],
  },
  RELIC_ELEMENT_SEAL: {
    id: 'RELIC_ELEMENT_SEAL',
    name: '오행 인장 (五行印章)',
    icon: '★',
    description: '내 오행 카드 비용 -1 (최소 0)',
    flavorText: '강호의 정기가 깃든 인장',
    hookPoints: ['play_card'],
  },
  RELIC_HELL_TALISMAN: {
    id: 'RELIC_HELL_TALISMAN',
    name: '황천 부적 (黃泉符籍)',
    icon: '▲',
    description: 'HP 5 이하일 때 공격력 +3',
    flavorText: '생사의 경계에서 얻는 힘',
    hookPoints: ['combat_attack'],
  },
}
