import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repo = 'andyue/ShowTimerPWA'
const maxArchiveBytes = 30 * 1024 * 1024
export function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    // npm is a .cmd file on Windows; only fixed npm commands pass through cmd.exe.
    const child = process.platform === 'win32' && command === 'npm'
      ? spawn('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd, stdio: 'inherit' })
      : spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} failed (${signal || code})`)))
  })
}
export function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.setTimeout(2000)
    socket.once('connect', () => { socket.destroy(); reject(new Error(`Port ${port} is in use. Stop the LAN server / OSC bridge with Ctrl+C, then retry.`)) })
    socket.once('timeout', () => { socket.destroy(); reject(new Error(`Could not check port ${port}. Update cancelled.`)) })
    socket.once('error', error => { socket.destroy(); error.code === 'ECONNREFUSED' ? resolve() : reject(error) })
  })
}
async function request(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'ShowTimer-Updater', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(120000) })
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
  return response
}
export async function installLatest({ root = path.join(homedir(), 'ShowTimer'), fetchImpl = fetch, execute = run } = {}) {
  // Install a revision which has passed the existing tests and Pages deployment.
  const response = await request(`https://api.github.com/repos/${repo}/actions/workflows/deploy-pages.yml/runs?branch=main&status=success&event=push&per_page=1`, fetchImpl)
  const revision = (await response.json()).workflow_runs?.[0]?.head_sha
  if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('No verified release found. Please try again after deployment finishes.')
  await mkdir(path.join(root, 'versions'), { recursive: true })
  const destination = await mkdtemp(path.join(root, 'versions', `${revision.slice(0, 7)}-`))
  const archiveName = '.showtimer-update.tar.gz'
  const archivePath = path.join(destination, archiveName)
  try {
    console.log(`Downloading tested version ${revision.slice(0, 7)}...`)
    const archive = await request(`https://codeload.github.com/${repo}/tar.gz/${revision}`, fetchImpl)
    const chunks = []
    let bytes = 0
    for await (const chunk of archive.body) {
      bytes += chunk.length
      if (bytes > maxArchiveBytes) throw new Error('Download exceeds the expected archive size.')
      chunks.push(chunk)
    }
    await writeFile(archivePath, Buffer.concat(chunks))
    // Windows tar can lose Unicode in command-line paths. Use a relative archive
    // name and let Node set the working directory using the Unicode Windows API.
    await execute('tar', ['-xzf', archiveName, '--strip-components=1'], destination)
    const manifest = JSON.parse(await readFile(path.join(destination, 'package.json'), 'utf8'))
    if (manifest.name !== 'showtimerpwa' || !manifest.scripts?.['build:lan']) throw new Error('Unexpected release contents.')
    await readFile(path.join(destination, 'package-lock.json'))
    console.log('Installing dependencies and building. Please keep this window open...')
    await execute('npm', ['ci'], destination)
    await execute('npm', ['run', 'build:lan'], destination)
    await writeFile(path.join(root, 'latest-installed.txt'), destination + '\n')
    console.log(`\nInstalled: ${destination}\nOld versions have been retained.\nFor daily use, open Start-LAN-Windows.cmd / Start-LAN-Mac.command or Start-OSC-Windows.cmd / Start-OSC-Mac.command in this folder.`)
    return destination
  } catch (error) {
    console.error(`Update failed. Old versions are unchanged. Incomplete files: ${destination}`)
    throw error
  } finally {
    await rm(archivePath, { force: true })
  }
}
async function main() {
  const oscMode = process.argv.includes('--osc')
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Please install Node.js 24 or newer first.')
  console.log('ShowTimer update — export your Show File backup before updating.\nInternet is required. Existing program folders and browser data are not overwritten.')
  const port = Number(process.env.LAN_PORT || 8789)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid LAN_PORT')
  await assertPortFree(port)
  await assertPortFree(8788)
  const destination = await installLatest()
  await assertPortFree(port)
  if (!oscMode) console.log(`\nStarting the new version. Refresh http://127.0.0.1:${port}/ and create a new broadcast QR code.\nPress Ctrl+C to stop. Start OSC separately if needed.`)
  if (oscMode) {
    process.env.OSC_HOST = '0.0.0.0'
    console.log('Starting OSC in LAN mode. Paste the pairing token into ShowTimer Tools. Local controller: http://127.0.0.1:8788/')
    await run(process.execPath, ['server/osc.mjs'], destination)
  } else {
    await run(process.execPath, ['server/lan.mjs'], destination)
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
