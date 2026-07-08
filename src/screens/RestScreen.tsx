/**
 * RestScreen — Run 중 휴식 노드 (Phase D)
 * 영웅 HP 회복, 버프 획득, 다음 전투 준비
 */

import React from 'react'
import gsap from 'gsap'

interface RestScreenProps {
  heroMaxHp: number
  heroCurrentHp: number
  onContinue: () => void
  onReturn: () => void
}

export default function RestScreen({
  heroMaxHp,
  heroCurrentHp,
  onContinue,
  onReturn,
}: RestScreenProps): React.ReactElement {
  const recoveredHp = Math.min(heroCurrentHp + Math.floor(heroMaxHp * 0.3), heroMaxHp)
  const recoveryAmount = recoveredHp - heroCurrentHp

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(135deg, #0D0B08 0%, #1A1410 50%, #0D0B08 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: 'var(--font-serif)',
      color: 'var(--text-body)',
    }}>
      {/* 타이틀 */}
      <div style={{
        fontSize: 48,
        fontWeight: 'bold',
        color: '#D4A574',
        marginBottom: 40,
        textAlign: 'center',
        textShadow: '0 0 20px rgba(212, 165, 116, 0.3)',
      }}>
        휴식처
      </div>

      {/* 설명 */}
      <div style={{
        maxWidth: 400,
        marginBottom: 60,
        textAlign: 'center',
        fontSize: 16,
        lineHeight: 1.8,
        color: 'rgba(212, 165, 116, 0.8)',
      }}>
        먼먼 길을 걸어온 여행자는 잠깐 쉬어간다.<br />
        이곳에서 영웅은 생기를 되찾는다.
      </div>

      {/* HP 회복 정보 */}
      <div style={{
        background: 'rgba(212, 165, 116, 0.1)',
        border: '1px solid rgba(212, 165, 116, 0.3)',
        borderRadius: 8,
        padding: '20px 40px',
        marginBottom: 60,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>영웅 HP 회복</div>
        <div style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: '#4ADE80',
        }}>
          +{recoveryAmount} / {recoveryAmount > 0 ? '✓ 회복됨' : '만전함'}
        </div>
        <div style={{
          fontSize: 13,
          marginTop: 8,
          color: 'rgba(212, 165, 116, 0.6)',
        }}>
          {heroCurrentHp} → {recoveredHp} / {heroMaxHp}
        </div>
      </div>

      {/* 버튼 */}
      <div style={{
        display: 'flex',
        gap: 16,
        width: '100%',
        maxWidth: 300,
      }}>
        <button
          onClick={onReturn}
          style={{
            flex: 1,
            padding: '14px 24px',
            background: 'rgba(212, 165, 116, 0.2)',
            border: '1px solid rgba(212, 165, 116, 0.4)',
            color: 'rgba(212, 165, 116, 0.8)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'var(--font-mono)',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            (e.target as HTMLElement).style.background = 'rgba(212, 165, 116, 0.3)'
          }}
          onMouseOut={(e) => {
            (e.target as HTMLElement).style.background = 'rgba(212, 165, 116, 0.2)'
          }}
        >
          돌아가기
        </button>
        <button
          onClick={onContinue}
          style={{
            flex: 1,
            padding: '14px 24px',
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
            gsap.to(e.target, { scale: 1.05, duration: 0.15 })
          }}
          onMouseOut={(e) => {
            (e.target as HTMLElement).style.background = 'linear-gradient(135deg, rgba(74, 222, 128, 0.3) 0%, rgba(74, 222, 128, 0.1) 100%)'
            gsap.to(e.target, { scale: 1, duration: 0.15 })
          }}
        >
          계속 진행
        </button>
      </div>
    </div>
  )
}
