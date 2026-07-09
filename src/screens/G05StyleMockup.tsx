/**
 * G05StyleMockup — 팔자전 G0.5 스타일 시안 3종
 *
 * 시안 1: 전투 화면 목업 (390×844 레이아웃)
 * 시안 2: 카드 3상태 (기본 / 선택 / 역극)
 * 시안 3: 타이포 예시 (족보명 / 데미지 팝업 / 운세 텍스트)
 *
 * 색상: 스펙 §8 hex 고정
 * 폰트: Pretendard / 나눔손글씨 붓 / 본명조(Noto Serif KR)
 */

import React, { useState } from 'react'

// ─── 색상 상수 ────────────────────────────────────────────
const C = {
  bg:          '#16130F',
  bgCard:      '#241F18',
  hanji:       '#E8DCC4',
  juSa:        '#B33A2B',
  ink:         '#2A2620',
  hanjiText:   '#D8CCB4',
  // 오방색
  wood:        '#4A9B6E',
  woodGlow:    '#7BD4A3',
  fire:        '#C63D2F',
  fireGlow:    '#FF7A5C',
  earth:       '#D9A441',
  earthGlow:   '#FFD98A',
  gold:        '#E8E3D5',
  goldGlow:    '#FFFFFF',
  water:       '#3D5A80',
  waterGlow:   '#8FB8DE',
  // 등급
  rareFrame:   '#B33A2B',
  heroFrame:   '#C9A227',
} as const

// ─── 오행 헬퍼 ───────────────────────────────────────────

type Element5 = '木' | '火' | '土' | '金' | '水'

function elementColor(el: Element5): string {
  const map: Record<Element5, string> = {
    木: C.wood, 火: C.fire, 土: C.earth, 金: C.gold, 水: C.water,
  }
  return map[el]
}

function elementGlow(el: Element5): string {
  const map: Record<Element5, string> = {
    木: C.woodGlow, 火: C.fireGlow, 土: C.earthGlow, 金: C.goldGlow, 水: C.waterGlow,
  }
  return map[el]
}

// ─── 카드 컴포넌트 ────────────────────────────────────────

type CardRarity = 'normal' | 'rare' | 'hero'
type CardState  = 'default' | 'selected' | 'counter'  // counter = 역극

interface CardProps {
  value: number
  element: Element5
  yinYang: 'yin' | 'yang'
  rarity?: CardRarity
  state?: CardState
  /** 부채꼴 배치용 회전각 (deg) */
  rotate?: number
  /** 부채꼴 배치용 translateY (px) */
  fanOffset?: number
}

function PaljapaeCard({
  value,
  element,
  yinYang,
  rarity = 'normal',
  state = 'default',
  rotate = 0,
  fanOffset = 0,
}: CardProps) {
  const elColor  = elementColor(element)
  const elGlow   = elementGlow(element)
  const isSelected = state === 'selected'
  const isCounter  = state === 'counter'

  // 프레임 테두리 색
  const frameColor =
    rarity === 'hero'   ? C.heroFrame  :
    rarity === 'rare'   ? C.rareFrame  :
    C.hanji

  // 영웅 등급 금박 반짝임 효과 (CSS keyframe은 인라인 불가, style tag로 처리)
  const heroGlow = rarity === 'hero'
    ? `0 0 8px 2px ${C.heroFrame}88, 0 0 16px 4px ${C.heroFrame}44`
    : undefined

  const cardStyle: React.CSSProperties = {
    width: 72,
    height: 101,   // 5:7 비율 (72 × 1.4 = 100.8)
    borderRadius: 8,
    border: isSelected
      ? `2px solid ${elGlow}`
      : `2px solid ${frameColor}`,
    background: C.bgCard,
    position: 'relative',
    flexShrink: 0,
    cursor: 'pointer',
    transform: `rotate(${rotate}deg) translateY(${isSelected ? fanOffset - 16 : fanOffset}px)`,
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    boxShadow: isSelected
      ? `0 0 12px 3px ${elGlow}88`
      : heroGlow ?? undefined,
    overflow: 'hidden',
    opacity: isCounter ? 0.4 : 1,
  }

  return (
    <div style={cardStyle}>
      {/* 속성 배경 틴트 (12% 오파시티) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: elColor,
        opacity: 0.12,
        borderRadius: 6,
      }} />

      {/* 역극 오버레이 */}
      {isCounter && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `${C.bg}99`,  // 60% 오버레이
          filter: 'saturate(0.3)',
          borderRadius: 6,
          zIndex: 10,
        }} />
      )}

      {/* 좌상단: 값 */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 5,
        fontSize: 16,
        fontWeight: 700,
        fontFamily: 'Pretendard, sans-serif',
        color: C.hanjiText,
        lineHeight: 1,
        zIndex: 5,
      }}>
        {value}
      </div>

      {/* 우상단: 음양 기호 */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 5,
        fontSize: 12,
        color: C.hanjiText,
        lineHeight: 1,
        zIndex: 5,
      }}>
        {yinYang === 'yang' ? '●' : '○'}
      </div>

      {/* 중앙 문양 (속성 한자 대형) */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -55%)',
        fontSize: 32,
        fontFamily: 'Noto Serif KR, serif',
        fontWeight: 700,
        color: elColor,
        opacity: 0.55,
        zIndex: 5,
        userSelect: 'none',
      }}>
        {element}
      </div>

      {/* 하단: 속성 한자 소자 */}
      <div style={{
        position: 'absolute',
        bottom: 5,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 13,
        fontFamily: 'Noto Serif KR, serif',
        fontWeight: 700,
        color: elColor,
        zIndex: 5,
      }}>
        {element}
      </div>
    </div>
  )
}

// ─── 시안 1: 전투 화면 목업 ──────────────────────────────

const FAN_CARDS: CardProps[] = [
  { value: 3, element: '水', yinYang: 'yin',  rotate: -21, fanOffset: 28 },
  { value: 7, element: '木', yinYang: 'yang', rotate: -14, fanOffset: 14 },
  { value: 2, element: '火', yinYang: 'yin',  rotate: -7,  fanOffset: 6 },
  { value: 9, element: '土', yinYang: 'yang', rotate:  0,  fanOffset: 0 },
  { value: 4, element: '金', yinYang: 'yin',  rotate:  7,  fanOffset: 6 },
  { value: 6, element: '木', yinYang: 'yang', rotate: 14,  fanOffset: 14 },
  { value: 1, element: '火', yinYang: 'yin',  rotate: 21,  fanOffset: 28 },
  { value: 8, element: '水', yinYang: 'yang', rotate: 28,  fanOffset: 44 },
]

function BattleScreenMockup() {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  return (
    <div style={{
      width: 390,
      height: 844,
      background: C.bg,
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      border: `1px solid ${C.bgCard}`,
      boxShadow: '0 8px 48px #000a',
    }}>

      {/* ── 상단바 6% ≈ 50px ── */}
      <div style={{
        height: 50,
        background: C.bgCard,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: `1px solid ${C.juSa}33`,
        flexShrink: 0,
      }}>
        <span style={{ color: C.hanjiText, fontFamily: 'Pretendard, sans-serif', fontSize: 13 }}>
          3층  甲午日
        </span>
        {/* 체력바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.fireGlow, fontFamily: 'Pretendard, sans-serif', fontSize: 12 }}>
            HP
          </span>
          <div style={{
            width: 100, height: 8, background: '#ffffff22', borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              width: '72%', height: '100%',
              background: `linear-gradient(90deg, ${C.fire}, ${C.fireGlow})`,
              borderRadius: 4,
            }} />
          </div>
          <span style={{ color: C.hanjiText, fontFamily: 'Pretendard, sans-serif', fontSize: 12 }}>
            22/30
          </span>
        </div>
      </div>

      {/* ── 적 영역 24% ≈ 202px ── */}
      <div style={{
        height: 202,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '12px 0',
        flexShrink: 0,
      }}>
        {/* 적 일러스트 플레이스홀더 */}
        <div style={{
          width: 110,
          height: 110,
          borderRadius: 12,
          background: C.bgCard,
          border: `1px solid ${C.juSa}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            color: C.juSa,
            fontFamily: 'Noto Serif KR, serif',
            fontSize: 36,
            opacity: 0.7,
          }}>
            鬼
          </span>
        </div>
        {/* 적 이름 + 체력바 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ color: C.hanjiText, fontFamily: 'Pretendard, sans-serif', fontSize: 13 }}>
            화염귀병 (金속성)
          </span>
          <div style={{
            width: 160, height: 10, background: '#ffffff22', borderRadius: 5, overflow: 'hidden',
          }}>
            <div style={{
              width: '55%', height: '100%',
              background: `linear-gradient(90deg, ${C.juSa}, ${C.fireGlow})`,
              borderRadius: 5,
            }} />
          </div>
          <span style={{ color: '#ffffff88', fontFamily: 'Pretendard, sans-serif', fontSize: 11 }}>
            33 / 60
          </span>
        </div>
      </div>

      {/* ── 족보 미리보기 띠 10% ≈ 84px ── */}
      <div style={{
        height: 84,
        background: `${C.bgCard}cc`,
        borderTop: `1px solid ${C.juSa}55`,
        borderBottom: `1px solid ${C.juSa}55`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '0 16px',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: `${C.wood}22`,
          border: `1px solid ${C.woodGlow}66`,
          borderRadius: 8,
          padding: '6px 16px',
        }}>
          <span style={{
            fontFamily: "'Nanum Brush Script', '나눔손글씨 붓', cursive",
            fontSize: 20,
            color: C.woodGlow,
            letterSpacing: 1,
          }}>
            상생 3체인
          </span>
          <span style={{
            fontFamily: 'Pretendard, sans-serif',
            fontSize: 22,
            fontWeight: 700,
            color: C.earthGlow,
          }}>
            ×4
          </span>
        </div>
      </div>

      {/* ── 핸드 (부채꼴 8장) 36% ≈ 304px ── */}
      <div style={{
        height: 304,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 16px',
        flexShrink: 0,
        position: 'relative',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: -8,
          position: 'relative',
        }}>
          {FAN_CARDS.map((card, i) => (
            <div
              key={i}
              onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
              style={{ marginLeft: i === 0 ? 0 : -18, cursor: 'pointer' }}
            >
              <PaljapaeCard
                {...card}
                state={selectedIdx === i ? 'selected' : 'default'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 버리기/출수 버튼 12% ≈ 101px ── */}
      <div style={{
        height: 101,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '0 16px',
        flexShrink: 0,
        background: `${C.bg}bb`,
      }}>
        <button style={{
          padding: '10px 22px',
          background: 'transparent',
          border: `1px solid ${C.hanjiText}66`,
          borderRadius: 8,
          color: C.hanjiText,
          fontFamily: 'Pretendard, sans-serif',
          fontSize: 14,
          cursor: 'pointer',
        }}>
          버리기 0/3
        </button>
        <button style={{
          padding: '10px 28px',
          background: C.juSa,
          border: 'none',
          borderRadius: 8,
          color: C.hanji,
          fontFamily: 'Pretendard, sans-serif',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}>
          출수 0/4
        </button>
      </div>

      {/* ── 패시브 슬롯 5칸 12% ≈ 101px ── */}
      <div style={{
        height: 101,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '0 16px',
        flexShrink: 0,
        background: C.bgCard,
        borderTop: `1px solid ${C.juSa}33`,
      }}>
        {(['木', '火', '土', '金', '水'] as Element5[]).map((el) => (
          <div key={el} style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            border: `1px solid ${elementColor(el)}88`,
            background: `${elementColor(el)}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'Noto Serif KR, serif',
              fontSize: 20,
              color: elementColor(el),
              opacity: 0.85,
            }}>
              {el}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 시안 2: 카드 3상태 ──────────────────────────────────

function CardStates() {
  return (
    <div style={{
      background: C.bgCard,
      borderRadius: 16,
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
    }}>
      <h3 style={{
        fontFamily: 'Pretendard, sans-serif',
        fontSize: 13,
        color: C.hanjiText,
        margin: 0,
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: 0.7,
      }}>
        시안 2 — 카드 3상태
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40 }}>

        {/* 기본 상태 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <PaljapaeCard value={7} element="木" yinYang="yang" state="default" />
          <span style={{
            fontFamily: 'Pretendard, sans-serif', fontSize: 12, color: C.hanjiText, opacity: 0.65,
          }}>
            기본
          </span>
        </div>

        {/* 선택 상태 (위로 16px 올라감 + 목 글로우) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <PaljapaeCard value={7} element="木" yinYang="yang" state="selected" />
          <span style={{
            fontFamily: 'Pretendard, sans-serif', fontSize: 12, color: C.woodGlow, opacity: 0.9,
          }}>
            선택
          </span>
        </div>

        {/* 역극 상태 (먹빛 오버레이 + 채도 제거) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ filter: 'saturate(0.3)' }}>
            <PaljapaeCard value={7} element="木" yinYang="yang" state="counter" />
          </div>
          <span style={{
            fontFamily: 'Pretendard, sans-serif', fontSize: 12, color: '#ffffff55',
          }}>
            역극
          </span>
        </div>
      </div>

      {/* 희귀/영웅 등급 예시 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: 8 }}>
        <PaljapaeCard value={5} element="火" yinYang="yin"  rarity="normal" />
        <PaljapaeCard value={8} element="土" yinYang="yang" rarity="rare" />
        <PaljapaeCard value={3} element="金" yinYang="yin"  rarity="hero" />
      </div>
      <div style={{ display: 'flex', gap: 24, marginTop: -20 }}>
        {(['일반', '희귀', '영웅'] as const).map((label) => (
          <span key={label} style={{
            width: 72, textAlign: 'center',
            fontFamily: 'Pretendard, sans-serif', fontSize: 11,
            color: label === '영웅' ? C.heroFrame : label === '희귀' ? C.juSa : C.hanjiText,
            opacity: 0.8,
          }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── 시안 3: 타이포 예시 ─────────────────────────────────

function TypographyShowcase() {
  return (
    <div style={{
      background: C.bgCard,
      borderRadius: 16,
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 28,
    }}>
      <h3 style={{
        fontFamily: 'Pretendard, sans-serif',
        fontSize: 13,
        color: C.hanjiText,
        margin: 0,
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: 0.7,
      }}>
        시안 3 — 타이포그래피
      </h3>

      {/* 족보명 28px 붓글씨 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          fontFamily: 'Pretendard, sans-serif', fontSize: 10, color: C.hanjiText, opacity: 0.5,
          letterSpacing: 1,
        }}>
          족보명 — 나눔손글씨 붓 28px
        </span>
        <span style={{
          fontFamily: "'Nanum Brush Script', '나눔손글씨 붓', cursive",
          fontSize: 28,
          color: C.woodGlow,
          letterSpacing: 2,
          textShadow: `0 0 12px ${C.woodGlow}88`,
        }}>
          상생 3체인
        </span>
      </div>

      {/* 데미지 팝업 64px */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          fontFamily: 'Pretendard, sans-serif', fontSize: 10, color: C.hanjiText, opacity: 0.5,
          letterSpacing: 1,
        }}>
          데미지 팝업 — 나눔손글씨 붓 64px
        </span>
        <span style={{
          fontFamily: "'Nanum Brush Script', '나눔손글씨 붓', cursive",
          fontSize: 64,
          color: C.fire,
          lineHeight: 1,
          textShadow: `0 0 18px ${C.fireGlow}aa, 0 2px 4px #000`,
          letterSpacing: -2,
        }}>
          342
        </span>
      </div>

      {/* 운세 풀이 본명조 15px 행간 1.7 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          fontFamily: 'Pretendard, sans-serif', fontSize: 10, color: C.hanjiText, opacity: 0.5,
          letterSpacing: 1,
        }}>
          운세/서사 — 본명조(Noto Serif KR) Light 15px / 행간 1.7
        </span>
        <p style={{
          fontFamily: '"Noto Serif KR", serif',
          fontWeight: 300,
          fontSize: 15,
          lineHeight: 1.7,
          color: C.hanjiText,
          margin: 0,
          maxWidth: 300,
        }}>
          갑오년 병오월 무오일, 세 개의 午火가 겹쳐<br />
          그대의 命局은 불길이 하늘을 가리는 형세라.<br />
          이 싸움에서 금(金)을 품은 자를 조심하라.
        </p>
      </div>

      {/* UI 본문 Pretendard 14~16px */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          fontFamily: 'Pretendard, sans-serif', fontSize: 10, color: C.hanjiText, opacity: 0.5,
          letterSpacing: 1,
        }}>
          UI 본문 — Pretendard 14~16px
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 16, color: C.hanjiText }}>
            덱에 남은 카드: 24장 / 버린 카드: 8장
          </span>
          <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 14, color: C.hanjiText, opacity: 0.75 }}>
            출수 가능 횟수 3/4 · 에너지 2/3
          </span>
        </div>
      </div>

      {/* 카드 수치 Pretendard Bold 22px */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          fontFamily: 'Pretendard, sans-serif', fontSize: 10, color: C.hanjiText, opacity: 0.5,
          letterSpacing: 1,
        }}>
          카드 수치 — Pretendard Bold 22px
        </span>
        <div style={{ display: 'flex', gap: 20, alignItems: 'baseline' }}>
          {([7, 3, 9, 2] as const).map((v, i) => {
            const colors = [C.wood, C.fire, C.earth, C.water]
            return (
              <span key={i} style={{
                fontFamily: 'Pretendard, sans-serif',
                fontWeight: 700,
                fontSize: 22,
                color: colors[i],
              }}>
                {v}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 메인 G05StyleMockup ─────────────────────────────────

export default function G05StyleMockup(): React.ReactElement {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      padding: '32px 24px 64px',
      overflowY: 'auto',
      fontFamily: 'Pretendard, sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 40, maxWidth: 900 }}>
        <div style={{
          fontSize: 11,
          color: C.juSa,
          letterSpacing: 3,
          fontWeight: 700,
          marginBottom: 8,
        }}>
          G0.5 STYLE MOCKUP
        </div>
        <h1 style={{
          fontFamily: 'Noto Serif KR, serif',
          fontSize: 28,
          color: C.hanji,
          margin: 0,
          letterSpacing: 2,
        }}>
          팔자전 八字戰 — 시각 시안
        </h1>
        <p style={{
          marginTop: 8,
          fontSize: 13,
          color: C.hanjiText,
          opacity: 0.65,
          lineHeight: 1.6,
        }}>
          Balatro × 오행 족보 웹게임 · 색상 §8 hex 고정 · 390×844 기준
        </p>
      </div>

      {/* 3개 시안 레이아웃 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 40,
        alignItems: 'flex-start',
        maxWidth: 1100,
      }}>

        {/* 시안 1 — 전투 화면 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            fontSize: 11,
            color: C.juSa,
            letterSpacing: 2,
            fontWeight: 700,
          }}>
            시안 1 — 전투 화면 목업
          </div>
          <BattleScreenMockup />
        </div>

        {/* 시안 2 + 시안 3 세로 배치 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          flex: 1,
          minWidth: 340,
          maxWidth: 520,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontSize: 11,
              color: C.juSa,
              letterSpacing: 2,
              fontWeight: 700,
            }}>
              시안 2 — 카드 3상태
            </div>
            <CardStates />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontSize: 11,
              color: C.juSa,
              letterSpacing: 2,
              fontWeight: 700,
            }}>
              시안 3 — 타이포그래피
            </div>
            <TypographyShowcase />
          </div>
        </div>
      </div>

      {/* 색상 팔레트 참조 */}
      <div style={{ marginTop: 48, maxWidth: 900 }}>
        <div style={{
          fontSize: 11,
          color: C.juSa,
          letterSpacing: 2,
          fontWeight: 700,
          marginBottom: 16,
        }}>
          오방색 팔레트 참조
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {(
            [
              { label: '목(木)', color: C.wood,  glow: C.woodGlow  },
              { label: '화(火)', color: C.fire,  glow: C.fireGlow  },
              { label: '토(土)', color: C.earth, glow: C.earthGlow },
              { label: '금(金)', color: C.gold,  glow: C.goldGlow  },
              { label: '수(水)', color: C.water, glow: C.waterGlow },
            ] as const
          ).map(({ label, color, glow }) => (
            <div key={label} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              alignItems: 'center',
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: color,
                boxShadow: `0 0 10px 2px ${glow}55`,
                border: `1px solid ${glow}44`,
              }} />
              <span style={{
                fontFamily: 'Pretendard, sans-serif',
                fontSize: 11,
                color: C.hanjiText,
                opacity: 0.7,
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
