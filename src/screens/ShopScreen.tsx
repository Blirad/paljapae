/**
 * ShopScreen — 상점 화면 (M7 P2-B)
 * 리라 M7 P1P4 스펙 §3 기준
 *
 * - 카드 3장 구매 (골드 차감)
 * - HP 회복 포션 (⬡30)
 * - 카드 제거 서비스 (⬡50 → RemoveCardScreen)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { ALL_CARDS } from '@/data/cards'
import type { Card, SoldierCard } from '@/types/cards'
import { ELEMENT_DISPLAY } from '@/types/elements'
import { useUnlockStore } from '@/stores/unlockStore'
import { saveGold } from '@/utils/persistence'

// ────────────────────────────────────────────────────
// 가격 테이블
// ────────────────────────────────────────────────────

const SHOP_CARD_PRICE: Record<string, number> = {
  common: 30,
  uncommon: 50,
  rare: 80,
  legendary: 120,
}

const SHOP_SERVICE_HP = 30
const SHOP_SERVICE_REMOVE = 50

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface ShopScreenProps {
  gold: number
  heroHp: number
  heroMaxHp: number
  onGoldChange: (newGold: number) => void
  onHpRestore: (delta: number) => void
  onComplete: () => void
  onRemoveCard: () => void
}

// ────────────────────────────────────────────────────
// 골드 카운트 애니메이션
// ────────────────────────────────────────────────────

function useCountAnim(target: number, duration = 400): number {
  const [displayed, setDisplayed] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevRef.current === target) {
      setDisplayed(target)
      return
    }
    const from = prevRef.current
    prevRef.current = target
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startRef.current = null

    function step(ts: number) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setDisplayed(Math.round(from + (target - from) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return displayed
}

// ────────────────────────────────────────────────────
// ShopCardSlot
// ────────────────────────────────────────────────────

interface ShopCardSlotProps {
  card: Card
  price: number
  canAfford: boolean
  sold: boolean
  index: number
  onTap: () => void
}

function ShopCardSlot({ card, price, canAfford, sold, index, onTap }: ShopCardSlotProps): React.ReactElement {
  const elDisplay = card.element ? ELEMENT_DISPLAY[card.element] : null
  const elColor = elDisplay?.color ?? '#6B5F52'
  const isSoldier = card.cardType === 'soldier'
  const [shaking, setShaking] = useState(false)

  function handleClick(): void {
    if (sold) return
    if (!canAfford) {
      setShaking(true)
      setTimeout(() => setShaking(false), 400)
      return
    }
    onTap()
  }

  if (sold) {
    return (
      <div style={{
        flex: '1 1 calc(50% - 4px)',
        minWidth: 100,
        height: 130,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: 0.5,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--el-wood)' }}>
          구입 완료
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${card.name} 구매 - ${price}골드`}
      style={{
        flex: '1 1 calc(50% - 4px)',
        minWidth: 100,
        height: 130,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        border: `1px solid ${canAfford ? 'var(--border-gold)' : 'var(--border)'}`,
        cursor: canAfford ? 'pointer' : 'not-allowed',
        padding: 0,
        overflow: 'hidden',
        animation: shaking
          ? 'shake 0.3s ease-out'
          : `shopCardIn 0.35s ease-out ${index * 60}ms both`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* 헤더 */}
      <div style={{
        height: 26,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: `${elColor}22`,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)' }}>
          {card.cost}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: elColor }}>
          {elDisplay ? `${elDisplay.icon}${card.element}` : '중립'}
        </span>
      </div>

      {/* 아트 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: elDisplay
          ? elDisplay.gradient.replace(/0\.\d+\)/g, '0.3)')
          : 'linear-gradient(135deg, var(--surface) 0%, var(--bg2) 100%)',
      }}>
        <span style={{ fontSize: 22 }}>{elDisplay?.icon ?? '⬜'}</span>
      </div>

      {/* 카드명 */}
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
          {isSoldier ? `병사 · ${(card as SoldierCard).attack}/${(card as SoldierCard).maxHealth}` : '주문'}
        </div>
      </div>

      {/* 가격 */}
      <div style={{
        padding: '4px 6px 6px',
        flexShrink: 0,
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 700,
          color: canAfford ? 'var(--gold)' : 'var(--text-muted)',
        }}>
          ⬡ {price}{!canAfford ? ' (부족)' : ''}
        </span>
      </div>
    </button>
  )
}

// ────────────────────────────────────────────────────
// BuyConfirmModal
// ────────────────────────────────────────────────────

interface BuyConfirmModalProps {
  card: Card
  price: number
  onConfirm: () => void
  onCancel: () => void
}

function BuyConfirmModal({ card, price, onConfirm, onCancel }: BuyConfirmModalProps): React.ReactElement {
  return (
    <>
      <div
        aria-hidden="true"
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="카드 구매 확인"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          background: 'var(--surface)',
          borderTop: '2px solid var(--border-gold)',
          padding: '20px 24px calc(env(safe-area-inset-bottom, 0px) + 20px)',
          zIndex: 50,
          animation: 'slideUpSheet 0.3s cubic-bezier(0.33,1,0.68,1)',
        }}
      >
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 16,
          color: 'var(--text-headline)',
          textAlign: 'center',
          marginBottom: 6,
        }}>
          {card.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--gold)',
          textAlign: 'center',
          marginBottom: 20,
        }}>
          ⬡ {price} 골드 소비
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px 0',
              background: 'transparent',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--text-muted)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            그냥 보는 것이오
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1, padding: '12px 0',
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
            구입합니다 (⬡ -{price})
          </button>
        </div>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────
// ShopToast
// ────────────────────────────────────────────────────

function ShopToast({ message, color = 'var(--text-headline)' }: { message: string; color?: string }): React.ReactElement {
  return (
    <div style={{
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
      color,
      animation: 'toastSlideDown 0.4s cubic-bezier(0.33,1,0.68,1)',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  )
}

// ────────────────────────────────────────────────────
// ShopScreen
// ────────────────────────────────────────────────────

export default function ShopScreen({
  gold,
  heroHp,
  heroMaxHp,
  onGoldChange,
  onHpRestore,
  onComplete,
  onRemoveCard,
}: ShopScreenProps): React.ReactElement {
  const currentDeckIds = useUnlockStore(s => s.currentDeckIds)

  // 상점 재고: 마운트 시 1회 고정 (useMemo + empty deps)
  // 스펙 §3-4: ALL_CARDS에서 현재 deckIds에 없는 common/uncommon 카드를 선택 풀로 사용
  const shopCards = useMemo<Card[]>(() => {
    const deckIdSet = new Set(currentDeckIds)
    const pool = ALL_CARDS.filter(
      c => (c.rarity === 'common' || c.rarity === 'uncommon') && !deckIdSet.has(c.id)
    )
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [soldIndices, setSoldIndices] = useState<Set<number>>(new Set())
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  const [hpRestored, setHpRestored] = useState(false)
  const [removeUsed, setRemoveUsed] = useState(false)
  const [toast, setToast] = useState<{ msg: string; color?: string } | null>(null)
  const [localGold, setLocalGold] = useState(gold)

  const displayedGold = useCountAnim(localGold)

  function showToast(msg: string, color?: string): void {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2500)
  }

  function deductGold(amount: number): number {
    const newGold = Math.max(0, localGold - amount)
    setLocalGold(newGold)
    onGoldChange(newGold)
    saveGold(newGold)
    return newGold
  }

  function handleBuyCard(idx: number): void {
    if (!shopCards[idx]) return
    setConfirmIdx(idx)
  }

  function handleConfirmBuy(): void {
    if (confirmIdx === null || !shopCards[confirmIdx]) return
    const card = shopCards[confirmIdx]
    const price = SHOP_CARD_PRICE[card.rarity] ?? 30

    deductGold(price)

    // 덱에 추가
    useUnlockStore.setState(state => ({
      ownedCardIds: new Set([...state.ownedCardIds, card.id]),
      currentDeckIds: [...state.currentDeckIds, card.id],
    }))

    setSoldIndices(prev => new Set([...prev, confirmIdx]))
    setConfirmIdx(null)
    showToast(`${card.name}을 구입했습니다. ⬡ -${price}`)
  }

  function handleCancelBuy(): void {
    setConfirmIdx(null)
  }

  function handleHpPotion(): void {
    if (heroHp >= heroMaxHp) {
      showToast('이미 최고 상태입니다', 'var(--text-muted)')
      return
    }
    if (localGold < SHOP_SERVICE_HP) {
      showToast('골드가 부족합니다.', 'var(--text-muted)')
      return
    }
    deductGold(SHOP_SERVICE_HP)
    onHpRestore(10)
    setHpRestored(true)
    showToast('HP +10 회복. 기운이 납니다.', 'var(--el-wood)')
  }

  function handleRemoveCard(): void {
    if (localGold < SHOP_SERVICE_REMOVE) {
      showToast('골드가 부족합니다.', 'var(--text-muted)')
      return
    }
    deductGold(SHOP_SERVICE_REMOVE)
    setRemoveUsed(true)
    onRemoveCard()
  }

  const allSold = soldIndices.size >= shopCards.length

  return (
    <>
      <div style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
        animation: 'fadeIn 0.25s ease-out',
      }}>
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
            onClick={onComplete}
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
            노점 상인 (路邊商人)
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--gold)',
            animation: 'shopGoldIn 0.4s ease-out',
          }}>
            ⬡ {displayedGold}
          </span>
        </header>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
        }}>
          {/* 상인 말풍선 */}
          <div className="pj-certificate-frame" style={{
            textAlign: 'center',
            padding: '14px 20px',
            marginTop: 16,
            animation: 'shopCertIn 0.3s ease-out 80ms both',
          }}>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 15,
              color: 'var(--text-headline)',
            }}>
              아, 어서오게. 좋은 물건 있네.
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              marginTop: 4,
            }}>
              골드만 있으면 다 되지.
            </div>
          </div>

          {/* 카드 구매 */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginTop: 20,
            marginBottom: 8,
          }}>
            카드 구매
          </div>

          {shopCards.length === 0 || allSold ? (
            <div style={{
              padding: '20px 0',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              오늘 준비한 물건은 다 팔렸네.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {shopCards.map((card, idx) => (
                <ShopCardSlot
                  key={card.id}
                  card={card}
                  price={SHOP_CARD_PRICE[card.rarity] ?? 30}
                  canAfford={localGold >= (SHOP_CARD_PRICE[card.rarity] ?? 30)}
                  sold={soldIndices.has(idx)}
                  index={idx}
                  onTap={() => handleBuyCard(idx)}
                />
              ))}
            </div>
          )}

          {/* 서비스 */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginTop: 24,
            marginBottom: 8,
          }}>
            서비스
          </div>

          <button
            type="button"
            onClick={handleHpPotion}
            disabled={hpRestored}
            style={{
              width: '100%',
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              cursor: hpRestored ? 'not-allowed' : 'pointer',
              opacity: hpRestored ? 0.65 : 1,
              marginBottom: 8,
              WebkitTapHighlightColor: 'transparent',
              animation: 'shopServiceIn 0.25s ease-out 350ms both',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 13,
              color: hpRestored ? 'var(--el-wood)' : 'var(--text-primary)',
            }}>
              {hpRestored ? '⚕ HP 회복 완료 ✓' : '⚕ HP 회복 (+10)'}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              color: (!hpRestored && localGold >= SHOP_SERVICE_HP) ? 'var(--gold)' : 'var(--text-muted)',
            }}>
              ⬡ {SHOP_SERVICE_HP}
            </span>
          </button>

          <button
            type="button"
            onClick={handleRemoveCard}
            disabled={removeUsed}
            style={{
              width: '100%',
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              cursor: removeUsed ? 'not-allowed' : 'pointer',
              opacity: removeUsed ? 0.65 : 1,
              marginBottom: 8,
              WebkitTapHighlightColor: 'transparent',
              animation: 'shopServiceIn 0.25s ease-out 400ms both',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--text-primary)',
            }}>
              덱에서 카드 제거
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              color: (!removeUsed && localGold >= SHOP_SERVICE_REMOVE) ? 'var(--gold)' : 'var(--text-muted)',
            }}>
              ⬡ {SHOP_SERVICE_REMOVE}
            </span>
          </button>

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0' }} />

          <button
            type="button"
            onClick={onComplete}
            style={{
              width: '100%',
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--border-gold)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--text-headline)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            상점을 떠납니다
          </button>
        </div>
      </div>

      {/* 구매 확인 모달 */}
      {confirmIdx !== null && shopCards[confirmIdx] && (
        <BuyConfirmModal
          card={shopCards[confirmIdx]}
          price={SHOP_CARD_PRICE[shopCards[confirmIdx].rarity] ?? 30}
          onConfirm={handleConfirmBuy}
          onCancel={handleCancelBuy}
        />
      )}

      {toast && <ShopToast message={toast.msg} color={toast.color} />}

      <style>{`
        @keyframes shopCardIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shopCertIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shopServiceIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shopGoldIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes toastSlideDown {
          from { transform: translateX(-50%) translateY(-100%); }
          to   { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  )
}
