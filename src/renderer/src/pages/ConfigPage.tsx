import { useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal'
import { HelpButton } from '../components/Help'
import DropdownMenu, { type DropdownMenuItem } from '../components/DropdownMenu'
import { GabaritHelp, BibliothequeHelp, ModelesHelp } from '../components/HelpTexts'
import { describeError } from '../lib/describeError'
import { buildGabaritAiInstructions } from '../lib/aiInstructions'
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
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [gabaritMenuOpen, setGabaritMenuOpen] = useState(false)
  const [gabaritPromptCopied, setGabaritPromptCopied] = useState(false)
  const [showGabaritHelp, setShowGabaritHelp] = useState(false)
  const gabaritTriggerRef = useRef<HTMLButtonElement>(null)

  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{
    path: string
    probe: FolderProbeResult
  } | null>(null)

  const [toDuplicate, setToDuplicate] = useState<MemoireSummary | null>(null)
  const [duplicateName, setDuplicateName] = useState('')
  const [toDeleteTemplate, setToDeleteTemplate] = useState<MemoireSummary | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [importingTemplate, setImportingTemplate] = useState(false)

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
      setError(describeError(err))
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
      setError(describeError(err))
    } finally {
      setPreviewBusy(false)
    }
  }

  async function copyGabaritAiPrompt(): Promise<void> {
    if (!status) return
    const text = buildGabaritAiInstructions(status.library.path, aiInstructions)
    await navigator.clipboard.writeText(text)
    setGabaritPromptCopied(true)
  }

  async function confirmRestoreDefaultTemplate(): Promise<void> {
    setConfirmRestore(false)
    setRestoreBusy(true)
    setError(null)
    try {
      setStatus(await window.api.model.applyGabaritUpdate())
    } catch (err) {
      setError(describeError(err))
    } finally {
      setRestoreBusy(false)
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
      setLibraryError(describeError(err))
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
      setLibraryError(describeError(err))
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
      setLibraryError(describeError(err))
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
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteTemplate(): Promise<void> {
    if (!toDeleteTemplate) return
    const target = toDeleteTemplate
    setToDeleteTemplate(null)
    setBusy(true)
    setError(null)
    try {
      await window.api.memoires.delete(target.id)
      refreshTemplates()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function exportTemplate(template: MemoireSummary): Promise<void> {
    const defaultName = `${template.name.replace(/[\\/:*?"<>|]/g, '_')}.xspromemo.zip`
    const target = await window.api.dialogs.pickSaveZip(defaultName)
    if (!target) return
    setExportingId(template.id)
    setError(null)
    try {
      await window.api.memoires.export(template.id, target)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setExportingId(null)
    }
  }

  async function importTemplate(): Promise<void> {
    const source = await window.api.dialogs.pickZip()
    if (!source) return
    setImportingTemplate(true)
    setError(null)
    try {
      const created = await window.api.memoires.import(source)
      onOpen(created.id)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setImportingTemplate(false)
    }
  }

  if (!status) return <p className="muted">Chargement...</p>

  const gabaritMenuItems: DropdownMenuItem[] = [
    { label: 'Aperçu', onSelect: () => void previewStyles() },
    { label: 'Ouvrir le gabarit dans Word', onSelect: () => window.api.model.openTemplate() },
    { label: 'Copier consigne pour IA', onSelect: () => void copyGabaritAiPrompt(), separatorBefore: true },
    { label: 'Aide', onSelect: () => setShowGabaritHelp(true), separatorBefore: true }
  ]

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
          <button
            ref={gabaritTriggerRef}
            className="secondary"
            onClick={() => setGabaritMenuOpen(true)}
            disabled={previewBusy}
          >
            {previewBusy ? 'Génération...' : 'Aperçu du style'}
          </button>
          {gabaritMenuOpen && (
            <DropdownMenu
              anchor="trigger"
              triggerRef={gabaritTriggerRef}
              items={gabaritMenuItems}
              onClose={() => setGabaritMenuOpen(false)}
            />
          )}
          <button
            className="secondary"
            onClick={() => setConfirmRestore(true)}
            disabled={restoreBusy}
          >
            {restoreBusy ? 'Restauration...' : 'Restaurer le gabarit par défaut'}
          </button>
          <button
            className="icon-btn"
            title="Aller dans le dossier de l&apos;application"
            onClick={() => window.api.model.openDataFolder()}
          >
            👁
          </button>
        </div>

        {status.gabaritUpdateAvailable && (
          <p className="muted">
            Une version plus récente du gabarit par défaut est disponible (styles de
            titre notamment). « Restaurer le gabarit par défaut » l&apos;applique.
          </p>
        )}

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
          <button
            className="icon-btn"
            title="Importer un modèle (.zip)"
            onClick={() => void importTemplate()}
            disabled={importingTemplate}
          >
            📥
          </button>
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
              <button
                className="icon-btn danger-link"
                title="Supprimer"
                onClick={() => setToDeleteTemplate(template)}
                disabled={busy}
              >
                ✕
              </button>
              <button
                className="icon-btn"
                title="Exporter (.zip)"
                onClick={() => void exportTemplate(template)}
                disabled={exportingId === template.id}
              >
                📤
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

      {gabaritPromptCopied && (
        <Modal
          title="Consigne copiée"
          onClose={() => setGabaritPromptCopied(false)}
          actions={
            <button className="primary" onClick={() => setGabaritPromptCopied(false)}>
              Compris
            </button>
          }
        >
          <p>
            Le texte copié explique à l&apos;IA comment fonctionne XSProMemo et lui
            demande de ne modifier que le gabarit, en faisant une copie de sauvegarde
            avant tout changement. Collez-le en premier message dans la session IA que
            vous pointez sur ce dossier.
          </p>
          <p className="muted">
            Le résultat dépend du LLM réellement utilisé : relisez toujours ce qu&apos;il
            a produit, et vérifiez le rendu avec « Aperçu » avant de faire confiance à ses
            modifications — une erreur ici affecte tous les mémoires, pas un seul.
          </p>
        </Modal>
      )}

      {showGabaritHelp && (
        <Modal title="La présentation du document" onClose={() => setShowGabaritHelp(false)}>
          <GabaritHelp />
        </Modal>
      )}

      {confirmRestore && (
        <Modal
          title="Restaurer le gabarit par défaut"
          onClose={() => (restoreBusy ? undefined : setConfirmRestore(false))}
          dismissable={!restoreBusy}
          actions={
            <>
              <button
                className="secondary"
                onClick={() => setConfirmRestore(false)}
                disabled={restoreBusy}
              >
                Annuler
              </button>
              <button className="primary" onClick={confirmRestoreDefaultTemplate} disabled={restoreBusy}>
                {restoreBusy ? 'En cours...' : 'Restaurer'}
              </button>
            </>
          }
        >
          <p>
            Remplace le gabarit actuel (styles, marges, en-tête, pied de page, logo par
            défaut) par celui livré avec l&apos;application. Une copie de l&apos;actuel est
            gardée à côté au cas où, mais toute personnalisation manuelle du gabarit non
            reportée dans celui livré sera remplacée.
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

      {toDeleteTemplate && (
        <Modal
          title="Supprimer le modèle"
          onClose={() => setToDeleteTemplate(null)}
          actions={
            <>
              <button className="secondary" onClick={() => setToDeleteTemplate(null)}>
                Annuler
              </button>
              <button className="danger" onClick={confirmDeleteTemplate}>
                Supprimer définitivement
              </button>
            </>
          }
        >
          <p>
            Supprimer « <b>{toDeleteTemplate.name}</b> » ?
          </p>
          <p className="muted">
            Ses fichiers de contenu partent avec lui — ils n&apos;appartiennent qu&apos;à ce
            modèle. Ils sont mis de côté dans <b>contenus\_corbeille</b>, d&apos;où vous
            pouvez les récupérer. Les mémoires déjà créés à partir de ce modèle gardent les
            leurs, qui sont des copies. Si c&apos;était le dernier modèle, l&apos;exemple
            livré avec l&apos;application sera recréé automatiquement.
          </p>
        </Modal>
      )}
    </div>
  )
}
