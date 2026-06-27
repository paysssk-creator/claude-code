#!/usr/bin/env bun
/**
 * 生产环境测试脚本
 *
 * 以 CI/生产环境模式运行测试套件，支持以下参数：
 *   --offline    跳过需要外部网络的测试
 *   --verbose    输出详细测试信息
 *   --bun        显式使用 Bun 运行时（默认已使用）
 *
 * 用法：
 *   bun run test:production
 *   bun run test:production:offline
 *   bun run test:production:verbose
 *   bun run test:production:bun
 */

import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const offline = args.includes('--offline')
const verbose = args.includes('--verbose')
const useBun = args.includes('--bun')

if (offline) {
  process.env.CI = '1'
  process.env.SKIP_NETWORK_TESTS = '1'
}

const bunArgs = ['test']
if (verbose) {
  bunArgs.push('--verbose')
}

if (useBun) {
  console.log('Using Bun runtime explicitly')
}

console.log(
  `=== Production test run (offline=${offline}, verbose=${verbose}) ===\n`,
)

const child = spawn('bun', bunArgs, {
  stdio: 'inherit',
  shell: false,
})

child.on('close', code => {
  process.exit(code ?? 1)
})

child.on('error', err => {
  console.error('Failed to start tests:', err.message)
  process.exit(1)
})
