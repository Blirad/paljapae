# ZERA — balance-v3 R3 (이중 상성 버그 픽스) (2026-07-14)

_발행: 빌라드 ⚔️ | 이든 R3 지시_

---

## 배경

R2 결과: 잔불 ×2.2 적용해도 독식 미해소 (51.9%~95.7%).

원인 규명: `scoreEffectForTrait wildfire` 이중 상성 버그
- `attackDamage` (이미 상성 ×1.5/×0.75 포함)
- × `affinityMult` (또 상성 곱함) ← **중복**

결과: 잔불 기대값 과대평가 → 항상 잔불 선택

---

## 수정 — 잔불 버그 픽스

### 위치

`/Users/bilard/.openclaw/workspace/paljapae/src/engine/fullCapBot.ts`

`scoreEffectForTrait` 함수 내 wildfire 케이스

### 현행 코드

```typescript
case 'wildfire':
  const attackDamage = getHighestDamageCombo(hand);
  // 현재 (버그): attackDamage에 이미 상성이 포함되어 있는데 또 곱함
  return Math.round(attackDamage * EMBER_BOT_MULTIPLIER * affinityMult);
```

### 수정안

```typescript
case 'wildfire':
  const attackDamage = getHighestDamageCombo(hand);
  // 수정: affinityMult 제거 (attackDamage가 이미 상성 적용됨)
  return Math.round(attackDamage * EMBER_BOT_MULTIPLIER);
```

**핵심**: `affinityMult` 제거. attackDamage는 이미 상성을 포함하고 있으므로 또 곱할 필요 없음.

---

## 3000판 × 3종 재시뮬

동일 조건:
- 시드: i*12345+7777
- 프리셋: 목화/금수/토단일
- enableEffectMode: true
- enableFloorReward: true
- enableCondenseClamp: true (R2의 clamp 완화 유지)

### 예상 착지

잔불 버그 픽스 후:

| 지표 | R2 | 예상 R3 | 근거 |
|------|-----|---------|------|
| 잔불 채택률 | 51.9%~95.7% | 15~35% | 이중 상성 제거로 정상화 |
| 토단일 클리어 | 21.63% | +3~5%p | 응축 + 다른 효과 활용 |
| 목화/금수 | 31.23%/26.77% | +2~3%p | 잔불 감소분 재분배 |

---

## 조치 체크리스트

```
[ ] 1. dispatch 파일 읽기
[ ] 2. fullCapBot.ts scoreEffectForTrait wildfire에서 affinityMult 제거
[ ] 3. 코드 검증: 수정 전후 diff 확인
[ ] 4. 3000판×3종 재시뮬 실행
[ ] 5. 결과 수집:
      - 클리어율 (Wilson 95% CI)
      - 효과 채택률 (자양/잔불/채굴/응축)
      - R2 vs R3 비교표
[ ] 6. 결과 파일 작성: ZERA_BALANCE_V3_R3_RESULT_20260714.md
[ ] 7. git commit
```

---

## 산출물

완료 보고서: `/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_R3_RESULT_20260714.md`

---

_발행: 빌라드 ⚔️ — 2026-07-14_
