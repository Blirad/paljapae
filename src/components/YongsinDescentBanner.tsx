/**
 * 팔자전 — 용신 강림 배너 최소판 (YongsinDescentBanner.tsx)
 * 발주서 작업 2-d: 풀강림 시 "용신 강림" 1줄 배너 + 잔광 문구
 *
 * 표시 조건: ENABLE_YONGSIN_DESCENT=true (강림 ON) 시만 렌더링
 * 이든이 발동을 인지할 수 있도록 최소 1줄 배너 필수.
 *
 * 강림 상태 (DESCENT_VARIANT='slot' 기준):
 *   - pendingDescent=true: 슬롯 도래 → 강림 대기 (배너 표시)
 *   - 용신 포함 공격 후: 풀강림 발동 (강림 문구)
 *   - 소멸 후: 잔광 문구 (×1.25, DESCENT_GLOW_AFTERGLOW_MULT)
 *
 * B-3 잔광(glow) 변형 기준:
 *   - 풀강림: "용신 강림" — ×1.8
 *   - 잔광: "잔광이 남는다" — ×1.25
 */

import { DESCENT_GLOW_FULL_MULT, DESCENT_GLOW_AFTERGLOW_MULT } from '../engine/balance'

// GameState.yongsinDescent의 익명 타입과 동일한 구조
type DescentState = {
  descentCount: number
  slots: number[]
  usedCount: number
  pendingDescent: boolean
  yongsinAttackCount?: number
  waitWindowRemaining?: number
}

interface YongsinDescentBannerProps {
  descentState: DescentState | null | undefined
  descentEnabled: boolean       // getDevDescentEnabled() 값
  attackCount: number           // 현재 공격 횟수 (슬롯 도래 판정용)
}

/**
 * 용신 강림 배너
 * descentEnabled=false이면 null 반환 (렌더링 없음)
 */
export default function YongsinDescentBanner({
  descentState,
  descentEnabled,
  attackCount,
}: YongsinDescentBannerProps) {
  if (!descentEnabled || !descentState) return null

  const { pendingDescent, slots, usedCount } = descentState

  // 슬롯 도래 여부 (현재 공격 횟수가 슬롯 번호 중 하나와 일치)
  const slotArrived = slots.includes(attackCount)

  // 배너 표시 조건
  const showPending = slotArrived && pendingDescent
  // B-3 잔광: waitWindowRemaining 존재하고 pendingDescent가 false인 경우 (대기창 만료)
  const showAfterglow = !pendingDescent && descentState.waitWindowRemaining === 0 && usedCount === 0 && slotArrived === false

  if (!showPending && !showAfterglow && usedCount === 0) return null

  // 배너 상태 결정
  let text: string
  let subText: string
  let color: string
  let subColor: string
  let borderColor: string

  if (showPending) {
    text = '용신 강림'
    subText = `용신 원소 포함 공격 시 ×${DESCENT_GLOW_FULL_MULT}`
    color = '#D9A441'
    subColor = '#FFD98A'
    borderColor = 'rgba(217,164,65,0.7)'
  } else if (showAfterglow) {
    text = '잔광이 남는다'
    subText = `이번 공격 ×${DESCENT_GLOW_AFTERGLOW_MULT}`
    color = '#8FB8DE'
    subColor = 'rgba(143,184,222,0.7)'
    borderColor = 'rgba(143,184,222,0.4)'
  } else if (usedCount > 0) {
    // 이미 사용된 후 — 상태 알림만
    text = `강림 완료 (${usedCount}회)`
    subText = ''
    color = '#6A6560'
    subColor = '#6A6560'
    borderColor = 'rgba(106,101,96,0.3)'
  } else {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 16px',
        backgroundColor: 'rgba(22,19,15,0.92)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0 0 6px 6px',
        textAlign: 'center',
        zIndex: 200,
        pointerEvents: 'none',
        minWidth: '140px',
        animation: showPending ? 'yongsinPulse 1.2s ease-in-out infinite' : undefined,
      }}
    >
      <div
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color,
          letterSpacing: '0.12em',
          lineHeight: 1.3,
        }}
      >
        {text}
      </div>
      {subText && (
        <div
          style={{
            fontSize: '10px',
            color: subColor,
            letterSpacing: '0.05em',
            marginTop: '2px',
          }}
        >
          {subText}
        </div>
      )}

      <style>{`
        @keyframes yongsinPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
