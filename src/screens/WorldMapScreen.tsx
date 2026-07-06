/**
 * WorldMapScreen — M7 리팩터링
 * 리라 M4 스펙 §2 + M5 스펙 §3 + M7 P3/P4 기준
 *
 * 구성:
 *   TopBar (팔자패 워드마크)
 *   RunSummaryBar (P4: HeroStatusBar 대체 + StatRow)
 *   RelicBar (P3: 유물 표시)
 *   RegionRow 2×2 그리드
 *   StageDetailPopup (bottom sheet)
 *   AdvantageNote 상성 안내
 *   pulseGlow 애니메이션 (available 노드)
 */

import React, { useState, useRef, useEffect } from 'react'
import type { Stage } from '@/data/stages'
import { ALL_STAGES } from '@/data/stages'
import { useStageStore } from '@/stores/stageStore'
import { useUnlockStore } from '@/stores/unlockStore'
import { useRelicStore } from '@/stores/relicStore'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'
import { getAdvantageRelation, getAdvantageText } from '@/utils/advantage'
import RelicDetailModal from '@/components/ui/RelicDetailModal'

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface WorldMapScreenProps {
  onStartBattle: (stageId: number) => void
  onUpgrade: () => void
  upgradeNodeCleared: boolean
  playerElement: FiveElement
  heroName: string
  heroHp: number
  heroMaxHp: number
  // P2: 이벤트 노드
  onEvent: () => void
  eventNodeCleared: boolean
  // P2-B: 상점 노드
  onShop: () => void
  shopNodeCleared: boolean
  gold: number
}

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

  // P0-B: HP 하락 시 shake 1회
  const prevHpRef = useRef<number>(current)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (current < prevHpRef.current) {
      setShaking(true)
      const t = setTimeout(() => setShaking(false), 300)
      prevHpRef.current = current
      return () => clearTimeout(t)
    }
    prevHpRef.current = current
  }, [current])

  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${heroName} HP ${current}/${max}`}
      style={{
        width: '100%',
        animation: shaking ? 'shake 0.3s ease-out' : 'none',
      }}
    >
      <div style={{
        width: '100%',
        height: 6,
        background: 'var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${ratio * 100}%`,
          height: '100%',
          background: hpColor,
          transition: 'width 0.4s ease-out, background-color 0.5s',
        }} />
      </div>
      {/* HP 수치 레이블 (선택 추가) */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)',
        marginTop: 2,
        textAlign: 'right',
      }}>
        {current}/{max}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// AdvantageNote
// ────────────────────────────────────────────────────

function AdvantageNote({ playerEl, aiEl }: { playerEl: FiveElement; aiEl: FiveElement }): React.ReactElement {
  const result = getAdvantageRelation(playerEl, aiEl)
  const text = getAdvantageText(playerEl, aiEl)

  const styles: React.CSSProperties =
    result === 'advantage'
      ? { color: 'var(--gold)', background: 'rgba(201,168,76,0.08)', fontWeight: 700 }
      : result === 'disadvantage'
      ? { color: 'var(--accent-red)', background: 'rgba(139,0,0,0.08)' }
      : { color: 'var(--text-muted)', background: 'var(--bg2)' }

  const prefix = result === 'advantage' ? '⚡ ' : result === 'disadvantage' ? '⚠ ' : ''

  return (
    <div style={{
      ...styles,
      borderRadius: 6,
      padding: '8px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      {prefix}{text}
    </div>
  )
}

// ────────────────────────────────────────────────────
// StarRating
// ────────────────────────────────────────────────────

function StarRating({ difficulty }: { difficulty: 1 | 2 | 3 | 4 }): React.ReactElement {
  return (
    <span>
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            fontSize: 11,
            color: i < difficulty ? 'var(--gold)' : 'var(--border)',
          }}
        >
          {i < difficulty ? '★' : '☆'}
        </span>
      ))}
      <span className="sr-only">난이도 {difficulty}점 / 4점</span>
    </span>
  )
}

// ────────────────────────────────────────────────────
// StageNode
// ────────────────────────────────────────────────────

type StageStatus = 'cleared' | 'available' | 'locked'

function getStageStatus(isCleared: boolean, isUnlocked: boolean): StageStatus {
  if (isCleared) return 'cleared'
  if (isUnlocked) return 'available'
  return 'locked'
}

interface StageNodeProps {
  stage: Stage
  isUnlocked: boolean
  isCleared: boolean
  onSelect: () => void
}

function StageNode({ stage, isUnlocked, isCleared, onSelect }: StageNodeProps): React.ReactElement {
  const status = getStageStatus(isCleared, isUnlocked)
  const elementInfo = stage.element !== 'neutral'
    ? ELEMENT_DISPLAY[stage.element as FiveElement]
    : null
  const isBoss = stage.id === 6

  // 상태별 스타일
  const nodeStyle: React.CSSProperties = (() => {
    switch (status) {
      case 'cleared':
        return {
          background: 'rgba(74,122,69,0.08)',
          border: '1px solid var(--gold)',
        }
      case 'available':
        return isBoss
          ? {
              background: 'rgba(139,0,0,0.08)',
              border: '1px solid var(--el-fire)',
              animation: 'pulseGlowBoss 2s ease-in-out infinite',
            }
          : {
              background: 'var(--surface)',
              border: '1px solid var(--border-gold)',
              animation: 'pulseGlow 2s ease-in-out infinite',
            }
      case 'locked':
        return {
          background: 'rgba(44,44,44,0.04)',
          border: '1px solid var(--border)',
          opacity: 0.65,
          cursor: 'not-allowed',
        }
    }
  })()

  // 보스 노드: 가로 전체
  if (isBoss) {
    return (
      <button
        onClick={isUnlocked ? onSelect : undefined}
        disabled={!isUnlocked}
        aria-label={`최종 보스: ${stage.bossName}${!isUnlocked ? ' (잠김)' : ''}`}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          textAlign: 'left',
          cursor: isUnlocked ? 'pointer' : 'not-allowed',
          ...nodeStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: status === 'available' ? 'var(--el-fire)' : 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            {status !== 'locked' ? '⚠ 최종 보스' : '???'}
          </div>
          <StarRating difficulty={stage.difficulty} />
        </div>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--text-headline)',
          marginTop: 4,
        }}>
          {status === 'locked' ? '???' : stage.bossName}
        </div>
        {status !== 'locked' && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 2,
          }}>
            "{stage.humorHint}"
          </div>
        )}
      </button>
    )
  }

  // 일반 노드
  return (
    <button
      onClick={isUnlocked ? onSelect : undefined}
      disabled={!isUnlocked}
      aria-label={`스테이지 ${stage.id}: ${status === 'locked' ? '잠김' : stage.bossName}`}
      style={{
        width: '100%',
        height: 72,
        padding: '10px 12px',
        borderRadius: 8,
        textAlign: 'left',
        cursor: isUnlocked ? 'pointer' : 'not-allowed',
        ...nodeStyle,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* 상태 아이콘 */}
        <div style={{
          fontSize: 14,
          color: status === 'cleared' ? 'var(--el-wood)' : 'var(--gold)',
          flexShrink: 0,
        }}>
          {status === 'cleared' ? '✓' : status === 'available' ? '▶' : '🔒'}
        </div>

        {/* 오행 아이콘 */}
        <div style={{ fontSize: 14 }}>
          {status !== 'locked' && elementInfo ? elementInfo.icon : '???'}
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-serif)',
        fontWeight: 700,
        fontSize: 13,
        color: status === 'locked' ? 'var(--text-muted)' : 'var(--text-headline)',
        marginTop: 2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {status === 'locked' ? '???' : stage.bossName.split(' ')[0]}
      </div>

      <div style={{ marginTop: 2 }}>
        <StarRating difficulty={stage.difficulty} />
      </div>
    </button>
  )
}

// ────────────────────────────────────────────────────
// StageDetailPopup (bottom sheet)
// ────────────────────────────────────────────────────

interface StageDetailPopupProps {
  stage: Stage
  isCleared: boolean
  playerElement: FiveElement
  onStartBattle: () => void
  onClose: () => void
}

function StageDetailPopup({
  stage,
  isCleared,
  playerElement,
  onStartBattle,
  onClose,
}: StageDetailPopupProps): React.ReactElement {
  const elementInfo = stage.element !== 'neutral'
    ? ELEMENT_DISPLAY[stage.element as FiveElement]
    : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`스테이지 ${stage.id} 상세`}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg2)',
          borderRadius: '16px 16px 0 0',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          animation: 'slideUpSheet 0.3s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 드래그 핸들 */}
        <div style={{
          width: 40,
          height: 4,
          background: 'rgba(201,168,76,0.20)',
          borderRadius: 2,
          margin: '12px auto',
        }} />

        <div style={{ padding: '8px 20px 20px' }}>
          {/* 스테이지 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 40 }}>
              {elementInfo ? elementInfo.icon : '⚡'}
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: 20,
                color: 'var(--text-headline)',
              }}>
                {stage.bossName}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-muted)',
                marginTop: 2,
              }}>
                {stage.region}
              </div>
            </div>
          </div>

          {/* 메타 정보 */}
          <div style={{
            display: 'flex',
            gap: 12,
            marginTop: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
          }}>
            <div style={{ flex: 1, background: 'rgba(44,44,44,0.06)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>오행</div>
              <div style={{ color: 'var(--text-headline)' }}>
                {elementInfo ? `${elementInfo.label}` : '중립 (全오행)'}
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(44,44,44,0.06)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>난이도</div>
              <div>
                <StarRating difficulty={stage.difficulty} />
              </div>
            </div>
          </div>

          {/* 구분선 */}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />

          {/* AI 전략 힌트 */}
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}>
            "{stage.humorHint}"
          </div>

          {/* 구분선 */}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />

          {/* 상성 안내 */}
          {stage.element !== 'neutral' && (
            <div style={{ marginBottom: 20 }}>
              <AdvantageNote
                playerEl={playerElement}
                aiEl={stage.element as FiveElement}
              />
            </div>
          )}

          {/* 버튼 행 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 8,
                border: '1px solid var(--border-gold)',
                background: 'transparent',
                color: 'var(--text-headline)',
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>

          {/* 도전하기 CTA */}
          <button
            onClick={onStartBattle}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 8,
              border: 'none',
              background: 'var(--gold)',
              color: '#1A1714',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            {isCleared ? '재도전' : '도전하기!'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// useCountUp — 숫자 변화 시 countUp 애니메이션 훅
// ────────────────────────────────────────────────────

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

function useCountUp(target: number, duration = 300): number {
  const [displayed, setDisplayed] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    if (from === target) return
    prevRef.current = target

    const startTime = performance.now()
    const diff = target - from

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutQuart(progress)
      setDisplayed(Math.round(from + diff * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return displayed
}

// ────────────────────────────────────────────────────
// RunSummaryBar — M7 P4 폴리시 (HeroStatusBar 대체)
// ────────────────────────────────────────────────────

interface RunSummaryBarProps {
  heroName: string
  heroHp: number
  heroMaxHp: number
  playerElement: FiveElement
  clearedCount: number
}

function RunSummaryBar({
  heroName,
  heroHp,
  heroMaxHp,
  playerElement,
  clearedCount,
}: RunSummaryBarProps): React.ReactElement {
  const currentDeckIds = useUnlockStore(s => s.currentDeckIds)
  const ownedRelics = useRelicStore(s => s.ownedRelics)
  const deckSize = currentDeckIds.length
  const relicCount = ownedRelics.length

  // P4-B 폴리시: 덱 크기 countUp
  const displayedDeckSize = useCountUp(deckSize, 300)

  // P4-B 폴리시: 유물 수치 변화 시 bounce
  const prevRelicCountRef = useRef(relicCount)
  const [relicBounce, setRelicBounce] = useState(false)
  useEffect(() => {
    if (relicCount > prevRelicCountRef.current) {
      setRelicBounce(true)
      const t = setTimeout(() => setRelicBounce(false), 400)
      prevRelicCountRef.current = relicCount
      return () => clearTimeout(t)
    }
    prevRelicCountRef.current = relicCount
  }, [relicCount])

  // P4-B 폴리시: 스테이지 수치 변화 시 scaleY bounce
  const prevClearedRef = useRef(clearedCount)
  const [stageBounce, setStageBounce] = useState(false)
  const stageBounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (clearedCount > prevClearedRef.current) {
      setStageBounce(true)
      if (stageBounceTimerRef.current) clearTimeout(stageBounceTimerRef.current)
      stageBounceTimerRef.current = setTimeout(() => setStageBounce(false), 400)
      prevClearedRef.current = clearedCount
    } else {
      prevClearedRef.current = clearedCount
    }
  }, [clearedCount])

  return (
    <div
      aria-label={`런 현황: ${heroName} HP ${heroHp}/${heroMaxHp}, 덱 ${deckSize}장, 유물 ${relicCount}개`}
      style={{ flexShrink: 0 }}
    >
      {/* HeroSection */}
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* 오행 아이콘 */}
        <div style={{ fontSize: 24, flexShrink: 0 }}>
          {ELEMENT_DISPLAY[playerElement].icon}
        </div>

        {/* 영웅명 + HP */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 16,
            color: 'var(--text-headline)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 200,
          }}>
            {heroName}
          </div>
          <div style={{ marginTop: 4 }}>
            <HeroHpBar current={heroHp} max={heroMaxHp} heroName={heroName} />
          </div>
        </div>

        {/* 스테이지 진행 — P4-B: 변화 시 bounce */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          flexShrink: 0,
          textAlign: 'right',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          스테이지{' '}
          <span style={{
            display: 'inline-block',
            color: 'var(--text-headline)',
            fontWeight: 700,
            fontSize: 12,
            animation: stageBounce ? 'statBounce 0.4s cubic-bezier(0.175,0.885,0.32,1.275)' : 'none',
          }}>
            {clearedCount}
          </span>
          /6
        </div>
      </div>

      {/* StatRow — 덱 크기 + 유물 수 + 유물 inline 아이콘 */}
      <div style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: 12,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* 덱 크기 — P4-B: countUp 애니메이션 */}
        <div
          aria-label={`현재 덱 ${deckSize}장`}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            덱
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-headline)',
            fontWeight: 700,
          }}>
            {displayedDeckSize}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            장
          </span>
        </div>

        {/* 유물 — P4-B: inline 아이콘 (최대 3개 + overflow) + bounce */}
        <div
          aria-label={`보유 유물 ${relicCount}개`}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            유물
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-headline)',
            fontWeight: 700,
            display: 'inline-block',
            animation: relicBounce ? 'statBounce 0.4s cubic-bezier(0.175,0.885,0.32,1.275)' : 'none',
          }}>
            {relicCount}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            개
          </span>
          {/* 유물 아이콘 inline — 최대 3개 */}
          {ownedRelics.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
              {ownedRelics.slice(0, 3).map(r => (
                <span
                  key={r.id}
                  title={r.name}
                  style={{
                    fontSize: 12,
                    lineHeight: 1,
                    color: 'var(--gold)',
                  }}
                >
                  {r.icon}
                </span>
              ))}
              {relicCount > 3 && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--text-muted)',
                }}>
                  +{relicCount - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────
// RelicTooltip — M7 P3
// ────────────────────────────────────────────────────

interface RelicTooltipProps {
  relic: import('@/types/relics').Relic
  anchorRect: DOMRect
  onClose: () => void
}

function RelicTooltip({ relic, anchorRect, onClose }: RelicTooltipProps): React.ReactElement {
  // 아이콘 위쪽에 표시 — fixed position
  const top = Math.max(8, anchorRect.top - 130)

  return (
    <>
      {/* 바깥 클릭 오버레이 */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 55 }}
        onClick={onClose}
      />
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          top,
          left: Math.max(8, Math.min(anchorRect.left - 40, window.innerWidth - 240)),
          width: 220,
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '10px 12px',
          zIndex: 56,
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>{relic.icon}</span>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-headline)',
          }}>
            {relic.name}
          </span>
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 6 }} />
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}>
          {relic.description}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}>
          {relic.flavorText}
        </div>
        <button
          onClick={onClose}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          닫기 ×
        </button>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────
// RelicBar — M8 P0-1 업그레이드 (최대 5개 + 더보기 + DetailModal)
// ────────────────────────────────────────────────────

const RELIC_BAR_MAX_VISIBLE = 5

function RelicBar(): React.ReactElement {
  const ownedRelics = useRelicStore(s => s.ownedRelics)
  const [tooltipRelicId, setTooltipRelicId] = useState<string | null>(null)
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const tooltipRelic = ownedRelics.find(r => r.id === tooltipRelicId) ?? null
  const visibleRelics = ownedRelics.slice(0, RELIC_BAR_MAX_VISIBLE)
  const overflowCount = Math.max(0, ownedRelics.length - RELIC_BAR_MAX_VISIBLE)

  function handleRelicClick(e: React.MouseEvent<HTMLButtonElement>, relicId: string) {
    if (tooltipRelicId === relicId) {
      setTooltipRelicId(null)
      setTooltipAnchor(null)
    } else {
      setTooltipRelicId(relicId)
      setTooltipAnchor((e.currentTarget as HTMLButtonElement).getBoundingClientRect())
    }
  }

  return (
    <>
      <div style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 8,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {/* 섹션 레이블 */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          flexShrink: 0,
        }}>
          유물
        </span>

        {ownedRelics.length === 0 ? (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            유물 없음 — 보스 처치 또는 이벤트로 획득 가능
          </span>
        ) : (
          <>
            {/* 유물 아이콘 버튼들 — 최대 5개 */}
            {visibleRelics.map(relic => (
              <button
                key={relic.id}
                onClick={e => handleRelicClick(e, relic.id)}
                aria-label={`유물: ${relic.name}`}
                style={{
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(201,168,76,0.12)',
                  border: tooltipRelicId === relic.id
                    ? '1px solid var(--gold)'
                    : '1px solid transparent',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: 14,
                  flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {relic.icon}
              </button>
            ))}

            {/* +N 더보기 버튼 */}
            {overflowCount > 0 && (
              <button
                onClick={() => setShowDetailModal(true)}
                aria-label={`유물 ${overflowCount}개 더보기`}
                style={{
                  height: 24,
                  padding: '0 6px',
                  background: 'rgba(201,168,76,0.08)',
                  border: '1px solid var(--border-gold)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--gold)',
                  flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                +{overflowCount} 더보기
              </button>
            )}

            {/* 카운트 + 전체 보기 (overflowCount=0일 때도 전체 목록 버튼 제공) */}
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              marginLeft: 'auto',
              flexShrink: 0,
              cursor: 'pointer',
            }}
              onClick={() => setShowDetailModal(true)}
            >
              {ownedRelics.length}/20
            </span>
          </>
        )}
      </div>

      {/* Tooltip */}
      {tooltipRelic && tooltipAnchor && (
        <RelicTooltip
          relic={tooltipRelic}
          anchorRect={tooltipAnchor}
          onClose={() => {
            setTooltipRelicId(null)
            setTooltipAnchor(null)
          }}
        />
      )}

      {/* RelicDetailModal (M8 P0-1) */}
      {showDetailModal && (
        <RelicDetailModal onClose={() => setShowDetailModal(false)} />
      )}
    </>
  )
}

// ────────────────────────────────────────────────────
// EventNode — M7 P2
// ────────────────────────────────────────────────────

type EventNodeStatus = 'available' | 'cleared' | 'locked'

interface EventNodeProps {
  status: EventNodeStatus
  onEvent: () => void
}

function EventNode({ status, onEvent }: EventNodeProps): React.ReactElement {
  const isAvailable = status === 'available'
  const isCleared = status === 'cleared'
  const isLocked = status === 'locked'

  const nodeStyle: React.CSSProperties = (() => {
    switch (status) {
      case 'available':
        return {
          background: 'rgba(201,168,76,0.06)',
          border: '1px solid var(--gold)',
          animation: 'pulseGlow 2s ease-in-out infinite',
          cursor: 'pointer',
        }
      case 'cleared':
        return {
          background: 'rgba(74,122,69,0.08)',
          border: '1px solid var(--gold)',
          cursor: 'not-allowed',
        }
      case 'locked':
        return {
          background: 'rgba(44,44,44,0.04)',
          border: '1px solid var(--border)',
          opacity: 0.4,
          cursor: 'not-allowed',
        }
    }
  })()

  const ariaLabel = isAvailable
    ? '기문의 길목 이벤트 — 진입 가능'
    : isCleared
    ? '기문의 길목 이벤트 — 완료됨'
    : '기문의 길목 이벤트 — 잠김, Stage 3 클리어 후 개방'

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={isAvailable ? onEvent : undefined}
      aria-label={ariaLabel}
      style={{
        width: '100%',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...nodeStyle,
      }}
    >
      {/* 좌측: 아이콘 + 텍스트 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{
          fontSize: 18,
          color: isLocked ? 'var(--text-muted)' : 'var(--gold)',
        }}>
          {isCleared ? '✓' : isLocked ? '🔒' : '◈'}
        </span>
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: isLocked ? 'var(--text-muted)' : 'var(--text-headline)',
            lineHeight: 1.2,
          }}>
            {isLocked ? '???' : isCleared ? '기문(奇門)의 길목' : '기문(奇門)의 길목'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 2,
          }}>
            {isCleared ? '이미 지나온 관문' : isLocked ? '아직 때가 아니다' : '사건이 그대를 기다린다'}
          </div>
        </div>
      </div>

      {/* 우측: 상태 레이블 */}
      {isAvailable && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--gold)',
          flexShrink: 0,
        }}>
          ▶ 입장
        </span>
      )}
      {isCleared && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}>
          완료
        </span>
      )}
    </button>
  )
}

// ────────────────────────────────────────────────────
// ShopNode — 상점 노드 (M7 P2-B)
// ────────────────────────────────────────────────────

type ShopNodeStatus = 'available' | 'cleared' | 'locked'

interface ShopNodeProps {
  status: ShopNodeStatus
  gold: number
  onShop: () => void
}

function ShopNode({ status, gold, onShop }: ShopNodeProps): React.ReactElement {
  const isAvailable = status === 'available'
  const isCleared = status === 'cleared'
  const isLocked = status === 'locked'

  const nodeStyle: React.CSSProperties = (() => {
    switch (status) {
      case 'available':
        return {
          background: 'rgba(201,168,76,0.06)',
          border: '1px solid var(--border-gold)',
          animation: 'pulseGlow 2s ease-in-out infinite',
          cursor: 'pointer',
        }
      case 'cleared':
        return {
          background: 'rgba(74,122,69,0.08)',
          border: '1px solid var(--border)',
          opacity: 0.6,
          cursor: 'not-allowed',
        }
      case 'locked':
        return {
          background: 'rgba(44,44,44,0.04)',
          border: '1px solid var(--border)',
          opacity: 0.4,
          cursor: 'not-allowed',
        }
    }
  })()

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={isAvailable ? onShop : undefined}
      aria-label={
        isAvailable
          ? `노점 상인 · 카드 구매/서비스 (보유 골드 ${gold})`
          : isCleared
          ? '노점 상인 · 방문 완료'
          : '노점 상인 · 잠김 (Stage 4 클리어 후 개방)'
      }
      style={{
        width: '100%',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...nodeStyle,
      }}
    >
      {/* 좌측: 아이콘 + 텍스트 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{
          fontSize: 18,
          color: isLocked ? 'var(--text-muted)' : 'var(--gold)',
        }}>
          {isCleared ? '✓' : isLocked ? '🔒' : '⬡'}
        </span>
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: isLocked ? 'var(--text-muted)' : 'var(--text-headline)',
            lineHeight: 1.2,
          }}>
            {isLocked ? '???' : isCleared ? '노점 상인 · 방문 완료' : '노점 상인 · 카드 구매/제거'}
          </div>
          {!isLocked && !isCleared && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              marginTop: 2,
            }}>
              카드 3장, 서비스 이용 가능
            </div>
          )}
        </div>
      </div>

      {/* 우측: 골드 or 상태 */}
      {isAvailable && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--gold)',
          flexShrink: 0,
        }}>
          ⬡ {gold}
        </span>
      )}
      {isCleared && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}>
          완료
        </span>
      )}
    </button>
  )
}

// ────────────────────────────────────────────────────
// UpgradeNode — 업그레이드 노드 (M7 P1-B)
// ────────────────────────────────────────────────────

type UpgradeNodeStatus = 'available' | 'cleared' | 'locked'

interface UpgradeNodeProps {
  status: UpgradeNodeStatus
  onUpgrade: () => void
}

function UpgradeNode({ status, onUpgrade }: UpgradeNodeProps): React.ReactElement {
  const isAvailable = status === 'available'
  const isCleared = status === 'cleared'
  const isLocked = status === 'locked'

  const nodeStyle: React.CSSProperties = (() => {
    switch (status) {
      case 'available':
        return {
          background: 'rgba(201,168,76,0.06)',
          border: '1px solid var(--gold)',
          animation: 'pulseGlow 2s ease-in-out infinite',
          cursor: 'pointer',
        }
      case 'cleared':
        return {
          background: 'rgba(74,122,69,0.08)',
          border: '1px solid var(--gold)',
          cursor: 'not-allowed',
        }
      case 'locked':
        return {
          background: 'rgba(44,44,44,0.04)',
          border: '1px solid var(--border)',
          opacity: 0.4,
          cursor: 'not-allowed',
        }
    }
  })()

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={isAvailable ? onUpgrade : undefined}
      aria-label={
        isAvailable
          ? '운명 단련소 · 카드 강화 진입'
          : isCleared
          ? '운명 단련소 · 강화 완료 (이미 사용)'
          : '운명 단련소 · 잠김'
      }
      style={{
        width: '100%',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...nodeStyle,
      }}
    >
      {/* 좌측: 아이콘 + 텍스트 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{
          fontSize: 18,
          color: isLocked ? 'var(--text-muted)' : 'var(--gold)',
        }}>
          {isCleared ? '✓' : isLocked ? '🔒' : '⬡'}
        </span>
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: isLocked ? 'var(--text-muted)' : 'var(--text-headline)',
            lineHeight: 1.2,
          }}>
            {isLocked ? '???' : isCleared ? '운명 단련소 · 강화 완료' : '운명 단련소 · 카드 강화'}
          </div>
          {!isLocked && !isCleared && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              marginTop: 2,
            }}>
              카드 1장을 더 강한 버전으로
            </div>
          )}
        </div>
      </div>

      {/* 우측: 상태 */}
      {isAvailable && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--gold)',
          flexShrink: 0,
        }}>
          ▶ 강화
        </span>
      )}
    </button>
  )
}

// ────────────────────────────────────────────────────
// 지역 레이아웃 데이터 (리라 M5 스펙 §3-4)
// ────────────────────────────────────────────────────

const REGION_LAYOUT = [
  {
    row: 1,
    blocks: [
      { regionId: 'region-1', label: '1지역 · 중원 초입', stageIds: [1, 2] },
      { regionId: 'region-2', label: '2지역 · 서역 사막', stageIds: [3, 4] },
    ],
  },
  {
    row: 2,
    blocks: [
      { regionId: 'region-3', label: '3지역 · 북방 빙원', stageIds: [5] },
      { regionId: 'region-boss', label: '최종 · 마교 본산', stageIds: [6], variant: 'boss' as const },
    ],
  },
]

// ────────────────────────────────────────────────────
// WorldMapScreen 메인
// ────────────────────────────────────────────────────

export default function WorldMapScreen({
  onStartBattle,
  onUpgrade,
  upgradeNodeCleared,
  playerElement,
  heroName,
  heroHp,
  heroMaxHp,
  onEvent,
  eventNodeCleared,
  onShop,
  shopNodeCleared,
  gold,
}: WorldMapScreenProps): React.ReactElement {
  const [detailStageId, setDetailStageId] = useState<number | null>(null)

  const isUnlocked = useStageStore(s => s.isUnlocked)
  const isCleared = useStageStore(s => s.isCleared)
  const clearedStageIds = useStageStore(s => s.clearedStageIds)

  const clearedCount = clearedStageIds.size

  // 업그레이드 노드 상태: Stage 2 클리어 시 available (스펙 §업그레이드 노드 언락 조건)
  const upgradeNodeStatus: UpgradeNodeStatus = upgradeNodeCleared
    ? 'cleared'
    : isCleared(2)
    ? 'available'
    : 'locked'

  // 이벤트 노드 상태: Stage 3 클리어 시 available (P2 스펙 §5-7)
  const eventNodeStatus: EventNodeStatus = eventNodeCleared
    ? 'cleared'
    : isCleared(3)
    ? 'available'
    : 'locked'

  // 상점 노드 상태: Stage 4 클리어 시 available (P2-B 스펙 §7-2)
  type ShopNodeStatus = 'available' | 'cleared' | 'locked'
  const shopNodeStatus: ShopNodeStatus = shopNodeCleared
    ? 'cleared'
    : isCleared(4)
    ? 'available'
    : 'locked'

  const detailStage = detailStageId !== null
    ? ALL_STAGES.find(s => s.id === detailStageId) ?? null
    : null

  function handleStartBattle(): void {
    if (detailStageId === null) return
    setDetailStageId(null)
    onStartBattle(detailStageId)
  }

  const stageMap = Object.fromEntries(ALL_STAGES.map(s => [s.id, s]))

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
    }}>

      {/* TopBar */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
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
      </header>

      {/* RunSummaryBar (P4: HeroStatusBar 대체 + StatRow) */}
      <RunSummaryBar
        heroName={heroName}
        heroHp={heroHp}
        heroMaxHp={heroMaxHp}
        playerElement={playerElement}
        clearedCount={clearedCount}
      />

      {/* RelicBar (P3: 유물 표시) */}
      <RelicBar />

      {/* 지도 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>
        {/* 지도 레이블 */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          marginBottom: 8,
        }}>
          강호 지도
        </div>

        {/* MapContainer */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
        }}>
          {REGION_LAYOUT.map((rowData, rowIdx) => (
            <React.Fragment key={rowData.row}>
              {/* 지역 행 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                padding: 16,
              }}>
                {rowData.blocks.map(block => {
                  const isBossBlock = block.variant === 'boss'
                  const blockStages = block.stageIds
                    .map(id => stageMap[id])
                    .filter(Boolean) as Stage[]

                  return (
                    <div
                      key={block.regionId}
                      style={{
                        background: isBossBlock
                          ? 'rgba(139,0,0,0.08)'
                          : 'rgba(44,44,44,0.04)',
                        border: isBossBlock
                          ? '1px solid rgba(139,0,0,0.25)'
                          : 'none',
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {/* 지역 레이블 */}
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {block.label}
                      </div>

                      {/* 스테이지 노드들 */}
                      {blockStages.map(stage => (
                        <StageNode
                          key={stage.id}
                          stage={stage}
                          isUnlocked={isUnlocked(stage.id)}
                          isCleared={isCleared(stage.id)}
                          onSelect={() => setDetailStageId(stage.id)}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>

              {/* row 1 이후: 업그레이드 행 (row 1.5) + 이벤트 행 삽입 */}
              {rowIdx === 0 && (
                <>
                  <div style={{
                    margin: '0 16px',
                    borderTop: '1px dashed rgba(232,200,74,0.12)',
                  }} />
                  <div style={{ padding: '8px 16px' }}>
                    <UpgradeNode
                      status={upgradeNodeStatus}
                      onUpgrade={onUpgrade}
                    />
                  </div>
                  {/* EventNode (P2) — UpgradeNode 아래, row 2 위 */}
                  <div style={{ padding: '0 16px 8px' }}>
                    <EventNode
                      status={eventNodeStatus}
                      onEvent={onEvent}
                    />
                  </div>
                  <div style={{
                    margin: '0 16px',
                    borderTop: '1px dashed rgba(232,200,74,0.12)',
                  }} />
                </>
              )}
              {/* row 2 이후: 상점 노드 삽입 (P2-B) */}
              {rowIdx === 1 && (
                <>
                  <div style={{
                    margin: '0 16px',
                    borderTop: '1px dashed rgba(232,200,74,0.12)',
                  }} />
                  <div style={{ padding: '8px 16px' }}>
                    <ShopNode
                      status={shopNodeStatus}
                      gold={gold}
                      onShop={onShop}
                    />
                  </div>
                </>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 전체 클리어 메시지 */}
        {clearedCount >= 7 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: 18,
              color: 'var(--gold)',
            }}>
              팔자가 좋으셨군요!
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--text-muted)',
              marginTop: 4,
            }}>
              모든 강호를 정복하셨습니다
            </div>
          </div>
        )}
      </div>

      {/* 스테이지 상세 팝업 */}
      {detailStage !== null && (
        <StageDetailPopup
          stage={detailStage}
          isCleared={isCleared(detailStage.id)}
          playerElement={playerElement}
          onStartBattle={handleStartBattle}
          onClose={() => setDetailStageId(null)}
        />
      )}
    </div>
  )
}
