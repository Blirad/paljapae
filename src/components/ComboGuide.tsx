/**
 * 팔자전 — 조합 도감 (ComboGuide) Phase 1.8
 * 원리 두 개 + 낳는 관계 / 이기는 관계 원형 도표 + 조합 예시
 */

import type { Element } from '../types/game'

interface ComboGuideProps {
  onClose: () => void
}

const ELEMENT_KO: Record<string, string> = {
  mok: '나무', hwa: '불', to: '흙', geum: '쇠', su: '물',
}
const ELEMENT_HANJA: Record<string, string> = {
  mok: '木', hwa: '火', to: '土', geum: '金', su: '水',
}
const ELEMENT_COLORS: Record<string, string> = {
  mok: '#4A9B6E', hwa: '#C63D2F', to: '#D9A441', geum: '#C8C0B0', su: '#3D5A80',
}

// 상생 순서: 목→화→토→금→수→목
const SAENG_ORDER: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

// 상극 관계
const GEUK_MAP: Record<Element, Element> = {
  mok: 'to', hwa: 'geum', to: 'su', geum: 'mok', su: 'hwa',
}

// 상생 원형 도표
function SaengCircleChart() {
  const cx = 90, cy = 90, r = 64
  const pos = SAENG_ORDER.map((el, i) => {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    return { el, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
  const posMap: Record<string, { x: number; y: number }> = {}
  pos.forEach(p => { posMap[p.el] = { x: p.x, y: p.y } })

  return (
    <svg width="180" height="180" viewBox="0 0 180 180" style={{ display: 'block', margin: '0 auto' }}>
      {/* 상생 화살표 */}
      {SAENG_ORDER.map((el, i) => {
        const next = SAENG_ORDER[(i + 1) % 5]
        const p1 = posMap[el], p2 = posMap[next]
        const dx = p2.x - p1.x, dy = p2.y - p1.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const ux = dx / len, uy = dy / len
        const nodeR = 20
        const x1 = p1.x + ux * nodeR, y1 = p1.y + uy * nodeR
        const x2 = p2.x - ux * nodeR, y2 = p2.y - uy * nodeR
        const ax = -uy * 5, ay = ux * 5
        return (
          <g key={`saeng-${el}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4A9B6E" strokeWidth="1.5" strokeOpacity="0.7" />
            <polygon
              points={`${x2},${y2} ${x2 - ux * 7 + ax},${y2 - uy * 7 + ay} ${x2 - ux * 7 - ax},${y2 - uy * 7 - ay}`}
              fill="#4A9B6E" opacity="0.8"
            />
          </g>
        )
      })}
      {/* 노드 */}
      {pos.map(({ el, x, y }) => (
        <g key={el}>
          <circle cx={x} cy={y} r="20" fill="rgba(28,23,16,0.95)" stroke={ELEMENT_COLORS[el]} strokeWidth="2" />
          <text x={x} y={y - 4} textAnchor="middle" dominantBaseline="middle" fill={ELEMENT_COLORS[el]} fontSize="13" fontWeight="bold">
            {ELEMENT_HANJA[el]}
          </text>
          <text x={x} y={y + 9} textAnchor="middle" dominantBaseline="middle" fill={ELEMENT_COLORS[el]} fontSize="7">
            {ELEMENT_KO[el]}
          </text>
        </g>
      ))}
    </svg>
  )
}

// 상극 별 모양 도표
function GeukCircleChart() {
  const cx = 90, cy = 90, r = 64
  // 상극 순서 배치 (별 모양)
  const GEUK_ORDER: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']
  const pos = GEUK_ORDER.map((el, i) => {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    return { el, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
  const posMap: Record<string, { x: number; y: number }> = {}
  pos.forEach(p => { posMap[p.el] = { x: p.x, y: p.y } })

  const geukArrows = (Object.entries(GEUK_MAP) as [Element, Element][]).map(([from, to]) => {
    const p1 = posMap[from], p2 = posMap[to]
    if (!p1 || !p2) return null
    const dx = p2.x - p1.x, dy = p2.y - p1.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const ux = dx / len, uy = dy / len
    const nodeR = 20
    const x1 = p1.x + ux * nodeR, y1 = p1.y + uy * nodeR
    const x2 = p2.x - ux * nodeR, y2 = p2.y - uy * nodeR
    const ax = -uy * 5, ay = ux * 5
    return (
      <g key={`geuk-${from}-${to}`}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(198,61,47,0.65)" strokeWidth="1.5" />
        <polygon
          points={`${x2},${y2} ${x2 - ux * 7 + ax},${y2 - uy * 7 + ay} ${x2 - ux * 7 - ax},${y2 - uy * 7 - ay}`}
          fill="rgba(198,61,47,0.75)"
        />
      </g>
    )
  })

  return (
    <svg width="180" height="180" viewBox="0 0 180 180" style={{ display: 'block', margin: '0 auto' }}>
      {geukArrows}
      {pos.map(({ el, x, y }) => (
        <g key={el}>
          <circle cx={x} cy={y} r="20" fill="rgba(28,23,16,0.95)" stroke={ELEMENT_COLORS[el]} strokeWidth="2" />
          <text x={x} y={y - 4} textAnchor="middle" dominantBaseline="middle" fill={ELEMENT_COLORS[el]} fontSize="13" fontWeight="bold">
            {ELEMENT_HANJA[el]}
          </text>
          <text x={x} y={y + 9} textAnchor="middle" dominantBaseline="middle" fill={ELEMENT_COLORS[el]} fontSize="7">
            {ELEMENT_KO[el]}
          </text>
        </g>
      ))}
    </svg>
  )
}

// 미니 카드 예시
function MiniCard({ element, value }: { element: Element; value: number }) {
  const c = ELEMENT_COLORS[element]
  return (
    <div style={{
      width: '36px', height: '50px',
      backgroundColor: '#E8DCC4',
      border: `2px solid ${c}`,
      borderRadius: '2px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexShrink: 0,
    }}>
      <span style={{ color: '#2A2620', fontSize: '14px', fontWeight: 'bold' }}>{value}</span>
      <span style={{ color: c, fontSize: '10px', fontWeight: 'bold', position: 'absolute', bottom: '4px' }}>
        {ELEMENT_HANJA[element]}
      </span>
    </div>
  )
}

export default function ComboGuide({ onClose }: ComboGuideProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        backgroundColor: 'rgba(22,19,15,0.7)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#1C1710',
          borderTop: '1px solid #2A2620',
          borderRadius: '8px 8px 0 0',
          maxHeight: '82vh',
          overflowY: 'auto',
          padding: '20px 16px 32px',
          animation: 'slideUp 220ms ease-out',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ color: '#D9A441', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.12em' }}>
            기운의 원리 (조합 도감)
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent', border: 'none',
              color: '#6A6560', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* 원리 텍스트 */}
        <div style={{
          backgroundColor: '#16130F',
          border: '1px solid #2A2620',
          padding: '14px 16px',
          marginBottom: '20px',
          color: '#D8CCB4',
          fontSize: '13px',
          lineHeight: '2',
          letterSpacing: '0.04em',
        }}>
          <div style={{ color: '#D9A441', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
            원리는 두 개뿐입니다.
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#4A9B6E', fontWeight: 'bold', marginBottom: '4px' }}>하나, 낳는 관계 — 기운이 다음 기운을 키웁니다.</div>
            <div style={{ color: '#8A8580', fontSize: '12px' }}>나무→불→흙→쇠→물→나무 (순환)</div>
            <div style={{ color: '#6A6560', fontSize: '11px', lineHeight: '1.8' }}>
              나무가 타서 불이 되고, 불이 꺼져 흙이 되고,<br/>
              흙에서 쇠가 나고, 쇠가 차가워져 물이 맺히고,<br/>
              물이 나무를 키웁니다.
            </div>
          </div>
          <div>
            <div style={{ color: '#C63D2F', fontWeight: 'bold', marginBottom: '4px' }}>둘, 이기는 관계 — 기운이 다른 기운을 누릅니다.</div>
            <div style={{ color: '#8A8580', fontSize: '12px' }}>나무→흙, 흙→물, 물→불, 불→쇠, 쇠→나무</div>
            <div style={{ color: '#6A6560', fontSize: '11px', lineHeight: '1.8' }}>
              나무가 흙을 뚫고, 흙이 물을 막고,<br/>
              물이 불을 끄고, 불이 쇠를 녹이고,<br/>
              쇠가 나무를 벱니다.
            </div>
          </div>
        </div>

        {/* 낳는 순서 도표 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#4A9B6E', fontSize: '11px', letterSpacing: '0.15em', marginBottom: '8px' }}>
            낳는 관계 (화살표 방향이 키우는 방향)
          </div>
          <SaengCircleChart />
        </div>

        {/* 이기는 관계 도표 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#C63D2F', fontSize: '11px', letterSpacing: '0.15em', marginBottom: '8px' }}>
            이기는 관계 (화살표 방향이 이기는 방향)
          </div>
          <GeukCircleChart />
        </div>

        {/* 조합 예시 */}
        <div>
          <div style={{ color: '#6A6560', fontSize: '11px', letterSpacing: '0.15em', marginBottom: '12px' }}>
            조합 예시 카드
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 기운 잇기 3 */}
            <div>
              <div style={{ color: '#D9A441', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                기운 잇기 3 (木→火→土) — ×3배
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <MiniCard element="mok" value={4} />
                <span style={{ color: '#4A9B6E', fontSize: '12px' }}>→</span>
                <MiniCard element="hwa" value={6} />
                <span style={{ color: '#4A9B6E', fontSize: '12px' }}>→</span>
                <MiniCard element="to" value={5} />
              </div>
            </div>

            {/* 같은 기운 모으기 5 */}
            <div>
              <div style={{ color: '#D9A441', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                같은 기운 모으기 5 (木×5) — ×4배
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[8, 6, 4, 2, 4].map((v, i) => (
                  <MiniCard key={i} element="mok" value={v} />
                ))}
              </div>
            </div>

            {/* 음양 짝 */}
            <div>
              <div style={{ color: '#D9A441', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                오행연환 (5종 전부) — ×10배
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {(['mok', 'hwa', 'to', 'geum', 'su'] as Element[]).map((el, i) => (
                  <MiniCard key={i} element={el} value={i + 3} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
