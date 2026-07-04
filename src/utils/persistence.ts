/**
 * LocalStorage 진행 저장/복원 — M4
 * 마스터플랜 §12-5 (완전 서버리스, LocalStorage 사용)
 *
 * 저장 항목:
 *  - 보유 카드 풀 ID 배열
 *  - 스테이지 클리어 기록
 *  - 현재 덱 구성
 *  - 플레이어 오행 (첫 방문 판별)
 */

import type { FiveElement } from '@/types/elements'

// ────────────────────────────────────────────────────
// LocalStorage 키
// ────────────────────────────────────────────────────

const STORAGE_KEYS = {
  OWNED_CARD_IDS: 'paljapae_owned_card_ids',
  CLEARED_STAGE_IDS: 'paljapae_cleared_stage_ids',
  CURRENT_DECK_IDS: 'paljapae_current_deck_ids',
  PLAYER_ELEMENT: 'paljapae_player_element',
  VISITED: 'paljapae_visited',
  PROCESSED_COMBOS: 'paljapae_processed_combos',
  // M5 추가
  HERO_HP: 'paljapae_hero_hp',
  HERO_MAX_HP: 'paljapae_hero_max_hp',
  HERO_NAME: 'paljapae_hero_name',
  BIRTH_DATE: 'paljapae_birth_date',
  SAVE_TIMESTAMP: 'paljapae_save_timestamp',
} as const

// ────────────────────────────────────────────────────
// 직렬화/역직렬화 헬퍼
// ────────────────────────────────────────────────────

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage 용량 초과 등 무시
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // 무시
  }
}

// ────────────────────────────────────────────────────
// 방문 여부 감지
// ────────────────────────────────────────────────────

/** 첫 방문인지 확인 */
export function isFirstVisit(): boolean {
  return localStorage.getItem(STORAGE_KEYS.VISITED) === null
}

/** 방문 기록 */
export function markVisited(): void {
  safeSet(STORAGE_KEYS.VISITED, true)
}

/** 재방문인지 확인 (저장된 진행이 있는지) */
export function hasSavedProgress(): boolean {
  return (
    localStorage.getItem(STORAGE_KEYS.PLAYER_ELEMENT) !== null &&
    localStorage.getItem(STORAGE_KEYS.CLEARED_STAGE_IDS) !== null
  )
}

// ────────────────────────────────────────────────────
// 플레이어 오행 저장/복원
// ────────────────────────────────────────────────────

export function savePlayerElement(element: FiveElement): void {
  safeSet(STORAGE_KEYS.PLAYER_ELEMENT, element)
}

export function loadPlayerElement(): FiveElement | null {
  const raw = localStorage.getItem(STORAGE_KEYS.PLAYER_ELEMENT)
  if (!raw) return null
  try {
    return JSON.parse(raw) as FiveElement
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────
// 보유 카드 풀 저장/복원
// ────────────────────────────────────────────────────

export function saveOwnedCardIds(ids: string[]): void {
  safeSet(STORAGE_KEYS.OWNED_CARD_IDS, ids)
}

export function loadOwnedCardIds(): string[] {
  return safeGet<string[]>(STORAGE_KEYS.OWNED_CARD_IDS, [])
}

// ────────────────────────────────────────────────────
// 스테이지 클리어 기록 저장/복원
// ────────────────────────────────────────────────────

export function saveClearedStageIds(ids: number[]): void {
  safeSet(STORAGE_KEYS.CLEARED_STAGE_IDS, ids)
}

export function loadClearedStageIds(): number[] {
  return safeGet<number[]>(STORAGE_KEYS.CLEARED_STAGE_IDS, [])
}

// ────────────────────────────────────────────────────
// 현재 덱 구성 저장/복원
// ────────────────────────────────────────────────────

export function saveCurrentDeckIds(ids: string[]): void {
  safeSet(STORAGE_KEYS.CURRENT_DECK_IDS, ids)
}

export function loadCurrentDeckIds(): string[] {
  return safeGet<string[]>(STORAGE_KEYS.CURRENT_DECK_IDS, [])
}

// ────────────────────────────────────────────────────
// 처리된 콤보 언락 저장/복원
// ────────────────────────────────────────────────────

export function saveProcessedCombos(comboKeys: string[]): void {
  safeSet(STORAGE_KEYS.PROCESSED_COMBOS, comboKeys)
}

export function loadProcessedCombos(): string[] {
  return safeGet<string[]>(STORAGE_KEYS.PROCESSED_COMBOS, [])
}

// ────────────────────────────────────────────────────
// M5: hero.hp / maxHp / name / birthDate / savedAt 저장/복원
// ────────────────────────────────────────────────────

export interface BirthDate {
  year: number
  month: number
  day: number
}

export function saveHeroState(hp: number, maxHp: number, name: string): void {
  safeSet(STORAGE_KEYS.HERO_HP, hp)
  safeSet(STORAGE_KEYS.HERO_MAX_HP, maxHp)
  safeSet(STORAGE_KEYS.HERO_NAME, name)
  safeSet(STORAGE_KEYS.SAVE_TIMESTAMP, Date.now())
}

export function loadHeroState(): { hp: number; maxHp: number; name: string } | null {
  const hp = safeGet<number | null>(STORAGE_KEYS.HERO_HP, null)
  const maxHp = safeGet<number | null>(STORAGE_KEYS.HERO_MAX_HP, null)
  const name = safeGet<string | null>(STORAGE_KEYS.HERO_NAME, null)
  if (hp === null || maxHp === null || name === null) return null
  return { hp: Math.max(1, hp), maxHp, name } // hp=0 방어 (리라 스펙 에러 핸들링)
}

export function saveBirthDate(date: BirthDate): void {
  safeSet(STORAGE_KEYS.BIRTH_DATE, date)
}

export function loadBirthDate(): BirthDate | null {
  return safeGet<BirthDate | null>(STORAGE_KEYS.BIRTH_DATE, null)
}

export function loadSaveTimestamp(): number | null {
  return safeGet<number | null>(STORAGE_KEYS.SAVE_TIMESTAMP, null)
}

/** 저장 시간 → 상대 시간 표시 (리라 스펙 §2-5 카피) */
export function relativeTime(savedAt: number): string {
  const diff = Date.now() - savedAt
  if (diff < 60000) return '방금 전'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
  return new Date(savedAt).toLocaleDateString('ko-KR')
}

/**
 * 저장 데이터 존재 여부 (M5 StartScreen 분기용)
 * paljapae_player_element AND paljapae_cleared_stage_ids 모두 있어야 "저장 있음"
 */
export function hasSaveData(): boolean {
  const el = localStorage.getItem(STORAGE_KEYS.PLAYER_ELEMENT)
  const stages = localStorage.getItem(STORAGE_KEYS.CLEARED_STAGE_IDS)
  return el !== null && stages !== null
}

// ────────────────────────────────────────────────────
// 전체 진행 상태 스냅샷
// ────────────────────────────────────────────────────

export interface ProgressSnapshot {
  playerElement: FiveElement | null
  ownedCardIds: string[]
  clearedStageIds: number[]
  currentDeckIds: string[]
  processedCombos: string[]
}

/** 전체 진행 상태 저장 */
export function saveProgress(snapshot: ProgressSnapshot): void {
  if (snapshot.playerElement) savePlayerElement(snapshot.playerElement)
  saveOwnedCardIds(snapshot.ownedCardIds)
  saveClearedStageIds(snapshot.clearedStageIds)
  saveCurrentDeckIds(snapshot.currentDeckIds)
  saveProcessedCombos(snapshot.processedCombos)
  markVisited()
}

/** 전체 진행 상태 복원 */
export function loadProgress(): ProgressSnapshot {
  return {
    playerElement: loadPlayerElement(),
    ownedCardIds: loadOwnedCardIds(),
    clearedStageIds: loadClearedStageIds(),
    currentDeckIds: loadCurrentDeckIds(),
    processedCombos: loadProcessedCombos(),
  }
}

// ────────────────────────────────────────────────────
// 새 게임 초기화 (진행 전부 삭제)
// ────────────────────────────────────────────────────

export function clearAllProgress(): void {
  Object.values(STORAGE_KEYS).forEach(key => safeRemove(key))
}

// ────────────────────────────────────────────────────
// Zustand 스토어와의 동기화 헬퍼
// ────────────────────────────────────────────────────

/**
 * 스토어 상태를 LocalStorage에 저장하는 구독 콜백 생성
 * 사용 예:
 *   useStageStore.subscribe(createStagePersistSubscriber())
 */
export function createStagePersistSubscriber() {
  return (state: { clearedStageIds: Set<number> }) => {
    saveClearedStageIds([...state.clearedStageIds])
  }
}

export function createUnlockPersistSubscriber() {
  return (state: { ownedCardIds: Set<string>; currentDeckIds: string[]; processedComboIds: Set<string> }) => {
    saveOwnedCardIds([...state.ownedCardIds])
    saveCurrentDeckIds(state.currentDeckIds)
    saveProcessedCombos([...state.processedComboIds])
  }
}
