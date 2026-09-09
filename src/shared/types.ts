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
}

export type FolderProbeResult = 'empty' | 'existingLibrary' | 'nonEmptyOther'

export interface GenerationProgressEvent {
  memoireId: string
  message: string
}

export interface GenerationResult {
  docxPath: string
  pdfPath: string
  pageCount: number
  warnings: string[]
}

