/**
 * STSBattleScreen — STS 전투 메인 화면
 * Phase 4 신규 파일 — 리라 스펙 §STSBattleScreen
 *
 * Phase 2 enemyEngine 미완성 대응: Mock EnemyDef 내장으로 독립 작동
 */

import React, { useEffect, useState, useCallback } from 'react'
import type { FiveElement } from '@/types/elements'
import type { CardDef, CardInstance } from '@/types/stsTypes'
import { useSTSBattleStore } from '@/game/store/stsBattleStore'
import { getDailyPillarInfo } from '@/game/saju/manseryeok'
import DailyElementBanner from '@/components/battle/DailyElementBanner'
import EnemyCard from '@/components/battle/EnemyCard'
import BuffBar from '@/components/battle/BuffBar'
import EnergyOrb from '@/components/battle/EnergyOrb'
import DeckPile from '@/components/battle/DeckPile'
import STSHandCard from '@/components/battle/STSHandCard'

// ─── Mock 적 데이터 (Phase 2 미완성 대응) ────────────────

import { ENEMY_FLAME_WARRIOR } from '@/data/enemies'

// ─── Mock 카드 데이터 (테스트용 스타터 덱) ───────────────

const MOCK_CARD_DEFS: CardDef[] = [
  {
    id: 'strike_fire',
    name: '화염검격',
    cost: 1,
    type: 'attack',
    rarity: 'starter',
    element: '火',
    description: '적에게 6 데미지를 준다.',
    effects: [{ type: 'damage', value: 6, target: 'enemy' }],
    icon: '⚔️',
  },
  {
    id: 'strike_fire_2',
    name: '화염검격',
    cost: 1,
    type: 'attack',
    rarity: 'starter',
    element: '火',
    description: '적에게 6 데미지를 준다.',
    effects: [{ type: 'damage', value: 6, target: 'enemy' }],
    icon: '⚔️',
  },
  {
    id: 'defend_fire',
    name: '방호진',
    cost: 1,
    type: 'skill',
    rarity: 'starter',
    element: '火',
    description: '블록 5를 얻는다.',
    effects: [{ type: 'block', value: 5, target: 'self' }],
    icon: '🛡️',
  },
  {
    id: 'defend_fire_2',
    name: '방호진',
    cost: 1,
    type: 'skill',
    rarity: 'starter',
    element: '火',
    description: '블록 5를 얻는다.',
    effects: [{ type: 'block', value: 5, target: 'self' }],
    icon: '🛡️',
  },
  {
    id: 'power_fire',
    name: '화염의지',
    cost: 2,
    type: 'power',
    rarity: 'common',
    element: '火',
    description: '힘 2를 얻는다. (영구)',
    effects: [{ type: 'applyBuff', value: 2, buffId: 'strength', target: 'self' }],
    icon: '💪',
    exhaustOnUse: true,
  },
]

function makeDeck(defs: CardDef[]): CardInstance[] {
  return defs.map((def, i) => ({
    instanceId: `inst_${def.id}_${i}`,
    defId: def.id,
    upgraded: false,
  }))
}

const MOCK_DECK = makeDeck(MOCK_CARD_DEFS)

// ─── 데미지 팝업 — STS 전용 래퍼 ────────────────────────

import React_dom from 'react-dom'
import gsap from 'gsap'
import type { DamagePopup } from '@/types/stsTypes'

function STSDamagePopup({ popup, onDone }: { popup: DamagePopup; onDone: (id: string) => void }): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const tl = gsap.fromTo(
      el,
      { y: 0, scale: 1.6, opacity: 1 },
      { y: -80, scale: 0.8, opacity: 0, duration: 0.9, ease: 'power2.out',
        onComplete: () => onDone(popup.id) },
    )
    return () => { tl.kill() }
  }, [popup.id, onDone])

  const color = popup.type === 'damage'
    ? '#EF4444'
    : popup.type === 'heal'
      ? '#4ADE80'
      : popup.type === 'block'
        ? '#60A5FA'
        : '#FCA5A5'

  const sign = popup.type === 'damage' ? '-' : '+'

  return React_dom.createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: `${popup.x}%`,
        top: `${popup.y}%`,
        transform: 'translateX(-50%)',
        zIndex: 40,
        pointerEvents: 'none',
        fontFamily: 'DM Mono, monospace',
        fontWeight: 700,
        fontSize: 32,
        color,
        textShadow: `0 2px 8px rgba(0,0,0,0.8), 0 0 12px ${color}80`,
      }}
    >
      {sign}{popup.amount}
    </div>,
    document.body,
  )
}

// ─── 카드 def 조회 헬퍼 (레지스트리에서) ─────────────────

function getDefForInstance(instance: CardInstance, defs: CardDef[]): CardDef | undefined {
  return defs.find(d => d.id === instance.defId)
}

// ─── Props ───────────────────────────────────────────────

interface STSBattleScreenProps {
  heroElement?: FiveElement
  heroHp?: number
  heroMaxHp?: number
  onVictory?: () => void
  onDefeat?: () => void
}

// ─── STSBattleScreen ─────────────────────────────────────

export default function STSBattleScreen({
  heroElement = '火',
  heroHp = 80,
  heroMaxHp = 80,
  onVictory,
  onDefeat,
}: STSBattleScreenProps): React.ReactElement {
  const store = useSTSBattleStore()
  const [dailyInfo] = useState(() => getDailyPillarInfo())

  // 전투 초기화
  useEffect(() => {
    store.initBattle(
      heroElement,
      ENEMY_FLAME_WARRIOR,
      MOCK_DECK,
      MOCK_CARD_DEFS,
      heroHp,
      heroMaxHp,
    )
    return () => store.reset()
  // 마운트 시 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRemovePopup = useCallback((id: string) => {
    store.removePopup(id)
  }, [store])

  const handleEndTurn = useCallback(() => {
    store.endTurn()
  }, [store])

  const handleCardPlay = useCallback((instanceId: string) => {
    const { state, targetingCardId } = store
    if (!state) return

    const instance = state.player.hand.find(c => c.instanceId === instanceId)
    if (!instance) return
    const def = getDefForInstance(instance, MOCK_CARD_DEFS)
    if (!def) return

    // 타겟 필요 카드 확인 (effects에 target === 'enemy' 존재)
    const needsTarget = def.effects.some(e => e.target === 'enemy')

    if (needsTarget) {
      if (targetingCardId === instanceId) {
        // 재클릭 → 취소
        store.cancelTargeting()
      } else {
        store.enterTargeting(instanceId)
      }
    } else {
      store.playCard(instanceId)
    }
  }, [store])

  const handleEnemyClick = useCallback(() => {
    if (store.targetingCardId) {
      store.selectTarget('enemy')
    }
  }, [store])

  const handleBackgroundClick = useCallback(() => {
    if (store.targetingCardId) {
      store.cancelTargeting()
    }
  }, [store])

  const { state, damagePopups, targetingCardId } = store

  // 로딩 상태
  if (!state || state.phase === 'init') {
    return (
      <div style={{
        width: '100%',
        height: '100dvh',
        background: '#0D0E11',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted, #6B5F52)',
        fontFamily: 'var(--font-mono, "DM Mono", monospace)',
        fontSize: 14,
      }}>
        전투 준비 중...
      </div>
    )
  }

  const { player, enemy, phase } = state
  const isPlayerTurn = phase === 'playerTurn'
  const isEnemyTurn = phase === 'enemyTurn'

  // 승리/패배 오버레이
  const showVictory = phase === 'victory'
  const showDefeat = phase === 'defeat'

  return (
    <div
      onClick={handleBackgroundClick}
      style={{
        width: '100%',
        height: '100dvh',
        background: '#0D0E11',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 1. DailyElementBanner — 32px 고정 */}
      <div className="h-8 flex-shrink-0">
        <DailyElementBanner
          stem={dailyInfo.stem}
          stemElement={dailyInfo.stemElement}
          heroElement={heroElement}
        />
      </div>

      {/* 2. 적 영역 — flex: 0 0 38% */}
      <div
        style={{
          flex: '0 0 38%',
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <EnemyCard
          enemy={enemy}
          playerElement={heroElement}
          isTargeted={!!targetingCardId}
          onClick={handleEnemyClick}
        />
      </div>

      {/* 구분선 */}
      <div
        style={{
          height: 1,
          flexShrink: 0,
          background: 'rgba(255,255,255,0.08)',
        }}
      />

      {/* 3. 플레이어 StatusBar — flex: 0 0 12% */}
      <div
        style={{
          flex: '0 0 12%',
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 10,
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        {/* 영웅 초상화 */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#1A1714',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {heroElement === '木' ? '🌿' : heroElement === '火' ? '🔥' : heroElement === '土' ? '🏔' : heroElement === '金' ? '⚔' : '💧'}
        </div>

        {/* HP 바 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%`,
                  background: '#16A34A',
                  borderRadius: 4,
                  transition: 'width 0.3s ease-out',
                }}
              />
            </div>
            <span style={{
              fontFamily: 'var(--font-mono, "DM Mono", monospace)',
              fontSize: 11,
              color: 'var(--text-secondary, #8A7D6E)',
              flexShrink: 0,
            }}>
              {player.hp}/{player.maxHp}
            </span>
          </div>

          {/* 블록 + 버프 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {player.block > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                background: '#1A4A7A',
                border: '1px solid rgba(100,180,255,0.4)',
                borderRadius: 12,
                padding: '2px 6px',
                fontSize: 11,
                color: 'var(--text-primary, #E8E0D0)',
                fontFamily: 'var(--font-mono, "DM Mono", monospace)',
                flexShrink: 0,
              }}>
                <span>🛡</span>
                <span>{player.block}</span>
              </div>
            )}
            <BuffBar buffs={player.buffs} size="sm" />
          </div>
        </div>
      </div>

      {/* 4. ActionBar — 44px 고정 */}
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          background: 'rgba(0,0,0,0.3)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 덱 더미 (왼쪽) */}
        <DeckPile
          drawCount={player.drawPile.length}
          discardCount={player.discardPile.length}
          exhaustCount={player.exhaustPile.length}
        />

        {/* 에너지 오브 (중앙) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <EnergyOrb
            currentEnergy={player.energy}
            maxEnergy={player.maxEnergy}
            heroElement={heroElement}
          />
        </div>

        {/* 턴 종료 버튼 (오른쪽) */}
        <button
          onClick={e => { e.stopPropagation(); handleEndTurn() }}
          disabled={!isPlayerTurn}
          style={{
            padding: '6px 14px',
            background: isPlayerTurn ? '#8B7536' : '#2A2520',
            border: '1px solid',
            borderColor: isPlayerTurn ? 'rgba(212,175,90,0.5)' : 'rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: isPlayerTurn ? '#E8E0D0' : '#6B5F52',
            fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
            fontSize: 12,
            cursor: isPlayerTurn ? 'pointer' : 'default',
            transition: 'background 0.15s, color 0.15s',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {isEnemyTurn ? '대기 중...' : '턴 종료'}
        </button>
      </div>

      {/* 5. HandArea — flex: 1 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 8px 12px',
          gap: 6,
          overflowX: 'auto',
          overflowY: 'visible',
          pointerEvents: isEnemyTurn ? 'none' : 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {player.hand.length === 0 && player.drawPile.length === 0 ? (
          <span style={{
            fontFamily: 'var(--font-mono, "DM Mono", monospace)',
            fontSize: 12,
            color: 'var(--text-muted, #6B5F52)',
          }}>
            덱이 비었습니다
          </span>
        ) : (
          player.hand.map(instance => {
            const def = getDefForInstance(instance, MOCK_CARD_DEFS)
            if (!def) return null
            const isPlayable = player.energy >= def.cost && !def.unplayable && isPlayerTurn
            const isSelected = targetingCardId === instance.instanceId
            return (
              <STSHandCard
                key={instance.instanceId}
                cardDef={def}
                instanceId={instance.instanceId}
                isPlayable={isPlayable}
                isSelected={isSelected}
                onPlay={handleCardPlay}
              />
            )
          })
        )}
      </div>

      {/* 타겟팅 안내 텍스트 */}
      {targetingCardId && (
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 14,
            color: '#fff',
            fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
            textShadow: '0 2px 8px rgba(0,0,0,0.9)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 20,
          }}
        >
          대상을 선택하세요
        </div>
      )}

      {/* 데미지 팝업 */}
      {damagePopups.map(popup => (
        <STSDamagePopup key={popup.id} popup={popup} onDone={handleRemovePopup} />
      ))}

      {/* 승리 오버레이 */}
      {showVictory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--surface, #16130F)',
              border: '1px solid rgba(212,175,90,0.4)',
              borderRadius: 12,
              padding: '32px 40px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{
              fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
              fontSize: 28,
              color: '#D4AF5A',
              fontWeight: 700,
            }}>
              승리!
            </div>
            <div style={{ fontSize: 28 }}>✨</div>
            <button
              onClick={onVictory}
              style={{
                padding: '10px 28px',
                background: '#8B7536',
                border: '1px solid rgba(212,175,90,0.5)',
                borderRadius: 8,
                color: '#E8E0D0',
                fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              계속하기 →
            </button>
          </div>
        </div>
      )}

      {/* 패배 오버레이 */}
      {showDefeat && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--surface, #16130F)',
              border: '1px solid rgba(192,57,43,0.4)',
              borderRadius: 12,
              padding: '32px 40px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{
              fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
              fontSize: 28,
              color: '#EF4444',
              fontWeight: 700,
            }}>
              패배...
            </div>
            <div style={{
              fontFamily: 'var(--font-mono, "DM Mono", monospace)',
              fontSize: 12,
              color: 'var(--text-secondary, #8A7D6E)',
            }}>
              도달 층수: {state.turn}층
            </div>
            <button
              onClick={onDefeat}
              style={{
                padding: '10px 28px',
                background: '#2A2520',
                border: '1px solid rgba(192,57,43,0.4)',
                borderRadius: 8,
                color: '#E8E0D0',
                fontFamily: 'var(--font-serif, "Noto Serif KR", serif)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              런 요약 보기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
