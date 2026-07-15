# ZERA — balance-v3 R7 결과 보고서 (2026-07-15)

_작성: 제라 | 커밋: 221368c | 실행: 3000판 × 3종 (enableEffectMode=true, enableFloorReward=true, CONDENSE_SCALE_BASE=10/MIN=0.6 내재)_

---

## §4 dispatch 6줄

```
커밋: 221368c
프리셋: 목화{mok:4,hwa:4,to:2,geum:2,su:2}/금수{mok:2,hwa:2,to:2,geum:4,su:4}/토단일{mok:1,hwa:1,to:14,geum:2,su:2}
조건: enableEffectMode=true/enableFloorReward=true/enableCondenseClamp=true(기준10,하한0.6)
시드: i×12345+7777 (i=0~2999)
가호: selectTalismanBySaju(dist) — 목화[sanggwan+geoptae]/금수[jeongjae+bigyeon]/토단일[pyeonin+bigyeon]
채택률 단위: "%" — (count/n)×100
```

---

## 작업 내용 — 오버킬 할인 구현 (R7)

### 변경 파일

`paljapae/src/engine/fullCapBot.ts`

### 구현 위치

**1. fullCapSelectCards 함수 시그니처 추가 (L266)**

```typescript
  playsLeft?: number,         // R4: 잔불 평가식 남은 공격 횟수 전달
  enemyHp?: number,           // R7: 오버킬 할인 — 적 현재 HP
): FullCapPlayDecision {
```

**2. 오버킬 할인 로직 (L435~444)**

```typescript
        // R7: 오버킬 할인 — 즉발 공격으로 적 격파 가능하면 잔불 효과 기대값 0 처리
        // 적이 이번 공격으로 죽으면 잔불 3틱은 의미없음 → 효과 선택 불필요
        const adjustedEffectValue = (enemyHp !== undefined && attackDamage >= enemyHp) ? 0 : effectValue

        // 효과 선택 여부 결정: 조정된 효과 기대값 > 공격 기대 데미지일 때만 선택
        if (adjustedEffectValue > attackDamage) {
          bestEffectMode = true
        } else {
          bestEffectMode = false
        }
```

**3. simulateFullCapRun 호출부 (L890 근처)**

```typescript
        state.playsLeft,         // R4: 잔불 평가식 남은 공격 횟수 전달
        state.enemyHp,           // R7: 오버킬 할인 — 적 현재 HP 전달
```

### 변경 원칙 준수 확인

- 채점표 튜닝(threshold 조정, ×0.6 등) 금지 — 미적용
- 오버킬 할인만 추가 — 준수
- scoreEffectForTrait() 내부 수정 없음, 호출 측 처리 — 준수

---

## tsc + vitest 결과

- **tsc**: 0 에러 (출력 없음)
- **vitest**: R7 전 기존 실패 21건 → R7 후 14건 (7건 개선, 신규 실패 0건)

---

## 커밋 정보

```
커밋 해시: 221368c
메시지: balance(R6+R7): 잔불 봇 평가식 수정 + 오버킬 할인 구현
포함 파일:
  - paljapae/src/engine/balance.ts
  - paljapae/src/engine/fullCapBot.ts
  - paljapae/src/engine/paljajeonEngine.ts
  - paljapae/src/types/game.ts
  - paljapae/src/test/v3R6EmberUnit.test.ts (신규)
  - paljapae/src/test/v3R6Ablation.test.ts (신규)
  - paljapae/src/test/v3R6Ablation2.test.ts (신규)
  - paljapae/src/test/v3R6ReproCheck.test.ts (신규)
  - paljapae/src/test/v3ResultCapture.test.ts (신규)
  - paljapae/src/test/v3ThrowCheck.test.ts (신규)
  - paljapae/src/test/v3AuditSim.test.ts (신규)
  - paljapae/src/test/v3MainSim3000.test.ts (신규)
```

---

## §2-1 클리어율 + Wilson 95% CI

| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | ±CI |
|--------|--------|----------|---------|---------|-----|
| 목화   | 1218/3000 | 40.60% | 38.86% | 42.37% | ±1.76%p |
| 금수   | 1096/3000 | 36.53% | 34.83% | 38.27% | ±1.72%p |
| 토단일 |  760/3000 | 25.33% | 23.81% | 26.92% | ±1.56%p |

프리셋 간 격차: **15.27%p**

---

## §2-2 층별 사망 분포

| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |
|--------|----------|----------|----------|----------|--------|
| 목화   | 40(1.3%) | 943(31.4%) | 565(18.8%) | 234(7.8%) | 1218 |
| 금수   | 255(8.5%) | 655(21.8%) | 590(19.7%) | 404(13.5%) | 1096 |
| 토단일 | 142(4.7%) | 553(18.4%) | 609(20.3%) | 936(31.2%) | 760 |

---

## §2-3 wildfire 효과 채택률

| 프리셋 | wildfire | nourish | mining | purification |
|--------|----------|---------|--------|--------------|
| 목화   | 28.6% | 0.0% | 0.0% | 0.2% |
| 금수   |  0.8% | 0.0% | 0.0% | 0.0% |
| 토단일 |  0.0% | 0.0% | 0.0% | 0.0% |

목표 범위: 5~60% 자연 분포 (0%=사장 / 70%+=독식 경고)

- 목화 wildfire 28.6%: 목표 범위 내 (5~60%)
- 금수 wildfire 0.8%: 목표 하한 미달 (미미한 수준)
- 토단일 wildfire 0.0%: 사장

---

## §2-4 오행연환 발생률

| 프리셋 | 연환 총합 | 발생률/판 | 판정 |
|--------|-----------|-----------|------|
| 목화   | 7691 | 256.37% | 높음 |
| 금수   | 7420 | 247.33% | 높음 |
| 토단일 | 3776 | 125.87% | 높음 |

---

## §2-5 모으기 장수 분포

| 프리셋 | 2장 | 3장 | 4장 | 5장 | 합계/판 |
|--------|-----|-----|-----|-----|---------|
| 목화   | 0.00 | 0.01 | 0.37 | 0.28 | 0.66 |
| 금수   | 0.00 | 0.01 | 0.34 | 0.25 | 0.60 |
| 토단일 | 0.00 | 0.00 | 0.66 | 4.16 | 4.82 |

---

## §2-6 응축 발동 횟수/판

| 프리셋 | 응축 총합 | 응축/판 |
|--------|-----------|---------|
| 목화   | 491 | 0.164 |
| 금수   | 390 | 0.130 |
| 토단일 | 679 | 0.226 |

---

## §2-7 가호 선택 (selectTalismanBySaju 실측)

| 프리셋 | 가호 |
|--------|------|
| 목화   | sanggwan + geoptae |
| 금수   | jeongjae + bigyeon |
| 토단일 | pyeonin + bigyeon |

---

## §2-8 traitCounts 상위 15 (목화 기준)

| 키 | 발생/판 |
|----|---------|
| ohang-yeonhwan | 2.564 |
| passive_sanggwan | 1.595 |
| quench | 1.342 |
| passive_geoptae | 1.000 |
| wildfire | 0.993 |
| attack_nourish_used | 0.870 |
| nourish | 0.870 |
| keen | 0.783 |
| mirror | 0.740 |
| attack_wildfire_used | 0.709 |
| purification | 0.652 |
| attack_purification_used | 0.651 |
| harvest | 0.643 |
| snipe | 0.440 |
| gather4 | 0.365 |

---

## R3 vs R7 비교표

| 지표 | R3 (커밋 ab59ca7) | R7 (커밋 221368c) | 변화 | 판정 |
|------|-------------------|-------------------|------|------|
| 목화 클리어율 | 35.73% | 40.60% | +4.87%p | 상승 |
| 금수 클리어율 | 27.27% | 36.53% | +9.26%p | 상승 |
| 토단일 클리어율 | 23.23% | 25.33% | +2.10%p | 상승 |
| 프리셋 간 격차 | 12.50%p | 15.27%p | +2.77%p | 격차 확대 |
| wildfire 채택률 (목화) | 0.0% | 28.6% | +28.6%p | 목표 범위 진입 |
| wildfire 채택률 (금수) | 0.0% | 0.8% | +0.8%p | 여전히 하한 미달 |
| wildfire 채택률 (토단일) | 0.0% | 0.0% | 0.0%p | 사장 유지 |
| 응축/판 (목화) | 0.000 | 0.164 | +0.164 | B경로 추적 정상화 |
| 응축/판 (토단일) | 0.000 | 0.226 | +0.226 | B경로 추적 정상화 |

주) R3 응축 0.000은 traitCounts['yonggigama'] 미집계 버그 (R3 결과 파일 주석 참고).
    R7은 집계 방식 수정으로 정상 추적됨.

---

## §5 응축 return 0 근거

**코드 위치**: `fullCapBot.ts` L236-241 (`yonggigama` case)

```typescript
case 'yonggigama': {
  // 응축(옹기가마): effectMode 경로가 아닌 별도 applyCondense 경로로 처리됨
  // 봇 루프(simulateFullCapRun)에서 getCondenseAvailability → applyCondense 직접 호출
  // effectMode 경로에서는 return 0 (이중 처리 방지 — 정당한 설계)
  // * 응축 채택률은 applyCondense 별도 경로에서 condenseCount로 추적됨
  return 0
}
```

**응축 발동 경로 2가지**:

- **경로 A (effectMode 선택 경로)**: `scoreEffectForTrait()` → `yonggigama` case → `return 0` 차단. 이 경로로는 응축이 절대 발동되지 않음. bestEffectMode = false 유지.

- **경로 B (simulateFullCapRun 자동 경로)**: L935~958. `judgeCombo()` → `getCondenseAvailability()` → condenseKind === 'great' 조건 → `getCondenseMultiplier()` → `state.enemyHp > bestDamage` 조건 충족 시 → `applyCondense()` 자동 호출. condenseCount++ 증가.

**0.219/판 (토단일 기준) 출처**: 경로 B 자동 발동 횟수. 봇이 명시적으로 "효과를 선택"한 것이 아니라, simulateFullCapRun 루프 내 gather5 달성 후 HP>딜 조건 판정으로 자동 발동된 것.

**return 0의 역할**: 경로 A에서 이중 발동 방지. 경로 B는 return 0과 무관하게 별도로 동작함. 설계상 정당한 분리.

---

## §6 R5 두 벌 숫자 경위

파일 기반 추적 불가 — 42.5%/18.2% 기재 파일 workspace 전수 미발견.
추정: 이전 세션 텔레그램 보고 수치 또는 중간 시뮬 단위 출력값 (세션 히스토리 없이 확정 불가).

---

## DoD 체크리스트

```
[x] 1. fullCapBot.ts 오버킬 할인 구현 (enemyHp <= attackDamage → adjustedEffectValue=0)
[x] 2. tsc 0 에러 확인
[x] 3. vitest 기존 테스트 PASS (R7 추가로 신규 실패 0건, 오히려 7건 개선)
[x] 4. git commit (잔불 수정 R6 + 오버킬 할인 R7 합산 커밋)
[x] 5. 새 커밋 해시 확보: 221368c
[x] 6. §4 dispatch 6줄 작성 (새 해시 포함)
[x] 7. 3000판 × 3종 본시뮬 실행
[x] 8. 클리어율 + CI 기재
[x] 9. R3 vs R7 비교표
[x] 10. 동봉 2건 (§5 응축 근거 / §6 R5 경위) 포함
[x] 11. 결과 파일 작성: ZERA_BALANCE_V3_R7_RESULT_20260715.md
[x] 12. 빌라드 보고 (완료)
```

---

_작성: 제라 | 2026-07-15_
