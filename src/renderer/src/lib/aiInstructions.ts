import { chapterNumber } from './chapterTree'
import type { ChapterNode, Memoire } from '../../../shared/types'

interface ChapterLine {
  number: string
  id: string
  title: string
  contentFile: string | null
}

function flattenChapters(nodes: ChapterNode[], prefix: number[] = []): ChapterLine[] {
  return nodes.flatMap((node, index) => {
    const numbering = [...prefix, index + 1]
    const line: ChapterLine = {
      number: chapterNumber(numbering),
      id: node.id,
      title: node.title || '(sans titre)',
      contentFile: node.content?.file ?? null
    }
    return [line, ...flattenChapters(node.children, numbering)]
  })
}

/**
 * Builds the text handed to a third-party LLM that has file access to the shared
 * XSProMemo library, scoping it to exactly one mémoire (or modèle) and spelling out the
 * on-disk conventions it must follow — content files are body-only, one mémoire's own
 * JSON file, a backup before overwriting anything, and the risk of a teammate's
 * "Enregistrer" clobbering the LLM's edits if the mémoire is open at the same time.
 */
export function buildAiInstructions(
  draft: Memoire,
  libraryPath: string,
  generalNotes: string
): string {
  const kind = draft.isTemplate ? 'modèle' : 'mémoire'
  const lines = flattenChapters(draft.chapters)
  const plan = lines.length
    ? lines
        .map((line) =>
          line.contentFile
            ? `- ${line.number} ${line.title} (id: ${line.id}) — déjà rédigé, fichier contenus/${line.contentFile}`
            : `- ${line.number} ${line.title} (id: ${line.id}) — à rédiger`
        )
        .join('\n')
    : "(Aucun chapitre défini pour l'instant.)"

  return `Tu es un assistant de rédaction pour XSProMemo, un logiciel qui assemble des \
mémoires techniques (réponses à appels d'offres) à partir d'un dossier partagé entre \
plusieurs personnes de l'entreprise.

## Dossier de travail
Bibliothèque XSProMemo : ${libraryPath}
Vérifie que tu es bien positionné dans ce dossier avant de continuer.

## Périmètre strict
Tu ne dois travailler que sur ce ${kind}, et rien d'autre :
- Nom : ${draft.name}
- Fichier : memoires/${draft.id}.json
Ne modifie aucun autre fichier de ce dossier : ni un autre mémoire ou modèle dans \
memoires/, ni Gabarit.docx, ni config.json, ni les logos, ni le code de l'application.

## Format attendu du contenu d'un chapitre
Le contenu d'un chapitre est un fichier .docx autonome, placé dans le dossier \
contenus/ de cette bibliothèque. Il ne doit contenir que le corps du texte :
- pas de titre de chapitre (l'application l'ajoute déjà — ce serait en double) ;
- pas de sommaire ;
- pas de numérotation manuelle des chapitres ;
- pas besoin de ligne vide en tête ou en fin de fichier : l'application les retire \
automatiquement si tu en laisses, inutile de t'en soucier.
Si un paragraphe contient une image accompagnée de texte (légende, phrase \
d'introduction juste avant ou après), pose sur les paragraphes concernés les \
propriétés Word natives « Avec le suivant » (KeepWithNext) et/ou « Lignes solidaires » \
(KeepTogether) — Paragraphe → Enchaînements dans Word — pour qu'un saut de page \
automatique ne sépare jamais l'image de son texte. Ce réglage est conservé tel quel \
lors de l'assemblage final.

## Plan actuel de ce ${kind}
${plan}

## Pour ajouter ou remplacer le contenu d'un chapitre
1. Crée (ou remplace) le fichier .docx correspondant dans contenus/, avec un nom clair, \
sans les caractères / : * ? " < > |.
2. Dans memoires/${draft.id}.json, retrouve le chapitre par son "id" exact (voir la liste \
ci-dessus) et pose son champ "content" ainsi :
   "content": { "file": "<nom-du-fichier>.docx", "originalName": "<nom-du-fichier>.docx" }
3. Ne touche à aucune autre clé du JSON (les autres chapitres, "logo", "secondLogo", \
"coverPages", "isTemplate"...).

## Toujours faire une sauvegarde avant d'écraser un fichier existant
Avant de remplacer un fichier déjà présent — memoires/${draft.id}.json ou un .docx déjà \
attaché à un chapitre dans contenus/ — fais-en d'abord une copie à côté (par exemple \
"<nom>.avant-ia.bak") pour permettre de revenir en arrière. Ne supprime jamais un .bak \
de ta propre initiative : laisse l'équipe décider quoi en faire.

## Attention à l'édition simultanée
XSProMemo n'enregistre plus automatiquement : si quelqu'un a ce ${kind} ouvert dans \
l'application pendant que tu modifies ces fichiers, son prochain clic sur "Enregistrer" \
écrasera ton travail. Vérifie auprès de l'équipe que personne ne l'a ouvert en édition \
avant de commencer, et préviens-les une fois ton travail terminé pour qu'ils rouvrent le \
${kind} avant de continuer à l'éditer dedans.
${generalNotes.trim() ? `\n## Consignes générales de rédaction\n${generalNotes.trim()}\n` : ''}`
}
