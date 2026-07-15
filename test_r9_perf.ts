import { runFullCapSimulation } from './src/engine/fullCapBot'

console.log('R9 성능 테스트: 50판\n')
console.time('50판 실행')
const result = runFullCapSimulation(50, {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
})
console.timeEnd('50판 실행')
console.log(`클리어율: ${result.clearRate.toFixed(2)}%`)
