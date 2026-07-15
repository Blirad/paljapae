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

// 복사 대상 1: workspace root의 ZERA_BALANCE_V3_* 파일
const workspaceFiles = readdirSync(WORKSPACE_ROOT)
  .filter(f => f.endsWith('.md'))
  .filter(f => /^ZERA_BALANCE_V3_/.test(f) || f === 'SPEC_v3.1.md' || f === 'DISPATCH_HANDOFF.md')
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

console.log(`\ncopy-reports: ${workspaceFiles.length + tasksFiles.length}개 파일 → public/reports/`)
