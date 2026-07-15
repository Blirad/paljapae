# ZERA — balance-v3 R4 (잔불 평가 수식 재설계 + 다른 효과 감사) (2026-07-14)

_발행: 빌라드 ⚔️ | 이든 R4 지시_

---

## 배경

R3 결과: 잔불 채택률 0.0% (과도 보정) + 자양/채굴/정화/응축도 거의 0%

근본 원인: EMBER_MULTIPLIER 상수가 게임 엔진 실효 배율과 괴리됨.

**R4 방향**: 상수 발명 금지 → 게임 엔진 값 직접 참조로 수식 재설계

---

## 즉답 2건 (우선 처리)

### ① 게임 엔진 잔불 실효 배율 감사

**확인 항목**:
게임 엔진(paljajeonEngine.ts)에서 잔불(wildfire) 효과의 실제 배율은?

**코드 라인 인용 필수**:
- wildfire 효과 처리 함수
- 데미지 계산식
- 최종 배율값

**현황**:
- R2/R3에서 EMBER_BOT_MULTIPLIER=2.2 적용했는데, 게임 엔진의 실제 잔불 배율이 ×2.2인지 확인
- 아니면 게임 엔진 값으로 보정 필요

**결론**:
- ×2.2 미반영이면: 게임 엔진 실제값 반영 + BOT 전용 상수 제거 → 게임 상수 단일 참조로 통일
- 이미 반영되면: 다음으로

---

### ② 자양·채굴·정화·응축 평가식 감사 (R3 미보고분)

**확인 항목** (fullCapBot.ts scoreEffectForTrait):

| 효과 | 평가식 | 문제점 감사 |
|------|--------|-----------|
| 자양(nourish) | min(기본치×2.5, maxHP-HP) × HP위험가중 | OK? |
| 채굴(mining) | 드로우장수 × 핸드평균값 | OK? |
| 정화(purification) | ? | 식 자체 미정의인가? |
| 응축(condense) | 다음공격추정 × 실효% | clamp 외 문제점? |

**결론**:
- 각 평가식 코드 라인 인용
- 상수값(배율, 기준값 등) 확인
- 게임 엔진과의 괴리 지점 특정

---

## 수정 — 잔불 평가 수식 재설계

### 원칙: 상수 금지, 게임 값 참조

```typescript
case 'wildfire': {
  // 게임 엔진 잔불 실제 배율 직접 참조
  // baseValue = 즉발 최대 데미지
  // 잔불 평가 = baseValue × 게임_잔불_총배율 × min(3, 남은공격)/3
  
  const WILDFIRE_GAME_MULTIPLIER = <게임 엔진에서 확인 + 코드 라인>
  const attacksRemaining = 3
  const emberEffectiveness = WILDFIRE_GAME_MULTIPLIER * Math.min(3, attacksRemaining) / 3
  
  return Math.round(baseValue * emberEffectiveness)
}
```

---

## 3000판 × 3종 재시뮬

동일 조건:
- 시드: i*12345+7777
- enableEffectMode: true
- enableCondenseClamp: true

### 예상 착지

- wildfire 채택률: 10~25% (생 상대 조우 근방)
- nourish: 소수% (HP 위험 국면)
- 여전히 전멸이면 "봇 하한 편향" 기록 + 클리어율 축 판정

---

## 최종 착지

- 효과 채택 정상화: 전 프리셋 +1~3%p (목화 36~38%, 토단일 25~27%)
- 미달 시 R5: 응축 clamp 추가 완화 (0.6→0.7)

---

_발행: 빌라드 ⚔️ — 2026-07-14_
