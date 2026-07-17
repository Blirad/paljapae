/**
 * copy-reports.js
 * 빌드 전 실행: workspace root의 공개 보고 파일을 public/reports/ 로 복사
 * 제외: 스토리/세계관/lore 전문 파일 (스포일러 자산)
 *
 * 실행: node scripts/copy-reports.js
 */

import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'
import { resolve, join, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const WORKSPACE_ROOT = resolve(__dirname, '../../')
const DEST = resolve(__dirname, '../public/reports')

// 제외 패턴 (스포일러 자산)
const EXCLUDE_PATTERNS = [
  /unmyeong.*story/i,
  /lore/i,
  /세계관/,
  /반전/,
  /스토리/,
  /STORY/i,
  /WORLD/i,
]

function isExcluded(filename) {
  return EXCLUDE_PATTERNS.some(p => p.test(filename))
}

mkdirSync(DEST, { recursive: true })

// 복사 대상 1: workspace root의 감사 보고 + 시뮬 결과 파일
const workspaceFiles = readdirSync(WORKSPACE_ROOT)
  .filter(f => f.endsWith('.md'))
  .filter(f => /^ZERA_BALANCE_V3_/.test(f) || /^G1_AUDIT_REPORT_/.test(f) || f === 'SPEC_v3.1.md' || f === 'DISPATCH_HANDOFF.md')
  .filter(f => !isExcluded(f))

for (const f of workspaceFiles) {
  const src = join(WORKSPACE_ROOT, f)
  const dest = join(DEST, f)
  copyFileSync(src, dest)
  console.log(`copied: ${f}`)
}

// 복사 대상 2: paljapae/TASKS.md
const paljapaeRoot = resolve(__dirname, '..')
const tasksFiles = ['TASKS.md']
for (const f of tasksFiles) {
  const src = join(paljapaeRoot, f)
  if (existsSync(src)) {
    copyFileSync(src, join(DEST, f))
    console.log(`copied: ${f}`)
  }
}

// 복사 대상 3: paljapae/docs/ 의 SPEC·LEDGER·HANDOVER류 (Claude 원문 대조 인프라 대상)
// lore·세계관·스토리 파일은 EXCLUDE_PATTERNS로 영구 미노출 (공개 금지 목록 승계)
const docsRoot = resolve(__dirname, '../docs')
const docsFiles = existsSync(docsRoot)
  ? readdirSync(docsRoot)
      .filter(f => f.endsWith('.md'))
      .filter(f => /^SPEC_/.test(f) || /^LEDGER_/.test(f) || /^HANDOVER_/.test(f))
      .filter(f => !isExcluded(f))
  : []

for (const f of docsFiles) {
  copyFileSync(join(docsRoot, f), join(DEST, f))
  console.log(`copied: docs/${f}`)
}

console.log(`\ncopy-reports: ${workspaceFiles.length + tasksFiles.length + docsFiles.length}개 파일 → public/reports/`)
