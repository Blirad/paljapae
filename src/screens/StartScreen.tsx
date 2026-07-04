/**
 * StartScreen — 재방문 시작 화면 (M5 신규)
 * 리라 M5 스펙 §2 기준
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
      ? '#3D7A3A'
      : ratio > 0.3
      ? '#C07A1A'
      : '#C0392B'

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
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        {/* 바 */}
        <div style={{
          width: `${ratio * 100}%`,
          height: '100%',
          background: hpColor,
          borderRadius: 3,
          transition: 'width 0.4s ease-out, background-color 0.5s',
        }} />
      </div>
      <div style={{
        marginTop: 4,
        fontFamily: 'DM Mono, monospace',
        fontSize: 11,
        color: '#A89880',
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
        background: 'rgba(0,0,0,0.7)',
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
          background: '#141210',
          border: '1px solid rgba(232,200,74,0.12)',
          borderRadius: 12,
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
            fontFamily: 'Noto Serif KR, serif',
            fontWeight: 700,
            fontSize: 18,
            color: '#E8E0D0',
            marginBottom: 12,
          }}
        >
          정말 새로 시작하시겠습니까?
        </h2>
        <p style={{
          fontFamily: 'Noto Sans KR, sans-serif',
          fontSize: 14,
          color: '#A89880',
          lineHeight: 1.6,
          marginBottom: 20,
        }}>
          기존 진행 데이터가 모두 삭제됩니다.<br />
          (덱, 언락 카드, 진행 기록)
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <SecondaryButton
            onClick={onCancel}
            style={{ flex: 1, height: 44, fontSize: 14 } as React.CSSProperties}
          >
            취소
          </SecondaryButton>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 8,
              border: 'none',
              background: '#C0392B',
              color: '#FFFFFF',
              fontFamily: 'Noto Sans KR, sans-serif',
              fontWeight: 700,
              fontSize: 14,
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
    // 저장 데이터 로드
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
        unlockedCount: Math.max(0, ownedIds.length - 20), // 시작 덱 20장 제외
        savedAt: savedAt ?? Date.now(),
      })
    }

    // 진입 애니메이션 트리거
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
      background: '#0D0B08',
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
        borderBottom: '1px solid rgba(232,200,74,0.12)',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 14,
          color: '#E8C84A',
          fontWeight: 700,
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
        <div style={{
          marginTop: 48,
          textAlign: 'center',
          animation: 'slideUp 0.4s ease-out',
        }}>
          <div style={{
            fontFamily: 'Noto Serif KR, serif',
            fontWeight: 700,
            fontSize: 32,
            color: '#E8C84A',
          }}>
            ⚔ 八字牌
          </div>
          <div style={{
            fontFamily: 'Noto Serif KR, serif',
            fontWeight: 400,
            fontSize: 14,
            color: '#A89880',
            marginTop: 6,
          }}>
            운명을 들고 싸워라
          </div>
        </div>

        {/* 저장 상태 섹션 */}
        {saveInfo && elementInfo && (
          <>
            {/* 섹션 레이블 */}
            <div style={{
              marginTop: 32,
              fontFamily: 'DM Mono, monospace',
              fontSize: 11,
              color: '#6B5F52',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              animation: 'slideUp 0.4s ease-out 0.1s both',
            }}>
              저장된 게임
            </div>

            {/* SaveStateCard */}
            <div style={{
              marginTop: 12,
              background: '#1A1714',
              border: '1px solid rgba(232,200,74,0.45)',
              borderRadius: 12,
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
                    fontFamily: 'Noto Serif KR, serif',
                    fontWeight: 700,
                    fontSize: 16,
                    color: '#E8E0D0',
                  }}>
                    {saveInfo.heroName}
                  </div>
                  <div style={{
                    fontFamily: 'Noto Sans KR, sans-serif',
                    fontSize: 13,
                    color: '#A89880',
                    marginTop: 2,
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
                fontFamily: 'Noto Sans KR, sans-serif',
                fontSize: 13,
                color: '#A89880',
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
                fontFamily: 'DM Mono, monospace',
                fontSize: 10,
                color: '#6B5F52',
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
            style={{ width: '100%', height: 48, fontSize: 15 } as React.CSSProperties}
          >
            새 게임 시작
          </SecondaryButton>
        </div>

        {/* 하단 팁 */}
        <div style={{
          marginTop: 24,
          textAlign: 'center',
          fontFamily: 'Noto Sans KR, sans-serif',
          fontStyle: 'italic',
          fontSize: 12,
          color: '#6B5F52',
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
