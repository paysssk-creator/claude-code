#!/usr/bin/env bun
/**
 * 项目健康检查脚本
 *
 * 按顺序执行以下检查，任一失败即退出并返回非零状态码：
 * 1. TypeScript 类型检查
 * 2. Biome lint/format 检查
 * 3. 单元/集成测试
 * 4. 生产构建
 * 5. 构建产物完整性检查
 *
 * 用法：
 *   bun run health
 */

import { spawn } from 'node:child_process'

interface Check {
  name: string
  command: string
  args: string[]
}

const CHECKS: Check[] = [
  { name: 'TypeScript typecheck', command: 'bun', args: ['run', 'typecheck'] },
  { name: 'Biome check', command: 'bun', args: ['run', 'check'] },
  { name: 'Test suite', command: 'bun', args: ['test'] },
  { name: 'Production build', command: 'bun', args: ['run', 'build'] },
  { name: 'Bundle integrity', command: 'bun', args: ['run', 'check:bundle'] },
]

function runCheck(check: Check): Promise<boolean> {
  return new Promise(resolve => {
    console.log(`\n▶ ${check.name}...`)
    const child = spawn(check.command, check.args, {
      stdio: 'inherit',
      shell: false,
    })
    child.on('close', code => {
      if (code === 0) {
        console.log(`✓ ${check.name} passed`)
        resolve(true)
      } else {
        console.error(`✗ ${check.name} failed (exit ${code ?? 'signal'})`)
        resolve(false)
      }
    })
    child.on('error', err => {
      console.error(`✗ ${check.name} error: ${err.message}`)
      resolve(false)
    })
  })
}

async function main(): Promise<void> {
  console.log('=== Claude Code Best 健康检查 ===\n')

  let passed = 0
  let failed = 0

  for (const check of CHECKS) {
    const ok = await runCheck(check)
    if (ok) {
      passed++
    } else {
      failed++
      console.error(`\n健康检查中止于: ${check.name}`)
      process.exit(1)
    }
  }

  console.log(`\n=== 全部通过: ${passed}/${CHECKS.length} ===`)
  process.exit(0)
}

await main()
