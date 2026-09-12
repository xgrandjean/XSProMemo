import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import { HelpButton } from '../components/Help'
import { MemoiresHelp } from '../components/HelpTexts'
import { describeError } from '../lib/describeError'
import type { MemoireSummary } from '../../../shared/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MemoiresListPage({
  onOpen
}: {
  onOpen: (id: string) => void
}): JSX.Element {
  const [memoires, setMemoires] = useState<MemoireSummary[] | null>(null)
  const [templates, setTemplates] = useState<MemoireSummary[]>([])
  const [templateId, setTemplateId] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<MemoireSummary | null>(null)
  const [toDuplicate, setToDuplicate] = useState<MemoireSummary | null>(null)
  const [duplicateName, setDuplicateName] = useState('')

  function refresh(): void {
    window.api.memoires.list().then(setMemoires)
  }

  useEffect(refresh, [])

  // Loaded once: which modèle a new mémoire starts from. With a single one (the common
  // case) the picker stays hidden and that one is used directly — no added friction.
  useEffect(() => {
    window.api.memoires.listTemplates().then((list) => {
      setTemplates(list)
      setTemplateId((current) => current || list[0]?.id || '')
    })
  }, [])

  async function create(): Promise<void> {
    const name = newName.trim()
    if (!name || !templateId) return
    setBusy(true)
    setError(null)
    try {
      const created = await window.api.memoires.create(name, templateId)
      setNewName('')
      onOpen(created.id)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  function askDuplicate(memoire: MemoireSummary): void {
    setToDuplicate(memoire)
    setDuplicateName(`${memoire.name} (copie)`)
  }

  async function confirmDuplicate(): Promise<void> {
    if (!toDuplicate || !duplicateName.trim()) return
    const source = toDuplicate
    setToDuplicate(null)
    setBusy(true)
    try {
      const created = await window.api.memoires.duplicate(source.id, duplicateName.trim())
      onOpen(created.id)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!toDelete) return
    const target = toDelete
    setToDelete(null)
    setBusy(true)
    try {
      await window.api.memoires.delete(target.id)
      refresh()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="panel-head" style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Mes mémoires</h1>
        <HelpButton title="Mes mémoires">
          <MemoiresHelp />
        </HelpButton>
      </div>

      <div className="panel">
        <div className="row">
          <input
            type="text"
            placeholder="Nom du nouveau mémoire (ex : AO Village Artisanal du Marin)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          {templates.length > 1 && (
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button className="primary" onClick={create} disabled={busy || !newName.trim() || !templateId}>
            Nouveau mémoire
          </button>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Un nouveau mémoire part d&apos;un modèle défini dans la configuration : vous
          n&apos;avez plus qu&apos;à retirer, ajouter et renommer ce qu&apos;il faut.
        </p>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="panel">
        {memoires === null && <p className="muted">Chargement...</p>}
        {memoires?.length === 0 && <p className="muted">Aucun mémoire pour le moment.</p>}
        {memoires?.map((memoire) => (
          <div className="list-item" key={memoire.id}>
            <div>
              <div className="item-title">{memoire.name}</div>
              <div className="muted">
                Modifié le {formatDate(memoire.updatedAt)}
                {memoire.lastGeneratedAt
                  ? ` · généré le ${formatDate(memoire.lastGeneratedAt)}`
                  : ' · jamais généré'}
              </div>
            </div>
            <div className="row">
              <button className="primary" onClick={() => onOpen(memoire.id)}>
                Ouvrir
              </button>
              <button className="secondary" onClick={() => askDuplicate(memoire)}>
                Dupliquer
              </button>
              <button className="danger" onClick={() => setToDelete(memoire)}>
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {toDuplicate && (
        <Modal
          title="Dupliquer le mémoire"
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
            <label>Nom de la copie</label>
            <input
              type="text"
              autoFocus
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmDuplicate()}
            />
          </div>
          <p className="muted">
            La copie est indépendante : la modifier ne touchera pas au mémoire d&apos;origine.
          </p>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="Supprimer le mémoire"
          onClose={() => setToDelete(null)}
          actions={
            <>
              <button className="secondary" onClick={() => setToDelete(null)}>
                Annuler
              </button>
              <button className="danger" onClick={confirmDelete}>
                Supprimer définitivement
              </button>
            </>
          }
        >
          <p>
            Supprimer « <b>{toDelete.name}</b> » ?
          </p>
          <p className="muted">
            Son plan est perdu. Les fichiers de contenu, eux, restent disponibles pour vos
            autres mémoires.
          </p>
        </Modal>
      )}
    </div>
  )
}
