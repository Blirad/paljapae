/**
 * 팔자전 — 개발자 설정 (devSettings.ts)
 * 프로토 빌드용 런타임 스위치
 *
 * 발주서 작업 2-a:
 *   - comboRuleset: 'v3' | 'recipe'  (기본값: 'v3')
 *   - descentEnabled: boolean          (기본값: false)
 *
 * 프로덕션 기본값: v3 + 강림 OFF (발주서 작업 2-e)
 * 개발자가 localStorage 또는 URL 쿼리로 전환 가능.
 *
 * 사용법:
 *   localStorage.setItem('paljajeon_dev_ruleset', 'recipe')  → recipe 모드 활성
 *   localStorage.setItem('paljajeon_dev_descent', 'true')    → 강림 활성
 *   URL: ?ruleset=recipe&descent=true                        → 즉시 전환
 *
 * 읽기: getDevComboRuleset(), getDevDescentEnabled()
 * 쓰기: setDevComboRuleset(), setDevDescentEnabled()
 */

const LS_RULESET_KEY = 'paljajeon_dev_ruleset'
const LS_DESCENT_KEY = 'paljajeon_dev_descent'

type ComboRuleset = 'v3' | 'recipe'

/** URL 쿼리 파라미터에서 개발 설정 읽기 (최초 로드 시 한 번만) */
function applyUrlParams(): void {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const ruleset = params.get('ruleset')
    const descent = params.get('descent')
    if (ruleset === 'recipe' || ruleset === 'v3') {
      localStorage.setItem(LS_RULESET_KEY, ruleset)
    }
    if (descent === 'true' || descent === 'false') {
      localStorage.setItem(LS_DESCENT_KEY, descent)
    }
  } catch {
    // localStorage 비활성화 환경 (Safari 개인정보 보호 등) 조용히 무시
  }
}

// 모듈 로드 시 URL 파라미터 적용
applyUrlParams()

/** comboRuleset 읽기 — 기본값: 'v3' */
export function getDevComboRuleset(): ComboRuleset {
  if (typeof window === 'undefined') return 'v3'
  try {
    const val = localStorage.getItem(LS_RULESET_KEY)
    if (val === 'recipe') return 'recipe'
  } catch {
    // ignore
  }
  return 'v3'
}

/** comboRuleset 쓰기 */
export function setDevComboRuleset(ruleset: ComboRuleset): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_RULESET_KEY, ruleset)
  } catch {
    // ignore
  }
}

/** ENABLE_YONGSIN_DESCENT 읽기 — 기본값: false */
export function getDevDescentEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const val = localStorage.getItem(LS_DESCENT_KEY)
    if (val === 'true') return true
  } catch {
    // ignore
  }
  return false
}

/** ENABLE_YONGSIN_DESCENT 쓰기 */
export function setDevDescentEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_DESCENT_KEY, enabled ? 'true' : 'false')
  } catch {
    // ignore
  }
}

/** 현재 개발 설정 요약 반환 (지문용) */
export function getDevSettingsSummary(): {
  comboRuleset: ComboRuleset
  descentEnabled: boolean
} {
  return {
    comboRuleset: getDevComboRuleset(),
    descentEnabled: getDevDescentEnabled(),
  }
}
