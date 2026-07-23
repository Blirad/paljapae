/**
 * 팔자전 — 환생(還生·절지) 부활 각성 연출 (JeoljiReviveOverlay.tsx)
 *
 * 정본 지시서: KAIL_PALJAJEON_UNSEONGPAE_UI_DISPATCH_20260723.md §2-b (스펙 §4-D)
 * 리라 스펙: LYRA_PALJAJEON_UNSEONGPAE_STAGE2_UX_SPEC_20260722.md §C-2
 *
 * 연출 시퀀스 (§4-D):
 *   1. 전체 암전(0.2s) → 슬롯 붉은→금 광휘 (jeoljiReviveFlash)
 *   2. 배너 "환생(還生) — 사경의 각성" (붉은금 #E8934A)
 *   3. 격 배지 1격 꺾임 표기: "부활로 격이 꺾였다: {이전격} → {현재격}" 1줄 0.8s
 *   4. 부활 전투 동안 "각성" 상시 표기 (별도 각성 배너)
 *
 * ⛔ G13 명명: 개체명은 엔진 UNSEONGPAE_LABEL.jeolji('환생(還生)')에서 조회.
 *              격 표기는 엔진 GYEOK_LABEL 참조. 구명칭(절지) 하드코딩 금지.
 *
 * HP 30% 회복은 엔진 처리 — UI는 연출만. reduced-motion 대응은 index.css.
 */

import { GYEOK_ORDER, GYEOK_LABEL, UNSEONGPAE_LABEL } from '../engine/unseongpae'
import type { Gyeok } from '../engine/unseongpae'

// §4-D 지정 붉은금 (배너 텍스트/테두리)
const REVIVE_GOLD = '#E8934A'

interface JeoljiReviveOverlayProps {
  /** 부활 연출 발동 트리거 (jeoljiUsed false→true 전이 시 true). false면 오버레이 미렌더. */
  reviving: boolean
  /** 부활 후 현재 격 (1격 꺾인 값). 이전 격은 GYEOK_ORDER +1로 역산. */
  currentGyeok: Gyeok
}

/**
 * 부활 순간 오버레이 — 암전→광휘 + 배너 + 격 꺾임 표기.
 * reviving=true 인 동안(약 2.4s) 렌더. 종료 처리(setState false)는 호출부 BattleScreen 타이머.
 */
export function JeoljiReviveOverlay({ reviving, currentGyeok }: JeoljiReviveOverlayProps) {
  if (!reviving) return null

  // 이전 격 역산: 현재격이 꺾인 값이므로 한 단계 위. 수격(idx 0)이면 유지(더 내려갈 곳 없음).
  const idx = GYEOK_ORDER.indexOf(currentGyeok)
  const prevGyeok: Gyeok = idx < GYEOK_ORDER.length - 1 ? GYEOK_ORDER[idx + 1] : currentGyeok
  const brokeDown = prevGyeok !== currentGyeok

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, pointerEvents: 'none' }}>
      {/* 1. 전체 암전 → 붉은 → 금 광휘 (0.2s 암전 포함 총 ~1.8s) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          animation: 'jeoljiReviveFlash 1.8s ease-in-out forwards',
        }}
      />

      {/* 2. 배너 "환생(還生) — 사경의 각성" */}
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '12px 26px',
          backgroundColor: 'rgba(22,19,15,0.92)',
          border: `1px solid ${REVIVE_GOLD}`,
          borderRadius: '4px',
          textAlign: 'center',
          boxShadow: `0 0 16px 3px rgba(232,147,74,0.45)`,
          animation: 'jeoljiReviveBanner 2.4s ease-out forwards',
        }}
      >
        <div
          style={{
            color: REVIVE_GOLD,
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            lineHeight: 1.4,
          }}
        >
          {UNSEONGPAE_LABEL.jeolji} — 사경의 각성
        </div>
        <div
          style={{
            color: '#D8CCB4',
            fontSize: '11px',
            letterSpacing: '0.06em',
            marginTop: '4px',
          }}
        >
          죽음 끝에서 다시 산다
        </div>
      </div>

      {/* 3. 격 꺾임 1줄 표기 (0.8s, 위험/하락 톤) — 수격 유지 시 미표시 */}
      {brokeDown && (
        <div
          style={{
            position: 'absolute',
            top: '54%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#B33A2B',
            fontSize: '12px',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            animation: 'jeoljiGyeokBreak 0.8s ease-out 0.9s both',
          }}
        >
          부활로 격이 꺾였다: {GYEOK_LABEL[prevGyeok]} → {GYEOK_LABEL[currentGyeok]}
        </div>
      )}
    </div>
  )
}

interface JeoljiAwakenBannerProps {
  /** 각성 지속 여부 (jeoljiAwakenBattle). false면 미렌더. */
  awakened: boolean
}

/**
 * 부활 전투 동안 "각성" 상시 표기 배너 (§4-D 상시 표기 / 스펙 §C-2).
 * 전투 화면 상단(HP바 아래 영역)에 상주. 각성 해제 시 미렌더.
 */
export function JeoljiAwakenBanner({ awakened }: JeoljiAwakenBannerProps) {
  if (!awakened) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '5px 14px',
        backgroundColor: 'rgba(232,147,74,0.12)',
        border: `1px solid ${REVIVE_GOLD}`,
        borderRadius: '0 0 6px 6px',
        textAlign: 'center',
        zIndex: 200,
        pointerEvents: 'none',
        minWidth: '150px',
        animation: 'jeoljiAwakenPulse 1.8s ease-in-out infinite',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: REVIVE_GOLD,
          letterSpacing: '0.12em',
          lineHeight: 1.3,
        }}
      >
        {UNSEONGPAE_LABEL.jeolji} · 각성
      </div>
      <div
        style={{
          fontSize: '10px',
          color: 'rgba(232,147,74,0.85)',
          letterSpacing: '0.04em',
          marginTop: '2px',
        }}
      >
        전 융합 ×1.5
      </div>
    </div>
  )
}
