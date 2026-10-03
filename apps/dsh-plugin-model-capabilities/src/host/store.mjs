/** Private, atomic scan history. Migration never grants old results write authority. */
import { randomUUID } from 'node:crypto'
import { copyFileSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const STORE_VERSION = 4
const empty = () => ({ version: STORE_VERSION, jobs: [], ownership: {} })
function read(file) {
  if (!lstatSync(file).isFile()) throw new Error('扫描记录必须为普通文件')
  const data = JSON.parse(readFileSync(file, 'utf8'))
  if (![2, 3, STORE_VERSION].includes(data?.version) || !Array.isArray(data.jobs)) throw new Error('不支持的扫描记录格式；已保留原文件')
  return data
}

export function writeStore(file, data) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  if (existsSync(file) && !lstatSync(file).isFile()) throw new Error('扫描记录必须为普通文件')
  const temp = `${file}.${randomUUID()}.tmp`
  try {
    writeFileSync(temp, JSON.stringify({ ...data, version: STORE_VERSION }), { mode: 0o600, flag: 'wx' })
    renameSync(temp, file)
  } finally { rmSync(temp, { force: true }) }
}

export function loadStore(file, legacyFiles = []) {
  if (!file) return empty()
  const source = existsSync(file) ? file : legacyFiles.find(candidate => existsSync(candidate))
  if (!source) return empty()
  const saved = read(source)
  if (saved.version === STORE_VERSION) return saved
  if (source === file) {
    // Never overwrite an existing backup, including one from a previous migration.
    copyFileSync(source, `${file}.v${saved.version}.${randomUUID()}.bak`, constants.COPYFILE_EXCL)
  }
  const migrated = empty()
  const safeNumber = value => Number.isSafeInteger(value) && value >= 0 ? value : 0
  const safeDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/u.test(value) ? value : undefined
  for (const job of saved.jobs) {
    if (!job || typeof job.route !== 'string' || !job.route || ['__proto__', 'constructor', 'prototype'].includes(job.route)) continue
    // Free-text errors, result notes and model snapshots may contain legacy credential echoes.
    // Keep them only in the untouched source; imported metadata cannot be applied or restored.
    migrated.jobs.push({ route: job.route, id: randomUUID(), scanVersion: 0, legacy: true,
      status: 'interrupted', scope: job.scope === 'all' ? 'all' : 'configured',
      startedAt: safeDate(job.startedAt), finishedAt: safeDate(job.finishedAt),
      total: safeNumber(job.total), progress: safeNumber(job.progress), discovered: safeNumber(job.discovered),
      truncated: job.truncated === true, results: [], error: '已保留旧扫描记录；请重新扫描以验证模型能力' })
  }
  writeStore(file, migrated)
  return migrated
}
