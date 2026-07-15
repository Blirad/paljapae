# ZERA — balance-v3 재기준선 발사 지시 (2026-07-14)

_발행: 빌라드 ⚔️ | 이든 14070 지시_
_대상 커밋 기준: 323920f (balance-v2, R10 완료)_

---

## ⛔ 보고 규칙 (절대 준수)

- **완료 보고 대상: 빌라드에게만** (파일 생성으로 보고)
- **이든에게 직접 연락/메시지 절대 금지** — 파이프라인 위반
- 빌라드가 검토 후 이든에게 전달함

---

## 배경

R10 PASS 완료 (목화 37.53% / 금수 32.73% / 토단일 31.23%, balance-v2 태그).
이든 지시: 봇 평가 수식화 → balance-v3 재기준선 발사.

---

## 작업 1 — 무한루프 픽스 확정 + 재발 방지

### 목표

봇 액션이 엔진에서 리젝될 때 조용히 무시(silent fail) → **즉시 throw**로 표면화.

### 구현

`fullCapBot.ts` 내 `playCards()` / `discardCards()` 호출부에서:
- 엔진이 상태를 변경하지 않고 동일 state를 반환하는 경우 (=리젝) throw
- 리젝 판별 조건: `nextState.hp === state.hp && nextState.enemyHp === state.enemyHp && nextState.discardCount === state.discardCount && nextState.hand.length === state.hand.length` (모든 상태 동일 = 리젝)

대표적 리젝 케이스:
- `discardCards(4장 이상)` — `MAX_DISCARD_PER_USE` 위반
- `playCards(0장)` — 빈 조합
- `discardCards(0장)` — 빈 버리기

### 유닛 테스트 (1건 필수)

파일: `paljapae/src/test/throwOnReject.test.ts` (신규)

```
케이스: fullCapBot 내부에서 4장 버리기를 시도하는 상황을 만들면
        엔진이 리젝(MAX_DISCARD_PER_USE=3 초과) → throw 발생
기대: expect(() => botAction()).toThrow()
```

구현 방식: fullCapBot의 `botDiscard` 내부에서 직접 4장 배열로 discardCards 호출을 mocking하거나,
또는 `runOneTurn`이 리젝 상태를 감지하면 throw하도록 구현.

---

## 작업 2 — A안 38.0% ≈ R10 37.53% 정합 확인 (1줄 기록)

작업 1 (무한루프 픽스) 완료 후, **동일 조건**으로 목화 프리셋 1000판 시뮬 실행:
- 프리셋: {mok:4, hwa:4, to:2, geum:2, su:2}
- 시드: i * 12345 + 7777
- enableFloorReward: true
- activePassiveIds: selectTalismanBySaju(dist) 결과 (sanggwan+geoptae)

결과값이 R10 본시뮬(37.53%, 3000판)의 ±2%p 이내면 정합 확인.

보고서에 1줄 기록:
```
무한루프 픽스 후 목화 1000판: XX.XX% (R10 37.53%와 ±Xp 이내 → 픽스 무결성 확인)
```

---

## 작업 3 — 효과 기대값 닫힌 수식 4종 교체

`fullCapBot.ts` 내 `scoreEffectForTrait()` 또는 해당 효과 채점 함수에서 아래 4종 수식을 **정확히** 적용.

### ⚠️ 원칙: 우대 가중치 금지

효과 모드 채점 시 어떤 특성도 임의로 보정치(bias/boost) 추가 금지.
공격 모드 기대 데미지 vs 효과 기대값을 동일 척도(데미지 환산)로 비교만 할 것.

### 수식 정의

| 특성 | 기대값 수식 |
|------|------------|
| **자양(nourish)** | `min(기본치 × 2.5, maxHP - HP) × HP위험 가중치`<br/>HP위험 가중치 = `HP <= maxHP*0.3 ? 2.0 : HP <= maxHP*0.5 ? 1.5 : 1.0` |
| **잔불(ember)** | `max(기본치 × 3, 즉발데미지 × EMBER_MULTIPLIER × 상성배율)`<br/>즉발데미지 = 현재 핸드 최고 공격 조합 점수 |
| **채굴(mining)** | `드로우장수 × 핸드평균값`<br/>드로우장수 = `min(MINING_MAX_DRAW, floor(핸드수 / MINING_DRAW_DIVISOR))`<br/>핸드평균값 = `sum(card.value) / hand.length` |
| **응축(condense)** | `다음공격추정 × 실효%`<br/>다음공격추정 = 현재 핸드에서 응축 제외 최고 조합 기대 데미지<br/>실효% = `getCondenseMultiplier(condenseCounts)` |

### 구현 위치

`fullCapBot.ts` 내 `scoreEffectForTrait()` 함수 (없으면 신규 생성):

```typescript
function scoreEffectForTrait(
  traitId: string,
  state: GameState,
  hand: Card[],
  ...
): number {
  switch (traitId) {
    case 'nourish': // 자양
    case 'ember':   // 잔불
    case 'mining':  // 채굴
    case 'condense': // 응축
    default:
      return 0 // 미정의 특성 → 0 (효과 미채택)
  }
}
```

---

## 작업 4 — 수식 교체 후 A/B 1000판 재확인

### 테스트 설계

| 구분 | 설정 |
|------|------|
| A안 | `enableEffectMode: false` (기존 — 항상 공격) |
| B안 | `enableEffectMode: true` (수식 교체 후 효과 선택) |
| 프리셋 | 표준 3종 각각 (목화/금수/토단일) |
| 판 수 | 각 1000판 |
| 시드 | i * 12345 + 7777 |
| enableFloorReward | true |
| activePassiveIds | selectTalismanBySaju(dist) |

### 관찰 지표

- **4종 효과 채택률**: 자양/잔불/채굴/응축 각각의 선택 비율
  - 0% = 사장 (수식 오류 의심)
  - 70%+ = 독식 (우대 가중치 의심)
  - 목표: 5~60% 범위 내 자연 분포
- **클리어율 A vs B 비교**

---

## 작업 5 — balance-v3 재기준선 발사

### 발사 조건

작업 1~4 완료 후 실행.

### §2 dispatch 6줄 발사 규격

| 항목 | 측정 내용 |
|------|---------|
| 판 수×프리셋 | 3000판 × 3종 (목화/금수/토단일) |
| 기본 지표 | 클리어율 (Wilson 95% CI) + 프리셋 간 격차 |
| 효과 채택률 | 자양/잔불/채굴/응축 옵션별 선택 비율 (enableEffectMode=true 조건) |
| 연환 발생률 | ×8 연환 발생 횟수/판 (현행 YEONHWAN_MULTIPLIER=8) — ×12/×16 시나리오 병행 가능 시 추가 |
| 모으기 장수 분포 | 각 층에서 선택된 gather 조합 장수 분포 (1장~5장) |
| 응축 투입값 분포 | 응축 발동 시 condenseCount 분포 (화N + 토M 조합별) |

### 시드/프리셋 (R10 동일)

```
시드: i * 12345 + 7777
목화: {mok:4, hwa:4, to:2, geum:2, su:2}
금수: {mok:2, hwa:2, to:2, geum:4, su:4}
토단일: {mok:1, hwa:1, to:14, geum:2, su:2}
enableFloorReward: true
activePassiveIds: selectTalismanBySaju(dist)
enableEffectMode: true  ← balance-v3 기준선이므로 수식 교체 반영
```

---

## 작업 6 — 예상 착지 기록 (보고서에 명시)

보고서에 반드시 아래 형식으로 예상 착지를 기록할 것:

```
## R10 대비 v3 순효과 예측

| 변수 | 방향 | 근거 |
|------|------|------|
| 양자택일(enableEffectMode) | 클리어율 하락 예상 | 공격 외 선택 증가 → 단기 딜 손실 |
| 값비례 수식 | 클리어율 하락 예상 | 기존 hardcode bias 제거 → 효과 선택 감소 |
| 모으기 4.0 배율 (T20) | 클리어율 상승 여지 | (현행 값 확인 후 기재) |
| 연환 상향 (×12/×16) | 클리어율 상승 여지 | 고배율 콤보 빈도 증가 |
| 합산 예측 | 현행 R10 대비 ±3%p 범위 예상 | 수식 교체 순영향 불확실 |
```

---

## DoD 체크리스트

```
[ ] 작업 1: throw 표면화 구현 + throwOnReject.test.ts 1건 PASS
[ ] 작업 2: A안 38.0% ≈ 37.53% 정합 확인 1줄 기록
[ ] 작업 3: 수식 4종 교체 완료 (자양/잔불/채굴/응축)
[ ] 작업 4: A/B 1000판 실행 — 채택률 0%/70%+ 없음 확인
[ ] 작업 5: balance-v3 3000판×3종 실행 완료
[ ] 작업 6: 예상 착지 기록 명시
[ ] vitest 전체 PASS (기존 테스트 회귀 없음)
[ ] tsc --noEmit 0에러
```

---

## 산출물

완료 보고서: `/Users/bilard/.openclaw/workspace/ZERA_BALANCE_V3_RESULT_20260714.md`

---

_발행: 빌라드 ⚔️ — 2026-07-14_
