/**
 * Fige le modèle en cours d'utilisation comme modèle livré à l'installation.
 *
 * Le dossier de travail (Documents\XSProMemo) et le modèle embarqué
 * (resources/exemple) sont deux choses distinctes : améliorer un fichier Word depuis
 * l'application ne change rien à ce que recevra un poste neuf. Ce script fait le
 * passage de l'un à l'autre, explicitement.
 *
 *   node scripts/exporter-modele.mjs [--simuler] [dossier]
 *
 * --simuler  n'écrit rien, se contente du rapport.
 * dossier    par défaut %USERPROFILE%\Documents\XSProMemo
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const projet = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cible = path.join(projet, 'resources', 'exemple')
const logo = path.join(projet, 'build', 'logo.png')

const arguments_ = process.argv.slice(2)
const simuler = arguments_.includes('--simuler')
const source =
  arguments_.find((a) => !a.startsWith('--')) ??
  path.join(os.homedir(), 'Documents', 'XSProMemo')

const rapport = []
const note = (ligne) => rapport.push(ligne)

async function lire(fichier) {
  return JSON.parse(await fs.readFile(fichier, 'utf-8'))
}

async function existe(chemin) {
  try {
    await fs.access(chemin)
    return true
  } catch {
    return false
  }
}

/** Les identifiants et les dates sont propres à une installation : ils ne partent pas. */
function sansIdentifiants(noeuds) {
  return noeuds.map((noeud) => ({
    title: noeud.title,
    pageBreakBefore: noeud.pageBreakBefore,
    orientation: noeud.orientation,
    content: noeud.content,
    children: sansIdentifiants(noeud.children ?? [])
  }))
}

function fichiersUtilises(memoire) {
  const utilises = new Set()
  for (const garde of memoire.coverPages ?? []) if (garde) utilises.add(garde.file)
  const parcourir = (noeuds) => {
    for (const noeud of noeuds ?? []) {
      if (noeud.content) utilises.add(noeud.content.file)
      parcourir(noeud.children)
    }
  }
  parcourir(memoire.chapters)
  return utilises
}

/** Rend le dossier destination identique au dossier source, ajouts et retraits compris. */
async function synchroniser(depuis, vers) {
  const presents = (await fs.readdir(depuis).catch(() => [])).filter((f) => !f.startsWith('~$'))
  const anciens = await fs.readdir(vers).catch(() => [])

  let ajoutes = 0
  let remplaces = 0
  for (const fichier of presents) {
    const a = path.join(depuis, fichier)
    const b = path.join(vers, fichier)
    const avant = await fs.stat(b).catch(() => null)
    const apres = await fs.stat(a)
    if (!avant) ajoutes += 1
    else if (avant.size !== apres.size || avant.mtimeMs < apres.mtimeMs) remplaces += 1
    else continue
    if (!simuler) await fs.copyFile(a, b)
  }

  const retires = anciens.filter((f) => !presents.includes(f))
  for (const fichier of retires) {
    if (!simuler) await fs.rm(path.join(vers, fichier), { force: true })
  }
  return { ajoutes, remplaces, retires, total: presents.length }
}

async function principal() {
  if (!(await existe(source))) throw new Error(`Dossier de travail introuvable : ${source}`)

  const config = await lire(path.join(source, 'config.json'))
  if (!config.exampleId) throw new Error("Ce dossier n'a pas de mémoire exemple enregistré.")

  const memoire = await lire(path.join(source, 'memoires', `${config.exampleId}.json`))
  note(`Mémoire exemple : « ${memoire.name} », ${memoire.chapters.length} chapitres racine`)

  // --- Le plan ---
  const plan = {
    name: memoire.name,
    coverPages: memoire.coverPages,
    chapters: sansIdentifiants(memoire.chapters)
  }
  if (!simuler) {
    await fs.writeFile(
      path.join(cible, 'exemple.json'),
      JSON.stringify(plan, null, 2) + '\n',
      'utf-8'
    )
  }

  // --- Les contenus ---
  const bilan = await synchroniser(path.join(source, 'contenus'), path.join(cible, 'contenus'))
  note(
    `Contenus : ${bilan.total} fichiers` +
      ` (${bilan.ajoutes} ajoutés, ${bilan.remplaces} mis à jour, ${bilan.retires.length} retirés)`
  )
  for (const retire of bilan.retires) note(`  retiré : ${retire}`)

  const utilises = fichiersUtilises(memoire)
  const presents = new Set(
    (await fs.readdir(path.join(source, 'contenus')).catch(() => [])).filter(
      (f) => !f.startsWith('~$')
    )
  )
  for (const fichier of utilises) {
    if (!presents.has(fichier)) note(`  ATTENTION référencé par le plan mais absent : ${fichier}`)
  }
  const orphelins = [...presents].filter((f) => !utilises.has(f))
  if (orphelins.length) {
    note(`  ${orphelins.length} fichiers livrés sans être utilisés par l'exemple :`)
    for (const orphelin of orphelins) note(`    ${orphelin}`)
  }

  // --- Le gabarit ---
  // Copié puis retatoué : le gabarit livré porte le logo XSPro, jamais celui du poste
  // de développement.
  if (!simuler) {
    await fs.copyFile(path.join(source, 'Gabarit.docx'), path.join(cible, 'Gabarit.docx'))
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(projet, 'resources', 'scripts', 'SetLogo.ps1'),
        '-TemplatePath',
        path.join(cible, 'Gabarit.docx'),
        '-LogoPath',
        logo
      ],
      { windowsHide: true, timeout: 3 * 60_000 }
    )
  }
  note('Gabarit : copié, puis logo XSPro réappliqué dans l\'en-tête')

  if (config.sommaireTitle && config.sommaireTitle !== 'Sommaire') {
    note(
      `Note : votre titre de sommaire est « ${config.sommaireTitle} ». Les postes neufs` +
        ' recevront « Sommaire » — c\'est un réglage, pas un contenu du modèle.'
    )
  }

  console.log((simuler ? '— SIMULATION, rien écrit —\n' : '') + rapport.join('\n'))
  console.log(
    simuler
      ? '\nRelancez sans --simuler pour figer réellement le modèle.'
      : '\nModèle figé. Vérifiez avec `git diff --stat` puis compilez.'
  )
}

principal().catch((erreur) => {
  const message = erreur.stderr?.trim() || erreur.message
  // En simulation le script sert d'avertissement avant compilation : il ne doit pas
  // faire echouer un build lance sur une machine sans dossier de travail.
  if (simuler) {
    console.warn('Modèle non vérifié : ' + message)
    process.exit(0)
  }
  console.error('Échec : ' + message)
  process.exit(1)
})
