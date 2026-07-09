// ⚠️ 모든 밸런스 수치는 여기에만. 코드 하드코딩 금지.
// v1.3 — 봇 시뮬레이션 3차 조정
// v1.1: 클리어율 96.7% (적 HP 380/720/1200/2000, retaliation 22/32/45/60)
// v1.2: 클리어율 6.3%  (적 HP 800/1800/3200/5500, retaliation 30/42/55/70)
// v1.3: 중간값 조정 (적 HP ~1.7x v1.1)

export const BALANCE = {
  // 플레이어
  PLAYER_HP: 100,

  // 층별 설정
  FLOORS: [
    { enemyHp: 600,  playsAllowed: 3, retaliation: 26 },   // 1층
    { enemyHp: 1100, playsAllowed: 3, retaliation: 36 },   // 2층
    { enemyHp: 1900, playsAllowed: 3, retaliation: 48 },   // 3층 (정예)
    { enemyHp: 3200, playsAllowed: 4, retaliation: 62 },   // 4층 (보스)
  ],
  DISCARD_LIMIT: 3,
  HAND_SIZE: 8,

  // 족보 수치 (C-3) — 변경 없음
  HANDS: {
    yinYangPair:  { baseDamage: 10,  multiplier: 2 },
    gather3:      { baseDamage: 20,  multiplier: 3 },
    chain2:       { baseDamage: 15,  multiplier: 2.5 },
    chain3:       { baseDamage: 30,  multiplier: 4 },
    chain4:       { baseDamage: 50,  multiplier: 6 },
    fiveElements: { baseDamage: 100, multiplier: 12 },
    gather4:      { baseDamage: 60,  multiplier: 7 },
    gather5:      { baseDamage: 90,  multiplier: 10 },
  },

  // 극/역극
  DOMINATE_BONUS: 0.5,    // 극: 최종 배율 +50%
  REVERSE_PENALTY: -0.3,  // 역극: 기본치 -30%

  // 카드 값 합산 (기본 데미지)
  CARD_VALUE_AS_BASE: true,  // 낸 카드 값 합 = 기본치에 추가
} as const
