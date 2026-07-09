/**
 * PaljapaeRewardScreen — 층간 보상 화면
 * 3택1: 카드 획득 / 유물 / 카드 강화(값 +2, 최대 10)
 * 편재 패시브 보유 시 유물 등장 확률 2배
 * 정재 패시브 보유 시 선택지 3개
 */
import React, { useState, useMemo } from 'react'
import type { PaljapaeCard, RelicId, PassiveId } from '@/types/paljapaeTypes'
import type { Element } from '@/types/paljapaeTypes'
import { RELIC_DEFS } from '@/data/paljapaeRelics'
import { PASSIVE_DEFS } from '@/data/paljapaePassives'

// ─── 색상 상수 (G0.5 §8 hex 고정) ────────────────────────
const C = {
  bg:        '#16130F',
  bgCard:    '#241F18',
  hanji:     '#E8DCC4',
  juSa:      '#B33A2B',
  ink:       '#2A2620',
  hanjiText: '#D8CCB4',
  heroFrame: '#C9A227',
  wood:      '#4A9B6E',
  fire:      '#C63D2F',
  earth:     '#D9A441',
  gold:      '#E8E3D5',
  water:     '#3D5A80',
  woodGlow:  '#7BD4A3',
  fireGlow:  '#FF7A5C',
  earthGlow: '#FFD98A',
  goldGlow:  '#FFFFFF',
  waterGlow: '#8FB8DE',
} as const

function elementColor(el: Element): string {
  const map: Record<Element, string> = {
    木: C.wood, 火: C.fire, 土: C.earth, 金: C.gold, 水: C.water,
  }
  return map[el]
}

interface CardReward {
  type: 'card'
  card: PaljapaeCard
}

interface RelicReward {
  type: 'relic'
  relicId: RelicId
}

interface UpgradeReward {
  type: 'upgrade'
  card: PaljapaeCard
  upgradedValue: number
}

type Reward = CardReward | RelicReward | UpgradeReward

interface PaljapaeRewardScreenProps {
  floor: number
  passives: PassiveId[]
  ownedRelics: RelicId[]
  hand: PaljapaeCard[]  // 현재 보유 카드 (강화용)
  onSelect: (reward: Reward) => void
  onSkip: () => void
}

// 간단한 랜덤 카드 생성
function generateRandomCard(): PaljapaeCard {
  const elements: Element[] = ['木', '火', '土', '金', '水']
  const el = elements[Math.floor(Math.random() * 5)]
  const yy = Math.random() < 0.5 ? '양' : '음' as const
  const val = Math.floor(Math.random() * 10) + 1
  return {
    id: `reward_${el}_${yy}_${Date.now()}`,
    element: el,
    yinYang: yy,
    value: val,
  }
}

// 보상 생성 (편재/정재 패시브 반영)
function generateRewards(passives: PassiveId[], ownedRelics: RelicId[], hand: PaljapaeCard[]): Reward[] {
  const hasPyeonjae = passives.includes('pyeonjae')  // 유물 확률 2배
  const hasJeongjae = passives.includes('jeongjae')  // 선택지 3개
  const count = hasJeongjae ? 3 : 2

  const ALL_RELICS: RelicId[] = ['pacheol', 'ochsaek', 'haetae', 'holibyeong']
  const availableRelics = ALL_RELICS.filter(r => !ownedRelics.includes(r))

  const rewards: Reward[] = []

  // 유물 등장 확률: 기본 33%, 편재 보유 시 66%
  const relicChance = hasPyeonjae ? 0.66 : 0.33

  for (let i = 0; i < count; i++) {
    const roll = Math.random()

    if (roll < relicChance && availableRelics.length > 0) {
      const relicId = availableRelics[Math.floor(Math.random() * availableRelics.length)]
      rewards.push({ type: 'relic', relicId })
      availableRelics.splice(availableRelics.indexOf(relicId), 1)
    } else if (roll < relicChance + 0.33 && hand.length > 0) {
      // 카드 강화 선택지
      const targetCard = hand[Math.floor(Math.random() * hand.length)]
      if (targetCard.value < 10) {
        rewards.push({
          type: 'upgrade',
          card: targetCard,
          upgradedValue: Math.min(10, targetCard.value + 2),
        })
      } else {
        rewards.push({ type: 'card', card: generateRandomCard() })
      }
    } else {
      rewards.push({ type: 'card', card: generateRandomCard() })
    }
  }

  return rewards
}

export default function PaljapaeRewardScreen({
  floor,
  passives,
  ownedRelics,
  hand,
  onSelect,
  onSkip,
}: PaljapaeRewardScreenProps): React.ReactElement {
  const rewards = useMemo(
    () => generateRewards(passives, ownedRelics, hand),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [selected, setSelected] = useState<number | null>(null)

  function handleConfirm() {
    if (selected === null) return
    onSelect(rewards[selected])
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: 390,
      height: '100dvh',
      maxHeight: 844,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 20px',
      gap: 24,
      margin: '0 auto',
      overflowY: 'auto',
    }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Nanum Brush Script', cursive",
          fontSize: 28,
          color: C.earthGlow,
          textShadow: `0 0 12px ${C.earthGlow}88`,
          marginBottom: 4,
        }}>
          {floor}층 클리어
        </div>
        <p style={{
          fontFamily: 'Noto Serif KR, serif',
          fontWeight: 300,
          fontSize: 13,
          color: C.hanjiText,
          opacity: 0.75,
          margin: 0,
        }}>
          하나를 선택하라
        </p>
      </div>

      {/* 보상 선택지 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
      }}>
        {rewards.map((reward, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: selected === i ? `${C.juSa}22` : C.bgCard,
              border: selected === i
                ? `2px solid ${C.juSa}`
                : `1px solid ${C.hanjiText}22`,
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              textAlign: 'left',
            }}
          >
            {/* 아이콘 영역 */}
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: reward.type === 'relic'
                ? `${C.heroFrame}22`
                : reward.type === 'upgrade'
                  ? `${C.water}22`
                  : `${elementColor((reward as CardReward).card.element)}22`,
              border: `1px solid ${reward.type === 'relic' ? C.heroFrame : C.hanjiText}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {reward.type === 'card' && (
                <span style={{
                  fontFamily: 'Noto Serif KR, serif',
                  fontSize: 20,
                  color: elementColor(reward.card.element),
                }}>
                  {reward.card.element}
                </span>
              )}
              {reward.type === 'relic' && (
                <span style={{ fontFamily: 'Noto Serif KR, serif', fontSize: 20, color: C.heroFrame }}>
                  器
                </span>
              )}
              {reward.type === 'upgrade' && (
                <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 18, color: C.waterGlow, fontWeight: 700 }}>
                  +2
                </span>
              )}
            </div>

            {/* 텍스트 */}
            <div style={{ flex: 1 }}>
              {reward.type === 'card' && (
                <>
                  <div style={{ color: C.hanjiText, fontFamily: 'Pretendard, sans-serif', fontSize: 14, fontWeight: 700 }}>
                    카드 획득
                  </div>
                  <div style={{ color: `${C.hanjiText}88`, fontFamily: 'Pretendard, sans-serif', fontSize: 12, marginTop: 2 }}>
                    {reward.card.element} {reward.card.yinYang} · 값 {reward.card.value}
                  </div>
                </>
              )}
              {reward.type === 'relic' && (
                <>
                  <div style={{ color: C.heroFrame, fontFamily: 'Pretendard, sans-serif', fontSize: 14, fontWeight: 700 }}>
                    {RELIC_DEFS[reward.relicId].name}
                  </div>
                  <div style={{ color: `${C.hanjiText}88`, fontFamily: 'Pretendard, sans-serif', fontSize: 12, marginTop: 2 }}>
                    {RELIC_DEFS[reward.relicId].description}
                  </div>
                </>
              )}
              {reward.type === 'upgrade' && (
                <>
                  <div style={{ color: C.waterGlow, fontFamily: 'Pretendard, sans-serif', fontSize: 14, fontWeight: 700 }}>
                    카드 강화
                  </div>
                  <div style={{ color: `${C.hanjiText}88`, fontFamily: 'Pretendard, sans-serif', fontSize: 12, marginTop: 2 }}>
                    {reward.card.element} {reward.card.yinYang} · {reward.card.value} → {reward.upgradedValue}
                  </div>
                </>
              )}
            </div>

            {/* 선택 표시 */}
            {selected === i && (
              <span style={{ color: C.juSa, fontSize: 18 }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* 확인/건너뛰기 버튼 */}
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button
          onClick={onSkip}
          style={{
            flex: 1,
            padding: '12px 0',
            background: 'transparent',
            border: `1px solid ${C.hanjiText}33`,
            borderRadius: 8,
            color: `${C.hanjiText}88`,
            fontFamily: 'Pretendard, sans-serif',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          건너뛰기
        </button>
        <button
          onClick={handleConfirm}
          disabled={selected === null}
          style={{
            flex: 2,
            padding: '12px 0',
            background: selected !== null ? C.juSa : '#3a1a1a',
            border: 'none',
            borderRadius: 8,
            color: selected !== null ? C.hanji : `${C.hanjiText}44`,
            fontFamily: 'Pretendard, sans-serif',
            fontSize: 14,
            fontWeight: 700,
            cursor: selected !== null ? 'pointer' : 'not-allowed',
          }}
        >
          선택
        </button>
      </div>

      {/* 현재 패시브 표시 */}
      {passives.length > 0 && (
        <div style={{
          width: '100%',
          padding: '12px 16px',
          background: C.bgCard,
          borderRadius: 8,
          border: `1px solid ${C.hanjiText}11`,
        }}>
          <div style={{ color: `${C.hanjiText}66`, fontSize: 11, fontFamily: 'Pretendard, sans-serif', marginBottom: 6 }}>
            장착 패시브
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {passives.map(pid => (
              <span key={pid} style={{
                fontSize: 11,
                color: C.hanjiText,
                fontFamily: 'Pretendard, sans-serif',
                background: `${C.hanjiText}11`,
                padding: '2px 8px',
                borderRadius: 4,
                border: `1px solid ${C.hanjiText}22`,
              }}>
                {PASSIVE_DEFS[pid].name.split('(')[0]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
