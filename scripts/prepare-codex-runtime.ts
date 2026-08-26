import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { access, chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { arch, platform } from 'node:process'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const universal = process.argv.includes('--universal')
const outputRoot = resolve('build/runtime')

async function executable(path: string): Promise<boolean> {
  return access(path, constants.X_OK).then(() => true, () => false)
}

async function sourceFor(targetArch: 'arm64' | 'x64'): Promise<string> {
  const archSpecific = process.env[`SPLITTBOT_CODEX_BUNDLE_SOURCE_${targetArch.toUpperCase()}`]
  const generic = process.env.SPLITTBOT_CODEX_BUNDLE_SOURCE
  const candidates = [
    archSpecific,
    generic,
    targetArch === arch ? '/Applications/ChatGPT.app/Contents/Resources/codex' : undefined
  ].filter((value): value is string => Boolean(value))
  for (const candidate of candidates) if (await executable(candidate)) return candidate
  throw new Error(`A ${targetArch} Codex runtime is required. Set SPLITTBOT_CODEX_BUNDLE_SOURCE_${targetArch.toUpperCase()} to an executable supplied for this build.`)
}

async function prepare(targetArch: 'arm64' | 'x64'): Promise<Record<string, unknown>> {
  const source = await sourceFor(targetArch)
  const { stdout: sourceArchitectures } = await execFileAsync('/usr/bin/lipo', ['-archs', source], { timeout: 15_000 })
  if (!sourceArchitectures.trim().split(/\s+/).includes(targetArch)) {
    throw new Error(`The supplied ${targetArch} runtime does not contain that architecture: ${source}`)
  }
  const directory = join(outputRoot, `darwin-${targetArch}`)
  const destination = join(directory, 'codex')
  await mkdir(directory, { recursive: true })
  await copyFile(source, destination)
  await chmod(destination, 0o755)
  const bytes = await readFile(destination)
  const { stdout } = await execFileAsync(destination, ['--version'], { timeout: 15_000 })
  const manifest = {
    schemaVersion: 1,
    platform: 'darwin',
    arch: targetArch,
    version: stdout.trim(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
    preparedAt: new Date().toISOString()
  }
  await writeFile(join(directory, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 })
  return manifest
}

if (platform !== 'darwin') throw new Error('SplittBot currently packages its standalone runtime only for macOS.')
const targets: Array<'arm64' | 'x64'> = universal ? ['arm64', 'x64'] : [arch === 'arm64' ? 'arm64' : 'x64']
const manifests = []
for (const target of targets) manifests.push(await prepare(target))
process.stdout.write(`${JSON.stringify({ prepared: manifests }, null, 2)}\n`)
