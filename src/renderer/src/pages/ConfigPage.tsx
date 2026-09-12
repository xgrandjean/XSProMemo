import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import { HelpButton } from '../components/Help'
import { GabaritHelp, BibliothequeHelp, ModelesHelp } from '../components/HelpTexts'
import type { FolderProbeResult, MemoireSummary, ModelStatus } from '../../../shared/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ConfigPage({
  onBack,
  onOpen
}: {
  onBack: () => void
  onOpen: (id: string) => void
}): JSX.Element {
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [sommaireTitle, setSommaireTitle] = useState('')
  const [aiInstructions, setAiInstructions] = useState('')
  const [templates, setTemplates] = useState<MemoireSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)

  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{
    path: string
    probe: FolderProbeResult
  } | null>(null)

  const [toDuplicate, setToDuplicate] = useState<MemoireSummary | null>(null)
  const [duplicateName, setDuplicateName] = useState('')

  useEffect(() => {
    window.api.model.get().then((s) => {
      setStatus(s)
      setSommaireTitle(s.config.sommaireTitle)
      setAiInstructions(s.config.aiInstructions)
    })
    refreshTemplates()
  }, [])

  function refreshTemplates(): void {
    window.api.memoires.listTemplates().then(setTemplates)
  }

  async function run(action: () => Promise<ModelStatus>): Promise<void> {
    setError(null)
    try {
      setStatus(await action())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveSommaireTitle(): Promise<void> {
    if (!status || sommaireTitle.trim() === status.config.sommaireTitle) return
    await run(() => window.api.model.setSommaireTitle(sommaireTitle))
  }

  async function saveAiInstructions(): Promise<void> {
    if (!status || aiInstructions === status.config.aiInstructions) return
    await run(() => window.api.model.setAiInstructions(aiInstructions))
  }

  async function previewStyles(): Promise<void> {
    setError(null)
    setPreviewBusy(true)
    try {
      await window.api.model.previewStyles()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreviewBusy(false)
    }
  }

  async function chooseFolder(): Promise<void> {
    const folder = await window.api.dialogs.pickFolder()
    if (!folder) return
    setLibraryError(null)
    try {
      const probe = await window.api.model.probeLibraryFolder(folder)
      if (probe === 'nonEmptyOther') {
        setLibraryError(
          "Ce dossier contient déjà autre chose et ne ressemble pas à une bibliothèque XSProMemo."
        )
        return
      }
      setConfirmTarget({ path: folder, probe })
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : String(err))
    }
  }

  async function confirmChooseFolder(): Promise<void> {
    if (!confirmTarget) return
    setLibraryBusy(true)
    setLibraryError(null)
    try {
      await window.api.model.chooseLibraryFolder(confirmTarget.path)
      // The application relaunches itself on success — nothing left to do here.
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : String(err))
      setLibraryBusy(false)
      setConfirmTarget(null)
    }
  }

  async function useDefaultLibrary(): Promise<void> {
    setLibraryBusy(true)
    setLibraryError(null)
    try {
      await window.api.model.useDefaultLibrary()
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : String(err))
      setLibraryBusy(false)
    }
  }

  function askDuplicate(template: MemoireSummary): void {
    setToDuplicate(template)
    setDuplicateName(`${template.name} (copie)`)
  }

  async function confirmDuplicate(): Promise<void> {
    if (!toDuplicate || !duplicateName.trim()) return
    const source = toDuplicate
    setToDuplicate(null)
    setBusy(true)
    setError(null)
    try {
      await window.api.memoires.duplicate(source.id, duplicateName.trim())
      refreshTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function deleteTemplate(template: MemoireSummary): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await window.api.memoires.delete(template.id)
      refreshTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className="muted">Chargement...</p>

  return (
    <div>
      <div className="editor-head">
        <button className="secondary" onClick={onBack}>
          ← Mes mémoires
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>Configuration</h1>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Présentation</h2>
          <HelpButton title="La présentation du document">
            <GabaritHelp />
          </HelpButton>
          <span className="muted">
            Ce qui habille chaque page produite : les styles, le format et le pied de
            page.
          </span>
        </div>

        <div className="field" style={{ maxWidth: 320 }}>
          <label>Titre de la page de sommaire</label>
          <input
            type="text"
            value={sommaireTitle}
            onChange={(e) => setSommaireTitle(e.target.value)}
            onBlur={saveSommaireTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>

        <div className="field" style={{ maxWidth: 480 }}>
          <label>Consignes générales pour l&apos;IA</label>
          <textarea
            rows={3}
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
            onBlur={saveAiInstructions}
            placeholder="Ton, style, vocabulaire métier à respecter..."
          />
          <span className="muted">
            Ajouté à la fin de chaque « Copier consigne pour IA », dans l&apos;éditeur
            d&apos;un mémoire ou d&apos;un modèle.
          </span>
        </div>

        <div className="row">
          <button className="secondary" onClick={() => window.api.model.openTemplate()}>
            Ouvrir le gabarit dans Word
          </button>
          <button className="secondary" onClick={() => void previewStyles()} disabled={previewBusy}>
            {previewBusy ? 'Génération...' : 'Aperçu du style'}
          </button>
          <button className="secondary" onClick={() => window.api.model.openDataFolder()}>
            Ouvrir le dossier de l&apos;application
          </button>
        </div>

        {!status.templateExists && (
          <p className="error-text">
            Le gabarit est absent du dossier. Relancez l&apos;application pour qu&apos;elle le
            rétablisse.
          </p>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Emplacement de la bibliothèque</h2>
          <HelpButton title="L'emplacement de la bibliothèque">
            <BibliothequeHelp />
          </HelpButton>
          <span className="muted">
            Où vivent le gabarit, vos contenus, vos modèles et vos mémoires.
          </span>
        </div>

        <p style={{ marginBottom: 8 }}>
          <code>{status.library.path}</code>
          {status.library.isDefault && (
            <span className="badge" style={{ marginLeft: 8 }}>
              emplacement par défaut
            </span>
          )}
        </p>

        <div className="row">
          <button
            className="secondary"
            onClick={chooseFolder}
            disabled={libraryBusy}
            title="Ouvrir un dossier — emplacement de la bibliothèque"
          >
            Ouvrir un dossier
          </button>
          <button
            className="secondary"
            onClick={chooseFolder}
            disabled={libraryBusy}
            title="Créer un dossier — emplacement de la bibliothèque (doit être vide)"
          >
            Créer un dossier
          </button>
          {!status.library.isDefault && (
            <button className="secondary" onClick={useDefaultLibrary} disabled={libraryBusy}>
              Revenir à l&apos;emplacement par défaut
            </button>
          )}
        </div>
        {libraryBusy && <p className="muted">Redémarrage en cours...</p>}
        {libraryError && <p className="error-text">{libraryError}</p>}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Modèles</h2>
          <HelpButton title="Les modèles">
            <ModelesHelp />
          </HelpButton>
          <span className="muted">
            Le ou les points de départ proposés pour « Nouveau mémoire ».
          </span>
        </div>

        {templates === null && <p className="muted">Chargement...</p>}
        {templates?.map((template) => (
          <div className="list-item" key={template.id}>
            <div>
              <div className="item-title">{template.name}</div>
              <div className="muted">Modifié le {formatDate(template.updatedAt)}</div>
            </div>
            <div className="row">
              <button className="primary" onClick={() => onOpen(template.id)}>
                Ouvrir
              </button>
              <button className="secondary" onClick={() => askDuplicate(template)} disabled={busy}>
                Dupliquer
              </button>
              <button className="danger" onClick={() => deleteTemplate(template)} disabled={busy}>
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmTarget && (
        <Modal
          title="Choisir ce dossier"
          onClose={() => (libraryBusy ? undefined : setConfirmTarget(null))}
          dismissable={!libraryBusy}
          actions={
            <>
              <button
                className="secondary"
                onClick={() => setConfirmTarget(null)}
                disabled={libraryBusy}
              >
                Annuler
              </button>
              <button className="primary" onClick={confirmChooseFolder} disabled={libraryBusy}>
                {libraryBusy ? 'En cours...' : 'Confirmer'}
              </button>
            </>
          }
        >
          {confirmTarget.probe === 'empty' ? (
            <p>
              Ce dossier est vide : tout le contenu actuel (gabarit, contenus, modèles,
              mémoires) y sera recopié, puis l&apos;application redémarrera sur ce nouvel
              emplacement.
            </p>
          ) : (
            <p>
              Ce dossier contient déjà une bibliothèque XSProMemo : l&apos;application va la
              rejoindre telle quelle, sans rien recopier, puis redémarrer.
            </p>
          )}
          <p className="muted">
            <code>{confirmTarget.path}</code>
          </p>
        </Modal>
      )}

      {toDuplicate && (
        <Modal
          title="Dupliquer le modèle"
          onClose={() => setToDuplicate(null)}
          actions={
            <>
              <button className="secondary" onClick={() => setToDuplicate(null)}>
                Annuler
              </button>
              <button className="primary" onClick={confirmDuplicate} disabled={!duplicateName.trim()}>
                Dupliquer
              </button>
            </>
          }
        >
          <div className="field">
            <label>Nom du nouveau modèle</label>
            <input
              type="text"
              autoFocus
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmDuplicate()}
            />
          </div>
          <p className="muted">
            La copie est indépendante : la modifier ne touchera pas au modèle d&apos;origine.
          </p>
        </Modal>
      )}
    </div>
  )
}
