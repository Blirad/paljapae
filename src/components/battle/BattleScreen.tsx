/**
 * BattleScreen — 배틀 메인 화면
 * 리라 스펙 §2 전체 레이아웃
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import gsap from 'gsap'
import { useBattleStore } from '@/game/store/battleStore'
import type { InteractionState } from '@/game/store/battleStore'
import { useOnboardingStore } from '@/game/store/onboardingStore'
import { createStartingDeck } from '@/game/store/onboardingStore'
import { useUnlockStore } from '@/stores/unlockStore'
import type { HeroId } from '@/types/game'
import { HEROES } from '@/types/game'
import { useRelicStore } from '@/stores/relicStore'
import { useChallengeStore } from '@/stores/challengeStore'

import TopStatusBar from './TopStatusBar'
import DailyElementBanner from './DailyElementBanner'
import ComboCounter from './ComboCounter'
import ElementMatchup from './ElementMatchup'
import PlayerStatusBar from './PlayerStatusBar'
import FieldArea from './FieldArea'
import HandArea from './HandArea'
import ActionBar from './ActionBar'
import AITurnOverlay from './AITurnOverlay'
import LogPanel from './LogPanel'
import ResultScreen from './ResultScreen'
import DamagePopup from './DamagePopup'
import FieldSeparator from './FieldSeparator'
import BattleParticles from './BattleParticles'
import type { BattleParticlesRef } from './BattleParticles'
import HeroCharacter from './HeroCharacter'
import RelicTooltip from './RelicTooltip'
import EffectToast from './EffectToast'
import DaewoonSlot from './DaewoonSlot'
import type { SilhouetteVariant } from './CardArtSVG'
import type { FieldUnit } from '@/types/cards'
import type { CardEffect } from '@/game/engine/effectEngine'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY, GENERATES } from '@/types/elements'
import { getDailyPillarInfo } from '@/game/saju/manseryeok'
import { STAGES_BY_ID } from '@/data/stages'
import type { GameState } from '@/types/game'

// ────────────────────────────────────────────────────
// EffectToast 큐 아이템 타입
// ────────────────────────────────────────────────────

interface EffectToastItem {
  id: string
  effectType: CardEffect['type']
  text: string
  cardName?: string
}

// ────────────────────────────────────────────────────
// 오행 → 영웅 타입 매핑 (Phase 2-A 리라 스펙 §3)
// ────────────────────────────────────────────────────

const ELEMENT_HERO_MAP: Record<FiveElement, SilhouetteVariant> = {
  '火': 'rush',
  '水': 'iceblade',
  '木': 'taoist',
  '金': 'swordsman',
  '土': 'shield',
}

// AI 영웅 타입: 오행 기반 (neutral이면 'spear' 기본값)
function getAiHeroType(element: string): SilhouetteVariant {
  if (element in ELEMENT_HERO_MAP) {
    return ELEMENT_HERO_MAP[element as FiveElement]
  }
  return 'spear'
}

// ────────────────────────────────────────────────────
// 글로벌 CSS 애니메이션 (인라인 스타일 보조)
// ────────────────────────────────────────────────────

const GLOBAL_STYLES = `
@keyframes pulseRed {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes scaleIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes floatUp {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
@keyframes cardAppear {
  0%   { transform: scale(0.4) translateY(12px); opacity: 0; }
  60%  { transform: scale(1.12) translateY(-4px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes heroGlowPulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.2); }
}
@keyframes dailyBannerIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes comboCountUp {
  0% { transform: scale(1); }
  50% { transform: scale(1.4); }
  100% { transform: scale(1); }
}
@keyframes daewoonRipple {
  0%   { transform: scale(1); opacity: 1; }
  50%  { transform: scale(1.04) translateX(-3px); opacity: 0.7; filter: blur(1px) hue-rotate(-20deg); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes relicGlow {
  0%   { filter: brightness(1); }
  50%  { filter: brightness(2.2); }
  100% { filter: brightness(1); }
}
@keyframes energySurge {
  0%   { filter: brightness(1); }
  50%  { filter: brightness(2.5) drop-shadow(0 0 8px #FFD700); }
  100% { filter: brightness(1); }
}
@keyframes effectToastIn {
  from { opacity: 0; transform: translate(-50%, -40%); }
  to   { opacity: 1; transform: translate(-50%, -50%); }
}
@keyframes battlecryIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ringPulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.12); }
  100% { transform: scale(1); }
}
`

// ────────────────────────────────────────────────────
// 오행별 전투 배경 — FAIL1 수정: JS inline style로 강제 적용
// CSS 선택자가 브라우저 캐시나 specificity 문제로 무시될 경우를 대비
// ────────────────────────────────────────────────────
// M8 P0: 채도/대비 강화 (리라 스펙 §3)
const ELEMENT_BATTLE_BG: Record<string, string> = {
  '木': 'radial-gradient(ellipse at top, #0E2210 0%, #071008 55%, #030804 100%)',
  '火': 'radial-gradient(ellipse at bottom, #4A1500 0%, #200800 50%, #0D0400 100%)',
  '土': 'radial-gradient(ellipse at center, #201800 0%, #100E00 55%, #080600 100%)',
  '金': 'radial-gradient(ellipse at top right, #06091A 0%, #030812 55%, #020509 100%)',
  '水': 'radial-gradient(ellipse at top, #040C1C 0%, #020A14 55%, #01060C 100%)',
}

// AI 영웅 매핑 (온보딩 결과와 반대 오행)
const AI_HERO_MAP: Record<string, HeroId> = {
  '木': 'fire_hero',
  '火': 'earth_hero',
  '土': 'water_hero',
  '金': 'wood_hero',
  '水': 'metal_hero',
}

interface BattleScreenProps {
  onRestart: () => void       // 패배/홈 버튼 → DefeatScreen (P0-A)
  onVictory?: (result: { playerHpRemaining: number }) => void  // 승리 → CardRewardScreen (P0-B)
  stageId?: number | null     // 현재 배틀 스테이지 ID (M5)
}

export default function BattleScreen({ onRestart, onVictory, stageId }: BattleScreenProps): React.ReactElement {
  const onboardingResult = useOnboardingStore(s => s.onboardingResult)
  const {
    gameState,
    interaction,
    selectedCardIndex,
    selectedUnitSlot,
    damagePopups,
    toasts,
    logOpen,
    isProcessing,
    playerKillCount,
    initBattle,
    selectCard,
    deselectCard,
    selectUnit,
    summonCard,
    attackTarget,
    endPlayerTurn,
    addToast,
    setLogOpen,
    resetBattle,
  } = useBattleStore()

  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [initialized, setInitialized] = useState(false)
  const particlesRef = useRef<BattleParticlesRef>(null)
  // 화면 흔들림 ref (리라 스펙 §2-B)
  const screenShakeRef = useRef<HTMLDivElement>(null)

  // P1: 유물 툴팁 상태
  const [activeTooltipRelicId, setActiveTooltipRelicId] = useState<string | null>(null)
  const [tooltipAnchorRect, setTooltipAnchorRect] = useState<DOMRect | null>(null)
  const relicIconRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // P2: EffectToast 큐
  const [effectToastQueue, setEffectToastQueue] = useState<EffectToastItem[]>([])
  const effectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // P3: 대운 슬롯 상태 (daewoonUsed 기본값)
  const DEFAULT_DAEWOON_USED: NonNullable<GameState['daewoonUsed']> = {
    daewoonje: false,
    seunJeonhwan: false,
    wolunGasok: false,
    siunJeongji: false,
  }

  // Phase 2-A: 영웅 공격/피격 애니메이션 상태
  const [isPlayerAttacking, setIsPlayerAttacking] = useState(false)
  const [isPlayerHit, setIsPlayerHit] = useState(false)
  const [isAiAttacking, setIsAiAttacking] = useState(false)
  const [isAiHit, setIsAiHit] = useState(false)

  const relicStore = useRelicStore()
  const sealedElement = useChallengeStore(s => s.sealedElement)

  // Phase 2-A: 일진 정보 (컴포넌트 마운트 시 1회 계산)
  const dailyPillarInfo = useMemo(() => {
    try {
      return getDailyPillarInfo(new Date())
    } catch {
      return null
    }
  }, [])

  // Phase 2-C: 오행 콤보 상태 구독
  const comboElement = useBattleStore(s => s.comboElement)
  const comboCount = useBattleStore(s => s.comboCount)

  // Phase 2-A: AI 턴 중 플레이어 피격 감지
  // Phase 2-C: 공격 시 오행별 파티클 이펙트 추가
  const prevPlayerHpRef = useRef<number | null>(null)
  const prevAiHpRef = useRef<number | null>(null)
  useEffect(() => {
    if (!gameState) return
    const currentPlayerHp = gameState.player.currentHp
    const currentAiHp = gameState.ai.currentHp

    // 플레이어 HP 감소 → isPlayerHit + isAiAttacking + 파티클
    if (prevPlayerHpRef.current !== null && currentPlayerHp < prevPlayerHpRef.current) {
      setIsPlayerHit(true)
      setIsAiAttacking(true)

      // Phase 2-C: AI 공격 원소 색상으로 파티클 이미션
      const aiElement = gameState.ai.hero.element as FiveElement
      particlesRef.current?.emit(
        window.innerWidth * 0.5,
        window.innerHeight * 0.5,
        aiElement,
        12
      )

      setTimeout(() => setIsPlayerHit(false), 300)
      setTimeout(() => setIsAiAttacking(false), 400)
    }
    // AI HP 감소 (자동 전투 페이즈) → isAiHit + 파티클
    if (prevAiHpRef.current !== null && currentAiHp < prevAiHpRef.current) {
      setIsAiHit(true)

      // Phase 2-C: 플레이어 공격 원소 색상으로 파티클 이미션
      const playerElement = gameState.player.hero.element as FiveElement
      particlesRef.current?.emit(
        window.innerWidth * 0.5,
        window.innerHeight * 0.5,
        playerElement,
        12
      )

      setTimeout(() => setIsAiHit(false), 300)
    }

    prevPlayerHpRef.current = currentPlayerHp
    prevAiHpRef.current = currentAiHp
  }, [gameState?.player.currentHp, gameState?.ai.currentHp])

  // 게임 초기화
  useEffect(() => {
    if (initialized) return
    setInitialized(true)

    try {
      const playerElement = onboardingResult?.primaryElement ?? '火'
      // HeroData에는 id 필드가 없으므로 element 기반으로 heroId 결정
      const ELEMENT_TO_HERO_ID: Record<string, HeroId> = {
        '木': 'wood_hero', '火': 'fire_hero', '土': 'earth_hero', '金': 'metal_hero', '水': 'water_hero',
      }
      const playerHeroId = ELEMENT_TO_HERO_ID[playerElement] ?? 'fire_hero'
      const aiHeroId = AI_HERO_MAP[playerElement] ?? 'earth_hero'

      // MOD-1: currentDeckIds가 있으면(이벤트/보상으로 추가된 카드 포함) 그것을 우선 사용.
      // currentDeckIds가 비어있으면(최초 전투 등) createStartingDeck 폴백.
      const currentDeck = useUnlockStore.getState().getCurrentDeck()
      const playerDeck = currentDeck.length > 0
        ? currentDeck
        : createStartingDeck(playerElement)

      // playerDeck 유효성 확인
      if (!playerDeck || playerDeck.length === 0) {
        console.error('[BattleScreen] playerDeck이 비어있습니다. element:', playerElement)
        throw new Error('덱 초기화 실패: 카드가 없습니다')
      }

      const aiDeck = createStartingDeck(HEROES[aiHeroId as HeroId].element)

      initBattle(playerHeroId, playerDeck, aiHeroId as HeroId, aiDeck)

      // 훅 포인트: 전투 시작 — RELIC_HERB_POUCH HP +3
      // initBattle 호출 후 battleStore의 gameState가 비동기로 업데이트되므로
      // 다음 마이크로태스크에서 처리
    } catch (err) {
      console.error('[BattleScreen] initBattle 실패:', err)
      throw err // ErrorBoundary에서 캐치
    }
  }, [initialized, onboardingResult, initBattle])

  const applyHerbPouch = useBattleStore(s => s.applyHerbPouch)
  // 전투 시작 유물 효과 — gameState 초기화 완료 후 1회 적용 (RELIC_HERB_POUCH HP +3)
  const herbPouchAppliedRef = useRef(false)
  useEffect(() => {
    if (!gameState) return
    if (herbPouchAppliedRef.current) return
    if (!relicStore.hasRelic('RELIC_HERB_POUCH')) return
    herbPouchAppliedRef.current = true
    applyHerbPouch()
  }, [gameState, relicStore, applyHerbPouch])

  if (!gameState) {
    return (
      <div data-screen="battle" style={{
        position: 'fixed', inset: 0, background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-headline)', fontFamily: 'var(--font-serif)',
      }}>
        전투 준비 중...
      </div>
    )
  }

  const { player, ai, turn, phase, result, log } = gameState
  const isAiTurn = interaction === 'ai_turn' || phase === 'ai_turn'

  // 적 오행 — stageId가 있으면 stages.ts에서 조회, 없으면 AI 영웅 오행 사용
  const enemyElement: FiveElement | 'neutral' = (() => {
    if (stageId != null && STAGES_BY_ID[stageId]) {
      return STAGES_BY_ID[stageId].element
    }
    return ai.hero.element as FiveElement
  })()

  // Phase 2-A: 오행 → 영웅 타입 결정
  const playerHeroType = ELEMENT_HERO_MAP[player.hero.element as FiveElement] ?? 'swordsman'
  const aiHeroType = getAiHeroType(
    enemyElement !== 'neutral' ? enemyElement : ai.hero.element,
  )

  // AI 필드에 도발 유닛 있는지
  const hasTauntInAiField = ai.field.some(
    u => u !== null && [...u.card.keywords, ...u.temporaryKeywords].includes('taunt'),
  )

  // 플레이어 선택 유닛의 관통 여부
  const selectedUnit = selectedUnitSlot !== null ? player.field[selectedUnitSlot] : null
  const attackerHasPierce = selectedUnit
    ? [...selectedUnit.card.keywords, ...selectedUnit.temporaryKeywords].includes('pierce')
    : false

  // ────────────────────────────────────────────────────
  // 화면 흔들림 (리라 스펙 §2-B)
  // ────────────────────────────────────────────────────

  const emitScreenShake = useCallback(() => {
    const el = screenShakeRef.current
    if (!el) return
    gsap.timeline()
      .to(el, { x: 4, duration: 0.04, ease: 'none' })
      .to(el, { x: -4, duration: 0.04 })
      .to(el, { x: 3, duration: 0.04 })
      .to(el, { x: -2, duration: 0.04 })
      .to(el, { x: 0, duration: 0.04 })
  }, [])

  // ────────────────────────────────────────────────────
  // 이벤트 핸들러
  // ────────────────────────────────────────────────────

  function handleAiUnitClick(slotIdx: number) {
    if (interaction !== 'unit_selected') return

    const attackerUnit = selectedUnitSlot !== null ? player.field[selectedUnitSlot] : null
    if (!attackerUnit) return

    // 도발 규칙 확인
    if (hasTauntInAiField && !attackerHasPierce) {
      const unit = ai.field[slotIdx] as FieldUnit | null
      if (!unit) return
      const hasTaunt = [...unit.card.keywords, ...unit.temporaryKeywords].includes('taunt')
      if (!hasTaunt) {
        addToast('도발 유닛을 먼저 공격해야 합니다')
        return
      }
    }

    // Phase 2-A: 플레이어 공격 → isAttacking, AI 피격 → isHit
    setIsPlayerAttacking(true)
    setIsAiHit(true)
    setTimeout(() => setIsPlayerAttacking(false), 400)
    setTimeout(() => setIsAiHit(false), 300)

    attackTarget(slotIdx)
    // 화면 흔들림 + 충격파 (리라 스펙 §2-B, §2-C)
    emitScreenShake()
    const targetUnit = ai.field[slotIdx]
    if (targetUnit) {
      // 타겟 슬롯 중앙 좌표로 emitShockwave
      const attackerDisplay = ELEMENT_DISPLAY[attackerUnit.card.element ?? '火']
      // targetEl은 DOM에서 가져올 수 없으므로 viewport 중앙 상단 근사값 사용
      // 실제 타겟 el 취득은 FieldArea forwardRef 추가 시 개선 가능 (리라 스펙 주석)
      const approxTargetEl = document.querySelector(`[data-screen="battle"]`) as HTMLElement | null
      if (approxTargetEl) {
        particlesRef.current?.emitShockwave(approxTargetEl, attackerDisplay.color)
      }
    }
  }

  function handleAiHeroClick() {
    if (interaction !== 'unit_selected') return
    const unit = selectedUnitSlot !== null ? player.field[selectedUnitSlot] : null
    if (!unit) return

    // 관통이 아닌데 적 필드에 유닛이 있으면 직접 공격 불가
    if (!attackerHasPierce && ai.field.some(u => u !== null)) {
      addToast('적 유닛을 먼저 처치하거나 관통 유닛을 사용하세요')
      return
    }

    // Phase 2-A: 플레이어 공격 → isAttacking, AI 영웅 피격 → isHit
    setIsPlayerAttacking(true)
    setIsAiHit(true)
    setTimeout(() => setIsPlayerAttacking(false), 400)
    setTimeout(() => setIsAiHit(false), 300)

    attackTarget('hero')
    // 화면 흔들림 (리라 스펙 §2-B)
    emitScreenShake()
  }

  function handlePlayerUnitClick(slotIdx: number) {
    if (isProcessing || isAiTurn) return

    if (interaction === 'card_selected' || interaction === 'spell_targeting') {
      deselectCard()
      return
    }

    selectUnit(slotIdx)
  }

  function handleEmptySlotClick(slotIdx: number) {
    if (isProcessing || isAiTurn) return

    if (interaction === 'card_selected' && selectedCardIndex !== null) {
      const card = player.hand[selectedCardIndex]
      if (!card) return
      if (card.cardType === 'spell') {
        addToast('주문 카드는 필드에 배치할 수 없습니다')
        deselectCard()
        return
      }
      const error = summonCard(slotIdx)
      if (error) {
        addToast(error)
      } else {
        // 카드 소환 성공 — 파티클 (슬롯 위치 근사 중앙)
        particlesRef.current?.emit(
          window.innerWidth / 2,
          window.innerHeight * 0.55,
          player.hero.element,
          8,
        )
        // Phase 2-D: 사주 친화도 보너스 팝업
        // 영웅 오행이 카드 오행을 상생(GENERATES[heroWuxing] === card.element)할 때 발동
        if (card.element && GENERATES[player.hero.element as FiveElement] === card.element) {
          useBattleStore.getState().addDamagePopup({
            value: 0,
            type: 'affinity_bonus',
            x: 60,  // 데미지 팝업보다 우측 오프셋
            y: 55,
          })
        }
      }
    }
  }

  function handleBoardClick() {
    if (interaction === 'card_selected' || interaction === 'spell_targeting') {
      deselectCard()
    }
    if (interaction === 'unit_selected') {
      useBattleStore.getState().deselectUnit()
    }
  }

  // 드래그 앤 드롭
  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    selectCard(index)
  }

  function handleDragEnd() {
    setDragOverSlot(null)
  }

  function handleDragOver(e: React.DragEvent, slotIdx: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSlot(slotIdx)
  }

  function handleDrop(e: React.DragEvent, slotIdx: number) {
    e.preventDefault()
    setDragOverSlot(null)
    if (selectedCardIndex !== null) {
      const error = summonCard(slotIdx)
      if (error) addToast(error)
    }
  }

  function handleDragLeave() {
    setDragOverSlot(null)
  }

  function handleRetry() {
    resetBattle()
    setInitialized(false)
  }

  function handleHome() {
    resetBattle()
    onRestart()
  }

  // P1: 유물 아이콘 탭 → 툴팁
  function handleRelicIconClick(relicId: string) {
    if (activeTooltipRelicId === relicId) {
      setActiveTooltipRelicId(null)
      setTooltipAnchorRect(null)
      return
    }
    const el = relicIconRefs.current[relicId]
    if (el) {
      setTooltipAnchorRect(el.getBoundingClientRect())
    }
    setActiveTooltipRelicId(relicId)
  }

  // P2: EffectToast 큐에 아이템 추가
  function addEffectToast(item: Omit<EffectToastItem, 'id'>) {
    const newItem: EffectToastItem = { ...item, id: `et-${Date.now()}-${Math.random()}` }
    setEffectToastQueue(prev => [...prev, newItem])
  }
  void addEffectToast // 미사용 경고 방지 (battlecry 연동 시 제거)

  // P2: EffectToast 큐 처리 — 첫 아이템 1.8s 후 제거
  useEffect(() => {
    if (effectToastQueue.length === 0) return
    if (effectToastTimerRef.current) return
    effectToastTimerRef.current = setTimeout(() => {
      setEffectToastQueue(prev => prev.slice(1))
      effectToastTimerRef.current = null
    }, 1800)
    return () => {
      if (effectToastTimerRef.current) {
        clearTimeout(effectToastTimerRef.current)
        effectToastTimerRef.current = null
      }
    }
  }, [effectToastQueue])

  // P3: 대운 카드 사용 핸들러
  function handleUseDaewoon(key: keyof NonNullable<GameState['daewoonUsed']>) {
    const currentDaewoonUsed = gameState?.daewoonUsed ?? DEFAULT_DAEWOON_USED
    if (currentDaewoonUsed[key]) {
      addToast('전투당 1회만 사용할 수 있습니다')
      return
    }
    if (!gameState || gameState.phase !== 'main') {
      addToast('메인 페이즈에만 사용 가능합니다')
      return
    }
    // 비용 체크 (대운 카드별 비용: daewoonje=5, seunJeonhwan=4, wolunGasok=3, siunJeongji=4)
    const COSTS: Record<string, number> = { daewoonje: 5, seunJeonhwan: 4, wolunGasok: 3, siunJeongji: 4 }
    const cost = COSTS[key] ?? 4
    if (gameState.player.currentEnergy < cost) {
      addToast(`에너지가 부족합니다 (필요: ${cost})`)
      return
    }
    // 토스트 표시 (실제 효과는 향후 daewoonEngine 연동)
    const TOAST_MSGS: Record<string, string> = {
      daewoonje: '시간을 되돌립니다',
      seunJeonhwan: '일진 오행 변경 선택 (준비 중)',
      wolunGasok: '다음 2턴 에너지 +2 적용',
      siunJeongji: '상대방의 다음 턴이 정지됩니다',
    }
    addToast(TOAST_MSGS[key] ?? '대운 카드 사용')
    // VFX: daewoon-active 토글
    const el = screenShakeRef.current
    if (el) {
      el.setAttribute('data-daewoon-active', 'true')
      gsap.to(el, { filter: 'hue-rotate(40deg) brightness(1.3)', duration: 0.15, yoyo: true, repeat: 3, onComplete: () => {
        el.removeAttribute('data-daewoon-active')
        gsap.set(el, { filter: 'none' })
      }})
    }
    // 실제로는 battleStore 액션 또는 상태 직접 변경이 필요하나
    // Phase 3 UI 단계에서는 토스트+VFX만 처리 (store 연동은 별도 작업)
  }

  // 승리 시 CardRewardScreen으로 전환 (P0-B: 실측 HP 전달)
  function handleVictory() {
    // battleStore에서 전투 후 실제 잔여 HP 읽기 (gameState는 null일 수 있으므로 방어)
    const storeState = useBattleStore.getState()
    const currentPlayerHp = storeState.gameState?.player.currentHp ?? 1
    resetBattle()
    if (onVictory) {
      onVictory({ playerHpRemaining: currentPlayerHp })
    } else {
      onRestart()
    }
  }

  // ────────────────────────────────────────────────────
  // 힌트 토스트 메시지
  // ────────────────────────────────────────────────────

  const hintMessage = (() => {
    if (interaction === 'card_selected') {
      const card = selectedCardIndex !== null ? player.hand[selectedCardIndex] : null
      if (!card) return null
      if (card.cardType === 'soldier') return '소환할 위치를 선택하세요'
      return '주문 카드를 사용합니다...'
    }
    if (interaction === 'unit_selected') return '공격할 대상을 선택하세요'
    if (interaction === 'spell_targeting') return '대상을 선택하세요 (취소: 빈 공간 탭)'
    return null
  })()

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div
        ref={screenShakeRef}
        data-screen="battle"
        data-element={player.hero.element}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxWidth: 480,
          margin: '0 auto',
          height: '100dvh',
          userSelect: 'none',
          pointerEvents: (isProcessing && !isAiTurn) ? 'none' : 'auto',
          // FAIL1 수정: 오행별 배경을 inline style로 강제 적용 (CSS specificity/캐시 문제 방어)
          background: ELEMENT_BATTLE_BG[player.hero.element] ?? '#1a1410',
          willChange: 'transform',
        }}
        onClick={handleBoardClick}
      >
        {/* [A][B] AI 상태 바 + 에너지 — MOD-3: 전체 영역 탭 타겟 오버레이 */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <TopStatusBar ai={ai} />
          {/* 투명 오버레이: unit_selected 시 TopStatusBar 전체(80px)를 AI 영웅 탭 타겟으로 활성화 */}
          {interaction === 'unit_selected' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                cursor: 'crosshair',
                zIndex: 10,
              }}
              onClick={(e) => { e.stopPropagation(); handleAiHeroClick() }}
            />
          )}
        </div>

        {/* [A-2] Phase 2-A: 일진 오행 배너 — TopStatusBar 아래, ElementMatchup 위 */}
        {dailyPillarInfo && result === null && (
          <DailyElementBanner
            stem={dailyPillarInfo.stem}
            stemElement={dailyPillarInfo.stemElement}
            heroElement={player.hero.element as FiveElement}
          />
        )}

        {/* [A-1] 오행 상성 실시간 표시 — 리라 스펙 Phase 1-B */}
        <ElementMatchup
          playerElement={player.hero.element as FiveElement}
          enemyElement={enemyElement}
        />

        {/* 힌트 배너 — FieldSeparator로 통합 */}

        {/* P2: EffectToast 큐 — 수직 중앙 */}
        {effectToastQueue.length > 0 && (() => {
          const current = effectToastQueue[0]
          return (
            <EffectToast
              key={current.id}
              effectType={current.effectType}
              text={current.text}
              cardName={current.cardName}
            />
          )
        })()}

        {/* [C] AI 영역: HeroCharacter(우측) + 필드 3슬롯(좌측) — Phase 2-A */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            margin: '0 0',
            position: 'relative',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* AI 영웅 캐릭터 — 우측, 좌측 바라봄 (scaleX(-1)) */}
          <div
            style={{ cursor: interaction === 'unit_selected' ? 'crosshair' : 'default', flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); handleAiHeroClick() }}
          >
            <HeroCharacter
              heroType={aiHeroType}
              side="ai"
              hp={ai.currentHp}
              maxHp={ai.hero.maxHp}
              isAttacking={isAiAttacking}
              isHit={isAiHit}
              element={enemyElement !== 'neutral' ? enemyElement : ai.hero.element as FiveElement}
            />
          </div>

          {/* AI 필드 3슬롯 (좌측) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldArea
              field={ai.field.slice(0, 3)}
              side="ai"
              interaction={interaction as InteractionState}
              selectedUnitSlot={selectedUnitSlot}
              selectedCardIndex={selectedCardIndex}
              hasTauntInAiField={hasTauntInAiField}
              attackerHasPierce={attackerHasPierce}
              onUnitClick={(slotIdx) => { handleAiUnitClick(slotIdx) }}
              playerElement={player.hero.element}
            />
          </div>
        </div>

        {/* 중앙 FieldSeparator + Phase 2-C: ComboCounter 오버레이 */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <FieldSeparator
            element={player.hero.element}
            hintMessage={hintMessage}
          />
          {comboElement && comboCount >= 2 && (
            <ComboCounter element={comboElement} count={comboCount} />
          )}
        </div>

        {/* [D] 플레이어 영역: HeroCharacter(좌측) + 필드 3슬롯(우측) — Phase 2-A */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            margin: '0 0',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* 플레이어 영웅 캐릭터 — 좌측, 우측 바라봄 */}
          <div style={{ flexShrink: 0 }}>
            <HeroCharacter
              heroType={playerHeroType}
              side="player"
              hp={player.currentHp}
              maxHp={player.hero.maxHp}
              isAttacking={isPlayerAttacking}
              isHit={isPlayerHit}
              element={player.hero.element as FiveElement}
            />
          </div>

          {/* 플레이어 필드 3슬롯 (우측) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldArea
              field={player.field.slice(0, 3)}
              side="player"
              interaction={interaction as InteractionState}
              selectedUnitSlot={selectedUnitSlot}
              selectedCardIndex={selectedCardIndex}
              onUnitClick={(slotIdx) => { handlePlayerUnitClick(slotIdx) }}
              onEmptySlotClick={handleEmptySlotClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragLeave={handleDragLeave}
              dragOverSlot={dragOverSlot}
              playerElement={player.hero.element}
            />
          </div>
        </div>

        {/* [E] 플레이어 상태 바 */}
        <PlayerStatusBar player={player} />

        {/* [E-1] 유물 아이콘 바 (P1 강화) — glow 애니메이션 + 탭 툴팁 */}
        {relicStore.ownedRelics.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            background: 'var(--bg2)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            overflowX: 'auto',
            // 스크롤바 숨김
            scrollbarWidth: 'none',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              flexShrink: 0,
            }}>
              유물
            </span>
            {relicStore.ownedRelics.map(relic => {
              const isTooltipOpen = activeTooltipRelicId === relic.id
              // 길흉별 테두리 색상
              const alignmentBorder: Record<string, string> = {
                '吉': 'rgba(100,200,100,0.4)',
                '凶': 'rgba(200,60,60,0.4)',
                '複': 'rgba(180,140,255,0.4)',
              }
              const borderColor = alignmentBorder[relic.alignment] ?? 'rgba(201,168,76,0.3)'
              return (
                <button
                  key={relic.id}
                  ref={el => { relicIconRefs.current[relic.id] = el }}
                  type="button"
                  aria-label={`유물 정보: ${relic.name}`}
                  aria-expanded={isTooltipOpen}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRelicIconClick(relic.id)
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    background: isTooltipOpen
                      ? 'rgba(201,168,76,0.3)'
                      : 'rgba(201,168,76,0.12)',
                    borderRadius: '50%',
                    border: `1px solid ${borderColor}`,
                    fontSize: 13,
                    flexShrink: 0,
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }}
                >
                  {relic.icon}
                </button>
              )
            })}
          </div>
        )}

        {/* [E-2] 대운 카드 슬롯 (P3) — 게임 진행 중에만 표시 */}
        {result === null && gameState && (
          <DaewoonSlot
            daewoonUsed={gameState.daewoonUsed ?? DEFAULT_DAEWOON_USED}
            currentEnergy={player.currentEnergy}
            phase={phase}
            isProcessing={isProcessing}
            isAiTurn={isAiTurn}
            onUseDaewoon={handleUseDaewoon}
          />
        )}

        {/* [F] 손패 영역 */}
        <div onClick={e => e.stopPropagation()}>
          <HandArea
            hand={player.hand}
            currentEnergy={player.currentEnergy}
            selectedCardIndex={selectedCardIndex}
            phase={phase}
            isProcessing={isProcessing || isAiTurn}
            onCardSelect={(i) => selectCard(i)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            sealedElement={sealedElement}
          />
        </div>

        {/* [G] 하단 액션 바 */}
        <ActionBar
          turn={turn}
          phase={phase}
          isProcessing={isProcessing}
          isAiTurn={isAiTurn}
          logOpen={logOpen}
          onEndTurn={() => {
            if (!isProcessing && !isAiTurn && phase === 'main') {
              endPlayerTurn()
            }
          }}
          onToggleLog={() => setLogOpen(!logOpen)}
        />
      </div>

      {/* AI 턴 오버레이 */}
      <AITurnOverlay visible={isAiTurn} ai={ai} />

      {/* 승패 화면 */}
      {result && (
        <ResultScreen
          result={result}
          player={player}
          ai={ai}
          turn={turn}
          playerKillCount={playerKillCount}
          onRetry={handleRetry}
          onHome={result === 'player_win' ? handleVictory : handleHome}
        />
      )}

      {/* 로그 패널 */}
      <LogPanel
        isOpen={logOpen}
        log={log}
        onClose={() => setLogOpen(false)}
      />

      {/* 데미지 팝업 */}
      {damagePopups.map(popup => (
        <DamagePopup key={popup.id} popup={popup} />
      ))}

      {/* 파티클 레이어 */}
      <BattleParticles ref={particlesRef} />

      {/* 토스트 */}
      <div style={{
        position: 'fixed',
        bottom: 160,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 55,
        pointerEvents: 'none',
        alignItems: 'center',
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              background: 'rgba(26,23,20,0.95)',
              border: '1px solid rgba(232,200,74,0.25)',
              borderRadius: 8,
              padding: '8px 16px',
              fontFamily: 'Noto Sans KR, sans-serif',
              fontSize: 13,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* P1: 유물 툴팁 — Portal 렌더링 */}
      {activeTooltipRelicId && tooltipAnchorRect && (() => {
        const relic = relicStore.ownedRelics.find(r => r.id === activeTooltipRelicId)
        if (!relic) return null
        return (
          <RelicTooltip
            relic={relic}
            anchorRect={tooltipAnchorRect}
            onClose={() => {
              setActiveTooltipRelicId(null)
              setTooltipAnchorRect(null)
            }}
          />
        )
      })()}
    </>
  )
}
