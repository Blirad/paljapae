/**
 * StartScreen — 재방문 시작 화면 (M5 신규)
 * 리라 M5 스펙 §2 기준
 * Momentor 디자인 시스템 전면 적용 (2026-07-05)
 *
 * 진입 조건: localStorage에 저장 데이터 있을 때만 표시
 * 분기:
 *   이어하기 → WorldMapScreen
 *   새 게임 시작 → 확인 모달 → OnboardingFlow
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
  relativeTime,
  clearAllProgress,
} from '@/utils/persistence'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SecondaryButton from '@/components/ui/SecondaryButton'

// ────────────────────────────────────────────────────
// HeroHpBar
// ────────────────────────────────────────────────────

interface HeroHpBarProps {
  current: number
  max: number
  heroName: string
}

function HeroHpBar({ current, max, heroName }: HeroHpBarProps): React.ReactElement {
  const ratio = max > 0 ? current / max : 0
  const hpColor =
    ratio > 0.6
      ? 'var(--gold)'
      : ratio > 0.3
      ? 'var(--el-earth)'
      : 'var(--el-fire)'

  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${heroName} HP ${current}/${max}`}
      style={{ width: '100%' }}
    >
      {/* 트랙 */}
      <div style={{
        width: '100%',
        height: 6,
        background: 'var(--border)',
        overflow: 'hidden',
      }}>
        {/* 바 */}
        <div style={{
          width: `${ratio * 100}%`,
          height: '100%',
          background: hpColor,
          transition: 'width 0.4s ease-out, background-color 0.5s',
        }} />
      </div>
      <div style={{
        marginTop: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)',
        textAlign: 'right',
      }}>
        {current}/{max}
      </div>
    </div>
  )
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
            marginBottom: 12,
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
          marginBottom: 20,
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
// StartScreen 저장 데이터 타입
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
// StartScreen 메인
// ────────────────────────────────────────────────────

interface StartScreenProps {
  onContinue: () => void
  onNewGame: () => void
}

export default function StartScreen({ onContinue, onNewGame }: StartScreenProps): React.ReactElement {
  const [showConfirm, setShowConfirm] = useState(false)
  const [saveInfo, setSaveInfo] = useState<SaveInfo | null>(null)
  const [mounted, setMounted] = useState(false)

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

  const elementInfo = saveInfo ? ELEMENT_DISPLAY[saveInfo.element] : null

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
      {/* TopBar */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 20,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* 골드 divider 라인 */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 1,
          top: 56,
          background: 'linear-gradient(90deg, transparent, var(--gold-primary), transparent)',
          opacity: 0.3,
        }} />
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--gold)',
          letterSpacing: '0.05em',
        }}>
          팔자패
        </span>
      </header>

      {/* 스크롤 컨테이너 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 24px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
      }}>
        {/* 타이틀 영역 */}
        <div className="pj-certificate-frame" style={{
          marginTop: 48,
          textAlign: 'center',
          animation: 'slideUp 0.4s ease-out',
          padding: '24px 16px',
        }}>
          {/* 인장 엠블럼 */}
          <div style={{
            width: 56,
            height: 56,
            margin: '0 auto 16px',
            border: '1px solid var(--border-gold)',
            background: 'var(--surface)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}>
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 22,
              color: 'var(--gold)',
              lineHeight: 1,
            }}>牌</span>
          </div>

          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 46,
            color: 'var(--text-headline)',
            letterSpacing: '0.05em',
          }}>
            八字牌
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 8,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            운명을 들고 싸워라
          </div>
        </div>

        {/* 골드 구분선 */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--border-gold), transparent)',
          margin: '24px 0',
        }} />

        {/* 저장 상태 섹션 */}
        {saveInfo && elementInfo && (
          <>
            {/* 섹션 레이블 */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              animation: 'slideUp 0.4s ease-out 0.1s both',
            }}>
              저장된 게임
            </div>

            {/* SaveStateCard */}
            <div style={{
              marginTop: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border-gold)',
              padding: 16,
              animation: 'slideUp 0.4s ease-out 0.1s both',
            }}>
              {/* 헤더: 오행 아이콘 + 영웅명 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  fontSize: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {elementInfo.icon}
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: 16,
                    color: 'var(--text-headline)',
                  }}>
                    {saveInfo.heroName}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    marginTop: 2,
                    letterSpacing: '0.05em',
                  }}>
                    {elementInfo.icon} {saveInfo.element} 덱
                  </div>
                </div>
              </div>

              {/* HP 바 */}
              <div style={{ marginTop: 12 }}>
                <HeroHpBar
                  current={saveInfo.hp}
                  max={saveInfo.maxHp}
                  heroName={saveInfo.heroName}
                />
              </div>

              {/* 진행 상세 */}
              <div style={{
                marginTop: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                <div>스테이지: {saveInfo.clearedCount}/7 진행 중</div>
                <div>덱: {saveInfo.deckSize}장 ({saveInfo.unlockedCount}장 언락)</div>
              </div>

              {/* 저장 시간 */}
              <div style={{
                marginTop: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
              }}>
                마지막 저장: {relativeTime(saveInfo.savedAt)}
              </div>
            </div>
          </>
        )}

        {/* 버튼 영역 */}
        <div style={{
          marginTop: 24,
          animation: 'slideUp 0.4s ease-out 0.2s both',
        }}>
          <PrimaryButton onClick={onContinue}>
            이어하기 →
          </PrimaryButton>
        </div>

        <div style={{
          marginTop: 12,
          animation: 'slideUp 0.4s ease-out 0.2s both',
        }}>
          <SecondaryButton
            onClick={() => setShowConfirm(true)}
            className="w-full"
            style={{ width: '100%', height: 48, fontSize: 13 } as React.CSSProperties}
          >
            새 게임 시작
          </SecondaryButton>
        </div>

        {/* 하단 팁 */}
        <div style={{
          marginTop: 24,
          textAlign: 'center',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          "운명은 바꿀 수 없다. 하지만 덱은 편집할 수 있다."
        </div>
      </div>

      {/* 새 게임 확인 모달 */}
      {showConfirm && (
        <NewGameConfirmModal
          onConfirm={handleConfirmNewGame}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
