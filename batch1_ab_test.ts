/**
 * 팔자전 배치 1 A/B 테스트 + 재기준선 3000판 시뮬레이션
 * 순서 2-3: enableEffectMode 양자택일 효과 도입 평가
 */

import fs from 'fs';
import { runFullCapSimulation } from './src/engine/fullCapBot';
import type { Element } from './src/types/game';

async function runBatch1() {
  console.log('팔자전 배치 1 A/B 테스트 + 재기준선 3000판');
  console.log('='.repeat(60));

  // ================================================================
  // 순서 2: A/B 게이트 (1000판 목화 배치)
  // ================================================================
  console.log('\n[순서 2] A/B 게이트 (1000판 목화)\n');

  const MOK_HWA_OPTS = {
    elementDist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    enableFloorReward: true,
  };

  // A안: enableEffectMode=false (공격 고정)
  console.log('A안 (공격 고정, 500판 샘플)...');
  const startA = Date.now();
  const resultA = runFullCapSimulation(500, {
    ...MOK_HWA_OPTS,
    enableEffectMode: false,
  });
  const timeA = Date.now() - startA;
  console.log(`완료 (${(timeA / 1000).toFixed(1)}s)`);
  console.log(`  클리어율: ${resultA.clearRate.toFixed(2)}%`);
  console.log(`  응축/판: ${resultA.condensesPerRun.toFixed(3)}`);
  console.log(`  버리기/판: ${resultA.discardsPerRun.toFixed(3)}`);

  // B안: enableEffectMode=true (양자택일)
  console.log('\nB안 (양자택일, 500판 샘플)...');
  const startB = Date.now();
  const resultB = runFullCapSimulation(500, {
    ...MOK_HWA_OPTS,
    enableEffectMode: true,
  });
  const timeB = Date.now() - startB;
  console.log(`완료 (${(timeB / 1000).toFixed(1)}s)`);
  console.log(`  클리어율: ${resultB.clearRate.toFixed(2)}%`);
  console.log(`  응축/판: ${resultB.condensesPerRun.toFixed(3)}`);
  console.log(`  버리기/판: ${resultB.discardsPerRun.toFixed(3)}`);

  const clearRateDelta = resultB.clearRate - resultA.clearRate;
  const passAB = clearRateDelta >= -3.0;
  console.log(
    `\n판정: B안 클리어율 ${clearRateDelta > 0 ? '+' : ''}${clearRateDelta.toFixed(2)}%p (기준: ≥-3.0%p) → ${passAB ? 'PASS' : 'FAIL'}`
  );

  // ================================================================
  // 순서 3: 재기준선 3000판×3종
  // ================================================================
  console.log('\n\n[순서 3] 재기준선 3000판×3종\n');

  const PRESETS = [
    {
      name: '목화',
      dist: { mok: 4, hwa: 4, to: 2, geum: 2, su: 2 } as Record<Element, number>,
    },
    {
      name: '금수',
      dist: { mok: 2, hwa: 2, to: 2, geum: 4, su: 4 } as Record<Element, number>,
    },
    {
      name: '토단일',
      dist: { mok: 1, hwa: 1, to: 14, geum: 2, su: 2 } as Record<Element, number>,
    },
  ];

  const baselineResults = [];
  for (const preset of PRESETS) {
    console.log(`${preset.name} (1000판)...`);
    const start = Date.now();
    const result = runFullCapSimulation(1000, {
      elementDist: preset.dist,
      enableFloorReward: true,
      enableEffectMode: true,
    });
    const elapsed = Date.now() - start;
    console.log(`완료 (${(elapsed / 1000).toFixed(1)}s)`);
    console.log(`  클리어율: ${result.clearRate.toFixed(2)}%`);
    console.log(`  응축/판: ${result.condensesPerRun.toFixed(3)}`);
    console.log(`  버리기/판: ${result.discardsPerRun.toFixed(3)}`);
    console.log(`  평균층수: ${result.avgFloorsCleared.toFixed(2)}`);

    baselineResults.push({
      name: preset.name,
      clearRate: result.clearRate,
      condensesPerRun: result.condensesPerRun,
      discardsPerRun: result.discardsPerRun,
      avgFloorsCleared: result.avgFloorsCleared,
    });
  }

  // ================================================================
  // 결과 파일 작성
  // ================================================================
  const outputPath = '/Users/bilard/.openclaw/workspace/ZERA_BATCH1_AB_BASELINE_20260713.md';

  const markdown = `# ZERA_BATCH1_AB_BASELINE_20260713.md

## A/B 게이트 (1000판 목화)

| 구분 | A안 (공격) | B안 (양자택일) | 판정 |
|------|-----------|--------------|------|
| 클리어율 | ${resultA.clearRate.toFixed(2)}% | ${resultB.clearRate.toFixed(2)}% | ${passAB ? '✓ PASS' : '✗ FAIL'} |
| 응축/판 | ${resultA.condensesPerRun.toFixed(3)} | ${resultB.condensesPerRun.toFixed(3)} | - |
| 버리기/판 | ${resultA.discardsPerRun.toFixed(3)} | ${resultB.discardsPerRun.toFixed(3)} | - |

**판정**: ${passAB ? 'PASS (B안 채택 가능)' : 'FAIL (3%p 이상 악화)'}

- 클리어율 차: ${clearRateDelta > 0 ? '+' : ''}${clearRateDelta.toFixed(2)}%p
- 기준선: ≥-3.0%p

## 재기준선 3000판×3종

| 프리셋 | 클리어율 | 응축/판 | 버리기/판 | 평균층수 |
|--------|----------|--------|----------|---------|
${baselineResults.map((r) => `| ${r.name} | ${r.clearRate.toFixed(2)}% | ${r.condensesPerRun.toFixed(3)} | ${r.discardsPerRun.toFixed(3)} | ${r.avgFloorsCleared.toFixed(2)} |`).join('\n')}

## 실행 환경

- 시작: 2026-07-13 (배치 1 순서 2-3)
- 엔진: fullCapBot.ts (R10 현재값)
- A안 표본: 500판 (enableEffectMode=false)
- B안 표본: 500판 (enableEffectMode=true)
- 기준선: 3000판 (3종 프리셋 × 1000판)
- 층 보상: enableFloorReward=true 적용
- 사주 가호: selectTalismanBySaju() 기본값 (프리셋별 자동 선택)

## 판정 근거

### A/B 게이트
- **기준선**: B안 클리어율이 A안 대비 3%p 이상 악화하지 않아야 PASS
- **배경**: 양자택일(enableEffectMode=true) 도입이 게임 밸런스를 유지하는지 검증
- **결과**: ${clearRateDelta > 0 ? `B안이 ${clearRateDelta.toFixed(2)}%p 향상 → 정상 범위` : `B안이 ${Math.abs(clearRateDelta).toFixed(2)}%p 악화 → ${passAB ? '허용 범위' : '초과'}`}

### 재기준선
- **목화 프리셋**: 기존 기준선 유지 (목표: ~50-60% 클리어율)
- **금수 프리셋**: 균형 프리셋 (사주 가호 2종 의존도 검증)
- **토단일 프리셋**: 극화 프리셋 (편재, 모으기 등 특성 의존도 검증)

---
생성일: 2026-07-13 ${new Date().toLocaleTimeString('ko-KR')}
`;

  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`\n✓ 결과 저장: ${outputPath}`);
  console.log('\n' + '='.repeat(60));
  console.log('배치 1 순서 2-3 완료');
}

runBatch1().catch((error) => {
  console.error('오류:', error);
  process.exit(1);
});
