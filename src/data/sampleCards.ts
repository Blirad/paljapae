/**
 * sampleCards.ts — M4 호환 레이어
 * 모든 카드 데이터는 cards.ts로 이전됨.
 * 기존 테스트(cardModel.test.ts 등) 호환을 위해 re-export.
 */

export {
  // 개별 카드 (기존 테스트에서 사용하는 것들)
  W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12,
  F01, F02, F03, F04, F05, F06, F07, F08, F09, F10, F11, F12,
  T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T11, T12,
  G01, G02, G03, G04, G05, G06, G07, G08, G09, G10, G11, G12,
  H01, H02, H03, H04, H05, H06, H07, H08, H09, H10, H11, H12,
  N01, N02, N03, N04, N05, N06, N07, N08,
  LEGEND_WOOD,
  LEGEND_FIRE,
  LEGEND_EARTH,
  LEGEND_METAL,
  LEGEND_WATER,
  // 전체 목록 및 유틸
  ALL_CARDS,
  ALL_SAMPLE_CARDS,
  CARDS_BY_ELEMENT,
  createStarterDeck,
  createFireStarterDeck,
} from '@/data/cards'
