import type { Element } from '@/types/paljapaeTypes'

export interface EnemyDef {
  id: string
  name: string
  element: Element | null  // null = 무속성(명외자)
  gimmick?: string  // 기믹 설명 (UI 툴팁용)
  deathLine: string  // 죽어가는 대사
}

// 부록 로스터 기준 엄수
export const ENEMY_DEFS: Record<string, EnemyDef> = {
  // ── 1층: 변질 오행 5종 (일진 속성 결정) ──────────────────
  gokmokryeong: {
    id: 'gokmokryeong',
    name: '고목령(枯木靈)',
    element: '木',
    gimmick: '상생 족보 발동 시 반격 피해 +4',
    deathLine: '봄날이여... 이 몸은 끝내 꽃을 피우지 못하였구나...',
  },
  janhwaryeong: {
    id: 'janhwaryeong',
    name: '잔화령(殘火靈)',
    element: '火',
    gimmick: '결집 족보 발동 시 반격 피해 +4',
    deathLine: '꺼져가는 불씨처럼... 타오르지 못한 한이 사무친다...',
  },
  bungkoryeong: {
    id: 'bungkoryeong',
    name: '붕토령(崩土靈)',
    element: '土',
    gimmick: '출수마다 적 방어도 +2',
    deathLine: '흙은 언제나 무너지는 법... 하지만 언젠가 다시 굳으리라...',
  },
  nokcheolryeong: {
    id: 'nokcheolryeong',
    name: '녹철령(綠鐵靈)',
    element: '金',
    gimmick: '음양쌍 족보 무효화',
    deathLine: '녹이 슨 쇠는 부서질 뿐... 끝이로구나...',
  },
  taksuyeong: {
    id: 'taksuyeong',
    name: '탁수령(濁水靈)',
    element: '水',
    gimmick: '버리기 시 플레이어 체력 -2',
    deathLine: '탁한 물은 맑아질 수 없는 것인가... 그것이 내 운명이었나...',
  },
  // ── 2층: 일진 속성 + 상생 관계 2체 혼성 (대표 2종) ─────────
  // 임의 결정: 2층은 gokmokryeong/janhwaryeong 혼성 대표 적으로 시작
  // (실제 로스터 확장 시 추가)
  // ── 3층 정예: 고신(孤辰) / 과숙(寡宿) 격일 교대 ───────────
  gosin: {
    id: 'gosin',
    name: '고신(孤辰)',
    element: null,
    gimmick: '모든 출수 기본치 -10. 홀수 라운드마다 반격 +5',
    deathLine: '외로운 별이여... 홀로 지는 것도 운명인가...',
  },
  gwasuk: {
    id: 'gwasuk',
    name: '과숙(寡宿)',
    element: null,
    gimmick: '체인 족보 배율 절반. 짝수 라운드마다 반격 +5',
    deathLine: '과부의 별이 지는구나... 이것도 하늘의 뜻이리라...',
  },
  // ── 4층 보스: 명외자 대장 ────────────────────────────────
  myeongwaeja_daejiang: {
    id: 'myeongwaeja_daejiang',
    name: '명외자 대장(命外者 大將)',
    element: null,
    gimmick: '5출수마다 특수 반격. 오행연환만이 약점을 뚫는다.',
    deathLine: '운명의 바깥에 있다 믿었거늘... 그대가 진정한 명외자(命外者)로구나.',
  },
}

// 층별 적 선택
export function getEnemyForFloor(floor: number): EnemyDef {
  switch (floor) {
    case 1: {
      // 1층: 변질 오행 5종 중 랜덤
      const floor1Enemies = ['gokmokryeong', 'janhwaryeong', 'bungkoryeong', 'nokcheolryeong', 'taksuyeong']
      const pick = floor1Enemies[Math.floor(Math.random() * floor1Enemies.length)]
      return ENEMY_DEFS[pick]
    }
    case 2: {
      // 2층: 혼성 — 1층 적 중 랜덤 2종 혼합 (대표로 단일 적)
      const floor2Enemies = ['gokmokryeong', 'janhwaryeong', 'bungkoryeong', 'nokcheolryeong', 'taksuyeong']
      const pick = floor2Enemies[Math.floor(Math.random() * floor2Enemies.length)]
      return ENEMY_DEFS[pick]
    }
    case 3: {
      // 3층: 고신/과숙 격일 교대 — 랜덤 선택
      return Math.random() < 0.5 ? ENEMY_DEFS['gosin'] : ENEMY_DEFS['gwasuk']
    }
    case 4:
    default:
      return ENEMY_DEFS['myeongwaeja_daejiang']
  }
}
