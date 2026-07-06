/**
 * BattleScreen — 배틀 메인 화면
 * 리라 스펙 §2 전체 레이아웃
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
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
import type { FieldUnit } from '@/types/cards'
import { ELEMENT_DISPLAY } from '@/types/elements'

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

export default function BattleScreen({ onRestart, onVictory, stageId: _stageId }: BattleScreenProps): React.ReactElement {
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

  const relicStore = useRelicStore()
  const sealedElement = useChallengeStore(s => s.sealedElement)

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

        {/* 힌트 배너 — FieldSeparator로 통합 */}

        {/* [C] AI 필드 */}
        <div style={{ flexShrink: 0 }}>
          {/* AI 영웅 클릭 타겟 — 4px 보조 영역 유지 (오버레이가 주 타겟) */}
          <div
            style={{ height: 4, cursor: interaction === 'unit_selected' ? 'crosshair' : 'default' }}
            onClick={(e) => { e.stopPropagation(); handleAiHeroClick() }}
          />
          <FieldArea
            field={ai.field}
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

        {/* 중앙 FieldSeparator */}
        <FieldSeparator
          element={player.hero.element}
          hintMessage={hintMessage}
        />

        {/* [D] 플레이어 필드 */}
        <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <FieldArea
            field={player.field}
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

        {/* [E] 플레이어 상태 바 */}
        <PlayerStatusBar player={player} />

        {/* [E-1] 유물 아이콘 바 (P3) — 보유 유물이 있을 때만 표시 */}
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
            {relicStore.ownedRelics.map(relic => (
              <span
                key={relic.id}
                aria-label={relic.name}
                title={relic.description}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  background: 'rgba(201,168,76,0.12)',
                  borderRadius: '50%',
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {relic.icon}
              </span>
            ))}
          </div>
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
    </>
  )
}
