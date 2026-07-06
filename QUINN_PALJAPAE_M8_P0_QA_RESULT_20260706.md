# QA 검수 보고서 — 팔자패 M8 P0 카드 비주얼 + 타격감 구현

- 검수 일시: 2026-07-06
- 검수 환경: darwin 25.3.0 / Node.js (CLI 정적 검수)
- Fresh State 초기화: 코드 정적 검수 + CLI 실행 기반. 브라우저 캐시 의존 없음.
- 참조 스펙: LYRA_PALJAPAE_M8_P0_CARD_VISUAL_SPEC_20260706.md
- 케일 보고서: KAIL_PALJAPAE_M8_P0_VISUAL_RESULT_20260706.md

---

## 1. 자동화 검수 결과

### 테스트 회귀 (vitest run)

```
Test Files  19 passed (19)
     Tests  554 passed (554)
  Start at  16:30:36
  Duration  4.64s
```

결과: PASS — 회귀 0건.

### tsc --noEmit

```
출력 없음 (에러 0)
```

결과: PASS — 타입 에러 없음.

### npm run build (gzip)

```
dist/assets/index-DJ47Gp6E.js   518.57 kB │ gzip: 162.26 kB
```

결과: PASS — 172 kB 이하 달성 (여유 9.74 kB).

---

## 2. 코드 정적 검수 결과

### §1 CardArtSVG.tsx — 실루엣 7종 + 선택 로직

**실루엣 7종 존재 여부:**
- ShieldSilhouette (taunt) — 확인
- SpearSilhouette (pierce) — 확인
- PoisonSilhouette (poison) — 확인
- RushSilhouette (rush) — 확인
- TaoistSilhouette (lifesteal) — 확인
- IcebladeSilhouette (freeze) — 확인
- SwordsmanSilhouette (기본 / cost 기반 scale) — 확인

**selectSilhouetteVariant 우선순위:**
taunt → pierce → poison → rush → lifesteal → freeze → swordsman 순서 스펙과 완전 일치.

**props 호환성:**
- `keywords?: string[]` — optional, 기본값 `[]`
- `cost?: number` — optional, 기본값 `3`
- 기존 호출 (keywords/cost 없이 호출) 전부 호환됨.

**실루엣 레이어 순서 (스펙 §1-5):**
배경 그라디언트 → 글로우 오버레이 → 오행 패턴 (opacity 0.7) → SilhouetteLayer → 희귀도 상단 바 — 스펙과 완전 일치.

**spell 카드:** 육각형 마법진 유지 확인. 실루엣 레이어 미적용.

**결정: PASS**

---

### §1 HandCardMini.tsx / FieldUnitCard.tsx

**HandCardMini.tsx:** `keywords={card.cardType === 'soldier' ? card.keywords : []}` 및 `cost={card.cost}` 전달 확인 — 스펙 §1-6과 일치.

**FieldUnitCard.tsx:** `keywords={unit.card.cardType === 'soldier' ? unit.card.keywords : []}` 및 `cost={unit.card.cost}` 전달 확인 — 스펙 §1-6과 일치.

**결정: PASS**

---

### §2 FieldUnitCard.tsx — 공격 돌진 및 피격 shake

**공격 돌진 (스펙 §2-1):**
- 스펙: `x: 16, y: -6, duration: 0.12, ease: 'power3.out'` → 복귀: `x: 0, y: 0, duration: 0.22, ease: 'back.out(1.5)'`
- 구현: L69-70 완전 일치.

**피격 shake (스펙 §2-2):**
- 스펙: -10, +8, -7, +5, -3, 0 (6스텝)
- 구현: L83-88 완전 일치.

**카드 소환 등장 애니메이션 (스펙 §2-4):**
- `useEffect([], [])` — 마운트 1회 CSS animation 적용.
- `cardAppear 0.22s ease-out forwards` — 스펙과 일치.
- 300ms 후 animation 속성 제거 (cleanup 포함) — 스펙과 일치.

**결정: PASS**

---

### §2 DamagePopup.tsx — 상극 연출 분기

**isCrit 분기:** `popup.modifier === 'dominate'` 기반 — 스펙 일치.

**상극 GSAP 시퀀스 (스펙 §2-3):**
- scale 0.5 → 2.6 → 2.2 → 위로 사라짐 (y:-120, scale:0.9, opacity:0)
- 타이밍: 0.12s / 0.08s / '+=0.1' 후 0.75s — 스펙과 완전 일치.

**일반 피해 GSAP:**
- y:-110, scale 1.8 → 0.8, drift ±12px — 스펙과 일치.

**getFontSize:** isCrit 시 `Math.min(56, 40 + value * 2)` — 스펙과 일치.

**getColor:** isCrit 시 `#FF1A1A` — 스펙과 일치.

**textShadow (글로우 강화):** isCrit 시 `0 0 20px ${CC} + 0 0 40px ${66}` 이중 글로우 — 스펙과 일치.

**레이아웃 수평 배치:** flex row, gap:4, alignItems:baseline. 숫자 + 상극!/상생 오른쪽 배치 — 스펙 §2-3 일치.

**fatigue 부호 처리:** `popup.type === 'damage' ? '-' : '+'` — 케일 보고 특이사항 확인. damage 타입만 '-' 처리, 나머지(heal/fatigue) '+' 처리로 통일. 스펙 §2-3 JSX 예시와 일치.

**결정: PASS**

---

### §3 BattleScreen.tsx — ELEMENT_BATTLE_BG 색상

5개 오행 색상값 스펙 §3 완전 대조:

| 오행 | 스펙 | 구현 | 판정 |
|------|------|------|------|
| 木 | `#0E2210 / #071008 55% / #030804` | `#0E2210 / #071008 55% / #030804` | 일치 |
| 火 | `#4A1500 / #200800 50% / #0D0400` | `#4A1500 / #200800 50% / #0D0400` | 일치 |
| 土 | `#201800 / #100E00 55% / #080600` | `#201800 / #100E00 55% / #080600` | 일치 |
| 金 | `#06091A / #030812 55% / #020509` | `#06091A / #030812 55% / #020509` | 일치 |
| 水 | `#040C1C / #020A14 55% / #01060C` | `#040C1C / #020A14 55% / #01060C` | 일치 |

**cardAppear @keyframes:**
- `0%: scale(0.4) translateY(12px) opacity:0`
- `60%: scale(1.12) translateY(-4px) opacity:1`
- `100%: scale(1) translateY(0) opacity:1`
- 구현 L67-71 완전 일치.

**결정: PASS**

---

### §4 AI 영웅 초상화 72px

TopStatusBar.tsx: `size={72}` — 이미 구현됨. 케일 보고와 일치. 스펙 완료 기준 충족.

**결정: PASS**

---

### §5 상극 파티클 (선택적)

케일이 M8 P0에서 포함하지 않기로 결정. 리라 스펙에서 "선택적(optional), 케일 판단으로 포함 여부 결정 가능"으로 명시됨. 이월 허용.

**결정: 해당 없음 (optional 이월)**

---

## 3. 치명적 리스크 점검

### cards.ts 변경 여부

`git status src/game/` — 변경 없음 확인. 게임 로직 테스트 554개 영향 없음.

**결정: PASS**

### 기존 인터페이스 변경으로 인한 호환성

- `CardArtSVG` props에 `keywords?: string[]`, `cost?: number` 추가 — 모두 optional, 기본값 설정됨.
- 기존 호출 코드 (keywords/cost 없이 호출하는 케이스) 전부 호환.
- `types/cards.ts` 변경 없음.

**결정: PASS**

### 변경 파일 범위

변경됨: CardArtSVG.tsx, HandCardMini.tsx, FieldUnitCard.tsx, DamagePopup.tsx, BattleScreen.tsx
변경 없음: cards.ts, types/cards.ts, BattleParticles.tsx, HeroPortraitSVG.tsx

케일 보고와 실제 `git status` 완전 일치.

**결정: PASS**

---

## 통과 항목

- [x] vitest 554/554 PASS — 회귀 0건
- [x] tsc --noEmit 에러 0건
- [x] gzip 162.26 kB (목표 172 kB 이하)
- [x] 실루엣 7종 SVG 구현 완료
- [x] selectSilhouetteVariant 우선순위 스펙 일치
- [x] CardArtSVG props optional 처리 (기존 호출 호환)
- [x] 실루엣 레이어 순서 스펙 §1-5 일치
- [x] 공격 돌진 x:16, y:-6 수치 일치
- [x] 피격 shake ±10px 6스텝 일치
- [x] 카드 등장 cardAppear 0.22s 일치
- [x] DamagePopup 상극 분기 (modifier === 'dominate') 확인
- [x] 상극 펀치인 scale 2.6 → 2.2 → 위로 사라짐 수치 일치
- [x] textShadow 이중 글로우 강화 확인
- [x] 레이아웃 수평 배치 확인
- [x] ELEMENT_BATTLE_BG 5종 색상값 스펙 완전 일치
- [x] cardAppear @keyframes BattleScreen.tsx 추가 확인
- [x] AI 영웅 초상화 72px 기충족 확인
- [x] cards.ts 미변경 확인
- [x] types/cards.ts 미변경 확인

## 실패 항목

없음.

---

## 최종 판정: PASS

CRIT 0건 / MOD 0건 / MINOR 0건.

케일 구현이 리라 스펙 §1~§4 전체 요구사항을 충족한다.
§5 상극 파티클은 스펙에서 선택적으로 지정됐으며, 케일의 이월 결정은 적법하다.
빌에게 M8 P0 비주얼 + 타격감 구현 PASS 보고한다.
