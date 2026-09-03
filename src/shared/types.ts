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
   * This mémoire's own logo, independent of the shared template's. Set from the
   * default at creation time, then editable from the mémoire's own plan screen without
   * affecting the default or any other mémoire.
   */
  logo: ContentRef | null
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
  exampleId: string | null
}

/** What the configuration screen shows about the template and the data folder. */
export interface ModelStatus {
  config: ModelConfig
  /** Absolute path of the folder holding everything the application owns. */
  dataFolder: string
  templatePath: string
  templateExists: boolean
}

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

