/**
 * ResultScreen — 승패 화면 오버레이
 * 리라 스펙 §8
 */

import React, { useEffect, useState } from 'react'
import type { GameResult } from '@/types/game'
import type { PlayerState } from '@/types/game'
import { ELEMENT_DISPLAY, DOMINATES } from '@/types/elements'
import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// 승리/패배 카피 (스펙 §8-2, §8-3)
// ────────────────────────────────────────────────────

const WIN_COPY: Record<FiveElement, string> = {
  '木': '청룡이 강호를 평정했습니다. (사실 책이 많아서)',
  '火': '불검의 화염이 적을 불태웠습니다. 피해도 좀 있지만...',
  '土': '황장군은 오늘도 지지 않았습니다. 이겼습니다.',
  '金': '백사형이 조용히 처리했습니다. 말 없이.',
  '水': '흑선인의 콤보가 완성됐습니다. 본인도 놀랐을 겁니다.',
}

const LOSE_COPY: Record<FiveElement, string> = {
  '木': '청룡이... 꺾였습니다. 책이 더 필요한 것 같습니다.',
  '火': '불검이 먼저 꺼졌습니다. 너무 뜨거웠나요.',
  '土': '황장군도 결국 무너졌습니다. 산도 흔들릴 때가 있습니다.',
  '金': '백사형도 이번엔 패했습니다. 무기값 청구서는 어디에...',
  '水': '흑선인의 콤보가... 터지지 않았습니다. 물이 막혔나요.',
}

// ────────────────────────────────────────────────────
// 황금 파티클 (승리 연출)
// ────────────────────────────────────────────────────

function GoldParticles(): React.ReactElement {
  return (
    <>
      {Array(6).fill(null).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#E8C84A',
            left: `${15 + i * 14}%`,
            bottom: '20%',
            animation: `floatUp ${0.8 + i * 0.2}s ease-out ${i * 0.15}s forwards`,
            opacity: 0,
          }}
        />
      ))}
    </>
  )
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────="────────────────────────────

interface ResultScreenProps {
  result: Exclude<GameResult, null>
  player: PlayerState
  ai: PlayerState
  turn: number
  playerKillCount: number
  onRetry: () => void
  onHome: () => void
}

export default function ResultScreen({
  result,
  player,
  ai,
  turn,
  playerKillCount,
  onRetry,
  onHome,
}: ResultScreenProps): React.ReactElement {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const isWin = result === 'player_win'
  const isDraw = result === 'draw'
  const playerElement = player.hero.element
  const playerDisplay = ELEMENT_DISPLAY[playerElement]

  const dominatedBy = Object.entries(DOMINATES).find(
    ([, target]) => target === playerElement,
  )?.[0] as FiveElement | undefined

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: `rgba(13,11,8,${visible ? 0.85 : 0})`,
      backdropFilter: 'blur(4px)',
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.4s',
    }}>
      {isWin && <GoldParticles />}

      {/* 패배 vignette */}
      {!isWin && !isDraw && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(192,57,43,0.15) 100%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* 결과 카드 */}
      <div style={{
        background: '#1A1714',
        border: '1px solid rgba(232,200,74,0.45)',
        borderRadius: 16,
        width: 'min(320px, 90vw)',
        padding: '32px 24px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        textAlign: 'center',
        transform: visible ? 'scale(1)' : 'scale(0.8)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.5s 0.2s ease-out, opacity 0.5s 0.2s ease-out',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* 아이콘 */}
        <div style={{
          fontSize: 80,
          marginBottom: 12,
          filter: isWin
            ? 'drop-shadow(0 0 12px rgba(232,200,74,0.6))'
            : !isDraw ? 'drop-shadow(0 0 8px rgba(192,57,43,0.5))' : 'none',
        }}>
          {isWin ? playerDisplay.icon : isDraw ? '⚖' : '💀'}
        </div>

        {/* 제목 */}
        <div style={{
          fontFamily: 'Noto Serif KR, serif',
          fontWeight: 700,
          fontSize: 28,
          color: isWin ? '#E8C84A' : isDraw ? '#A89880' : '#E8E0D0',
          marginBottom: 8,
        }}>
          {isWin ? '역시 팔자가 좋았군요' : isDraw ? '팽팽했습니다!' : '팔자가 사나우셨네요'}
        </div>

        {/* 부제 */}
        <div style={{
          fontFamily: 'Noto Serif KR, serif',
          fontSize: 16,
          fontStyle: 'italic',
          color: '#A89880',
          marginBottom: 8,
        }}>
          {isWin
            ? '운명이 당신의 편이었습니다'
            : isDraw
            ? '둘 다 쓰러졌네요.'
            : '오늘은 운이 없었을 뿐...'}
        </div>

        {/* 유머 카피 */}
        <div style={{
          fontFamily: 'Noto Sans KR, sans-serif',
          fontSize: 14,
          color: '#6B5F52',
          marginBottom: 16,
          lineHeight: 1.6,
        }}>
          {isWin ? WIN_COPY[playerElement] : isDraw ? '' : LOSE_COPY[playerElement]}
        </div>

        <div style={{ height: 1, background: 'rgba(232,200,74,0.12)', marginBottom: 12 }} />

        {/* 전투 요약 */}
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 12,
          color: '#A89880',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginBottom: 16,
          textAlign: 'left',
        }}>
          <div>턴: <span style={{ color: '#E8C84A' }}>{turn}</span></div>
          <div>처치한 적 유닛: <span style={{ color: '#E8C84A' }}>{playerKillCount}</span></div>
          {isWin && (
            <>
              <div>받은 피해: <span style={{ color: '#FF4444' }}>{30 - player.currentHp}</span></div>
              <div>남은 HP: <span style={{ color: '#44FF88' }}>{player.currentHp}</span></div>
            </>
          )}
          {!isWin && !isDraw && (
            <>
              <div>적 영웅 남은 HP: <span style={{ color: '#FF8800' }}>{ai.currentHp}</span></div>
            </>
          )}
        </div>

        {/* 패배 시 힌트 */}
        {!isWin && !isDraw && dominatedBy && (
          <div style={{
            fontFamily: 'Noto Sans KR, sans-serif',
            fontSize: 12,
            color: '#6B5F52',
            marginBottom: 16,
            padding: '8px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 6,
          }}>
            💡 상극을 노려보세요: {playerElement}은(는) {DOMINATES[playerElement]}에 강합니다
          </div>
        )}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 8,
              border: isWin ? '1px solid rgba(232,200,74,0.45)' : 'none',
              background: isWin ? 'transparent' : '#E8C84A',
              color: isWin ? '#A89880' : '#0D0B08',
              fontFamily: 'Noto Sans KR, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            다시 도전
          </button>
          <button
            onClick={onHome}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 8,
              border: isWin ? 'none' : '1px solid rgba(232,200,74,0.45)',
              background: isWin ? '#E8C84A' : 'transparent',
              color: isWin ? '#0D0B08' : '#A89880',
              fontFamily: 'Noto Sans KR, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {isWin ? '카드 선택하기' : '홈으로'}
          </button>
        </div>
      </div>
    </div>
  )
}
