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
 * G1 수정 2차 (2026-07-09):
 *  - 족보 미리보기 실체화: 64px 높이, 20px+ 붓글씨, 바운스+글로우, 즉시 갱신
 *  - 상성 가시화: 뱃지 18px+글로우, 극 정보 미리보기 띠 추가, 역극 opacity 0.35+剋 한자
 *  - 피해 내역 노출: 적 HP바 아래, 3초, 스태거 카운트업 순서대로
 *  - 인라인 안내 3종: 핸드 위 위치, 14px, 주사선 장식, 4초
 *  - VFX/SFX 트리거 로그: console.log('[VFX]') + iOS AudioContext resume 확인
 *  - 배경 질감: 격자 0.08/40px, 한지 노이즈 오버레이, 4층 붉은 격자
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { FLOOR_CONFIGS, GEUK_BONUS_MULTIPLIER } from '../engine/balance'
import { useGameContext } from '../context/GameContext'
import { audioManager } from '../services/audioManager'
import type { Element } from '../types/game'

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

// 극 관계 한자 표현
function getGeukLabel(attacker: Element, victim: Element): string {
  return `${ELEMENT_LABELS[attacker]}克${ELEMENT_LABELS[victim]}`
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
        const glowColor = ELEMENT_GLOW_COLORS[card.element] ?? '#D8CCB4'
        const animDelay = `${(idx * 180) / 1000}s`
        return (
          <line
            key={`chain-${card.id}-${idx}`}
            x1={card.x}
            y1={card.y}
            x2={next.x}
            y2={next.y}
            stroke={glowColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 5px ${glowColor})`,
              animation: `chainGlow ${getCssDuration(180)} ease-in-out ${animDelay} both`,
            }}
          />
        )
      })}
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
        피해 내역
      </div>
      <div style={{ color: '#D8CCB4', fontSize: '13px', lineHeight: '1.9', fontVariantNumeric: 'tabular-nums' }}>
        {/* 스텝 1: 기본치 */}
        {staggerStep >= 1 && (
          <div style={{ animation: `slideInRow ${getCssDuration(200)} ease-out forwards` }}>
            기본치&nbsp;&nbsp;: <span style={{ color: '#D9A441' }}>{breakdown.baseScore}</span>
          </div>
        )}
        {/* 스텝 2: 배율 */}
        {staggerStep >= 2 && (
          <div style={{ animation: `slideInRow ${getCssDuration(200)} ease-out forwards` }}>
            × 배율&nbsp;&nbsp;: <span style={{ color: '#7BD4A3' }}>{breakdown.multiplier}</span>{' '}
            <span style={{ color: '#4A4540', fontSize: '11px' }}>(족보)</span>
          </div>
        )}
        {/* 스텝 3: 극보너스 (있을 때만) */}
        {staggerStep >= 3 && breakdown.geukBonus > 1 && (
          <div style={{ animation: `slideInRow ${getCssDuration(200)} ease-out forwards` }}>
            × 극보너스: <span style={{ color: '#FF7A5C' }}>{breakdown.geukBonus}</span>{' '}
            <span style={{ color: '#4A4540', fontSize: '11px' }}>({breakdown.geukLabel})</span>
          </div>
        )}
        {/* 스텝 4: 최종피해 */}
        {staggerStep >= 4 && (
          <div style={{
            borderTop: '1px solid #2A2620',
            marginTop: '6px',
            paddingTop: '6px',
            animation: `slideInRow ${getCssDuration(200)} ease-out forwards`,
          }}>
            = 최종피해: <span style={{
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

// ---------- 적 속성 결정 (층별 고정) ----------
const FLOOR_ENEMY_ELEMENTS: Record<number, Element> = {
  1: 'mok',
  2: 'hwa',
  3: 'to',
  4: 'geum',
}

interface BattleScreenProps {
  onFloorClear: () => void
  onResult: (victory: boolean) => void
}

export default function BattleScreen({ onFloorClear, onResult }: BattleScreenProps) {
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
    toggleCardSelect,
    playSelectedCards,
    discardSelectedCards,
    hasShownFirstHand,
    hasShownFirstDiscard,
    hasShownFirstAffinity,
    markFirstHandShown,
    markFirstDiscardShown,
    markFirstAffinityShown,
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
  }, [phase, isVictory, onFloorClear, onResult])

  // G1 수정 #4 — 첫 핸드 진입 안내
  useEffect(() => {
    if (!hasShownFirstHand && hand.length > 0) {
      markFirstHandShown()
      const timer = setTimeout(() => {
        showBanner('같은 기운 둘, 또는 이어지는 기운(木→火→土→金→水)을 골라보라')
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
        showBanner('마음에 안 드는 패는 버리고 새로 받을 수 있다')
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
        showBanner('상대를 이기는 기운은 더 아프게 박힌다')
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

  // 적 HP 변화 감지 → Score Popup + Screen Shake + 피해 내역 패널
  useEffect(() => {
    const damage = prevEnemyHp.current - enemyHp
    if (damage > 0) {
      if (previewResult?.rank === 'ohang-yeonhwan') {
        triggerElementalSequence()
      }

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

      // G1 수정 #3 — 피해 내역 패널 표시 (3초)
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

  // 플레이어 HP 변화 → 피격 사운드 / 회복음
  useEffect(() => {
    if (playerHp < prevPlayerHp.current) {
      audioManager.playerHit()
      console.log('[SFX] 플레이어 피격음', { damage: prevPlayerHp.current - playerHp, timestamp: Date.now() })
    } else if (playerHp > prevPlayerHp.current) {
      audioManager.playHealSFX()
      console.log('[SFX] 회복음', { heal: playerHp - prevPlayerHp.current, timestamp: Date.now() })
    }
    prevPlayerHp.current = playerHp
  }, [playerHp])

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

    playSelectedCards()
  }, [selectedCards, playsLeft, previewResult, getDuration, playSelectedCards])

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

  // G1 수정 #1 — 족보 미리보기 실체화 텍스트
  const getPreviewBannerText = () => {
    if (!previewResult || selectedCards.length === 0) return null
    if (previewResult.rank === 'none') {
      return '족보 없음 — 낱장 합산'
    }
    return `${previewResult.description} · 기본치 ${previewResult.baseScore} × 배율 ${previewResult.multiplier} = 예상 ${previewResult.totalScore}`
  }

  const previewBannerText = getPreviewBannerText()

  // G1 수정 #2(b) — 극 뱃지 미리보기 띠 텍스트
  const geukBadgeText = hasGeukOnEnemy && geukAttacker
    ? ` · ${getGeukLabel(geukAttacker.element, enemyElement)} +${Math.round((GEUK_BONUS_MULTIPLIER - 1) * 100)}%`
    : ''

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
      `}</style>

      {/* 오행연환 오버레이 */}
      <ElementalSequenceOverlay seq={elementalSeq} getCssDuration={getCssDuration} />

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
        {/* 상단바: 층수·체력 */}
        <div
          style={{
            backgroundColor: '#1C1710',
            padding: '10px 16px',
            borderBottom: '1px solid #2A2620',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '6vh',
            minHeight: '48px',
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
            <div
              style={{
                width: '80px', height: '6px',
                backgroundColor: '#2A2620', borderRadius: '3px', overflow: 'hidden',
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

        {/* 적 영역 (24%) */}
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
          {/* G1 수정 #2(a) — 적 이름 옆 속성 한자 + 오방색 글로우 (18px) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#D8CCB4', fontSize: '15px', letterSpacing: '0.1em' }}>
              {floorConfig.enemyName}
            </span>
            <span
              style={{
                backgroundColor: ELEMENT_BG_COLORS[enemyElement],
                border: `1px solid ${ELEMENT_COLORS[enemyElement]}`,
                color: ELEMENT_COLORS[enemyElement],
                fontSize: '18px',
                padding: '4px 10px',
                letterSpacing: '0.05em',
                borderRadius: '2px',
                boxShadow: `0 0 8px ${ELEMENT_GLOW_COLORS[enemyElement]}, inset 0 0 4px ${ELEMENT_BG_COLORS[enemyElement]}`,
                fontWeight: 'bold',
              }}
            >
              {ELEMENT_LABELS[enemyElement]}
            </span>
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

          {/* G1 수정 #3 — 피해 내역 패널: 적 HP바 아래 인라인 배치 */}
          <DamageBreakdownPanel breakdown={damageBreakdown} getCssDuration={getCssDuration} />

          {/* 반격 예고 */}
          {!damageBreakdown.visible && (
            <div style={{ color: '#4A4540', fontSize: '11px' }}>
              반격: {floorConfig.counterDamage} 피해
            </div>
          )}

          {/* G1 수정 #2(b) — 극 성립 시 뱃지 (적 영역) */}
          {hasGeukOnEnemy && geukAttacker && (
            <div
              style={{
                backgroundColor: ELEMENT_BG_COLORS[geukAttacker.element],
                border: `1px solid ${ELEMENT_GLOW_COLORS[geukAttacker.element]}`,
                color: ELEMENT_GLOW_COLORS[geukAttacker.element],
                fontSize: '13px',
                padding: '3px 10px',
                letterSpacing: '0.1em',
                borderRadius: '2px',
                '--glow': ELEMENT_GLOW_COLORS[geukAttacker.element],
                animation: 'geukPulse 1.5s ease-in-out infinite',
              } as React.CSSProperties}
            >
              {getGeukLabel(geukAttacker.element, enemyElement)} +{Math.round((GEUK_BONUS_MULTIPLIER - 1) * 100)}%
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
                  {/* 수식 (16px) */}
                  <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                    <span style={{ color: '#E8DCC4' }}>기본치 {previewResult?.baseScore}</span>
                    <span style={{ color: '#6A6560' }}> × </span>
                    <span style={{ color: '#E8DCC4' }}>배율 {previewResult?.multiplier}</span>
                    <span style={{ color: '#6A6560' }}> = </span>
                    <span style={{ color: '#D9A441', fontWeight: 'bold' }}>예상 {previewResult?.totalScore}</span>
                    {/* G1 수정 #2(b) — 극 정보 미리보기 띠에 추가 */}
                    {geukBadgeText && (
                      <span style={{ color: '#FF7A5C', fontWeight: 'bold' }}>{geukBadgeText}</span>
                    )}
                  </div>
                </>
              ) : (
                <span style={{ color: '#6A6560', fontSize: '14px' }}>
                  족보 없음 — 낱장 합산
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: '#2A2620', fontSize: '11px' }}>
              카드 선택 시 족보 표시
            </span>
          )}
        </div>

        {/* G1 수정 #4 — 인라인 안내 배너 (핸드 위) */}
        <InlineBanner message={bannerMessage} visible={bannerVisible} getCssDuration={getCssDuration} />

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
          {/* 체인 빛줄기 */}
          {selectedCards.length >= 2 && (
            <ChainGlow
              cards={chainCardPositions}
              getCssDuration={getCssDuration}
            />
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

            // G1 수정 #2(c) — 역극 카드: opacity 0.35, 필터 더 강하게
            // 핸드 모든 카드 중 역극 여부 (선택 여부와 무관하게 표시)
            const isYeokgeukInHand = GEUK_MAP[enemyElement] === card.element

            return (
              <button
                key={card.id}
                onClick={() => handleCardSelect(card.id)}
                style={{
                  width: w,
                  height: h,
                  backgroundColor: isYeokgeukInHand ? '#1A1614' : '#E8DCC4',
                  border: `2px solid ${isSelected ? elColor : isYeokgeukInHand ? '#2A2620' : '#2A2620'}`,
                  borderRadius: '2px',
                  position: 'relative',
                  cursor: 'pointer',
                  transform: `rotate(${angle}deg) translateY(${isSelected ? -14 : 0}px)`,
                  transition: `transform ${getCssDuration(120)} ease-out, border-color ${getCssDuration(120)} ease-out`,
                  boxShadow: isSelected ? `0 0 8px ${glowColor}` : 'none',
                  flexShrink: 0,
                  padding: 0,
                  // G1 수정: 역극 opacity 0.35, 필터 강화
                  opacity: isYeokgeukInHand ? 0.35 : 1,
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
                <span style={{
                  color: isYeokgeukInHand ? '#3A3530' : elColor,
                  fontSize: '11px',
                  position: 'absolute', bottom: '4px', left: '50%',
                  transform: 'translateX(-50%)',
                }}>
                  {ELEMENT_LABELS[card.element]}
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
                    오늘은 이 기운이 죽는 날
                  </div>
                )}
              </button>
            )
          })}
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
            disabled={selectedCards.length === 0 || discardsLeft <= 0}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: 'transparent',
              border: '1px solid #4A4540',
              color: discardsLeft <= 0 ? '#4A4540' : '#D8CCB4',
              fontSize: '14px',
              cursor: selectedCards.length === 0 || discardsLeft <= 0 ? 'not-allowed' : 'pointer',
              opacity: discardsLeft <= 0 ? 0.4 : 1,
              letterSpacing: '0.1em',
            }}
          >
            버리기 {discardsLeft}/3
          </button>
          <button
            onClick={handlePlayCards}
            disabled={selectedCards.length === 0 || playsLeft <= 0}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: selectedCards.length > 0 && playsLeft > 0 ? '#B33A2B' : '#2A2620',
              border: 'none',
              color: '#E8DCC4',
              fontSize: '14px',
              cursor: selectedCards.length === 0 || playsLeft <= 0 ? 'not-allowed' : 'pointer',
              opacity: playsLeft <= 0 ? 0.4 : 1,
              letterSpacing: '0.1em',
              transition: `background-color ${getCssDuration(150)}`,
            }}
          >
            출수 {playsLeft}/{floorConfig.maxPlays}
          </button>
        </div>

        {/* 패시브 슬롯 */}
        <div
          style={{
            height: '12vh',
            minHeight: '56px',
            backgroundColor: '#181410',
            borderTop: '1px solid #2A2620',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '0 16px',
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '44px',
                height: '44px',
                border: '1px solid #2A2620',
                backgroundColor: '#1C1710',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#2A2620', fontSize: '10px' }}>패</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
