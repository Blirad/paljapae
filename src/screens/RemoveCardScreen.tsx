/**
 * RemoveCardScreen — 덱 카드 제거 화면 (M7 P1-A)
 * 리라 M7 P0 UX 스펙 §P1-A
 *
 * 진입: CardRewardScreen 스킵 후 "카드 제거하기" 선택
 * 진출: 제거 완료 or 취소 → onComplete() → worldMap
 *
 * 정책:
 *  - currentDeckIds 전체를 표시
 *  - 덱 크기 <= 8이면 빈 상태 메시지 표시
 *  - 제거 가능 카드: currentDeckIds.length > 8인 경우에만 (제거 후 8장 미만 방지)
 *  - 실제 방어는 unlockStore.removeCardFromDeck 내부에서도 처리
 *  - ownedCardIds는 유지 (덱에서만 제거)
 */

import React, { useState } from 'react'
import { useUnlockStore } from '@/stores/unlockStore'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { Card } from '@/types/cards'
import { ALL_CARDS } from '@/data/cards'

// ────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────

const ALL_CARDS_MAP: Map<string, Card> = new Map(ALL_CARDS.map(c => [c.id, c]))

function lookupCard(id: string): Card | undefined {
  if (ALL_CARDS_MAP.has(id)) return ALL_CARDS_MAP.get(id)
  const baseId = id.replace(/_(?:s\d+|ai\d+|[a-z])$/, '')
  return ALL_CARDS_MAP.get(baseId)
}

// ────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────

const DECK_MIN_SIZE = 8

// ────────────────────────────────────────────────────
// RemoveCardSlot — 카드 슬롯 (RewardCardSlot 패턴 참조)
// ────────────────────────────────────────────────────

interface RemoveCardSlotProps {
  card: Card
  deckId: string       // 실제 덱 내 ID (중복 카드 구분용)
  isSelected: boolean
  isRemovable: boolean  // 덱 크기 > 8 이고 스타터 제한 없을 때
  index: number
  onSelect: () => void
}

function RemoveCardSlot({
  card,
  isSelected,
  isRemovable,
  index,
  onSelect,
}: RemoveCardSlotProps): React.ReactElement {
  const elDisplay = card.element ? ELEMENT_DISPLAY[card.element] : null
  const elColor = elDisplay?.color ?? '#6B5F52'
  const isSoldier = card.cardType === 'soldier'

  return (
    <button
      type="button"
      aria-label={`${card.name} ${isRemovable ? '제거 선택' : '제거 불가'}`}
      aria-disabled={!isRemovable}
      onClick={isRemovable ? onSelect : undefined}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isSelected ? 'var(--gold)' : `${elColor}4D`}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: isRemovable ? 'pointer' : 'not-allowed',
        padding: 0,
        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isSelected ? '0 0 16px rgba(201,168,76,0.3)' : 'none',
        opacity: isRemovable ? 1 : 0.4,
        transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s, border-color 0.2s',
        WebkitTapHighlightColor: 'transparent',
        zIndex: isSelected ? 1 : 0,
        animation: `cardStagger 0.3s ease-out ${index * 100}ms both`,
        minWidth: 0,
        minHeight: 120,
      }}
    >
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
// CardDetailPreview (CardRewardScreen과 동일 패턴)
// ────────────────────────────────────────────────────

function CardDetailPreview({ card }: { card: Card }): React.ReactElement {
  const elDisplay = card.element ? ELEMENT_DISPLAY[card.element] : null
  const elColor = elDisplay?.color ?? '#6B5F52'
  const isSoldier = card.cardType === 'soldier'

  return (
    <div
      role="region"
      aria-label="선택한 카드 정보"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        padding: 12,
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {elDisplay && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            padding: '2px 6px',
            color: elColor,
          }}>
            {elDisplay.icon} {card.element}
          </span>
        )}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          padding: '2px 6px',
          color: 'var(--text-muted)',
        }}>
          비용 {card.cost}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          padding: '2px 6px',
          color: 'var(--text-muted)',
        }}>
          {isSoldier ? '병사' : '주문'}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontWeight: 700,
        fontSize: 15,
        color: 'var(--text-headline)',
      }}>
        {card.name}
      </div>
      {(card as any).effectText && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginTop: 6,
          lineHeight: 1.5,
        }}>
          {(card as any).effectText}
        </div>
      )}
      {(card as any).flavorText && (
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--text-muted)',
          marginTop: 6,
          lineHeight: 1.5,
        }}>
          {(card as any).flavorText}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────
// ConfirmDialog — 바텀 시트 (StageDetailPopup 패턴 참조)
// ────────────────────────────────────────────────────

interface ConfirmDialogProps {
  cardName: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ cardName, onConfirm, onCancel }: ConfirmDialogProps): React.ReactElement {
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
        aria-label="카드 제거 확인"
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
          {cardName}을(를) 덱에서 제거할까요?
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--accent-red)',
          textAlign: 'center',
          marginBottom: 20,
        }}>
          이 작업은 되돌릴 수 없습니다.
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
              background: 'var(--accent-red)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 700,
              color: '#F2EAD8',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            제거합니다
          </button>
        </div>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────
// RemoveCardScreen
// ────────────────────────────────────────────────────

export interface RemoveCardScreenProps {
  onComplete: () => void
}

export default function RemoveCardScreen({ onComplete }: RemoveCardScreenProps): React.ReactElement {
  const [selectedDeckIdx, setSelectedDeckIdx] = useState<number | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [removing, setRemoving] = useState(false)

  const currentDeckIds = useUnlockStore(s => s.currentDeckIds)
  const starterDeckIds = useUnlockStore(s => s.starterDeckIds)
  const removeCardFromDeck = useUnlockStore(s => s.removeCardFromDeck)

  // P1-A CRIT-01: starterDeck 카드 ID 집합 (빠른 조회용)
  const starterDeckIdsSet = new Set(starterDeckIds)

  const deckSize = currentDeckIds.length
  const isEmpty = deckSize <= DECK_MIN_SIZE

  // 선택된 카드
  const selectedDeckId = selectedDeckIdx !== null ? currentDeckIds[selectedDeckIdx] : null
  const selectedCard = selectedDeckId ? lookupCard(selectedDeckId) ?? null : null

  function handleCardSelect(idx: number): void {
    if (isEmpty) return
    // starterDeck 카드는 선택 불가 (CRIT-01)
    const deckId = currentDeckIds[idx]
    if (starterDeckIdsSet.has(deckId)) return
    setSelectedDeckIdx(prev => prev === idx ? null : idx)
  }

  function handleCtaClick(): void {
    if (selectedDeckIdx === null || !selectedCard) return
    setShowConfirm(true)
  }

  function handleConfirmRemove(): void {
    if (selectedDeckIdx === null || !selectedDeckId || removing) return
    setRemoving(true)
    removeCardFromDeck(selectedDeckId)
    // 카드 그리드 fadeOut 후 완료
    setTimeout(() => {
      onComplete()
    }, 400)
  }

  function handleCancelConfirm(): void {
    setShowConfirm(false)
  }

  function handleCancel(): void {
    onComplete()
  }

  // 구분선
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
          카드를 제거합니다
        </span>
        {/* 우측 빈 공간 (중앙 정렬용) */}
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
            fontSize: 18,
            color: 'var(--text-headline)',
            marginBottom: 8,
          }}>
            덱에서 카드 1장을 영구 삭제합니다.
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            신중하게 고르세요 — 팔자도 한 번 삭제하면 못 돌려요
          </div>
        </div>

        <Divider />

        {isEmpty ? (
          /* 빈 상태: 덱이 8장 이하 */
          <div style={{
            padding: 32,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}>
            <div>제거할 카드가 없습니다.</div>
            <div style={{ marginTop: 8 }}>덱에 카드를 더 추가해보세요.</div>
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
              opacity: removing ? 0 : 1,
              transition: removing ? 'opacity 0.2s ease-out' : 'none',
            }}>
              {currentDeckIds.map((deckId, idx) => {
                const card = lookupCard(deckId)
                if (!card) return null
                return (
                  <RemoveCardSlot
                    key={`${deckId}-${idx}`}
                    card={card}
                    deckId={deckId}
                    index={idx}
                    isSelected={selectedDeckIdx === idx}
                    isRemovable={!starterDeckIdsSet.has(deckId)}
                    onSelect={() => handleCardSelect(idx)}
                  />
                )
              })}
            </div>
          </>
        )}

        <Divider />

        {/* 카드 상세 미리보기 */}
        <div style={{ marginBottom: 16 }}>
          {selectedCard ? (
            <CardDetailPreview card={selectedCard} />
          ) : (
            <div style={{
              background: 'rgba(232,220,196,0.4)',
              border: '1px dashed var(--border-subtle)',
              padding: 16,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text-muted)',
            }}>
              카드를 선택하면 정보가 표시됩니다
            </div>
          )}
        </div>

        <Divider />

        {/* CTA 버튼 */}
        <button
          type="button"
          onClick={handleCtaClick}
          disabled={!selectedCard || isEmpty || removing}
          style={{
            width: '100%',
            padding: '14px 0',
            background: selectedCard && !isEmpty ? 'var(--accent-red)' : 'var(--border)',
            border: 'none',
            cursor: selectedCard && !isEmpty ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            fontWeight: selectedCard && !isEmpty ? 700 : 400,
            color: selectedCard && !isEmpty ? '#F2EAD8' : 'var(--text-muted)',
            textAlign: 'center',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {selectedCard && !isEmpty ? '이 카드를 덱에서 제거합니다' : '카드를 먼저 선택해주세요'}
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

      {/* 확인 다이얼로그 */}
      {showConfirm && selectedCard && (
        <ConfirmDialog
          cardName={selectedCard.name}
          onConfirm={handleConfirmRemove}
          onCancel={handleCancelConfirm}
        />
      )}
    </div>
  )
}
