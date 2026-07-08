/**
 * PlayerVsPlayerScreen — PvP 전투 화면
 * 리라 스펙 §신규 화면 3 — PlayerVsPlayerScreen
 * AppScene: 'pvpBattle'
 *
 * BattleScreen 구조 유지 + 3개 신규 컴포넌트 탑재:
 *   - OpponentStatusBar (상단)
 *   - TurnTimerBar (타이머)
 *   - PvPActionBar (하단)
 *
 * Phase 4 MVP: 목 데이터 기반 동작, 서버 연동 후 교체
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useBattleStore } from '@/game/store/battleStore'
import { useOnboardingStore, createStartingDeck } from '@/game/store/onboardingStore'
import { useUnlockStore } from '@/stores/unlockStore'
import { usePvPStore, mockOpponentTurn, mockGenerateResult } from '@/stores/pvpStore'
import { pvpClient } from '@/services/pvpClient'
import { HEROES } from '@/types/game'
import type { HeroId } from '@/types/game'
import { getDailyPillarInfo } from '@/game/saju/manseryeok'
import type { FiveElement } from '@/types/elements'

import OpponentStatusBar from './OpponentStatusBar'
import TurnTimerBar from './TurnTimerBar'
import DailyElementBanner from './DailyElementBanner'
import FieldArea from './FieldArea'
import FieldSeparator from './FieldSeparator'
import PlayerStatusBar from './PlayerStatusBar'
import HandArea from './HandArea'
import PvPActionBar from './PvPActionBar'
import LogPanel from './LogPanel'
import DamagePopup from './DamagePopup'
import BattleParticles from './BattleParticles'
import type { BattleParticlesRef } from './BattleParticles'
import EffectToast from './EffectToast'
import ComboCounter from './ComboCounter'
import type { CardEffect } from '@/game/engine/effectEngine'

// ────────────────────────────────────────────────────
// 오행별 전투 배경 (BattleScreen과 동일)
// ────────────────────────────────────────────────────

const ELEMENT_BATTLE_BG: Record<string, string> = {
  '木': 'radial-gradient(ellipse at top, #0E2210 0%, #071008 55%, #030804 100%)',
  '火': 'radial-gradient(ellipse at bottom, #4A1500 0%, #200800 50%, #0D0400 100%)',
  '土': 'radial-gradient(ellipse at center, #201800 0%, #100E00 55%, #080600 100%)',
  '金': 'radial-gradient(ellipse at top right, #06091A 0%, #030812 55%, #020509 100%)',
  '水': 'radial-gradient(ellipse at top, #040C1C 0%, #020A14 55%, #01060C 100%)',
}

const ELEMENT_TO_HERO_ID: Record<string, HeroId> = {
  '木': 'wood_hero',
  '火': 'fire_hero',
  '土': 'earth_hero',
  '金': 'metal_hero',
  '水': 'water_hero',
}

const AI_HERO_MAP: Record<string, HeroId> = {
  '木': 'fire_hero',
  '火': 'earth_hero',
  '土': 'water_hero',
  '金': 'wood_hero',
  '水': 'metal_hero',
}

// ────────────────────────────────────────────────────
// EffectToast 큐 아이템
// ────────────────────────────────────────────────────

interface EffectToastItem {
  id: string
  effectType: CardEffect['type']
  text: string
  cardName?: string
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface PlayerVsPlayerScreenProps {
  onEndGame: (isWin: boolean) => void   // 게임 종료 → PvPResultScreen
  onWaitTurn: () => void                 // 내 턴 종료 → YourTurnWaitScreen
}

// ────────────────────────────────────────────────────
// PlayerVsPlayerScreen
// ────────────────────────────────────────────────────

export default function PlayerVsPlayerScreen({
  onEndGame,
  onWaitTurn,
}: PlayerVsPlayerScreenProps): React.ReactElement {
  const onboardingResult = useOnboardingStore(s => s.onboardingResult)
  const {
    gameState,
    interaction,
    selectedCardIndex,
    selectedUnitSlot,
    damagePopups,
    logOpen,
    isProcessing,
    initBattle,
    selectCard,
    selectUnit,
    summonCard,
    attackTarget,
    endPlayerTurn,
    setLogOpen,
  } = useBattleStore()

  const pvpStore = usePvPStore()
  const isServerConnected = usePvPStore(s => s.isServerConnected)
  const particlesRef = useRef<BattleParticlesRef>(null)
  const screenShakeRef = useRef<HTMLDivElement>(null)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [effectToastQueue, setEffectToastQueue] = useState<EffectToastItem[]>([])
  const effectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // PvP 턴 타이머 (로컬 카운트다운)
  const [timerSeconds, setTimerSeconds] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const comboElement = useBattleStore(s => s.comboElement)
  const comboCount = useBattleStore(s => s.comboCount)

  // 플레이어 오행
  const playerElement: FiveElement = (onboardingResult?.primaryElement ?? '火') as FiveElement

  // 일진 정보
  const dailyPillarInfo = useMemo(() => {
    try { return getDailyPillarInfo(new Date()) }
    catch { return null }
  }, [])

  // 배틀 초기화 (BattleScreen 방식 그대로)
  useEffect(() => {
    if (initialized) return
    setInitialized(true)

    try {
      const playerHeroId = ELEMENT_TO_HERO_ID[playerElement] ?? 'fire_hero'
      const aiHeroId = AI_HERO_MAP[playerElement] ?? 'earth_hero'

      const currentDeck = useUnlockStore.getState().getCurrentDeck()
      const playerDeck = currentDeck.length > 0
        ? currentDeck
        : createStartingDeck(playerElement)

      const aiHero = HEROES[aiHeroId]
      const aiDeck = createStartingDeck(aiHero.element as FiveElement)

      initBattle(playerHeroId, playerDeck, aiHeroId, aiDeck)
      // MOD-02: isMyTurn 초기값이 false이므로 전투 진입 시 명시적으로 true 설정
      usePvPStore.getState().setIsMyTurn(true)
    } catch (err) {
      console.error('[PlayerVsPlayerScreen] initBattle 실패:', err)
    }
  }, [initialized, playerElement, initBattle])

  // Phase 4: 서버 연결 시 pvpClient 이벤트 콜백 등록
  useEffect(() => {
    if (!isServerConnected) return

    // STATE_UPDATE: 서버 뷰 갱신
    pvpClient.onStateUpdate((view) => {
      pvpStore.setServerView(view)
      pvpStore.addPvPLog(`[서버] 상태 업데이트 — 턴 ${view.turn}`)
    })

    // TURN_TIMER_UPDATE: 타이머 동기화
    pvpClient.onTurnTimerUpdate((secondsLeft) => {
      setTimerSeconds(secondsLeft)
      pvpStore.setTurnSecondsLeft(secondsLeft)
    })

    // TURN_TIMEOUT: 서버가 타임아웃 알림
    pvpClient.onTurnTimeout(() => {
      pvpStore.addPvPLog('[서버] 턴 타임아웃')
    })

    // ACTION_REJECTED: 낙관적 업데이트 롤백 안내
    pvpClient.onActionRejected((reason, message, _rejectedSeq) => {
      pvpStore.setLastRejectionReason(reason)
      pvpStore.addPvPLog(`[서버 거부] ${reason}: ${message}`)
    })

    // OPPONENT_DISCONNECTED: 상대 재연결 대기
    pvpClient.onOpponentDisconnected((reconnectTimeoutIn) => {
      pvpStore.setOpponentReconnecting(true, reconnectTimeoutIn)
      pvpStore.addPvPLog(`[서버] 상대 재연결 대기 중... (${reconnectTimeoutIn}초)`)
    })

    // GAME_END: 게임 종료
    pvpClient.onGameEnd(({ winner, reason, finalView }) => {
      pvpStore.setServerView(finalView)
      const myPlayerId = pvpClient.getPlayerId()
      const isWin = (winner === 'player1' && finalView.viewOwner === 'player1')
        || (winner === 'player2' && finalView.viewOwner === 'player2')
      pvpStore.addPvPLog(`[서버] 게임 종료 — ${winner} 승. 사유: ${reason}`)
      pvpStore.setResult(mockGenerateResult(isWin))
      onEndGame(isWin)
      void myPlayerId // suppress unused warning
    })
  }, [isServerConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // PvP 턴 타이머 카운트다운
  useEffect(() => {
    if (!pvpStore.isMyTurn) return

    setTimerSeconds(60)
    pvpStore.setTurnSecondsLeft(60)

    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        const next = prev - 1
        pvpStore.setTurnSecondsLeft(next)
        return next
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [pvpStore.isMyTurn])

  // 타이머 만료 처리
  const handleTimerExpire = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    pvpStore.addPvPLog('[나] 시간 초과 — 턴 자동 종료')
    handleEndTurn()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 내 턴 종료
  const handleEndTurn = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (isServerConnected) {
      // 서버 연결: 서버에 END_TURN 전송 (서버가 STATE_UPDATE로 응답)
      pvpStore.dispatch({ type: 'END_TURN' })
      pvpStore.setIsMyTurn(false)
      pvpStore.addPvPLog('[나] 턴 종료 → 서버 전송')
      onWaitTurn()
    } else {
      // 목 모드: 로컬 battleStore 처리
      await endPlayerTurn()
      pvpStore.setIsMyTurn(false)
      pvpStore.addPvPLog('[나] 턴 종료')

      const currentTurn = gameState?.turn ?? 0
      if (currentTurn >= 10 && Math.random() < 0.2) {
        const isWin = Math.random() < 0.5
        pvpStore.setResult(mockGenerateResult(isWin))
        onEndGame(isWin)
        return
      }

      mockOpponentTurn(() => {
        pvpStore.addPvPLog('[상대] 턴 종료 — 내 차례입니다')
        pvpStore.setIsMyTurn(true)
        setTimerSeconds(60)
      })

      onWaitTurn()
    }
  }, [endPlayerTurn, pvpStore, gameState, onEndGame, onWaitTurn, isServerConnected])

  // 카드 선택
  const handleCardPlay = useCallback((cardIndex: number) => {
    selectCard(cardIndex)
  }, [selectCard])

  // 빈 슬롯 클릭 (소환)
  const handleEmptySlotClick = useCallback((slotIdx: number) => {
    // 선택된 카드 ID 확인 (battleStore)
    const { gameState: gs, selectedCardIndex: sci } = useBattleStore.getState()
    const selectedCard = (sci !== null && gs) ? gs.player.hand[sci] : null

    if (isServerConnected && selectedCard) {
      // 서버 연결: PLAY_CARD 전송 (unitId 기반)
      pvpStore.dispatch({ type: 'PLAY_CARD', cardId: selectedCard.id, fieldSlot: slotIdx })
      pvpStore.addPvPLog(`[나] 카드 소환 → 서버 전송 (${selectedCard.name})`)
    }

    // 로컬 battleStore도 항상 실행 (목 모드 또는 낙관적 업데이트)
    const result = summonCard(slotIdx)
    if (result && !isServerConnected) {
      pvpStore.addPvPLog(`[나] 카드 소환`)
    }
  }, [summonCard, pvpStore, isServerConnected])

  // 유닛 클릭
  const handlePlayerUnitClick = useCallback((slotIdx: number) => {
    selectUnit(slotIdx)
  }, [selectUnit])

  const handleAiUnitClick = useCallback((slotIdx: number) => {
    if (isServerConnected) {
      // 서버 연결: FieldUnit.unitId 사용 (서버 부여 UUID)
      const serverView = pvpStore.serverView
      const gs = useBattleStore.getState().gameState
      const selectedSlot = useBattleStore.getState().selectedUnitSlot

      const attackerUnit = (selectedSlot !== null && gs) ? gs.player.field[selectedSlot] : null
      const targetUnit = serverView?.opponent.field[slotIdx] ?? (gs ? gs.ai.field[slotIdx] : null)

      // unitId는 ServerFieldUnit에서만 존재 — serverView 우선 사용
      const serverAttackerUnit = serverView?.self.field[selectedSlot ?? -1]
      const serverTargetUnit = serverView?.opponent.field[slotIdx]

      if (serverAttackerUnit && serverTargetUnit) {
        const attackerUnitId = serverAttackerUnit.unitId
        const targetUnitId = serverTargetUnit.unitId
        pvpStore.dispatch({ type: 'ATTACK_UNIT', attackerUnitId, targetUnitId })
        pvpStore.addPvPLog(`[나] 유닛 공격 → 서버 전송 (${attackerUnitId} → ${targetUnitId})`)
      } else if (attackerUnit && targetUnit) {
        // 서버 뷰 없을 때: unitId fallback (런타임에 서버 연결 전환 시 대비)
        pvpStore.addPvPLog('[나] 유닛 공격 — serverView 없음, 서버 전송 생략')
      }
    }

    // 로컬 battleStore도 항상 실행 (목 모드 또는 낙관적 업데이트)
    attackTarget(slotIdx)
    if (!isServerConnected) {
      pvpStore.addPvPLog('[나] 유닛 공격')
    }
  }, [attackTarget, pvpStore, isServerConnected])

  // EffectToast 큐 관리 (battleStore toasts → queue)
  const toastsLen = useBattleStore(s => s.toasts.length)
  const toasts = useBattleStore(s => s.toasts)
  useEffect(() => {
    if (toastsLen === 0) return
    const latest = toasts[toastsLen - 1]
    // ToastData는 message: string 구조 — EffectToast용으로 변환
    const item: EffectToastItem = {
      id: `${Date.now()}-${Math.random()}`,
      effectType: 'damage',
      text: latest.message,
    }
    setEffectToastQueue(prev => [...prev, item])
  }, [toastsLen])

  useEffect(() => {
    if (effectToastQueue.length === 0) return
    const timer = setTimeout(() => {
      setEffectToastQueue(prev => prev.slice(1))
    }, 1200)
    effectToastTimerRef.current = timer
    return () => clearTimeout(timer)
  }, [effectToastQueue])

  if (!gameState) {
    return (
      <div style={{
        height: '100dvh',
        background: '#0D0B08',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--gold)',
        fontFamily: 'var(--font-serif)',
        fontSize: 16,
      }}>
        전투 준비 중...
      </div>
    )
  }

  const { player, ai } = gameState
  const battleBg = ELEMENT_BATTLE_BG[playerElement] ?? ELEMENT_BATTLE_BG['火']

  // 상대 정보 (목 또는 pvpStore 데이터)
  const opponent = pvpStore.opponent ?? {
    nickname: '대전 상대',
    heroElement: (ai.hero.element ?? '火') as FiveElement,
    currentHp: ai.currentHp,
    handCount: ai.hand.length,
    deckCount: ai.deck.length,
    rank: 'Unranked',
  }

  const hasTauntInAiField = ai.field.some(u =>
    u != null && [...u.card.keywords, ...u.temporaryKeywords].includes('taunt'),
  )
  const attackerHasPierce = selectedUnitSlot !== null
    && player.field[selectedUnitSlot] != null
    && [...(player.field[selectedUnitSlot]!.card.keywords), ...(player.field[selectedUnitSlot]!.temporaryKeywords)].includes('pierce')

  // FieldSeparator용 힌트
  const dailyElement = dailyPillarInfo?.stemElement ?? playerElement
  const separatorHint = null

  // LogPanel 로그: pvpLog + gameState.log 합산
  const allLogs: string[] = [
    ...pvpStore.pvpLog,
    ...gameState.log,
  ]

  return (
    <div
      data-screen="battle"
      ref={screenShakeRef}
      style={{
        height: '100dvh',
        background: battleBg,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <BattleParticles ref={particlesRef} />

      {/* 1. 상대 프로필바 72px */}
      <OpponentStatusBar
        nickname={opponent.nickname}
        heroElement={opponent.heroElement as FiveElement}
        currentHp={opponent.currentHp}
        maxHp={30}
        handCount={opponent.handCount}
        deckCount={opponent.deckCount}
        rank={opponent.rank}
      />

      {/* 2. 턴 타이머 바 32px */}
      <TurnTimerBar
        secondsLeft={timerSeconds}
        isMyTurn={pvpStore.isMyTurn}
        onExpire={handleTimerExpire}
      />

      {/* 3. 일진 배너 */}
      {dailyPillarInfo && (
        <DailyElementBanner
          stem={dailyPillarInfo.stem}
          stemElement={dailyPillarInfo.stemElement}
          heroElement={playerElement}
        />
      )}

      {/* 4. 콤보 카운터 */}
      {comboCount >= 2 && comboElement && (
        <ComboCounter
          element={comboElement}
          count={comboCount}
        />
      )}

      {/* 5. 상대 필드 (read-only) */}
      <FieldArea
        field={ai.field}
        side="ai"
        interaction={interaction}
        selectedUnitSlot={selectedUnitSlot}
        selectedCardIndex={selectedCardIndex}
        hasTauntInAiField={hasTauntInAiField}
        attackerHasPierce={attackerHasPierce}
        onUnitClick={pvpStore.isMyTurn ? handleAiUnitClick : undefined}
        playerElement={playerElement}
        readonly={!pvpStore.isMyTurn}
      />

      {/* 6. 필드 구분선 */}
      <FieldSeparator
        element={dailyElement}
        hintMessage={separatorHint}
      />

      {/* 7. 내 필드 */}
      <FieldArea
        field={player.field}
        side="player"
        interaction={interaction}
        selectedUnitSlot={selectedUnitSlot}
        selectedCardIndex={selectedCardIndex}
        onUnitClick={pvpStore.isMyTurn ? handlePlayerUnitClick : undefined}
        onEmptySlotClick={pvpStore.isMyTurn ? handleEmptySlotClick : undefined}
        onDragOver={(e, slotIdx) => { e.preventDefault(); setDragOverSlot(slotIdx) }}
        onDrop={pvpStore.isMyTurn ? (e, slotIdx) => {
          e.preventDefault()
          setDragOverSlot(null)
          summonCard(slotIdx)
        } : undefined}
        onDragLeave={() => setDragOverSlot(null)}
        dragOverSlot={dragOverSlot}
        playerElement={playerElement}
        readonly={!pvpStore.isMyTurn}
      />

      {/* 8. 내 프로필바 */}
      <PlayerStatusBar player={player} />

      {/* 9. 내 손패 */}
      <HandArea
        hand={player.hand}
        currentEnergy={player.currentEnergy}
        selectedCardIndex={selectedCardIndex}
        phase={gameState.phase}
        isProcessing={isProcessing}
        onCardSelect={pvpStore.isMyTurn ? handleCardPlay : () => {}}
        onDragStart={pvpStore.isMyTurn
          ? (_e, index) => selectCard(index)
          : () => {}}
        onDragEnd={() => {}}
      />

      {/* 10. PvP 액션바 */}
      <PvPActionBar
        turn={gameState.turn}
        isMyTurn={pvpStore.isMyTurn}
        isProcessing={isProcessing}
        logOpen={logOpen}
        onEndTurn={handleEndTurn}
        onToggleLog={() => setLogOpen(!logOpen)}
      />

      {/* 로그 패널 */}
      <LogPanel
        isOpen={logOpen}
        log={allLogs}
        onClose={() => setLogOpen(false)}
      />

      {/* 데미지 팝업 */}
      {damagePopups.map(popup => (
        <DamagePopup key={popup.id} popup={popup} />
      ))}

      {/* 이펙트 토스트 */}
      {effectToastQueue[0] && (
        <EffectToast
          effectType={effectToastQueue[0].effectType}
          text={effectToastQueue[0].text}
          cardName={effectToastQueue[0].cardName}
        />
      )}
    </div>
  )
}
