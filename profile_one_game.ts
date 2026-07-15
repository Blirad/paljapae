import { simulateFullCapRun } from './src/engine/fullCapBot'
import type { FullCapSimOptions } from './src/engine/fullCapBot'

const opts: FullCapSimOptions = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 },
  enableFloorReward: true,
  enableEffectMode: true,
  seed: 12345,
}

console.time('1게임 총 소요시간')

const result = simulateFullCapRun(opts)

console.timeEnd('1게임 총 소요시간')
console.log(`클리어: ${result.cleared ? '✅' : '❌'}`)
console.log(`층수: ${result.floorsCleared}`)
