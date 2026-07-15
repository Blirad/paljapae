# ZERA — balance-v3 R6 재현 검증 dispatch (2026-07-15)

_발행: 빌라드 ⚔️ | 이든 지시: 구성 고정 후 재현 검증 1000판_

---

## 배경

R6 어블레이션에서 토단일 +15.7%p 발생. 원인 확정:
- **프리셋 불일치**: R6 어블레이션 테스트(v3R6Ablation.test.ts)가 R3 기준 프리셋과 다른 값 사용
- R3 기준 토단일: to:14, R6 어블레이션: to:6 → 비교 무효

이든 지시: R3 조건 복원 → 토단일 23%대 재현 확인 → 차이 요인 1개씩 켜며 특정

---

## 작업 — 재현 검증 1000판

### 구성 고정 원칙

모든 설정을 R3 완료 당시와 동일하게 고정.

**프리셋 (R3 기준, v3MainSim3000.test.ts 실측값 사용)**:
- 목화: {mok:4, hwa:4, to:2, geum:2, su:2}
- 금수: {mok:2, hwa:2, to:2, geum:4, su:4}
- 토단일: {mok:1, hwa:1, to:14, geum:2, su:2}

**기타 조건**:
- 시드: i×12345+7777 (i=0~999)
- enableEffectMode: true
- enableFloorReward: true
- enableCondenseClamp: true (기준값 10, 하한 0.6)
- 가호: selectTalismanBySaju(dist)

### 단계별 실행

#### 단계 A: R3 조건 완전 복원 (1000판)

현재 R6 수정 코드 상태에서 R3 기준 프리셋으로 실행.
목표: 토단일 23%대 재현 여부 확인.

엔진 상태 (현재): R6 잔불 수정 적용 (effectMode=true 시 rawBase×EMBER_MULTIPLIER 직접 계산)

결과 기록:
- 클리어율 3종 + Wilson 95% CI
- wildfire 효과채택율 (count/n, ×100 없이) — 단위 반드시 "%"로 표기
- attack_wildfire_used/판

#### 단계 B: 요인 비교 (단계 A 결과 기반, 빌라드 판단 후 진행)

단계 A에서 토단일 23%대 재현되면 → R6 잔불 수정이 원인이 아님 확정.
단계 A에서 토단일이 여전히 높으면 → R6 엔진 수정 자체가 원인.

---

## 채택률 집계 수정 필수

R6 어블레이션에서 집계 오류 발견:
```typescript
// 현행 오류
wildfireEffectRate = (wildfireEffectCount / n) * 100  // ×100 하고 "회/판" 표기
```

재현 검증에서는 반드시:
```typescript
// 수정: "%" 단위
wildfireEffectPct = (wildfireEffectCount / n) * 100   // "wildfire효과 선택률 (%)"
// 또는
wildfireEffectPerGame = wildfireEffectCount / n        // "wildfire효과 선택/판"
```

단위를 명확히 표기. "회/판"이면 ×100 없이.

---

## DoD 체크리스트

```
[ ] 1. 프리셋 R3 기준으로 고정 확인 (to:14 등)
[ ] 2. 단계 A 1000판 × 3종 실행
[ ] 3. 클리어율 (Wilson 95% CI) 기재
[ ] 4. wildfire 채택률 단위 명확화 (% 또는 /판, ×100 오류 수정)
[ ] 5. R3 결과와 비교표 작성
[ ] 6. 토단일 재현 여부 판정
[ ] 7. 결과 파일 작성: ZERA_BALANCE_V3_R6_REPRO_RESULT_20260715.md
[ ] 8. 빌라드 보고 (이든 직접 연락 금지)
```

---

## ⛔ 제한 사항

- 3000판 발사 금지 (이든 지시)
- dispatch 6줄 없는 시뮬 결과 이든이 접수 불가
- 이든에게 직접 연락/메시지 절대 금지

---

## 발사 전 확인 6줄 (결과 파일에 반드시 포함)

```
커밋: [실행 시점 git HEAD 해시]
프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}
조건: enableEffectMode=true/enableFloorReward=true/enableCondenseClamp=true(기준10,하한0.6)
시드: i×12345+7777 (i=0~999)
가호: selectTalismanBySaju(dist) 자동 [실측 결과 기재]
기타: 채택률 단위 "%" 또는 "/판" 명시 (×100 여부 표기)
```

---

## 산출물

`/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_R6_REPRO_RESULT_20260715.md`

---

_발행: 빌라드 ⚔️ — 2026-07-15_
