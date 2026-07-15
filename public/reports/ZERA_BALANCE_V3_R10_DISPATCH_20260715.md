# ZERA — balance-v3 R10 (4층 HP 하향 + 본시뮬 3000판) (2026-07-15)

_발행: 빌라드 ⚔️ | 이든 R10 지시_

---

## 확정 사항 (재론 금지)

- R9 = 목화·금수·격차 PASS 확정 (목화 37.87%/금수 35.60%/격차 13.17%p)
- 응축 레버 계열(CONDENSE_SCALE_BASE) 공식 폐기 — 3연속 미달
- 잔불 EMBER_MULTIPLIER = 2.6/3 동결 (롤백 금지)
- 2층 HP = 445 동결
- CONDENSE_SCALE_BASE = 8 동결

---

## 작업 1 — 4층 HP 하향

### 변경 대상

`paljapae/src/engine/balance.ts` — FLOOR_CONFIGS 내 floor:4 enemyHp

### 변경 내용

```typescript
// 변경 전 (R9)
{ floor: 4, enemyHp: 560, ... }

// 변경 후 (R10)
{ floor: 4, enemyHp: 540, ... }
```

**타 수치 전면 동결** (R9 상태 그대로):
- 2층 enemyHp: 445 (변경 없음)
- CONDENSE_SCALE_BASE: 8 (변경 없음)
- CONDENSE_SCALE_MIN: 0.6 (변경 없음)
- EMBER_MULTIPLIER: 2.6/3 (변경 없음)
- EMBER_DURATION: 3 (변경 없음)

---

## 작업 2 — 커밋

커밋 후 새 해시 확보 필수. §4 dispatch에 이 해시 사용.

커밋 메시지: `balance(R10): 4층 HP 560→540`

---

## 작업 3 — 본시뮬 3000판 × 3종

### §4 dispatch 6줄 (결과 파일 첫 섹션 필수)

```
커밋: [작업2에서 확보한 새 해시]
프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}
조건: enableEffectMode=true/enableFloorReward=true/enableCondenseClamp=true(기준8,하한0.6)
시드: i×12345+7777 (i=0~2999)
가호: selectTalismanBySaju(dist) — [실측 결과 기재]
채택률 단위: "%" — (count/n)×100, 단위 "%" 명시
```

**§4 없으면 이든이 결과 접수 불가. 절대 누락 금지.**

### 조건

- 시드: i×12345+7777 (i=0~2999)
- enableEffectMode: true
- enableFloorReward: true
- enableCondenseClamp: true (기준값 8, 하한 0.6)
- 프리셋: R9 기준 3종
- 가호: selectTalismanBySaju(dist) 자동

### 집계 항목

- 클리어율 + Wilson 95% CI
- 층별 사망 분포 (4층 사망 변화 특히 확인)
- wildfire 효과 채택률 (목화 15%+ 유지 여부)
- R9 vs R10 비교표
- 이든 예상 착지 vs 실측 비교

이든 예상 착지 (R10):
- 목화: ≈ 38.7%
- 금수: ≈ 36.4%
- 토단일: ≈ 26.2%
- 격차: ≈ 12.5%p

---

## PASS 판정 시 즉시 실행 2건

### ① git tag balance-v3

```bash
git tag balance-v3
```

PASS 기준 (이든 지시 — 전 항목 충족 시):
- 목화: 25~40% 범위 내
- 금수: 25~40% 범위 내
- 토단일: 25~40% 범위 내 (현재 유일 잔여)
- 격차: ≤15%p

전 항목 PASS 시 그 자리에서 즉시 태그 실행. 대기 없음.

### ② v2→v3 전체 변경 요약표

결과 파일 내 별도 섹션으로:

| 항목 | v2 기준 (balance-v2 @ 323920f) | v3 변경 | 커밋 | 라운드 |
|------|-------------------------------|---------|------|--------|
| 양자택일 구조 (공격/효과) | 미구현 | enableEffectMode=true — fusion-birth 조합 시 공격/효과 택일 | [R5 커밋] | R5 |
| 효과 5종 공식 정비 | 엔진 damage 경유 | rawBase×EMBER_MULTIPLIER 직접 계산 | 221368c | R6 |
| E안 시너지 반영 | 미반영 | synergyMultiplier 참조 통일 | 221368c | R6 |
| 잔불 재정의 총배율 | ×3.0 (EMBER_MULTIPLIER=1.0×3) | ×2.6 (EMBER_MULTIPLIER=2.6/3) | 34f2830 | R8 |
| 응축 clamp 기준값 | 10 (CONDENSE_SCALE_BASE) | 8 | e40e0c8 | R9 |
| 응축 clamp 하한 | 0.6 (CONDENSE_SCALE_MIN) | 0.6 (동결) | — | — |
| 오버킬 할인 | 미구현 | attackDamage>=enemyHp → effectValue=0 | 221368c | R7 |
| 2층 HP | 430 | 445 | e40e0c8 | R9 |
| 4층 HP | 560 | 540 | [R10 커밋] | R10 |

표 내 커밋/라운드 모두 병기 필수.

---

## DoD 체크리스트

```
[ ] 1. balance.ts floor:4 enemyHp = 540 변경 (560→540)
[ ] 2. 타 수치 전면 동결 확인 (2층445/BASE=8/MIN=0.6/EMBER×2.6/3)
[ ] 3. tsc 0 에러 확인
[ ] 4. vitest 신규 실패 0건 확인
[ ] 5. git commit — 새 커밋 해시 확보
[ ] 6. §4 dispatch 6줄 작성 (새 해시 포함)
[ ] 7. 3000판 × 3종 본시뮬 실행 (enableEffectMode=true, enableFloorReward=true)
[ ] 8. 클리어율 + Wilson 95% CI 기재
[ ] 9. 층별 사망 분포 (4층 사망 변화 확인)
[ ] 10. wildfire 채택률 기재 (목화 15%+ 확인)
[ ] 11. R9 vs R10 비교표
[ ] 12. 이든 예상 착지 vs 실측 비교
[ ] 13. PASS 판정 시: git tag balance-v3 즉시 실행
[ ] 14. PASS 판정 시: v2→v3 전체 변경 요약표 작성 (커밋·라운드 병기)
[ ] 15. 결과 파일 작성: ZERA_BALANCE_V3_R10_RESULT_20260715.md
[ ] 16. 빌라드 보고
```

---

## ⛔ 제한 사항

- 이든에게 직접 연락/메시지 절대 금지
- §4 dispatch 없는 시뮬 결과 이든이 접수 불가
- 4층 HP 540 외 추가 수치 변경 금지
- 응축 레버(CONDENSE_SCALE_BASE) 추가 조정 금지 — 폐기 확정
- 잔불 EMBER_MULTIPLIER 변경 금지 — 동결

---

## 산출물

`/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_R10_RESULT_20260715.md`

---

_발행: 빌라드 ⚔️ — 2026-07-15_
