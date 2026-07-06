# 팔자패 — StS 클론 전투 시스템 리빌드 스펙

## 목표
현재 하스스톤형 유닛 배치 전투를 **Slay the Spire 완전 클론**으로 교체.
사주 오행 테마만 유지, 나머지 메카닉은 StS 그대로 카피.

---

## 1. 전투 구조 (StS 그대로)

### 턴 플로우
1. **턴 시작**: 에너지 3 충전, 블록 0으로 리셋, 카드 5장 드로우
2. **플레이어 페이즈**: 카드 사용 (에너지 소모), 순서 자유
3. **턴 종료 버튼**: 남은 패 전부 버림패로
4. **적 턴**: 표시된 의도(Intent) 실행 → 새 의도 결정
5. 반복

### 카드 더미 순환 (StS 그대로)
- **뽑기패(Draw Pile)** → 패(Hand, max 10) → **버림패(Discard Pile)**
- 뽑기패 0장 시 → 버림패 셔플 → 뽑기패로
- **소멸(Exhaust)**: 별도 소멸패로, 재사용 불가

### 에너지
- 기본 3/턴 (유물로 4 가능)
- 카드 코스트: 0~3
- 미사용 에너지 소멸 (특정 유물 제외)

---

## 2. 플레이어 스탯

```typescript
interface PlayerState {
  hp: number           // 현재 HP
  maxHp: number        // 최대 HP (기본 72)
  block: number        // 블록 (턴 시작 시 0 리셋)
  energy: number       // 현재 에너지
  maxEnergy: number    // 최대 에너지 (기본 3)

  drawPile: Card[]     // 뽑기패
  hand: Card[]         // 현재 패
  discardPile: Card[]  // 버림패
  exhaustPile: Card[]  // 소멸패

  buffs: Buff[]        // 버프/디버프 목록
  relics: Relic[]      // 유물 목록
  potions: (Potion|null)[]  // 포션 슬롯 (2칸, 유물로 3칸)
}
```

---

## 3. 적 시스템

### 적 구조
```typescript
interface Enemy {
  id: string
  name: string
  hp: number
  maxHp: number
  block: number
  buffs: Buff[]
  intent: Intent          // 현재 의도 (플레이어에게 표시)
  pattern: EnemyPattern   // AI 패턴
}

interface Intent {
  type: 'attack' | 'defend' | 'buff' | 'debuff' | 'attackDebuff' | 'unknown'
  damage?: number         // 공격 의도 시 표시할 데미지
  hits?: number           // 다중 타격 횟수
  isHeavy?: boolean       // 강공격 표시
}
```

### 적 의도 표시 (StS 핵심)
- 칼 아이콘 + 숫자 = 공격 (데미지 표시)
- 방패 아이콘 = 방어
- 위 화살표 = 버프
- 아래 화살표 = 디버프
- 칼+아래화살표 = 공격+디버프
- ? = 알 수 없음

### 적 AI 패턴
```typescript
type EnemyPattern = {
  moves: EnemyMove[]
  type: 'sequential' | 'random_weighted'
}

interface EnemyMove {
  intent: Intent
  action: (enemy: Enemy, player: PlayerState) => void
  weight?: number  // random_weighted 시
}
```

---

## 4. 버프/디버프 시스템 (StS 카피)

```typescript
interface Buff {
  id: BuffId
  amount: number        // 스택 수
  duration?: number     // 턴 기반이면 남은 턴
}

type BuffId =
  // 플레이어 버프
  | 'strength'      // 공격 카드 데미지 +N
  | 'dexterity'     // 블록 카드 블록 +N
  | 'vulnerable'    // 받는 데미지 50% 증가 (턴 기반)
  | 'weak'          // 주는 데미지 25% 감소 (턴 기반)
  | 'frail'         // 얻는 블록 25% 감소 (턴 기반)
  | 'poison'        // 턴 시작 시 N 데미지, 1 감소
  | 'ritual'        // 턴 종료 시 힘 +N
  | 'metallicize'   // 턴 종료 시 블록 +N
  | 'thorns'        // 공격받을 때 N 반사 데미지
  | 'regen'         // 턴 종료 시 HP +N, 1 감소
  | 'barricade'     // 블록이 턴 시작 시 리셋 안 됨
  | 'elementBoost'  // 오행 보너스 (팔자패 고유)
```

---

## 5. 카드 시스템

### 카드 타입 (StS 3종)
- **공격(Attack)** 빨간색: 데미지 딜링
- **스킬(Skill)** 초록색: 블록, 유틸리티
- **파워(Power)** 파란색: 영구 버프 (1회 사용, 소멸)

### 카드 구조
```typescript
interface Card {
  id: string
  name: string
  cost: number           // 0-3
  type: 'attack' | 'skill' | 'power'
  rarity: 'starter' | 'common' | 'uncommon' | 'rare'
  element: FiveElement | 'neutral'
  description: string    // 효과 설명
  upgraded: boolean

  // 효과 (함수)
  effects: CardEffect[]
}

interface CardEffect {
  type: 'damage' | 'block' | 'applyBuff' | 'draw' | 'gainEnergy' | 'exhaust' | 'heal'
  value: number
  target?: 'enemy' | 'self' | 'all_enemies' | 'random'
  buffId?: BuffId
  times?: number  // 다중 타격
}
```

### 오행별 카드 (각 10장 = 50장 + 중립 10장 = 60장)

#### 木 (나무) — 성장/드로우/독 테마
스타터:
- 강타(Strike) [공격 1코] 6 데미지
- 수비(Defend) [스킬 1코] 5 블록
- 목기순환(Wood Flow) [스킬 1코] 카드 2장 드로우

커먼:
- 가시덤불(Thorn Bush) [스킬 1코] 5블록, 가시1 획득
- 맹독침(Venom Needle) [공격 1코] 4데미지, 독2 부여
- 뿌리내림(Root Down) [스킬 1코] 7블록
- 독안개(Poison Fog) [스킬 1코] 적 전체 독3

언커먼:
- 숲의분노(Forest Rage) [공격 2코] 12데미지
- 생명력흡수(Life Drain) [공격 2코] 8데미지, HP 4회복
- 성장(Growth) [파워 1코] 매 턴 힘+1

레어:
- 천년고목(Ancient Tree) [파워 3코] 매 턴 종료 블록6, 가시3
- 맹독폭풍(Venom Storm) [공격 2코] 독8 부여, 카드1 드로우

#### 火 (불) — 공격/힘/소각 테마
스타터:
- 강타(Strike) [공격 1코] 6 데미지
- 수비(Defend) [스킬 1코] 5 블록
- 화염일격(Flame Strike) [공격 1코] 3데미지 x2

커먼:
- 불꽃칼(Fire Blade) [공격 1코] 8데미지
- 화염폭발(Fire Burst) [공격 1코] 적 전체 4데미지
- 분노의불길(Rage Fire) [스킬 1코] 힘+2
- 연소(Combustion) [공격 0코] 3데미지, HP 1 소모

언커먼:
- 용염참(Dragon Slash) [공격 2코] 4데미지 x3
- 업화(Hellfire) [공격 2코] 적 전체 10데미지, 자신 3데미지
- 투지(Fighting Spirit) [파워 1코] 공격 카드 사용 시 힘+1

레어:
- 화산폭발(Eruption) [공격 3코] 25데미지
- 불사조(Phoenix) [파워 2코] HP 0 시 1회 HP 10으로 부활

#### 土 (흙) — 방어/블록/회복 테마
스타터:
- 강타(Strike) [공격 1코] 6 데미지
- 수비(Defend) [스킬 1코] 5 블록
- 대지의방패(Earth Shield) [스킬 1코] 8블록

커먼:
- 바위투척(Rock Throw) [공격 1코] 5데미지, 5블록
- 철벽(Iron Wall) [스킬 2코] 15블록
- 대지치유(Earth Heal) [스킬 1코] HP 4회복
- 흙갑옷(Mud Armor) [스킬 1코] 6블록, 허약1 부여

언커먼:
- 지진(Earthquake) [공격 2코] 적전체 8데미지, 취약1 부여
- 산사태(Landslide) [공격 2코] 블록량 = 데미지
- 요새화(Fortify) [파워 1코] 블록 턴 리셋 안 됨 (Barricade)

레어:
- 태산압정(Mountain Crush) [공격 3코] 20데미지, 10블록
- 대지의축복(Earth Blessing) [파워 2코] 턴 종료 HP 3회복, 블록5

#### 金 (쇠) — 정밀/취약/연타 테마
스타터:
- 강타(Strike) [공격 1코] 6 데미지
- 수비(Defend) [스킬 1코] 5 블록
- 칼날비(Blade Rain) [공격 1코] 2데미지 x3

커먼:
- 관통찌르기(Pierce) [공격 1코] 5데미지, 취약1 부여
- 검기(Sword Qi) [공격 2코] 14데미지
- 금속갑옷(Metal Armor) [스킬 1코] 5블록, 가시1
- 날카로운눈(Sharp Eye) [스킬 0코] 카드1 드로우, 에너지+1 (소멸)

언커먼:
- 천검(Thousand Blades) [공격 2코] 1데미지 x8
- 파쇄(Shatter) [공격 1코] 7데미지, 적 블록 제거
- 금강불괴(Indestructible) [파워 2코] 매 턴 민첩+1

레어:
- 멸절참(Annihilation) [공격 3코] 적 취약 수 x10 데미지
- 검의춤(Blade Dance) [파워 1코] 공격 사용 시 랜덤적 2데미지

#### 水 (물) — 제어/약화/적응 테마
스타터:
- 강타(Strike) [공격 1코] 6 데미지
- 수비(Defend) [스킬 1코] 5 블록
- 냉기파동(Frost Wave) [스킬 1코] 5블록, 적 약화1

커먼:
- 물의채찍(Water Whip) [공격 1코] 7데미지, 약화1
- 얼음방패(Ice Shield) [스킬 1코] 8블록
- 안개(Mist) [스킬 1코] 적 전체 약화1
- 흐름읽기(Read Flow) [스킬 1코] 카드2 드로우

언커먼:
- 해일(Tsunami) [공격 2코] 적전체 8데미지, 약화2
- 동결(Deep Freeze) [스킬 2코] 12블록, 에너지+1
- 적응(Adapt) [파워 1코] 턴 시작 시 버림패 1장 패로

레어:
- 대홍수(Great Flood) [공격 3코] 15데미지 x2
- 물의지배(Water Mastery) [파워 2코] 스킬 사용 시 블록+3

#### 중립 (Neutral) — 보상/이벤트 전용
- 부상(Wound) [저주] 사용불가 (패 오염)
- 혼돈(Daze) [저주] 사용불가, 소멸
- 전력질주(Sprint) [스킬 2코] 카드4 드로우
- 발견(Discovery) [스킬 1코] 랜덤 카드3 중 1선택 → 패에 추가 (소멸)
- 비전의힘(Arcane Power) [파워 3코] 에너지+1 매턴
- 섬광(Flash) [공격 0코] 3데미지 x2 (소멸)
- 집중(Focus) [스킬 0코] 힘+3, 턴종료 힘-3
- 피의계약(Blood Pact) [스킬 0코] HP 3소모, 카드3 드로우

---

## 6. 적 디자인 (6스테이지 유지)

### Stage 1: 목령 (木 정령) — HP 42
패턴 (순차 반복):
1. 공격 6
2. 공격 8 + 독2
3. 방어 8
4. 공격 11

### Stage 2: 토괴 (土 골렘) — HP 55
패턴:
1. 방어 10
2. 공격 9 + 취약1
3. 공격 12
4. 방어 14 + 힘+2

### Stage 3: 수룡 (水 드래곤) — HP 50
패턴:
1. 공격 5 x2
2. 약화2 부여
3. 공격 7 + 블록 5
4. 공격 13

### Stage 4: 금장군 (金 장군) — HP 58
패턴:
1. 공격 4 x3
2. 힘+3
3. 공격 8 + 취약2
4. 공격 16

### Stage 5: 화마 (火 마왕) — HP 65
패턴:
1. 힘+2 + 공격 6
2. 공격 8 x2
3. 공격 20
4. 적 전체 5데미지 (AOE) + 취약1

### Stage 6 (보스): 혼돈의제왕 (混沌) — HP 80
패턴 (랜덤 가중):
- 공격 10 x2 (30%)
- 힘+3, 방어12 (20%)
- 공격 22 (20%)
- 약화2 + 취약2 (15%)
- 공격 30 (15%) — 5턴마다

---

## 7. 전투 UI 레이아웃 (StS 클론)

```
┌─────────────────────────────────────┐
│  [HP BAR]  [에너지:3/3]  [포션][포션]│  ← 상단 플레이어 정보
├─────────────────────────────────────┤
│                                     │
│         ┌──────────────┐            │
│         │   적 이름     │            │
│         │   HP: 42/42   │            │
│         │   [의도: ⚔12] │            │  ← 적 영역
│         │   [버프 아이콘]│            │
│         └──────────────┘            │
│                                     │
├─────────────────────────────────────┤
│  블록: 5 🛡  HP: ████████░░ 60/72   │  ← 플레이어 상태
│  [힘+2] [취약1]                      │  ← 버프/디버프 아이콘
├─────────────────────────────────────┤
│                                     │
│   [카드1] [카드2] [카드3] [카드4]     │  ← 패 (부채꼴 배치)
│                                     │
├─────────────────────────────────────┤
│  뽑기패:15  [턴 종료]  버림패:5      │  ← 하단 바
└─────────────────────────────────────┘
```

### 카드 UI
- 상단: 코스트 (원 안에 숫자)
- 중앙: 카드 이름 + 아이콘
- 하단: 효과 설명
- 테두리 색: 공격=빨강, 스킬=초록, 파워=파랑
- 오행 색상 그라데이션 배경

### 인터랙션
- 카드 탭 → 선택 (확대 + 하이라이트)
- 선택된 카드 위로 스와이프(또는 재탭) → 사용
- 적 탭 → 타겟 (공격 카드용)
- 카드 사용 시 → 날아가는 애니메이션 + 데미지 숫자 팝업
- 턴 종료 → 패 사라지는 애니메이션

### 데미지 표시
- 빨간 숫자 팝업 (적 머리 위) — 데미지
- 파란 숫자 팝업 — 블록 획득
- 초록 숫자 팝업 — HP 회복
- 화면 흔들림 (큰 데미지)
- HP바 깎이는 애니메이션

---

## 8. 오행 변형 (팔자패 고유)

### 상극 보너스
공격 카드가 적의 약점 오행일 때 데미지 1.3배
(木克土, 土克水, 水克火, 火克金, 金克木)

### 상생 보너스
같은 턴에 상생 관계 카드 연속 사용 시:
木→火, 火→土, 土→金, 金→水, 水→木
→ 두번째 카드 효과 +20%

### 오행 공명
같은 오행 카드 3장 한 턴에 사용 → 특수 보너스 효과 발동

---

## 9. 유물 (15개로 확장)

1. **옥구슬**: 전투 시작 시 HP 6 회복
2. **오행인**: 주 오행 카드 코스트 -1 (최소0)
3. **용의비늘**: 최대에너지 +1
4. **불멸의부적**: HP 0 시 1회 HP 1로 부활
5. **독사의송곳니**: 공격 카드 사용 시 적에게 독1
6. **수정구**: 턴 시작 시 카드 1장 추가 드로우
7. **화염망토**: 턴 종료 시 블록 +3
8. **대지의뿌리**: 턴 종료 시 HP 2 회복
9. **금강석**: 가시 3 (공격받으면 3 반사)
10. **거울방패**: 블록이 다음 턴에 리셋 안 됨
11. **혈석**: 전투 시작 시 힘 +2
12. **바람의깃털**: 0코스트 카드 사용 시 카드 1장 드로우
13. **마력증폭기**: 파워 카드 사용 시 에너지 +1
14. **연금술사의돌**: 포션 슬롯 +1
15. **혼돈의오브**: 매 3턴마다 랜덤 버프 1 획득

---

## 10. 포션 시스템 (신규)

- 2슬롯 (유물로 3슬롯)
- 전투 중 사용 (에너지 안 씀)
- 보스 처치 시 랜덤 1개 획득

포션 목록:
1. **체력물약**: HP 20 회복
2. **화력물약**: 이번 턴 힘 +5
3. **방어물약**: 블록 12 획득
4. **독물약**: 적에게 독 6
5. **에너지물약**: 에너지 +2
6. **드로우물약**: 카드 3장 드로우

---

## 11. 구현 우선순위

### 반드시 구현 (이번)
- [x] 새 타입 시스템 (PlayerState, Enemy, Card, Buff, Intent)
- [x] 전투 엔진 (데미지 계산, 블록, 버프 적용, 턴 처리)
- [x] 적 AI (의도 시스템, 패턴 실행)
- [x] 카드 데이터 (50+ 오행 카드)
- [x] 전투 UI (적 표시, 패 표시, 의도 아이콘, HP바, 블록)
- [x] 카드 사용 인터랙션 (탭→사용)
- [x] 데미지 숫자 팝업
- [x] 턴 종료 로직
- [x] battleStore 완전 재작성

### 기존 유지
- WorldMapScreen (그대로)
- StartScreen (그대로)
- ShopScreen (카드 데이터만 교체)
- OnboardingFlow (그대로)
- DefeatScreen / EndingScreen (그대로)
- CardRewardScreen (카드 데이터만 교체)
- EventScreen (그대로)
- 포션은 상점에서 구매 가능하게 추가

---

## 12. 파일 변경 계획

### 새로 작성
- `src/types/stsTypes.ts` — 새 타입 전체
- `src/game/engine/stsEngine.ts` — 전투 엔진
- `src/game/engine/buffSystem.ts` — 버프/디버프 처리
- `src/game/ai/enemyAI.ts` — 적 AI + 의도
- `src/data/stsCards.ts` — 새 카드 데이터
- `src/data/enemies.ts` — 적 데이터
- `src/data/potions.ts` — 포션 데이터
- `src/data/stsRelics.ts` — 확장 유물 데이터
- `src/stores/stsBattleStore.ts` — 새 전투 스토어

### 재작성
- `src/components/battle/BattleScreen.tsx` — 완전 재작성
- (기존 battle 하위 컴포넌트 삭제하고 새로 작성)

### 수정
- `src/App.tsx` — BattleScreen props 변경
- `src/screens/CardRewardScreen.tsx` — 새 카드 타입 사용
- `src/screens/ShopScreen.tsx` — 포션 추가, 새 카드 타입
- `src/screens/RemoveCardScreen.tsx` — 새 카드 타입
- `src/screens/UpgradeCardScreen.tsx` — 새 카드 타입

---

## 핵심 원칙
1. StS를 거의 그대로 카피. 의심되면 StS가 하는 대로.
2. 오행 테마는 스킨 레벨로만 (색상, 이름, 상극 보너스)
3. 게임 느낌(juice) 중요 — 숫자 팝업, 화면 흔들림, 카드 애니메이션 필수
4. 모바일 퍼스트 (480px 컨테이너)
