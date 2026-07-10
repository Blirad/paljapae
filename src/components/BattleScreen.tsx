/**
 * 팔자전 — (6) 전투 화면
 * 4층 출정, 1층 turn-based
 * 핸드 8장 중 1~5장 출수
 *
 * VFX 구현:
 *  - Score Popup (Section 5, line 87): 300ms, stagger 150ms, 위로 부유+페이드
 *  - Chain Glow (Section 5, line 88): 180ms/카드, 오방색 SVG 라인
 *  - Screen Shake (Section 5, line 90): 250ms, 4~12px 피해 비례
 *  - Elemental Sequence (Section 5, line 91): 2500ms 3단계 시퀀스
 *  - Speed Toggle (Section 5, line 93): 1x/2x — getCssDuration/getDuration
 *
 * G1 종합 수정 11건 (2026-07-09):
 *  A1: 용어 한글화 — 조합/기운잇기/같은기운모으기/음양짝/공격력/죽은기운/공격
 *  A2: 순환 바 상시 표시 — 나무→불→흙→쇠→물→나무, 탭하면 반화면 오버레이
 *  A3: 관계 시각화 — 초록 연결선(상생), 붉은 화살표(상극)
 *  A4: 훈수 버튼 — 최강 조합 1.5초 하이라이트
 *  A5: 첫 판 가이드 — localStorage 플래그, 3스텝, 스킵 버튼
 *  B6: 횟수 압박 — 남은 공격 중앙 상단 크게, 줄어들 때 펄스, 마지막 테두리 경고
 *  B7: 예측 표시 — "이 속도면 N번 더 필요" / "다음 한 방으로 끝!"
 *  B8: 피격 체감 — shake + 붉은 플래시 + 피격음
 *  B9: 결과의 근거 — 승리/패배 구체 수치
 *  C10: 적 연출 4종 — 돌진/선언배너/입장연출/기믹 실제 적용
 *  D11: 영웅 실루엣 + 조합 발동 시퀀스
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { FLOOR_CONFIGS, GEUK_BONUS_MULTIPLIER } from '../engine/balance'
// Phase 1.7: FLOOR_ENEMY_ELEMENTS는 floorConfig.enemyPrimaryElement로 대체됨
import { useGameContext } from '../context/GameContext'
import { audioManager } from '../services/audioManager'
import { judgeHand, detectElementClash, calcGeukBonusMultiplier, detectYeokgeukPenalty, determinePrimaryElement, judgeCombo } from '../engine/pokerHandJudge'
import { getCondenseAvailability } from '../engine/paljajeonEngine'
import type { Element } from '../types/game'
import TalismanBar from './TalismanBar'
import type { TalismanId } from '../engine/talismans'
import { useDragAndDrop, checkFusionCompatibility } from '../hooks/useDragAndDrop'
import PassiveSlot, { PassiveActivationBanner } from './PassiveSlot'
import { usePassiveAnimation } from '../hooks/usePassiveAnimation'
import type { Passive } from '../types/passive'
import ComboGuide from './ComboGuide'

const ELEMENT_LABELS: Record<string, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}

// 오방색 (G1 수정 — 상성 가시화)
const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}

// 오방색 글로우 (Section 1-2)
const ELEMENT_GLOW_COLORS: Record<string, string> = {
  mok: '#7BD4A3',
  hwa: '#FF7A5C',
  to: '#FFD98A',
  geum: '#E8E3D5',
  su: '#8FB8DE',
}

// 오방색 배경 (적 속성 뱃지용)
const ELEMENT_BG_COLORS: Record<string, string> = {
  mok: 'rgba(74,155,110,0.25)',
  hwa: 'rgba(198,61,47,0.25)',
  to: 'rgba(217,164,65,0.25)',
  geum: 'rgba(200,192,176,0.25)',
  su: 'rgba(61,90,128,0.25)',
}

// 오행 상극: A가 B를 극한다
const GEUK_MAP: Record<Element, Element> = {
  mok: 'to',
  hwa: 'geum',
  to: 'su',
  geum: 'mok',
  su: 'hwa',
}

// 오행 한글 이름
const ELEMENT_KO: Record<string, string> = {
  mok: '나무', hwa: '불', to: '흙', geum: '쇠', su: '물',
}

// 극 관계 한자 표현
function getGeukLabel(attacker: Element, victim: Element): string {
  return `${ELEMENT_LABELS[attacker]}克${ELEMENT_LABELS[victim]}`
}

// 한국어 조사 처리 (받침 유무)
function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const last = word.charCodeAt(word.length - 1)
  const hasBatchim = last >= 0xAC00 && (last - 0xAC00) % 28 !== 0
  return word + (hasBatchim ? withBatchim : withoutBatchim)
}

// A1: 극 관계 한글 표현 — "물이 불을 이긴다 +50%"
function getGeukKoLabel(attacker: Element, victim: Element, bonusPct: number): string {
  return `${josa(ELEMENT_KO[attacker], '이', '가')} ${josa(ELEMENT_KO[victim], '을', '를')} 이긴다 +${bonusPct}%`
}

// ─── Phase 1.9.2 상수 ───────────────────────────────────────────────────────

// Phase 1.9.4: 배너 텍스트는 런타임에 수치 포함하여 동적 생성
const TRAIT_BANNER_TEMPLATES = {
  fireBurn: (bonus: number) => bonus > 0 ? `불꽃이 타오른다 +${bonus}` : '불꽃이 타오른다 +30%',
  metalPierce: (ignored: number) => ignored > 0 ? `쇠가 꿰뚫는다 — 보호 ${ignored} 무시` : '쇠가 꿰뚫는다 — 보호 무시',
} as const

const CONDENSE_LABELS = {
  condense: '응축 — 힘을 담는다',
  superCondense: '대응축 — 가마에 굽는다',
  lastHandWarning: '마지막 패는 구울 수 없다',
} as const

const PREVIEW_IDLE = '기운을 골라 공격하라 — 같은 기운을 모으거나, 맺고 끊는 짝을 찾아라.'
const PREVIEW_BLOCKED = '서로 다른 기운은 둘까지만 손을 잡는다 — 다섯이 모이면 연환이 된다.'
const PREVIEW_YEONHWAN_READY = "오행이 모두 모였다 — '연환 완성하기'로 대의식을 완성하라."
const BATTLE_INTRO_DEAD = (element: string) => `오늘 ${element}의 기세가 죽어 있다 — 평소 힘의 6할만 낸다.`

// 오행 상극 역관계: B가 A를 극한다 → A는 B에게 기세 죽음
// GEUK_MAP[A] = B → A가 B를 극함
// B에게 눌리는 기운 목록 계산: GEUK_MAP[enemy] = X → X가 기세 죽음
// 카드 기운이 적 기운을 이기는지: GEUK_MAP[card.element] === enemyElement → 기세 오름
// 적 기운이 카드 기운을 이기는지: GEUK_MAP[enemyElement] === card.element → 기세 죽음

// ─── B-1: 신형 미리보기 빌더 ───────────────────────────────────────────────

const ELEMENT_GEUK_REASON: Record<Element, string> = {
  mok: '나무가 흙을 이긴다',
  hwa: '불이 쇠를 이긴다',
  to: '흙이 물을 이긴다',
  geum: '쇠가 나무를 이긴다',
  su: '물이 불을 이긴다',
}

const ELEMENT_ANTI_REASON: Record<Element, string> = {
  mok: '나무가 흙을 막는다',
  hwa: '불이 쇠를 막는다',
  to: '흙이 물을 막는다',
  geum: '쇠가 나무를 막는다',
  su: '물이 불을 막는다',
}

function buildPreviewText(
  cards: Array<{ element: Element; value: number; polarity: string; id: string }>,
  enemyElement: Element,
  options?: {
    hasAllFive?: boolean
  },
): {
  line1: string
  line2: string | null
  line1Color: string
  line1Style?: React.CSSProperties
  condenseInfo?: { attack: number; type: 'basic' | 'great'; comboName: string }
  isIdle?: boolean
  isYeonhwanReady?: boolean
  isInvalidCombo?: boolean
} | null {
  const { hasAllFive = false } = options ?? {}

  // 상태 ⑤: 연환 가능 (선택 0장이어도 핸드에 5기운 있으면 표시)
  if (hasAllFive && cards.length === 0) {
    return {
      line1: PREVIEW_YEONHWAN_READY,
      line2: null,
      line1Color: '#8B5CF6',
      isYeonhwanReady: true,
    }
  }

  // 상태 ①: 선택 0장
  if (cards.length === 0) {
    return {
      line1: PREVIEW_IDLE,
      line2: null,
      line1Color: '#8B9BB4',
      isIdle: true,
    }
  }

  // 상태 ② 1장 낱장
  if (cards.length === 1) {
    const card = cards[0]
    const isDeadGeuki = GEUK_MAP[enemyElement] === card.element
    const baseVal = isDeadGeuki ? Math.round(card.value * 0.6) : card.value
    return {
      line1: `낱장 — 공격력 ${baseVal}`,
      line2: null,
      line1Color: '#FFFDF7',
    }
  }

  const comboResult = judgeCombo(cards as any)

  // 상태 ④: 무효 조합
  if (comboResult.type === 'none') {
    return {
      line1: '이 기운들은 조합이 맺어지지 않는다 — 같은 기운끼리, 또는 맞는 짝을 골라라.',
      line2: null,
      line1Color: '#C63D2F',
      isInvalidCombo: true,
    }
  }

  const fe = comboResult.finishingElement
  const feHanja = ELEMENT_LABELS[fe]
  const geuksEnemy = GEUK_MAP[fe] === enemyElement
  const enemyGeuksFinish = GEUK_MAP[enemyElement] === fe

  // 상태 ⑤: 연환
  if (comboResult.type === 'ohang-yeonhwan') {
    return {
      line1: '오행연환 (五行) · 배율 ×8',
      line2: null,
      line1Color: '#C8A8E8',
      isYeonhwanReady: true,
    }
  }

  // 상태 ⑥: 토 타격 조합 (condenseType이 있을 때)
  const condenseAvail = getCondenseAvailability(comboResult.name ?? '', fe)
  if (condenseAvail !== null) {
    const mult = comboResult.multiplier
    const baseScore = comboResult.baseScore
    const geukMult = geuksEnemy ? 1.7 : enemyGeuksFinish ? 0.6 : 1.0
    const finalDamage = Math.round(baseScore * mult * geukMult)
    // Phase 1.9.3: 조합명 포함
    return {
      line1: '',
      line2: null,
      line1Color: '#FFFDF7',
      condenseInfo: { attack: finalDamage, type: condenseAvail, comboName: comboResult.name },
    }
  }

  // 상태 ③: 유효 조합
  const mult = comboResult.multiplier
  const baseScore = comboResult.baseScore
  const typeLabel = comboResult.type === 'fusion-hone' ? '벼리는' : '낳는'
  const comboName = comboResult.name

  let geukSuffix = ''
  let geukMultLabel = ''
  let line1Color = '#D8CCB4'

  if (comboResult.type === 'fusion-hone') {
    line1Color = '#E8C870'
  }

  if (geuksEnemy) {
    const reason = ELEMENT_GEUK_REASON[fe] ?? `${feHanja}이 이긴다`
    geukSuffix = ` · ${reason} +70%`
    geukMultLabel = ' × 1.7(극 유리)'
    line1Color = '#4A9B6E'
  } else if (enemyGeuksFinish) {
    const reason = ELEMENT_ANTI_REASON[enemyElement] ?? '막힌다'
    geukSuffix = ` · ${reason} −40%`
    geukMultLabel = ' × 0.6(극 불리)'
    line1Color = '#C63D2F'
  }

  // gather 타입
  if (comboResult.type === 'gather') {
    const elementName = ELEMENT_KO[cards[0].element]
    let line1 = `${elementName} 모으기 ${cards.length} (${ELEMENT_LABELS[cards[0].element]}) · 공격력 ${baseScore} × ${mult}`
    let gColor = '#D8CCB4'
    if (geuksEnemy) { line1 += ' +70%'; gColor = '#4A9B6E' }
    else if (enemyGeuksFinish) { line1 += ' −40%'; gColor = '#C63D2F' }
    const finalMult = geuksEnemy ? mult * 1.7 : enemyGeuksFinish ? mult * 0.6 : mult
    const line2 = `예상 ${Math.round(baseScore * finalMult)}${geukMultLabel ? ` (극 보정 포함)` : ''}`
    return { line1, line2, line1Color: gColor }
  }

  const finalMult = geuksEnemy ? mult * 1.7 : enemyGeuksFinish ? mult * 0.6 : mult
  const line1 = `${comboName} (${feHanja})${geukSuffix} · 공격력 ${baseScore} × ${mult} = 예상 ${Math.round(baseScore * finalMult)}`
  const line2 = geukMultLabel ? `기본 ${baseScore} × ${mult}(${typeLabel})${geukMultLabel} = ${Math.round(baseScore * finalMult)}` : null

  return { line1, line2, line1Color }
}

// ─── B-2: 이종 기운 3장 이상 차단 판정 ────────────────────────────────────

/** 현재 선택 기운 종류 배열 반환 */
function getSelectedElements(
  hand: Array<{ id: string; element: Element }>,
  selectedIds: string[],
): Element[] {
  const selected = hand.filter(c => selectedIds.includes(c.id))
  return [...new Set(selected.map(c => c.element))]
}

/**
 * 카드 클릭 시 차단 여부 판단
 * 반환: 차단하면 true
 */
function shouldBlockCardSelection(
  hand: Array<{ id: string; element: Element }>,
  selectedIds: string[],
  targetCardId: string,
): boolean {
  const targetCard = hand.find(c => c.id === targetCardId)
  if (!targetCard) return false

  const currentSelectedEls = getSelectedElements(hand, selectedIds)
  if (currentSelectedEls.length < 2) return false  // 아직 차단 조건 미충족

  const targetEl = targetCard.element
  // 이미 선택된 기운에 없고, 현재 기운 종류가 이미 2종인 경우 차단
  if (!currentSelectedEls.includes(targetEl) && currentSelectedEls.length >= 2) {
    return true
  }
  return false
}

/**
 * 5기운 전부 핸드에 있는지 확인 (오행연환 원탭 유도용)
 */
function handHasAllFiveElements(hand: Array<{ element: Element }>): boolean {
  const els = new Set(hand.map(c => c.element))
  return els.size === 5 && ['mok', 'hwa', 'to', 'geum', 'su'].every(e => els.has(e as Element))
}

// ─────────────────────────────────────────────────────────────────────────────

// A2: 순환 도표 오버레이 (탭하면 반화면)
function CycleChartOverlay({
  onClose,
  enemyElement,
}: {
  onClose: () => void
  enemyElement: Element
}) {
  const CYCLE_ORDER: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
  const KO = ELEMENT_KO
  const LABELS = ELEMENT_LABELS
  const COLORS = ELEMENT_COLORS
  const GLOW = ELEMENT_GLOW_COLORS

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(22,19,15,0.92)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
      }}
    >
      <div style={{ color: '#D9A441', fontSize: '16px', letterSpacing: '0.15em', marginBottom: '24px' }}>
        오행 순환
      </div>
      {/* 원형 도표 */}
      <div style={{ position: 'relative', width: '200px', height: '200px', marginBottom: '24px' }}>
        {CYCLE_ORDER.map((el, idx) => {
          const angle = (idx / 5) * Math.PI * 2 - Math.PI / 2
          const r = 80
          const cx = 100 + r * Math.cos(angle)
          const cy = 100 + r * Math.sin(angle)
          const isEnemy = el === enemyElement
          return (
            <div
              key={el}
              style={{
                position: 'absolute',
                left: cx - 22,
                top: cy - 22,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: isEnemy ? COLORS[el] : 'rgba(42,38,32,0.9)',
                border: `2px solid ${COLORS[el]}`,
                boxShadow: isEnemy ? `0 0 16px ${GLOW[el]}` : `0 0 4px ${COLORS[el]}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: isEnemy ? '#16130F' : COLORS[el], fontSize: '16px', fontWeight: 'bold', lineHeight: 1 }}>{LABELS[el]}</span>
              <span style={{ color: isEnemy ? '#16130F' : GLOW[el], fontSize: '9px', lineHeight: 1.2 }}>{KO[el]}</span>
            </div>
          )
        })}
        {/* 상생 화살표 (SVG) */}
        <svg style={{ position: 'absolute', inset: 0, width: '200px', height: '200px', pointerEvents: 'none' }}>
          {CYCLE_ORDER.map((el, idx) => {
            const nextIdx = (idx + 1) % 5
            const a1 = (idx / 5) * Math.PI * 2 - Math.PI / 2
            const a2 = (nextIdx / 5) * Math.PI * 2 - Math.PI / 2
            const r = 80
            const x1 = 100 + (r - 20) * Math.cos(a1)
            const y1 = 100 + (r - 20) * Math.sin(a1)
            const x2 = 100 + (r - 20) * Math.cos(a2)
            const y2 = 100 + (r - 20) * Math.sin(a2)
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            const dx = x2 - x1
            const dy = y2 - y1
            const len = Math.sqrt(dx * dx + dy * dy)
            const ax = -dy / len * 4
            const ay = dx / len * 4
            return (
              <g key={`saeng-${el}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4A9B6E" strokeWidth="1.5" strokeOpacity="0.6" />
                <polygon
                  points={`${midX},${midY} ${midX - ax - dx/len*6},${midY - ay - dy/len*6} ${midX + ax - dx/len*6},${midY + ay - dy/len*6}`}
                  fill="#4A9B6E"
                  opacity="0.7"
                />
              </g>
            )
          })}
        </svg>
      </div>
      {/* 설명 두 문장 */}
      <div style={{ textAlign: 'center', color: '#D8CCB4', fontSize: '14px', lineHeight: '2', letterSpacing: '0.05em' }}>
        <div>화살표 방향으로 이어 내면 세진다</div>
        <div>한 칸 건너뛴 기운은 상대를 이긴다</div>
      </div>
      <div style={{ color: '#4A4540', fontSize: '11px', marginTop: '20px' }}>탭하여 닫기</div>
    </div>
  )
}

// A5: 첫 판 가이드 (localStorage 플래그, 3스텝 모달 오버레이)
const TUTORIAL_KEY = 'paljajeon_tutorial_done_v1'

function FirstGameGuide({
  step,
  onNext,
  onPrev,
  onSkip,
}: {
  step: 0 | 1 | 2
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  // 지시서 A5: 3스텝 튜토리얼, modal overlay rgba(22,19,15,0.75), 16px 텍스트
  const STEPS = [
    {
      title: '1단계 — 기운 잇기',
      text: '같은 줄 기운을 이으면 더 세진다: 나무(木)→불(火)',
      sub: '이어지는 기운 두 장을 고르면 "기운 잇기 2" 조합이 만들어진다.',
    },
    {
      title: '2단계 — 상극',
      text: '당신의 불이 적의 쇠를 이긴다: 불이 쇠를 극한다',
      sub: '카드와 적 속성의 상극 관계 — 한 칸 건너뛴 기운이 상대를 이긴다.',
    },
    {
      title: '3단계 — 자유 조합',
      text: '이제 자유롭게 조합을 만들어보자',
      sub: '카드 1~5장을 골라 공격 버튼을 누르면 조합이 발동된다.',
    },
  ]
  const current = STEPS[step]

  return (
    // 배경 오버레이 (클릭해도 닫히지 않음 — 스킵 버튼으로만)
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(22,19,15,0.75)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* 모달 박스 */}
      <div
        style={{
          backgroundColor: 'rgba(28,23,16,0.98)',
          border: '1px solid #B33A2B',
          padding: '28px 24px',
          minWidth: '280px',
          maxWidth: '360px',
          width: '100%',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* 우상단 스킵 버튼 */}
        <button
          onClick={onSkip}
          style={{
            position: 'absolute',
            top: '10px',
            right: '12px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#4A4540',
            fontSize: '12px',
            cursor: 'pointer',
            letterSpacing: '0.1em',
          }}
        >
          스킵
        </button>

        {/* 스텝 표시 */}
        <div style={{ color: '#B33A2B', fontSize: '11px', letterSpacing: '0.2em', marginBottom: '12px' }}>
          {step + 1} / 3
        </div>

        {/* 제목 */}
        <div style={{ color: '#D9A441', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.12em', marginBottom: '12px' }}>
          {current.title}
        </div>

        {/* 본문 (지시서: 16px, #D8CCB4) */}
        <div style={{ color: '#D8CCB4', fontSize: '16px', lineHeight: '1.7', marginBottom: '8px', letterSpacing: '0.05em' }}>
          {current.text}
        </div>
        <div style={{ color: '#6A6560', fontSize: '12px', lineHeight: '1.6', marginBottom: '20px', letterSpacing: '0.04em' }}>
          {current.sub}
        </div>

        {/* 버튼 행 */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {/* 이전 버튼 (스텝 1에서 비활성) */}
          <button
            onClick={onPrev}
            disabled={step === 0}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #4A4540',
              color: step === 0 ? '#2A2620' : '#D8CCB4',
              padding: '10px 20px',
              fontSize: '13px',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            이전
          </button>
          {step < 2 ? (
            <button
              onClick={onNext}
              style={{
                backgroundColor: '#B33A2B',
                border: 'none',
                color: '#E8DCC4',
                padding: '10px 24px',
                fontSize: '13px',
                cursor: 'pointer',
                letterSpacing: '0.1em',
              }}
            >
              다음
            </button>
          ) : (
            <button
              onClick={onSkip}
              style={{
                backgroundColor: '#B33A2B',
                border: 'none',
                color: '#E8DCC4',
                padding: '10px 24px',
                fontSize: '13px',
                cursor: 'pointer',
                letterSpacing: '0.1em',
              }}
            >
              시작
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Score Popup ----------
interface ScorePopItem {
  id: string
  cardIndex: number
  damage: number
}

function ScorePopup({
  item,
  getCssDuration,
}: {
  item: ScorePopItem
  getCssDuration: (ms: number) => string
}) {
  const delayMs = item.cardIndex * parseFloat(getCssDuration(150)) * 1000
  const delay = `${delayMs / 1000}s`
  return (
    <div
      key={item.id}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: '#D9A441',
        fontSize: '28px',
        fontWeight: 'bold',
        fontVariantNumeric: 'tabular-nums',
        pointerEvents: 'none',
        zIndex: 50,
        animation: `scorePop ${getCssDuration(300)} ease-out ${delay} forwards`,
      }}
    >
      -{item.damage}
    </div>
  )
}

// ---------- Chain Glow SVG ----------
interface ChainGlowProps {
  cards: Array<{ id: string; element: string; x: number; y: number }>
  getCssDuration: (ms: number) => string
}

function ChainGlow({ cards, getCssDuration }: ChainGlowProps) {
  if (cards.length < 2) return null

  // A3: 상생 잇기 연결선 — 초록 고정 #7BD4A3, 3px (지시서 A3 규정)
  const chainLineColor = '#7BD4A3'

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 40,
        overflow: 'visible',
      }}
    >
      {cards.slice(0, -1).map((card, idx) => {
        const next = cards[idx + 1]
        const animDelay = `${(idx * 180) / 1000}s`
        return (
          <line
            key={`chain-${card.id}-${idx}`}
            x1={card.x}
            y1={card.y}
            x2={next.x}
            y2={next.y}
            stroke={chainLineColor}
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 5px ${chainLineColor})`,
              animation: `chainGlow ${getCssDuration(180)} ease-in-out ${animDelay} both`,
            }}
          />
        )
      })}
    </svg>
  )
}

// ---------- A3: 붉은 화살표 (상극 기운 포함 시 적 방향) ----------
interface GeukArrowProps {
  visible: boolean
  getCssDuration: (ms: number) => string
}

function GeukArrow({ visible, getCssDuration }: GeukArrowProps) {
  if (!visible) return null
  return (
    <svg
      style={{
        position: 'absolute',
        top: '-40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '28px',
        height: '40px',
        pointerEvents: 'none',
        zIndex: 45,
        overflow: 'visible',
        animation: `geukArrowPulse ${getCssDuration(900)} ease-in-out infinite`,
      }}
    >
      {/* 화살표 몸통 */}
      <line x1="14" y1="36" x2="14" y2="10" stroke="#C63D2F" strokeWidth="3" strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 4px #C63D2F)' }} />
      {/* 화살표 머리 */}
      <polygon points="14,2 7,14 21,14" fill="#C63D2F"
        style={{ filter: 'drop-shadow(0 0 6px #C63D2F)' }} />
    </svg>
  )
}

// ---------- Elemental Sequence Overlay ----------
interface ElementalSeqState {
  active: boolean
  phase: 0 | 1 | 2
  litElements: number
}

function ElementalSequenceOverlay({
  seq,
  getCssDuration,
}: {
  seq: ElementalSeqState
  getCssDuration: (ms: number) => string
}) {
  if (!seq.active) return null

  const elements = ['mok', 'hwa', 'to', 'geum', 'su']

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '180px',
          height: '180px',
          position: 'relative',
          animation: seq.phase >= 0
            ? `orbRotate ${getCssDuration(800)} linear forwards`
            : undefined,
        }}
      >
        {elements.map((el, idx) => {
          const angle = (idx / 5) * Math.PI * 2 - Math.PI / 2
          const r = 70
          const cx = 90 + r * Math.cos(angle)
          const cy = 90 + r * Math.sin(angle)
          const isLit = seq.litElements > idx
          const glowColor = ELEMENT_GLOW_COLORS[el]
          return (
            <div
              key={el}
              style={{
                position: 'absolute',
                left: cx - 16,
                top: cy - 16,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isLit ? glowColor : '#2A2620',
                border: `2px solid ${glowColor}`,
                boxShadow: isLit ? `0 0 12px 4px ${glowColor}` : 'none',
                transition: `all ${getCssDuration(200)} ease-in`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: isLit ? '#16130F' : glowColor,
              }}
            >
              {ELEMENT_LABELS[el]}
            </div>
          )
        })}

        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '22px',
            color: '#D9A441',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
            textShadow: '0 0 8px #D9A441',
          }}
        >
          五行
        </div>
      </div>

      {seq.phase === 2 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {elements.map((el, idx) => {
            const angle = (idx / 5) * Math.PI * 2
            const glowColor = ELEMENT_GLOW_COLORS[el]
            return (
              <div
                key={`particle-${el}`}
                style={{
                  position: 'absolute',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: glowColor,
                  boxShadow: `0 0 8px ${glowColor}`,
                  animation: `particle${idx} ${getCssDuration(700)} ease-out forwards`,
                  '--angle': `${angle}rad`,
                  '--dist': '120px',
                } as React.CSSProperties}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- 피해 내역 패널 (G1 수정 #3 — 스태거 카운트업) ----------
interface DamageBreakdown {
  baseScore: number
  multiplier: number
  geukBonus: number  // 1.0 = 없음, 1.5 = 극 보너스
  totalDamage: number
  geukLabel: string  // "火克金" 등
  visible: boolean
}

interface DamageBreakdownPanelProps {
  breakdown: DamageBreakdown
  getCssDuration: (ms: number) => string
}

function DamageBreakdownPanel({ breakdown, getCssDuration }: DamageBreakdownPanelProps) {
  // 스태거 표시 상태: 0=없음, 1=기본치, 2=배율, 3=극보너스, 4=최종
  const [staggerStep, setStaggerStep] = useState(0)
  const [finalCountVal, setFinalCountVal] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!breakdown.visible) {
      setStaggerStep(0)
      setFinalCountVal(0)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    console.log('[VFX] DamageBreakdownPanel 표시 시작', {
      baseScore: breakdown.baseScore,
      multiplier: breakdown.multiplier,
      geukBonus: breakdown.geukBonus,
      totalDamage: breakdown.totalDamage,
      timestamp: Date.now(),
    })

    // 스태거 순서:
    // 0ms  → step 1: 기본치 표시
    // 400ms → step 2: 배율 표시
    // 800ms → step 3: 극보너스 표시 (있을 때만)
    // 1100ms → step 4: 최종피해 카운트업 시작
    setStaggerStep(1)

    const t1 = setTimeout(() => setStaggerStep(2), 400)
    const hasGeuk = breakdown.geukBonus > 1
    const t2 = setTimeout(() => setStaggerStep(hasGeuk ? 3 : 4), 800)
    const finalDelay = hasGeuk ? 1100 : 800
    const t3 = setTimeout(() => {
      setStaggerStep(4)
      // 최종피해 카운트업 600ms
      const start = Date.now()
      const duration = 600
      const target = breakdown.totalDamage
      const tick = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        setFinalCountVal(Math.round(target * progress))
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }, finalDelay)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [breakdown.visible, breakdown.totalDamage, breakdown.baseScore]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!breakdown.visible) return null

  return (
    <div
      style={{
        // 적 HP바 아래에 절대 위치로 배치 (적 영역 내부에서 렌더링됨)
        backgroundColor: 'rgba(22,19,15,0.96)',
        border: '1px solid #4A4540',
        borderTop: '1px solid #B33A2B',
        padding: '10px 18px',
        minWidth: '200px',
        fontFamily: 'monospace',
        animation: `fadeInScale ${getCssDuration(200)} ease-out forwards`,
        pointerEvents: 'none',
        marginTop: '8px',
      }}
    >
      <div style={{ color: '#B33A2B', fontSize: '10px', letterSpacing: '0.15em', marginBottom: '8px', textAlign: 'center' }}>
        공격 내역
      </div>
      <div style={{ color: '#D8CCB4', fontSize: '13px', lineHeight: '1.9', fontVariantNumeric: 'tabular-nums' }}>
        {/* 스텝 1: 공격력 */}
        {staggerStep >= 1 && (
          <div style={{ animation: `slideInRow ${getCssDuration(200)} ease-out forwards` }}>
            공격력&nbsp;&nbsp;: <span style={{ color: '#D9A441' }}>{breakdown.baseScore}</span>
          </div>
        )}
        {/* 스텝 2: 배율 */}
        {staggerStep >= 2 && (
          <div style={{ animation: `slideInRow ${getCssDuration(200)} ease-out forwards` }}>
            × 배율&nbsp;&nbsp;: <span style={{ color: '#7BD4A3' }}>{breakdown.multiplier}배</span>{' '}
            <span style={{ color: '#4A4540', fontSize: '11px' }}>(조합)</span>
          </div>
        )}
        {/* 스텝 3: 극보너스 (있을 때만) */}
        {staggerStep >= 3 && breakdown.geukBonus > 1 && (
          <div style={{ animation: `slideInRow ${getCssDuration(200)} ease-out forwards` }}>
            × 이기는기운: <span style={{ color: '#FF7A5C' }}>{breakdown.geukBonus}</span>{' '}
            <span style={{ color: '#4A4540', fontSize: '11px' }}>({breakdown.geukLabel})</span>
          </div>
        )}
        {/* 스텝 4: 최종 피해 */}
        {staggerStep >= 4 && (
          <div style={{
            borderTop: '1px solid #2A2620',
            marginTop: '6px',
            paddingTop: '6px',
            animation: `slideInRow ${getCssDuration(200)} ease-out forwards`,
          }}>
            = 피해: <span style={{
              color: '#C63D2F',
              fontSize: '24px',
              fontWeight: 'bold',
              textShadow: '0 0 8px rgba(198,61,47,0.6)',
            }}>{finalCountVal}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- 인라인 안내 배너 (G1 수정 #4 — 핸드 위 위치, 주사선 장식) ----------
interface InlineBannerProps {
  message: string
  visible: boolean
  getCssDuration: (ms: number) => string
}

function InlineBanner({ message, visible, getCssDuration }: InlineBannerProps) {
  if (!visible) return null
  return (
    <div
      style={{
        backgroundColor: '#241F18',
        borderLeft: '2px solid #B33A2B',
        borderRight: '2px solid #B33A2B',
        color: '#D8CCB4',
        fontSize: '14px',
        padding: '8px 16px',
        letterSpacing: '0.06em',
        pointerEvents: 'none',
        animation: `inlineBannerIn ${getCssDuration(300)} ease-out forwards`,
        textAlign: 'center',
        lineHeight: '1.5',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {message}
    </div>
  )
}

// ---------- 카드 위치 계산 (체인 글로우용) ----------
function getCardPositions(hand: Array<{ id: string; element: string }>, selectedIds: string[]) {
  const selectedCards = hand.filter(c => selectedIds.includes(c.id))
  const totalWidth = 300
  const cardWidth = 62
  const spacing = totalWidth / Math.max(selectedCards.length, 1)

  return selectedCards.map((card, idx) => ({
    id: card.id,
    element: card.element,
    x: totalWidth / 2 - (selectedCards.length - 1) * spacing / 2 + idx * spacing + cardWidth / 2,
    y: 60,
  }))
}

// C10: 층별 적 정보 (이름, 속성, 기믹 예고, 대사)
const FLOOR_ENEMY_INFO: Record<number, {
  name: string
  element: Element
  gimmickHint: string
  dialogue: string
  eliteBanner?: string
  // Phase 1.7 신규
  gimmickDialogue?: string  // 기믹 발동 시 대사
  subElement?: Element
}> = {
  1: {
    name: '고목령(枯木靈)',
    element: 'mok',
    subElement: 'hwa',
    gimmickHint: '매 공격마다 체력을 15 회복한다',
    dialogue: '뿌리가... 어디였더라...',
  },
  2: {
    name: '잔화령(殘火靈)',
    element: 'hwa',
    subElement: 'geum',
    gimmickHint: '반격이 더 강하지만 체력이 낮다',
    dialogue: '이 불길, 그대도 함께 태워주마.',
    gimmickDialogue: '이 불길, 그대도 함께 태워주마.',
  },
  3: {
    name: '정예: 고신',
    element: 'to',
    subElement: 'su',
    gimmickHint: '가호 슬롯 2칸을 봉인한다 | 체력 50% 시 기운 전환',
    dialogue: '외로운 힘이 그대를 짓누른다.',
    eliteBanner: '고신 — 그대의 가호 두 칸을 봉인한다',
    gimmickDialogue: '외로운 힘이 그대를 짓누른다.',
  },
  4: {
    name: '보스: 명외자 대장',
    element: 'geum',
    subElement: 'mok',
    gimmickHint: '금강불괴: 피해 -30% | 폭풍격: 기운 전환 후 반격 강화',
    dialogue: '이제부터 진짜 전투다.',
    eliteBanner: '명외자 — 금강불괴, 피해를 30% 막아낸다',
    gimmickDialogue: '이제부터 진짜 전투다.',
  },
}

interface BattleScreenProps {
  onFloorClear: () => void
  onResult: (victory: boolean) => void
  passives?: Passive[]  // 드래프트에서 선택한 패시브 (옵셔널, 없으면 빈 슬롯)
}

export default function BattleScreen({ onFloorClear, onResult, passives = [] }: BattleScreenProps) {
  const {
    currentFloor,
    playerHp,
    playerMaxHp,
    enemyHp,
    enemyMaxHp,
    hand,
    selectedCards,
    previewResult,
    discardsLeft,
    playsLeft,
    phase,
    isVictory,
    talismans,
    amplifyActive,
    attackCount,
    enemyPhaseSwitch,
    condenseActive,
    // Phase 1.9.2 신규 필드
    yeonhwanUsed,
    condenseType,
    condensedDamage,
    isLastAttack,
    sootCount,
    combustionTriggered,
    combustionBonus,
    penetrationTriggered,
    penetrationIgnored,
    reshuffled,
    toggleCardSelect,
    playSelectedCards,
    discardSelectedCards,
    hasShownFirstHand,
    hasShownFirstDiscard,
    hasShownFirstAffinity,
    markFirstHandShown,
    markFirstDiscardShown,
    markFirstAffinityShown,
    updateBattleStats,
    useJeonghwa,
    useHwanpae,
    useJeungpok,
    applyCondenseAction,
  } = useGameStore()

  const { getCssDuration, getDuration, playbackSpeed, togglePlaybackSpeed } = useGameContext()

  const floorConfig = FLOOR_CONFIGS[currentFloor - 1]
  // Phase 1.7: 기운 전환 반영한 현재 주/부 기운
  const currentPrimaryElement: Element = enemyPhaseSwitch
    ? floorConfig.enemySubElement
    : floorConfig.enemyPrimaryElement
  const currentSubElement: Element = enemyPhaseSwitch
    ? floorConfig.enemyPrimaryElement
    : floorConfig.enemySubElement
  const enemyElement: Element = currentPrimaryElement

  // ---------- VFX 상태 ----------
  const [shakeActive, setShakeActive] = useState(false)
  const [shakeAmplitude, setShakeAmplitude] = useState(4)
  const [scorePopups, setScorePopups] = useState<ScorePopItem[]>([])
  const [elementalSeq, setElementalSeq] = useState<ElementalSeqState>({
    active: false,
    phase: 0,
    litElements: 0,
  })

  // G1 수정 #3 — 피해 내역 패널 (적 영역 내부)
  const [damageBreakdown, setDamageBreakdown] = useState<DamageBreakdown>({
    baseScore: 0,
    multiplier: 1,
    geukBonus: 1,
    totalDamage: 0,
    geukLabel: '',
    visible: false,
  })

  // G1 수정 #4 — 인라인 안내 배너 (핸드 위)
  const [bannerMessage, setBannerMessage] = useState('')
  const [bannerVisible, setBannerVisible] = useState(false)
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 역극 첫 진입 안내 표시 여부 (카드별, 화면에 직접 표시)
  const [showYeokgeukHint, setShowYeokgeukHint] = useState(false)
  const yeokgeukHintShownRef = useRef(false)

  // Phase 1.8: 역극 카드 탭 시 툴팁
  const [yeokgeukTooltip, setYeokgeukTooltip] = useState<{ cardId: string; text: string } | null>(null)
  const yeokgeukTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Phase 1.8: 전투 진입 시 역극 배너 (1회)
  const [hasShownYeokgeukBanner, setHasShownYeokgeukBanner] = useState(false)

  // A2: 순환 도표 오버레이
  const [showCycleChart, setShowCycleChart] = useState(false)

  // A4: 훈수 하이라이트 카드 목록
  const [hintCards, setHintCards] = useState<string[]>([])
  const [hintActive, setHintActive] = useState(false)

  // B6: 횟수 압박 — 이전 playsLeft 추적 (펄스 애니메이션)
  const [playsCountPulse, setPlaysCountPulse] = useState(false)
  const prevPlaysLeft = useRef(playsLeft)

  // B7: 예측 표시 상태
  const [predictionText, setPredictionText] = useState<string | null>(null)

  // B8: 피격 플래시 + 체력바 흔들림
  const [hitFlash, setHitFlash] = useState(false)
  const [hpBarShake, setHpBarShake] = useState(false)

  // B9: 결과 근거 수집
  const totalPlaysUsedRef = useRef(0)
  const maxSingleDamageRef = useRef(0)

  // C10: 적 등장 연출 상태
  const [enemyEntrance, setEnemyEntrance] = useState(true)
  const [enemyEntranceText, setEnemyEntranceText] = useState<string | null>(null)

  // C10: 적 돌진 모션 상태
  const [enemyCharge, setEnemyCharge] = useState(false)
  const [enemyDialogue, setEnemyDialogue] = useState<string | null>(null)

  // C10: 기믹 선언 배너 상태
  const [gimmickBanner, setGimmickBanner] = useState<string | null>(null)

  // C10(b): 기믹 선언 배너 0.5초 입력 잠금
  const [isInputLocked, setIsInputLocked] = useState(false)

  // D11: 영웅 전방 모션 상태
  const [heroCharge, setHeroCharge] = useState(false)
  const [spiritOrbs, setSpiritOrbs] = useState<string[]>([]) // 정령 구체 속성 목록

  // Phase 1.7: 조합 도감 오버레이
  const [showComboGuide, setShowComboGuide] = useState(false)

  // Phase 1.8: 도감 버튼 맥동 (처음 3판)
  const comboGuideButtonPulse = (() => {
    try {
      const played = parseInt(localStorage.getItem('paljajeon_games_played') ?? '0', 10)
      return played < 3
    } catch {
      return true
    }
  })()

  // Phase 1.7: 기운 전환 배너 표시
  const [phaseSwitchBanner, setPhaseSwitchBanner] = useState(false)
  const prevEnemyPhaseSwitch = useRef(false)

  // Phase 1.7: 강공 배너
  const [heavyAttackBanner, setHeavyAttackBanner] = useState(false)
  const prevAttackCount = useRef(0)

  // Phase 1.8: 토 응축 연출
  const [condenseBanner, setCondenseBanner] = useState<'accumulate' | 'explode' | null>(null)
  const prevCondenseActive = useRef(false)

  // Phase 1.7: 반격 피해 팝업 (독립 비트)
  const [counterPopup, setCounterPopup] = useState<{ value: number; id: number } | null>(null)
  // Phase 1.7: 적 대사 (기믹 발동 시)
  const [gimmickDialogue, setGimmickDialogue] = useState<string | null>(null)

  // Phase 1.8: 적 패 뒤집기 연출
  const [enemyCardFlip, setEnemyCardFlip] = useState<{ label: string; damage: number; id: number } | null>(null)

  // Phase 1.8: 기운 잇기 3 이상 팝업
  const [chainPopup, setChainPopup] = useState<{ text: string; id: number } | null>(null)

  // B-2: 이종 기운 차단 안내 텍스트 (500ms 소멸)
  const [blockMsg, setBlockMsg] = useState<string | null>(null)
  const blockMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // B-3: 오행연환 shimmer 상태 (5기운 보유 여부)
  const hasAllFiveElements = handHasAllFiveElements(hand)

  // Phase 1.9.2: 기세 죽음 전투 진입 배너
  const [geukiBanner, setGeukiBanner] = useState<string | null>(null)
  const geukiBannerShownRef = useRef(false)

  // Phase 1.9.2: 특성 배너 (화 연소 / 금 관통)
  // Phase 1.9.4: type 외 bonus/ignored 수치 포함
  const [traitBanner, setTraitBanner] = useState<{ type: 'fire' | 'metal'; key: number; bonus?: number; ignored?: number } | null>(null)

  // Phase 1.9.2: 특성 최초 발동 툴팁
  const [traitTooltip, setTraitTooltip] = useState<'fire' | 'metal' | null>(null)

  // Phase 1.9.2: 응축 발동 연출 구슬
  const [condenseOrb, setCondenseOrb] = useState<'basic' | 'great' | null>(null)

  // Phase 1.9.2 이전 combustionTriggered/penetrationTriggered 추적
  const prevCombustionTriggered = useRef(false)
  const prevPenetrationTriggered = useRef(false)

  // Phase 1.9.4: 덱 재순환 배너
  const [reshuffleBanner, setReshuffleBanner] = useState<boolean>(false)
  const prevReshuffled = useRef(false)
  useEffect(() => {
    if (reshuffled && !prevReshuffled.current) {
      setReshuffleBanner(true)
      setTimeout(() => setReshuffleBanner(false), 1800)
    }
    prevReshuffled.current = reshuffled
  }, [reshuffled])

  // Phase 1.9.2: 전투 진입 시 기세 죽음 배너 (1회)
  useEffect(() => {
    if (!geukiBannerShownRef.current && hand.length > 0) {
      const deadEl = GEUK_MAP[enemyElement]  // 적에게 눌리는 기운
      const hasDeadEl = hand.some(c => c.element === deadEl)
      if (hasDeadEl) {
        geukiBannerShownRef.current = true
        const geukiIntroKey = `paljajeon_geuki_intro_${deadEl}`
        // localStorage 1회 제한 체크
        let alreadyShown = false
        try { alreadyShown = !!localStorage.getItem(geukiIntroKey) } catch { /* noop */ }
        if (!alreadyShown) {
          try { localStorage.setItem(geukiIntroKey, '1') } catch { /* noop */ }
          setTimeout(() => {
            setGeukiBanner(BATTLE_INTRO_DEAD(ELEMENT_KO[deadEl]))
            setTimeout(() => setGeukiBanner(null), 3800)
          }, 600)
        }
      }
    }
  }, [hand.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 1.9.4: 화 연소 / 금 관통 배너 (수치 포함)
  useEffect(() => {
    if (combustionTriggered && !prevCombustionTriggered.current) {
      setTraitBanner({ type: 'fire', key: Date.now(), bonus: combustionBonus })
      setTimeout(() => setTraitBanner(null), 1700)
      // 최초 툴팁
      try {
        const key = 'paljajeon_trait_fire_burn_explained'
        if (!localStorage.getItem(key)) {
          setTimeout(() => setTraitTooltip('fire'), 200)
        }
      } catch { /* noop */ }
    }
    prevCombustionTriggered.current = combustionTriggered
  }, [combustionTriggered])

  useEffect(() => {
    if (penetrationTriggered && !prevPenetrationTriggered.current) {
      setTraitBanner({ type: 'metal', key: Date.now(), ignored: penetrationIgnored })
      setTimeout(() => setTraitBanner(null), 1700)
      // 최초 툴팁
      try {
        const key = 'paljajeon_trait_metal_pierce_explained'
        if (!localStorage.getItem(key)) {
          setTimeout(() => setTraitTooltip('metal'), 200)
        }
      } catch { /* noop */ }
    }
    prevPenetrationTriggered.current = penetrationTriggered
  }, [penetrationTriggered])

  // B-4: 응축 최초 툴팁 (localStorage 플래그)
  const CONDENSE_TOOLTIP_KEY = 'paljajeon_condensation_explained'
  const [showCondenseTooltip, setShowCondenseTooltip] = useState(false)
  const condensePrevActive = useRef(false)

  // B-4: 최초 응축 발동 시 툴팁 표시
  useEffect(() => {
    if (condenseActive && !condensePrevActive.current) {
      try {
        const explained = localStorage.getItem(CONDENSE_TOOLTIP_KEY)
        if (!explained) {
          setShowCondenseTooltip(true)
        }
      } catch { /* noop */ }
    }
    condensePrevActive.current = condenseActive
  }, [condenseActive])

  const handleCondenseTooltipClose = useCallback(() => {
    setShowCondenseTooltip(false)
    try {
      localStorage.setItem(CONDENSE_TOOLTIP_KEY, '1')
    } catch { /* noop */ }
  }, [])

  // 2번: 드래그 앤 드롭 훅 (합성 소환 인터랙션)
  const { dragState, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel, rejectAnimCardId } = useDragAndDrop()

  // 드래그 겹치기 불가 안내 메시지
  const [fusionRejectMsg, setFusionRejectMsg] = useState<string | null>(null)
  const fusionRejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 3번: 패시브 애니메이션 훅
  const { activationState, clearActivation } = usePassiveAnimation()
  void clearActivation // 향후 패시브 발동 시 사용

  // A5: 첫 판 가이드
  const [tutorialStep, setTutorialStep] = useState<0 | 1 | 2 | null>(() => {
    try {
      return localStorage.getItem(TUTORIAL_KEY) ? null : 0
    } catch {
      return null
    }
  })
  const handleTutorialNext = useCallback(() => {
    setTutorialStep(prev => (prev !== null && prev < 2 ? (prev + 1) as 0 | 1 | 2 : null))
  }, [])
  const handleTutorialPrev = useCallback(() => {
    setTutorialStep(prev => (prev !== null && prev > 0 ? (prev - 1) as 0 | 1 | 2 : prev))
  }, [])
  const handleTutorialSkip = useCallback(() => {
    setTutorialStep(null)
    try { localStorage.setItem(TUTORIAL_KEY, '1') } catch { /* ignore */ }
  }, [])

  const showBanner = useCallback((msg: string) => {
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current)
    setBannerMessage(msg)
    setBannerVisible(true)
    // 4초 표시
    bannerTimeoutRef.current = setTimeout(() => setBannerVisible(false), 4000)
  }, [])

  // Phase 1.8: 전투 진입 시 역극 배너 (1회)
  useEffect(() => {
    if (!hasShownYeokgeukBanner && hand.length > 0) {
      const yeokgeukEl = GEUK_MAP[enemyElement]  // 적이 이기는 기운 = 역극 기운
      const hasYeokgeuk = hand.some(c => c.element === yeokgeukEl)
      if (hasYeokgeuk) {
        setHasShownYeokgeukBanner(true)
        const elKo = ELEMENT_KO[yeokgeukEl]
        const enemyElKo = ELEMENT_KO[enemyElement]
        setTimeout(() => {
          showBanner(`주의: 패에 ${elKo} 카드가 있지만, 적의 ${enemyElKo} 앞에서 힘을 쓰지 못합니다.`)
        }, 800)
      }
    }
  }, [hand.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // 이전 HP 추적
  const prevEnemyHp = useRef(enemyHp)
  const prevPlayerHp = useRef(playerHp)

  // 족보 미리보기 바운스 애니메이션 트리거
  const [previewBounce, setPreviewBounce] = useState(false)
  const prevPreviewRank = useRef<string | null>(null)

  // iOS AudioContext — 첫 터치 시 resume (G1 수정 #5)
  useEffect(() => {
    const resumeAudio = () => {
      const ctx = (window as unknown as { _audioCtx?: AudioContext })._audioCtx
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          console.log('[SFX] iOS AudioContext resumed on user gesture')
        })
      }
      // Web Audio API 전역 트리거: 실제 AudioContext는 audioManager 내부에서 관리
      // 첫 터치 후 getCtx() 내 resume()이 자동 호출되므로 여기서는 더미 노드 생성으로 unlock
      try {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtxClass) {
          const tempCtx = new AudioCtxClass()
          const buf = tempCtx.createBuffer(1, 1, 22050)
          const src = tempCtx.createBufferSource()
          src.buffer = buf
          src.connect(tempCtx.destination)
          src.start(0)
          if (tempCtx.state === 'suspended') {
            tempCtx.resume()
          }
          setTimeout(() => tempCtx.close(), 100)
          console.log('[SFX] AudioContext unlock 시도 완료 (iOS 호환)')
        }
      } catch {
        // 무시
      }
      document.removeEventListener('touchstart', resumeAudio)
      document.removeEventListener('click', resumeAudio)
    }
    document.addEventListener('touchstart', resumeAudio, { once: true })
    document.addEventListener('click', resumeAudio, { once: true })
    return () => {
      document.removeEventListener('touchstart', resumeAudio)
      document.removeEventListener('click', resumeAudio)
    }
  }, [])

  // Phase 1.8: 게임 플레이 카운터 증가
  useEffect(() => {
    try {
      const current = parseInt(localStorage.getItem('paljajeon_games_played') ?? '0', 10)
      localStorage.setItem('paljajeon_games_played', String(current + 1))
    } catch { /* noop */ }
  }, [])

  // BGM: BattleScreen 진입 시 재생, 언마운트 시 정지
  useEffect(() => {
    console.log('[SFX] BGM 시작 — BattleScreen 진입', { timestamp: Date.now() })
    audioManager.playBGM()
    return () => {
      console.log('[SFX] BGM 정지 — BattleScreen 언마운트', { timestamp: Date.now() })
      audioManager.stopBGM()
    }
  }, [])

  // Phase 전환 처리
  useEffect(() => {
    if (phase === 'floor-reward') {
      audioManager.stopBGM()
      audioManager.floorClearAscending()
      console.log('[SFX] 층 클리어 사운드 재생', { phase, timestamp: Date.now() })
      onFloorClear()
    } else if (phase === 'result') {
      // B9: 전투 통계 store에 기록
      updateBattleStats({
        totalPlaysUsed: totalPlaysUsedRef.current,
        maxSingleDamage: maxSingleDamageRef.current,
        remainingEnemyHpAtEnd: enemyHp,
      })
      audioManager.stopBGM()
      if (isVictory) {
        audioManager.floorClearAscending()
        console.log('[SFX] 승리 사운드 재생', { timestamp: Date.now() })
      } else {
        audioManager.defeatDeepTone()
        console.log('[SFX] 패배 사운드 재생', { timestamp: Date.now() })
      }
      onResult(isVictory)
    }
  }, [phase, isVictory, onFloorClear, onResult, enemyHp, updateBattleStats])

  // G1 수정 #4 — 첫 핸드 진입 안내
  useEffect(() => {
    if (!hasShownFirstHand && hand.length > 0) {
      markFirstHandShown()
      const timer = setTimeout(() => {
        showBanner('같은 기운 둘, 또는 이어지는 기운(나무→불→흙→쇠→물)을 골라보라')
        console.log('[UX] 인라인 안내 1: 첫 핸드', { timestamp: Date.now() })
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [hand.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // G1 수정 #4 — 첫 버리기 가능 시 안내
  useEffect(() => {
    if (!hasShownFirstDiscard && discardsLeft > 0 && hand.length > 0) {
      if (selectedCards.length > 0) {
        markFirstDiscardShown()
        showBanner('마음에 안 드는 카드는 버리고 새로 받을 수 있다')
        console.log('[UX] 인라인 안내 2: 첫 버리기', { timestamp: Date.now() })
      }
    }
  }, [selectedCards.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // G1 수정 #4 — 첫 극 성립 안내 (previewResult에 극 관련 족보)
  useEffect(() => {
    if (!hasShownFirstAffinity && previewResult) {
      const isGeukRank = previewResult.rank === 'geuk-bonas' || previewResult.rank === 'geukchae-chain'
      if (isGeukRank) {
        markFirstAffinityShown()
        showBanner('상대를 이기는 기운은 더 아프게 박힌다 — 한 칸 건너뛴 기운이 이긴다')
        console.log('[UX] 인라인 안내 3: 첫 극 성립', { timestamp: Date.now() })
      }
    }
  }, [previewResult?.rank]) // eslint-disable-line react-hooks/exhaustive-deps

  // 족보 미리보기 변경 시 바운스 애니메이션 + 기운 잇기 3+ 팝업
  useEffect(() => {
    const newRank = previewResult?.rank ?? null
    if (newRank !== prevPreviewRank.current && newRank && newRank !== 'none') {
      console.log('[VFX] 족보 미리보기 갱신 — 바운스', { rank: newRank, timestamp: Date.now() })
      setPreviewBounce(true)
      const t = setTimeout(() => setPreviewBounce(false), 220)
      prevPreviewRank.current = newRank

      // Phase 1.8: 기운 잇기 3 이상 팝업
      if (newRank === 'saengchae-3' || newRank === 'saengchae-chain' || newRank === 'ohang-yeonhwan') {
        const mult = newRank === 'saengchae-3' ? '×3' : newRank === 'saengchae-chain' ? '×7' : '×10'
        setChainPopup({ text: `기운이 셋 이어져 ${mult}!`, id: Date.now() })
        setTimeout(() => setChainPopup(null), getDuration(1500))
      }

      return () => clearTimeout(t)
    }
    prevPreviewRank.current = newRank
  }, [previewResult?.rank]) // eslint-disable-line react-hooks/exhaustive-deps

  // 적 HP 변화 감지 → Score Popup + Screen Shake + 피해 내역 패널 + B9 근거 수집
  useEffect(() => {
    const damage = prevEnemyHp.current - enemyHp
    if (damage > 0) {
      if (previewResult?.rank === 'ohang-yeonhwan') {
        triggerElementalSequence()
      }

      // B9: 최대 한 방 추적
      if (damage > maxSingleDamageRef.current) maxSingleDamageRef.current = damage
      totalPlaysUsedRef.current += 1

      // D11: 영웅 전방 모션 + 정령 구체 소환
      const selectedEls = hand.filter(c => selectedCards.includes(c.id)).map(c => c.element)
      const uniqueEls = [...new Set(selectedEls)]
      setHeroCharge(true)
      setSpiritOrbs(uniqueEls)
      setTimeout(() => setHeroCharge(false), getDuration(400))
      setTimeout(() => setSpiritOrbs([]), getDuration(1200))

      // Score Popup
      const selected = hand.filter(c => selectedCards.includes(c.id))
      const perCardDamage = Math.floor(damage / Math.max(selected.length, 1))
      const newPopups: ScorePopItem[] = selected.map((_, idx) => ({
        id: `popup-${Date.now()}-${idx}`,
        cardIndex: idx,
        damage: perCardDamage,
      }))
      setScorePopups(prev => [...prev, ...newPopups])

      console.log('[VFX] ScorePopup 생성', { damage, perCardDamage, count: newPopups.length, timestamp: Date.now() })

      // 사운드: 카드별 피치 상승 틱
      selected.forEach((_, idx) => {
        setTimeout(() => {
          audioManager.scoreCountTick(idx, selected.length)
          console.log('[SFX] scoreCountTick', { cardIndex: idx, timestamp: Date.now() })
        }, idx * getDuration(150))
      })

      // 팝업 제거
      const totalDuration = getDuration(300) + selected.length * getDuration(150) + 200
      setTimeout(() => {
        setScorePopups(prev => prev.filter(p => !newPopups.some(n => n.id === p.id)))
      }, totalDuration)

      // Screen Shake
      const amplitude = Math.max(4, Math.min(12, 4 + (damage / 100) * 8))
      setShakeAmplitude(amplitude)
      setShakeActive(true)
      console.log('[VFX] ScreenShake 발동', { amplitude, duration: getDuration(250), timestamp: Date.now() })
      setTimeout(() => setShakeActive(false), getDuration(250))

      // 피해 내역 패널 표시 (3초)
      if (previewResult) {
        const selectedCardObjs = hand.filter(c => selectedCards.includes(c.id))
        const geukCalcForPanel = calcGeukBonusMultiplier(selectedCardObjs, enemyElement)
        const geukBonus = geukCalcForPanel.multiplier
        const geukCard = selectedCardObjs.find(c => GEUK_MAP[c.element] === enemyElement)
        const geukLabel = geukCard ? getGeukLabel(geukCard.element, enemyElement) : ''

        setDamageBreakdown({
          baseScore: previewResult.baseScore,
          multiplier: previewResult.multiplier,
          geukBonus,
          totalDamage: damage,
          geukLabel,
          visible: true,
        })

        // B7: 예측 표시 — 이 속도면 N번 더 필요 / 다음 한 방으로 끝
        if (enemyHp > 0) {
          const avgDamage = damage
          const remainHp = enemyHp
          const turnsNeeded = Math.ceil(remainHp / avgDamage)
          const pred = turnsNeeded <= 1
            ? '다음 한 방으로 끝!'
            : `이 속도면 ${turnsNeeded}번 더 필요`
          setPredictionText(pred)
          setTimeout(() => setPredictionText(null), getDuration(3000))
        }

        console.log('[VFX] 피해 내역 패널 표시', {
          baseScore: previewResult.baseScore,
          multiplier: previewResult.multiplier,
          geukBonus,
          totalDamage: damage,
          duration: '3000ms',
          timestamp: Date.now(),
        })

        // 3초 후 숨김
        setTimeout(() => {
          setDamageBreakdown(prev => ({ ...prev, visible: false }))
        }, getDuration(3000))
      }
    }
    prevEnemyHp.current = enemyHp
  }, [enemyHp])  // eslint-disable-line react-hooks/exhaustive-deps

  // 플레이어 HP 변화 → B8: 피격 플래시 + 사운드 / 회복음 + Phase 1.7 반격 팝업
  useEffect(() => {
    if (playerHp < prevPlayerHp.current) {
      const dmg = prevPlayerHp.current - playerHp
      audioManager.playerHit()
      // B8: 붉은 플래시 + 체력바 흔들림
      setHitFlash(true)
      setHpBarShake(true)
      setTimeout(() => setHitFlash(false), getDuration(300))
      setTimeout(() => setHpBarShake(false), getDuration(200))
      // Phase 1.7 CRIT-1 fix: 반격 피해 팝업 (동일 useEffect 내 통합)
      setTimeout(() => {
        setCounterPopup({ value: dmg, id: Date.now() })
        setTimeout(() => setCounterPopup(null), getDuration(1000))
      }, getDuration(200))
      // Phase 1.8: 적 패 뒤집기 연출 (반격)
      setTimeout(() => {
        setEnemyCardFlip({ label: '反擊', damage: dmg, id: Date.now() })
        setTimeout(() => setEnemyCardFlip(null), getDuration(1200))
      }, getDuration(100))
      // 5-D: 반격 시 기믹 대사 (잔화령 등)
      const floorInfo = FLOOR_ENEMY_INFO[currentFloor]
      if (floorInfo?.gimmickDialogue && currentFloor <= 2) {
        setGimmickDialogue(floorInfo.gimmickDialogue ?? floorInfo.dialogue)
        setTimeout(() => setGimmickDialogue(null), getDuration(1500))
      }
      console.log('[SFX] 플레이어 피격음', { damage: dmg, timestamp: Date.now() })
    } else if (playerHp > prevPlayerHp.current) {
      audioManager.playHealSFX()
      console.log('[SFX] 회복음', { heal: playerHp - prevPlayerHp.current, timestamp: Date.now() })
    }
    prevPlayerHp.current = playerHp
  }, [playerHp]) // eslint-disable-line react-hooks/exhaustive-deps

  // B6: playsLeft 변화 → 펄스 애니메이션
  useEffect(() => {
    if (playsLeft < prevPlaysLeft.current) {
      setPlaysCountPulse(true)
      setTimeout(() => setPlaysCountPulse(false), getDuration(400))
    }
    prevPlaysLeft.current = playsLeft
  }, [playsLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 1.7: 기운 전환 감지 → 배너 표시
  useEffect(() => {
    if (enemyPhaseSwitch && !prevEnemyPhaseSwitch.current) {
      setPhaseSwitchBanner(true)
      // 5-D: 기믹 대사
      const floorInfo = FLOOR_ENEMY_INFO[currentFloor]
      if (floorInfo?.dialogue) {
        setGimmickDialogue(floorInfo.dialogue)
        setTimeout(() => setGimmickDialogue(null), getDuration(1500))
      }
      setTimeout(() => setPhaseSwitchBanner(false), getDuration(2000))
    }
    prevEnemyPhaseSwitch.current = enemyPhaseSwitch
  }, [enemyPhaseSwitch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 1.8: 토 응축 감지 → 연출
  useEffect(() => {
    if (condenseActive && !prevCondenseActive.current) {
      // 응축 적립
      setCondenseBanner('accumulate')
      setTimeout(() => setCondenseBanner(null), getDuration(2000))
    } else if (!condenseActive && prevCondenseActive.current) {
      // 응축 소모 (폭발)
      setCondenseBanner('explode')
      setTimeout(() => setCondenseBanner(null), getDuration(1500))
    }
    prevCondenseActive.current = condenseActive
  }, [condenseActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 1.7: 강공 감지 → 배너 표시
  useEffect(() => {
    const heavyConf = floorConfig.heavyAttack
    if (heavyConf && attackCount > 0 && attackCount > prevAttackCount.current) {
      if (attackCount % heavyConf.everyN === 0) {
        setHeavyAttackBanner(true)
        setShakeAmplitude(16)
        setShakeActive(true)
        setTimeout(() => setShakeActive(false), getDuration(300))
        setTimeout(() => setHeavyAttackBanner(false), getDuration(2000))
        // Phase 1.8: 강공 카드 플립
        const dmg = heavyConf.damage
        setTimeout(() => {
          setEnemyCardFlip({ label: '強攻', damage: dmg, id: Date.now() })
          setTimeout(() => setEnemyCardFlip(null), getDuration(1200))
        }, getDuration(200))
      }
    }
    prevAttackCount.current = attackCount
  }, [attackCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 1.7: counterPopup 로직은 위 playerHp useEffect에 통합됨 (CRIT-1 fix)

  // C10(b)(c): 층 입장 연출 + 정예/보스 기믹 선언 배너
  useEffect(() => {
    const enemyInfo = FLOOR_ENEMY_INFO[currentFloor]
    if (enemyInfo) {
      setEnemyEntrance(true)
      setEnemyEntranceText(`${enemyInfo.name} · ${ELEMENT_KO[enemyInfo.element]} · ${enemyInfo.gimmickHint}`)
      setTimeout(() => {
        setEnemyEntrance(false)
        setEnemyEntranceText(null)
      }, getDuration(1000))

      // C10(b): 정예/보스 기믹 선언 배너 + 0.5초 입력 잠금
      if (enemyInfo.eliteBanner) {
        const bannerText = enemyInfo.eliteBanner
        setTimeout(() => {
          setGimmickBanner(bannerText)
          // 배너 시작 시 500ms 입력 잠금
          setIsInputLocked(true)
          setTimeout(() => setIsInputLocked(false), getDuration(500))
          setTimeout(() => setGimmickBanner(null), getDuration(2500))
        }, getDuration(500))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFloor])

  // 오행연환 시퀀스 트리거
  const triggerElementalSequence = useCallback(() => {
    console.log('[VFX] 오행연환 시퀀스 시작', { timestamp: Date.now() })
    audioManager.elementalSequenceKoreanPercussion()
    console.log('[SFX] 오행연환 국악 타악 재생', { timestamp: Date.now() })

    setElementalSeq({ active: true, phase: 0, litElements: 0 })

    // 오행별 파티클음: 꽹과리 5개 점등과 동기화
    const elementOrder: Array<'mok' | 'hwa' | 'to' | 'geum' | 'su'> = ['mok', 'hwa', 'to', 'geum', 'su']
    for (let i = 0; i <= 5; i++) {
      setTimeout(() => {
        setElementalSeq(prev => ({ ...prev, phase: 1, litElements: i }))
        // i=1~5: 각 오행 점등 시 파티클음 재생
        if (i >= 1 && i <= 5) {
          audioManager.playParticleSFX(elementOrder[i - 1])
          console.log('[SFX] 오행 파티클음', { element: elementOrder[i - 1], step: i, timestamp: Date.now() })
        }
      }, getDuration(800) + i * getDuration(200))
    }

    setTimeout(() => {
      setElementalSeq(prev => ({ ...prev, phase: 2 }))
      console.log('[VFX] 오행연환 Phase 2 — 폭발+셰이크', { timestamp: Date.now() })
    }, getDuration(1800))

    setTimeout(() => {
      setElementalSeq({ active: false, phase: 0, litElements: 0 })
      console.log('[VFX] 오행연환 시퀀스 종료', { timestamp: Date.now() })
    }, getDuration(2500) + 100)
  }, [getDuration])

  // 카드 선택 사운드
  const handleCardSelect = useCallback((cardId: string) => {
    // B-2: 이종 기운 3장 이상 차단
    const isAlreadySelected = selectedCards.includes(cardId)
    if (!isAlreadySelected && shouldBlockCardSelection(hand, selectedCards, cardId)) {
      // 5기운 전부 있으면 연환 모드이므로 차단 안 함
      if (!hasAllFiveElements) {
        if (blockMsgTimerRef.current) clearTimeout(blockMsgTimerRef.current)
        setBlockMsg(PREVIEW_BLOCKED)
        blockMsgTimerRef.current = setTimeout(() => setBlockMsg(null), 500)
        return  // 선택 자체를 막음
      }
    }

    audioManager.cardSelectTick()
    console.log('[SFX] 카드 선택 틱', { cardId, timestamp: Date.now() })

    // 역극 카드 선택 시 첫 진입 안내
    const card = hand.find(c => c.id === cardId)
    if (card && GEUK_MAP[enemyElement] === card.element) {
      if (!yeokgeukHintShownRef.current) {
        yeokgeukHintShownRef.current = true
        setShowYeokgeukHint(true)
        setTimeout(() => setShowYeokgeukHint(false), 4000)
      }
      // Phase 1.8: 역극 카드 툴팁 (2초)
      const cardElKo = ELEMENT_KO[card.element]
      const enemyElKo = ELEMENT_KO[enemyElement]
      const tooltipText = `오늘 ${cardElKo}의 기운은 힘을 못 쓴다 — 적의 ${enemyElKo}이/가 누르기 때문.`
      if (yeokgeukTooltipTimerRef.current) clearTimeout(yeokgeukTooltipTimerRef.current)
      setYeokgeukTooltip({ cardId, text: tooltipText })
      yeokgeukTooltipTimerRef.current = setTimeout(() => setYeokgeukTooltip(null), 2000)
    }

    toggleCardSelect(cardId)
  }, [toggleCardSelect, hand, selectedCards, enemyElement, hasAllFiveElements, blockMsgTimerRef])

  // 출수 처리
  const handlePlayCards = useCallback(() => {
    if (selectedCards.length === 0 || playsLeft <= 0) return

    if (previewResult && previewResult.rank !== 'none') {
      const rank = previewResult.rank
      let rarity: 'common' | 'rare' | 'hero' = 'common'
      if (rank === 'ohang-yeonhwan' || rank === 'saengchae-chain') rarity = 'hero'
      else if (rank === 'geukchae-chain' || rank === 'eumyang-pair-3' || rank === 'jipgyeol-5') rarity = 'rare'
      audioManager.genealogyMatch(rarity)
      console.log('[SFX] 족보 성립음', { rank, rarity, timestamp: Date.now() })

      if (rank === 'geuk-bonas') {
        setTimeout(() => {
          audioManager.hostileDrum()
          console.log('[SFX] 역극 북소리', { timestamp: Date.now() })
        }, getDuration(80))
      }
      if (rank === 'geukchae-chain') {
        setTimeout(() => {
          audioManager.affinityBonusGong()
          console.log('[SFX] 극 보너스 징', { timestamp: Date.now() })
        }, getDuration(100))
      }
    }

    selectedCards.forEach((_, idx) => {
      setTimeout(() => {
        audioManager.cardLand()
        console.log('[SFX] 카드 착지음', { cardIndex: idx, timestamp: Date.now() })
      }, idx * getDuration(80))
    })

    console.log('[VFX] 출수 처리 — 카드 이동 연출 시작', {
      selectedCount: selectedCards.length,
      rank: previewResult?.rank,
      timestamp: Date.now(),
    })

    // C10(a): 적 돌진 모션 + 대사 (반격 연출) — 출수 후 반격 타이밍에 맞춰
    const enemyInfo = FLOOR_ENEMY_INFO[currentFloor]
    if (enemyInfo) {
      setTimeout(() => {
        setEnemyCharge(true)
        setEnemyDialogue(enemyInfo.dialogue)
        setTimeout(() => {
          setEnemyCharge(false)
          setEnemyDialogue(null)
        }, getDuration(800))
      }, getDuration(200))
    }

    playSelectedCards()
  }, [selectedCards, playsLeft, previewResult, getDuration, playSelectedCards, currentFloor])

  // A4: 훈수 버튼 — 최강 조합 1.5초 하이라이트
  const handleHint = useCallback(() => {
    if (hand.length === 0) return
    // 최강 조합 탐색: 1~5장 모든 조합 중 totalScore 최대
    let bestScore = -1
    let bestIds: string[] = []
    const n = hand.length
    for (let mask = 1; mask < (1 << n); mask++) {
      if ((mask & (mask - 1)) === 0 && n > 1) continue // 1장 단독은 두 번째로
      const chosen: string[] = []
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) chosen.push(hand[i].id)
      }
      if (chosen.length > 5) continue
      const cards = hand.filter(c => chosen.includes(c.id))
      const result = judgeHand(cards)
      if (result.totalScore > bestScore) {
        bestScore = result.totalScore
        bestIds = chosen
      }
    }
    if (bestIds.length > 0) {
      setHintCards(bestIds)
      setHintActive(true)
      setTimeout(() => {
        setHintActive(false)
        setHintCards([])
      }, 1500)
    }
    console.log('[UX] 훈수 버튼 — 최강 조합 하이라이트', { bestIds, bestScore, timestamp: Date.now() })
  }, [hand])

  // Phase 1.9.3: 응축 버튼 핸들러 — 발동 배너 포함
  const handleApplyCondense = useCallback((type: 'basic' | 'great') => {
    // 발동 배너: "옹기가마 — 가마에 굽는다!" (great) / "응축 — 힘을 담는다" (basic)
    const currentSelected = useGameStore.getState().selectedCards
    const currentHand = useGameStore.getState().hand
    const selObjs = currentHand.filter(c => currentSelected.includes(c.id))
    if (selObjs.length >= 2) {
      const comboRes = judgeCombo(selObjs as any)
      const comboName = comboRes.name
      const bannerText = type === 'great'
        ? `${comboName} — 가마에 굽는다!`
        : `${comboName} — 힘을 담는다`
      showBanner(bannerText)
    }
    applyCondenseAction(type)
    // 구슬 연출
    setCondenseOrb(type)
    setTimeout(() => setCondenseOrb(null), type === 'great' ? 2000 : 2500)
  }, [applyCondenseAction, showBanner])

  // B-3: 연환 완성하기 — 각 기운 최고값 카드 1장씩 자동 선택
  const handleYeonhwanComplete = useCallback(() => {
    const FIVE_ELEMENTS: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
    const toSelect: string[] = []
    for (const el of FIVE_ELEMENTS) {
      const candidates = hand.filter(c => c.element === el)
      if (candidates.length === 0) continue
      const best = candidates.reduce((max, c) => c.value > max.value ? c : max)
      toSelect.push(best.id)
    }
    // 현재 선택 초기화 후 5장 선택
    // 이미 선택된 것 포함해서 toggleCardSelect 로직이 복잡하므로
    // 이미 선택 안된 것만 토글
    const currentSelected = new Set(selectedCards)
    // 기존 선택 전부 해제 (해당 5장 외)
    for (const id of selectedCards) {
      if (!toSelect.includes(id)) {
        toggleCardSelect(id)
      }
    }
    for (const id of toSelect) {
      if (!currentSelected.has(id)) {
        toggleCardSelect(id)
      }
    }
    audioManager.cardSelectTick()
    console.log('[B-3] 연환 완성하기 자동 선택', { toSelect, timestamp: Date.now() })
  }, [hand, selectedCards, toggleCardSelect])

  // 버리기 처리
  const handleDiscardCards = useCallback(() => {
    if (selectedCards.length === 0 || discardsLeft <= 0) return
    audioManager.cardDiscardSwish()
    console.log('[SFX] 카드 버리기 스윽', { count: selectedCards.length, timestamp: Date.now() })
    // 5-D CRIT-2 fix: 탁수령(水) 버리기 징벌 대사 — 적 주 기운이 su인 층에서 발동
    const fc = FLOOR_CONFIGS[currentFloor - 1]
    if (fc?.enemyPrimaryElement === 'su' || (enemyPhaseSwitch && fc?.enemySubElement === 'su')) {
      setGimmickDialogue('버린 패가 독이 되어 돌아온다.')
      setTimeout(() => setGimmickDialogue(null), getDuration(1500))
    }
    discardSelectedCards()
  }, [selectedCards, discardsLeft, discardSelectedCards, currentFloor, enemyPhaseSwitch])

  const enemyHpPercent = Math.max(0, (enemyHp / enemyMaxHp) * 100)
  const playerHpPercent = Math.max(0, (playerHp / playerMaxHp) * 100)

  const chainCardPositions = getCardPositions(
    hand.map(c => ({ id: c.id, element: c.element })),
    selectedCards
  )

  const shakeStyle: React.CSSProperties = shakeActive
    ? {
        animation: `screenShake ${getCssDuration(250)} ease-in-out`,
        '--shake-amp': `${shakeAmplitude}px`,
      } as React.CSSProperties
    : {}

  // G1 수정 #2 — 선택 카드들의 극/역극 상태 계산
  const selectedCardObjs = hand.filter(c => selectedCards.includes(c.id))
  const hasGeukOnEnemy = selectedCardObjs.some(c => GEUK_MAP[c.element] === enemyElement)
  const geukAttacker = selectedCardObjs.find(c => GEUK_MAP[c.element] === enemyElement)

  // Phase 1.6 A — 새 전투 규칙 미리보기 계산
  const clashInfo = selectedCardObjs.length > 0 ? detectElementClash(selectedCardObjs) : []
  const geukCalcInfo = selectedCardObjs.length > 0 ? calcGeukBonusMultiplier(selectedCardObjs, enemyElement) : null
  const yeokgeukInfo = selectedCardObjs.length > 0 ? detectYeokgeukPenalty(selectedCardObjs, [enemyElement]) : null
  const primaryEl = selectedCardObjs.length > 0 ? determinePrimaryElement(selectedCardObjs) : null

  // A1: 조합 미리보기 실체화 텍스트
  const getPreviewBannerText = () => {
    if (!previewResult || selectedCards.length === 0) return null
    const parts: string[] = []
    if (previewResult.rank !== 'none') {
      parts.push(`${previewResult.description} · 공격력 ${previewResult.baseScore} × ${previewResult.multiplier}배`)
    } else {
      parts.push('조합 없음 — 낱장 합산')
    }
    return parts.join(' ')
  }

  const getWarningTexts = () => {
    const warnings: string[] = []
    // 기운 충돌 경고
    if (clashInfo.length > 0) {
      const pair = clashInfo[0]
      warnings.push(`${josa(ELEMENT_KO[pair.attacker], '과', '와')} ${josa(ELEMENT_KO[pair.victim], '이', '가')} 부딪힌다 −30%`)
    }
    // 적의 반극 경고
    if (yeokgeukInfo?.hasPenalty && yeokgeukInfo.enemyStrongest && yeokgeukInfo.myPrimary) {
      warnings.push(`적의 ${josa(ELEMENT_KO[yeokgeukInfo.enemyStrongest], '이', '가')} 내 ${josa(ELEMENT_KO[yeokgeukInfo.myPrimary.element], '을', '를')} 누른다 −30%`)
    }
    return warnings
  }

  const getBoostTexts = () => {
    const boosts: string[] = []
    // 주 기운 원칙 극 보너스
    if (geukCalcInfo && geukCalcInfo.multiplier > 1.0) {
      const pct = Math.round((geukCalcInfo.multiplier - 1) * 100)
      if (geukCalcInfo.isMainGeuk) {
        boosts.push(`주 기운 ${josa(ELEMENT_KO[geukCalcInfo.primaryElement?.element ?? 'mok'], '이', '가')} 이긴다 +${pct}%`)
      } else {
        boosts.push(`이기는 기운 있음(주 기운 아님) +${pct}%`)
      }
    }
    // 증폭부 활성
    if (amplifyActive) {
      boosts.push('증폭부 발동 중 ×2')
    }
    return boosts
  }

  // B-1 이전 로직 — 사용 안 함 (신형 buildPreviewText로 대체), 타입 에러 방지
  void getPreviewBannerText
  void getWarningTexts
  void getBoostTexts
  void primaryEl

  const bonusPct = Math.round((GEUK_BONUS_MULTIPLIER - 1) * 100)
  void bonusPct
  void hasGeukOnEnemy
  void geukAttacker

  // G1 수정 #6 — 배경 격자: 4층은 붉은 격자
  const isBossFloor = currentFloor === 4
  const gridColor = isBossFloor
    ? 'rgba(179,58,43,0.04)'
    : 'rgba(200,185,160,0.08)'

  return (
    <>
      {/* 전역 CSS 애니메이션 */}
      <style>{`
        @keyframes scorePop {
          0%   { transform: translate(-50%, -50%) translateY(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) translateY(-60px); opacity: 0; }
        }
        @keyframes chainGlow {
          0%   { opacity: 0; stroke-width: 1; }
          40%  { opacity: 0.9; stroke-width: 3; }
          100% { opacity: 0; stroke-width: 1; }
        }
        @keyframes screenShake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(calc(-1 * var(--shake-amp, 6px))); }
          30%  { transform: translateX(calc(var(--shake-amp, 6px))); }
          50%  { transform: translateX(calc(-0.8 * var(--shake-amp, 6px))); }
          65%  { transform: translateX(calc(0.6 * var(--shake-amp, 6px))); }
          80%  { transform: translateX(calc(-0.3 * var(--shake-amp, 6px))); }
          100% { transform: translateX(0); }
        }
        @keyframes orbRotate {
          0%   { transform: rotate(0deg) scale(0.7); opacity: 0.6; }
          60%  { transform: rotate(270deg) scale(1.1); opacity: 1; }
          100% { transform: rotate(360deg) scale(1); opacity: 1; }
        }
        @keyframes particle0 { to { transform: translate(calc(cos(0rad) * 120px), calc(sin(0rad) * 120px)); opacity: 0; } }
        @keyframes particle1 { to { transform: translate(calc(cos(1.257rad) * 120px), calc(sin(1.257rad) * 120px)); opacity: 0; } }
        @keyframes particle2 { to { transform: translate(calc(cos(2.513rad) * 120px), calc(sin(2.513rad) * 120px)); opacity: 0; } }
        @keyframes particle3 { to { transform: translate(calc(cos(3.77rad) * 120px), calc(sin(3.77rad) * 120px)); opacity: 0; } }
        @keyframes particle4 { to { transform: translate(calc(cos(5.027rad) * 120px), calc(sin(5.027rad) * 120px)); opacity: 0; } }
        @keyframes fadeInScale {
          0%   { opacity: 0; transform: scale(0.94); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes inlineBannerIn {
          0%   { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes previewBounce {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        @keyframes geukPulse {
          0%   { opacity: 0.85; box-shadow: 0 0 6px var(--glow); }
          50%  { opacity: 1; box-shadow: 0 0 14px var(--glow); }
          100% { opacity: 0.85; box-shadow: 0 0 6px var(--glow); }
        }
        @keyframes slideInRow {
          0%   { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes yeokgeukInk {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes hitFlash {
          0%   { opacity: 0.5; }
          40%  { opacity: 0.8; }
          100% { opacity: 0; }
        }
        @keyframes playsCountPulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.3); color: #C63D2F; }
          100% { transform: scale(1); }
        }
        @keyframes enemyCharge {
          0%   { transform: translateX(0); }
          30%  { transform: translateX(18px); }
          60%  { transform: translateX(-4px); }
          100% { transform: translateX(0); }
        }
        @keyframes heroChargeAnim {
          0%   { transform: translateX(0); }
          30%  { transform: translateX(12px); }
          100% { transform: translateX(0); }
        }
        @keyframes spiritOrbIn {
          0%   { opacity: 0; transform: scale(0.3) translateX(30px); }
          60%  { opacity: 1; transform: scale(1.1) translateX(-4px); }
          100% { opacity: 0.8; transform: scale(1) translateX(0); }
        }
        @keyframes spiritOrbFly {
          0%   { opacity: 0.8; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(120px) scale(0.4); }
        }
        @keyframes entranceBanner {
          0%   { opacity: 0; transform: translateY(-10px); }
          20%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes dialogueFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes gimmickBannerIn {
          0%   { opacity: 0; transform: scale(0.9); }
          30%  { opacity: 1; transform: scale(1.02); }
          70%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; }
        }
        @keyframes yeonhwanShimmer {
          0%   { box-shadow: 0 0 4px #FFD98A; border-color: #D9A441; }
          50%  { box-shadow: 0 0 16px #FFD98A, 0 0 32px rgba(255,217,138,0.5); border-color: #FFD98A; }
          100% { box-shadow: 0 0 4px #FFD98A; border-color: #D9A441; }
        }
        @keyframes yeonhwanButtonShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes condensePulse {
          0%   { opacity: 1; box-shadow: 0 0 6px rgba(217,164,65,0.8); }
          50%  { opacity: 0.6; box-shadow: 0 0 12px rgba(217,164,65,0.5); }
          100% { opacity: 1; box-shadow: 0 0 6px rgba(217,164,65,0.8); }
        }
        @keyframes geukArrowPulse {
          0%   { opacity: 0.7; transform: translateX(-50%) translateY(0); }
          50%  { opacity: 1; transform: translateX(-50%) translateY(-5px); }
          100% { opacity: 0.7; transform: translateX(-50%) translateY(0); }
        }
        @keyframes dangerBorderPulse {
          0%   { box-shadow: inset 0 0 0 2px rgba(198,61,47,0.6); }
          50%  { box-shadow: inset 0 0 0 2px rgba(198,61,47,1); }
          100% { box-shadow: inset 0 0 0 2px rgba(198,61,47,0.6); }
        }
        @keyframes hpBarShake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-4px); }
          40%  { transform: translateX(4px); }
          60%  { transform: translateX(-3px); }
          80%  { transform: translateX(2px); }
          100% { transform: translateX(0); }
        }
        @keyframes counterPopup {
          0%   { opacity: 1; transform: translateY(0); }
          60%  { opacity: 1; transform: translateY(-20px); }
          100% { opacity: 0; transform: translateY(-35px); }
        }
        @keyframes hpBarDanger {
          0%   { opacity: 0.6; }
          50%  { opacity: 1; }
          100% { opacity: 0.6; }
        }
        @keyframes condenseBannerIn {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
          30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
          70%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes condenseExplode {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          20%  { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          60%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
        @keyframes pulseBadge {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @keyframes cardFlipIn {
          0%   { transform: rotateY(0deg); }
          50%  { transform: rotateY(90deg); }
          100% { transform: rotateY(180deg); }
        }
        @keyframes cardFlipFadeOut {
          0%   { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes chainPopupIn {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          25%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          70%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
        /* Phase 1.9.2 애니메이션 */
        @keyframes sealShimmer {
          0%   { box-shadow: 0 0 3px rgba(212, 175, 55, 0.5); }
          50%  { box-shadow: 0 0 8px rgba(212, 175, 55, 0.9), 0 0 14px rgba(240, 208, 80, 0.4); }
          100% { box-shadow: 0 0 3px rgba(212, 175, 55, 0.5); }
        }
        @keyframes textPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.65; }
        }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1.0); box-shadow: 0 0 6px rgba(217, 164, 65, 0.8); }
          50%       { transform: scale(1.12); box-shadow: 0 0 12px rgba(217, 164, 65, 1.0); }
        }
        @keyframes superOrbPulse {
          0%, 100% { transform: scale(1.0); box-shadow: 0 0 10px rgba(255, 140, 0, 0.9); }
          50%       { transform: scale(1.18); box-shadow: 0 0 18px rgba(255, 140, 0, 1.0), 0 0 30px rgba(212, 175, 55, 0.6); }
        }
        @keyframes fireRise {
          0%   { opacity: 0; transform: translateX(-50%) translateY(0); }
          20%  { opacity: 1; transform: translateX(-50%) translateY(-4px); }
          80%  { opacity: 1; transform: translateX(-50%) translateY(-12px); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-24px); }
        }
        @keyframes metalSlash {
          0%   { opacity: 0; transform: translateX(-80%); }
          15%  { opacity: 1; transform: translateX(-50%); }
          75%  { opacity: 1; transform: translateX(-50%); }
          100% { opacity: 0; transform: translateX(-20%); }
        }
        @keyframes geukiBannerFade {
          0%   { opacity: 0; }
          10%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* B-4: 응축 최초 툴팁 (localStorage 1회) */}
      {showCondenseTooltip && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 250,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(22,19,15,0.6)',
        }}>
          <div style={{
            maxWidth: '280px',
            width: '90%',
            backgroundColor: 'rgba(28,23,16,0.95)',
            border: '1px solid #D9A441',
            borderRadius: '4px',
            padding: '16px 20px',
            textAlign: 'center',
          }}>
            <div style={{
              color: '#D8CCB4',
              fontSize: '13px',
              lineHeight: '1.7',
              letterSpacing: '0.04em',
              marginBottom: '16px',
            }}>
              "흙은 힘을 모은다 —<br />지금은 약하게, 다음에 크게."
            </div>
            <button
              onClick={handleCondenseTooltipClose}
              style={{
                width: '44px',
                height: '36px',
                backgroundColor: '#D9A441',
                border: 'none',
                color: '#1C1710',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '2px',
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Phase 1.9.2: 특성 최초 발동 툴팁 */}
      {traitTooltip && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 350,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(22,19,15,0.7)',
        }}>
          <div style={{
            background: 'rgba(28,23,16,0.97)',
            border: '1px solid rgba(216,204,180,0.3)',
            borderRadius: '4px',
            padding: '12px 16px',
            maxWidth: '280px',
            fontSize: '13px',
            color: '#D8CCB4',
            position: 'relative',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#E8D8A0' }}>
              {traitTooltip === 'fire' ? '연소 (火 특성)' : '관통 (金 특성)'}
            </div>
            <div style={{ lineHeight: '1.6', marginBottom: '10px' }}>
              {traitTooltip === 'fire'
                ? '화 주 기운 조합은 즉시 피해 +30%.\n사용한 화 카드는 값이 줄어든다.'
                : '금 주 기운 조합은 적의 보호·피해감소를\n무시하고 꿰뚫는다.'}
            </div>
            <button
              onClick={() => {
                const key = traitTooltip === 'fire'
                  ? 'paljajeon_trait_fire_burn_explained'
                  : 'paljajeon_trait_metal_pierce_explained'
                try { localStorage.setItem(key, '1') } catch { /* noop */ }
                setTraitTooltip(null)
              }}
              style={{
                background: '#D8CCB4', color: '#1C1710',
                height: '36px', width: '100%',
                border: 'none', borderRadius: '4px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >확인</button>
          </div>
        </div>
      )}

      {/* 오행연환 오버레이 */}
      <ElementalSequenceOverlay seq={elementalSeq} getCssDuration={getCssDuration} />

      {/* A2: 순환 도표 오버레이 */}
      {showCycleChart && (
        <CycleChartOverlay onClose={() => setShowCycleChart(false)} enemyElement={enemyElement} />
      )}

      {/* 3-B: 조합 도감 오버레이 */}
      {showComboGuide && <ComboGuide onClose={() => setShowComboGuide(false)} />}

      {/* C10(b): 기믹 선언 배너 */}
      {gimmickBanner && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 180,
          backgroundColor: 'rgba(22,19,15,0.97)',
          border: '2px solid #B33A2B',
          padding: '20px 32px',
          textAlign: 'center',
          color: '#D9A441',
          fontSize: '15px',
          letterSpacing: '0.08em',
          lineHeight: '1.6',
          maxWidth: '300px',
          animation: `gimmickBannerIn 2500ms ease-out forwards`,
          pointerEvents: 'none',
        }}>
          {gimmickBanner}
        </div>
      )}

      {/* Phase 1.9.2: 특성 배너 (화 연소 / 금 관통) */}
      {traitBanner?.type === 'fire' && (
        <div
          key={traitBanner.key}
          style={{
            position: 'fixed',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '16px',
            fontWeight: 700,
            color: '#FF6B35',
            textShadow: '0 0 8px rgba(255,107,53,0.8), 0 0 16px rgba(255,60,0,0.4)',
            letterSpacing: '0.08em',
            pointerEvents: 'none',
            zIndex: 200,
            whiteSpace: 'nowrap',
            animation: 'fireRise 1.5s ease-out forwards',
          }}
        >
          {TRAIT_BANNER_TEMPLATES.fireBurn(traitBanner?.bonus ?? 0)}
        </div>
      )}
      {traitBanner?.type === 'metal' && (
        <div
          key={traitBanner.key}
          style={{
            position: 'fixed',
            top: '20%',
            left: '50%',
            fontSize: '16px',
            fontWeight: 700,
            background: 'linear-gradient(90deg, #C0C0C0, #E8F4FD, #C0C0C0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 4px rgba(192,192,192,0.6))',
            letterSpacing: '0.12em',
            pointerEvents: 'none',
            zIndex: 200,
            whiteSpace: 'nowrap',
            animation: 'metalSlash 1.5s ease-out forwards',
          }}
        >
          {TRAIT_BANNER_TEMPLATES.metalPierce(traitBanner?.ignored ?? 0)}
        </div>
      )}

      {/* Phase 1.9.4: 덱 재순환 배너 */}
      {reshuffleBanner && (
        <div
          style={{
            position: 'fixed',
            top: '28%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '14px',
            fontWeight: 600,
            color: '#D8CCB4',
            textShadow: '0 0 6px rgba(216,204,180,0.5)',
            letterSpacing: '0.1em',
            pointerEvents: 'none',
            zIndex: 200,
            whiteSpace: 'nowrap',
            animation: 'fireRise 1.5s ease-out forwards',
          }}
        >
          패를 다시 섞는다.
        </div>
      )}

      {/* B8: 피격 플래시 오버레이 */}
      {hitFlash && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(198,61,47,0.35)',
          zIndex: 160,
          pointerEvents: 'none',
          animation: `hitFlash ${getCssDuration(300)} ease-out forwards`,
        }} />
      )}

      {/* B6: 마지막 기회 — 화면 전체 테두리 붉은 경고 pulse */}
      {playsLeft === 1 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 155,
          animation: 'dangerBorderPulse 800ms ease-in-out infinite',
        }} />
      )}

      {/* A5: 첫 판 가이드 */}
      {tutorialStep !== null && (
        <FirstGameGuide
          step={tutorialStep}
          onNext={handleTutorialNext}
          onPrev={handleTutorialPrev}
          onSkip={handleTutorialSkip}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          // G1 수정 #6 — 배경: 격자 0.08/40px + 한지 노이즈 오버레이
          backgroundColor: '#221D17',
          backgroundImage: `
            radial-gradient(ellipse at 20% 50%, rgba(232,220,196,0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(232,220,196,0.02) 0%, transparent 40%),
            linear-gradient(${gridColor} 1px, transparent 1px),
            linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 40px 40px, 40px 40px',
          overflow: 'hidden',
          ...shakeStyle,
        }}
      >
        {/* 3-B: 패시브 발동 배너 */}
        <PassiveActivationBanner
          passiveName={activationState.passiveName}
          visible={activationState.bannerVisible}
        />

        {/* B6: 남은 공격 횟수 — 중앙 상단 크게 */}
        <div style={{
          textAlign: 'center',
          padding: '6px 0 2px',
          backgroundColor: '#1C1710',
          borderBottom: playsLeft === 1 ? '1px solid #C63D2F' : '1px solid #2A2620',
          // B6: 마지막 공격 기회 — 테두리 붉은 경고
          boxShadow: playsLeft === 1 ? '0 0 16px rgba(198,61,47,0.4)' : 'none',
          position: 'relative',
        }}>
          <span
            style={{
              color: playsLeft === 1 ? '#C63D2F' : playsLeft <= 2 ? '#D9A441' : '#E8DCC4',
              fontSize: playsLeft === 1 ? '26px' : '22px',
              fontWeight: 'bold',
              letterSpacing: '0.05em',
              fontVariantNumeric: 'tabular-nums',
              animation: playsCountPulse ? `playsCountPulse ${getCssDuration(400)} ease-out` : undefined,
            }}
          >
            남은 공격 {playsLeft}회
          </span>
          {playsLeft === 1 && (
            <span style={{ color: '#C63D2F', fontSize: '11px', marginLeft: '8px', letterSpacing: '0.1em' }}>
              마지막 기회
            </span>
          )}
          {condenseActive && (
            <span style={{
              color: '#D9A441',
              fontSize: '11px',
              marginLeft: '8px',
              letterSpacing: '0.06em',
              backgroundColor: 'rgba(140,90,30,0.4)',
              border: '1px solid #D9A441',
              padding: '1px 6px',
              borderRadius: '2px',
              animation: 'pulseBadge 1.5s ease-in-out infinite',
            }}>
              응축 중
            </span>
          )}
        </div>

        {/* 상단바: 층수·체력 */}
        <div
          style={{
            backgroundColor: '#1C1710',
            padding: '6px 16px',
            borderBottom: '1px solid #2A2620',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '40px',
          }}
        >
          <span style={{ color: '#B33A2B', fontSize: '13px', letterSpacing: '0.1em' }}>
            {currentFloor}층{isBossFloor ? ' — 보스' : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={togglePlaybackSpeed}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #4A4540',
                color: playbackSpeed === 2 ? '#D9A441' : '#6A6560',
                fontSize: '11px',
                padding: '2px 6px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                minWidth: '32px',
                minHeight: '24px',
              }}
              title="배속 전환 (1x/2x)"
            >
              {playbackSpeed}x
            </button>
            {/* B8: 체력바 — 피격 시 hpBarShake 흔들림 */}
            <div
              style={{
                width: '80px', height: '6px',
                backgroundColor: '#2A2620', borderRadius: '3px', overflow: 'hidden',
                animation: hpBarShake ? `hpBarShake ${getCssDuration(150)} ease-out` : undefined,
              }}
            >
              <div
                style={{
                  width: `${playerHpPercent}%`, height: '100%',
                  backgroundColor: '#4A9B6E',
                  transition: `width ${getCssDuration(300)}`,
                }}
              />
            </div>
            <span style={{ color: '#D8CCB4', fontSize: '12px' }}>{playerHp}/{playerMaxHp}</span>
          </div>
        </div>

        {/* A2: 순환 바 상시 표시 */}
        <div
          style={{
            backgroundColor: '#1A1510',
            borderBottom: '1px solid #2A2620',
            padding: '4px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setShowCycleChart(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {(['mok', 'hwa', 'to', 'geum', 'su'] as Element[]).map((el, idx) => (
              <span key={el} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span
                  style={{
                    color: el === enemyElement ? ELEMENT_COLORS[el] : '#6A6560',
                    fontSize: '13px',
                    fontWeight: el === enemyElement ? 'bold' : 'normal',
                    textShadow: el === enemyElement ? `0 0 6px ${ELEMENT_GLOW_COLORS[el]}` : 'none',
                    borderBottom: el === enemyElement ? `2px solid ${ELEMENT_COLORS[el]}` : '2px solid transparent',
                    paddingBottom: '1px',
                  }}
                >
                  {ELEMENT_KO[el]}
                </span>
                {idx < 4 && <span style={{ color: '#4A4540', fontSize: '10px' }}>→</span>}
              </span>
            ))}
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* A4: 훈수 버튼 */}
            <button
              onClick={handleHint}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #4A4540',
                color: '#8A8580',
                fontSize: '12px',
                cursor: 'pointer',
                letterSpacing: '0.08em',
                width: '40px',
                height: '32px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              훈수
            </button>
            {/* 3-B: 조합 도감 버튼 */}
            <button
              onClick={() => setShowComboGuide(true)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #4A4540',
                color: '#6A6560',
                fontSize: '14px',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: comboGuideButtonPulse ? 'pulseBadge 1.5s ease-in-out infinite' : undefined,
              }}
              title="조합 도감"
            >
              册
            </button>
          </div>
        </div>

        {/* 적 영역 (24vh) */}
        <div
          style={{
            height: '24vh',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            position: 'relative',
          }}
        >
          {/* C10(c): 층 입장 연출 배너 */}
          {enemyEntrance && enemyEntranceText && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(22,19,15,0.95)',
              textAlign: 'center',
              padding: '10px 16px',
              color: '#D9A441',
              fontSize: '13px',
              letterSpacing: '0.08em',
              zIndex: 10,
              animation: `entranceBanner ${getCssDuration(1000)} ease-out forwards`,
              pointerEvents: 'none',
            }}>
              {enemyEntranceText}
            </div>
          )}

          {/* C10(a): 적 돌진 모션 + 대사 */}
          {enemyCharge && enemyDialogue && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#C63D2F',
              fontSize: '12px',
              fontStyle: 'italic',
              letterSpacing: '0.05em',
              zIndex: 10,
              animation: `dialogueFadeIn ${getCssDuration(200)} ease-out forwards`,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}>
              "{enemyDialogue}"
            </div>
          )}

          {/* Phase 1.8: 토 응축 배너 */}
          {condenseBanner === 'accumulate' && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              zIndex: 25,
              backgroundColor: 'rgba(140,90,30,0.95)',
              color: '#FFD98A',
              fontSize: '14px',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              padding: '8px 20px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              animation: `condenseBannerIn ${getCssDuration(2000)} ease-out forwards`,
            }}>
              힘을 응축했다
            </div>
          )}
          {condenseBanner === 'explode' && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              zIndex: 25,
              backgroundColor: 'rgba(200,150,0,0.97)',
              color: '#16130F',
              fontSize: '18px',
              fontWeight: 'bold',
              letterSpacing: '0.12em',
              padding: '10px 24px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              animation: `condenseExplode ${getCssDuration(1500)} ease-out forwards`,
            }}>
              응축 폭발!
            </div>
          )}

          {/* Phase 1.7: 기운 전환 배너 */}
          {phaseSwitchBanner && (
            <div style={{
              position: 'absolute',
              top: '4px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(198,61,47,0.9)',
              color: '#E8DCC4',
              fontSize: '14px',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              padding: '6px 16px',
              borderRadius: '2px',
              zIndex: 20,
              whiteSpace: 'nowrap',
              animation: `gimmickBannerIn ${getCssDuration(2000)} ease-out forwards`,
              pointerEvents: 'none',
            }}>
              기운이 뒤집힌다!
            </div>
          )}

          {/* Phase 1.7: 강공 배너 */}
          {heavyAttackBanner && (
            <div style={{
              position: 'absolute',
              top: phaseSwitchBanner ? '40px' : '4px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(180,80,0,0.9)',
              color: '#FFD98A',
              fontSize: '14px',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              padding: '6px 16px',
              borderRadius: '2px',
              zIndex: 20,
              whiteSpace: 'nowrap',
              animation: `gimmickBannerIn ${getCssDuration(2000)} ease-out forwards`,
              pointerEvents: 'none',
            }}>
              격랑(激浪) — 강공!
            </div>
          )}

          {/* 기믹 대사 (5-D) */}
          {gimmickDialogue && (
            <div style={{
              position: 'absolute',
              bottom: '4px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#C63D2F',
              fontSize: '11px',
              fontStyle: 'italic',
              letterSpacing: '0.04em',
              zIndex: 15,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>
              "{gimmickDialogue}"
            </div>
          )}

          {/* Phase 1.8: 적 패 카드 슬롯 */}
          <div style={{ position: 'absolute', right: '8px', top: '8px', display: 'flex', gap: '4px' }}>
            {/* 강공 카운트다운 카드 (뒷면) */}
            {floorConfig.heavyAttack && (
              <div style={{
                width: '32px',
                height: '45px',
                backgroundColor: '#3A1A14',
                border: '1px solid #5A2A20',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                color: '#D9A441',
                letterSpacing: '0.02em',
                position: 'relative',
              }}>
                <span style={{ fontSize: '8px', color: '#C63D2F' }}>
                  {floorConfig.heavyAttack.everyN - (attackCount % floorConfig.heavyAttack.everyN)}
                </span>
              </div>
            )}
            {/* 반격 카드 (뒷면 상시, 플립 발동 시 앞면) */}
            <div
              key={enemyCardFlip?.id}
              style={{
                width: '32px',
                height: '45px',
                backgroundColor: enemyCardFlip ? '#C63D2F' : '#3A1A14',
                border: `1px solid ${enemyCardFlip ? '#FF7A5C' : '#5A2A20'}`,
                borderRadius: '2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                color: enemyCardFlip ? '#E8DCC4' : '#5A2A20',
                perspective: '200px',
                animation: enemyCardFlip
                  ? `cardFlipFadeOut ${getCssDuration(1200)} ease-out forwards`
                  : undefined,
              }}
            >
              {enemyCardFlip ? (
                <div style={{ textAlign: 'center', lineHeight: 1.2, animation: `cardFlipIn ${getCssDuration(400)} ease-out` }}>
                  <div style={{ fontSize: '12px' }}>{enemyCardFlip.label}</div>
                  <div style={{ fontSize: '9px', color: '#FFD98A' }}>{enemyCardFlip.damage}</div>
                </div>
              ) : (
                <span style={{ fontSize: '14px', opacity: 0.4 }}>≡</span>
              )}
            </div>
          </div>

          {/* 적 이름 + 주/부 기운 뱃지 (C10 돌진 모션 적용) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            animation: enemyCharge ? `enemyCharge ${getCssDuration(500)} ease-out` : undefined,
          }}>
            <span style={{ color: '#D8CCB4', fontSize: '15px', letterSpacing: '0.1em' }}>
              {floorConfig.enemyName}
            </span>
            {/* 4-C: 주 기운 뱃지 */}
            <div
              style={{
                backgroundColor: ELEMENT_BG_COLORS[currentPrimaryElement],
                border: `1px solid ${ELEMENT_COLORS[currentPrimaryElement]}`,
                color: ELEMENT_COLORS[currentPrimaryElement],
                padding: '3px 8px',
                letterSpacing: '0.05em',
                borderRadius: '2px',
                boxShadow: `0 0 6px ${ELEMENT_GLOW_COLORS[currentPrimaryElement]}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                lineHeight: 1.1,
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{ELEMENT_LABELS[currentPrimaryElement]}</span>
              <span style={{ fontSize: '9px', opacity: 0.85 }}>{ELEMENT_KO[currentPrimaryElement]}</span>
            </div>
            {/* 4-C: 부 기운 뱃지 (작게) */}
            <div
              style={{
                backgroundColor: 'rgba(42,38,32,0.7)',
                border: `1px solid ${ELEMENT_COLORS[currentSubElement]}`,
                color: ELEMENT_COLORS[currentSubElement],
                padding: '2px 6px',
                letterSpacing: '0.03em',
                borderRadius: '2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                lineHeight: 1.1,
                opacity: 0.75,
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{ELEMENT_LABELS[currentSubElement]}</span>
              <span style={{ fontSize: '8px', opacity: 0.85 }}>{ELEMENT_KO[currentSubElement]}</span>
            </div>
          </div>

          {/* 4-C: 3층+ 가호 1줄 텍스트 */}
          {currentFloor >= 3 && floorConfig.enemyGimmick && (
            <div style={{ fontSize: '10px', color: '#C63D2F', letterSpacing: '0.06em', textAlign: 'center' }}>
              {currentFloor === 3
                ? `${floorConfig.enemyGimmick}: 가호 2칸 봉인`
                : `${floorConfig.enemyGimmick}: 피해 -30%`
              }
              {currentFloor === 4 && ' | 폭풍격: 기운 전환 후 반격 강화'}
            </div>
          )}

          {/* 4-C: 강공 예고 */}
          {floorConfig.heavyAttack && (
            <div style={{ fontSize: '10px', color: '#D9A441', letterSpacing: '0.04em' }}>
              {(() => {
                const everyN = floorConfig.heavyAttack!.everyN
                const dmg = floorConfig.heavyAttack!.damage
                const remaining = everyN - (attackCount % everyN)
                return `${remaining}번째 공격 후 — 강공 ${dmg}`
              })()}
            </div>
          )}

          {/* 적 HP바 */}
          <div style={{ width: '100%', maxWidth: '240px' }}>
            <div
              style={{
                width: '100%', height: '8px',
                backgroundColor: '#2A2620', borderRadius: '4px', overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${enemyHpPercent}%`, height: '100%',
                  backgroundColor: '#C63D2F',
                  transition: `width ${getCssDuration(300)}`,
                }}
              />
            </div>
            <div style={{ color: '#6A6560', fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
              {enemyHp} / {enemyMaxHp}
            </div>
          </div>

          {/* Phase 1.9.2: 기세 죽음 전투 진입 배너 */}
          {geukiBanner && (
            <div style={{
              background: 'rgba(139, 115, 85, 0.85)',
              border: '1px solid rgba(139, 115, 85, 0.6)',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              color: '#D8CCB4',
              letterSpacing: '0.05em',
              textAlign: 'center',
              pointerEvents: 'none',
              animation: 'geukiBannerFade 3.8s ease-out forwards',
            }}>
              {geukiBanner}
            </div>
          )}

          {/* 피해 내역 패널: 적 HP바 아래 인라인 배치 */}
          <DamageBreakdownPanel breakdown={damageBreakdown} getCssDuration={getCssDuration} />

          {/* B7: 예측 표시 */}
          {predictionText && (
            <div style={{
              color: predictionText.includes('한 방') ? '#D9A441' : '#D8CCB4',
              fontSize: '12px',
              letterSpacing: '0.05em',
              fontWeight: predictionText.includes('한 방') ? 'bold' : 'normal',
              animation: `fadeInScale ${getCssDuration(200)} ease-out`,
            }}>
              {predictionText}
            </div>
          )}

          {/* A1: 반격 예고 (한글화) */}
          {!damageBreakdown.visible && !predictionText && (
            <div style={{ color: '#4A4540', fontSize: '11px' }}>
              공격마다 반격 {floorConfig.counterDamage} 피해
            </div>
          )}

          {/* A1: 극 성립 시 뱃지 — "물이 불을 이긴다 +50%" 형식 */}
          {hasGeukOnEnemy && geukAttacker && (
            <div
              style={{
                backgroundColor: ELEMENT_BG_COLORS[geukAttacker.element],
                border: `1px solid ${ELEMENT_GLOW_COLORS[geukAttacker.element]}`,
                color: ELEMENT_GLOW_COLORS[geukAttacker.element],
                fontSize: '12px',
                padding: '3px 10px',
                letterSpacing: '0.05em',
                borderRadius: '2px',
                '--glow': ELEMENT_GLOW_COLORS[geukAttacker.element],
                animation: 'geukPulse 1.5s ease-in-out infinite',
              } as React.CSSProperties}
            >
              {getGeukKoLabel(geukAttacker.element, enemyElement, bonusPct)}
            </div>
          )}

          {/* Score Popup */}
          {scorePopups.map(item => (
            <ScorePopup key={item.id} item={item} getCssDuration={getCssDuration} />
          ))}
        </div>

        {/* Phase 1.8: 기운 잇기 팝업 */}
        {chainPopup && (
          <div style={{
            position: 'fixed',
            top: '40%',
            left: '50%',
            zIndex: 190,
            color: '#D9A441',
            fontSize: '22px',
            fontWeight: 'bold',
            letterSpacing: '0.08em',
            pointerEvents: 'none',
            textShadow: '0 0 20px rgba(217,164,65,0.8)',
            animation: `chainPopupIn ${getCssDuration(1500)} ease-out forwards`,
          }}>
            {chainPopup.text}
          </div>
        )}

        {/* Phase 1.9.2: 미리보기 패널 (6종 상태 + 차단 안내) */}
        {(() => {
          // blockMsg 우선: 이종 3장 차단 시도 안내
          if (blockMsg) {
            return (
              <div style={{
                background: 'rgba(28,23,16,0.9)',
                border: '1px solid rgba(216,204,180,0.2)',
                borderRadius: '4px',
                padding: '8px 12px',
                minHeight: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '12px', color: '#D9A441', letterSpacing: '0.04em', textAlign: 'center' }}>
                  {blockMsg}
                </span>
              </div>
            )
          }

          const preview = buildPreviewText(
            selectedCardObjs,
            enemyElement,
            { hasAllFive: hasAllFiveElements },
          )

          // condenseInfo: 토 타격 조합
          // Phase 1.9.4: 저장형 응축 미리보기 —
          // "옹기가마 (土) · 공격: 예상 45 / 대응축: 45를 굽는다 → 다음 공격 +90"
          if (preview?.condenseInfo) {
            const { attack, type, comboName } = preview.condenseInfo
            const mult = type === 'great' ? 2.0 : 1.5
            const savedBonus = Math.round(attack * mult)
            const label = type === 'great' ? '대응축' : '응축'
            const verbPhrase = type === 'great' ? '를 굽는다' : '를 담는다'
            const labelColor = type === 'great' ? '#FF8C40' : '#D9A441'
            return (
              <div style={{
                background: 'rgba(28,23,16,0.9)',
                border: '1px solid rgba(216,204,180,0.2)',
                borderRadius: '4px',
                padding: '8px 12px',
                minHeight: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                gap: '6px',
                flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '13px', color: '#D9A441', fontWeight: 700 }}>{comboName} (土)</span>
                <span style={{ fontSize: '13px', color: '#4A4540' }}>·</span>
                <span style={{ fontSize: '13px', color: '#FFFDF7' }}>공격: 예상 {attack}</span>
                <span style={{ fontSize: '13px', color: '#4A4540' }}>/</span>
                <span style={{ fontSize: '13px', color: labelColor, fontWeight: type === 'great' ? 700 : 600 }}>
                  {label}: {attack}{verbPhrase} → 다음 공격 +{savedBonus}
                </span>
              </div>
            )
          }

          if (!preview) return null

          const isIdleState = preview.isIdle
          const isYeonhwan = preview.isYeonhwanReady
          const isInvalid = preview.isInvalidCombo

          return (
            <div
              style={{
                background: 'rgba(28,23,16,0.9)',
                border: '1px solid rgba(216,204,180,0.2)',
                borderRadius: '4px',
                padding: '8px 12px',
                minHeight: '44px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                gap: '4px',
              }}
            >
              <div
                style={{
                  animation: previewBounce && !isIdleState && !isYeonhwan ? `previewBounce 220ms ease-out` : undefined,
                  textAlign: 'center',
                }}
              >
                <span style={{
                  color: preview.line1Color,
                  fontSize: isIdleState || isInvalid ? '12px' : '13px',
                  fontStyle: isIdleState ? 'italic' : 'normal',
                  fontWeight: (!isIdleState && !isInvalid) ? 600 : 400,
                  letterSpacing: '0.04em',
                  animation: isYeonhwan ? 'textPulse 1.5s ease-in-out infinite' : undefined,
                }}>
                  {isYeonhwan && !preview.line1.startsWith('오행연환') && '✦ '}{preview.line1}
                </span>
              </div>
              {preview.line2 && (
                <div style={{
                  color: '#D8CCB4', fontSize: '12px',
                  letterSpacing: '0.03em', opacity: 0.85, textAlign: 'center',
                }}>
                  {preview.line2}
                </div>
              )}
            </div>
          )
        })()}

        {/* G1 수정 #4 — 인라인 안내 배너 (핸드 위) */}
        <InlineBanner message={bannerMessage} visible={bannerVisible} getCssDuration={getCssDuration} />

        {/* 핸드 + 부적 슬롯 (가로 배치) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Phase 1.6 B — 부적 슬롯 바 (우측) */}
        <TalismanBar
          talismans={talismans}
          amplifyActive={amplifyActive}
          onUse={(id: TalismanId) => {
            if (id === 'jeonghwa') useJeonghwa()
            else if (id === 'hwanpae') useHwanpae()
            else if (id === 'jeungpok') useJeungpok()
          }}
        />

        {/* 핸드 부채꼴 + Chain Glow SVG */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 4px 0 4px',
            overflowX: 'hidden',
            gap: '2px',
            position: 'relative',
          }}
        >
          {/* D11: 영웅 실루엣 (좌하단 상주) */}
          <div style={{
            position: 'absolute',
            left: '4px',
            bottom: '4px',
            zIndex: 5,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}>
            {/* 영웅 실루엣 + 오행색 글로우 */}
            <div style={{
              width: '36px',
              height: '50px',
              position: 'relative',
              animation: heroCharge ? `heroChargeAnim ${getCssDuration(400)} ease-out` : undefined,
            }}>
              {/* D11: 영웅 실루엣 — 플레이어 기운 금색(#FFD98A) 글로우 */}
              <svg width="36" height="50" viewBox="0 0 36 50" style={{ position: 'absolute', inset: 0 }}>
                <ellipse cx="18" cy="10" rx="7" ry="8" fill="#FFD98A" opacity="0.3" />
                <rect x="10" y="18" width="16" height="22" rx="3" fill="#FFD98A" opacity="0.2" />
                <rect x="10" y="40" width="6" height="10" rx="2" fill="#FFD98A" opacity="0.2" />
                <rect x="20" y="40" width="6" height="10" rx="2" fill="#FFD98A" opacity="0.2" />
                {/* 글로우 외곽선 */}
                <ellipse cx="18" cy="10" rx="7" ry="8" fill="none" stroke="#D9A441" strokeWidth="1.5" opacity="0.7" />
                <rect x="10" y="18" width="16" height="22" rx="3" fill="none" stroke="#D9A441" strokeWidth="1.5" opacity="0.6" />
                {/* 팔자 — 소형 텍스트 */}
                <text x="18" y="34" textAnchor="middle" fontSize="6" fill="#D9A441" opacity="0.6" fontWeight="bold">팔자</text>
              </svg>
              {/* Phase 1.9.4: 응축 저장형 구슬 + 라벨 "응축 +N 대기" */}
            {condenseType === 'basic' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px',
              }}>
                <div style={{
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: 'radial-gradient(circle at 30% 30%, #FFE8A8, #D9A441)',
                  boxShadow: '0 0 6px rgba(217,164,65,0.8)',
                  flexShrink: 0,
                  animation: 'orbPulse 1.5s ease-in-out infinite',
                }} />
                <span style={{ color: '#D9A441', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  {condensedDamage > 0
                    ? `응축 +${Math.round(condensedDamage * 1.5)} 대기`
                    : '응축 대기 중'}
                </span>
              </div>
            )}
            {condenseType === 'great' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px',
              }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: 'radial-gradient(circle at 30% 30%, #FFFA80, #FF8C00, #D4AF37)',
                  boxShadow: '0 0 10px rgba(255,140,0,0.9), 0 0 20px rgba(212,175,55,0.5)',
                  flexShrink: 0,
                  animation: 'superOrbPulse 1.0s ease-in-out infinite',
                }} />
                <span style={{ color: '#FF8C40', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  {condensedDamage > 0
                    ? `대응축 +${Math.round(condensedDamage * 2.0)} 대기`
                    : '대응축 대기 중'}
                </span>
              </div>
            )}
            {/* 응축 발동 시 연출 구슬 (일회성) */}
            {condenseOrb === 'basic' && (
              <div style={{
                position: 'absolute', top: '0', left: '50%',
                width: '12px', height: '12px', borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #FFE8A8, #D9A441)',
                boxShadow: '0 0 6px rgba(217,164,65,0.8)',
                animation: 'orbPulse 1.5s ease-in-out 2',
                pointerEvents: 'none',
              }} />
            )}
            {condenseOrb === 'great' && (
              <div style={{
                position: 'absolute', top: '0', left: '50%',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #FFFA80, #FF8C00, #D4AF37)',
                boxShadow: '0 0 10px rgba(255,140,0,0.9), 0 0 20px rgba(212,175,55,0.5)',
                animation: 'superOrbPulse 1.0s ease-in-out 2',
                pointerEvents: 'none',
              }} />
            )}

            {/* 정령 구체 D11: 조합에 포함된 오행 차례 소환 */}
              {spiritOrbs.map((el, orbIdx) => (
                <div
                  key={`orb-${el}-${orbIdx}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: ELEMENT_GLOW_COLORS[el],
                    boxShadow: `0 0 6px ${ELEMENT_GLOW_COLORS[el]}`,
                    animation: orbIdx < spiritOrbs.length - 1
                      ? `spiritOrbIn ${getCssDuration(300)} ease-out ${orbIdx * getDuration(150)}ms forwards`
                      : `spiritOrbFly ${getCssDuration(400)} ease-in ${(orbIdx) * getDuration(150)}ms forwards`,
                    marginLeft: -6 + orbIdx * 4,
                    marginTop: -6,
                  }}
                >
                  <span style={{ fontSize: '7px', color: '#16130F', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    {ELEMENT_LABELS[el]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* 체인 빛줄기 */}
          {selectedCards.length >= 2 && (
            <ChainGlow
              cards={chainCardPositions}
              getCssDuration={getCssDuration}
            />
          )}

          {/* A3: 붉은 화살표 — 상극 기운 포함 시 적 방향 */}
          {selectedCards.length >= 2 && (
            <GeukArrow
              visible={hasGeukOnEnemy}
              getCssDuration={getCssDuration}
            />
          )}

          {/* 드래그 융합 불가 안내 */}
          {fusionRejectMsg && (
            <div
              style={{
                position: 'absolute',
                top: '-28px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(179,58,43,0.9)',
                color: '#E8DCC4',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '2px',
                whiteSpace: 'nowrap',
                zIndex: 60,
                pointerEvents: 'none',
              }}
            >
              {fusionRejectMsg}
            </div>
          )}

          {hand.map((card, idx) => {
            const isSelected = selectedCards.includes(card.id)
            const elColor = ELEMENT_COLORS[card.element]
            const glowColor = ELEMENT_GLOW_COLORS[card.element]
            const totalCards = hand.length
            const midpoint = (totalCards - 1) / 2
            const angle = (idx - midpoint) * 4
            // 8장이 화면에 들어오도록 동적 너비 계산 (최대 62px, 최소 38px)
            const maxW = 62
            const minW = 38
            const w = Math.max(minW, Math.min(maxW, Math.floor((window.innerWidth - 48) / Math.max(totalCards, 1)) - 4))
            const h = Math.round(w * 7 / 5)

            // Phase 1.9.2: 기세 오름 / 기세 죽음 판정
            // 기세 오름: 카드 기운이 적 기운을 이긴다 (GEUK_MAP[card.element] === enemyElement)
            // 기세 죽음: 적 기운이 카드 기운을 이긴다 (GEUK_MAP[enemyElement] === card.element)
            const isGeukiOleum = GEUK_MAP[card.element] === enemyElement   // 기세 오름
            const isGeukiJugeum = GEUK_MAP[enemyElement] === card.element  // 기세 죽음 (구 역극)
            const isYeokgeukInHand = isGeukiJugeum  // 하위 호환성 유지
            // A4: 훈수 하이라이트
            const isHinted = hintActive && hintCards.includes(card.id)

            // 드래그 상태
            const isDraggingThis = dragState.draggingCardId === card.id
            const isDropTarget = dragState.overCardId === card.id
            const isRejectAnim = rejectAnimCardId === card.id

            // B-2: 이종 기운 차단 (선택 안된 카드만 해당)
            const isBlockedByDiversity = !isSelected && shouldBlockCardSelection(hand, selectedCards, card.id) && !hasAllFiveElements

            // B-3: 5기운 shimmer 대상 (핸드에 5기운 있을 때 각 기운 최고값 카드)
            const isYeonhwanCandidate = hasAllFiveElements && (() => {
              const sameEl = hand.filter(c => c.element === card.element)
              const best = sameEl.reduce((max, c) => c.value > max.value ? c : max, sameEl[0])
              return best?.id === card.id
            })()

            return (
              <button
                key={card.id}
                draggable={!isBlockedByDiversity}
                onClick={() => !isDraggingThis && !isBlockedByDiversity && handleCardSelect(card.id)}
                onDragStart={() => !isBlockedByDiversity && handleDragStart(card.id)}
                onDragOver={e => { e.preventDefault(); handleDragOver(card.id, hand) }}
                onDrop={() => {
                  const fusion = (cards: typeof hand) => {
                    // 드래그로 선택한 카드 2장을 탭 선택 방식으로 전환
                    cards.forEach(c => {
                      if (!selectedCards.includes(c.id)) {
                        toggleCardSelect(c.id)
                      }
                    })
                    // 불가능 조합 시 안내 (rejectAnimCardId로 처리됨)
                    const result = checkFusionCompatibility(cards)
                    if (result.type === 'reject' && result.message) {
                      if (fusionRejectTimerRef.current) clearTimeout(fusionRejectTimerRef.current)
                      setFusionRejectMsg(result.message)
                      fusionRejectTimerRef.current = setTimeout(() => setFusionRejectMsg(null), 2000)
                    }
                  }
                  handleDragEnd(fusion, hand)
                }}
                onDragEnd={handleDragCancel}
                style={{
                  width: w,
                  height: h,
                  // Phase 1.9.3: 기세 죽음 카드 배경색 유지 (#E8DCC4) — 카드면 색상 변경 금지
                  backgroundColor: '#E8DCC4',
                  border: isHinted
                    ? `2px solid #D9A441`
                    : isYeonhwanCandidate && !isSelected
                    ? `2px solid #FFD98A`
                    : isDropTarget && dragState.fusionPreview?.type !== 'reject'
                    ? `2px solid #D9A441`
                    : `2px solid ${isSelected ? elColor : '#2A2620'}`,
                  borderRadius: '2px',
                  position: 'relative',
                  cursor: isBlockedByDiversity ? 'not-allowed' : 'grab',
                  transform: isDraggingThis
                    ? `rotate(${angle}deg) scale(0.9) translateY(${isSelected ? -14 : 0}px)`
                    : isRejectAnim
                    ? `rotate(${angle}deg) translateX(8px) translateY(${isSelected ? -14 : 0}px)`
                    : `rotate(${angle}deg) translateY(${isSelected ? -14 : 0}px)`,
                  transition: isRejectAnim
                    ? `transform 0.1s ease-out`
                    : `transform ${getCssDuration(120)} ease-out, border-color ${getCssDuration(120)} ease-out`,
                  boxShadow: isHinted
                    ? `0 0 12px #D9A441`
                    : isYeonhwanCandidate && !isSelected
                    ? `0 0 8px #FFD98A, 0 0 16px rgba(255,217,138,0.4)`
                    : isDropTarget && dragState.fusionPreview?.type !== 'reject'
                    ? `0 0 14px #D9A441`
                    : isSelected ? `0 0 8px ${glowColor}` : 'none',
                  flexShrink: 0,
                  padding: 0,
                  // Phase 1.9.3: 기세 죽음 — filter 전체 제거 (배경 색상 변경 금지)
                  // B-2 차단 opacity 0.4
                  opacity: isDraggingThis ? 0.5 : isBlockedByDiversity ? 0.4 : 1,
                  // B-3: shimmer 애니메이션
                  animation: isYeonhwanCandidate && !isSelected
                    ? 'yeonhwanShimmer 300ms ease-in-out 3'
                    : undefined,
                }}
              >
                {/* Phase 1.9.3: 기세 죽음 — 내부 테두리에만 saturate(0.6) 적용 */}
                <div style={{
                  position: 'absolute', inset: '2px',
                  border: `1px solid ${isSelected ? elColor : '#B33A2B'}`,
                  opacity: isSelected ? 0.9 : 0.3,
                  borderRadius: '1px',
                  filter: isGeukiJugeum ? 'saturate(0.6)' : 'none',
                }} />
                {/* Phase 1.9.2: 기세 오름 도장 (우상단 20×20) */}
                {isGeukiOleum && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #F0D060, #D4AF37, #A08020)',
                    border: '1px solid rgba(212,175,55,0.9)',
                    boxShadow: '0 0 4px rgba(212,175,55,0.7), inset 0 1px 2px rgba(255,240,150,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    zIndex: 3,
                    animation: 'sealShimmer 2s ease-in-out infinite',
                    lineHeight: 1,
                  }}>
                    <span style={{ color: '#FFFDF7', fontSize: '4px', letterSpacing: 0, textAlign: 'center', display: 'block', lineHeight: '1.1' }}>기세</span>
                    <span style={{ color: '#FFFDF7', fontSize: '4px', letterSpacing: 0, textAlign: 'center', display: 'block', lineHeight: '1.1' }}>오름</span>
                  </div>
                )}
                {/* Phase 1.9.2: 기세 죽음 도장 (우상단 20×20) */}
                {isGeukiJugeum && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 40%, #A09070, #8B7355, #6B5535)',
                    border: '1px solid rgba(139,115,85,0.6)',
                    boxShadow: '0 0 2px rgba(0,0,0,0.4)',
                    opacity: 0.85,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    zIndex: 3,
                    lineHeight: 1,
                    overflow: 'hidden',
                  }}>
                    <span style={{ color: '#9B9080', fontSize: '4px', letterSpacing: 0, textAlign: 'center', display: 'block', lineHeight: '1.1' }}>기세</span>
                    <span style={{ color: '#9B9080', fontSize: '4px', letterSpacing: 0, textAlign: 'center', display: 'block', lineHeight: '1.1' }}>죽음</span>
                    {/* 균열선 */}
                    <div style={{
                      position: 'absolute',
                      top: '3px', left: '8px',
                      width: '1px', height: '14px',
                      background: 'rgba(0,0,0,0.4)',
                      transform: 'rotate(15deg)',
                    }} />
                  </div>
                )}
                {/* A-1: 값(숫자) 좌상단 18px — 그을음 적용 */}
                {/* Phase 1.9.3: 기세 죽음 — 글자에만 saturate(0.6) 적용 */}
                <span style={{
                  color: '#2A2620',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  position: 'absolute',
                  top: '4px',
                  left: '5px',
                  lineHeight: 1,
                  filter: isGeukiJugeum ? 'saturate(0.6)' : 'none',
                }}>
                  {card.element === 'hwa' && sootCount[card.id]
                    ? Math.max(0, card.value - (sootCount[card.id] ?? 0))
                    : card.value}
                </span>
                {/* A-1: 속성(한자) 중앙 32px */}
                <span style={{
                  color: elColor,
                  fontSize: '32px',
                  fontWeight: 'bold',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  lineHeight: 1,
                  filter: isGeukiJugeum ? 'saturate(0.6)' : 'none',
                }}>
                  {ELEMENT_LABELS[card.element]}
                </span>
                {/* A-1: 한글 속성명 하단 중앙 (죽은 기운 카드에서도 유지) */}
                <span style={{
                  color: elColor,
                  fontSize: '9px',
                  position: 'absolute', bottom: '3px', left: '50%',
                  transform: 'translateX(-50%)',
                  opacity: 0.8,
                  filter: isGeukiJugeum ? 'saturate(0.6)' : 'none',
                }}>
                  {ELEMENT_KO[card.element]}
                </span>
                <span style={{
                  color: '#6A6560', fontSize: '9px',
                  position: 'absolute', top: '3px', right: '4px',
                }}>
                  {card.polarity === 'yang' ? '●' : '○'}
                </span>
                {/* A-1 Phase 1.9: 죽은 기운 카드 剋 표시 제거 (리본으로 대체됨) */}
                {/* 역극 첫 진입 안내 텍스트 (카드 아래) */}
                {isYeokgeukInHand && showYeokgeukHint && (
                  <div style={{
                    position: 'absolute',
                    bottom: '-20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '9px',
                    color: '#B33A2B',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                    pointerEvents: 'none',
                  }}>
                    오늘은 이 기운이 힘을 못 쓰는 날
                  </div>
                )}
                {/* Phase 1.9.2: 그을음 라벨 */}
                {card.element === 'hwa' && sootCount[card.id] > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    fontSize: '9px',
                    color: '#8B8070',
                    letterSpacing: '0.02em',
                    pointerEvents: 'none',
                  }}>
                    {sootCount[card.id] === 1 ? '그을음' : `그을음×${sootCount[card.id]}`}
                  </div>
                )}
                {/* Phase 1.8: 역극 툴팁 팝업 */}
                {isYeokgeukInHand && yeokgeukTooltip?.cardId === card.id && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(22,19,15,0.97)',
                    border: '1px solid #B33A2B',
                    color: '#D8CCB4',
                    fontSize: '10px',
                    padding: '6px 8px',
                    borderRadius: '2px',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                    zIndex: 80,
                    pointerEvents: 'none',
                    lineHeight: '1.5',
                    maxWidth: '180px',
                    textAlign: 'center',
                  }}>
                    {yeokgeukTooltip.text}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {/* 핸드+부적슬롯 외부 flex 컨테이너 닫기 */}
        </div>

        {/* Phase 1.9.2: 연환 완성하기 버튼 (5기운 보유 시 표시, yeonhwanUsed 비활성) */}
        {hasAllFiveElements && (
          <div style={{ padding: '0 8px', flexShrink: 0 }}>
            <button
              onClick={yeonhwanUsed ? undefined : handleYeonhwanComplete}
              disabled={yeonhwanUsed}
              style={{
                width: '100%',
                height: '44px',
                backgroundColor: yeonhwanUsed ? 'rgba(42,38,32,0.6)' : 'rgba(61,90,128,0.8)',
                border: yeonhwanUsed ? '1.5px solid #4A4540' : '1.5px solid #8FB8DE',
                color: yeonhwanUsed ? '#4A4540' : '#FFFDF7',
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.08em',
                cursor: yeonhwanUsed ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                position: 'relative',
                overflow: 'hidden',
                opacity: yeonhwanUsed ? 0.5 : 1,
                animation: yeonhwanUsed ? undefined : 'yeonhwanButtonShimmer 2s ease-in-out infinite',
              }}
            >
              {yeonhwanUsed ? '연환 완성됨 (출정당 1회)' : '연환 완성하기 →'}
            </button>
            {yeonhwanUsed && (
              <div style={{ fontSize: '11px', color: '#6B6560', textAlign: 'center', marginTop: '4px', letterSpacing: '0.04em' }}>
                연환은 출정마다 한 번만 이룰 수 있는 대의식이다.
              </div>
            )}
          </div>
        )}

        {/* 5-B: 내 체력 하단 상시 노출 */}
        <div style={{
          padding: '4px 16px 2px',
          backgroundColor: '#1C1710',
          borderTop: '1px solid #2A2620',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ color: '#6A6560', fontSize: '11px', letterSpacing: '0.06em', minWidth: '36px' }}>
            체력 HP
          </span>
          <div style={{ flex: 1, position: 'relative', height: '12px', backgroundColor: '#2A2620', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${playerHpPercent}%`,
                height: '100%',
                backgroundColor: '#C63D2F',
                transition: `width 300ms`,
                animation: playerHp <= 30 ? 'hpBarDanger 1.2s ease-in-out infinite' : undefined,
              }}
            />
          </div>
          <span style={{ color: '#D8CCB4', fontSize: '11px', minWidth: '40px', textAlign: 'right', letterSpacing: '0.04em' }}>
            {playerHp}/{playerMaxHp}
          </span>
          {/* 5-A: 반격 피해 팝업 */}
          {counterPopup && (
            <span
              key={counterPopup.id}
              style={{
                position: 'absolute',
                right: '16px',
                bottom: '20px',
                color: '#FF7A5C',
                fontSize: '16px',
                fontWeight: 'bold',
                pointerEvents: 'none',
                animation: `counterPopup ${600}ms ease-out forwards`,
                letterSpacing: '0.05em',
              }}
            >
              -{counterPopup.value}
            </span>
          )}
        </div>

        {/* 버리기·공격 버튼 */}
        <div
          style={{
            height: '12vh',
            minHeight: '64px',
            display: 'flex',
            gap: '8px',
            padding: '8px 16px',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <button
            onClick={handleDiscardCards}
            disabled={selectedCards.length === 0 || discardsLeft <= 0 || isInputLocked}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: 'transparent',
              border: '1px solid #4A4540',
              color: discardsLeft <= 0 ? '#4A4540' : '#D8CCB4',
              fontSize: '14px',
              cursor: selectedCards.length === 0 || discardsLeft <= 0 || isInputLocked ? 'not-allowed' : 'pointer',
              opacity: discardsLeft <= 0 || isInputLocked ? 0.4 : 1,
              letterSpacing: '0.1em',
              pointerEvents: isInputLocked ? 'none' : undefined,
            }}
          >
            버리기 {discardsLeft}회 남음
          </button>
          {/* Phase 1.9.2: 토 타격 조합 선택 시 2분할, 아니면 단일 공격 버튼 */}
          {(() => {
            const selectedComboResult = selectedCardObjs.length >= 2
              ? judgeCombo(selectedCardObjs as any)
              : null
            const condenseAvail = selectedComboResult
              ? getCondenseAvailability(selectedComboResult.name ?? '', selectedComboResult.finishingElement)
              : null
            const canAttack = selectedCards.length > 0 && playsLeft > 0 && !isInputLocked
            const isGreat = condenseAvail === 'great'
            // Phase 1.9.3: 버튼 라벨에 조합명 포함
            // great(옹기가마): "대응축 — 옹기가마에 굽는다"
            // basic(토 모으기/일군 밭): "응축 — 힘을 담는다"
            const condenseBtnLabel = isGreat
              ? `대응축 — ${selectedComboResult?.name ?? '옹기가마'}에 굽는다`
              : CONDENSE_LABELS.condense

            if (condenseAvail !== null) {
              // 2분할 버튼
              return (
                <div style={{ flex: 1, display: 'flex', gap: '0', height: '48px' }}>
                  {/* 공격 */}
                  <button
                    onClick={handlePlayCards}
                    disabled={!canAttack}
                    style={{
                      flex: 0.9,
                      height: '48px',
                      background: '#3B4A6B',
                      border: 'none',
                      color: '#FFFDF7',
                      fontSize: '14px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      cursor: canAttack ? 'pointer' : 'not-allowed',
                      opacity: canAttack ? 1 : 0.4,
                      borderRadius: '4px 0 0 4px',
                    }}
                  >
                    공격
                  </button>
                  {/* 응축/대응축 */}
                  <button
                    onClick={isLastAttack ? undefined : () => handleApplyCondense(condenseAvail)}
                    disabled={isLastAttack || !canAttack}
                    style={{
                      flex: 1.1,
                      height: '48px',
                      background: isLastAttack
                        ? '#2A2620'
                        : isGreat
                        ? 'linear-gradient(90deg, #FF8C00, #D4AF37)'
                        : '#D9A441',
                      border: 'none',
                      color: isGreat ? '#FFFDF7' : '#3B2A0A',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      cursor: (isLastAttack || !canAttack) ? 'not-allowed' : 'pointer',
                      opacity: isLastAttack ? 0.3 : canAttack ? 1 : 0.4,
                      borderRadius: '0 4px 4px 0',
                      boxShadow: (!isLastAttack && isGreat) ? '0 0 8px rgba(255,140,0,0.4), 0 0 4px rgba(212,175,55,0.3)' : 'none',
                      pointerEvents: isLastAttack ? 'none' : undefined,
                    }}
                  >
                    {condenseBtnLabel}
                  </button>
                </div>
              )
            }

            // 단일 공격 버튼
            return (
              <button
                onClick={handlePlayCards}
                disabled={selectedCards.length === 0 || playsLeft <= 0 || isInputLocked}
                style={{
                  flex: 1,
                  height: '48px',
                  backgroundColor: canAttack ? '#B33A2B' : '#2A2620',
                  border: 'none',
                  color: '#E8DCC4',
                  fontSize: '14px',
                  cursor: canAttack ? 'pointer' : 'not-allowed',
                  opacity: (playsLeft <= 0 || isInputLocked) ? 0.4 : 1,
                  letterSpacing: '0.1em',
                  transition: `background-color ${getCssDuration(150)}`,
                  pointerEvents: isInputLocked ? 'none' : undefined,
                  borderRadius: '4px',
                }}
              >
                공격 {playsLeft}/{floorConfig.maxPlays}
              </button>
            )
          })()}
          {/* Phase 1.9.2: 마지막 패 경고 */}
          {isLastAttack && (() => {
            const selectedComboResult = selectedCardObjs.length >= 2
              ? judgeCombo(selectedCardObjs as any)
              : null
            const condenseAvail = selectedComboResult
              ? getCondenseAvailability(selectedComboResult.name ?? '', selectedComboResult.finishingElement)
              : null
            if (condenseAvail !== null) {
              return (
                <div style={{
                  position: 'absolute', bottom: '2px', left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '11px', color: '#6B6560',
                  whiteSpace: 'nowrap', letterSpacing: '0.04em',
                  pointerEvents: 'none',
                }}>
                  {CONDENSE_LABELS.lastHandWarning}
                </div>
              )
            }
            return null
          })()}
        </div>

        {/* 패시브 슬롯 (3-A: 실제 카드로 표시) */}
        <PassiveSlot
          passives={passives}
          flashCardId={activationState.flashCardId}
        />
      </div>
    </>
  )
}
