/**
 * EventScreen — 이벤트 노드 진입 화면 (M7 P2)
 * 리라 M7 P2 스펙 §2-3, §4 기준
 *
 * 진입: WorldMap EventNode 탭 → App scene='event'
 * 진출:
 *   - "← 돌아가기" (idle 상태만): onComplete({ ...result, cancelled: true })
 *   - "확인하고 지도로": onComplete(result)
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { ALL_EVENTS } from '@/data/events'
import type { EventResult } from '@/data/events'
import { useRelicStore } from '@/stores/relicStore'
import { useUnlockStore } from '@/stores/unlockStore'
import { ALL_CARDS } from '@/data/cards'
import type { Card } from '@/types/cards'

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface EventScreenProps {
  playerElement?: string
  bossElement?: string
  onComplete: (result: EventResult | null) => void
  onNeedRemoveCard: () => void
}

// ────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────

function pickRandomEvent() {
  const idx = Math.floor(Math.random() * ALL_EVENTS.length)
  return ALL_EVENTS[idx]
}

function pickRandomCard(excludeIds: Set<string>): Card | null {
  // INITIAL_UNLOCK_POOL과 유사한 범위에서 common 카드를 랜덤 선택
  const candidates = ALL_CARDS.filter(
    c => c.rarity === 'common' && !excludeIds.has(c.id)
  )
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

// ────────────────────────────────────────────────────
// EventScreen
// ────────────────────────────────────────────────────

export default function EventScreen({
  playerElement,
  bossElement,
  onComplete,
  onNeedRemoveCard,
}: EventScreenProps): React.ReactElement {
  // 마운트 시 이벤트 1종 랜덤 결정
  const event = useMemo(() => pickRandomEvent(), [])

  const [phase, setPhase] = useState<'idle' | 'resolved'>('idle')
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState<number | null>(null)
  const [resolvedResult, setResolvedResult] = useState<EventResult | null>(null)
  // (유물 획득 팝업은 App.tsx RelicAcquirePopup에서 처리)

  // P2-A 폴리시: 타이핑 효과
  const fullNarrative = event.narrative
  const [displayedText, setDisplayedText] = useState('')
  const [typingDone, setTypingDone] = useState(false)
  const [showChoices, setShowChoices] = useState(false)
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // 150ms 딜레이 후 타이핑 시작
    const startDelay = setTimeout(() => {
      let i = 0
      typingTimerRef.current = setInterval(() => {
        i++
        setDisplayedText(fullNarrative.slice(0, i))
        if (i >= fullNarrative.length) {
          if (typingTimerRef.current) clearInterval(typingTimerRef.current)
          setTypingDone(true)
          // 타이핑 완료 후 선택지 stagger
          setTimeout(() => setShowChoices(true), 100)
        }
      }, 18)
    }, 150)
    return () => {
      clearTimeout(startDelay)
      if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    }
  }, [fullNarrative])

  const handleSkipTyping = useCallback(() => {
    if (typingDone) return
    if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    setDisplayedText(fullNarrative)
    setTypingDone(true)
    setShowChoices(true)
  }, [typingDone, fullNarrative])

  const addRelic = useRelicStore(s => s.addRelic)
  const ownedCardIds = useUnlockStore(s => s.ownedCardIds)

  function handleChoiceSelect(choiceIdx: number) {
    if (phase !== 'idle') return

    const choice = event.choices[choiceIdx]
    const result = choice.resolve({ playerElement, bossElement })

    // MOD-1: 카드 추가 처리 — ownedCardIds/currentDeckIds 직접 갱신
    // selectReward는 pendingReward 없으면 즉시 리턴하는 가드가 있으므로 사용 불가.
    // useUnlockStore.setState로 두 상태를 원자적으로 갱신한다.
    if (result.cardAdded) {
      const card = pickRandomCard(ownedCardIds)
      if (card) {
        useUnlockStore.setState(state => ({
          ownedCardIds: new Set([...state.ownedCardIds, card.id]),
          currentDeckIds: [...state.currentDeckIds, card.id],
        }))
      }
    }

    // 유물 획득 처리 (P3 relicStore 연계) — 팝업은 App.tsx RelicAcquirePopup에서
    if (result.relicId) {
      try {
        addRelic(result.relicId)
      } catch {
        // relicStore 없으면 noop
      }
    }

    setSelectedChoiceIdx(choiceIdx)
    setResolvedResult(result)
    setPhase('resolved')
  }

  function handleConfirm() {
    if (!resolvedResult) return

    // 카드 제거 필요 시 App에서 처리
    if (resolvedResult.needRemoveCard) {
      onNeedRemoveCard()
      return
    }

    onComplete(resolvedResult)
  }

  function handleBack() {
    if (phase !== 'idle') return
    onComplete(null)
  }

  return (
    <div
      data-screen="event"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
        animation: 'fadeIn 0.3s ease-out',
        position: 'relative',
      }}
    >
      {/* 유물 획득 팝업은 App.tsx RelicAcquirePopup에서 처리 */}
      {/* TopBar */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={handleBack}
          disabled={phase === 'resolved'}
          aria-label="돌아가기"
          style={{
            background: 'none',
            border: 'none',
            cursor: phase === 'resolved' ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: phase === 'resolved' ? 'var(--text-muted)' : 'var(--text-primary)',
            opacity: phase === 'resolved' ? 0.3 : 1,
            padding: '8px 0',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ← 돌아가기
        </button>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 15,
          color: 'var(--text-headline)',
        }}>
          기문(奇門)의 길목
        </span>
        <div style={{ width: 80 }} />
      </header>

      {/* 스크롤 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>

        {/* 이벤트 제목 */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--gold)',
          marginBottom: 12,
          letterSpacing: '0.03em',
        }}>
          {event.title}
        </div>

        {/* 일러스트 영역 (placeholder) */}
        <div style={{
          height: 120,
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 48 }}>◈</span>
        </div>

        {/* 내러티브 텍스트 — 타이핑 효과 */}
        <div
          className="pj-certificate-frame"
          onClick={handleSkipTyping}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 20,
            cursor: typingDone ? 'default' : 'pointer',
          }}
        >
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: 0,
          }}>
            {displayedText}
            {!typingDone && (
              <span style={{ animation: 'blink 0.5s step-start infinite', borderLeft: '2px solid var(--gold)' }}>
                &nbsp;
              </span>
            )}
          </p>
        </div>

        {/* 선택지 목록 — 타이핑 완료 후 stagger 등장 */}
        {phase === 'idle' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: showChoices ? 1 : 0,
            transition: 'opacity 0.3s ease-out',
          }}>
            {event.choices.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => handleChoiceSelect(idx)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: 'var(--text-headline)',
                  marginBottom: 4,
                }}>
                  {choice.label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}>
                  {choice.hint}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 결과 패널 (선택 후 표시) */}
        {phase === 'resolved' && resolvedResult && selectedChoiceIdx !== null && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* 선택지들 (disabled 상태) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {event.choices.map((choice, idx) => {
                const isSelected = idx === selectedChoiceIdx
                return (
                  <button
                    key={idx}
                    disabled
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'var(--surface)',
                      border: isSelected
                        ? '1px solid var(--gold)'
                        : '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      textAlign: 'left',
                      cursor: 'not-allowed',
                      opacity: isSelected ? 1 : 0.35,
                      transform: isSelected ? 'scale(1.02)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--font-serif)',
                      fontStyle: 'italic',
                      fontSize: 14,
                      color: 'var(--text-headline)',
                      marginBottom: 4,
                    }}>
                      {choice.label}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}>
                      {choice.hint}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 결과 표시 박스 */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-gold)',
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 16,
              animation: 'fadeIn 0.3s ease-out',
            }}>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 14,
                color: 'var(--text-headline)',
                marginBottom: 8,
              }}>
                {resolvedResult.resultText}
              </div>

              {/* 효과 요약 */}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                {resolvedResult.hpDelta !== 0 && (
                  <span style={{
                    color: resolvedResult.hpDelta > 0 ? 'var(--el-wood)' : 'var(--accent-red)',
                  }}>
                    HP {resolvedResult.hpDelta > 0 ? '+' : ''}{resolvedResult.hpDelta}
                  </span>
                )}
                {resolvedResult.relicId && (
                  <span style={{ color: 'var(--gold)' }}>유물 획득</span>
                )}
                {resolvedResult.needRemoveCard && (
                  <span>카드 제거 선택으로 이동...</span>
                )}
              </div>
            </div>

            {/* CTA 버튼 */}
            <button
              onClick={handleConfirm}
              aria-label="이벤트 결과 확인 후 세계지도로 돌아가기"
              style={{
                width: '100%',
                height: 48,
                borderRadius: 8,
                border: 'none',
                background: 'var(--gold)',
                color: '#1A1714',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              {resolvedResult.needRemoveCard ? '카드를 제거하러 가기' : '확인하고 지도로'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
