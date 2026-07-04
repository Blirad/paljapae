/**
 * Toast — 하단 알림 토스트
 * 리라 스펙 §7
 */
import React, { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  duration?: number
  onDismiss: () => void
  bottomOffset?: number
}

export default function Toast({
  message,
  duration = 2500,
  onDismiss,
  bottomOffset = 100,
}: ToastProps): React.ReactElement {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: `${bottomOffset}px`,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '10px'})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s, transform 0.2s',
        background: 'rgba(20,18,16,0.95)',
        border: '1px solid rgba(232,200,74,0.3)',
        borderRadius: '24px',
        padding: '10px 20px',
        fontFamily: 'Noto Sans KR, sans-serif',
        fontSize: '14px',
        color: '#E8E0D0',
        whiteSpace: 'nowrap',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  )
}
