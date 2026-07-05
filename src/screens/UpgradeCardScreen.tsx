/**
 * UpgradeCardScreen — 카드 업그레이드 화면 (M7 P1-B)
 * 리라 M7 P1 UX 스펙 §2 기준
 *
 * 진입: WorldMap 업그레이드 노드 탭
 * 진출: 강화 완료 or 취소 → onComplete() → worldMap
 *
 * 정책:
 *  - currentDeckIds 전체 표시
 *  - UPGRADE_MAP에 있는 카드만 선택 가능
 *  - 선택 후 BeforeAfter 미리보기 표시
 *  - 확인 다이얼로그 → upgradeCardInDeck 호출
 *  - 1런 1회: 완료 후 upgraded=true, onComplete(upgraded) 콜백
 */

import React, { useState, useRef } from 'react'
import { useUnlockStore } from '@/stores/unlockStore'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { Card, SoldierCard, SpellCard } from '@/types/cards'
import { ALL_CARDS } from '@/data/cards'
import { UPGRADE_MAP, isUpgradable, getUpgradeEntry } from '@/data/upgradeCards'

// ────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────

// UPGRADE_MAP의 강화 카드도 ALL_CARDS_MAP에 포함되도록 확장 맵 구성
const EXTRA_CARDS: Card[] = Object.values(UPGRADE_MAP).map(e => e.upgraded)

const ALL_CARDS_MAP: Map<string, Card> = new Map([
  ...ALL_CARDS.map(c => [c.id, c] as [string, Card]),
  ...EXTRA_CARDS.map(c => [c.id, c] as [string, Card]),
])

function lookupCard(id: string): Card | undefined {
  if (ALL_CARDS_MAP.has(id)) return ALL_CARDS_MAP.get(id)
  const baseId = id.replace(/_(?:s\d+|ai\d+|[a-z])$/, '')
  return ALL_CARDS_MAP.get(baseId)
}

// ────────────────────────────────────────────────────
// UpgradeCardSlot
// ────────────────────────────────────────────────────

interface UpgradeCardSlotProps {
  card: Card
  deckId: string
  isSelected: boolean
  isUpgradeable: boolean
  index: number
  flipPhase?: 'idle' | 'out' | 'in'
  onSelect: () => void
}

function UpgradeCardSlot({
  card,
  isSelected,
  isUpgradeable,
  index,
  flipPhase = 'idle',
  onSelect,
}: UpgradeCardSlotProps): React.ReactElement {
  const elDisplay = card.element ? ELEMENT_DISPLAY[card.element] : null
  const elColor = elDisplay?.color ?? '#6B5F52'
  const isSoldier = card.cardType === 'soldier'

  return (
    <button
      type="button"
      aria-label={`${card.name} ${isUpgradeable ? '강화 선택' : '강화 불가'}`}
      aria-disabled={!isUpgradeable}
      onClick={isUpgradeable ? onSelect : undefined}
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: `1px solid ${isSelected ? 'var(--gold)' : `${elColor}4D`}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: isUpgradeable ? 'pointer' : 'not-allowed',
        padding: 0,
        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        boxShadow: flipPhase === 'in'
          ? '0 0 24px rgba(201,168,76,0.6)'
          : isSelected
          ? '0 0 16px rgba(201,168,76,0.3)'
          : 'none',
        opacity: isUpgradeable ? 1 : 0.35,
        transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s, border-color 0.2s',
        WebkitTapHighlightColor: 'transparent',
        zIndex: isSelected ? 1 : 0,
        animation: flipPhase === 'out'
          ? 'cardFlipOut 0.2s ease-in forwards'
          : flipPhase === 'in'
          ? 'cardFlipIn 0.2s ease-out forwards'
          : `cardStagger 0.3s ease-out ${index * 100}ms both`,
        minWidth: 0,
        minHeight: 120,
      }}
    >
      {/* 강화 선택 뱃지 */}
      {isSelected && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 12,
            color: 'var(--gold)',
            zIndex: 2,
            lineHeight: 1,
          }}
        >
          ⬆
        </span>
      )}

      {/* 헤더: 비용 + 오행 */}
      <div style={{
        height: 28,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: `${elColor}1A`,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold)' }}>
          {card.cost}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: elColor }}>
          {elDisplay ? `${elDisplay.icon}${card.element}` : '중립'}
        </span>
      </div>

      {/* 아트 영역 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: elDisplay
          ? elDisplay.gradient.replace(/0\.\d+\)/g, '0.4)')
          : 'linear-gradient(135deg, var(--surface) 0%, var(--bg2) 100%)',
        minHeight: 50,
      }}>
        <span aria-hidden="true" style={{ fontSize: 24 }}>
          {elDisplay?.icon ?? '⬜'}
        </span>
      </div>

      {/* 카드 정보 */}
      <div style={{ padding: '4px 6px', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 10,
          color: 'var(--text-headline)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {card.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          marginTop: 1,
        }}>
          {isSoldier ? '병사' : '주문'}
        </div>
      </div>
    </button>
  )
}

// ────────────────────────────────────────────────────
// StatBadge — 수치 변경 강조 태그
// ────────────────────────────────────────────────────

function StatBadge({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | number
  highlight?: boolean
}): React.ReactElement {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      background: 'var(--surface)',
      border: `1px solid ${highlight ? 'var(--gold)' : 'var(--border-subtle)'}`,
      padding: '2px 6px',
      color: highlight ? 'var(--gold)' : 'var(--text-muted)',
    }}>
      {label} {value}
    </span>
  )
}

// ────────────────────────────────────────────────────
// BeforeAfterPreview — 기존/강화 후 카드 비교
// ────────────────────────────────────────────────────

function BeforeAfterPreview({
  baseCard,
  upgradedCard,
}: {
  baseCard: Card
  upgradedCard: Card
}): React.ReactElement {
  const elDisplay = baseCard.element ? ELEMENT_DISPLAY[baseCard.element] : null
  const elColor = elDisplay?.color ?? '#6B5F52'

  const baseIsSoldier = baseCard.cardType === 'soldier'
  const upIsSoldier = upgradedCard.cardType === 'soldier'

  const baseSoldier = baseIsSoldier ? (baseCard as SoldierCard) : null
  const upSoldier = upIsSoldier ? (upgradedCard as SoldierCard) : null
  const baseSpell = !baseIsSoldier ? (baseCard as SpellCard) : null
  const upSpell = !upIsSoldier ? (upgradedCard as SpellCard) : null

  const costChanged = baseCard.cost !== upgradedCard.cost
  const attackChanged = baseSoldier && upSoldier && baseSoldier.attack !== upSoldier.attack
  const hpChanged = baseSoldier && upSoldier && baseSoldier.maxHealth !== upSoldier.maxHealth
  const effectChanged = baseSpell && upSpell && baseSpell.effectText !== upSpell.effectText

  // 공통 패널 스타일
  const panelStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: 'var(--bg)',
    border: '1px solid var(--border-subtle)',
    padding: '10px 8px',
  }

  return (
    <div
      role="region"
      aria-label="선택한 카드 강화 정보"
      style={{
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* 레이블 행 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 24px 1fr',
        gap: 4,
        marginBottom: 4,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          textAlign: 'center',
        }}>
          강화 전
        </div>
        <div />
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--gold)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          textAlign: 'center',
        }}>
          강화 후
        </div>
      </div>

      {/* 2열 병렬 패널 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 24px 1fr',
        gap: 4,
        alignItems: 'start',
      }}>
        {/* Before 패널 */}
        <div style={{
          ...panelStyle,
          animation: 'beforePanelIn 0.3s ease-out',
        }}>
          {/* 오행 + 비용 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            {elDisplay && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                border: '1px solid var(--border-subtle)',
                padding: '1px 4px',
                color: elColor,
              }}>
                {elDisplay.icon}
              </span>
            )}
            <StatBadge label="비용" value={baseCard.cost} highlight={false} />
          </div>
          {/* 카드명 */}
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--text-headline)',
            marginBottom: 4,
            lineHeight: 1.3,
          }}>
            {baseCard.name}
          </div>
          {/* 스탯 */}
          {baseSoldier && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}>
              <div>공격 {baseSoldier.attack}</div>
              <div>체력 {baseSoldier.maxHealth}</div>
              {baseSoldier.keywords.length > 0 && (
                <div style={{ marginTop: 2 }}>{baseSoldier.keywords.join(', ')}</div>
              )}
            </div>
          )}
          {baseSpell && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              {baseSpell.effectText}
            </div>
          )}
        </div>

        {/* 화살표 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          color: 'var(--gold)',
          animation: 'arrowIn 0.25s ease-out 0.1s both',
          alignSelf: 'center',
        }}>
          →
        </div>

        {/* After 패널 */}
        <div style={{
          ...panelStyle,
          border: '1px solid var(--border-gold)',
          animation: 'afterPanelIn 0.3s ease-out 0.08s both',
        }}>
          {/* 오행 + 비용 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            {elDisplay && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                border: '1px solid var(--border-subtle)',
                padding: '1px 4px',
                color: elColor,
              }}>
                {elDisplay.icon}
              </span>
            )}
            <StatBadge label="비용" value={upgradedCard.cost} highlight={costChanged} />
          </div>
          {/* 카드명 */}
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--gold)',
            marginBottom: 4,
            lineHeight: 1.3,
          }}>
            {upgradedCard.name}
          </div>
          {/* 스탯 */}
          {upSoldier && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              lineHeight: 1.5,
            }}>
              <div style={{ color: attackChanged ? 'var(--gold)' : 'var(--text-muted)' }}>
                공격 {upSoldier.attack}{attackChanged ? ' ▲' : ''}
              </div>
              <div style={{ color: hpChanged ? 'var(--gold)' : 'var(--text-muted)' }}>
                체력 {upSoldier.maxHealth}{hpChanged ? ' ▲' : ''}
              </div>
              {upSoldier.keywords.length > 0 && (
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  {upSoldier.keywords.join(', ')}
                </div>
              )}
              {upSoldier.battlecry && (
                <div style={{ color: 'var(--gold)', marginTop: 2 }}>
                  {upSoldier.battlecry}
                </div>
              )}
            </div>
          )}
          {upSpell && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: effectChanged ? 'var(--gold)' : 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              {upSpell.effectText}
            </div>
          )}
          {upgradedCard.flavorText && (
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 10,
              color: 'var(--text-muted)',
              marginTop: 6,
              lineHeight: 1.4,
            }}>
              "{upgradedCard.flavorText}"
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes beforePanelIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes afterPanelIn {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes arrowIn {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ────────────────────────────────────────────────────
// UpgradeConfirmDialog — 강화 확인 바텀 시트
// ────────────────────────────────────────────────────

interface UpgradeConfirmDialogProps {
  cardName: string
  onConfirm: () => void
  onCancel: () => void
}

function UpgradeConfirmDialog({
  cardName,
  onConfirm,
  onCancel,
}: UpgradeConfirmDialogProps): React.ReactElement {
  return (
    <>
      {/* 오버레이 */}
      <div
        aria-hidden="true"
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 40,
        }}
      />
      {/* 바텀 시트 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="카드 강화 확인"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)',
          zIndex: 50,
          animation: 'slideUpSheet 0.3s ease-out',
        }}
      >
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 16,
          color: 'var(--text-headline)',
          marginBottom: 8,
          textAlign: 'center',
        }}>
          {cardName}을(를) 강화할까요?
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginBottom: 20,
        }}>
          기존 카드는 강화 버전으로 교체됩니다. 되돌릴 수 없습니다.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'transparent',
              border: '1px solid var(--border-gold)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--text-muted)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            아니요
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'var(--gold)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 700,
              color: '#1A1714',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            강화합니다
          </button>
        </div>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────
// UpgradeCardScreen
// ────────────────────────────────────────────────────

export interface UpgradeCardScreenProps {
  /** 강화 완료 or 취소 시 호출. upgraded=true면 강화 완료 */
  onComplete: (upgraded: boolean) => void
}

export default function UpgradeCardScreen({
  onComplete,
}: UpgradeCardScreenProps): React.ReactElement {
  const [selectedDeckIdx, setSelectedDeckIdx] = useState<number | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  // P1-B 폴리시: toast, shake 피드백
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  // MOD-1: flip 애니메이션 상태 ('idle' | 'out' | 'in')
  const [flipPhase, setFlipPhase] = useState<'idle' | 'out' | 'in'>('idle')

  function showToast(msg: string): void {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }

  const currentDeckIds = useUnlockStore(s => s.currentDeckIds)
  const upgradeCardInDeck = useUnlockStore(s => s.upgradeCardInDeck)

  // 선택된 덱 ID
  const selectedDeckId = selectedDeckIdx !== null ? currentDeckIds[selectedDeckIdx] : null
  const selectedCard = selectedDeckId ? lookupCard(selectedDeckId) ?? null : null

  // 업그레이드 엔트리 (UPGRADE_MAP 기준, 접미사 strip 포함)
  const upgradeEntry = selectedDeckId ? getUpgradeEntry(selectedDeckId) ?? null : null
  const upgradedCard = upgradeEntry?.upgraded ?? null

  // 업그레이드 가능 카드가 하나라도 있는지 확인
  const hasUpgradableCard = currentDeckIds.some(id => isUpgradable(id))

  function handleCardSelect(idx: number): void {
    const deckId = currentDeckIds[idx]
    if (!isUpgradable(deckId)) {
      // 불가 카드 탭: shake 피드백
      showToast('이 카드는 강화할 수 없습니다.')
      return
    }
    setPreviewVisible(false)
    setTimeout(() => {
      setSelectedDeckIdx(prev => prev === idx ? null : idx)
      setPreviewVisible(true)
    }, 50)
  }

  function handleCtaClick(): void {
    if (selectedDeckIdx === null || !selectedCard || !upgradedCard) return
    setShowConfirm(true)
  }

  function handleConfirmUpgrade(): void {
    if (selectedDeckIdx === null || !selectedDeckId || !upgradedCard || upgrading) return
    setUpgrading(true)
    setShowConfirm(false)
    // MOD-1: 선택 슬롯 cardFlipOut → cardFlipIn 연출
    setFlipPhase('out')
    setTimeout(() => {
      upgradeCardInDeck(selectedDeckId, upgradedCard)
      setFlipPhase('in')
      setTimeout(() => {
        setFlipPhase('idle')
        // 완료 토스트 표시 후 복귀
        showToast(`강화 완료! [${upgradedCard.name}]이 더 강해졌습니다.`)
        setTimeout(() => {
          onComplete(true)
        }, 1000)
      }, 200)
    }, 200)
  }

  function handleCancelConfirm(): void {
    setShowConfirm(false)
  }

  function handleCancel(): void {
    onComplete(false)
  }

  function Divider(): React.ReactElement {
    return (
      <div style={{
        width: '100%',
        height: 1,
        background: 'var(--border-subtle)',
        margin: '16px 0',
      }} />
    )
  }

  const deckSize = currentDeckIds.length

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      {/* TopBar */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        gap: 12,
      }}>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: 'var(--text-muted)',
            padding: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ← 취소
        </button>
        <span style={{
          flex: 1,
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--text-headline)',
          textAlign: 'center',
        }}>
          카드를 강화합니다
        </span>
        {/* 우측 공간 (중앙 정렬용) */}
        <span style={{ width: 44 }} />
      </header>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '0 16px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}>

        {/* 설명 패널 */}
        <div className="pj-certificate-frame" style={{
          textAlign: 'center',
          padding: '16px 24px',
          marginTop: 16,
        }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 16,
            color: 'var(--text-headline)',
            marginBottom: 8,
          }}>
            덱에서 카드 1장을 강화된 버전으로 영구 교체합니다.
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            팔자도 갈고닦아야 빛이 납니다.
          </div>
        </div>

        <Divider />

        {!hasUpgradableCard ? (
          /* 빈 상태: 업그레이드 가능 카드 없음 */
          <div style={{
            padding: 32,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}>
            <div>강화할 수 있는 카드가 없습니다.</div>
            <div style={{ marginTop: 8 }}>카드를 더 모으면 강화 선택지가 늘어납니다.</div>
          </div>
        ) : (
          <>
            {/* 덱 섹션 레이블 */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: 8,
            }}>
              현재 덱 ({deckSize}장)
            </div>

            {/* 카드 그리드 3열 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              paddingBottom: 16,
              opacity: upgrading ? 0 : 1,
              transition: upgrading ? 'opacity 0.2s ease-out' : 'none',
            }}>
              {currentDeckIds.map((deckId, idx) => {
                const card = lookupCard(deckId)
                if (!card) return null
                return (
                  <UpgradeCardSlot
                    key={`${deckId}-${idx}`}
                    card={card}
                    deckId={deckId}
                    index={idx}
                    isSelected={selectedDeckIdx === idx}
                    isUpgradeable={isUpgradable(deckId)}
                    flipPhase={selectedDeckIdx === idx ? flipPhase : 'idle'}
                    onSelect={() => handleCardSelect(idx)}
                  />
                )
              })}
            </div>
          </>
        )}

        <Divider />

        {/* 카드 상세 미리보기 */}
        <div style={{
          marginBottom: 16,
          opacity: previewVisible && selectedCard ? 1 : (selectedCard ? 0 : 1),
          transform: previewVisible && selectedCard ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
        }}>
          {selectedCard && upgradedCard ? (
            <BeforeAfterPreview
              baseCard={selectedCard}
              upgradedCard={upgradedCard}
            />
          ) : (
            <div
              role="region"
              aria-label="선택한 카드 강화 정보"
              style={{
                background: 'rgba(232,220,196,0.4)',
                border: '1px dashed var(--border-subtle)',
                padding: 16,
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--text-muted)',
              }}
            >
              카드를 선택하면 강화 정보가 표시됩니다
            </div>
          )}
        </div>

        <Divider />

        {/* CTA 버튼 */}
        <button
          type="button"
          onClick={handleCtaClick}
          disabled={!selectedCard || !upgradedCard || upgrading}
          style={{
            width: '100%',
            padding: '14px 0',
            background: selectedCard && upgradedCard && !upgrading
              ? 'var(--gold)'
              : 'var(--border)',
            border: 'none',
            cursor: selectedCard && upgradedCard && !upgrading ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            fontWeight: selectedCard && upgradedCard ? 700 : 400,
            color: selectedCard && upgradedCard && !upgrading ? '#1A1714' : 'var(--text-muted)',
            textAlign: 'center',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {upgrading
            ? '강화 중...'
            : selectedCard && upgradedCard
            ? '이 카드를 강화합니다'
            : '카드를 먼저 선택해주세요'}
        </button>

        {/* 취소 링크 */}
        <button
          type="button"
          onClick={handleCancel}
          style={{
            display: 'block',
            margin: '16px auto 0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-muted)',
            textDecoration: 'underline',
            padding: '8px 16px',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          취소하고 돌아가기
        </button>
      </div>

      {/* 강화 확인 다이얼로그 */}
      {showConfirm && selectedCard && (
        <UpgradeConfirmDialog
          cardName={selectedCard.name}
          onConfirm={handleConfirmUpgrade}
          onCancel={handleCancelConfirm}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            maxWidth: 480,
            width: '100%',
            padding: '10px 16px',
            background: 'var(--surface)',
            borderBottom: '2px solid var(--border-gold)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-headline)',
            animation: 'slideUp 0.3s ease-out',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
