/**
 * 이벤트 데이터 — M7 P2
 * 리라 M7 P2 스펙 §3-3 기반
 * 이벤트 5종 (사주·무협 테마)
 */

import type { RelicId } from '@/types/relics'

// ────────────────────────────────────────────────────
// 이벤트 결과 타입
// ────────────────────────────────────────────────────

export interface EventResult {
  hpDelta: number         // 양수: 회복, 음수: 피해, 0: 변화 없음
  cardAdded: boolean      // true: 이벤트 내에서 카드 1장 추가 처리
  relicId: RelicId | null // null: 유물 없음 (P3 연계)
  needRemoveCard: boolean // true: 카드 제거 UI 진입 필요
  resultText: string      // 결과 패널 표시 텍스트
}

export interface EventChoice {
  label: string
  hint: string
  resolve: (context: EventContext) => EventResult
}

export interface EventDef {
  id: string
  title: string
  narrative: string
  choices: EventChoice[]
}

// 이벤트 결과 계산 시 필요한 컨텍스트
export interface EventContext {
  playerElement?: string
  bossElement?: string
}

// ────────────────────────────────────────────────────
// 이벤트 5종 데이터
// ────────────────────────────────────────────────────

export const ALL_EVENTS: EventDef[] = [
  // ──────────────────────────────────────────
  // 이벤트 1 — 약초 행상인 (藥草行商人)
  // ──────────────────────────────────────────
  {
    id: 'EVENT_HERB_MERCHANT',
    title: '약초 행상인 (藥草行商人)',
    narrative:
      '지친 발걸음을 옮기다 노인 하나를 만났다. 등에 약초 바구니를 진 행상인. 그가 묻는다. "한 가지만 가져가게."',
    choices: [
      {
        label: '체력을 회복하겠소',
        hint: 'HP +6 회복',
        resolve: () => ({
          hpDelta: 6,
          cardAdded: false,
          relicId: null,
          needRemoveCard: false,
          resultText: '약초를 먹으니 기운이 솟는다. HP +6',
        }),
      },
      {
        label: '좋은 카드를 찾겠소',
        hint: '덱에 카드 1장 추가',
        resolve: () => ({
          hpDelta: 0,
          cardAdded: true,
          relicId: null,
          needRemoveCard: false,
          resultText: '행상인이 카드 한 장을 건넨다.',
        }),
      },
      {
        label: '약초 한 줌을 얻겠소',
        hint: '유물 1개 획득 가능성',
        resolve: () => ({
          hpDelta: 0,
          cardAdded: false,
          relicId: 'RELIC_HERB_POUCH',
          needRemoveCard: false,
          resultText: '노인이 품속에서 오래된 부적을 꺼낸다.',
        }),
      },
    ],
  },

  // ──────────────────────────────────────────
  // 이벤트 2 — 폐허의 사당 (廢墟祠堂)
  // ──────────────────────────────────────────
  {
    id: 'EVENT_RUINED_SHRINE',
    title: '폐허의 사당 (廢墟祠堂)',
    narrative:
      '오래된 사당이 보인다. 제단 위에 두 가지 물건이 놓여 있다. 하나를 집어 들었다가 다른 하나를 버릴 수도 있다.',
    choices: [
      {
        label: '제물을 바치고 복을 빈다',
        hint: 'HP -4, 카드 1장 획득',
        resolve: () => ({
          hpDelta: -4,
          cardAdded: true,
          relicId: null,
          needRemoveCard: false,
          resultText: '사당의 신기가 감응한다. 카드를 얻었다.',
        }),
      },
      {
        label: '아무것도 건드리지 않는다',
        hint: '아무 변화 없음',
        resolve: () => ({
          hpDelta: 0,
          cardAdded: false,
          relicId: null,
          needRemoveCard: false,
          resultText: '현명한 선택. 사당을 지나친다.',
        }),
      },
    ],
  },

  // ──────────────────────────────────────────
  // 이벤트 3 — 무림 도전장 (武林挑戰狀)
  // ──────────────────────────────────────────
  {
    id: 'EVENT_DUEL_CHALLENGE',
    title: '무림 도전장 (武林挑戰狀)',
    narrative:
      '누군가 도전장을 던졌다. 받아들이면 위험하지만, 이길 경우 보상이 크다.',
    choices: [
      {
        label: '도전을 받아들인다',
        hint: 'HP -8, 유물 1개 획득',
        resolve: () => ({
          hpDelta: -8,
          cardAdded: false,
          relicId: 'RELIC_DUEL_CREST',
          needRemoveCard: false,
          resultText: '몸은 상했지만 귀한 것을 얻었다.',
        }),
      },
      {
        label: '피한다',
        hint: 'HP 변화 없음, 보상 없음',
        resolve: () => ({
          hpDelta: 0,
          cardAdded: false,
          relicId: null,
          needRemoveCard: false,
          resultText: '지금은 때가 아니다. 훗날을 기약한다.',
        }),
      },
    ],
  },

  // ──────────────────────────────────────────
  // 이벤트 4 — 팔자 점쟁이 (八字占卜師)
  // ──────────────────────────────────────────
  {
    id: 'EVENT_FORTUNE_TELLER',
    title: '팔자 점쟁이 (八字占卜師)',
    narrative:
      '노파가 손을 내밀며 말한다. "팔자를 읽어드리리다. 대신 약한 패는 내게 주시오."',
    choices: [
      {
        label: '덱에서 카드 1장을 제거한다',
        hint: '카드 1장 제거 + HP +4',
        resolve: () => ({
          hpDelta: 4,
          cardAdded: false,
          relicId: null,
          needRemoveCard: true,
          resultText: '노파가 고개를 끄덕인다. "운명이 조금 가벼워졌소."',
        }),
      },
      {
        label: '거절한다',
        hint: '아무 변화 없음',
        resolve: () => ({
          hpDelta: 0,
          cardAdded: false,
          relicId: null,
          needRemoveCard: false,
          resultText: '노파가 쓸쓸히 웃으며 사라진다.',
        }),
      },
    ],
  },

  // ──────────────────────────────────────────
  // 이벤트 5 — 오행 시험대 (五行試驗臺)
  // ──────────────────────────────────────────
  {
    id: 'EVENT_ELEMENT_ALTAR',
    title: '오행 시험대 (五行試驗臺)',
    narrative:
      '오행의 기운이 응집된 제단이 있다. 내 원소와 공명하면 힘을 얻고, 반발하면 화를 입을 수도 있다.',
    choices: [
      {
        label: '원소와 공명을 시도한다',
        hint: 'HP ±(원소 상성에 따름)',
        resolve: (ctx: EventContext) => {
          // 영웅 오행이 보스와 상성 유리 → +8, 불리 → -4, 중립 → +2
          const ADVANTAGE: Record<string, string> = {
            '木': '土', '火': '金', '土': '水', '金': '木', '水': '火',
          }
          const playerEl = ctx.playerElement ?? ''
          const bossEl = ctx.bossElement ?? ''
          let hpDelta = 2
          let resultText = '조용한 공명. HP +2'
          if (bossEl && ADVANTAGE[playerEl] === bossEl) {
            hpDelta = 8
            resultText = '기운이 온몸을 감싼다. HP +8'
          } else if (bossEl && ADVANTAGE[bossEl] === playerEl) {
            hpDelta = -4
            resultText = '반발하는 기운에 튕겨난다. HP -4'
          }
          return { hpDelta, cardAdded: false, relicId: null, needRemoveCard: false, resultText }
        },
      },
      {
        label: '제단을 떠난다',
        hint: '아무 변화 없음',
        resolve: () => ({
          hpDelta: 0,
          cardAdded: false,
          relicId: null,
          needRemoveCard: false,
          resultText: '현명한 판단이었을 것이다.',
        }),
      },
    ],
  },
]
