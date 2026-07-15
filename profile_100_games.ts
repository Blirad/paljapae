import { runFullCapSimulation } from './src/engine/fullCapBot'

console.log('100판 프로파일링 (enableEffectMode=false)\n')
console.time('A안 100판')
const a = runFullCapSimulation(100, {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
  enableEffectMode: false,
})
console.timeEnd('A안 100판')
console.log(`클리어율: ${a.clearRate.toFixed(2)}%\n`)

console.log('100판 프로파일링 (enableEffectMode=true)\n')
console.time('B안 100판')
const b = runFullCapSimulation(100, {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
  enableEffectMode: true,
})
console.timeEnd('B안 100판')
console.log(`클리어율: ${b.clearRate.toFixed(2)}%\n`)

console.log(`차이: ${(b.clearRate - a.clearRate).toFixed(2)}%p`)
