# ZERA — balance-v3 R6 (잔불 엔진 버그 수정 + 어블레이션) (2026-07-15)

_발행: 빌라드 ⚔️ | 이든 R6 지시 (메시지 14102)_

---

## 배경

R5에서 제라가 발견한 이슈 2:
> effectMode=true + wildfire 선택 시 damage=0 → carryoverBurn = damage×0.3 = 0.
> 봇이 wildfire를 효과 모드로 선택해도 실제 잔불이 이월되지 않는다.

원인: R5에서 잔불 엔진 구현이 **carryoverBurn = damage × 0.3** 방식(구 번짐 잔재)으로 동작 중.
effectMode에서 damage=0으로 세팅되므로 carryoverBurn = 0이 됨.

이든 진단: "R5 채택률 30%는 '값 0짜리 수를 30% 두는 봇'의 숫자" — R6 채택률이 첫 진짜 분포.

---

## 작업 1 — 잔불 엔진 버그 수정

### 목표
효과 선택(effectMode) 시 잔불 = rawBase × EMBER_MULTIPLIER 매 턴, EMBER_DURATION(3턴) 고정 피해.
damage 경유 방식(carryoverBurn = damage × 0.3) 제거.

### 현행 코드 (paljajeonEngine.ts)

```typescript
// 현행 (버그 — 구 번짐 잔재): effectMode 시 damage=0 → carryoverBurn=0
case 'wildfire': {
  newCarryoverBurn = Math.round(damage * 0.3 * synergyMultiplier)
  break
}
```

plus:
```typescript
// effectMode=true 시 damage=0으로 세팅 (L486)
if (effectMode && isFusion && result.rank === 'fusion-birth') {
  damage = 0
}
```

### 수정 방향

잔불 엔진을 damage 경유에서 rawBase 직접 계산으로 교체:
- **effectMode=false (공격 모드)**: 기존 방식 유지 (rawBase 기반 또는 damage×0.3 — 공격에서 damage≠0)
- **effectMode=true (효과 모드)**: rawBase × EMBER_MULTIPLIER로 직접 잔불 설정, EMBER_DURATION(3턴)

수정 후 잔불 1턴 피해 = rawBase × EMBER_MULTIPLIER = rawBase × 1.0 = rawBase
3턴 합 = rawBase × 3.0

⚠️ **총배율 ×3.0 유지**: EMBER_BOT_MULTIPLIER의 ×2.2 하향은 잔불 독식 때문이었으나 독식 원인은 R3에서 이미 제거됨(이중 상성 버그). ×3.0 복원.

### 유닛 테스트 필수

`paljapae/src/test/` 에 새 테스트 추가:
- effectMode=true 잔불 선택 시 3틱 합 = rawBase × 3 assert
- rawBase = 예: 10 → 3틱 합 = 30

vitest 실행으로 PASS 확인 필수.

---

## 작업 2 — 어블레이션 1000판 × 2설정

### 설정 ①: 잔불 수정만

조건:
- 잔불 엔진 버그 수정 (작업 1 완료)
- enableEffectMode=true, enableFloorReward=true, enableCondenseClamp=true (기준값 10, 하한 0.6)
- 시드: i×12345+7777 (i=0~999)
- 프리셋: 목화/금수/토단일 동일

### 설정 ②: 잔불 수정 + 응축 clamp 하한 상향

조건: 설정 ① + CONDENSE_SCALE_MIN 0.6 → 0.7

---

## 작업 3 — 어블레이션 결과 보고 → 본시뮬 판정

1. ①② 결과를 이 파일에 표로 기재
2. 어블레이션 기준 판정:
   - wildfire 채택률 범위 내 (5~60%) 여부
   - 클리어율 방향성 확인
3. 판정 결과에 따라 본시뮬 구성 확정

### 본시뮬 (빌라드 판정 후 실행)

3000판 × 3종 (①, ②, 또는 빌라드 지시 설정)

---

## 예상 착지

| 설정 | 목화 예상 | 금수 예상 | 토단일 예상 | 근거 |
|------|----------|----------|------------|------|
| ① 잔불 수정 | +1~3%p | 유지 | +1~2%p | 봇이 버리던 수 30% 회복 |
| ② +clamp 상향 | 유지 | 유지 | +2~3%p (25 회복 목표) | 응축 조건 강화 |

이든 코멘트: "① 목화 40 재초과 가능성 주시"

---

## DoD 체크리스트

```
[ ] 1. paljajeonEngine.ts wildfire case — damage 경유 제거, rawBase × EMBER_MULTIPLIER 직접 계산
[ ] 2. effectMode 분기 처리 (공격 모드/효과 모드 각각 잔불 적용)
[ ] 3. 유닛 테스트: effectMode=true 3틱 합 = rawBase×3 PASS
[ ] 4. tsc 0 에러 확인
[ ] 5. 어블레이션 ① 실행 (1000판 × 3종) + 결과 기재
[ ] 6. 어블레이션 ② 실행 (1000판 × 3종) + 결과 기재
[ ] 7. ①② 비교표 작성 + 본시뮬 구성 권고
[ ] 8. 빌라드 판정 요청 (본시뮬 진행 여부)
[ ] 9. 결과 파일 작성: ZERA_BALANCE_V3_R6_RESULT_20260715.md
[ ] 10. git commit (본시뮬 완료 후)
```

---

## ⛔ 보고 규칙 (절대 준수)

- **완료 보고 대상: 빌라드에게만** (파일 생성으로 보고)
- **이든에게 직접 연락/메시지 절대 금지** — 파이프라인 위반
- 빌라드가 검토 후 이든에게 전달함

---

## 산출물

완료 보고서: `/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_R6_RESULT_20260715.md`

---

_발행: 빌라드 ⚔️ — 2026-07-15_
