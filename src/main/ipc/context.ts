import { readAppConfig } from '../store/appConfig'

export async function requireLibraryPath(): Promise<string> {
  const config = await readAppConfig()
  if (!config.libraryPath) {
    throw new Error('Aucun dossier de bibliothèque configuré. Choisissez-en un dans les réglages.')
  }
  return config.libraryPath
}
