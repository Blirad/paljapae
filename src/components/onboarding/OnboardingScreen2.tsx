/**
 * 화면 2 — 오행 결과 공개
 * 리라 스펙 §3
 * ⚠️ W4 필수: "약식 사주(생년월일 기준)" 명시 포함
 */
import React, { useEffect, useState } from 'react'
import PrimaryButton from '@/components/ui/PrimaryButton'
import Divider from '@/components/ui/Divider'
import type { SajuResult } from '@/game/saju/manseryeok'
import { elementScoreToPercent } from '@/game/saju/manseryeok'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// 카피 (리라 스펙 §3 오행별 5종)
// ────────────────────────────────────────────────────
const HUMOR_COPY: Record<FiveElement, string> = {
  木: '자라나는 기운이 넘칩니다. 적도 나무처럼 자라나기 전에 쳐야 합니다.',
  火: '화기왕성(火氣旺盛). 일단 불부터 지르고 생각하는 타입.',
  土: '토기충만(土氣充滿). 안 죽는 게 특기. 상대가 지칠 때까지 버팁니다.',
  金: '금기정예(金氣精銳). 말수는 적지만 칼은 빠릅니다. 카드 값도 비쌉니다.',
  水: '수기심연(水氣深淵). 언제 움직이는지 아무도 모릅니다. 본인도 가끔 모름.',
}

const DESC_COPY: Record<FiveElement, string> = {
  木: '木의 기운은 확장과 성장. 드로우와 버프로 판을 키우는 컨트롤 스타일.',
  火: '火의 기운은 속도와 파괴. 돌진과 직접 딜로 적을 압도하는 어그로 스타일.',
  土: '土의 기운은 안정과 인내. 도발과 회복으로 버티는 탱킹 스타일.',
  金: '金의 기운은 정밀과 제거. 적을 카운터치는 미드레인지 스타일.',
  水: '水의 기운은 유연과 연쇄. 콤보와 유틸로 상황을 만드는 기믹 스타일.',
}

const ELEMENT_NAMES: Record<FiveElement, string> = {
  木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물',
}

const ELEMENT_ORDER: FiveElement[] = ['木', '火', '土', '金', '水']

// ────────────────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────────────────
interface OnboardingScreen2Props {
  sajuResult: SajuResult
  onNext: () => void
  onBack?: () => void
}

export default function OnboardingScreen2({ sajuResult, onNext }: OnboardingScreen2Props): React.ReactElement {
  const { primaryElement, elementScore, isTied, tiedElements, dayElement } = sajuResult
  const display = ELEMENT_DISPLAY[primaryElement]
  const percentMap = elementScoreToPercent(elementScore)

  // 진입 애니메이션 단계
  const [animStep, setAnimStep] = useState(0)

  useEffect(() => {
    const timings = [100, 500, 900, 1200]
    const timers = timings.map((delay, i) =>
      setTimeout(() => setAnimStep(i + 1), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  // 바 차트 너비 (진입 후 표시)
  const barsVisible = animStep >= 4

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0D0B08',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* TopBar — 진행 점 표시 (화면 2: ● ○ ○) */}
      <div
        style={{
          height: '56px',
          borderBottom: '1px solid rgba(232,200,74,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <div
          role="group"
          aria-label="온보딩 1/3 단계"
          style={{ display: 'flex', gap: '6px' }}
        >
          {[true, false, false].map((done, i) => (
            <div
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: done ? '#E8C84A' : 'rgba(232,200,74,0.2)',
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
          paddingBottom: 'calc(32px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {/* ElementReveal */}
        <div
          style={{
            marginTop: '32px',
            textAlign: 'center',
            minHeight: '120px',
          }}
        >
          <div
            style={{
              fontSize: '80px',
              lineHeight: 1,
              opacity: animStep >= 1 ? 1 : 0,
              transform: animStep >= 1 ? 'scale(1)' : 'scale(0.5)',
              transition: 'opacity 300ms ease-out, transform 500ms ease-out',
            }}
            aria-hidden="true"
          >
            {display.icon}
          </div>
          <div
            style={{
              fontFamily: 'Noto Serif KR, serif',
              fontWeight: 700,
              fontSize: '64px',
              color: display.color,
              lineHeight: 1,
              marginTop: '8px',
              opacity: animStep >= 2 ? 1 : 0,
              transform: animStep >= 2 ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 400ms ease-out, transform 400ms ease-out',
            }}
          >
            {primaryElement}
          </div>
        </div>

        {/* RevealCopy */}
        <div
          style={{
            marginTop: '16px',
            textAlign: 'center',
            opacity: animStep >= 3 ? 1 : 0,
            transition: 'opacity 300ms ease-out',
          }}
        >
          {/* W4 약식 사주 명시 */}
          <p
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              color: '#6B5F52',
              letterSpacing: '0.05em',
              margin: '0 0 8px',
            }}
          >
            약식 사주(생년월일 기준)
          </p>

          <p
            style={{
              fontFamily: 'Noto Serif KR, serif',
              fontSize: '16px',
              color: '#E8E0D0',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            당신의 운명의 기운은...{' '}
            <span style={{ color: display.color }}>
              {display.icon} {primaryElement} {display.label.split(' ')[1]} ({ELEMENT_NAMES[primaryElement]})
            </span>
            !
          </p>

          {isTied && (
            <p
              style={{
                fontFamily: 'Noto Sans KR, sans-serif',
                fontSize: '12px',
                color: '#6B5F52',
                margin: '6px 0 0',
              }}
            >
              두 기운이 팽팽합니다 ({tiedElements.map(e => `${ELEMENT_DISPLAY[e].icon} ${e}`).join(', ')}).
              일간 기준으로 {ELEMENT_DISPLAY[dayElement].icon} {dayElement}으로 판정했습니다. 사주도 우유부단할 수 있습니다.
            </p>
          )}

          <p
            style={{
              fontFamily: 'Noto Sans KR, sans-serif',
              fontSize: '13px',
              fontStyle: 'italic',
              color: '#A89880',
              margin: '8px 0 0',
            }}
          >
            {HUMOR_COPY[primaryElement]}
          </p>
        </div>

        <Divider className="mt-7" />

        {/* DistributionChart */}
        <div
          style={{
            marginTop: '20px',
            opacity: animStep >= 4 ? 1 : 0,
            transition: 'opacity 300ms ease-out',
          }}
        >
          <p
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: '#6B5F52',
              margin: '0 0 12px',
            }}
          >
            오행 분포
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ELEMENT_ORDER.map((el, idx) => {
              const elDisplay = ELEMENT_DISPLAY[el]
              const pct = percentMap[el]
              const isPrimary = el === primaryElement

              return (
                <div
                  key={el}
                  role="row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '36px',
                    gap: '8px',
                  }}
                >
                  {/* 오행 레이블 */}
                  <span
                    role="cell"
                    style={{
                      width: '64px',
                      fontFamily: 'Noto Sans KR, sans-serif',
                      fontSize: '12px',
                      color: '#A89880',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {elDisplay.icon} {el}{elDisplay.label.split(' ')[1]}
                  </span>

                  {/* 바 트랙 */}
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${el} ${pct}%`}
                    style={{
                      flex: 1,
                      height: '8px',
                      background: '#1A1714',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      border: isPrimary ? '1px solid rgba(232,200,74,0.45)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: barsVisible ? `${pct}%` : '0%',
                        background: elDisplay.color,
                        borderRadius: '4px',
                        transition: `width 0.6s ease-out ${idx * 100}ms`,
                      }}
                    />
                  </div>

                  {/* 비율 */}
                  <span
                    role="cell"
                    style={{
                      width: '44px',
                      textAlign: 'right',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      color: '#6B5F52',
                      flexShrink: 0,
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <Divider className="mt-5" />

        {/* 오행 성향 설명 */}
        <p
          style={{
            fontFamily: 'Noto Serif KR, serif',
            fontStyle: 'italic',
            fontSize: '14px',
            color: '#A89880',
            lineHeight: 1.6,
            margin: '16px 0 0',
            opacity: animStep >= 4 ? 1 : 0,
            transition: 'opacity 300ms ease-out 200ms',
          }}
        >
          {DESC_COPY[primaryElement]}
        </p>

        {/* CTA */}
        <div style={{ marginTop: '28px' }}>
          <PrimaryButton onClick={onNext}>
            내 영웅 확인하기 →
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
