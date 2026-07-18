# ZERA T20 결과 보고서

**작성자**: 제라 (Zera)
**날짜**: 2026-07-16
**보고 대상**: 빌라드

---

## 1. 배율표 정화 완료

### 수동값 도입 커밋 특정

```
e3e3f51 feat: Recipe (B) 사주별 배율 주입
```

이 커밋에서 `toDanil` 섹션에 수동값(kiln=3.31, harvest=3.87, snipe=3.82, keen=6.95, forest=6.32, spring=5.35)이 최초 도입됨.

### 정화 전/후 비교표

| recipe ID       | 정화 전 (수동값) | 역산 K      | 정화 후 (K=0.8 공식) | 비고                |
|----------------|----------------|------------|---------------------|---------------------|
| fusion_forest   | 6.32           | 역산불명    | 5.00                | 0.09% → 889 → cap  |
| fusion_spring   | 5.35           | 역산불명    | 5.00                | 0.34% → 236 → cap  |
| fusion_mine     | 5.08           | ≈0.8(정상) | 5.00                | 19.63% → 5.08 → cap |
| fusion_kiln     | 3.31           | ≈0.184     | 5.00                | 7.98% → 11.03 → cap |
| fusion_wildfire | 5.00           | —          | 3.00                | 0% 발동불가 기본값   |
| fusion_keen     | 6.95           | 역산불명    | 5.00                | 13.44% → 6.95 → cap |
| fusion_snipe    | 3.82           | ≈0.992     | 4.08                | 25.96% → 4.08 (유일 미캡) |
| fusion_harvest  | 3.87           | ≈0.268     | 5.00                | 9.41% → 9.50 → cap |
| fusion_pierce   | 5.00           | —          | 3.00                | 0% 발동불가 기본값   |
| fusion_temper   | 6.32           | 역산불명    | 5.00                | 0.09% → 889 → cap  |

정화 결과: kiln=3.31→5.00, harvest=3.87→5.00, snipe=3.82→4.08, keen=6.95→5.00, forest=6.32→5.00, spring=5.35→5.00, wildfire=5.00→3.00(발동불가), pierce=5.00→3.00(발동불가).

---

## 2. T20 구현 E2E 지문

### 코드 인용

**구현 위치**: `/Users/bilard/.openclaw/workspace/paljapae/src/engine/pokerHandJudge.ts`

```
// T20: recipe 모드에서 gather5(5장) 필살기 계층 배율 override
// ⚠️ GATHER_MULTIPLIERS[5]=5.0 은 v3 모드 동결값 — 직접 수정 금지
// recipeMultipliers['_gather5'] 주입 시 그 값 우선 (B벌=7.0 측정용)
const gather5Mult = recipeMultipliers?.['_gather5'] ?? RECIPE_GATHER5_MULT_A
const multiplier = (COMBO_RULESET_VERSION === 'recipe' && count === 5)
  ? gather5Mult
  : (GATHER_MULTIPLIERS[count] ?? 1)
```

상수 정의 위치: `/Users/bilard/.openclaw/workspace/paljapae/src/engine/balance.ts`

```
export const RECIPE_GATHER5_MULT_A = 6.5  // 1벌 (A안)
export const RECIPE_GATHER5_MULT_B = 7.0  // 2벌 (B안)
```

### E2E 지문 테스트 결과

| 테스트 | 조건 | 배율 | 결과 |
|--------|------|------|------|
| [E2E-1] v3 모드, 토5장 | COMBO_RULESET_VERSION='v3' (기본값) | GATHER_MULTIPLIERS[5]=×5.0 | PASS |
| [E2E-2] recipe 모드, 토5장 | COMBO_RULESET_VERSION='recipe' (mock) | RECIPE_GATHER5_MULT_A=×6.5 | PASS |

테스트 파일:
- E2E-1: `/Users/bilard/.openclaw/workspace/paljapae/src/test/gatherMultiplierAudit.test.ts`
- E2E-2: `/Users/bilard/.openclaw/workspace/paljapae/src/test/t20RecipeGather.test.ts`

---

## 3. 측정 커밋

커밋 해시: `be21304`
커밋 메시지: `feat: T20 recipe gather5 override + toDanil 배율표 정화`

변경 파일:
- `paljapae/src/engine/balance.ts` — RECIPE_GATHER5_MULT_A/B 상수 추가 + toDanil 배율표 정화
- `paljapae/src/engine/pokerHandJudge.ts` — recipe 모드 gather5 override 구현
- `paljapae/src/test/gatherMultiplierAudit.test.ts` — E2E-1 테스트 (신규)
- `paljapae/src/test/t20RecipeGather.test.ts` — E2E-2 테스트 (신규)

---

## 4. 재측정 결과 (6회)

**측정 조건**: recipe 모드 / toDanil 배율표 정화 반영 / 1000판 / seed=i*12345+7777

| 벌 | gather5 | 목화    | 금수    | 토단일  | 게이트 판정                              |
|----|---------|---------|---------|---------|------------------------------------------|
| A  | ×6.5    | 35.7%   | 38.1%   | 43.0%   | 목화 PASS / 금수 PASS / 토단일 ≥25% PASS |
| B  | ×7.0    | 35.6%   | 40.1%   | 48.5%   | 목화 PASS / 금수 경계(40초과) / 토단일 ≥25% PASS |

**게이트 기준 적용**:
- 목화 25~40%: A=35.7% PASS / B=35.6% PASS
- 금수 25~40% (목표 36~38): A=38.1% PASS / B=40.1% 경계 (40.1%로 상한 0.1%p 초과)
- 토단일 ≥25%: A=43.0% PASS / B=48.5% PASS (상한 제약 없음)

**주목 사항**:
- B벌(×7.0)에서 금수 40.1% — 상한 40% 기준 0.1%p 초과. 측정 오차 범위 가능성 있음.
- 토단일 A=43%, B=48.5% — 배율 상향 효과가 토단일에 직접 반영됨.

---

## 5. 토단일 딜 분해 (A/B 각각)

**비고**: gather5(토 5장 모으기)는 `__recipeLog`가 `fusion_*` ID 조건으로만 푸시하므로 별도 집계됨. 아래 표는 레시피(융합) 기반 딜 분해이며, gather5 딜은 별도 경로로 클리어율 상승에 기여.

### A벌 (×6.5) 토단일 딜 분해

| 공격 유형         | 발동수 | 평균데미지 | 총딜     | 비중%  |
|-----------------|--------|-----------|---------|--------|
| fusion_keen     | 4,570  | 142       | 649,930 | 40.7%  |
| fusion_snipe    | 2,734  | 129       | 353,096 | 22.1%  |
| fusion_kiln     | 2,602  | 116       | 301,450 | 18.9%  |
| fusion_harvest  | 1,082  | 130       | 140,450 | 8.8%   |
| fusion_mine     | 884    | 153       | 134,880 | 8.4%   |
| fusion_temper   | 94     | 122       | 11,430  | 0.7%   |
| fusion_spring   | 48     | 118       | 5,640   | 0.4%   |
| fusion_forest   | 8      | 123       | 980     | 0.1%   |

- fusion_keen 의존도: **40.7%** (이전 69.4%에서 대폭 완화 — toDanil 배율표 정화 효과)
- fusion_snipe 22.1%, fusion_kiln 18.9%로 분산 개선

### B벌 (×7.0) 토단일 딜 분해

| 공격 유형         | 발동수 | 평균데미지 | 총딜     | 비중%  |
|-----------------|--------|-----------|---------|--------|
| fusion_keen     | 4,594  | 144       | 662,580 | 40.8%  |
| fusion_snipe    | 2,780  | 132       | 367,572 | 22.6%  |
| fusion_kiln     | 2,634  | 117       | 307,020 | 18.9%  |
| fusion_harvest  | 1,036  | 132       | 137,110 | 8.4%   |
| fusion_mine     | 848    | 157       | 132,830 | 8.2%   |
| fusion_temper   | 100    | 120       | 12,030  | 0.7%   |
| fusion_spring   | 32     | 124       | 3,960   | 0.2%   |
| fusion_forest   | 6      | 173       | 1,040   | 0.1%   |

- fusion_keen 의존도: **40.8%** — A벌과 유사, 정화 효과 유지
- A→B 배율 변경 시 각 레시피 발동 비중 거의 동일 (gather5 배율 변화는 선택 패턴 미변화)

**이전 측정 대비 keen 의존도 변화**: 69.4% → 40.7/40.8% (배율표 정화로 28.6%p 완화)

---

## 6. §4 dispatch 확인

**현황**: 구현 그대로 작동 확인됨.

- `__recipeLog.push({ recipeId: result.name, damage: result.totalScore })` 경로: fullCapBot.ts:411~417, 1021~1027
- recipe 모드에서 `fusion_*` ID를 가진 콤보만 로그에 쌓임
- gather5(같은 기운 5장 모으기)는 `result.name`이 "흙 모으기 5" 형태이므로 `startsWith('fusion_')` 조건 미충족 → 별도 집계
- 강림 슬롯 카운트(§4-b): `ENABLE_YONGSIN_DESCENT=false`이므로 현재 비활성 — 구조는 유지

**T20 gather5MultOverride 주입 경로**: `simulateFullCapRun(opts.gather5MultOverride)` → `initFullCapState()` → `recipeMultipliers['_gather5']` → `judgeCombo()` → `gather5Mult = recipeMultipliers['_gather5']` → 적용 확인.

---

## 7. 이든 처방 분기 예비 결론

### 게이트 통과 여부

| 벌 | 목화 | 금수 | 토단일 | 종합 |
|----|------|------|--------|------|
| A (×6.5) | PASS (35.7%) | PASS (38.1%) | PASS ≥25% (43.0%) | **ALL PASS** |
| B (×7.0) | PASS (35.6%) | 경계 (40.1%) | PASS ≥25% (48.5%) | **금수 경계** |

### 채택 권고

**A벌(×6.5) 채택 권고**:
- 목화/금수 모두 25~40% 게이트 통과 (목화 35.7%, 금수 38.1%)
- 토단일 43.0% — ≥25% 기준 충족, 클리어율 상승 뚜렷
- 금수 B벌(40.1%)은 상한 0.1%p 초과로 불안정 요소

### 예비 레버 ("외길 보정") 적용 가능성

토단일이 43%로 상한 40%를 초과하는 경우, 외길 보정이 필요하다면:
- 토단일 gather5만 별도 하향 (예: ×5.5 ~ 6.0)하는 프리셋별 분기 추가 가능
- 또는 토단일의 game이 "상한 없이 ≥25%" 조건이면 현재 A벌 그대로 채택

**결론**: 이든 확정 전 `COMBO_RULESET_VERSION='v3'`(기본값) 유지. A벌(×6.5) 채택 시 balance.ts의 `COMBO_RULESET_VERSION='recipe'`로 전환 필요.

---

## 완료 체크리스트

- [x] 수동값 도입 커밋 특정: `e3e3f51`
- [x] toDanil 배율표 정화 (balance.ts)
- [x] RECIPE_GATHER5_MULT_A=6.5 / RECIPE_GATHER5_MULT_B=7.0 상수 정의 (balance.ts)
- [x] recipe 분기 gather5 override 구현 (pokerHandJudge.ts + fullCapBot.ts gather5MultOverride)
- [x] E2E 지문 2건: v3 gather5=×5.0 PASS / recipe gather5=×6.5 PASS
- [x] 변경사항 커밋 (`be21304`)
- [x] A벌(×6.5) 3프리셋 × 1000판 측정 완료
- [x] B벌(×7.0) 3프리셋 × 1000판 측정 완료
- [x] 토단일 딜 분해 재측정 (A/B 각각)
- [x] §4 dispatch 확인
- [x] 산출물 파일 저장
