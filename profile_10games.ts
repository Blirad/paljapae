import { runFullCapSimulation } from './src/engine/fullCapBot'

console.log('=== 10판 시간 측정 ===\n')

const start = performance.now()

const result = runFullCapSimulation(10, {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
  enableEffectMode: true,
})

const end = performance.now()

console.log(`총 시간: ${(end - start).toFixed(2)}ms`)
console.log(`평균: ${((end - start) / 10).toFixed(2)}ms/게임`)
console.log(`클리어율: ${result.clearRate.toFixed(1)}%`)
