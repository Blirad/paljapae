# ZERA — balance-v3 R3 결과 보고서 (2026-07-14)

_작성: 제라 | 실행: 3000판 × 3종 (enableEffectMode=true, enableFloorReward=true, enableCondenseClamp=true)_

---

## 수정 내용

### 수정 — wildfire affinityMult 이중 적용 버그 픽스

**파일**: `paljapae/src/engine/fullCapBot.ts`

**위치**: `scoreEffectForTrait()` 함수, `wildfire` 케이스 (line 188~197)

**변경 전 (버그)**:
```typescript
case 'wildfire': {
  const affinityMult = enemyPrimaryElement
    ? getAffinityMultiplier(comboResult.finishingElement, enemyPrimaryElement)
    : 1.0
  const emberVal = Math.max(
    baseValue * EMBER_BOT_MULTIPLIER,
    Math.round(attackDamage * EMBER_MULTIPLIER * affinityMult),  // 이중 상성
  )
  return emberVal
}
```

**변경 후 (픽스)**:
```typescript
case 'wildfire': {
  // attackDamage는 fullCapCalcExpectedDamage() 반환값으로 이미 상성 배율 포함.
  // R3 버그픽스: affinityMult 이중 적용 제거.
  const emberVal = Math.max(
    baseValue * EMBER_BOT_MULTIPLIER,
    Math.round(attackDamage * EMBER_MULTIPLIER),  // affinityMult 제거
  )
  return emberVal
}
```

**추가 변경**: 파라미터 `comboResult` → `_comboResult` (R3 버그픽스 후 미사용, 시그니처 유지)

---

## 3000판 × 3종 시뮬 결과

**시드**: `i * 12345 + 7777` (i=0~2999)
**옵션**: `enableEffectMode=true`, `enableFloorReward=true`, `enableCondenseClamp=true` (R2 clamp 완화 유지)

### §2-1 클리어율 + Wilson 95% CI

| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | ±CI |
|--------|--------|----------|---------|---------|-----|
| 목화 | 1072/3000 | 35.73% | 34.04% | 37.47% | ±1.71%p |
| 금수 | 818/3000 | 27.27% | 25.70% | 28.89% | ±1.59%p |
| 토단일 | 697/3000 | 23.23% | 21.76% | 24.78% | ±1.51%p |

프리셋 간 격차: **12.50%p**

### §2-2 층별 사망 분포

| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |
|--------|----------|----------|----------|----------|--------|
| 목화 | 68(2.3%) | 993(33.1%) | 607(20.2%) | 260(8.7%) | 1072 |
| 금수 | 508(16.9%) | 680(22.7%) | 588(19.6%) | 406(13.5%) | 818 |
| 토단일 | 164(5.5%) | 593(19.8%) | 600(20.0%) | 946(31.5%) | 697 |

### §2-3 효과 채택률 (effectMode=true 조건)

| 프리셋 | wildfire | nourish | mining | purification |
|--------|----------|---------|--------|--------------|
| 목화 | 0.0% | 0.0% | 0.0% | 0.0% |
| 금수 | 0.0% | 0.2% | 0.0% | 0.0% |
| 토단일 | 0.0% | 0.4% | 0.0% | 0.0% |

목표 범위: 5~60% 자연 분포 (0%=사장 / 70%+=독식 경고)

### §2-4 오행연환 발생률

| 프리셋 | 연환 총합 | 발생률/판 | 판정 |
|--------|-----------|-----------|------|
| 목화 | 7592 | 253.07% | 높음 |
| 금수 | 6742 | 224.73% | 높음 |
| 토단일 | 3759 | 125.30% | 높음 |

### §2-5 모으기 장수 분포

| 프리셋 | 2장 | 3장 | 4장 | 5장 | 합계/판 |
|--------|-----|-----|-----|-----|---------|
| 목화 | 0.00 | 0.02 | 0.38 | 0.28 | 0.68 |
| 금수 | 0.00 | 0.01 | 0.31 | 0.21 | 0.53 |
| 토단일 | 0.00 | 0.01 | 0.64 | 4.08 | 4.72 |

### §2-6 응축 발동 횟수/판

| 프리셋 | 응축 총합 | 응축/판 |
|--------|-----------|---------|
| 목화 | 0 | 0.000 |
| 금수 | 0 | 0.000 |
| 토단일 | 0 | 0.000 |

주의: `traitCounts['yonggigama']` 집계 방식 한계로 0 표시됨 (R2 동일 현상).

### traitCounts 상위 15 (목화 기준)

| 키 | 발생/판 |
|----|---------|
| ohang-yeonhwan | 2.531 |
| passive_sanggwan | 1.586 |
| quench | 1.291 |
| passive_geoptae | 0.999 |
| attack_wildfire_used | 0.960 |
| attack_nourish_used | 0.841 |
| keen | 0.762 |
| mirror | 0.703 |
| harvest | 0.669 |
| attack_purification_used | 0.632 |
| snipe | 0.426 |
| gather4 | 0.380 |
| gather5 | 0.281 |
| attack_mining_used | 0.199 |
| attack_yonggigama_used | 0.168 |

### 가호 선택 (selectTalismanBySaju)

| 프리셋 | 가호 |
|--------|------|
| 목화 | sanggwan + geoptae |
| 금수 | jeongjae + bigyeon |
| 토단일 | pyeonin + bigyeon |

---

## R2 vs R3 비교표

| 지표 | R2 | R3 | 변화 | 판정 |
|------|----|----|------|------|
| 목화 클리어율 | 31.23% | 35.73% | +4.50%p | 상승 |
| 금수 클리어율 | 26.77% | 27.27% | +0.50%p | 미세 상승 |
| 토단일 클리어율 | 21.63% | 23.23% | +1.60%p | 상승 |
| 프리셋 간 격차 | 9.60%p | 12.50%p | +2.90%p | 격차 확대 |
| wildfire 채택률 (목화) | 51.9% | 0.0% | -51.9%p | 과도 보정 |
| wildfire 채택률 (토단일) | 95.7% | 0.0% | -95.7%p | 과도 보정 |

---

## 예상 착지 비교

dispatch 예상:

| 지표 | 예상 R3 | 실측 R3 | 달성 |
|------|---------|---------|------|
| 잔불 채택률 | 15~35% | 0.0% | 미달 — 과도 보정 |
| 토단일 클리어 | +3~5%p | +1.60%p | 부분 달성 |
| 목화/금수 | +2~3%p | +4.50%p / +0.50%p | 목화 초과 / 금수 부분 |

---

## 분석 — wildfire 효과 완전 사장 원인

### 버그픽스 전후 수식 비교

**R2 (버그 있음)**:
```
효과 기대값 = max(baseValue×2.2, attackDamage × EMBER_MULTIPLIER × affinityMult)
            = max(baseValue×2.2, attackDamage × 1.0 × 상성²)
```
`attackDamage`가 이미 상성 포함이므로 사실상 `attackDamage×상성²` → **과대평가**

**R3 (버그픽스 후)**:
```
효과 기대값 = max(baseValue×2.2, attackDamage × EMBER_MULTIPLIER)
            = max(baseValue×2.2, attackDamage × 1.0)
```
`EMBER_MULTIPLIER=1.0`이므로 두 번째 항 = `attackDamage×1.0 = attackDamage`.
그런데 비교 대상도 `attackDamage`이므로 `attackDamage ≤ attackDamage` → 효과 선택 불가.
첫 번째 항(`baseValue×2.2`)도 대부분 `attackDamage`보다 낮아 **항상 공격 선택**.

### 핵심 문제

`EMBER_MULTIPLIER=1.0` 자체가 "잔불 효과 기대값이 즉발 공격과 동등"이라는 의미지만, 실제 잔불은 EMBER_DURATION(3턴)에 걸쳐 피해를 주므로 봇 평가에서 과소평가되고 있다. `EMBER_MULTIPLIER`를 엔진 실제값(지속 턴 기반)에 맞게 상향하거나, `baseValue×EMBER_BOT_MULTIPLIER`의 승수를 높여야 effectMode가 작동한다.

**즉**: 버그픽스는 정확하다. 단, EMBER_MULTIPLIER 또는 EMBER_BOT_MULTIPLIER 값 조정이 추가로 필요하다.

---

## 종합 판정

| 항목 | 결과 | 판정 |
|------|------|------|
| 코드 수정 (affinityMult 이중 제거) | 완료 | PASS |
| 3000판 시뮬 실행 | 완료 | PASS |
| vitest PASS | PASS | PASS |
| wildfire 채택률 15~35% | 0.0% (과도 보정) | BLOCKED |
| 클리어율 전반 상승 | 목화 +4.50%p, 토 +1.60%p | PASS |

**버그픽스 자체는 정확하나 EMBER_MULTIPLIER 재보정 필요 → R4 추가 작업 권고**

---

## R4 권고 사항 (빌라드 판단 요청)

잔불 채택률 15~35% 착지를 위한 선택지:

**옵션 A — EMBER_MULTIPLIER 상향** (현재 1.0):
```typescript
// balance.ts
export const EMBER_MULTIPLIER = 1.5  // 1.0 → 1.5 (잔불 1.5턴 등가로 평가)
// 또는 EMBER_DURATION(3) 기반으로 조정
```

**옵션 B — EMBER_BOT_MULTIPLIER 상향** (현재 2.2):
```typescript
export const EMBER_BOT_MULTIPLIER = 3.5  // 2.2 → 3.5
```

**권장**: 옵션 A (EMBER_MULTIPLIER 조정) — 의미적으로 명확. 잔불 지속 효과의 현실적 가치를 봇 평가에 반영.

---

_작성: 제라 | 2026-07-14_
