# T10: 시뮬 가호 장착 여부 감사 — 작업 지시 (Kail 담당)

**담당자**: kail (케일)
**요청일**: 2026-07-12 03:07 GMT+9
**상태**: 대기 (kail 착수 대기)
**유형**: 확인·보고형 (구현 없음)

---

## 1. 작업 개요

### 목표
fullCapBot 시뮬레이션에서 **부적술(talismans) 장착 여부 검증**

### 필요성
- R6 시뮬 결과가 실제 게임 메커니즘을 반영하는지 확인
- 부적술이 시뮬에서 제대로 장착되고 있는지 검증
- 필요시 부적술 장착 로직 수정 대기

---

## 2. 검토 대상

### 2-1. 핵심 파일

**primaryFile**: `src/engine/fullCapBot.ts`
- 함수: `runFullCapSimulation()`, `fullCapCalcExpectedDamage()`
- 필드: `talismans` (GameState 내 배열)
- 검색어: "talisman", "gainTalisman", "activateTalisman"

**secondaryFile**: `src/engine/talismans.ts`
- 부적술 정의 및 효과
- 부적술 ID 목록

**referenceFile**: `src/types/game.ts`
- GameState.talismans 타입 (string[] 배열)

---

## 3. 검토 체크리스트

### 3-1. 코드 존재 여부

- [ ] fullCapBot에서 state.talismans를 **읽는** 코드 존재?
  - 찾는 것: `state.talismans`, `talismans.includes()`, `talismans.map()`
  - 위치 기록: ___________________

- [ ] fullCapBot에서 state.talismans를 **수정하는** 코드 존재?
  - 찾는 것: `gainTalisman()`, `talismans: [...]`, `[...state.talismans, ...]`
  - 위치 기록: ___________________

- [ ] 층마다 부적술 장착 로직이 있는가?
  - 기대: 층 클리어 → 부적술 획득 로직
  - 현황: [ ] 있음 [ ] 없음 [ ] 부분적

### 3-2. 시뮬 재구성 시 부적술 유지

- [ ] advanceToNextFloor() 시 state.talismans가 유지되는가?
  - 찾는 것: advanceToNextFloor → `talismans: state.talismans`
  - 위치: src/engine/paljajeonEngine.ts L?

- [ ] 다음층 시작 시 부적술 상태 초기화는 없는가?
  - 기대: 부적술은 런 동안 누적 유지 (게임 오브 직접)
  - 확인: yeonhwanUsed처럼 매층 리셋하지 않는지 확인

### 3-3. fullCapBot의 부적술 활용

- [ ] 부적술 효과를 **평가 단계에서 반영**하는가?
  - 예: `fullCapCalcExpectedDamage()` 내에서 부적술 배율 적용
  - 찾는 것: talisman 관련 damage 수정 코드
  - 현황: [ ] 반영함 [ ] 반영 안 함

- [ ] 부적술 선택 전략이 있는가?
  - 기대: 층 보상으로 여러 부적술 중 최적 선택
  - 현황: [ ] 있음 [ ] 없음 [ ] 미구현

---

## 4. 보고 형식

### 4-1. 보고서 작성

다음 항목을 포함하는 **마크다운 보고서** 작성:

```
# T10: 시뮬 가호 장착 여부 감사 — 감사 결과

**감사자**: kail
**날짜**: 2026-07-12
**결론**: [✅ 정상 / ⚠️ 부분적 / ❌ 미구현]

## 1. fullCapBot 부적술 지원

### 1-1. 코드 위치
- 읽기: src/engine/fullCapBot.ts L? (`...`)
- 쓰기: src/engine/fullCapBot.ts L? (`...`)

### 1-2. 장착 메커니즘
[코드 스니펫 인용]
```typescript
// 부적술 장착 로직
...
```

## 2. 게임 상태 유지

### 2-1. 층간 부적술 유지
- [✅ 유지됨 / ❌ 리셋됨 / ⚠️ 부분적]
- 위치: src/engine/paljajeonEngine.ts L?

## 3. 평가 반영

### 3-1. damage 계산에 포함
- [✅ 포함됨 / ❌ 미포함]
- 근거: [코드 인용]

## 4. 결론

### 문제점 (있는 경우)
1. [문제] — [근거]
2. ...

### 권장사항
- [ ] 현재 상태 유지
- [ ] 수정 필요: [사항]
```

### 4-2. 파일명

`T10_TALISMAN_AUDIT_RESULT_20260712.md`

---

## 5. 검토 수준

### "정상" 판정 기준
- ✅ 부적술이 매층 누적됨
- ✅ fullCapBot이 부적술 효과를 평가에 반영
- ✅ 보상 선택 시 부적술도 후보 중 하나
- ✅ 시뮬 결과(R6)가 게임 메커니즘 반영

### "부분적" 판정 기준
- ⚠️ 부적술이 누적되지만 효과 미반영
- ⚠️ 부적술이 선택되지만 평가 반영 안 됨

### "미구현" 판정 기준
- ❌ fullCapBot에서 talismans 필드 사용 안 함
- ❌ 부적술 획득 로직 없음
- ❌ R6 시뮬에 부적술 미포함

---

## 6. 제출 및 다음 단계

### 제출 방식
1. 보고서 작성 (T10_TALISMAN_AUDIT_RESULT_20260712.md)
2. git add + commit
3. 이 채널에 "T10 완료" 보고

### 다음 배치 (T4, T5, T11, T12)
T10 완료 후 이든이 지시할 때까지 대기

---

## 질문이 있으신가요?

불분명한 부분이 있으면:
1. fullCapBot.ts 코드를 직접 읽어보기
2. talismans.ts의 부적술 정의 확인
3. R6_AFFINITY_AUDIT와 비교 (참고용)

---

_작업 대기 중. Kail의 착수를 기다립니다._
