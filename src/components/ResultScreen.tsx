/**
 * 팔자전 — (8) 결과 화면
 * 클리어율 % 표시 / "다시 도전" / "홈" 버튼
 */



interface ResultScreenProps {
  isVictory: boolean
  floorsCleared: number
  onRetry: () => void
  onHome: () => void
}

export default function ResultScreen({
  isVictory,
  floorsCleared,
  onRetry,
  onHome,
}: ResultScreenProps) {
  const clearRate = Math.round((floorsCleared / 4) * 100)

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen"
      style={{ backgroundColor: '#16130F', padding: '40px 24px' }}
    >
      {/* 결과 헤더 */}
      <div className="text-center">
        <div
          style={{
            fontSize: '48px',
            marginBottom: '8px',
            color: isVictory ? '#4A9B6E' : '#C63D2F',
          }}
        >
          {isVictory ? '승' : '패'}
        </div>
        <h2
          style={{
            color: '#E8DCC4',
            fontSize: '22px',
            letterSpacing: '0.15em',
            margin: 0,
          }}
        >
          {isVictory ? '운명을 꿰뚫었다' : '전장이 무너지다'}
        </h2>
      </div>

      {/* 구분선 */}
      <div style={{ width: '120px', height: '1px', backgroundColor: '#B33A2B', margin: '32px 0' }} />

      {/* 통계 */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <div style={{ color: '#6A6560', fontSize: '12px', letterSpacing: '0.2em' }}>클리어율</div>
          <div
            style={{
              color: '#D9A441',
              fontSize: '56px',
              fontWeight: 'bold',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              marginTop: '4px',
            }}
          >
            {clearRate}%
          </div>
        </div>

        <div className="text-center">
          <div style={{ color: '#6A6560', fontSize: '12px', letterSpacing: '0.2em' }}>클리어 층수</div>
          <div style={{ color: '#D8CCB4', fontSize: '24px', marginTop: '4px' }}>
            {floorsCleared} / 4
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex flex-col gap-4 w-full mt-12">
        <button
          onClick={onRetry}
          className="transition-all duration-150 active:scale-95"
          style={{
            backgroundColor: '#B33A2B',
            border: 'none',
            color: '#E8DCC4',
            padding: '18px',
            fontSize: '16px',
            letterSpacing: '0.2em',
            cursor: 'pointer',
            width: '100%',
            minHeight: '56px',
          }}
        >
          다시 도전
        </button>
        <button
          onClick={onHome}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #4A4540',
            color: '#D8CCB4',
            padding: '16px',
            fontSize: '15px',
            letterSpacing: '0.15em',
            cursor: 'pointer',
            width: '100%',
            minHeight: '48px',
          }}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}
