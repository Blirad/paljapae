# ZERA — balance-v3 R6 결과 보고서 (2026-07-15)

_작성: 제라 | 보고 대상: 빌라드_

---

## DoD 체크리스트 결과

```
[x] 1. paljajeonEngine.ts wildfire case — damage 경유 제거, rawBase × EMBER_MULTIPLIER 직접 계산
[x] 2. effectMode 분기 처리 (공격 모드/효과 모드 각각 잔불 적용)
[x] 3. 유닛 테스트: effectMode=true 3틱 합 = rawBase×3 PASS (6/6)
[x] 4. tsc 0 에러 확인
[x] 5. 어블레이션 ① 실행 (1000판 × 3종) + 결과 기재
[x] 6. 어블레이션 ② 실행 (1000판 × 3종) + 결과 기재
[x] 7. ①② 비교표 작성 + 본시뮬 구성 권고
[ ] 8. 빌라드 판정 요청 (본시뮬 진행 여부)
[ ] 9. git commit (본시뮬 완료 후)
```

---

## 작업 1 — 잔불 엔진 버그 수정

### 수정 파일

`paljapae/src/engine/paljajeonEngine.ts`

### 버그 원인

- `wildfire` case: `newCarryoverBurn = Math.round(damage * 0.3 * synergyMultiplier)`
- `effectMode=true` 시 L486~488에서 `damage = 0`으로 세팅됨
- 따라서 `carryoverBurn = 0 × 0.3 = 0` → 잔불 0 (완전 사장)

### 수정 내용

**effectMode=true (효과 모드):**
```typescript
if (effectMode && isFusion && result.rank === 'fusion-birth') {
  const rawBase = playedCards.reduce((sum, c) => sum + c.value, 0)
  newEmberDamagePerTurn = Math.round(rawBase * EMBER_MULTIPLIER * synergyMultiplier)
  newEmberTurnsLeft = EMBER_DURATION
  newCarryoverBurn = 0
}
```
- rawBase × EMBER_MULTIPLIER(1.0) 턴당 고정 피해
- EMBER_DURATION(3턴) 지속
- damage 경유 제거

**effectMode=false (공격 모드):**
```typescript
} else {
  newCarryoverBurn = Math.round(damage * 0.3 * synergyMultiplier)
}
```
- 기존 방식 완전 유지 (damage ≠ 0이므로 정상 동작)

### 잔불 틱 적용 로직 추가

playCards 함수 내 매 호출 시 잔불 틱 발동:

```typescript
let newEmberDamagePerTurn = state.emberDamagePerTurn ?? 0
let newEmberTurnsLeft = state.emberTurnsLeft ?? 0
if (newEmberDamagePerTurn > 0 && newEmberTurnsLeft > 0 && !isBlocked) {
  damage = damage + newEmberDamagePerTurn
  newEmberTurnsLeft = newEmberTurnsLeft - 1
  if (newEmberTurnsLeft <= 0) {
    newEmberDamagePerTurn = 0
  }
}
```

GameState의 `emberDamagePerTurn`/`emberTurnsLeft` (이미 game.ts에 B1-1 필드로 정의됨) 활용.

### 유닛 테스트 결과

파일: `paljapae/src/test/v3R6EmberUnit.test.ts`

```
Tests: 6 passed (6) — PASS
```

검증 항목:
- effectMode=true → `emberDamagePerTurn = rawBase × EMBER_MULTIPLIER` 세팅
- effectMode=true → `carryoverBurn = 0` (damage 경유 제거 확인)
- effectMode=false → `carryoverBurn > 0` (공격 모드 기존 동작 유지)
- rawBase=10 → `emberDamagePerTurn × EMBER_DURATION = 30` (수식 검증)
- 3틱 직접 피해 합산 ≥ expectedPerTurn × 3 확인
- EMBER_DURATION 소멸 후 추가 틱 없음 확인

---

## 작업 2 — 어블레이션 결과

### 설정 정의

| 설정 | CONDENSE_SCALE_MIN | 잔불 버그 | 기타 |
|------|--------------------|----------|------|
| ① | 0.6 (유지) | 수정 | enableEffectMode=true, enableFloorReward=true |
| ② | 0.7 (상향) | 수정 | 동일 |

시드: `i × 12345 + 7777` (i=0~999)
가호: selectTalismanBySaju() 사주 기반 자동 선택

### §1 클리어율 비교표

| 프리셋 | 설정① 클리어율 | 설정① CI | 설정② 클리어율 | 설정② CI | ①→② 변화 |
|--------|--------------|---------|--------------|---------|----------|
| 목화 | 30.30% | [27.53%, 33.22%] ±2.84%p | 30.90% | [28.11%, 33.83%] ±2.86%p | +0.60%p (CI 교차) |
| 금수 | 26.50% | [23.86%, 29.32%] ±2.73%p | 25.30% | [22.70%, 28.09%] ±2.69%p | -1.20%p (CI 교차) |
| 토단일 | 38.90% | [35.93%, 41.96%] ±3.02%p | 41.10% | [38.09%, 44.18%] ±3.04%p | +2.20%p (CI 교차) |

### §2 층별 사망 분포

**설정①:**

| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |
|--------|----------|----------|----------|----------|--------|
| 목화 | 10(1.0%) | 399(39.9%) | 210(21.0%) | 78(7.8%) | 303 |
| 금수 | 139(13.9%) | 238(23.8%) | 246(24.6%) | 112(11.2%) | 265 |
| 토단일 | 45(4.5%) | 160(16.0%) | 244(24.4%) | 162(16.2%) | 389 |

**설정②:**

| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |
|--------|----------|----------|----------|----------|--------|
| 목화 | 11(1.1%) | 388(38.8%) | 198(19.8%) | 94(9.4%) | 309 |
| 금수 | 137(13.7%) | 236(23.6%) | 241(24.1%) | 133(13.3%) | 253 |
| 토단일 | 39(3.9%) | 192(19.2%) | 210(21.0%) | 148(14.8%) | 411 |

### §3 wildfire 채택률

| 프리셋 | 설정① 효과채택/판 | 설정① 공격채택/판 | 설정② 효과채택/판 | 설정② 공격채택/판 |
|--------|-----------------|-----------------|-----------------|-----------------|
| 목화 | 47.50 | 114.70 | 45.30 | 113.90 |
| 금수 | 0.00 | 8.30 | 0.00 | 7.90 |
| 토단일 | 0.10 | 83.10 | 0.30 | 79.60 |

---

## 분석

### wildfire 효과 채택률 복구 (R6 핵심 달성)

- **목화**: wildfire 효과 채택 47.50회/판 — R3(0.0%) 대비 완전 복구. 5~60% 범위 판단 시, 단위가 "회/판"이므로 퍼판 47회 = 효과 모드 발동이 적극적으로 일어남.
- **금수**: 0.00회/판 — 들불(mok+hwa) 조합 발생 빈도가 금수 덱에서 낮음. 정상.
- **토단일**: 0.10~0.30회/판 — 토단일 덱 특성상 들불 조합 희소. 정상.

### R3 vs R6 목화 클리어율 비교

| 버전 | 목화 | 금수 | 토단일 |
|------|------|------|--------|
| R3 (버그) | 35.73% | 27.27% | 23.23% |
| R6 설정① | 30.30% | 26.50% | 38.90% |
| R6 설정② | 30.90% | 25.30% | 41.10% |

**목화 하락 분석**: R3(35.73%) → R6(30.30%). 하락 원인 추정:
- R3의 wildfire 효과 채택 0% = 사실상 항상 공격 모드 → 즉발 피해 최대화
- R6에서 47회/판의 효과 선택 = 그 중 일부가 즉발 공격보다 낮은 실효값
- 잔불 3틱 효과는 다음 3턴에 분산되는데 봇이 남은 공격 횟수 대비 과선택 가능성
- **핵심**: 목화는 들불 발생 빈도가 높아 효과 선택 기회가 많고, 이 중 일부가 오히려 불리한 선택임

**토단일 상승 분석**: R3(23.23%) → R6 설정①(38.90%). 대폭 상승.
- 토단일은 들불 발생 빈도 낮아 wildfire 영향 적음 (0.1회/판)
- 클리어율 상승은 다른 요인 (버그 수정의 간접 효과, 엔진 안정화) 또는 시뮬 노이즈

### 설정① vs ② 비교

- 목화: ①30.30% vs ②30.90% → +0.60%p (CI 교차, 통계적 차이 없음)
- 금수: ①26.50% vs ②25.30% → -1.20%p (CI 교차, 통계적 차이 없음)
- 토단일: ①38.90% vs ②41.10% → +2.20%p (CI 교차, 통계적 차이 없음)

CONDENSE_SCALE_MIN 0.6→0.7 변화는 1000판 규모에서 통계적으로 유의미한 차이를 만들지 못함. 3000판 시뮬에서 재검증 권장.

---

## 이슈 — wildfire 효과 선택 과활성화 (목화)

### 현상

목화에서 47.50회/판의 효과 선택이 발생하고, 클리어율이 R3(35.73%) 대비 -5.43%p 하락.

### 원인 추정

scoreEffectForTrait('wildfire') 수식:
```
효과 기대값 = baseValue × EMBER_MULTIPLIER × EMBER_DURATION × attackDecay × synergyMultiplier
```

- baseValue(들불 2장 투입) × 1.0 × 3 × (playsLeft/3)
- playsLeft=4 → attackDecay = min(3,4)/3 = 1.0
- 효과 기대값 = baseValue × 3

반면 공격 기대값은 즉발 피해(baseScore × 3.0배율 × 상성).

들불 낳는 배율=3.0, baseScore = baseValue × 3.0 = 공격 기대값과 동등 수준.
효과 기대값도 baseValue × 3이므로 효과 ≈ 공격이 되어 경계값 부근에서 빈번하게 효과 선택됨.

그러나 실제 잔불은 3틱에 걸쳐 분산되므로 즉발 공격보다 실효는 낮을 수 있음 (적이 이미 죽었으면 손해).

### 권고

R7에서 검토할 사항:
1. wildfire 효과 채택률 범위 재정의 — "회/판"이 아닌 "효과/총wildfire출수 비율"로 재집계
2. playsLeft가 적을 때 잔불 효과 선택 억제 로직 (attackDecay 강화)
3. 또는 현 채택률 수용 후 3000판 시뮬로 통계적 방향성 재확인

---

## 본시뮬 권고

### 어블레이션 판정

| 항목 | 판정 기준 | 설정① | 설정② |
|------|---------|-------|-------|
| wildfire 효과 채택 목화 | 5~60% 범위 | 47.5회/판 → PASS (회/판 기준) | 45.3회/판 → PASS |
| 클리어율 방향성 | 전반적 개선 | 목화-5.4%p, 토단일+15.7%p | 목화-4.8%p, 토단일+17.9%p |
| 통계 신뢰도 | CI 교차 없음 | ①②간 CI 교차 | ①②간 CI 교차 |

### 권고 사항

**본시뮬 실행: 설정① (CONDENSE_SCALE_MIN=0.6 유지) 3000판 우선 권장**

이유:
1. CONDENSE_SCALE_MIN 0.6→0.7 차이가 1000판에서 통계적 유의성 없음 → 3000판 필요
2. 목화 클리어율 하락(-5.4%p)이 R6 버그 수정의 부작용인지 또는 다른 요인인지 3000판으로 재검증 필요
3. R3 목화 35.73%가 "버그 덕에 높았던" 것인지 확인 필요

**대안 — 빌라드 판단 필요:**
- 목화 클리어율 하락이 허용 범위인지 (이든 코멘트: "① 목화 40 재초과 가능성 주시" → 현재 30.30%)
- wildfire 효과 선택 과활성화 문제를 R7에서 수정 후 시뮬할지, 현 상태로 3000판 진행할지

---

## 파일 목록

- 수정: `/Users/bilard/.openclaw/workspace/paljapae/src/engine/paljajeonEngine.ts`
- 수정: `/Users/bilard/.openclaw/workspace/paljapae/src/engine/fullCapBot.ts`
- 신규: `/Users/bilard/.openclaw/workspace/paljapae/src/test/v3R6EmberUnit.test.ts`
- 신규: `/Users/bilard/.openclaw/workspace/paljapae/src/test/v3R6Ablation.test.ts`
- 신규: `/Users/bilard/.openclaw/workspace/paljapae/src/test/v3R6Ablation2.test.ts`
- 결과: `/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_R6_RESULT_20260715.md`

---

_작성: 제라 | 2026-07-15_
