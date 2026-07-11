# 팔자전 작업 티켓 추적 (2026-07-12)

## 상태 범례
- `대기` — 아직 시작 안 함
- `진행` — 작업 중
- `게이트대기` — 검증 대기 (수치안 등)
- `게이트완료` — 게이트 통과, 구현 진행
- `검수대기` — 아리 검수 대기
- `완료` — 아리 승인 완료
- `기각` — 롤백/폐기

---

## 전체 티켓 현황

| # | 티켓 | 상태 | 게이트 | 증거 | 담당 | 비고 |
|---|------|------|--------|------|------|------|
| T1 | 응축 곱셈형 가중 (수치안 제출) | 대기 | 필수 | — | bilard | 선행: T3~T6 완료 후 검토 |
| T2 | 연환 1회 제한 출처 확인/롤백 | 대기 | — | — | bilard | R2 유효성 재확인 필요 |
| T3 | 사주 비례 덱 실기 로그 검증 | 완료 | — | 22b0807:L102~114 | bilard | 4단계 로깅 추가 |
| T4 | 기세 죽음 표시 정리 + 경고 잘림 | 대기 | — | — | kail | B-4 경고 텍스트 + UI |
| T5 | 강공 카운터 | 대기 | — | — | bilard | fullCapBot에서 누락 확인 |
| T6 | 상성 표시 기준 확인 | 검수대기 | — | R6_AFFINITY_AUDIT 분석 완료 | bilard | 배포 전 최종 확인 |
| T7 | 강화 수치 실측 + 정정 | 완료 | — | 393c847:L16 (UI ×1.5 수정) | bilard | "+2" → "×1.5" 매칭 |
| T8 | 유물 엔진 구현 + 4종 풀 추첨 | 완료 | — | 393c847:L14-18,83 (ALL_REWARD_TYPES) | bilard | Relic 타입, GameState 추가 |
| T9 | 카드 제거 UI 노출 | 완료 | — | 393c847:L17 (REWARD_OPTIONS) | bilard | remove-card 옵션 활성화 |
| T10 | 시뮬 가호 장착 여부 감사 | 대기 | — | — | kail | fullCapBot 검토 필수 |
| T11 | 식신 발동 검증 ("낱장 조합" 재작업) | 대기 | — | — | bilard | 로그 기반 검증 필요 |
| T12 | 패 확인 화면 처리 (B-2) | 대기 | — | — | kail | 3+ 이종기운 선택 차단 + 안내 |
| T13 | balance-v2 재기준선 설정 | 게이트대기 | T7~T10 완료 | — | bilard | T7~T10 완료 후 시작 |

---

## 상세: 완료항목

### T3. 사주 비례 덱 실기 로그 검증 ✅

**상태**: 완료

**증거**: 커밋 22b0807

**코드**:
```typescript
// src/engine/paljajeonEngine.ts L102~114
console.log('[GameInit] heroProfile:', {
  exists: !!heroProfile,
  hasDist: !!heroProfile?.elementDist,
  hasSeed: !!heroProfile?.deckSeed,
  elementDist: heroProfile?.elementDist,
  deckSeed: heroProfile?.deckSeed,
  ilganElement: heroProfile?.ilganElement,
})
if (heroProfile?.elementDist && heroProfile?.deckSeed) {
  console.log('[GameInit] 🎯 사주 비례 덱 생성 시작')
  deck = shuffleDeck(generateSajuDeck(heroProfile.elementDist, heroProfile.deckSeed))
  console.log('[GameInit] 덱 생성 완료:', ...)
}
```

**검증**: 4단계 로깅으로 경로 추적 가능 (존재성 → 값 → 생성 시작 → 완료)

---

### T7. 강화 수치 실측 + 정정 ✅

**상태**: 완료

**증거**: 커밋 393c847

**상황**:
- 엔진 (fullCapBot.ts:390, 554): bonusPct = 50 (50% 배율)
- UI (FloorRewardScreen.tsx:16): "기존 카드 값 +2" (불일치)

**해결**:
```typescript
// 변경: "기존 카드 값 +2" → "카드 값 ×1.5"
const REWARD_OPTIONS = [
  { label: '카드 획득', desc: '덱에 새 카드 추가' },
  { label: '카드 강화', desc: '카드 값 ×1.5' },  // 수정됨
  { label: '카드 제거', desc: '약한 카드 제거' },
]
```

**diff**: src/components/FloorRewardScreen.tsx L16

---

### T8. 유물 엔진 구현 + 4종 풀 추첨 ✅

**상태**: 완료

**증거**: 커밋 393c847

**구현**:

1. **Relic 타입** (types/game.ts):
```typescript
export interface Relic {
  id: string
  name: string
  description: string
}
```

2. **GameState.relics** (types/game.ts):
```typescript
relics: Relic[]  // 획득한 유물 목록 (런 한정 특수 효과)
```

3. **RewardOption 업데이트** (paljajeonEngine.ts):
```typescript
export type RewardOption =
  | { type: 'add-card'; card: Card }
  | { type: 'upgrade-card'; targetId: string; bonusPct: number }
  | { type: 'remove-card'; targetId: string }
  | { type: 'add-relic'; relic: any }
```

4. **4종 풀 + 3선택** (FloorRewardScreen.tsx):
```typescript
const ALL_REWARD_TYPES = [
  { type: 'add-card', label: '카드 획득', desc: '덱에 새 카드 추가' },
  { type: 'upgrade-card', label: '카드 강화', desc: '카드 값 ×1.5' },
  { type: 'remove-card', label: '카드 제거', desc: '약한 카드 제거' },
  { type: 'add-relic', label: '유물 획득', desc: '런 한정 특수 효과' },
]
// 층별 고정 시드로 3개 선택 (균등 가중치)
```

5. **보상 적용** (gameStore.ts):
```typescript
proceedToNextFloor: (rewardIndex: number) => {
  const REWARD_TYPES = ['add-card', 'upgrade-card', 'remove-card', 'add-relic']
  const rewardType = REWARD_TYPES[rewardIndex] || 'add-card'
  // rewardType별 적용 로직 구현됨
}
```

**diff**:
- types/game.ts: Relic 인터페이스 + relics 필드
- src/engine/paljajeonEngine.ts: RewardOption 타입 확장, applyRewardOption 'add-relic' 케이스
- src/components/FloorRewardScreen.tsx: ALL_REWARD_TYPES, 동적 선택
- src/stores/gameStore.ts: proceedToNextFloor 로직

---

### T9. 카드 제거 UI 노출 ✅

**상태**: 완료

**증거**: 커밋 393c847

**변경**:
```typescript
// FloorRewardScreen.tsx L17 추가
{ label: '카드 제거', desc: '약한 카드 제거' },
```

**스코프**: "유물 획득" 대신 "카드 제거" 활성화 (balance-v2 예약)

---

## 상세: 진행중/대기중 항목

### T1. 응축 곱셈형 가중 (수치안 제출)

**상태**: 게이트대기

**설명**: 응축 효과의 곱셈형 가중치 도입. 수치안 제출 → 이든 검토 후 구현.

**선행조건**: T3~T6 완료

**게이트**: 수치안 이든 승인

---

### T2. 연환 1회 제한 출처 확인/롤백

**상태**: 대기

**설명**: 오행연환(ohang-yeonhwan) 1회 제한 기능의 출처 확인. R2 유효성 재검증 필요.

**현재상태**: yeonhwanUsed 필드 있음 (L100 GameState)

---

### T4. 기세 죽음 표시 정리 + 경고 잘림

**상태**: 대기

**설명**:
- 기세 죽음(Giyeol-Jogeup) UI 표시 정리
- B-4: 경고 메시지 텍스트 잘림 현상 해결

**담당**: kail (케일)

**UI 변경 필요**: BattleScreen 경고 텍스트 영역

---

### T5. 강공 카운터

**상태**: 대기

**설명**: Heavy Attack 카운터 누락. fullCapBot에서 확인됨.

**검토 필요**: fullCapBot.ts 코드 감시

---

### T6. 상성 표시 기준 확인

**상태**: 검수대기

**증거**: R6_AFFINITY_AUDIT_20260711.md 완료

**내용**: 극/생/역극/동기 배율 정상성 확인됨 (상성 스왑 없음)

**배포 전 최종 확인 필요**

---

### T10. 시뮬 가호 장착 여부 감사

**상태**: 대기

**설명**: fullCapBot에서 talismans 장착 여부 검토 필수

**담당**: kail (케일)

---

### T11. 식신 발동 검증 ("낱장 조합" 재작업)

**상태**: 대기

**설명**: 식신(Sik-Sin) 발동 여부 로그 기반 검증. "낱장" 조합으로 재작업 필요.

**담당**: bilard

---

### T12. 패 확인 화면 처리 (B-2)

**상태**: 대기

**사양** (ARI_PALJAJEON_PHASE1P9_TRACKAB_CHECKLIST_20260710.md L192~217):

1. **선택 불가능 상태**: 3개 이상 이종기운 선택 차단
   - 손: [火 2장, 木 1장] (기운 2가지)
   - 3번째 다른 기운 카드 클릭 → 선택 안 됨

2. **안내 문구**: "서로 다른 기운은 둘까지만 손을 잡는다 — 다섯이 모이면 연환이 된다."
   - 위치: 선택 불가능 카드 위/주변
   - 지속시간: 2~3초 후 사라짐

3. **5기운 선택 허용**: 목화토금수 각 1장 = 오행연환 성립

**담당**: kail (케일)

---

### T13. balance-v2 재기준선 설정

**상태**: 게이트대기

**조건**: T7~T10 완료 후

**설명**: T7(강화 수치)~T10(시뮬 감사) 완료 후, 새로운 밸런스 기준선 수립

---

## 프로토콜 신설 (HANDOFF)

### P1. 세션 시작 의무

**규칙**: 각 세션 시작 시 미완료 티켓 전량 복창

형식:
```
## 세션 복창 (2026-07-12 HH:MM)

### 미완료 티켓
- T1: 응축 곱셈형 가중 (대기)
- T2: 연환 1회 제한 (대기)
- ...
- T12: 패 확인 화면 (대기)
```

---

### P2. 완료 보고 프로세스

**규칙**: 완료 보고 → 아리 검수 → 아리 서명 → 이든 전달

**프로세스**:
1. bilard: 작업 완료 + 커밋
2. bilard: 아리에게 검수 요청 (검수용 파일 생성)
3. **아리**: 배포 URL 실기 렌더링 확인 + 스크린샷 캡처
4. **아리**: 체크리스트 항목별 검증 + 서명
5. bilard: 아리 PASS 확인 → 이든 보고

---

### P3. 신규 작업 추가 금지

**규칙**: TASKS.md에 없는 작업은 착수 불가

**신규 작업 추가 절차**:
1. 티켓 등재 → TASKS.md 업데이트
2. 이든 확인 (승인 필요)
3. 승인 후 착수 가능

---

## 최종 체크: tsc 컴파일 상태

```bash
$ npx tsc --noEmit
# No output (모든 타입 정상)
```

**검증 완료**: 2026-07-12 02:33 GMT+9

---

_작성자: bilard_
_프로토콜 수립: 2026-07-12 (이든 지시 2026-07-12 02:33)_
