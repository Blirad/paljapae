/**
 * 팔자전 — 운성패(運星牌) UI 상수 (2단계, 2026-07-23 케일)
 *
 * 리라 스펙 정본: LYRA_PALJAJEON_UNSEONGPAE_STAGE2_UX_SPEC_20260722.md §A
 *
 * 격(Gyeok) 4단 시각 상수 — 수(囚)→휴(休)→상(相)→왕(旺).
 * PassiveSlot.tsx에서 legendary tier 분기에서만 참조.
 * 색상 금지 목록(§A-2)은 주석으로 명시.
 */

import type { Gyeok, UnseongpaeId } from '../engine/unseongpae'
import { UNSEONGPAE_LABEL, ALL_UNSEONGPAE } from '../engine/unseongpae'

// ─────────────────────────────────────────────────────────────────────────────
// 종별 종 심볼 (§A-3 선택 구현)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 배포 확정 종 (지시서 2026-07-23 마감 시퀀스 — 3종 확정)
//   금고(墓地/myoji)는 게이트 미달로 폐기 → UI 전면 제외.
//   엔진 코드는 비활성 보존(식별자·상태·테스트 유지), 렌더 트리에서만 조건부 미표시.
// ─────────────────────────────────────────────────────────────────────────────

/** UI 표시 대상 운성패 종 (금고 제외 — 렌더 트리에서만 숨김). */
export const UNSEONG_HIDDEN_IN_UI: ReadonlySet<string> = new Set(['myoji'])

/** 해당 legendary cardId가 UI에 표시 가능한지 여부 (금고=false). */
export function isUnseongVisible(cardId: string): boolean {
  return !UNSEONG_HIDDEN_IN_UI.has(cardId)
}

/** 운성패 4종 우상단 식별 심볼 (§A-3) */
export const UNSEONG_SYMBOL: Record<string, string> = {
  saengji: '✦',  // 샘솟음
  wangji:  '◆',  // 정점
  myoji:   '▣',  // 창고
  jeolji:  '☒',  // 단절
}

// ─────────────────────────────────────────────────────────────────────────────
// 격별 테두리 (§A-1)
// 금지: #8A7332 계열을 왕격 이상 사용 금지 / rgba(255,255,255,...) 계열 사용 금지
// ─────────────────────────────────────────────────────────────────────────────

/** 격별 테두리 CSS 값 (border shorthand) */
export const UNSEONG_GRADE_BORDER: Record<Gyeok, string> = {
  su:   '1px solid #8A7332',  // 탁한 금 1px — "전설이지만 아직 안 자랐다"
  hyu:  '2px solid #B38A30',
  sang: '2px solid #C9A227',
  wang: '2px solid #F0C64A',  // 가장 밝은 금
}

/** 격별 box-shadow (글로우) */
export const UNSEONG_GRADE_SHADOW: Record<Gyeok, string> = {
  su:   'none',
  hyu:  '0 0 6px 1px rgba(179,138,48,0.35)',
  sang: '0 0 8px 2px rgba(201,162,39,0.45)',
  wang: '0 0 12px 3px rgba(240,198,74,0.60)',  // 왕격 강화 (펄스 애니 별도)
}

// ─────────────────────────────────────────────────────────────────────────────
// 격 배지 (우하단, §A-1)
// ─────────────────────────────────────────────────────────────────────────────

/** 격 배지 배경색 */
export const UNSEONG_GRADE_BADGE_BG: Record<Gyeok, string> = {
  su:   'rgba(138,115,50,0.25)',
  hyu:  'rgba(179,138,48,0.30)',
  sang: 'rgba(201,162,39,0.35)',
  wang: 'rgba(240,198,74,0.45)',
}

/** 격 배지 텍스트 색상 */
export const UNSEONG_GRADE_BADGE_COLOR: Record<Gyeok, string> = {
  su:   '#B39A55',
  hyu:  '#D9A441',
  sang: '#E8C048',
  wang: '#16130F',  // 왕격: 밝은 배지 위 어두운 글자 (§A-1 표 준수)
}

/** 격 배지 짧은 한글 표기 */
export const UNSEONG_GRADE_SHORT: Record<Gyeok, string> = {
  su:   '수',
  hyu:  '휴',
  sang: '상',
  wang: '왕',
}

/** 이름 텍스트 색상 (격이 오를수록 밝아짐) */
export const UNSEONG_GRADE_NAME_COLOR: Record<Gyeok, string> = {
  su:   '#C9A227',  // 기본 금
  hyu:  '#C9A227',
  sang: '#C9A227',
  wang: '#F0C64A',  // 왕격 강조
}

// ─────────────────────────────────────────────────────────────────────────────
// 종별 먹이 라벨 (§B-3 정본 — 임의 변경 금지)
// ─────────────────────────────────────────────────────────────────────────────

/** 종별 먹이 라벨 (게이지 하단 표기) */
export const UNSEONG_FEED_LABEL: Record<string, string> = {
  saengji: '융합 누적',
  wangji:  '동일 융합 반복',
  myoji:   '버리기 누적',
  jeolji:  '전투 승리',
}

/** 종별 문법 한 줄 (정체성 카피, §카피 정본) */
export const UNSEONG_CATCHPHRASE: Record<string, string> = {
  saengji: '생명은 마르지 않는다',
  wangji:  '정점은 지지 않는다',
  myoji:   '죽은 것은 창고에서 기다린다',
  jeolji:  '절처봉생',
}

// ─────────────────────────────────────────────────────────────────────────────
// 종별 이름·한자 (G13 명명 준수 — 반드시 엔진 UNSEONGPAE_LABEL에서 파생)
//   ⛔ 구명칭(생지/왕지/묘지/절지) 하드코딩 금지 (지시서 §2 G13).
//   엔진 라벨 형식 = '장생(長生)' (이름 + 괄호 한자). 아래 파서로 분리.
//   G13 갱신값: saengji='장생(長生)' / wangji='제왕(帝旺)' / myoji='금고(金庫)' / jeolji='환생(還生)'.
// ─────────────────────────────────────────────────────────────────────────────

/** 엔진 라벨 '장생(長生)' → { name: '장생', hanja: '(長生)' } 분리 파서 */
function splitLabel(label: string): { name: string; hanja: string } {
  const m = label.match(/^(.*?)(\([^)]*\))\s*$/)
  if (m) return { name: m[1], hanja: m[2] }
  return { name: label, hanja: '' }
}

/** 종별 이름 (엔진 UNSEONGPAE_LABEL 파생 — G13 개체명 정본, 하드코딩 아님) */
export const UNSEONG_NAME: Record<string, string> = Object.fromEntries(
  ALL_UNSEONGPAE.map((id: UnseongpaeId) => [id, splitLabel(UNSEONGPAE_LABEL[id]).name]),
) as Record<string, string>

/** 종별 한자 보조 표기 (엔진 UNSEONGPAE_LABEL 파생 — G13 개체명 정본) */
export const UNSEONG_HANJA: Record<string, string> = Object.fromEntries(
  ALL_UNSEONGPAE.map((id: UnseongpaeId) => [id, splitLabel(UNSEONGPAE_LABEL[id]).hanja]),
) as Record<string, string>
