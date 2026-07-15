# ZERA — balance-v3 R7 (오버킬 할인 구현 + 커밋 + 본시뮬 3000판) (2026-07-15)

_발행: 빌라드 ⚔️ | 이든 판정 문서 기반 (메시지 14107)_

---

## 확정 사항 (재론 금지)

- R6 어블레이션 (목화30.3/토단일38.9) = 무효. 프리셋 오기입(to:6 vs to:14).
- wildfire 억제 R7안 = 기각 확정. 채점표 튜닝 금지.
- 재현 검증 1000판 (2369662) = 유효.

---

## 작업 1 — 오버킬 할인 구현

### 현황

`fullCapBot.ts` 내 잔불 효과 선택 결정 로직:
```typescript
// 현행 (오버킬 할인 없음)
if (effectValue > attackDamage) {
  bestEffectMode = true
}
```

오버킬 할인 미구현: 적 현재 HP가 즉발 공격만으로도 격파 가능한 경우,
잔불 3틱 효과는 어차피 의미없음 → 효과 기대값 0으로 처리해야 함.

### 구현 방향

이든 지시: "R4 지시의 할인식 = × min(3, 남은 공격)/3 + 오버킬 할인"
"평가가 현실을 정확히 비추면 손해 보는 선택은 저절로 준다"

오버킬 할인 스펙:
- 조건: 즉발 공격 데미지(attackDamage)가 적 현재 HP(enemyHp) 이상이면
- 처리: 잔불 효과 기대값을 0으로 처리 (선택하지 않음)
- 이유: 적이 이번 공격으로 죽을 수 있는데 잔불 3턴을 써봤자 의미없음

구현 방법:
- scoreEffectForTrait() 함수에 enemyHp 파라미터 추가 (또는 호출 측에서 처리)
- wildfire case 내 또는 호출 직후: `if (enemyHp <= attackDamage) return 0`

**선택**: 호출 측(fullCapSelectCards, L432 이후)에서 처리 권장.
함수 시그니처 변경 최소화:
```typescript
const effectValue = scoreEffectForTrait(...)
// 오버킬 할인: 즉발 공격으로 적 격파 가능하면 잔불 선택 불필요
const adjustedEffectValue = (enemyHp !== undefined && attackDamage >= enemyHp) ? 0 : effectValue
if (adjustedEffectValue > attackDamage) {
  bestEffectMode = true
}
```

`enemyHp`는 fullCapSelectCards 호출 시 state.enemyHp로 접근 가능한지 확인 필요.
함수 시그니처 확인 후 가장 깔끔한 방식으로 구현.

### 채점표 튜닝 금지 원칙

- effectValue 자체를 임의 비율로 조정하는 것은 금지
- 오버킬 할인은 "현실 반영" (적이 죽으면 잔불 무의미) → 허용
- threshold 조정(effectValue > attackDamage × 0.6 등) → 금지

---

## 작업 2 — 커밋 (발사 전 6줄 확정용)

커밋 내용:
1. 잔불 엔진 수정 (R6: effectMode=true시 rawBase×EMBER_MULTIPLIER 직접 계산)
2. 오버킬 할인 (R7: 이 커밋에 포함)
3. 유닛 테스트 6종 (v3R6EmberUnit.test.ts)

커밋 후 새 해시 확보 필수. 본시뮬 §4 dispatch에 이 해시 사용.

---

## 작업 3 — 본시뮬 3000판 × 3종

### §4 dispatch 6줄 (결과 파일 첫 섹션에 반드시 포함)

```
커밋: [작업2에서 확보한 새 해시]
프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}
조건: enableEffectMode=true/enableFloorReward=true/enableCondenseClamp=true(기준10,하한0.6)
시드: i×12345+7777 (i=0~2999)
가호: selectTalismanBySaju(dist) — [실측 결과 기재]
채택률 단위: "%" — (count/n)×100, 단위 "%" 명시
```

**§4 없으면 이든이 결과 접수 불가. 절대 누락 금지.**

### 조건

- 시드: i×12345+7777 (i=0~2999)
- enableEffectMode: true
- enableFloorReward: true
- enableCondenseClamp: true (기준값 10, 하한 0.6)
- 프리셋: 위 R3 기준
- 가호: selectTalismanBySaju(dist) 자동

### 집계 항목

- 클리어율 (Wilson 95% CI)
- wildfire 효과채택률 (%, 단위 명시)
- R3 기준선 vs R7 비교표
- 응축 발동/판

---

## 동봉 필수 2건 (이든 지시, 없으면 반려)

### ① 응축 봇 평가 return 0 근거 (4회째·최종)

결과 파일에 별도 섹션으로:
```
§5 응축 return 0 근거:
- 코드 위치: fullCapBot.ts L236-241 (yonggigama case)
- 근거: 응축은 effectMode 경로(A)가 아닌 simulateFullCapRun L918~933 별도 루프(B)로 처리
- B 경로: gather5 달성 → getCondenseAvailability → applyCondense 자동 호출
- return 0의 역할: A 경로에서 이중 발동 방지 (B 경로는 무관)
- 0.219/판 출처: B 경로 자동 발동 횟수 (봇 선택 없이 발생)
```

빌라드 주의: 이든이 "불명이면 불명이라 명기"라고 했으므로, 위 이상으로 설명 불가능하면 "불명" 기재.

### ② R5 두 벌 숫자 경위 1줄

```
§6 R5 두 벌 숫자 경위:
파일 기반 추적 불가 — 42.5%/18.2% 기재 파일 workspace 전수 미발견.
추정: 이전 세션 텔레그램 보고 수치 (세션 히스토리 없이 확정 불가).
```

---

## DoD 체크리스트

```
[ ] 1. fullCapBot.ts 오버킬 할인 구현 (enemyHp <= attackDamage → effectValue=0)
[ ] 2. tsc 0 에러 확인
[ ] 3. vitest 기존 테스트 PASS (오버킬 할인 추가로 기존 테스트 영향 없는지)
[ ] 4. git commit (잔불 수정 + 오버킬 할인 합산 커밋)
[ ] 5. 새 커밋 해시 확보
[ ] 6. §4 dispatch 6줄 작성 (새 해시 포함)
[ ] 7. 3000판 × 3종 본시뮬 실행
[ ] 8. 클리어율 + CI 기재
[ ] 9. R3 vs R7 비교표
[ ] 10. 동봉 2건 (§5 응축 근거 / §6 R5 경위) 포함
[ ] 11. 결과 파일 작성: ZERA_BALANCE_V3_R7_RESULT_20260715.md
[ ] 12. 빌라드 보고 (이든 직접 연락 절대 금지)
```

---

## ⛔ 제한 사항

- 이든에게 직접 연락/메시지 절대 금지
- §4 dispatch 없는 시뮬 결과 이든이 접수 불가
- 채점표 튜닝(threshold 조정 등) 금지
- 오버킬 할인 외 추가 조정 금지

---

## 산출물

`/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_R7_RESULT_20260715.md`

---

_발행: 빌라드 ⚔️ — 2026-07-15_
