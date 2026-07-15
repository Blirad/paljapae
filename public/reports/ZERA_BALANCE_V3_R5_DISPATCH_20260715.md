# ZERA — balance-v3 R5 (E안: 효과에 시너지 적용 + 정화 구현 + 응축 평가) (2026-07-15)

_발행: 빌라드 ⚔️ | 이든 R5 지시 (14098)_

---

## 배경

R4 결과: wildfire 여전히 0.3% 사장. 원인 = 봇 평가식이 게임 시너지(용신·가호)를 미반영.

**R5 방향 (E안)**: 게임 엔진에서 효과 옵션에 용신·가호 시너지를 실제로 적용 + 봇 평가식도 이를 거울 반영.

---

## 작업 1 — 게임 엔진 변경: 효과 옵션에 시너지 적용

### 원칙

스펙 v3.1 §3 개정:
"효과 = rawBase가 아니라 용신·가호 시너지를 받는 값. 공격과의 차이는 상성 축뿐"

### 시너지 적용 규격

**용신 ×1.3**: 효과 5종 전부 적용
- 잔불(wildfire): 잔불 총량(baseValue × EMBER_MULTIPLIER × EMBER_DURATION) × 1.3
- 자양(nourish): 자양 회복량(min(baseValue × 2.5, maxHP-HP)) × 1.3
- 채굴(mining): 채굴 임계값(drawCount 계산 기준) × 1.3
- 정화(purification): 정화 임계값 × 1.3
- 응축(condense): 응축 실효%(getCondenseMultiplier()) × 1.3

**가호**: 효과에도 적용 가능한 것만 자연 적용
- 식신 "다음 공격 +10%": 공격 전용 유지, 효과에 미적용
- 다른 가호(자연 적용 가능한 것): 그대로 적용

**상성**: 각 효과 정의대로
- 잔불: 상성 무시 유지
- 기타: 효과 정의에 따름

### 구현 위치

`paljajeonEngine.ts` 내 효과 처리 함수:
- 용신 배율을 읽어 효과 계산에 적용
- 가호 중 효과에 자연 적용 가능한 것 확인 후 적용

---

## 작업 2 — 봇 평가식 거울 반영 (C안 흔적 금지)

`fullCapBot.ts scoreEffectForTrait` 함수:

- 게임 엔진이 계산한 실제 효과 값(시너지 적용 후)을 그대로 가져와 비교
- 별도 보정/bias 없이 게임 값을 그대로 반영
- C안 잔재(effectValue > attackDamage × 0.6 등) 있으면 제거

---

## 작업 3 — 정화(purification) case 구현

**현황**: R4 감사에서 정화 case가 default:return 0으로 미정의 상태 확인됨

**구현**:
- paljajeonEngine.ts에서 정화 효과 실제 동작 확인
- 정화 기대값 계산식 구현:
  ```typescript
  case 'purification': {
    // 게임 엔진 정화 실제 효과값 참조
    // 시너지 적용 (용신 ×1.3)
    return Math.round(purificationValue);
  }
  ```

---

## 작업 4 — 응축 평가 구현 + "return 0 의도" 근거 제출

**현황**: R4에서 응축이 effectMode에서 return 0으로 설계됨 = 봇이 응축을 영구 미선택

**이든 지시**: 
"응축 평가 구현 시 토단일 상승 여력 있음 (중요)"
- 토단일 22%에서 응축 0%였다 = 응축 발동 전혀 없는 상태에서 22%
- 응축 평가 구현 시 +2~4%p 예상

**구현**:
- 응축 case에서 return 0 제거
- 게임 엔진 응축 실효값(getCondenseMultiplier) 참조
- 봇이 응축을 선택할 수 있도록 평가식 구현:
  ```typescript
  case 'yonggigama': // 응축
  case 'condense': {
    const condenseEff = getCondenseMultiplier(condenseCounts);
    const nextAttackEst = getHighestDamageCombo(hand.filter(c => /* 응축 카드 제외 */));
    return Math.round(nextAttackEst * condenseEff * 1.3); // 용신 시너지 포함
  }
  ```

---

## 작업 5 — 3000판 × 3종 재시뮬

동일 조건:
- 시드: i*12345+7777
- enableEffectMode: true
- enableCondenseClamp: true (기준값 10, 하한 0.6)

### 예상 착지

| 효과 | 예상 채택률 | 근거 |
|------|-----------|------|
| wildfire | 10~25% | 시너지 반영으로 기대값 상승 |
| nourish | HP 위험 국면 소수% | HP 낮을 때만 유리 |
| condense | 5~15% (토단일) | 응축 평가 구현 + 클램프 완화 |
| purification | 5~10% | 정화 case 구현 |

### 클리어율 예상

| 프리셋 | 예상 R5 | 근거 |
|--------|---------|------|
| 목화 | 35~37% | 유지 |
| 금수 | 27~29% | 미세 상승 |
| 토단일 | 24~27% | 응축 평가 구현 (+2~4%p) |

---

## DoD 체크리스트

```
[ ] 1. 게임 엔진: 효과 5종에 용신 ×1.3 적용
[ ] 2. 게임 엔진: 가호 자연 적용 확인 (식신 공격 전용 유지)
[ ] 3. 봇 평가식: 게임 시너지 거울 반영 (C안 흔적 제거)
[ ] 4. 정화 case 구현 (미정의 버그 해소)
[ ] 5. 응축 평가 구현 (return 0 제거)
[ ] 6. 3000판×3종 재시뮬 완료
[ ] 7. 채택률 측정 (wildfire/nourish/condense/purification)
[ ] 8. 결과 파일 작성: ZERA_BALANCE_V3_R5_RESULT_20260715.md
[ ] 9. git commit
```

---

## 산출물

완료 보고서: `/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_R5_RESULT_20260715.md`

---

_발행: 빌라드 ⚔️ — 2026-07-15_
