/**
 * PrimaryButton — 공통 황금 CTA 버튼
 * 리라 스펙 §7
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
      className={[
        'w-full h-[52px] rounded-[8px] border-none cursor-pointer',
        'font-sans font-bold text-[16px]',
        'bg-[#E8C84A] text-[#0D0B08]',
        'transition-opacity duration-[150ms] transition-transform duration-[100ms]',
        'hover:opacity-90 active:scale-[0.98]',
        'focus:outline-[2px] focus:outline-solid focus:outline-[#E8C84A] focus:outline-offset-2',
        isDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
        className,
      ].join(' ')}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span
            className="inline-block w-4 h-4 border-2 border-[#0D0B08] border-t-transparent rounded-full animate-spin"
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
