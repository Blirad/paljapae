/**
 * SecondaryButton — 투명 테두리 버튼
 * 리라 스펙 §7
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
      style={style}
      className={[
        'h-[52px] rounded-[8px] cursor-pointer',
        'bg-transparent text-[#E8E0D0] font-sans text-[16px]',
        'border border-[rgba(232,200,74,0.45)]',
        'transition-all duration-[150ms]',
        'hover:border-[rgba(232,200,74,0.8)] hover:text-[#E8C84A]',
        'active:scale-[0.98]',
        'focus:outline-[2px] focus:outline-solid focus:outline-[#E8C84A] focus:outline-offset-2',
        disabled ? 'opacity-30 cursor-not-allowed' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
