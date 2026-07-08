/**
 * SettingsScreen — 게임 설정 화면 (Phase D)
 * 음량, 밝기, 게임 초기화 등
 */

import React, { useState } from 'react'
import { clearAllProgress } from '@/utils/persistence'

interface SettingsScreenProps {
  onClose: () => void
  onResetGame: () => void
}

export default function SettingsScreen({
  onClose,
  onResetGame,
}: SettingsScreenProps): React.ReactElement {
  const [masterVolume, setMasterVolume] = useState(80)
  const [confirmReset, setConfirmReset] = useState(false)

  const handleReset = () => {
    if (confirmReset) {
      try {
        clearAllProgress()
        onResetGame()
      } catch {
        alert('게임 초기화에 실패했습니다')
      }
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 100,
    }}>
      {/* 모달 배경 */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1410 0%, #0D0B08 100%)',
        borderRadius: 12,
        border: '1px solid rgba(212, 165, 116, 0.3)',
        padding: '40px',
        maxWidth: 400,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
      }}>
        {/* 타이틀 */}
        <div style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: '#D4A574',
          marginBottom: 32,
          fontFamily: 'var(--font-serif)',
        }}>
          설정
        </div>

        {/* 설정 항목들 */}
        <div style={{ marginBottom: 32 }}>
          {/* 음량 제어 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 14,
              color: 'rgba(212, 165, 116, 0.8)',
              marginBottom: 8,
              fontFamily: 'var(--font-mono)',
            }}>
              음량: {masterVolume}%
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseInt(e.target.value))}
              style={{
                width: '100%',
                height: 6,
                borderRadius: 3,
                background: 'rgba(212, 165, 116, 0.2)',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* 게임 초기화 */}
          <div style={{
            padding: '16px',
            background: 'rgba(255, 107, 53, 0.1)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: 13,
              color: 'rgba(255, 107, 53, 0.8)',
              marginBottom: 8,
            }}>
              {confirmReset
                ? '정말로 초기화하시겠습니까? (3초)'
                : '게임 진행 상황 모두 초기화'}
            </div>
            <button
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '10px',
                background: confirmReset
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.5) 0%, rgba(239, 68, 68, 0.2) 100%)'
                  : 'rgba(255, 107, 53, 0.2)',
                border: `1px solid ${confirmReset ? 'rgba(239, 68, 68, 0.6)' : 'rgba(255, 107, 53, 0.4)'}`,
                color: confirmReset ? '#EF4444' : 'rgba(255, 107, 53, 0.8)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                transition: 'all 0.2s',
              }}
            >
              {confirmReset ? '✓ 초기화 확인' : '게임 초기화'}
            </button>
          </div>
        </div>

        {/* 정보 */}
        <div style={{
          fontSize: 12,
          color: 'rgba(212, 165, 116, 0.4)',
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          팔자패 v1.0<br />
          2026년 7월 배포
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.3) 0%, rgba(74, 222, 128, 0.1) 100%)',
            border: '1px solid rgba(74, 222, 128, 0.6)',
            color: '#4ADE80',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            (e.target as HTMLElement).style.background = 'linear-gradient(135deg, rgba(74, 222, 128, 0.4) 0%, rgba(74, 222, 128, 0.15) 100%)'
          }}
          onMouseOut={(e) => {
            (e.target as HTMLElement).style.background = 'linear-gradient(135deg, rgba(74, 222, 128, 0.3) 0%, rgba(74, 222, 128, 0.1) 100%)'
          }}
        >
          닫기
        </button>
      </div>
    </div>
  )
}
