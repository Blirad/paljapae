/**
 * StartScreen — 게임 로비 (Phase A 전면 개편)
 * 리라 스펙 LYRA_GAMEFLOW_PHASE_A_20260708.md §A-2
 *
 * 단순 메뉴 → 영웅 프로필 + 4버튼 그리드 + 일일 운세
 * 기존 props (onContinue, onNewGame, onDeckBuild) 유지
 * 신규 prop: onDailyDraw
 */

import React, { useState, useEffect } from 'react'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'
import {
  loadPlayerElement,
  loadHeroState,
  loadSaveTimestamp,
  loadClearedStageIds,
  loadOwnedCardIds,
  clearAllProgress,
} from '@/utils/persistence'
import { useUnlockStore } from '@/stores/unlockStore'
import { calculateSaju } from '@/game/saju/manseryeok'
import CardArtSVG from '@/components/battle/CardArtSVG'
import SecondaryButton from '@/components/ui/SecondaryButton'

// ────────────────────────────────────────────────────
// hexToRgb 유틸
// ────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

// ────────────────────────────────────────────────────
// 오행 → 영웅 실루엣 키워드 매핑
// ────────────────────────────────────────────────────

const ELEMENT_TO_HERO_KEYWORDS: Record<FiveElement, string[]> = {
  '火': ['rush'],
  '水': ['freeze'],
  '木': ['lifesteal'],
  '金': ['pierce'],
  '土': ['taunt'],
}

// ────────────────────────────────────────────────────
// NewGameConfirmModal
// ────────────────────────────────────────────────────

interface NewGameConfirmModalProps {
  onConfirm: () => void
  onCancel: () => void
}

function NewGameConfirmModal({ onConfirm, onCancel }: NewGameConfirmModalProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-game-dialog-title"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          padding: 24,
          margin: '0 24px',
          maxWidth: 327,
          width: '100%',
          animation: 'slideUp 0.25s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          id="new-game-dialog-title"
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 18,
            color: 'var(--text-headline)',
            margin: '0 0 12px',
          }}
        >
          정말 새로 시작하시겠습니까?
        </h2>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: '0 0 20px',
        }}>
          기존 진행 데이터가 모두 삭제됩니다.<br />
          (덱, 언락 카드, 진행 기록)
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <SecondaryButton
            onClick={onCancel}
            style={{ flex: 1, height: 44, fontSize: 13 } as React.CSSProperties}
          >
            취소
          </SecondaryButton>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 44,
              border: '1px solid var(--el-fire)',
              background: 'transparent',
              color: 'var(--el-fire)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            새로 시작하기
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// HeroProfileCard
// ────────────────────────────────────────────────────

interface HeroProfileCardProps {
  element: FiveElement
  heroName: string
  ownedCardCount: number
  highestStage: number | null
}

function HeroProfileCard({ element, heroName, ownedCardCount, highestStage }: HeroProfileCardProps): React.ReactElement {
  const display = ELEMENT_DISPLAY[element]

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-gold)',
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: `inset 3px 0 0 ${display.color}, 0 0 20px rgba(${hexToRgb(display.color)}, 0.1)`,
    }}>
      {/* 영웅 SVG 아트 */}
      <div style={{
        width: 64,
        height: 58,
        flexShrink: 0,
        borderRadius: 4,
        overflow: 'hidden',
        background: display.gradient,
      }}>
        <CardArtSVG
          element={element}
          rarity="common"
          size="mini"
          cardType="soldier"
          keywords={ELEMENT_TO_HERO_KEYWORDS[element]}
        />
      </div>

      {/* 정보 영역 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 16,
          color: 'var(--text-headline)',
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {heroName}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: display.color,
          marginBottom: 8,
        }}>
          내 천명: {element} {display.icon}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: 16,
        }}>
          <span>보유 카드: {ownedCardCount}장</span>
          <span>최고 스테이지: {highestStage !== null ? highestStage : '-'}</span>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// LobbyButton
// ────────────────────────────────────────────────────

interface LobbyButtonProps {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  accentColor?: string
}

function LobbyButton({ icon, label, onClick, disabled = false, accentColor }: LobbyButtonProps): React.ReactElement {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px 8px',
        background: 'var(--surface)',
        border: `1px solid ${disabled ? 'var(--border)' : (accentColor ?? 'var(--border-subtle)')}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 0.15s, border-color 0.15s',
        width: '100%',
        minHeight: 72,
        fontFamily: 'var(--font-serif)',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
      }}
      onMouseLeave={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        letterSpacing: '0.05em',
      }}>
        {label}
      </span>
    </button>
  )
}

// ────────────────────────────────────────────────────
// DailyFortuneBar
// ────────────────────────────────────────────────────

function DailyFortuneBar(): React.ReactElement {
  let fortuneText = '오늘의 기운을 불러오는 중...'
  let fortuneColor = 'var(--text-muted)'

  try {
    const today = new Date()
    const result = calculateSaju(today.getFullYear(), today.getMonth() + 1, today.getDate())
    const el = result.primaryElement
    const display = ELEMENT_DISPLAY[el]
    fortuneText = `오늘은 ${el}의 날 — ${el} 카드가 강해집니다.`
    fortuneColor = display.color
  } catch {
    fortuneText = '오늘의 운세를 불러올 수 없습니다.'
  }

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: '1px solid var(--border)',
      background: 'rgba(0,0,0,0.2)',
    }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 13,
        color: fortuneColor,
        textAlign: 'center',
        lineHeight: 1.5,
      }}>
        {fortuneText}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// SaveInfo 타입 (기존 유지)
// ────────────────────────────────────────────────────

interface SaveInfo {
  element: FiveElement
  heroName: string
  hp: number
  maxHp: number
  clearedCount: number
  deckSize: number
  unlockedCount: number
  savedAt: number
}

// ────────────────────────────────────────────────────
// StartScreen Props
// ────────────────────────────────────────────────────

interface StartScreenProps {
  onContinue: () => void    // 새 런 시작 → handleContinue
  onNewGame: () => void     // 새 게임 → Onboarding
  onDeckBuild?: () => void  // 덱 빌드
  onDailyDraw?: () => void  // 일일 뽑기 (Phase A 신규)
}

// ────────────────────────────────────────────────────
// StartScreen 메인
// ────────────────────────────────────────────────────

export default function StartScreen({
  onContinue,
  onNewGame,
  onDeckBuild,
  onDailyDraw,
}: StartScreenProps): React.ReactElement {
  const [showConfirm, setShowConfirm] = useState(false)
  const [saveInfo, setSaveInfo] = useState<SaveInfo | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showSettingsToast, setShowSettingsToast] = useState(false)

  // unlockStore에서 보유 카드 수 실시간 조회
  const ownedCardCount = useUnlockStore(s => s.ownedCardIds.size)

  useEffect(() => {
    const element = loadPlayerElement()
    const hero = loadHeroState()
    const savedAt = loadSaveTimestamp()
    const clearedIds = loadClearedStageIds()
    const ownedIds = loadOwnedCardIds()

    if (element && hero) {
      setSaveInfo({
        element,
        heroName: hero.name,
        hp: hero.hp,
        maxHp: hero.maxHp,
        clearedCount: clearedIds.length,
        deckSize: ownedIds.length,
        unlockedCount: Math.max(0, ownedIds.length - 20),
        savedAt: savedAt ?? Date.now(),
      })
    }

    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  function handleConfirmNewGame(): void {
    clearAllProgress()
    setShowConfirm(false)
    onNewGame()
  }

  function handleSettingsTap(): void {
    setShowSettingsToast(true)
    setTimeout(() => setShowSettingsToast(false), 3000)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
      opacity: mounted ? 1 : 0,
      transition: 'opacity 0.3s ease-out',
    }}>

      {/* ── TopBar ── */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 16,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--gold)',
          letterSpacing: '0.05em',
        }}>
          팔자패
        </span>
        <button
          onClick={handleSettingsTap}
          aria-label="설정"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            color: 'var(--text-muted)',
            padding: 8,
          }}
        >
          ⚙
        </button>
      </header>

      {/* ── 스크롤 컨테이너 ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>

        {/* 영웅 프로필 카드 (saveInfo 있을 때만) */}
        {saveInfo && (
          <div style={{ animation: 'slideUp 0.4s ease-out 0.1s both' }}>
            <HeroProfileCard
              element={saveInfo.element}
              heroName={saveInfo.heroName}
              ownedCardCount={ownedCardCount}
              highestStage={saveInfo.clearedCount > 0 ? saveInfo.clearedCount : null}
            />
          </div>
        )}

        {/* 4버튼 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          animation: 'slideUp 0.4s ease-out 0.2s both',
        }}>
          <LobbyButton
            icon="🗡"
            label={saveInfo ? '새 런 시작' : '새 게임 시작'}
            onClick={onContinue}
          />
          <LobbyButton
            icon="📦"
            label="컬렉션"
            onClick={() => {}}
            disabled={true}
          />
          <LobbyButton
            icon="🃏"
            label="덱 빌드"
            onClick={onDeckBuild ?? (() => {})}
            disabled={!onDeckBuild}
          />
          <LobbyButton
            icon="📅"
            label="일일 뽑기"
            onClick={onDailyDraw ?? (() => {})}
            disabled={!onDailyDraw}
          />
        </div>

        {/* 새 게임 시작 (소형 보조 버튼) */}
        <div style={{ animation: 'slideUp 0.4s ease-out 0.3s both' }}>
          <SecondaryButton
            onClick={() => setShowConfirm(true)}
            style={{ width: '100%', height: 40, fontSize: 12 } as React.CSSProperties}
          >
            새 게임 시작
          </SecondaryButton>
        </div>

      </div>

      {/* ── 일일 운세 배너 ── */}
      <div style={{ animation: 'slideUp 0.4s ease-out 0.35s both', flexShrink: 0 }}>
        <DailyFortuneBar />
      </div>

      {/* ── 새 게임 확인 모달 ── */}
      {showConfirm && (
        <NewGameConfirmModal
          onConfirm={handleConfirmNewGame}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* ── 설정 toast (Phase A: 미구현 안내) ── */}
      {showSettingsToast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(26,23,20,0.92)',
          border: '1px solid var(--border-subtle)',
          padding: '10px 20px',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          zIndex: 200,
          whiteSpace: 'nowrap',
          animation: 'slideUp 0.2s ease-out',
        }}>
          설정은 곧 오픈됩니다
        </div>
      )}

    </div>
  )
}
