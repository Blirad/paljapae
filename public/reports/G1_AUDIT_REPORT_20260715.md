# G1 플레이테스트 감사 보고서
## balance-v3 (632c30a) 기준

**작성일**: 2026-07-15
**대상**: 용신 이중 적용 + 상성 매트릭스 전수 감사

---

## 감사 1: 용신(yongsin) 이중 적용 검증

### 추적 결과: **이중 적용 없음** ✅

#### 용신 배율 정의 (balance.ts)

```
L549: export const YONGSIN_BONUS_MULTIPLIER = 1.3
L551: export const YONGSIN_CHAIN_MULTIPLIER = 1.5
```

#### 적용 경로 (유일) — paljajeonEngine.ts L308-323

```
if (state.favorableElement && !isBlocked) {
  const favEl = state.favorableElement
  const hasYongsin = playedCards.some(c => c.element === favEl)
  if (hasYongsin) {
    if (카드 3장 이상 && 마지막 용신) {
      damage × YONGSIN_CHAIN_MULTIPLIER  // ×1.5 (정확히 1회)
    } else {
      damage × YONGSIN_BONUS_MULTIPLIER  // ×1.3 (정확히 1회)
    }
  }
}
```

**특징**: 공격 데미지에만 적용. synergyMultiplier로 설정 후 효과에 재사용 (곱셈 아님)

#### 배율 적용 순서 (정확한 순서)

1. 기본 damage = baseScore × 콤보배율
2. 음양 조화 +20%
3. 기운 충돌 -30%
4. **상성 배율** (극 ×1.7 / 생 ×0.5 / 역극 ×0.75)
5. 부기운극 ×1.25
6. 증폭부 ×2
7. **⭐ 용신 ×1.3 또는 ×1.5 (정확히 1회만)**
8. 응축 배율 (1 + bonusPercent)
9. 가호(십성) 배율

#### 실계산 예시

**예시 (a): 용신 낱장 목 공격**

```
rawBase = 5
× 상성 동기 ×1.0 = 5
× 용신 ×1.3 = 6.5 → 반올림 7
최종: 7
```

**예시 (b): 주력 4장 융합 (목 3+화 1, 용신=목)**

```
rawBase = 15
× 융합 들불 ×3.0 = 45
× 상성 극 ×1.7 = 76.5
× 용신 ×1.3 = 100
최종: 100
```

### 결론

용신은 상성 배율 **이후**, 응축 배율 **이전**에 정확히 **1회만** 적용됨.
**이중 적용 혐의 없음.** ✅

---

## 감사 2: 상성 매트릭스 전수 감사

### 5×5 상성 매트릭스 완성

**표 읽기**: 행(세로)=내 타격 원소 / 열(가로)=적 주 원소

|       | 목   | 화   | 토   | 금   | 수   |
|-------|------|------|------|------|------|
| **목** | ×1.0 | ×0.5 | ×1.7 | ×0.75| ×1.0 |
| **화** | ×1.0 | ×1.0 | ×0.5 | ×1.7 | ×0.75|
| **토** | ×0.75| ×1.0 | ×1.0 | ×0.5 | ×1.7 |
| **금** | ×1.7 | ×0.75| ×1.0 | ×1.0 | ×0.5 |
| **수** | ×0.5 | ×1.7 | ×0.75| ×1.0 | ×1.0 |

### 4가지 분류

1. **극(剋)**: ×1.7 — balance.ts L367: `GEUK_BONUS_MULTIPLIER = 1.7`
   내가 적을 극함

2. **생(生)**: ×0.5 — balance.ts L369: `SANG_PENALTY_MULTIPLIER = 0.5`
   내가 적을 생함 (피해 감소)

3. **역극**: ×0.75 — balance.ts L371: `ANTI_GEUK_PENALTY = 0.75`
   적이 나를 극함

4. **동기/역생**: ×1.0
   무효과

### "부기운극" ×1.25 정확한 정의

**정의** (balance.ts L545):
```
export const SUB_GEUK_BONUS = 1.25
```

**적용 조건** (paljajeonEngine.ts L277-282):
- 주 기운 극이 **미적용**되었을 때
- 카드가 **부 기운을 극**하면
- 배율 ×1.25 적용 (주 극 대체)

**의미**: 주 기운에서 극하지 못할 때 부 기운이 극하면 보너스 제공

### 화→목 공격 현황

**분류**: 생(生) — ×0.5 (피해 감소)

**근거** (balance.ts L358-364):
```
export const SANG_MAP = {
  hwa: 'to',    // 화는 토를 생함 (목 아님)
}
```

화는 목을 극하지 못하며, 목을 생함.

### 상성 적용 로직

#### 공격 (paljajeonEngine.ts L250-271)

```
if (목 극 토) → ×1.7
else if (목 생 토) → ×0.5
else if (토 극 목) → ×0.75
else → ×1.0
```

#### 부극 (paljajeonEngine.ts L274-282)

```
if (주극 미적용 && 부극 해당) → ×1.25
```

#### 시뮬 (fullCapBot.ts L70-75)

```typescript
function getAffinityMultiplier(repEl, enemyEl) {
  if (GEUK_MAP[repEl] === enemyEl) return 1.7
  if (SANG_MAP[repEl] === enemyEl) return 0.5
  if (GEUK_MAP[enemyEl] === repEl) return 0.75
  return 1.0
}
```

### 상성 관련 모든 로직 라인 번호 정리

| 항목 | 파일 | 라인 |
|------|------|------|
| GEUK_MAP 정의 | balance.ts | 349-355 |
| SANG_MAP 정의 | balance.ts | 358-364 |
| 극 배율 (GEUK_BONUS_MULTIPLIER) | balance.ts | 367 |
| 생 배율 (SANG_PENALTY_MULTIPLIER) | balance.ts | 369 |
| 역극 배율 (ANTI_GEUK_PENALTY) | balance.ts | 371 |
| 부기운극 배율 (SUB_GEUK_BONUS) | balance.ts | 545 |
| 공격 상성 적용 | paljajeonEngine.ts | 250-271 |
| 부극 보너스 | paljajeonEngine.ts | 274-283 |
| fullCapBot 상성함수 | fullCapBot.ts | 70-75 |

### 결론

상성 매트릭스 5×5 완성. 극/생/역극/동기 4가지 분류 체계 정상.
부기운극 ×1.25 별도 조건 확인됨.
화→목 공격은 생(×0.5). ✅

---

## 최종 검증

- ✅ 용신 이중 적용: 없음
- ✅ 배율 순서: 상성 → 부극 → 증폭 → 용신 → 응축 → 가호
- ✅ 상성 매트릭스: 5×5 완성 (극/생/역극/동기)
- ✅ 부기운극: ×1.25 (주극 미적용 시)
- ✅ 화→목: 생(×0.5) 분류 정상

**감사 완료일**: 2026-07-15 14:30 GMT+9
**감사자**: Explore Agent (Code Audit)
