/**
 * CollectionScreen — 카드 컬렉션 화면 (Phase E)
 * 획득한 모든 카드와 유물 표시
 */

import React, { useMemo } from 'react'
import { ALL_CARDS } from '@/data/cards'
import CardArtSVG from '@/components/battle/CardArtSVG'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'
import type { Relic } from '@/types/relics'

interface CollectionScreenProps {
  ownedCardIds: Set<string>
  ownedRelics: Relic[]
  onClose: () => void
}

export default function CollectionScreen({
  ownedCardIds,
  ownedRelics: relics,
  onClose,
}: CollectionScreenProps): React.ReactElement {
  const [tab, setTab] = React.useState<'cards' | 'relics'>('cards')

  const ownedCards = useMemo(() => {
    return Array.from(ownedCardIds)
      .map(id => ALL_CARDS.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c != null)
      .sort((a, b) => {
        // 오행별 정렬
        const elA = (Object.keys(ELEMENT_DISPLAY) as FiveElement[]).indexOf(
          a.element as FiveElement
        )
        const elB = (Object.keys(ELEMENT_DISPLAY) as FiveElement[]).indexOf(
          b.element as FiveElement
        )
        if (elA !== elB) return elA - elB
        // 같은 오행이면 레어도로 정렬
        const rarityOrder = { common: 0, uncommon: 1, rare: 2, legendary: 3 }
        return (
          (rarityOrder[a.rarity as keyof typeof rarityOrder] ?? 0) - (rarityOrder[b.rarity as keyof typeof rarityOrder] ?? 0)
        )
      })
  }, [ownedCardIds])

  const sortedRelics = useMemo(() => {
    return [...relics].sort((a, b) => {
      // 길/흉/복 순서
      const alignOrder: Record<string, number> = { '吉': 0, '凶': 1, '複': 2 }
      return (alignOrder[a.alignment] ?? 0) - (alignOrder[b.alignment] ?? 0)
    })
  }, [relics])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0D0B08',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-serif)',
      color: 'var(--text-body)',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(212, 165, 116, 0.1) 0%, rgba(212, 165, 116, 0.05) 100%)',
        borderBottom: '1px solid rgba(212, 165, 116, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: '#D4A574',
        }}>
          컬렉션
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            background: 'rgba(212, 165, 116, 0.2)',
            border: '1px solid rgba(212, 165, 116, 0.4)',
            color: 'rgba(212, 165, 116, 0.8)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            (e.target as HTMLElement).style.background = 'rgba(212, 165, 116, 0.3)'
          }}
          onMouseOut={(e) => {
            (e.target as HTMLElement).style.background = 'rgba(212, 165, 116, 0.2)'
          }}
        >
          닫기
        </button>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex',
        padding: '16px 20px',
        gap: 8,
        borderBottom: '1px solid rgba(212, 165, 116, 0.2)',
      }}>
        {(['cards', 'relics'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              background: tab === t
                ? 'rgba(74, 222, 128, 0.3)'
                : 'transparent',
              border: `1px solid ${
                tab === t ? 'rgba(74, 222, 128, 0.6)' : 'rgba(212, 165, 116, 0.2)'
              }`,
              color: tab === t ? '#4ADE80' : 'rgba(212, 165, 116, 0.6)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              transition: 'all 0.2s',
            }}
          >
            {t === 'cards' ? `카드 (${ownedCards.length})` : `유물 (${relics.length})`}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px',
      }}>
        {tab === 'cards' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: 16,
          }}>
            {ownedCards.map(card => (
              <div
                key={card.id}
                style={{
                  textAlign: 'center',
                }}
              >
                <div style={{
                  marginBottom: 8,
                  height: 80,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(212, 165, 116, 0.05)',
                  borderRadius: 4,
                  padding: '4px',
                }}>
                  <CardArtSVG
                    element={card.element ?? '火'}
                    rarity={card.rarity}
                    size="field"
                    cardType={card.cardType}
                    keywords={card.cardType === 'soldier' ? card.keywords : []}
                    cost={card.cost}
                  />
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(212, 165, 116, 0.7)',
                  lineHeight: 1.3,
                }}>
                  {card.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {sortedRelics.map(relic => (
              <div
                key={relic.id}
                style={{
                  background: 'rgba(212, 165, 116, 0.05)',
                  border: '1px solid rgba(212, 165, 116, 0.2)',
                  borderRadius: 8,
                  padding: '16px',
                }}
              >
                <div style={{
                  fontSize: 20,
                  marginBottom: 8,
                }}>
                  {relic.icon}
                </div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  marginBottom: 4,
                  color: '#D4A574',
                }}>
                  {relic.name}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(212, 165, 116, 0.6)',
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}>
                  {relic.description}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(212, 165, 116, 0.4)',
                }}>
                  {relic.alignment === '吉' ? '✓ 길' : relic.alignment === '凶' ? '⚠ 흉' : '⬡ 복'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
