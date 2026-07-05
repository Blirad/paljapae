/**
 * 화면 3 — 영웅 배정
 * 리라 스펙 §4
 */
import React, { useEffect, useState } from 'react'
import PrimaryButton from '@/components/ui/PrimaryButton'
import Divider from '@/components/ui/Divider'
import SectionLabel from '@/components/ui/SectionLabel'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'
import { HERO_DATA } from '@/game/store/onboardingStore'

interface OnboardingScreen3Props {
  primaryElement: FiveElement
  onNext: () => void
  onBack: () => void
}

export default function OnboardingScreen3({ primaryElement, onNext, onBack }: OnboardingScreen3Props): React.ReactElement {
  const hero = HERO_DATA[primaryElement]
  const display = ELEMENT_DISPLAY[primaryElement]

  // 진입 애니메이션
  const [visible, setVisible] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 30)
    const t2 = setTimeout(() => setCardVisible(true), 100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
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

        <div
          role="group"
          aria-label="온보딩 2/3 단계"
          style={{ display: 'flex', gap: '6px' }}
        >
          {[true, true, false].map((done, i) => (
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

        <div style={{ width: '60px' }} />
      </div>

      {/* ScrollContainer */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 24px',
          paddingBottom: 'calc(32px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        <SectionLabel className="mt-5">당신의 영웅</SectionLabel>

        {/* HeroCard */}
        <div
          role="img"
          aria-label={`${hero.name} 영웅 카드`}
          style={{
            marginTop: '16px',
            height: '200px',
            borderRadius: '12px',
            border: `1px solid ${display.color}99`,
            background: display.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            opacity: cardVisible ? 1 : 0,
            transform: cardVisible ? 'scale(1)' : 'scale(0.9)',
            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: '80px',
              filter: `drop-shadow(0 0 20px ${display.color}80)`,
            }}
          >
            {display.icon}
          </span>
        </div>

        {/* HeroInfo */}
        <div style={{ marginTop: '20px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '24px',
              color: 'var(--text-headline)',
              margin: 0,
            }}
          >
            {hero.name}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: '14px',
              color: 'var(--gold)',
              margin: '4px 0 0',
            }}
          >
            "{hero.nickname}"
          </p>
        </div>

        {/* StyleTags */}
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {[display.icon + primaryElement, hero.strategyTag, hero.playstyleTag].map((tag) => (
            <span
              key={tag}
              role="note"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${display.color}80`,
                borderRadius: '999px',
                padding: '4px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <Divider className="mt-5" />

        {/* 설명 */}
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '14px',
            color: 'var(--text-muted)',
            lineHeight: 1.7,
            margin: '16px 0 0',
          }}
        >
          {hero.description}
        </p>

        <Divider className="mt-5" />

        {/* 플레이버 텍스트 */}
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '13px',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            margin: '16px 0 0',
          }}
        >
          {hero.flavorText}
        </p>

        {/* CTA */}
        <div style={{ marginTop: '28px' }}>
          <PrimaryButton onClick={onNext}>
            시작 덱 확인하기 →
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
