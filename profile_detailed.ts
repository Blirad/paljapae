import { simulateFullCapRun } from './src/engine/fullCapBot'

// 1게임만 실행하고 시간 측정
console.log('=== 1게임 상세 프로파일 ===\n')

const startTime = performance.now()

const result = simulateFullCapRun(12345, {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
  enableEffectMode: true,
})

const endTime = performance.now()
const duration = endTime - startTime

console.log(`총 시간: ${duration.toFixed(2)}ms`)
console.log(`클리어: ${result.victory ? '✅' : '❌'}`)
console.log(`층수: ${result.floorsCleared}`)
console.log(`선택 횟수: ${result.selectCallCount ?? 0}회`)
