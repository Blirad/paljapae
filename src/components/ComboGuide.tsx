/**
 * 팔자전 — 조합 도감 (ComboGuide) Phase 1.9
 * B-5: 탭 5개 — 기운 모으기 / 융합 10쌍 / 오행연환 / 응축 / 상성
 * 낳는 ×3.0 / 벼리는 ×3.5 / "예시" 폐지 — 전 조합 공개
 */

import { useState } from 'react'
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
const ELEMENT_GLOW: Record<string, string> = {
  mok: '#7BD4A3', hwa: '#FF7A5C', to: '#FFD98A', geum: '#E8E3D5', su: '#8FB8DE',
}

// 상생 순서: 목→화→토→금→수→목
const SAENG_ORDER: Element[] = ['mok', 'hwa', 'to', 'geum', 'su']

// 상극 관계
const GEUK_MAP: Record<Element, Element> = {
  mok: 'to', hwa: 'geum', to: 'su', geum: 'mok', su: 'hwa',
}

// 상극 관계 설명
const GEUK_REASON: Record<Element, string> = {
  mok: '나무가 흙을 이긴다',
  hwa: '불이 쇠를 이긴다',
  to: '흙이 물을 이긴다',
  geum: '쇠가 나무를 이긴다',
  su: '물이 불을 이긴다',
}

// 낳는 조합 5쌍
const BIRTH_COMBOS = [
  { el1: 'mok', el2: 'hwa', name: '들불', result: 'hwa', reason: '불이 쇠를 이긴다' },
  { el1: 'hwa', el2: 'to', name: '옹기가마', result: 'to', reason: '흙이 물을 이긴다', condense: true },
  { el1: 'to', el2: 'geum', name: '광맥', result: 'geum', reason: '쇠가 나무를 이긴다' },
  { el1: 'geum', el2: 'su', name: '샘', result: 'su', reason: '물이 불을 이긴다' },
  { el1: 'su', el2: 'mok', name: '숲', result: 'mok', reason: '나무가 흙을 이긴다' },
] as const

// 벼리는 조합 5쌍
const HONE_COMBOS = [
  { el1: 'hwa', el2: 'geum', name: '주물', result: 'geum', reason: '불이 쇠를 녹인다' },
  { el1: 'geum', el2: 'mok', name: '벼림', result: 'mok', reason: '쇠가 나무를 깎는다' },
  { el1: 'mok', el2: 'to', name: '개간', result: 'to', reason: '나무가 흙을 일군다', condense: true },
  { el1: 'to', el2: 'su', name: '제방', result: 'su', reason: '흙이 물을 다스린다' },
  { el1: 'su', el2: 'hwa', name: '담금질', result: 'hwa', reason: '물이 불을 단련한다' },
] as const

// ─── 상생 원형 도표 ─────────────────────────────────────────────────────────
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

// ─── 상극 별 도표 ────────────────────────────────────────────────────────────
function GeukCircleChart() {
  const cx = 90, cy = 90, r = 64
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

// ─── 탭 1: 기운 모으기 ───────────────────────────────────────────────────────
function TabGather() {
  const rows = [
    { count: 2, mult: '×1.5', desc: '두 장' },
    { count: 3, mult: '×2.5', desc: '세 장' },
    { count: 4, mult: '×3.5', desc: '네 장' },
    { count: 5, mult: '×5.0', desc: '다섯 장 (최대)' },
  ]
  return (
    <div>
      <div style={{ color: '#D8CCB4', fontSize: '13px', letterSpacing: '0.05em', marginBottom: '16px', lineHeight: '1.6' }}>
        같은 기운을 모으면 힘이 커진다
      </div>
      <div style={{ marginBottom: '4px', display: 'flex', gap: '0', borderBottom: '1px solid rgba(216,204,180,0.2)' }}>
        {['장수', '배율', '설명'].map((h, i) => (
          <div key={h} style={{
            flex: i === 2 ? 2 : 1,
            color: '#B33A2B',
            fontSize: '12px',
            fontWeight: 700,
            padding: '4px 8px',
            letterSpacing: '0.05em',
          }}>{h}</div>
        ))}
      </div>
      {rows.map(row => (
        <div key={row.count} style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(216,204,180,0.08)', alignItems: 'center' }}>
          <div style={{ flex: 1, padding: '8px 8px', color: '#D8CCB4', fontSize: '13px' }}>{row.count}장</div>
          <div style={{ flex: 1, padding: '8px 8px', color: '#FFD98A', fontSize: '13px', fontWeight: 700 }}>{row.mult}</div>
          <div style={{ flex: 2, padding: '8px 8px', color: '#D8CCB4', fontSize: '13px' }}>{row.desc}</div>
        </div>
      ))}
    </div>
  )
}

// ─── 탭 2: 융합 10쌍 ─────────────────────────────────────────────────────────
function TabFusion() {
  const [expandedBirth, setExpandedBirth] = useState<number | null>(null)
  const [expandedHone, setExpandedHone] = useState<number | null>(null)

  return (
    <div>
      {/* 낳는 조합 5종 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: '#4A9B6E', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.12em', marginBottom: '8px' }}>
          낳는 조합 (5종)
        </div>
        <div style={{ color: '#D8CCB4', fontSize: '12px', marginBottom: '12px', lineHeight: '1.5' }}>
          기운은 낳는다 — 목과 화가 만나 불이 된다
        </div>
        <div style={{ marginBottom: '4px', display: 'flex', gap: '0', borderBottom: '1px solid rgba(216,204,180,0.2)' }}>
          {['재료', '조합명', '결과', '배율', '타격 속성'].map((h, i) => (
            <div key={h} style={{
              flex: [2, 1.5, 0.8, 0.8, 2][i],
              color: '#B33A2B', fontSize: '11px', fontWeight: 700,
              padding: '4px 4px', letterSpacing: '0.03em',
            }}>{h}</div>
          ))}
        </div>
        {BIRTH_COMBOS.map((combo, i) => {
          const isExpanded = expandedBirth === i
          return (
            <div key={combo.name}>
              <div
                style={{
                  display: 'flex',
                  gap: '0',
                  borderBottom: '1px solid rgba(216,204,180,0.08)',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedBirth(isExpanded ? null : i)}
              >
                <div style={{ flex: 2, padding: '8px 4px', color: '#D8CCB4', fontSize: '12px' }}>
                  {ELEMENT_HANJA[combo.el1]}({ELEMENT_KO[combo.el1]}) + {ELEMENT_HANJA[combo.el2]}({ELEMENT_KO[combo.el2]})
                </div>
                <div style={{ flex: 1.5, padding: '8px 4px', color: '#D8CCB4', fontSize: '12px', fontWeight: 600 }}>{combo.name}</div>
                <div style={{ flex: 0.8, padding: '8px 4px', color: ELEMENT_COLORS[combo.result], fontSize: '15px', fontWeight: 700 }}>
                  {ELEMENT_HANJA[combo.result]}
                </div>
                <div style={{ flex: 0.8, padding: '8px 4px', color: '#FFD98A', fontSize: '12px', fontWeight: 700 }}>×3.0</div>
                <div style={{ flex: 2, padding: '8px 4px', color: '#D8CCB4', fontSize: '11px' }}>{combo.reason}</div>
              </div>
              {isExpanded && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: `rgba(${combo.result === 'mok' ? '74,155,110' : combo.result === 'hwa' ? '198,61,47' : combo.result === 'to' ? '217,164,65' : combo.result === 'geum' ? '200,192,176' : '61,90,128'},0.15)`,
                  fontSize: '12px',
                  color: ELEMENT_GLOW[combo.result],
                  letterSpacing: '0.03em',
                  borderBottom: '1px solid rgba(216,204,180,0.08)',
                }}>
                  {combo.reason} +70%
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 구분선 */}
      <div style={{ borderTop: '1px solid rgba(216,204,180,0.2)', marginBottom: '20px' }} />

      {/* 벼리는 조합 5종 */}
      <div>
        <div style={{ color: '#FF7A5C', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.12em', marginBottom: '8px' }}>
          벼리는 조합 (5종)
        </div>
        <div style={{ color: '#D8CCB4', fontSize: '12px', marginBottom: '12px', lineHeight: '1.5' }}>
          기운은 벼린다 — 불과 쇠가 만나 검이 된다
        </div>
        <div style={{ marginBottom: '4px', display: 'flex', gap: '0', borderBottom: '1px solid rgba(216,204,180,0.2)' }}>
          {['재료', '조합명', '결과', '배율', '타격 속성'].map((h, i) => (
            <div key={h} style={{
              flex: [2, 1.5, 0.8, 0.8, 2][i],
              color: '#B33A2B', fontSize: '11px', fontWeight: 700,
              padding: '4px 4px', letterSpacing: '0.03em',
            }}>{h}</div>
          ))}
        </div>
        {HONE_COMBOS.map((combo, i) => {
          const isExpanded = expandedHone === i
          return (
            <div key={combo.name}>
              <div
                style={{
                  display: 'flex',
                  gap: '0',
                  borderBottom: '1px solid rgba(216,204,180,0.08)',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedHone(isExpanded ? null : i)}
              >
                <div style={{ flex: 2, padding: '8px 4px', color: '#D8CCB4', fontSize: '12px' }}>
                  {ELEMENT_HANJA[combo.el1]}({ELEMENT_KO[combo.el1]}) + {ELEMENT_HANJA[combo.el2]}({ELEMENT_KO[combo.el2]})
                </div>
                <div style={{ flex: 1.5, padding: '8px 4px', color: '#D8CCB4', fontSize: '12px', fontWeight: 600 }}>{combo.name}</div>
                <div style={{ flex: 0.8, padding: '8px 4px', color: ELEMENT_COLORS[combo.result], fontSize: '15px', fontWeight: 700 }}>
                  {ELEMENT_HANJA[combo.result]}
                </div>
                <div style={{ flex: 0.8, padding: '8px 4px', color: '#FF7A5C', fontSize: '12px', fontWeight: 700 }}>×3.5</div>
                <div style={{ flex: 2, padding: '8px 4px', color: '#D8CCB4', fontSize: '11px' }}>{combo.reason}</div>
              </div>
              {isExpanded && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: `rgba(${combo.result === 'mok' ? '74,155,110' : combo.result === 'hwa' ? '198,61,47' : combo.result === 'to' ? '217,164,65' : combo.result === 'geum' ? '200,192,176' : '61,90,128'},0.15)`,
                  fontSize: '12px',
                  color: ELEMENT_GLOW[combo.result],
                  letterSpacing: '0.03em',
                  borderBottom: '1px solid rgba(216,204,180,0.08)',
                }}>
                  {combo.reason} +70%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 탭 3: 오행연환 ──────────────────────────────────────────────────────────
function TabYeonhwan() {
  return (
    <div>
      <div style={{ color: '#D8CCB4', fontSize: '13px', lineHeight: '1.7', letterSpacing: '0.05em', marginBottom: '16px' }}>
        다섯 기운이 모여 순환을 이룬다
      </div>
      <SaengCircleChart />
      <div style={{ marginTop: '16px', marginBottom: '12px' }}>
        <div style={{ color: '#D8CCB4', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>구성 조건</div>
        <div style={{ color: '#D8CCB4', fontSize: '12px', lineHeight: '1.8' }}>
          <div>· 木·火·土·金·水 5기운 각 1장 이상</div>
          <div>· 정확히 5장 선택</div>
        </div>
      </div>
      <div style={{
        padding: '8px 12px',
        backgroundColor: 'rgba(217,164,65,0.1)',
        border: '1px solid #D9A441',
        borderRadius: '2px',
        marginBottom: '12px',
      }}>
        <div style={{ color: '#FFD98A', fontSize: '13px', fontWeight: 700 }}>배율: ×8</div>
        <div style={{ color: '#D8CCB4', fontSize: '12px', marginTop: '4px' }}>연출: 2.5초 상생 순환 애니메이션 전용 시퀀스</div>
      </div>
      <div style={{
        padding: '10px 12px',
        backgroundColor: 'rgba(61,90,128,0.15)',
        border: '1px solid rgba(143,184,222,0.4)',
        borderRadius: '2px',
      }}>
        <div style={{ color: '#8FB8DE', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>원탭 완성법</div>
        <div style={{ color: '#D8CCB4', fontSize: '12px', lineHeight: '1.8' }}>
          <div>1. 핸드에 5기운이 모두 있으면 카드에 반짝임</div>
          <div>2. [연환 완성하기] 버튼 클릭</div>
          <div>3. 나머지 4장 자동 선택 완료</div>
        </div>
      </div>
    </div>
  )
}

// ─── 탭 4: 응축 확정판 (Phase 1.9.5 — 옹기가마 전용 장수 비례표) ────────────
function TabCondense() {
  return (
    <div>
      <div style={{ color: '#D8CCB4', fontSize: '13px', lineHeight: '1.7', letterSpacing: '0.05em', marginBottom: '16px', fontStyle: 'italic' }}>
        흙은 힘을 담는다. 불로 구운 그릇은, 더 큰 힘을 담는다.
      </div>
      <div style={{ color: '#FFD98A', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>옹기가마 (火+土→土) 장수 비례표</div>
      <div style={{ marginBottom: '4px', display: 'flex', borderBottom: '1px solid rgba(216,204,180,0.2)' }}>
        {['태운 장수', '배율', '다음 공격 보너스'].map((h, i) => (
          <div key={h} style={{
            flex: [1, 1, 2][i],
            color: '#B33A2B', fontSize: '11px', fontWeight: 700,
            padding: '4px 6px',
          }}>{h}</div>
        ))}
      </div>
      {[
        { count: '2장', mult: '×2.2', pct: '+120%' },
        { count: '3장', mult: '×2.6', pct: '+160%' },
        { count: '4장', mult: '×3.0', pct: '+200%' },
        { count: '5장', mult: '×3.4', pct: '+240%' },
      ].map(row => (
        <div
          key={row.count}
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(216,204,180,0.08)',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: 1, padding: '8px 6px', color: '#D8CCB4', fontSize: '12px' }}>{row.count}</div>
          <div style={{ flex: 1, padding: '8px 6px', color: '#FFD98A', fontSize: '13px', fontWeight: 700 }}>{row.mult}</div>
          <div style={{ flex: 2, padding: '8px 6px', color: '#FFD98A', fontSize: '13px', fontWeight: 700 }}>{row.pct}</div>
        </div>
      ))}
      <div style={{ marginTop: '16px' }}>
        <div style={{ color: '#D8CCB4', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>사용법</div>
        <div style={{ color: '#D8CCB4', fontSize: '12px', lineHeight: '1.8' }}>
          <div>· 옹기가마 조합 선택 → 공격 버튼이 2분할로 전환</div>
          <div>· [대응축] 선택 시 공격 횟수 1회 소모</div>
          <div>· 피해 없이 다음 공격에 보너스를 담는다</div>
          <div>· 태우는 장수가 많을수록 위력이 강해진다 (2~5장)</div>
          <div>· 중첩 불가, 마지막 공격 기회에 사용 불가</div>
          <div>· 영웅 옆 구슬로 상태 표시</div>
        </div>
      </div>
    </div>
  )
}

// ─── 탭 5: 특성 (Phase 1.9.5 — 10종 융합 특성) ─────────────────────────────
function TabTraits() {
  // 낟는 5종
  const BIRTH_TRAIT_ROWS = [
    { fusion: '들불', combo: '木+火', result: 'hwa', mult: '×3.0', trait: '번짐', effect: '피해의 30%가 다음 공격에 잔불로 이월', borderW: 3 },
    { fusion: '광맥', combo: '土+金', result: 'geum', mult: '×3.0', trait: '채굴', effect: '공격 후 덱에서 1장 추가 드로우', borderW: 3 },
    { fusion: '샘',   combo: '金+水', result: 'su',   mult: '×3.0', trait: '정화', effect: '공격 후 기세 죽음 1종 해제', borderW: 3 },
    { fusion: '숲',   combo: '水+木', result: 'mok',  mult: '×3.0', trait: '자양', effect: '공격 후 최대 HP 8% 회복', borderW: 3 },
    { fusion: '옹기가마', combo: '火+土', result: 'to', mult: '×3.0', trait: '응축', effect: '다음 공격 +120~+240% (장수 비례)', borderW: 3 },
  ] as const

  // 벼리는 5종
  const HONE_TRAIT_ROWS = [
    { fusion: '주물',    combo: '火+金', result: 'geum', mult: '×3.5', trait: '예리',   effect: '극 보너스 ×1.5배 적용', borderW: 5 },
    { fusion: '벼림',    combo: '金+木', result: 'mok', mult: '×3.5', trait: '저격',   effect: '적의 가호(보호 효과) 1개 무효화', borderW: 5 },
    { fusion: '개간',    combo: '木+土', result: 'to',   mult: '×3.5', trait: '수확',   effect: '손의 목·토 카드 값 +1', borderW: 5 },
    { fusion: '제방',    combo: '土+水', result: 'su',   mult: '×3.5', trait: '비침',   effect: '적의 다음 강공 피해 −50%', borderW: 5 },
    { fusion: '담금질',  combo: '水+火', result: 'hwa',  mult: '×3.5', trait: '담금질', effect: '카드 값 +1 영구 (출정 내)', borderW: 5 },
  ] as const

  const borderColors: Record<string, string> = {
    hwa: '#C63D2F', geum: '#C8C0B0', su: '#3D5A80', mok: '#4A9B6E', to: '#D9A441',
  }

  const renderRow = (row: { fusion: string; combo: string; result: string; mult: string; trait: string; effect: string; borderW: number }) => (
    <div
      key={row.fusion}
      style={{
        display: 'flex',
        borderBottom: '1px solid rgba(216,204,180,0.08)',
        borderLeft: `${row.borderW}px solid ${borderColors[row.result]}`,
        alignItems: 'flex-start',
        paddingLeft: '4px',
      }}
    >
      <div style={{ flex: 1.2, padding: '7px 4px', color: '#D8CCB4', fontSize: '11px', fontWeight: 600 }}>{row.fusion}</div>
      <div style={{ flex: 1, padding: '7px 4px', color: '#6A6560', fontSize: '10px' }}>{row.combo}</div>
      <div style={{ flex: 0.6, padding: '7px 4px', color: '#FFD98A', fontSize: '11px', fontWeight: 700 }}>{row.mult}</div>
      <div style={{ flex: 0.8, padding: '7px 4px', color: ELEMENT_GLOW[row.result], fontSize: '11px', fontWeight: 700 }}>{row.trait}</div>
      <div style={{ flex: 3, padding: '7px 4px', color: '#D8CCB4', fontSize: '10px', lineHeight: '1.5' }}>{row.effect}</div>
    </div>
  )

  return (
    <div>
      {/* 낟는 특성 */}
      <div style={{ color: '#4A9B6E', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px' }}>
        낟는 특성 (5종) — ×3.0
      </div>
      <div style={{ marginBottom: '4px', display: 'flex', borderBottom: '1px solid rgba(216,204,180,0.2)', paddingLeft: '4px' }}>
        {['융합명', '기운', '배율', '특성', '효과'].map((h, i) => (
          <div key={h} style={{
            flex: [1.2, 1, 0.6, 0.8, 3][i],
            color: '#B33A2B', fontSize: '10px', fontWeight: 700, padding: '4px 4px',
          }}>{h}</div>
        ))}
      </div>
      {BIRTH_TRAIT_ROWS.map(renderRow)}

      {/* 구분선 */}
      <div style={{ borderTop: '1px solid rgba(216,204,180,0.15)', margin: '12px 0 8px' }} />

      {/* 벼리는 특성 */}
      <div style={{ color: '#FF7A5C', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px' }}>
        벼리는 특성 (5종) — ×3.5
      </div>
      <div style={{ marginBottom: '4px', display: 'flex', borderBottom: '1px solid rgba(216,204,180,0.2)', paddingLeft: '4px' }}>
        {['융합명', '기운', '배율', '특성', '효과'].map((h, i) => (
          <div key={h} style={{
            flex: [1.2, 1, 0.6, 0.8, 3][i],
            color: '#B33A2B', fontSize: '10px', fontWeight: 700, padding: '4px 4px',
          }}>{h}</div>
        ))}
      </div>
      {HONE_TRAIT_ROWS.map(renderRow)}
    </div>
  )
}

// ─── 탭 5: 상성 ──────────────────────────────────────────────────────────────
function TabAffinity() {
  const [hoveredGeuk, setHoveredGeuk] = useState<Element | null>(null)
  return (
    <div>
      <div style={{ color: '#D8CCB4', fontSize: '13px', lineHeight: '1.7', letterSpacing: '0.05em', marginBottom: '16px' }}>
        오행은 서로를 이긴다
      </div>
      <div style={{ marginBottom: '8px', color: '#C63D2F', fontSize: '11px', letterSpacing: '0.1em' }}>
        이기는 관계 (화살표 방향이 이기는 방향)
      </div>
      <GeukCircleChart />
      {hoveredGeuk && (
        <div style={{
          textAlign: 'center', color: '#FF7A5C', fontSize: '12px',
          marginTop: '8px', fontWeight: 600,
        }}>
          {GEUK_REASON[hoveredGeuk]} +70%
        </div>
      )}

      <div style={{ marginTop: '20px', marginBottom: '8px' }}>
        <div style={{ color: '#D8CCB4', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>상성 배율표</div>
        <div style={{ borderBottom: '1px solid rgba(216,204,180,0.2)', paddingBottom: '4px', marginBottom: '4px', display: 'flex' }}>
          {['관계', '배율 효과', '설명'].map((h, i) => (
            <div key={h} style={{ flex: [2, 1.5, 3][i], color: '#B33A2B', fontSize: '11px', fontWeight: 700, padding: '2px 4px' }}>{h}</div>
          ))}
        </div>
        {[
          { rel: '극 유리 (+70%)', mult: '×1.7', desc: '타격 속성이 적 기운을 이길 때', color: '#4A9B6E' },
          { rel: '극 불리 (−40%)', mult: '×0.6', desc: '적 기운이 타격 속성을 이길 때', color: '#C63D2F' },
          { rel: '중립', mult: '×1.0', desc: '상극 관계 없음', color: '#D8CCB4' },
        ].map(row => (
          <div key={row.rel} style={{ display: 'flex', borderBottom: '1px solid rgba(216,204,180,0.08)', alignItems: 'center' }}>
            <div style={{ flex: 2, padding: '7px 4px', color: row.color, fontSize: '12px', fontWeight: 600 }}>{row.rel}</div>
            <div style={{ flex: 1.5, padding: '7px 4px', color: row.color, fontSize: '12px', fontWeight: 700 }}>{row.mult}</div>
            <div style={{ flex: 3, padding: '7px 4px', color: '#D8CCB4', fontSize: '11px' }}>{row.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px' }}>
        <div style={{ color: '#D8CCB4', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>상극 관계 (전체)</div>
        <div style={{ color: '#D8CCB4', fontSize: '12px', lineHeight: '2' }}>
          {(Object.entries(GEUK_MAP) as [Element, Element][]).map(([from, to]) => (
            <div key={from}>
              <span
                style={{ color: ELEMENT_COLORS[from] }}
                onMouseEnter={() => setHoveredGeuk(from)}
                onMouseLeave={() => setHoveredGeuk(null)}
              >
                {ELEMENT_KO[from]}({ELEMENT_HANJA[from]})
              </span>
              <span style={{ color: '#6A6560' }}> 이/가 </span>
              <span style={{ color: ELEMENT_COLORS[to] }}>{ELEMENT_KO[to]}({ELEMENT_HANJA[to]})</span>
              <span style={{ color: '#6A6560' }}>을/를 이긴다</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 메인 ComboGuide ─────────────────────────────────────────────────────────
type TabKey = 'gather' | 'fusion' | 'yeonhwan' | 'condense' | 'traits' | 'affinity'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'gather', label: '기운 모으기' },
  { key: 'fusion', label: '융합 10쌍' },
  { key: 'yeonhwan', label: '오행연환' },
  { key: 'condense', label: '응축' },
  { key: 'traits', label: '특성' },
  { key: 'affinity', label: '상성' },
]

export default function ComboGuide({ onClose }: ComboGuideProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('gather')

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
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 220ms ease-out',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 0',
          flexShrink: 0,
        }}>
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

        {/* 탭 바 (5개) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #2A2620',
          padding: '8px 8px 0',
          gap: '2px',
          flexShrink: 0,
          overflowX: 'auto',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                backgroundColor: activeTab === tab.key ? '#2A2620' : 'transparent',
                border: activeTab === tab.key ? '1px solid #B33A2B' : '1px solid transparent',
                borderBottom: 'none',
                color: activeTab === tab.key ? '#D9A441' : '#6A6560',
                fontSize: '11px',
                fontWeight: activeTab === tab.key ? 700 : 400,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: '3px 3px 0 0',
                whiteSpace: 'nowrap',
                transition: 'color 150ms, background-color 150ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div style={{
          overflowY: 'auto',
          padding: '16px 16px 32px',
          flex: 1,
        }}>
          {activeTab === 'gather' && <TabGather />}
          {activeTab === 'fusion' && <TabFusion />}
          {activeTab === 'yeonhwan' && <TabYeonhwan />}
          {activeTab === 'condense' && <TabCondense />}
          {activeTab === 'traits' && <TabTraits />}
          {activeTab === 'affinity' && <TabAffinity />}
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
