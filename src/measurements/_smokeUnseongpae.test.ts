import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import type { Element } from '../types/game'
import type { UnseongpaeId } from '../engine/unseongpae'
vi.mock('../engine/balance', async () => {
  const actual = await vi.importActual('../engine/balance') as Record<string, unknown>
  const FC = actual['FLOOR_CONFIGS'] as Array<{ enemyHp: number }>
  const T: Record<number,number> = {1:352,2:712,3:1088,4:680}
  return { ...actual, COMBO_RULESET_VERSION:'v4', V4_FLOOR_HP_TABLE:T,
    getFloorHp:(fi:number)=> T[fi+1] ?? FC[fi].enemyHp }
})
const { simulateFullCapRun, selectTalismanBySaju } = await import('../engine/fullCapBot')
const { getFavorableElement } = await import('../engine/manseryeok')
const dist = { mok:4,hwa:4,to:2,geum:2,su:2 } as Record<Element,number>
describe.skip('smoke', ()=>{
  it('A/B differ + growth', ()=>{
    const tal = selectTalismanBySaju(dist)
    const RUNS=400
    const lines:string[]=[]
    for (const up of ['saengji','wangji','myoji','jeolji'] as UnseongpaeId[]) {
      let a=0,b=0,rev=0,rel=0; const g:Record<string,number>={su:0,hyu:0,sang:0,wang:0}
      for(let i=0;i<RUNS;i++){
        const seed=i*12345+7777
        const c={elementDist:dist,ilganElement:'mok' as Element,favorableElement:getFavorableElement('mok'),enableFloorReward:true,enableEffectMode:true,activePassiveIds:tal}
        const ar=simulateFullCapRun(seed,{...c,forceUnseongpae:up}); if(ar.victory)a++
        if(ar.unseongpaeFinalGyeok)g[ar.unseongpaeFinalGyeok]++
        rev+=ar.jeoljiRevives??0; rel+=ar.myogoReleases??0
        const br=simulateFullCapRun(seed,{...c}); if(br.victory)b++
      }
      lines.push(`${up}: A=${(a/RUNS*100).toFixed(1)}% B=${(b/RUNS*100).toFixed(1)}% Δ=${((a-b)/RUNS*100).toFixed(1)} | 격 su${g.su}/hyu${g.hyu}/sang${g.sang}/wang${g.wang} | rev=${rev} rel=${rel}`)
    }
    writeFileSync('/tmp/unseongpae_smoke.txt', lines.join('\n')+'\n')
    expect(true).toBe(true)
  }, 120000)
})
