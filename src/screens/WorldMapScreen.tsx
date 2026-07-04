/**
 * WorldMapScreen — M5 리팩터링
 * 리라 M4 스펙 §2 + M5 스펙 §3 기준
 *
 * 구성:
 *   TopBar (팔자패 워드마크)
 *   HeroStatusBar (HP 바 + 영웅명 + 진행)
 *   RegionRow 2×2 그리드
 *   StageDetailPopup (bottom sheet)
 *   AdvantageNote 상성 안내
 *   pulseGlow 애니메이션 (available 노드)
 */

import React, { useState } from 'react'
import type { Stage } from '@/data/stages'
import { ALL_STAGES } from '@/data/stages'
import { useStageStore } from '@/stores/stageStore'
import { ELEMENT_DISPLAY } from '@/types/elements'
import type { FiveElement } from '@/types/elements'
import { getAdvantageRelation, getAdvantageText } from '@/utils/advantage'

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface WorldMapScreenProps {
  onStartBattle: (stageId: number) => void
  playerElement: FiveElement
  heroName: string
  heroHp: number
  heroMaxHp: number
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
      <div style={{
        width: '100%',
        height: 6,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${ratio * 100}%`,
          height: '100%',
          background: hpColor,
          borderRadius: 3,
          transition: 'width 0.4s ease-out, background-color 0.5s',
        }} />
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
      ? { color: '#E8C84A', background: 'rgba(232,200,74,0.08)', fontWeight: 700 }
      : result === 'disadvantage'
      ? { color: '#C0392B', background: 'rgba(192,57,43,0.08)' }
      : { color: '#A89880', background: '#1A1714' }

  const prefix = result === 'advantage' ? '⚡ ' : result === 'disadvantage' ? '⚠ ' : ''

  return (
    <div style={{
      ...styles,
      borderRadius: 6,
      padding: '8px 12px',
      fontFamily: 'Noto Sans KR, sans-serif',
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
            color: i < difficulty ? '#E8C84A' : '#6B5F52',
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
          background: 'rgba(61,122,58,0.15)',
          border: '1px solid rgba(61,122,58,0.4)',
        }
      case 'available':
        return isBoss
          ? {
              background: 'rgba(192,57,43,0.15)',
              border: '1px solid rgba(192,57,43,0.6)',
              animation: 'pulseGlowBoss 2s ease-in-out infinite',
            }
          : {
              background: '#1A1714',
              border: '1px solid rgba(232,200,74,0.45)',
              animation: 'pulseGlow 2s ease-in-out infinite',
            }
      case 'locked':
        return {
          background: '#3A3530',
          border: '1px solid rgba(255,255,255,0.06)',
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
            fontFamily: 'DM Mono, monospace',
            fontSize: 11,
            color: status === 'available' ? '#C0392B' : '#6B5F52',
          }}>
            {status !== 'locked' ? '⚠ 최종 보스' : '???'}
          </div>
          <StarRating difficulty={stage.difficulty} />
        </div>
        <div style={{
          fontFamily: 'Noto Serif KR, serif',
          fontWeight: 700,
          fontSize: 14,
          color: '#E8E0D0',
          marginTop: 4,
        }}>
          {status === 'locked' ? '???' : stage.bossName}
        </div>
        {status !== 'locked' && (
          <div style={{
            fontFamily: 'Noto Serif KR, serif',
            fontStyle: 'italic',
            fontSize: 11,
            color: '#6B5F52',
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
          color: status === 'cleared' ? '#3D7A3A' : '#E8C84A',
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
        fontFamily: 'Noto Serif KR, serif',
        fontWeight: 700,
        fontSize: 13,
        color: status === 'locked' ? '#6B5F52' : '#E8E0D0',
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
          background: '#141210',
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
          background: 'rgba(232,200,74,0.12)',
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
                fontFamily: 'Noto Serif KR, serif',
                fontWeight: 700,
                fontSize: 20,
                color: '#E8E0D0',
              }}>
                {stage.bossName}
              </div>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 11,
                color: '#6B5F52',
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
            fontFamily: 'Noto Sans KR, sans-serif',
            fontSize: 14,
          }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: '#6B5F52', marginBottom: 2 }}>오행</div>
              <div style={{ color: '#E8E0D0' }}>
                {elementInfo ? `${elementInfo.label}` : '중립 (全오행)'}
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: '#6B5F52', marginBottom: 2 }}>난이도</div>
              <div>
                <StarRating difficulty={stage.difficulty} />
              </div>
            </div>
          </div>

          {/* 구분선 */}
          <div style={{ height: 1, background: 'rgba(232,200,74,0.12)', margin: '16px 0' }} />

          {/* AI 전략 힌트 */}
          <div style={{
            fontFamily: 'Noto Serif KR, serif',
            fontStyle: 'italic',
            fontSize: 13,
            color: '#6B5F52',
            marginBottom: 8,
          }}>
            "{stage.humorHint}"
          </div>

          {/* 구분선 */}
          <div style={{ height: 1, background: 'rgba(232,200,74,0.12)', margin: '16px 0' }} />

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
                border: '1px solid rgba(232,200,74,0.45)',
                background: 'transparent',
                color: '#E8E0D0',
                fontFamily: 'Noto Sans KR, sans-serif',
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
              background: '#E8C84A',
              color: '#0D0B08',
              fontFamily: 'Noto Sans KR, sans-serif',
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
  playerElement,
  heroName,
  heroHp,
  heroMaxHp,
}: WorldMapScreenProps): React.ReactElement {
  const [detailStageId, setDetailStageId] = useState<number | null>(null)

  const { isUnlocked, isCleared, clearedStageIds } = useStageStore(state => ({
    isUnlocked: state.isUnlocked,
    isCleared: state.isCleared,
    clearedStageIds: state.clearedStageIds,
  }))

  const clearedCount = clearedStageIds.size

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
      background: '#0D0B08',
      color: '#E8E0D0',
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

      {/* HeroStatusBar */}
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        background: '#1A1714',
        flexShrink: 0,
      }}>
        {/* 오행 아이콘 */}
        <div style={{ fontSize: 24, flexShrink: 0 }}>
          {ELEMENT_DISPLAY[playerElement].icon}
        </div>

        {/* 영웅명 + HP */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Noto Serif KR, serif',
            fontWeight: 700,
            fontSize: 16,
            color: '#E8E0D0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {heroName}
          </div>
          <div style={{ marginTop: 4 }}>
            <HeroHpBar current={heroHp} max={heroMaxHp} heroName={heroName} />
          </div>
        </div>

        {/* 스테이지 진행 */}
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 11,
          color: '#6B5F52',
          flexShrink: 0,
          textAlign: 'right',
        }}>
          스테이지 {clearedCount}/7
        </div>
      </div>

      {/* 지도 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>
        {/* 지도 레이블 */}
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 11,
          color: '#6B5F52',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          강호 지도
        </div>

        {/* MapContainer */}
        <div style={{
          background: '#141210',
          border: '1px solid rgba(232,200,74,0.12)',
          borderRadius: 12,
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
                          ? 'rgba(192,57,43,0.08)'
                          : 'rgba(0,0,0,0.2)',
                        border: isBossBlock
                          ? '1px solid rgba(192,57,43,0.3)'
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
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 10,
                        color: '#6B5F52',
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

              {/* 지역 행 구분선 */}
              {rowIdx < REGION_LAYOUT.length - 1 && (
                <div style={{
                  margin: '0 16px',
                  borderTop: '1px dashed rgba(232,200,74,0.12)',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 전체 클리어 메시지 */}
        {clearedCount >= 7 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <div style={{
              fontFamily: 'Noto Serif KR, serif',
              fontWeight: 700,
              fontSize: 18,
              color: '#E8C84A',
            }}>
              팔자가 좋으셨군요!
            </div>
            <div style={{
              fontFamily: 'Noto Sans KR, sans-serif',
              fontSize: 14,
              color: '#A89880',
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
