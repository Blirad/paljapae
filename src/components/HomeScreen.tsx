/**
 * 팔자전 — (3) 홈 화면 (점집 책상)
 */



interface HomeScreenProps {
  onNewRun: () => void
  wins: number
  losses: number
}

export default function HomeScreen({ onNewRun, wins, losses }: HomeScreenProps) {
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '40px 24px' }}
    >
      {/* 상단 전적 */}
      <div className="text-center mt-8">
        <h2 style={{ color: '#B33A2B', fontSize: '13px', letterSpacing: '0.3em', margin: 0 }}>
          전적
        </h2>
        <div className="flex justify-center gap-8 mt-4">
          {[
            { label: '승', value: wins, color: '#4A9B6E' },
            { label: '패', value: losses, color: '#C63D2F' },
            { label: '승률', value: `${winRate}%`, color: '#D8CCB4' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span style={{ color, fontSize: '28px', fontWeight: 'bold' }}>{value}</span>
              <span style={{ color: '#6A6560', fontSize: '12px' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div style={{ borderTop: '1px solid #2A2620', margin: '32px 0' }} />

      {/* 중단 버튼 */}
      <div className="flex flex-col gap-4">
        <button
          onClick={onNewRun}
          className="transition-all duration-150 active:scale-95"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #B33A2B',
            color: '#E8DCC4',
            padding: '20px',
            fontSize: '16px',
            letterSpacing: '0.2em',
            cursor: 'pointer',
            width: '100%',
            minHeight: '64px',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#B33A2B'
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'
          }}
        >
          새로운 도전
        </button>
      </div>

      {/* 타이틀 하단 장식 */}
      <div className="mt-auto text-center pb-8">
        <div style={{ color: '#2A2620', fontSize: '11px', letterSpacing: '0.1em' }}>
          팔자전 八字戰 · Phase 1
        </div>
      </div>
    </div>
  )
}
