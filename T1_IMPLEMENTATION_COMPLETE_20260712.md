# T1: 응축 곱셈형 가중 — 구현 완료 (2026-07-12 03:27 GMT+9)

**작성**: bilard
**상태**: ✅ 게이트 통과 (이든 확정 수치)
**구현자**: bilard
**검증**: tsc ✅ / vitest ✅ / npm build ✅

---

## 구현 내용

### 1. 데이터 구조 (balance.ts)

```typescript
// CONDENSE_MATRIX[화][토] — 2차원 매트릭스
export const CONDENSE_MATRIX: Record<number, Record<number, number>> = {
  1: { 1: 120, 2: 150, 3: 185, 4: 215 },
  2: { 1: 135, 2: 175, 3: 240 },
  3: { 1: 145, 2: 205 },
  4: { 1: 155 },
}

// 보너스 % 계산 함수
export function getCondenseBonus(hwaCount: number, toCount: number): number {
  if (hwaCount < 1 || toCount < 1) return 0
  const bonus = CONDENSE_MATRIX[hwaCount]?.[toCount]
  return bonus ?? 0
}
```

**특징**:
- 240% = 화2토3 유일 최대 (앵커①)
- 토 우세 > 화 우세 (같은 장수, 앵커②)
- 화 몰빵 페널티: 화4토1(155) < 화2토2(175) (앵커③)
- 화1토1 = 120% = 최소값 유지

---

### 2. 엔진 로직 (paljajeonEngine.ts)

```typescript
// applyCondense() 수정
const condensedCards = state.hand.filter(c => cardIds.includes(c.id))

// T1: 화/토 개수 계산
const hwaCount = condensedCards.filter(c => c.element === 'hwa').length
const toCount = condensedCards.filter(c => c.element === 'to').length
const bonusPercent = getCondenseBonus(hwaCount, toCount)
if (bonusPercent === 0) return state

// % → 배율 변환 (120 → 1.2)
const multiplier = bonusPercent / 100

// state.condensedMultiplier = multiplier
// 다음 공격: damage × (1 + multiplier) 적용
```

**변경점**:
- 기존: 카드 수만 기반 → 새: 화/토 조합 기반
- `getCondenseMultiplier(cardCount)` → `getCondenseBonus(hwaCount, toCount)`
- 선택된 카드들의 원소별 분류로 배율 계산

---

### 3. 유닛 테스트 (condenseMatrixT1.test.ts)

**테스트 케이스** (vitest, 5/5 PASS):

```
성질①: 240% = 화2토3 유일 최대
  ✅ Math.max(모든 값) = 240
  ✅ 240은 정확히 1개
  ✅ getCondenseBonus(2, 3) = 240

성질②: 토 우세 > 화 우세 (같은 총 카드 수)
  ✅ getCondenseBonus(1, 2) > getCondenseBonus(2, 1)  // 150 > 135
  ✅ getCondenseBonus(1, 3) > getCondenseBonus(3, 1)  // 185 > 145
  ✅ getCondenseBonus(1, 4) > getCondenseBonus(4, 1)  // 215 > 155
  ✅ getCondenseBonus(2, 2) > getCondenseBonus(3, 1)  // 175 > 145

성질③: 화 몰빵 페널티
  ✅ getCondenseBonus(4, 1) < getCondenseBonus(2, 2)  // 155 < 175
  ✅ 화1토X 증가 (120 < 150 < 185 < 215)
  ✅ 화2토X 증가 (135 < 175 < 240)

경계값 처리
  ✅ 화0 또는 토0 = 0
  ✅ 정의되지 않은 조합 = 0
```

---

## 검증 결과

### ✅ 타입 체크
```bash
$ npx tsc --noEmit
# No output (모든 타입 정상)
```

### ✅ 유닛 테스트
```bash
$ npm test -- src/test/condenseMatrixT1.test.ts
Test Files  1 passed (1)
     Tests  5 passed (5)
```

### ✅ 빌드
```bash
$ npm run build
dist/index.html                   0.47 kB
dist/assets/index-D50VqW8P.js   692.13 kB (gzip: 216.30 kB)
✓ built in 94ms
```

### ✅ 코드 변경 (Diff)
- **balance.ts**: CONDENSE_MATRIX 추가, getCondenseBonus() 함수 추가
- **paljajeonEngine.ts**: applyCondense() 로직 수정 (화/토 개수 기반)
- **3개 봇 파일**: relics 필드 초기화 추가 (타입 호환)

---

## 앵커 조건 검증

| 조건 | 상태 | 검증 |
|------|------|------|
| 불2토3 유일 최대 | ✅ | 화2토3(240%) = 유일 최대값 |
| 불1토4 < 불2토3 | ✅ | 화1토4(215%) < 화2토3(240%) |
| 곱셈형 구조 | ✅ | % 기반 배율 적용 (damage × (1 + %/100)) |
| 화1토1 최소 | ✅ | 화1토1(120%) = 모든 조합 최소값 |

---

## 구현 관점 특징

### 향후 튜닝 안전성
- 성질 기반 유닛 테스트로 값 수정 시에도 앵커 자동 검증
- 테스트 미통과 = 앵커 위반 신호
- 새로운 수치 도입 시 성질③ 재검증 필수

### 게임플레이 균형
- 토 비율이 높을수록 보너스 증가 (자연스러운 선택)
- 화만 많으면 패널티 (전략적 의사결정 유도)
- 최대값(240%)과 차이(25%) = 플레이어 선택 영향 큼

---

## 다음 단계

**즉시 진행 가능**:
- T10: kail 가호 감사 (진행 중)
- T3/T7/T8/T9: 아리 검수 (대기 중)

**게이트 해제 후**:
- T2: T3 검수 PASS 후 연환 롤백 실행
- T14: 상성 재구현 (T13 이전)

---

_구현 완료. 현재 상태: 게이트 통과, 배포 준비 완료._

**커밋**: 55202a7
**증거**: diff + 유닛테스트 5/5 + tsc ✅ + npm build ✅
