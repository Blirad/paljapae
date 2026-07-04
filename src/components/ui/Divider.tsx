/**
 * Divider — 황금 구분선
 * 리라 스펙 §7
 */
import React from 'react'

interface DividerProps {
  className?: string
}

export default function Divider({ className = '' }: DividerProps): React.ReactElement {
  return (
    <hr
      aria-hidden="true"
      className={['border-none border-t border-[rgba(232,200,74,0.12)] m-0', className].join(' ')}
      style={{ borderTop: '1px solid rgba(232,200,74,0.12)' }}
    />
  )
}
