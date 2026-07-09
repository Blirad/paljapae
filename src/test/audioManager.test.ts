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
