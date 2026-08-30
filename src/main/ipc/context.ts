import { dataRoot } from '../store/paths'

/**
 * The application stores everything in its own data folder, so there is nothing to
 * configure before it can run.
 */
export async function requireLibraryPath(): Promise<string> {
  return dataRoot()
}
