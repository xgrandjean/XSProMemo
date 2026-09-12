/**
 * A rejected `ipcRenderer.invoke()` call reaches the renderer as an Error whose message
 * Electron has already prefixed with "Error invoking remote method '<channel>': " — showing
 * that verbatim would put implementation detail in front of the user. This keeps only what
 * the main process actually threw.
 */
export function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/, '')
}
