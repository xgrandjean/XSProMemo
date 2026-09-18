import { useSyncExternalStore } from 'react'

/**
 * Le « mode IA » : une posture de travail, pas un réglage d'un mémoire. Quand il est actif,
 * les gestes qui ouvrent un document dans Word y ajoutent la consigne à coller dans le
 * Claude de Word — le plan pour un chapitre, la configuration pour le gabarit.
 *
 * Gardé côté poste (localStorage) plutôt que dans le dossier de travail : c'est la façon de
 * travailler de la personne, pas une propriété du mémoire partagé.
 *
 * Un petit magasin partagé plutôt qu'un état par composant : la bascule est en haut de
 * l'application et ce qu'elle commande se trouve sur d'autres écrans. Trois copies d'un
 * booléen finiraient par ne plus dire la même chose.
 */
const KEY = 'xspromemo.modeIA'

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // Stockage bloqué : le mode fonctionne quand même, il ne survit simplement pas à la
    // fermeture de l'application.
    return false
  }
}

let current = readStored()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAiMode(): boolean {
  return current
}

export function setAiMode(on: boolean): void {
  if (on === current) return
  current = on
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* voir readStored */
  }
  for (const listener of listeners) listener()
}

/** S'abonne au mode : tout écran qui l'utilise se remet à jour quand la bascule change. */
export function useAiMode(): boolean {
  return useSyncExternalStore(subscribe, getAiMode, getAiMode)
}
