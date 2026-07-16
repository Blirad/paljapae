# 제라 작업 산출물 — 레시피제 구조 정본화 + 성립률 전면 재실측

**발행**: 제라 → 빌라드
**날짜**: 2026-07-16
**지시 파일**: ZERA_T20_RECIPE_GATHER_20260716_V2.md
**커밋 해시**: eabeeb2

---

## 완료 체크리스트

- [x] balance.ts RECIPE_MAP 5쌍 elem2 고정 (벼림/담금질/개간 null→특정원소, 제방 elem1 변경)
- [x] balance.ts 들불 화+화 → 목+화
- [x] RecipeSpec 인터페이스 fusionType 필드 추가 (isHone 판별 기반 변경)
- [x] pokerHandJudge.ts judgeCombo(): isHone = spec.elem2 === null → fusionType 필드 기반
- [x] pokerHandJudge.ts detectRecipe(): null 분기 제거, 전 레시피 특정 원소쌍 판정
- [x] 한글 정본명 코드 주석 반영
- [x] E2E-1: elem2 고정 판정 코드 인용 + assert (16 테스트 PASS)
- [x] E2E-2: 들불 목+화 단위 테스트 (포함)
- [x] 성립률 3프리셋 × 10쌍 재실측 (핸드 샘플링 10000핸드)
- [x] 배율표 3프리셋 재산출 (balance.ts 업데이트)
- [x] 변경사항 커밋 (eabeeb2)
- [x] 1000판 × 3프리셋 클리어율 측정
- [x] §4 dispatch 확인
- [x] TASKS.md 판정 로그 2건 추가

---

## 작업 1: RECIPE_MAP 수정 전/후 10쌍 비교표

| 레시피 ID | 정본명 | 극 관계 | 구 elem1 | 구 elem2 | 신 elem1 | 신 elem2 | 변경 |
|----------|-------|--------|---------|---------|---------|---------|-----|
| fusion_forest | 숲 | 수생목 | su | mok | su | mok | 변경 없음 |
| fusion_spring | 샘 | 금생수 | geum | su | geum | su | 변경 없음 |
| fusion_mine | 광맥 | 토생금 | to | geum | to | geum | 변경 없음 |
| fusion_kiln | 옹기가마 | 화생토 | hwa | to | hwa | to | 변경 없음 |
| fusion_wildfire | 들불 | 목생화 | hwa | **hwa** | mok | **hwa** | elem1 변경 (오기 수정) |
| fusion_keen | 벼림 | 금극목 | geum | **null** | geum | **mok** | elem2 고정 |
| fusion_snipe | 담금질 | 수극화 | su | **null** | su | **hwa** | elem2 고정 |
| fusion_harvest | 개간 | 목극토 | mok | **null** | mok | **to** | elem2 고정 |
| fusion_pierce | 제방 | 토극수 | **geum** | su | **to** | su | elem1 변경 (토극수 정본) |
| fusion_temper | 주물 | 화극금 | hwa | geum | hwa | geum | 변경 없음 |

**비고**:
- fusion_pierce와 fusion_spring이 구버전에서 동일 원소(금+수)로 충돌 → 정본화로 해소 (pierce=토+수, spring=금+수)
- fusionType: birth/hone 명시 필드 추가 (RecipeSpec 인터페이스)
- judgeCombo()의 `isHone = spec.elem2 === null` 로직 → `recipeEntry.fusionType === 'hone'`으로 변경

---

## 작업 2: E2E 지문

### E2E-1: elem2 고정 판정 코드 인용

**판정 코드 (pokerHandJudge.ts detectRecipe()):**
```typescript
// 3장: elem1 1장+elem2 2장 또는 elem2 1장+elem1 2장
if (elementCounts[elem1] >= 1 && elementCounts[elem2] >= minCount) return recipeId
if (elementCounts[elem2] >= 1 && elementCounts[elem1] >= minCount) return recipeId
```

elem2가 특정 원소로 고정되어 있으므로, `elementCounts[elem2]`는 해당 원소 카드 수만 카운트.
구버전의 `elem2 === null` 분기 (타원소 전부 허용)는 완전 제거.

**테스트 결과** (`src/test/recipeStructureE2E.test.ts` — 16 PASS):

| 테스트 케이스 | 입력 | 기대 결과 | 실제 결과 |
|------------|------|---------|---------|
| keen 성립: geum1+mok2 | 금1+목2 | fusion_keen | PASS |
| keen 성립: geum2+mok1 | 금2+목1 | fusion_keen | PASS |
| keen 대형 성립: geum2+mok3 | 금2+목3 | fusion_keen | PASS |
| keen 불성립: geum1+su2 | 금1+수2 | fusion_spring (not keen) | PASS |
| keen 불성립: geum1+hwa2 | 금1+화2 | fusion_temper (not keen) | PASS |
| harvest 성립: mok1+to2 | 목1+토2 | fusion_harvest | PASS |
| harvest 불성립: mok1+hwa2 | 목1+화2 | fusion_wildfire (not harvest) | PASS |
| snipe 성립: su1+hwa2 | 수1+화2 | fusion_snipe | PASS |
| snipe 불성립: su1+mok2 | 수1+목2 | fusion_forest (not snipe) | PASS |
| pierce 성립: to1+su2 | 토1+수2 | fusion_pierce | PASS |
| pierce 불성립: geum1+su2 | 금1+수2 | fusion_spring (not pierce) | PASS |

### E2E-2: 들불 목+화 단위 테스트

| 테스트 케이스 | 입력 | 기대 결과 | 실제 결과 |
|------------|------|---------|---------|
| wildfire 성립: mok1+hwa2 | 목1+화2 | fusion_wildfire | PASS |
| wildfire 성립: mok2+hwa1 | 목2+화1 | fusion_wildfire | PASS |
| wildfire 대형: mok2+hwa3 | 목2+화3 | fusion_wildfire | PASS |
| wildfire 불성립: hwa3 | 화3장 | null (not wildfire) | PASS |
| wildfire 불성립: hwa5 | 화5장 | null (not wildfire) | PASS |

---

## 작업 3: 성립률 전면 재실측 결과 (3프리셋 × 10쌍)

**측정 조건**: 핸드 샘플링 10000핸드, 3장/5장 조합 전수, detectRecipe() 직접 호출
**측정 파일**: `src/test/recipeFormationRateV2.test.ts`

### 목화 (mok:4, hwa:4, to:2, geum:2, su:2)

| 레시피 ID | 성립률(%) | K=0.8 배율 산출 | 비고 |
|----------|---------|--------------|-----|
| fusion_forest | 4.63% | cap 5.00 | |
| fusion_spring | 1.12% | cap 5.00 | |
| fusion_mine | 1.12% | cap 5.00 | |
| fusion_kiln | 4.59% | cap 5.00 | |
| fusion_wildfire | 15.58% | 1+0.8/0.1558=6.13→cap 5.00 | 목+화 정본화로 급등 |
| fusion_keen | 4.56% | cap 5.00 | 구 elem2=null: 45.84%→4.56% 대폭 하락 |
| fusion_snipe | 4.64% | cap 5.00 | 구 elem2=null: 31.78%→4.64% 대폭 하락 |
| fusion_harvest | 4.58% | cap 5.00 | 구 elem2=null: 48.76%→4.58% 대폭 하락 |
| fusion_pierce | 1.13% | cap 5.00 | 구 elem1=geum: 0%→1.13% (토+수 성립) |
| fusion_temper | 4.54% | cap 5.00 | |

### 금수 (mok:2, hwa:2, to:2, geum:4, su:4)

| 레시피 ID | 성립률(%) | K=0.65 배율 산출 | 비고 |
|----------|---------|---------------|-----|
| fusion_forest | 4.58% | cap 5.00 | |
| fusion_spring | 15.87% | 1+0.65/0.1587=5.10→cap 5.00 | 금+수 최고 |
| fusion_mine | 4.60% | cap 5.00 | |
| fusion_kiln | 1.10% | cap 5.00 | |
| fusion_wildfire | 1.11% | cap 5.00 | |
| fusion_keen | 4.55% | cap 5.00 | 구 76.80%→4.55% 폭락 (mok 특정) |
| fusion_snipe | 4.66% | cap 5.00 | 구 39.25%→4.66% |
| fusion_harvest | 1.11% | cap 5.00 | |
| fusion_pierce | 4.61% | cap 5.00 | 토+수 성립 |
| fusion_temper | 4.61% | cap 5.00 | |

### 토단일 (mok:1, hwa:1, to:14, geum:2, su:2)

| 레시피 ID | 성립률(%) | K=0.8 배율 산출 | 비고 |
|----------|---------|--------------|-----|
| fusion_forest | 0.09% | cap 5.00 | |
| fusion_spring | 0.34% | cap 5.00 | |
| fusion_mine | 19.59% | 1+0.8/0.1959=5.08→cap 5.00 | 토+금 최고 |
| fusion_kiln | 7.85% | 1+0.8/0.0785=11.19→cap 5.00 | |
| fusion_wildfire | 0.00% | 기본값 3.00 | 발동불가 (목 1장) |
| fusion_keen | 0.09% | cap 5.00 | |
| fusion_snipe | 0.09% | cap 5.00 | |
| fusion_harvest | 7.93% | 1+0.8/0.0793=11.09→cap 5.00 | 목+토 (토 풍부) |
| fusion_pierce | 19.53% | 1+0.8/0.1953=5.10→cap 5.00 | 토+수 정본화로 신규 최고 |
| fusion_temper | 0.09% | cap 5.00 | |

**구조 특성**: 정본화 후 원소 특정으로 성립률 대부분 < 20% → K 공식 전량 상한 5.0 cap.
단, 토단일 mine/pierce는 약 20%에 근접하여 공식값 ~5.08~5.10 → cap에 근접.

---

## 작업 4: 배율표 재산출 결과 (balance.ts 업데이트 완료)

정본화 후 성립률 < 20% → 배율 공식 전량 cap 5.0 (wildfire 토단일=0% 제외).

| 레시피 ID | mokHwa | geumSu | toDanil | 비고 |
|----------|--------|--------|---------|-----|
| fusion_forest | 5.00 | 5.00 | 5.00 | |
| fusion_spring | 5.00 | 5.00 | 5.00 | |
| fusion_mine | 5.00 | 5.00 | 5.00 | |
| fusion_kiln | 5.00 | 5.00 | 5.00 | |
| fusion_wildfire | 5.00 | 5.00 | **3.00** | 토단일 발동불가 기본값 |
| fusion_keen | 5.00 | 5.00 | 5.00 | 구: mokHwa 2.75, geumSu 1.85 |
| fusion_snipe | 5.00 | 5.00 | 5.00 | 구: mokHwa 2.32, geumSu 2.66 |
| fusion_harvest | 5.00 | 5.00 | 5.00 | 구: mokHwa 2.64 |
| fusion_pierce | 5.00 | 5.00 | 5.00 | 구: 전량 3.00(발동불가) |
| fusion_temper | 5.00 | 5.00 | 5.00 | |

balance.ts `RECIPE_MULTIPLIER_BY_PRESET` 3개 섹션 전량 업데이트 완료.

---

## 작업 4 (측정): 1000판 × 3프리셋 클리어율

**측정 조건**:
- recipe 모드 (COMBO_RULESET_VERSION='recipe')
- gather5 × 6.5 유지 (A벌 확정값)
- 구조 정본화 + 배율표 재산출 반영
- 커밋: eabeeb2

| 프리셋 | 클리어율 | 게이트 25~40 | |
|--------|---------|------------|--|
| 목화 | **27.90%** | PASS | |
| 금수 | **26.40%** | PASS | |
| 토단일 | **33.40%** | PASS | |
| **격차** | **7.0%p** | **≤15 PASS** | |

**전 프리셋 25~40 + 격차 ≤15 — 게이트 통과.**

### 금수 recipe 딜 분해 [B] (1000판 누적)

| 레시피 ID | 발동수 | 평균데미지 | 총딜 | 비중% |
|----------|--------|---------|-----|------|
| fusion_forest | 1988회 | 130 | 258120 | 16.7% |
| fusion_spring | 2070회 | 147 | 303390 | 19.6% |
| fusion_mine | 1748회 | 125 | 218880 | 14.1% |
| fusion_pierce | 1176회 | 126 | 148340 | 9.6% |
| fusion_snipe | 1600회 | 127 | 202500 | 13.1% |
| fusion_temper | 822회 | 131 | 107860 | 7.0% |
| fusion_kiln | 920회 | 118 | 108890 | 7.0% |
| fusion_wildfire | 546회 | 120 | 65270 | 4.2% |
| fusion_harvest | 570회 | 117 | 66680 | 4.3% |
| fusion_keen | 500회 | 139 | 69410 | 4.5% |

**관찰**: 정본화 후 금수 딜이 spring(19.6%), forest(16.7%), mine(14.1%), snipe(13.1%)으로 고르게 분산. 구버전 keen 쏠림(76.8% 성립) 완전 해소. keen은 발동수 500회(4.5%)로 최소 그룹.

### 토단일 α 성립률 [C]

소응축(α) 성립: 159818/165525 = **96.6%**

---

## 작업 5: TASKS.md 판정 로그

추가 완료 (TASKS.md 기록):

1. `gather5 토단일 정체성 회복 (2026-07-16 이든 판정)` — gather5 39.2%, 연환 6.8%
2. `레시피 구조 정본화 (2026-07-16 이든 판정)` — 벼리는 5쌍 elem2 고정 + 들불 목+화 + 제방 토+수, 커밋 eabeeb2

---

## 작업 6: §4 dispatch 확인

### 1. fusion_pierce vs fusion_spring 충돌 해소

| | 구버전 | 정본화 후 |
|---|-------|---------|
| fusion_spring | geum+su | geum+su (불변) |
| fusion_pierce | **geum**+su | **to**+su |

구버전에서 금3+수2 입력 시 spring과 pierce 양쪽이 성립 가능 (RECIPE_MAP 순회 순서 의존). 정본화 후 pierce=to+su로 변경 → 금+수는 spring만, 토+수는 pierce만 성립. 충돌 완전 해소.

E2E 확인 (`recipeStructureE2E.test.ts`):
- 금1+수2 → fusion_spring (not pierce) PASS
- 토1+수2 → fusion_pierce PASS

### 2. fusion_temper vs fusion_snipe 충돌 없음

| | elem1 | elem2 |
|---|------|------|
| fusion_temper | hwa | geum |
| fusion_snipe | su | hwa |

hwa+geum vs su+hwa — 원소 쌍이 다름. 충돌 없음 확인.

### 3. 새 elem2 고정 후 레시피 감지 우선순위

detectRecipe() 판정 로직 (정본화 후):
```typescript
// 3장: elem1 1장+elem2 2장 또는 elem2 1장+elem1 2장
if (elementCounts[elem1] >= 1 && elementCounts[elem2] >= minCount) return recipeId
if (elementCounts[elem2] >= 1 && elementCounts[elem1] >= minCount) return recipeId
```

모든 레시피가 특정 2원소 쌍만 성립 → RECIPE_MAP 순회 순서에 관계없이 1:1 매핑 보장.

**중복 매칭 가능성 검사** (10쌍 원소 쌍 목록):
- forest: su+mok
- spring: geum+su
- mine: to+geum
- kiln: hwa+to
- wildfire: mok+hwa
- keen: geum+mok
- snipe: su+hwa
- harvest: mok+to
- pierce: to+su
- temper: hwa+geum

각 쌍 유일성 확인: 10쌍 모두 서로 다른 원소 조합. 중복 없음. 우선순위 문제 없음.

**단, 주의**: 3장 조합 판정에서 `elementCounts[elem2] >= 1 && elementCounts[elem1] >= minCount`가 역방향 성립을 허용하므로, geum2+mok1은 fusion_keen (elem1=geum, elem2=mok의 역방향). 이는 의도된 동작.

---

## 파일 목록

- `/Users/bilard/.openclaw/workspace/paljapae/src/engine/balance.ts` — RECIPE_MAP 정본화 + 배율표 재산출
- `/Users/bilard/.openclaw/workspace/paljapae/src/engine/pokerHandJudge.ts` — detectRecipe() + judgeCombo() 수정
- `/Users/bilard/.openclaw/workspace/paljapae/src/test/recipeStructureE2E.test.ts` — E2E 지문 16 테스트
- `/Users/bilard/.openclaw/workspace/paljapae/src/test/recipeFormationRateV2.test.ts` — 성립률 재실측
- `/Users/bilard/.openclaw/workspace/paljapae/src/test/batch1RecipeDetect.test.ts` — 들불 테스트 수정
- `/Users/bilard/.openclaw/workspace/paljapae/TASKS.md` — 판정 로그 2건 추가

---

## 측정 커밋 해시

`eabeeb2` — fix: 레시피 구조 정본화 — elem2 null→극관계 원소 고정 + 들불 목+화 복원
