/**
 * PrimaryButton — Momentor 골드 CTA 버튼
 * 리라 스펙 §7 + Momentor 디자인 시스템 (2026-07-05)
 */
import React from 'react'

interface PrimaryButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  isLoading?: boolean
  loadingText?: string
  type?: 'button' | 'submit'
  className?: string
}

export default function PrimaryButton({
  children,
  onClick,
  disabled = false,
  isLoading = false,
  loadingText,
  type = 'button',
  className = '',
}: PrimaryButtonProps): React.ReactElement {
  const isDisabled = disabled || isLoading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={isLoading}
      className={className}
      style={{
        width: '100%',
        height: 52,
        border: '1px solid var(--gold-primary)',
        background: 'transparent',
        color: 'var(--gold)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        letterSpacing: '0.1em',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.4 : 1,
        transition: 'background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        pointerEvents: isDisabled ? 'none' : 'auto',
      }}
      onMouseEnter={e => {
        if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,175,90,0.08)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {isLoading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid var(--gold)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
            aria-hidden="true"
          />
          {loadingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
