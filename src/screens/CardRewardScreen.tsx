/**
 * CardRewardScreen — 배틀 승리 후 카드 3장 선택 화면 (M5)
 * 리라 M4 스펙 §4 + M5 스펙 §4 보완
 *
 * 플로우:
 *   배틀 승리 → 카드 3장 제시 → 1장 선택 → 덱에 추가 → WorldMap
 *   보스(stage 6) 승리 → 엔딩 화면
 */

import React, { useState, useEffect } from 'react'
import type { Card } from '@/types/cards'
import type { FiveElement } from '@/types/elements'
import { ELEMENT_DISPLAY } from '@/types/elements'
import { useUnlockStore } from '@/stores/unlockStore'
import PrimaryButton from '@/components/ui/PrimaryButton'

// ────────────────────────────────────────────────────
// 오행별 승리 타이틀 (리라 M4 스펙 §4 카피)
// ────────────────────────────────────────────────────

const VICTORY_TITLE: Record<FiveElement, string> = {
  '木': '역시 나무는 꺾이지 않았군요!',
  '火': '역시 팔자가 좋았군요!',
  '土': '결국 안 죽으면 이기는 거였군요!',
  '金': '조용했지만 결과는 화려했습니다.',
  '水': '흐름이 결국 이겼습니다.',
}

const BOSS_VICTORY_TITLE = "'내 사주엔 패배가 없다'던 그 사람... 방금 졌습니다"
const BOSS_VICTORY_SUBTITLE = '강호 최강자가 되었습니다. 팔자가 진짜 좋으시네요.'

// ────────────────────────────────────────────────────
// RewardCardSlot
// ────────────────────────────────────────────────────

interface RewardCardSlotProps {
  card: Card
  isSelected: boolean
  dimmed: boolean
  index: number
  onSelect: () => void
}

function RewardCardSlot({ card, isSelected, dimmed, index, onSelect }: RewardCardSlotProps): React.ReactElement {
  const elDisplay = card.element ? ELEMENT_DISPLAY[card.element] : null
  const elColor = elDisplay?.color ?? '#6B5F52'
  const isSoldier = card.cardType === 'soldier'

  return (
    <button
      role="radio"
      aria-checked={isSelected}
      aria-label={`${card.name} 선택`}
      onClick={onSelect}
      style={{
        flex: 1,
        background: '#141210',
        border: `2px solid ${isSelected ? '#E8C84A' : `${elColor}4D`}`,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        padding: 0,
        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isSelected ? '0 0 16px rgba(232,200,74,0.3)' : 'none',
        opacity: dimmed ? 0.4 : 1,
        transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s, border-color 0.2s',
        WebkitTapHighlightColor: 'transparent',
        zIndex: isSelected ? 1 : 0,
        animation: `cardStagger 0.3s ease-out ${index * 100}ms both`,
        minWidth: 0,
      }}
    >
      {/* 헤더: 비용 + 오행 */}
      <div style={{
        height: 28,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: `${elColor}26`,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 14, color: '#E8C84A' }}>
          {card.cost}
        </span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: elColor }}>
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
          : 'linear-gradient(135deg, #1A1714 0%, #141210 100%)',
        minHeight: 60,
      }}>
        <span aria-hidden="true" style={{ fontSize: 28 }}>
          {elDisplay?.icon ?? '⬜'}
        </span>
      </div>

      {/* 카드 정보 */}
      <div style={{
        padding: '6px 8px',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'Noto Serif KR, serif',
          fontWeight: 700,
          fontSize: 11,
          color: '#E8E0D0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {card.name}
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B5F52', marginTop: 1 }}>
          {isSoldier ? '병사' : '주문'}
        </div>
        {isSoldier && (
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#E8C84A', fontWeight: 700, marginTop: 1 }}>
            {(card as any).attack}/{(card as any).maxHealth}
          </div>
        )}
      </div>
    </button>
  )
}

// ────────────────────────────────────────────────────
// CardDetailPreview
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
        background: '#1A1714',
        border: '1px solid rgba(232,200,74,0.12)',
        borderRadius: 8,
        padding: 12,
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* 태그 행 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {elDisplay && (
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 10,
            background: '#1A1714',
            border: '1px solid rgba(232,200,74,0.12)',
            borderRadius: 4,
            padding: '2px 6px',
            color: elColor,
          }}>
            {elDisplay.icon} {card.element}
          </span>
        )}
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          background: '#1A1714',
          border: '1px solid rgba(232,200,74,0.12)',
          borderRadius: 4,
          padding: '2px 6px',
          color: '#A89880',
        }}>
          비용 {card.cost}
        </span>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          background: '#1A1714',
          border: '1px solid rgba(232,200,74,0.12)',
          borderRadius: 4,
          padding: '2px 6px',
          color: '#A89880',
        }}>
          {isSoldier ? '병사' : '주문'}
        </span>
        {isSoldier && (
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 10,
            background: '#1A1714',
            border: '1px solid rgba(232,200,74,0.12)',
            borderRadius: 4,
            padding: '2px 6px',
            color: '#E8C84A',
          }}>
            {(card as any).attack}/{(card as any).maxHealth}
          </span>
        )}
      </div>

      {/* 카드명 */}
      <div style={{
        fontFamily: 'Noto Serif KR, serif',
        fontWeight: 700,
        fontSize: 15,
        color: '#E8E0D0',
      }}>
        {card.name}
      </div>

      {/* 효과 텍스트 */}
      {(card as any).effectText && (
        <div style={{
          fontFamily: 'Noto Sans KR, sans-serif',
          fontSize: 13,
          color: '#A89880',
          marginTop: 6,
          lineHeight: 1.5,
        }}>
          {(card as any).effectText}
        </div>
      )}

      {/* 플레이버 텍스트 */}
      {(card as any).flavorText && (
        <div style={{
          fontFamily: 'Noto Sans KR, sans-serif',
          fontStyle: 'italic',
          fontSize: 12,
          color: '#6B5F52',
          marginTop: 6,
          lineHeight: 1.5,
        }}>
          {(card as any).flavorText}
        </div>
      )}
    </div>
  )
}

function CardPreviewPlaceholder(): React.ReactElement {
  return (
    <div style={{
      background: 'rgba(26,23,20,0.5)',
      border: '1px dashed rgba(232,200,74,0.12)',
      borderRadius: 8,
      padding: 16,
      textAlign: 'center',
      fontFamily: 'Noto Sans KR, sans-serif',
      fontSize: 13,
      color: '#6B5F52',
    }}>
      카드를 선택하면 상세 정보가 표시됩니다
    </div>
  )
}

// ────────────────────────────────────────────────────
// CardRewardScreen
// ────────────────────────────────────────────────────

interface CardRewardScreenProps {
  playerElement: FiveElement
  stageId: number            // 6이면 보스
  onComplete: () => void     // WorldMap 복귀
  onBossCleared: () => void  // 보스 클리어 → EndingScreen
}

export default function CardRewardScreen({
  playerElement,
  stageId,
  onComplete,
  onBossCleared,
}: CardRewardScreenProps): React.ReactElement {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [adding, setAdding] = useState(false)
  const [visible, setVisible] = useState(false)

  const { pendingReward, selectReward } = useUnlockStore(s => ({
    pendingReward: s.pendingReward,
    selectReward: s.selectReward,
  }))

  const isBoss = stageId === 6

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  function handleConfirmSelection(): void {
    if (!selectedCard || adding) return
    setAdding(true)

    // 카드 추가 애니메이션 후 복귀
    selectReward(selectedCard.id)
    setTimeout(() => {
      onComplete()
    }, 400)
  }

  function handleSkip(): void {
    onComplete()
  }

  const rewardCards = pendingReward?.cards ?? []

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
      overflowY: 'auto',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease-out',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '0 16px 32px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}>

        {/* 승리 배너 */}
        <div style={{
          textAlign: 'center',
          paddingTop: 32,
          paddingBottom: 16,
          animation: 'slideUp 0.4s ease-out 0.2s both',
        }}>
          {isBoss ? (
            <>
              <div style={{
                fontFamily: 'Noto Serif KR, serif',
                fontWeight: 700,
                fontSize: 18,
                color: '#E8C84A',
                lineHeight: 1.4,
              }}>
                {BOSS_VICTORY_TITLE}
              </div>
              <div style={{
                fontFamily: 'Noto Sans KR, sans-serif',
                fontSize: 14,
                color: '#A89880',
                marginTop: 8,
              }}>
                {BOSS_VICTORY_SUBTITLE}
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontFamily: 'Noto Serif KR, serif',
                fontWeight: 700,
                fontSize: 22,
                color: '#E8C84A',
              }}>
                {VICTORY_TITLE[playerElement]}
              </div>
              <div style={{
                fontFamily: 'Noto Sans KR, sans-serif',
                fontSize: 14,
                color: '#A89880',
                marginTop: 4,
              }}>
                카드 1장을 선택하세요
              </div>
            </>
          )}
        </div>

        {/* 구분선 */}
        <div style={{ height: 1, background: 'rgba(232,200,74,0.12)', marginBottom: 16 }} />

        {/* 보스 클리어: 엔딩 버튼만 표시 */}
        {isBoss ? (
          <div style={{ marginTop: 24, padding: '0 16px' }}>
            <PrimaryButton onClick={onBossCleared}>
              엔딩 보기
            </PrimaryButton>
          </div>
        ) : (
          <>
            {/* 카드 3장 */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 16,
            }}>
              {rewardCards.map((card, i) => (
                <RewardCardSlot
                  key={card.id}
                  card={card}
                  index={i}
                  isSelected={selectedCard?.id === card.id}
                  dimmed={selectedCard !== null && selectedCard.id !== card.id}
                  onSelect={() => setSelectedCard(card)}
                />
              ))}
            </div>

            {/* 카드 상세 */}
            <div style={{ marginBottom: 16 }}>
              {selectedCard
                ? <CardDetailPreview card={selectedCard} />
                : <CardPreviewPlaceholder />
              }
            </div>

            {/* 구분선 */}
            <div style={{ height: 1, background: 'rgba(232,200,74,0.12)', marginBottom: 16 }} />

            {/* CTA */}
            <div style={{ marginTop: 'auto' }}>
              <PrimaryButton
                disabled={!selectedCard}
                isLoading={adding}
                loadingText="추가 중..."
                onClick={handleConfirmSelection}
              >
                {selectedCard ? '내 덱에 추가하기 ✓' : '카드를 먼저 선택해주세요'}
              </PrimaryButton>

              {/* 스킵 */}
              <button
                type="button"
                onClick={handleSkip}
                style={{
                  display: 'block',
                  margin: '16px auto 0',
                  background: 'none',
                  border: 'none',
                  color: '#6B5F52',
                  fontFamily: 'Noto Sans KR, sans-serif',
                  fontSize: 13,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '8px 16px',
                }}
              >
                이번 판은 건너뜁니다
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
