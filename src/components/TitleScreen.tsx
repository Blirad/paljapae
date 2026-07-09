/**
 * 팔자전 — (1) 타이틀 화면
 * 빌드 지문: "팔자전 八字戰 · Phase 1 · <git-hash>"
 */



interface TitleScreenProps {
  onStart: () => void
}

const commitHash = import.meta.env.VITE_COMMIT_HASH || 'unknown'

export default function TitleScreen({ onStart }: TitleScreenProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen relative"
      style={{ backgroundColor: '#16130F' }}
    >
      {/* 배경 문양 */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 30%, #B33A2B 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* 로고 영역 */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-8">
        {/* 주사 장식선 */}
        <div style={{ color: '#B33A2B', fontSize: '14px', letterSpacing: '0.4em' }}>
          ─── 命 ───
        </div>

        {/* 메인 타이틀 */}
        <div className="text-center">
          <h1
            className="font-bold leading-tight"
            style={{
              color: '#E8DCC4',
              fontSize: '52px',
              letterSpacing: '0.1em',
              textShadow: '0 0 40px rgba(179,58,43,0.3)',
            }}
          >
            팔자전
          </h1>
          <p
            style={{
              color: '#B33A2B',
              fontSize: '22px',
              letterSpacing: '0.3em',
              marginTop: '4px',
            }}
          >
            八字戰
          </p>
        </div>

        {/* 부제 */}
        <p
          style={{
            color: '#D8CCB4',
            fontSize: '14px',
            opacity: 0.6,
            letterSpacing: '0.1em',
            textAlign: 'center',
          }}
        >
          팔자가 곧 전장이다
        </p>

        {/* 게임시작 버튼 */}
        <button
          onClick={onStart}
          className="mt-8 transition-all duration-200 active:scale-95"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #B33A2B',
            color: '#E8DCC4',
            padding: '16px 48px',
            fontSize: '16px',
            letterSpacing: '0.2em',
            cursor: 'pointer',
            minWidth: '200px',
            minHeight: '56px',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#B33A2B'
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'
          }}
        >
          게임시작
        </button>
      </div>

      {/* 빌드 지문 — 필수 */}
      <div
        className="absolute bottom-4 text-center w-full"
        style={{ color: '#4A4540', fontSize: '11px', letterSpacing: '0.05em' }}
      >
        팔자전 八字戰 · Phase 1 · {commitHash}
      </div>
    </div>
  )
}
