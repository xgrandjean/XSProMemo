export type Orientation = 'portrait' | 'paysage'

/**
 * A content file attached to a chapter, or used as a cover page. Always a .docx: the
 * document is assembled as one Word file, so mixing formats would defeat the point.
 * The file holds content only — chapter titles are added by the application.
 */
export interface ContentRef {
  /** File name inside the contents folder — readable, so it can be found and replaced. */
  file: string
  originalName: string
}

/** 'logo' sits at the top right of every page, 'secondLogo' at the top left. */
export type LogoField = 'logo' | 'secondLogo'

export interface ChapterNode {
  id: string
  title: string
  pageBreakBefore: boolean
  orientation: Orientation
  content: ContentRef | null // null = heading only, no content of its own
  children: ChapterNode[]
  /** Purely a visual marker in the editor — never read by the generator. Absent on a
   *  plan saved before this field existed, which must read the same as false. */
  validated?: boolean
}

/** One mémoire = one document being built. It owns its whole plan directly. */
export interface Memoire {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  coverPages: ContentRef[] // first, unnumbered, absent from the table of contents
  chapters: ChapterNode[]
  /**
   * This mémoire's own logo (top right), independent of the shared template's. Set from
   * the example at creation time, then editable from the mémoire's own plan screen
   * without affecting the example or any other mémoire.
   */
  logo: ContentRef | null
  /** A second logo, top left — typically a partner's or a client's, for this one mémoire. */
  secondLogo: ContentRef | null
  /**
   * A modèle offered as a starting point for "Nouveau mémoire", rather than a working
   * mémoire in progress. Just a flag — a modèle is a mémoire like any other, editable the
   * same way, only reached from a different screen and excluded from the working list.
   */
  isTemplate: boolean
  lastGeneratedAt: string | null
  outputDocx: string | null
  outputPdf: string | null
}

export interface MemoireSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  lastGeneratedAt: string | null
}

/** The frozen part, edited behind the configuration screen. */
export interface ModelConfig {
  sommaireTitle: string
  /** Appended to every "Copier consigne pour IA" text — house tone/style, set once. */
  aiInstructions: string
  /**
   * App version that last touched this library's gabarit (created it, or the user
   * applied/dismissed an update prompt for it). Compared against the running app's own
   * version to decide whether a newer shipped gabarit should be offered.
   */
  gabaritVersion: string
}

/** What the configuration screen shows about the template and the data folder. */
export interface ModelStatus {
  config: ModelConfig
  /** Absolute path of the folder holding everything the application owns. */
  dataFolder: string
  templatePath: string
  templateExists: boolean
  /** Where the library actually lives, and whether that's the default location. */
  library: { path: string; isDefault: boolean }
  /** True once the running app ships a gabarit newer than the one this library last saw. */
  gabaritUpdateAvailable: boolean
}

export type FolderProbeResult = 'empty' | 'existingLibrary' | 'nonEmptyOther'

/**
 * What an empty folder should be given when it becomes the working folder: the shipped
 * gabarit and neutral example (`fresh`), or this machine's gabarit, settings and modèles
 * (`templates`). Working mémoires and generated documents are never carried over — moving
 * a whole working folder is a copy/paste in the file explorer, after which the folder is
 * simply joined as it stands.
 */
export type LibrarySetupMode = 'fresh' | 'templates'

export interface GenerationProgressEvent {
  memoireId: string
  message: string
}

/** Ce qu'a donné une mise en conformité des contenus d'un mémoire. */
export interface ConformiteResult {
  /** Les fichiers effectivement modifiés, par leur libellé dans le plan. */
  ajustes: string[]
  /** Ceux qui étaient déjà au format de la page finale. */
  conformes: number
  /** Introuvables ou refusés par Word : signalés, jamais silencieux. */
  echecs: string[]
}

export interface GenerationResult {
  docxPath: string
  /** Null when the PDF could not be written — most often because a reader was holding it
   *  open. The Word document is produced either way; a stale PDF from an earlier run may
   *  still sit at that path, which is precisely why nothing points at it. */
  pdfPath: string | null
  pageCount: number
  warnings: string[]
}

