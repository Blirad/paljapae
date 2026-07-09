/**
 * 팔자전 — (6) 전투 화면
 * 4층 던전, 1층 turn-based
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
import { FLOOR_ENEMY_ELEMENTS as ENGINE_FLOOR_ENEMY_ELEMENTS } from '../engine/paljajeonEngine'
import { useGameContext } from '../context/GameContext'
import { audioManager } from '../services/audioManager'
import { judgeHand, detectElementClash, calcGeukBonusMultiplier, detectYeokgeukPenalty, determinePrimaryElement } from '../engine/pokerHandJudge'
import type { Element } from '../types/game'
import TalismanBar from './TalismanBar'
import type { TalismanId } from '../engine/talismans'
import { useDragAndDrop, checkFusionCompatibility } from '../hooks/useDragAndDrop'
import PassiveSlot, { PassiveActivationBanner } from './PassiveSlot'
import { usePassiveAnimation } from '../hooks/usePassiveAnimation'
import type { Passive } from '../types/passive'

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

// ---------- 적 속성 결정 (층별 고정 — 엔진에서 import) ----------
const FLOOR_ENEMY_ELEMENTS: Record<number, Element> = ENGINE_FLOOR_ENEMY_ELEMENTS as Record<number, Element>

// C10: 층별 적 정보 (이름, 속성, 기믹 예고, 대사)
const FLOOR_ENEMY_INFO: Record<number, {
  name: string
  element: Element
  gimmickHint: string
  dialogue: string
  eliteBanner?: string
}> = {
  1: {
    name: '고목령(枯木靈)',
    element: 'mok',
    gimmickHint: '매 공격마다 체력을 15 회복한다',
    dialogue: '뿌리가... 어디였더라...',
  },
  2: {
    name: '잔화령(殘火靈)',
    element: 'hwa',
    gimmickHint: '반격이 더 강하지만 체력이 낮다',
    dialogue: '꺼지기 전이... 가장 뜨겁다...',
  },
  3: {
    name: '정예: 고신',
    element: 'to',
    gimmickHint: '패시브 슬롯 2칸을 봉인한다',
    dialogue: '곁이라는 것을, 나는 모른다.',
    eliteBanner: '고신 — 그대의 패시브 두 칸을 봉인한다',
  },
  4: {
    name: '보스: 명외자 대장',
    element: 'geum',
    gimmickHint: '세 번째 공격 턴에 배율이 1로 고정된다',
    dialogue: '왕께서 오신다. 너희의 팔자를 지우러.',
    eliteBanner: '빈 시간 — 세 번째 공격은 배율이 1로 고정된다',
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
  } = useGameStore()

  const { getCssDuration, getDuration, playbackSpeed, togglePlaybackSpeed } = useGameContext()

  const floorConfig = FLOOR_CONFIGS[currentFloor - 1]
  const enemyElement: Element = FLOOR_ENEMY_ELEMENTS[currentFloor] ?? 'mok'

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

  // 족보 미리보기 변경 시 바운스 애니메이션
  useEffect(() => {
    const newRank = previewResult?.rank ?? null
    if (newRank !== prevPreviewRank.current && newRank && newRank !== 'none') {
      console.log('[VFX] 족보 미리보기 갱신 — 바운스', { rank: newRank, timestamp: Date.now() })
      setPreviewBounce(true)
      const t = setTimeout(() => setPreviewBounce(false), 220)
      prevPreviewRank.current = newRank
      return () => clearTimeout(t)
    }
    prevPreviewRank.current = newRank
  }, [previewResult?.rank])

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
        const hasGeuk = selectedCardObjs.some(c => GEUK_MAP[c.element] === enemyElement)
        const geukCard = selectedCardObjs.find(c => GEUK_MAP[c.element] === enemyElement)
        const geukBonus = hasGeuk ? GEUK_BONUS_MULTIPLIER : 1.0
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

  // 플레이어 HP 변화 → B8: 피격 플래시 + 사운드 / 회복음
  useEffect(() => {
    if (playerHp < prevPlayerHp.current) {
      audioManager.playerHit()
      // B8: 붉은 플래시 + 체력바 흔들림
      setHitFlash(true)
      setHpBarShake(true)
      setTimeout(() => setHitFlash(false), getDuration(300))
      setTimeout(() => setHpBarShake(false), getDuration(200))
      console.log('[SFX] 플레이어 피격음', { damage: prevPlayerHp.current - playerHp, timestamp: Date.now() })
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
    audioManager.cardSelectTick()
    console.log('[SFX] 카드 선택 틱', { cardId, timestamp: Date.now() })

    // 역극 카드 선택 시 첫 진입 안내
    const card = hand.find(c => c.id === cardId)
    if (card && GEUK_MAP[enemyElement] === card.element && !yeokgeukHintShownRef.current) {
      yeokgeukHintShownRef.current = true
      setShowYeokgeukHint(true)
      setTimeout(() => setShowYeokgeukHint(false), 4000)
    }

    toggleCardSelect(cardId)
  }, [toggleCardSelect, hand, enemyElement])

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

  // 버리기 처리
  const handleDiscardCards = useCallback(() => {
    if (selectedCards.length === 0 || discardsLeft <= 0) return
    audioManager.cardDiscardSwish()
    console.log('[SFX] 카드 버리기 스윽', { count: selectedCards.length, timestamp: Date.now() })
    discardSelectedCards()
  }, [selectedCards, discardsLeft, discardSelectedCards])

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
      warnings.push(`${ELEMENT_KO[pair.attacker]}과 ${ELEMENT_KO[pair.victim]}이 부딪힌다 −30%`)
    }
    // 적의 반극 경고
    if (yeokgeukInfo?.hasPenalty && yeokgeukInfo.enemyStrongest && yeokgeukInfo.myPrimary) {
      warnings.push(`적의 ${ELEMENT_KO[yeokgeukInfo.enemyStrongest]}이 내 ${ELEMENT_KO[yeokgeukInfo.myPrimary.element]}을 누른다 −30%`)
    }
    return warnings
  }

  const getBoostTexts = () => {
    const boosts: string[] = []
    // 주 기운 원칙 극 보너스
    if (geukCalcInfo && geukCalcInfo.multiplier > 1.0) {
      const pct = Math.round((geukCalcInfo.multiplier - 1) * 100)
      if (geukCalcInfo.isMainGeuk) {
        boosts.push(`주 기운 ${ELEMENT_KO[geukCalcInfo.primaryElement?.element ?? 'mok']}이 이긴다 +${pct}%`)
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

  const previewBannerText = getPreviewBannerText()
  const warningTexts = getWarningTexts()
  const boostTexts = getBoostTexts()

  // A1: 극 뱃지 — 주 기운 원칙 반영으로 boostTexts로 대체됨 (참고용 유지)
  const bonusPct = Math.round((GEUK_BONUS_MULTIPLIER - 1) * 100)
  void bonusPct  // 미리보기 콘솔 디버깅용 유지
  void hasGeukOnEnemy
  void geukAttacker

  // 주 기운 표시 텍스트
  const primaryElText = primaryEl
    ? `주 기운: ${ELEMENT_KO[primaryEl.element]}(${primaryEl.count}장, 합 ${primaryEl.totalValue})`
    : null

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
      `}</style>

      {/* 오행연환 오버레이 */}
      <ElementalSequenceOverlay seq={elementalSeq} getCssDuration={getCssDuration} />

      {/* A2: 순환 도표 오버레이 */}
      {showCycleChart && (
        <CycleChartOverlay onClose={() => setShowCycleChart(false)} enemyElement={enemyElement} />
      )}

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
              width: '48px',
              height: '48px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            훈수
          </button>
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

          {/* 적 이름 + 속성 뱃지 (C10 돌진 모션 적용) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: enemyCharge ? `enemyCharge ${getCssDuration(500)} ease-out` : undefined,
          }}>
            <span style={{ color: '#D8CCB4', fontSize: '15px', letterSpacing: '0.1em' }}>
              {floorConfig.enemyName}
            </span>
            {/* A1: 속성 한자 크게 + 한글 병기 */}
            <div
              style={{
                backgroundColor: ELEMENT_BG_COLORS[enemyElement],
                border: `1px solid ${ELEMENT_COLORS[enemyElement]}`,
                color: ELEMENT_COLORS[enemyElement],
                padding: '4px 10px',
                letterSpacing: '0.05em',
                borderRadius: '2px',
                boxShadow: `0 0 8px ${ELEMENT_GLOW_COLORS[enemyElement]}, inset 0 0 4px ${ELEMENT_BG_COLORS[enemyElement]}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                lineHeight: 1.1,
              }}
            >
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{ELEMENT_LABELS[enemyElement]}</span>
              <span style={{ fontSize: '10px', opacity: 0.85 }}>{ELEMENT_KO[enemyElement]}</span>
            </div>
          </div>

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

        {/* G1 수정 #1 — 족보 미리보기 실체화 (최소 64px 높이, 붓글씨 20px+) */}
        <div
          style={{
            minHeight: '64px',
            backgroundColor: previewBannerText ? '#1C1710' : 'transparent',
            borderTop: '1px solid #2A2620',
            borderBottom: '1px solid #2A2620',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: `background-color ${getCssDuration(150)}`,
            flexShrink: 0,
          }}
        >
          {previewBannerText ? (
            <div style={{ textAlign: 'center' }}>
              {previewResult?.rank !== 'none' ? (
                <>
                  {/* 족보명 (붓글씨체 20px, 금색, 글로우) */}
                  <div
                    style={{
                      color: '#D9A441',
                      fontSize: '20px',
                      fontFamily: '"Noto Serif KR", "UnifrakturMaguntia", "Georgia", serif',
                      fontWeight: 'bold',
                      letterSpacing: '0.1em',
                      textShadow: '0 0 16px rgba(217,164,65,0.5)',
                      animation: previewBounce ? `previewBounce 220ms ease-out` : undefined,
                      marginBottom: '2px',
                    }}
                  >
                    {previewResult?.description.split(' — ')[0] ?? ''}
                  </div>
                  {/* 수식 (A1 한글화: 공격력 N × N배 = N 피해) */}
                  <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                    <span style={{ color: '#E8DCC4' }}>공격력 {previewResult?.baseScore}</span>
                    <span style={{ color: '#6A6560' }}> × </span>
                    <span style={{ color: '#E8DCC4' }}>{previewResult?.multiplier}배</span>
                    <span style={{ color: '#6A6560' }}> = </span>
                    <span style={{ color: '#D9A441', fontWeight: 'bold' }}>예상 {previewResult?.totalScore} 피해</span>
                    {/* A1: 극 정보 — 주 기운 원칙 반영 */}
                    {boostTexts.length > 0 && boostTexts.map((t, i) => (
                      <span key={i} style={{ color: '#FF7A5C', fontWeight: 'bold' }}> · {t}</span>
                    ))}
                  </div>
                  {/* Phase 1.6 A: 주 기운 표시 */}
                  {primaryElText && selectedCards.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#6A6560', marginTop: '2px' }}>
                      {primaryElText}
                    </div>
                  )}
                  {/* Phase 1.6 A: 기운 충돌 경고 (붉은색) */}
                  {warningTexts.map((w, i) => (
                    <div key={i} style={{ fontSize: '11px', color: '#C63D2F', marginTop: '1px', fontWeight: 'bold' }}>
                      {w}
                    </div>
                  ))}
                </>
              ) : (
                <span style={{ color: '#6A6560', fontSize: '14px' }}>
                  조합 없음 — 낱장 합산
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: '#2A2620', fontSize: '11px' }}>
              카드 선택 시 조합 표시
            </span>
          )}
        </div>

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
            padding: '8px 8px 0 8px',
            overflowX: 'auto',
            gap: '4px',
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
            const angle = (idx - midpoint) * 5
            const w = 62
            const h = Math.round(w * 7 / 5)

            // 역극 카드: opacity 0.35, 필터 더 강하게
            const isYeokgeukInHand = GEUK_MAP[enemyElement] === card.element
            // A4: 훈수 하이라이트
            const isHinted = hintActive && hintCards.includes(card.id)

            // 드래그 상태
            const isDraggingThis = dragState.draggingCardId === card.id
            const isDropTarget = dragState.overCardId === card.id
            const isRejectAnim = rejectAnimCardId === card.id

            return (
              <button
                key={card.id}
                draggable
                onClick={() => !isDraggingThis && handleCardSelect(card.id)}
                onDragStart={() => handleDragStart(card.id)}
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
                  backgroundColor: isYeokgeukInHand ? '#1A1614' : '#E8DCC4',
                  border: isHinted
                    ? `2px solid #D9A441`
                    : isDropTarget && dragState.fusionPreview?.type !== 'reject'
                    ? `2px solid #D9A441`
                    : `2px solid ${isSelected ? elColor : isYeokgeukInHand ? '#2A2620' : '#2A2620'}`,
                  borderRadius: '2px',
                  position: 'relative',
                  cursor: 'grab',
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
                    : isDropTarget && dragState.fusionPreview?.type !== 'reject'
                    ? `0 0 14px #D9A441`
                    : isSelected ? `0 0 8px ${glowColor}` : 'none',
                  flexShrink: 0,
                  padding: 0,
                  // G1 수정: 역극 opacity 0.35, 필터 강화
                  opacity: isDraggingThis ? 0.5 : isYeokgeukInHand ? 0.35 : 1,
                  filter: isYeokgeukInHand ? 'grayscale(0.85) brightness(0.4)' : 'none',
                }}
              >
                <div style={{
                  position: 'absolute', inset: '2px',
                  border: `1px solid ${isSelected ? elColor : '#B33A2B'}`,
                  opacity: isSelected ? 0.9 : 0.3,
                  borderRadius: '1px',
                }} />
                <span style={{
                  color: isYeokgeukInHand ? '#4A4540' : '#2A2620',
                  fontSize: '17px',
                  fontWeight: 'bold',
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}>
                  {card.value}
                </span>
                {/* A1: 한자(크게) + 한글(나무) 병기 */}
                <span style={{
                  color: isYeokgeukInHand ? '#3A3530' : elColor,
                  fontSize: '13px',
                  fontWeight: 'bold',
                  position: 'absolute', bottom: '14px', left: '50%',
                  transform: 'translateX(-50%)',
                }}>
                  {ELEMENT_LABELS[card.element]}
                </span>
                <span style={{
                  color: isYeokgeukInHand ? '#3A3530' : elColor,
                  fontSize: '9px',
                  position: 'absolute', bottom: '3px', left: '50%',
                  transform: 'translateX(-50%)',
                  opacity: 0.8,
                }}>
                  {ELEMENT_KO[card.element]}
                </span>
                <span style={{
                  color: '#6A6560', fontSize: '9px',
                  position: 'absolute', top: '3px', right: '4px',
                }}>
                  {card.polarity === 'yang' ? '●' : '○'}
                </span>
                {/* G1 수정 #2(c) — 역극 표시: "역" → "剋" 한자 10px, #B33A2B */}
                {isYeokgeukInHand && (
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: '3px',
                    fontSize: '10px',
                    color: '#B33A2B',
                    opacity: 0.9,
                    fontWeight: 'bold',
                    animation: 'yeokgeukInk 400ms ease-out forwards',
                  }}>
                    剋
                  </span>
                )}
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
              </button>
            )
          })}
        </div>
        {/* 핸드+부적슬롯 외부 flex 컨테이너 닫기 */}
        </div>

        {/* 버리기·출수 버튼 */}
        <div
          style={{
            height: '12vh',
            minHeight: '64px',
            display: 'flex',
            gap: '8px',
            padding: '8px 16px',
            alignItems: 'center',
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
          <button
            onClick={handlePlayCards}
            disabled={selectedCards.length === 0 || playsLeft <= 0 || isInputLocked}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: selectedCards.length > 0 && playsLeft > 0 && !isInputLocked ? '#B33A2B' : '#2A2620',
              border: 'none',
              color: '#E8DCC4',
              fontSize: '14px',
              cursor: selectedCards.length === 0 || playsLeft <= 0 || isInputLocked ? 'not-allowed' : 'pointer',
              opacity: playsLeft <= 0 || isInputLocked ? 0.4 : 1,
              letterSpacing: '0.1em',
              transition: `background-color ${getCssDuration(150)}`,
              pointerEvents: isInputLocked ? 'none' : undefined,
            }}
          >
            공격 {playsLeft}/{floorConfig.maxPlays}
          </button>
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
