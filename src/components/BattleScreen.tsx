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
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { FLOOR_CONFIGS } from '../engine/balance'
import { useGameContext } from '../context/GameContext'
import { audioManager } from '../services/audioManager'

const ELEMENT_LABELS: Record<string, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}

const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#7A756A', su: '#3D5A80',
}

// 오방색 글로우 (Section 1-2)
const ELEMENT_GLOW_COLORS: Record<string, string> = {
  mok: '#7BD4A3',
  hwa: '#FF7A5C',
  to: '#FFD98A',
  geum: '#E8E3D5',
  su: '#8FB8DE',
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
  // stagger: cardIndex * 150ms (배속 적용)
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
  phase: 0 | 1 | 2  // 0=orb rotate, 1=sequential light, 2=explosion
  litElements: number  // 0~5
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
      {/* Phase 0: 원환 회전 + Phase 1: 5색 점등 */}
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

        {/* 중앙 오행 문자 */}
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

      {/* Phase 2: 폭발 파티클 */}
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

// ---------- 카드 위치 계산 (체인 글로우용) ----------
function getCardPositions(hand: Array<{ id: string; element: string }>, selectedIds: string[]) {
  const selectedCards = hand.filter(c => selectedIds.includes(c.id))
  const totalWidth = 300  // 핸드 전체 추정 폭
  const cardWidth = 62
  const spacing = totalWidth / Math.max(selectedCards.length, 1)

  return selectedCards.map((card, idx) => ({
    id: card.id,
    element: card.element,
    x: totalWidth / 2 - (selectedCards.length - 1) * spacing / 2 + idx * spacing + cardWidth / 2,
    y: 60,  // 핸드 영역 상단 기준
  }))
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
  } = useGameStore()

  const { getCssDuration, getDuration, playbackSpeed, togglePlaybackSpeed } = useGameContext()

  const floorConfig = FLOOR_CONFIGS[currentFloor - 1]

  // ---------- VFX 상태 ----------
  const [shakeActive, setShakeActive] = useState(false)
  const [shakeAmplitude, setShakeAmplitude] = useState(4)
  const [scorePopups, setScorePopups] = useState<ScorePopItem[]>([])
  const [elementalSeq, setElementalSeq] = useState<ElementalSeqState>({
    active: false,
    phase: 0,
    litElements: 0,
  })

  // 이전 enemyHp 추적 (피해량 계산)
  const prevEnemyHp = useRef(enemyHp)
  const prevPlayerHp = useRef(playerHp)

  // Phase 전환 처리
  useEffect(() => {
    if (phase === 'floor-reward') {
      // 층 클리어 사운드
      audioManager.floorClearAscending()
      onFloorClear()
    } else if (phase === 'result') {
      if (isVictory) {
        audioManager.floorClearAscending()
      } else {
        audioManager.defeatDeepTone()
      }
      onResult(isVictory)
    }
  }, [phase, isVictory, onFloorClear, onResult])

  // 적 HP 변화 감지 → Score Popup + Screen Shake
  useEffect(() => {
    const damage = prevEnemyHp.current - enemyHp
    if (damage > 0) {
      // 체인 빛줄기가 오행연환이면 ElementalSequence 트리거
      if (previewResult?.rank === 'ohang-yeonhwan') {
        triggerElementalSequence()
      }

      // Score Popup (출수한 카드들)
      const selected = hand.filter(c => selectedCards.includes(c.id))
      const perCardDamage = Math.floor(damage / Math.max(selected.length, 1))
      const newPopups: ScorePopItem[] = selected.map((_, idx) => ({
        id: `popup-${Date.now()}-${idx}`,
        cardIndex: idx,
        damage: perCardDamage,
      }))
      setScorePopups(prev => [...prev, ...newPopups])

      // 사운드: 카드별 피치 상승 틱
      selected.forEach((_, idx) => {
        setTimeout(() => {
          audioManager.scoreCountTick(idx, selected.length)
        }, idx * getDuration(150))
      })

      // 팝업 제거 (300ms * maxCards + stagger)
      const totalDuration = getDuration(300) + selected.length * getDuration(150) + 200
      setTimeout(() => {
        setScorePopups(prev => prev.filter(p => !newPopups.some(n => n.id === p.id)))
      }, totalDuration)

      // Screen Shake (피해 비례 4~12px)
      const amplitude = Math.max(4, Math.min(12, 4 + (damage / 100) * 8))
      setShakeAmplitude(amplitude)
      setShakeActive(true)
      setTimeout(() => setShakeActive(false), getDuration(250))
    }
    prevEnemyHp.current = enemyHp
  }, [enemyHp])  // eslint-disable-line react-hooks/exhaustive-deps

  // 플레이어 HP 감소 → 피격 사운드
  useEffect(() => {
    if (playerHp < prevPlayerHp.current) {
      audioManager.playerHit()
    }
    prevPlayerHp.current = playerHp
  }, [playerHp])

  // 오행연환 시퀀스 트리거
  const triggerElementalSequence = useCallback(() => {
    audioManager.elementalSequenceKoreanPercussion()

    setElementalSeq({ active: true, phase: 0, litElements: 0 })

    // Phase 1: 5색 순차 점등 (800ms 후 시작, 200ms 간격)
    for (let i = 0; i <= 5; i++) {
      setTimeout(() => {
        setElementalSeq(prev => ({ ...prev, phase: 1, litElements: i }))
      }, getDuration(800) + i * getDuration(200))
    }

    // Phase 2: 폭발 (1800ms 후)
    setTimeout(() => {
      setElementalSeq(prev => ({ ...prev, phase: 2 }))
    }, getDuration(1800))

    // 종료 (2500ms 후)
    setTimeout(() => {
      setElementalSeq({ active: false, phase: 0, litElements: 0 })
    }, getDuration(2500) + 100)
  }, [getDuration])

  // 카드 선택 사운드
  const handleCardSelect = useCallback((cardId: string) => {
    audioManager.cardSelectTick()
    toggleCardSelect(cardId)
  }, [toggleCardSelect])

  // 출수 처리 (족보 성립 사운드 포함)
  const handlePlayCards = useCallback(() => {
    if (selectedCards.length === 0 || playsLeft <= 0) return

    // 족보 성립 사운드
    if (previewResult && previewResult.rank !== 'none') {
      const rank = previewResult.rank
      let rarity: 'common' | 'rare' | 'hero' = 'common'
      if (rank === 'ohang-yeonhwan' || rank === 'saengchae-chain') rarity = 'hero'
      else if (rank === 'geukchae-chain' || rank === 'eumyang-pair-3' || rank === 'jipgyeol-5') rarity = 'rare'
      audioManager.genealogyMatch(rarity)

      // 역극 사운드
      if (rank === 'geuk-bonas') {
        setTimeout(() => audioManager.hostileDrum(), getDuration(80))
      }
      // 극 보너스 징
      if (rank === 'geukchae-chain') {
        setTimeout(() => audioManager.affinityBonusGong(), getDuration(100))
      }
    }

    // 출수 착지 사운드 (카드당 stagger)
    selectedCards.forEach((_, idx) => {
      setTimeout(() => {
        audioManager.cardLand()
      }, idx * getDuration(80))
    })

    playSelectedCards()
  }, [selectedCards, playsLeft, previewResult, getDuration, playSelectedCards])

  // 버리기 처리 (스윗 사운드)
  const handleDiscardCards = useCallback(() => {
    if (selectedCards.length === 0 || discardsLeft <= 0) return
    audioManager.cardDiscardSwish()
    discardSelectedCards()
  }, [selectedCards, discardsLeft, discardSelectedCards])

  const enemyHpPercent = Math.max(0, (enemyHp / enemyMaxHp) * 100)
  const playerHpPercent = Math.max(0, (playerHp / playerMaxHp) * 100)

  // 체인 글로우 좌표 (선택 카드 위치 추정)
  const chainCardPositions = getCardPositions(
    hand.map(c => ({ id: c.id, element: c.element })),
    selectedCards
  )

  // 화면 셰이크 CSS keyframe inline 정의
  const shakeStyle: React.CSSProperties = shakeActive
    ? {
        animation: `screenShake ${getCssDuration(250)} ease-in-out`,
        '--shake-amp': `${shakeAmplitude}px`,
      } as React.CSSProperties
    : {}

  return (
    <>
      {/* 전역 CSS 애니메이션 (keyframes) */}
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
      `}</style>

      {/* 오행연환 오버레이 */}
      <ElementalSequenceOverlay seq={elementalSeq} getCssDuration={getCssDuration} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          backgroundColor: '#16130F',
          overflow: 'hidden',
          ...shakeStyle,
        }}
      >
        {/* 상단바: 층수·일진속성·체력 (6%) */}
        <div
          style={{
            backgroundColor: '#241F18',
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
            {currentFloor}층
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 배속 토글 버튼 (Section 5, line 93) */}
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

        {/* 적 영역 (24%) — Score Popup 여기에 렌더 */}
        <div
          style={{
            height: '24vh',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            position: 'relative',
          }}
        >
          <div style={{ color: '#D8CCB4', fontSize: '15px', letterSpacing: '0.1em' }}>
            {floorConfig.enemyName}
          </div>
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
          {/* 반격 예고 */}
          <div style={{ color: '#4A4540', fontSize: '11px' }}>
            반격: {floorConfig.counterDamage} 피해
          </div>

          {/* Score Popup 렌더 (Section 5, line 87) */}
          {scorePopups.map(item => (
            <ScorePopup key={item.id} item={item} getCssDuration={getCssDuration} />
          ))}
        </div>

        {/* 족보 미리보기 (10%) */}
        <div
          style={{
            height: '10vh',
            minHeight: '56px',
            backgroundColor: previewResult ? '#241F18' : 'transparent',
            borderTop: '1px solid #2A2620',
            borderBottom: '1px solid #2A2620',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: `background-color ${getCssDuration(150)}`,
          }}
        >
          {previewResult ? (
            <>
              <span style={{ color: '#D9A441', fontSize: '14px', fontWeight: 'bold' }}>
                {previewResult.description}
              </span>
              <span style={{ color: '#D8CCB4', fontSize: '13px' }}>
                {previewResult.baseScore} × {previewResult.multiplier} ={' '}
                <strong style={{ color: '#4A9B6E', fontSize: '16px' }}>{previewResult.totalScore}</strong>
              </span>
            </>
          ) : (
            <span style={{ color: '#4A4540', fontSize: '12px' }}>
              카드 선택 시 족보 표시
            </span>
          )}
        </div>

        {/* 핸드 부채꼴 (36%) — Chain Glow SVG 오버레이 포함 */}
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
          {/* 체인 빛줄기 (Section 5, line 88) */}
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

            return (
              <button
                key={card.id}
                onClick={() => handleCardSelect(card.id)}
                style={{
                  width: w,
                  height: h,
                  backgroundColor: '#E8DCC4',
                  border: `2px solid ${isSelected ? elColor : '#2A2620'}`,
                  borderRadius: '2px',
                  position: 'relative',
                  cursor: 'pointer',
                  transform: `rotate(${angle}deg) translateY(${isSelected ? -14 : 0}px)`,
                  transition: `transform ${getCssDuration(120)} ease-out, border-color ${getCssDuration(120)} ease-out`,
                  boxShadow: isSelected ? `0 0 8px ${glowColor}` : 'none',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <div style={{
                  position: 'absolute', inset: '2px',
                  border: `1px solid ${isSelected ? elColor : '#B33A2B'}`,
                  opacity: isSelected ? 0.9 : 0.3,
                  borderRadius: '1px',
                }} />
                <span style={{
                  color: '#2A2620', fontSize: '17px', fontWeight: 'bold',
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}>
                  {card.value}
                </span>
                <span style={{
                  color: elColor, fontSize: '11px',
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
              </button>
            )
          })}
        </div>

        {/* 버리기·출수 버튼 (12%) */}
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

        {/* 패시브 슬롯 (12%) */}
        <div
          style={{
            height: '12vh',
            minHeight: '56px',
            backgroundColor: '#1A1712',
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
                backgroundColor: '#241F18',
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
