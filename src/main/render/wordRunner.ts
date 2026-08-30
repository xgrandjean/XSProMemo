import { spawn, execFile } from 'node:child_process'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import { app } from 'electron'
import path from 'node:path'

const execFileAsync = promisify(execFile)

export class GenerationError extends Error {}

interface ScriptEvent {
  type: 'progress' | 'pid' | 'result'
  message?: string
  pid?: number
  [key: string]: unknown
}

export function getScriptPath(fileName: string): string {
  const root = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources')
  return path.join(root, 'scripts', fileName)
}

function describeFailure(exitCode: number | null, stderrText: string): GenerationError {
  const stderr = stderrText.trim()
  if (exitCode === 10 || stderr.includes('WORD_ALREADY_RUNNING')) {
    return new GenerationError(
      'Word est ouvert sur ce poste. Fermez toutes les fenêtres Word puis réessayez.'
    )
  }
  if (stderr.includes('running scripts is disabled') || stderr.includes("d'exécution de scripts")) {
    return new GenerationError(
      "PowerShell est bloqué par une stratégie de sécurité sur ce poste. Contactez votre administrateur informatique (politique d'exécution de scripts)."
    )
  }
  if (exitCode === null) {
    return new GenerationError(
      'La génération a pris trop de temps et a été interrompue. Vérifiez le Gestionnaire des tâches (WINWORD.EXE).'
    )
  }
  return new GenerationError(stderr || `Échec de la génération (code ${exitCode}).`)
}

/**
 * Runs a Word automation script, streaming its progress. On timeout the Word process
 * the script reported is killed by pid — never every WINWORD.EXE, since the user may
 * have their own documents open.
 */
export function runWordScript(
  scriptPath: string,
  manifestAbsPath: string,
  onProgress: (message: string) => void,
  timeoutMs = 20 * 60_000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-ManifestPath',
        manifestAbsPath
      ],
      { windowsHide: true }
    )

    let wordPid: number | null = null
    let result: Record<string, unknown> | null = null
    let stderrText = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      if (wordPid !== null) {
        void execFileAsync('taskkill', ['/PID', String(wordPid), '/F', '/T']).catch(() => undefined)
      }
      child.kill()
    }, timeoutMs)

    const lines = createInterface({ input: child.stdout })
    lines.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      let event: ScriptEvent
      try {
        event = JSON.parse(trimmed)
      } catch {
        return // ignore non-JSON noise
      }
      if (event.type === 'progress' && event.message) onProgress(event.message)
      else if (event.type === 'pid' && typeof event.pid === 'number') wordPid = event.pid
      else if (event.type === 'result') result = event
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderrText += chunk.toString('utf-8')
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new GenerationError(`Impossible de lancer PowerShell : ${err.message}`))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      lines.close()
      if (!timedOut && code === 0 && result) resolve(result)
      else reject(describeFailure(timedOut ? null : code, stderrText))
    })
  })
}
