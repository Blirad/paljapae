/**
 * SectionLabel — DM Mono 섹션 레이블
 * 리라 스펙 §7
 */
import React from 'react'

interface SectionLabelProps {
  children: React.ReactNode
  className?: string
}

export default function SectionLabel({ children, className = '' }: SectionLabelProps): React.ReactElement {
  return (
    <p
      className={['font-mono text-[11px] tracking-[0.1em] uppercase text-text-muted m-0', className].join(' ')}
    >
      {children}
    </p>
  )
}
