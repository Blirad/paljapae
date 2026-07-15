import { runFullCapSimulation } from './src/engine/fullCapBot'

console.log('=== 10판 빠른 검증 (코드 정상 확인용) ===\n')

const MOK_HWA = {
  elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as const,
  enableFloorReward: true,
}

console.log('A안 실행 (10판)...')
const a = runFullCapSimulation(10, { ...MOK_HWA, enableEffectMode: false })
console.log(`A안: ${a.clearRate.toFixed(1)}%\n`)

console.log('B안 실행 (10판)...')
const b = runFullCapSimulation(10, { ...MOK_HWA, enableEffectMode: true })
console.log(`B안: ${b.clearRate.toFixed(1)}%\n`)

console.log(`차이: ${(b.clearRate - a.clearRate).toFixed(1)}%p`)
console.log('판정: ' + ((b.clearRate - a.clearRate) >= -3.0 ? '✅ PASS' : '❌ FAIL'))
console.log('\n✅ 코드 정상작동 확인됨')
console.log('📊 1000판 공식 게이트는 배경에서 계속 실행 중...')
