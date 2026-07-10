/**
 * 팔자전 — 조합 도감 (ComboGuide)
 * Phase 1.7 신규: 3-A
 *
 * 반화면 슬라이드업 오버레이
 *  - 전체 조합 목록 (약→강 순)
 *  - 상극 관계 원형 도표 (SVG)
 *  - 닫기 버튼 (우상단 ×)
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

// 상극 관계 (나무→흙→물→불→쇠→나무)
const GEUK_MAP: Record<Element, Element> = {
  mok: 'to', to: 'su', su: 'hwa', hwa: 'geum', geum: 'mok',
}

// 원형 도표 오각형 배치용 (12시 방향부터 시계방향, 상극 순서)
const CIRCLE_ORDER: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

const COMBO_LIST = [
  { name: '낱장 합산', mult: '×1.0', desc: '단독 패 — 카드 값 합산' },
  { name: '같은 기운 2', mult: '×1.5', desc: '같은 오행 2장' },
  { name: '기운 잇기 2종', mult: '×1.8', desc: '이어지는 오행 2종 (예: 나무+불)' },
  { name: '같은 기운 3', mult: '×2.0', desc: '같은 오행 3장' },
  { name: '같은 기운 4', mult: '×2.5', desc: '같은 오행 4장' },
  { name: '기운 잇기 3종', mult: '×2.5', desc: '이어지는 오행 3종' },
  { name: '기운 잇기 4종', mult: '×3.0', desc: '이어지는 오행 4종' },
  { name: '같은 기운 5', mult: '×3.5', desc: '같은 오행 5장 — 대결집' },
  { name: '기운 잇기 5종', mult: '×4.0', desc: '이어지는 오행 5종' },
  { name: '오행 연환', mult: '×10.0', desc: '5오행 모두 포함 — 극강의 조화' },
]

/**
 * 상극 관계 원형 도표 SVG
 * 나무→흙→물→불→쇠→나무 순서로 화살표
 */
function GeukCircleChart() {
  const cx = 90, cy = 90, r = 65

  const pos = CIRCLE_ORDER.map((el, i) => {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    return {
      el,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  })

  const posMap: Record<string, { x: number; y: number }> = {}
  pos.forEach(p => { posMap[p.el] = { x: p.x, y: p.y } })

  // 상극 화살표 (나무→흙, 흙→물, 물→불, 불→쇠, 쇠→나무)
  const geukArrows = (Object.entries(GEUK_MAP) as [Element, Element][]).map(([from, to]) => {
    const p1 = posMap[from]
    const p2 = posMap[to]
    if (!p1 || !p2) return null
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const ux = dx / len, uy = dy / len
    const nodeR = 22
    const x1 = p1.x + ux * nodeR
    const y1 = p1.y + uy * nodeR
    const x2 = p2.x - ux * nodeR
    const y2 = p2.y - uy * nodeR
    // 화살표 머리
    const ax = -uy * 5, ay = ux * 5
    return (
      <g key={`geuk-${from}-${to}`}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(198,61,47,0.6)" strokeWidth="1.5" />
        <polygon
          points={`${x2},${y2} ${x2 - ux * 8 + ax},${y2 - uy * 8 + ay} ${x2 - ux * 8 - ax},${y2 - uy * 8 - ay}`}
          fill="rgba(198,61,47,0.7)"
        />
      </g>
    )
  })

  return (
    <svg width="180" height="180" viewBox="0 0 180 180" style={{ display: 'block', margin: '0 auto' }}>
      {geukArrows}
      {pos.map(({ el, x, y }) => (
        <g key={el}>
          <circle
            cx={x}
            cy={y}
            r="22"
            fill="rgba(28,23,16,0.95)"
            stroke={ELEMENT_COLORS[el]}
            strokeWidth="2"
          />
          <text x={x} y={y - 5} textAnchor="middle" dominantBaseline="middle" fill={ELEMENT_COLORS[el]} fontSize="14" fontWeight="bold">
            {ELEMENT_HANJA[el]}
          </text>
          <text x={x} y={y + 9} textAnchor="middle" dominantBaseline="middle" fill={ELEMENT_COLORS[el]} fontSize="8">
            {ELEMENT_KO[el]}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function ComboGuide({ onClose }: ComboGuideProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        backgroundColor: 'rgba(22,19,15,0.7)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#1C1710',
          borderTop: '1px solid #2A2620',
          borderRadius: '8px 8px 0 0',
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: '20px 16px 32px',
          animation: 'slideUp 220ms ease-out',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ color: '#D9A441', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.12em' }}>
            조합 도감
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#6A6560',
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* 조합 목록 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#6A6560', fontSize: '10px', letterSpacing: '0.15em', marginBottom: '10px' }}>
            조합 목록 (약 → 강)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {COMBO_LIST.map((combo, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  backgroundColor: i === COMBO_LIST.length - 1 ? 'rgba(217,164,65,0.08)' : '#16130F',
                  border: `1px solid ${i === COMBO_LIST.length - 1 ? 'rgba(217,164,65,0.3)' : '#2A2620'}`,
                  borderRadius: '2px',
                }}
              >
                <div
                  style={{
                    minWidth: '42px',
                    textAlign: 'center',
                    color: i === COMBO_LIST.length - 1 ? '#D9A441' : '#C63D2F',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    letterSpacing: '0.02em',
                  }}
                >
                  {combo.mult}
                </div>
                <div>
                  <div style={{ color: '#D8CCB4', fontSize: '12px', fontWeight: 'bold', marginBottom: '1px' }}>
                    {combo.name}
                  </div>
                  <div style={{ color: '#6A6560', fontSize: '10px' }}>
                    {combo.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 상극 관계 도표 */}
        <div>
          <div style={{ color: '#6A6560', fontSize: '10px', letterSpacing: '0.15em', marginBottom: '10px' }}>
            상극 관계 (화살표 방향이 이기는 방향)
          </div>
          <GeukCircleChart />
          <div style={{ textAlign: 'center', marginTop: '8px', color: '#6A6560', fontSize: '10px', lineHeight: '1.8' }}>
            <div>나무 → 흙 → 물 → 불 → 쇠 → 나무</div>
            <div style={{ color: '#4A4540' }}>적 기운을 이기는 기운으로 공격하면 피해가 늘어난다</div>
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
