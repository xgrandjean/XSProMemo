import { chapterNumber } from './chapterTree'
import type { ChapterNode, Memoire } from '../../../shared/types'

interface ChapterLine {
  number: string
  id: string
  title: string
  level: number
  contentFile: string | null
}

function flattenChapters(nodes: ChapterNode[], prefix: number[] = []): ChapterLine[] {
  return nodes.flatMap((node, index) => {
    const numbering = [...prefix, index + 1]
    const line: ChapterLine = {
      number: chapterNumber(numbering),
      id: node.id,
      title: node.title || '(sans titre)',
      level: numbering.length,
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
  const contentsDir = `contenus/${draft.id}/`
  const plan = lines.length
    ? lines
        .map((line) =>
          line.contentFile
            ? `- ${line.number} ${line.title} (id: ${line.id}) — déjà rédigé, fichier ${line.contentFile}`
            : `- ${line.number} ${line.title} (id: ${line.id}) — à rédiger`
        )
        .join('\n')
    : "(Aucun chapitre défini pour l'instant.)"

  return `Tu es un assistant de rédaction pour XSProMemo, un logiciel qui assemble des \
mémoires techniques (réponses à appels d'offres) à partir d'un dossier partagé entre \
plusieurs personnes de l'entreprise.

## Dossier de travail
Dossier de travail XSProMemo : ${libraryPath}
Vérifie que tu es bien positionné dans ce dossier avant de continuer.

## Périmètre strict
Tu ne dois travailler que sur ce ${kind}, et rien d'autre :
- Nom : ${draft.name}
- Fichier : memoires/${draft.id}.json
Ne modifie aucun autre fichier de ce dossier : ni un autre mémoire ou modèle dans \
memoires/, ni Gabarit.docx, ni config.json, ni les logos, ni le code de l'application.

## Format attendu du contenu d'un chapitre
Le contenu d'un chapitre est un fichier .docx autonome, placé dans le dossier \
${contentsDir} — le dossier propre à ce ${kind}. Il ne doit contenir que le corps du texte :
- pas de titre de chapitre (l'application l'ajoute déjà — ce serait en double) ;
- aucun style de titre, « Titre 1 » à « Titre 9 », même pour découper un long \
chapitre : un style de titre laissé dans un fichier de contenu entre dans le sommaire du \
mémoire final, sans numéro, entre deux vrais chapitres. Si une section mérite son propre \
titre, c'est un sous-chapitre à créer dans le plan, avec son propre fichier ;
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
1. Chaque mémoire possède son propre dossier de contenus. Celui de ce ${kind} est \
${contentsDir}, et c'est le seul où tu as le droit d'écrire. N'écris jamais dans le dossier \
d'un autre mémoire, et ne fais jamais pointer un chapitre de ce ${kind} vers un fichier situé \
ailleurs : ce serait rendre un même fichier Word modifiable depuis deux mémoires à la fois, \
exactement ce que cette organisation existe pour empêcher.
2. Crée (ou remplace) le fichier .docx dans ${contentsDir}, avec un nom clair, sans les \
caractères / : * ? " < > |. Un nom déjà utilisé par un autre chapitre du même ${kind} \
écraserait son contenu : liste le dossier avant de choisir.
3. Dans memoires/${draft.id}.json, retrouve le chapitre par son "id" exact (voir la liste \
ci-dessus) et pose son champ "content" ainsi — le "file" est le chemin relatif au dossier \
contenus/, dossier du mémoire compris, et le "originalName" le seul nom du fichier :
   "content": { "file": "${draft.id}/<nom-du-fichier>.docx", "originalName": "<nom-du-fichier>.docx" }
4. Ne touche à aucune autre clé du JSON (les autres chapitres, "logo", "secondLogo", \
"coverPages", "isTemplate"...).

## Toujours faire une sauvegarde avant d'écraser un fichier existant
Avant de remplacer un fichier déjà présent — memoires/${draft.id}.json ou un .docx déjà \
attaché à un chapitre dans ${contentsDir} — fais-en d'abord une copie à côté (par exemple \
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

/**
 * Builds the text for editing the gabarit itself — not tied to any mémoire, and higher
 * stakes than editing one chapter's content: a mistake here affects every mémoire the
 * library will ever generate, not just one chapter, so the backup rule is stated more
 * firmly and the LLM is told not to worry about the paragraph-flow properties the
 * application itself already enforces on every generation.
 */
export function buildGabaritAiInstructions(libraryPath: string, generalNotes: string): string {
  return `Tu es un assistant pour XSProMemo, un logiciel qui assemble des mémoires \
techniques (réponses à appels d'offres) à partir d'un dossier partagé entre plusieurs \
personnes de l'entreprise.

## Dossier de travail
Dossier de travail XSProMemo : ${libraryPath}
Vérifie que tu es bien positionné dans ce dossier avant de continuer.

## Périmètre strict
Tu ne dois modifier que le fichier Gabarit.docx, à la racine de ce dossier de travail, et \
rien d'autre : ni un mémoire ou modèle dans memoires/, ni un contenu dans contenus/ (chaque \
mémoire y a son propre dossier), ni \
config.json, ni les logos, ni le code de l'application. Ce fichier est partagé par tous \
les mémoires : une erreur dessus se répercute sur chacun d'eux, pas un seul.

## Ce que contient le gabarit
Il est volontairement vide de tout contenu (un mémoire y insère ses chapitres au moment \
de sa génération) et ne définit que trois choses :
- les styles de titre « Titre 1 » à « Titre 9 » (un par niveau de chapitre : police, \
taille, couleur, gras/italique) et le style « Normal » pour le texte courant ;
- l'en-tête et le pied de page (numéro de page, coordonnées de l'entreprise ou tout \
texte fixe voulu sur chaque page) ;
- le format de page (marges, orientation par défaut).

## Ce que tu n'as pas à gérer toi-même
L'application impose déjà, à chaque génération, « Avec le suivant » et « Lignes \
solidaires » sur les 9 styles de titre, le contrôle des veuves/orphelines, et retire \
toute numérotation automatique éventuellement associée à un style — inutile d'ajouter ou \
de vérifier ces réglages, ils sont garantis quel que soit l'état du fichier.

## Toujours faire une sauvegarde avant de modifier ce fichier
Avant le moindre changement, copie Gabarit.docx à côté (par exemple \
"Gabarit.avant-ia.bak.docx") pour permettre de revenir en arrière. Ne supprime jamais un \
.bak de ta propre initiative : laisse l'équipe décider quoi en faire.

## Attention à l'édition simultanée
Assure-toi qu'aucun collègue n'est en train de générer un mémoire pendant que tu \
modifies ce fichier (l'application copie le gabarit au moment de la génération).

## Vérifier le résultat
Une fois terminé, utilise le bouton « Aperçu du style » de l'application (menu à côté du \
gabarit, dans Configuration) pour voir le rendu réel de chaque niveau de titre avant de \
considérer le travail terminé.
${generalNotes.trim() ? `\n## Consignes générales\n${generalNotes.trim()}\n` : ''}`
}

/**
 * Builds the text for the Claude built into Word, working on one chapter's .docx with the
 * document in front of it and nothing else — no library, no plan file, no other chapter.
 * Deliberately says nothing about folders or JSON: naming what it cannot reach would only
 * send it looking.
 *
 * Its own chapter is named, and so is the rest of the plan, because the trap here is not
 * writing badly but writing someone else's chapter. And the rules are given with the
 * consequence attached — an assistant told "no heading styles" reaches for one anyway to
 * break up three pages of prose; told that each one lands in the mémoire's table of
 * contents unnumbered, between two real chapters, it does not.
 */
export function buildWordAiInstructions(
  draft: Memoire,
  chapterId: string,
  generalNotes: string
): string {
  const lines = flattenChapters(draft.chapters)
  const current = lines.find((line) => line.id === chapterId)
  const heading = current ? `${current.number} ${current.title}` : '(chapitre inconnu)'
  const depth = current
    ? current.level === 1
      ? 'un chapitre de premier niveau'
      : `un sous-chapitre de niveau ${current.level}`
    : ''

  const plan = lines
    .map((line) => {
      const indent = '  '.repeat(line.level - 1)
      const mark = line.id === chapterId ? '   <<< LE CHAPITRE QUE TU RÉDIGES' : ''
      return `${indent}${line.number} ${line.title}${mark}`
    })
    .join('\n')

  return `Tu travailles dans Word, sur un document qui n'est pas un mémoire : c'est le corps \
d'un seul chapitre, rien d'autre.

## Ce que deviendra ce document
XSProMemo assemble un mémoire technique (réponse à un appel d'offres) en mettant bout à bout \
un fichier Word par chapitre. Au moment de l'assemblage, l'application écrit elle-même, juste \
avant ce texte, le titre du chapitre et son numéro, puis construit le sommaire et la \
pagination du document final. Ce fichier ne porte donc que le corps du texte.

## Le chapitre que tu rédiges
Mémoire : ${draft.name}
Chapitre : ${heading}${depth ? ` (${depth})` : ''}

## Sa place dans le mémoire
${plan}

Tiens-t'en à ton chapitre : ce que traitent les autres n'a pas à être repris ici.

## Ce que ce document ne doit jamais contenir
- Le titre du chapitre. L'application l'ajoute : l'écrire ici le ferait apparaître deux fois.
- Un style de titre, « Titre 1 » à « Titre 9 », même pour découper un long chapitre. \
Vérifié sur le logiciel : un « Titre 2 » laissé dans un fichier de contenu entre dans le \
sommaire du mémoire final, sans numéro, coincé entre deux vrais chapitres. Si une section \
mérite vraiment son propre titre, ce n'est pas un titre à écrire ici, c'est un sous-chapitre \
à créer dans le plan de l'application — il aura alors son propre fichier.
- Un sommaire, une table des matières, une numérotation de chapitre écrite à la main.
- Un en-tête, un pied de page, un numéro de page : le gabarit du mémoire s'en charge.

## Comment structurer sans titres
Paragraphes, listes à puces ou numérotées, tableaux, images, un mot en gras pour ouvrir un \
paragraphe. Tout, sauf un style de titre.

## Mise en forme
Écris en style « Normal ». Sa police, sa taille et sa couleur dans ce fichier n'ont aucune \
importance : à l'assemblage, le « Normal » de ce document est remplacé par celui du gabarit \
du mémoire (vérifié : un fichier rédigé en Comic Sans 16 rouge ressort dans la police \
du gabarit). \
En revanche, toute mise en forme posée à la main sur du texte — changer la police, la taille, \
la couleur — est conservée telle quelle dans le document final. N'en pose donc que si tu la \
veux vraiment à l'impression.

## Images et légendes
Si tu insères une image accompagnée d'une légende ou d'une phrase d'introduction, sélectionne \
les paragraphes concernés et coche, dans Paragraphe → Enchaînements, « Avec le suivant » \
et/ou « Lignes solidaires ». Sans cela, un saut de page peut séparer l'image de son texte. Ce \
réglage est conservé à l'assemblage.

## Lignes vides
Ne te demande pas s'il en faut une au début ou à la fin du document : l'application retire \
l'une et l'autre automatiquement.
${generalNotes.trim() ? `\n## Consignes générales de rédaction\n${generalNotes.trim()}\n` : ''}`
}
