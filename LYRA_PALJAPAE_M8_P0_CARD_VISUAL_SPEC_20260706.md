# 팔자패 M8 P0 카드 비주얼 & 전투 타격감 UX 스펙

작성자: 리라 (Lira)
작성일: 2026-07-06
대상 구현자: 케일 (Kail)
기술 스택: React 18, TypeScript, Tailwind, GSAP (기존 스택 그대로)

---

## 배경

이든(클라이언트) M8 P0 배포 후 두 가지를 요청했다.
1. "카드 이미지 들어가야 한다" — 현재 CardArtSVG는 오행 5종 패턴만 존재. 같은 火 원소 카드가 전부 동일한 불꽃 패턴.
2. "타격감을 줘야 한다" — 공격/피격/카드 사용 시 물리적 임팩트 연출 강화.

목표 수준: Slay the Spire급 퀄리티 (외부 이미지 파일 없이 SVG/CSS/GSAP로 구현)

---

## 와이어프레임

### A. 카드 아트 영역 레이아웃 (현재 vs 변경 후)

```
[현재 HandCardMini — width:80px, height:124px]
┌──────────────────────────┐
│ ● (비용)    🔥 (오행)    │ ← 헤더 24px
├──────────────────────────┤
│                          │
│   [오행 패턴 SVG 60px]   │ ← 아트 영역 60px (변경 대상)
│   (전체 火카드 동일)      │
├──────────────────────────┤
│ 카드명                   │ ← 20px
├──────────────────────────┤
│ 병사  ⊕공격  ⊕체력      │ ← 20px
└──────────────────────────┘

[변경 후 HandCardMini]
┌──────────────────────────┐
│ ● (비용)    🔥 (오행)    │ ← 헤더 24px (변경 없음)
├──────────────────────────┤
│ [오행 배경 패턴]          │
│ [캐릭터 실루엣 SVG 위에]  │ ← 아트 영역 60px (실루엣 레이어 추가)
│ [카드명 기반 해시로 결정] │
├──────────────────────────┤
│ 카드명                   │ ← 변경 없음
├──────────────────────────┤
│ 병사  ⊕공격  ⊕체력      │ ← 변경 없음
└──────────────────────────┘
```

### B. 전투 타격감 연출 시퀀스

```
[공격 시퀀스]
① 플레이어 유닛 카드: X축 -8px 이동 (0.1s) → 0 복귀 (0.15s bounce)
   [현재는 Y축 이동. X축으로 변경 — 횡방향이 "돌진" 느낌에 더 적합]

② 피격 유닛 카드: shake keyframe 2회 반복 (총 0.3s)
   [현재 GSAP timeline shake 존재하지만 진폭이 작음 — 강화]

③ DamagePopup: 현재 scale:1.6 → 0.7, y:-100
   치명/상성 발동 시: scale:2.4 → 0.8, y:-120, 추가 glow 링

[카드 플레이 시퀀스]
HandCardMini에서 FieldUnitCard로 전환 시:
① 손패에서 카드가 사라짐 (기존 동작)
② FieldUnitCard 마운트 시 card-appear 애니메이션 적용 (신규)
   transform: scale(0) → scale(1.15) → scale(1), opacity: 0 → 1
   duration: 0.25s

[데미지 팝업 위치]
치명타/상극 텍스트를 숫자 아래가 아닌 오른쪽으로 배치 (모바일 세로 공간 절약)
```

### C. 전투 배경 오행 연동 (현재 → 목표)

```
현재: ELEMENT_BATTLE_BG 이미 구현됨 (BattleScreen.tsx L73-78)
      단, 강도가 낮아 시각적 차이가 미미함

목표: 배경 그라디언트 채도/대비 강화

火: radial-gradient(ellipse at bottom, #4A1500 0%, #200800 50%, #0D0400 100%)
    [현재 #3A1A0A → #4A1500으로 채도 업]
木: radial-gradient(ellipse at top, #0E2210 0%, #071008 50%, #030804 100%)
金: radial-gradient(ellipse at top right, #060A1A 0%, #030812 50%, #020509 100%)
水: radial-gradient(ellipse at top, #040C1C 0%, #020A14 50%, #01060C 100%)
土: radial-gradient(ellipse at center, #1E1400 0%, #0F0A00 50%, #080602 100%)
```

### D. AI 영웅 초상화 크기 변경

```
현재: width:56px, height:56px (HeroPortraitSVG 내부 또는 TopStatusBar)
목표: width:72px, height:72px
     viewBox 그대로 유지, SVG 크기만 확대
```

---

## 카피 요소

### 신규 추가 없음

이번 변경은 순수 시각/애니메이션 변경이다. 신규 텍스트 카피 없음.

기존 유지:
- DamagePopup: "⚡ 상극!", "🛡 상생", "소진" — 변경 없음
- 치명타 연출에서 신규 텍스트를 추가하지 않음 (숫자 크기와 색상으로만 구분)

---

## 인터랙션 명세

### §1 카드별 고유 실루엣 — CardArtSVG 확장

#### 1-1 설계 결정: artVariant 필드 없음 (cards.ts 변경 불필요)

cards.ts를 읽은 결과, 73장 카드의 기존 필드만으로 아트 분류가 가능하다.
- `element` (5종: 木火土金水)
- `cardType` ('soldier' | 'spell')
- `rarity` (4종: common/uncommon/rare/legendary)
- `keywords` (rush/taunt/poison/lifesteal/freeze/pierce/reborn/incinerate)
- `cost` (1~5)

**결론: cards.ts 변경 불필요. artVariant 필드 추가하지 않는다.**

케일은 cards.ts를 건드리지 않는다. CardArtSVG.tsx 내부에서 props를 조합해 실루엣을 결정한다.

#### 1-2 실루엣 분류 로직

CardArtSVG에 전달되는 props에 `keywords?: Keyword[]`를 추가한다.

```typescript
// CardArtSVG props 변경
interface CardArtSVGProps {
  element: FiveElement
  rarity?: Rarity
  size?: 'mini' | 'field'
  cardType?: 'soldier' | 'spell'
  keywords?: string[]   // 신규 추가 — 실루엣 선택에만 사용
}
```

실루엣 결정 우선순위 (soldier 카드):
1. keywords에 'taunt' 있음 → 방패 실루엣
2. keywords에 'pierce' 있음 → 창 실루엣
3. keywords에 'poison' 있음 → 독침 실루엣
4. keywords에 'rush' 있음 → 달리는 검객 실루엣
5. keywords에 'lifesteal' 있음 → 도사 실루엣
6. keywords에 'freeze' 있음 → 빙검 실루엣
7. keywords 없음 or 기타 → 오행별 기본 검사 실루엣

spell 카드: 기존 육각형 마법진 유지, 오행별 색상만 적용.

#### 1-3 케일이 구현할 실루엣 SVG (7종 × viewBox 0 0 64 58)

**실루엣 A: 방패 (taunt 카드 전용)**
```svg
<!-- 방패 실루엣 — 중앙 하단 배치 -->
<g opacity="0.75">
  <!-- 방패 외형 -->
  <path d="M32 10 L50 18 L50 36 L32 50 L14 36 L14 18 Z"
        fill={accent} fillOpacity="0.25"
        stroke={accent} strokeWidth="1.5" strokeOpacity="0.7"/>
  <!-- 방패 중앙 문양 -->
  <circle cx="32" cy="30" r="6" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.5"/>
  <!-- 방패 상단 볼트 -->
  <circle cx="32" cy="16" r="2.5" fill={accent} fillOpacity="0.6"/>
  <!-- 손잡이 -->
  <rect x="29" y="46" width="6" height="5" rx="2" fill={accent} fillOpacity="0.5"/>
</g>
```

**실루엣 B: 창 (pierce 카드 전용)**
```svg
<!-- 창 실루엣 — 대각선 45도 배치 -->
<g opacity="0.75">
  <!-- 창대 -->
  <line x1="16" y1="50" x2="48" y2="12"
        stroke={accent} strokeWidth="2.5" strokeOpacity="0.7"/>
  <!-- 창날 -->
  <polygon points="48,12 42,18 52,22"
           fill={accent} fillOpacity="0.7"/>
  <!-- 창날 광택 -->
  <line x1="48" y1="12" x2="44" y2="16"
        stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
  <!-- 창끝 장식 -->
  <circle cx="16" cy="50" r="3" fill={accent} fillOpacity="0.4"/>
</g>
```

**실루엣 C: 독침 (poison 카드 전용)**
```svg
<!-- 독침 실루엣 — 곤봉 + 독방울 -->
<g opacity="0.75">
  <!-- 줄기 -->
  <line x1="32" y1="52" x2="32" y2="22"
        stroke={accent} strokeWidth="2" strokeOpacity="0.7"/>
  <!-- 독침 머리 -->
  <path d="M32 14 C26 14 22 18 22 24 C22 32 28 36 32 38 C36 36 42 32 42 24 C42 18 38 14 32 14Z"
        fill={accent} fillOpacity="0.35" stroke={accent} strokeWidth="1" strokeOpacity="0.6"/>
  <!-- 독 방울 3개 -->
  <circle cx="24" cy="30" r="2.5" fill={accent} fillOpacity="0.5"/>
  <circle cx="40" cy="32" r="2" fill={accent} fillOpacity="0.4"/>
  <circle cx="32" cy="44" r="2" fill={accent} fillOpacity="0.35"/>
</g>
```

**실루엣 D: 달리는 검객 (rush 카드 전용)**
```svg
<!-- 달리는 검객 실루엣 — 앞으로 기울어진 자세 -->
<g opacity="0.75">
  <!-- 머리 -->
  <circle cx="38" cy="16" r="5" fill={accent} fillOpacity="0.5"/>
  <!-- 몸통 — 앞으로 기울어짐 -->
  <line x1="38" y1="21" x2="28" y2="36"
        stroke={accent} strokeWidth="3" strokeOpacity="0.6"/>
  <!-- 앞발 -->
  <line x1="28" y1="36" x2="18" y2="50"
        stroke={accent} strokeWidth="2" strokeOpacity="0.55"/>
  <!-- 뒷발 -->
  <line x1="28" y1="36" x2="36" y2="50"
        stroke={accent} strokeWidth="2" strokeOpacity="0.45"/>
  <!-- 칼 — 앞으로 뻗음 -->
  <line x1="38" y1="21" x2="52" y2="28"
        stroke={accent} strokeWidth="2.5" strokeOpacity="0.7"/>
  <polygon points="52,28 48,24 56,22"
           fill={accent} fillOpacity="0.65"/>
</g>
```

**실루엣 E: 도사 (lifesteal 카드 전용)**
```svg
<!-- 도사 실루엣 — 명상 자세 -->
<g opacity="0.75">
  <!-- 머리 -->
  <circle cx="32" cy="15" r="5" fill={accent} fillOpacity="0.5"/>
  <!-- 몸통 -->
  <path d="M26 22 Q32 20 38 22 L40 40 L24 40 Z"
        fill={accent} fillOpacity="0.35"/>
  <!-- 양팔 수평으로 펼침 -->
  <line x1="26" y1="28" x2="14" y2="26"
        stroke={accent} strokeWidth="2" strokeOpacity="0.55"/>
  <line x1="38" y1="28" x2="50" y2="26"
        stroke={accent} strokeWidth="2" strokeOpacity="0.55"/>
  <!-- 발 — 가부좌 -->
  <ellipse cx="27" cy="44" rx="5" ry="3" fill={accent} fillOpacity="0.3"/>
  <ellipse cx="37" cy="44" rx="5" ry="3" fill={accent} fillOpacity="0.3"/>
  <!-- 기운 원 -->
  <circle cx="32" cy="30" r="10" fill="none"
          stroke={accent} strokeWidth="0.8" strokeOpacity="0.3"
          strokeDasharray="3 2"/>
</g>
```

**실루엣 F: 빙검 (freeze 카드 전용)**
```svg
<!-- 빙검 실루엣 — 수직 검 + 얼음 결정 -->
<g opacity="0.75">
  <!-- 검 날 -->
  <polygon points="32,8 36,38 32,44 28,38"
           fill={accent} fillOpacity="0.45"/>
  <!-- 검 광택 -->
  <polygon points="32,8 34,24 32,28 31,24"
           fill="white" fillOpacity="0.25"/>
  <!-- 검 가드 -->
  <rect x="20" y="36" width="24" height="4" rx="2"
        fill={accent} fillOpacity="0.6"/>
  <!-- 얼음 결정 — 검 주변 3개 -->
  <polygon points="20,20 22,16 18,16" fill={accent} fillOpacity="0.5"/>
  <polygon points="44,24 46,20 42,20" fill={accent} fillOpacity="0.4"/>
  <polygon points="14,32 16,28 12,28" fill={accent} fillOpacity="0.35"/>
</g>
```

**실루엣 G: 오행 기본 검사 (키워드 없음 — cost 기반 크기 변화)**
```svg
<!-- 기본 검사 실루엣 — cost가 높을수록 더 크고 강인한 자세 -->
<!-- cost 1-2: 소형 (scale 0.8) -->
<!-- cost 3: 중형 (scale 1.0) -->
<!-- cost 4-5: 대형 (scale 1.2) -->
<g opacity="0.75" transform={`scale(${costScale}) translate(${translateOffset})`}>
  <!-- 머리 -->
  <circle cx="32" cy="14" r="5" fill={accent} fillOpacity="0.5"/>
  <!-- 몸통 — 직립 자세 -->
  <line x1="32" y1="19" x2="32" y2="38"
        stroke={accent} strokeWidth="2.5" strokeOpacity="0.6"/>
  <!-- 양팔 — 검 들고 있음 -->
  <line x1="32" y1="24" x2="20" y2="32"
        stroke={accent} strokeWidth="2" strokeOpacity="0.5"/>
  <line x1="32" y1="24" x2="44" y2="22"
        stroke={accent} strokeWidth="2" strokeOpacity="0.5"/>
  <!-- 검 -->
  <line x1="44" y1="22" x2="52" y2="12"
        stroke={accent} strokeWidth="2" strokeOpacity="0.7"/>
  <polygon points="52,12 49,16 55,16"
           fill={accent} fillOpacity="0.65"/>
  <!-- 다리 -->
  <line x1="32" y1="38" x2="24" y2="52"
        stroke={accent} strokeWidth="2" strokeOpacity="0.5"/>
  <line x1="32" y1="38" x2="40" y2="52"
        stroke={accent} strokeWidth="2" strokeOpacity="0.5"/>
</g>
```

cost 기반 transform 계산:
```typescript
const costScale = cost <= 2 ? 0.82 : cost >= 4 ? 1.1 : 1.0
const translateOffset = cost <= 2
  ? '8 5'    // 소형: 중앙 정렬 보정
  : cost >= 4
  ? '-3 -4'  // 대형: 중앙 정렬 보정
  : '0 0'
```

#### 1-4 CardArtSVG 실루엣 선택 함수 (케일 구현용 의사코드)

```typescript
function selectSilhouetteVariant(
  keywords: string[],
  cost: number,
): 'shield' | 'spear' | 'poison' | 'rush' | 'taoist' | 'iceblade' | 'swordsman' {
  if (keywords.includes('taunt'))     return 'shield'
  if (keywords.includes('pierce'))    return 'spear'
  if (keywords.includes('poison'))    return 'poison'
  if (keywords.includes('rush'))      return 'rush'
  if (keywords.includes('lifesteal')) return 'taoist'
  if (keywords.includes('freeze'))    return 'iceblade'
  return 'swordsman'  // cost 기반 스케일 적용
}
```

#### 1-5 실루엣 레이어 렌더링 순서

```
1. 배경 그라디언트 (기존 grad-{element})
2. 글로우 오버레이 (기존)
3. 오행 패턴 (기존 WoodPattern / FirePattern 등) — 채도 약간 낮춤 (fillOpacity 0.15 감소)
4. 실루엣 SVG (신규) — 오행 패턴 위에 렌더링
5. 희귀도 상단 바 (기존)
```

#### 1-6 HandCardMini 및 FieldUnitCard 변경

HandCardMini.tsx (L187):
```tsx
<CardArtSVG
  element={element}
  rarity={card.rarity}
  size="mini"
  cardType={card.cardType}
  keywords={card.cardType === 'soldier' ? card.keywords : []}  // 신규
/>
```

FieldUnitCard.tsx (L156):
```tsx
<CardArtSVG
  element={element}
  rarity={unit.card.rarity}
  size="field"
  cardType={unit.card.cardType}
  keywords={unit.card.cardType === 'soldier' ? unit.card.keywords : []}  // 신규
/>
```

---

### §2 전투 타격감 애니메이션

#### 2-1 공격 돌진 애니메이션 — FieldUnitCard.tsx 수정

**현재 구현** (FieldUnitCard.tsx L57-59):
```typescript
gsap.timeline()
  .to(el, { y: -20, duration: 0.15 })    // 위로 이동
  .to(el, { y: 0, duration: 0.25, ease: 'bounce.out' })
```

**변경 후**: 적 방향(오른쪽)으로 돌진 후 복귀
```typescript
// side === 'player' 유닛이 공격 시 (오른쪽으로 돌진)
gsap.timeline()
  .to(el, { x: 16, y: -6, duration: 0.12, ease: 'power3.out' })
  .to(el, { x: 0, y: 0, duration: 0.22, ease: 'back.out(1.5)' })
```

#### 2-2 피격 shake 애니메이션 강화 — FieldUnitCard.tsx 수정

**현재 구현** (FieldUnitCard.tsx L71-75): 진폭 ±6px, 4스텝, 총 0.2s

**변경 후**: 진폭 ±10px, 6스텝, 총 0.35s, 첫 스텝 강조
```typescript
gsap.timeline()
  .to(el, { x: -10, duration: 0.05, ease: 'power2.out' })
  .to(el, { x: 8, duration: 0.06 })
  .to(el, { x: -7, duration: 0.06 })
  .to(el, { x: 5, duration: 0.06 })
  .to(el, { x: -3, duration: 0.06 })
  .to(el, { x: 0, duration: 0.06, ease: 'power2.out' })
```

#### 2-3 DamagePopup 개선 — DamagePopup.tsx 수정

**현재**: 단순 위로 float + fade out. 치명/상성 구분 없음.

**변경 후 — 일반 피해**:
```typescript
gsap.fromTo(
  el,
  { y: 0, x: xOffset.current, scale: 1.8, opacity: 1 },
  { y: -110, x: xOffset.current + (Math.random() - 0.5) * 24,
    scale: 0.8, opacity: 0, duration: 0.85, ease: 'power2.out' },
)
```

**변경 후 — 상극(dominate) 발동 시**: popup.modifier === 'dominate'
```typescript
// 1. 먼저 크게 펀치인
gsap.timeline()
  .fromTo(el,
    { scale: 0.5, opacity: 0 },
    { scale: 2.6, opacity: 1, duration: 0.12, ease: 'power3.out' }
  )
  .to(el, { scale: 2.2, duration: 0.08 })   // 약간 눌림
  .to(el,
    { y: -120, x: xOffset.current + (Math.random() - 0.5) * 20,
      scale: 0.9, opacity: 0, duration: 0.75, ease: 'power1.in' },
    '+=0.1'
  )
```

**변경 후 — 색상 및 크기 기준**:
```typescript
function getFontSize(value: number, isCrit: boolean): number {
  if (isCrit) return Math.min(56, 40 + value * 2)
  if (value >= 7) return 48
  if (value >= 4) return 40
  return 32
}

function getColor(type: DamagePopupData['type'], value: number, isCrit: boolean): string {
  if (type === 'heal')    return '#4ADE80'
  if (type === 'fatigue') return '#F59E0B'
  if (isCrit)             return '#FF1A1A'   // 상극: 더 진한 빨강
  if (value >= 7)         return '#EF4444'
  if (value >= 4)         return '#FCA5A5'
  return '#FFB3B3'
}
```

**변경 후 — textShadow (상극 시 글로우 강화)**:
```typescript
const isCrit = popup.modifier === 'dominate'
const shadowColor = isCrit ? '#FF0000' : color
const textShadow = isCrit
  ? `0 2px 12px rgba(0,0,0,0.9), 0 0 20px ${shadowColor}CC, 0 0 40px ${shadowColor}66`
  : `0 2px 8px rgba(0,0,0,0.8), 0 0 12px ${shadowColor}80`
```

**변경 후 — 치명타 레이블 레이아웃**:
현재 세로 배치 → 오른쪽 배치로 변경 (모바일 공간 절약):
```tsx
<div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
  <span>{popup.type === 'damage' ? '-' : '+'}{popup.value}</span>
  {popup.modifier === 'dominate' && (
    <span style={{ fontSize: 12, color: '#FF3333', fontWeight: 700 }}>상극!</span>
  )}
  {popup.modifier === 'generate_defense' && (
    <span style={{ fontSize: 12, color: '#44CC66' }}>상생</span>
  )}
</div>
{popup.type === 'fatigue' && (
  <div style={{ fontSize: 11, color: '#FF8800', textAlign: 'center' }}>소진</div>
)}
```

#### 2-4 카드 소환 시 FieldUnitCard 등장 애니메이션 (신규)

**구현 위치**: BattleScreen.tsx GLOBAL_STYLES + FieldUnitCard.tsx

BattleScreen.tsx의 GLOBAL_STYLES에 추가:
```css
@keyframes cardAppear {
  0%   { transform: scale(0.4) translateY(12px); opacity: 0; }
  60%  { transform: scale(1.12) translateY(-4px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
```

FieldUnitCard.tsx에서 마운트 시 1회 실행:
```typescript
// useEffect 내부 — cardRef 마운트 후 1회만
useEffect(() => {
  const el = cardRef.current
  if (!el) return
  el.style.animation = 'cardAppear 0.22s ease-out forwards'
  const timer = setTimeout(() => {
    if (el) el.style.animation = ''
  }, 300)
  return () => clearTimeout(timer)
}, [])   // 빈 배열 — 마운트 시 1회만
```

주의: 기존 테스트에서 FieldUnitCard를 직접 마운트하는 케이스가 있을 수 있으므로,
애니메이션은 CSS animation 속성으로 처리 (GSAP 사용하지 않음 — GSAP는 타이밍 이슈 있을 수 있음).

---

### §3 전투 배경 오행 연동 강화

**구현 위치**: BattleScreen.tsx L73-78 (ELEMENT_BATTLE_BG 객체)

**현재 값 → 변경 값**:

```typescript
const ELEMENT_BATTLE_BG: Record<string, string> = {
  // 현재 → 변경 (채도/대비 강화)
  '木': 'radial-gradient(ellipse at top, #0E2210 0%, #071008 55%, #030804 100%)',
  // 현재: #1A2E1A → #0A1208 → 변경: #0E2210 → #071008 → #030804 (더 깊은 어둠, 상단 녹색 포인트 강화)

  '火': 'radial-gradient(ellipse at bottom, #4A1500 0%, #200800 50%, #0D0400 100%)',
  // 현재: #3A1A0A → #1A0A04 → 변경: #4A1500 → #200800 → #0D0400 (붉은 열기 강화)

  '土': 'radial-gradient(ellipse at center, #201800 0%, #100E00 55%, #080600 100%)',
  // 현재: #2A1E0A → #1A1408 → 변경: #201800 → #100E00 → #080600 (황금빛 토색 강화)

  '金': 'radial-gradient(ellipse at top right, #06091A 0%, #030812 55%, #020509 100%)',
  // 현재: #0A1022 → #060C1A → 변경: #06091A → #030812 → #020509 (더 차가운 청금색)

  '水': 'radial-gradient(ellipse at top, #040C1C 0%, #020A14 55%, #01060C 100%)',
  // 현재: #060E1E → #041018 → 변경: #040C1C → #020A14 → #01060C (더 깊은 심해)
}
```

변경 범위: BattleScreen.tsx 1개 파일, 5개 색상값. 로직 변경 없음.

---

### §4 AI 영웅 초상화 크기 개선

**확인 필요**: `HeroPortraitSVG` 파일 위치를 케일이 확인할 것.
아래 경로 중 하나에 존재할 가능성이 높음:
- `/src/components/battle/HeroPortraitSVG.tsx`
- `/src/components/battle/TopStatusBar.tsx` 내부 인라인

**변경 내용**:
AI 영웅 초상화 컨테이너의 width/height를 56px → 72px로 변경.
SVG viewBox는 그대로 유지하고 width/height 속성만 변경.

**인터랙션**: 크기 변경 외 없음. 호버/클릭 없음.

**주의**: TopStatusBar 레이아웃에서 AI 영웅 초상화 영역이 커지면 양옆 HP/에너지 수치 표시가 밀릴 수 있음. 케일은 TopStatusBar 레이아웃 충돌 여부를 확인 후 필요 시 flex 조정.

---

### §5 BattleParticles — 상극 발동 시 추가 파티클

**현재**: BattleParticles.emit()은 카드 소환 시에만 호출됨.

**변경**: DamagePopup이 `modifier === 'dominate'`일 때 파티클을 추가로 방출.

BattleScreen.tsx의 damagePopups 처리 부분에서:
```typescript
// damagePopups 렌더링 직전 또는 useEffect 내부
// popup.modifier === 'dominate'이고 첫 마운트 시:
// particlesRef.current?.emit(popup.x 좌표, popup.y 좌표, element, 12)
```

단, BattleScreen에서 popup.x/y는 % 값이므로 px 변환 필요:
```typescript
const pxX = (popup.x / 100) * window.innerWidth
const pxY = (popup.y / 100) * window.innerHeight
particlesRef.current?.emit(pxX, pxY, player.hero.element, 14)
```

이 변경은 선택적(optional)이다. 케일 판단으로 M8 P0에 포함 여부 결정 가능.

---

## 구현 가능성 검토

### 기술 스택 확인 결과

| 항목 | 사용 기술 | 케일 구현 가능 여부 |
|------|-----------|---------------------|
| 실루엣 SVG (7종) | 순수 SVG path/line/polygon | 가능 — 좌표값 이 스펙에 포함됨 |
| 실루엣 선택 로직 | TypeScript 함수 | 가능 — 의사코드 이 스펙에 포함됨 |
| 공격 돌진 애니메이션 | GSAP (이미 사용 중) | 가능 — 기존 코드 수정 |
| 피격 shake 강화 | GSAP (이미 사용 중) | 가능 — 기존 코드 수정 |
| DamagePopup 개선 | GSAP + inline style | 가능 — 기존 컴포넌트 수정 |
| 카드 등장 애니메이션 | CSS @keyframes | 가능 — GLOBAL_STYLES에 추가 |
| 전투 배경 강화 | CSS gradient (기존 객체 수정) | 가능 — 색상값 교체만 |
| AI 영웅 크기 조정 | width/height 속성 변경 | 가능 — 레이아웃 충돌 확인 필요 |
| 상극 파티클 | BattleParticles.emit() (기존 API) | 가능 — 선택적 |

### 구현 불가 요소 (제거/대체)

| 불가 항목 | 이유 | 대안 |
|-----------|------|------|
| 카드별 개별 캐릭터 일러스트 (73장 각각) | SVG 코딩 공수 과다 | 키워드 기반 7종 실루엣으로 대체 |
| 외부 이미지 파일 로드 | 이든 지시: 외부 이미지 없이 구현 | SVG inline으로 구현 |
| GSAP flip 플러그인 | 미설치 | CSS animation으로 대체 |
| 3D 원근감 카드 뒤집기 | CSS perspective 필요, 모바일 성능 이슈 | 2D scale 애니메이션으로 대체 |

### 번들 크기 예측

현재: 161.98kB (gzip)
추가 예상:
- CardArtSVG 실루엣 7종: SVG path 문자열 약 2.5KB (gzip 약 1.2KB)
- 애니메이션 CSS: 약 0.5KB
- DamagePopup 로직 추가: 약 0.3KB
합계 추가: 약 +2KB (gzip) → **목표 172kB 이내 충분히 달성**

### 기존 테스트(554개) 회귀 위험

| 변경 파일 | 테스트 영향 | 위험도 |
|-----------|-------------|--------|
| CardArtSVG.tsx | props에 keywords 추가 (optional, 기본값 []) — 기존 호출 전부 호환 | 낮음 |
| HandCardMini.tsx | keywords prop 전달 추가 — 렌더링 변경 없음 | 낮음 |
| FieldUnitCard.tsx | GSAP 수치 변경 + useEffect 추가 — DOM 구조 변경 없음 | 낮음 |
| DamagePopup.tsx | GSAP 수치 변경, JSX 구조 소폭 변경 | 낮음 |
| BattleScreen.tsx | 색상값 교체 + CSS 추가 — 로직 변경 없음 | 없음 |
| cards.ts | 변경 없음 | 없음 |

**cards.ts 변경 없음 = 게임 로직 테스트 전혀 영향 없음.**

---

## 변경 대상 파일 목록 (케일 착수 순서)

1. **CardArtSVG.tsx** — keywords prop 추가, 실루엣 7종 SVG 추가, 레이어 순서 조정
2. **HandCardMini.tsx** — CardArtSVG 호출 시 keywords prop 전달
3. **FieldUnitCard.tsx** — CardArtSVG keywords prop 전달, GSAP 애니메이션 수치 변경, 등장 애니메이션 useEffect 추가
4. **DamagePopup.tsx** — GSAP 애니메이션 변경, 상극 연출 강화, JSX 레이아웃 소폭 변경
5. **BattleScreen.tsx** — ELEMENT_BATTLE_BG 색상값 교체, GLOBAL_STYLES에 cardAppear 추가, 상극 파티클 emit (선택)
6. **HeroPortraitSVG.tsx 또는 TopStatusBar.tsx** — AI 영웅 크기 56px → 72px

변경 없는 파일: `cards.ts`, `types/cards.ts`, `BattleParticles.tsx`

---

## 완료 기준 (케일 구현 완료 판단 기준)

- [ ] 같은 오행의 카드라도 keywords가 다르면 서로 다른 실루엣이 보인다
- [ ] 플레이어 유닛 공격 클릭 시 오른쪽으로 돌진 후 복귀 애니메이션이 보인다
- [ ] 피격 유닛 흔들림 진폭이 이전보다 뚜렷하다
- [ ] 상극 데미지 팝업이 일반 팝업보다 크고 붉게 표시된다
- [ ] 카드 소환 시 FieldUnitCard가 튀어오르며 등장한다
- [ ] 火 전투 배경이 이전보다 더 붉고 어둡게 보인다
- [ ] AI 영웅 초상화가 72px로 표시된다
- [ ] `npm run build` 통과, gzip 172kB 이내
- [ ] 기존 테스트 554개 전부 통과 (cards.ts 미변경이므로 게임 로직 테스트는 안전)
