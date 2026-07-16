# ZERA 산출물 — 프로토 빌드 결과 (2026-07-16)

## 빌드 개요

| 항목 | 값 |
|-----|-----|
| 프로토 빌드 커밋 | `dd38e52` |
| 빌드일 | 2026-07-16 |
| tsc 에러 | **0** |
| 전체 테스트 | 577 PASS / 592 실행 (15 FAIL — 전량 기존 실패, 신규 실패 0) |
| 로컬 build | **성공** (npm run build, 에러 없음) |

---

## 구현 항목별 증거

### (a) comboRuleset 스위치 + ENABLE_YONGSIN_DESCENT 토글

**신규 파일**: `paljapae/src/engine/devSettings.ts`

- `getDevComboRuleset()`: LocalStorage `paljajeon_dev_ruleset` 값 반환 (기본: `'v3'`)
- `setDevComboRuleset(ruleset)`: `'v3'` | `'recipe'` 전환
- `getDevDescentEnabled()`: LocalStorage `paljajeon_dev_descent` 값 반환 (기본: `false`)
- `setDevDescentEnabled(enabled)`: `true` | `false` 전환
- URL 쿼리 파라미터 지원: `?ruleset=recipe&descent=true`
- `getDevSettingsSummary()`: 현재 설정 요약 반환 (지문용)

```
스위치 위치: paljapae/src/engine/devSettings.ts
localStorage key: paljajeon_dev_ruleset / paljajeon_dev_descent
기본값: 'v3' / false
```

---

### (b) 내비게이터 간이판

**신규 파일**: `paljapae/src/components/RecipeNavigator.tsx`

- 현재 핸드에서 성립 레시피 목록 표시 (소형/대형 구분)
- "1장 차이" 레시피 최대 1건 표시 (소형 우선)
- recipe 모드 한정 렌더링 (`getDevComboRuleset() === 'recipe'` 조건)
- BattleScreen 버리기·공격 버튼 영역에 절대 위치로 통합

```
통합 위치: BattleScreen.tsx (버리기·공격 버튼 상단 absolute 배치)
조건: getDevComboRuleset() === 'recipe' 시만 렌더링
```

---

### (c) 한글명 반영

**수정 파일**: `paljapae/src/components/BattleScreen.tsx`

- `RECIPE_KO_NAMES` 매핑 테이블 추가 (발주서 2-c 정본 명명)
- `resolveComboKoName(comboName)` 함수: recipe ID → 한글명 변환
- 분해식 표시 (`line1`)에서 `comboDisplayName` 사용

| 레시피 ID | 한글명 (낳는/연료) |
|----------|----------------|
| fusion_forest | 숲 |
| fusion_spring | 샘 |
| fusion_mine | 광맥 |
| fusion_kiln | 옹기가마 |
| fusion_wildfire | 들불 |

| 레시피 ID | 한글명 (벼리는/촉매) |
|----------|--------------------|
| fusion_keen | 벼림 |
| fusion_harvest | 개간 |
| fusion_pierce | 제방 |
| fusion_snipe | 담금질 |
| fusion_temper | 주물 |

```
적용 함수: resolveComboKoName() → buildPreviewText() 내 line1 표시
v3 모드: 기존 한글 이름(들불, 광맥 등) 그대로 통과 (영향 없음)
```

---

### (d) 강림 최소판

**신규 파일**: `paljapae/src/components/YongsinDescentBanner.tsx`

- `YongsinDescentBanner` 컴포넌트: descentEnabled=true 시만 렌더링
- 풀강림 (슬롯 도래 + pendingDescent=true): "용신 강림" + `×1.8` 서브텍스트 + 펄스 애니메이션
- 잔광 (대기창 만료): "잔광이 남는다" + `×1.25` 서브텍스트
- BattleScreen 버리기·공격 버튼 영역 상단에 absolute 배치
- `DESCENT_GLOW_FULL_MULT = 1.8`, `DESCENT_GLOW_AFTERGLOW_MULT = 1.25` (balance.ts 상수 참조)

```
통합 위치: BattleScreen.tsx (버리기·공격 버튼 영역 상단 absolute)
조건: getDevDescentEnabled()=true 시만 렌더링
```

---

### (e) 프로덕션 기본값

| 설정 | 값 | 위치 |
|-----|-----|-----|
| COMBO_RULESET_VERSION | `'v3'` | balance.ts:641 |
| ENABLE_YONGSIN_DESCENT | `false` | balance.ts:649 |
| comboRuleset (런타임) | `'v3'` (LocalStorage 없을 때 기본) | devSettings.ts |
| descentEnabled (런타임) | `false` (LocalStorage 없을 때 기본) | devSettings.ts |

배포 기본 상태: v3·강림OFF. 스위치로만 recipe·강림ON 전환.

---

## 추가 수정 사항 (기존 빌드 에러 해소)

| 파일 | 수정 내용 |
|-----|---------|
| `paljajeonEngine.ts` | `DESCENT_DUAL_SLOT_MULT`, `DESCENT_DUAL_NONSLOT_MULT`, `DESCENT_WAIT_WINDOW` 삭제 상수를 로컬 상수로 대체. `waitWindowRemaining` TS18048 에러 수정 (`??` nullable 처리). |
| `pokerHandJudge.ts` | `RECIPE_LARGE_BIRTH_MULT`, `RECIPE_LARGE_HONE_MULT` 미사용 import 제거 (TS6133). |

---

## 테스트 결과

```
전체: 592 테스트 실행
PASS: 577
FAIL: 15 (전량 기존 실패 — phase1p9_qa/pokerHandJudge/batch1 등 구버전 배율 기준)
신규 실패: 0
tsc --noEmit: 0 에러
npm run build: 0 에러
```

기존 실패 테스트 (대표 사례):
- `phase1p9_qa.test.ts`: 4장 모으기 ×3.5 기대 → 현재 ×4.0 (balance.ts 갱신 후 구버전 기대값)
- `pokerHandJudge.test.ts`: 4장 ×3.5 동일 구버전 기대값
- `batch1AbTest.test.ts`, `batch1EffectChoice.test.ts`: 기존 게이트 기준 불일치

---

## 코드 지문 6줄

```
[1] 프로토 빌드 커밋: dd38e52
[2] COMBO_RULESET_VERSION = 'v3'  (balance.ts:641, 기본값)
[3] ENABLE_YONGSIN_DESCENT = false (balance.ts:649, 기본값)
[4] 스위치 위치: paljapae/src/engine/devSettings.ts (LocalStorage/URL 쿼리)
[5] 한글명 매핑: RECIPE_KO_NAMES (BattleScreen.tsx) — 숲/샘/광맥/옹기가마/들불/벼림/개간/제방/담금질/주물
[6] tsc 0에러 / build 성공 / 신규 테스트 실패 0
```

---

## 배포 안내 (빌라드 전달용)

- 로컬 빌드: `paljapae/dist/` 디렉토리에 생성 완료
- Vercel 배포: 빌라드가 맥미니 터미널에서 직접 실행 (발주서 절대 준수 사항)
- quinn 스팟: 배포 후 이든 3판 플레이 → recipe/강림 스위치 전환 확인
