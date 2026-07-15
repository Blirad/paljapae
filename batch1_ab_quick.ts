import { runFullCapSimulation } from './src/engine/fullCapBot'

const MOK_HWA = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as const,
  enableFloorReward: true,
}

console.log('A안 빠른 검증 (100판, 공격고정)...')
const a = runFullCapSimulation(100, { ...MOK_HWA, enableEffectMode: false })

console.log('B안 빠른 검증 (100판, 양자택일)...')
const b = runFullCapSimulation(100, { ...MOK_HWA, enableEffectMode: true })

console.log('')
console.log('=== 배치1 빠른 검증 — 목화 100판 ===')
console.log(`A안 (공격고정): ${a.clearRate.toFixed(2)}%`)
console.log(`B안 (양자택일): ${b.clearRate.toFixed(2)}%`)
console.log(`차이: ${(b.clearRate - a.clearRate).toFixed(2)}%p`)
console.log('')
console.log('판정: ' + ((b.clearRate - a.clearRate) >= -3.0 ? 'PASS (≥ A−3%p)' : 'FAIL'))
console.log('⚠️  참고: 100판 빠른 검증. 공식 게이트는 1000판 실행 중...')
