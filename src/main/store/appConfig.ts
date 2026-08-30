import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AppConfig } from '../../shared/types'

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

const defaultConfig: AppConfig = {
  libraryPath: null
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf-8')
    return { ...defaultConfig, ...JSON.parse(raw) }
  } catch {
    return { ...defaultConfig }
  }
}

export async function writeAppConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath()), { recursive: true })
  const tmp = configPath() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(config, null, 2), 'utf-8')
  await fs.rename(tmp, configPath())
}
