import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const FC = actual['FLOOR_CONFIGS'] as Array<{ enemyHp: number }>
  const T: Record<number,number> = {1:352,2:712,3:1088,4:680}
  return { ...actual, COMBO_RULESET_VERSION:'v4', V4_FLOOR_HP_TABLE:T, getFloorHp:(fi:number)=> T[fi+1] ?? FC[fi].enemyHp }
})
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const dist = { mok:4,hwa:4,to:2,geum:2,su:2 } as Record<Element,number>
describe.skip('hp', ()=>{ it('death causes', ()=>{
  const tal = selectTalismanBySaju(dist)
  let deaths=0, hpDeath=0
  for(let i=0;i<400;i++){
    const seed=i*12345+7777
    const c={elementDist:dist,ilganElement:'mok' as Element,favorableElement:getFavorableElement('mok'),enableFloorReward:true,enableEffectMode:true,activePassiveIds:tal}
    const r=simulateFullCapRun(seed,{...c,forceUnseongpae:'jeolji' as any})
    if(!r.victory){deaths++; if(r.deathFloor)hpDeath++}
  }
  writeFileSync('/tmp/hpcheck.txt', `deaths=${deaths} withDeathFloor=${hpDeath}\n`)
  expect(true).toBe(true)
},60000)})
