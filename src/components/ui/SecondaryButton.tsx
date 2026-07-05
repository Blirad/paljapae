/**
 * SecondaryButton — Momentor 투명 테두리 버튼
 * 리라 스펙 §7 + Momentor 디자인 시스템 (2026-07-05)
 */
import React from 'react'

interface SecondaryButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

export default function SecondaryButton({
  children,
  onClick,
  disabled = false,
  className = '',
  style,
}: SecondaryButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        height: 52,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        letterSpacing: '0.05em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        transition: 'border-color 0.15s, color 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          const btn = e.currentTarget as HTMLButtonElement
          btn.style.borderColor = 'var(--border-gold)'
          btn.style.color = 'var(--gold)'
        }
      }}
      onMouseLeave={e => {
        const btn = e.currentTarget as HTMLButtonElement
        btn.style.borderColor = 'var(--border)'
        btn.style.color = 'var(--text-secondary)'
      }}
    >
      {children}
    </button>
  )
}
