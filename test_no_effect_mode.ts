import { runFullCapSimulation } from './src/engine/fullCapBot'

console.log('10판 (enableEffectMode=false)\n')
console.time('10판')
const result = runFullCapSimulation(10, {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
  enableEffectMode: false,  // 효과모드 비활성
})
console.timeEnd('10판')
console.log(`클리어율: ${result.clearRate.toFixed(1)}%`)
