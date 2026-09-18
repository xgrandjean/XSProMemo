import Modal from './Modal'
import type { GenerationResult } from '../../../shared/types'

/**
 * Generation happens in a dialog rather than a panel further down the page: the button
 * sits at the top, and a result appearing below the fold went unnoticed.
 */
export default function GenerationDialog({
  running,
  steps,
  result,
  error,
  onClose
}: {
  running: boolean
  steps: string[]
  result: GenerationResult | null
  error: string | null
  onClose: () => void
}): JSX.Element {
  const currentStep = steps[steps.length - 1] ?? 'Démarrage...'
  const previousSteps = steps.slice(0, -1).slice(-6)

  return (
    <Modal
      title={running ? 'Génération en cours' : error ? 'La génération a échoué' : 'Mémoire généré'}
      onClose={onClose}
      dismissable={!running}
      actions={
        running ? undefined : (
          <>
            <button className="secondary" onClick={onClose}>
              Fermer
            </button>
            {result && (
              <>
                {/* Sans PDF, c'est le Word qui devient l'action principale : il n'y a pas
                    d'autre document à ouvrir, et celui de la fois précédente ne correspond
                    plus à ce qui vient d'être assemblé. */}
                <button
                  className={result.pdfPath ? 'secondary' : 'primary'}
                  onClick={() => window.api.shell.openPath(result.docxPath)}
                >
                  Ouvrir le Word
                </button>
                {result.pdfPath && (
                  <button
                    className="primary"
                    onClick={() => window.api.shell.openPath(result.pdfPath as string)}
                  >
                    Ouvrir le PDF
                  </button>
                )}
              </>
            )}
          </>
        )
      }
    >
      {running && (
        <div className="generation-live">
          <span className="generation-spinner" aria-hidden="true" />
          <div>
            <div className="generation-step">{currentStep}</div>
            <div className="muted">Word travaille en arrière-plan, cela peut prendre un moment.</div>
          </div>
        </div>
      )}

      {previousSteps.length > 0 && (
        <ul className="generation-history">
          {previousSteps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ul>
      )}

      {error && <p className="error-text">{error}</p>}

      {result && (
        <>
          <p>
            <span className="badge ok">{result.pageCount} pages</span>
          </p>
          {result.warnings.length > 0 && (
            <>
              <p className="muted">Points à vérifier :</p>
              <ul>
                {result.warnings.map((warning, index) => (
                  <li key={index} className="muted">
                    {warning}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
