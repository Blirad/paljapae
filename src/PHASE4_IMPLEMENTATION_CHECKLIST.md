# Phase 4 (PvP) 구현 체크리스트

**프로젝트**: 운명카드전
**작성일**: 2026-07-08
**상태**: 준비 작업 완료 / 본 구현 대기 중

---

## 전제 조건 (구현 시작 전 필수)

- [ ] 리라 UX 스펙 `LIRA_UNMYEONG_PHASE4_PVP_UX_SPEC_20260708.md` 최종본 수신
- [ ] 도리안 서버 설계 `DORIAN_UNMYEONG_PHASE4_SERVER_DESIGN_20260708.md` 최종본 수신
- [ ] 녹스(Knox) WebSocket API 스펙 확정 및 수신

---

## 4-1: 타입 시스템 분리 (케일 담당)

- [x] `PlayerView` 인터페이스 정의 (`/src/types/pvp.ts`)
- [x] `ServerGameState` 인터페이스 정의 (`/src/types/pvp.ts`)
- [x] `GameAction` / `GameActionType` 정의 (`/src/types/pvp.ts`)
- [x] `MatchmakingState` / `MatchmakingStatus` 정의 (`/src/types/pvp.ts`)
- [x] `PvPClient` 인터페이스 스켈레톤 (`/src/services/pvpClient.ts`)
- [x] WebSocket 메시지 스키마 타입 정의 (`/src/services/pvpClient.ts`)
- [ ] `tsc --noEmit` 에러 0 최종 확인 (본 구현 완료 후)

---

## 4-2: 서버 판정 엔진 (녹스 담당 — 클라이언트 대기)

- [ ] WebSocket 서버 엔드포인트 구성
- [ ] `ServerGameState` 기반 판정 로직 구현
- [ ] `PlayerView` 변환 로직 구현 (핸드 숨김 처리)
- [ ] 턴 타이머 (60초) 서버 측 관리
- [ ] 승패 판정 및 게임 종료 처리

**케일 대기 조건**: 녹스가 WebSocket 엔드포인트 URL 및 메시지 스키마 확정 후 통보 시 착수

---

## 4-3: WebSocket 클라이언트 구현 (케일 담당)

- [x] `PvPClient` 인터페이스 정의 완료
- [x] 메시지 페이로드 타입 정의 완료
- [ ] `WebSocketPvPClient` 실제 구현체 작성
- [ ] `MockPvPClient` 테스트용 목업 구현체 작성
- [ ] 연결 재시도 로직 (네트워크 단절 처리)
- [ ] ping/pong 연결 유지 메커니즘

**선행 조건**: 4-2 서버 엔드포인트 URL 수신 후 착수

---

## 4-4: 턴 타이머 UI (케일 담당)

- [ ] 리라 스펙 §x 60초 타이머 UI 컴포넌트 구현
- [ ] `turnTimeRemaining` (PlayerView) 기반 실시간 업데이트
- [ ] 10초 이하 경고 시각 효과
- [ ] 타이머 만료 시 자동 턴 종료 처리 (`onTurnTimeout` 콜백)
- [ ] 내 턴 / 상대 턴 구분 표시

**선행 조건**: 리라 UX 스펙 §x (타이머 UI 섹션) 수신 후 착수

---

## 4-5: 매칭 로비 (케일 담당)

- [ ] `LobbyScreen` 컴포넌트 구현 (리라 UX 스펙 기반)
- [ ] 영웅 선택 + 덱 선택 UI
- [ ] 매칭 탐색 중 애니메이션
- [ ] 매칭 성공 → 게임 전환 플로우
- [ ] 매칭 취소 처리

**선행 조건**: 리라 UX 스펙 `LobbyScreen` 섹션 수신 후 착수

---

## 4-6: BattleScreen PvP 통합 (케일 담당)

- [ ] 기존 `BattleScreen` PvP 모드 지원 추가
- [ ] `GameState` 단일 참조 → `PlayerView` 참조로 분기 처리
  - 방안: `BattleScreen<T = GameState | PlayerView>` 제네릭 리팩토링
  - 또는: `PvPBattleScreen` 별도 컴포넌트 분기 (리라 스펙 확인 후 결정)
- [ ] 상대 핸드 영역: 카드 뒷면(개수) 표시
- [ ] `turnOwner` 기반 인터랙션 활성화/비활성화
- [ ] 기존 712 테스트 regression 없음 확인

**선행 조건**: 4-3 WebSocket 클라이언트 구현 완료 후 착수

---

## 4-7: QA 인계 (퀸 담당)

- [ ] Phase 4 기능 테스트 시나리오 케일 → 퀸 공유
- [ ] 매칭 → 게임 → 종료 E2E 플로우 검증
- [ ] 턴 타이머 만료 시나리오 검증
- [ ] 네트워크 단절 복구 시나리오 검증

---

## 파일 경로 정리

| 파일 | 담당 | 상태 |
|------|------|------|
| `/src/types/pvp.ts` | 케일 | 완료 (스켈레톤) |
| `/src/services/pvpClient.ts` | 케일 | 완료 (스켈레톤) |
| `/src/services/WebSocketPvPClient.ts` | 케일 | 미착수 |
| `/src/screens/LobbyScreen.tsx` | 케일 | 미착수 |
| `/src/components/battle/PvPBattleScreen.tsx` | 케일 | 미착수 |
| 서버 WebSocket 엔드포인트 | 녹스 | 미착수 |

---

## 비고

- Phase 1~3 기존 712 테스트는 BattleScreen을 직접 테스트하지 않으므로 Phase 4 준비 작업과 충돌 없음
- `pvp.ts` 타입 정의는 기존 `game.ts`, `cards.ts`, `hero.ts` 타입을 import하여 재사용 (중복 정의 없음)
- 리라/도리안 스펙 변경 발생 시 `pvp.ts` 인터페이스 즉시 갱신 필요
