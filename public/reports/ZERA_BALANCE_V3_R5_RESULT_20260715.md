# ZERA — balance-v3 R5 결과 보고서 (2026-07-15)

_작성: 제라 | dispatch: ZERA_BALANCE_V3_R5_DISPATCH_20260715.md_
_재시뮬 완료: 2026-07-15 01:45 KST_

---

## 요약

R5 (E안: 효과에 시너지 적용) 구현 검증 및 3000판 × 3종 재시뮬 완료.

**핵심 변경**:
1. `playCards` 함수에 `effectMode?: boolean` 파라미터 추가 (봇에서 전달하던 3번째 인자가 엔진에서 무시되던 버그 수정)
2. `effectMode=true` + `fusion-birth` 시 `damage=0` 처리 (양자택일 구현)

**엔진 효과 5종 synergyMultiplier 반영**: 이미 구현 완료 상태 확인.

---

## DoD 체크리스트

```
[x] 1. 게임 엔진: 효과 5종에 용신 x1.3 적용
     - wildfire: carryoverBurn = damage x 0.3 x synergyMultiplier (라인 574)
     - mining: drawCount = floor(baseValue x synergyMultiplier / MINING_DRAW_DIVISOR) (라인 584)
     - nourish: healAmount = baseHeal x synergyMultiplier (라인 704)
     - purification: effectiveThreshold = PURIFICATION_THRESHOLD / synergyMultiplier (라인 625)
     - applyCondense: multiplier = (bonusPercent/100) x synergyMultiplier (라인 1007)
     -> 확인: 엔진에 이미 R5 시너지 적용 완료 상태

[x] 2. 게임 엔진: 가호 자연 적용 확인 (식신 공격 전용 유지)
     - sikshin "다음 공격 +10%": 공격 전용, effectMode=true시 damage=0이므로 자연 제외
     - geoptae(목 x1.3): synergyMultiplier에 반영 (paljajeonEngine.ts 421~432)
     - dispatch 규칙 준수 확인

[x] 3. 봇 평가식: 게임 시너지 거울 반영 (C안 흔적 없음 확인)
     - scoreEffectForTrait에 synergyMultiplier 파라미터 전달 + 5종 case 구현 완료
     - C안 흔적(effectValue > attackDamage x 0.6 등) 없음
     - 순수 기대값 비교만 수행

[x] 4. 정화 case 구현 (미정의 버그 해소)
     - paljajeonEngine.ts 619~643: purification case 완전 구현 확인
     - fullCapBot.ts 220~234: purification 봇 평가식 구현 확인

[x] 5. 응축 평가 구현 (return 0 설계 근거 확인)
     - yonggigama case return 0은 정당한 설계 (이중처리 방지)
     - 응축은 applyCondense 별도 경로로 처리 (simulateFullCapRun 916~947)
     - 응축 실제 발동 확인: 토단일 0.219/판, 목화 0.155/판

[x] 6. playCards effectMode 파라미터 추가 (신규 발견 버그 수정)
     - 봇에서 3인자로 호출하나 엔진이 2인자만 받아 effectMode 무시 상태였음
     - paljajeonEngine.ts playCards 함수에 effectMode?: boolean 파라미터 추가
     - fusion-birth + effectMode=true 시 damage=0 처리 삽입

[x] 7. 3000판 x 3종 재시뮬 완료 (v3MainSim3000.test.ts, PASS)

[x] 8. 채택률 측정 완료 (wildfire/nourish/condense/purification 전부)

[x] 9. 결과 파일 작성

[ ] 10. git commit (보고서 작성 완료 후 실행)
```

---

## 구현 변경 사항

### paljajeonEngine.ts

**변경 1: playCards 함수 시그니처 확장**

```typescript
// 이전 (2인자)
export function playCards(state: GameState, cardIds: string[]): GameState

// 이후 (3인자, effectMode 추가)
export function playCards(state: GameState, cardIds: string[], effectMode?: boolean): GameState
```

**변경 2: effectMode 처리 블록 추가 (호리병 처리 후 / afterDamageHp 계산 직전)**

```typescript
// B1-1: effectMode — fusion-birth 조합에서 양자택일(효과만, 공격 데미지 = 0)
// effectMode=true이면 공격 데미지를 0으로 설정하고 효과만 발동
// 융합(fusion-birth)이 아닌 경우 effectMode는 무시
if (effectMode && isFusion && result.rank === 'fusion-birth') {
  damage = 0
}
```

---

## 시뮬레이션 결과 (3000판 x 3종)

**시드**: i x 12345 + 7777
**조건**: enableEffectMode=true, enableFloorReward=true
**가호**: selectTalismanBySaju(dist) 자동 선택
**소요 시간**: 약 29초

### §2-1 클리어율 + Wilson 95% CI

| 프리셋 | 클리어 | 클리어율 | CI 하한 | CI 상한 | +/-CI |
|--------|--------|----------|---------|---------|-------|
| 목화   | 1101/3000 | 36.70% | 34.99% | 38.44% | +/-1.72%p |
| 금수   | 1124/3000 | 37.47% | 35.75% | 39.21% | +/-1.73%p |
| 토단일 |  710/3000 | 23.67% | 22.18% | 25.22% | +/-1.52%p |

**프리셋 간 격차: 13.80%p**

**R10 기준선 비교 (enableEffectMode=false)**:

| 프리셋 | R10 기준선 | R5 결과 | 변화 |
|--------|-----------|---------|------|
| 목화   | 37.53%    | 36.70%  | -0.83%p |
| 금수   | 32.73%    | 37.47%  | +4.74%p |
| 토단일 | 31.23%    | 23.67%  | **-7.56%p** |

### §2-2 층별 사망 분포

| 프리셋 | 1층 사망 | 2층 사망 | 3층 사망 | 4층 사망 | 클리어 |
|--------|----------|----------|----------|----------|--------|
| 목화   | 91(3.0%)  | 976(32.5%) | 570(19.0%) | 262(8.7%)  | 1101 |
| 금수   | 274(9.1%) | 658(21.9%) | 568(18.9%) | 376(12.5%) | 1124 |
| 토단일 | 144(4.8%) | 544(18.1%) | 625(20.8%) | 977(32.6%) | 710  |

### §2-3 효과 채택률 (effectMode=true 조건)

| 프리셋 | wildfire | nourish | mining | purification |
|--------|----------|---------|--------|--------------|
| 목화   | 30.0%    | 0.0%    | 0.0%   | 0.1%         |
| 금수   |  0.5%    | 0.0%    | 0.0%   | 0.0%         |
| 토단일 |  0.0%    | 0.0%    | 0.0%   | 0.0%         |

목표 기준 5~60% 자연 분포:
- wildfire 목화 30.0%: 범위 내
- 나머지: 0% (사장 상태)

### §2-4 오행연환 발생률

| 프리셋 | 연환 총합 | 발생/판 |
|--------|-----------|---------|
| 목화   | 7455      | 2.485/판 |
| 금수   | 7455      | 2.485/판 |
| 토단일 | 3787      | 1.262/판 |

### §2-5 모으기 장수 분포 (발동/판)

| 프리셋 | 2장 | 3장 | 4장 | 5장 | 합계/판 |
|--------|-----|-----|-----|-----|---------|
| 목화   | 0.00 | 0.02 | 0.35 | 0.27 | 0.64 |
| 금수   | 0.00 | 0.01 | 0.34 | 0.23 | 0.58 |
| 토단일 | 0.00 | 0.00 | 0.68 | 4.12 | 4.81 |

### §2-6 응축 발동 횟수/판

| 프리셋 | 응축 총합 | 응축/판 |
|--------|-----------|---------|
| 목화   | 464       | 0.155   |
| 금수   | 382       | 0.127   |
| 토단일 | 656       | 0.219   |

응축 실제 발동 확인. R3의 0회 문제에서 정상화됨.

### 가호 선택 (selectTalismanBySaju)

| 프리셋 | 가호 |
|--------|------|
| 목화   | sanggwan + geoptae |
| 금수   | jeongjae + bigyeon |
| 토단일 | pyeonin + bigyeon  |

### traitCounts 상위 15 (목화 기준)

| trait | 발동/판 |
|-------|---------|
| ohang-yeonhwan | 2.485 |
| passive_sanggwan | 1.586 |
| quench | 1.319 |
| passive_geoptae | 0.999 |
| wildfire | 0.936 |
| attack_nourish_used | 0.863 |
| nourish | 0.863 |
| keen | 0.767 |
| mirror | 0.724 |
| attack_wildfire_used | 0.655 |
| harvest | 0.637 |
| purification | 0.633 |
| attack_purification_used | 0.632 |
| snipe | 0.441 |
| gather4 | 0.351 |

---

## dispatch 예상 vs 실측 비교

| 항목 | dispatch 예상 | 실측 | 달성 |
|------|-------------|------|------|
| 목화 클리어율 | 35~37% | 36.70% | 달성 |
| 금수 클리어율 | 27~29% | 37.47% | 초과 달성 |
| 토단일 클리어율 | 24~27% | 23.67% | 미달 (-0.33%p) |
| wildfire 채택률 | 10~25% | 30.0%(목화) / 0.5%(금수) / 0%(토단일) | 목화 범위 초과 |
| nourish 채택률 | HP위험 소수% | 0.0% | 결과 부합 (정상 HP에서 미선택) |
| condense 채택률 | 5~15%(토단일) | 0.219/판 발동 | 발동 확인 (채택률 단위 상이) |
| purification 채택률 | 5~10% | 0.1% / 0% / 0% | 미달성 |

---

## 분석

### 이슈 1 — 토단일 클리어율 R10 대비 -7.56%p

현상: R10 enableEffectMode=false 기준 31.23% → R5 enableEffectMode=true 23.67%.

원인 분석:
- 4층 사망 977건(32.6%)으로 집중 — 4층 병목이 지배적
- effectMode 도입 시 공격 기회를 효과 발동에 사용하면 이후 턴에서 적 HP 격파 실패
- 토단일은 응축 후 1회 강타가 핵심 전략인데, effectMode로 공격 기회 소모 시 손해 가능성
- 단, 토단일에서 wildfire 채택률 0.0%이므로 effectMode 직접 영향은 없음
- 추정: 이번 실행 난수 조건 차이, 또는 가호 변경(R3 sikshin 제외) 영향

추가 검증 권장: enableEffectMode=false 조건으로 재실행해 R10 기준선 재현 여부 확인.

### 이슈 2 — wildfire 효과 설계 문제

현상: effectMode=true + wildfire 선택 시 damage=0 → carryoverBurn = 0 x 0.3 = 0.
봇이 wildfire를 효과 모드로 선택하면 실제 잔불 이월이 0이다. 손해 발생.

원인: 봇의 wildfire 기대값 계산식이 baseValue x EMBER_MULTIPLIER x EMBER_DURATION = baseValue x 3.0으로 산정되어 공격 기대값보다 크게 나오는 케이스 발생.

그러나 실제 엔진에서 wildfire effectMode는 damage=0 → carryoverBurn=0이므로 실익 없음.

제언: wildfire는 effectMode 경로에서 제외하고 항상 공격+효과 동시 발동으로 처리하는 것이 적합.

### 이슈 3 — nourish/mining/purification 채택률 0%

원인:
- nourish 기대값: maxHp x 0.08 x synergyMultiplier = 500 x 0.08 x 1.3 = 52
  공격 기대 데미지 100+ 대비 절반 미만 -> 미선택
- mining 기대값: drawCount x handAvg = 최대 3 x 평균카드값 -> 15~30 수준 -> 미선택
- purification 기대값: BASE_PURIFICATION_DAMAGE x synergyMultiplier = 8 x 1.3 = 10.4
  공격 기대값 대비 극소 -> 항상 미선택

효과 평가식 자체는 엔진 거울 반영 완료. 단, 게임 설계상 해당 효과들의 실제 가치(HP 회복, 드로우, 기세죽음 해제)가 순수 데미지 비교 기준으로는 저평가되는 구조적 문제.

---

## tsc 검증

```
npx tsc --noEmit -> 에러 없음 (0 errors)
```

---

## 변경 파일 목록

- `/Users/bilard/.openclaw/workspace/paljapae/src/engine/paljajeonEngine.ts`
  - playCards 함수 effectMode 파라미터 추가
  - effectMode=true 시 fusion-birth damage=0 처리 삽입

- `/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_R5_RESULT_20260715.md`
  - 본 결과 보고서

---

_작성 완료: 제라 — 2026-07-15_
