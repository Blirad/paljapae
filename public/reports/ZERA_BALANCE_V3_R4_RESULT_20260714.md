# ZERA — balance-v3 R4 결과 보고서 (2026-07-14)

_작성: 제라 | 실행: 3000판 × 3종 (enableEffectMode=true, enableFloorReward=true)_

---

## 즉답 ① — 게임 엔진 잔불 실효 배율 감사

**파일**: `paljapae/src/engine/paljajeonEngine.ts`

**wildfire 처리 코드** (line 569~575):
```typescript
case 'wildfire': {
  // B1-1: 들불 재정의 → 잔불 (3턴 × 투입값 × 1.0 고정 피해, 상성 무시)
  const baseValue = playedCards.reduce((sum, c) => sum + c.value, 0)
  newEmberDamagePerTurn = Math.round(baseValue * EMBER_MULTIPLIER)
  newEmberTurnsLeft = EMBER_DURATION
  break
}
```

**잔불 적용 루프** (line 211~220):
```typescript
let emberEnemyDamage = 0
let newEmberTurnsLeft = state.emberTurnsLeft ?? 0
let newEmberDamagePerTurn = state.emberDamagePerTurn ?? 0
if (newEmberTurnsLeft > 0 && newEmberDamagePerTurn > 0) {
  emberEnemyDamage = newEmberDamagePerTurn
  newEmberTurnsLeft -= 1
  if (newEmberTurnsLeft <= 0) {
    newEmberDamagePerTurn = 0
  }
}
```

**상수값** (`balance.ts` line 529~530):
```typescript
export const EMBER_DURATION = 3     // 잔불 지속 턴 수
export const EMBER_MULTIPLIER = 1.0 // 턴당 피해 = 투입값 × 1.0
```

**실효 배율 계산**:
- 턴당 피해 = `baseValue × EMBER_MULTIPLIER = baseValue × 1.0 = baseValue`
- 총 피해 = `baseValue × 3` (EMBER_DURATION=3)
- 단, 상성 무시(잔불은 고정 피해) + 잔불 중 피격 시 덮어쓰기 가능

**결론**: 게임 엔진 잔불 총배율 = **×3.0** (상성 무시). R2/R3의 EMBER_BOT_MULTIPLIER=2.2는 실제 엔진값 ×3.0보다 낮았다.

---

## 즉답 ② — 자양/채굴/정화/응축 평가식 감사

**파일**: `paljapae/src/engine/fullCapBot.ts` — `scoreEffectForTrait()` 함수 (line 161~221)

### 자양(nourish) — line 176~186

```typescript
case 'nourish': {
  // 자양: min(기본치×2.5, maxHP - HP) × HP위험 가중치
  // HP위험 가중치: HP≤30% → ×2.0, HP≤50% → ×1.5, else → ×1.0
  const rawHeal = Math.min(
    Math.round(baseValue * NOURISH_EFFECT_COEFF),  // NOURISH_EFFECT_COEFF=2.5
    Math.max(0, maxHp - curHp),
  )
  const hpRatio = curHp / maxHp
  const hpWeight = hpRatio <= 0.3 ? 2.0 : hpRatio <= 0.5 ? 1.5 : 1.0
  return Math.round(rawHeal * hpWeight)
}
```

**평가**: 수식 자체는 논리적이나, HP 풀 상태(hpRatio > 0.5)에서 `maxHP - HP = 0`이면 rawHeal=0 → effectValue=0 → 항상 공격 선택. 회복 필요성이 없을 때는 당연히 공격 우위. 수식 이상 없음.

**괴리**: 게임 엔진은 HP 회복을 실제로 처리하나, 봇 평가식에서 "회복량의 전투 가치"를 데미지로 환산하는 방식 자체가 저평가 가능성 있음. HP 전체가 공격력으로 치환되지 않으므로.

### 채굴(mining) — line 196~208

```typescript
case 'mining': {
  // 드로우장수 = min(MINING_MAX_DRAW, floor(투입값/MINING_DRAW_DIVISOR))
  // 핸드평균값 = sum(card.value) / hand.length
  const drawCount = Math.min(
    MINING_MAX_DRAW,                              // MINING_MAX_DRAW=3
    Math.floor(baseValue / MINING_DRAW_DIVISOR),  // MINING_DRAW_DIVISOR=5
  )
  const handAvg = hand.length > 0
    ? hand.reduce((s, c) => s + c.value, 0) / hand.length
    : 0
  return Math.round(drawCount * handAvg)
}
```

**상수**: `MINING_DRAW_DIVISOR=5`, `MINING_MAX_DRAW=3`

**괴리**: 채굴 효과 가치 = "드로우한 카드의 기대 데미지"인데, 봇이 핸드평균값을 사용하는 것은 그 카드를 즉시 플레이한다고 가정. 실제로는 남은 플레이 횟수와 덱 구성에 따라 가치가 달라짐. 저투입 조합(baseValue<15)은 drawCount=2 이하로 효과 기대값이 낮아 공격 우위.

### 정화(purification) — line 218~220

```typescript
default:
  return 0  // 미정의 특성 → 0 (효과 미채택)
```

**정화 케이스 자체가 scoreEffectForTrait에 없다.** `traitId === 'purification'`에 해당하는 case가 없으므로 항상 `default: return 0`으로 처리. effectValue=0이므로 attackDamage>0이면 항상 공격 선택.

**괴리**: 정화 효과는 게임 엔진에서 `PURIFICATION_THRESHOLD=10` 조건(투입값≥10)으로 적 전해제 + 면역 부여인데, 봇 평가식에 정화 케이스 자체가 미정의. 이것이 정화 채택률 0%의 직접 원인.

### 응축(condense/yonggigama) — line 211~216

```typescript
case 'yonggigama': {
  // effectMode 경로가 아닌 별도 applyCondense 경로로 처리됨
  // 봇 루프에서 getCondenseAvailability → applyCondense 직접 호출하므로
  // effectMode 경로에서는 0 반환 (이중 처리 방지)
  return 0
}
```

**평가**: 응축은 effectMode 경로가 아닌 별도 루프(line 867~900)에서 처리. 이는 의도된 설계. clamp 파라미터는 `CONDENSE_SCALE_BASE=10`, `CONDENSE_SCALE_MIN=0.6` (R2에서 이미 완화됨).

**괴리**: 없음 — 의도된 분리 처리.

---

## R4 수식 반영 현황

dispatch 지시의 잔불 평가 수식 재설계는 **이미 코드에 반영 완료** 상태였다.

**현재 코드** (`fullCapBot.ts` line 188~194):
```typescript
case 'wildfire': {
  // R4 이든 지시: rawBase × 게임_잔불_총배율 × min(3, 남은공격)/3
  // 게임_잔불_총배율 = EMBER_MULTIPLIER × EMBER_DURATION (= 1.0 × 3 = 3.0)
  const gameTotalMult = EMBER_MULTIPLIER * EMBER_DURATION
  const attackDecay = Math.min(3, playsLeft) / 3
  return Math.round(baseValue * gameTotalMult * attackDecay)
}
```

EMBER_BOT_MULTIPLIER 상수 제거 완료. 게임 엔진 상수(EMBER_MULTIPLIER × EMBER_DURATION) 직접 참조.

---

## 3000판 × 3종 시뮬 결과 (R4)

**시드**: `i * 12345 + 7777` (i=0~2999)
**옵션**: `enableEffectMode=true`, `enableFloorReward=true`

### §2-1 클리어율 + Wilson 95% CI

| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | ±CI |
|--------|--------|----------|---------|---------|-----|
| 목화 | 1093/3000 | 36.43% | 34.73% | 38.17% | ±1.72%p |
| 금수 | 785/3000 | 26.17% | 24.62% | 27.77% | ±1.57%p |
| 토단일 | 661/3000 | 22.03% | 20.59% | 23.55% | ±1.48%p |

프리셋 간 격차: **14.40%p**

R10 기준선(enableEffectMode=false): 목화 37.53% / 금수 32.73% / 토단일 31.23%

### §2-2 층별 사망 분포

| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |
|--------|----------|----------|----------|----------|--------|
| 목화 | 60(2.0%) | 994(33.1%) | 599(20.0%) | 254(8.5%) | 1093 |
| 금수 | 506(16.9%) | 673(22.4%) | 587(19.6%) | 449(15.0%) | 785 |
| 토단일 | 171(5.7%) | 600(20.0%) | 593(19.8%) | 975(32.5%) | 661 |

### §2-3 효과 채택률 (effectMode=true 조건)

| 프리셋 | wildfire | nourish | mining | purification |
|--------|----------|---------|--------|--------------|
| 목화 | 0.3% | 0.0% | 0.0% | 0.0% |
| 금수 | 0.2% | 0.2% | 0.0% | 0.0% |
| 토단일 | 0.0% | 0.0% | 0.0% | 0.0% |

목표 범위: 5~60% 자연 분포 (0%=사장 / 70%+=독식 경고)

### §2-4 오행연환 발생률

| 프리셋 | 연환 총합 | 발생률/판 | 판정 |
|--------|-----------|-----------|------|
| 목화 | 7693 | 256.43% | 높음 |
| 금수 | 6797 | 226.57% | 높음 |
| 토단일 | 3681 | 122.70% | 높음 |

### §2-5 모으기 장수 분포

| 프리셋 | 2장 | 3장 | 4장 | 5장 | 합계/판 |
|--------|-----|-----|-----|-----|---------|
| 목화 | 0.00 | 0.01 | 0.35 | 0.28 | 0.64 |
| 금수 | 0.00 | 0.01 | 0.30 | 0.22 | 0.53 |
| 토단일 | 0.00 | 0.00 | 0.64 | 4.08 | 4.73 |

### §2-6 응축 발동 횟수/판

| 프리셋 | 응축 총합 | 응축/판 |
|--------|-----------|---------|
| 목화 | 0 | 0.000 |
| 금수 | 0 | 0.000 |
| 토단일 | 0 | 0.000 |

주의: `traitCounts['yonggigama']` 집계 방식 한계로 0 표시됨 (R2/R3 동일 현상).

### traitCounts 상위 15 (목화 기준)

| 키 | 발생/판 |
|----|---------|
| ohang-yeonhwan | 2.564 |
| passive_sanggwan | 1.593 |
| quench | 1.310 |
| passive_geoptae | 0.997 |
| attack_wildfire_used | 0.971 |
| attack_nourish_used | 0.843 |
| keen | 0.778 |
| mirror | 0.727 |
| harvest | 0.665 |
| attack_purification_used | 0.617 |
| snipe | 0.436 |
| gather4 | 0.352 |
| gather5 | 0.275 |
| attack_mining_used | 0.200 |
| attack_yonggigama_used | 0.169 |

### 가호 선택

| 프리셋 | 가호 |
|--------|------|
| 목화 | sanggwan + geoptae |
| 금수 | jeongjae + bigyeon |
| 토단일 | pyeonin + bigyeon |

---

## R3 vs R4 비교

| 지표 | R3 | R4 | 변화 | 판정 |
|------|----|----|------|------|
| 목화 클리어율 | 35.73% | 36.43% | +0.70%p | 미세 상승 |
| 금수 클리어율 | 27.27% | 26.17% | -1.10%p | 미세 하락 |
| 토단일 클리어율 | 23.23% | 22.03% | -1.20%p | 미세 하락 |
| 프리셋 간 격차 | 12.50%p | 14.40%p | +1.90%p | 격차 확대 |
| wildfire 채택률 (목화) | 0.0% | 0.3% | +0.3%p | 거의 무변화 |
| wildfire 채택률 (금수) | 0.2% | 0.2% | 0%p | 변화 없음 |

---

## 분석 — wildfire 효과 지속 사장 원인

### R4 수식 분석

```
effectValue = baseValue × (EMBER_MULTIPLIER × EMBER_DURATION) × min(3, playsLeft)/3
            = baseValue × 3.0 × attackDecay
```

비교 대상:
```
attackDamage = baseValue × affinityMult × (yongsinBonus 등)
```

상성 유리(affinityMult=1.5) + 용신 보너스(×1.2) 조합 시:
```
attackDamage ≈ baseValue × 1.5 × 1.2 = baseValue × 1.8
```

이 경우 `effectValue(baseValue×3.0) > attackDamage(baseValue×1.8)` — 효과 선택 가능.

### 왜 여전히 0%에 가까운가

1. **공격 데미지에 콤보 배율 포함**: `judgeCombo()`가 이미 콤보 시너지 배율을 totalScore에 반영. `baseValue`가 실제 `attackDamage`보다 항상 낮음.

2. **공격=핸드 내 최선 콤보**: `fullCapSelectCards()`는 핸드 내 모든 조합을 평가해 최고 데미지 콤보를 선택. wildfire 조합이 최선 콤보로 선택됐을 때만 effectMode 비교가 일어남. 이 시점에서 attackDamage는 이미 최고값.

3. **playsLeft 전달 문제 의심**: `fullCapSelectCards` 호출 시 `playsLeft ?? 1`으로 전달되는데, 첫 출수(playsLeft=4)와 마지막(playsLeft=1) 차이가 있다. playsLeft=1이면 `attackDecay=min(3,1)/3=0.33` → `effectValue=baseValue×1.0`. 이는 공격 대비 항상 불리.

4. **근본 문제**: `baseValue`(투입 카드 raw합)를 `attackDamage`(콤보+상성+용신 처리된 최적화 데미지)와 비교하는 구조적 비대칭. 잔불 effectValue에도 상성 등을 적용해야 공정 비교 가능하나, 잔불은 상성 무시 고정 피해이므로 의도적으로 낮게 평가된다.

### 핵심 진단

`attack_wildfire_used: 0.971/판` — 잔불 콤보가 판당 거의 1회 발생하는데도 효과 채택이 0%인 이유:

**judgeCombo totalScore > baseValue (raw합)** 이 항상 성립하기 때문.

예: 5장 콤보, 각 value=3 → baseValue=15, judgeCombo totalScore=40~80 (조합에 따라)
- effectValue = 15 × 3 × attackDecay = 45 × 0.33~1.0 = 15~45
- attackDamage = 40~80 (상성 적용 전 totalScore만으로 이미 baseValue보다 큼)

---

## 종합 판정

| 항목 | 결과 | 판정 |
|------|------|------|
| 게임 엔진 잔불 배율 감사 | ×3.0 (EMBER_MULTIPLIER×EMBER_DURATION) 확인 | PASS |
| 자양/채굴 평가식 감사 | 수식 정상, 평가 구조적 한계 특정 | PASS |
| 정화 평가식 감사 | case 미정의 — 항상 0 반환 | 발견 |
| 응축 평가식 감사 | 별도 루프 처리로 의도적 0 반환 | PASS |
| R4 수식 반영 (EMBER_BOT_MULTIPLIER 제거) | 이미 적용 완료 상태 | PASS |
| 3000판 시뮬 실행 | 완료 | PASS |
| vitest PASS | PASS | PASS |
| wildfire 채택률 10~25% | 0.0~0.3% (목표 미달) | BLOCKED |
| 클리어율 R10 기준선 대비 | 목화 -1.10%p, 금수 -6.56%p, 토 -9.20%p | 하락 |

---

## R5 권고 사항 (빌라드 판단 요청)

### 진단 요약

- R4 수식 변경(EMBER_BOT_MULTIPLIER 제거 + 게임값 참조)은 적용됐으나 효과 없음.
- 근본 원인: `judgeCombo totalScore (콤보 시너지 포함)` vs `baseValue × 3 (raw합만)`의 구조적 비대칭.
- 잔불이 콤보 점수를 대체할 수 없는 이상, effectValue가 attackDamage를 넘기 어렵다.

### 선택지

**옵션 A — effectValue 계산 기준 변경**:
```typescript
// baseValue 대신 attackDamage × EMBER_DURATION 사용
// 잔불 총피해 = 이번 공격과 동등한 피해를 EMBER_DURATION턴 축적
const effectValue = Math.round(attackDamage * EMBER_DURATION * attackDecay)
```
예상: wildfire 채택률 급등 가능성. attackDamage×3이면 항상 effectMode 선택 → 독식 경고.
따라서 계수 조정 필요: `attackDamage × EMBER_DURATION × 0.4` 정도.

**옵션 B — 정화(purification) case 추가**:
```typescript
case 'purification': {
  if (baseValue >= PURIFICATION_THRESHOLD) {
    // 정화 효과 발동 조건 충족 시 일정 데미지 환산값 반환
    return Math.round(attackDamage * 0.3)  // 공격의 30% 가치
  }
  return 0
}
```

**옵션 C — effectValue threshold 완화**:
현재 `effectValue > attackDamage`에서 `effectValue > attackDamage * 0.6`으로 완화.
잔불이 공격의 60% 이상 가치면 효과 선택 허용.

**권장**: 옵션 C (threshold 완화) — 수식 로직은 유지하면서 채택 기준만 낮춤. 가장 안전한 조정.

---

_작성: 제라 | 2026-07-14_
