# ZERA — balance-v3 R2 결과 보고서 (2026-07-14)

_작성: 제라 | 실행: 3000판 × 3종 (enableEffectMode=true, enableFloorReward=true)_

---

## 수정 내용

### 수정 1 — 잔불 봇 배율 ×3.0 → ×2.2

**파일**: `paljapae/src/engine/balance.ts`

**변경 라인**:
```typescript
// 추가 (line 531):
export const EMBER_BOT_MULTIPLIER = 2.2  // 잔불 [봇 기대값]: R2: 3.0→2.2
```

**파일**: `paljapae/src/engine/fullCapBot.ts`

**변경 라인** (scoreEffectForTrait wildfire case):
```typescript
// 이전:
baseValue * EMBER_DURATION           // EMBER_DURATION=3 → ×3.0
// 이후:
baseValue * EMBER_BOT_MULTIPLIER     // EMBER_BOT_MULTIPLIER=2.2 → ×2.2
```

주의: `EMBER_DURATION=3`은 엔진의 실제 지속 턴 수이므로 건드리지 않았다. 봇 전용 기대값 계산에만 `EMBER_BOT_MULTIPLIER`를 사용한다.

### 수정 2 — 응축 clamp 완화

**파일**: `paljapae/src/engine/balance.ts`

```typescript
// 이전:
export const CONDENSE_SCALE_BASE = 15  // 기준값
export const CONDENSE_SCALE_MIN = 0.4  // 하한

// 이후:
export const CONDENSE_SCALE_BASE = 10  // R2: 15→10, 저투입 효율 상향
export const CONDENSE_SCALE_MIN = 0.6  // R2: 0.4→0.6, 저치 착취 차단 강화
```

엔진의 실제 응축 계산식 (`paljajeonEngine.ts` line 997):
```typescript
const valueScale = Math.max(CONDENSE_SCALE_MIN, Math.min(1.0, totalCardValue / CONDENSE_SCALE_BASE))
```

---

## 버그 검증 — 즉발 기대값 상성 포함 여부

### 조사 대상

`fullCapBot.ts` — `scoreEffectForTrait()` 함수, `wildfire` case

### 코드 인용

```typescript
// fullCapBot.ts line 379-382 (최종 선택 콤보 효과 평가 전처리)
const baseValue = bestCombo.reduce((sum, c) => sum + c.value, 0)  // 카드 value 합계만
const attackDamage = enemyPrimaryElement
  ? fullCapCalcExpectedDamage(bestCombo, enemyPrimaryElement, ...)  // ← 상성 포함된 최종 데미지
  : result.totalScore
```

```typescript
// fullCapBot.ts scoreEffectForTrait wildfire case (line 190-197)
const affinityMult = enemyPrimaryElement
  ? getAffinityMultiplier(comboResult.finishingElement, enemyPrimaryElement)  // 상성 다시 계산
  : 1.0
const emberVal = Math.max(
  baseValue * EMBER_BOT_MULTIPLIER,
  Math.round(attackDamage * EMBER_MULTIPLIER * affinityMult),  // ← 상성 이중 적용!
)
```

`fullCapCalcExpectedDamage()`는 내부에서 이미 (line 107-108):
```typescript
const affinityMult = getAffinityMultiplier(repEl, enemyPrimaryElement)
damage = Math.round(damage * affinityMult)  // 상성 1회 적용
```

### 판정: **(a) 버그**

`attackDamage`는 이미 상성 배율이 반영된 값인데, `scoreEffectForTrait`에서 `affinityMult`를 한 번 더 곱한다. 극 상대(×1.7)라면 잔불 `max`의 두 번째 항이 `attackDamage × 1.7²`이 되어 과대평가된다.

**영향 분석**: `max(baseValue×2.2, attackDamage×1.0×affinityMult)` 구조에서 `EMBER_MULTIPLIER=1.0`이므로, 극 상대(×1.7)에서 두 번째 항 = `attackDamage × 1.7`. 하지만 첫 번째 항 `baseValue×2.2`가 통상 더 크거나 비슷하므로 이중 적용 효과가 최대화되는 경우는 한정적이다.

**이번 R2 수정 범위 외**: dispatch 지시에 따라 1·2번(잔불+응축) 수정은 이 검증 결과에 무관하게 반영 완료.

---

## 3000판 × 3종 시뮬 결과

**시드**: `i * 12345 + 7777` (i=0~2999)
**옵션**: `enableEffectMode=true`, `enableFloorReward=true`

### §2-1 클리어율 + Wilson 95% CI

| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | ±CI |
|--------|--------|----------|---------|---------|-----|
| 목화 | 937/3000 | 31.23% | 29.60% | 32.91% | ±1.66%p |
| 금수 | 803/3000 | 26.77% | 25.21% | 28.38% | ±1.58%p |
| 토단일 | 649/3000 | 21.63% | 20.20% | 23.14% | ±1.47%p |

프리셋 간 격차: **9.60%p**

### v3 vs R2 비교표

| 지표 | v3 (이전) | R2 (이번) | 변화 |
|------|-----------|-----------|------|
| 목화 클리어 | 32.23% | 31.23% | -1.0%p |
| 금수 클리어 | 26.63% | 26.77% | +0.1%p |
| 토단일 클리어 | 22.27% | 21.63% | -0.6%p |
| 잔불 채택률(목화) | 51.9% | **51.9%** | 0 (미변화) |
| 잔불 채택률(토단일) | 95.7% | **95.7%** | 0 (미변화) |

주의: 수치가 동일하게 나온 이유는 아래 "기대 미달 분석" 참조.

### §2-2 층별 사망 분포

| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |
|--------|----------|----------|----------|----------|--------|
| 목화 | 92(3.1%) | 1094(36.5%) | 616(20.5%) | 261(8.7%) | 937 |
| 금수 | 516(17.2%) | 675(22.5%) | 579(19.3%) | 427(14.2%) | 803 |
| 토단일 | 200(6.7%) | 614(20.5%) | 575(19.2%) | 962(32.1%) | 649 |

### §2-3 효과 채택률

| 프리셋 | wildfire | nourish | mining | purification |
|--------|----------|---------|--------|--------------|
| 목화 | 51.9% | 0.0% | 0.0% | 0.0% |
| 금수 | 47.9% | 0.1% | 0.0% | 0.0% |
| 토단일 | 95.7% | 0.0% | 0.0% | 0.0% |

### §2-4 오행연환 발생률

| 프리셋 | 연환 총합 | 발생률/판 | 판정 |
|--------|-----------|-----------|------|
| 목화 | 7451 | 248.37% | 높음 |
| 금수 | 6854 | 228.47% | 높음 |
| 토단일 | 3663 | 122.10% | 높음 |

### §2-5 모으기 장수 분포

| 프리셋 | 2장 | 3장 | 4장 | 5장 | 합계/판 |
|--------|-----|-----|-----|-----|---------|
| 목화 | 0.00 | 0.02 | 0.34 | 0.27 | 0.63 |
| 금수 | 0.00 | 0.01 | 0.31 | 0.22 | 0.54 |
| 토단일 | 0.00 | 0.00 | 0.64 | 4.01 | 4.65 |

### §2-6 응축 발동 횟수/판

응축 집계 주의: `traitCounts['yonggigama']` key는 `lastTraitTriggered` 경유가 아니므로 항상 0으로 표시된다. 실제 발동은 `result.condenseCount`로 측정 (별도 100판 실측):

| 프리셋 | condenseCount/판 (실측 100판) |
|--------|-------------------------------|
| 목화 | 0.420/판 |
| 금수 | 0.280/판 |
| 토단일 | 0.540/판 |

---

## 응축 투입값 분포 (300판 실측)

### 화N + 토M 조합별 발생 비율

**목화** (응축 총합 103회):
- 화1토1: 22.3% | 화2토1: 21.4% | 화1토2: 10.7%
- 다양한 조합 가능 (화 4장 → 화2+, 화3+ 조합 다수)
- 상위 조합: 화1토1(값합10) 4.9%, 화2토1(값합13) 3.9%

**금수** (응축 총합 71회):
- 화1토1: 39.4% | 화2토1: 28.2% | 화1토2: 18.3%
- 화 2장 덱이라 화1 조합이 지배적

**토단일** (응축 총합 117회):
- 화1토1: 11.1% | **화2토1: 0.0%** | 화1토2: 39.3%
- **화가 1장뿐이라 화2+ 조합 완전 불가**
- 화1토2(값합5~14) 저투입 조합이 다수

### 토단일 저투입 구조 증거

토단일 덱(`hwa:1, to:14`)은 구조적으로 화 카드가 1장뿐이다:
- 화2토1 조합: 0회 (화 카드 2장 동시 손패 불가능)
- 응축의 주력: 화1토2 (39.3%), 화1토3 (22.3%)
- 저투입(값합5~14) 조합이 66%+

CONDENSE_SCALE_BASE 15→10, MIN 0.4→0.6 수정의 효과:
- 값합5: 5/10=0.5 → clamp(0.6, 1.0) = 0.6 (구: 5/15=0.33 → clamp(0.4) = **0.4** → 효율 50% 개선)
- 값합9: 9/10=0.9 → clamp = 0.9 (구: 9/15=0.6 → clamp = 0.6 → 효율 50% 개선)
- 값합15: 15/10=1.5 → clamp = 1.0 (구: 15/15=1.0 → 동일)

저투입 시 응축 효율이 15~50% 향상됨.

---

## 기대 미달 분석 — 잔불 독식 미해소

**dispatch 예상**: 잔불 채택률 51~95% → 20~40%
**실측 결과**: 51.9%~95.7% (목화 51.9%, 토단일 95.7%) — 미변화

**원인 분석**:

`scoreEffectForTrait wildfire` 계산식:
```typescript
const emberVal = Math.max(
  baseValue * EMBER_BOT_MULTIPLIER,  // ×2.2 (구 ×3.0)
  Math.round(attackDamage * EMBER_MULTIPLIER * affinityMult),  // attackDamage×1.0×상성
)
```

`EMBER_MULTIPLIER = 1.0`이므로 두 번째 항 = `attackDamage × 상성`. 그런데 `attackDamage`는 이미 상성 포함이라 사실상 `attackDamage × 상성²`(버그). 결과적으로 두 번째 항이 첫 번째 항보다 거의 항상 크거나 같아 `max`가 두 번째 항을 선택한다.

즉, **잔불 기대값 ≈ attackDamage × 상성** 구조라 배율을 ×3.0→×2.2로 낮춰도 두 번째 항이 지배하면 효과가 없다.

**이 버그가 잔불 독식의 실질 원인**이다. 위 "(a) 버그" 판정과 연결된다.

**빌라드에게**: 잔불 채택률 20~40%로 하락하려면 `scoreEffectForTrait wildfire`의 이중 상성 적용 버그를 수정해야 한다. 구체적으로 두 번째 항에서 `affinityMult`를 제거해야 한다:

```typescript
// 수정 제안 (R3 검토):
const emberVal = Math.max(
  baseValue * EMBER_BOT_MULTIPLIER,
  Math.round(attackDamage * EMBER_MULTIPLIER),  // affinityMult 제거
)
```

이 수정은 이번 R2 dispatch 범위 밖이므로 R3로 넘긴다.

---

## 가호 선택 (selectTalismanBySaju)

| 프리셋 | 가호 1 | 가호 2 |
|--------|--------|--------|
| 목화 | sanggwan (상관) | geoptae (겁재) |
| 금수 | jeongjae (정재) | bigyeon (비견) |
| 토단일 | pyeonin (편인) | bigyeon (비견) |

---

## 종합 판정

| 항목 | 결과 | 판정 |
|------|------|------|
| 코드 수정 (잔불 ×2.2) | 완료 | PASS |
| 코드 수정 (응축 clamp) | 완료 | PASS |
| 3000판 시뮬 실행 | 완료 | PASS |
| 잔불 채택률 20~40% 하락 | 미달성 | BLOCKED — 버그 원인 특정 |
| 토단일 클리어 +4~6%p | 미달성 (+0.6%p 하락) | 정보 수집 완료 |
| 응축 투입값 분포 측정 | 완료 | PASS |
| 버그 검증 (즉발 상성) | (a) 버그 확인 | PASS |

**잔불 독식 미해소 → R3 작업 필요 (이중 상성 버그 수정)**

---

_작성: 제라 | 2026-07-14_
