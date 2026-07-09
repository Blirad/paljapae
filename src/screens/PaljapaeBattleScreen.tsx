/**
 * PaljapaeBattleScreen — 팔자전 전투 화면
 * G0.5 시안 색·질감·타이포 규범 준수
 * 390×844 기준 6구역 레이아웃
 */
import React, { useState, useEffect, useCallback } from 'react'
import type { BattleState, PaljapaeCard, Element, RelicId, PassiveId } from '@/types/paljapaeTypes'
import {
  initFloor,
  toggleSelect,
  playHand,
  discardSelected,
  calcRetaliation,
} from '@/game/engine/paljapaeEngine'
import { judgeHand, HAND_RANK_DISPLAY, calcDamage } from '@/game/engine/pokerHandJudge'
import { BALANCE } from '@/data/balance'
import { PASSIVE_DEFS } from '@/data/paljapaePassives'
import { RELIC_DEFS } from '@/data/paljapaeRelics'

// ─── 색상 상수 (G0.5 §8 hex 고정) ────────────────────────
const C = {
  bg:          '#16130F',
  bgCard:      '#241F18',
  hanji:       '#E8DCC4',
  juSa:        '#B33A2B',
  ink:         '#2A2620',
  hanjiText:   '#D8CCB4',
  wood:        '#4A9B6E',
  woodGlow:    '#7BD4A3',
  fire:        '#C63D2F',
  fireGlow:    '#FF7A5C',
  earth:       '#D9A441',
  earthGlow:   '#FFD98A',
  gold:        '#E8E3D5',
  goldGlow:    '#FFFFFF',
  goldText:    '#7A756A',  // 금(金) 카드 글자색
  water:       '#3D5A80',
  waterGlow:   '#8FB8DE',
  heroFrame:   '#C9A227',
} as const

type El5 = '木' | '火' | '土' | '金' | '水'

function elColor(el: El5): string {
  const map: Record<El5, string> = {
    木: C.wood, 火: C.fire, 土: C.earth, 金: C.gold, 水: C.water,
  }
  return map[el]
}

function elGlow(el: El5): string {
  const map: Record<El5, string> = {
    木: C.woodGlow, 火: C.fireGlow, 土: C.earthGlow, 金: C.goldGlow, 水: C.waterGlow,
  }
  return map[el]
}

function elTextColor(el: El5): string {
  return el === '金' ? C.goldText : C.ink
}

// 상극 맵 (극하는 쪽 → 극당하는 쪽)
const DOMINATES_MAP: Record<El5, El5> = {
  '木': '土', '火': '金', '土': '水', '金': '木', '水': '火',
}

function isCounterDayCard(card: PaljapaeCard, dayEl: Element): boolean {
  return DOMINATES_MAP[dayEl as El5] === card.element
}

// ─── 카드 컴포넌트 ──────────────────────────────────────

interface CardDisplayProps {
  card: PaljapaeCard
  isSelected: boolean
  isCounter: boolean
  rotate: number
  fanOffset: number
  onClick: () => void
}

function PaljapaeCardDisplay({ card, isSelected, isCounter, rotate, fanOffset, onClick }: CardDisplayProps) {
  const ec = elColor(card.element as El5)
  const eg = elGlow(card.element as El5)
  const tc = elTextColor(card.element as El5)
  const rarity = card.rarity ?? 'normal'

  // 등급별 테두리 스타일
  const rarityBorder = rarity === 'hero'
    ? `2px solid ${C.heroFrame}`
    : rarity === 'rare'
      ? `2px solid ${C.juSa}`
      : `1px solid ${C.ink}`

  const resolvedBoxShadow = isSelected
    ? `0 0 8px ${eg}88, 0 0 20px ${eg}50`
    : rarity === 'hero'
      ? `0 0 8px #C9A22760`
      : `0 0 4px ${ec}30`

  return (
    <div
      onClick={onClick}
      style={{
        width: 72,
        height: 101,
        borderRadius: 8,
        border: rarityBorder,
        background: C.hanji,
        position: 'relative',
        flexShrink: 0,
        cursor: 'pointer',
        transform: `rotate(${rotate}deg) translateY(${isSelected ? fanOffset - 16 : fanOffset}px)`,
        transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out',
        boxShadow: resolvedBoxShadow,
        overflow: 'hidden',
        opacity: isCounter ? 0.4 : 1,
        userSelect: 'none',
      }}
    >
      {/* 속성 배경 틴트 */}
      <div style={{ position: 'absolute', inset: 0, background: ec, opacity: 0.12, borderRadius: 6 }} />

      {/* 한지 노이즈 텍스처 */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='80' height='80' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.06, borderRadius: 6, pointerEvents: 'none', zIndex: 2,
      }} />

      {/* 역극 오버레이 */}
      {isCounter && (
        <div style={{ position: 'absolute', inset: 0, background: `${C.bg}99`, filter: 'saturate(0.3)', borderRadius: 6, zIndex: 10 }} />
      )}

      {/* 희귀 등급: 4모서리 ✚ 문양 */}
      {rarity === 'rare' && (
        <>
          <span style={{ position: 'absolute', top: 2, left: 2, color: C.juSa, fontSize: 7, lineHeight: 1, zIndex: 6, userSelect: 'none' }}>✚</span>
          <span style={{ position: 'absolute', top: 2, right: 2, color: C.juSa, fontSize: 7, lineHeight: 1, zIndex: 6, userSelect: 'none' }}>✚</span>
          <span style={{ position: 'absolute', bottom: 2, left: 2, color: C.juSa, fontSize: 7, lineHeight: 1, zIndex: 6, userSelect: 'none' }}>✚</span>
          <span style={{ position: 'absolute', bottom: 2, right: 2, color: C.juSa, fontSize: 7, lineHeight: 1, zIndex: 6, userSelect: 'none' }}>✚</span>
        </>
      )}

      {/* 좌상단: 값 */}
      <div style={{ position: 'absolute', top: 4, left: 5, fontSize: 16, fontWeight: 700, fontFamily: 'Pretendard, sans-serif', color: tc, lineHeight: 1, zIndex: 5 }}>
        {card.value}
      </div>

      {/* 우상단: 음양 기호 */}
      <div style={{ position: 'absolute', top: 4, right: 5, fontSize: 12, color: tc, lineHeight: 1, zIndex: 5 }}>
        {card.yinYang === '양' ? '●' : '○'}
      </div>

      {/* 중앙 문양 */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -55%)', fontSize: 32, fontFamily: 'Noto Serif KR, serif', fontWeight: 700, color: ec, opacity: 0.55, zIndex: 5, userSelect: 'none' }}>
        {card.element}
      </div>

      {/* 하단 속성 한자 */}
      <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontFamily: 'Noto Serif KR, serif', fontWeight: 700, color: ec, zIndex: 5 }}>
        {card.element}
      </div>
    </div>
  )
}

// ─── 부채꼴 배치 계산 ────────────────────────────────────

function getFanParams(index: number, total: number): { rotate: number; fanOffset: number } {
  if (total === 0) return { rotate: 0, fanOffset: 0 }
  const spread = Math.min(28, total * 3.5)
  const center = (total - 1) / 2
  const t = total > 1 ? (index - center) / center : 0
  const rotate = t * spread
  const fanOffset = Math.abs(t) * (total > 4 ? 28 : 14)
  return { rotate, fanOffset }
}

// ─── 족보 미리보기 띠 ────────────────────────────────────

function HandPreview({ state }: { state: BattleState }) {
  const selectedCards = state.hand.filter(c => state.selected.includes(c.id))

  if (selectedCards.length === 0) {
    return (
      <div style={{ height: 84, background: `${C.bgCard}cc`, borderTop: `1px solid ${C.juSa}55`, borderBottom: `1px solid ${C.juSa}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 13, color: `${C.hanjiText}66` }}>
          카드를 선택하세요 (최대 5장)
        </span>
      </div>
    )
  }

  const result = judgeHand(selectedCards)
  const rankName = HAND_RANK_DISPLAY[result.rank]
  const el = selectedCards[0].element as El5
  const gc = elGlow(el)
  const bc = elColor(el)

  const effectiveRelics = [...state.relics]
  const holiIdx = effectiveRelics.indexOf('holibyeong')
  if (holiIdx !== -1 && state.playerHp > 30) effectiveRelics.splice(holiIdx, 1)

  const estDamage = calcDamage(selectedCards, result, state.enemyElement, state.dayElement, effectiveRelics, state.passives)

  return (
    <div style={{ height: 84, background: `${C.bgCard}cc`, borderTop: `1px solid ${C.juSa}55`, borderBottom: `1px solid ${C.juSa}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${bc}22`, border: `1px solid ${gc}66`, borderRadius: 8, padding: '6px 16px' }}>
        <span style={{ fontFamily: "'Nanum Brush Script', '나눔손글씨 붓', cursive", fontSize: 20, color: gc, letterSpacing: 1 }}>
          {rankName}
        </span>
        <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 22, fontWeight: 700, color: C.earthGlow }}>
          ×{result.multiplier}
        </span>
        <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 14, color: `${C.hanjiText}aa` }}>
          예상 {estDamage}
        </span>
      </div>
    </div>
  )
}

// ─── Web Audio 합성음 ────────────────────────────────────
// 임의 결정: Howler.js 대신 Web Audio API 합성음 사용 (음원 파일 없음)

let _audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}

type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle'

function playTone(freq: number, duration: number, type: OscType = 'sine', gain: number = 0.12) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gainNode.gain.setValueAtTime(gain, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch { /* 오디오 컨텍스트 불가 시 무시 */ }
}

const SFX = {
  cardSelect:   () => playTone(880, 0.08, 'sine', 0.08),
  cardDiscard:  () => playTone(220, 0.15, 'triangle', 0.07),
  handLand:     () => playTone(440, 0.2, 'sine', 0.1),
  handRankUp:   (rank: number) => playTone(330 + rank * 110, 0.3, 'sine', 0.13),
  scoreTick:    (pitch: number) => playTone(220 + pitch * 30, 0.05, 'square', 0.04),
  dominateJing: () => { playTone(660, 0.4, 'sine', 0.18); playTone(880, 0.4, 'sine', 0.09) },
  reverseDrum:  () => playTone(55, 0.3, 'triangle', 0.22),
  fiveElements: () => { [261, 329, 392, 523, 659].forEach((f, i) => setTimeout(() => playTone(f, 0.4, 'sine', 0.16), i * 180)) },
  hit:          () => playTone(110, 0.25, 'sawtooth', 0.18),
  floorClear:   () => { [440, 554, 659].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.18), i * 150)) },
  defeat:       () => playTone(110, 1.2, 'sine', 0.28),
}

// ─── 메인 전투 화면 ──────────────────────────────────────

interface PaljapaeBattleScreenProps {
  floor?: number
  dayElement?: Element
  relics?: RelicId[]
  passives?: PassiveId[]
  onVictory?: (score: number) => void
  onDefeat?: () => void
}

const ELEMENTS_LIST: Element[] = ['木', '火', '土', '金', '水']

export default function PaljapaeBattleScreen({
  floor = 1,
  dayElement,
  relics = [],
  passives = [],
  onVictory,
  onDefeat,
}: PaljapaeBattleScreenProps): React.ReactElement {
  const [state, setState] = useState<BattleState>(() => {
    const el: Element = dayElement ?? ELEMENTS_LIST[Math.floor(Math.random() * 5)]
    return initFloor(floor, el, relics, passives)
  })

  const [speed, setSpeed] = useState<1 | 2>(1)
  const [dmgPopup, setDmgPopup] = useState<{ value: number; show: boolean }>({ value: 0, show: false })
  const [chainLight, setChainLight] = useState<Element[]>([])
  const [fiveElAnim, setFiveElAnim] = useState(false)
  const [inkAnim, setInkAnim] = useState(false)
  const [shake, setShake] = useState(false)
  const [shakeAmp, setShakeAmp] = useState(4)
  const [phase, setPhase] = useState<'battle' | 'victory' | 'defeat'>('battle')
  const [currentDayEl, setCurrentDayEl] = useState<Element>(state.dayElement)

  const dur = useCallback((ms: number) => Math.round(ms / speed), [speed])

  const triggerShake = useCallback((dmg: number) => {
    const amp = Math.min(12, 4 + Math.floor(dmg / 100))
    setShakeAmp(amp)
    setShake(true)
    setTimeout(() => setShake(false), 250)
  }, [])

  // 일진 토글 (테스트용)
  const handleDayToggle = useCallback((el: Element) => {
    setCurrentDayEl(el)
    setState(prev => ({ ...prev, dayElement: el }))
  }, [])

  // 카드 선택
  const handleCardClick = useCallback((cardId: string) => {
    SFX.cardSelect()
    setState(prev => toggleSelect(prev, cardId))
  }, [])

  // 출수 실행
  const handlePlayHand = useCallback(() => {
    if (state.selected.length === 0 || state.playsLeft <= 0) return

    const selectedCards = state.hand.filter(c => state.selected.includes(c.id))
    const { newState, handResult, damageDealt, dominateApplied } = playHand(state)

    const RANK_SCORE: Record<string, number> = {
      none: 0, yinYangPair: 1, chain2: 2, gather3: 2, chain3: 3, gather4: 3, chain4: 4, gather5: 4, fiveElements: 5,
    }
    const rankNum = RANK_SCORE[handResult.rank] ?? 0

    SFX.handLand()
    setTimeout(() => SFX.handRankUp(rankNum), 100)

    if (dominateApplied) setTimeout(() => SFX.dominateJing(), dur(200))

    const hasCounter = selectedCards.some(c => isCounterDayCard(c, state.dayElement))
    if (hasCounter) {
      setInkAnim(true)
      SFX.reverseDrum()
      setTimeout(() => setInkAnim(false), dur(400))
    }

    if (handResult.rank === 'fiveElements') {
      setFiveElAnim(true)
      SFX.fiveElements()
      setTimeout(() => setFiveElAnim(false), dur(2500))
    }

    if (handResult.chainElements && handResult.chainElements.length >= 2) {
      setChainLight(handResult.chainElements)
      setTimeout(() => setChainLight([]), dur(handResult.chainElements!.length * 180))
    }

    setTimeout(() => {
      setDmgPopup({ value: damageDealt, show: true })
      triggerShake(damageDealt)
      SFX.hit()
    }, dur(250))
    setTimeout(() => setDmgPopup(prev => ({ ...prev, show: false })), dur(250 + 900))

    const tickCount = Math.min(10, Math.floor(damageDealt / 30))
    for (let i = 0; i < tickCount; i++) {
      setTimeout(() => SFX.scoreTick(i), dur(300 + i * 150))
    }

    setState(newState)

    if (newState.enemyHp <= 0) {
      setTimeout(() => { SFX.floorClear(); setPhase('victory') }, dur(600))
    } else if (newState.playsLeft <= 0) {
      const retaliation = calcRetaliation(state.floor, state.relics)
      setTimeout(() => {
        SFX.hit()
        setState(prev => {
          const newHp = prev.playerHp - retaliation
          if (newHp <= 0) setTimeout(() => { SFX.defeat(); setPhase('defeat') }, 300)
          return { ...prev, playerHp: Math.max(0, newHp) }
        })
      }, dur(400))
    }
  }, [state, dur, triggerShake])

  // 버리기 실행
  const handleDiscard = useCallback(() => {
    if (state.selected.length === 0 || state.discardsLeft <= 0) return
    SFX.cardDiscard()
    setState(prev => discardSelected(prev))
  }, [state])

  // 승패 → 콜백
  useEffect(() => {
    if (phase === 'victory' && onVictory) {
      const t = setTimeout(() => onVictory(state.score), dur(1000))
      return () => clearTimeout(t)
    }
    if (phase === 'defeat' && onDefeat) {
      const t = setTimeout(() => onDefeat(), dur(1500))
      return () => clearTimeout(t)
    }
  }, [phase, onVictory, onDefeat, state.score, dur])

  const hpPct = state.playerHp / state.playerMaxHp
  const enemyHpPct = state.enemyHp / state.enemyMaxHp
  const floorIdx = Math.min(state.floor - 1, BALANCE.FLOORS.length - 1)
  const maxPlays = BALANCE.FLOORS[floorIdx].playsAllowed
  const playsUsed = maxPlays - state.playsLeft

  const shakeStyle = shake ? { transform: `translateX(${(Math.random() < 0.5 ? 1 : -1) * shakeAmp}px)` } : {}

  return (
    <div style={{
      width: '100%',
      maxWidth: 390,
      height: '100dvh',
      maxHeight: 844,
      background: C.bg,
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto',
      transition: shake ? 'none' : 'transform 0.05s ease',
      ...shakeStyle,
    }}>

      {/* 오행연환 전용 연출 */}
      {fiveElAnim && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', gap: 20 }}>
          <div style={{ fontFamily: "'Nanum Brush Script', cursive", fontSize: 64, color: C.earthGlow, textShadow: `0 0 40px ${C.earthGlow}`, animation: `fiveElPop ${dur(800)}ms ease-out` }}>
            오행연환
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {ELEMENTS_LIST.map((el, i) => (
              <span key={el} style={{ fontSize: 28, color: elGlow(el as El5), textShadow: `0 0 12px ${elGlow(el as El5)}`, animationDelay: `${i * dur(200)}ms` }}>
                {el}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 역극 먹물번짐 */}
      {inkAnim && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 150, pointerEvents: 'none', background: `radial-gradient(circle at center, transparent 30%, ${C.ink}99 100%)`, animation: `inkBleed ${dur(400)}ms ease-out forwards` }} />
      )}

      {/* 체인 빛줄기 */}
      {chainLight.length >= 2 && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 120, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {chainLight.map((el, i) => (
            <div key={i} style={{ width: 4, height: 120, background: `linear-gradient(to bottom, transparent, ${elGlow(el as El5)}, transparent)`, boxShadow: `0 0 12px ${elGlow(el as El5)}`, borderRadius: 2, animation: `chainRay ${dur(180)}ms ease-out ${i * dur(180)}ms both` }} />
          ))}
        </div>
      )}

      {/* ── 상단바 6% ≈ 50px ── */}
      <div style={{ height: 50, background: C.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', borderBottom: `1px solid ${C.juSa}33`, flexShrink: 0, gap: 6 }}>
        {/* 층수 + 일진 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: C.hanjiText, fontFamily: 'Pretendard, sans-serif', fontSize: 11 }}>{state.floor}층</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {ELEMENTS_LIST.map(el => (
              <button key={el} onClick={() => handleDayToggle(el)} style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${currentDayEl === el ? elGlow(el as El5) : elColor(el as El5) + '44'}`, background: currentDayEl === el ? `${elColor(el as El5)}44` : 'transparent', color: currentDayEl === el ? elGlow(el as El5) : `${elColor(el as El5)}88`, fontSize: 11, cursor: 'pointer', fontFamily: 'Noto Serif KR, serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{el}</button>
            ))}
          </div>
        </div>

        {/* 배속 토글 */}
        <button onClick={() => setSpeed(s => s === 1 ? 2 : 1)} style={{ padding: '2px 5px', background: 'transparent', border: `1px solid ${C.hanjiText}44`, borderRadius: 4, color: C.hanjiText, fontSize: 10, cursor: 'pointer', fontFamily: 'Pretendard, sans-serif' }}>
          {speed}x
        </button>

        {/* 플레이어 HP바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: C.fireGlow, fontSize: 10, fontFamily: 'Pretendard, sans-serif' }}>HP</span>
          <div style={{ width: 70, height: 6, background: '#ffffff22', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${hpPct * 100}%`, height: '100%', background: hpPct > 0.5 ? `linear-gradient(90deg, ${C.fire}, ${C.fireGlow})` : hpPct > 0.25 ? `linear-gradient(90deg, ${C.earth}, ${C.earthGlow})` : `linear-gradient(90deg, ${C.juSa}, ${C.fireGlow})`, borderRadius: 3, transition: 'width 0.3s ease' }} />
          </div>
          <span style={{ color: C.hanjiText, fontSize: 9, fontFamily: 'Pretendard, sans-serif' }}>{state.playerHp}/{state.playerMaxHp}</span>
        </div>
      </div>

      {/* ── 적 영역 24% ≈ 202px ── */}
      <div style={{ height: 202, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 0', flexShrink: 0, position: 'relative' }}>
        {/* 데미지 팝업 */}
        {dmgPopup.show && (
          <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', fontFamily: "'Nanum Brush Script', '나눔손글씨 붓', cursive", fontSize: dmgPopup.value >= 1000 ? 52 : 64, color: C.fire, lineHeight: 1, textShadow: `0 0 18px ${C.fireGlow}aa, 0 2px 4px #000`, letterSpacing: -2, zIndex: 100, pointerEvents: 'none', animation: `damagePopup 0.9s ease-out forwards` }}>
            {dmgPopup.value}
          </div>
        )}

        {/* 적 일러스트 */}
        <div style={{ width: 90, height: 90, borderRadius: 12, background: C.bgCard, border: `1px solid ${state.enemyElement ? elColor(state.enemyElement as El5) + '55' : C.juSa + '55'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: state.enemyElement ? elColor(state.enemyElement as El5) : C.juSa, fontFamily: 'Noto Serif KR, serif', fontSize: 36, opacity: 0.7 }}>
            {state.enemyElement ?? '鬼'}
          </span>
        </div>

        {/* 적 이름 + HP바 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.hanjiText, fontFamily: 'Pretendard, sans-serif', fontSize: 13 }}>{state.enemyName}</span>
            {state.enemyElement && (
              <span style={{ fontSize: 11, color: elColor(state.enemyElement as El5), fontFamily: 'Noto Serif KR, serif', border: `1px solid ${elColor(state.enemyElement as El5)}55`, borderRadius: 3, padding: '1px 4px' }}>{state.enemyElement}</span>
            )}
          </div>
          <div style={{ width: 160, height: 8, background: '#ffffff22', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${enemyHpPct * 100}%`, height: '100%', background: `linear-gradient(90deg, ${C.juSa}, ${C.fireGlow})`, borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ color: '#ffffff88', fontFamily: 'Pretendard, sans-serif', fontSize: 11 }}>{state.enemyHp} / {state.enemyMaxHp}</span>
        </div>

        <span style={{ color: `${C.hanjiText}66`, fontFamily: 'Pretendard, sans-serif', fontSize: 10 }}>누적 피해: {state.score}</span>
      </div>

      {/* ── 족보 미리보기 띠 10% ≈ 84px ── */}
      <HandPreview state={state} />

      {/* ── 핸드 영역 36% ≈ 304px ── */}
      <div style={{ height: 304, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 16px', flexShrink: 0, position: 'relative', overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
          {state.hand.map((card, i) => {
            const { rotate, fanOffset } = getFanParams(i, state.hand.length)
            return (
              <div key={card.id} style={{ marginLeft: i === 0 ? 0 : -14 }}>
                <PaljapaeCardDisplay
                  card={card}
                  isSelected={state.selected.includes(card.id)}
                  isCounter={isCounterDayCard(card, state.dayElement)}
                  rotate={rotate}
                  fanOffset={fanOffset}
                  onClick={() => handleCardClick(card.id)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 버튼 영역 12% ≈ 101px ── */}
      <div style={{ height: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 16px', flexShrink: 0, background: `${C.bg}bb` }}>
        <button
          onClick={handleDiscard}
          disabled={state.selected.length === 0 || state.discardsLeft <= 0}
          style={{ padding: '10px 18px', background: 'transparent', border: `1px solid ${state.discardsLeft > 0 ? C.hanjiText + '66' : '#ffffff22'}`, borderRadius: 8, color: state.discardsLeft > 0 ? C.hanjiText : '#ffffff33', fontFamily: 'Pretendard, sans-serif', fontSize: 13, cursor: state.discardsLeft > 0 ? 'pointer' : 'not-allowed' }}
        >
          버리기 {BALANCE.DISCARD_LIMIT - state.discardsLeft}/{BALANCE.DISCARD_LIMIT}
        </button>
        <button
          onClick={handlePlayHand}
          disabled={state.selected.length === 0 || state.playsLeft <= 0}
          style={{ padding: '10px 24px', background: state.playsLeft > 0 ? C.juSa : '#4a2020', border: 'none', borderRadius: 8, color: C.hanji, fontFamily: 'Pretendard, sans-serif', fontSize: 13, fontWeight: 700, cursor: state.playsLeft > 0 ? 'pointer' : 'not-allowed' }}
        >
          출수 {playsUsed}/{maxPlays}
        </button>
      </div>

      {/* ── 패시브 슬롯 12% ≈ 101px ── */}
      <div style={{ height: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 16px', flexShrink: 0, background: C.bgCard, borderTop: `1px solid ${C.juSa}33` }}>
        {state.passives.slice(0, 3).map(pid => {
          const def = PASSIVE_DEFS[pid]
          return (
            <div key={pid} title={def.description} style={{ width: 52, height: 52, borderRadius: 10, border: `1px solid ${C.hanjiText}44`, background: `${C.hanjiText}11`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontFamily: 'Noto Serif KR, serif', fontSize: 12, color: C.hanjiText }}>{def.name.charAt(0)}</span>
              <span style={{ fontSize: 8, color: `${C.hanjiText}88`, fontFamily: 'Pretendard, sans-serif' }}>{def.name.split('(')[0]}</span>
            </div>
          )
        })}
        {state.relics.slice(0, 2).map(rid => {
          const def = RELIC_DEFS[rid]
          return (
            <div key={rid} title={def.description} style={{ width: 52, height: 52, borderRadius: 10, border: `1px solid ${C.heroFrame}88`, background: `${C.heroFrame}11`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontFamily: 'Noto Serif KR, serif', fontSize: 12, color: C.heroFrame }}>器</span>
              <span style={{ fontSize: 8, color: `${C.heroFrame}88`, fontFamily: 'Pretendard, sans-serif' }}>{def.name.split('(')[0]}</span>
            </div>
          )
        })}
        {Array.from({ length: Math.max(0, 5 - state.passives.slice(0, 3).length - state.relics.slice(0, 2).length) }).map((_, i) => (
          <div key={`empty-${i}`} style={{ width: 52, height: 52, borderRadius: 10, border: `1px dashed ${C.hanjiText}22`, background: 'transparent' }} />
        ))}
      </div>

      {/* 승리 오버레이 */}
      {phase === 'victory' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 300 }}>
          <span style={{ fontFamily: "'Nanum Brush Script', cursive", fontSize: 52, color: C.earthGlow, textShadow: `0 0 20px ${C.earthGlow}` }}>승</span>
          <span style={{ color: C.hanjiText, fontFamily: 'Pretendard, sans-serif', fontSize: 16 }}>총 피해: {state.score}</span>
          <button onClick={() => onVictory?.(state.score)} style={{ padding: '12px 32px', background: C.juSa, border: 'none', borderRadius: 8, color: C.hanji, fontFamily: 'Pretendard, sans-serif', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            다음 층
          </button>
        </div>
      )}

      {/* 패배 오버레이 */}
      {phase === 'defeat' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 300 }}>
          <span style={{ fontFamily: "'Nanum Brush Script', cursive", fontSize: 52, color: C.juSa, textShadow: `0 0 20px ${C.juSa}` }}>패</span>
          <span style={{ color: `${C.hanjiText}88`, fontFamily: 'Noto Serif KR, serif', fontSize: 14 }}>운명이 그대를 외면하였도다</span>
          <button onClick={() => onDefeat?.()} style={{ padding: '12px 32px', background: '#3a1a1a', border: `1px solid ${C.juSa}`, borderRadius: 8, color: C.hanjiText, fontFamily: 'Pretendard, sans-serif', fontSize: 15, cursor: 'pointer' }}>
            처음으로
          </button>
        </div>
      )}

      {/* CSS keyframes */}
      <style>{`
        @keyframes damagePopup {
          0%   { opacity: 1; transform: translateX(-50%) scale(1.2); }
          60%  { opacity: 1; transform: translateX(-50%) translateY(-24px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(0.8); }
        }
        @keyframes fiveElPop {
          0%   { opacity: 0; transform: scale(0.5); }
          40%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.8; transform: scale(1.0); }
        }
        @keyframes chainRay {
          0%   { opacity: 0; transform: scaleY(0); }
          50%  { opacity: 1; transform: scaleY(1.1); }
          100% { opacity: 0; transform: scaleY(1); }
        }
        @keyframes inkBleed {
          0%   { opacity: 0; }
          40%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
