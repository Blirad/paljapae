/**
 * 화면 4 — 시작 덱 미리보기
 * 리라 스펙 §5
 */
import React, { useState } from 'react'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SecondaryButton from '@/components/ui/SecondaryButton'
import Divider from '@/components/ui/Divider'
import SectionLabel from '@/components/ui/SectionLabel'
import DeckCard from './DeckCard'
import Toast from '@/components/ui/Toast'
import { DECK_FLAVOR } from '@/game/store/onboardingStore'
import type { FiveElement } from '@/types/elements'
import type { Card } from '@/types/cards'

interface OnboardingScreen4Props {
  primaryElement: FiveElement
  deck: Card[]
  onStart: () => void
  onBack: () => void
}

export default function OnboardingScreen4({
  primaryElement,
  deck,
  onStart,
  onBack,
}: OnboardingScreen4Props): React.ReactElement {
  const [showToast, setShowToast] = useState(false)

  const handleDeckEdit = () => {
    setShowToast(true)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* TopBar */}
      <div
        style={{
          height: '56px',
          borderBottom: '1px solid rgba(232,200,74,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '8px 0',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="이전 화면으로 돌아가기"
        >
          ← 뒤로
        </button>

        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--text-headline)',
          }}
        >
          덱 ({deck.length}장)
        </span>

        <div
          role="group"
          aria-label="온보딩 3/3 단계"
          style={{ display: 'flex', gap: '6px' }}
        >
          {[true, true, true].map((done, i) => (
            <div
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: done ? 'var(--gold)' : 'rgba(201,168,76,0.2)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ScrollContainer */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 24px',
          paddingBottom: '120px',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        <SectionLabel className="mt-5">당신의 시작 덱</SectionLabel>

        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '14px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            margin: '8px 0 0',
          }}
        >
          {DECK_FLAVOR[primaryElement]}
        </p>

        <Divider className="mt-4" />

        {/* 카드 그리드 (2열) */}
        <div
          style={{
            marginTop: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
          }}
        >
          {deck.map((card, i) => (
            <DeckCard key={card.id} card={card} index={i} />
          ))}
        </div>
      </div>

      {/* StickyBottomBar */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '16px 24px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, var(--bg) 80%, transparent)',
          display: 'flex',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <SecondaryButton
          onClick={handleDeckEdit}
          className="flex-1"
          style={{ flex: 1, opacity: 0.4, cursor: 'not-allowed' } as React.CSSProperties}
        >
          덱 편집
        </SecondaryButton>
        <div style={{ flex: 2 }}>
          <PrimaryButton onClick={onStart}>
            바로 시작
          </PrimaryButton>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <Toast
          message="덱 편집은 스테이지 4 클리어 후 해금됩니다 🔒"
          duration={2500}
          bottomOffset={100}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </div>
  )
}
