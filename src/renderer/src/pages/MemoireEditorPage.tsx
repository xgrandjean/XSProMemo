import { useEffect, useRef, useState } from 'react'
import MemoirePlanEditor from '../components/MemoirePlanEditor'
import GenerationDialog from '../components/GenerationDialog'
import Modal from '../components/Modal'
import { buildAiInstructions } from '../lib/aiInstructions'
import { describeError } from '../lib/describeError'
import type {
  ConformiteResult,
  GenerationProgressEvent,
  GenerationResult,
  Memoire
} from '../../../shared/types'

/**
 * Owns the mémoire's draft: nothing here is persisted until "Enregistrer" is clicked
 * (or "Générer" saves it first) — there is no autosave. Everything editable in this
 * screen (the name field below, and the whole plan inside MemoirePlanEditor) goes
 * through the same `edit()`/`save()` pair, so a rename can never race ahead of or
 * discard a more recent plan edit.
 */
export default function MemoireEditorPage({
  memoireId,
  onBack,
  onDirtyChange
}: {
  memoireId: string
  onBack: () => void
  onDirtyChange?: (dirty: boolean) => void
}): JSX.Element {
  const [draft, setDraft] = useState<Memoire | null>(null)
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')
  // Deux echecs sans rapport, donc deux etats : celui de l'enregistrement s'affiche dans
  // la barre du haut, celui de la generation dans sa fenetre. Les confondre faisait
  // apparaitre l'erreur de generation collee au mot « Enregistré », et surtout l'y laissait
  // apres la fermeture de la fenetre — un message rouge qui ne partait plus.
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [aiPromptCopied, setAiPromptCopied] = useState(false)
  const [conforming, setConforming] = useState(false)
  const [conformite, setConformite] = useState<ConformiteResult | null>(null)
  const [conformiteError, setConformiteError] = useState<string | null>(null)
  const [libraryPath, setLibraryPath] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const latest = useRef<Memoire | null>(null)

  useEffect(() => {
    window.api.memoires.get(memoireId).then((m) => {
      setDraft(m)
      latest.current = m
      setStatus('saved')
    })
  }, [memoireId])

  useEffect(() => {
    window.api.model.get().then((s) => {
      setLibraryPath(s.library.path)
      setGeneralNotes(s.config.aiInstructions)
    })
  }, [])

  useEffect(() => {
    onDirtyChange?.(status !== 'saved')
  }, [status, onDirtyChange])

  useEffect(() => {
    return window.api.generation.onProgress((event: GenerationProgressEvent) => {
      if (event.memoireId !== memoireId) return
      setSteps((previous) => [...previous, event.message])
    })
  }, [memoireId])

  function edit(mutate: (current: Memoire) => Memoire): void {
    setDraft((current) => {
      if (!current) return current
      const next = mutate(current)
      latest.current = next
      return next
    })
    setStatus('dirty')
  }

  async function save(): Promise<Memoire> {
    if (!latest.current) throw new Error('Aucun mémoire chargé')
    setStatus('saving')
    setSaveError(null)
    try {
      const saved = await window.api.memoires.save(latest.current)
      latest.current = saved
      setDraft(saved)
      setStatus('saved')
      return saved
    } catch (err) {
      setStatus('dirty')
      setSaveError(describeError(err))
      throw err
    }
  }

  async function generate(): Promise<void> {
    setGenerationError(null)
    setResult(null)
    setSteps([])
    setDialogOpen(true)
    setGenerating(true)
    try {
      if (status !== 'saved') await save()
      setResult(await window.api.generation.run(memoireId))
      const refreshed = await window.api.memoires.get(memoireId)
      latest.current = refreshed
      setDraft(refreshed)
      setStatus('saved')
    } catch (err) {
      setGenerationError(describeError(err))
    } finally {
      setGenerating(false)
    }
  }

  async function copyAiPrompt(): Promise<void> {
    if (!draft) return
    const text = buildAiInstructions(draft, libraryPath, generalNotes)
    await navigator.clipboard.writeText(text)
    setAiPromptCopied(true)
  }

  /** Réparation ponctuelle : remet les fichiers de contenu au format de la page finale,
   *  pour ceux écrits avant cette règle. Ce qui est créé ou attaché depuis naît conforme. */
  async function conformer(): Promise<void> {
    if (!draft) return
    setConformiteError(null)
    setConforming(true)
    try {
      if (status !== 'saved') await save()
      setConformite(await window.api.generation.conformer(memoireId))
    } catch (err) {
      setConformiteError(describeError(err))
    } finally {
      setConforming(false)
    }
  }

  if (!draft) return <p className="muted">Chargement...</p>

  return (
    <div>
      <div className="editor-head">
        <button className="secondary" onClick={onBack}>
          ← Mes mémoires
        </button>
        <input
          className="memoire-name"
          type="text"
          value={draft.name}
          onChange={(e) => edit((m) => ({ ...m, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {draft.lastGeneratedAt && draft.outputPdf && !dialogOpen && (
          <button
            className="secondary"
            onClick={() => window.api.shell.openPath(draft.outputPdf as string)}
          >
            Ouvrir le dernier PDF
          </button>
        )}
        <button className="primary" onClick={() => void save()} disabled={status !== 'dirty'}>
          Enregistrer
        </button>
        <span className="save-status save-status--inline">
          {saveError ? (
            // Elle dit deja que rien n'est enregistre : repeter le statut a cote n'ajoute
            // rien et les deux textes se retrouvaient colles l'un a l'autre.
            <span className="error-text">{saveError}</span>
          ) : (
            <>
              {status === 'saving' && <span className="muted">Enregistrement...</span>}
              {status === 'saved' && <span className="muted">Enregistré</span>}
              {status === 'dirty' && <span className="muted">Modifications non enregistrées</span>}
            </>
          )}
        </span>
        <button
          className="primary"
          onClick={generate}
          disabled={generating || draft.chapters.length === 0}
          title={draft.chapters.length === 0 ? 'Ajoutez au moins un chapitre avant de générer' : undefined}
        >
          {generating ? 'Génération...' : 'Générer'}
        </button>
        <button className="secondary" onClick={() => void copyAiPrompt()}>
          Copier consigne pour IA
        </button>
        <button
          className="secondary"
          onClick={() => void conformer()}
          disabled={conforming}
          title="Remet les fichiers de contenu au format de la page finale : marges du gabarit, et retrait de leur niveau. Word doit être fermé."
        >
          {conforming ? 'Mise en conformité...' : 'Conformer les contenus'}
        </button>
      </div>

      <MemoirePlanEditor draft={draft} edit={edit} generalNotes={generalNotes} />

      {dialogOpen && (
        <GenerationDialog
          running={generating}
          steps={steps}
          result={result}
          error={generationError}
          onClose={() => {
            setDialogOpen(false)
            setGenerationError(null)
          }}
        />
      )}

      {aiPromptCopied && (
        <Modal
          title="Consigne copiée"
          onClose={() => setAiPromptCopied(false)}
          actions={
            <button className="primary" onClick={() => setAiPromptCopied(false)}>
              Compris
            </button>
          }
        >
          <p>
            Le texte copié explique à l&apos;IA comment fonctionne XSProMemo, lui demande
            de ne rédiger que ce {draft.isTemplate ? 'modèle' : 'mémoire'} précis, et de
            toujours faire une copie de sauvegarde avant de remplacer un fichier existant.
            Collez-le en premier message dans la session IA que vous pointez sur ce
            dossier.
          </p>
          <p className="muted">
            Le résultat dépend du LLM réellement utilisé : certains suivront ces
            consignes à la lettre, d&apos;autres moins bien. Relisez toujours ce qu&apos;il
            a produit, et vérifiez que les copies de sauvegarde attendues ont bien été
            créées avant de faire confiance à ses modifications.
          </p>
        </Modal>
      )}

      {(conformite || conformiteError) && (
        <Modal
          title="Mise en conformité des contenus"
          onClose={() => {
            setConformite(null)
            setConformiteError(null)
          }}
          actions={
            <button
              className="primary"
              onClick={() => {
                setConformite(null)
                setConformiteError(null)
              }}
            >
              Fermer
            </button>
          }
        >
          {conformiteError && <p className="error-text">{conformiteError}</p>}
          {conformite && (
            <>
              {conformite.ajustes.length === 0 && conformite.echecs.length === 0 && (
                <p>
                  Rien à changer : les {conformite.conformes} fichiers de ce mémoire sont
                  déjà au format de la page finale.
                </p>
              )}
              {conformite.ajustes.length > 0 && (
                <>
                  <p>
                    {conformite.ajustes.length === 1
                      ? 'Un fichier a été ajusté'
                      : `${conformite.ajustes.length} fichiers ont été ajustés`}
                    {conformite.conformes > 0 && `, ${conformite.conformes} l'étaient déjà`}. Ils
                    s&apos;ouvrent désormais dans Word tels qu&apos;ils apparaîtront dans le
                    mémoire.
                  </p>
                  <ul>
                    {conformite.ajustes.map((nom) => (
                      <li key={nom}>{nom}</li>
                    ))}
                  </ul>
                  <p className="muted">
                    Une copie de chaque fichier modifié a été gardée à côté, sous le nom
                    « .avant-conformite.bak.docx », pour revenir en arrière au besoin.
                  </p>
                </>
              )}
              {conformite.echecs.length > 0 && (
                <>
                  <p className="error-text">Fichiers laissés tels quels :</p>
                  <ul>
                    {conformite.echecs.map((echec) => (
                      <li key={echec}>{echec}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
