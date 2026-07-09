/**
 * 팔자전 — Audio Manager (v1)
 * 12종 사운드 전부 Web Audio API 합성음으로 구현
 * 라이선스: Web Audio API 코드 생성 — 외부 자산 없음 (상업 사용 무제한)
 *
 * Howler.js 의존성 없음: Web Audio API만 사용하여 환경 독립성 확보
 * 팔자패 v0.8.0 자산 포팅 금지 (격리 원칙 준수)
 */

// AudioContext 싱글턴 (재사용으로 지연 최소화)
let _ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  // 자동재생 정책: 사용자 인터랙션 후 resume
  if (_ctx.state === 'suspended') {
    _ctx.resume()
  }
  return _ctx
}

/** 기본 오실레이터 유틸 */
function playTone(
  frequency: number,
  duration: number,
  options?: {
    type?: OscillatorType
    gainStart?: number
    gainEnd?: number
    delay?: number
    attack?: number
    detune?: number
  }
): void {
  const ctx = getCtx()
  const now = ctx.currentTime + (options?.delay ?? 0)
  const attack = options?.attack ?? 0.005
  const gainStart = options?.gainStart ?? 0.35
  const gainEnd = options?.gainEnd ?? 0.001

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = options?.type ?? 'sine'
  osc.frequency.setValueAtTime(frequency, now)
  if (options?.detune) osc.detune.setValueAtTime(options.detune, now)

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(gainStart, now + attack)
  gain.gain.exponentialRampToValueAtTime(gainEnd, now + duration)

  osc.start(now)
  osc.stop(now + duration + 0.01)
}

/** 노이즈 버스트 (타악/스윙 계열) */
function playNoiseBurst(duration: number, gainPeak: number, delay = 0): void {
  const ctx = getCtx()
  const bufSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1)
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  const now = ctx.currentTime + delay

  source.connect(gain)
  gain.connect(ctx.destination)

  gain.gain.setValueAtTime(gainPeak, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  source.start(now)
  source.stop(now + duration + 0.01)
}

/** 로우패스 필터 적용 노이즈 (북/둔탁 계열) */
function playFilteredNoise(
  duration: number,
  gainPeak: number,
  cutoff: number,
  delay = 0
): void {
  const ctx = getCtx()
  const bufSize = Math.ceil(ctx.sampleRate * (duration + 0.05))
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufSize; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  filter.Q.value = 1.5

  const gain = ctx.createGain()
  const now = ctx.currentTime + delay

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  gain.gain.setValueAtTime(gainPeak, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  source.start(now)
  source.stop(now + duration + 0.05)
}

// BGM 루프용 싱글턴 노드 보관
let _bgmOscillator: OscillatorNode | null = null
let _bgmGain: GainNode | null = null

export const audioManager = {
  /**
   * 1. 카드 선택 틱
   * 톡톡 소리, ~200ms
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  cardSelectTick(): void {
    playTone(1200, 0.12, { type: 'square', gainStart: 0.15, gainEnd: 0.001, attack: 0.002 })
    playTone(800, 0.06, { type: 'sine', gainStart: 0.08, gainEnd: 0.001, delay: 0.04 })
  },

  /**
   * 2. 카드 버리기 스윅
   * 슥슥 소리(스윕), ~300ms
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  cardDiscardSwish(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 주파수 하강 스윕
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.28)
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.start(now)
    osc.stop(now + 0.3)

    // 노이즈 레이어 (슥 텍스처)
    playNoiseBurst(0.2, 0.07)
  },

  /**
   * 3. 출수 착지
   * 쿵 소리, ~150ms
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  cardLand(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 피치 드롭 (쿵 특성)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.14)
    gain.gain.setValueAtTime(0.55, now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.start(now)
    osc.stop(now + 0.15)

    // 타격 노이즈 레이어
    playFilteredNoise(0.06, 0.3, 800)
  },

  /**
   * 4. 족보 성립 딱 (등급 기반 화음)
   * 맑은 딱 소리, 등급에 따라 화음 추가
   * 출처: Web Audio 합성 (상업 사용 무제한)
   *
   * @param rarity 'common'(단음) | 'rare'(2음) | 'hero'(3음)
   */
  genealogyMatch(rarity: 'common' | 'rare' | 'hero' = 'common'): void {
    // 기본 단음
    playTone(660, 0.18, { type: 'triangle', gainStart: 0.3, gainEnd: 0.001, attack: 0.003 })

    if (rarity === 'rare' || rarity === 'hero') {
      playTone(830, 0.18, { type: 'triangle', gainStart: 0.22, gainEnd: 0.001, attack: 0.003, delay: 0.06 })
    }
    if (rarity === 'hero') {
      playTone(990, 0.22, { type: 'triangle', gainStart: 0.18, gainEnd: 0.001, attack: 0.003, delay: 0.12 })
    }
  },

  /**
   * 5. 점수 카운트 틱 (피치 상승 — 카드당)
   * 틱틱틱, 800~1200 Hz 선형 상승
   * 출처: Web Audio 합성 (상업 사용 무제한)
   *
   * @param cardIndex 0~4
   * @param maxCards 총 카드 수
   */
  scoreCountTick(cardIndex: number, maxCards: number): void {
    const basePitch = 800
    const pitch = basePitch + (cardIndex / Math.max(maxCards - 1, 1)) * 400
    playTone(pitch, 0.08, { type: 'square', gainStart: 0.18, gainEnd: 0.001, attack: 0.002 })
  },

  /**
   * 6. 극 보너스 징
   * 맑은 징 소리, ~400ms 여운
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  affinityBonusGong(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 징 기본음 (배음 구조)
    const freqs = [320, 640, 960, 1280]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const vol = 0.28 / (idx + 1)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(vol, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.start(now)
      osc.stop(now + 0.42)
    })

    // 타격 임펄스
    playFilteredNoise(0.04, 0.4, 2000)
  },

  /**
   * 7. 역극 둔탁한 북
   * 둔한 북 소리, ~300ms
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  hostileDrum(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 저음 북 피치 드롭
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.25)
    gain.gain.setValueAtTime(0.45, now + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.start(now)
    osc.stop(now + 0.3)

    // 중저역 노이즈
    playFilteredNoise(0.15, 0.25, 400)
  },

  /**
   * 8. 오행연환 국악 타악 세트 (징/꽹과리/북 시퀀스)
   * 총 2500ms — 800ms(징) + 200ms간격 꽹과리 5개 + 1600ms(북+폭발)
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  elementalSequenceKoreanPercussion(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 1. 징 (800ms시작)
    ;(() => {
      const freqs = [280, 560, 840]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g)
        g.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const vol = 0.3 / (idx + 1)
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(vol, now + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
        osc.start(now)
        osc.stop(now + 0.82)
      })
    })()

    // 2. 꽹과리 5번 (5색 순차 점등, 각 200ms 간격, 800ms~1800ms)
    for (let i = 0; i < 5; i++) {
      const delay = 0.8 + i * 0.2
      const pitches = [880, 1050, 920, 1100, 980]
      ;((d: number, p: number) => {
        // 꽹과리: 고음 짧은 금속음
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g)
        g.connect(ctx.destination)
        osc.type = 'triangle'
        osc.frequency.value = p
        g.gain.setValueAtTime(0, now + d)
        g.gain.linearRampToValueAtTime(0.22, now + d + 0.005)
        g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.12)
        osc.start(now + d)
        osc.stop(now + d + 0.14)
        // 노이즈 레이어 (금속 질감)
        playFilteredNoise(0.05, 0.12, 3000, d)
      })(delay, pitches[i])
    }

    // 3. 북+폭발 (1800ms~2500ms)
    ;(() => {
      const delay = 1.8
      // 저음 북
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g)
      g.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(100, now + delay)
      osc.frequency.exponentialRampToValueAtTime(35, now + delay + 0.6)
      g.gain.setValueAtTime(0.6, now + delay + 0.004)
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.65)
      osc.start(now + delay)
      osc.stop(now + delay + 0.7)
      // 폭발 노이즈
      playFilteredNoise(0.25, 0.35, 600, delay)
    })()
  },

  /**
   * 9. 피격 (플레이어 히트)
   * 우웅 소리, ~200ms
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  playerHit(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 둔탁한 임팩트 + 피치 하강
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18)
    gain.gain.setValueAtTime(0.4, now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.start(now)
    osc.stop(now + 0.2)

    // 노이즈 텍스처
    playNoiseBurst(0.08, 0.2)
  },

  /**
   * 10. 층 클리어 3음 상승 (도-미-솔)
   * C4-E4-G4 스케일, 300ms
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  floorClearAscending(): void {
    // C4=262Hz, E4=330Hz, G4=392Hz
    const notes = [
      { freq: 262, delay: 0 },
      { freq: 330, delay: 0.15 },
      { freq: 392, delay: 0.3 },
    ]
    notes.forEach(({ freq, delay }) => {
      playTone(freq, 0.32, { type: 'triangle', gainStart: 0.28, gainEnd: 0.001, attack: 0.01, delay })
    })
  },

  /**
   * 11. 패배 저음 여운
   * 깊은 저음, 1000ms+
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  defeatDeepTone(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 기본 저음 (F1 = 43Hz 변형)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 1.2)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.45, now + 0.05)
    gain.gain.setValueAtTime(0.45, now + 0.5)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4)
    osc.start(now)
    osc.stop(now + 1.45)

    // 배음 레이어 (음산함)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(135, now + 0.1)
    osc2.frequency.exponentialRampToValueAtTime(90, now + 1.3)
    gain2.gain.setValueAtTime(0, now + 0.1)
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4)
    osc2.start(now + 0.1)
    osc2.stop(now + 1.45)
  },

  /**
   * 12. 산가지통 흔들기 (달그락, 뽑기 핵심 촉감 — 최우선 품질)
   * 목재 산가지가 통 안에서 흔들리는 소리
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  diviningRodShake(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 달그락 패턴: 불규칙 목재 타격음 8회 (1200ms 총 길이)
    const hits = [
      { delay: 0.00, freq: 1800, dur: 0.06, vol: 0.32 },
      { delay: 0.08, freq: 2100, dur: 0.05, vol: 0.28 },
      { delay: 0.14, freq: 1600, dur: 0.07, vol: 0.25 },
      { delay: 0.22, freq: 1900, dur: 0.06, vol: 0.30 },
      { delay: 0.30, freq: 2200, dur: 0.05, vol: 0.26 },
      { delay: 0.42, freq: 1700, dur: 0.07, vol: 0.22 },
      { delay: 0.55, freq: 2000, dur: 0.06, vol: 0.20 },
      { delay: 0.70, freq: 1850, dur: 0.08, vol: 0.16 },
    ]

    hits.forEach(({ delay, freq, dur, vol }) => {
      // 목재 타격: 고음 짧은 임펄스 (triangle)
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g)
      g.connect(ctx.destination)
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + delay)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + delay + dur)
      g.gain.setValueAtTime(0, now + delay)
      g.gain.linearRampToValueAtTime(vol, now + delay + 0.003)
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur)
      osc.start(now + delay)
      osc.stop(now + delay + dur + 0.01)

      // 고역 노이즈 (목재 질감)
      playFilteredNoise(dur * 0.6, vol * 0.35, 4000, delay)
    })

    // 통이 흔들리는 셰이크 배경 노이즈 (전체)
    playFilteredNoise(0.9, 0.08, 3500)
  },

  /**
   * 13. 배경음 (BGM) — 전투 중 저주파 루프
   * 60Hz 저주파 명상/배경음 톤, volume 0.35, loop true
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  playBGM(): void {
    // 이미 재생 중이면 중복 시작 방지
    if (_bgmOscillator !== null) return
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(60, ctx.currentTime)

    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.5)

    osc.start(ctx.currentTime)
    // loop: OscillatorNode는 stop 전까지 자동 루프

    _bgmOscillator = osc
    _bgmGain = gain
  },

  /**
   * BGM 정지 — fadeout 후 노드 해제
   */
  stopBGM(): void {
    if (_bgmGain === null || _bgmOscillator === null) return
    const ctx = getCtx()
    const gain = _bgmGain
    const osc = _bgmOscillator

    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.stop(ctx.currentTime + 0.85)

    _bgmOscillator = null
    _bgmGain = null
  },

  /**
   * 14. 파티클음 — 오행파티클 발동 시 효과음 (0.5초 burst)
   * 오행별 frequency: 木150 / 火250 / 土200 / 金350 / 水100 Hz
   * 출처: Web Audio 합성 (상업 사용 무제한)
   *
   * @param element 오행 Element 타입
   */
  playParticleSFX(element: 'mok' | 'hwa' | 'to' | 'geum' | 'su'): void {
    const ELEMENT_FREQ: Record<string, number> = {
      mok: 150,
      hwa: 250,
      to: 200,
      geum: 350,
      su: 100,
    }
    const frequency = ELEMENT_FREQ[element] ?? 200

    const ctx = getCtx()
    const now = ctx.currentTime

    // ADSR: attack 50ms / sustain ~400ms / release 50ms — 총 0.5초
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(frequency, now)
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.05, now + 0.05)
    osc.frequency.setValueAtTime(frequency, now + 0.45)

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05)     // attack 50ms
    gain.gain.setValueAtTime(0.4, now + 0.45)              // sustain
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5) // release 50ms

    osc.start(now)
    osc.stop(now + 0.52)
  },

  /**
   * 15. 회복음 — lifesteal 발동 시 밝은 상승음 (440→880Hz, 0.6초)
   * 출처: Web Audio 합성 (상업 사용 무제한)
   */
  playHealSFX(): void {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 소프라노 스윕: 440Hz → 880Hz
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.55)

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.5, now + 0.05)
    gain.gain.setValueAtTime(0.5, now + 0.45)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    osc.start(now)
    osc.stop(now + 0.62)

    // 배음 레이어 (맑음 강화)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now)
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.55)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.05)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc2.start(now)
    osc2.stop(now + 0.62)
  },
}

/** 재생 속도 적용 유틸 (GameContext와 연동) */
export function applyPlaybackSpeed(baseDuration: number, speed: number): number {
  return baseDuration / speed
}
