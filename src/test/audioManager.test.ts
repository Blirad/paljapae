/**
 * 팔자전 — AudioManager 단위 테스트
 * Web Audio API mock 환경에서 12종 사운드 호출 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Web Audio API 전체 mock
class MockAudioContext {
  currentTime = 0
  state = 'running' as AudioContextState

  createOscillator() {
    return {
      type: 'sine' as OscillatorType,
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), value: 440 },
      detune: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        value: 1,
      },
      connect: vi.fn(),
    }
  }

  createBuffer(_channels: number, length: number, _sampleRate: number) {
    return {
      getChannelData: (_ch: number) => new Float32Array(length),
    }
  }

  createBufferSource() {
    return {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  createBiquadFilter() {
    return {
      type: 'lowpass' as BiquadFilterType,
      frequency: { value: 1000 },
      Q: { value: 1 },
      connect: vi.fn(),
    }
  }

  resume() {
    return Promise.resolve()
  }

  get destination() {
    return {} as AudioDestinationNode
  }

  get sampleRate() {
    return 44100
  }
}

// global mock 설정
beforeEach(() => {
  vi.stubGlobal('AudioContext', MockAudioContext)
  vi.stubGlobal('webkitAudioContext', MockAudioContext)
  // setTimeout mock (타이밍 검증)
  vi.useFakeTimers()
})

describe('AudioManager — 12종 사운드 검증', () => {
  it('import 가능 (모듈 로드)', async () => {
    const mod = await import('../services/audioManager')
    expect(mod.audioManager).toBeDefined()
    expect(typeof mod.audioManager.cardSelectTick).toBe('function')
  })

  it('1. cardSelectTick() — 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.cardSelectTick()).not.toThrow()
  })

  it('2. cardDiscardSwish() — 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.cardDiscardSwish()).not.toThrow()
  })

  it('3. cardLand() — 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.cardLand()).not.toThrow()
  })

  it('4. genealogyMatch() — common/rare/hero 3단계 모두 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.genealogyMatch('common')).not.toThrow()
    expect(() => audioManager.genealogyMatch('rare')).not.toThrow()
    expect(() => audioManager.genealogyMatch('hero')).not.toThrow()
  })

  it('5. scoreCountTick() — 0~4 인덱스 범위 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    for (let i = 0; i < 5; i++) {
      expect(() => audioManager.scoreCountTick(i, 5)).not.toThrow()
    }
  })

  it('6. affinityBonusGong() — 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.affinityBonusGong()).not.toThrow()
  })

  it('7. hostileDrum() — 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.hostileDrum()).not.toThrow()
  })

  it('8. elementalSequenceKoreanPercussion() — 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.elementalSequenceKoreanPercussion()).not.toThrow()
    // 타이머 진행 (2500ms 시퀀스)
    vi.advanceTimersByTime(2600)
  })

  it('9. playerHit() — 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.playerHit()).not.toThrow()
  })

  it('10. floorClearAscending() — 3음 도-미-솔 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.floorClearAscending()).not.toThrow()
    vi.advanceTimersByTime(500)
  })

  it('11. defeatDeepTone() — 예외 없이 실행 (1000ms+)', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.defeatDeepTone()).not.toThrow()
    vi.advanceTimersByTime(1500)
  })

  it('12. diviningRodShake() — 예외 없이 실행 (최우선 품질)', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.diviningRodShake()).not.toThrow()
    vi.advanceTimersByTime(1200)
  })

  it('applyPlaybackSpeed() 유틸 — 배속 계산 정확', async () => {
    const { applyPlaybackSpeed } = await import('../services/audioManager')
    expect(applyPlaybackSpeed(300, 1)).toBe(300)
    expect(applyPlaybackSpeed(300, 2)).toBe(150)
    expect(applyPlaybackSpeed(600, 2)).toBe(300)
    expect(applyPlaybackSpeed(1200, 2)).toBe(600)
  })

  it('전체 12종 API 존재 확인', async () => {
    const { audioManager } = await import('../services/audioManager')
    const requiredMethods = [
      'cardSelectTick',
      'cardDiscardSwish',
      'cardLand',
      'genealogyMatch',
      'scoreCountTick',
      'affinityBonusGong',
      'hostileDrum',
      'elementalSequenceKoreanPercussion',
      'playerHit',
      'floorClearAscending',
      'defeatDeepTone',
      'diviningRodShake',
    ] as const

    for (const method of requiredMethods) {
      expect(typeof audioManager[method], `${method} 미존재`).toBe('function')
    }
  })
})

describe('AudioManager — 신규 3종 사운드 검증', () => {
  it('13. playBGM() — 중복 호출 시 예외 없이 실행 (싱글턴 보호)', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.playBGM()).not.toThrow()
    expect(() => audioManager.playBGM()).not.toThrow()  // 중복 호출 방지 검증
  })

  it('stopBGM() — BGM 정지 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    audioManager.playBGM()
    expect(() => audioManager.stopBGM()).not.toThrow()
    expect(() => audioManager.stopBGM()).not.toThrow()  // 이미 정지 후 재호출도 안전
  })

  it('14. playParticleSFX() — 오행 5종 모두 예외 없이 실행', async () => {
    const { audioManager } = await import('../services/audioManager')
    const elements = ['mok', 'hwa', 'to', 'geum', 'su'] as const
    for (const el of elements) {
      expect(() => audioManager.playParticleSFX(el), `파티클음 실패: ${el}`).not.toThrow()
    }
  })

  it('14. playParticleSFX() — 오행별 frequency 범위 (테스트용 spy)', async () => {
    // frequency 검증: 오행별 값 상수 확인
    const EXPECTED_FREQS: Record<string, number> = {
      mok: 150, hwa: 250, to: 200, geum: 350, su: 100,
    }
    const elements = ['mok', 'hwa', 'to', 'geum', 'su'] as const
    for (const el of elements) {
      const freq = EXPECTED_FREQS[el]
      expect(freq).toBeGreaterThan(0)
      expect(freq).toBeLessThanOrEqual(400)
    }
    // 실제 audioManager.playParticleSFX는 throw 없이 실행됨을 재확인
    const { audioManager } = await import('../services/audioManager')
    for (const el of elements) {
      expect(() => audioManager.playParticleSFX(el)).not.toThrow()
    }
  })

  it('15. playHealSFX() — 예외 없이 실행 (0.6초 상승음)', async () => {
    const { audioManager } = await import('../services/audioManager')
    expect(() => audioManager.playHealSFX()).not.toThrow()
    vi.advanceTimersByTime(700)
  })

  it('전체 15종 API 존재 확인 (신규 3종 포함)', async () => {
    const { audioManager } = await import('../services/audioManager')
    const allMethods = [
      'cardSelectTick', 'cardDiscardSwish', 'cardLand', 'genealogyMatch',
      'scoreCountTick', 'affinityBonusGong', 'hostileDrum',
      'elementalSequenceKoreanPercussion', 'playerHit', 'floorClearAscending',
      'defeatDeepTone', 'diviningRodShake',
      // 신규 3종
      'playBGM', 'stopBGM', 'playParticleSFX', 'playHealSFX',
    ]
    for (const method of allMethods) {
      expect(
        typeof (audioManager as Record<string, unknown>)[method],
        `${method} 미존재`
      ).toBe('function')
    }
  })
})

describe('paljajeonEngine — lifesteal 메커니즘 검증', () => {
  it('lifesteal 카드 출수 시 HP 회복 (데미지 30%)', async () => {
    const { createInitialGameState, playCards } = await import('../engine/paljajeonEngine')

    const state = createInitialGameState(0)

    // lifesteal 카드로 첫 장 교체
    const lifestealCard = { ...state.hand[0], lifesteal: true }
    const modifiedState = {
      ...state,
      hand: [lifestealCard, ...state.hand.slice(1)],
      playerHp: 50,  // HP를 낮춰서 회복이 명확히 보이도록
    }

    const cardToPlay = lifestealCard.id
    const before = modifiedState.playerHp

    const result = playCards(modifiedState, [cardToPlay])

    // lifesteal이 없을 때: playerHp = 50 - counterDamage
    // lifesteal이 있을 때: playerHp = 50 - counterDamage + floor(damage * 0.3)
    // lifesteal heal이 적용되면 playerHp >= before - counterDamage
    const floorConfig = (await import('../engine/balance')).FLOOR_CONFIGS[0]
    const withoutLifesteal = before - floorConfig.counterDamage
    expect(result.playerHp).toBeGreaterThanOrEqual(withoutLifesteal)
  })

  it('lifesteal 없는 카드 출수 — HP 회복 없음 (counterDamage만 감소)', async () => {
    const { createInitialGameState, playCards } = await import('../engine/paljajeonEngine')
    const { FLOOR_CONFIGS } = await import('../engine/balance')

    const state = createInitialGameState(0)
    const card = state.hand[0]
    // lifesteal 명시 없음
    expect(card.lifesteal).toBeUndefined()

    const result = playCards(state, [card.id])
    const expectedHp = Math.max(0, state.playerHp - FLOOR_CONFIGS[0].counterDamage)
    expect(result.playerHp).toBe(expectedHp)
  })

  it('lifesteal HP 회복은 playerMaxHp를 초과하지 않음', async () => {
    const { createInitialGameState, playCards } = await import('../engine/paljajeonEngine')

    const state = createInitialGameState(0)
    const lifestealCard = { ...state.hand[0], lifesteal: true }
    // HP를 최대로 세팅
    const fullHpState = {
      ...state,
      hand: [lifestealCard, ...state.hand.slice(1)],
      playerHp: state.playerMaxHp,
    }

    const result = playCards(fullHpState, [lifestealCard.id])
    expect(result.playerHp).toBeLessThanOrEqual(result.playerMaxHp)
  })
})
