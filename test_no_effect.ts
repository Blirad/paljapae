import { runFullCapSimulation } from './src/engine/fullCapBot'

console.log('50판 (enableEffectMode=false)\n')
console.time('50판')
const result = runFullCapSimulation(50, {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
  enableEffectMode: false,
})
console.timeEnd('50판')
console.log(`클리어율: ${result.clearRate.toFixed(2)}%`)
