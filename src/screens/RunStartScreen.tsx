/**
 * RunStartScreen — 난이도 선택 화면 (M8 P0-2 신규)
 * 리라 M8 스펙 P0-2 와이어프레임 기반
 *
 * 흐름:
 *   StartScreen 또는 온보딩 완료 → RunStartScreen → WorldMapScreen
 *   취소 → StartScreen 복귀
 */

import React, { useState, useEffect } from 'react'
import type { ChallengeMode } from '@/types/challengeMode'
import {
  CHALLENGE_DISPLAY_NAME,
  CHALLENGE_DESCRIPTION,
  CHALLENGE_SUBTITLE,
  isMaxChallenge,
} from '@/types/challengeMode'
import { useChallengeStore } from '@/stores/challengeStore'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SecondaryButton from '@/components/ui/SecondaryButton'

// ────────────────────────────────────────────────────
// 챌린지 목록 순서
// ────────────────────────────────────────────────────

const CHALLENGE_LIST: ChallengeMode[] = [
  'normal',
  'challenge1',
  'challenge2',
  'challenge3',
  'challenge4',
  'challenge5',
]

// ────────────────────────────────────────────────────
// 챌린지 펄스 스타일 주입
// ────────────────────────────────────────────────────

const STYLE_ID = 'run-start-screen-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes ch5StarPulse {
      0%   { transform: scale(1);    opacity: 1; }
      50%  { transform: scale(1.4);  opacity: 0.7; }
      100% { transform: scale(1);    opacity: 1; }
    }
    .ch5-star-pulse {
      animation: ch5StarPulse 0.4s ease-out 1;
    }
    @keyframes runStartFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `
  document.head.appendChild(style)
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface RunStartScreenProps {
  heroName: string
  heroElement: string
  onStart: (mode: ChallengeMode) => void
  onCancel: () => void
}

// ────────────────────────────────────────────────────
// ChallengeRadioRow — 개별 난이도 행
// ────────────────────────────────────────────────────

interface ChallengeRadioRowProps {
  mode: ChallengeMode
  isSelected: boolean
  onSelect: () => void
  ch5StarPulseActive: boolean
}

function ChallengeRadioRow({
  mode,
  isSelected,
  onSelect,
  ch5StarPulseActive,
}: ChallengeRadioRowProps): React.ReactElement {
  const isMax = isMaxChallenge(mode)
  const displayName = CHALLENGE_DISPLAY_NAME[mode]
  const description = CHALLENGE_DESCRIPTION[mode]
  const subtitle = CHALLENGE_SUBTITLE[mode]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`난이도 선택: ${displayName}`}
      style={{
        width: '100%',
        minHeight: 60,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: isSelected
          ? 'rgba(201,168,76,0.08)'
          : 'transparent',
        borderLeft: isSelected
          ? isMax
            ? '3px solid var(--accent-red)'
            : '3px solid var(--gold)'
          : '3px solid transparent',
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: isSelected
          ? 'none'
          : '1px solid var(--border)',
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.05)'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }
      }}
    >
      {/* 라디오 인디케이터 */}
      <div style={{
        width: 16,
        height: 16,
        border: isSelected
          ? isMax
            ? '2px solid var(--accent-red)'
            : '2px solid var(--gold)'
          : '2px solid var(--border)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'border-color 0.15s',
      }}>
        {isSelected && (
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isMax ? 'var(--accent-red)' : 'var(--gold)',
          }} />
        )}
      </div>

      {/* 텍스트 영역 */}
      <div style={{ flex: 1, minWidth: 0, padding: '10px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Challenge 5 별 아이콘 */}
          {isMax && (
            <span
              className={ch5StarPulseActive ? 'ch5-star-pulse' : ''}
              aria-hidden="true"
              style={{
                fontSize: 13,
                color: 'var(--accent-red)',
                flexShrink: 0,
              }}
            >
              ★
            </span>
          )}
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 16,
            fontWeight: 600,
            color: isMax
              ? 'var(--accent-red)'
              : isSelected
              ? 'var(--text-headline)'
              : 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {displayName}
          </span>
          {subtitle && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}>
              {subtitle}
            </span>
          )}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 2,
          lineHeight: 1.4,
        }}>
          {description}
        </div>
      </div>
    </button>
  )
}

// ────────────────────────────────────────────────────
// SelectedModeSummary — 선택 모드 요약 패널
// ────────────────────────────────────────────────────

function SelectedModeSummary({ mode }: { mode: ChallengeMode }): React.ReactElement {
  const isMax = isMaxChallenge(mode)

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isMax ? 'var(--accent-red)' : 'var(--border-gold)'}`,
      padding: '12px 16px',
      marginTop: 16,
      animation: 'runStartFadeIn 0.2s ease-out',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: isMax ? 'var(--accent-red)' : 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 6,
      }}>
        선택된 모드
      </div>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 14,
        color: isMax ? 'var(--accent-red)' : 'var(--text-headline)',
        marginBottom: 4,
      }}>
        {CHALLENGE_DISPLAY_NAME[mode]}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        {CHALLENGE_DESCRIPTION[mode]}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// RunStartScreen 메인
// ────────────────────────────────────────────────────

export default function RunStartScreen({
  heroName,
  heroElement,
  onStart,
  onCancel,
}: RunStartScreenProps): React.ReactElement {
  const { mode, setMode } = useChallengeStore()
  const [mounted, setMounted] = useState(false)
  const [ch5StarPulseActive, setCh5StarPulseActive] = useState(false)
  const [hasCh5BeenVisited, setHasCh5BeenVisited] = useState(false)

  useEffect(() => {
    injectStyles()
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  function handleModeSelect(selectedMode: ChallengeMode) {
    setMode(selectedMode)
    // Challenge 5 첫 진입 시 별 펄스 애니메이션 1회
    if (isMaxChallenge(selectedMode) && !hasCh5BeenVisited) {
      setHasCh5BeenVisited(true)
      setCh5StarPulseActive(true)
      setTimeout(() => setCh5StarPulseActive(false), 400)
    }
  }

  function handleStart() {
    onStart(mode)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
      opacity: mounted ? 1 : 0,
      transition: 'opacity 0.25s ease-out',
    }}>
      {/* TopBar */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 20,
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg2)',
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--gold)',
          letterSpacing: '0.05em',
        }}>
          팔자패 (八字牌)
        </span>
      </header>

      {/* 스크롤 영역 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 24px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}>
        {/* 영웅 정보 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 16,
          color: 'var(--text-headline)',
          marginBottom: 4,
        }}>
          영웅: {heroName}
          {heroElement && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
              marginLeft: 8,
              fontStyle: 'normal',
            }}>
              ({heroElement})
            </span>
          )}
        </div>

        {/* 구분선 */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, var(--border-gold), transparent)',
          marginBottom: 24,
        }} />

        {/* 섹션 제목 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          난이도 선택
        </div>

        {/* 챌린지 목록 */}
        <div style={{
          border: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          {CHALLENGE_LIST.map((m) => (
            <ChallengeRadioRow
              key={m}
              mode={m}
              isSelected={mode === m}
              onSelect={() => handleModeSelect(m)}
              ch5StarPulseActive={ch5StarPulseActive && isMaxChallenge(m)}
            />
          ))}
        </div>

        {/* 선택 모드 요약 패널 */}
        <SelectedModeSummary mode={mode} />

        {/* 버튼 영역 */}
        <div style={{
          marginTop: 28,
          display: 'flex',
          gap: 12,
          flexDirection: 'column',
        }}>
          <PrimaryButton onClick={handleStart}>
            게임 시작
          </PrimaryButton>
          <SecondaryButton
            onClick={onCancel}
            style={{ width: '100%', height: 48, fontSize: 14 } as React.CSSProperties}
          >
            취소
          </SecondaryButton>
        </div>

        {/* 챌린지 5 경고 문구 */}
        {isMaxChallenge(mode) && (
          <div style={{
            marginTop: 16,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--accent-red)',
            opacity: 0.8,
            animation: 'runStartFadeIn 0.3s ease-out',
          }}>
            ★ 황천지옥: 모든 제약이 동시에 적용됩니다. 최고 난이도.
          </div>
        )}
      </div>
    </div>
  )
}
