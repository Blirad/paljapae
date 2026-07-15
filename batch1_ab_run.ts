import { runFullCapSimulation } from './src/engine/fullCapBot'

const MOK_HWA = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as const,
  enableFloorReward: true,
}

console.log('A안 실행 중 (1000판, 공격고정)...')
const a = runFullCapSimulation(1000, { ...MOK_HWA, enableEffectMode: false })

console.log('B안 실행 중 (1000판, 양자택일)...')
const b = runFullCapSimulation(1000, { ...MOK_HWA, enableEffectMode: true })

console.log('')
console.log('=== 배치1 A/B 게이트 — 목화 1000판 ===')
console.log(`A안 (공격고정): ${a.clearRate.toFixed(2)}%`)
console.log(`B안 (양자택일): ${b.clearRate.toFixed(2)}%`)
console.log(`차이: ${(b.clearRate - a.clearRate).toFixed(2)}%p`)
console.log(`응축/판  A: ${a.condensesPerRun.toFixed(3)}  B: ${b.condensesPerRun.toFixed(3)}`)
console.log(`버리기/판 A: ${a.discardsPerRun.toFixed(3)}  B: ${b.discardsPerRun.toFixed(3)}`)
console.log(`융합/판  A: ${a.fusionsPerRun.toFixed(3)}  B: ${b.fusionsPerRun.toFixed(3)}`)
console.log('')
console.log('판정: ' + ((b.clearRate - a.clearRate) >= -3.0 ? 'PASS (≥ A−3%p)' : 'FAIL'))
