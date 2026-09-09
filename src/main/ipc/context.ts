import { resolveLibraryPath } from '../store/settings'

/**
 * The folder the application reads and writes everything from. Defaults to the local
 * Documents folder — nothing to configure before it can run — but the user can point it
 * elsewhere (another disk, a shared network folder) from the Configuration screen.
 */
export const requireLibraryPath = resolveLibraryPath
