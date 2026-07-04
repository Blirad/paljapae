/**
 * BattleScreen — 배틀 메인 화면
 * 리라 스펙 §2 전체 레이아웃
 */

import React, { useEffect, useState } from 'react'
import { useBattleStore } from '@/game/store/battleStore'
import type { InteractionState } from '@/game/store/battleStore'
import { useOnboardingStore } from '@/game/store/onboardingStore'
import { createStartingDeck } from '@/game/store/onboardingStore'
import type { HeroId } from '@/types/game'
import { HEROES } from '@/types/game'

import TopStatusBar from './TopStatusBar'
import PlayerStatusBar from './PlayerStatusBar'
import FieldArea from './FieldArea'
import HandArea from './HandArea'
import ActionBar from './ActionBar'
import AITurnOverlay from './AITurnOverlay'
import LogPanel from './LogPanel'
import ResultScreen from './ResultScreen'
import DamagePopup from './DamagePopup'
import type { FieldUnit } from '@/types/cards'

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
`

// AI 영웅 매핑 (온보딩 결과와 반대 오행)
const AI_HERO_MAP: Record<string, HeroId> = {
  '木': 'fire_hero',
  '火': 'earth_hero',
  '土': 'water_hero',
  '金': 'wood_hero',
  '水': 'metal_hero',
}

interface BattleScreenProps {
  onRestart: () => void       // 패배/홈 버튼 → WorldMap (or Onboarding)
  onVictory?: () => void      // 승리 → CardRewardScreen (M5)
  stageId?: number | null     // 현재 배틀 스테이지 ID (M5)
}

export default function BattleScreen({ onRestart, onVictory }: BattleScreenProps): React.ReactElement {
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

  // 게임 초기화
  useEffect(() => {
    if (initialized) return
    setInitialized(true)

    const playerElement = onboardingResult?.primaryElement ?? '火'
    // HeroData에는 id 필드가 없으므로 element 기반으로 heroId 결정
    const ELEMENT_TO_HERO_ID: Record<string, HeroId> = {
      '木': 'wood_hero', '火': 'fire_hero', '土': 'earth_hero', '金': 'metal_hero', '水': 'water_hero',
    }
    const playerHeroId = ELEMENT_TO_HERO_ID[playerElement] ?? 'fire_hero'
    const aiHeroId = AI_HERO_MAP[playerElement] ?? 'earth_hero'
    const playerDeck = createStartingDeck(playerElement)
    const aiDeck = createStartingDeck(HEROES[aiHeroId as HeroId].element)

    initBattle(playerHeroId, playerDeck, aiHeroId as HeroId, aiDeck)
  }, [initialized, onboardingResult, initBattle])

  if (!gameState) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0D0B08',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#E8E0D0', fontFamily: 'Noto Serif KR, serif',
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

  // 승리 시 CardRewardScreen으로 전환 (M5)
  function handleVictory() {
    resetBattle()
    if (onVictory) {
      onVictory()
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
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0D0B08',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxWidth: 480,
          margin: '0 auto',
          height: '100dvh',
          userSelect: 'none',
          pointerEvents: (isProcessing && !isAiTurn) ? 'none' : 'auto',
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

        {/* 힌트 배너 */}
        {hintMessage && (
          <div style={{
            height: 24,
            background: 'rgba(232,200,74,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Noto Sans KR, sans-serif',
            fontSize: 12,
            color: '#E8C84A',
            flexShrink: 0,
          }}>
            {hintMessage}
          </div>
        )}

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
          />
        </div>

        {/* 중앙 경계선 */}
        <div style={{
          height: 1,
          margin: '8px 16px',
          borderTop: '1px dashed rgba(232,200,74,0.12)',
          flexShrink: 0,
        }} />

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
          />
        </div>

        {/* [E] 플레이어 상태 바 */}
        <PlayerStatusBar player={player} />

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
              color: '#E8E0D0',
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
